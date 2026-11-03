// Walks a DOM (the browser's own parser reads HTML into one without loading anything) down to the
// HTML 3.2 Netscape Navigator 3.0 understands: no CSS, no scripts, no media. Shared by the sites
// that show arbitrary HTML: READMEs (guest-markdown.js) and Wikipedia articles (guest-wikipedia.js).
import { expandTabs, guestText } from "./guest-text.js";

/** Elements dropped with everything inside them. */
const DROPPED = new Set(["SCRIPT", "STYLE", "SVG", "VIDEO", "AUDIO", "IFRAME", "OBJECT", "EMBED", "FORM", "BUTTON", "SELECT", "TEXTAREA", "TEMPLATE", "HEAD", "SOURCE", "TRACK", "CANVAS", "NOSCRIPT"]);
/** Elements that map to an HTML 3.2 tag of another name. */
const RENAMED = { STRONG: "B", EM: "I", CODE: "TT", KBD: "TT", SAMP: "TT", VAR: "I", CITE: "I", DEL: "STRIKE", S: "STRIKE", INS: "U", ADDRESS: "I", ABBR: "", MARK: "B" };
/** Elements that keep their own name, with no attributes. */
const PLAIN = new Set(["B", "I", "U", "STRIKE", "SUB", "SUP", "BIG", "SMALL", "TT", "BLOCKQUOTE", "UL", "DL", "DT", "DD", "CENTER", "CAPTION", "THEAD", "TBODY", "TFOOT"]);
const ALIGNS = new Set(["left", "center", "right"]);
const MAX_IMAGE_WIDTH = 600;

/**
 * The slug GitHub gives a heading: lower case, punctuation removed, spaces to hyphens.
 * Characters the guest cannot show are fine here, the slug only has to match the link.
 */
export function slugOf(text) {
  return text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
}

function numeric(value) {
  return /^\d{1,4}$/.test(value ?? "") ? Number(value) : undefined;
}

/** Elements that start a line of their own. */
const BLOCKS = new Set(["P", "DIV", "SECTION", "ARTICLE", "HEADER", "FOOTER", "MAIN", "NAV", "UL", "OL", "DL", "TABLE", "PRE", "BLOCKQUOTE", "HR", "FIGURE", "CENTER", "FORM", "DETAILS", "SUMMARY", "H1", "H2", "H3", "H4", "H5", "H6"]);

/** Whether `node` has text or an inline element among its children. */
function hasInline(node) {
  return [...node.childNodes].some((child) => (child.nodeType === Node.TEXT_NODE ? child.data.trim() !== "" : child.nodeType === Node.ELEMENT_NODE && !BLOCKS.has(child.tagName.toUpperCase()) && !DROPPED.has(child.tagName.toUpperCase())));
}

/** Elements that cannot hold an anchor: only cells may sit in a row, only items in a list. */
const TABLE_PARTS = new Set(["TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH", "COL", "COLGROUP", "UL", "OL", "DL"]);

/**
 * Walks a DOM down to HTML 3.2. `links` is the site's policy:
 *   link(href, node)        the guest URL of a link, or undefined to drop the link and keep its text
 *   image(src, width, node) the guest URL of an image, or undefined to drop it
 * and, optionally:
 *   skip(node)              true to drop an element with everything inside it
 *   custom(node)            the HTML 3.2 to emit for an element instead of walking it, or undefined
 *   unstyled(node)         true to keep an element's content and drop its tag (a citation that is not italic)
 *   target(node)           the name to anchor an element under (headings always are), or undefined
 *   imageWidth(node)        the widest the image may be shown, in pixels (default MAX_IMAGE_WIDTH)
 *   float(node)             {align, width} to float a table or figure beside the text
 */
class Walker {
  /** `fences` holds the highlighted lines of each fenced code block, by the index its <pre data-fence> names. */
  constructor(links, fences) {
    this.links = links;
    this.fences = fences;
  }

  children(node) {
    return [...node.childNodes].map((child) => this.node(child)).join("");
  }

