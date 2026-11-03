import { expect, test } from "bun:test";
import { guestText } from "./guest-text.js";

test("punctuation outside Latin-1 gets its ASCII spelling", () => {
  expect(guestText("main thread — unless")).toBe("main thread -- unless");
  expect(guestText("1–2")).toBe("1-2");
  expect(guestText("“it’s”")).toBe("&quot;it's&quot;");
  expect(guestText("wait…")).toBe("wait...");
  expect(guestText("a → b ← c ⇒ d")).toBe("a -&gt; b &lt;- c =&gt; d");
  expect(guestText("// ── KVO ──")).toBe("// -- KVO --");
  expect(guestText("┌─┐\n│ │\n└─┘")).toBe("+-+\n| |\n+-+");
});

test("invisible format characters vanish", () => {
  expect(guestText("a​b⁡c‎d")).toBe("abcd");
});

test("Latin-1 and unmappable characters are unchanged", () => {
  expect(guestText("café <&>")).toBe("caf&#233; &lt;&amp;&gt;");
  expect(guestText("hi \u{1F600}!")).toBe("hi ?!");
  expect(guestText("中")).toBe("?");
});
