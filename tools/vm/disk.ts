// Disk image construction: external tools, MBR parsing, FAT access through mtools.
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { CHUNK_SIZE, DISK_SIZE, chunkNames, partNames } from "./hda.ts";
import type { FileAdd, FilePatch } from "./patches.ts";

const SECTOR = 512;

/** Runs a command, failing with its output when it exits non-zero; returns stdout. */
export async function run(cmd: string[], opts: { cwd?: string; env?: Record<string, string> } = {}): Promise<string> {
  const proc = Bun.spawn(cmd, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`${cmd.join(" ")} exited with ${code}\n${stdout}${stderr}`);
  return stdout;
}

// mtools refuses images whose BPB geometry disagrees with its own idea of the disk; the
// images here are partitions inside a larger disk, so that check does not apply.
const MTOOLS_ENV = { MTOOLS_SKIP_CHECK: "1" };
const mtools = (tool: string, args: string[]) => run([tool, ...args], { env: MTOOLS_ENV });

/** Byte offset of the first MBR partition, read from the partition table. */
export async function firstPartitionOffset(image: string): Promise<number> {
  const mbr = await Bun.file(image).slice(0, SECTOR).bytes();
  if (mbr[510] !== 0x55 || mbr[511] !== 0xaa) throw new Error(`${image}: no MBR signature`);
  const lba = new DataView(mbr.buffer).getUint32(0x1be + 8, true);
  if (lba === 0) throw new Error(`${image}: first partition entry is empty`);
  return lba * SECTOR;
}

/** Where the first partition's FAT12 or FAT16 file system keeps its parts, as image offsets. */
interface FatLayout {
  part: number;
  clusterBytes: number;
  /** The first FAT, [start, end). */
  fat: [number, number];
  /** The root directory, [start, end). */
  root: [number, number];
  /** The first byte of cluster 2. */
  data: number;
  /** Clusters in the data area. */
  clusters: number;
}

async function fatLayout(image: string): Promise<FatLayout> {
  const part = await firstPartitionOffset(image);
  const bpb = new DataView((await Bun.file(image).slice(part, part + SECTOR).bytes()).buffer);
  const bytesPerSector = bpb.getUint16(11, true);
  const reserved = bpb.getUint16(14, true);
  const fats = bpb.getUint8(16);
  const rootEntries = bpb.getUint16(17, true);
  const sectorsPerFat = bpb.getUint16(22, true);
  if (sectorsPerFat === 0) throw new Error(`${image}: FAT32 is not supported`);
  const totalSectors = bpb.getUint16(19, true) || bpb.getUint32(32, true);
  const fat = part + reserved * bytesPerSector;
  const root = fat + fats * sectorsPerFat * bytesPerSector;
  const data = root + rootEntries * 32;
  const clusterBytes = bpb.getUint8(13) * bytesPerSector;
  return {
    part,
    clusterBytes,
    fat: [fat, fat + sectorsPerFat * bytesPerSector],
    root: [root, data],
    data,
    clusters: Math.floor((part + totalSectors * bytesPerSector - data) / clusterBytes),
  };
}

/** Which file of a disk image's first partition holds each of its blocks. */
export interface DiskFiles {
  /** The file (or directory, or the partition's FAT or root directory) holding `block`. */
  fileOf(block: number): string | undefined;
  /** Every block of `file`. */
  blocksOf(file: string): number[];
}

/**
 * Maps the blocks of `blockSize` bytes of `image` to the files of its first partition (a FAT12
 * or FAT16 file system, 8.3 names), from its directory tree and the cluster chains in its FAT.
 */
