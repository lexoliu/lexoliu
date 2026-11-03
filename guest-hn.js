// http://news.ycombinator.com/ inside Netscape Navigator 3.0: Hacker News rendered here (in the
// visitor's browser) from the official Firebase API as HTML 3.2, the way guest-github.js answers
// http://github.com/.
//
// Routes (the guest's paths mirror the real site's):
//   / and /news   top stories      ?p=N        /newest, /ask, /show, /jobs   the other lists, ?p=N
//   /item?id=N    a story, comment or poll, with its comments    ?p=N pages of top-level comments
//   /user?id=NAME a user
//   /_out?u=URL   opens URL (a story or a link in a comment) in the host browser
//   /_real/PATH   opens news.ycombinator.com/PATH in the host browser
// Anything else on the host (login, submit, voting, ...) opens on the real site.
import { renderHtml } from "./guest-markdown.js";
import { NotFound, Upstream, htmlResponse, noContent, pager } from "./guest-site.js";
import { formatAge, formatCount, formatDate, guestText } from "./guest-text.js";

const REAL = "https://news.ycombinator.com";
const API = "https://hacker-news.firebaseio.com/v0";
/** Stories per page of a list, as on the real site. */
export const LIST_PAGE = 30;
/** Top-level comments per page of an item. */
export const TOP_COMMENTS_PER_PAGE = 15;
/** Comments fetched for one page of an item; replies beyond it link to their parent's own page. */
export const COMMENT_BUDGET = 60;
/** Nesting levels drawn; deeper replies stay at this level. */
export const MAX_INDENT = 8;
/** How long a fetched API response is reused, in milliseconds. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** The guest's list routes: path -> API list and heading. */
const LISTS = {
  "/": ["topstories", "Top stories"],
  "/news": ["topstories", "Top stories"],
  "/newest": ["newstories", "New stories"],
  "/ask": ["askstories", "Ask HN"],
  "/show": ["showstories", "Show HN"],
  "/jobs": ["jobstories", "Jobs"],
};
const NAV = [["new", "/newest"], ["ask", "/ask"], ["show", "/show"], ["jobs", "/jobs"]];

// Links are root-relative: the guest resolves them against the host it asked, and the slow link
// to the guest carries every byte of markup.
const realLink = (path) => `/_real${path}`;
const itemHref = (id) => `/item?id=${id}`;
const userHref = (id) => `/user?id=${encodeURIComponent(id)}`;

/** A live item: present and neither deleted nor dead. */
export function isLive(item) {
  return item !== null && item !== undefined && !item.deleted && !item.dead;
}

/** "example.com" for a story's URL, without a leading "www."; undefined when it has none. */
export function domainOf(url) {
  if (url === undefined) return undefined;
  return new URL(url).hostname.replace(/^www\./, "");
}

/** The page number a ?p= value names (1 when absent); NotFound when it is not a positive integer. */
export function pageNumber(value) {
  if (value === null) return 1;
  if (!/^[1-9]\d{0,6}$/.test(value)) throw new NotFound(`There is no page "${value}".`);
  return Number(value);
}

/** The ids on page `page` (from 1) of `ids`, in pages of `size`, and the number of pages; NotFound past the last page. */
export function slicePage(ids, page, size) {
  const pages = Math.ceil(ids.length / size);
  if (page > Math.max(pages, 1)) throw new NotFound(`There is no page ${page}; there ${pages === 1 ? "is 1 page" : `are ${pages} pages`}.`);
  return { ids: ids.slice((page - 1) * size, page * size), pages };
}

/**
 * The comment tree under `ids`, fetched a level at a time (each level concurrently) until `budget`
 * items were requested. A level that does not fit is cut at the budget. Returns [{item, kids, cut}]
 * for the live items, where `cut` counts the item's replies that were not requested; deleted and
 * dead items vanish with their replies. `load(id)` returns the item or null.
 */
