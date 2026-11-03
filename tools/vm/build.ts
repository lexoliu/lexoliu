// Generates every VM asset the page loads from /public/vm, from pinned and hash-verified
// inputs: v86, its BIOSes (patched), the C: chunks (patched), the D: chunks, the guest's
// display modes and the saved state, which carries the disk blocks the boot after it reads.
// Usage: bun tools/vm/build.ts [--out DIR] [--cache DIR]
//   --out    output directory, replaced entirely (default: public/vm)
//   --cache  verified downloads, reused across runs (default: $XDG_CACHE_HOME/lexoliu-vm)
import { homedir } from "node:os";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { HDB_CHUNK_SIZE, HDB_SIZE, buildHda, buildHdb, fileExtents, firstPartitionOffset, run, writeParts } from "./disk.ts";
import { type ModesFile, bootDisplay, checkAddedModes, checkOptionRomChecksum, guestModes } from "./display.ts";
import { CHUNK_SIZE, DISK_SIZE, fetchHdaBase } from "./hda.ts";
import { buildDriveD, buildReschg, buildUnshield } from "./netscape.ts";
import { VBEMP_PATH, applyBytePatches, cDrivePatches, vgaBiosPatches } from "./patches.ts";
import { parseWavFormat, snapshotAtStartupSound } from "./snapshot.ts";
import { fetchSources } from "./sources.ts";

const ROOT = join(dirname(import.meta.path), "..", "..");
// HKCU\AppEvents\Schemes\Apps\.Default\SystemStart\.Current in the base image's USER.DAT.
const STARTUP_SOUND = "/WINDOWS/MEDIA/The Microsoft Sound.wav";
// The registry hives, preloaded whole: which of their pages the boot after the saved state
// reads follows which keys get looked up, and that changes with the guest's timing.
const REGISTRY_HIVES = ["/WINDOWS/SYSTEM.DAT", "/WINDOWS/USER.DAT"];
const STATE_FILE = "win95-netscape.state.bin.zst";
const STATE_ZSTD_LEVEL = 19;
const MODES_FILE = "modes.json";

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
 * The display switches the boot after the snapshot is recorded with, as the page switches the
 * guest to fit the viewport: the largest portrait mode and the largest landscape mode other
 * than the snapshot's within its pixel count, so the preload holds what a switch in either
 * orientation reads.
 */
function pageModeSwitches(modes: [number, number][], [sw, sh]: [number, number]): [number, number][] {
  const fit = modes.filter(([w, h]) => w * h <= sw * sh && !(w === sw && h === sh));
  const largest = (ms: [number, number][]) => {
    if (ms.length === 0) throw new Error("the guest has no display mode to switch to in one orientation");
    return ms.reduce((a, b) => (b[0] * b[1] > a[0] * a[1] ? b : a));
  };
  return [largest(fit.filter(([w, h]) => h > w)), largest(fit.filter(([w, h]) => w > h))];
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

  const [v86Dir, unshield, reschg] = await stage("build tools", () =>
    Promise.all([
      (async () => {
        const dir = join(work, "v86");
        await mkdir(dir);
        await run(["tar", "-xzf", src.v86, "-C", dir]);
        return join(dir, "package", "build");
      })(),
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
    await cp(join(v86Dir, "libv86.js"), join(out, "libv86.js"));
    await cp(join(v86Dir, "v86.wasm"), join(out, "v86.wasm"));
    await cp(src.seabios, join(out, "seabios.bin"));
    const vgabios = applyBytePatches("vgabios.bin", await Bun.file(src.vgabios).bytes(), vgaBiosPatches);
    checkOptionRomChecksum(vgabios);
    await Bun.write(join(out, "vgabios.bin"), vgabios);
  });

  const modes = await stage("derive display modes", async () => {
    const image = join(work, "c.img");
    const drv = join(work, "vbemp.drv");
    await run(["mcopy", "-o", "-i", `${image}@@${await firstPartitionOffset(image)}`, `::${VBEMP_PATH}`, drv], {
      env: { MTOOLS_SKIP_CHECK: "1" },
    });
    const boot = bootDisplay(await Bun.file(join(dirname(import.meta.path), "guest", "netscape.reg")).text());
    const modes = guestModes(await Bun.file(join(out, "vgabios.bin")).bytes(), await Bun.file(drv).bytes(), boot);
    checkAddedModes(await Bun.file(src.vgabios).bytes(), modes);
    console.log(`display modes at ${boot.bitsPerPixel} bpp: ${modes.modes.map(([w, h]) => `${w}x${h}`).join(" ")}`);
    return modes;
  });

  const snapshot = await stage("boot to startup sound", async () => {
    const image = join(work, "c.img");
    const wav = join(work, "startup.wav");
    await run(["mcopy", "-o", "-i", `${image}@@${await firstPartitionOffset(image)}`, `::${STARTUP_SOUND}`, wav], {
      env: { MTOOLS_SKIP_CHECK: "1" },
    });
    return snapshotAtStartupSound({
      libv86: join(v86Dir, "libv86.mjs"),
      wasm: join(out, "v86.wasm"),
      seabios: join(out, "seabios.bin"),
      vgabios: join(out, "vgabios.bin"),
      hda: {
        url: join(out, "hda", ".img"),
        size: DISK_SIZE,
        chunkSize: CHUNK_SIZE,
        image,
        pinned: (await Promise.all(REGISTRY_HIVES.map((hive) => fileExtents(image, hive)))).flat(),
      },
      hdb: { url: join(out, "hdb", ".img"), size: HDB_SIZE, chunkSize: HDB_CHUNK_SIZE, image: join(work, "d.img"), pinned: [] },
      startupSound: parseWavFormat(await Bun.file(wav).bytes()),
      screen: modes.snapshotMode,
      modeSwitches: pageModeSwitches(modes.modes, modes.snapshotMode),
    });
  });

  // Written once the snapshot is taken: it only exists if RESCHG.EXE was running in the state.
  await Bun.write(join(out, MODES_FILE), `${JSON.stringify({ ...modes, reschgInState: true } satisfies ModesFile)}\n`);

  await stage("compress state", async () => {
    await Bun.write(join(out, STATE_FILE), await Bun.zstdCompress(snapshot.state, { level: STATE_ZSTD_LEVEL }));
  });

  await rm(work, { recursive: true, force: true });
  for (const [name, s] of timings) console.log(`${name.padEnd(24)} ${s.toFixed(1).padStart(7)} s`);
  for (const f of ["libv86.js", "v86.wasm", "seabios.bin", "vgabios.bin", MODES_FILE, STATE_FILE]) {
    console.log(`${f.padEnd(32)} ${Bun.file(join(out, f)).size} bytes`);
  }
  console.log(`state (uncompressed)             ${snapshot.state.length} bytes`);
  for (const disk of ["hda", "hdb"] as const) {
    const { readBytes, preloadedBlocks } = snapshot[disk];
    console.log(`${disk} boot reads                   ${readBytes} bytes, ${preloadedBlocks} blocks preloaded into the state`);
  }
} catch (e) {
  console.error(`vm build failed: ${e instanceof Error ? (e.stack ?? e.message) : e}`);
  process.exit(1);
}
