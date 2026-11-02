// Generates every VM asset the page loads from /public/vm, from pinned and hash-verified
// inputs: v86, its BIOSes, the C: chunks (patched), the D: image and the saved state.
// Usage: bun tools/vm/build.ts [--out DIR] [--cache DIR]
//   --out    output directory, replaced entirely (default: public/vm)
//   --cache  verified downloads, reused across runs (default: $XDG_CACHE_HOME/lexoliu-vm)
import { homedir } from "node:os";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { buildHda, buildHdb, firstPartitionOffset, run } from "./disk.ts";
import { fetchHdaBase } from "./hda.ts";
import { buildDriveD, buildReschg, buildUnshield } from "./netscape.ts";
import { applyBytePatches, cDrivePatches, vgaBiosPatches } from "./patches.ts";
import { parseWavFormat, snapshotAtStartupSound } from "./snapshot.ts";
import { fetchSources } from "./sources.ts";

const ROOT = join(dirname(import.meta.path), "..", "..");
// HKCU\AppEvents\Schemes\Apps\.Default\SystemStart\.Current in the base image's USER.DAT.
const STARTUP_SOUND = "/WINDOWS/MEDIA/The Microsoft Sound.wav";
const STATE_FILE = "win95-netscape.state.bin.zst";
const STATE_ZSTD_LEVEL = 19;

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
        await buildHdb(join(out, "hdb.img"), root, "NETSCAPE");
      })(),
      buildHda(join(cache, "hda"), join(out, "hda"), work, cDrivePatches),
    ]),
  );

  await stage("copy runtime", async () => {
    await cp(join(v86Dir, "libv86.js"), join(out, "libv86.js"));
    await cp(join(v86Dir, "v86.wasm"), join(out, "v86.wasm"));
    await cp(src.seabios, join(out, "seabios.bin"));
    await Bun.write(join(out, "vgabios.bin"), applyBytePatches("vgabios.bin", await Bun.file(src.vgabios).bytes(), vgaBiosPatches));
  });

  const state = await stage("boot to startup sound", async () => {
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
      hdaDir: join(out, "hda"),
      hdb: join(out, "hdb.img"),
      startupSound: parseWavFormat(await Bun.file(wav).bytes()),
    });
  });

  await stage("compress state", async () => {
    await Bun.write(join(out, STATE_FILE), await Bun.zstdCompress(state, { level: STATE_ZSTD_LEVEL }));
  });

  await rm(work, { recursive: true, force: true });
  for (const [name, s] of timings) console.log(`${name.padEnd(24)} ${s.toFixed(1).padStart(7)} s`);
  for (const f of ["libv86.js", "v86.wasm", "seabios.bin", "vgabios.bin", "hdb.img", STATE_FILE]) {
    console.log(`${f.padEnd(32)} ${Bun.file(join(out, f)).size} bytes`);
  }
  console.log(`state (uncompressed)             ${state.length} bytes`);
} catch (e) {
  console.error(`vm build failed: ${e instanceof Error ? (e.stack ?? e.message) : e}`);
  process.exit(1);
}
