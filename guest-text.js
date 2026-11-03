// Text for the guest: Netscape Navigator 3.0 renders HTML 3.2 in a Latin-1 font, so every character
// reaching a page is HTML-escaped and every character outside Latin-1 is replaced visibly.

/** Shown in place of a character the guest cannot display (one per code point). */
export const REPLACEMENT = "?";
/** Columns between tab stops in source files. */
export const TAB_WIDTH = 4;

// Punctuation outside Latin-1 and its nearest faithful spelling. Anything else outside Latin-1 stays REPLACEMENT.
const PUNCTUATION = new Map([
  ["‐", "-"], ["‑", "-"], ["‒", "-"], ["–", "-"], ["—", "--"], ["―", "--"], ["−", "-"],
  ["‘", "'"], ["’", "'"], ["‚", ","], ["‛", "'"], ["“", '"'], ["”", '"'], ["„", '"'], ["‟", '"'],
  ["′", "'"], ["″", '"'], ["‹", "<"], ["›", ">"],
  ["•", "*"], ["‣", ">"], ["⁃", "-"], ["…", "..."], ["⁄", "/"], ["™", "(TM)"],
  ["←", "<-"], ["→", "->"], ["↔", "<->"], ["⇐", "<="], ["⇒", "=>"], ["⇔", "<=>"],
  ["↑", "^"], ["↓", "v"], ["≤", "<="], ["≥", ">="], ["≠", "!="], ["≈", "~"],
  ["✓", "v"], ["✕", "x"], ["✗", "x"],
  ["╴", "-"], ["╵", "|"], ["╶", "-"], ["╷", "|"], ["╸", "-"], ["╹", "|"], ["╺", "-"], ["╻", "|"],
  ["╱", "/"], ["╲", "\\"], ["╳", "X"],
]);

/** Box-drawing code points that are straight horizontal or vertical lines (light, heavy, dashed, double); every other one is a junction. */
const HORIZONTAL = new Set([0x2500, 0x2501, 0x2504, 0x2505, 0x2508, 0x2509, 0x254c, 0x254d, 0x2550]);
const VERTICAL = new Set([0x2502, 0x2503, 0x2506, 0x2507, 0x250a, 0x250b, 0x254e, 0x254f, 0x2551]);

/** The Latin-1-safe spelling of a code point outside Latin-1, or REPLACEMENT. */
function transliterate(ch, code) {
  const mapped = PUNCTUATION.get(ch);
  if (mapped !== undefined) return mapped;
  if (HORIZONTAL.has(code)) return "-";
  if (VERTICAL.has(code)) return "|";
  if (code >= 0x2500 && code <= 0x257f) return "+";
  return REPLACEMENT;
}

/** Escapes `text` for HTML 3.2 content or a double-quoted attribute; punctuation outside Latin-1 becomes its ASCII spelling (which can change the width) and other code points the guest cannot show become REPLACEMENT. */
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
    else if (code > 255) out += guestText(transliterate(ch, code));
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

/** Units of an age, largest first, with their length in seconds. */
const AGE_UNITS = [["year", 365 * 86400], ["month", 30 * 86400], ["day", 86400], ["hour", 3600], ["minute", 60]];

/** `unixSeconds` relative to `nowMs`: "5 minutes ago", "1 day ago"; under a minute is "just now". */
export function formatAge(unixSeconds, nowMs) {
  const seconds = Math.floor(nowMs / 1000) - unixSeconds;
  for (const [unit, length] of AGE_UNITS) {
    const n = Math.floor(seconds / length);
    if (n >= 1) return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  }
  return "just now";
}

/** Path segments as a URL path, each percent-encoded. */
export function encodePath(segments) {
  return segments.map(encodeURIComponent).join("/");
}
