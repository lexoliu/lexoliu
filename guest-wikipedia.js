// http://en.wikipedia.org/ inside Netscape Navigator 3.0: Wikipedia's articles rendered here (in the
// visitor's browser) from its public REST and Action APIs as HTML 3.2, the way guest-github.js
// answers http://github.com/.
//
// Routes (the guest's paths mirror Wikipedia's):
//   /                              start page with a search form
//   /wiki/TITLE                    article, split into pages at section boundaries   ?page=N
//   /w/index.php?search=QUERY      search; an exact title opens that article (as Wikipedia's "Go" does),
//                                  fulltext=1 always lists results                    ?offset=N
//   /_img?u=URL&w=WIDTH, /_real/PATH (opens en.wikipedia.org/PATH in the host browser)
// Anything else on the host (Special: pages, edit forms, ...) opens on the real Wikipedia in the host browser.
import { renderNodes } from "./guest-html.js";
import { ImageProxy, Memo, NotFound, Upstream, htmlResponse, noContent, pager } from "./guest-site.js";
import { guestText } from "./guest-text.js";

const SITE = "http://en.wikipedia.org";
const REAL = "https://en.wikipedia.org";
const REST_HTML = `${REAL}/api/rest_v1/page/html/`;
const API = `${REAL}/w/api.php`;
/** The base the REST API resolves an article's relative links against. */
const WIKI_BASE = `${REAL}/wiki/`;
/** Markup per page of an article: Netscape's emulated network moves about 5 KB a second. */
export const PAGE_CHARS = 20_000;
/** Search results per page. */
const SEARCH_PAGE = 20;
/** Search results listed under a missing article. */
const SIMILAR_RESULTS = 5;
/** Widest image shown in the text and in an infobox, in pixels; also the widest the image route serves. */
const THUMB_WIDTH = 220;
const INFOBOX_IMAGE_WIDTH = 250;
/** Width of a floated infobox: its image plus the cell padding and border. */
const INFOBOX_WIDTH = INFOBOX_IMAGE_WIDTH + 30;
/** Cell padding and border around a floated figure's picture. */
const FIGURE_MARGIN = 12;
const MAX_IMAGE_BYTES = 20_000_000;
const FEATURED = ["Windows 95", "Netscape Navigator", "World Wide Web", "Rust (programming language)", "Internet", "Mosaic (web browser)"];
/** Elements Wikipedia marks as chrome around the article, dropped with everything inside them. */
const SKIPPED_CLASSES = new Set(["mw-editsection", "navbox", "navbox-styles", "sistersitebox", "metadata", "ambox", "noprint", "mw-empty-elt", "mw-cite-backlink", "sidebar", "vertical-navbox"]);
/** The `typeof` of a figure that floats beside the text. */
const FLOATING_FIGURE = /mw:File\/(Thumb|Frame)\b/;

const href = (path) => `${SITE}${path}`;
const realLink = (path) => href(`/_real${path}`);

