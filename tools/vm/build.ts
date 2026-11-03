// Generates every VM asset the page loads from /public/vm, from pinned and hash-verified
// inputs: v86 (built from source, patched) and its BIOSes, the C: chunks (patched, with the vbe9x display driver), the
// D: chunks, the guest display (modes.json), the saved state, which carries the disk blocks the boot after it reads, and
// the project logos (baseline JPEG, for Netscape 3.0), the link-preview image (preview.png), the guest's screen once Netscape rendered the homepage.
// Usage: bun tools/vm/build.ts [--out DIR] [--cache DIR]
//   --out    output directory, replaced entirely (default: public/vm)
//   --cache  verified downloads, reused across runs (default: $XDG_CACHE_HOME/lexoliu-vm)
import { homedir } from "node:os";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { guestModeFor } from "../../guest-display.js";
import { HDB_CHUNK_SIZE, HDB_SIZE, buildHda, buildHdb, diskFiles, fileExtents, firstFatExtent, firstPartitionOffset, run, writeParts } from "./disk.ts";
import { type GuestDisplay, type ModesFile, bootDisplay, guestDisplay } from "./display.ts";
import { CHUNK_SIZE, DISK_SIZE, fetchHdaBase } from "./hda.ts";
import { buildDriveD, buildReschg, buildUnshield } from "./netscape.ts";
import { buildLogos } from "./logos.ts";
import { previewMode, renderPreview } from "./preview.ts";
import { VBE9X_DRV_PATH, cDrivePatches } from "./patches.ts";
import { BLOCK_SIZE } from "./reads.ts";
import { parseWavFormat, snapshotAtStartupSound } from "./snapshot.ts";
import { fetchSources } from "./sources.ts";
import { buildV86 } from "./v86.ts";

const ROOT = join(dirname(import.meta.path), "..", "..");
// HKCU\AppEvents\Schemes\Apps\.Default\SystemStart\.Current in the base image's USER.DAT.
const STARTUP_SOUND = "/WINDOWS/MEDIA/The Microsoft Sound.wav";
// The registry hives, preloaded whole: which of their pages the boot after the saved state
// reads follows which keys get looked up, and that changes with the guest's timing.
const REGISTRY_HIVES = ["/WINDOWS/SYSTEM.DAT", "/WINDOWS/USER.DAT"];
const STATE_FILE = "win95-netscape.state.bin.zst";
const STATE_ZSTD_LEVEL = 19;
const MODES_FILE = "modes.json";
const PREVIEW_FILE = "preview.png";

function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  const value = process.argv[i + 1];
  if (!value) throw new Error(`${name} requires a directory`);
  return resolve(value);
}

const out = option("--out", join(ROOT, "public", "vm"));
const cache = option("--cache", join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "lexoliu-vm"));
const work = join(cache, "work");

/**
 * Viewports whose power-on modes the preload replays (snapshot.ts). The boot reads the same files
 * in every mode, and which blocks of some of them follows the layout; those files are preloaded
 * whole once two replays read them differently. So the set spans the bounded space of modes the
 * page asks for (display.ts): its corners (the least square, the widest and the tallest at the
 * least shorter side, the widest and tallest at the most pixels) and the phones, tablets and
 * desktops between them, each in portrait and landscape.
 */
// prettier-ignore
const POWER_ON_VIEWPORTS: [number, number][] = [
  [320, 320], [4000, 320], [320, 4000], [2560, 500], [900, 1800],
  [320, 568], [568, 320], [390, 844], [844, 390], [430, 932], [932, 430],
  [820, 1180], [1180, 820], [1000, 1000], [1280, 720], [1440, 900], [1920, 1080], [3440, 1440],
];

/** The guest modes the page switches to at power-on in each of `viewports`, without repeats. */
function powerOnModesOf(display: GuestDisplay, viewports: [number, number][]): [number, number][] {
  const modes = new Map<string, [number, number]>();
  for (const [vw, vh] of viewports) {
    const mode: [number, number] = guestModeFor(display, vw, vh);
    modes.set(mode.join("x"), mode);
  }
  return [...modes.values()];
}

const timings: [string, number][] = [];
async function stage<T>(name: string, body: () => Promise<T>): Promise<T> {
  const t = performance.now();
  const result = await body();
  const s = (performance.now() - t) / 1000;
  timings.push([name, s]);
  console.log(`== ${name}: ${s.toFixed(1)} s`);
  return result;
}

