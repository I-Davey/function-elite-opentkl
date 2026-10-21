import type { CSSObject } from '@emotion/react';
import type { KeyboardLayoutInfo } from '../layouts/types.js';

/** Keep the keyboard anchored identically regardless of each tab's side controls. */
export function keyboardPreviewStyles(
  formFactor: KeyboardLayoutInfo['formFactor'],
  width: number,
  transitionEnabled: boolean,
) {
  const minScale = { Fullsize: 0.55, Tenkeyless: 0.65, MiniTkl: 0.7 }[formFactor];
  const scale = Math.max(minScale, 0.7 * (width / 1000));
  return {
    container: {
      label: 'Component-container',
      display: 'flex',
      justifyContent: 'center',
      '@media (max-width: 1180px)': { flexDirection: 'column' },
    },
    content: {
      label: 'Component-content',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    footer: {
      label: 'Component-footer',
      display: 'flex',
      alignSelf: 'center',
      flex: '0 0 148px',
      width: 148,
      justifyContent: 'center',
      '@media (max-width: 1180px)': { flex: '0 0 auto', width: 'auto', paddingBottom: 16 },
    },
    keyboard: {
      label: 'Component-keyboard',
      transform: `scale(${scale})`,
      transition: transitionEnabled ? 'transform 0.2s ease' : 'none',
      visibility: width !== 0 ? 'visible' : 'hidden',
    },
  } satisfies Record<string, CSSObject>;
}
