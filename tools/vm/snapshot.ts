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
// marked as written. The preload starts with every block the cold boot read: the guest's own
// caches (VCACHE, the kernel's profile cache, discardable code and data) hold only what it read
// or wrote before the snapshot, and when they drop something the boot after it reads that again.
// Which of those it drops and reads again follows how the guest's threads interleave, which
// follows how fast the host runs it against the wall clock, so no recorded boot can stand in for
// every visitor's; the cold boot's reads hold them all. Each round restores the snapshot in a
// fresh machine as the page does, puts the blocks recorded so far into the disk caches from the
// disk images, marked to be saved, and
// saves that state; then it runs the boot from that state once in each of a set of power-on
// modes (tools/vm/replay.ts), as the page runs it, followed by switches while running, recording
// every read: those are the blocks the guest reads for the first time after the snapshot. The
// guest's wall-clock timers make a round read blocks the one before did not; those join the
// preload and the next round runs.
//
// The page switches the guest to the viewport's own size at power-on (guest-display.js), so the
// modes it can ask for are too many to replay each. What the boot reads in them was measured
// over 58 sizes from 240x320 to 2560x338 and 316x1600, with repeats of two: every mode of at
// least 320 pixels a side reads the same files, and only which blocks of a few of them changes,
// with the layout (how much of the homepage shows decides which glyphs of its TrueType fonts get
// rasterized, and which code of NETSCAPE.EXE and COMCTL32.DLL runs; repeats of one mode read the
// same blocks of these) or with timing (the registry hives). So every file whose blocks two runs
// of a round read differently is preloaded whole: which of its blocks a mode reads then cannot
// matter, and the replayed modes only need to span the bounded space of modes the page asks for
// (display.ts, build.ts) so that every such file shows its variation. A smaller desktop, such as
// 300x200, runs code in Explorer and MFC that no replayed mode does, which is why the page asks
// for none. Preloading every file the boot reads whole instead would add some 30 MB to the
// state: Explorer reads only the headers of large programs, for their icons.
//
// The page also switches the mode whenever the viewport changes while the guest runs. The first
// such switch once the boot settled runs code in Explorer that the power-on switch, which lands
// while the shell is still starting, does not: some 12 to 20 KiB of EXPLORER.EXE and the same
// 8 KiB of SHDOCVW.DLL, read whatever the power-on mode, the snapshot's own included (where the
// power-on switch changes nothing). Every later switch read nothing at all, measured over runs
// of up to four modes from 320x320 to 2560x500, between portrait and landscape and back. Which
// blocks of EXPLORER.EXE the first switch reads differs between runs, as with the files above. So
// each run switches, once the disks went quiet after Netscape's request, to the next power-on mode
// of the list (the last to the first) and then back: every replayed mode is the source of one such
// switch and the target of another, so the first switch's variation shows across the bounded space
// as the boot's does and the files it reads differently are preloaded whole, and the switch back
// stands for every later one, so a round in which it reads outside the preload does not converge.
// Even so, which blocks the first switch reads depends on the mode pair, and the pairs replayed
// are a few of those a resize can make (growing both dimensions from a 320-high mode is none), so
// the replayed pairs cannot be relied on to cover the others: every file any switch step reads is
// preloaded whole, whatever the pair.
//
// The first round in which no step of any run reads outside the preload and that finds no file left
// to preload whole gives the state; no such round within PRELOAD_ROUNDS fails the build. Blocks the
// guest wrote before the snapshot are in the state already and stay as they are; byte ranges a
// disk pins (the registry hives, the FAT) are preloaded whole from the start.
//
// Nothing in the saved state waits on wall-clock time: v86 only moves audio DMA forward when
// the page's speaker asks for samples, so the sound starts whenever the restored machine runs.
import { availableParallelism } from "node:os";
import type { DiskFiles } from "./disk.ts";
import { VGA_MEMORY_SIZE } from "./display.ts";
import { BLOCK_SIZE, type DiskBuffer as ReadableDiskBuffer, logReads, newReadLog } from "./reads.ts";
import type { Frame, ReplayReply, ReplayRequest, ReplayResult, ReplayStep } from "./replay.ts";

