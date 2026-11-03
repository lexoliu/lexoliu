// Every modification applied to upstream inputs. Each byte patch states the bytes it
// expects, so a changed input fails the build instead of being patched blindly.
import { vbempModePatches, vgaBiosModePatches } from "./display.ts";

export interface BytePatch {
  offset: number;
  from: string; // hex
  to: string; // hex
  why: string;
}

export function applyBytePatches(name: string, bytes: Uint8Array, patches: BytePatch[]): Uint8Array {
  const out = bytes.slice();
  for (const p of patches) {
    const from = Buffer.from(p.from, "hex");
    const to = Buffer.from(p.to, "hex");
    if (from.length !== to.length) throw new Error(`${name}@0x${p.offset.toString(16)}: length mismatch`);
    const found = Buffer.from(out.subarray(p.offset, p.offset + from.length));
    if (!found.equals(from)) {
      throw new Error(`${name}@0x${p.offset.toString(16)}: expected ${p.from}, found ${found.toString("hex")} (${p.why})`);
    }
    out.set(to, p.offset);
  }
  return out;
}

/** shared/netscape.exe from the Netscape Navigator 3.0 installer. */
export const netscapeExePatches: BytePatch[] = [
  { offset: 0x6ab51, from: "0f84ac000000", to: "90e9ac000000", why: "skip the license agreement check" },
  { offset: 0x6ac7b, from: "7408", to: "eb08", why: "skip the default-browser prompt" },
  { offset: 0x6a621, from: "7417", to: "eb17", why: "ignore a stale NETSCAPE.LCK" },
];

/** v86's VGA BIOS as served to the guest: the added display modes (display.ts). */
export const vgaBiosPatches: BytePatch[] = vgaBiosModePatches();

/** A file on the C: drive rewritten from its upstream content. */
export interface FilePatch {
  path: string; // DOS path inside the partition, e.g. "/AUTOEXEC.BAT"
  why: string;
  apply(content: Uint8Array): Uint8Array;
}

/** The Windows display driver, VBE Miniport. */
export const VBEMP_PATH = "/WINDOWS/SYSTEM/VBEMP.DRV";

const REGEDIT_IMPORT = "C:\\WINDOWS\\REGEDIT.EXE D:\\NETSCAPE.REG";

/**
 * SB16SND.DRV's [sndblst.drv] intrate in SYSTEM.INI: the wave interrupts per second, from
 * which the driver sizes its DMA block (bytes per second / intrate, a multiple of 4, at most
 * half the DMA buffer SB16.VXD allocates less 16 bytes) and its auto-init ring (two blocks).
 * The driver's own default is 16, a 62 ms block for the startup sound (22050 Hz, 8-bit mono);
 * when the guest is busy for longer than one block, the SB16 replays the stale half of the
 * ring. The driver reads the key at a wave open and then deletes it, so it sizes the open that
 * plays the startup sound, the one the saved state holds.
 */
const SB16_INTERRUPTS_PER_SECOND = 4;
const SB16_SECTION = "[sndblst.drv]";

export const cDrivePatches: FilePatch[] = [
  {
    path: "/AUTOEXEC.BAT",
    why: "import D:\\NETSCAPE.REG (Run and RunServices keys, Netscape and display settings) before Windows starts",
    apply(content) {
      const text = Buffer.from(content).toString("latin1");
      if (text.includes(REGEDIT_IMPORT)) throw new Error("AUTOEXEC.BAT already imports NETSCAPE.REG");
      const sep = text.length === 0 || text.endsWith("\r\n") ? "" : "\r\n";
      return Buffer.from(`${text}${sep}${REGEDIT_IMPORT}\r\n`, "latin1");
    },
  },
  {
    path: "/WINDOWS/SYSTEM.INI",
    why: `size the SB16 wave DMA block for ${SB16_INTERRUPTS_PER_SECOND} interrupts per second`,
    apply(content) {
      const text = Buffer.from(content).toString("latin1");
      if (text.toLowerCase().includes(SB16_SECTION)) throw new Error(`SYSTEM.INI already has ${SB16_SECTION}`);
      const sep = text.length === 0 || text.endsWith("\r\n") ? "" : "\r\n";
      return Buffer.from(`${text}${sep}${SB16_SECTION}\r\nintrate=${SB16_INTERRUPTS_PER_SECOND}\r\n`, "latin1");
    },
  },
  {
    path: VBEMP_PATH,
    why: "give the display driver the added display modes (display.ts)",
    apply: (content) => applyBytePatches("VBEMP.DRV", content, vbempModePatches(content)),
  },
];
