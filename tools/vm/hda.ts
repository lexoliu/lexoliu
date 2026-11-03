// The Windows 95 C: base image (copy.sh windows95-v3), served as fixed-size chunks and
// verified against tools/vm/hda.sha256.
// `bun tools/vm/hda.ts --write-manifest` re-pins the manifest to the upstream chunks.
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { download, sha256 } from "./sources.ts";

const BASE_URL = "https://i.copy.sh/windows95-v3/";
export const CHUNK_SIZE = 256 * 1024;
export const DISK_SIZE = 471859200;
const CONCURRENCY = 16;
const MANIFEST = join(dirname(import.meta.path), "hda.sha256");

/**
 * Chunk file names in disk order, as v86 requests them with `use_parts` and a
 * `fixed_chunk_size`: v86 names every chunk, the last included, by a full chunk's range, so
 * `chunkSize` must divide `diskSize`.
 */
export function partNames(diskSize: number, chunkSize: number): string[] {
  if (diskSize % chunkSize !== 0) throw new Error(`chunk size ${chunkSize} does not divide the disk size ${diskSize}`);
  return Array.from({ length: diskSize / chunkSize }, (_, k) => `${k * chunkSize}-${(k + 1) * chunkSize}.img`);
}

export const chunkNames = partNames(DISK_SIZE, CHUNK_SIZE);

async function readManifest(): Promise<Map<string, string>> {
  const expected = new Map<string, string>();
  for (const line of (await Bun.file(MANIFEST).text()).split("\n")) {
    if (!line) continue;
    const [hash, name] = line.split("  ");
    expected.set(name, hash);
  }
  if (expected.size !== chunkNames.length) {
    throw new Error(`hda.sha256 has ${expected.size} entries, expected ${chunkNames.length}`);
  }
  return expected;
}

async function forEachChunk(work: (name: string) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < chunkNames.length) await work(chunkNames[next++]);
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

/** Ensures `dir` holds every unmodified base chunk, downloading what is missing or wrong. */
export async function fetchHdaBase(dir: string): Promise<void> {
  const expected = await readManifest();
  await mkdir(dir, { recursive: true });
  let fetched = 0;
  await forEachChunk(async (name) => {
    const path = join(dir, name);
    const want = expected.get(name)!;
    if (existsSync(path) && sha256(await Bun.file(path).bytes()) === want) return;
    const bytes = await download(BASE_URL + name);
    const got = sha256(bytes);
    if (got !== want) throw new Error(`hash mismatch for ${BASE_URL}${name}: got ${got}, manifest ${want}`);
    await Bun.write(path, bytes);
    fetched++;
  });
  console.log(`hda: ${chunkNames.length} base chunks verified (${fetched} downloaded)`);
}

async function writeManifest(): Promise<void> {
  const hashes = new Map<string, string>();
  await forEachChunk(async (name) => {
    hashes.set(name, sha256(await download(BASE_URL + name)));
  });
  await Bun.write(MANIFEST, chunkNames.map((n) => `${hashes.get(n)}  ${n}`).join("\n") + "\n");
  console.log(`hda.sha256 written: ${chunkNames.length} chunks`);
}

if (import.meta.main) {
  if (process.argv[2] !== "--write-manifest") throw new Error("usage: bun tools/vm/hda.ts --write-manifest");
  await writeManifest();
}
