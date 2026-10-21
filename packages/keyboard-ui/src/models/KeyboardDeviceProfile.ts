import {
  addDisposer,
  clone,
  getEnv,
  getSnapshot,
  types,
  type Instance,
  type SnapshotIn,
  type SnapshotOrInstance,
} from 'mobx-state-tree';
import { observable, reaction } from 'mobx';
import { v4 } from 'uuid';
import fastDeepEqual from 'fast-deep-equal';
import { i18n } from '../../../ui-platform/src/i18n.cjs';
import logger from '../../../ui-platform/src/logger.cjs';
import { getKeyboardInfo } from '../layouts/keyboardInfo.js';
import type { KeyboardLayoutDevice } from '../layouts/types.js';
import { KeyboardInfo } from './KeyboardInfo.js';
import {
  KeyboardProfile,
  type KeyboardProfileInstance,
  type HardwareKeyboardProfileInstance,
} from './KeyboardProfile.js';
import {
  createDefaultKeyboardProfile,
  getDefaultKeyboardProfileSettings,
} from './profileDefaults.js';
import { DEFAULT_PROFILE_ID } from './profileConstants.js';
import {
  KeyboardRegion,
  keyboardRegionFromLanguage,
  type KeyboardRegionValue,
} from './KeyboardRegion.js';
import type { KeyboardReadyDevice } from './deviceTypes.js';
import type { KeyRemapDeviceProfileInstance } from './KeyRemapDeviceProfile.js';
import {
  getEffectSettingsSnapshot,
  setEffectSnapshot,
  type LightingEffectInfo,
} from './defaultEffects.js';
import { BaseZoneEffectSettings } from './BaseZoneEffects.js';
import { ReactiveZoneEffectSettings } from './ReactiveZoneEffects.js';
import type { DeviceOrigin } from './KeyboardSettings.js';
import type { ZoneEditingDevice } from './defaultZones.js';
import { colorsByKey, perimeterGradient } from './lightingPreview.js';
import {
  OFF_BASE_EFFECT_INFO,
  MIXED_BASE_EFFECT_INFO,
  OFF_REACTIVE_EFFECT_INFO,
  MIXED_REACTIVE_EFFECT_INFO,
} from './lightingConstants.js';

/** Concrete composition inputs; models no longer search a broad CAM device/controller registry. */
export interface KeyboardProfileEnvironment {
  keyboardDevice: KeyboardReadyDevice;
  profileLinks: { remap?: KeyRemapDeviceProfileInstance };
}
export type ProfileEditState =
  | { kind: 'edit'; id: string; name: string }
  | { kind: 'add'; name: string; originId: string | undefined };
type Effect = Instance<typeof BaseZoneEffectSettings> | Instance<typeof ReactiveZoneEffectSettings>;

/** Profile editing, lighting selection and previews. The existing renderer owns transactions.
 * Brightness and hardware profiles are transient; saved software profiles retain their schema.
 */
