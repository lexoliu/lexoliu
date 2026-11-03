// Syntax highlighting with Shiki, loaded the first time a source page is requested, with the
// grammar of the file's language only. Tokens come back as colors, which the page turns into
// <FONT COLOR>: Netscape Navigator 3.0 has no CSS.
import { expandTabs, guestText } from "./guest-text.js";

/** A light theme that reads on a white page. */
const THEME = "github-light";
/** Files above this many characters are shown plain: tokenizing them would stall the page. */
export const HIGHLIGHT_MAX_CHARS = 300_000;
/** Longer lines are cut, as no one reads them in a 1997 browser. */
const MAX_LINE_CHARS = 1000;
/** Names of files with no extension, or one that is not the language, -> Shiki language. */
const FILENAMES = { dockerfile: "docker", makefile: "makefile", "cargo.lock": "toml", "cmakelists.txt": "cmake", ".gitignore": "ini", ".gitattributes": "ini", ".editorconfig": "ini" };
/** Extensions that are not Shiki language names or aliases. */
const EXTENSIONS = { mjs: "js", cjs: "js", mts: "ts", cts: "ts", h: "c", hpp: "cpp", hh: "cpp", cc: "cpp", cxx: "cpp", mm: "objective-cpp", m: "objective-c", htm: "html", svg: "xml", plist: "xml", xcconfig: "ini", cfg: "ini", lock: "toml", gradle: "groovy", kts: "kotlin", pyi: "python" };

/** The Shiki language for a file path, or undefined when it is plain text. */
export function languageOf(path, languages) {
  const name = path.split("/").pop().toLowerCase();
  if (name in FILENAMES) return FILENAMES[name];
  const dot = name.lastIndexOf(".");
  if (dot === -1) return undefined;
  const ext = name.slice(dot + 1);
  const lang = EXTENSIONS[ext] ?? ext;
  return Object.hasOwn(languages, lang) ? lang : undefined;
}

export class Highlighter {
  #core;
  #languages;
  /** Language -> the promise of its grammar being loaded, so concurrent blocks load it once. */
  #loaded = new Map();

  /** Loads the engine, the theme and the language map; the grammars come per file. */
  async #ready() {
    this.#core ??= (async () => {
      const [{ createHighlighterCore }, { createOnigurumaEngine }, { bundledThemes }, { bundledLanguages }] = await Promise.all([
        import("shiki/core"),
        import("shiki/engine/oniguruma"),
        import("shiki/themes"),
        import("shiki/langs"),
      ]);
      this.#languages = bundledLanguages;
      return createHighlighterCore({ themes: [(await bundledThemes[THEME]()).default], langs: [], engine: createOnigurumaEngine(import("shiki/wasm")) });
    })();
    return this.#core;
  }

  /** The Shiki language for `path`, loading the language map if needed. */
  async languageOf(path) {
    await this.#ready();
    return languageOf(path, this.#languages);
  }

  /** The Shiki language a Markdown fence names (`rust`, `rs`, `sh`, ...), or undefined when it is none. */
  async languageNamed(name) {
    await this.#ready();
    const lang = name.toLowerCase();
    return Object.hasOwn(this.#languages, lang) ? lang : undefined;
  }

  /** `code` as lines of HTML 3.2 (text with <FONT COLOR>, <B>, <I>), tabs expanded and escaped. */
  async lines(code, lang) {
    const core = await this.#ready();
    if (!this.#loaded.has(lang)) this.#loaded.set(lang, (async () => core.loadLanguage((await this.#languages[lang]()).default))());
    await this.#loaded.get(lang);
    const foreground = core.getTheme(THEME).fg.toLowerCase();
    const rows = core.codeToTokensBase(code, { lang, theme: THEME });
    return rows.map((tokens) => {
      // Netscape on the emulated network reads about 5 KB/s, so the markup is kept small: a token
      // that is only blanks joins the span before it, and neighbours of one style become one span.
      const spans = [];
      let column = 0;
      for (const token of tokens) {
        let text = expandTabs(token.content, column);
        column += text.length;
        if (column > MAX_LINE_CHARS) text = text.slice(0, Math.max(0, text.length - (column - MAX_LINE_CHARS)));
        if (text === "") continue;
        const color = token.color && token.color.slice(0, 7).toLowerCase() !== foreground ? token.color.slice(0, 7).toLowerCase() : undefined;
        const fontStyle = token.fontStyle & 3;
        const last = spans[spans.length - 1];
        if (last !== undefined && ((last.color === color && last.fontStyle === fontStyle) || text.trim() === "")) last.text += text;
        else spans.push({ color, fontStyle, text });
      }
      const html = spans
        .map(({ color, fontStyle, text }) => {
          let piece = guestText(text);
          if (fontStyle & 1) piece = `<I>${piece}</I>`;
          if (fontStyle & 2) piece = `<B>${piece}</B>`;
          return color === undefined ? piece : `<FONT COLOR=${color}>${piece}</FONT>`;
        })
        .join("");
      return column > MAX_LINE_CHARS ? `${html}<FONT COLOR=#cc0000> [line cut]</FONT>` : html;
    });
  }
}

/** `code` as lines of escaped HTML with no color. */
export function plainLines(code) {
  return code.split("\n").map((line) => {
    const text = expandTabs(line);
    return text.length > MAX_LINE_CHARS ? `${guestText(text.slice(0, MAX_LINE_CHARS))}<FONT COLOR="#CC0000"> [line cut]</FONT>` : guestText(text);
  });
}
