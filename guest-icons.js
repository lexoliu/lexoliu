// Pixel icons for the GitHub pages, drawn here on a canvas and encoded as baseline JPEG, the format
// Netscape Navigator 3.0 shows (it has no PNG). Each is 16x16 on white, like the pages.
const SIZE = 16;
/** JPEG quality of every image sent to the guest; the same as tools/vm/logos.ts. */
export const JPEG_QUALITY = 0.92;
const COLORS = {
  ".": "#ffffff",
  O: "#808000",
  Y: "#ffff00",
  W: "#ffffff",
  K: "#000000",
  G: "#808080",
  B: "#000080",
  S: "#ffcc00",
  T: "#806000",
};

function blank() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill("."));
}

function rect(grid, x, y, w, h, ch) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) grid[j][i] = ch;
}

function folder() {
  const g = blank();
  rect(g, 1, 2, 6, 2, "O");
  rect(g, 1, 4, 14, 9, "O");
  rect(g, 2, 3, 4, 1, "Y");
  rect(g, 2, 5, 12, 7, "Y");
  rect(g, 2, 5, 12, 1, "W");
  return g;
}

function file() {
  const g = blank();
  rect(g, 3, 1, 10, 14, "K");
  rect(g, 4, 2, 8, 12, "W");
  rect(g, 9, 1, 4, 4, "K");
  rect(g, 9, 2, 3, 2, "G");
  rect(g, 4, 2, 5, 1, "W");
  rect(g, 4, 5, 8, 1, "B");
  rect(g, 5, 7, 6, 1, "G");
  rect(g, 5, 9, 6, 1, "G");
  rect(g, 5, 11, 4, 1, "G");
  return g;
}

const STAR_ROWS = [
  ".......SS.......",
  ".......SS.......",
  "......SSSS......",
  "......SSSS......",
  "SSSSSSSSSSSSSSSS",
  ".SSSSSSSSSSSSSS.",
  "..SSSSSSSSSSSS..",
  "...SSSSSSSSSS...",
  "....SSSSSSSS....",
  "....SSSSSSSS....",
  "...SSSSSSSSSS...",
  "...SSSS..SSSS...",
  "..SSSS....SSSS..",
  "..SSS......SSS..",
  ".SS..........SS.",
];

function star() {
  // The art is 16 wide and 15 high, outlined one pixel out: drawn at offset (0, 1) and clipped.
  const g = blank();
  STAR_ROWS.forEach((row, j) => {
    if (row.length !== SIZE) throw new Error(`star row ${j} is ${row.length} wide`);
    [...row].forEach((ch, i) => {
      if (ch !== "." && j + 1 < SIZE) g[j + 1][i] = ch;
    });
  });
  const outline = g.map((row) => row.slice());
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      if (g[j][i] !== ".") continue;
      const near = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dj, di]) => g[j + dj]?.[i + di] === "S");
      if (near) outline[j][i] = "T";
    }
  }
  return outline;
}

/** name -> the icon's pixel grid, rows of COLORS keys. */
const ICONS = {
  "folder.jpg": folder,
  "file.jpg": file,
  "star.jpg": star,
};

/** The baseline JPEG of a canvas. */
export async function canvasJpeg(canvas) {
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
  return new Uint8Array(await blob.arrayBuffer());
}

/** JPEG bytes of the icon `name`, or undefined when there is none. */
export async function iconBytes(name) {
  const draw = ICONS[name];
  if (draw === undefined) return undefined;
  const canvas = new OffscreenCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");
  draw().forEach((row, y) =>
    row.forEach((ch, x) => {
      ctx.fillStyle = COLORS[ch];
      ctx.fillRect(x, y, 1, 1);
    })
  );
  return canvasJpeg(canvas);
}

export const ICON_SIZE = SIZE;
