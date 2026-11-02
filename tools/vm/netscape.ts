// The D: drive contents: Netscape Navigator 3.0 unpacked from its installer, its registry
// settings and bookmarks, and RESCHG.EXE.
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { run } from "./disk.ts";
import { applyBytePatches, netscapeExePatches } from "./patches.ts";
import type { SourceName } from "./sources.ts";

const HERE = dirname(import.meta.path);

/** Compiles unshieldv3 (InstallShield 3 archive extractor) with the host C/C++ compiler. */
export async function buildUnshield(src: Record<SourceName, string>, workDir: string): Promise<string> {
  const dir = join(workDir, "unshieldv3");
  await mkdir(dir, { recursive: true });
  const config = (await Bun.file(src["unshieldv3/config.h.in"]).text())
    .replace("@PROJECT_NAME@", "unshieldv3")
    .replace("@PROJECT_VERSION@", "pinned");
  await Bun.write(join(dir, "config.h"), config);
  const srcDir = dirname(src["unshieldv3/main.cpp"]);
  const blast = join(dir, "blast.o");
  await run(["cc", "-O2", "-c", src["unshieldv3/blast.c"], "-o", blast]);
  const bin = join(dir, "unshieldv3");
  await run([
    "c++", "-std=c++17", "-O2", `-I${dir}`, `-I${srcDir}`,
    src["unshieldv3/main.cpp"], src["unshieldv3/ISArchiveV3.cpp"], blast, "-o", bin,
  ]);
  return bin;
}

// InstallShield 3 archives start with this signature; the archive length follows at +18.
const IS3_SIGNATURE = Buffer.from([0x13, 0x5d, 0x65, 0x8c]);
const IS3_LENGTH_OFFSET = 18;

/** Extracts every InstallShield 3 archive embedded in the self-extracting installer. */
async function extractInstaller(installer: string, unshield: string, outDir: string, workDir: string): Promise<void> {
  const exe = Buffer.from(await Bun.file(installer).bytes());
  const archives: string[] = [];
  for (let pos = exe.indexOf(IS3_SIGNATURE); pos >= 0; ) {
    const length = exe.readUInt32LE(pos + IS3_LENGTH_OFFSET);
    if (pos + length > exe.length) throw new Error(`archive at ${pos} overruns the installer (${length} bytes)`);
    const path = join(workDir, `netscape-${archives.length}.z`);
    await Bun.write(path, exe.subarray(pos, pos + length));
    archives.push(path);
    pos = exe.indexOf(IS3_SIGNATURE, pos + length);
  }
  if (archives.length === 0) throw new Error(`${installer}: no InstallShield 3 archive found`);
  await mkdir(outDir, { recursive: true });
  for (const archive of archives) await run([unshield, "extract", archive, outDir]);
}

// Installed file -> path inside the extracted installer.
const NETSCAPE_FILES: Record<string, string> = {
  "PR3230.DLL": "Program/pr3230.dll",
  "JRT3230.DLL": "Program/jrt3230.dll",
  "UNI3200.DLL": "Program/uni3200.dll",
  "NETSCAPE.TLB": "Program/NETSCAPE.TLB",
  "NETSCAPE.HLP": "Program/NETSCAPE.HLP",
  "MSVCRT40.DLL": "SYSTEM/MSVCRT40.DLL",
  "MFC40.DLL": "SYSTEM/MFC40.DLL",
  "CTL3D32.DLL": "CTL3D32.DLL",
  "CTL3D32S.DLL": "CTL3D32S.DLL",
  "PLUGINS/NPNUL32.DLL": "Program/plugins/npnul32.dll",
};

const crlf = (text: string) => Buffer.from(text.replace(/\r?\n/g, "\r\n"), "latin1");

/** Builds RESCHG.EXE from tools/vm/reschg.zig for Windows 95. */
export async function buildReschg(workDir: string): Promise<string> {
  const dir = join(workDir, "reschg");
  await mkdir(dir, { recursive: true });
  const out = join(dir, "RESCHG.EXE");
  await run(
    [
      "zig", "build-exe", join(HERE, "reschg.zig"),
      "-target", "x86-windows-gnu", "-mcpu", "pentium", "-O", "ReleaseSmall", "-fstrip",
      "--subsystem", "windows", "--cache-dir", join(dir, "zig-cache"), `-femit-bin=${out}`,
    ],
    { cwd: dir },
  );
  // Windows 95 refuses images whose OS or subsystem version exceeds 4.0, and zig has no
  // flag for these PE optional-header fields.
  const exe = Buffer.from(await Bun.file(out).bytes());
  const opt = exe.readUInt32LE(0x3c) + 24;
  if (exe.readUInt32LE(opt - 24) !== 0x00004550) throw new Error("RESCHG.EXE: no PE signature");
  if (exe.readUInt16LE(opt) !== 0x10b) throw new Error("RESCHG.EXE: not a PE32 image");
  for (const field of [40, 48]) {
    exe.writeUInt16LE(4, opt + field); // major OS / subsystem version
    exe.writeUInt16LE(0, opt + field + 2); // minor
  }
  await Bun.write(out, exe);
  return out;
}

/** Lays out the D: root in `rootDir`. */
export async function buildDriveD(
  installer: string,
  unshield: string,
  reschg: string,
  rootDir: string,
  workDir: string,
): Promise<void> {
  const extracted = join(workDir, "netscape-extracted");
  await extractInstaller(installer, unshield, extracted, workDir);

  const ns = join(rootDir, "NETSCAPE");
  await mkdir(join(ns, "PLUGINS"), { recursive: true });
  await mkdir(join(ns, "CACHE"), { recursive: true });
  const exe = await Bun.file(join(extracted, "shared/netscape.exe")).bytes();
  await Bun.write(join(ns, "NETSCAPE.EXE"), applyBytePatches("netscape.exe", exe, netscapeExePatches));
  await Promise.all(
    Object.entries(NETSCAPE_FILES).map(async ([dst, src]) => Bun.write(join(ns, dst), Bun.file(join(extracted, src)))),
  );
  await Bun.write(join(ns, "BOOKMARK.HTM"), crlf(await Bun.file(join(HERE, "guest/bookmark.htm")).text()));
  await Bun.write(join(rootDir, "NETSCAPE.REG"), crlf(await Bun.file(join(HERE, "guest/netscape.reg")).text()));
  await Bun.write(join(rootDir, "RESCHG.EXE"), Bun.file(reschg));
}
