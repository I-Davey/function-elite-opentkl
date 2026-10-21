import { types, cast, type Instance, type SnapshotIn, type SnapshotOrInstance } from 'mobx-state-tree';
import { IdleTimeout } from './IdleTimeout.js';
import { PollingRate } from './keyboardEnums.js';
import { KeyboardBaseZone, KeyboardReactiveZone, KeyboardPerimeterZone } from './KeyboardZone.js';
import { getCoreBaseEffectPerKey, getCoreBaseEffectPerLed, getCoreReactiveEffectPerKey } from './effectUtils.js';

export interface DeviceOrigin { fromDevice: boolean }

/** Saved settings plus transient dirty lighting payloads consumed by device synchronization. */
export const KeyboardSettings = types.model({
  fnLockEnabled: types.optional(types.boolean, false),
  gameModeEnabled: types.optional(types.boolean, false),
  idleTimeout: types.optional(IdleTimeout, { disabled: true, timeoutSeconds: 60 }),
  pollingRate: types.optional(types.enumeration('PollingRate', Object.values(PollingRate)), PollingRate.Hz1000),
  baseZones: types.array(KeyboardBaseZone),
  perimeterZones: types.array(KeyboardPerimeterZone),
  reactiveZones: types.array(KeyboardReactiveZone),
})
  .volatile(() => ({
    baseZonesToUpdate: undefined as { kind: 'Base'; config: ReturnType<typeof getCoreBaseEffectPerKey> } | undefined,
    reactiveZonesToUpdate: undefined as { kind: 'Reactive'; config: ReturnType<typeof getCoreReactiveEffectPerKey> } | undefined,
    perimeterZonesToUpdate: undefined as { kind: 'Ring'; config: ReturnType<typeof getCoreBaseEffectPerLed> } | undefined,
    originatedFromDevice: new Set<string>(),
  }))
  .actions((self) => ({
    clearBaseZonesToUpdate() { self.baseZonesToUpdate = undefined; },
    clearReactiveZonesToUpdate() { self.reactiveZonesToUpdate = undefined; },
    clearPerimeterZonesToUpdate() { self.perimeterZonesToUpdate = undefined; },
    setFnLockEnabled(value: boolean) { self.fnLockEnabled = value; },
    setPollingRate(value: typeof self.pollingRate) { self.pollingRate = value; },
    setBaseZones(zones: SnapshotOrInstance<typeof KeyboardBaseZone>[]) { self.baseZones = cast(zones); },
    setPerimeterZones(zones: SnapshotOrInstance<typeof KeyboardPerimeterZone>[]) { self.perimeterZones = cast(zones); },
    setReactiveZones(zones: SnapshotOrInstance<typeof KeyboardReactiveZone>[]) { self.reactiveZones = cast(zones); },
    setBaseZonesToUpdate(zones: Instance<typeof KeyboardBaseZone>[]) {
      self.baseZonesToUpdate = { kind: 'Base', config: getCoreBaseEffectPerKey(zones) };
    },
    setReactiveZonesToUpdate(zones: Instance<typeof KeyboardReactiveZone>[]) {
      self.reactiveZonesToUpdate = { kind: 'Reactive', config: getCoreReactiveEffectPerKey(zones) };
    },
    setPerimeterZonesToUpdate(zones: Instance<typeof KeyboardPerimeterZone>[]) {
      self.perimeterZonesToUpdate = { kind: 'Ring', config: getCoreBaseEffectPerLed(zones) };
    },
    setGameModeEnabled(value: boolean, origin: DeviceOrigin) {
      if (origin.fromDevice) self.originatedFromDevice.add('gameMode');
      else self.originatedFromDevice.delete('gameMode');
      self.gameModeEnabled = value;
    },
  }));

export type KeyboardSettingsInstance = Instance<typeof KeyboardSettings>;
export type KeyboardSettingsSnapshot = SnapshotIn<typeof KeyboardSettings>;
