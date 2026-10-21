import type { CSSObject } from '@emotion/react';
import type { KeyboardTheme } from '../../theme/types.js';
export const actuationSettingStyles = (theme: KeyboardTheme) =>
  ({
    container: { label: 'Component-container', height: 280 },
    flexCenter: {
      label: 'Component-flexCenter',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    hintText: {
      label: 'Component-hintText',
      width: 95,
      '& > p': {
        whiteSpace: 'normal',
        fontSize: 14,
        marginBottom: 8,
        color: `${theme.body.text4}`,
        fontStyle: 'italic',
        textAlign: 'center',
        width: 125,
        transform: 'translateX(-15px)',
      },
    },
    switch: {
      label: 'Component-switch',
      width: 130,
      height: 130,
      color: `${theme.body.borderColor}`,
      marginRight: 30,
    },
  }) satisfies Record<string, CSSObject>;
export const actuationPresetsStyles = (theme: KeyboardTheme) =>
  ({
    container: {
      label: 'Component-container',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      boxSizing: 'border-box',
    },
    presetItem: {
      label: 'Component-presetItem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      margin: '6px 0',
      padding: '8px 12px',
      borderRadius: 6,
      border: '2px solid',
      borderColor: `${theme.body.borderColor}`,
      cursor: 'pointer',
      '& *': {
        cursor: 'pointer',
      },
      '&:hover': {
        borderColor: `${theme.body.ddColor}`,
        transform: 'border-color 0.4s ease-in-out',
      },
      '&.selected': {
        borderColor: `${theme.body.dtColor}`,
      },
    },
    presetName: {
      label: 'Component-presetName',
      flex: 1,
      fontSize: 16,
      paddingTop: 6,
      paddingBottom: 6,
      width: 60,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
    },
    presetValuesWrapper: { label: 'Component-presetValuesWrapper', display: 'flex', gap: 16 },
    presetValue: {
      label: 'Component-presetValue',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      fontSize: 14,
      letterSpacing: 0.6,
      '& > .label': {
        fontWeight: 300,
        whiteSpace: 'nowrap',
      },
    },
  }) satisfies Record<string, CSSObject>;
export const rapidTriggerStyles = (theme: KeyboardTheme) =>
  ({
    mb16: { label: 'Component-mb16', marginBottom: 16 },
    rapidTriggerRow: {
      label: 'Component-rapidTriggerRow',
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'center',
    },
    sliderContainer: { label: 'Component-sliderContainer', width: '100%' },
    checkbox: {
      label: 'Component-checkbox',
      '& > span': {
        whiteSpace: 'nowrap',
      },
    },
    moreInfo: {
      label: 'Component-moreInfo',
      color: `${theme.body.secondary}`,
      fontSize: 13,
      fontWeight: 600,
      marginTop: 4,
      marginLeft: 8,
    },
    tooltipInner: {
      label: 'Component-tooltipInner',
      width: 300,
      lineHeight: '22px',
      backgroundColor: `${theme.colorPicker.backgroundColor}`,
      color: `${theme.body.text1}`,
    },
  }) satisfies Record<string, CSSObject>;
export const pollingRateStyles = (theme: KeyboardTheme) =>
  ({
    pollingSlider: { label: 'Component-pollingSlider', maxWidth: '75%', minWidth: '50%' },
    belowSlider: {
      label: 'Component-belowSlider',
      position: 'relative',
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12,
      color: `${theme.body.text4}`,
      paddingTop: 8,
      paddingBottom: 32,
    },
  }) satisfies Record<string, CSSObject>;
export const performanceControlStyles = (theme: KeyboardTheme) =>
  ({
    container: {
      label: 'Component-container',
      display: 'flex',
      flexDirection: 'column',
      lineHeight: 'initial',
      border: `1px solid ${theme.body.borderColor}`,
      borderRadius: 10,
      background: `${theme.modal.backgroundColor}`,
      gap: 20,
      color: `${theme.body.text2}`,
      padding: 24,
    },
    section: {
      label: 'Component-section',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      gap: 32,
      '& > div': { minWidth: 0 },
      '@media (max-width: 1140px)': { gridTemplateColumns: '1fr' },
    },
    title: {
      label: 'Component-title',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      lineHeight: 'normal',
      fontSize: 16,
      fontWeight: 700,
      color: `${theme.body.text2}`,
      width: '100%',
    },
    moreInfo: {
      label: 'Component-moreInfo',
      color: `${theme.body.secondary}`,
      fontSize: 13,
      fontWeight: 600,
    },
    infoIcon: {
      label: 'Component-infoIcon',
      color: `${theme.body.text1}`,
      '&:hover': {
        color: `${theme.body.secondary}`,
      },
      height: 16,
      width: 16,
      marginLeft: 8,
      marginTop: 4,
    },
    keyboardRegion: { label: 'Component-keyboardRegion', paddingTop: 16 },
    keyboardRegionSelect: { label: 'Component-keyboardRegionSelect', width: 120 },
    tooltipInner: {
      label: 'Component-tooltipInner',
      width: 300,
      lineHeight: '22px',
      backgroundColor: `${theme.colorPicker.backgroundColor}`,
      color: `${theme.body.text1}`,
    },
    regionDescription: {
      label: 'Component-regionDescription',
      overflow: 'visible',
      fontSize: 15,
      lineHeight: 1.3,
      color: `${theme.body.text4}`,
      padding: '8px 0 16px 0',
    },
  }) satisfies Record<string, CSSObject>;
/** Original Snap styles with explicit availability. Unused appliedKey rule removed. */
export const snapOverrideStyles = (theme: KeyboardTheme, available: boolean) =>
  ({
    container: {
      label: 'Component-container',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      boxSizing: 'border-box',
      opacity: available ? 1 : 0.5,
    },
    title: {
      label: 'Component-title',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      lineHeight: 'normal',
      color: `${theme.body.text2}`,
      marginBottom: 16,
    },
    tooltipInner: {
      label: 'Component-tooltipInner',
      width: 300,
      lineHeight: '22px',
      backgroundColor: `${theme.colorPicker.backgroundColor}`,
      color: `${theme.body.text1}`,
    },
    infoIcon: {
      label: 'Component-infoIcon',
      color: `${theme.body.text1}`,
      '&:hover': {
        color: `${theme.body.secondary}`,
      },
      height: 16,
      width: 16,
      marginLeft: 8,
      marginTop: 4,
    },
    description: {
      label: 'Component-description',
      color: `${theme.body.text4}`,
      fontSize: 14,
      marginBottom: 16,
      whiteSpace: 'normal',
    },
    previewKeys: { label: 'Component-previewKeys', display: 'flex', gap: 16 },
    checkbox: {
      label: 'Component-checkbox',
      ...(!available && {
        cursor: 'default',
        '*': {
          cursor: 'default',
        },
      }),
    },
  }) satisfies Record<string, CSSObject>;
