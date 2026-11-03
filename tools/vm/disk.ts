// Disk image construction: external tools, MBR parsing, FAT access through mtools.
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { CHUNK_SIZE, DISK_SIZE, chunkNames, partNames } from "./hda.ts";
import type { FilePatch } from "./patches.ts";

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

/**
 * The byte ranges of the image that hold the file at `path` in the first partition (a FAT12 or
 * FAT16 file system), from its cluster chain as mtools reports it, whole clusters included.
 */
export async function fileExtents(image: string, path: string): Promise<[number, number][]> {
  const part = await firstPartitionOffset(image);
  const bpb = new DataView((await Bun.file(image).slice(part, part + SECTOR).bytes()).buffer);
  const bytesPerSector = bpb.getUint16(11, true);
  const clusterBytes = bpb.getUint8(13) * bytesPerSector;
  const reserved = bpb.getUint16(14, true);
  const fats = bpb.getUint8(16);
  const rootEntries = bpb.getUint16(17, true);
  const sectorsPerFat = bpb.getUint16(22, true);
  if (sectorsPerFat === 0) throw new Error(`${image}: FAT32 is not supported`);
  const data = part + (reserved + fats * sectorsPerFat) * bytesPerSector + rootEntries * 32;
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

/** Builds the D: disk image holding every entry of `rootDir` at its root. */
export async function buildHdb(out: string, rootDir: string, label: string): Promise<void> {
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
    "-i", part, "-v", label, "-T", String(total - start),
    "-h", String(HDB_HEADS), "-s", String(HDB_SECTORS), "-H", String(start), "::",
  ]);
  const fatType = Buffer.from(await Bun.file(out).slice(start * SECTOR + 54, start * SECTOR + 62).bytes()).toString("latin1");
  if (fatType !== "FAT12   ") throw new Error(`mformat produced ${JSON.stringify(fatType)}, partition type says FAT12`);
  const entries = (await readdir(rootDir)).map((e) => join(rootDir, e));
  await mtools("mcopy", ["-s", "-i", part, ...entries, "::"]);
}

/**
 * Writes the C: chunks to `outDir`: the base chunks from `baseDir` with `patches` applied
 * to files in the first partition. `workDir` receives the assembled image.
 */
export async function buildHda(baseDir: string, outDir: string, workDir: string, patches: FilePatch[]): Promise<void> {
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
