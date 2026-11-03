// The project logos on the guest homepage: the pinned GitHub organisation avatars (PNG or JPEG),
// re-encoded as baseline JPEG, which Netscape Navigator 3.0 decodes (it has no PNG support).
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { GUEST_IMAGES, LOGO_SIZE } from "../../guest-pages.js";
import type { SourceName } from "./sources.ts";

const JPEG_QUALITY = 92;

/** Writes every file GUEST_IMAGES names under `out`, from the avatar source of the same name. */
export async function buildLogos(src: Record<SourceName, string>, out: string): Promise<void> {
  for (const file of Object.values(GUEST_IMAGES)) {
    const name = file.replace(/^logos\/(.+)\.jpg$/, "$1");
    const source = src[`avatar/${name}` as SourceName];
    if (!source) throw new Error(`${file} has no avatar/${name} entry in sources.json`);
    const image = new Bun.Image(await Bun.file(source).bytes());
    const { width, height } = await image.metadata();
    if (width !== LOGO_SIZE || height !== LOGO_SIZE) throw new Error(`avatar/${name} is ${width}x${height}, the page shows ${LOGO_SIZE}x${LOGO_SIZE}`);
    const path = join(out, file);
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, await image.jpeg({ quality: JPEG_QUALITY }).bytes());
  }
}
