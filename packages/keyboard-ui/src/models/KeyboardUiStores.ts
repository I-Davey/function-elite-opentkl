import type { ColorPickerStoreInstance } from './ColorPickerStore.js';
import type { KeyboardViewStateInstance } from './KeyboardViewState.js';
import type { MacroRecordStore } from './MacroRecordStore.js';

/** Actual instances required by the retained MobX provider readers. Profile models use their own environment. */
export interface KeyboardUiStores {
  localStore: { colorPicker: ColorPickerStoreInstance };
  viewStateStore: KeyboardViewStateInstance;
  macroRecordStore: MacroRecordStore;
}
