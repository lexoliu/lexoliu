// README rendering: markdown-it turns Markdown (and the HTML READMEs embed) into HTML, the browser's
// own parser reads that into a DOM without loading anything, and this walks the DOM down to the
// HTML 3.2 Netscape Navigator 3.0 understands: no CSS, no scripts, no media.
import MarkdownIt from "markdown-it";
import { MAIL_ROUTE } from "./guest-pages.js";
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

class Walker {
  /** `links` maps hrefs and image sources to the guest's URLs, see GitHubSite. */
  constructor(links) {
    this.links = links;
  }

  children(node) {
    return [...node.childNodes].map((child) => this.node(child)).join("");
  }

  node(node) {
    if (node.nodeType === Node.TEXT_NODE) return guestText(node.data);
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toUpperCase();
    if (DROPPED.has(tag)) return "";
    const inner = () => this.children(node);
    const align = ALIGNS.has(node.getAttribute("align")) ? ` ALIGN="${node.getAttribute("align").toUpperCase()}"` : "";
    if (/^H[1-6]$/.test(tag)) {
      const slug = node.id || slugOf(node.textContent);
      return `<${tag}${align}><A NAME="${guestText(slug)}"></A>${inner()}</${tag}>\n`;
    }
    switch (tag) {
      case "P":
        return `<P${align}>${inner()}</P>\n`;
      case "DIV":
      case "SECTION":
      case "ARTICLE":
      case "HEADER":
      case "FOOTER":
      case "MAIN":
      case "NAV":
      case "FIGURE":
      case "FIGCAPTION":
        return align === "" ? `${inner()}\n` : `<DIV${align}>${inner()}</DIV>\n`;
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
        return `<PRE>${guestText(expandTabs(node.textContent.replace(/\n$/, "")))}</PRE>\n`;
      case "TABLE":
        return `<TABLE BORDER="1" CELLPADDING="3" CELLSPACING="0">${inner()}</TABLE>\n`;
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
    const target = href === null ? undefined : this.links.link(href);
    const parts = [];
    if (name) parts.push(`<A NAME="${guestText(name)}"></A>`);
    if (target === undefined) return parts.join("") + inner;
    return `${parts.join("")}<A HREF="${guestText(target)}">${inner}</A>`;
  }

  image(node) {
    const src = node.getAttribute("src");
    if (!src) return "";
    const width = Math.min(numeric(node.getAttribute("width")) ?? MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH);
    const url = this.links.image(src, width);
    if (url === undefined) return "";
    return `<IMG SRC="${guestText(url)}" ALT="${guestText(node.getAttribute("alt") ?? "")}" BORDER="0">`;
  }
}

/**
 * Markdown -> HTML 3.2. `links.link(href)` returns the guest URL for a link (or undefined to drop
 * the link and keep its text); `links.image(src, width)` the guest URL of an image.
 */
export function renderMarkdown(source, links) {
  const md = new MarkdownIt({ html: true, linkify: true });
  const doc = new DOMParser().parseFromString(`<body>${md.render(source)}`, "text/html");
  return new Walker(links).children(doc.body);
}

/** The address a README mailto: link asks the visitor's mail client for, as the guest's mail route. */
export function mailRoute(address) {
  return `http://lexo.cool${MAIL_ROUTE}${address}`;
}
