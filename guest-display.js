// How the page picks the guest's display mode for the viewport. The VM generator
// (tools/vm/build.ts) records the boot after the saved state in every mode this picks.

/**
 * Among `modes` sharing the best aspect ratio for a `vw`x`vh` viewport, the one nearest the
 * viewport's size, up to `maxPixels`.
 */
export function pickGuestMode(modes, maxPixels, vw, vh) {
  const misfit = ([w, h]) => Math.abs(Math.log(w / h / (vw / vh)));
  const best = Math.min(...modes.map(misfit));
  const fitting = modes.filter((m) => misfit(m) - best < 1e-9);
  const target = Math.min(vw * vh, maxPixels);
  const sizeMisfit = ([w, h]) => Math.abs(Math.log((w * h) / target));
  return fitting.reduce((a, b) => (sizeMisfit(b) < sizeMisfit(a) ? b : a));
}