try {
  await rm(work, { recursive: true, force: true });
  await rm(out, { recursive: true, force: true });
  await mkdir(work, { recursive: true });
  await mkdir(out, { recursive: true });

  const [src] = await stage("fetch inputs", () =>
    Promise.all([fetchSources(join(cache, "sources")), fetchHdaBase(join(cache, "hda"))]),
  );

  const [v86, unshield, reschg] = await stage("build tools", () =>
    Promise.all([
      buildV86(src, work),
      buildUnshield(src, work),
      buildReschg(work),
    ]),
  );

  await stage("build disks", () =>
    Promise.all([
      (async () => {
        const root = join(work, "d");
        await mkdir(root);
        await buildDriveD(src.netscape, unshield, reschg, { reg: src["vbe9x/vbe9x.reg"], notices: src["vbe9x/THIRD-PARTY-NOTICES"] }, root, work);
        await buildHdb(join(work, "d.img"), root, "NETSCAPE");
        await writeParts(join(work, "d.img"), join(out, "hdb"), HDB_CHUNK_SIZE);
      })(),
      buildHda(join(cache, "hda"), join(out, "hda"), work, cDrivePatches, [
        { path: VBE9X_DRV_PATH, from: src["vbe9x/vbe9x.drv"], why: "the display driver, vbe9x (display.ts)" },
      ]),
    ]),
  );

  await stage("copy runtime", async () => {
    await cp(join(v86.build, "libv86.js"), join(out, "libv86.js"));
    await cp(join(v86.build, "v86.wasm"), join(out, "v86.wasm"));
    await cp(join(v86.bios, "seabios.bin"), join(out, "seabios.bin"));
    await cp(join(v86.bios, "vgabios.bin"), join(out, "vgabios.bin"));
  });

  await stage("convert logos", () => buildLogos(src, out));

  const display = guestDisplay(bootDisplay(await Bun.file(join(dirname(import.meta.path), "guest", "netscape.reg")).text()));

  const snapshot = await stage("boot to startup sound", async () => {
    const image = join(work, "c.img");
    const wav = join(work, "startup.wav");
    await run(["mcopy", "-o", "-i", `${image}@@${await firstPartitionOffset(image)}`, `::${STARTUP_SOUND}`, wav], {
      env: { MTOOLS_SKIP_CHECK: "1" },
    });
    const powerOnModes = powerOnModesOf(display, POWER_ON_VIEWPORTS);
    console.log(`power-on modes: ${powerOnModes.map(([w, h]) => `${w}x${h}`).join(" ")}`);
    return snapshotAtStartupSound({
      libv86: join(v86.build, "libv86.mjs"),
      wasm: join(out, "v86.wasm"),
      seabios: join(out, "seabios.bin"),
      vgabios: join(out, "vgabios.bin"),
      hda: {
        url: join(out, "hda", ".img"),
        size: DISK_SIZE,
        chunkSize: CHUNK_SIZE,
        image,
        // Each disk's FAT is preloaded whole too: which of its sectors the boot reads follows which
        // clusters the guest looks up and allocates, and that changes with its timing.
        pinned: [await firstFatExtent(image), ...(await Promise.all(REGISTRY_HIVES.map((hive) => fileExtents(image, hive)))).flat()],
        files: await diskFiles(image, BLOCK_SIZE),
      },
      hdb: {
        url: join(out, "hdb", ".img"),
        size: HDB_SIZE,
        chunkSize: HDB_CHUNK_SIZE,
        image: join(work, "d.img"),
        pinned: [await firstFatExtent(join(work, "d.img"))],
        files: await diskFiles(join(work, "d.img"), BLOCK_SIZE),
      },
      startupSound: parseWavFormat(await Bun.file(wav).bytes()),
      screen: display.snapshotMode,
      powerOnModes,
      captureMode: previewMode(powerOnModes),
      assetsDir: out,
    });
  });

  // Written once the snapshot is taken: it only exists if RESCHG.EXE was running in the state.
  await Bun.write(join(out, MODES_FILE), `${JSON.stringify({ ...display, reschgInState: true } satisfies ModesFile)}\n`);

  await stage("render preview", async () => {
    await Bun.write(join(out, PREVIEW_FILE), renderPreview(snapshot.frame));
  });

  await stage("compress state", async () => {
    await Bun.write(join(out, STATE_FILE), await Bun.zstdCompress(snapshot.state, { level: STATE_ZSTD_LEVEL }));
  });

  await rm(work, { recursive: true, force: true });
  for (const [name, s] of timings) console.log(`${name.padEnd(24)} ${s.toFixed(1).padStart(7)} s`);
  for (const f of ["libv86.js", "v86.wasm", "seabios.bin", "vgabios.bin", MODES_FILE, STATE_FILE, PREVIEW_FILE]) {
    console.log(`${f.padEnd(32)} ${Bun.file(join(out, f)).size} bytes`);
  }
  console.log(`state (uncompressed)             ${snapshot.state.length} bytes`);
  for (const disk of ["hda", "hdb"] as const) {
    const { readBytes, coldReadBytes, preloadedBlocks, wholeFiles } = snapshot[disk];
    console.log(
      `${disk} preload                      ${readBytes} bytes (cold boot read ${coldReadBytes}), ${preloadedBlocks} blocks put into the state, whole: ${wholeFiles.join(" ")}`,
    );
  }
} catch (e) {
  console.error(`vm build failed: ${e instanceof Error ? (e.stack ?? e.message) : e}`);
  process.exit(1);
}