export async function diskFiles(image: string, blockSize: number): Promise<DiskFiles> {
  const { clusterBytes, fat, root, data, clusters } = await fatLayout(image);
  if (clusterBytes % blockSize !== 0 || data % blockSize !== 0 || root[0] % blockSize !== 0) {
    throw new Error(`${image}: the file system is not aligned to ${blockSize}-byte blocks`);
  }
  const bytes = await Bun.file(image).bytes();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // FAT12 has fewer than 4085 clusters (Microsoft's FAT specification).
  const fat12 = clusters < 4085;
  const next = (c: number) => {
    if (!fat12) return view.getUint16(fat[0] + 2 * c, true);
    const v = view.getUint16(fat[0] + Math.floor((3 * c) / 2), true);
    return c & 1 ? v >> 4 : v & 0xfff;
  };
  const end = fat12 ? 0xff8 : 0xfff8;
  const chain = (first: number) => {
    const out: number[] = [];
    for (let c = first; c >= 2 && c < end; c = next(c)) {
      if (out.length > clusters) throw new Error(`${image}: the cluster chain from ${first} loops`);
      out.push(c);
    }
    return out;
  };

  const owner = new Int32Array(Math.ceil(bytes.length / blockSize)).fill(-1);
  const names: string[] = [];
  const blocks: number[][] = [];
  const own = (name: string, ranges: [number, number][]) => {
    const id = names.push(name) - 1;
    blocks.push([]);
    for (const [start, stop] of ranges) {
      for (let b = start / blockSize; b < stop / blockSize; b++) {
        owner[b] = id;
        blocks[id].push(b);
      }
    }
  };
  const clusterRanges = (cs: number[]): [number, number][] =>
    cs.map((c) => [data + (c - 2) * clusterBytes, data + (c - 1) * clusterBytes]);
  own("<FAT>", [fat]);
  own("/", [root]);
  const walk = (dir: string, ranges: [number, number][]) => {
    for (const [start, stop] of ranges) {
      for (let e = start; e < stop; e += 32) {
        const first = bytes[e];
        if (first === 0) return;
        const attr = bytes[e + 11];
        if (first === 0xe5 || attr === 0x0f || attr & 0x08) continue; // deleted, long name, volume label
        const base = Buffer.from(bytes.subarray(e, e + 8)).toString("latin1").trimEnd();
        if (base === "." || base === "..") continue;
        const ext = Buffer.from(bytes.subarray(e + 8, e + 11)).toString("latin1").trimEnd();
        const path = `${dir}${base}${ext ? `.${ext}` : ""}`;
        const cs = chain(view.getUint16(e + 26, true));
        if (cs.length === 0) continue;
        const extents = clusterRanges(cs);
        own(attr & 0x10 ? `${path}/` : path, extents);
        if (attr & 0x10) walk(`${path}/`, extents);
      }
    }
  };
  walk("/", [root]);
  const ids = new Map(names.map((n, i) => [n, i]));
  return {
    fileOf: (block) => (owner[block] >= 0 ? names[owner[block]] : undefined),
    blocksOf(file) {
      const id = ids.get(file);
      if (id === undefined) throw new Error(`${image}: no file ${file}`);
      return blocks[id];
    },
  };
}

/** The byte range of the image that holds the first FAT of its first partition. */
export async function firstFatExtent(image: string): Promise<[number, number]> {
  return (await fatLayout(image)).fat;
}

/**
 * The byte ranges of the image that hold the file at `path` in the first partition (a FAT12 or
 * FAT16 file system), from its cluster chain as mtools reports it, whole clusters included.
 */
export async function fileExtents(image: string, path: string): Promise<[number, number][]> {
  const { part, clusterBytes, data } = await fatLayout(image);
  const chain = await mtools("mshowfat", ["-i", `${image}@@${part}`, `::${path}`]);
  const runs = [...chain.matchAll(/<(\d+)(?:-(\d+))?>/g)];
  if (runs.length === 0) throw new Error(`mshowfat printed no clusters for ${path}: ${chain}`);
  return runs.map(([, first, last]) => [
    data + (Number(first) - 2) * clusterBytes,
    data + (Number(last ?? first) - 1) * clusterBytes,
  ]);
}

// The D: drive geometry: 16 cylinders x 16 heads x 63 sectors, one FAT12 partition
// starting at the first sector of the second track, as DOS partitions do.
const HDB_CYLINDERS = 16;
const HDB_HEADS = 16;
const HDB_SECTORS = 63;
export const HDB_SIZE = HDB_CYLINDERS * HDB_HEADS * HDB_SECTORS * SECTOR;
/** D:'s chunk size; it must divide HDB_SIZE (2^17 * 63). */
export const HDB_CHUNK_SIZE = 128 * 1024;
const PARTITION_TYPE_FAT12 = 0x01;

