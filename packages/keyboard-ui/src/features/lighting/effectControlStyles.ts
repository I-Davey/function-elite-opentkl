import type { CSSObject } from '@emotion/react';
import type { KeyboardTheme } from '../../theme/types.js';
import { zIndex } from '../../theme/layers.js';
export const keyboardSizeStyles = (theme: KeyboardTheme) =>
  ({
    tooltipInner: {
      label: 'Component-tooltipInner',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 15,
      boxShadow: `0 0 4px 0 ${theme.body.borderColor.alpha(0.5)}`,
      borderRadius: 2,
      padding: '3px 7px',
      backgroundColor: `${theme.ui.tooltipBackgroundColor}`,
      color: `${theme.ui.tooltipColor}`,
      zIndex: zIndex('tooltip'),
    },
  }) satisfies Record<string, CSSObject>;
