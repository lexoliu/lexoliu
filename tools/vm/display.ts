// The guest's display. vbe9x (lexoliu/vbe9x), the Windows 95 display driver installed in the
// guest, sets modes through the Bochs VBE (DISPI) registers v86 emulates and takes any size
// ChangeDisplaySettings asks for, so the page asks RESCHG.EXE for a size derived from the
// viewport (guest-display.js) instead of picking from a mode list. What bounds a size:
//   - v86's DISPI clamps XRES to 2560 and YRES to 1600 (src/vga.js MAX_XRES, MAX_YRES) and
//     otherwise keeps a width as written.
//   - vbe9x keeps each scanline a whole number of DWORDs (DISPI_AlignedWidth: 4, 2 and 1
//     pixels at 8, 16 and 32 bpp, 4 at 24 bpp): it widens the adapter's mode to the next such
//     width and leaves the columns past the desktop as padding the page would show, so the
//     page asks only for widths that are a multiple of it.
//   - vbe9x's CheckMode refuses a framebuffer larger than the VRAM.
// The page also keeps the guest's shorter side at MIN_SIDE or more, so the modes it asks for
// form a bounded space whose corners the preload replays (build.ts, snapshot.ts): a desktop
// smaller than any phone's runs code in Explorer and MFC that no larger one does.

/** VRAM v86 is configured with; the page reads it from modes.json. */
export const VGA_MEMORY_SIZE = 8 * 1024 * 1024;
/** v86's Bochs DISPI limits (the clamp on XRES and YRES writes). */
const DISPI_MAX = { width: 2560, height: 1600 };
/** The narrowest phone viewport, in CSS pixels: smaller viewports get a mode scaled up to it. */
const MIN_SIDE = 320;
/** vbe9x's DISPI_AlignedWidth step: the pixels in a whole number of DWORDs, per depth. */
const WIDTH_STEP: Record<number, number> = { 8: 4, 16: 2, 24: 4, 32: 1 };

/** The guest display as netscape.reg configures it for the cold boot the snapshot is taken in. */
export interface BootDisplay {
  bitsPerPixel: number;
  resolution: [number, number];
}

/** What the page needs about the guest display (written to modes.json, read by guest-display.js). */
export interface GuestDisplay {
  bitsPerPixel: number;
  vgaMemorySize: number;
  /** The guest's mode in the saved state; the page asks for no more pixels than it has. */
  snapshotMode: [number, number];
  maxWidth: number;
  maxHeight: number;
  /** The least width and height the page asks for. */
  minSide: number;
  /** Every width the page asks for is a multiple of this. */
  widthStep: number;
}

/** modes.json: the guest display plus a fact only the snapshot establishes. */
export interface ModesFile extends GuestDisplay {
  /** RESCHG.EXE is running and listening on COM1 in the saved state. */
  reschgInState: true;
}

/** The display the page drives, failing unless the boot mode is one the page could ask for. */
export function guestDisplay(boot: BootDisplay): GuestDisplay {
  const { bitsPerPixel, resolution } = boot;
  const widthStep = WIDTH_STEP[bitsPerPixel];
  if (widthStep === undefined) throw new Error(`vbe9x sets no ${bitsPerPixel} bpp mode`);
  const [w, h] = resolution;
  if (MIN_SIDE % widthStep !== 0) throw new Error(`the least width ${MIN_SIDE} is not a multiple of ${widthStep}`);
  if (w % widthStep !== 0 || Math.min(w, h) < MIN_SIDE || w > DISPI_MAX.width || h > DISPI_MAX.height || w * h * (bitsPerPixel / 8) > VGA_MEMORY_SIZE) {
    throw new Error(`netscape.reg boots at ${w}x${h}x${bitsPerPixel}, which the page cannot ask for`);
  }
  return {
    bitsPerPixel,
    vgaMemorySize: VGA_MEMORY_SIZE,
    snapshotMode: resolution,
    maxWidth: DISPI_MAX.width,
    maxHeight: DISPI_MAX.height,
    minSide: MIN_SIDE,
    widthStep,
  };
}

/** The single value netscape.reg sets for `name` across its display settings keys. */
function registryValue(reg: string, name: string): string {
  const values = [...reg.matchAll(new RegExp(`^"${name}"="([^"]*)"$`, "gm"))].map((m) => m[1]);
  if (values.length === 0 || values.some((v) => v !== values[0])) throw new Error(`netscape.reg: ${name} ${values.join(", ")}`);
  return values[0];
}

/** Reads the boot display settings from netscape.reg. */
export function bootDisplay(reg: string): BootDisplay {
  const bitsPerPixel = Number(registryValue(reg, "BitsPerPixel"));
  const resolution = registryValue(reg, "Resolution").split(",").map(Number);
  if (resolution.length !== 2 || resolution.some((v) => !Number.isInteger(v) || v <= 0)) throw new Error(`netscape.reg: Resolution ${resolution}`);
  return { bitsPerPixel, resolution: [resolution[0], resolution[1]] };
}