/** Wall-clock budget from power-on to the snapshot moment (a local boot takes ~12 s). */
const BOOT_DEADLINE_MS = 300_000;
/**
 * Rounds recorded into the preload before one must read nothing outside it. The guest's paging
 * follows wall-clock timers, so each round can read a few blocks the one before did not.
 */
const PRELOAD_ROUNDS = 6;

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
  /** The image's files, for preloading whole those the runs read differently. */
  files: DiskFiles;
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
  /** Display modes the page asks RESCHG.EXE for at power-on, spanning the layouts; each round runs each. */
  powerOnModes: [number, number][];
  /** The power-on mode (one of `powerOnModes`) whose boot also returns the screen it ends on. */
  captureMode: [number, number];
  /** The build's output directory, holding the files the guest's images are served from. */
  assetsDir: string;
}

export interface DiskPreload {
  /** Distinct bytes in the preload: the cold boot's reads, the boot after the snapshot's, the files preloaded whole, and the pins. */
  readBytes: number;
  /** Distinct bytes the cold boot read before the snapshot. */
  coldReadBytes: number;
  /** Blocks put into the state; the rest of the read blocks were written before the snapshot. */
  preloadedBlocks: number;
  /** The files preloaded whole because the runs read them differently. */
  wholeFiles: string[];
}

export interface Snapshot {
  /** The uncompressed state at the startup sound, carrying the preloaded blocks. */
  state: Uint8Array;
  hda: DiskPreload;
  hdb: DiskPreload;
  /** The guest's screen in `captureMode` once Netscape rendered the homepage. */
  frame: Frame;
}

