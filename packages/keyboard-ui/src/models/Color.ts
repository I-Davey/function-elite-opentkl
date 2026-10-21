import { types, cast, type Instance, type SnapshotIn } from 'mobx-state-tree';
import { rgbFromHex, rgbToHex } from '../theme/color.js';
import type { Rgb as RgbValue } from '../../../backend/src/contracts.cjs';

export const Rgb = types.model({
  r: types.optional(types.number, 255),
  g: types.optional(types.number, 255),
  b: types.optional(types.number, 255),
});
export type RgbSnapshot = SnapshotIn<typeof Rgb>;
export type RgbInstance = Instance<typeof Rgb>;

/** One editable keyboard colour; the default is CAM's keyboard purple. */
export const Color = types.model({ color: types.optional(Rgb, rgbFromHex('51007A')) })
  .views((self) => ({
    get colorHex() { return rgbToHex(self.color.r, self.color.g, self.color.b); },
  }))
  .actions((self) => ({
    setColor(color: RgbSnapshot) { self.color = cast(color); },
    setColorObj(color: { toRgb(): RgbValue }) { self.color = cast(color.toRgb()); },
  }));

/** Editable effect palette; extending past its end inserts white entries. */
export const Colors = types.model({ colors: types.optional(types.array(Rgb), [rgbFromHex('51007A')]) })
  .actions((self) => ({
    setColors(colors: RgbSnapshot[]) { self.colors = cast(colors); },
    setColorWithIndex(color: RgbSnapshot, index: number) {
      const length = self.colors.length;
      if (length < index) {
        const white = Array.from({ length: index - length }, () => rgbFromHex('FFFFFF'));
        self.colors = cast([...self.colors, ...white, color]);
      } else self.colors[index] = cast(color);
    },
    addColor(color: RgbSnapshot) { self.colors.push(cast(color)); },
    removeColor(index: number) {
      const color = self.colors[index];
      if (color) self.colors.remove(color);
    },
  }));

export type ColorInstance = Instance<typeof Color>;
export type ColorsInstance = Instance<typeof Colors>;
