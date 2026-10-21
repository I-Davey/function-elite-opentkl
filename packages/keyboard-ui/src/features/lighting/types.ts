import type { IAnyType, SnapshotIn, SnapshotOut } from 'mobx-state-tree';
import type { KeyboardReadyDevice } from '../../models/deviceTypes.js';
import type { KeyboardTheme } from '../../theme/types.js';

/** Class names come from the maintained base/reactive surface's shared theme rules. */
export interface LightingControlClasses {
  container: string;
  label: string;
}
export interface BaseControlClasses extends LightingControlClasses {
  row: string;
  colorPickers: string;
}
export interface EffectControlProps<Model extends IAnyType> {
  effectSettings: SnapshotOut<Model>;
  onSelect: (settings: SnapshotIn<Model>) => void;
  readyKeyboardDevice: KeyboardReadyDevice;
  styles: LightingControlClasses;
  theme: KeyboardTheme;
  perimeter?: boolean;
}
export interface ControlPlacement {
  containerClass?: string;
  labelClass?: string;
}
export interface Choice<Value> {
  value: Value;
  label: string;
}