export async function loadThread(ids, budget, load) {
  const roots = [];
  let level = ids.map((id) => ({ id, into: roots, parent: undefined }));
  let remaining = budget;
  while (level.length > 0 && remaining > 0) {
    const taken = level.slice(0, remaining);
    for (const entry of level.slice(remaining)) if (entry.parent) entry.parent.cut++;
    remaining -= taken.length;
    const items = await Promise.all(taken.map((entry) => load(entry.id)));
    level = [];
    items.forEach((item, i) => {
      if (!isLive(item)) return;
      const node = { item, kids: [], cut: 0 };
      taken[i].into.push(node);
      for (const id of item.kids ?? []) level.push({ id, into: node.kids, parent: node });
    });
  }
  for (const entry of level) if (entry.parent) entry.parent.cut++;
  return roots;
}

/** [{node, depth}] for a tree in reading order, depth from 1 and capped at MAX_INDENT. */
export function flatten(nodes, depth = 1, out = []) {
  for (const node of nodes) {
    out.push({ node, depth: Math.min(depth, MAX_INDENT) });
    flatten(node.kids, depth + 1, out);
  }
  return out;
}

/** The tags that move a nest of lists from `from` levels to `to`. */
export function indentTags(from, to) {
  return to >= from ? "<UL>".repeat(to - from) : "</UL>".repeat(from - to);
}

export class HackerNewsSite {
  #fetch;
  #openHost;
  #now;
  #ttl;
  /** API responses by URL, with when they were requested. */
  #responses = new Map();
  /** How the walker maps a link in HN's HTML: web links go through the host browser, nothing else is shown. */
  #links = {
    link: (target) => (/^https?:\/\//i.test(target) ? this.#outHref(target) : undefined),
    image: () => undefined,
  };

  /**
   * `fetch` is the host browser's; `openHost(url)` opens a URL in the visitor's browser (the page's
   * existing mechanism for links off the guest's site).
   */
  constructor({ fetch, openHost, now = () => Date.now(), ttlMs = DEFAULT_TTL_MS }) {
    this.#fetch = fetch;
    this.#openHost = openHost;
    this.#now = now;
    this.#ttl = ttlMs;
  }

