import type { CoreGradientSnapshot, WithoutLayer } from './effectTypes.js';
import { types, type Instance, type SnapshotIn, type SnapshotOut } from 'mobx-state-tree';
import {
  ReactiveEffectColorTypeWithSize,
  ReactiveEffectColorTypeNoSize,
  FadeColorType,
} from './KeyEffectColors.js';
import { Speed, KeyEvent } from './KeyEffectProperties.js';
import * as colorUtils from '../theme/color.js';
import { MixedEffectReactive, OffEffectReactive } from './NeutralEffects.js';
const ReactiveEffect = types.model({
  layer: types.literal('Reactive'),
});
const RippleEffect = types
  .compose(
    'RippleEffect',
    ReactiveEffect,
    types.model({
      kind: types.literal('Ripple'),
      color: ReactiveEffectColorTypeWithSize,
    }),
    Speed,
    KeyEvent,
  )
  .views((self) => ({
    get colorType() {
      switch (self.color.kind) {
        case 'Gradient':
          return {
            kind: self.color.kind,
            gradient: self.color.gradient,
          };
        case 'Color': {
          const { r: r, g: g, b: b } = self.color.color;
          return {
            kind: self.color.kind,
            color: (0, colorUtils.rgbToHex)(r, g, b),
          };
        }
        default:
          return {
            kind: self.color.kind,
          };
      }
    },
    get direction() {
      return undefined;
    },
  }));
const LineEffect = types
  .compose(
    'LineEffect',
    ReactiveEffect,
    types.model({
      kind: types.literal('Line'),
      color: ReactiveEffectColorTypeNoSize,
    }),
    Speed,
    KeyEvent,
  )
  .views((self) => ({
    get colorType() {
      switch (self.color.kind) {
        case 'Gradient':
          return {
            kind: self.color.kind,
            gradient: self.color.gradient,
          };
        case 'Color': {
          const { r: r, g: g, b: b } = self.color;
          return {
            kind: self.color.kind,
            color: (0, colorUtils.rgbToHex)(r, g, b),
          };
        }
        default:
          return {
            kind: self.color.kind,
          };
      }
    },
    get direction() {
      return undefined;
    },
  }));
const FadeEffect = types
  .compose(
    'FadeEffect',
    ReactiveEffect,
    types.model({
      kind: types.literal('Fade'),
      color: FadeColorType,
    }),
    Speed,
    KeyEvent,
  )
  .views((self) => ({
    get colorType() {
      if ('Color' === self.color.kind) {
        const { r: r, g: g, b: b } = self.color;
        return {
          kind: self.color.kind,
          color: (0, colorUtils.rgbToHex)(r, g, b),
        };
      }
      return {
        kind: self.color.kind,
      };
    },
    get direction() {
      return undefined;
    },
  }));
const ReactiveZoneEffectSettings = types.union(
  RippleEffect,
  LineEffect,
  FadeEffect,
  MixedEffectReactive,
  OffEffectReactive,
);
function createReactiveZoneEffect(effect: CoreReactiveEffect) {
  switch (effect.kind) {
    case 'Fade':
      return (
        effect.color.kind,
        FadeEffect.create({
          ...effect,
          color: effect.color,
          layer: 'Reactive',
        })
      );
    case 'Line':
      return 'Gradient' === effect.color.kind
        ? LineEffect.create({
            ...effect,
            color: {
              ...effect.color,
              gradient: (0, colorUtils.fromCoreGradient)(effect.color.gradient),
            },
            layer: 'Reactive',
          })
        : LineEffect.create({
            ...effect,
            color: effect.color,
            layer: 'Reactive',
          });
    case 'Ripple':
      return 'Gradient' === effect.color.kind
        ? RippleEffect.create({
            ...effect,
            color: {
              ...effect.color,
              gradient: (0, colorUtils.fromCoreGradient)(effect.color.gradient),
            },
            layer: 'Reactive',
          })
        : RippleEffect.create({
            ...effect,
            color: effect.color,
            layer: 'Reactive',
          });
  }
}
export {
  ReactiveEffect,
  RippleEffect,
  LineEffect,
  FadeEffect,
  ReactiveZoneEffectSettings,
  createReactiveZoneEffect,
};

export type CoreReactiveEffect = CoreGradientSnapshot<
  WithoutLayer<SnapshotIn<typeof ReactiveZoneEffectSettings>>
>;
export type ReactiveEffectInstance = Instance<typeof ReactiveEffect>;
export type ReactiveEffectSnapshot = SnapshotIn<typeof ReactiveEffect>;
export type ReactiveEffectValue =
  Instance<typeof ReactiveEffect> | SnapshotOut<typeof ReactiveEffect>;
export type RippleEffectInstance = Instance<typeof RippleEffect>;
export type RippleEffectSnapshot = SnapshotIn<typeof RippleEffect>;
export type RippleEffectValue = Instance<typeof RippleEffect> | SnapshotOut<typeof RippleEffect>;
export type LineEffectInstance = Instance<typeof LineEffect>;
export type LineEffectSnapshot = SnapshotIn<typeof LineEffect>;
export type LineEffectValue = Instance<typeof LineEffect> | SnapshotOut<typeof LineEffect>;
export type FadeEffectInstance = Instance<typeof FadeEffect>;
export type FadeEffectSnapshot = SnapshotIn<typeof FadeEffect>;
export type FadeEffectValue = Instance<typeof FadeEffect> | SnapshotOut<typeof FadeEffect>;
export type ReactiveZoneEffectSettingsInstance = Instance<typeof ReactiveZoneEffectSettings>;
export type ReactiveZoneEffectSettingsSnapshot = SnapshotIn<typeof ReactiveZoneEffectSettings>;
export type ReactiveZoneEffectSettingsValue =
  Instance<typeof ReactiveZoneEffectSettings> | SnapshotOut<typeof ReactiveZoneEffectSettings>;
