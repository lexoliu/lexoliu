// The guest's display modes. Three layers each keep a fixed table, and a mode is usable only
// when all of them list it:
//   - v86's VGA BIOS (SeaVGABIOS, bochsvga): its VBE mode table. v86's Bochs DISPI accepts any
//     size up to 2560x1600, but the BIOS sets only the sizes in this table, and at boot it drops
//     every entry wider than DISPI's maximum or larger than the VRAM.
//   - VBEMP.DRV, the Windows display driver: 38 resolution slots. It matches the BIOS modes
//     against them at load and ignores modes in no slot.
//   - The registry's MODES list for the display class key, which Windows reads to offer modes.
// So the guest cannot take arbitrary sizes without another driver. The added modes extend the
// stock landscape set (5:4, 4:3, 16:10, 5:3, 16:9) into a ladder of aspect ratios from 9:20
// (phones, portrait) through 1:1 to 64:27 (ultrawide), each step at most 1.19x the last, and
// give phones in landscape their portrait modes turned sideways, so rotating keeps the scale.
// They take table entries the guest can never set at its depth (netscape.reg's BitsPerPixel):
// BIOS entries the BIOS itself drops for this VRAM size and DISPI limit or of another depth,
// and VBEMP slots naming resolutions the BIOS has no mode for.
import type { BytePatch } from "./patches.ts";

/** VRAM v86 is configured with; the page reads it from modes.json. */
export const VGA_MEMORY_SIZE = 8 * 1024 * 1024;
/** v86's Bochs DISPI limits (GETCAPS, and the clamp on XRES/YRES writes). */
const DISPI_MAX = { width: 2560, height: 1600, depth: 32 };

interface BiosEntry {
  offset: number; // of the 14-byte mode table entry in vgabios.bin
  mode: number;
  width: number;
  height: number;
  depth: number;
}

interface VbempSlot {
  slot: number;
  width: number;
  height: number;
  eLo: number; // stock GDIINFO dpELoVpt extent
  eHi: number; // stock GDIINFO dpEHiVpt and dpTwpVpt extent
}

interface AddedMode {
  width: number;
  height: number;
  bios: BiosEntry; // stock entry it replaces
  vbemp: VbempSlot; // stock slot it replaces
}

// prettier-ignore
export const ADDED_MODES: AddedMode[] = [
  { width: 504, height: 1120, bios: { offset: 0x5208, mode: 0x189, width: 1920, height: 1200, depth: 32 }, vbemp: { slot: 10, width: 320, height: 240, eLo: 127, eHi: 64 } },
  { width: 504, height: 1008, bios: { offset: 0x5224, mode: 0x18b, width: 2560, height: 1600, depth: 24 }, vbemp: { slot: 11, width: 400, height: 300, eLo: 159, eHi: 79 } },
  { width: 504, height: 896, bios: { offset: 0x5232, mode: 0x18c, width: 2560, height: 1600, depth: 32 }, vbemp: { slot: 12, width: 512, height: 384, eLo: 203, eHi: 102 } },
  { width: 768, height: 1152, bios: { offset: 0x52cc, mode: 0x197, width: 2560, height: 1440, depth: 24 }, vbemp: { slot: 13, width: 320, height: 400, eLo: 127, eHi: 64 } },
  { width: 768, height: 1024, bios: { offset: 0x52da, mode: 0x198, width: 2560, height: 1440, depth: 32 }, vbemp: { slot: 14, width: 640, height: 350, eLo: 254, eHi: 127 } },
  { width: 896, height: 1024, bios: { offset: 0x52e8, mode: 0x199, width: 3840, height: 2160, depth: 16 }, vbemp: { slot: 15, width: 720, height: 400, eLo: 286, eHi: 143 } },
  { width: 1024, height: 1024, bios: { offset: 0x52f6, mode: 0x19a, width: 3840, height: 2160, depth: 32 }, vbemp: { slot: 16, width: 720, height: 480, eLo: 286, eHi: 143 } },
  { width: 1152, height: 1024, bios: { offset: 0x5304, mode: 0x19b, width: 4096, height: 2160, depth: 16 }, vbemp: { slot: 17, width: 720, height: 576, eLo: 286, eHi: 153 } },
  { width: 1440, height: 960, bios: { offset: 0x5312, mode: 0x19c, width: 4096, height: 2160, depth: 32 }, vbemp: { slot: 20, width: 1792, height: 1344, eLo: 711, eHi: 356 } },
  { width: 1920, height: 960, bios: { offset: 0x5320, mode: 0x19d, width: 5120, height: 2160, depth: 16 }, vbemp: { slot: 21, width: 1856, height: 1392, eLo: 737, eHi: 368 } },
  { width: 2560, height: 1080, bios: { offset: 0x532e, mode: 0x19e, width: 5120, height: 2160, depth: 32 }, vbemp: { slot: 22, width: 2048, height: 1536, eLo: 813, eHi: 406 } },
  { width: 1120, height: 504, bios: { offset: 0x51fa, mode: 0x188, width: 1920, height: 1200, depth: 24 }, vbemp: { slot: 23, width: 800, height: 480, eLo: 318, eHi: 127 } },
  { width: 1008, height: 504, bios: { offset: 0x5278, mode: 0x191, width: 1920, height: 1080, depth: 24 }, vbemp: { slot: 24, width: 1024, height: 600, eLo: 406, eHi: 159 } },
  { width: 896, height: 504, bios: { offset: 0x52a2, mode: 0x194, width: 1600, height: 900, depth: 24 }, vbemp: { slot: 25, width: 832, height: 624, eLo: 330, eHi: 165 } },
];

