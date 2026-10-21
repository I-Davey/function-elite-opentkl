import { types, type Instance, type SnapshotIn } from 'mobx-state-tree';

/** A single HID/media output; the numeric identity is preserved on the wire. */
export const RemapSimpleRemap = types.model({
  targetKeyId: types.number,
  kind: types.literal('SimpleRemap'),
}).actions((self) => ({
  setTargetKeyId(targetKeyId: typeof self.targetKeyId) {
    self.targetKeyId = targetKeyId;
  },
}));

export function isRemapTypeSimpleRemap<T extends { kind: string }>(
  remap: T | null | undefined,
): remap is T & { kind: 'SimpleRemap' } {
  return remap != null && remap.kind === 'SimpleRemap';
}

export type RemapSimpleInstance = Instance<typeof RemapSimpleRemap>;
export type RemapSimpleSnapshot = SnapshotIn<typeof RemapSimpleRemap>;
