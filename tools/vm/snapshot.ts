// Cold-boots Windows 95 in v86 and saves the machine state at the moment the startup sound
// starts playing, then keeps running the saved machine to prove Netscape opens lexo.cool.
//
// Snapshot moment: the first Sound Blaster 16 DMA playback start of the boot, i.e. the first
// "dac-enable" v86 raises when the guest unmasks the SB16's DMA channel after programming a
// transfer. The SB16 driver's boot-time probe (DSP reset, version and ASP queries) never
// starts DMA, so on this image the first playback is Windows' SystemStart event, fired once
// the shell is up. The event is accepted only when the DSP is programmed for the startup
// WAV's own sample rate, width and channel count, no sample has been consumed yet, and the
// VGA is in a graphics mode; anything else fails the build.
//
// Nothing in the saved state waits on wall-clock time: v86 only moves audio DMA forward when
// the page's speaker asks for samples, so the sound starts whenever the restored machine runs.
import { join } from "node:path";
import { HDB_SIZE } from "./disk.ts";
import { VGA_MEMORY_SIZE } from "./display.ts";
import { CHUNK_SIZE, DISK_SIZE } from "./hda.ts";

/** Wall-clock budget from power-on to the snapshot moment (a local boot takes ~12 s). */
const BOOT_DEADLINE_MS = 300_000;
/** Wall-clock budget from the snapshot to Netscape's request for http://lexo.cool/. */
const NETSCAPE_DEADLINE_MS = 300_000;
/** Interval at which the headless run asks the SB16 for samples, standing in for a speaker. */
const SPEAKER_PULL_MS = 10;
const HOMEPAGE_HOST = "lexo.cool";

export interface WavFormat {
  sampleRate: number;
  bitsPerSample: number;
  channels: number;
}

export function parseWavFormat(wav: Uint8Array): WavFormat {
  const b = Buffer.from(wav);
  if (b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WAVE") throw new Error("not a WAV file");
  for (let pos = 12; pos + 8 <= b.length; ) {
    const id = b.toString("latin1", pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    if (id === "fmt ") {
      if (b.readUInt16LE(pos + 8) !== 1) throw new Error("WAV is not PCM");
      return { channels: b.readUInt16LE(pos + 10), sampleRate: b.readUInt32LE(pos + 12), bitsPerSample: b.readUInt16LE(pos + 22) };
    }
    pos += 8 + size + (size & 1);
  }
  throw new Error("WAV has no fmt chunk");
}

export interface SnapshotInputs {
  libv86: string; // libv86.mjs
  wasm: string;
  seabios: string;
  vgabios: string;
  hdaDir: string;
  hdb: string;
  startupSound: WavFormat;
  /** The screen size the guest boots to; the snapshot fails at any other. */
  screen: [number, number];
}

function deadline(ms: number, what: string): { promise: Promise<never>; clear(): void } {
  let timer: Timer;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not happen within ${ms / 1000} s`)), ms);
  });
  return { promise, clear: () => clearTimeout(timer) };
}

/** Boots, returns the uncompressed state saved at the startup sound. */
export async function snapshotAtStartupSound(inputs: SnapshotInputs): Promise<Uint8Array> {
  const { V86 } = await import(inputs.libv86);
  const t0 = performance.now();
  const elapsed = () => `${((performance.now() - t0) / 1000).toFixed(1)} s`;

  // Guest HTTP goes through the global fetch (network_relay_url "fetch"). Before the snapshot
  // there must be none; afterwards only the homepage request is expected.
  const hostFetch = globalThis.fetch;
  let phase: "boot" | "verify" = "boot";
  let failBoot: (e: Error) => void = () => {};
  let homepageRequested: () => void = () => {};
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (phase === "boot") {
      const e = new Error(`guest requested ${url.href} before the startup sound`);
      failBoot(e);
      throw e;
    }
    console.log(`snapshot: guest requested ${url.href} at ${elapsed()}`);
    if (url.hostname !== HOMEPAGE_HOST) return new Response("not served by the generator", { status: 404 });
    if (url.pathname === "/") homepageRequested();
    return new Response("<HTML><BODY>lexo.cool</BODY></HTML>", { headers: { "Content-Type": "text/html" } });
  }) as typeof fetch;

  const emulator = new V86({
    wasm_path: inputs.wasm,
    memory_size: 64 * 1024 * 1024,
    vga_memory_size: VGA_MEMORY_SIZE,
    bios: { url: inputs.seabios },
    vga_bios: { url: inputs.vgabios },
    hda: { url: join(inputs.hdaDir, ".img"), size: DISK_SIZE, async: true, fixed_chunk_size: CHUNK_SIZE, use_parts: true },
    hdb: { url: inputs.hdb, size: HDB_SIZE, async: false },
    network_relay_url: "fetch",
    disable_speaker: true,
    autostart: true,
  });

  try {
    const boot = deadline(BOOT_DEADLINE_MS, "the Windows 95 startup sound");
    const atSound = new Promise<void>((resolve, reject) => {
      failBoot = reject;
      emulator.add_listener("dac-enable", function onDac() {
        emulator.remove_listener("dac-enable", onDac);
        const { sb16, vga } = emulator.v86.cpu.devices;
        const want = inputs.startupSound;
        const got = {
          sampleRate: sb16.sampling_rate,
          bitsPerSample: sb16.dsp_16bit ? 16 : 8,
          channels: sb16.dsp_stereo ? 2 : 1,
        };
        if (got.sampleRate !== want.sampleRate || got.bitsPerSample !== want.bitsPerSample || got.channels !== want.channels) {
          reject(new Error(`first SB16 playback is ${JSON.stringify(got)}, startup sound is ${JSON.stringify(want)}`));
        } else if (sb16.dma_bytes_left !== sb16.dma_bytes_count) {
          reject(new Error("SB16 playback had consumed samples before it was reported"));
        } else if (!vga.graphical_mode) {
          reject(new Error("first SB16 playback started before Windows' GUI"));
        } else {
          resolve();
        }
      });
    });
    await Promise.race([atSound, boot.promise]).finally(boot.clear);
    await emulator.stop();
    const { vga } = emulator.v86.cpu.devices;
    console.log(`snapshot: startup sound at ${elapsed()} (screen ${vga.screen_width}x${vga.screen_height})`);
    if (vga.screen_width !== inputs.screen[0] || vga.screen_height !== inputs.screen[1]) {
      throw new Error(`snapshot screen is ${vga.screen_width}x${vga.screen_height}, the guest boots to ${inputs.screen.join("x")}`);
    }
    const state = new Uint8Array(await emulator.save_state());

    phase = "verify";
    let dacEnabled = true;
    emulator.add_listener("dac-enable", () => (dacEnabled = true));
    emulator.add_listener("dac-disable", () => (dacEnabled = false));
    const pull = setInterval(() => dacEnabled && emulator.bus.send("dac-request-data"), SPEAKER_PULL_MS);
    const verify = deadline(NETSCAPE_DEADLINE_MS, "Netscape's request for http://lexo.cool/");
    const homepage = new Promise<void>((resolve) => (homepageRequested = resolve));
    emulator.run();
    await Promise.race([homepage, verify.promise]).finally(() => {
      verify.clear();
      clearInterval(pull);
    });
    console.log(`snapshot: Netscape opened http://${HOMEPAGE_HOST}/ at ${elapsed()}`);
    return state;
  } finally {
    await emulator.destroy();
    globalThis.fetch = hostFetch;
  }
}
