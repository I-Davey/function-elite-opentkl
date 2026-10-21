import { v4 } from 'uuid';
import { getKeyboardInfo } from '../layouts/keyboardInfo.js';
import type { KeyboardLayoutDevice } from '../layouts/types.js';
import { KeyboardBaseZone, KeyboardReactiveZone, KeyboardPerimeterZone } from './KeyboardZone.js';
import { getDefaultBaseEffects, getDefaultReactiveEffects } from './defaultEffects.js';
import { FALLBACK_BASE_KEYBOARD_EFFECT_INFO, FALLBACK_REACTIVE_KEYBOARD_EFFECT_INFO } from './lightingConstants.js';
import { OffEffectBase, OffEffectReactive } from './NeutralEffects.js';

/** Capability fields actually consumed by default creation and zone editing. */
export interface KeyboardLightingDevice extends KeyboardLayoutDevice {
  deviceType: string;
  supportedCapabilities: Record<string, boolean | undefined>;
  capabilityData: KeyboardLayoutDevice['capabilityData'] & {
    keyboardMouseLighting?: {
      supportedRingEffects: { ledCount: number };
      maxNumberOfBaseEffects: number;
      maxNumberOfReactiveEffects: number;
    };
  };
}
export interface ZoneEditingDevice extends KeyboardLayoutDevice {
  capabilityData: KeyboardLayoutDevice['capabilityData'] & {
    keyboardMouseLighting: { maxNumberOfBaseEffects: number; maxNumberOfReactiveEffects: number };
  };
}

export function getDefaultBaseZone(device: KeyboardLightingDevice) {
  if (device.supportedCapabilities.keyboardMouseLighting && device.supportedCapabilities.physicalKeys) {
    const { keys } = getKeyboardInfo(device)!;
    return [KeyboardBaseZone.create({ id: v4(), keys,
      effectSettings: getDefaultBaseEffects(FALLBACK_BASE_KEYBOARD_EFFECT_INFO.effectName) })];
  }
  return [];
}
export function getDefaultReactiveZone(device: KeyboardLightingDevice) {
  if (device.supportedCapabilities.keyboardMouseLighting && device.supportedCapabilities.physicalKeys) {
    const { keys } = getKeyboardInfo(device)!;
    return [KeyboardReactiveZone.create({ id: v4(), keys,
      effectSettings: getDefaultReactiveEffects(FALLBACK_REACTIVE_KEYBOARD_EFFECT_INFO.effectName) })];
  }
  return [];
}
export function getDefaultPerimeterZone(device: KeyboardLightingDevice) {
  if (device.supportedCapabilities.keyboardMouseLighting) {
    // Ready-device capability flags imply matching capability data, as in CAM.
    const { ledCount } = device.capabilityData.keyboardMouseLighting!.supportedRingEffects;
    if (ledCount) return [KeyboardPerimeterZone.create({ id: v4(),
      leds: Array.from({ length: ledCount }, (_, index) => index),
      effectSettings: getDefaultBaseEffects(FALLBACK_BASE_KEYBOARD_EFFECT_INFO.effectName) })];
  }
  return [];
}

export const NO_BASE_ZONE_PERIMETER = KeyboardPerimeterZone.create({
  id: 'NO BASE ZONE PERIMETER', leds: [], effectSettings: OffEffectBase.create({ layer: 'Base', kind: 'Off' }),
});
export const NO_BASE_ZONE = KeyboardBaseZone.create({
  id: 'NO BASE ZONE', keys: [], effectSettings: OffEffectBase.create({ layer: 'Base', kind: 'Off' }),
});
export const NO_REACTIVE_ZONE = KeyboardReactiveZone.create({
  id: 'NO REACTIVE ZONE', keys: [], effectSettings: OffEffectReactive.create({ layer: 'Reactive', kind: 'Off' }),
});
