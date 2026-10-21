import { US_ANSI_LABELS } from './US_ANSI_LABELS.js';
import { US_ISO_LABELS } from './US_ISO_LABELS.js';
import { DE_ISO_LABELS } from './DE_ISO_LABELS.js';
import { FR_ISO_LABELS } from './FR_ISO_LABELS.js';
import { ND_ISO_LABELS } from './ND_ISO_LABELS.js';
import { UK_ISO_LABELS } from './UK_ISO_LABELS.js';
import { getKeyCoordinate } from './keyboardInfo.js';
import type { KeyLabel, KeyLabelRecord } from './keyLabels.js';

export const fallbackKeyInfo: KeyLabel = { label: '', activationKeyText: '', keyTerms: [] };
const isoLabels: Record<string, KeyLabelRecord | undefined> = {
  DE: DE_ISO_LABELS,
  FR: FR_ISO_LABELS,
  ND: ND_ISO_LABELS,
  UK: UK_ISO_LABELS,
};
/** ANSI always uses US legends; unsupported ISO regions retain CAM's US fallback. */
export function getKeyInfo(
  key: number | undefined,
  physicalLayout: string,
  region: string,
): KeyLabel {
  if (!key) return fallbackKeyInfo;
  const labels =
    physicalLayout === 'ANSI'
      ? US_ANSI_LABELS
      : physicalLayout === 'ISO'
        ? (isoLabels[region] ?? US_ISO_LABELS)
        : undefined;
  return labels?.[key] ?? fallbackKeyInfo;
}
export { getKeyCoordinate };
