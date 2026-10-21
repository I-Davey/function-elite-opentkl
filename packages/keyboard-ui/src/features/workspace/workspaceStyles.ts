import type { CSSObject } from '@emotion/react';
import type { KeyboardTheme } from '../../theme/types.js';
/** Preview card and editor share the desktop shell's spacing and surfaces. */
export const keyboardContentStyles = (theme: KeyboardTheme) =>
  ({
    container: {
      label: 'Component-container',
      transition: 'height 0.3s ease-out',
      '&:last-child': {
        borderBottom: 'none',
      },
    },
    paneContainer: {
      label: 'Component-paneContainer',
      width: '100%',
      minHeight: 280,
      backgroundColor: `${theme.body.backgroundColor}`,
      padding: '12px 0 8px',
    },
    settingsPreview: {
      label: 'Component-settingsPreview',
      width: '100%',
      overflow: 'hidden',
      position: 'relative',
    },
    viewPicker: {
      label: 'Component-viewPicker',
      display: 'flex',
      flexDirection: 'column',
    },
  }) satisfies Record<string, CSSObject>;

export const keyboardWorkspaceStyles = (_theme: KeyboardTheme) =>
  ({
    keyboardContainer: {
      label: 'Component-keyboardContainer',
      padding: 0,
      boxSizing: 'border-box',
      minWidth: 0,
    },
    overlayWrapper: {
      label: 'Component-overlayWrapper',
      position: 'relative',
      marginBottom: 20,
    },
  }) satisfies Record<string, CSSObject>;
