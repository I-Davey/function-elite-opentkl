import type { CoreGradientSnapshot, WithoutLayer } from './effectTypes.js';
import { types, type Instance, type SnapshotIn, type SnapshotOut } from 'mobx-state-tree';
import { Rgb } from './Color.js';
import * as colorUtils from '../theme/color.js';
import { Direction, GradientType, Speed } from './KeyEffectProperties.js';
import { Gradient } from './Gradient.js';
import {
  ColorTypeNoPicker,
  PulseColorType,
  ShiftColorType,
  WaveColorType,
} from './KeyEffectColors.js';
import { MixedEffectBase, OffEffectBase } from './NeutralEffects.js';
const BaseEffect = types.model({
  layer: types.literal('Base'),
});
const ColorEffect = types
  .compose(
    'ColorEffect',
    BaseEffect,
    types.model({
      kind: types.literal('Color'),
      color: Rgb,
    }),
  )
  .views((self) => ({
    get colorType() {
      const { r: r, g: g, b: b } = self.color;
      return {
        kind: 'Color' as const,
        color: (0, colorUtils.rgbToHex)(r, g, b),
      };
    },
    get direction() {
      return undefined;
    },
  }));
const SolidGradientEffect = types
  .compose(
    'SolidGradientEffect',
    BaseEffect,
    types.model({
      kind: types.literal('SolidGradient'),
    }),
    Direction,
    Gradient,
  )
  .views((self) => ({
    get colorType() {
      return {
        kind: 'Gradient' as const,
        gradient: self.gradient,
      };
    },
  }));
const SolidGradient2Effect = types
  .compose(
    'SolidGradient2Effect',
    BaseEffect,
    types.model({
      kind: types.literal('SolidGradient2'),
    }),
    Gradient,
    GradientType,
  )
  .views((self) => ({
    get colorType() {
      return {
        kind: 'Gradient' as const,
        gradient: self.gradient,
      };
    },
    get direction() {
      return undefined;
    },
  }));
const CoveringMarqueeEffect = types
  .compose(
    'CoveringMarqueeEffect',
    BaseEffect,
    types.model({
      kind: types.literal('CoveringMarquee'),
      color: ColorTypeNoPicker,
    }),
    Direction,
    Speed,
  )
  .views((self) => ({
    get colorType() {
      switch (self.color.kind) {
        case 'Gradient':
          return {
            kind: 'Gradient' as const,
            gradient: self.color.gradient,
          };
        case 'Rainbow':
        case 'Random':
          return {
            kind: self.color.kind,
          };
      }
    },
  }));
const PulseColorEffect = types
  .compose(
    'PulseEffect',
    BaseEffect,
    types.model({
      kind: types.literal('PulseColor'),
      color: PulseColorType,
    }),
    Speed,
  )
  .views((self) => ({
    get colorType() {
      switch (self.color.kind) {
        case 'Colors':
          return {
            kind: self.color.kind,
            colors: self.color.colors.map(({ r: r, g: g, b: b }) =>
              (0, colorUtils.rgbToHex)(r, g, b),
            ),
          };
        case 'Rainbow':
        case 'Random':
          return {
            kind: self.color.kind,
          };
      }
    },
    get direction() {
      return undefined;
    },
  }));
const ShiftColorEffect = types
  .compose(
    'ShiftColorEffect',
    BaseEffect,
    types.model({
      kind: types.literal('ShiftColor'),
      color: ShiftColorType,
    }),
    Speed,
  )
  .views((self) => ({
    get colorType() {
      switch (self.color.kind) {
        case 'Gradient':
          return {
            kind: self.color.kind,
            gradient: self.color.gradient,
          };
        case 'Rainbow':
        case 'Random':
          return {
            kind: self.color.kind,
          };
      }
    },
    get direction() {
      return undefined;
    },
  }));
const WaveEffect = types
  .compose(
    'WaveEffect',
    BaseEffect,
    types.model({
      kind: types.literal('Wave'),
      color: WaveColorType,
    }),
    Direction,
    Speed,
  )
  .views((self) => ({
    get colorType() {
      switch (self.color.kind) {
        case 'Gradient':
          return {
            kind: 'Gradient' as const,
            gradient: self.color.gradient,
          };
        case 'Rainbow':
          return {
            kind: 'Rainbow' as const,
          };
        case 'Color': {
          const { r: r, g: g, b: b } = self.color.color;
          return {
            kind: 'Color' as const,
            color: (0, colorUtils.rgbToHex)(r, g, b),
          };
        }
      }
    },
  }));
