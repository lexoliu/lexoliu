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
// VGA is in a graphics mode; anything else fails the build. RESCHG.EXE, which switches the
// display on the page's request over COM1, starts from the RunServices key before the shell
// and so before that moment: the boot must have seen its RESCHG_READY by then, and the state
// holds it running and listening, so the page can ask for the viewer's mode at power-on.
//
// Preload: both disks are v86 on-demand buffers, which serve a read from their 256-byte block
// cache when every block of it is cached, and the saved state carries each buffer's blocks
// marked as written. Each round restores the snapshot in a fresh machine as the page does, puts
// the blocks recorded so far into the disk caches from the disk images, marked to be saved, and
// saves that state; then it runs the boot from that state once in every mode the page can switch
// the guest to at power-on (tools/vm/replay.ts), as the page runs it, recording every read. What
// the boot reads follows the mode (Netscape lays out its window and the homepage for it) and the
// guest's wall-clock timers, so a round can read blocks the one before did not; those join the
// preload and the next round runs, and the first round that reads nothing outside the preload
// in any mode gives the state. No such round within PRELOAD_ROUNDS fails the build. Blocks the
// guest wrote before the snapshot are in the state already and stay as they are; byte ranges a
// disk pins (the registry hives, the FAT) are preloaded whole.
//
// Nothing in the saved state waits on wall-clock time: v86 only moves audio DMA forward when
// the page's speaker asks for samples, so the sound starts whenever the restored machine runs.
import { availableParallelism } from "node:os";
import { VGA_MEMORY_SIZE } from "./display.ts";
import type { ReplayReply, ReplayRequest, ReplayResult } from "./replay.ts";

/** Wall-clock budget from power-on to the snapshot moment (a local boot takes ~12 s). */
const BOOT_DEADLINE_MS = 300_000;
/**
 * Rounds recorded into the preload before one must read nothing outside it. The guest's paging
 * follows wall-clock timers, so each round can read a few blocks the one before did not.
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
  /** Every display mode the page can ask RESCHG.EXE for at power-on; each round runs each. */
  powerOnModes: [number, number][];
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

/** Runs the boot after `request.state` in a worker of its own (tools/vm/replay.ts). */
function replayInWorker(request: ReplayRequest): Promise<ReplayResult> {
  const worker = new Worker(new URL("./replay.ts", import.meta.url).href);
  return new Promise<ReplayResult>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<ReplayReply>) => {
      const reply = event.data;
      if (reply.ok) resolve(reply.result);
      else reject(new Error(`the boot in ${request.mode.join("x")}: ${reply.error}`));
    };
    worker.onerror = (event) => reject(new Error(`the boot in ${request.mode.join("x")}: ${event.message}`));
    worker.postMessage(request, [request.state]);
  }).finally(() => worker.terminate());
}

/** Runs `run` over `items`, at most `bound` at a time, keeping the order of `items`. */
async function boundedMap<T, R>(items: T[], bound: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await run(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(bound, items.length) }, lane));
  return results;
}

/** Boots to the startup sound and returns the state saved there with the boot's reads preloaded. */
export async function snapshotAtStartupSound(inputs: SnapshotInputs): Promise<Snapshot> {
  const { V86 } = await import(inputs.libv86);
  const t0 = performance.now();
  const elapsed = () => `${((performance.now() - t0) / 1000).toFixed(1)} s`;

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

  // Guest HTTP goes through the global fetch (network_relay_url "fetch"); before the snapshot
  // there must be none.
  const hostFetch = globalThis.fetch;
  let failBoot: (e: Error) => void = () => {};
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const e = new Error(`guest requested ${url} before the startup sound`);
    failBoot(e);
    throw e;
  }) as typeof fetch;

  let atStartupSound: ArrayBuffer;
  try {
    const cold = new V86({ ...options, autostart: true });
    let reschgReady = false;
    let coldLine = "";
    cold.add_listener("serial0-output-byte", (byte: number) => {
      if (byte !== 10) coldLine += String.fromCharCode(byte);
      else {
        if (coldLine === "RESCHG_READY") reschgReady = true;
        coldLine = "";
      }
    });
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
          } else if (!reschgReady) {
            reject(new Error("first SB16 playback started before RESCHG.EXE reported ready"));
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
  } finally {
    globalThis.fetch = hostFetch;
  }

  // Each round restores the snapshot in a fresh machine, as the page does, so nothing of an
  // earlier run (such as network replies still in flight to its NE2000) reaches the state.
  const pinnedBlocks = (disk: ChunkedDisk) =>
    new Set(disk.pinned.flatMap(([start, end]) => Array.from({ length: (end - start) / BLOCK_SIZE }, (_, k) => start / BLOCK_SIZE + k)));
  const blocks = { hda: pinnedBlocks(inputs.hda), hdb: pinnedBlocks(inputs.hdb) };
  // Each boot is a machine of its own on a thread of its own.
  const lanes = availableParallelism();
  for (let round = 1; round <= PRELOAD_ROUNDS; round++) {
    const warm = new V86({ ...options, initial_state: { buffer: atStartupSound.slice(0) }, autostart: false });
    let state: Uint8Array;
    let preloaded: { hda: number; hdb: number };
    try {
      await new Promise<void>((resolve) => warm.add_listener("emulator-loaded", resolve));
      const disk = disks(warm);
      preloaded = {
        hda: await preload(disk.hda, inputs.hda.image, blocks.hda),
        hdb: await preload(disk.hdb, inputs.hdb.image, blocks.hdb),
      };
      state = new Uint8Array(await warm.save_state());
    } finally {
      await warm.destroy();
    }
    const runs = await boundedMap(inputs.powerOnModes, lanes, (mode) =>
      replayInWorker({ libv86: inputs.libv86, options, state: state.slice().buffer, mode }),
    );
    const missed = inputs.powerOnModes
      .map((mode, i) => [mode, runs[i].misses] as const)
      .filter(([, m]) => m.hda + m.hdb > 0);
    console.log(
      `snapshot: round ${round} at ${elapsed()}: ${missed.length} of ${runs.length} power-on modes read outside the preload` +
        missed.map(([[w, h], m]) => ` ${w}x${h} (${m.hda} C:, ${m.hdb} D:)`).join(","),
    );
    if (missed.length === 0) {
      const report = (name: "hda" | "hdb"): DiskPreload => ({
        readBytes: blocks[name].size * BLOCK_SIZE,
        preloadedBlocks: preloaded[name],
      });
      return { state, hda: report("hda"), hdb: report("hdb") };
    }
    for (const run of runs) for (const name of ["hda", "hdb"] as const) for (const b of run.reads[name]) blocks[name].add(b);
  }
  throw new Error(`the boot after the startup sound still read outside the preload after ${PRELOAD_ROUNDS} rounds`);
}
