import { types, type Instance } from 'mobx-state-tree';
import type { GradientStop } from '../theme/color.js';

/** Gradient stops stay frozen snapshot data, matching the existing editor model. */
export const Gradient = types.model({ gradient: types.frozen<GradientStop[]>([]) })
  .actions((self) => ({
    setGradient(gradient: GradientStop[]) { self.gradient = gradient; },
  }));
export type GradientInstance = Instance<typeof Gradient>;