const ADDED_DEPTH = 16;

const hex = (bytes: number[]) => Buffer.from(bytes).toString("hex");
const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
const i16 = (v: number) => u16(v & 0xffff);
const u32 = (v: number) => [...u16(v & 0xffff), ...u16(v >>> 16)];

// ---------------------------------------------------------------------------------------------
// VGA BIOS

// struct { u16 mode; struct vgamode_s { u8 memmodel; u16 width; u16 height; u8 depth;
// u8 cwidth; u8 cheight; u16 sstart; } info; }, naturally aligned: 14 bytes.
const BIOS_TABLE = 0x4ec0;
const BIOS_ENTRY = 14;
const BIOS_CHECKSUM = 6; // option ROM checksum byte, as SeaBIOS's buildrom.py places it
const BIOS_CHECKSUM_STOCK = 0x3a;
const MM = { planar: 3, packed: 4, direct: 6 } as const;

interface BiosMode {
  mode: number;
  memmodel: number;
  width: number;
  height: number;
  depth: number;
}

function parseBiosModes(rom: Uint8Array): BiosMode[] {
  const v = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
  const modes: BiosMode[] = [];
  for (let off = BIOS_TABLE; ; off += BIOS_ENTRY) {
    const mode = v.getUint16(off, true);
    if (mode < 0x100 || mode >= 0x200) break;
    modes.push({ mode, memmodel: v.getUint8(off + 2), width: v.getUint16(off + 4, true), height: v.getUint16(off + 6, true), depth: v.getUint8(off + 8) });
  }
  const first = modes[0];
  if (!first || first.mode !== 0x100 || first.width !== 640 || first.height !== 400 || first.depth !== 8) {
    throw new Error(`vgabios.bin: no SeaVGABIOS mode table at 0x${BIOS_TABLE.toString(16)}`);
  }
  return modes;
}

/** SeaVGABIOS bochsvga_setup: a mode survives when DISPI and the VRAM can hold it. */
function biosKeeps(m: BiosMode): boolean {
  const bpp = m.memmodel === MM.planar ? 1 : m.depth > 8 ? Math.ceil(m.depth / 8) * 8 : m.depth;
  const ratio = m.memmodel === MM.planar ? 4 : 1;
  const mem = m.height * Math.ceil((m.width * bpp) / 8) * ratio;
  return m.width <= DISPI_MAX.width && m.depth <= DISPI_MAX.depth && mem <= VGA_MEMORY_SIZE;
}

/** Rewrites each replaced entry's size and depth, then the ROM checksum. */
export function vgaBiosModePatches(): BytePatch[] {
  const patches: BytePatch[] = ADDED_MODES.map(({ width, height, bios: b }) => ({
    offset: b.offset,
    from: hex([...u16(b.mode), MM.direct, 0, ...u16(b.width), ...u16(b.height), b.depth]),
    to: hex([...u16(b.mode), MM.direct, 0, ...u16(width), ...u16(height), ADDED_DEPTH]),
    why: `mode 0x${b.mode.toString(16)}: ${b.width}x${b.height}x${b.depth} (dropped by the BIOS) -> ${width}x${height}x${ADDED_DEPTH}`,
  }));
  const byteSum = (h: string) => Buffer.from(h, "hex").reduce((s, x) => s + x, 0);
  const delta = patches.reduce((s, p) => s + byteSum(p.to) - byteSum(p.from), 0);
  patches.push({
    offset: BIOS_CHECKSUM,
    from: hex([BIOS_CHECKSUM_STOCK]),
    to: hex([(((BIOS_CHECKSUM_STOCK - delta) % 256) + 256) % 256]),
    why: "option ROM checksum",
  });
  return patches;
}

