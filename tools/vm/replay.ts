// A worker that restores a saved state as the page does and runs the boot after it in one
// power-on display mode, then switches modes as resizes while running do, recording every disk
// block the guest reads (tools/vm/snapshot.ts).
//
// The run asks RESCHG.EXE, listening in the state, for the first mode right after it starts, as
// the page does at power-on; Netscape then opens lexo.cool and renders the page's homepage. Once
// the disks went quiet after Netscape's request, the run asks for each further mode in turn, as
// the page does when the viewport changes, each once the disks went quiet after the one before.
// The run ends once they went quiet after the last.
import { join } from "node:path";
import { GUEST_IMAGES, GUEST_IMAGE_TYPE, PAGES, mailAddressOf } from "../../guest-pages.js";
import { logReads, newReadLog } from "./reads.ts";

declare const self: Worker;

/** Wall-clock budget from the run's start to Netscape's request for http://lexo.cool/. */
const NETSCAPE_DEADLINE_MS = 300_000;
/**
 * After Netscape's request, a run ends once no disk was read for this long: Explorer and
 * Netscape keep paging in code and data in the background, as the visitor's machine does.
 */
const DISK_QUIET_MS = 3_000;
/** Wall-clock budget from Netscape's request, or from a switch, to the quiet disk. */
const QUIET_DEADLINE_MS = 120_000;
/** Wall-clock budget from asking RESCHG.EXE for a mode while running to its RESCHG_OK. */
const SWITCH_DEADLINE_MS = 60_000;
/** Interval at which the run asks the SB16 for samples, standing in for a speaker. */
const SPEAKER_PULL_MS = 10;
const HOMEPAGE_HOST = "lexo.cool";

export interface ReplayRequest {
  libv86: string;
  /** V86 options the state was saved with, less the state itself. */
  options: Record<string, unknown>;
  state: ArrayBuffer;
  /** The modes the run asks for in turn: the power-on mode, then the switches of resizes while running. */
  modes: [number, number][];
  /** Directory holding the generated files GUEST_IMAGES names (the build's output directory). */
  assetsDir: string;
  /** Returns the guest's screen once the disks went quiet in the power-on mode (the homepage rendered). */
  capture: boolean;
}

/** The guest's screen, `width` x `height` pixels of RGBA. */
export interface Frame {
  width: number;
  height: number;
  rgba: Uint8Array;
}

/** What the guest read from the request for one mode to the quiet disk after it. */
export interface ReplayStep {
  /** Indices of the blocks the guest read, per disk. */
  reads: { hda: number[]; hdb: number[] };
  /** Reads the state's block caches could not serve, per disk. */
  misses: { hda: number; hdb: number };
}

export interface ReplayResult {
  /** One step per mode of the request, in its order. */
  steps: ReplayStep[];
  /** The screen once the disk went quiet in the power-on mode, when the request asked for it. */
  frame?: Frame;
}

export type ReplayReply = { ok: true; result: ReplayResult } | { ok: false; error: string };

