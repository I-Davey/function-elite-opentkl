import type { KeyRemapDeviceProfileInstance } from '../../models/KeyRemapDeviceProfile.js';
import type { MacroActionTargetKeyInstance } from '../../models/RemapMacro.js';
import {
  MACRO_DELAY_MINIMUM,
  MACRO_DELAY_MAXIMUM,
} from '../../models/macroConstants.js';

export const MACRO_ACTION_DRAG_TYPE = 'MacroAction';
export interface MacroActionDragItem {
  type: typeof MACRO_ACTION_DRAG_TYPE;
  index: number;
}

/** Route edit notifications through the same model request queues used by device transactions. */
export function queueMacroRemap(
  profile: KeyRemapDeviceProfileInstance,
  physicalKey: number | undefined,
  isFn: boolean,
) {
  if (physicalKey === undefined) return;
  const key = profile.activeProfile?.physicalKeys.get(String(physicalKey));
  if (!key) return;
  if (isFn && key.active.kind === 'Single' && key.active.fnPressed !== null)
    profile.sendFnRemapToCore([key]);
  else profile.sendRemapToCore([key]);
}

/** The recovered warning policy lets one release match all preceding unmatched presses of that key. */
export function matchedMacroPresses(
  actions: readonly MacroActionTargetKeyInstance[],
): Set<number> {
  const pending = new Map<number, number[]>(),
    matched = new Set<number>();
  actions.forEach((action, index) => {
    if (action.state === 'Pressed') {
      const entries = pending.get(action.targetKeyId) ?? [];
      entries.push(index);
      pending.set(action.targetKeyId, entries);
    } else if (action.state === 'Released') {
      for (const press of pending.get(action.targetKeyId) ?? [])
        matched.add(press);
      pending.delete(action.targetKeyId);
    }
  });
  return matched;
}

export function clampMacroDelay(milliseconds: number): number {
  return Math.min(
    MACRO_DELAY_MAXIMUM,
    Math.max(MACRO_DELAY_MINIMUM, Math.floor(milliseconds)),
  );
}

/** Keep the original >= boundary and skip visible/hidden overflow containers. */
export function getMacroScrollParent(node: Node | null): HTMLElement | null {
  while (node) {
    if (node instanceof HTMLElement && node.scrollHeight >= node.clientHeight) {
      const overflow = window.getComputedStyle(node).overflowY;
      if (overflow !== 'visible' && overflow !== 'hidden') return node;
    }
    node = node.parentNode;
  }
  return null;
}