  node(node) {
    if (node.nodeType === Node.TEXT_NODE) return guestText(node.data);
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toUpperCase();
    if (DROPPED.has(tag) || this.links.skip?.(node)) return "";
    const custom = this.links.custom?.(node);
    if (custom !== undefined) return custom;
    if (this.links.unstyled?.(node)) return this.children(node);
    const name = TABLE_PARTS.has(tag) || /^H[1-6]$/.test(tag) ? undefined : this.links.target?.(node);
    const mark = name === undefined ? "" : `<A NAME="${guestText(name)}"></A>`;
    const inner = () => mark + this.children(node);
    const align = ALIGNS.has(node.getAttribute("align")) ? ` ALIGN="${node.getAttribute("align").toUpperCase()}"` : "";
    if (/^H[1-6]$/.test(tag)) {
      const slug = node.id || slugOf(node.textContent);
      return `<${tag}${align}><A NAME="${guestText(slug)}"></A>${inner()}</${tag}>\n`;
    }
    switch (tag) {
      case "P":
        return `<P${align}>${inner()}</P>\n`;
      case "DIV":
        // A DIV holding text or inline elements is a line of its own in a browser; HTML 3.2 breaks lines only at block tags.
        if (align === "" && hasInline(node)) return `<P>${inner()}</P>\n`;
      // falls through
      case "SECTION":
      case "ARTICLE":
      case "HEADER":
      case "FOOTER":
      case "MAIN":
      case "NAV":
        return align === "" ? `${inner()}\n` : `<DIV${align}>${inner()}</DIV>\n`;
      case "FIGURE": {
        const float = this.links.float?.(node);
        if (float === undefined) return align === "" ? `${inner()}\n` : `<DIV${align}>${inner()}</DIV>\n`;
        return `<TABLE ALIGN="${float.align}" WIDTH="${float.width}" BORDER="0" CELLPADDING="4" CELLSPACING="0"><TR><TD>${inner()}</TD></TR></TABLE>\n`;
      }
      case "FIGCAPTION":
        return `<BR><FONT SIZE="-1">${inner()}</FONT>\n`;
      case "BR":
        return "<BR>";
      case "HR":
        return "<HR>\n";
      case "OL": {
        const start = numeric(node.getAttribute("start"));
        return `<OL${start === undefined ? "" : ` START="${start}"`}>${inner()}</OL>\n`;
      }
      case "LI":
        return `<LI>${inner()}\n`;
      case "PRE":
        if (node.hasAttribute("data-fence")) return `<PRE>${this.fences[Number(node.getAttribute("data-fence"))].join("\n")}</PRE>\n`;
        return `<PRE>${guestText(expandTabs(node.textContent.replace(/\n$/, "")))}</PRE>\n`;
      case "TABLE": {
        const float = this.links.float?.(node);
        const placed = float === undefined ? "" : ` ALIGN="${float.align}" WIDTH="${float.width}"`;
        return `<TABLE${placed} BORDER="1" CELLPADDING="3" CELLSPACING="0">${inner()}</TABLE>\n`;
      }
      case "TR":
        return `<TR>${inner()}</TR>\n`;
      case "TD":
      case "TH": {
        const span = ["colspan", "rowspan"].map((a) => (numeric(node.getAttribute(a)) ? ` ${a.toUpperCase()}="${numeric(node.getAttribute(a))}"` : "")).join("");
        return `<${tag}${align}${span} VALIGN="TOP">${inner()}</${tag}>`;
      }
      case "A":
        return this.anchor(node, inner());
      case "IMG":
        return this.image(node);
      case "SUMMARY":
        return `<P><B>${inner()}</B></P>\n`;
      case "INPUT":
        return node.type === "checkbox" ? (node.checked || node.hasAttribute("checked") ? "[x] " : "[ ] ") : "";
      case "FONT":
      case "SPAN":
      case "DETAILS":
      case "PICTURE":
      case "LABEL":
        return inner();
      default:
    }
    if (tag in RENAMED) {
      const name = RENAMED[tag];
      return name === "" ? inner() : `<${name}>${inner()}</${name}>`;
    }
    if (PLAIN.has(tag)) return `<${tag}>${inner()}</${tag}>`;
    return inner();
  }

  anchor(node, inner) {
    const name = node.getAttribute("name");
    const href = node.getAttribute("href");
    const target = href === null ? undefined : this.links.link(href, node);
    const parts = [];
    if (name) parts.push(`<A NAME="${guestText(name)}"></A>`);
    if (target === undefined) return parts.join("") + inner;
    return `${parts.join("")}<A HREF="${guestText(target)}">${inner}</A>`;
  }

  image(node) {
    const src = node.getAttribute("src");
    if (!src) return "";
    const cap = this.links.imageWidth?.(node) ?? MAX_IMAGE_WIDTH;
    const natural = numeric(node.getAttribute("width"));
    const width = Math.min(natural ?? cap, cap);
    const url = this.links.image(src, width, node);
    if (url === undefined) return "";
    // With both dimensions given, Netscape lays the page out before the picture arrives.
    const naturalHeight = numeric(node.getAttribute("height"));
    const size = natural && naturalHeight ? ` WIDTH="${width}" HEIGHT="${Math.max(1, Math.round((naturalHeight * width) / natural))}"` : "";
    return `<IMG SRC="${guestText(url)}" ALT="${guestText(node.getAttribute("alt") ?? "")}"${size} BORDER="0">`;
  }
}

/** DOM nodes -> HTML 3.2, under the site policy `links` (see Walker). */
export function renderNodes(nodes, links, fences = []) {
  const walker = new Walker(links, fences);
  return nodes.map((node) => walker.node(node)).join("");
}

/**
 * HTML text -> HTML 3.2, with `links` as for renderNodes and `fences` the highlighted code blocks
 * its <pre data-fence> elements name. The text is parsed into an inert document, nothing in it loads.
 */
export function renderHtml(html, links, fences = []) {
  const doc = new DOMParser().parseFromString(`<body>${html}`, "text/html");
  return renderNodes([...doc.body.childNodes], links, fences);
}
