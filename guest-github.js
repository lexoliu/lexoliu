// http://github.com/ inside Netscape Navigator 3.0: a 1997-style browser for any public GitHub
// repository, rendered here (in the visitor's browser) from GitHub's API and raw.githubusercontent.com
// as HTML 3.2, the way main.js answers http://lexo.cool/ from guest-pages.js.
//
// Routes (the guest's paths mirror GitHub's):
//   /                            start page
//   /OWNER                       profile and repository list      ?page=N
//   /OWNER/REPO                  description, files, README
//   /OWNER/REPO/tree/REF/PATH    directory                         ?page=N
//   /OWNER/REPO/blob/REF/PATH    file, highlighted or rendered     ?page=N ?L=LINE ?plain=1
//   /_icons/NAME.jpg, /_img?u=URL&w=WIDTH, /_go?q=..., /_real/PATH (opens github.com/PATH in the host browser)
// Anything else on github.com (issues, pulls, ...) opens on the real GitHub in the host browser.
import { Highlighter, HIGHLIGHT_MAX_CHARS, plainLines } from "./guest-highlight.js";
import { ICON_SIZE, canvasJpeg, iconBytes } from "./guest-icons.js";
import { mailRoute, renderMarkdown } from "./guest-markdown.js";
import { encodePath, formatBytes, formatCount, formatDate, guestText } from "./guest-text.js";

const SITE = "http://github.com";
const REAL = "https://github.com";
const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
/** Source lines per page: Netscape on the emulated CPU is slow with large pages. */
export const PAGE_LINES = 400;
/** Directory entries per page. */
const DIR_PAGE = 100;
/** Repositories per page of an owner. */
const REPO_PAGE = 30;
/** Largest text file shown; larger ones are listed with their size. */
const MAX_VIEW_BYTES = 1_000_000;
const MAX_README_BYTES = 300_000;
const MAX_IMAGE_BYTES = 8_000_000;
/** Widest image the guest is sent, in pixels. */
const MAX_IMAGE_WIDTH = 600;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|bmp|webp|svg|ico)$/i;
const MARKDOWN_EXTENSIONS = /\.(md|markdown|mdown)$/i;
const README_NAME = /^readme(\.(md|markdown|mdown|txt|rst))?$/i;
const FEATURED = [
  ["lexoliu", "Lexo Liu"],
  ["water-rs/waterui", "WaterUI, a cross-platform GUI kit in Rust"],
  ["May-Agent/may", "May"],
  ["zen-rs/skyzen", "Skyzen, an HTTP framework in Rust"],
  ["rust-lang/rust", "The Rust programming language"],
];

class RateLimited extends Error {
  /** `reset` is the epoch second the limit resets at, or undefined when GitHub did not say. */
  constructor(reset) {
    super("GitHub API rate limit reached");
    this.reset = reset;
  }
}

class NotFound extends Error {}

class Upstream extends Error {}

const href = (path) => `${SITE}${path}`;
const realLink = (path) => href(`/_real${path}`);

/** The width of a number's decimal digits. */
const digits = (n) => String(n).length;

export class GitHubSite {
  #fetch;
  #openHost;
  #highlighter;
  #now;
  /** In-memory for the session: API/raw responses and rendered pages, by URL. */
  #responses = new Map();
  #pages = new Map();
  #trees = new Map();
  #tokens = new Map();

  /**
   * `fetch` is the host browser's; `openHost(url)` opens a URL in the visitor's browser (the page's
   * existing mechanism for links off the guest's site).
   */
  constructor({ fetch, openHost, highlighter = new Highlighter(), now = () => Date.now() }) {
    this.#fetch = fetch;
    this.#openHost = openHost;
    this.#highlighter = highlighter;
    this.#now = now;
  }

  /** Answers the guest's request for a URL on github.com. */
  async handle(url) {
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    try {
      const response = await this.#route(url, segments);
      if (response !== undefined) return response;
      // A GitHub page this site has no rendering of.
      this.#openHost(`${REAL}${url.pathname}${url.search}`);
      return new Response(null, { status: 204, statusText: "No Content" });
    } catch (error) {
      if (error instanceof RateLimited) return this.#html(200, this.#rateLimitPage(url, error));
      if (error instanceof NotFound) return this.#html(404, this.#chrome({ title: "Not found", real: url.pathname, crumbs: [], body: `<H2>Not found</H2><P>${guestText(error.message)}` }));
      if (error instanceof Upstream) return this.#html(502, this.#chrome({ title: "GitHub error", real: url.pathname, crumbs: [], body: `<H2>GitHub could not be reached</H2><P>${guestText(error.message)}<P><A HREF="${guestText(url.pathname + url.search)}">Try again</A>` }));
      throw error;
    }
  }

