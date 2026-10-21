import {
  cast,
  clone,
  getSnapshot,
  types,
  unprotect,
  type Instance,
  type SnapshotIn,
  type SnapshotOrInstance,
} from 'mobx-state-tree';
import { toJS } from 'mobx';
import { v4 } from 'uuid';
import { i18n } from '../../../ui-platform/src/i18n.cjs';
import logger from '../../../ui-platform/src/logger.cjs';
import { KeyboardKeyCodes } from '../layouts/keyboardKeys.js';
import {
  HardwareKeyRemapSettings,
  SoftwareKeyRemapSettings,
  PhysicalKeyModel,
  type PhysicalKeyInstance,
  type PhysicalKeySnapshot,
} from './KeyRemapSettings.js';
import { RemapMacro, type RemapMacroInstance, type RemapMacroSnapshot } from './RemapMacro.js';
import { RemapSimpleRemap, isRemapTypeSimpleRemap } from './RemapSimple.js';
import { RemapModifier, type RemapModifierSnapshot } from './RemapModifier.js';
import type { RemapInstance } from './Remap.js';
import {
  SnapOverrideConfig,
  type SnapOverrideConfigSnapshot,
} from './SnapOverrideSettings.js';
import {
  fromCoreRemapConfig,
  toCoreRemapConfig,
  toCoreActuationConfig,
  type MacroSlotInfo,
} from './remapConfig.js';
import {
  getValidActuationTypesForDevice,
  getValidPhysicalKeysForRemapForDevice,
} from './remapKeyUtils.js';
import type { KeyboardRemapDevice, RemapProfileId } from './deviceTypes.js';
import type { ActuationConfig } from '../../../backend/src/contracts.cjs';

export const HardwareKeyRemapSettingsMap = types.map(HardwareKeyRemapSettings);
export const SoftwareKeyRemapSettingsMap = types.map(SoftwareKeyRemapSettings);
export const MacroMapModel = types.map(RemapMacro);
export const OrphanMacro = types.model({ profileId: types.identifier, macro: MacroMapModel });
export const OrphanMacroMapModel = types.map(OrphanMacro);
export interface LocatedMacro {
  remapTo: RemapMacroInstance;
  physicalKey?: number;
  level?: number;
}
type KeyActive = { active: PhysicalKeyInstance['active']; physicalKey: number };
type RemapRequest = { physicalKey: number; remapTo: ReturnType<typeof toCoreRemapConfig> };
type ActuationRequest = {
  physicalKey: number;
  actuation: ReturnType<typeof toCoreActuationConfig>;
};
export interface InitialRemapSetting {
  profileId: RemapProfileId;
  physicalKeyToAction: { key: number; active: ActuationConfig }[];
  snapOverrideKeyConfigs: SnapOverrideConfigSnapshot[];
}

function mappedMacros(
  keys: KeyActive[],
  kind: 'Single' | 'NoConfigurableActuation' | 'all',
  isFn = false,
) {
  const result: LocatedMacro[] = [];
  for (const { active, physicalKey } of keys) {
    if (active.kind === 'Single' && (kind === 'Single' || kind === 'all')) {
      if ((!isFn || kind === 'all') && active.remapTo.kind === 'Macro')
        result.push({ remapTo: active.remapTo, physicalKey });
      if ((isFn || kind === 'all') && active.fnPressed?.remapTo.kind === 'Macro')
        result.push({ remapTo: active.fnPressed.remapTo, physicalKey });
    } else if (
      active.kind === 'NoConfigurableActuation' &&
      (kind === active.kind || kind === 'all') &&
      active.remapTo.kind === 'Macro'
    ) {
      result.push({ remapTo: active.remapTo, physicalKey });
    }
  }
  return result;
}

/** Keyboard-only remap state. The renderer's existing transaction coordinator owns I/O.
 * Volatile request arrays retain editor notification semantics; profiles and macro metadata
 * remain snapshots. attachDevice supplies capability data without a CAM controller registry.
 */
