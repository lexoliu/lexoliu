// Pinned, hash-verified inputs listed in tools/vm/sources.json.
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import sources from "./sources.json";

export type SourceName = keyof typeof sources;

const NETWORK_RETRIES = 3;

export function sha256(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

/** Downloads `url`, retrying only on network errors; an HTTP error status fails at once. */
export async function download(url: string): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 0; attempt < NETWORK_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url);
    } catch (e) {
      lastError = e;
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new Error(`network error for ${url}: ${lastError}`);
}

/** Ensures every source is present in `dir` with its pinned hash; returns name -> local path. */
export async function fetchSources(dir: string): Promise<Record<SourceName, string>> {
  const names = Object.keys(sources) as SourceName[];
  const paths = await Promise.all(
    names.map(async (name) => {
      const { url, sha256: want } = sources[name];
      const path = join(dir, name);
      if (existsSync(path) && sha256(await Bun.file(path).bytes()) === want) return path;
      const bytes = await download(url);
      const got = sha256(bytes);
      if (got !== want) throw new Error(`hash mismatch for ${url}: got ${got}, sources.json ${want}`);
      await mkdir(dirname(path), { recursive: true });
      await Bun.write(path, bytes);
      return path;
    }),
  );
  console.log(`sources: ${names.length} inputs verified`);
  return Object.fromEntries(names.map((n, i) => [n, paths[i]])) as Record<SourceName, string>;
}
