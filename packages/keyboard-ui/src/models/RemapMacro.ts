import { cast, detach, types, type Instance, type SnapshotIn } from 'mobx-state-tree';
import { v4 } from 'uuid';
import { HidKeyCode } from '../layouts/hidKeys.js';
import { i18n } from '../../../ui-platform/src/i18n.cjs';
import { TargetKeyState } from './keyboardEnums.js';
import { MAX_MACRO_ACTIONS, MacroKeyEvent, type RecordedMacroAction } from './macroConstants.js';

export const RepeatCountWhilePressed = types.model({ kind: types.literal('WhilePressed') });
export const RepeatCountInfinite = types.model({ kind: types.literal('Infinite') });
export const RepeatCountCount = types.model({
  nonZeroCount: types.number,
  kind: types.literal('Count'),
});

/** A stored output transition. delaySeconds is the delay before the next transition. */
export const MacroActionTargetKey = types.model({
  targetKeyId: types.optional(types.number, HidKeyCode.A),
  state: types.optional(types.enumeration(Object.values(TargetKeyState)), TargetKeyState.Pressed),
  delaySeconds: types.optional(types.number, 0.05),
}).actions((self) => ({
  setDelaySeconds(delaySeconds: typeof self.delaySeconds) { self.delaySeconds = delaySeconds; },
  setTargetKeyId(targetKeyId: typeof self.targetKeyId) { self.targetKeyId = targetKeyId; },
  setState(state: typeof self.state) { self.state = state; },
}));

export const MacroAction = types.model({
  repeatCount: types.union(RepeatCountWhilePressed, RepeatCountInfinite, RepeatCountCount),
  targetKeys: types.array(MacroActionTargetKey),
});

/** Stored macro definition, recording conversion and firmware memory accounting. */
export const RemapMacro = types.model({
  // Models load before translations; resolve the default when a macro is created.
  name: types.optional(types.string, () => i18n.t('macro:macroUnnamed')),
  id: types.optional(types.identifier, () => `${Date.now()}-${v4()}`),
  kind: types.literal('Macro'),
  action: MacroAction,
}).views((self) => ({
  getAction(index: number) {
    if (index < self.action.targetKeys.length) return self.action.targetKeys[index];
  },
  get didReachMaxMacroActions() { return self.action.targetKeys.length >= MAX_MACRO_ACTIONS; },
  get tagsLength() {
    return 2 * self.action.targetKeys.filter((action) => action.state === TargetKeyState.Pressed).length
      + self.action.targetKeys.filter((action) => action.state !== TargetKeyState.Pressed).length;
  },
  get memoryRequired(): number { return 10 + 3 * this.tagsLength; },
})).actions((self) => ({
  setName(name: string) { self.name = name; },
  addReleaseAction(keyCode: number) {
    if (!self.didReachMaxMacroActions)
      self.action.targetKeys.push({ targetKeyId: keyCode, state: TargetKeyState.Released });
  },
  addDefaultActionPair() {
    // Preserve the editor's paired insertion, including when only one slot remains.
    if (!self.didReachMaxMacroActions) {
      self.action.targetKeys.push({ state: TargetKeyState.Pressed });
      self.action.targetKeys.push({ state: TargetKeyState.Released });
    }
  },
  tryAddActions(macroActions: readonly RecordedMacroAction[]) {
    if (self.didReachMaxMacroActions) return false;
    const allowedCount = Math.min(MAX_MACRO_ACTIONS - self.action.targetKeys.length, macroActions.length);
    const targetKeys: Instance<typeof MacroActionTargetKey>[] = [];
    for (let index = 0; index < allowedCount; index++) {
      const action = macroActions[index];
      if (!action || action.hidKey === undefined) continue;
      targetKeys.push(cast({
        state: action.state === MacroKeyEvent.DOWN ? TargetKeyState.Pressed : TargetKeyState.Released,
        targetKeyId: action.hidKey,
        delaySeconds: action.delayMs / 1000,
      }));
    }
    if (targetKeys.length)
      self.action.targetKeys.replace([...self.action.targetKeys, ...targetKeys]);
    return true;
  },
  deleteAction(index: number) { self.action.targetKeys.splice(index, 1); },
  clearActions() { self.action.targetKeys.clear(); },
  moveAction(fromIndex: number, toIndex: number) {
    const actionToMove = detach(self.action.targetKeys[fromIndex]);
    if (!actionToMove) throw new Error(`Unable to move action from ${fromIndex} to ${toIndex}`);
    self.action.targetKeys.splice(toIndex, 0, actionToMove);
  },
})).actions((self) => ({
  tryAddAction(macroAction: RecordedMacroAction | RecordedMacroAction[]): boolean {
    if (self.didReachMaxMacroActions) return false;
    if (Array.isArray(macroAction)) return self.tryAddActions(macroAction);
    if (macroAction.hidKey !== undefined) self.action.targetKeys.push(cast({
      state: macroAction.state === MacroKeyEvent.DOWN ? TargetKeyState.Pressed : TargetKeyState.Released,
      targetKeyId: macroAction.hidKey,
      delaySeconds: macroAction.delayMs / 1000,
    }));
    return true;
  },
}));

export function isRemapTypeMacro<T extends { kind: string }>(
  remap: T | null | undefined,
): remap is T & { kind: 'Macro' } {
  return remap != null && remap.kind === 'Macro';
}

export type MacroActionTargetKeyInstance = Instance<typeof MacroActionTargetKey>;
export type RemapMacroInstance = Instance<typeof RemapMacro>;
export type RemapMacroSnapshot = SnapshotIn<typeof RemapMacro>;
