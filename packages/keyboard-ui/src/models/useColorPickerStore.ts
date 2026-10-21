import { useContext } from 'react';
import { MobXProviderContext } from 'mobx-react';
import type { ColorPickerStoreInstance } from './ColorPickerStore.js';

/** Read the existing model; the standalone composition root owns its lifetime and persistence. */
export function useColorPickerStore(): ColorPickerStoreInstance {
  return useContext(MobXProviderContext).localStore.colorPicker;
}
