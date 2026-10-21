import { useContext } from 'react';
import { MobXProviderContext } from 'mobx-react';
import type { KeyboardViewStateInstance } from './KeyboardViewState.js';

/** Read the actual keyboard model supplied by the existing standalone composition root. */
export function useKeyboardViewState(): KeyboardViewStateInstance {
  return useContext(MobXProviderContext).viewStateStore;
}
