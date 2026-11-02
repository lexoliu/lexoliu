// Fetches the Windows 95 C: disk chunks from the copy.sh base image into public/vm/hda,
// verifying each against tools/vm/hda.sha256.
// Usage: bun tools/vm/fetch-hda.ts [--out DIR] [--write-manifest]
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const BASE_URL = "https://i.copy.sh/windows95-v3/";
const CHUNK_SIZE = 256 * 1024;
const DISK_SIZE = 471859200;
const CHUNK_COUNT = Math.ceil(DISK_SIZE / CHUNK_SIZE);
const CONCURRENCY = 16;
const NETWORK_RETRIES = 3;
const PROGRESS_EVERY = 100;

const root = join(dirname(import.meta.path), "..", "..");
const manifestPath = join(dirname(import.meta.path), "hda.sha256");

const args = process.argv.slice(2);
const writeManifest = args.includes("--write-manifest");
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args[outIdx + 1] : join(root, "public", "vm", "hda");
if (outIdx >= 0 && !outDir) throw new Error("--out requires a directory");

const names: string[] = [];
for (let k = 0; k < CHUNK_COUNT; k++) {
  const start = k * CHUNK_SIZE;
  names.push(`${start}-${Math.min(start + CHUNK_SIZE, DISK_SIZE)}.img`);
}

function sha256(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

const expected = new Map<string, string>();
if (!writeManifest) {
  for (const line of (await Bun.file(manifestPath).text()).split("\n")) {
    if (!line) continue;
    const [hash, name] = line.split("  ");
    expected.set(name, hash);
  }
  if (expected.size !== CHUNK_COUNT) {
    throw new Error(`manifest has ${expected.size} entries, expected ${CHUNK_COUNT}`);
  }
}

async function download(name: string): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 0; attempt < NETWORK_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(BASE_URL + name);
    } catch (e) {
      lastError = e;
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${BASE_URL}${name}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new Error(`network error for ${BASE_URL}${name}: ${lastError}`);
}

const hashes = new Map<string, string>();
let done = 0;
let next = 0;

async function worker() {
  while (next < names.length) {
    const name = names[next++];
    const path = join(outDir, name);
    const want = expected.get(name);
    let hash: string | undefined;
    if (!writeManifest && existsSync(path)) {
      const h = sha256(new Uint8Array(await Bun.file(path).arrayBuffer()));
      if (h === want) hash = h;
    }
    if (hash === undefined) {
      const bytes = await download(name);
      hash = sha256(bytes);
      if (!writeManifest && hash !== want) {
        throw new Error(`hash mismatch for ${name}: got ${hash}, manifest ${want}`);
      }
      await Bun.write(path, bytes);
    }
    hashes.set(name, hash);
    if (++done % PROGRESS_EVERY === 0) console.log(`${done}/${names.length} chunks`);
  }
}

try {
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
} catch (e) {
  console.error(`fetch-hda failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

if (writeManifest) {
  await Bun.write(manifestPath, names.map((n) => `${hashes.get(n)}  ${n}`).join("\n") + "\n");
}
console.log(`${writeManifest ? "manifest written" : "verified"}: ${names.length} chunks`);
