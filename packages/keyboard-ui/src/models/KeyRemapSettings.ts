import { getParent, getSnapshot, types, type Instance, type SnapshotIn } from 'mobx-state-tree';
import logger from '../../../ui-platform/src/logger.cjs';
import { Remap, type RemapInstance } from './Remap.js';
import { SingleActuation, DualActuation } from './Actuation.js';
import { SnapOverrideConfig, type SnapOverrideConfigInstance } from './SnapOverrideSettings.js';

/** An output-only key has no configurable actuation depth. */
export const NoActuationActive = types.model({
  kind: types.literal('NoConfigurableActuation'),
  remapTo: Remap,
}).actions((self) => ({
  setRemapTo(remapTo: RemapInstance) { self.remapTo = remapTo; },
}));

export const SingleActive = types.model({
  kind: types.literal('Single'),
  remapTo: Remap,
  actuation: SingleActuation,
  fnPressed: types.maybeNull(types.model({ remapTo: Remap })),
}).actions((self) => ({
  setRemapTo(remapTo: RemapInstance) { self.remapTo = remapTo; },
  setFnRemapTo(remapTo: RemapInstance) {
    if (self.fnPressed) self.fnPressed.remapTo = remapTo;
    else logger.warn(`No fn model for key: ${getParent<{ physicalKey: number }>(self)?.physicalKey}`);
  },
}));

export const DualActive = types.model({
  kind: types.literal('Dual'),
  remapTo: types.array(Remap),
  actuation: DualActuation,
  fnPressed: types.maybeNull(types.model({ remapTo: types.array(Remap) })),
}).actions((self) => ({
  setRemapTo(remapTo: RemapInstance, level: number) { self.remapTo[level] = remapTo; },
  setFnRemapTo(remapTo: RemapInstance, level: number) {
    if (self.fnPressed) self.fnPressed.remapTo[level] = remapTo;
    else logger.warn(`No fn model for key: ${getParent<{ physicalKey: number }>(self)?.physicalKey}`);
  },
}));

/** One physical key's base/Fn mappings and actuation configuration.
 * Levels are indices into the device's supported-depth tables. Switching modes intentionally
 * rebuilds Fn mappings from the base output, matching the recovered editor.
 */
export const PhysicalKeyModel = types.model({
  physicalKey: types.identifierNumber,
  active: types.union(NoActuationActive, SingleActive, DualActive),
}).actions((self) => ({
  switchActuation(type: 'Single' | 'Dual') {
    if (self.active.kind === 'NoConfigurableActuation')
      throw new Error('NoConfigurableActuation cannot be switched');
    if (type === 'Single' && self.active.kind === 'Dual') {
      const remapTo = self.active.remapTo[0];
      if (remapTo === undefined) throw new Error('Cannot switch to Single with undefined remapTo');
      self.active = SingleActive.create({
        kind: 'Single',
        remapTo: getSnapshot(remapTo),
        fnPressed: { remapTo: getSnapshot(remapTo) },
        actuation: { level: self.active.actuation.level1, isRapidTrigger: false },
      });
    } else if (type === 'Dual' && self.active.kind === 'Single') {
      self.active = DualActive.create({
        kind: 'Dual',
        remapTo: [getSnapshot(self.active.remapTo), getSnapshot(self.active.remapTo)],
        fnPressed: {
          remapTo: [getSnapshot(self.active.remapTo), getSnapshot(self.active.remapTo)],
        },
        actuation: { level1: 16, level2: 34 },
      });
    }
  },
  resetActuationToSingle(defaultLevel: number) {
    if (self.active.kind === 'NoConfigurableActuation')
      throw new Error('Actuation:NoConfigurableActuation cannot be reset');
    switch (self.active.kind) {
      case 'Single':
        self.active.actuation = SingleActuation.create({ level: defaultLevel });
        break;
      case 'Dual': {
        const remapTo = self.active.remapTo[0];
        if (!remapTo) throw new Error('Cannot reset actuation to Single with undefined remapTo');
        self.active = SingleActive.create({
          kind: 'Single',
          remapTo: getSnapshot(remapTo),
          fnPressed: { remapTo: getSnapshot(remapTo) },
          actuation: { level: defaultLevel, isRapidTrigger: false },
        });
        break;
      }
    }
  },
  updateActuationLevel(level1: number, level2?: number) {
    if (self.active.kind === 'Single') self.active.actuation.setLevel(level1);
    if (self.active.kind === 'Dual' && level2 !== undefined) {
      self.active.actuation.setLevel1(level1);
      self.active.actuation.setLevel2(level2);
    }
  },
}));

export const PhysicalKeyModelMap = types.map(PhysicalKeyModel);
export const SoftwareKeyRemapSettings = types.model({
  profileId: types.identifier,
  kind: types.literal('Software'),
  physicalKeys: PhysicalKeyModelMap,
  snapOverrideConfigs: types.array(SnapOverrideConfig),
}).actions((self) => ({
  removeSnapOverride(config: SnapOverrideConfigInstance) { self.snapOverrideConfigs.remove(config); },
}));

export const HardwareKeyRemapSettings = types.model({
  profileId: types.identifierNumber,
  kind: types.literal('Hardware'),
  physicalKeys: PhysicalKeyModelMap,
  snapOverrideConfigs: types.array(SnapOverrideConfig),
  isSyncedToDevice: types.optional(types.boolean, true),
}).actions((self) => ({
  setIsSynced(isSyncedToDevice: typeof self.isSyncedToDevice) {
    self.isSyncedToDevice = isSyncedToDevice;
  },
  removeSnapOverride(config: SnapOverrideConfigInstance) { self.snapOverrideConfigs.remove(config); },
}));

export type PhysicalKeyInstance = Instance<typeof PhysicalKeyModel>;
export type PhysicalKeySnapshot = SnapshotIn<typeof PhysicalKeyModel>;
export type SoftwareKeyRemapInstance = Instance<typeof SoftwareKeyRemapSettings>;
export type HardwareKeyRemapInstance = Instance<typeof HardwareKeyRemapSettings>;
export type SoftwareKeyRemapSnapshot = SnapshotIn<typeof SoftwareKeyRemapSettings>;
export type HardwareKeyRemapSnapshot = SnapshotIn<typeof HardwareKeyRemapSettings>;
