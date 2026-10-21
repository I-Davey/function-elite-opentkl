import { useContext } from 'react';
import { MobXProviderContext } from 'mobx-react';
import type { MacroRecordStore } from './MacroRecordStore.js';

/** The renderer owns this existing recorder's host listener and final disposal. */
export function useMacroRecorder(): MacroRecordStore {
  return useContext(MobXProviderContext).macroRecordStore;
}