export function checkOptionRomChecksum(rom: Uint8Array): void {
  if (rom[0] !== 0x55 || rom[1] !== 0xaa || rom[2] * 512 !== rom.length) throw new Error("vgabios.bin: not an option ROM of its own length");
  const sum = rom.reduce((s, x) => (s + x) & 0xff, 0);
  if (sum !== 0) throw new Error(`vgabios.bin: checksum is 0x${sum.toString(16)}, expected 0`);
}

// ---------------------------------------------------------------------------------------------
// VBEMP.DRV
//
// All three slot tables sit in the second code segment:
//   - the lookup routine (seg offset 0x1a8f) turning a resolution into a slot: `xor ax, ax`,
//     then per slot `cmp esi, (w << 16) | h; je found; inc ax`, ending `mov ax, 1; ret`;
//   - a list of (u16 w, u16 h) per slot at 0x200e, read by `mov cx, cs:[di + 0x200e]`;
//   - a table of near pointers at 0x14e6, read by `mov si, cs:[ebx*2 + 0x14e6]`, to each slot's
//     GDIINFO, whose resolution-dependent fields are rewritten.
// At load it stores every BIOS mode with a slot into a 15-byte-per-mode array at DS:0x3e1,
// which runs to the end of the data segment with no bound check.

const VBEMP_SLOTS = 38;
const SEG_LOOKUP = 0x1a8f;
const SEG_LIST = 0x200e;
const SEG_GDIINFO_PTRS = 0x14e6;
const GDIINFO_SIZE = 110;
// Code that names each table's address, as a guard that they are where the code reads them.
const LIST_REF = { seg: 0x1f38, bytes: "2e8b8d0e20" }; // mov cx, cs:[di + 0x200e]
const PTRS_REF = { seg: 0x17b1, bytes: "672e8b345de6140000" }; // mov si, cs:[ebx*2 + 0x14e6]
const MODE_ARRAY_REF = { seg: 0x2385, bytes: "c706b303e103" }; // mov word [0x3b3], 0x3e1
const MODE_ARRAY = 0x3e1;
const MODE_ARRAY_ENTRY = 15;
// GDIINFO byte offsets.
const GDI = { horzRes: 8, vertRes: 10, mLoVpt: 52, mHiVpt: 60, eLoVpt: 68, eHiVpt: 76, twpVpt: 84 };
// VBEMP's convention, from its 640x480 slot: English mapping extents scale with the width
// (low) and the height (high and twips).
const eLo = (w: number) => Math.round((254 * w) / 640);
const eHi = (h: number) => Math.round((127 * h) / 480);

interface VbempLayout {
  /** File offset of each slot's imm32 in the lookup routine. */
  lookup: number[];
  /** File offset of each slot's list entry. */
  list: number[];
  /** File offset of each slot's GDIINFO. */
  gdiinfo: number[];
  sizes: [number, number][];
  /** Mode array capacity in modes. */
  modeArrayCapacity: number;
}