function deadline(ms: number, what: string): { promise: Promise<never>; clear(): void } {
  let timer: Timer;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not happen within ${ms / 1000} s`)), ms);
  });
  return { promise, clear: () => clearTimeout(timer) };
}

/**
 * v86 keeps the guest's screen in an ImageData over its WebAssembly memory, which only exists in
 * a browser; the capture run gets the same shape of object, so v86 renders into it unchanged.
 */
class ImageDataOverBuffer {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number,
  ) {}
}

/** The visible screen out of the VGA device's rendered buffer, whose rows are `virtual_width` wide. */
function readFrame(vga: any): Frame {
  if (!vga.graphical_mode) throw new Error("the guest's screen is not in a graphics mode");
  vga.screen_fill_buffer();
  const { screen_width: width, screen_height: height, virtual_width: stride } = vga;
  const data: Uint8ClampedArray | undefined = vga.image_data?.data;
  if (!data || data.byteLength < stride * height * 4) throw new Error("v86 rendered no screen buffer");
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) rgba.set(data.subarray(y * stride * 4, (y * stride + width) * 4), y * width * 4);
  return { width, height, rgba };
}

async function replay({ libv86, options, state, modes, assetsDir, capture }: ReplayRequest): Promise<ReplayResult> {
  if (modes.length === 0) throw new Error("a run needs a power-on mode");
  if (capture) (globalThis as any).ImageData = ImageDataOverBuffer;
  const { V86 } = await import(libv86);
  let homepageRequested: () => void = () => {};
  const homepage = new Promise<void>((resolve) => (homepageRequested = resolve));
  // Guest HTTP goes through the global fetch (network_relay_url "fetch"): Netscape gets the
  // homepage the page serves, so it renders, and reads from disk, what it renders for the visitor.
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== HOMEPAGE_HOST) return new Response("not served by the generator", { status: 404 });
    const image = GUEST_IMAGES[url.pathname as keyof typeof GUEST_IMAGES];
    if (image !== undefined) return new Response(Bun.file(join(assetsDir, image)), { headers: { "Content-Type": GUEST_IMAGE_TYPE } });
    if (mailAddressOf(url.pathname) !== undefined) return new Response(null, { status: 204 });
    if (url.pathname !== "/") return new Response("not served by the generator", { status: 404 });
    homepageRequested();
    return new Response(PAGES["/"], { headers: { "Content-Type": "text/html" } });
  }) as typeof fetch;

  const emulator = new V86({ ...options, initial_state: { buffer: state }, autostart: false });
  try {
    await new Promise<void>((resolve) => emulator.add_listener("emulator-loaded", resolve));
    const { primary } = emulator.v86.cpu.devices.ide;
    const logs = { hda: newReadLog(), hdb: newReadLog() };
    logReads(primary.master.buffer, logs.hda);
    logReads(primary.slave.buffer, logs.hdb);
    // Ends a step: what the logs hold goes to it, and they start over for the next.
    const takeStep = (): ReplayStep => {
      const step = {
        reads: { hda: [...logs.hda.blocks], hdb: [...logs.hdb.blocks] },
        misses: { hda: logs.hda.misses, hdb: logs.hdb.misses },
      };
      for (const log of [logs.hda, logs.hdb]) {
        log.blocks = new Set();
        log.misses = 0;
      }
      return step;
    };

    let failRun: (e: Error) => void = () => {};
    const runFailed = new Promise<never>((_, reject) => (failRun = reject));
    let switched: () => void = () => {};
    let asked: [number, number] = modes[0];
    let line = "";
    emulator.add_listener("serial0-output-byte", (byte: number) => {
      const c = String.fromCharCode(byte);
      if (c !== "\n") {
        line += c;
        return;
      }
      const done = line;
      line = "";
      if (done === "RESCHG_ERR") failRun(new Error(`RESCHG.EXE could not switch the display to ${asked.join("x")}`));
      if (done === "RESCHG_READY") failRun(new Error("RESCHG.EXE started after the snapshot"));
      if (done === "RESCHG_OK") switched();
    });
    /** Asks RESCHG.EXE for `mode`; resolves on its RESCHG_OK, with `performance.now()` then. */
    const switchTo = (mode: [number, number]): Promise<number> => {
      asked = mode;
      const ok = new Promise<number>((resolve) => (switched = () => resolve(performance.now())));
      emulator.serial0_send(`RES ${mode[0]} ${mode[1]}\n`);
      return ok;
    };
    /** Resolves once no disk was read for DISK_QUIET_MS, counting from `since` at the earliest. */
    const quiet = async (since: number, after: string) => {
      const quietBy = performance.now() + QUIET_DEADLINE_MS;
      while (performance.now() - Math.max(logs.hda.last, logs.hdb.last, since) < DISK_QUIET_MS) {
        if (performance.now() > quietBy) throw new Error(`the disks were still read ${QUIET_DEADLINE_MS / 1000} s after ${after}`);
        await Promise.race([Bun.sleep(DISK_QUIET_MS / 10), runFailed]);
      }
    };
    const steps: ReplayStep[] = [];
    let frame: Frame | undefined;
    let dacEnabled = true;
    emulator.add_listener("dac-enable", () => (dacEnabled = true));
    emulator.add_listener("dac-disable", () => (dacEnabled = false));
    const pull = setInterval(() => dacEnabled && emulator.bus.send("dac-request-data"), SPEAKER_PULL_MS);
    try {
      const [powerOn, ...resizes] = modes;
      const verify = deadline(NETSCAPE_DEADLINE_MS, "Netscape's request for http://lexo.cool/");
      emulator.run();
      const poweredOn = switchTo(powerOn);
      await Promise.race([Promise.all([homepage, poweredOn]), verify.promise, runFailed]).finally(verify.clear);
      await quiet(performance.now(), "Netscape's request");
      if (capture) frame = readFrame(emulator.v86.cpu.devices.vga);
      steps.push(takeStep());
      for (const mode of resizes) {
        const what = `the switch to ${mode.join("x")}`;
        const switchBy = deadline(SWITCH_DEADLINE_MS, what);
        const at = await Promise.race([switchTo(mode), switchBy.promise, runFailed]).finally(switchBy.clear);
        await quiet(at, what);
        steps.push(takeStep());
      }
    } finally {
      clearInterval(pull);
      await emulator.stop();
    }
    return { steps, frame };
  } finally {
    await emulator.destroy();
  }
}

self.onmessage = async (event: MessageEvent<ReplayRequest>) => {
  let reply: ReplayReply;
  try {
    reply = { ok: true, result: await replay(event.data) };
  } catch (e) {
    reply = { ok: false, error: e instanceof Error ? (e.stack ?? e.message) : String(e) };
  }
  postMessage(reply);
};
