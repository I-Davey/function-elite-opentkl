import type { CSSObject } from '@emotion/react';
import type { KeyboardTheme } from '../theme/types.js';
import { zIndex } from '../theme/layers.js';
export const advancedColorStyles = (theme: KeyboardTheme) =>
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
    hexContainer: {
      label: 'Component-hexContainer',
      display: 'flex',
      alignItems: 'baseline',
      gap: 6,
      padding: '6px 0',
    },
    label: {
      label: 'Component-label',
      alignSelf: 'center',
      color: `${theme.body.text2}`,
      fontSize: 13,
      cursor: 'inherit',
    },
    textField: {
      label: 'Component-textField',
      outline: 'none',
      border: `1px solid ${theme.secondaryButton.borderColor}`,
      backgroundColor: `${theme.body.backgroundColor}`,
      color: `${theme.body.text1}`,
      fontSize: 12,
      height: 22,
      maxWidth: 54,
      textTransform: 'uppercase',
    },
  }) satisfies Record<string, CSSObject>;
export const colorPickerStyles = (theme: KeyboardTheme) =>
  ({
    tooltipInner: {
      label: 'Component-tooltipInner',
      backgroundColor: `${theme.colorPicker.backgroundColor}`,
    },
    pickerContainer: {
      label: 'Component-pickerContainer',
      width: 250,
      backgroundColor: 'transparent',
    },
    pickerMode: { label: 'Component-pickerMode', zIndex: zIndex('base'), marginBottom: 6 },
    buttons: {
      label: 'Component-buttons',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    buttonPicker: {
      label: 'Component-buttonPicker',
      width: '47.5%',
      fontSize: 13,
      border: `1px solid ${theme.colorPicker.button.borderColor}`,
      borderRadius: 0,
      backgroundColor: 'transparent',
      ':hover': {
        boxShadow: `0 0 4px 1px ${theme.colorPicker.button.borderColor.alpha(0.5)}`,
      },
      ':active': {
        boxShadow: `0 0 4px 1px ${theme.colorPicker.button.borderColor.alpha(0.5)}`,
      },
    },
  }) satisfies Record<string, CSSObject>;
export const colorStopTooltipStyles = (theme: KeyboardTheme) =>
  ({
    innerClassName: {
      label: 'Component-innerClassName',
      width: 200,
      lineHeight: '22px',
      backgroundColor: `${theme.colorPicker.backgroundColor}`,
      color: `${theme.body.text1}`,
    },
    open: { label: 'Component-open', color: `${theme.body.secondary}` },
    infoIcon: {
      label: 'Component-infoIcon',
      transition: 'all 0.2s ease-in-out',
      color: `${theme.body.text1}`,
      '*': {
        cursor: 'pointer',
      },
      '&:hover': {
        color: `${theme.body.secondary}`,
      },
      height: 14,
      width: 14,
      marginLeft: 4,
    },
  }) satisfies Record<string, CSSObject>;
export const gradientPickerStyles = (theme: KeyboardTheme) =>
  ({
    tooltipInner: {
      label: 'Component-tooltipInner',
      backgroundColor: `${theme.colorPicker.backgroundColor}`,
    },
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
    },
    buttonMinimal: {
      label: 'Component-buttonMinimal',
      border: '0 none',
      height: 'auto',
      padding: 0,
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
    buttonSwatch: { label: 'Component-buttonSwatch', marginRight: 6 },
    buttonSwatchMinimal: { label: 'Component-buttonSwatchMinimal', marginRight: 0 },
    pickerContainer: {
      label: 'Component-pickerContainer',
      width: 250,
      backgroundColor: 'transparent',
    },
    pickerMode: { label: 'Component-pickerMode', zIndex: zIndex('base'), marginBottom: 6 },
    buttonInnerMinimal: { label: 'Component-buttonInnerMinimal', minWidth: 'auto' },
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
      padding: 0,
    },
    buttons: {
      label: 'Component-buttons',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    buttonPicker: {
      label: 'Component-buttonPicker',
      width: '47.5%',
      fontSize: 13,
      border: `1px solid ${theme.colorPicker.button.borderColor}`,
      borderRadius: 0,
      backgroundColor: 'transparent',
      ':hover': {
        boxShadow: `0 0 4px 1px ${theme.colorPicker.button.borderColor.alpha(0.5)}`,
      },
      ':active': {
        boxShadow: `0 0 4px 1px ${theme.colorPicker.button.borderColor.alpha(0.5)}`,
      },
    },
    heading: {
      label: 'Component-heading',
      display: 'flex',
      alignItems: 'center',
      color: `${theme.body.text2}`,
      fontSize: 13,
      fontWeight: 'bold',
      textTransform: 'uppercase',
    },
    customHeading: {
      label: 'Component-customHeading',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    swatchHeading: { label: 'Component-swatchHeading', marginBottom: 12 },
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
      paddingBottom: 8,
      marginBottom: 8,
      borderBottom: `1px solid ${theme.body.separatorColor}`,
    },
    slider: {
      label: 'Component-slider',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      marginBottom: 10,
      width: '100%',
      height: 10,
    },
    rail: { label: 'Component-rail', width: '100%', height: 10 },
    handle: {
      label: 'Component-handle',
      '&&': {
        position: 'absolute',
        borderRadius: '50%',
        marginLeft: -7,
        border: '2px solid',
        width: 14,
        height: 14,
        transition: '0.3s ease box-shadow, 0.3s ease background-color',
        boxShadow: '0px 0px 2px 1px rgba(0, 0, 0, 0.50)',
      },
    },
    noShim: {
      label: 'Component-noShim',
      padding: '0 !important',
      margin: 0,
      backgroundColor: 'transparent !important',
      border: 'none !important',
    },
    buttonIcon: { label: 'Component-buttonIcon', marginTop: 3, marginLeft: 6, width: 10 },
    biggerIcon: { label: 'Component-biggerIcon', width: 36, height: 36 },
    hexContainer: {
      label: 'Component-hexContainer',
      display: 'flex',
      alignItems: 'baseline',
      gap: 6,
      padding: '6px 0',
    },
    label: {
      label: 'Component-label',
      alignSelf: 'center',
      color: `${theme.body.text2}`,
      fontSize: 13,
      cursor: 'inherit',
    },
    textField: {
      label: 'Component-textField',
      outline: 'none',
      border: `1px solid ${theme.secondaryButton.borderColor}`,
      backgroundColor: `${theme.body.backgroundColor}`,
      color: `${theme.body.text1}`,
      fontSize: 12,
      height: 22,
      maxWidth: 54,
      textTransform: 'uppercase',
    },
    buttonMinimalWithDownArrow: {
      label: 'Component-buttonMinimalWithDownArrow',
      border: `1px solid ${theme.colorPicker.button.borderColor}`,
      height: 35,
      padding: '0 6px',
    },
  }) satisfies Record<string, CSSObject>;
/** Recover the private fork's CSS delta without copying its runtime. */
export const nzxtColorPickerStyle: CSSObject = {
  '.react-colorful__saturation': { borderRadius: 0, borderBottom: 'none' },
  '.react-colorful__alpha, .react-colorful__hue': { marginTop: 10, height: 10 },
  '.react-colorful__last-control': { borderRadius: 0 },
  '.react-colorful__pointer': { width: 14, height: 14 },
  '.react-colorful__interactive:focus .react-colorful__pointer': {
    transform: 'translate(-50%, -50%)',
  },
  '.react-colorful__hue-pointer': { cursor: 'pointer' },
};
