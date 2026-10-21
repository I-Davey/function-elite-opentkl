import type { KeyRemapDeviceProfileInstance } from '../../models/KeyRemapDeviceProfile.js';

/** Macros use Single actuation and cannot replace another macro or a non-identity simple remap.
 * Fn uses its own mapping when present and otherwise inherits the base mapping.
 */
export function unavailableMacroKeys(
  profile: KeyRemapDeviceProfileInstance,
  isFn: boolean,
): number[] {
  const unavailable: number[] = [];
  profile.activeProfile?.physicalKeys.forEach(({ physicalKey, active }) => {
    if (active.kind === 'NoConfigurableActuation' || active.kind === 'Dual') {
      unavailable.push(physicalKey);
      return;
    }
    const remap =
      isFn && active.fnPressed !== null
        ? active.fnPressed.remapTo
        : active.remapTo;
    if (
      remap.kind === 'Macro' ||
      (remap.kind === 'SimpleRemap' && remap.targetKeyId !== physicalKey)
    )
      unavailable.push(physicalKey);
  });
  return unavailable;
}