/** The members of v86's AsyncXHRPartfileBuffer (src/buffer.js) the preload uses. */
interface DiskBuffer extends ReadableDiskBuffer {
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

/** The files of `files` in which the `runs` (each the set of blocks one run read) read different blocks. */
function filesReadDifferently(files: DiskFiles, runs: number[][]): Set<string> {
  const perRun = runs.map((reads) => {
    const byFile = new Map<string, number[]>();
    for (const b of reads) {
      const file = files.fileOf(b);
      if (file !== undefined) (byFile.get(file) ?? byFile.set(file, []).get(file)!).push(b);
    }
    for (const blocks of byFile.values()) blocks.sort((x, y) => x - y);
    return byFile;
  });
  const differ = new Set<string>();
  for (const file of new Set(perRun.flatMap((m) => [...m.keys()]))) {
    const first = perRun[0].get(file)?.join();
    if (perRun.some((m) => m.get(file)?.join() !== first)) differ.add(file);
  }
  return differ;
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

const modesName = (modes: [number, number][]) => modes.map((m) => m.join("x")).join(" > ");

/** Every block a run read on `disk` over its steps, each once. */
const runReads = (steps: ReplayStep[], disk: "hda" | "hdb") => [...new Set(steps.flatMap((step) => step.reads[disk]))];

/** The files of `files` in which any block was read by a step after the first (a switch while running) of any run. */
function filesReadBySwitches(files: DiskFiles, runs: ReplayStep[][], disk: "hda" | "hdb"): Set<string> {
  const switched = new Set<string>();
  for (const steps of runs) {
    for (const step of steps.slice(1)) {
      for (const b of step.reads[disk]) {
        const file = files.fileOf(b);
        if (file !== undefined) switched.add(file);
      }
    }
  }
  return switched;
}

/** Runs the boot after `request.state` in a worker of its own (tools/vm/replay.ts). */
function replayInWorker(request: ReplayRequest): Promise<ReplayResult> {
  const worker = new Worker(new URL("./replay.ts", import.meta.url).href);
  return new Promise<ReplayResult>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<ReplayReply>) => {
      const reply = event.data;
      if (reply.ok) resolve(reply.result);
      else reject(new Error(`the boot in ${modesName(request.modes)}: ${reply.error}`));
    };
    worker.onerror = (event) => reject(new Error(`the boot in ${modesName(request.modes)}: ${event.message}`));
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
  if (!inputs.powerOnModes.some(([w, h]) => w === inputs.captureMode[0] && h === inputs.captureMode[1])) {
    throw new Error(`the capture mode ${inputs.captureMode.join("x")} is not a power-on mode`);
  }
  if (inputs.powerOnModes.length < 2) throw new Error("the runs switch from each power-on mode to another, so they need two or more");
  // Each run powers on in one mode, switches to the next mode of the list (the last to the first),
  // and back; see the header comment.
  const runModes = inputs.powerOnModes.map((mode, i): [number, number][] => [mode, inputs.powerOnModes[(i + 1) % inputs.powerOnModes.length], mode]);
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
  const coldReads = { hda: newReadLog(), hdb: newReadLog() };
  try {
    const cold = new V86({ ...options, autostart: false });
    await new Promise<void>((resolve) => cold.add_listener("emulator-loaded", resolve));
    const coldDisks = disks(cold);
    logReads(coldDisks.hda, coldReads.hda);
    logReads(coldDisks.hdb, coldReads.hdb);
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
      cold.run();
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
  const blocks = {
    hda: pinnedBlocks(inputs.hda).union(coldReads.hda.blocks),
    hdb: pinnedBlocks(inputs.hdb).union(coldReads.hdb.blocks),
  };
  const wholeFiles = { hda: new Set<string>(), hdb: new Set<string>() };
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
    const runs = await boundedMap(runModes, lanes, (modes) =>
      replayInWorker({
        libv86: inputs.libv86,
        options,
        state: state.slice().buffer,
        modes,
        assetsDir: inputs.assetsDir,
        capture: modes[0][0] === inputs.captureMode[0] && modes[0][1] === inputs.captureMode[1],
      }),
    );
    // Each step of each run that read outside the preload: the mode it asked for, and its misses.
    const missed = runModes.flatMap((modes, i) =>
      runs[i].steps
        .map((step, k) => [`${modesName(modes)} at ${modes[k].join("x")}`, step.misses] as const)
        .filter(([, m]) => m.hda + m.hdb > 0),
    );
    const newWholeFiles = { hda: [] as string[], hdb: [] as string[] };
    for (const name of ["hda", "hdb"] as const) {
      const files = inputs[name].files;
      const whole = new Set([
        ...filesReadDifferently(files, runs.map((run) => runReads(run.steps, name))),
        ...filesReadBySwitches(files, runs.map((run) => run.steps), name),
      ]);
      for (const file of whole) {
        if (!wholeFiles[name].has(file)) newWholeFiles[name].push(file);
      }
    }
    console.log(
      `snapshot: round ${round} at ${elapsed()}: ${missed.length} of ${runs.length * runModes[0].length} steps read outside the preload` +
        missed.map(([step, m]) => ` ${step} (${m.hda} C:, ${m.hdb} D:)`).join(",") +
        `; files read differently, newly preloaded whole: C: ${newWholeFiles.hda.join(" ") || "none"}, D: ${newWholeFiles.hdb.join(" ") || "none"}`,
    );
    if (missed.length === 0 && newWholeFiles.hda.length + newWholeFiles.hdb.length === 0) {
      const report = (name: "hda" | "hdb"): DiskPreload => ({
        readBytes: blocks[name].size * BLOCK_SIZE,
        coldReadBytes: coldReads[name].blocks.size * BLOCK_SIZE,
        preloadedBlocks: preloaded[name],
        wholeFiles: [...wholeFiles[name]].sort(),
      });
      const frame = runs[inputs.powerOnModes.findIndex(([w, h]) => w === inputs.captureMode[0] && h === inputs.captureMode[1])].frame;
      if (!frame) throw new Error(`the boot in ${inputs.captureMode.join("x")} returned no screen`);
      return { state, hda: report("hda"), hdb: report("hdb"), frame };
    }
    for (const name of ["hda", "hdb"] as const) {
      for (const run of runs) for (const b of runReads(run.steps, name)) blocks[name].add(b);
      for (const file of newWholeFiles[name]) {
        wholeFiles[name].add(file);
        for (const b of inputs[name].files.blocksOf(file)) blocks[name].add(b);
      }
    }
  }
  throw new Error(`the boot after the startup sound still read outside the preload, or read files differently, after ${PRELOAD_ROUNDS} rounds`);
}
