import type { RemapInstance } from '../../models/Remap.js';
import type { RemapModifierInstance } from '../../models/RemapModifier.js';
import type { SelectedRemapKey } from './types.js';
import { KeyModifier } from '../../models/keyboardEnums.js';

type Modifier = RemapModifierInstance['modifier'];
export interface ModifierOption {
  value: Modifier | 'None';
  label: string;
}
export const NoModifier: ModifierOption = { value: 'None', label: 'None' };
export const modifierOptions: ModifierOption[] = [
  NoModifier,
  ...Object.values(KeyModifier).map((value) => ({ value, label: value })),
];

function pairCodes(outputs: readonly RemapInstance[] | undefined, physical: number) {
  const [first, second] = outputs ?? [];
  const code = (output: RemapInstance | undefined) =>
    output?.kind === 'SimpleRemap'
      ? output.targetKeyId
      : output?.kind === 'Modifier'
        ? physical
        : undefined;
  const left = code(first),
    right = code(second);
  return left !== undefined && right !== undefined ? [left, right] : undefined;
}
/** Retain the recovered label fallbacks: Fn pairs override labels only when both base outputs are simple. */
export function appliedKeyState(selected: SelectedRemapKey, isFnLayerSelected: boolean) {
  const { active, physicalKey } = selected.physicalKeyModel;
  let remapped = [physicalKey],
    modifier1: Modifier | undefined,
    modifier2: Modifier | undefined,
    isRemapped = false;
  if (active.kind === 'Single') {
    if (active.remapTo.kind === 'SimpleRemap') {
      const fn = selected.isFn ? active.fnPressed?.remapTo : undefined;
      remapped = [
        fn?.kind === 'SimpleRemap'
          ? fn.targetKeyId
          : fn?.kind === 'Modifier'
            ? physicalKey
            : active.remapTo.targetKeyId,
      ];
    }
    const output =
      isFnLayerSelected && active.fnPressed ? active.fnPressed.remapTo : active.remapTo;
    isRemapped = output.kind !== 'SimpleRemap' || output.targetKeyId !== physicalKey;
    if (selected.isFn && active.fnPressed?.remapTo.kind === 'Modifier')
      modifier1 = active.fnPressed.remapTo.modifier;
    else if (active.remapTo.kind === 'Modifier') modifier1 = active.remapTo.modifier;
  } else if (active.kind === 'Dual') {
    const [first, second] = active.remapTo;
    const baseCodes = pairCodes(active.remapTo, physicalKey);
    if (first?.kind === 'SimpleRemap' && second?.kind === 'SimpleRemap')
      remapped = (selected.isFn
        ? pairCodes(active.fnPressed?.remapTo, physicalKey)
        : undefined) ?? [first.targetKeyId, second.targetKeyId];
    else if (baseCodes) remapped = baseCodes;
    const outputs =
      isFnLayerSelected && active.fnPressed ? active.fnPressed.remapTo : active.remapTo;
    isRemapped =
      outputs[0]?.kind !== 'SimpleRemap' ||
      outputs[0].targetKeyId !== physicalKey ||
      outputs[1]?.kind !== 'SimpleRemap' ||
      outputs[1].targetKeyId !== physicalKey;
    const modifiers = selected.isFn ? active.fnPressed?.remapTo : active.remapTo;
    if (modifiers?.[0]?.kind === 'Modifier') modifier1 = modifiers[0].modifier;
    if (modifiers?.[1]?.kind === 'Modifier') modifier2 = modifiers[1].modifier;
  }
  return {
    remapped,
    modifier1,
    modifier2,
    isDualEnabled: active.kind === 'Dual',
    shouldHideReset: !isRemapped && modifier1 === undefined && modifier2 === undefined,
  };
}
