// v86 built from source: the pinned upstream commit with the fixes in tools/vm/v86/ applied, until
// a v86 release carries them. Each patch is the diff of an upstream pull request:
//   sb16-dma-pacing.patch  speaker: drop stale DAC requests from the worklet (copy/v86#1661)
//   pam-rom-protect.patch  pci: emulate the i440FX PAM write protection of the shadowed ROMs
import { availableParallelism } from "node:os";
import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { run } from "./disk.ts";
import type { SourceName } from "./sources.ts";

const PATCH_DIR = join(dirname(import.meta.path), "v86");
const PATCHES = ["sb16-dma-pacing.patch", "pam-rom-protect.patch"];
const ARTIFACTS = ["libv86.js", "libv86.mjs", "v86.wasm"];

/** The patched v86 tree: libv86.js, libv86.mjs and v86.wasm in `build`, the BIOSes in `bios`. */
export type V86Build = { build: string; bios: string };

export async function buildV86(src: Record<SourceName, string>, workDir: string): Promise<V86Build> {
  const dir = join(workDir, "v86");
  await mkdir(dir);
  await run(["tar", "-xzf", src.v86, "-C", dir, "--strip-components=1"]);
  // Without a repository of its own, git apply would otherwise apply relative to an enclosing one.
  const env = { GIT_CEILING_DIRECTORIES: workDir };
  for (const patch of PATCHES) await run(["git", "apply", join(PATCH_DIR, patch)], { cwd: dir, env });
  // The Makefile expects the Closure Compiler here.
  await mkdir(join(dir, "closure-compiler"));
  await cp(src["closure-compiler.jar"], join(dir, "closure-compiler", "compiler.jar"));
  await run(["make", `-j${availableParallelism()}`, ...ARTIFACTS.map((f) => `build/${f}`)], { cwd: dir });
  return { build: join(dir, "build"), bios: join(dir, "bios") };
}
