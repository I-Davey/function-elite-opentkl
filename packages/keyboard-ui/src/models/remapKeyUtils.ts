import {
  KeyCodeLookup,
  MediaKeyCode,
  HidKeyCode,
  CustomKeysMap,
  NumpadKeys,
  excludedDevicePhysicalKeys,
} from '../layouts/hidKeys.js';
import { KeyboardFormFactor } from './keyboardEnums.js';
import type { CustomRemapKeyGroup, KeyboardRemapDevice } from './deviceTypes.js';

export interface NamedRemapKey {
  keyId: number;
  name: string | undefined;
}
export interface ValidPhysicalRemapKeys {
  Base: NamedRemapKey[];
  Fn: NamedRemapKey[];
}
export interface ActuationLevels {
  validLevels: number[];
  reverseValidLevels: Partial<Record<number, number>>;
}
export interface ValidActuationTypes {
  Single: ActuationLevels;
  Dual: ActuationLevels;
  Rapid: ActuationLevels & {
    validSensitivity: number[];
    reverseValidSensitivity: Partial<Record<number, number>>;
  };
}

export const cache = {
  hidKeyNames: null as Map<number, NamedRemapKey> | null,
  mediaKeyNames: null as Map<number, NamedRemapKey> | null,
  validSimpleRemapTargetKeys: new Map<string, NamedRemapKey[]>(),
  validPhysicalKeysForRemap: new Map<string, ValidPhysicalRemapKeys>(),
  validMacroTargetKeys: new Map<string, NamedRemapKey[]>(),
  validActuationTypes: new Map<string, ValidActuationTypes>(),
};
let keyNames: ReadonlyMap<number, string> = new Map();

/** Supply current device labels before rendering; no CAM client/driver registry is needed. */
export function configureKeyNames(names: ReadonlyMap<number, string>) {
  keyNames = names;
  cache.hidKeyNames = null;
  cache.mediaKeyNames = null;
  cache.validSimpleRemapTargetKeys.clear();
  cache.validPhysicalKeysForRemap.clear();
  cache.validMacroTargetKeys.clear();
}

export const getFallbackName = (hidKey: number) => KeyCodeLookup[hidKey] ?? 'Unknown Key';
export const retrieveKeyNames = (keyCodes: number[]) =>
  new Map(
    keyCodes.map((keyId) => [
      keyId,
      {
        keyId,
        name: keyNames.get(keyId) ?? getFallbackName(keyId),
      },
    ]),
  );
export const retrieveMediaHidNames = () =>
  cache.mediaKeyNames || (cache.mediaKeyNames = retrieveKeyNames(Object.values(MediaKeyCode)));
export const retrieveHidNames = () =>
  cache.hidKeyNames || (cache.hidKeyNames = retrieveKeyNames(Object.values(HidKeyCode)));

export function getSupportedCustomKeys(custom: CustomRemapKeyGroup[]): NamedRemapKey[] {
  return custom.flatMap(({ keys }) =>
    keys.map((key) => ({
      name: CustomKeysMap.get(key.targetKeyId) ?? key.name,
      keyId: key.targetKeyId,
    })),
  );
}

export function getKeyById(id: number): NamedRemapKey | undefined {
  const hidKeys = retrieveHidNames(),
    mediaKeys = retrieveMediaHidNames();
  return hidKeys.has(id)
    ? hidKeys.get(id)
    : mediaKeys.has(id)
      ? mediaKeys.get(id)
      : CustomKeysMap.has(id)
        ? { keyId: id, name: CustomKeysMap.get(id) }
        : undefined;
}

export function getExcludedDeviceKeys(device: KeyboardRemapDevice) {
  const excludedKeys = new Set<number>();
  if (!device.supportedCapabilities.physicalKeys) return excludedKeys;
  const formFactor = device.capabilityData.physicalKeys?.physicalKeysLayout?.formFactor;
  if (formFactor === KeyboardFormFactor.Tenkeyless || formFactor === KeyboardFormFactor.MiniTkl)
    NumpadKeys.forEach((key) => excludedKeys.add(key));
  if (formFactor === KeyboardFormFactor.MiniTkl) excludedKeys.add(HidKeyCode.RightGui);
  return excludedKeys;
}