/** "windows_95" -> "Windows 95": how Wikipedia identifies a title. */
export function normalizeTitle(title) {
  const spaced = title.replaceAll("_", " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The guest path of an article. */
export function articlePath(title) {
  return `/wiki/${encodeURIComponent(title.replaceAll(" ", "_")).replaceAll("%2F", "/").replaceAll("%3A", ":")}`;
}

/** What a link in the HTML of article `self` points at: {article, fragment}, {external: URL}, or undefined for a link to drop (a red link, a scheme the guest cannot open). */
export function classifyLink(target, self) {
  if (target.startsWith("#")) return { article: self, fragment: decodeURIComponent(target.slice(1)) };
  const url = new URL(target, WIKI_BASE);
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  if (url.hostname === "en.wikipedia.org" && url.pathname.startsWith("/wiki/")) {
    if (url.searchParams.has("redlink")) return undefined;
    return { article: normalizeTitle(decodeURIComponent(url.pathname.slice("/wiki/".length))), fragment: decodeURIComponent(url.hash.slice(1)) };
  }
  return { external: url };
}

/** Packs consecutive `sizes` into pages of at most `budget` (a unit larger than that gets a page of its own); returns the page number (0-based) of each. */
export function packPages(sizes, budget) {
  const pages = [];
  let page = 0;
  let used = 0;
  for (const size of sizes) {
    if (used > 0 && used + size > budget) {
      page++;
      used = 0;
    }
    used += size;
    pages.push(page);
  }
  return pages;
}

/** The anchor builder `pager` wants, for pages whose address is `url(n)`. */
const pageLink = (url) => (n, label) => `<A HREF="${guestText(url(n))}">${label}</A>`;

const classes = (node) => node.getAttribute("class")?.split(/\s+/) ?? [];

/** Whether `node` sits in the running text, not inside a table or another figure. */
function inFlow(node) {
  return node.parentElement?.closest("table, figure") === null;
}


/** A formula as its source text (what the wikitext holds), on a line of its own when Wikipedia shows it so. */
function formula(math) {
  const { attrs, body } = JSON.parse(math.getAttribute("data-mw"));
  const source = guestText(body.extsrc.trim());
  return attrs.display === "block" ? `<P ALIGN="CENTER"><TT>${source}</TT></P>\n` : `<TT>${source}</TT>`;
}

/** The text of an Action API snippet, with the matched words in bold. */
function snippetHtml(snippet) {
  const doc = new DOMParser().parseFromString(snippet, "text/html");
  return [...doc.body.childNodes].map((node) => (node.nodeType === Node.TEXT_NODE ? guestText(node.data) : classes(node).includes("searchmatch") ? `<B>${guestText(node.textContent)}</B>` : guestText(node.textContent))).join("");
}

/** The first heading in `nodes`, as text, or undefined. */
function firstHeading(nodes) {
  for (const node of nodes) {
    const heading = /^H[1-6]$/.test(node.tagName) ? node : node.querySelector?.("h1, h2, h3, h4, h5, h6");
    if (heading) return heading.textContent.trim();
  }
  return undefined;
}

export class WikipediaSite {
  #fetch;
  #openHost;
  #images;
  /** Responses of the APIs, by URL; articles rendered into pages, by title. */
  #responses = new Memo();
  #articles = new Memo();

  /**
   * `fetch` is the host browser's; `openHost(url)` opens a URL in the visitor's browser (the page's
   * existing mechanism for links off the guest's site).
   */
  constructor({ fetch, openHost }) {
    this.#fetch = fetch;
    this.#openHost = openHost;
    this.#images = new ImageProxy({ fetch, site: SITE, maxWidth: INFOBOX_IMAGE_WIDTH, maxBytes: MAX_IMAGE_BYTES });
  }

  /** Answers the guest's request for a URL on wikipedia.org. */
  async handle(url) {
    try {
      const response = await this.#route(url);
      if (response !== undefined) return response;
      // A Wikipedia page this site has no rendering of.
      this.#openHost(`${REAL}${url.pathname}${url.search}`);
      return noContent();
    } catch (error) {
      if (error instanceof Upstream) {
        return htmlResponse(502, this.#chrome({ title: "Wikipedia error", real: url.pathname, body: `<H1>Wikipedia could not be reached</H1><P>${guestText(error.message)}<P><A HREF="${guestText(url.pathname + url.search)}">Try again</A>` }));
      }
      if (error instanceof NotFound) {
        return htmlResponse(404, this.#chrome({ title: "Not found", real: url.pathname, body: `<H1>Not found</H1><P>${guestText(error.message)}` }));
      }
      throw error;
    }
  }

  async #route(url) {
    const path = url.pathname;
    if (path === "/_img") return this.#images.handle(url);
    if (path.startsWith("/_real/")) {
      this.#openHost(`${REAL}${path.slice("/_real".length)}${url.search}`);
      return noContent();
    }
    if (path === "/") return htmlResponse(200, this.#startPage());
    if (path === "/w/index.php") {
      if (url.searchParams.has("search")) return this.#searchResponse(url);
      const title = url.searchParams.get("title");
      return title === null ? undefined : this.#articleResponse(url, normalizeTitle(title));
    }
    if (path.startsWith("/wiki/")) {
      const title = normalizeTitle(decodeURIComponent(path.slice("/wiki/".length)));
      if (title === "") return htmlResponse(200, this.#startPage());
      if (/^Special:Search$/i.test(title)) return this.#searchResponse(url);
      if (/^Special:/i.test(title)) return undefined;
      return this.#articleResponse(url, title);
    }
    return undefined;
  }

  // ---------------------------------------------------------------- upstream

  /** One request per URL for the session; failures other than 404 are not remembered. */
  #request(url, read) {
    return this.#responses.get(
      url,
      async () => {
        let res;
        try {
          res = await this.#fetch(url);
        } catch (error) {
          throw new Upstream(`${url}: ${error.message}`);
        }
        if (res.status === 404) throw new NotFound(`Wikipedia has nothing at ${url}.`);
        if (!res.ok) throw new Upstream(`${url}: HTTP ${res.status}`);
        return read(res);
      },
      (error) => error instanceof NotFound
    );
  }

  async #query(params) {
    const url = `${API}?${new URLSearchParams({ action: "query", format: "json", formatversion: "2", origin: "*", ...params })}`;
    const json = await this.#request(url, (res) => res.json());
    if (json.error) throw new Upstream(`${url}: ${json.error.info}`);
    return json.query;
  }

  /** Search hits for `query` ({total, suggestion, hits}); with `exact`, also the article the query names, if there is one. */
  async #search(query, offset, limit, exact) {
    const { searchinfo, search, pages, redirects } = await this.#query({
      list: "search",
      srsearch: query,
      srlimit: String(limit),
      sroffset: String(offset),
      srprop: "snippet|size|wordcount",
      srinfo: "totalhits|suggestion",
      ...(exact ? { titles: query, redirects: "1" } : {}),
    });
    const page = exact && !query.includes("|") ? pages?.[0] : undefined;
    return {
      total: searchinfo.totalhits,
      suggestion: searchinfo.suggestion,
      hits: search,
      exact: page === undefined || page.missing || page.invalid ? undefined : { title: page.title, redirectedFrom: redirects?.[0]?.from },
    };
  }

  // ---------------------------------------------------------------- chrome

  /** The page around `body`: the Wikipedia banner with its search box, and the licence line. */
  #chrome({ title, real, body, base, query = "" }) {
    return `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
<HTML>
<HEAD>
<TITLE>${guestText(title)}</TITLE>
${base === undefined ? "" : `<BASE HREF="${guestText(base)}">\n`}</HEAD>
<BODY BGCOLOR="#FFFFFF" TEXT="#000000" LINK="#0000CC" VLINK="#551A8B" ALINK="#FF0000">
<TABLE WIDTH="100%" BORDER="0" CELLPADDING="4" CELLSPACING="0" BGCOLOR="#EEEEEE">
<TR>
<TD><A HREF="${href("/")}"><FONT SIZE="+3"><B>Wikipedia</B></FONT></A> <FONT SIZE="-1"><I>The Free Encyclopedia</I></FONT></TD>
<TD ALIGN="RIGHT" NOWRAP>${this.#searchForm(query)}</TD>
</TR>
<TR>
<TD COLSPAN="2"><FONT SIZE="-1">[ <A HREF="${href("/")}">Main page</A> ] [ <A HREF="http://lexo.cool/">lexo.cool</A> ] [ <A HREF="${guestText(realLink(real))}"><B>View on real Wikipedia</B></A> ]</FONT></TD>
</TR>
</TABLE>
${body}
<HR>
<FONT SIZE="-2" COLOR="#555555">Text from Wikipedia, available under the <A HREF="${realLink("/wiki/Wikipedia:Text_of_the_Creative_Commons_Attribution-ShareAlike_4.0_International_License")}">Creative Commons Attribution-ShareAlike License</A>. Built in your browser from Wikipedia's public API and kept for this session. Not affiliated with the Wikimedia Foundation.</FONT>
</BODY>
</HTML>`;
  }

  #searchForm(query) {
    return `<FORM ACTION="${href("/w/index.php")}" METHOD="GET"><INPUT TYPE="text" NAME="search" SIZE="24" VALUE="${guestText(query)}"> <INPUT TYPE="submit" VALUE="Go"> <INPUT TYPE="submit" NAME="fulltext" VALUE="Search"></FORM>`;
  }

  // ---------------------------------------------------------------- start and search

  #startPage() {
    const items = FEATURED.map((title) => `<LI><A HREF="${href(articlePath(title))}"><B>${guestText(title)}</B></A>`).join("\n");
    return this.#chrome({
      title: "Wikipedia, the free encyclopedia",
      real: "/",
      body: `<H1>Wikipedia</H1>
<P><I>The Free Encyclopedia</I>
<P>Read Wikipedia without leaving Netscape. Type what you are looking for, then <B>Go</B> to open the article of that name or <B>Search</B> to list the articles that mention it.
<P><B>Start with:</B>
<UL>
${items}
</UL>`,
    });
  }

  async #searchResponse(url) {
    const query = (url.searchParams.get("search") ?? "").trim();
    if (query === "") return htmlResponse(200, this.#startPage());
    const offset = Number(url.searchParams.get("offset")) || 0;
    const fulltext = url.searchParams.has("fulltext");
    const { total, suggestion, hits, exact } = await this.#search(query, offset, SEARCH_PAGE, !fulltext && offset === 0);
    if (exact !== undefined) return this.#articleResponse(url, exact.title, exact.redirectedFrom);
    const searchLink = (n) => `${href("/w/index.php")}?${new URLSearchParams({ search: query, fulltext: "1", offset: String((n - 1) * SEARCH_PAGE) })}`;
    const pages = Math.ceil(total / SEARCH_PAGE);
    const body = `<H1>Search results</H1>
${suggestion === undefined ? "" : `<P>Did you mean: <A HREF="${guestText(`${href("/w/index.php")}?${new URLSearchParams({ search: suggestion })}`)}"><B>${guestText(suggestion)}</B></A>?`}
${
  total === 0
    ? `<P>There were no results matching the query <B>${guestText(query)}</B>.`
    : `<P>Results ${offset + 1}-${offset + hits.length} of ${total.toLocaleString("en-US")} for <B>${guestText(query)}</B>:
${this.#hitList(hits)}
${pager(pageLink(searchLink), offset / SEARCH_PAGE + 1, pages, "Results")}`
}`;
    return htmlResponse(200, this.#chrome({ title: `Search results for "${query}" - Wikipedia`, real: `/w/index.php?${new URLSearchParams({ search: query, fulltext: "1" })}`, body, query }));
  }

  #hitList(hits) {
    const items = hits.map((hit) => `<LI><A HREF="${guestText(href(articlePath(hit.title)))}"><B>${guestText(hit.title)}</B></A> <FONT SIZE="-1" COLOR="#555555">(${Math.ceil(hit.size / 1024)} KB, ${hit.wordcount.toLocaleString("en-US")} words)</FONT><BR>${snippetHtml(hit.snippet)}`);
    return `<UL>\n${items.join("\n")}\n</UL>`;
  }

  // ---------------------------------------------------------------- articles

  /** The article `title` as the page the guest asked for (`url`): ?page=N of it, or its missing-article page. */
  async #articleResponse(url, title, redirectedFrom) {
    const article = await this.#article(title);
    if (article.missing) return htmlResponse(404, await this.#missingPage(title));
    const requested = Number(url.searchParams.get("page")) || 1;
    const page = Math.min(Math.max(1, requested), article.pages.length);
    const pageUrl = (n) => href(`${articlePath(article.title)}${n === 1 ? "" : `?page=${n}`}`);
    const from = redirectedFrom ?? (normalizeTitle(title) === article.title ? undefined : title);
    const nav = article.pages.length > 1 ? pager(pageLink(pageUrl), page, article.pages.length, "Article") : "";
    const next = page < article.pages.length ? `<P><FONT SIZE="-1">Continues with <A HREF="${guestText(pageUrl(page + 1))}">${guestText(article.pages[page].heading ?? "the next page")}</A></FONT>` : "";
    const body = `<H1>${guestText(article.title)}</H1>
<FONT SIZE="-1"><I>From Wikipedia, the free encyclopedia</I>${from === undefined ? "" : ` &nbsp; (Redirected from ${guestText(normalizeTitle(from))})`}</FONT>
${page === 1 ? article.contents : ""}${nav}
${article.pages[page - 1].html}
${nav}${next}`;
    return htmlResponse(200, this.#chrome({ title: `${article.title} - Wikipedia`, real: articlePath(article.title), body, base: pageUrl(page) }));
  }

  async #missingPage(title) {
    const { hits } = await this.#search(title, 0, SIMILAR_RESULTS, false);
    const fulltext = href(`/w/index.php?${new URLSearchParams({ search: title, fulltext: "1" })}`);
    return this.#chrome({
      title: `${title} - Wikipedia`,
      real: articlePath(title),
      query: title,
      body: `<H1>${guestText(title)}</H1>
<P><B>Wikipedia does not have an article with this exact name.</B>
<P>Search for <A HREF="${guestText(fulltext)}"><B>${guestText(title)}</B></A> in all of Wikipedia, check the spelling, or <A HREF="${guestText(realLink(`/w/index.php?${new URLSearchParams({ title, action: "edit" })}`))}">create the page on the real Wikipedia</A>.
${hits.length === 0 ? "" : `<P>Articles that may be what you want:\n${this.#hitList(hits)}`}`,
    });
  }

  /** The article `title` rendered into pages, or {missing: true}. One build per title for the session. */
  #article(title) {
    return this.#articles.get(title, async () => {
      let html;
      try {
        html = await this.#request(`${REST_HTML}${encodeURIComponent(title.replaceAll(" ", "_"))}`, (res) => res.text());
      } catch (error) {
        if (error instanceof NotFound) return { missing: true };
        throw error;
      }
      return this.#paginate(new DOMParser().parseFromString(html, "text/html"));
    });
  }

  /**
   * Renders the parsed article: its sections are cut into units no larger than PAGE_CHARS (a section
   * too big for a page is cut along its subsections), the units packed into pages, and every link
   * to a place in the article points at the page that holds it.
   */
  #paginate(doc) {
    const title = normalizeTitle(doc.title);
    const body = doc.body;
    const skip = (node) => classes(node).some((name) => SKIPPED_CLASSES.has(name)) || node.hasAttribute("hidden") || /display\s*:\s*none/.test(node.getAttribute("style") ?? "");
    const shown = (node) => {
      for (let n = node; n !== null && n !== body; n = n.parentElement) if (skip(n)) return false;
      return true;
    };
    const policy = (links) => ({
      skip,
      custom: (node) => (node.localName === "math" ? formula(node) : undefined),
      unstyled: (node) => node.tagName === "CITE",
      imageWidth: (node) => (node.closest(".infobox") ? INFOBOX_IMAGE_WIDTH : THUMB_WIDTH),
      float: (node) => this.#float(node),
      ...links,
    });

    // Anchors worth emitting: the places a link in the article points at.
    const targets = new Set();
    for (const a of body.querySelectorAll("a[href]")) {
      const link = classifyLink(a.getAttribute("href"), title);
      if (link?.article === title && link.fragment !== "" && shown(a)) targets.add(link.fragment);
    }
    const anchors = { target: (node) => (targets.has(node.id) ? node.id : undefined) };

    const sizeOf = (nodes) => renderNodes(nodes, policy({ ...anchors, link: () => "", image: () => "" })).length;
    const units = this.#units(body, sizeOf);
    const pageOf = packPages(units.map(sizeOf), PAGE_CHARS);
    const owner = new Map();
    units.forEach((nodes, i) => nodes.forEach((node) => owner.set(node, pageOf[i])));
    const pageOfElement = (element) => {
      for (let node = element; node !== null; node = node.parentNode) if (owner.has(node)) return owner.get(node);
      return undefined;
    };
    const placed = new Map([...body.querySelectorAll("[id]")].filter((e) => targets.has(e.id) || /^H[1-6]$/.test(e.tagName)).map((e) => [e.id, pageOfElement(e)]));

    const count = pageOf.length === 0 ? 1 : pageOf[pageOf.length - 1] + 1;
    const pageUrl = (n) => href(`${articlePath(title)}${n === 0 ? "" : `?page=${n + 1}`}`);
    const pages = Array.from({ length: count }, (_, n) => {
      const nodes = units.filter((_, i) => pageOf[i] === n).flat();
      const links = policy({
        ...anchors,
        link: (target) => this.#link(target, title, (fragment) => (placed.has(fragment) ? `${pageUrl(placed.get(fragment))}#${fragment}` : undefined)),
        image: (src, width) => this.#image(src, width),
      });
      return { html: renderNodes(nodes, links), heading: firstHeading(nodes) };
    });

    const sections = [...body.querySelectorAll(":scope > section > h2[id]")];
    const items = sections.map((h) => `<LI><A HREF="${guestText(`${pageUrl(placed.get(h.id))}#${h.id}`)}">${guestText(h.textContent.trim())}</A>`);
    const contents = count > 1 && items.length > 0 ? `<P><B>Contents</B>\n<UL>\n${items.join("\n")}\n</UL>\n` : "";
    return { title, pages, contents };
  }

  /** `parent`'s children as units to pack into pages: each section is one, cut at its subsections when it is larger than a page; the nodes between sections stay together. */
  #units(parent, sizeOf) {
    const units = [];
    let run = [];
    const flush = () => {
      if (run.length > 0) units.push(run);
      run = [];
    };
    for (const child of parent.childNodes) {
      if (child.tagName !== "SECTION") {
        run.push(child);
        continue;
      }
      flush();
      if (sizeOf([child]) > PAGE_CHARS && child.querySelector(":scope > section") !== null) units.push(...this.#units(child, sizeOf));
      else units.push([child]);
    }
    flush();
    return units;
  }

  /** {align, width} when `node` (an infobox or a thumbnail figure) floats beside the text. */
  #float(node) {
    if (!inFlow(node)) return undefined;
    if (node.tagName === "TABLE") return classes(node).includes("infobox") ? { align: "RIGHT", width: INFOBOX_WIDTH } : undefined;
    if (node.tagName !== "FIGURE" || !FLOATING_FIGURE.test(node.getAttribute("typeof") ?? "")) return undefined;
    const names = classes(node);
    if (names.includes("mw-halign-center") || names.includes("mw-halign-none")) return undefined;
    const image = node.querySelector("img");
    if (image === null) return undefined;
    const width = Math.min(Number(image.getAttribute("width")) || THUMB_WIDTH, THUMB_WIDTH);
    return { align: names.includes("mw-halign-left") ? "LEFT" : "RIGHT", width: width + FIGURE_MARGIN };
  }

  /** The guest URL of a link in the article `title`; `place(fragment)` is where a place in the article lives. */
  #link(target, title, place) {
    const link = classifyLink(target.trim(), title);
    if (link === undefined) return undefined;
    if (link.external !== undefined) return `http://${link.external.host}${link.external.pathname}${link.external.search}${link.external.hash}`;
    if (link.article === title) return link.fragment === "" ? undefined : place(link.fragment);
    return `${href(articlePath(link.article))}${link.fragment === "" ? "" : `#${encodeURIComponent(link.fragment)}`}`;
  }

  #image(src, width) {
    const absolute = src.startsWith("//") ? `https:${src}` : src;
    return /^https?:\/\//i.test(absolute) ? this.#images.url(absolute, width) : undefined;
  }
}