  async #route(url, segments) {
    const [owner, repo, kind] = segments;
    const first = owner;
    if (first === "_icons") return this.#icon(segments[1]);
    if (first === "_img") return this.#image(url);
    if (first === "_real") {
      this.#openHost(`${REAL}${url.pathname.slice("/_real".length)}${url.search}`);
      return new Response(null, { status: 204, statusText: "No Content" });
    }
    if (first === "_go") return this.#go(url);
    if (segments.length === 0) return this.#cached(url, () => this.#startPage());
    if (segments.length === 1) return this.#cached(url, () => this.#ownerPage(url, owner));
    if (segments.length === 2) return this.#cached(url, () => this.#repoPage(url, owner, repo));
    if ((kind === "tree" || kind === "blob") && segments.length >= 4) return this.#cached(url, () => this.#pathPage(url, owner, repo, kind, segments.slice(3)));
    return undefined;
  }

  #html(status, html) {
    const bytes = new TextEncoder().encode(html);
    return new Response(bytes, {
      status,
      statusText: status === 200 ? "OK" : status === 404 ? "Not Found" : "Error",
      headers: { "Content-Type": "text/html", "Content-Length": String(bytes.byteLength) },
    });
  }

  /** A rendered page is built once per URL for the session. */
  async #cached(url, render) {
    const key = `${url.pathname}${url.search}`;
    let html = this.#pages.get(key);
    if (html === undefined) {
      html = await render();
      this.#pages.set(key, html);
    }
    return this.#html(200, html);
  }

  // ---------------------------------------------------------------- upstream

  /** One request per URL for the session; failures other than 404 are not remembered. */
  #get(url, read) {
    let entry = this.#responses.get(url);
    if (entry === undefined) {
      entry = (async () => {
        let res;
        try {
          res = await this.#fetch(url);
        } catch (error) {
          throw new Upstream(`${url}: ${error.message}`);
        }
        if (res.status === 404) throw new NotFound(`GitHub has no ${url.replace(/^https:\/\//, "")}.`);
        const remaining = res.headers.get("x-ratelimit-remaining");
        if ((res.status === 403 && remaining === "0") || res.status === 429) {
          const reset = Number(res.headers.get("x-ratelimit-reset"));
          const retryAfter = Number(res.headers.get("retry-after"));
          throw new RateLimited(reset > 0 ? reset : retryAfter > 0 ? Math.floor(this.#now() / 1000) + retryAfter : undefined);
        }
        if (!res.ok) throw new Upstream(`${url}: HTTP ${res.status}`);
        return read(res);
      })();
      this.#responses.set(url, entry);
      entry.catch((error) => {
        if (!(error instanceof NotFound)) this.#responses.delete(url);
      });
    }
    return entry;
  }

  #json(path) {
    return this.#get(`${API}${path}`, (res) => res.json());
  }

  #raw(owner, repo, ref, path) {
    return this.#get(`${RAW}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${encodePath(path.split("/"))}`, async (res) => new Uint8Array(await res.arrayBuffer()));
  }

  #meta(owner, repo) {
    return this.#json(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  }

  /** The repository's recursive git tree at `ref`, indexed by directory. One request per repository ref. */
  async #tree(owner, repo, ref) {
    const key = `${owner}/${repo}@${ref}`;
    let tree = this.#trees.get(key);
    if (tree === undefined) {
      tree = this.#json(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`).then((data) => {
        const dirs = new Map([["", []]]);
        for (const entry of data.tree) {
          const slash = entry.path.lastIndexOf("/");
          const parent = slash === -1 ? "" : entry.path.slice(0, slash);
          const type = entry.type === "tree" ? "dir" : entry.type === "commit" ? "submodule" : "file";
          if (!dirs.has(parent)) dirs.set(parent, []);
          dirs.get(parent).push({ name: entry.path.slice(slash + 1), type, size: entry.size ?? 0 });
          if (type === "dir" && !dirs.has(entry.path)) dirs.set(entry.path, []);
        }
        return { truncated: data.truncated, dirs };
      });
      this.#trees.set(key, tree);
      tree.catch(() => this.#trees.delete(key));
    }
    return tree;
  }

  /** The entries of directory `path` ({name, type: dir|file|submodule, size}), from the tree or, when GitHub truncated it, the contents API. */
  async #listDir(owner, repo, ref, path) {
    const tree = await this.#tree(owner, repo, ref);
    if (!tree.truncated) {
      const entries = tree.dirs.get(path);
      if (entries === undefined) throw new NotFound(`${owner}/${repo} has no directory ${path} at ${ref}.`);
      return entries;
    }
    const items = await this.#json(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path === "" ? [] : path.split("/"))}?ref=${encodeURIComponent(ref)}`);
    if (!Array.isArray(items)) throw new NotFound(`${path} is not a directory.`);
    return items.map((item) => ({ name: item.name, type: item.type === "dir" ? "dir" : item.type === "submodule" ? "submodule" : "file", size: item.size ?? 0 }));
  }

  /** What `path` is at `ref`: {name, type, size}, found through its parent directory. */
  async #stat(owner, repo, ref, path) {
    const slash = path.lastIndexOf("/");
    const entries = await this.#listDir(owner, repo, ref, slash === -1 ? "" : path.slice(0, slash));
    const entry = entries.find((e) => e.name === path.slice(slash + 1));
    if (entry === undefined) throw new NotFound(`${owner}/${repo} has no ${path} at ${ref}.`);
    return entry;
  }

  /**
   * Splits what follows tree/ or blob/ into the ref and the path. A branch name may hold slashes;
   * the default branch is recognised as a whole, any other ref is the first segment.
   */
  async #refAndPath(owner, repo, rest) {
    const meta = await this.#meta(owner, repo);
    const def = meta.default_branch.split("/");
    if (def.length > 1 && def.every((part, i) => rest[i] === part)) return { meta, ref: meta.default_branch, path: rest.slice(def.length).join("/") };
    return { meta, ref: rest[0], path: rest.slice(1).join("/") };
  }

  // ---------------------------------------------------------------- chrome

  /** The page around `body`: a navy title bar, a gray toolbar with the breadcrumb and the link to the real page. */
  #chrome({ title, crumbs, real, body }) {
    const trail = crumbs.map(([label, link]) => (link === null ? `<B>${guestText(label)}</B>` : `<A HREF="${guestText(link)}">${guestText(label)}</A>`)).join(" / ");
    return `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
<HTML>
<HEAD>
<TITLE>${guestText(title)}</TITLE>
</HEAD>
<BODY BGCOLOR="#FFFFFF" TEXT="#000000" LINK="#0000CC" VLINK="#551A8B" ALINK="#FF0000">
<TABLE WIDTH="100%" BORDER="0" CELLPADDING="4" CELLSPACING="0" BGCOLOR="#000080">
<TR>
<TD><A HREF="${SITE}/"><FONT COLOR="#FFFFFF" SIZE="+2"><B>GitHub</B></FONT></A> <FONT COLOR="#C0C0C0" SIZE="-1">Source Code Browser for Netscape 3.0</FONT></TD>
<TD ALIGN="RIGHT"><FONT COLOR="#FFFF00" SIZE="-1"><B>[Best viewed at 1024x768]</B></FONT></TD>
</TR>
</TABLE>
<TABLE WIDTH="100%" BORDER="0" CELLPADDING="3" CELLSPACING="0" BGCOLOR="#C0C0C0">
<TR>
<TD><FONT SIZE="-1">[ <A HREF="${SITE}/">Home</A> ] [ <A HREF="http://lexo.cool/">lexo.cool</A> ] ${trail === "" ? "" : `&nbsp; ${trail}`}</FONT></TD>
<TD ALIGN="RIGHT" NOWRAP><FONT SIZE="-1">[ <A HREF="${realLink(real)}"><B>View on real GitHub</B></A> ]</FONT></TD>
</TR>
</TABLE>
${body}
<HR>
<FONT SIZE="-2" COLOR="#555555">Built in your browser from api.github.com and raw.githubusercontent.com, and kept for this session. Not affiliated with GitHub.</FONT>
</BODY>
</HTML>`;
  }

  async #icon(name) {
    const bytes = await iconBytes(name);
    if (bytes === undefined) throw new NotFound(`No icon ${name}.`);
    return new Response(bytes, { status: 200, statusText: "OK", headers: { "Content-Type": "image/jpeg", "Content-Length": String(bytes.byteLength) } });
  }

  #iconTag(name, alt) {
    return `<IMG SRC="${href(`/_icons/${name}.jpg`)}" WIDTH="${ICON_SIZE}" HEIGHT="${ICON_SIZE}" ALT="${alt}" BORDER="0" ALIGN="ABSMIDDLE">`;
  }

  /** The Star button and its count: a Win95 push button, then the number in a sunken cell. */
  #starButton(meta) {
    return `<TABLE BORDER="0" CELLPADDING="0" CELLSPACING="0"><TR>
<TD><TABLE BORDER="2" CELLPADDING="3" CELLSPACING="0"><TR><TD BGCOLOR="#C0C0C0"><A HREF="${realLink(`/${encodePath([meta.owner.login, meta.name])}`)}">${this.#iconTag("star", "*")} <B>Star</B></A></TD></TR></TABLE></TD>
<TD><TABLE BORDER="2" CELLPADDING="3" CELLSPACING="0"><TR><TD BGCOLOR="#FFFFFF"><B>${formatCount(meta.stargazers_count)}</B></TD></TR></TABLE></TD>
</TR></TABLE>`;
  }

  #pager(path, query, page, pages, what) {
    if (pages <= 1) return "";
    const link = (n, label) => `<A HREF="${guestText(`${href(path)}?${new URLSearchParams({ ...query, page: String(n) })}`)}">${label}</A>`;
    const parts = [
      page > 1 ? link(1, "&laquo; First") : "&laquo; First",
      page > 1 ? link(page - 1, "&lt; Previous") : "&lt; Previous",
      `<B>${what} page ${page} of ${pages}</B>`,
      page < pages ? link(page + 1, "Next &gt;") : "Next &gt;",
      page < pages ? link(pages, "Last &raquo;") : "Last &raquo;",
    ];
    return `<P><FONT SIZE="-1">[ ${parts.join(" ] [ ")} ]</FONT>`;
  }

  // ---------------------------------------------------------------- pages

  #startPage() {
    const items = FEATURED.map(([path, text]) => `<LI><A HREF="${href(`/${path}`)}"><B>${guestText(path)}</B></A> - ${guestText(text)}`).join("\n");
    return this.#chrome({
      title: "GitHub - Source Code Browser",
      real: "/",
      crumbs: [],
      body: `<H1>GitHub</H1>
<P>Browse any public GitHub repository without leaving Netscape. Enter an owner, or <TT>owner/repository</TT>:
<FORM ACTION="${href("/_go")}" METHOD="GET">
<INPUT TYPE="text" NAME="q" SIZE="36"> <INPUT TYPE="submit" VALUE="Go">
</FORM>
<P><B>Start with:</B>
<UL>
${items}
</UL>`,
    });
  }

  /** The start page's form: an owner, owner/repository, or any path or github.com URL the routes answer. */
  async #go(url) {
    const query = (url.searchParams.get("q") ?? "").trim().replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "");
    const target = new URL(`${SITE}/${query.replace(/^\/+/, "")}`);
    const segments = target.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (segments.length === 0 || segments[0].startsWith("_")) {
      return this.#html(404, this.#chrome({ title: "Not found", real: "/", crumbs: [], body: `<H2>Enter an owner or owner/repository</H2><P><A HREF="${SITE}/">Back</A>` }));
    }
    return (await this.#route(target, segments)) ?? this.#html(404, this.#chrome({ title: "Not found", real: "/", crumbs: [], body: `<H2>No such page</H2><P><A HREF="${SITE}/">Back</A>` }));
  }

  async #ownerPage(url, owner) {
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const user = await this.#json(`/users/${encodeURIComponent(owner)}`);
    const repos = await this.#json(`/users/${encodeURIComponent(owner)}/repos?per_page=${REPO_PAGE}&page=${page}&sort=pushed`);
    const pages = Math.ceil(user.public_repos / REPO_PAGE);
    const facts = [
      user.company && ["Company", guestText(user.company)],
      user.location && ["Location", guestText(user.location)],
      user.blog && ["Web", guestText(user.blog)],
      ["Followers", formatCount(user.followers)],
      user.type === "User" && ["Following", formatCount(user.following)],
      ["Joined", formatDate(user.created_at)],
    ].filter(Boolean);
    const rows = repos
      .map(
        (r) => `<TR>
<TD VALIGN="TOP">${this.#iconTag("folder", "")}</TD>
<TD VALIGN="TOP"><A HREF="${href(`/${encodePath([r.owner.login, r.name])}`)}"><B>${guestText(r.name)}</B></A>${r.fork ? ' <FONT SIZE="-1" COLOR="#555555">(fork)</FONT>' : ""}${r.archived ? ' <FONT SIZE="-1" COLOR="#CC0000">(archived)</FONT>' : ""}<BR>${guestText(r.description ?? "")}</TD>
<TD VALIGN="TOP"><FONT SIZE="-1">${guestText(r.language ?? "")}</FONT></TD>
<TD VALIGN="TOP" ALIGN="RIGHT">${this.#iconTag("star", "stars")} ${formatCount(r.stargazers_count)}</TD>
<TD VALIGN="TOP"><FONT SIZE="-1">${formatDate(r.pushed_at ?? r.updated_at)}</FONT></TD>
</TR>`
      )
      .join("\n");
    const login = user.login;
    return this.#chrome({
      title: `${login} - GitHub`,
      real: `/${encodePath([login])}`,
      crumbs: [[login, null]],
      body: `<TABLE WIDTH="100%" BORDER="0" CELLPADDING="6" CELLSPACING="0"><TR>
<TD WIDTH="72" VALIGN="TOP"><IMG SRC="${href(`/_img?w=64&u=${encodeURIComponent(user.avatar_url)}`)}" WIDTH="64" HEIGHT="64" ALT="${guestText(login)}" BORDER="1"></TD>
<TD VALIGN="TOP"><FONT SIZE="+2"><B>${guestText(user.name ?? login)}</B></FONT> <FONT COLOR="#555555">${guestText(login)}${user.type === "Organization" ? " (organization)" : ""}</FONT>
${user.bio ? `<BR>${guestText(user.bio)}` : ""}
<BR><FONT SIZE="-1">${facts.map(([k, v]) => `<B>${k}:</B> ${v}`).join(" &nbsp;|&nbsp; ")}</FONT></TD>
</TR></TABLE>
<H3>Repositories (${formatCount(user.public_repos)})</H3>
<TABLE WIDTH="100%" BORDER="1" CELLPADDING="4" CELLSPACING="0">
<TR BGCOLOR="#C0C0C0"><TH WIDTH="24">&nbsp;</TH><TH ALIGN="LEFT">Repository</TH><TH ALIGN="LEFT">Language</TH><TH ALIGN="RIGHT">Stars</TH><TH ALIGN="LEFT">Pushed</TH></TR>
${rows}
</TABLE>
${this.#pager(`/${encodePath([login])}`, {}, page, pages, "Repositories")}`,
    });
  }

  /** The repository header every repository page starts with. */
  #repoHeader(meta, ref, path) {
    const base = `/${encodePath([meta.owner.login, meta.name])}`;
    const tail = path === "" ? [] : path.split("/");
    const trail = [`<A HREF="${href(base)}"><B>${guestText(meta.name)}</B></A>`];
    tail.forEach((part, i) => {
      const last = i === tail.length - 1;
      trail.push(last ? `<B>${guestText(part)}</B>` : `<A HREF="${href(`${base}/tree/${encodePath([ref])}/${encodePath(tail.slice(0, i + 1))}`)}">${guestText(part)}</A>`);
    });
    const topics = (meta.topics ?? []).map((t) => `[${guestText(t)}]`).join(" ");
    const facts = [
      meta.language && `<B>Language:</B> ${guestText(meta.language)}`,
      `<B>Branch:</B> ${guestText(ref)}`,
      `<B>Forks:</B> ${formatCount(meta.forks_count)}`,
      meta.license?.spdx_id && meta.license.spdx_id !== "NOASSERTION" && `<B>License:</B> ${guestText(meta.license.spdx_id)}`,
      `<B>Pushed:</B> ${formatDate(meta.pushed_at)}`,
    ].filter(Boolean);
    return `<TABLE WIDTH="100%" BORDER="0" CELLPADDING="4" CELLSPACING="0"><TR>
<TD VALIGN="TOP"><FONT SIZE="+2"><A HREF="${href(`/${encodePath([meta.owner.login])}`)}">${guestText(meta.owner.login)}</A> / ${trail.join(" / ")}</FONT>${meta.archived ? ' <FONT COLOR="#CC0000">(archived)</FONT>' : ""}
${meta.description ? `<BR>${guestText(meta.description)}` : ""}${meta.homepage ? `<BR><FONT SIZE="-1">${guestText(meta.homepage)}</FONT>` : ""}
${topics ? `<BR><FONT SIZE="-1" COLOR="#555555">${topics}</FONT>` : ""}
<BR><FONT SIZE="-1">${facts.join(" &nbsp;|&nbsp; ")}</FONT></TD>
<TD VALIGN="TOP" ALIGN="RIGHT" WIDTH="150">${this.#starButton(meta)}</TD>
</TR></TABLE>`;
  }

  async #repoPage(url, owner, repo) {
    const meta = await this.#meta(owner, repo);
    return this.#directoryPage(url, meta, meta.default_branch, "");
  }

  async #pathPage(url, owner, repo, kind, rest) {
    const { meta, ref, path } = await this.#refAndPath(owner, repo, rest);
    if (path === "") return this.#directoryPage(url, meta, ref, "");
    const entry = await this.#stat(owner, repo, ref, path);
    if (entry.type === "dir") return this.#directoryPage(url, meta, ref, path);
    if (kind === "tree") throw new NotFound(`${path} is a file, not a directory.`);
    return this.#filePage(url, meta, ref, path, entry);
  }

  async #directoryPage(url, meta, ref, path) {
    const owner = meta.owner.login;
    const base = `/${encodePath([owner, meta.name])}`;
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const entries = (await this.#listDir(owner, meta.name, ref, path)).slice().sort((a, b) => (a.type === "file") - (b.type === "file") || a.name.localeCompare(b.name));
    const pages = Math.max(1, Math.ceil(entries.length / DIR_PAGE));
    const slice = entries.slice((page - 1) * DIR_PAGE, page * DIR_PAGE);
    const here = path === "" ? [] : path.split("/");
    const rows = [];
    if (here.length > 0) {
      const parent = here.slice(0, -1);
      rows.push(`<TR><TD>${this.#iconTag("folder", "")}</TD><TD COLSPAN="2"><A HREF="${href(parent.length === 0 ? base : `${base}/tree/${encodePath([ref])}/${encodePath(parent)}`)}"><B>..</B></A></TD></TR>`);
    }
    for (const e of slice) {
      const child = [...here, e.name];
      const target = e.type === "dir" ? href(`${base}/tree/${encodePath([ref])}/${encodePath(child)}`) : e.type === "file" ? href(`${base}/blob/${encodePath([ref])}/${encodePath(child)}`) : undefined;
      const name = target === undefined ? `${guestText(e.name)} <FONT SIZE="-1" COLOR="#555555">(submodule)</FONT>` : `<A HREF="${target}">${e.type === "dir" ? `<B>${guestText(e.name)}</B>` : guestText(e.name)}</A>`;
      rows.push(`<TR><TD>${this.#iconTag(e.type === "file" ? "file" : "folder", "")}</TD><TD>${name}</TD><TD ALIGN="RIGHT"><FONT SIZE="-1">${e.type === "file" ? formatBytes(e.size) : ""}</FONT></TD></TR>`);
    }
    const readme = entries.find((e) => e.type === "file" && README_NAME.test(e.name));
    const readmeHtml = readme === undefined ? "" : await this.#readme(owner, meta.name, ref, here, readme);
    const real = path === "" ? (ref === meta.default_branch ? base : `${base}/tree/${encodePath([ref])}`) : `${base}/tree/${encodePath([ref])}/${encodePath(here)}`;
    return this.#chrome({
      title: `${owner}/${meta.name}${path === "" ? "" : `/${path}`} - GitHub`,
      real,
      crumbs: [[owner, href(`/${encodePath([owner])}`)], [meta.name, path === "" ? null : href(base)], ...(path === "" ? [] : [[path, null]])],
      body: `${this.#repoHeader(meta, ref, path)}
<TABLE WIDTH="100%" BORDER="1" CELLPADDING="3" CELLSPACING="0">
<TR BGCOLOR="#C0C0C0"><TH WIDTH="24">&nbsp;</TH><TH ALIGN="LEFT" WIDTH="80%">Name</TH><TH ALIGN="RIGHT" WIDTH="15%">Size</TH></TR>
${rows.join("\n")}
</TABLE>
${this.#pager(url.pathname, {}, page, pages, "Files")}
${readmeHtml}`,
    });
  }

  /** The README section of a directory page; a README that cannot be fetched or is too large is just linked. */
  async #readme(owner, repo, ref, dir, entry) {
    const path = [...dir, entry.name].join("/");
    const base = `/${encodePath([owner, repo])}`;
    const fileLink = href(`${base}/blob/${encodePath([ref])}/${encodePath(path.split("/"))}`);
    const head = (note) => `<P><TABLE WIDTH="100%" BORDER="1" CELLPADDING="3" CELLSPACING="0"><TR><TD BGCOLOR="#C0C0C0"><B>${guestText(entry.name)}</B> <FONT SIZE="-1">${note}</FONT></TD></TR></TABLE>`;
    if (entry.size > MAX_README_BYTES) return `${head(`(${formatBytes(entry.size)}, too large to show here)`)}<P><A HREF="${fileLink}">Open ${guestText(entry.name)}</A>`;
    const text = new TextDecoder().decode(await this.#raw(owner, repo, ref, path));
    return `${head("")}<TABLE WIDTH="100%" BORDER="0" CELLPADDING="8" CELLSPACING="0"><TR><TD>${await this.#markdownBody(text, entry.name, { owner, repo, ref, dir })}</TD></TR></TABLE>`;
  }

  async #markdownBody(text, name, ctx) {
    if (!MARKDOWN_EXTENSIONS.test(name)) return `<PRE>${plainLines(text.replace(/\r\n?/g, "\n")).join("\n")}</PRE>`;
    return this.#markdown(text, ctx);
  }

  /** Markdown as HTML 3.2, its fenced code blocks highlighted like source pages. */
  #markdown(text, ctx) {
    return renderMarkdown(text, this.#links(ctx), async (code, name) => {
      if (code.length > HIGHLIGHT_MAX_CHARS) return undefined;
      const lang = await this.#highlighter.languageNamed(name);
      return lang === undefined ? undefined : this.#highlighter.lines(code, lang);
    });
  }

  /** How a README's links and images map to the guest: GitHub routes inside the repository, raw files for images. */
  #links({ owner, repo, ref, dir }) {
    const base = `/${encodePath([owner, repo])}`;
    const here = new URL(`http://repo.invalid/${dir.map(encodeURIComponent).join("/")}${dir.length ? "/" : ""}`);
    const inRepo = (target) => {
      const resolved = new URL(target, here);
      const path = resolved.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      return { path, rest: `${resolved.search}${resolved.hash}` };
    };
    const external = (u) => {
      if (u.hostname === "github.com" || u.hostname === "www.github.com") return `${SITE}${u.pathname}${u.search}${u.hash}`;
      return `http://${u.host}${u.pathname}${u.search}${u.hash}`;
    };
    return {
      link: (target) => {
        target = target.trim();
        if (target.startsWith("#")) return target;
        const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(target)?.[1]?.toLowerCase();
        if (scheme === "mailto") return mailRoute(target.slice("mailto:".length).split("?")[0]);
        if (scheme === "http" || scheme === "https") return external(new URL(target));
        if (scheme !== undefined) return undefined;
        if (target.startsWith("//")) return external(new URL(`https:${target}`));
        const { path, rest } = inRepo(target);
        return href(path.length === 0 ? `${base}${rest}` : `${base}/blob/${encodePath([ref])}/${encodePath(path)}${rest}`);
      },
      image: (target, width) => {
        target = target.trim();
        const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(target)?.[1]?.toLowerCase();
        let absolute;
        if (scheme === "http" || scheme === "https" || target.startsWith("//")) {
          const u = new URL(target.startsWith("//") ? `https:${target}` : target);
          const blob = /^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/.exec(u.pathname);
          absolute = (u.hostname === "github.com" || u.hostname === "www.github.com") && blob ? `${RAW}/${blob[1]}/${blob[2]}/${blob[3]}` : u.href;
        } else if (scheme === undefined) {
          const { path } = inRepo(target);
          absolute = `${RAW}/${encodePath([owner, repo, ref])}/${encodePath(path)}`;
        } else {
          return undefined;
        }
        return href(`/_img?w=${width}&u=${encodeURIComponent(absolute)}`);
      },
    };
  }

  async #filePage(url, meta, ref, path, entry) {
    const owner = meta.owner.login;
    const base = `/${encodePath([owner, meta.name])}`;
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    const here = `${base}/blob/${encodePath([ref])}/${encodePath(parts)}`;
    const dir = parts.slice(0, -1);
    const crumbs = [[owner, href(`/${encodePath([owner])}`)], [meta.name, href(base)], [path, null]];
    const page = (body) => this.#chrome({ title: `${path} - ${owner}/${meta.name}`, real: here, crumbs, body: `${this.#repoHeader(meta, ref, path)}${body}` });
    const bar = (extra) => `<TABLE WIDTH="100%" BORDER="1" CELLPADDING="3" CELLSPACING="0"><TR><TD BGCOLOR="#C0C0C0">${this.#iconTag("file", "")} <B>${guestText(name)}</B> <FONT SIZE="-1">&nbsp; ${extra}</FONT></TD></TR></TABLE>`;
    const rawUrl = `${RAW}/${encodePath([owner, meta.name, ref])}/${encodePath(parts)}`;

    if (IMAGE_EXTENSIONS.test(name) && entry.size <= MAX_IMAGE_BYTES) {
      return page(`${bar(formatBytes(entry.size))}<P><IMG SRC="${guestText(href(`/_img?w=${MAX_IMAGE_WIDTH}&u=${encodeURIComponent(rawUrl)}`))}" ALT="${guestText(name)}" BORDER="1">`);
    }
    if (entry.size > MAX_VIEW_BYTES) {
      return page(`${bar(formatBytes(entry.size))}<P>This file is ${formatBytes(entry.size)}, too large to show here. Use <B>View on real GitHub</B> above.`);
    }
    const bytes = await this.#raw(owner, meta.name, ref, path);
    if (bytes.subarray(0, 8000).includes(0)) {
      return page(`${bar(formatBytes(bytes.length))}<P>Binary file, ${formatBytes(bytes.length)}. Use <B>View on real GitHub</B> above to download it.`);
    }
    const text = new TextDecoder().decode(bytes);
    const plain = url.searchParams.get("plain") === "1";
    if (MARKDOWN_EXTENSIONS.test(name) && !plain) {
      return page(`${bar(`${formatBytes(bytes.length)} &nbsp;|&nbsp; Rendered &nbsp;[ <A HREF="${guestText(`${href(here)}?plain=1`)}">Show source</A> ]`)}<TABLE WIDTH="100%" BORDER="0" CELLPADDING="8" CELLSPACING="0"><TR><TD>${await this.#markdown(text, { owner, repo: meta.name, ref, dir })}</TD></TR></TABLE>`);
    }

    const lines = (await this.#sourceLines(`${owner}/${meta.name}@${ref}:${path}`, text, path)).lines;
    const total = lines.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_LINES));
    const jump = Number(url.searchParams.get("L")) || undefined;
    const shown = Math.min(pages, Math.max(1, jump === undefined ? Number(url.searchParams.get("page")) || 1 : Math.ceil(jump / PAGE_LINES)));
    const first = (shown - 1) * PAGE_LINES;
    const width = digits(total);
    const body = lines
      .slice(first, first + PAGE_LINES)
      .map((html, i) => `<A NAME=L${first + i + 1}></A><FONT COLOR=#808080>${String(first + i + 1).padStart(width)}</FONT>  ${html}`)
      .join("\n");
    const go = pages > 1 ? `<FORM ACTION="${guestText(href(here))}" METHOD="GET"><FONT SIZE="-1">Go to line: <INPUT TYPE="text" NAME="L" SIZE="6"> <INPUT TYPE="submit" VALUE="Go"></FONT></FORM>` : "";
    const jumpNote = jump !== undefined && jump >= 1 && jump <= total ? `<P><FONT SIZE="-1">Line ${jump}: <A HREF="#L${jump}">jump to it</A></FONT>` : "";
    const pager = this.#pager(here, {}, shown, pages, `Lines ${first + 1}-${Math.min(total, first + PAGE_LINES)} of ${formatCount(total)},`);
    const kind = MARKDOWN_EXTENSIONS.test(name) ? `[ <A HREF="${guestText(href(here))}">Show rendered</A> ]` : "";
    return page(`${bar(`${formatCount(total)} lines &nbsp;|&nbsp; ${formatBytes(bytes.length)} ${kind}`)}${go}${jumpNote}${pager}<TABLE WIDTH="100%" BORDER="1" CELLPADDING="4" CELLSPACING="0"><TR><TD BGCOLOR="#FFFFFF"><PRE>${body}</PRE></TD></TR></TABLE>${pager}`);
  }

  /** The file's lines as HTML, highlighted when its language is known (Shiki loads here, on the first source page). */
  async #sourceLines(key, text, path) {
    let entry = this.#tokens.get(key);
    if (entry === undefined) {
      entry = (async () => {
        const normalized = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
        const lang = text.length <= HIGHLIGHT_MAX_CHARS ? await this.#highlighter.languageOf(path) : undefined;
        return { lines: lang === undefined ? plainLines(normalized) : await this.#highlighter.lines(normalized, lang) };
      })();
      this.#tokens.set(key, entry);
      entry.catch(() => this.#tokens.delete(key));
    }
    return entry;
  }

  #rateLimitPage(url, error) {
    const when = error.reset === undefined ? undefined : new Date(error.reset * 1000);
    const minutes = when === undefined ? undefined : Math.max(1, Math.ceil((when.getTime() - this.#now()) / 60000));
    return this.#chrome({
      title: "GitHub API limit reached",
      real: url.pathname,
      crumbs: [],
      body: `<H2>GitHub's API limit has been reached</H2>
<P>This browser asks GitHub's public API for everything it shows, and GitHub allows an anonymous visitor only 60 requests an hour. The limit is used up for now.
<P>${when === undefined ? "GitHub did not say when it resets; it usually resets within the hour." : `The limit resets at <B>${guestText(when.toLocaleTimeString())}</B>, in about <B>${minutes} minute${minutes === 1 ? "" : "s"}</B>.`}
<P>Pages already opened in this session still work. <A HREF="${guestText(url.pathname + url.search)}">Try again</A>, or use <B>View on real GitHub</B> above to read this page there.`,
    });
  }

  // ---------------------------------------------------------------- images

  /** An image for the guest: baseline JPEG (or the GIF itself when small), scaled to `w`. */
  async #image(url) {
    const source = url.searchParams.get("u");
    const width = Math.min(Number(url.searchParams.get("w")) || MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH);
    if (!/^https?:\/\//i.test(source ?? "")) throw new NotFound("No such image.");
    let entry = this.#responses.get(`image:${width}:${source}`);
    if (entry === undefined) {
      entry = this.#convertImage(source, width);
      this.#responses.set(`image:${width}:${source}`, entry);
      entry.catch(() => this.#responses.delete(`image:${width}:${source}`));
    }
    let image;
    try {
      image = await entry;
    } catch (error) {
      // A picture that cannot be fetched or decoded is a broken image in the guest, not a page error.
      console.warn(`image ${source}: ${error.message}`);
      return new Response(null, { status: 404, statusText: "Not Found" });
    }
    return new Response(image.bytes, { status: 200, statusText: "OK", headers: { "Content-Type": image.type, "Content-Length": String(image.bytes.byteLength) } });
  }

  async #convertImage(source, width) {
    const res = await this.#fetch(source);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error("image too large");
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
