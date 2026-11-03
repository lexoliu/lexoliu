// Every modification applied to upstream inputs. Each byte patch states the bytes it
// expects, so a changed input fails the build instead of being patched blindly.

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

/** A file on the C: drive rewritten from its upstream content. */
export interface FilePatch {
  path: string; // DOS path inside the partition, e.g. "/AUTOEXEC.BAT"
  why: string;
  apply(content: Uint8Array): Uint8Array;
}

/** A file added to the C: drive, copied from `from` on the host. */
export interface FileAdd {
  path: string; // DOS path inside the partition
  from: string;
  why: string;
}

/** Where the display driver (vbe9x, display.ts) goes: Windows loads display drivers from SYSTEM. */
export const VBE9X_DRV_PATH = "/WINDOWS/SYSTEM/VBE9X.DRV";

/** The display adapter's class key, which the base image points at VBE Miniport (VBEMP.DRV). */
const DISPLAY_CLASS_KEY = "HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\Class\\Display\\0000";

/**
 * Run before Windows starts, in order: drop the display class key (VBE Miniport's driver,
 * VxD and mode list), import vbe9x's own key, then NETSCAPE.REG (Run and RunServices keys,
 * Netscape settings, and the boot display size, which overrides vbe9x's default).
 */
const REGEDIT_LINES = [
  `C:\\WINDOWS\\REGEDIT.EXE /D ${DISPLAY_CLASS_KEY}`,
  "C:\\WINDOWS\\REGEDIT.EXE D:\\VBE9X\\VBE9X.REG",
  "C:\\WINDOWS\\REGEDIT.EXE D:\\NETSCAPE.REG",
];

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
    why: "switch the display to vbe9x and import D:\\NETSCAPE.REG before Windows starts",
    apply(content) {
      const text = Buffer.from(content).toString("latin1");
      if (text.toUpperCase().includes("REGEDIT")) throw new Error("AUTOEXEC.BAT already runs REGEDIT");
      const sep = text.length === 0 || text.endsWith("\r\n") ? "" : "\r\n";
      return Buffer.from(`${text}${sep}${REGEDIT_LINES.join("\r\n")}\r\n`, "latin1");
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
];
