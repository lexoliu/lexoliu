// Pieces shared by the sites the guest browses through the host page (guest-github.js, guest-hn.js).

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
