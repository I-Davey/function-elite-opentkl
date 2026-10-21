import { cast, types, type Instance, type SnapshotIn } from 'mobx-state-tree';
import { uniq } from 'lodash';
import { removeHexPound, type GradientStop } from '../theme/color.js';
import { areGradientsEqual } from '../theme/gradients.js';

/** Five recent colours/gradients shared by the existing picker controls. */
export const ColorPickerStore = types
  .model('ColorPicker', {
    colors: types.array(types.string),
    gradients: types.array(types.frozen<GradientStop[]>([])),
  })
  .views((self) => ({
    get recentColors() {
      return self.colors;
    },
    get recentGradients() {
      return self.gradients.map((gradient) => [...gradient]);
    },
  }))
  .actions((self) => ({
    async addColor(value: string) {
      const color = removeHexPound(value);
      self.colors = cast(uniq([color, ...self.colors]).slice(0, 5));
    },
    addGradient(gradient: GradientStop[]) {
      if (!self.gradients.some((stored) => areGradientsEqual(gradient, stored)))
        self.gradients = cast([gradient, ...self.gradients].slice(0, 5));
    },
  }));

export type ColorPickerStoreInstance = Instance<typeof ColorPickerStore>;
export type ColorPickerStoreSnapshot = SnapshotIn<typeof ColorPickerStore>;