const BaseZoneEffectSettings = types.union(
  ColorEffect,
  SolidGradientEffect,
  SolidGradient2Effect,
  CoveringMarqueeEffect,
  PulseColorEffect,
  ShiftColorEffect,
  WaveEffect,
  MixedEffectBase,
  OffEffectBase,
);
function createBaseZoneEffect(effect: CoreBaseEffect) {
  switch (effect.kind) {
    case 'Color':
      return ColorEffect.create({
        ...effect,
        layer: 'Base',
      });
    case 'CoveringMarquee':
      return 'Gradient' === effect.color.kind
        ? CoveringMarqueeEffect.create({
            ...effect,
            color: {
              ...effect.color,
              gradient: (0, colorUtils.fromCoreGradient)(effect.color.gradient),
            },
            layer: 'Base',
          })
        : CoveringMarqueeEffect.create({
            ...effect,
            color: {
              ...effect.color,
            },
            layer: 'Base',
          });
    case 'PulseColor':
      return (
        effect.color.kind,
        PulseColorEffect.create({
          ...effect,
          color: {
            ...effect.color,
          },
          layer: 'Base',
        })
      );
    case 'ShiftColor':
      return 'Gradient' === effect.color.kind
        ? ShiftColorEffect.create({
            ...effect,
            color: {
              ...effect.color,
              gradient: (0, colorUtils.fromCoreGradient)(effect.color.gradient),
            },
            layer: 'Base',
          })
        : ShiftColorEffect.create({
            ...effect,
            color: {
              ...effect.color,
            },
            layer: 'Base',
          });
    case 'SolidGradient':
      return SolidGradientEffect.create({
        ...effect,
        gradient: (0, colorUtils.fromCoreGradient)(effect.gradient),
        layer: 'Base',
      });
    case 'SolidGradient2':
      return SolidGradient2Effect.create({
        ...effect,
        gradient: (0, colorUtils.fromCoreGradient)(effect.gradient),
        layer: 'Base',
      });
    case 'Wave':
      switch (effect.color.kind) {
        case 'Gradient':
          return WaveEffect.create({
            ...effect,
            color: {
              ...effect.color,
              gradient: (0, colorUtils.fromCoreGradient)(effect.color.gradient),
            },
            layer: 'Base',
          });
        case 'Color':
          return WaveEffect.create({
            ...effect,
            color: {
              kind: 'Color',
              color: {
                ...effect.color,
              },
              size: effect.color.size,
            },
            layer: 'Base',
          });
        case 'Rainbow':
          return WaveEffect.create({
            ...effect,
            color: {
              ...effect.color,
            },
            layer: 'Base',
          });
      }
  }
}
export {
  BaseEffect,
  ColorEffect,
  SolidGradientEffect,
  SolidGradient2Effect,
  CoveringMarqueeEffect,
  PulseColorEffect,
  ShiftColorEffect,
  WaveEffect,
  BaseZoneEffectSettings,
  createBaseZoneEffect,
};

import type { Rgb as RgbValue } from '../../../backend/src/contracts.cjs';
import type { CoreColorStop } from '../theme/color.js';
type WaveColorSnapshot = SnapshotIn<typeof WaveColorType>;
type CoreWaveColor =
  | Exclude<WaveColorSnapshot, { kind: 'Gradient' | 'Color' }>
  | (Omit<Extract<WaveColorSnapshot, { kind: 'Gradient' }>, 'gradient'> & {
      gradient: CoreColorStop[];
    })
  | (Omit<Extract<WaveColorSnapshot, { kind: 'Color' }>, 'color'> & RgbValue);
export type CoreBaseEffect =
  | CoreGradientSnapshot<
      WithoutLayer<Exclude<SnapshotIn<typeof BaseZoneEffectSettings>, { kind: 'Wave' }>>
    >
  | (Omit<WithoutLayer<SnapshotIn<typeof WaveEffect>>, 'color'> & { color: CoreWaveColor });
export type BaseEffectInstance = Instance<typeof BaseEffect>;
export type BaseEffectSnapshot = SnapshotIn<typeof BaseEffect>;
export type BaseEffectValue = Instance<typeof BaseEffect> | SnapshotOut<typeof BaseEffect>;
export type ColorEffectInstance = Instance<typeof ColorEffect>;
export type ColorEffectSnapshot = SnapshotIn<typeof ColorEffect>;
export type ColorEffectValue = Instance<typeof ColorEffect> | SnapshotOut<typeof ColorEffect>;
export type SolidGradientEffectInstance = Instance<typeof SolidGradientEffect>;
export type SolidGradientEffectSnapshot = SnapshotIn<typeof SolidGradientEffect>;
export type SolidGradientEffectValue =
  Instance<typeof SolidGradientEffect> | SnapshotOut<typeof SolidGradientEffect>;
export type SolidGradient2EffectInstance = Instance<typeof SolidGradient2Effect>;
export type SolidGradient2EffectSnapshot = SnapshotIn<typeof SolidGradient2Effect>;
export type SolidGradient2EffectValue =
  Instance<typeof SolidGradient2Effect> | SnapshotOut<typeof SolidGradient2Effect>;
export type CoveringMarqueeEffectInstance = Instance<typeof CoveringMarqueeEffect>;
export type CoveringMarqueeEffectSnapshot = SnapshotIn<typeof CoveringMarqueeEffect>;
export type CoveringMarqueeEffectValue =
  Instance<typeof CoveringMarqueeEffect> | SnapshotOut<typeof CoveringMarqueeEffect>;
export type PulseColorEffectInstance = Instance<typeof PulseColorEffect>;
export type PulseColorEffectSnapshot = SnapshotIn<typeof PulseColorEffect>;
export type PulseColorEffectValue =
  Instance<typeof PulseColorEffect> | SnapshotOut<typeof PulseColorEffect>;
export type ShiftColorEffectInstance = Instance<typeof ShiftColorEffect>;
export type ShiftColorEffectSnapshot = SnapshotIn<typeof ShiftColorEffect>;
export type ShiftColorEffectValue =
  Instance<typeof ShiftColorEffect> | SnapshotOut<typeof ShiftColorEffect>;
export type WaveEffectInstance = Instance<typeof WaveEffect>;
export type WaveEffectSnapshot = SnapshotIn<typeof WaveEffect>;
export type WaveEffectValue = Instance<typeof WaveEffect> | SnapshotOut<typeof WaveEffect>;
export type BaseZoneEffectSettingsInstance = Instance<typeof BaseZoneEffectSettings>;
export type BaseZoneEffectSettingsSnapshot = SnapshotIn<typeof BaseZoneEffectSettings>;
export type BaseZoneEffectSettingsValue =
  Instance<typeof BaseZoneEffectSettings> | SnapshotOut<typeof BaseZoneEffectSettings>;
