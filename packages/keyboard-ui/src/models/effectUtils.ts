import type { KeyboardLayoutDevice } from '../layouts/types.js';
import type { BaseZoneEffectSettingsValue } from './BaseZoneEffects.js';
import type {
  KeyboardBaseZoneValue,
  KeyboardReactiveZoneValue,
  KeyboardPerimeterZoneValue,
} from './KeyboardZone.js';
import * as mobx from 'mobx';
import { getKeyboardInfo } from '../layouts/keyboardInfo.js';
import { KeyboardMouseLightingDirection } from './keyboardEnums.js';
import * as colorUtils from '../theme/color.js';
/** areZonesEqual. Recovered from src/renderer/keyboard/v2/lib/effectUtils.ts. */
function areZonesEqual(zoneA: { kind: string }, zoneB: { kind: string }) {
  if (zoneA.kind !== zoneB.kind) return false;
  function compare(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (typeof left !== typeof right) return false;
    if (typeof left !== 'object' || left === null || right === null) return false;
    if (Array.isArray(left) && Array.isArray(right))
      return (
        left.length === right.length && left.every((item, index) => compare(item, right[index]))
      );
    const a = left as Record<string, unknown>,
      b = right as Record<string, unknown>,
      keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => (key === 'id' && a[key] !== b[key]) || compare(a[key], b[key]))
    );
  }
  return compare(
    mobx.isObservable(zoneA) ? mobx.toJS(zoneA) : zoneA,
    mobx.isObservable(zoneB) ? mobx.toJS(zoneB) : zoneB,
  );
}
/** getMaxWaveSize. Recovered from src/renderer/keyboard/v2/lib/effectUtils.ts. */
function getMaxWaveSize(device: KeyboardLayoutDevice, colorKind: string, direction?: string) {
  const { width: width } = getKeyboardInfo(device)!;
  switch (colorKind) {
    case 'Rainbow':
      return 2;
    case 'Color':
      switch (direction) {
        case KeyboardMouseLightingDirection.Up:
        case KeyboardMouseLightingDirection.Down:
        case KeyboardMouseLightingDirection.Left:
        case KeyboardMouseLightingDirection.Right:
          return 10;
        case KeyboardMouseLightingDirection.Radial:
        case KeyboardMouseLightingDirection.RadialReverse:
          return width / 2 - 1;
      }
  }
}
/** getCoreBaseEffect. Recovered from src/renderer/keyboard/v2/lib/effectUtils.ts. */
function getCoreBaseEffect(effectSettings: BaseZoneEffectSettingsValue) {
  let effect;
  switch (effectSettings.kind) {
    case 'Color':
      effect = effectSettings;
      break;
    case 'CoveringMarquee':
      switch (effectSettings.color.kind) {
        case 'Gradient':
          effect = {
            ...effectSettings,
            color: {
              ...effectSettings.color,
              gradient: effectSettings.color.gradient.map(colorUtils.toCoreColorStop),
            },
          };
          break;
        case 'Rainbow':
        case 'Random':
          effect = {
            ...effectSettings,
            color: effectSettings.color,
          };
      }
      break;
    case 'PulseColor':
      switch (effectSettings.color.kind) {
        case 'Rainbow':
        case 'Random':
          effect = {
            ...effectSettings,
            color: effectSettings.color,
          };
          break;
        case 'Colors':
          effect = (0, mobx.toJS)(effectSettings);
      }
      break;
    case 'ShiftColor':
      switch (effectSettings.color.kind) {
        case 'Rainbow':
        case 'Random':
          effect = {
            ...effectSettings,
            color: effectSettings.color,
          };
          break;
        case 'Gradient':
          effect = {
            ...effectSettings,
            color: {
              ...effectSettings.color,
              gradient: effectSettings.color.gradient.map(colorUtils.toCoreColorStop),
            },
          };
      }
      break;
    case 'SolidGradient':
    case 'SolidGradient2':
      effect = {
        ...effectSettings,
        gradient: effectSettings.gradient.map(colorUtils.toCoreColorStop),
      };
      break;
    case 'Wave':
      switch (effectSettings.color.kind) {
        case 'Color':
        case 'Rainbow':
          effect = {
            ...effectSettings,
            color: effectSettings.color,
          };
          break;
        case 'Gradient':
          effect = {
            ...effectSettings,
            color: {
              ...effectSettings.color,
              gradient: effectSettings.color.gradient.map(colorUtils.toCoreColorStop),
            },
          };
      }
  }
  return effect;
}
/** getCoreBaseEffectPerLed. Recovered from src/renderer/keyboard/v2/lib/effectUtils.ts. */
function getCoreBaseEffectPerLed(
  zones: readonly Pick<KeyboardPerimeterZoneValue, 'leds' | 'effectSettings'>[],
) {
  return zones
    .map((zone) => ({
      leds: [...zone.leds],
      effect: getCoreBaseEffect(zone.effectSettings),
    }))
    .filter((effectPerKey) => void 0 !== effectPerKey.effect);
}
/** getCoreBaseEffectPerKey. Recovered from src/renderer/keyboard/v2/lib/effectUtils.ts. */
function getCoreBaseEffectPerKey(
  zones: readonly Pick<KeyboardBaseZoneValue, 'keys' | 'effectSettings'>[],
) {
  return zones
    .map((zone) => ({
      keys: zone.keys.map((key) => key),
      effect: getCoreBaseEffect(zone.effectSettings),
    }))
    .filter((effectPerKey) => void 0 !== effectPerKey.effect);
}
/** getCoreReactiveEffectPerKey. Recovered from src/renderer/keyboard/v2/lib/effectUtils.ts. */
function getCoreReactiveEffectPerKey(
  zones: readonly Pick<KeyboardReactiveZoneValue, 'keys' | 'effectSettings'>[],
) {
  return zones
    .map((zone) => {
      let effect;
      const { effectSettings: effectSettings } = zone;
      switch (effectSettings.kind) {
        case 'Line':
          switch (effectSettings.color.kind) {
            case 'Rainbow':
            case 'Random':
              effect = {
                ...effectSettings,
                color: effectSettings.color,
              };
              break;
            case 'Color':
              effect = {
                ...effectSettings,
                color: {
                  ...effectSettings.color,
                },
              };
              break;
            case 'Gradient':
              effect = {
                ...effectSettings,
                color: {
                  ...effectSettings.color,
                  gradient: effectSettings.color.gradient.map(colorUtils.toCoreColorStop),
                },
              };
          }
          break;
        case 'Ripple':
          switch (effectSettings.color.kind) {
            case 'Color':
            case 'Rainbow':
            case 'Random':
              effect = {
                ...effectSettings,
                color: effectSettings.color,
              };
              break;
            case 'Gradient':
              effect = {
                ...effectSettings,
                color: {
                  ...effectSettings.color,
                  gradient: effectSettings.color.gradient.map(colorUtils.toCoreColorStop),
                },
              };
          }
          break;
        case 'Fade':
          switch (effectSettings.color.kind) {
            case 'Rainbow':
            case 'Random':
              effect = {
                ...effectSettings,
                color: effectSettings.color,
              };
              break;
            case 'Color':
              effect = effectSettings;
          }
      }
      return {
        keys: zone.keys.map((key) => key),
        effect: effect,
      };
    })
    .filter((effectPerKey) => void 0 !== effectPerKey.effect);
}
export {
  areZonesEqual,
  getMaxWaveSize,
  getCoreBaseEffect,
  getCoreBaseEffectPerLed,
  getCoreBaseEffectPerKey,
  getCoreReactiveEffectPerKey,
};
