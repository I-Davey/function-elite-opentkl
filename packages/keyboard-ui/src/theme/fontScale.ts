/** Recovered font steps; sizes outside the scale keep the original fallback behavior. */
export const FONT_SCALE = [13, 15, 20, 24, 34, 46, 64];
export function steppedFontSize(size: number, step: number) {
  return FONT_SCALE[Math.max(FONT_SCALE.indexOf(size) + step, 0)] || size;
}