  /** Answers the guest's request for a URL on news.ycombinator.com. */
  async handle(url) {
    try {
      const response = await this.#route(url);
      if (response !== undefined) return response;
      // A Hacker News page this site has no rendering of.
      this.#openHost(`${REAL}${url.pathname}${url.search}`);
      return noContent();
    } catch (error) {
      const retry = guestText(url.pathname + url.search);
      if (error instanceof NotFound) return htmlResponse(404, this.#chrome({ title: "Not found", real: url.pathname + url.search, body: `<H3>Not found</H3><P>${guestText(error.message)}` }));
      if (error instanceof Upstream) return htmlResponse(502, this.#chrome({ title: "Hacker News error", real: url.pathname + url.search, body: `<H3>Hacker News could not be reached</H3><P>${guestText(error.message)}<P><A HREF="${retry}">Try again</A>` }));
      throw error;
    }
  }

  async #route(url) {
    const path = url.pathname;
    if (path.startsWith("/_real/")) {
      this.#openHost(`${REAL}${path.slice("/_real".length)}${url.search}`);
      return noContent();
    }
    if (path === "/_out") return this.#out(url);
    if (path in LISTS) return htmlResponse(200, await this.#listPage(url, ...LISTS[path]));
    if (path === "/item") return htmlResponse(200, await this.#itemPage(url));
    if (path === "/user") return htmlResponse(200, await this.#userPage(url));
    return undefined;
  }

  #out(url) {
    const target = url.searchParams.get("u");
    if (!/^https?:\/\//i.test(target ?? "")) throw new NotFound("That is not a web address.");
    this.#openHost(target);
    return noContent();
  }

  #outHref(target) {
    return `/_out?u=${encodeURIComponent(target)}`;
  }

  // ---------------------------------------------------------------- upstream

  /** One request per path for the TTL; a failed request is not remembered. */
  #get(path) {
    const url = `${API}${path}.json`;
    const cached = this.#responses.get(url);
    if (cached !== undefined && this.#now() - cached.at < this.#ttl) return cached.entry;
    const entry = (async () => {
      let res;
      try {
        res = await this.#fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (error) {
        throw new Upstream(`${url}: ${error.message}`);
      }
    })();
    this.#responses.set(url, { at: this.#now(), entry });
    entry.catch(() => {
      if (this.#responses.get(url)?.entry === entry) this.#responses.delete(url);
    });
    return entry;
  }

  /** The item, or null when Hacker News has none (it answers null for a removed one). */
  #load(id) {
    return this.#get(`/item/${id}`);
  }

  async #item(value) {
    if (!/^\d{1,12}$/.test(value ?? "")) throw new NotFound("There is no item with that id.");
    const item = await this.#load(value);
    if (!isLive(item)) throw new NotFound(`Hacker News has no item ${value}, or it was deleted.`);
    return item;
  }

  // ---------------------------------------------------------------- chrome

  /** The page around `body`: the orange bar with the sections and, last, the link to the real page. */
  #chrome({ title, real, body }) {
    const bar = (label, path) => `<A HREF="${path}"><FONT COLOR="#000000">${label}</FONT></A>`;
    const sections = NAV.map(([label, path]) => bar(label, path)).join(" | ");
    return `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
<HTML>
<HEAD>
<TITLE>${guestText(title)}</TITLE>
</HEAD>
<BODY BGCOLOR="#F6F6EF" TEXT="#000000" LINK="#0000CC" VLINK="#828282" ALINK="#FF0000">
<TABLE WIDTH="100%" BORDER="0" CELLPADDING="3" CELLSPACING="0" BGCOLOR="#FF6600">
<TR>
<TD><FONT SIZE="-1"><B>${bar("Hacker News", "/")}</B> &nbsp; ${sections} | <A HREF="${realLink("/submit")}"><FONT COLOR="#000000">submit</FONT></A></FONT></TD>
<TD ALIGN="RIGHT"><FONT SIZE="-1"><A HREF="${realLink("/login")}"><FONT COLOR="#000000">login</FONT></A></FONT></TD>
</TR>
</TABLE>
${body}
<HR SIZE="1">
<FONT SIZE="-2" COLOR="#828282">Built in your browser from the Hacker News API. <A HREF="${guestText(realLink(real))}">View on real Hacker News</A>. Not affiliated with Y Combinator.</FONT>
</BODY>
</HTML>`;
  }

  /** The line under a title or comment: points, author, age, and the comments link. */
  #subtext(item, { comments }) {
    const parts = [];
    if (item.score !== undefined) parts.push(`${formatCount(item.score)} point${item.score === 1 ? "" : "s"} by`);
    if (item.by !== undefined) parts.push(`<A HREF="${userHref(item.by)}">${guestText(item.by)}</A>`);
    parts.push(formatAge(item.time, this.#now()));
    let line = parts.join(" ");
    if (comments && item.type !== "job") {
      const n = item.descendants ?? 0;
      line += ` | <A HREF="${itemHref(item.id)}">${n === 0 ? "discuss" : `${formatCount(n)} comment${n === 1 ? "" : "s"}`}</A>`;
    }
    return line;
  }

  #storyTitle(item) {
    const target = item.url === undefined ? itemHref(item.id) : this.#outHref(item.url);
    const domain = domainOf(item.url);
    return `<A HREF="${guestText(target)}">${guestText(item.title)}</A>${domain === undefined ? "" : ` <FONT SIZE="-2">(${guestText(domain)})</FONT>`}`;
  }

  #text(html) {
    return renderHtml(html, this.#links);
  }

  // ---------------------------------------------------------------- pages

  async #listPage(url, list, heading) {
    const page = pageNumber(url.searchParams.get("p"));
    const { ids, pages } = slicePage(await this.#get(`/${list}`), page, LIST_PAGE);
    const items = await Promise.all(ids.map((id) => this.#load(id)));
    const first = (page - 1) * LIST_PAGE;
    const rows = items
      .map((item, i) => [item, first + i + 1])
      .filter(([item]) => isLive(item))
      .map(([item, rank]) => `<TR><TD ALIGN="RIGHT" VALIGN="TOP"><FONT SIZE="-1">${rank}.</FONT></TD><TD>${this.#storyTitle(item)}<BR><FONT SIZE="-2">${this.#subtext(item, { comments: true })}</FONT></TD></TR>`)
      .join("\n");
    const link = (n, label) => `<A HREF="${guestText(`${url.pathname}?p=${n}`)}">${label}</A>`;
    return this.#chrome({
      title: `${heading} | Hacker News`,
      real: url.pathname,
      body: `<TABLE WIDTH="100%" BORDER="0" CELLPADDING="2" CELLSPACING="0">
${rows}
</TABLE>
${pager(link, page, pages, "Stories")}`,
    });
  }

  async #itemPage(url) {
    const item = await this.#item(url.searchParams.get("id"));
    const page = pageNumber(url.searchParams.get("p"));
    const { ids, pages } = slicePage(item.kids ?? [], page, TOP_COMMENTS_PER_PAGE);
    const [thread, options] = await Promise.all([
      loadThread(ids, COMMENT_BUDGET, (id) => this.#load(id)),
      Promise.all((item.parts ?? []).map((id) => this.#load(id))),
    ]);
    const link = (n, label) => `<A HREF="${itemHref(item.id)}&amp;p=${n}">${label}</A>`;
    const real = `/item?id=${item.id}`;
    return this.#chrome({
      title: `${item.title ?? `Comment by ${item.by}`} | Hacker News`,
      real,
      body: `${this.#itemHeader(item)}${this.#pollOptions(options)}
<P><FONT SIZE="-1"><A HREF="${realLink(`/reply?id=${item.id}`)}">add comment</A></FONT>
${this.#comments(thread)}
${pager(link, page, pages, "Comments")}`,
    });
  }

  #itemHeader(item) {
    const text = item.text === undefined ? "" : `<BLOCKQUOTE>${this.#text(item.text)}</BLOCKQUOTE>`;
    if (item.title === undefined) {
      const parent = item.parent === undefined ? "" : ` | <A HREF="${itemHref(item.parent)}">parent</A>`;
      return `<P><FONT SIZE="-1">${this.#subtext(item, { comments: false })}${parent}</FONT>${text}`;
    }
    return `<P><FONT SIZE="+1">${this.#storyTitle(item)}</FONT><BR><FONT SIZE="-1">${this.#subtext(item, { comments: true })}</FONT>${text}`;
  }

