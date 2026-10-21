/** Physical legends offered by the retained keyboard UI. */
export const KeyboardRegion = {
  UNKNOWN: 'Unknown',
  US: 'US',
  UK: 'UK',
  DE: 'DE',
  FR: 'FR',
  ND: 'ND',
} as const;
export type KeyboardRegionValue = (typeof KeyboardRegion)[keyof typeof KeyboardRegion];
export const ISO_KeyboardRegions = new Set(['UK', 'DE', 'FR', 'ND']);

/** Preserve CAM's locale grouping; unsupported locales use US legends. */
export function keyboardRegionFromLanguage(language: string): KeyboardRegionValue {
  switch (language) {
    case 'en-GB':
    case 'UK':
      return KeyboardRegion.UK;
    case 'fr':
    case 'fr-FR':
    case 'FR':
      return KeyboardRegion.FR;
    case 'de':
    case 'de-DE':
    case 'DE':
      return KeyboardRegion.DE;
    case 'no':
    case 'nb':
    case 'nn':
    case 'sv':
    case 'sv-SE':
    case 'sv-FI':
    case 'fi':
    case 'fi-FI':
    case 'is':
    case 'is-IS':
    case 'da':
    case 'da-DK':
    case 'fo':
    case 'fo-FO':
    case 'se':
    case 'se-NO':
    case 'se-SE':
    case 'se-FI':
      return KeyboardRegion.ND;
    default:
      return KeyboardRegion.US;
  }
}
