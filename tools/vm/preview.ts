// The link-preview image: the guest's screen with Netscape showing the homepage, cropped to the
// aspect ratio previews expect and scaled down to their size, encoded as an RGB PNG.
import { deflateSync } from "node:zlib";
import type { Frame } from "./replay.ts";

export const PREVIEW_WIDTH = 1200;
export const PREVIEW_HEIGHT = 630;

/** The smallest power-on mode that the preview is cut from without scaling it up. */
export function previewMode(modes: [number, number][]): [number, number] {
  const fits = modes.filter(([w, h]) => w >= PREVIEW_WIDTH && h >= PREVIEW_HEIGHT).sort((a, b) => a[0] * a[1] - b[0] * b[1]);
  if (fits.length === 0) throw new Error(`no power-on mode is at least ${PREVIEW_WIDTH}x${PREVIEW_HEIGHT}`);
  return fits[0];
}

/**
 * Fails unless the frame is the rendered homepage: the guest-pages.js chrome around it paints a
 * navy title bar (#000080), a gray page (#C0C0C0) and a white content box, each a large flat
 * area, which neither a blank screen, the desktop (teal) nor Netscape's empty window has.
 */
export function checkHomepage({ width, height, rgba }: Frame): void {
  let navy = 0;
  let gray = 0;
  let white = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
    if (r < 24 && g < 24 && b > 100 && b < 160) navy++;
    else if (r > 232 && g > 232 && b > 232) white++;
    else if (Math.abs(r - 192) < 16 && Math.abs(g - 192) < 16 && Math.abs(b - 192) < 16) gray++;
  }
  const pixels = width * height;
  const share = { navy: navy / pixels, gray: gray / pixels, white: white / pixels };
  console.log(`preview frame ${width}x${height}: navy ${(share.navy * 100).toFixed(2)}%, gray ${(share.gray * 100).toFixed(2)}%, white ${(share.white * 100).toFixed(2)}%`);
  if (share.navy < 0.002 || share.gray < 0.02 || share.white < 0.05) {
    throw new Error("the captured screen is not Netscape showing the homepage");
  }
}

/** `frame` cut to the preview's aspect ratio (from the top, centered across) and area-averaged down to its size. */
function scaleToPreview({ width, height, rgba }: Frame): Uint8Array {
  const scale = Math.min(width / PREVIEW_WIDTH, height / PREVIEW_HEIGHT);
  if (scale < 1) throw new Error(`a ${width}x${height} frame is smaller than the ${PREVIEW_WIDTH}x${PREVIEW_HEIGHT} preview`);
  const x0 = (width - PREVIEW_WIDTH * scale) / 2;
  const out = new Uint8Array(PREVIEW_WIDTH * PREVIEW_HEIGHT * 3);
  // Overlap of the source interval [a, b) with pixel `p`, as a weight.
  const cover = (p: number, a: number, b: number) => Math.max(0, Math.min(b, p + 1) - Math.max(a, p));
  for (let y = 0; y < PREVIEW_HEIGHT; y++) {
    const [ya, yb] = [y * scale, (y + 1) * scale];
    for (let x = 0; x < PREVIEW_WIDTH; x++) {
      const [xa, xb] = [x0 + x * scale, x0 + (x + 1) * scale];
      const sum = [0, 0, 0];
      let weight = 0;
      for (let sy = Math.floor(ya); sy < Math.min(height, Math.ceil(yb)); sy++) {
        const wy = cover(sy, ya, yb);
        for (let sx = Math.floor(xa); sx < Math.min(width, Math.ceil(xb)); sx++) {
          const w = wy * cover(sx, xa, xb);
          const i = (sy * width + sx) * 4;
          sum[0] += rgba[i] * w;
          sum[1] += rgba[i + 1] * w;
          sum[2] += rgba[i + 2] * w;
          weight += w;
        }
      }
      const o = (y * PREVIEW_WIDTH + x) * 3;
      for (let c = 0; c < 3; c++) out[o + c] = Math.round(sum[c] / weight);
    }
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "latin1");
  out.set(data, 8);
  out.writeUInt32BE(Bun.hash.crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width: number, height: number, rgb: Uint8Array): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB, deflate, no filter method variants, no interlace
  // Each scanline starts with its filter type byte, 0 (none).
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (1 + width * 3) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/** The preview PNG for the guest's `frame`; throws when the frame is not the homepage. */
export function renderPreview(frame: Frame): Uint8Array {
  checkHomepage(frame);
  return encodePng(PREVIEW_WIDTH, PREVIEW_HEIGHT, scaleToPreview(frame));
}
