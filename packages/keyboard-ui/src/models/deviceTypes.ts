import type { KeyboardLayoutDevice } from '../layouts/types.js';
import type { KeyboardLightingDevice, ZoneEditingDevice } from './defaultZones.js';

/** The standalone HE device has both remapping and editable lighting capabilities. */
export type KeyboardReadyDevice = KeyboardRemapDevice & KeyboardLightingDevice & ZoneEditingDevice & {
  capabilityData: { keyboardMouseLighting: {
    maxGradientCount: number;
    supportedBaseEffects: string[];
    supportedReactiveEffects: string[];
    supportedRingEffects: { ledCount: number; effects: string[] };
  } };
};

export type RemapProfileId = { kind: 'Hardware'; id: number } | { kind: 'Software'; id: string };
export type RemapLayerModifier = 'NonePressed' | 'Fn';
export interface PhysicalRemapKey {
  physicalKeyId: number;
  name: string;
}
export interface CustomRemapKeyGroup {
  category: string;
  keys: { targetKeyId: number; name?: string }[];
}
export interface RemapTargetCapabilities {
  supportsHid: boolean;
  supportsMedia: boolean;
  custom: CustomRemapKeyGroup[];
}
export type ActuationCapability =
  | { kind: 'Single' | 'Dual'; validLevels: { valueMicroMeters: number }[] }
  | {
      kind: 'Rapid';
      validLevels: { valueMicroMeters: number }[];
      validSensitivity: { valueMicroMeters: number }[];
    };

/** Retained keyboard capability data supplied by the existing composition root.
 * UI depth values index these tables; their values are micrometres, not linear indices.
 */
export interface KeyboardRemapDevice extends KeyboardLayoutDevice {
  id: number;
  uniqueId: string;
  deviceType: string;
  supportedCapabilities: Record<string, boolean | undefined>;
  capabilityData: KeyboardLayoutDevice['capabilityData'] & {
    uniqueId: { id: string };
    keyRemap: {
      validPhysicalKeysForRemap: { modifier: RemapLayerModifier; keys: PhysicalRemapKey[] }[];
      validSimpleRemapTargetKeys: RemapTargetCapabilities;
      validMacroTargetKeys: RemapTargetCapabilities;
      validMacroActionTargetKeyTimeoutRange: {
        minSeconds: number;
        maxSeconds: number;
        stepSeconds: number;
      };
      validRepeatCountRange: { min: number; max: number };
      validActuationTypes: ActuationCapability[];
      maxSnapOverrideConfigs: number;
    };
    pollingRate?: { validValues: string[] };
    deviceSpecificData?: { hardware_id?: string };
  };
}