export function getValidSimpleRemapTargetKeysForDevice(device: KeyboardRemapDevice) {
  const cached = cache.validSimpleRemapTargetKeys.get(device.deviceType);
  if (cached) return cached;
  const { custom, supportsHid, supportsMedia } =
    device.capabilityData.keyRemap.validSimpleRemapTargetKeys;
  const keys = getSupportedCustomKeys(custom);
  if (supportsHid) keys.push(...retrieveHidNames().values());
  if (supportsMedia) keys.push(...retrieveMediaHidNames().values());
  const excluded = getExcludedDeviceKeys(device);
  const result = [
    ...new Map(keys.map((key) => [key.keyId, getKeyById(key.keyId) ?? key])).values(),
  ].filter((key) => !excluded.has(key.keyId));
  cache.validSimpleRemapTargetKeys.set(device.deviceType, result);
  return result;
}

/** Macro outputs retain their own capability set, table order and physical exclusions. */
export function getValidMacroTargetKeysForDevice(device: KeyboardRemapDevice) {
  const cached = cache.validMacroTargetKeys.get(device.deviceType);
  if (cached) return cached;
  const { custom, supportsHid, supportsMedia } = device.capabilityData.keyRemap.validMacroTargetKeys;
  const keys = getSupportedCustomKeys(custom);
  if (supportsHid) keys.push(...retrieveHidNames().values());
  if (supportsMedia) keys.push(...retrieveMediaHidNames().values());
  const excluded = getExcludedDeviceKeys(device);
  const result = [...new Map(keys.map((key) => [key.keyId, getKeyById(key.keyId) ?? key])).values()]
    .filter((key) => !excluded.has(key.keyId));
  cache.validMacroTargetKeys.set(device.deviceType, result);
  return result;
}

export function getValidPhysicalKeysForRemapForDevice(device: KeyboardRemapDevice) {
  const cached = cache.validPhysicalKeysForRemap.get(device.deviceType);
  if (cached) return cached;
  const result: ValidPhysicalRemapKeys = { Base: [], Fn: [] };
  for (const group of device.capabilityData.keyRemap.validPhysicalKeysForRemap) {
    if (group.modifier !== 'NonePressed' && group.modifier !== 'Fn') continue;
    result[group.modifier === 'Fn' ? 'Fn' : 'Base'] = group.keys
      .filter((key) => !excludedDevicePhysicalKeys.has(key.physicalKeyId))
      .map((key) => ({ keyId: key.physicalKeyId, name: getKeyById(key.physicalKeyId)?.name }));
  }
  cache.validPhysicalKeysForRemap.set(device.deviceType, result);
  return result;
}

/** Preserve device table order and reverse-index lookup; never infer depths from an index. */
export function getValidActuationTypesForDevice(device: KeyboardRemapDevice) {
  const cached = cache.validActuationTypes.get(device.deviceType);
  if (cached) return cached;
  const result: ValidActuationTypes = {
    Single: { validLevels: [], reverseValidLevels: {} },
    Dual: { validLevels: [], reverseValidLevels: {} },
    Rapid: {
      validLevels: [],
      reverseValidLevels: {},
      validSensitivity: [],
      reverseValidSensitivity: {},
    },
  };
  for (const type of device.capabilityData.keyRemap.validActuationTypes) {
    if (type.kind !== 'Single' && type.kind !== 'Dual' && type.kind !== 'Rapid') continue;
    type.validLevels.forEach((level, index) => {
      result[type.kind].validLevels.push(level.valueMicroMeters);
      result[type.kind].reverseValidLevels[level.valueMicroMeters] = index;
    });
    if (type.kind === 'Rapid')
      type.validSensitivity.forEach((level, index) => {
        result.Rapid.validSensitivity.push(level.valueMicroMeters);
        result.Rapid.reverseValidSensitivity[level.valueMicroMeters] = index;
      });
  }
  cache.validActuationTypes.set(device.deviceType, result);
  return result;
}
