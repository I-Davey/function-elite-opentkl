import type {
  PhysicalKeyInstance,
  HardwareKeyRemapInstance,
  SoftwareKeyRemapInstance,
} from './KeyRemapSettings.js';
import type { KeyboardTheme } from '../theme/types.js';

export type RemapPreviewProfile = HardwareKeyRemapInstance | SoftwareKeyRemapInstance;
export type RemapPreviewLayer = 'Base' | 'Fn';
export type RemapPreviewKind = 'None' | 'Disabled' | 'Single' | 'Dual' | 'Macro' | 'Snap';
export function isRemapped(key: PhysicalKeyInstance | undefined, originalKeyId: number) {
  return (
    !!key &&
    key.active.kind === 'Single' &&
    (key.active.remapTo.kind === 'Modifier' ||
      (key.active.remapTo.kind === 'SimpleRemap' &&
        key.active.remapTo.targetKeyId !== originalKeyId))
  );
}
/** Dual previews display their first simple output; non-simple outputs retain the physical legend. */
export function getRemappedCode(
  layer: RemapPreviewLayer,
  profile: RemapPreviewProfile | undefined,
  code: number | undefined,
) {
  if (code === undefined) return code;
  const active = profile?.physicalKeys.get(String(code))?.active;
  if (active?.kind === 'Single') {
    const output = layer === 'Base' ? active.remapTo : active.fnPressed?.remapTo;
    return output?.kind === 'SimpleRemap' ? output.targetKeyId : code;
  }
  if (active?.kind === 'Dual') {
    const output = (layer === 'Base' ? active.remapTo : active.fnPressed?.remapTo)?.[0];
    return output?.kind === 'SimpleRemap' ? output.targetKeyId : code;
  }
  return code;
}
/** Keep CAM's remap/macro/Snap precedence, including disabled and incomplete dual mappings. */
export function getRemapAppearance(
  profile: RemapPreviewProfile | undefined,
  validKeys: readonly number[],
  layer: RemapPreviewLayer,
  code: number | undefined,
  theme: KeyboardTheme,
) {
  let labelColor: string | undefined = `#${theme.keyboard.selectedKeyText.toHex()}`;
  let kind: RemapPreviewKind = 'None',
    remappedCode = code,
    isDoubleColor = false;
  if (code === undefined) return { labelColor, kind, remappedCode, isDoubleColor };
  if (!validKeys.includes(code))
    return { labelColor: undefined, kind: 'Disabled' as const, remappedCode, isDoubleColor };
  const key = profile?.physicalKeys.get(String(code));
  remappedCode = getRemappedCode(layer, profile, code);
  if (!key) return { labelColor, kind, remappedCode, isDoubleColor };
  const active = key.active;
  if (active.kind === 'Single') {
    const output = layer === 'Base' ? active.remapTo : active.fnPressed?.remapTo;
    if (output?.kind === 'SimpleRemap' && output.targetKeyId !== code) {
      kind = 'Single';
      labelColor = `#${theme.keyboard.simpleRemap.toHex()}`;
      remappedCode = output.targetKeyId;
    }
    if (output?.kind === 'Modifier') {
      kind = 'Single';
      labelColor = `#${theme.keyboard.simpleRemap.toHex()}`;
    }
    if (output?.kind === 'Macro') {
      kind = 'Macro';
      labelColor = `#${theme.keyboard.macro.toHex()}`;
    }
  }
  if (active.kind === 'Dual') {
    const outputs = layer === 'Base' ? active.remapTo : active.fnPressed?.remapTo;
    const [first, second] = outputs ?? [];
    if (first?.kind === 'Modifier' || second?.kind === 'Modifier') {
      kind = 'Dual';
      isDoubleColor = true;
      labelColor = `#${theme.keyboard.simpleRemap.toHex()}`;
    }
    if (first?.kind === 'SimpleRemap' && second?.kind === 'SimpleRemap') {
      kind = 'Dual';
      remappedCode = first.targetKeyId;
      if (first.targetKeyId !== code || second.targetKeyId !== code) {
        isDoubleColor = true;
        labelColor = `#${theme.keyboard.simpleRemap.toHex()}`;
      }
    }
  }
  const snap = profile?.snapOverrideConfigs.find(
    (config) => config.physicalKey1 === code || config.physicalKey2 === code,
  );
  if (snap) {
    const first = profile?.physicalKeys.get(String(snap.physicalKey1));
    const second = profile?.physicalKeys.get(String(snap.physicalKey2));
    if (
      !isRemapped(first, snap.physicalKey1) &&
      !isRemapped(second, snap.physicalKey2) &&
      first?.active.kind !== 'Dual' &&
      second?.active.kind !== 'Dual'
    ) {
      kind = 'Snap';
      labelColor = `#${theme.keyboard.snapOverride.toHex()}`;
    }
  }
  return { labelColor, kind, remappedCode, isDoubleColor };
}
