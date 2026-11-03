// Pieces shared by the sites the guest browses through the host page (guest-github.js, guest-hn.js,
// guest-wikipedia.js): the errors a page turns into an error page, HTML and empty responses, the
// pager line, a memo of asynchronous results, and the image proxy that turns any picture into what
// Netscape Navigator 3.0 shows.
import { canvasJpeg } from "./guest-icons.js";

/** The upstream has nothing at the requested address. */
export class NotFound extends Error {}

/** The upstream could not be reached or answered with an error. */
export class Upstream extends Error {}

const STATUS_TEXT = { 200: "OK", 404: "Not Found" };

/** An HTML 3.2 page as the guest's HTTP response. */
export function htmlResponse(status, html) {
  const bytes = new TextEncoder().encode(html);
  return new Response(bytes, {
    status,
    statusText: STATUS_TEXT[status] ?? "Error",
    headers: { "Content-Type": "text/html", "Content-Length": String(bytes.byteLength) },
  });
}

/** The answer to a link that opened something in the visitor's browser: Netscape stays on its page. */
export function noContent() {
  return new Response(null, { status: 204, statusText: "No Content" });
}

/**
 * First / Previous / "what page N of M" / Next / Last, or "" when there is one page.
 * `link(n, label)` returns the anchor of page n.
 */
export function pager(link, page, pages, what) {
  if (pages <= 1) return "";
  const parts = [
    page > 1 ? link(1, "&laquo; First") : "&laquo; First",
    page > 1 ? link(page - 1, "&lt; Previous") : "&lt; Previous",
    `<B>${what} page ${page} of ${pages}</B>`,
    page < pages ? link(page + 1, "Next &gt;") : "Next &gt;",
    page < pages ? link(pages, "Last &raquo;") : "Last &raquo;",
  ];
  return `<P><FONT SIZE="-1">[ ${parts.join(" ] [ ")} ]</FONT>`;
}

/** Remembers one asynchronous result per key; a failure is forgotten unless `keep(error)`. */
export class Memo {
  #entries = new Map();

  get(key, produce, keep = () => false) {
    let entry = this.#entries.get(key);
    if (entry === undefined) {
      entry = produce();
      this.#entries.set(key, entry);
      entry.catch((error) => {
        if (!keep(error)) this.#entries.delete(key);
      });
    }
    return entry;
  }
}

/** Serves `/_img?u=URL&w=WIDTH`: the picture at URL, baseline JPEG (or the GIF itself when small) scaled down to at most WIDTH pixels. */
export class ImageProxy {
  #fetch;
  #site;
  #maxWidth;
  #maxBytes;
  #memo = new Memo();

  /** `site` is the guest-side origin the proxy route lives on; `maxWidth` the widest image sent, in pixels. */
  constructor({ fetch, site, maxWidth, maxBytes }) {
    this.#fetch = fetch;
    this.#site = site;
    this.#maxWidth = maxWidth;
    this.#maxBytes = maxBytes;
  }

  /** The guest URL of `source` (absolute http(s) URL) scaled to at most `width` pixels. */
  url(source, width) {
    return `${this.#site}/_img?w=${Math.min(width, this.#maxWidth)}&u=${encodeURIComponent(source)}`;
  }

  async handle(url) {
    const source = url.searchParams.get("u");
    const width = Math.min(Number(url.searchParams.get("w")) || this.#maxWidth, this.#maxWidth);
    if (!/^https?:\/\//i.test(source ?? "")) throw new NotFound("No such image.");
    let image;
    try {
      image = await this.#memo.get(`${width}:${source}`, () => this.#convert(source, width));
    } catch (error) {
      // A picture that cannot be fetched or decoded is a broken image in the guest, not a page error.
      console.warn(`image ${source}: ${error.message}`);
      return new Response(null, { status: 404, statusText: "Not Found" });
    }
    return new Response(image.bytes, { status: 200, statusText: "OK", headers: { "Content-Type": image.type, "Content-Length": String(image.bytes.byteLength) } });
  }

  async #convert(source, width) {
    const res = await this.#fetch(source);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > this.#maxBytes) throw new Error("image too large");
    const isGif = String.fromCharCode(...bytes.subarray(0, 4)) === "GIF8";
    if (isGif && bytes.length <= 200_000) return { bytes, type: "image/gif" };
    const type = res.headers.get("content-type")?.split(";")[0] || (isGif ? "image/gif" : "image/png");
    const blob = new Blob([bytes], { type });
    let drawable;
    let naturalWidth;
    let naturalHeight;
    if (type === "image/svg+xml" || /^\s*<(\?xml|svg)/.test(new TextDecoder().decode(bytes.subarray(0, 200)))) {
      // createImageBitmap cannot decode SVG; an <img> can.
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/svg+xml" }));
      drawable = new Image();
      drawable.src = objectUrl;
      try {
        await drawable.decode();
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
      naturalWidth = drawable.naturalWidth || 120;
      naturalHeight = drawable.naturalHeight || 20;
    } else {
      drawable = await createImageBitmap(blob);
      naturalWidth = drawable.width;
      naturalHeight = drawable.height;
    }
    const scale = Math.min(1, width / naturalWidth);
    const w = Math.max(1, Math.round(naturalWidth * scale));
    const h = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(drawable, 0, 0, w, h);
    return { bytes: await canvasJpeg(canvas), type: "image/jpeg" };
  }
}
