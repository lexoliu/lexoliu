// README rendering: markdown-it turns Markdown (and the HTML READMEs embed) into HTML, the browser's
// own parser reads that into a DOM, and guest-html.js walks it down to HTML 3.2.
import MarkdownIt from "markdown-it";
import { renderNodes } from "./guest-html.js";
import { MAIL_ROUTE } from "./guest-pages.js";

/**
 * Markdown -> HTML 3.2. `links.link(href)` returns the guest URL for a link (or undefined to drop
 * the link and keep its text); `links.image(src, width)` the guest URL of an image.
 */
export function renderMarkdown(source, links) {
  const md = new MarkdownIt({ html: true, linkify: true });
  const doc = new DOMParser().parseFromString(`<body>${md.render(source)}`, "text/html");
  return renderNodes([...doc.body.childNodes], links);
}

/** The address a README mailto: link asks the visitor's mail client for, as the guest's mail route. */
export function mailRoute(address) {
  return `http://lexo.cool${MAIL_ROUTE}${address}`;
}
