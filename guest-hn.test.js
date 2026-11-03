import { expect, test } from "bun:test";
import { MAX_INDENT, domainOf, flatten, indentTags, isLive, loadThread, pageNumber, slicePage } from "./guest-hn.js";
import { pager } from "./guest-site.js";
import { formatAge } from "./guest-text.js";

test("domainOf drops www and path", () => {
  expect(domainOf("https://www.example.com/a/b?c")).toBe("example.com");
  expect(domainOf(undefined)).toBeUndefined();
});

test("pageNumber and slicePage", () => {
  expect(pageNumber(null)).toBe(1);
  expect(pageNumber("3")).toBe(3);
  expect(() => pageNumber("0")).toThrow();
  expect(() => pageNumber("x")).toThrow();
  const ids = Array.from({ length: 70 }, (_, i) => i);
  expect(slicePage(ids, 3, 30)).toEqual({ ids: ids.slice(60), pages: 3 });
  expect(() => slicePage(ids, 4, 30)).toThrow();
  expect(slicePage([], 1, 30)).toEqual({ ids: [], pages: 0 });
});

test("formatAge", () => {
  const now = 1_000_000_000_000;
  const at = (seconds) => now / 1000 - seconds;
  expect(formatAge(at(5), now)).toBe("just now");
  expect(formatAge(at(60), now)).toBe("1 minute ago");
  expect(formatAge(at(7300), now)).toBe("2 hours ago");
  expect(formatAge(at(86400 * 400), now)).toBe("1 year ago");
});

test("indentTags and flatten cap the depth", () => {
  expect(indentTags(0, 2)).toBe("<UL><UL>");
  expect(indentTags(3, 1)).toBe("</UL></UL>");
  expect(indentTags(2, 2)).toBe("");
  let node = { kids: [] };
  const root = node;
  for (let i = 0; i < MAX_INDENT + 3; i++) {
    const kid = { kids: [] };
    node.kids.push(kid);
    node = kid;
  }
  expect(Math.max(...flatten([root]).map((e) => e.depth))).toBe(MAX_INDENT);
});

test("isLive skips deleted, dead and missing items", () => {
  expect(isLive({ id: 1 })).toBe(true);
  expect(isLive({ deleted: true })).toBe(false);
  expect(isLive({ dead: true })).toBe(false);
  expect(isLive(null)).toBe(false);
});

test("loadThread fetches levels concurrently, skips dead items with their replies and cuts at the budget", async () => {
  const items = {
    1: { id: 1, kids: [3, 4] },
    2: { id: 2, dead: true, kids: [5] },
    3: { id: 3, kids: [6, 7] },
    4: { id: 4, kids: [] },
    5: { id: 5 },
    6: { id: 6 },
    7: { id: 7 },
  };
  const requested = [];
  const load = async (id) => (requested.push(id), items[id] ?? null);
  const tree = await loadThread([1, 2], 100, load);
  expect(tree.map((n) => n.item.id)).toEqual([1]);
  expect(tree[0].kids.map((n) => n.item.id)).toEqual([3, 4]);
  expect(tree[0].kids[0].kids.map((n) => n.item.id)).toEqual([6, 7]);
  expect(requested).not.toContain(5);

  const cut = await loadThread([1, 2], 4, load);
  expect(cut[0].kids[0].kids).toEqual([]);
  expect(cut[0].kids[0].cut).toBe(2);
  expect(cut[0].cut).toBe(0);
});

test("pager is empty for one page and links the other pages", () => {
  const link = (n, label) => `[${n}:${label}]`;
  expect(pager(link, 1, 1, "X")).toBe("");
  const html = pager(link, 2, 3, "Stories");
  expect(html).toContain("[1:&laquo; First]");
  expect(html).toContain("Stories page 2 of 3");
  expect(html).toContain("[3:Last &raquo;]");
});