  #pollOptions(options) {
    const rows = options
      .filter(isLive)
      .map((option) => `<LI>${this.#text(option.text)} <FONT SIZE="-1">(${formatCount(option.score)} point${option.score === 1 ? "" : "s"})</FONT>`)
      .join("\n");
    return rows === "" ? "" : `<UL>\n${rows}\n</UL>`;
  }

  /** The comments as nested lists; a reply that was not fetched is counted with a link to its parent's page. */
  #comments(thread) {
    let depth = 0;
    let out = "";
    for (const { node, depth: level } of flatten(thread)) {
      out += indentTags(depth, level);
      depth = level;
      const { item, cut } = node;
      const more = cut === 0 ? "" : `<BR><FONT SIZE="-1"><A HREF="${itemHref(item.id)}">${formatCount(cut)} more repl${cut === 1 ? "y" : "ies"}</A></FONT>`;
      out += `<LI><FONT SIZE="-1"><B><A HREF="${userHref(item.by)}">${guestText(item.by)}</A></B> <A HREF="${itemHref(item.id)}">${formatAge(item.time, this.#now())}</A></FONT><BR>${this.#text(item.text ?? "")}${more}\n`;
    }
    return out + indentTags(depth, 0);
  }

  async #userPage(url) {
    const id = url.searchParams.get("id");
    const user = id === null ? null : await this.#get(`/user/${encodeURIComponent(id)}`);
    if (user === null) throw new NotFound(`Hacker News has no user ${id ?? ""}.`);
    const row = (label, value) => `<TR><TD VALIGN="TOP">${label}:</TD><TD>${value}</TD></TR>`;
    const about = user.about === undefined ? "" : row("about", this.#text(user.about));
    const links = ["submitted", "threads", "favorites"].map((view) => `<A HREF="${guestText(realLink(`/${view}?id=${encodeURIComponent(user.id)}`))}">${view}</A>`).join(" | ");
    return this.#chrome({
      title: `Profile: ${user.id} | Hacker News`,
      real: `/user?id=${encodeURIComponent(user.id)}`,
      body: `<TABLE BORDER="0" CELLPADDING="2" CELLSPACING="0">
${row("user", `<B>${guestText(user.id)}</B>`)}
${row("created", formatDate(new Date(user.created * 1000).toISOString()))}
${row("karma", formatCount(user.karma))}
${about}
${row("see", links)}
</TABLE>`,
    });
  }
}