function parseVbemp(drv: Uint8Array): VbempLayout {
  const b = Buffer.from(drv.buffer, drv.byteOffset, drv.byteLength);
  const ne = b.readUInt32LE(0x3c);
  if (b.toString("latin1", ne, ne + 2) !== "NE") throw new Error("VBEMP.DRV: not an NE image");
  const segTable = ne + b.readUInt16LE(ne + 0x22);
  const shift = b.readUInt16LE(ne + 0x32);
  const seg = (i: number) => ({
    file: b.readUInt16LE(segTable + 8 * (i - 1)) << shift,
    flags: b.readUInt16LE(segTable + 8 * (i - 1) + 4),
    minAlloc: b.readUInt16LE(segTable + 8 * (i - 1) + 6),
  });
  const code = seg(2).file;
  const data = seg(3);
  if (b.readUInt16LE(ne + 0x1c) !== 3 || !(data.flags & 1)) throw new Error("VBEMP.DRV: expected two code segments and a data segment");
  for (const ref of [LIST_REF, PTRS_REF, MODE_ARRAY_REF]) {
    const found = b.toString("hex", code + ref.seg, code + ref.seg + ref.bytes.length / 2);
    if (found !== ref.bytes) throw new Error(`VBEMP.DRV@seg 0x${ref.seg.toString(16)}: expected ${ref.bytes}, found ${found}`);
  }

  const lookup: number[] = [];
  const sizes: [number, number][] = [];
  let p = code + SEG_LOOKUP;
  if (b.toString("hex", p, p + 2) !== "33c0") throw new Error("VBEMP.DRV: lookup routine does not start with xor ax, ax");
  p += 2;
  while (b.toString("hex", p, p + 3) === "6681fe") {
    lookup.push(p + 3);
    const imm = b.readUInt32LE(p + 3);
    sizes.push([imm >>> 16, imm & 0xffff]);
    p += 7;
    if (b[p] === 0x0f && b[p + 1] === 0x84) p += 4; // je rel16
    else if (b[p] === 0x74) p += 2; // je rel8
    else throw new Error(`VBEMP.DRV@0x${p.toString(16)}: expected je after cmp`);
    if (b[p] === 0x40) p += 1; // inc ax
  }
  if (b.toString("hex", p, p + 4) !== "b80100c3") throw new Error("VBEMP.DRV: lookup routine does not end with mov ax, 1; ret");
  if (sizes.length !== VBEMP_SLOTS) throw new Error(`VBEMP.DRV: ${sizes.length} slots, expected ${VBEMP_SLOTS}`);

  const list = sizes.map((_, k) => code + SEG_LIST + 4 * k);
  const gdiinfo = sizes.map((_, k) => code + b.readUInt16LE(code + SEG_GDIINFO_PTRS + 2 * k));
  sizes.forEach(([w, h], k) => {
    const listed = [b.readUInt16LE(list[k]), b.readUInt16LE(list[k] + 2)];
    const gdi = [b.readUInt16LE(gdiinfo[k] + GDI.horzRes), b.readUInt16LE(gdiinfo[k] + GDI.vertRes)];
    if (listed[0] !== w || listed[1] !== h || gdi[0] !== w || gdi[1] !== h) {
      throw new Error(`VBEMP.DRV slot ${k}: lookup ${w}x${h}, list ${listed.join("x")}, GDIINFO ${gdi.join("x")}`);
    }
  });
  if (data.minAlloc <= MODE_ARRAY) throw new Error("VBEMP.DRV: data segment ends before the mode array");
  return { lookup, list, gdiinfo, sizes, modeArrayCapacity: Math.floor((data.minAlloc - MODE_ARRAY) / MODE_ARRAY_ENTRY) };
}

/** Rewrites each replaced slot in the lookup routine, the list and its GDIINFO. */
export function vbempModePatches(drv: Uint8Array): BytePatch[] {
  const layout = parseVbemp(drv);
  const patches: BytePatch[] = [];
  for (const { width: w, height: h, vbemp: s } of ADDED_MODES) {
    const why = `slot ${s.slot}: ${s.width}x${s.height} (no BIOS mode) -> ${w}x${h}`;
    const g = layout.gdiinfo[s.slot];
    const field = (offset: number, from: number[], to: number[]) => patches.push({ offset, from: hex(from), to: hex(to), why });
    field(layout.lookup[s.slot], u32((s.width << 16) | s.height), u32((w << 16) | h));
    field(layout.list[s.slot], [...u16(s.width), ...u16(s.height)], [...u16(w), ...u16(h)]);
    field(g + GDI.horzRes, [...u16(s.width), ...u16(s.height)], [...u16(w), ...u16(h)]);
    for (const vpt of [GDI.mLoVpt, GDI.mHiVpt]) field(g + vpt, [...i16(s.width), ...i16(-s.height)], [...i16(w), ...i16(-h)]);
    field(g + GDI.eLoVpt, [...i16(s.eLo), ...i16(-s.eLo)], [...i16(eLo(w)), ...i16(-eLo(w))]);
    for (const vpt of [GDI.eHiVpt, GDI.twpVpt]) field(g + vpt, [...i16(s.eHi), ...i16(-s.eHi)], [...i16(eHi(h)), ...i16(-eHi(h))]);
  }
  return patches;
}

// ---------------------------------------------------------------------------------------------
// The modes the guest exposes

/** SeaVGABIOS's standard VGA modes VBEMP also stores: mode 0x13, 320x200x8. */
const STD_VGA_STORED = 1;

/** The guest display as netscape.reg configures it for the cold boot the snapshot is taken in. */
export interface BootDisplay {
  bitsPerPixel: number;
  resolution: [number, number];
}

/** What the page needs about the guest display (written to modes.json). */
export interface GuestModes {
  bitsPerPixel: number;
  vgaMemorySize: number;
  /** The guest's mode in the saved state. */
  snapshotMode: [number, number];
  modes: [number, number][];
}

