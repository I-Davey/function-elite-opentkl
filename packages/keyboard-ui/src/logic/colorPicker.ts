import { Color } from '../theme/color.js';

/** The existing Color parser already normalizes raw HSL channels and preserves opaque alpha. */
export function convertHexToColorObject(hex: string) {
  return new Color().fromHex(hex);
}
