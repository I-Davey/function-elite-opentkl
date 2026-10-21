import type { CSSObject } from '@emotion/react';
import type { KeyboardTheme } from '../theme/types.js';
import type { Color } from '../theme/color.js';
import { formatHex } from '../theme/color.js';
import { colors } from '../theme/colors.js';
export const colorPickerSwatchStyles = (theme: KeyboardTheme, color?: Color) =>
  ({
    swatch: {
      label: 'Component-swatch',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 22,
      borderRadius: 2,
      overflow: 'hidden',
      border: `1px solid ${theme.body.separatorColor}`,
      cursor: 'pointer',
      padding: 0,
      backgroundColor: void 0 !== color ? color.toString() : '',
      borderColor: void 0 !== color ? color.darken(0.1).toString() : '',
    },
    transparentSwatch: {
      label: 'Component-transparentSwatch',
      backgroundColor: '#fff',
      backgroundImage:
        'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), \n                      linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)',
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0, 10px 10px',
      border: '1px solid #ccc',
    },
  }) satisfies Record<string, CSSObject>;
export const colorPickerSimpleStyles = () =>
  ({
    swatchGrid: {
      label: 'Component-swatchGrid',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
      gridColumnGap: 22,
      gridRowGap: 14,
      paddingBottom: 6,
    },
    swatchGridOutline: { label: 'Component-swatchGridOutline', minHeight: 94 },
  }) satisfies Record<string, CSSObject>;
export const colorPickerHeaderStyles = (theme: KeyboardTheme) =>
  ({
    heading: {
      label: 'Component-heading',
      display: 'flex',
      gap: 6,
      color: `${theme.body.text2}`,
      fontSize: 13,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    tab: {
      label: 'Component-tab',
      color: `${theme.body.text3}`,
      padding: '0px 6px 4px 6px',
      border: 'none',
      borderBottom: '3px solid transparent',
      borderRadius: 0,
      background: 'none',
      fontSize: 15,
    },
    selectedTab: {
      label: 'Component-selectedTab',
      borderBottom: `3px solid ${theme.body.secondary}`,
    },
    swatchGrid: {
      label: 'Component-swatchGrid',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
      gridColumnGap: 22,
      gridRowGap: 14,
      paddingBottom: 6,
    },
    recentSwatches: {
      label: 'Component-recentSwatches',
      marginTop: 12,
      paddingBottom: 8,
      marginBottom: 8,
      borderBottom: `1px solid ${theme.body.separatorColor}`,
    },
  }) satisfies Record<string, CSSObject>;
export const colorPickerButtonStyles = (theme: KeyboardTheme, hex: string, outlineHex?: string) =>
  ({
    button: {
      label: 'Component-button',
      width: 'auto',
      border: `1px solid ${theme.colorPicker.button.borderColor}`,
      backgroundColor: 'transparent',
      height: 36,
      paddingLeft: 6,
      ':hover': {
        boxShadow: `0 0 4px 1px ${theme.colorPicker.button.borderColor.alpha(0.5)}`,
      },
      ':active': {
        boxShadow: `0 0 4px 1px ${theme.colorPicker.button.borderColor.alpha(0.5)}`,
      },
      ':focus': {
        boxShadow: `0 0 4px 1px ${theme.colorPicker.button.borderColor.alpha(0.5)}`,
      },
      ':disabled, :disabled *': {
        cursor: 'not-allowed',
        boxShadow: 'none',
      },
    },
    buttonMinimal: {
      label: 'Component-buttonMinimal',
      border: '0 none',
      height: 'auto',
      padding: 0,
    },
    buttonMinimalWithDownArrow: {
      label: 'Component-buttonMinimalWithDownArrow',
      border: `1px solid ${theme.colorPicker.button.borderColor}`,
      height: 35,
      padding: '0 6px',
    },
    buttonInner: {
      label: 'Component-buttonInner',
      minWidth: 110,
      flex: '1 0 auto',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontFamily: 'Segoe UI, sans-serif',
      fontSize: 15,
      color: `${theme.colorPicker.button.color}`,
      whiteSpace: 'nowrap',
      height: '100%',
    },
    buttonInnerMinimal: { label: 'Component-buttonInnerMinimal', minWidth: 'auto' },
    buttonIcon: { label: 'Component-buttonIcon', marginTop: 3, marginLeft: 6, width: 10 },
    noShim: {
      label: 'Component-noShim',
      padding: '0 !important',
      margin: 0,
      backgroundColor: 'transparent !important',
      border: 'none !important',
    },
    swatch: {
      label: 'Component-swatch',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 22,
      borderRadius: 2,
      overflow: 'hidden',
      border: `1px solid ${theme.body.separatorColor}`,
      cursor: 'pointer',
      padding: 0,
      backgroundColor: formatHex(hex),
    },
    outline: {
      label: 'Component-outline',
      width: 20,
      height: 20,
      borderColor: outlineHex ? formatHex(outlineHex) : colors.white.toString(),
      borderStyle: outlineHex ? 'solid' : 'dashed',
      borderWidth: 2,
    },
  }) satisfies Record<string, CSSObject>;
export const rgbInputStyles = (theme: KeyboardTheme) =>
  ({
    rgbContainer: {
      label: 'Component-rgbContainer',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      'input::-webkit-outer-spin-button, input::-webkit-inner-spin-button': {
        ' -webkit-appearance': 'none',
        margin: 0,
      },
    },
    rgbInput: {
      label: 'Component-rgbInput',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      label: 'Component-label',
      display: 'flex',
      padding: '0px 6px 0 6px',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      color: `${theme.body.text2}`,
      cursor: 'inherit',
    },
    textField: {
      label: 'Component-textField',
      borderRadius: 0,
      outline: 'none',
      border: `1px solid ${theme.secondaryButton.borderColor}`,
      fontSize: 12,
      height: 22,
      maxWidth: 26,
      backgroundColor: `${theme.body.backgroundColor}`,
      color: `${theme.body.text1}`,
    },
  }) satisfies Record<string, CSSObject>;
