import { types, cast, clone, type Instance, type SnapshotIn, type SnapshotOrInstance } from 'mobx-state-tree';
import { v4 } from 'uuid';
import { KeyboardKeyCodes } from '../layouts/keyboardKeys.js';
import { KeyboardSettings } from './KeyboardSettings.js';
import { KeyboardBaseZone, KeyboardReactiveZone, KeyboardPerimeterZone,
  type KeyboardBaseZoneInstance, type KeyboardReactiveZoneInstance } from './KeyboardZone.js';
import { BaseZoneEffectSettings } from './BaseZoneEffects.js';
import { ReactiveZoneEffectSettings } from './ReactiveZoneEffects.js';
import { NO_BASE_ZONE, NO_REACTIVE_ZONE, NO_BASE_ZONE_PERIMETER, type ZoneEditingDevice } from './defaultZones.js';
import { areZonesEqual } from './effectUtils.js';
import { DEFAULT_PROFILE_ID } from './profileConstants.js';

export function isValidZone(zone: { keys: readonly number[]; effectSettings: { kind: string } }) {
  return zone.keys.filter((key) => key !== KeyboardKeyCodes.Copilot).length > 0 && zone.effectSettings.kind !== 'Off';
}

/** Profile settings and zone editing; hardware synchronization remains outside this model. */
export const BaseKeyboardProfile = types.model('BaseKeyboardProfile', {
  id: types.string,
  originId: types.maybe(types.string),
  name: types.optional(types.string, ''),
  lastSelected: types.optional(types.number, () => Date.now()),
  hardwareProfileId: types.maybe(types.number),
  settings: KeyboardSettings,
  keyBrightness: types.optional(types.number,.8),
  perimeterBrightness: types.optional(types.number,.8),
})
  .volatile(() => ({ deniedBaseZoneMax: false, deniedReactiveZoneMax: false, copiedSettings: false }))
  .views((self) => ({
    get canBeDeleted() { return self.id !== DEFAULT_PROFILE_ID && self.hardwareProfileId === undefined; },
    get isHardwareProfile() { return self.hardwareProfileId !== undefined; },
    baseZoneFromKey(key?: number) {
      return self.settings.baseZones.find((zone) => key !== undefined && zone.keys.includes(key)) || NO_BASE_ZONE;
    },
    reactiveZoneFromKey(key?: number) {
      return self.settings.reactiveZones.find((zone) => key !== undefined && zone.keys.includes(key)) || NO_REACTIVE_ZONE;
    },
    get perimeterZone() { return self.settings.perimeterZones[0] || NO_BASE_ZONE_PERIMETER; },
  }))
  .actions((self) => ({
    setName(name: string) { self.name = name; },
    setBrightness(channel:'keys'|'ring',value:number) { if(!Number.isFinite(value)||value<0||value>1)throw Error('Invalid brightness');if(channel==='keys')self.keyBrightness=value;else self.perimeterBrightness=value; },
    assignKeysToBaseZoneSnapshot(zones: KeyboardBaseZoneInstance[], keys: number[], effectSettings: SnapshotOrInstance<typeof BaseZoneEffectSettings>) {
      const matching = zones.find((zone) => areZonesEqual(zone.effectSettings, effectSettings));
      if (matching) { matching.addKeys(keys); return; }
      zones.push(KeyboardBaseZone.create({ id: v4(), keys, effectSettings }));
    },
    assignKeysToReactiveZoneSnapshot(zones: KeyboardReactiveZoneInstance[], keys: number[], effectSettings: SnapshotOrInstance<typeof ReactiveZoneEffectSettings>) {
      const matching = zones.find((zone) => areZonesEqual(zone.effectSettings, effectSettings));
      if (matching) { matching.addKeys(keys); return; }
      zones.push(KeyboardReactiveZone.create({ id: v4(), keys, effectSettings }));
    },
    copySettingsFrom(settings: SnapshotOrInstance<typeof KeyboardSettings>) {
      self.settings = cast(settings); self.copiedSettings = true;
    },
    clearCopiedSettings() { self.copiedSettings = false; },
    cleanEmptyZones(layer?: 'Base' | 'Reactive') {
      if (!layer || layer === 'Base') self.settings.baseZones = cast(self.settings.baseZones.filter((zone) => zone.keys.length));
      if (!layer || layer === 'Reactive') self.settings.reactiveZones = cast(self.settings.reactiveZones.filter((zone) => zone.keys.length));
    },
    modifyPerimeterZones(ledCount: number, effectSettings: SnapshotOrInstance<typeof BaseZoneEffectSettings>) {
      const zone = KeyboardPerimeterZone.create({ id: v4(),
        leds: Array.from({ length: ledCount }, (_, index) => index), effectSettings });
      self.settings.perimeterZones = cast([zone]);
      self.settings.setPerimeterZonesToUpdate([zone]);
    },
    setDenyBaseZoneMax(value: boolean) { self.deniedBaseZoneMax = value; },
    setDenyReactiveZoneMax(value: boolean) { self.deniedReactiveZoneMax = value; },
  }))
  .actions((self) => ({
    moveKeysToZone(device: ZoneEditingDevice, keys: number[],
      effectSettings: SnapshotOrInstance<typeof BaseZoneEffectSettings> | SnapshotOrInstance<typeof ReactiveZoneEffectSettings>) {
      const { maxNumberOfBaseEffects, maxNumberOfReactiveEffects } = device.capabilityData.keyboardMouseLighting;
      if (effectSettings.layer === 'Base') {
        self.setDenyBaseZoneMax(false);
        let zones = self.settings.baseZones.map((zone) => clone(zone));
        for (const zone of zones) zone.removeKeys(keys);
        zones = zones.filter(isValidZone);
        self.assignKeysToBaseZoneSnapshot(zones, keys, effectSettings);
        if (zones.length <= maxNumberOfBaseEffects) {
          self.settings.setBaseZones(zones); self.settings.setBaseZonesToUpdate(zones);
        } else self.setDenyBaseZoneMax(true);
      } else if (effectSettings.layer === 'Reactive') {
        self.setDenyReactiveZoneMax(false);
        let zones = self.settings.reactiveZones.map((zone) => clone(zone));
        for (const zone of zones) zone.removeKeys(keys);
        zones = zones.filter(isValidZone);
        self.assignKeysToReactiveZoneSnapshot(zones, keys, effectSettings);
        if (zones.length <= maxNumberOfReactiveEffects) {
          self.settings.setReactiveZones(zones); self.settings.setReactiveZonesToUpdate(zones);
        } else self.setDenyReactiveZoneMax(true);
      }
    },
  }));

export const HardwareKeyboardProfile = types.compose('HardwareKeyboardProfile', BaseKeyboardProfile,
  types.model({ hardwareProfileId: types.number }));
export const KeyboardProfile = types.union(BaseKeyboardProfile, HardwareKeyboardProfile);
export type KeyboardProfileInstance = Instance<typeof KeyboardProfile>;
export type KeyboardProfileSnapshot = SnapshotIn<typeof KeyboardProfile>;
export type HardwareKeyboardProfileInstance = Instance<typeof HardwareKeyboardProfile>;
