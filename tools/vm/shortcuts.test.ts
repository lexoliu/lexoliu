import { expect, test } from "bun:test";
import { shortcutBytes } from "./shortcuts.ts";

const EXE = "D:\\NETSCAPE\\NETSCAPE.EXE";
const URL = "http://github.com/torvalds/linux";

test("the link's offsets and strings are self-consistent", () => {
  const b = shortcutBytes(EXE, URL, "NETSCAPE", 0x12345678);
  expect(b.readUInt32LE(0)).toBe(0x4c);
  expect(b.readUInt32LE(0x14)).toBe(0x73);
  let at = 0x4c;
  const idListEnd = at + 2 + b.readUInt16LE(at);
  expect(b.readUInt16LE(idListEnd - 2)).toBe(0); // terminator
  // The item ids chain exactly to the terminator.
  for (at += 2; at < idListEnd - 2; at += b.readUInt16LE(at)) expect(b.readUInt16LE(at)).toBeGreaterThan(2);
  expect(at).toBe(idListEnd - 2);

  const info = idListEnd;
  const size = b.readUInt32LE(info);
  const volume = info + b.readUInt32LE(info + 12);
  expect(b.readUInt32LE(volume + 8)).toBe(0x12345678);
  expect(b.toString("latin1", volume + 16, volume + b.readUInt32LE(volume) - 1)).toBe("NETSCAPE");
  const base = info + b.readUInt32LE(info + 16);
  expect(b.toString("latin1", base, base + EXE.length + 1)).toBe(`${EXE}\0`);

  const strings: string[] = [];
  at = info + size;
  while (at + 4 < b.length) {
    const n = b.readUInt16LE(at);
    strings.push(b.toString("latin1", at + 2, at + 2 + n));
    at += 2 + n;
  }
  expect(strings).toEqual(["D:\\NETSCAPE", URL, EXE]);
  expect(b.length - at).toBe(4);
});

test("a path that is not 8.3 is refused", () => {
  expect(() => shortcutBytes("D:\\Netscape Navigator\\NETSCAPE.EXE", URL, "X", 0)).toThrow();
});
