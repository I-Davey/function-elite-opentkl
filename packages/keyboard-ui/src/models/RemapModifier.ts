import { KeyModifier } from './keyboardEnums.js';
import { types, type Instance, type SnapshotIn } from 'mobx-state-tree';

/** RemapModifier. Recovered from src/renderer/capabilities/keyremap/models/RemapTypeModifier.ts. */
const RemapModifier = types
  .model({
    kind: types.literal('Modifier'),
    modifier: types.enumeration([...Object.values(KeyModifier)]),
  })
  .actions((self) => ({
    setModifier(modifier: typeof self.modifier) {
      self.modifier = modifier;
    },
  }));
export { RemapModifier };

export type RemapModifierInstance = Instance<typeof RemapModifier>;
export type RemapModifierSnapshot = SnapshotIn<typeof RemapModifier>;
