import type { CSSObject } from '@emotion/react';
import type { KeyboardTheme } from '../../theme/types.js';
export const lightingBaseStyles = (theme: KeyboardTheme) =>
  ({
    container: {
      label: 'Component-container',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    },
    colorPickers: {
      label: 'Component-colorPickers',
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    row: {
      label: 'Component-row',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    label: {
      label: 'Component-label',
      fontSize: 15,
      color: `${theme.body.text1}`,
      overflow: 'visible',
      lineHeight: '20px',
    },
  }) satisfies Record<string, CSSObject>;
export const lightingReactiveStyles = (theme: KeyboardTheme) =>
  ({
    container: {
      label: 'Component-container',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    },
    label: {
      label: 'Component-label',
      fontSize: 15,
      color: `${theme.body.text1}`,
      overflow: 'visible',
      lineHeight: '20px',
    },
  }) satisfies Record<string, CSSObject>;
export const lightingLayerStyles = (theme: KeyboardTheme) =>
  ({
    controls: {
      label: 'Component-controls',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      paddingTop: 16,
    },
    label: {
      label: 'Component-label',
      fontSize: 15,
      color: `${theme.body.text1}`,
      overflow: 'visible',
    },
    modeSelect: {
      label: 'Component-modeSelect',
      display: 'inline-block',
      verticalAlign: 'top',
      minWidth: '100%',
    },
  }) satisfies Record<string, CSSObject>;
export const lightingSettingsStyles = (theme: KeyboardTheme) =>
  ({
    container: {
      label: 'Component-container',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    },
    title: {
      label: 'Component-title',
      lineHeight: 'normal',
      fontSize: 16,
      fontWeight: 700,
      color: `${theme.body.text2}`,
    },
    label: {
      label: 'Component-label',
      position: 'relative',
      flexShrink: 0,
      fontSize: 16,
      color: `${theme.body.text2}`,
      overflow: 'visible',
      lineHeight: '20px',
    },
  }) satisfies Record<string, CSSObject>;
/** Matching lighting cards keep effects and device settings visually distinct. */
export const lightingControlStyles = (theme: KeyboardTheme) =>
  ({
    container: {
      label: 'Component-container',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      gap: 20,
      '@media (max-width: 1140px)': { gridTemplateColumns: '1fr' },
    },
    section: {
      label: 'Component-section',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      border: `1px solid ${theme.body.borderColor}`,
      borderRadius: 10,
      background: `${theme.modal.backgroundColor}`,
      lineHeight: 'initial',
      color: `${theme.body.text2}`,
    },
  }) satisfies Record<string, CSSObject>;
