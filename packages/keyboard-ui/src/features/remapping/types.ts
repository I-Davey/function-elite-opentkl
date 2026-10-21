import type { PhysicalKeyInstance } from '../../models/KeyRemapSettings.js';
import type { KeyRemapDeviceProfileInstance } from '../../models/KeyRemapDeviceProfile.js';
import type { KeyLabel } from '../../layouts/keyLabels.js';

export interface SelectedRemapKey {
  keyCode: number;
  physicalKeyModel: PhysicalKeyInstance;
  isFn: boolean;
}
export interface RemapTargetLabel extends KeyLabel {
  keyCode: number;
}
export interface RemapTargetProps {
  keyRemapDeviceProfile: KeyRemapDeviceProfileInstance;
  selectedKey: SelectedRemapKey;
  selectedLevel: number;
}
