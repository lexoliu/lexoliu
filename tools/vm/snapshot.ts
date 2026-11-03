// Cold-boots Windows 95 in v86 and saves the machine state at the moment the startup sound
// starts playing, with every disk block the boot after it reads already in the state, so the
// visitor's boot from the state reads nothing over the network.
//
// Snapshot moment: the first Sound Blaster 16 DMA playback start of the boot, i.e. the first
// "dac-enable" v86 raises when the guest unmasks the SB16's DMA channel after programming a
// transfer. The SB16 driver's boot-time probe (DSP reset, version and ASP queries) never
// starts DMA, so on this image the first playback is Windows' SystemStart event, fired once
// the shell is up. The event is accepted only when the DSP is programmed for the startup
// WAV's own sample rate, width and channel count, no sample has been consumed yet, and the
// VGA is in a graphics mode; anything else fails the build.
//
// Preload: both disks are v86 on-demand buffers, which serve a read from their 256-byte block
// cache when every block of it is cached, and the saved state carries each buffer's blocks
// marked as written. Each round restores the snapshot in a fresh machine as the page does, puts
// the blocks recorded so far into the disk caches from the disk images, marked to be saved,
// saves that state, and runs it as the page does (switching the display, Netscape opening
// lexo.cool and rendering the page's homepage) until the disks go quiet, recording every read.
// The guest's paging follows its wall-clock timers, so a round can read pages the one before
// did not; those join the preload and the next round runs, and the first round that reads
// nothing outside the preload gives the state. No such round within PRELOAD_ROUNDS fails the
// build. Blocks the guest wrote before the snapshot are in the state already and stay as they
// are; byte ranges a disk pins (the registry hives) are preloaded whole.
//
// Nothing in the saved state waits on wall-clock time: v86 only moves audio DMA forward when
// the page's speaker asks for samples, so the sound starts whenever the restored machine runs.
import { PAGES } from "../../guest-pages.js";
import { VGA_MEMORY_SIZE } from "./display.ts";

/** Wall-clock budget from power-on to the snapshot moment (a local boot takes ~12 s). */
const BOOT_DEADLINE_MS = 300_000;
/** Wall-clock budget from a restored run's start to Netscape's request for http://lexo.cool/. */
const NETSCAPE_DEADLINE_MS = 300_000;
/**
 * After Netscape's request, a run ends once no disk was read for this long: Explorer and
 * Netscape keep paging in code and data in the background, as the visitor's machine does.
 */
const DISK_QUIET_MS = 3_000;
/** Wall-clock budget from Netscape's request to the quiet disk. */
const QUIET_DEADLINE_MS = 120_000;
/** Interval at which the headless run asks the SB16 for samples, standing in for a speaker. */
const SPEAKER_PULL_MS = 10;
const HOMEPAGE_HOST = "lexo.cool";
/**
 * Restored runs recorded into the preload before one must read nothing outside it. The guest's
 * paging follows wall-clock timers, so each run reads a few pages the one before did not.
 */
const PRELOAD_ROUNDS = 6;
/** v86's disk buffer cache granularity (src/buffer.js). */
const BLOCK_SIZE = 256;

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

/** A disk as v86 loads it on demand: fixed-size chunk files named by byte range. */
export interface ChunkedDisk {
  /** v86's `url` for the chunks (`use_parts`): the directory followed by the extension. */
  url: string;
  size: number;
  chunkSize: number;
  /** The whole image the chunks were cut from, read for the preloaded blocks. */
  image: string;
  /** Byte ranges preloaded whole, whatever a run reads of them. */
  pinned: [number, number][];
}

export interface SnapshotInputs {
  libv86: string; // libv86.mjs
  wasm: string;
  seabios: string;
  vgabios: string;
  hda: ChunkedDisk;
  hdb: ChunkedDisk;
  startupSound: WavFormat;
  /** The screen size the guest boots to; the snapshot fails at any other. */
  screen: [number, number];
  /**
   * Display modes RESCHG.EXE switches the guest to, one after another, in every run after the
   * snapshot, as the page switches it to fit the viewport; the switch pages in code and data.
   */
  modeSwitches: [number, number][];
}

export interface DiskPreload {
  /** Distinct bytes the guest read between the snapshot and Netscape's request. */
  readBytes: number;
  /** Blocks put into the state; the rest of the read blocks were written before the snapshot. */
  preloadedBlocks: number;
}

export interface Snapshot {
  /** The uncompressed state at the startup sound, carrying the preloaded blocks. */
  state: Uint8Array;
  hda: DiskPreload;
  hdb: DiskPreload;
}

/** The members of v86's AsyncXHRPartfileBuffer (src/buffer.js) the preload uses. */
interface DiskBuffer {
  byteLength: number;
  block_cache: Map<number, Uint8Array>;
  block_cache_is_write: Set<number>;
  get(offset: number, len: number, fn: (data: Uint8Array) => void, options?: unknown): void;
  get_from_cache(offset: number, len: number): Uint8Array | undefined;
}

