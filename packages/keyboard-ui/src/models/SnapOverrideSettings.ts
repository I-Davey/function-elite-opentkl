import { ResolutionMethod, BottomMode } from './keyboardEnums.js';
import { types, type Instance, type SnapshotIn } from 'mobx-state-tree';

/** SnapOverrideConfig. Recovered from src/renderer/capabilities/keyremap/models/SnapOverrideSettings.ts. */
const SnapOverrideConfig = types.model({
  physicalKey1: types.number,
  physicalKey2: types.number,
  resolutionMethod: types.enumeration('ResolutionMethod', Object.values(ResolutionMethod)),
  bottomMode: types.enumeration('BottomMode', Object.values(BottomMode)),
});
export { SnapOverrideConfig };

export type SnapOverrideConfigInstance = Instance<typeof SnapOverrideConfig>;
export type SnapOverrideConfigSnapshot = SnapshotIn<typeof SnapOverrideConfig>;
