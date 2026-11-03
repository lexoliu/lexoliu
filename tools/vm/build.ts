// Generates every VM asset the page loads from /public/vm, from pinned and hash-verified
// inputs: v86 (built from source, patched) and its BIOSes (patched), the C: chunks (patched), the D: chunks, the guest's
// display modes, the saved state, which carries the disk blocks the boot after it reads, and
// the project logos (baseline JPEG, for Netscape 3.0), the link-preview image (preview.png), the guest's screen once Netscape rendered the homepage.
// Usage: bun tools/vm/build.ts [--out DIR] [--cache DIR]
//   --out    output directory, replaced entirely (default: public/vm)
//   --cache  verified downloads, reused across runs (default: $XDG_CACHE_HOME/lexoliu-vm)
import { homedir } from "node:os";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pickGuestMode } from "../../guest-display.js";
import { HDB_CHUNK_SIZE, HDB_SIZE, buildHda, buildHdb, fileExtents, firstFatExtent, firstPartitionOffset, run, writeParts } from "./disk.ts";
import { type ModesFile, bootDisplay, checkAddedModes, checkOptionRomChecksum, guestModes } from "./display.ts";
import { CHUNK_SIZE, DISK_SIZE, fetchHdaBase } from "./hda.ts";
import { buildDriveD, buildReschg, buildUnshield } from "./netscape.ts";
import { buildLogos } from "./logos.ts";
import { previewMode, renderPreview } from "./preview.ts";
import { VBEMP_PATH, applyBytePatches, cDrivePatches, vgaBiosPatches } from "./patches.ts";
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
 * Every mode the page's pickGuestMode can switch the guest to at power-on, the boot after the
 * snapshot being recorded in each. A viewport of a mode's own size picks every mode pickGuestMode
 * ever picks: among the modes of one aspect ratio, a viewport at a mode's size up to the
 * snapshot's pixel count picks that mode, and one at a larger mode's size picks what every
 * viewport of that ratio past the snapshot's pixel count picks.
 */
function powerOnModesOf(modes: [number, number][], [sw, sh]: [number, number]): [number, number][] {
  const picked = new Map<string, [number, number]>();
  for (const [w, h] of modes) {
    const mode: [number, number] = pickGuestMode(modes, sw * sh, w, h);
    picked.set(mode.join("x"), mode);
  }
  return [...picked.values()];
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
        await buildDriveD(src.netscape, unshield, reschg, root, work);
        await buildHdb(join(work, "d.img"), root, "NETSCAPE");
        await writeParts(join(work, "d.img"), join(out, "hdb"), HDB_CHUNK_SIZE);
      })(),
      buildHda(join(cache, "hda"), join(out, "hda"), work, cDrivePatches),
    ]),
  );

  await stage("copy runtime", async () => {
    await cp(join(v86.build, "libv86.js"), join(out, "libv86.js"));
    await cp(join(v86.build, "v86.wasm"), join(out, "v86.wasm"));
    await cp(join(v86.bios, "seabios.bin"), join(out, "seabios.bin"));
    const vgabios = applyBytePatches("vgabios.bin", await Bun.file(join(v86.bios, "vgabios.bin")).bytes(), vgaBiosPatches);
    checkOptionRomChecksum(vgabios);
    await Bun.write(join(out, "vgabios.bin"), vgabios);
  });

  await stage("convert logos", () => buildLogos(src, out));

  const modes = await stage("derive display modes", async () => {
    const image = join(work, "c.img");
    const drv = join(work, "vbemp.drv");
    await run(["mcopy", "-o", "-i", `${image}@@${await firstPartitionOffset(image)}`, `::${VBEMP_PATH}`, drv], {
      env: { MTOOLS_SKIP_CHECK: "1" },
    });
    const boot = bootDisplay(await Bun.file(join(dirname(import.meta.path), "guest", "netscape.reg")).text());
    const modes = guestModes(await Bun.file(join(out, "vgabios.bin")).bytes(), await Bun.file(drv).bytes(), boot);
    checkAddedModes(await Bun.file(join(v86.bios, "vgabios.bin")).bytes(), modes);
    console.log(`display modes at ${boot.bitsPerPixel} bpp: ${modes.modes.map(([w, h]) => `${w}x${h}`).join(" ")}`);
    return modes;
  });

  const snapshot = await stage("boot to startup sound", async () => {
    const image = join(work, "c.img");
    const wav = join(work, "startup.wav");
    await run(["mcopy", "-o", "-i", `${image}@@${await firstPartitionOffset(image)}`, `::${STARTUP_SOUND}`, wav], {
      env: { MTOOLS_SKIP_CHECK: "1" },
    });
    const powerOnModes = powerOnModesOf(modes.modes, modes.snapshotMode);
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
      },
      hdb: {
        url: join(out, "hdb", ".img"),
        size: HDB_SIZE,
        chunkSize: HDB_CHUNK_SIZE,
        image: join(work, "d.img"),
        pinned: [await firstFatExtent(join(work, "d.img"))],
      },
      startupSound: parseWavFormat(await Bun.file(wav).bytes()),
      screen: modes.snapshotMode,
      powerOnModes,
      captureMode: previewMode(powerOnModes),
      assetsDir: out,
    });
  });

  // Written once the snapshot is taken: it only exists if RESCHG.EXE was running in the state.
  await Bun.write(join(out, MODES_FILE), `${JSON.stringify({ ...modes, reschgInState: true } satisfies ModesFile)}\n`);

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
    const { readBytes, coldReadBytes, preloadedBlocks } = snapshot[disk];
    console.log(
      `${disk} preload                      ${readBytes} bytes (cold boot read ${coldReadBytes}), ${preloadedBlocks} blocks put into the state`,
    );
  }
} catch (e) {
  console.error(`vm build failed: ${e instanceof Error ? (e.stack ?? e.message) : e}`);
  process.exit(1);
}
