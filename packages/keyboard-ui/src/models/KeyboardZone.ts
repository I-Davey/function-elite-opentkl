import { types, type Instance, type SnapshotIn, type SnapshotOut } from 'mobx-state-tree';
import { BaseZoneEffectSettings } from './BaseZoneEffects.js';
import { ReactiveZoneEffectSettings } from './ReactiveZoneEffects.js';
import { KeyboardMouseLightingDirection } from './keyboardEnums.js';
import { getKeyCoordinate } from '../layouts/keyboardInfo.js';
import type { KeyboardLayoutDevice } from '../layouts/types.js';
import { OFF_BASE_EFFECT_INFO, KEYBOARD_BASE_EFFECT_INFO_MAP,
  OFF_REACTIVE_EFFECT_INFO, KEYBOARD_REACTIVE_EFFECT_INFO_MAP } from './lightingConstants.js';

/** A physical key selection and its effect; geometry uses the same layout as the UI. */
export const KeyboardCommonZone = types.model({
  id: types.identifier,
  keys: types.array(types.number),
  effectSettings: types.union(BaseZoneEffectSettings, ReactiveZoneEffectSettings),
})
  .views((self) => ({
    getMaxDistanceBetweenKeys(device: KeyboardLayoutDevice) {
      let orientation: 'x' | 'y' = 'x';
      if (self.effectSettings.kind !== 'Off' && self.effectSettings.kind !== 'Mixed') {
        orientation = self.effectSettings.direction === KeyboardMouseLightingDirection.Up ||
          self.effectSettings.direction === KeyboardMouseLightingDirection.Down ? 'y' : 'x';
      }
      let min = Infinity, max = -Infinity;
      for (const key of self.keys) {
        const coordinate = getKeyCoordinate(key, device);
        if (coordinate !== undefined) {
          min = Math.min(min, coordinate[orientation]);
          max = Math.max(max, coordinate[orientation]);
        }
      }
      return { distance: max - min + 1, max, min };
    },
  }))
  .actions((self) => ({
    addKeys(keys: readonly number[]) {
      for (const key of keys) if (!self.keys.includes(key)) self.keys.push(key);
    },
    removeKeys(keys: readonly number[]) {
      self.keys.replace(self.keys.filter((key) => !keys.includes(key)));
    },
  }));

export const KeyboardBaseZone = KeyboardCommonZone.named('BaseZone')
  .props({ effectSettings: BaseZoneEffectSettings })
  .views((self) => ({
    get info() {
      return self.effectSettings.kind === 'Off' ? OFF_BASE_EFFECT_INFO
        : KEYBOARD_BASE_EFFECT_INFO_MAP[self.effectSettings.kind];
    },
  }));
export const KeyboardReactiveZone = KeyboardCommonZone.named('ReactiveZone')
  .props({ effectSettings: ReactiveZoneEffectSettings })
  .views((self) => ({
    get info() {
      return self.effectSettings.kind === 'Off' ? OFF_REACTIVE_EFFECT_INFO
        : KEYBOARD_REACTIVE_EFFECT_INFO_MAP[self.effectSettings.kind];
    },
  }));
export const KeyboardPerimeterZone = types.model({
  id: types.identifier,
  leds: types.array(types.number),
  effectSettings: BaseZoneEffectSettings,
})
  .views((self) => ({
    get info() {
      return self.effectSettings.kind === 'Off' ? OFF_BASE_EFFECT_INFO
        : KEYBOARD_BASE_EFFECT_INFO_MAP[self.effectSettings.kind];
    },
  }));

export type KeyboardBaseZoneInstance = Instance<typeof KeyboardBaseZone>;
export type KeyboardBaseZoneSnapshot = SnapshotIn<typeof KeyboardBaseZone>;
export type KeyboardBaseZoneValue = KeyboardBaseZoneInstance | SnapshotOut<typeof KeyboardBaseZone>;
export type KeyboardReactiveZoneInstance = Instance<typeof KeyboardReactiveZone>;
export type KeyboardReactiveZoneSnapshot = SnapshotIn<typeof KeyboardReactiveZone>;
export type KeyboardReactiveZoneValue = KeyboardReactiveZoneInstance | SnapshotOut<typeof KeyboardReactiveZone>;
export type KeyboardPerimeterZoneInstance = Instance<typeof KeyboardPerimeterZone>;
export type KeyboardPerimeterZoneSnapshot = SnapshotIn<typeof KeyboardPerimeterZone>;
export type KeyboardPerimeterZoneValue = KeyboardPerimeterZoneInstance | SnapshotOut<typeof KeyboardPerimeterZone>;
