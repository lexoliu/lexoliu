// README rendering: markdown-it turns Markdown (and the HTML READMEs embed) into HTML, the browser's
// own parser reads that into a DOM, and guest-html.js walks it down to HTML 3.2.
import MarkdownIt from "markdown-it";
import { renderHtml } from "./guest-html.js";
import { MAIL_ROUTE } from "./guest-pages.js";

/**
 * Markdown -> HTML 3.2. `links.link(href)` returns the guest URL for a link (or undefined to drop
 * the link and keep its text); `links.image(src, width)` the guest URL of an image.
 * `highlight(code, name)` resolves to the HTML 3.2 lines of a fenced block whose info string
 * names `name` (its first word, before any comma as in rustdoc's `rust,ignore`), or undefined to
 * show it plain.
 */
export async function renderMarkdown(source, links, highlight) {
  const md = new MarkdownIt({ html: true, linkify: true });
  const env = {};
  const tokens = md.parse(source, env);
  const fenced = tokens.filter((token) => token.type === "fence" && token.info.trim() !== "");
  const fences = await Promise.all(fenced.map((token) => highlight(token.content.replace(/\n$/, ""), token.info.trim().split(/[\s,]/)[0])));
  const plainFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (all, index, options, env_, self) => {
    const at = fenced.indexOf(all[index]);
    return at === -1 || fences[at] === undefined ? plainFence(all, index, options, env_, self) : `<pre data-fence="${at}"></pre>\n`;
  };
  return renderHtml(md.renderer.render(tokens, md.options, env), links, fences);
}

/** The address a README mailto: link asks the visitor's mail client for, as the guest's mail route. */
export function mailRoute(address) {
  return `http://lexo.cool${MAIL_ROUTE}${address}`;
}
