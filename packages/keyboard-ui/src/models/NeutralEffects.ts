import { types, type Instance, type SnapshotIn } from 'mobx-state-tree';
/** OffEffectReactive. Recovered from src/renderer/keyboard/v2/models/effects/NeutralEffects.ts. */
const OffEffectReactive = types
  .model('OffEffectReactive', {
    layer: types.literal('Reactive'),
    kind: types.literal('Off'),
  })
  .views(() => ({
    get colorType() {
      return {
        kind: 'Off' as const,
      };
    },
    get direction() {
      return undefined;
    },
  }));
/** OffEffectBase. Recovered from src/renderer/keyboard/v2/models/effects/NeutralEffects.ts. */
const OffEffectBase = types
  .model('OffEffectBase', {
    layer: types.literal('Base'),
    kind: types.literal('Off'),
  })
  .views(() => ({
    get colorType() {
      return {
        kind: 'Off' as const,
      };
    },
    get direction() {
      return undefined;
    },
  }));
/** MixedEffectBase. Recovered from src/renderer/keyboard/v2/models/effects/NeutralEffects.ts. */
const MixedEffectBase = types
  .model('MixedEffectBase', {
    layer: types.literal('Base'),
    kind: types.literal('Mixed'),
  })
  .views(() => ({
    get colorType() {
      return {
        kind: 'Mixed' as const,
      };
    },
  }));
/** MixedEffectReactive. Recovered from src/renderer/keyboard/v2/models/effects/NeutralEffects.ts. */
const MixedEffectReactive = types
  .model('MixedEffectReactive', {
    layer: types.literal('Reactive'),
    kind: types.literal('Mixed'),
  })
  .views(() => ({
    get colorType() {
      return {
        kind: 'Mixed' as const,
      };
    },
  }));
export { OffEffectReactive, OffEffectBase, MixedEffectBase, MixedEffectReactive };

export type OffEffectReactiveInstance = Instance<typeof OffEffectReactive>;
export type OffEffectReactiveSnapshot = SnapshotIn<typeof OffEffectReactive>;
export type OffEffectBaseInstance = Instance<typeof OffEffectBase>;
export type OffEffectBaseSnapshot = SnapshotIn<typeof OffEffectBase>;
export type MixedEffectBaseInstance = Instance<typeof MixedEffectBase>;
export type MixedEffectBaseSnapshot = SnapshotIn<typeof MixedEffectBase>;
export type MixedEffectReactiveInstance = Instance<typeof MixedEffectReactive>;
export type MixedEffectReactiveSnapshot = SnapshotIn<typeof MixedEffectReactive>;
