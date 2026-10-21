import type {
  KEYBOARD_BASE_EFFECT_INFO_MAP,
  KEYBOARD_REACTIVE_EFFECT_INFO_MAP,
} from './lightingConstants.js';
type BaseEffectInstance = Instance<typeof BaseZoneEffectSettings>;
type ReactiveEffectInstance = Instance<typeof ReactiveZoneEffectSettings>;
type EffectSnapshot =
  SnapshotOut<typeof BaseZoneEffectSettings> | SnapshotOut<typeof ReactiveZoneEffectSettings>;
type BaseEffectKind = keyof typeof KEYBOARD_BASE_EFFECT_INFO_MAP;
type ReactiveEffectKind = keyof typeof KEYBOARD_REACTIVE_EFFECT_INFO_MAP;
export type LightingEffectInfo =
  | (typeof KEYBOARD_BASE_EFFECT_INFO_MAP)[BaseEffectKind]
  | (typeof KEYBOARD_REACTIVE_EFFECT_INFO_MAP)[ReactiveEffectKind];
import QuickLRU from 'quick-lru';
import { createBaseZoneEffect, BaseZoneEffectSettings } from './BaseZoneEffects.js';
import * as colorUtils from '../theme/color.js';
import { cloneGradient, defaultMulticolor, defaultGradients } from '../theme/gradients.js';
import {
  KeyboardMouseLightingDirection,
  KeyboardMouseGradientType,
  KeyboardMouseLightingKeyTrigger,
} from './keyboardEnums.js';
import {
  MixedEffectBase,
  OffEffectBase,
  MixedEffectReactive,
  OffEffectReactive,
} from './NeutralEffects.js';
import { createReactiveZoneEffect, ReactiveZoneEffectSettings } from './ReactiveZoneEffects.js';
import { KeyboardEffectLayer } from './lightingConstants.js';
import { getSnapshot, type Instance, type SnapshotOut } from 'mobx-state-tree';
const effectSettingsCache = new QuickLRU<string, EffectSnapshot>({
  maxSize: 50,
});
function getDefaultBaseEffects(effectKind: BaseEffectKind): BaseEffectInstance;
function getDefaultBaseEffects(effectKind: string): BaseEffectInstance | undefined;
function getDefaultBaseEffects(effectKind: string) {
  switch (effectKind) {
    case 'Color':
      return createBaseZoneEffect({
        kind: 'Color',
        color: {
          r: 81,
          g: 0,
          b: 121,
        },
      });
    case 'CoveringMarquee':
      return createBaseZoneEffect({
        kind: 'CoveringMarquee',
        color: {
          kind: 'Gradient',
          gradient: (0, colorUtils.toCoreColorStops)(cloneGradient(defaultMulticolor)),
        },
        speedPercent: 0.7,
        direction: KeyboardMouseLightingDirection.Right,
      });
    case 'PulseColor':
      return createBaseZoneEffect({
        kind: 'PulseColor',
        color: {
          kind: 'Rainbow',
        },
        speedPercent: 0.7,
      });
    case 'ShiftColor':
      return createBaseZoneEffect({
        kind: 'ShiftColor',
        color: {
          kind: 'Gradient',
          gradient: (0, colorUtils.toCoreColorStops)(cloneGradient(defaultMulticolor)),
        },
        speedPercent: 1,
      });
    case 'SolidGradient':
      return createBaseZoneEffect({
        kind: 'SolidGradient',
        gradient: (0, colorUtils.toCoreColorStops)(cloneGradient(defaultGradients[0])),
        direction: KeyboardMouseLightingDirection.Right,
      });
    case 'SolidGradient2':
      return createBaseZoneEffect({
        kind: 'SolidGradient2',
        gradient: (0, colorUtils.toCoreColorStops)(cloneGradient(defaultGradients[0])),
        gradientType: KeyboardMouseGradientType.Horizontal,
      });
    case 'Wave':
      return createBaseZoneEffect({
        kind: 'Wave',
        color: {
          kind: 'Rainbow',
          value: 1,
        },
        speedPercent: 0.7,
        direction: KeyboardMouseLightingDirection.Right,
      });
    case 'Mixed':
      return MixedEffectBase.create({
        layer: 'Base',
        kind: 'Mixed',
      });
    case 'Off':
      return OffEffectBase.create({
        layer: 'Base',
        kind: 'Off',
      });
  }
}
function getDefaultReactiveEffects(effectKind: ReactiveEffectKind): ReactiveEffectInstance;
function getDefaultReactiveEffects(effectKind: string): ReactiveEffectInstance | undefined;
function getDefaultReactiveEffects(effectKind: string) {
  switch (effectKind) {
    case 'Fade':
      return createReactiveZoneEffect({
        kind: 'Fade',
        speedPercent: 0.7,
        keyEvent: KeyboardMouseLightingKeyTrigger.Pressed,
        color: {
          kind: 'Color',
          r: 81,
          g: 0,
          b: 121,
        },
      });
    case 'Line':
      return createReactiveZoneEffect({
        kind: effectKind,
        keyEvent: KeyboardMouseLightingKeyTrigger.Pressed,
        speedPercent: 0.7,
        color: {
          kind: 'Color',
          r: 81,
          g: 0,
          b: 121,
        },
      });
    case 'Ripple':
      return createReactiveZoneEffect({
        kind: effectKind,
        keyEvent: KeyboardMouseLightingKeyTrigger.Pressed,
        speedPercent: 0.7,
        color: {
          kind: 'Color',
          color: {
            r: 81,
            g: 0,
            b: 121,
          },
          size: {
            value: 3,
          },
        },
      });
    case 'Mixed':
      return MixedEffectReactive.create({
        layer: 'Reactive',
        kind: 'Mixed',
      });
    case 'Off':
      return OffEffectReactive.create({
        layer: 'Reactive',
        kind: 'Off',
      });
  }
}
function getEffectCacheKey({ layer, kind }: { layer: string; kind: string }) {
  return `${layer}-${kind}`;
}
function getEffectSettingsSnapshot({
  effectInfo,
  isPerimeter = false,
}: {
  effectInfo: LightingEffectInfo;
  isPerimeter?: boolean;
}) {
  const key = getEffectCacheKey({
      layer: isPerimeter ? 'Perimeter' : effectInfo.effectLayer,
      kind: effectInfo.effectName,
    }),
    effect = effectSettingsCache.get(key);
  if (effect)
    switch (effect.layer) {
      case 'Base':
        return BaseZoneEffectSettings.create(effect);
      case 'Reactive':
        return ReactiveZoneEffectSettings.create(effect);
    }
  return (function getDefaultEffect(effectInfo: LightingEffectInfo) {
    switch (effectInfo.effectLayer) {
      case KeyboardEffectLayer.Base:
        return getDefaultBaseEffects(effectInfo.effectName);
      case KeyboardEffectLayer.Reactive:
        return getDefaultReactiveEffects(effectInfo.effectName);
    }
  })(effectInfo);
}
function setEffectSnapshot({
  effectSettings,
  isPerimeter = false,
}: {
  effectSettings: BaseEffectInstance | ReactiveEffectInstance;
  isPerimeter?: boolean;
}) {
  const key = getEffectCacheKey({
    layer: isPerimeter ? 'Perimeter' : effectSettings.layer,
    kind: effectSettings.kind,
  });
  effectSettingsCache.set(key, getSnapshot(effectSettings));
}
export {
  effectSettingsCache,
  getDefaultBaseEffects,
  getDefaultReactiveEffects,
  getEffectCacheKey,
  getEffectSettingsSnapshot,
  setEffectSnapshot,
};
