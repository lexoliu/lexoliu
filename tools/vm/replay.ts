// A worker that restores a saved state as the page does and runs the boot after it in one
// power-on display mode, recording every disk block the guest reads (tools/vm/snapshot.ts).
//
// The run asks RESCHG.EXE, listening in the state, for the mode right after it starts, as the
// page does at power-on; Netscape then opens lexo.cool and renders the page's homepage. The run
// ends once the disks went quiet after Netscape's request.
import { PAGES } from "../../guest-pages.js";

declare const self: Worker;

/** Wall-clock budget from the run's start to Netscape's request for http://lexo.cool/. */
const NETSCAPE_DEADLINE_MS = 300_000;
/**
 * After Netscape's request, a run ends once no disk was read for this long: Explorer and
 * Netscape keep paging in code and data in the background, as the visitor's machine does.
 */
const DISK_QUIET_MS = 3_000;
/** Wall-clock budget from Netscape's request to the quiet disk. */
const QUIET_DEADLINE_MS = 120_000;
/** Interval at which the run asks the SB16 for samples, standing in for a speaker. */
const SPEAKER_PULL_MS = 10;
const HOMEPAGE_HOST = "lexo.cool";
/** v86's disk buffer cache granularity (src/buffer.js). */
const BLOCK_SIZE = 256;

export interface ReplayRequest {
  libv86: string;
  /** V86 options the state was saved with, less the state itself. */
  options: Record<string, unknown>;
  state: ArrayBuffer;
  mode: [number, number];
  /** Returns the guest's screen once the run is over (the homepage rendered). */
  capture: boolean;
}

/** The guest's screen, `width` x `height` pixels of RGBA. */
export interface Frame {
  width: number;
  height: number;
  rgba: Uint8Array;
}

export interface ReplayResult {
  /** Indices of the blocks the guest read, per disk. */
  reads: { hda: number[]; hdb: number[] };
  /** Reads the state's block caches could not serve, per disk. */
  misses: { hda: number; hdb: number };
  /** The screen after the quiet disk, when the request asked for it. */
  frame?: Frame;
}

export type ReplayReply = { ok: true; result: ReplayResult } | { ok: false; error: string };

/** The members of v86's AsyncXHRPartfileBuffer (src/buffer.js) a run uses. */
interface DiskBuffer {
  get(offset: number, len: number, fn: (data: Uint8Array) => void, options?: unknown): void;
  get_from_cache(offset: number, len: number): Uint8Array | undefined;
}

interface ReadLog {
  /** `performance.now()` of the latest read. */
  last: number;
  blocks: Set<number>;
  misses: number;
}

/** Records every read the IDE device makes from `buffer` into `log`. */
function logReads(buffer: DiskBuffer, log: ReadLog): void {
  const get = buffer.get;
  buffer.get = function (offset, len, fn, options) {
    if (offset % BLOCK_SIZE !== 0 || len % BLOCK_SIZE !== 0) throw new Error(`disk read [${offset}, +${len}) is not block-aligned`);
    log.last = performance.now();
    for (let b = offset / BLOCK_SIZE; b < (offset + len) / BLOCK_SIZE; b++) log.blocks.add(b);
    if (!this.get_from_cache(offset, len)) log.misses++;
    get.call(this, offset, len, fn, options);
  };
}

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

async function replay({ libv86, options, state, mode: [w, h], capture }: ReplayRequest): Promise<ReplayResult> {
  if (capture) (globalThis as any).ImageData = ImageDataOverBuffer;
  const { V86 } = await import(libv86);
  let homepageRequested: () => void = () => {};
  const homepage = new Promise<void>((resolve) => (homepageRequested = resolve));
  // Guest HTTP goes through the global fetch (network_relay_url "fetch"): Netscape gets the
  // homepage the page serves, so it renders, and reads from disk, what it renders for the visitor.
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== HOMEPAGE_HOST || url.pathname !== "/") return new Response("not served by the generator", { status: 404 });
    homepageRequested();
    return new Response(PAGES["/"], { headers: { "Content-Type": "text/html" } });
  }) as typeof fetch;

  const emulator = new V86({ ...options, initial_state: { buffer: state }, autostart: false });
  try {
    await new Promise<void>((resolve) => emulator.add_listener("emulator-loaded", resolve));
    const { primary } = emulator.v86.cpu.devices.ide;
    const logs = {
      hda: { last: performance.now(), blocks: new Set<number>(), misses: 0 },
      hdb: { last: performance.now(), blocks: new Set<number>(), misses: 0 },
    };
    logReads(primary.master.buffer, logs.hda);
    logReads(primary.slave.buffer, logs.hdb);

    let failSwitch: (e: Error) => void = () => {};
    const switchFailed = new Promise<never>((_, reject) => (failSwitch = reject));
    let switched = false;
    let line = "";
    emulator.add_listener("serial0-output-byte", (byte: number) => {
      const c = String.fromCharCode(byte);
      if (c !== "\n") {
        line += c;
        return;
      }
      const done = line;
      line = "";
      if (done === "RESCHG_ERR") failSwitch(new Error(`RESCHG.EXE could not switch the display to ${w}x${h}`));
      if (done === "RESCHG_READY") failSwitch(new Error("RESCHG.EXE started after the snapshot"));
      if (done === "RESCHG_OK") switched = true;
    });
    let frame: Frame | undefined;
    let dacEnabled = true;
    emulator.add_listener("dac-enable", () => (dacEnabled = true));
    emulator.add_listener("dac-disable", () => (dacEnabled = false));
    const pull = setInterval(() => dacEnabled && emulator.bus.send("dac-request-data"), SPEAKER_PULL_MS);
    try {
      const verify = deadline(NETSCAPE_DEADLINE_MS, "Netscape's request for http://lexo.cool/");
      emulator.run();
      emulator.serial0_send(`RES ${w} ${h}\n`);
      await Promise.race([homepage, verify.promise, switchFailed]).finally(verify.clear);
      const quietBy = performance.now() + QUIET_DEADLINE_MS;
      while (performance.now() - Math.max(logs.hda.last, logs.hdb.last) < DISK_QUIET_MS) {
        if (performance.now() > quietBy) throw new Error(`the disks were still read ${QUIET_DEADLINE_MS / 1000} s after Netscape's request`);
        await Promise.race([Bun.sleep(DISK_QUIET_MS / 10), switchFailed]);
      }
      if (capture) frame = readFrame(emulator.v86.cpu.devices.vga);
    } finally {
      clearInterval(pull);
      await emulator.stop();
    }
    if (!switched) throw new Error(`the disks went quiet before RESCHG.EXE switched the display to ${w}x${h}`);
    return {
      reads: { hda: [...logs.hda.blocks], hdb: [...logs.hdb.blocks] },
      misses: { hda: logs.hda.misses, hdb: logs.hdb.misses },
      frame,
    };
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
