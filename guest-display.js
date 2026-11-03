// The guest's display mode for the viewport. The VM generator (tools/vm/build.ts) uses it too,
// to record the boot after the saved state in the modes the page switches to at power-on.

/**
 * The guest mode for a `vw`x`vh` viewport (`display` is modes.json, tools/vm/display.ts): the
 * viewport's own size, scaled down when it has more pixels than the saved state's mode or is
 * beyond what the adapter and its VRAM can show, and scaled up when its shorter side is under
 * the least the page asks for. The width is rounded down to the driver's step; only a viewport
 * more extreme in shape than the limits allow is clamped out of its aspect ratio.
 */
export function guestModeFor(display, vw, vh) {
  const [sw, sh] = display.snapshotMode;
  const pixels = vw * vh;
  const down = Math.min(
    1,
    Math.sqrt((sw * sh) / pixels),
    Math.sqrt(display.vgaMemorySize / (display.bitsPerPixel / 8) / pixels),
    display.maxWidth / vw,
    display.maxHeight / vh,
  );
  const scale = Math.max(down, display.minSide / Math.min(vw, vh));
  const step = display.widthStep;
  const clamp = (v, max) => Math.min(Math.max(v, display.minSide), max);
  return [clamp(Math.floor((vw * scale) / step) * step, display.maxWidth), clamp(Math.floor(vh * scale), display.maxHeight)];
}