/** Builds the D: disk image holding every entry of `rootDir` at its root, with the volume `label` and `serial`. */
export async function buildHdb(out: string, rootDir: string, label: string, serial: number): Promise<void> {
  const total = HDB_SIZE / SECTOR;
  const start = HDB_SECTORS;
  const mbr = new Uint8Array(SECTOR);
  const entry = new DataView(mbr.buffer, 0x1be, 16);
  const last = HDB_CYLINDERS - 1;
  entry.setUint8(0, 0x00); // not bootable
  entry.setUint8(1, 1); // start head
  entry.setUint8(2, 1); // start sector (cylinder 0)
  entry.setUint8(3, 0); // start cylinder
  entry.setUint8(4, PARTITION_TYPE_FAT12);
  entry.setUint8(5, HDB_HEADS - 1); // end head
  entry.setUint8(6, HDB_SECTORS | ((last >> 8) << 6)); // end sector + cylinder bits 8-9
  entry.setUint8(7, last & 0xff); // end cylinder
  entry.setUint32(8, start, true);
  entry.setUint32(12, total - start, true);
  mbr[510] = 0x55;
  mbr[511] = 0xaa;
  const image = new Uint8Array(HDB_SIZE);
  image.set(mbr);
  await Bun.write(out, image);

  const part = `${out}@@${start * SECTOR}`;
  await mtools("mformat", [
    "-i", part, "-v", label, "-N", serial.toString(16), "-T", String(total - start),
    "-h", String(HDB_HEADS), "-s", String(HDB_SECTORS), "-H", String(start), "::",
  ]);
  const fatType = Buffer.from(await Bun.file(out).slice(start * SECTOR + 54, start * SECTOR + 62).bytes()).toString("latin1");
  if (fatType !== "FAT12   ") throw new Error(`mformat produced ${JSON.stringify(fatType)}, partition type says FAT12`);
  const entries = (await readdir(rootDir)).map((e) => join(rootDir, e));
  await mtools("mcopy", ["-s", "-i", part, ...entries, "::"]);
}

/**
 * Writes the C: chunks to `outDir`: the base chunks from `baseDir` with `patches` applied
 * to files in the first partition and `added` copied into it. `workDir` receives the
 * assembled image.
 */
export async function buildHda(baseDir: string, outDir: string, workDir: string, patches: FilePatch[], added: FileAdd[]): Promise<void> {
  const image = join(workDir, "c.img");
  const assembled = new Uint8Array(DISK_SIZE);
  await Promise.all(
    chunkNames.map(async (name, k) => assembled.set(await Bun.file(join(baseDir, name)).bytes(), k * CHUNK_SIZE)),
  );
  await Bun.write(image, assembled);

  const part = `${image}@@${await firstPartitionOffset(image)}`;
  for (const patch of patches) {
    const local = join(workDir, "patched-file");
    await mtools("mcopy", ["-o", "-i", part, `::${patch.path}`, local]);
    await Bun.write(local, patch.apply(await Bun.file(local).bytes()));
    await mtools("mcopy", ["-o", "-i", part, local, `::${patch.path}`]);
    console.log(`hda: patched ${patch.path} (${patch.why})`);
  }
  for (const file of added) {
    const exists = await run(["mdir", "-b", "-i", part, `::${file.path}`], { env: MTOOLS_ENV }).then(
      () => true,
      () => false,
    );
    if (exists) throw new Error(`hda: ${file.path} is already in the base image`);
    await mtools("mcopy", ["-i", part, file.from, `::${file.path}`]);
    console.log(`hda: added ${file.path} (${file.why})`);
  }

  await writeParts(image, outDir, CHUNK_SIZE);
}

/** Cuts `image` into the chunk files v86 loads on demand with `use_parts`. */
export async function writeParts(image: string, outDir: string, chunkSize: number): Promise<void> {
  const bytes = await Bun.file(image).bytes();
  await mkdir(outDir, { recursive: true });
  await Promise.all(
    partNames(bytes.length, chunkSize).map((name, k) =>
      Bun.write(join(outDir, name), bytes.subarray(k * chunkSize, (k + 1) * chunkSize)),
    ),
  );
}
