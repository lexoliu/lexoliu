// Builds the deploy directory: the page bundled by Bun's HTML bundler (index.html -> a content-
// hashed script), the generated VM assets under public/vm, the root files the site serves, the
// sitemap, and manifest.json, which gives main.js the content hash of every file it fetches by URL string.
//
//   bun tools/site/build.ts [--out DIR]
//
//   --out    output directory, replaced entirely (default: dist)
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(import.meta.path), "..", "..");
const VM = join(ROOT, "public", "vm");
/** Files served from the repository root at their own path. */
const ROOT_FILES = ["robots.txt", "llms.txt", "CNAME"];
/** The page the sitemap lists, and the file whose last commit dates it. */
const SITE_URL = "https://lexo.cool/";
const PAGE_SOURCE = "index.html";
/** Directories of numbered chunks that v86 requests, each versioned as a whole. */
const DISKS = ["hda", "hdb"];
/** The hash is a prefix of this many hex digits of the SHA-256. */
const HASH_LENGTH = 12;

function option(name: string, fallback: string): string {
  const i = Bun.argv.indexOf(name);
  if (i === -1) return fallback;
  const value = Bun.argv[i + 1];
  if (value === undefined) throw new Error(`${name} needs a value`);
  return value;
}

const out = option("--out", join(ROOT, "dist"));

async function* files(dir: string): AsyncGenerator<string> {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

function digest(parts: Iterable<string | Uint8Array>): string {
  const hasher = new Bun.CryptoHasher("sha256");
  for (const part of parts) hasher.update(part);
  return hasher.digest("hex").slice(0, HASH_LENGTH);
}

function git(...args: string[]): string {
  const run = Bun.spawnSync(["git", ...args], { cwd: ROOT });
  if (run.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr.toString().trim()}`);
  return run.stdout.toString().trim();
}

/** sitemap.xml, its page dated by the last commit of the file it is built from. */
function sitemap(): string {
  // A shallow clone dates every file by its one commit, so the date would be wrong.
  if (git("rev-parse", "--is-shallow-repository") === "true") throw new Error("the sitemap needs the full history: fetch with depth 0");
  const lastmod = git("log", "-1", "--format=%cs", "--", PAGE_SOURCE);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) throw new Error(`no commit dates ${PAGE_SOURCE}`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>
</urlset>
`;
}

/** The path (relative to public/vm) -> content hash of every runtime file, a disk as one entry. */
async function manifest(): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  const disks = DISKS.map((d) => join(VM, d));
  for await (const path of files(VM)) {
    if (disks.some((d) => path.startsWith(`${d}/`))) continue;
    const name = relative(VM, path);
    if (name === "modes.json") continue; // fetched fresh, never by a versioned URL
    if (name === "preview.png") continue; // crawlers fetch it at its stable absolute URL
    entries[name] = digest([new Uint8Array(await Bun.file(path).arrayBuffer())]);
  }
  for (const disk of DISKS) {
    const parts: (string | Uint8Array)[] = [];
    for await (const path of files(join(VM, disk))) {
      parts.push(relative(VM, path), "\0", new Uint8Array(await Bun.file(path).arrayBuffer()), "\0");
    }
    if (parts.length === 0) throw new Error(`public/vm/${disk} has no chunks: run tools/vm/build.ts first`);
    // v86 appends the chunk range to the configured name and keeps its query string.
    entries[`${disk}/.img`] = digest(parts);
  }
  return entries;
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const built = await Bun.build({ entrypoints: [join(ROOT, "index.html")], outdir: out, splitting: true });
if (!built.success) {
  for (const log of built.logs) console.error(log);
  throw new Error("bundling index.html failed");
}

await cp(join(ROOT, "public"), join(out, "public"), { recursive: true });
for (const file of ROOT_FILES) await cp(join(ROOT, file), join(out, file));
await Bun.write(join(out, "sitemap.xml"), sitemap());
await Bun.write(join(out, "manifest.json"), `${JSON.stringify(await manifest(), null, 2)}\n`);

for (const output of built.outputs) console.log(`${relative(out, output.path).padEnd(32)} ${output.size} bytes`);
