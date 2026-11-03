import { expect, test } from "bun:test";
import { articlePath, classifyLink, normalizeTitle, packPages } from "./guest-wikipedia.js";

test("titles are identified the way Wikipedia does", () => {
  expect(normalizeTitle("windows_95")).toBe("Windows 95");
  expect(normalizeTitle(" rust (programming language)")).toBe("Rust (programming language)");
  expect(normalizeTitle("")).toBe("");
});

test("an article's guest path keeps slashes and colons readable", () => {
  expect(articlePath("Rust (programming language)")).toBe("/wiki/Rust_(programming_language)");
  expect(articlePath("AC/DC")).toBe("/wiki/AC/DC");
  expect(articlePath("File:A b.png")).toBe("/wiki/File:A_b.png");
  expect(articlePath("Fish & chips")).toBe("/wiki/Fish_%26_chips");
});

test("links in article HTML are told apart", () => {
  expect(classifyLink("#History", "Windows 95")).toEqual({ article: "Windows 95", fragment: "History" });
  expect(classifyLink("./Windows_9x")).toEqual({ article: "Windows 9x", fragment: "" });
  expect(classifyLink("./Windows_95#Features")).toEqual({ article: "Windows 95", fragment: "Features" });
  expect(classifyLink("//en.wikipedia.org/wiki/Caf%C3%A9")).toEqual({ article: "Café", fragment: "" });
  expect(classifyLink("./Nope?action=edit&redlink=1")).toBeUndefined();
  expect(classifyLink("mailto:a@b.c")).toBeUndefined();
  expect(classifyLink("https://example.com/a?b=1#c").external.href).toBe("https://example.com/a?b=1#c");
  expect(classifyLink("//fr.wikipedia.org/wiki/Paris").external.host).toBe("fr.wikipedia.org");
});

test("units are packed into pages in order", () => {
  expect(packPages([10, 10, 10, 10], 25)).toEqual([0, 0, 1, 1]);
  expect(packPages([30, 5, 5], 25)).toEqual([0, 1, 1]);
  expect(packPages([5, 30, 5], 25)).toEqual([0, 1, 2]);
  expect(packPages([], 25)).toEqual([]);
});