interface ReadLog {
  /** `performance.now()` of the latest read. */
  last: number;
  /** Indices of the blocks read. */
  blocks: Set<number>;
  /** Reads the block cache could not serve, as [offset, length]. */
  misses: [number, number][];
  stop(): void;
}

/** Records every read the IDE device makes from `buffer` until `stop`. */
function logReads(buffer: DiskBuffer): ReadLog {
  const get = buffer.get;
  const log: ReadLog = {
    last: performance.now(),
    blocks: new Set(),
    misses: [],
    stop: () => {
      buffer.get = get;
    },
  };
  buffer.get = function (offset, len, fn, options) {
    if (offset % BLOCK_SIZE !== 0 || len % BLOCK_SIZE !== 0) throw new Error(`disk read [${offset}, +${len}) is not block-aligned`);
    log.last = performance.now();
    for (let b = offset / BLOCK_SIZE; b < (offset + len) / BLOCK_SIZE; b++) log.blocks.add(b);
    if (!this.get_from_cache(offset, len)) log.misses.push([offset, len]);
    get.call(this, offset, len, fn, options);
  };
  return log;
}

/** Puts the `blocks` not already cached into `buffer`'s cache from `image`, marked to be saved. */
async function preload(buffer: DiskBuffer, image: string, blocks: Set<number>): Promise<number> {
  const wanted = [...blocks].filter((b) => !buffer.block_cache.has(b)).sort((a, b) => a - b);
  const file = Bun.file(image);
  if (file.size !== buffer.byteLength) throw new Error(`${image} is ${file.size} bytes, the guest's disk ${buffer.byteLength}`);
  for (let i = 0; i < wanted.length; ) {
    let j = i + 1;
    while (j < wanted.length && wanted[j] === wanted[j - 1] + 1) j++;
    const run = await file.slice(wanted[i] * BLOCK_SIZE, (wanted[j - 1] + 1) * BLOCK_SIZE).bytes();
    for (let k = i; k < j; k++) {
      buffer.block_cache.set(wanted[k], run.slice((k - i) * BLOCK_SIZE, (k - i + 1) * BLOCK_SIZE));
      buffer.block_cache_is_write.add(wanted[k]);
    }
    i = j;
  }
  return wanted.length;
}