/** modes.json: the guest display plus a fact only the snapshot establishes. */
export interface ModesFile extends GuestModes {
  /** RESCHG.EXE is running and listening on COM1 in the saved state. */
  reschgInState: true;
}

/** Modes settable at the boot depth given the BIOS and VBEMP as they are served. */
export function guestModes(rom: Uint8Array, drv: Uint8Array, boot: BootDisplay): GuestModes {
  const { bitsPerPixel } = boot;
  const vbemp = parseVbemp(drv);
  const slotOf = (w: number, h: number) => vbemp.sizes.findIndex(([sw, sh]) => sw === w && sh === h);
  const kept = parseBiosModes(rom).filter(biosKeeps);
  // VBEMP's load loop: depth of at least 8 except 15, and a slot for its resolution.
  const stored = kept.filter((m) => m.depth >= 8 && m.depth !== 15 && slotOf(m.width, m.height) >= 0);
  if (stored.length + STD_VGA_STORED > vbemp.modeArrayCapacity) {
    throw new Error(`VBEMP.DRV would store ${stored.length + STD_VGA_STORED} modes, its array holds ${vbemp.modeArrayCapacity}`);
  }
  const modes = stored
    .filter((m) => m.depth === bitsPerPixel && m.height <= DISPI_MAX.height)
    .map((m): [number, number] => [m.width, m.height])
    .sort((a, b) => a[0] / a[1] - b[0] / b[1] || a[0] * a[1] - b[0] * b[1]);
  if (!modes.some(([w, h]) => w === boot.resolution[0] && h === boot.resolution[1])) {
    throw new Error(`netscape.reg boots at ${boot.resolution.join("x")}, which the guest cannot set`);
  }
  return { bitsPerPixel, vgaMemorySize: VGA_MEMORY_SIZE, snapshotMode: boot.resolution, modes };
}

/**
 * Fails unless every replaced entry was unusable at the guest's depth in the stock BIOS (so no
 * mode the guest can set is lost) and every added mode is served.
 */
export function checkAddedModes(stockRom: Uint8Array, served: GuestModes): void {
  const stock = parseBiosModes(stockRom);
  const usable = (m: BiosMode) => biosKeeps(m) && m.depth === served.bitsPerPixel;
  for (const { width, height, bios, vbemp } of ADDED_MODES) {
    const entry = stock.find((m) => m.mode === bios.mode);
    if (!entry || usable(entry)) throw new Error(`BIOS mode 0x${bios.mode.toString(16)} is usable at ${served.bitsPerPixel} bpp, replacing it loses a mode`);
    if (stock.some((m) => usable(m) && m.width === vbemp.width && m.height === vbemp.height)) {
      throw new Error(`VBEMP slot ${vbemp.slot} (${vbemp.width}x${vbemp.height}) has a stock BIOS mode usable at ${served.bitsPerPixel} bpp, replacing it loses a mode`);
    }
    if (!served.modes.some(([w, h]) => w === width && h === height)) throw new Error(`${width}x${height} is not served`);
  }
}

const MODES_KEY = "HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\Class\\Display\\0000\\MODES";

/** The single value netscape.reg sets for `name` across its display settings keys. */
function registryValue(reg: string, name: string): string {
  const values = [...reg.matchAll(new RegExp(`^"${name}"="([^"]*)"$`, "gm"))].map((m) => m[1]);
  if (values.length === 0 || values.some((v) => v !== values[0])) throw new Error(`netscape.reg: ${name} ${values.join(", ")}`);
  return values[0];
}

/**
 * Reads the boot display settings from netscape.reg, failing unless it lists exactly the
 * added modes at that depth.
 */
export function bootDisplay(reg: string): BootDisplay {
  const bitsPerPixel = Number(registryValue(reg, "BitsPerPixel"));
  const resolution = registryValue(reg, "Resolution").split(",").map(Number);
  if (resolution.length !== 2 || resolution.some((v) => !Number.isInteger(v) || v <= 0)) throw new Error(`netscape.reg: Resolution ${resolution}`);
  const prefix = `[${MODES_KEY}\\`;
  const listed = reg
    .split(/\r?\n/)
    .filter((l) => l.startsWith(prefix))
    .map((l) => l.slice(prefix.length, -1));
  const expected = ADDED_MODES.map((m) => `${bitsPerPixel}\\${m.width},${m.height}`);
  if (listed.sort().join() !== [...expected].sort().join()) {
    throw new Error(`netscape.reg lists modes ${listed.join(" ")}, expected ${expected.join(" ")}`);
  }
  return { bitsPerPixel, resolution: [resolution[0], resolution[1]] };
}