export const KeyboardDeviceProfile = types
  .compose(
    'KeyboardProfileManager',
    KeyboardInfo,
    types.model({
      softwareProfiles: types.array(KeyboardProfile),
      activeProfileId: types.maybe(types.string),
      keyboardRegion: types.optional(
        types.enumeration('KeyboardRegion', Object.values(KeyboardRegion)),
        KeyboardRegion.UNKNOWN,
      ),
    }),
  )
  .volatile(() => ({
    hardwareProfiles: observable.array<HardwareKeyboardProfileInstance>([]),
    profileEditState: undefined as ProfileEditState | undefined,
    keyBrightness: undefined as number | undefined,
    perimeterBrightness: undefined as number | undefined,
    originatedFromDevice: new Set<string>(),
  }))
  .views((self) => ({
    get device() {
      const device = getEnv<KeyboardProfileEnvironment>(self).keyboardDevice;
      return device?.uniqueId === self.deviceUniqueId ? device : undefined;
    },
    get profiles(): KeyboardProfileInstance[] {
      return [
        ...self.hardwareProfiles.slice().sort((a, b) => b.hardwareProfileId - a.hardwareProfileId),
        ...self.softwareProfiles.slice().sort((a, b) => b.lastSelected - a.lastSelected),
      ];
    },
  }))
  .views((self) => ({
    get keyremapProfile() {
      if (self.device?.supportedCapabilities.keyRemap)
        return getEnv<KeyboardProfileEnvironment>(self).profileLinks.remap;
    },
    isValidProfile(id: string) {
      return self.profiles.some((profile) => profile.id === id);
    },
    get activeProfile() {
      return (
        self.profiles.find((profile) => profile.id === self.activeProfileId) ??
        createDefaultKeyboardProfile(self.device)
      );
    },
  }))
  .actions((self) => ({
    removeSoftwareProfile(id: string) {
      const target = self.softwareProfiles.find(profile => profile.id === id);
      if (!target || !target.canBeDeleted) throw Error('This profile cannot be deleted');
      self.keyremapProfile?.removeSoftwareKeyRemapSetting(id);
      self.softwareProfiles.remove(target);
    },
    setKeyBrightness(brightness: number, origin: DeviceOrigin) {
      if (origin.fromDevice) self.originatedFromDevice.add('keyBrightness');
      else self.originatedFromDevice.delete('keyBrightness');
      self.keyBrightness = brightness;
      self.activeProfile.setBrightness('keys',brightness);
    },
    setPerimeterBrightness(brightness: number, origin: DeviceOrigin) {
      if (origin.fromDevice) self.originatedFromDevice.add('perimeterBrightness');
      else self.originatedFromDevice.delete('perimeterBrightness');
      self.perimeterBrightness = brightness;
      self.activeProfile.setBrightness('ring',brightness);
    },
    setKeyremapActiveProfileId(profileId: string) {
      const profile = self.profiles.find((candidate) => candidate.id === profileId);
      self.keyremapProfile?.setActiveProfileId(
        profile?.hardwareProfileId !== undefined
          ? { kind: 'Hardware', id: profile.hardwareProfileId }
          : { kind: 'Software', id: profileId },
      );
    },
    setKeyboardRegion(region: KeyboardRegionValue) {
      self.keyboardRegion = region;
    },
    addSoftwareProfile(
      profile: KeyboardProfileInstance,
      copyFrom?: { id?: string; hardwareProfileId?: number },
    ) {
      self.softwareProfiles.unshift(profile);
      if (copyFrom?.id !== undefined) {
        self.keyremapProfile?.duplicateSoftwareKeyRemapSetting(
          copyFrom.hardwareProfileId !== undefined
            ? { id: copyFrom.hardwareProfileId, kind: 'Hardware' }
            : { id: copyFrom.id, kind: 'Software' },
          profile.id,
        );
      } else if (self.device) {
        const info = getKeyboardInfo(self.device);
        if (!info) throw Error('Unsupported keyboard layout for profile creation');
        self.keyremapProfile?.addSoftwareKeyRemapSetting(
          self.device,
          'Single',
          profile.id,
          info.keys,
        );
      }
    },
    addHardwareProfiles(profiles: HardwareKeyboardProfileInstance[]) {
      for (const profile of profiles) {
        const index = self.hardwareProfiles.findIndex(
          (candidate) => candidate.hardwareProfileId === profile.hardwareProfileId,
        );
        if (index !== -1) self.hardwareProfiles[index] = profile;
        else self.hardwareProfiles.unshift(profile);
      }
    },
    beginProfileEdit(profileId?: string) {
      if (profileId) {
        const profile = self.profiles.find((candidate) => candidate.id === profileId);
        if (!profile) return void logger.warn('Invalid keyboard profile id for editing', profileId);
        self.profileEditState = observable({
          kind: 'edit' as const,
          id: profile.id,
          name:
            profile.id !== DEFAULT_PROFILE_ID || profile.name
              ? profile.name
              : i18n.t('common:default'),
        });
      } else
        self.profileEditState = observable({ kind: 'add' as const, name: '', originId: undefined });
    },
    cancelProfileEdit() {
      self.profileEditState = undefined;
    },
  }))
  .actions((self) => ({
    setActiveProfileId(profileId: string, origin: DeviceOrigin) {
      if (origin.fromDevice) self.originatedFromDevice.add('activeProfileId');
      else self.originatedFromDevice.delete('activeProfileId');
      self.activeProfileId = profileId;
      self.setKeyremapActiveProfileId(profileId);
      const selected=self.profiles.find(profile=>profile.id===profileId);
      if(selected?.hardwareProfileId===undefined && selected && !origin.fromDevice){self.keyBrightness=selected.keyBrightness;self.perimeterBrightness=selected.perimeterBrightness;}
    },
    copyCurrentProfileToHardware(
      hardwareSlot: number,
      backupProfile: boolean,
      backupName?: string,
    ) {
      const target = self.hardwareProfiles.find(
        (profile) => profile.hardwareProfileId === hardwareSlot,
      );
      if (!target)
        return void logger.error(
          `[debug] Keyboard hardware profile ${hardwareSlot} not found for copying`,
        );
      if (backupProfile) {
        if (!backupName) logger.warn('[debug] Keyboard backup profile name not provided');
        self.addSoftwareProfile(
          KeyboardProfile.create({
            id: v4(),
            name: backupName,
            settings: clone(target.settings, false),
          }),
          { id: target.id, hardwareProfileId: target.hardwareProfileId },
        );
      }
      const settings = clone(self.activeProfile.settings, false);
      self.keyremapProfile?.copySoftwareToHardware(self.activeProfile.id, target.hardwareProfileId);
      target.copySettingsFrom(settings);
      target.setBrightness('keys',self.activeProfile.keyBrightness);
      target.setBrightness('ring',self.activeProfile.perimeterBrightness);
    },
  }))
  .actions((self) => ({
    deleteActiveProfile() {
      if (!self.activeProfile.canBeDeleted)
        return void logger.warn(
          `[debug] Keyboard profile ${self.activeProfile.id} cannot be deleted`,
        );
      self.keyremapProfile?.removeSoftwareKeyRemapSetting(self.activeProfile.id);
      self.softwareProfiles.remove(self.activeProfile);
      self.setActiveProfileId(DEFAULT_PROFILE_ID, { fromDevice: false });
    },
    saveProfileEdit() {
      const edit = self.profileEditState;
      if (!edit) return void logger.warn('[debug] Keyboard profile not in edit state');
      if (edit.kind === 'add') {
        const original = self.profiles.find((profile) => profile.id === edit.originId);
        const settings = original?.settings ?? getDefaultKeyboardProfileSettings(self.device);
        const id = v4();
        self.addSoftwareProfile(
          KeyboardProfile.create({ id, name: edit.name, settings: getSnapshot(settings) }),
          { id: original?.id, hardwareProfileId: original?.hardwareProfileId },
        );
        self.setActiveProfileId(id, { fromDevice: false });
      } else {
        const profile = self.profiles.find((candidate) => candidate.id === edit.id);
        if (!profile)
          return void logger.warn(
            '[debug] Keyboard edit state id is invalid. No profile exists.',
            edit.id,
          );
        Object.assign(profile, edit);
      }
    },
    afterCreate() {
      addDisposer(
        self,
        reaction(
          () => self.activeProfile,
          () => {
            const settings = self.activeProfile.settings;
            settings.baseZones.forEach((zone) =>
              setEffectSnapshot({ effectSettings: zone.effectSettings }),
            );
            settings.reactiveZones.forEach((zone) =>
              setEffectSnapshot({ effectSettings: zone.effectSettings }),
            );
            settings.perimeterZones.forEach((zone) =>
              setEffectSnapshot({ effectSettings: zone.effectSettings, isPerimeter: true }),
            );
          },
        ),
      );
      if (self.keyboardRegion === KeyboardRegion.UNKNOWN)
        self.setKeyboardRegion(keyboardRegionFromLanguage(navigator.language));
    },
  }))
  .volatile(() => ({
    kind: 'fwk2' as const,
    selectedKeys: observable.set<number>(),
    selecting: false,
    isPerimeterSelected: false,
    keyremapLayer: 'Base' as 'Base' | 'Fn',
  }))
  .views((self) => ({
    get selected() {
      return Array.from(self.selectedKeys);
    },
    get hasSelection() {
      return Boolean(self.selectedKeys.size);
    },
  }))
  .views((self) => ({
    get selectedBaseZone() {
      return self.activeProfile.baseZoneFromKey(self.selected[0]);
    },
    get selectedReactiveZone() {
      return self.activeProfile.reactiveZoneFromKey(self.selected[0]);
    },
    get selectedPerimeterZone() {
      return self.activeProfile.perimeterZone;
    },
    getColorsByKey(device: KeyboardLayoutDevice, group: 'Base' | 'Reactive') {
      return colorsByKey(
        group === 'Base'
          ? self.activeProfile.settings.baseZones
          : self.activeProfile.settings.reactiveZones,
        device,
      );
    },
    getPerimeterGradient() {
      return perimeterGradient(self.activeProfile.settings.perimeterZones);
    },
  }))
  .views((self) => ({
    get selectedBaseEffectInfo(): LightingEffectInfo {
      if (!self.selected.length) return OFF_BASE_EFFECT_INFO;
      for (let index = 1; index < self.selected.length; index++) {
        const key = self.selected[index];
        if (key && !fastDeepEqual(self.selectedBaseZone, self.activeProfile.baseZoneFromKey(key)))
          return MIXED_BASE_EFFECT_INFO;
      }
      return self.activeProfile.baseZoneFromKey(self.selected[0]).info;
    },
    get selectedReactiveEffectInfo(): LightingEffectInfo {
      if (!self.selected.length) return OFF_REACTIVE_EFFECT_INFO;
      for (let index = 1; index < self.selected.length; index++) {
        const key = self.selected[index];
        if (
          key &&
          !fastDeepEqual(self.selectedReactiveZone, self.activeProfile.reactiveZoneFromKey(key))
        )
          return MIXED_REACTIVE_EFFECT_INFO;
      }
      return self.activeProfile.reactiveZoneFromKey(self.selected[0]).info;
    },
    get selectedPerimeterEffectInfo() {
      return self.isPerimeterSelected
        ? self.activeProfile.perimeterZone.info
        : OFF_BASE_EFFECT_INFO;
    },
  }))
  .actions((self) => ({
    applyEffectsToSelection(
      device: ZoneEditingDevice,
      info: LightingEffectInfo,
      modified?: Effect,
    ) {
      if (!self.selected.length) return;
      const effect = modified || getEffectSettingsSnapshot({ effectInfo: info });
      if (!effect) throw Error(`No default effect for ${info.effectName}`);
      self.activeProfile.moveKeysToZone(device, self.selected, effect);
    },
    applyEffectsToPerimeter(ledCount: number, info: LightingEffectInfo, modified?: Effect) {
      if (info.effectLayer !== 'Base')
        return void logger.error('[debug] Perimeter effects must be base effects', info.effectName);
      const effect = modified || getEffectSettingsSnapshot({ effectInfo: info, isPerimeter: true });
      if (!effect || effect.layer !== 'Base') throw Error('Perimeter effects must be base effects');
      self.activeProfile.modifyPerimeterZones(ledCount, effect);
    },
    addKey(code: number) {
      self.selectedKeys.add(code);
    },
    addKeys(codes: number[]) {
      codes.forEach((code) => self.selectedKeys.add(code));
    },
    clearSelection() {
      self.selectedKeys.clear();
    },
    removeKey(code: number) {
      self.selectedKeys.delete(code);
    },
    removeKeys(codes: number[]) {
      codes.forEach((code) => self.selectedKeys.delete(code));
    },
    setIsSelecting(value: boolean) {
      self.selecting = value;
    },
    setIsPerimeterSelected(value: boolean) {
      self.isPerimeterSelected = value;
    },
    updateKeyremapLayer(layer: 'Base' | 'Fn') {
      self.keyremapLayer = layer;
    },
  }))
  .actions((self) => ({
    updateBaseEffectSettings(
      device: ZoneEditingDevice,
      settings: SnapshotOrInstance<typeof BaseZoneEffectSettings>,
    ) {
      const effect = BaseZoneEffectSettings.create(settings);
      self.applyEffectsToSelection(device, self.selectedBaseEffectInfo, effect);
      setEffectSnapshot({ effectSettings: effect });
    },
    updateReactiveEffectSettings(
      device: ZoneEditingDevice,
      settings: SnapshotOrInstance<typeof ReactiveZoneEffectSettings>,
    ) {
      const effect = ReactiveZoneEffectSettings.create(settings);
      self.applyEffectsToSelection(device, self.selectedReactiveEffectInfo, effect);
      setEffectSnapshot({ effectSettings: effect });
    },
    updatePerimeterEffectSettings(
      ledCount: number,
      settings: SnapshotOrInstance<typeof BaseZoneEffectSettings>,
    ) {
      const effect = BaseZoneEffectSettings.create(settings);
      self.applyEffectsToPerimeter(
        ledCount,
        self.selectedPerimeterEffectInfo,
        BaseZoneEffectSettings.create(settings),
      );
      setEffectSnapshot({ effectSettings: effect, isPerimeter: true });
    },
  }));

export type KeyboardDeviceProfileInstance = Instance<typeof KeyboardDeviceProfile>;
export type KeyboardDeviceProfileSnapshot = SnapshotIn<typeof KeyboardDeviceProfile>;