function deadline(ms: number, what: string): { promise: Promise<never>; clear(): void } {
  let timer: Timer;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not happen within ${ms / 1000} s`)), ms);
  });
  return { promise, clear: () => clearTimeout(timer) };
}

const diskOption = (disk: ChunkedDisk) => ({
  url: disk.url,
  size: disk.size,
  async: true,
  fixed_chunk_size: disk.chunkSize,
  use_parts: true,
});

/** The IDE device's buffers; restoring a state keeps the objects and replaces their contents. */
function disks(emulator: any): { hda: DiskBuffer; hdb: DiskBuffer } {
  const { primary } = emulator.v86.cpu.devices.ide;
  return { hda: primary.master.buffer, hdb: primary.slave.buffer };
}

/** Boots to the startup sound and returns the state saved there with the boot's reads preloaded. */
export async function snapshotAtStartupSound(inputs: SnapshotInputs): Promise<Snapshot> {
  const { V86 } = await import(inputs.libv86);
  const t0 = performance.now();
  const elapsed = () => `${((performance.now() - t0) / 1000).toFixed(1)} s`;

  // Guest HTTP goes through the global fetch (network_relay_url "fetch"). Before the snapshot
  // there must be none; afterwards Netscape gets the homepage the page serves, so it renders,
  // and reads from disk, what it renders for the visitor.
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
    if (url.hostname !== HOMEPAGE_HOST || url.pathname !== "/") return new Response("not served by the generator", { status: 404 });
    homepageRequested();
    return new Response(PAGES["/"], { headers: { "Content-Type": "text/html" } });
  }) as typeof fetch;

  const options = {
    wasm_path: inputs.wasm,
    memory_size: 64 * 1024 * 1024,
    vga_memory_size: VGA_MEMORY_SIZE,
    bios: { url: inputs.seabios },
    vga_bios: { url: inputs.vgabios },
    hda: diskOption(inputs.hda),
    hdb: diskOption(inputs.hdb),
    network_relay_url: "fetch",
    // As the page restores the state: the guest's NE2000 driver keeps the MAC it booted with.
    preserve_mac_from_state_image: true,
    disable_speaker: true,
  };

  /**
   * Runs the stopped machine through the boot after the snapshot: on until Netscape requests
   * the homepage and the disks in `reads` then go quiet, switching the display through
   * `inputs.modeSwitches` once RESCHG.EXE is up as the page does; then stops it.
   */
  async function runBoot(emulator: any, reads: ReadLog[]): Promise<void> {
    const switches = [...inputs.modeSwitches];
    let failSwitch: (e: Error) => void = () => {};
    const switchFailed = new Promise<never>((_, reject) => (failSwitch = reject));
    let line = "";
    const onSerial = (byte: number) => {
      const c = String.fromCharCode(byte);
      if (c !== "\n") {
        line += c;
        return;
      }
      const done = line;
      line = "";
      if (done === "RESCHG_ERR") failSwitch(new Error("RESCHG.EXE could not switch the display mode"));
      if ((done === "RESCHG_READY" || done === "RESCHG_OK") && switches.length > 0) {
        const [w, h] = switches.shift()!;
        emulator.serial0_send(`RES ${w} ${h}\n`);
      }
    };
    let dacEnabled = true;
    const onEnable = () => (dacEnabled = true);
    const onDisable = () => (dacEnabled = false);
    emulator.add_listener("serial0-output-byte", onSerial);
    emulator.add_listener("dac-enable", onEnable);
    emulator.add_listener("dac-disable", onDisable);
    const pull = setInterval(() => dacEnabled && emulator.bus.send("dac-request-data"), SPEAKER_PULL_MS);
    try {
      const verify = deadline(NETSCAPE_DEADLINE_MS, "Netscape's request for http://lexo.cool/");
      const homepage = new Promise<void>((resolve) => (homepageRequested = resolve));
      emulator.run();
      await Promise.race([homepage, verify.promise, switchFailed]).finally(verify.clear);
      const quietBy = performance.now() + QUIET_DEADLINE_MS;
      while (performance.now() - Math.max(...reads.map((r) => r.last)) < DISK_QUIET_MS) {
        if (performance.now() > quietBy) throw new Error(`the disks were still read ${QUIET_DEADLINE_MS / 1000} s after Netscape's request`);
        await Promise.race([Bun.sleep(DISK_QUIET_MS / 10), switchFailed]);
      }
    } finally {
      clearInterval(pull);
      emulator.remove_listener("serial0-output-byte", onSerial);
      emulator.remove_listener("dac-enable", onEnable);
      emulator.remove_listener("dac-disable", onDisable);
      await emulator.stop();
    }
    if (switches.length > 0) throw new Error(`the disks went quiet before the display switched to ${switches.map((m) => m.join("x")).join(", ")}`);
    console.log(`snapshot: disks quiet at ${elapsed()}`);
  }

  try {
    const cold = new V86({ ...options, autostart: true });
    let atStartupSound: ArrayBuffer;
    try {
      const boot = deadline(BOOT_DEADLINE_MS, "the Windows 95 startup sound");
      const atSound = new Promise<void>((resolve, reject) => {
        failBoot = reject;
        cold.add_listener("dac-enable", function onDac() {
          cold.remove_listener("dac-enable", onDac);
          const { sb16, vga } = cold.v86.cpu.devices;
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
      await cold.stop();
      const { vga } = cold.v86.cpu.devices;
      console.log(`snapshot: startup sound at ${elapsed()} (screen ${vga.screen_width}x${vga.screen_height})`);
      if (vga.screen_width !== inputs.screen[0] || vga.screen_height !== inputs.screen[1]) {
        throw new Error(`snapshot screen is ${vga.screen_width}x${vga.screen_height}, the guest boots to ${inputs.screen.join("x")}`);
      }
      atStartupSound = await cold.save_state();
    } finally {
      await cold.destroy();
    }
    phase = "verify";

    // Each round restores the snapshot in a fresh machine, as the page does, so nothing of an
    // earlier run (such as network replies still in flight to its NE2000) reaches the state.
    const pinnedBlocks = (disk: ChunkedDisk) =>
      new Set(disk.pinned.flatMap(([start, end]) => Array.from({ length: (end - start) / BLOCK_SIZE }, (_, k) => start / BLOCK_SIZE + k)));
    const blocks = { hda: pinnedBlocks(inputs.hda), hdb: pinnedBlocks(inputs.hdb) };
    for (let round = 1; round <= PRELOAD_ROUNDS; round++) {
      const warm = new V86({ ...options, initial_state: { buffer: atStartupSound.slice(0) }, autostart: false });
      try {
        await new Promise<void>((resolve) => warm.add_listener("emulator-loaded", resolve));
        const disk = disks(warm);
        const preloaded = {
          hda: await preload(disk.hda, inputs.hda.image, blocks.hda),
          hdb: await preload(disk.hdb, inputs.hdb.image, blocks.hdb),
        };
        const state = new Uint8Array(await warm.save_state());
        const reads = { hda: logReads(disk.hda), hdb: logReads(disk.hdb) };
        await runBoot(warm, [reads.hda, reads.hdb]).finally(() => {
          reads.hda.stop();
          reads.hdb.stop();
        });
        const missed = reads.hda.misses.length + reads.hdb.misses.length;
        console.log(`snapshot: round ${round}: ${reads.hda.misses.length} C: and ${reads.hdb.misses.length} D: reads outside the preload`);
        if (missed === 0) {
          const report = (name: "hda" | "hdb"): DiskPreload => ({
            readBytes: blocks[name].size * BLOCK_SIZE,
            preloadedBlocks: preloaded[name],
          });
          return { state, hda: report("hda"), hdb: report("hdb") };
        }
        for (const name of ["hda", "hdb"] as const) for (const b of reads[name].blocks) blocks[name].add(b);
      } finally {
        await warm.destroy();
      }
    }
    throw new Error(`the boot after the startup sound still read outside the preload after ${PRELOAD_ROUNDS} rounds`);
  } finally {
    globalThis.fetch = hostFetch;
  }
}
