// Text for the guest: Netscape Navigator 3.0 renders HTML 3.2 in a Latin-1 font, so every character
// reaching a page is HTML-escaped and every character outside Latin-1 is replaced visibly.

/** Shown in place of a character the guest cannot display (one per code point). */
export const REPLACEMENT = "?";
/** Columns between tab stops in source files. */
export const TAB_WIDTH = 4;

/** Escapes `text` for HTML 3.2 content or a double-quoted attribute; code points the guest cannot show become REPLACEMENT. */
export function guestText(text) {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (ch === "&") out += "&amp;";
    else if (ch === "<") out += "&lt;";
    else if (ch === ">") out += "&gt;";
    else if (ch === '"') out += "&quot;";
    else if (code === 9 || code === 10 || code === 13 || (code >= 32 && code < 127)) out += ch;
    else if (code >= 160 && code <= 255) out += `&#${code};`;
    else out += REPLACEMENT;
  }
  return out;
}

/** Expands tabs to the next multiple of TAB_WIDTH, starting at column `column`; returns the text. */
export function expandTabs(text, column = 0) {
  let out = "";
  for (const ch of text) {
    if (ch === "\t") {
      const pad = TAB_WIDTH - ((column + out.length) % TAB_WIDTH);
      out += " ".repeat(pad);
    } else {
      out += ch;
    }
  }
  return out;
}

/** 1234567 -> "1,234,567" */
export function formatCount(n) {
  return n.toLocaleString("en-US");
}

/** 1536 -> "1.5 KB" */
export function formatBytes(n) {
  if (n < 1024) return `${n} bytes`;
  const units = ["KB", "MB", "GB"];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** An ISO timestamp as "YYYY-MM-DD". */
export function formatDate(iso) {
  return iso.slice(0, 10);
}

/** Path segments as a URL path, each percent-encoded. */
export function encodePath(segments) {
  return segments.map(encodeURIComponent).join("/");
}
