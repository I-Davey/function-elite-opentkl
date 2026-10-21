import type { CSSObject } from '@emotion/react';
import type { KeyboardTheme } from '../theme/types.js';
export const quickSelectStyles = (theme: KeyboardTheme) =>
  ({
    container: {
      label: 'Component-container',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      ['@media (max-width: 1180px)']: {
        flexDirection: 'row',
      },
    },
    icon: {
      label: 'Component-icon',
      width: 22,
      height: 22,
      cursor: 'pointer',
      '& path': {
        cursor: 'pointer',
      },
    },
    item: {
      label: 'Component-item',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: 116,
      height: 38,
      borderRadius: 7,
      border: `1px solid ${theme.body.borderColor}`,
      transition: 'border-color 0.2s ease',
      background: `${theme.lightingAccessory.expandedBackgroundColor}`,
      fontWeight: 400,
      cursor: 'pointer',
      color: `${theme.body.text1}`,
      fontSize: 12,
      '&:hover': { background: `${theme.body.primary.alpha(0.12)}`, borderColor: `${theme.body.primary}` },
    },
    selected: {
      label: 'Component-selected',
      borderColor: `${theme.body.primary}`,
      background: `${theme.body.primary.alpha(0.14)}`,
      transition: 'border-color 0.5s ease',
      ':hover': {
        borderColor: `${theme.body.primary}`,
      },
    },
  }) satisfies Record<string, CSSObject>;
