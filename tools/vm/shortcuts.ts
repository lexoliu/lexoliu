// Windows 95 desktop shortcuts: .lnk files that start Netscape on a URL. Windows 95 + IE4 opens
// Internet Shortcuts (.url) in the default http handler, which on this image is Internet Explorer,
// so the shortcuts name the program and its argument instead, as the Run key in NETSCAPE.REG does.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { FileAdd } from "./patches.ts";
import { DRIVE_D_LABEL, DRIVE_D_SERIAL, NETSCAPE_EXE } from "./netscape.ts";

/** The desktop folder inside the C: partition. */
const DESKTOP_DIR = "/WINDOWS/DESKTOP";

const DESKTOP_SHORTCUTS: { name: string; url: string }[] = [
  { name: "WaterUI", url: "http://github.com/water-rs/waterui" },
  { name: "Linux Kernel", url: "http://github.com/torvalds/linux" },
];

// Shell link header (ShellLink as the Windows 95 shell writes it).
const HEADER_SIZE = 0x4c;
const LINK_CLSID = Buffer.from("0114020000000000c000000000000046", "hex");
const HAS_ID_LIST = 0x01;
const HAS_LINK_INFO = 0x02;
const HAS_WORKING_DIR = 0x10;
const HAS_ARGUMENTS = 0x20;
const HAS_ICON_LOCATION = 0x40;
const SW_SHOWNORMAL = 1;

// Shell item ids: My Computer's CLSID item, then drive and file system items.
const MY_COMPUTER_ITEM = Buffer.from("1f0fe04fd020ea3a6910a2d808002b30309d", "hex");
const ITEM_DRIVE = 0x23;
/** A drive item is 25 bytes, as the Windows 95 shell writes it: the path, zero-filled. */
const DRIVE_ITEM_SIZE = 0x19;
const ITEM_FOLDER = 0x31;
const ITEM_FILE = 0x32;
const ATTR_DIRECTORY = 0x10;
const DRIVE_FIXED = 3;
/** 8.3 names only: the items carry no long name. */
const DOS_NAME = /^[A-Z0-9_]{1,8}(\.[A-Z0-9_]{1,3})?$/;

const u16 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
};
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};
const cstr = (s: string) => Buffer.from(`${s}\0`, "latin1");
/** A counted string, as the link stores working directory, arguments and icon location. */
const counted = (s: string) => Buffer.concat([u16(s.length), Buffer.from(s, "latin1")]);

/** A shell item id: its size, then `body`. */
const item = (body: Buffer) => Buffer.concat([u16(2 + body.length), body]);

/** A file system item id (type, pad, size, date, time, attributes, 8.3 name); the shell binds by name. */
function fsItem(type: number, name: string, attributes: number): Buffer {
  if (!DOS_NAME.test(name)) throw new Error(`${name}: not an upper-case 8.3 name`);
  const body = Buffer.concat([Buffer.from([type, 0]), u32(0), u16(0), u16(0), u16(attributes), cstr(name)]);
  return item(Buffer.concat([body, Buffer.alloc(body.length % 2 === 0 ? 0 : 1)])); // the name is padded to an even size
}

function driveItem(drive: string): Buffer {
  const path = cstr(`${drive}\\`);
  return item(Buffer.concat([Buffer.from([ITEM_DRIVE]), path, Buffer.alloc(DRIVE_ITEM_SIZE - 2 - 1 - path.length)]));
}

/** The item id list of `drive`:\dir\...\file, from My Computer down. */
function idList(drive: string, dirs: string[], file: string): Buffer {
  const items = [
    item(MY_COMPUTER_ITEM),
    driveItem(drive),
    ...dirs.map((dir) => fsItem(ITEM_FOLDER, dir, ATTR_DIRECTORY)),
    fsItem(ITEM_FILE, file, 0),
  ];
  const list = Buffer.concat([...items, u16(0)]);
  return Buffer.concat([u16(list.length), list]);
}

/** The local-volume link info: the volume's identity and the target's path on it. */
function linkInfo(path: string, label: string, serial: number): Buffer {
  const volume = Buffer.concat([u32(16 + label.length + 1), u32(DRIVE_FIXED), u32(serial), u32(16), cstr(label)]);
  const fixed = 0x1c;
  const localBase = cstr(path);
  const commonSuffix = cstr("");
  const volumeOffset = fixed;
  const baseOffset = volumeOffset + volume.length;
  const suffixOffset = baseOffset + localBase.length;
  const size = suffixOffset + commonSuffix.length;
  const volumeLocal = 1;
  return Buffer.concat([
    u32(size), u32(fixed), u32(volumeLocal), u32(volumeOffset), u32(baseOffset), u32(0), u32(suffixOffset),
    volume, localBase, commonSuffix,
  ]);
}

/** The bytes of a .lnk that runs `exe` (a DOS path on a drive labelled `label`) with `args`. */
export function shortcutBytes(exe: string, args: string, label: string, serial: number): Buffer {
  const match = /^([A-Z]):\\((?:[^\\]+\\)*)([^\\]+)$/.exec(exe);
  if (!match) throw new Error(`${exe}: not an absolute DOS path`);
  const [, drive, dirPath, file] = match;
  const dirs = dirPath.split("\\").filter(Boolean);
  const workingDir = exe.slice(0, exe.length - file.length - 1);
  const flags = HAS_ID_LIST | HAS_LINK_INFO | HAS_WORKING_DIR | HAS_ARGUMENTS | HAS_ICON_LOCATION;
  const header = Buffer.alloc(HEADER_SIZE);
  header.writeUInt32LE(HEADER_SIZE, 0);
  LINK_CLSID.copy(header, 4);
  header.writeUInt32LE(flags, 0x14);
  header.writeUInt32LE(0, 0x38); // icon index
  header.writeUInt32LE(SW_SHOWNORMAL, 0x3c);
  return Buffer.concat([
    header,
    idList(`${drive}:`, dirs, file),
    linkInfo(exe, label, serial),
    counted(workingDir),
    counted(args),
    counted(exe),
    Buffer.alloc(4),
  ]);
}

/** Writes the desktop shortcuts under `workDir` and returns them as files to add to C:. */
export async function buildDesktopShortcuts(workDir: string): Promise<FileAdd[]> {
  const dir = join(workDir, "shortcuts");
  await mkdir(dir, { recursive: true });
  return Promise.all(
    DESKTOP_SHORTCUTS.map(async ({ name, url }) => {
      const from = join(dir, `${name}.lnk`);
      await Bun.write(from, shortcutBytes(NETSCAPE_EXE, url, DRIVE_D_LABEL, DRIVE_D_SERIAL));
      return { path: `${DESKTOP_DIR}/${name}.lnk`, from, why: `desktop shortcut opening ${url} in Netscape` };
    }),
  );
}