export const KeyRemapDeviceProfile = types
  .model('KeyRemapDeviceProfile', {
    deviceUniqueId: types.string,
    deviceType: types.optional(types.string, 'Unknown'),
    activeProfileId: types.maybeNull(
      types.union(
        types.model({ id: types.number, kind: types.literal('Hardware') }),
        types.model({ id: types.string, kind: types.literal('Software') }),
      ),
    ),
    softwareKeyRemapSettingsMap: SoftwareKeyRemapSettingsMap,
    orphanMacroMap: types.optional(OrphanMacroMapModel, {}),
    hardwareMacroInfoMap: types.optional(
      types.map(
        types.model({
          id: types.identifier,
          name: types.string,
          macroId: types.maybe(types.string),
        }),
      ),
      {},
    ),
  })
  .volatile(() => ({
    initialized: false,
    loaded: false,
    isRecordingMacro: false,
    isDraggingMacro: false,
    device: undefined as KeyboardRemapDevice | undefined,
    macroEditId: undefined as string | undefined,
    hardwareKeyRemapSettingsMap: undefined as
      Instance<typeof HardwareKeyRemapSettingsMap> | undefined,
    remapParams: undefined as RemapRequest[] | undefined,
    fnRemapParams: undefined as RemapRequest[] | undefined,
    actuationParams: undefined as ActuationRequest[] | undefined,
    snapOverrideParams: undefined as SnapOverrideConfigSnapshot[] | undefined,
    snapOverridesDirty: false,
  }))
  .views((self) => ({
    get activeProfile() {
      if (self.activeProfileId?.kind === 'Hardware')
        return self.hardwareKeyRemapSettingsMap?.get(String(self.activeProfileId.id));
      if (self.activeProfileId?.kind === 'Software')
        return self.softwareKeyRemapSettingsMap.get(self.activeProfileId.id);
    },
  }))
  .views((self) => ({
    get keyActives(): KeyActive[] {
      return self.activeProfile
        ? [...self.activeProfile.physicalKeys.values()].map(({ active, physicalKey }) => ({
            active,
            physicalKey,
          }))
        : [];
    },
    getKeyActive(physicalKey: number) {
      return self.activeProfile?.physicalKeys.get(String(physicalKey))?.active;
    },
  }))
  .views((self) => ({
    getMacroRemap(macroId: string): LocatedMacro | undefined {
      const orphan = self.orphanMacroMap.get(String(self.activeProfileId?.id))?.macro.get(macroId);
      if (orphan) return { remapTo: orphan };
      for (const { active, physicalKey } of self.keyActives) {
        if (active.kind === 'NoConfigurableActuation' || active.kind === 'Single') {
          if (active.remapTo.kind === 'Macro' && active.remapTo.id === macroId)
            return { remapTo: active.remapTo, physicalKey };
          if (
            active.kind === 'Single' &&
            active.fnPressed?.remapTo.kind === 'Macro' &&
            active.fnPressed.remapTo.id === macroId
          )
            return { remapTo: active.fnPressed.remapTo, physicalKey };
        } else
          for (let level = 0; level < active.remapTo.length; level++) {
            const base = active.remapTo[level],
              fn = active.fnPressed?.remapTo[level];
            if (base?.kind === 'Macro' && base.id === macroId)
              return { remapTo: base, physicalKey, level };
            // The recovered Fn lookup omits level; retain this existing result shape.
            if (fn?.kind === 'Macro' && fn.id === macroId) return { remapTo: fn, physicalKey };
          }
      }
    },
    get orphanMacros(): LocatedMacro[] {
      const orphan = self.orphanMacroMap.get(String(self.activeProfileId?.id));
      return orphan
        ? [...orphan.macro.values()].map((remapTo) => ({ remapTo, physicalKey: undefined }))
        : [];
    },
  }))
  .views((self) => ({
    get editingMacro() {
      return self.macroEditId ? self.getMacroRemap(self.macroEditId) : undefined;
    },
    unavailableNoActuationMacroButtons(currentMacroId: string) {
      if (!self.device) return [];
      return self.keyActives
        .filter(
          ({ active, physicalKey }) =>
            active.kind !== 'NoConfigurableActuation' ||
            (active.remapTo.kind === 'SimpleRemap' && active.remapTo.targetKeyId !== physicalKey) ||
            (active.remapTo.kind === 'Macro' && active.remapTo.id !== currentMacroId),
        )
        .map(({ physicalKey }) => physicalKey);
    },
    get noActuationMacroRemaps() {
      return [...mappedMacros(self.keyActives, 'NoConfigurableActuation'), ...self.orphanMacros];
    },
    get singleMacroRemaps() {
      return [...mappedMacros(self.keyActives, 'Single'), ...self.orphanMacros].sort((a, b) =>
        b.remapTo.id.localeCompare(a.remapTo.id),
      );
    },
    get singleFnMacroRemaps() {
      return [...mappedMacros(self.keyActives, 'Single', true), ...self.orphanMacros].sort((a, b) =>
        b.remapTo.id.localeCompare(a.remapTo.id),
      );
    },
    get macroRemaps() {
      return [...mappedMacros(self.keyActives, 'all'), ...self.orphanMacros];
    },
  }))
  .actions((self) => ({
    attachDevice(device: KeyboardRemapDevice) {
      self.device = device;
    },
    sendSnapOverrideToCore(config: SnapOverrideConfigSnapshot[]) {
      self.snapOverrideParams = config;
    },
    sendRemapToCore(keys: PhysicalKeyInstance[]) {
      self.remapParams = [
        ...keys.map((key) => ({
          physicalKey: key.physicalKey,
          remapTo: toCoreRemapConfig(key.active, false),
        })),
        ...(self.remapParams ?? []),
      ];
    },
    sendFnRemapToCore(keys: PhysicalKeyInstance[]) {
      self.fnRemapParams = [
        ...keys.map((key) => ({
          physicalKey: key.physicalKey,
          remapTo: toCoreRemapConfig(key.active, true),
        })),
        ...(self.fnRemapParams ?? []),
      ];
    },
    sendActuationToCore(keys: PhysicalKeyInstance[]) {
      if (!self.device) return;
      const valid = getValidActuationTypesForDevice(self.device);
      self.actuationParams = [
        ...keys.map((key) => ({
          physicalKey: key.physicalKey,
          actuation: toCoreActuationConfig(key.active, valid),
        })),
        ...(self.actuationParams ?? []),
      ];
    },
    resetRemapParams() {
      self.remapParams = undefined;
    },
    resetFnRemapParams() {
      self.fnRemapParams = undefined;
    },
    resetActuationParams() {
      self.actuationParams = undefined;
    },
    resetSnapOverrideParams() {
      self.snapOverrideParams = undefined;
    },
    setSnapOverridesDirty(value: boolean) {
      self.snapOverridesDirty = value;
    },
    setDeviceType(deviceType: string) {
      self.deviceType = deviceType;
    },
    setMacroEditId(id?: string) {
      self.macroEditId = id;
    },
    setIsRecordingMacro(value: boolean) {
      self.isRecordingMacro = value;
    },
    setIsDraggingMacro(value: boolean) {
      self.isDraggingMacro = value;
    },
    setLoaded(value = true) {
      self.loaded = value;
    },
    setInitialized() {
      self.initialized = true;
    },
  }))
  .actions((self) => ({
    setActiveProfileId(profileId: RemapProfileId) {
      self.activeProfileId = cast(toJS(profileId));
      if (profileId.kind !== 'Software' || !self.device) return;
      const valid = getValidPhysicalKeysForRemapForDevice(self.device);
      const settings = self.softwareKeyRemapSettingsMap.get(profileId.id);
      if (!settings) return;
      const keys = [...settings.physicalKeys.values()];
      self.sendRemapToCore(
        keys.filter((key) => valid.Base.some((candidate) => candidate.keyId === key.physicalKey)),
      );
      self.sendFnRemapToCore(
        keys.filter((key) => valid.Fn.some((candidate) => candidate.keyId === key.physicalKey)),
      );
      self.sendActuationToCore(keys);
      self.sendSnapOverrideToCore(settings.snapOverrideConfigs);
    },
    resetSimpleRemaps(isFn = false) {
      const keys = [...(self.activeProfile?.physicalKeys.values() ?? [])];
      for (const key of keys) {
        const { active, physicalKey } = key;
        const reset = (remap: RemapInstance) => {
          if (isRemapTypeSimpleRemap(remap) && remap.targetKeyId !== physicalKey)
            remap.setTargetKeyId(physicalKey);
        };
        if (active.kind === 'NoConfigurableActuation') reset(active.remapTo);
        else if (active.kind === 'Single')
          reset(isFn && active.fnPressed ? active.fnPressed.remapTo : active.remapTo);
        else (isFn && active.fnPressed ? active.fnPressed.remapTo : active.remapTo).forEach(reset);
      }
      self.sendRemapToCore(keys);
      if (isFn) self.sendFnRemapToCore(keys);
    },
    resetSnapOverrides() {
      if (!self.activeProfile) return;
      const settings = self.softwareKeyRemapSettingsMap.get(String(self.activeProfileId?.id));
      if (settings) {
        settings.snapOverrideConfigs.clear();
        self.sendSnapOverrideToCore(settings.snapOverrideConfigs);
      }
    },
    updateSimpleRemap(
      physicalKey: number,
      targetKeyId: number,
      level = 0,
      isFn = false,
      modifier?: RemapModifierSnapshot['modifier'],
    ) {
      const target = self.activeProfile?.physicalKeys.get(String(physicalKey));
      if (!target)
        throw new Error(`Failed to update simple remap: target key ${physicalKey} not found.`);
      const remap = modifier
        ? RemapModifier.create({ kind: 'Modifier', modifier })
        : RemapSimpleRemap.create({ kind: 'SimpleRemap', targetKeyId });
      if (target.active.kind === 'NoConfigurableActuation') target.active.setRemapTo(remap);
      else if (target.active.kind === 'Single') {
        if (isFn && target.active.fnPressed) {
          target.active.setFnRemapTo(remap);
          self.sendFnRemapToCore([target]);
          return;
        }
        target.active.setRemapTo(remap);
      } else {
        if (isFn && target.active.fnPressed) {
          target.active.setFnRemapTo(remap, level);
          self.sendFnRemapToCore([target]);
          return;
        }
        target.active.setRemapTo(remap, level);
      }
      self.sendRemapToCore([target]);
    },
    updateSnapOverrideConfigs(configs: SnapshotOrInstance<typeof SnapOverrideConfig>[]) {
      if (self.activeProfile) {
        self.activeProfile.snapOverrideConfigs.replace(configs);
        self.sendSnapOverrideToCore(configs);
      }
    },
  }))
  .actions((self) => ({
    addMacro(name?: string, macroAction?: RemapMacroSnapshot['action']) {
      if (!self.activeProfileId) throw new Error('No active profile');
      const profileId = String(self.activeProfileId.id);
      if (!self.orphanMacroMap.has(profileId)) self.orphanMacroMap.put({ profileId, macro: {} });
      const id = `${Date.now()}-${v4()}`;
      self.orphanMacroMap.get(profileId)?.macro.put(
        RemapMacro.create({
          id,
          kind: 'Macro',
          name: name || i18n.t('mouse:macroNew'),
          action: macroAction ?? {
            repeatCount: { kind: 'Count', nonZeroCount: 1 },
            targetKeys: [],
          },
        }),
      );
      self.setMacroEditId(id);
    },
    removeHardwareMacroInfo(physicalKey: number, level = 0, isFn = false) {
      if (!self.activeProfileId) throw new Error('No active profile');
      self.hardwareMacroInfoMap.delete(
        `${self.activeProfileId.id}_${physicalKey}_${level}${isFn ? '_fn' : ''}`,
      );
    },
    storeHardwareMacroInfo(
      name: string,
      macroId: string,
      physicalKey?: number,
      level = 0,
      isFn = false,
    ) {
      if (!self.activeProfileId) throw new Error('No active profile');
      if (physicalKey === undefined)
        return void console.log(
          `Skip to store hardware macro name: macro id ${macroId} is an orphan macro.`,
        );
      if (!self.getMacroRemap(macroId))
        throw new Error(`Failed to store hardware macro name: macro id ${macroId} not found.`);
      self.hardwareMacroInfoMap.put({
        id: `${self.activeProfileId.id}_${physicalKey}_${level}${isFn ? '_fn' : ''}`,
        name,
        macroId,
      });
    },
  }))
  .actions((self) => ({
    cloneMacro(macroId: string) {
      const original = self.getMacroRemap(macroId);
      if (!original) throw new Error(`Failed to clone macro: original macro:${macroId} not found.`);
      self.addMacro(
        `${original.remapTo.name} - ${i18n.t('keyboard:copy')}`,
        getSnapshot(original.remapTo.action),
      );
    },
    reserveReplacedMacro(remap: RemapInstance) {
      if (remap.kind !== 'Macro') return;
      const original = self.getMacroRemap(remap.id);
      if (original) self.addMacro(original.remapTo.name, getSnapshot(original.remapTo.action));
    },
    deleteMacro(macroId: string, isFn = false) {
      const target = self.getMacroRemap(macroId);
      if (!target)
        return void logger.warn(`Failed to delete macro: macro id:${macroId} not found.`);
      self.orphanMacroMap.get(String(self.activeProfileId?.id))?.macro.delete(macroId);
      if (target.physicalKey !== undefined) {
        self.updateSimpleRemap(target.physicalKey, target.physicalKey, target.level, isFn);
        self.removeHardwareMacroInfo(target.physicalKey, target.level, isFn);
      }
    },
    resetMacroPhysicalKey(macroId: string, isFn = false) {
      const target = self.getMacroRemap(macroId);
      if (!target) throw new Error(`Failed to reset macro: macro id:${macroId} not found.`);
      if (target.physicalKey === undefined)
        return void logger.warn(`${macroId} is already an orphan macro.`);
      self.orphanMacroMap.get(String(self.activeProfileId?.id))?.macro.put(clone(target.remapTo));
      self.updateSimpleRemap(target.physicalKey, target.physicalKey, target.level, isFn);
      self.removeHardwareMacroInfo(target.physicalKey, target.level, isFn);
    },
    switchMacroPhysicalKeyLayer(macroId: string, physicalKey: number, oldLayerIsFn: boolean) {
      const target = self.activeProfile?.physicalKeys.get(String(physicalKey));
      if (!target)
        throw new Error(`Failed to update macro: physical key ${physicalKey} not found.`);
      const original = self.getMacroRemap(macroId);
      if (!original)
        return void logger.warn(`${macroId} is an orphan macro. Don't need to switch layer.`);
      const macro = clone(original.remapTo);
      if (target.active.kind !== 'Single' || !target.active.fnPressed) return;
      self.updateSimpleRemap(physicalKey, physicalKey, 0, oldLayerIsFn);
      if (oldLayerIsFn) {
        target.active.setRemapTo(macro);
        self.sendRemapToCore([target]);
      } else {
        target.active.setFnRemapTo(macro);
        self.sendFnRemapToCore([target]);
      }
    },
    updateMacroPhysicalKey(macroId: string, physicalKey: number, level = 0, isFn = false) {
      const target = self.activeProfile?.physicalKeys.get(String(physicalKey));
      if (!target)
        throw new Error(`Failed to update macro: physical key ${physicalKey} not found.`);
      const orphans = self.orphanMacroMap.get(String(self.activeProfileId?.id));
      const orphan = orphans?.macro.get(macroId);
      if (orphan) {
        switch (target.active.kind) {
          case 'NoConfigurableActuation':
            target.active.setRemapTo(clone(orphan, false));
            self.sendRemapToCore([target]);
            break;
          case 'Single':
            if (isFn && target.active.fnPressed) {
              target.active.setFnRemapTo(clone(orphan, false));
              self.sendFnRemapToCore([target]);
            } else {
              target.active.setRemapTo(clone(orphan, false));
              self.sendRemapToCore([target]);
            }
            break;
          case 'Dual':
            if (isFn && target.active.fnPressed) {
              target.active.setFnRemapTo(clone(orphan, false), level);
              self.sendFnRemapToCore([target]);
            } else {
              target.active.setRemapTo(clone(orphan), level);
              self.sendRemapToCore([target]);
            }
        }
        self.storeHardwareMacroInfo(orphan.name, macroId, physicalKey, level);
        orphans?.macro.delete(macroId);
        return;
      }
      const original = self.getMacroRemap(macroId);
      if (!original || original.physicalKey === undefined) return;
      const previous = self.activeProfile?.physicalKeys.get(String(original.physicalKey));
      if (!previous)
        throw new Error(`Failed to update macro: previous key ${original.physicalKey} not found.`);
      if (target.active.kind !== previous.active.kind)
        throw new Error(
          `Failed to update macro: previous kind:${previous.active.kind} and target kind:${target.active.kind} are unmatched.`,
        );
      if (
        previous.active.kind === 'NoConfigurableActuation' &&
        target.active.kind === 'NoConfigurableActuation'
      ) {
        target.active.setRemapTo(clone(previous.active.remapTo));
        self.sendRemapToCore([target]);
      } else if (previous.active.kind === 'Single' && target.active.kind === 'Single') {
        if (isFn && previous.active.fnPressed) {
          target.active.setFnRemapTo(clone(previous.active.fnPressed.remapTo));
          self.sendFnRemapToCore([target]);
        } else {
          target.active.setRemapTo(clone(previous.active.remapTo));
          self.sendRemapToCore([target]);
        }
      } else if (previous.active.kind === 'Dual' && target.active.kind === 'Dual') {
        const source =
          isFn && previous.active.fnPressed
            ? previous.active.fnPressed.remapTo
            : previous.active.remapTo;
        const macro = original.level === undefined ? undefined : source[original.level];
        if (!macro)
          throw new Error(
            `Failed to update macro: previous macro level ${original.level} not found.`,
          );
        if (isFn && previous.active.fnPressed) {
          target.active.setFnRemapTo(clone(macro), level);
          self.sendFnRemapToCore([target]);
        } else {
          target.active.setRemapTo(clone(macro), level);
          self.sendRemapToCore([target]);
        }
      }
      self.updateSimpleRemap(original.physicalKey, original.physicalKey, original.level, isFn);
    },
    switchActuation(keys: PhysicalKeyInstance[], type: 'Single' | 'Dual') {
      keys.forEach((key) => key.switchActuation(type));
      self.sendActuationToCore(keys);
      self.sendRemapToCore(keys);
      self.sendFnRemapToCore(keys);
    },
    resetActuationToSingle(keys: PhysicalKeyInstance[], defaultLevel: number) {
      keys.forEach((key) => key.resetActuationToSingle(defaultLevel));
      self.sendActuationToCore(keys);
      self.sendRemapToCore(keys);
      self.sendFnRemapToCore(keys);
    },
    updateActuationRapid(keys: PhysicalKeyInstance[], rapidTrigger: boolean, sensitivity?: number) {
      keys.forEach((key) => {
        if (key.active.kind === 'Single') {
          key.active.actuation.setRapidTrigger(rapidTrigger);
          if (sensitivity !== undefined) key.active.actuation.setRapidSensitivity(sensitivity);
        }
      });
      self.sendActuationToCore(keys);
    },
    updateActuationRapidSensitivity(keys: PhysicalKeyInstance[], sensitivity: number) {
      keys.forEach((key) => {
        if (key.active.kind === 'Single') key.active.actuation.setRapidSensitivity(sensitivity);
      });
      self.sendActuationToCore(keys);
    },
    resetActuationRapid(keys: PhysicalKeyInstance[]) {
      keys.forEach((key) => {
        if (key.active.kind === 'Single') key.active.actuation.setRapidTrigger(false);
      });
      self.sendActuationToCore(keys);
    },
    updateActuationLevel(keys: PhysicalKeyInstance[], level1: number, level2?: number) {
      keys.forEach((key) => key.updateActuationLevel(level1, level2));
      self.sendActuationToCore(keys);
    },
  }))
  .actions((self) => ({
    resetHardwareKeyRemapSettings() {
      if (self.hardwareKeyRemapSettingsMap) self.hardwareKeyRemapSettingsMap.clear();
      else self.hardwareKeyRemapSettingsMap = HardwareKeyRemapSettingsMap.create({});
      unprotect(self.hardwareKeyRemapSettingsMap);
    },
  }))
  .actions((self) => ({
    addHardwareKeyRemapSetting(
      profileId: Extract<RemapProfileId, { kind: 'Hardware' }>,
      physicalKey: number,
      config: ActuationConfig,
    ) {
      if (!self.device) return;
      if (!self.hardwareKeyRemapSettingsMap) self.resetHardwareKeyRemapSettings();
      const macroInfo: MacroSlotInfo[] = [];
      for (let level = 0; level < (config.kind === 'Dual' ? 2 : 1); level++) {
        const base = self.hardwareMacroInfoMap.get(`${profileId.id}_${physicalKey}_${level}`);
        const fn = self.hardwareMacroInfoMap.get(`${profileId.id}_${physicalKey}_${level}_fn`);
        macroInfo.push({
          name: base?.name,
          macroId: base?.macroId,
          fnName: fn?.name,
          fnMacroId: fn?.macroId,
        });
      }
      const active = fromCoreRemapConfig(
        config,
        macroInfo,
        getValidActuationTypesForDevice(self.device),
      );
      const existing = self.hardwareKeyRemapSettingsMap?.get(String(profileId.id));
      if (existing) existing.physicalKeys.put(PhysicalKeyModel.create({ physicalKey, active }));
      else
        self.hardwareKeyRemapSettingsMap?.put({
          profileId: profileId.id,
          kind: profileId.kind,
          physicalKeys: { [physicalKey]: { physicalKey, active } },
        });
    },
    addHardwareSnapOverride(
      profileId: Extract<RemapProfileId, { kind: 'Hardware' }>,
      config: SnapOverrideConfigSnapshot,
    ) {
      if (!self.device) return;
      if (!self.hardwareKeyRemapSettingsMap) self.resetHardwareKeyRemapSettings();
      const existing = self.hardwareKeyRemapSettingsMap?.get(String(profileId.id));
      if (existing) existing.snapOverrideConfigs.push(SnapOverrideConfig.create(config));
      else
        self.hardwareKeyRemapSettingsMap?.put({
          profileId: profileId.id,
          kind: profileId.kind,
          snapOverrideConfigs: [config],
        });
    },
    resetHardwareSnapOverrides() {
      if (!self.hardwareKeyRemapSettingsMap) self.resetHardwareKeyRemapSettings();
      self.hardwareKeyRemapSettingsMap?.forEach((item) => item.snapOverrideConfigs.clear());
    },
    addSoftwareKeyRemapSetting(
      device: KeyboardRemapDevice,
      defaultKind: 'NoConfigurableActuation' | 'Single' | 'Dual',
      profileId: string,
      keys: number[],
    ) {
      if (!keys.length)
        throw new Error('No physical keys found when adding software key remap setting.');
      const copilot =
        ['FunctionEliteAnsi', 'FunctionEliteIso'].includes(device.deviceType) &&
        device.supportedCapabilities.deviceSpecificData &&
        device.capabilityData.deviceSpecificData?.hardware_id === '1';
      const physicalKeys: Record<string, PhysicalKeySnapshot> = {};
      for (const physicalKey of keys) {
        const targetKeyId =
          copilot && physicalKey === KeyboardKeyCodes.RightControl
            ? KeyboardKeyCodes.Copilot
            : physicalKey;
        if (defaultKind === 'NoConfigurableActuation')
          physicalKeys[physicalKey] = {
            physicalKey,
            active: {
              kind: defaultKind,
              remapTo: { kind: 'SimpleRemap', targetKeyId },
            },
          };
        if (defaultKind === 'Single')
          physicalKeys[physicalKey] = {
            physicalKey,
            active: {
              kind: defaultKind,
              remapTo: { kind: 'SimpleRemap', targetKeyId },
              actuation: { level: 16, isRapidTrigger: false },
              fnPressed: { remapTo: { kind: 'SimpleRemap', targetKeyId } },
            },
          };
      }
      self.softwareKeyRemapSettingsMap.put({ profileId, kind: 'Software', physicalKeys });
    },
    duplicateSoftwareKeyRemapSetting(origin: RemapProfileId, newProfileId: string) {
      const source =
        origin.kind === 'Hardware'
          ? self.hardwareKeyRemapSettingsMap?.get(String(origin.id))
          : self.softwareKeyRemapSettingsMap.get(origin.id);
      if (source)
        self.softwareKeyRemapSettingsMap.put({
          profileId: newProfileId,
          kind: 'Software',
          physicalKeys: getSnapshot(source.physicalKeys),
          snapOverrideConfigs: getSnapshot(source.snapOverrideConfigs),
        });
      else
        logger.error(
          `Failed to duplicate software key remap setting: profile ${origin.id} not found`,
        );
    },
    removeSoftwareKeyRemapSetting(profileId: string) {
      self.softwareKeyRemapSettingsMap.delete(profileId);
    },
    copySoftwareToHardware(softwareProfileId: string, hardwareProfileId: number) {
      const source = self.softwareKeyRemapSettingsMap.get(softwareProfileId);
      if (!source)
        return void logger.error(
          `Failed to copy software to hardware setting: software profile ${softwareProfileId} not found.`,
        );
      if (!self.hardwareKeyRemapSettingsMap?.has(String(hardwareProfileId)))
        return void logger.error(
          `Failed to copy software to hardware setting: hardware profile ${hardwareProfileId} not found.`,
        );
      self.hardwareKeyRemapSettingsMap.put({
        profileId: hardwareProfileId,
        kind: 'Hardware',
        physicalKeys: getSnapshot(source.physicalKeys),
        snapOverrideConfigs: getSnapshot(source.snapOverrideConfigs),
        isSyncedToDevice: false,
      });
    },
  }))
  .actions((self) => ({
    initializeRemaps(remaps: InitialRemapSetting[]) {
      self.resetHardwareKeyRemapSettings();
      for (const setting of remaps) {
        const profileId = setting.profileId;
        if (profileId.kind !== 'Hardware') continue;
        setting.physicalKeyToAction.forEach(({ key, active }) =>
          self.addHardwareKeyRemapSetting(profileId, key, active),
        );
        setting.snapOverrideKeyConfigs.forEach((config) =>
          self.addHardwareSnapOverride(profileId, config),
        );
      }
    },
  }));

export type KeyRemapDeviceProfileInstance = Instance<typeof KeyRemapDeviceProfile>;
export type KeyRemapDeviceProfileSnapshot = SnapshotIn<typeof KeyRemapDeviceProfile>;
