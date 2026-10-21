import { types, type Instance, type SnapshotIn } from 'mobx-state-tree';
/** KeyboardInfo. Recovered from src/renderer/keyboard/v2/models/device/KeyboardInfo.ts. */
const KeyboardInfo = types
  .model('KeyboardInfo', {
    deviceUniqueId: types.string,
    deviceType: types.string,
    createdAt: types.optional(types.number, () => Date.now()),
  })
  .volatile(() => ({
    type: 'v2',
  }));
export { KeyboardInfo };

export type KeyboardInfoInstance = Instance<typeof KeyboardInfo>;
export type KeyboardInfoSnapshot = SnapshotIn<typeof KeyboardInfo>;
