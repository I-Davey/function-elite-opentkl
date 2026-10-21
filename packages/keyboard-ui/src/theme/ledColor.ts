import convert from 'color-convert';
import type { Rgb } from '../../../backend/src/contracts.cjs';

/** LED interpolation keeps fractional channels; rounding belongs to the final output. */
export function convertHexToLedRgb(hex: string, brightness: number): Rgb {
  const [r, g, b] = convert.hex.rgb.raw(hex).map((channel) => channel * brightness);
  if (r === undefined || g === undefined || b === undefined) throw new Error(`Invalid hex color: ${hex}`);
  return { r, g, b };
}
