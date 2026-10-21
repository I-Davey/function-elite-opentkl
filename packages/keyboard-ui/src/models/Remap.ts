import { types, type Instance, type SnapshotIn } from 'mobx-state-tree';
import { RemapSimpleRemap } from './RemapSimple.js';
import { RemapMacro } from './RemapMacro.js';
import { RemapModifier } from './RemapModifier.js';

/** Output variants accepted by base, Fn and dual-actuation mappings. */
export const Remap = types.union({ eager: true }, RemapSimpleRemap, RemapMacro, RemapModifier);
export type RemapInstance = Instance<typeof Remap>;
export type RemapSnapshot = SnapshotIn<typeof Remap>;
