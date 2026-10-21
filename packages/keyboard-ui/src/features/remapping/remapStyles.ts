import type { CSSObject } from '@emotion/react';
import type { KeyboardTheme } from '../../theme/types.js';
/** Mapping destinations and the selected assignment share the desktop card treatment. */
export const remapControlStyles = (theme: KeyboardTheme) =>
  ({
    container: { label: 'Component-container', display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 20 },
    section: {
      label: 'Component-section',
      minHeight: 340,
      maxHeight: 440,
      minWidth: 0,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${theme.body.borderColor}`,
      borderRadius: 10,
      background: `${theme.modal.backgroundColor}`,
      lineHeight: 'initial',
      color: `${theme.body.text2}`,
      '&:nth-child(1)': {
        flex: 2,
      },
      '&:nth-child(2)': {
        flex: 1,
      },
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
      marginBottom: 16,
    },
  }) satisfies Record<string, CSSObject>;
export const remapTargetStyles = (theme: KeyboardTheme) =>
  ({
    hintText: {
      label: 'Component-hintText',
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      '& > p': {
        whiteSpace: 'normal',
        fontSize: 14,
        color: `${theme.body.text4}`,
        fontStyle: 'italic',
        textAlign: 'center',
      },
    },
    searchField: {
      label: 'Component-searchField',
      marginBottom: 16,
      backgroundColor: `${theme.settings.navBackgroundColor}`,
      height: 38,
      maxHeight: 38,
    },
    searchFieldText: { label: 'Component-searchFieldText', fontSize: 15 },
    keysContainer: {
      label: 'Component-keysContainer',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      boxSizing: 'border-box',
      paddingRight: 12,
    },
  }) satisfies Record<string, CSSObject>;
export const targetCategoryStyles = (
  theme: KeyboardTheme,
  isDetailShow: boolean,
  isDual: boolean,
) =>
  ({
    keysWrapper: {
      label: 'Component-keysWrapper',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      flexWrap: 'wrap',
      gap: 6,
      paddingBottom: 8,
    },
    keyCategory: {
      label: 'Component-keyCategory',
      lineHeight: 1.5,
      fontSize: 15,
      fontWeight: 700,
      color: `${theme.body.text2}`,
      padding: '8px 4px',
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: `${theme.subnav.hoverBackgroundColor}`,
      },
      '& > *': {
        cursor: 'pointer',
      },
      '& > svg': {
        marginBottom: -4,
        marginLeft: 8,
        fontSize: 12,
        transform: isDetailShow ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform .2s ease-out',
      },
    },
    key: {
      label: 'Component-key',
      g: {
        'text, svg': {
          fill: `${theme.keyboard.selectedKeyText}`,
        },
      },
      cursor: 'pointer',
      '& *': {
        cursor: 'pointer',
      },
      '&:hover': {
        g: {
          'text, svg': {
            fill: isDual ? `${theme.keyboard.simpleRemapDual}` : `${theme.keyboard.simpleRemap}`,
          },
        },
      },
    },
    details: {
      label: 'Component-details',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    detailsInner: {
      label: 'Component-detailsInner',
      width: '100%',
      opacity: 0,
      transition: 'opacity 100ms ease-out',
    },
    detailsInnerVisible: { label: 'Component-detailsInnerVisible', opacity: 1 },
  }) satisfies Record<string, CSSObject>;
export const appliedKeyStyles = (theme: KeyboardTheme, isDual: boolean) =>
  ({
    hintText: {
      label: 'Component-hintText',
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      '& > p': {
        whiteSpace: 'normal',
        fontSize: 14,
        color: `${theme.body.text4}`,
        fontStyle: 'italic',
        textAlign: 'center',
      },
    },
    flexCenter: {
      label: 'Component-flexCenter',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      flexGrow: 1,
    },
    modifier: {
      label: 'Component-modifier',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      height: 32,
      fontWeight: 500,
      alignItems: 'center',
      width: '100%',
    },
    enableDual: {
      label: 'Component-enableDual',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      width: '100%',
    },
    appliedKeys: {
      label: 'Component-appliedKeys',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 5,
      boxSizing: 'border-box',
      textAlign: 'center',
      gap: 16,
    },
    appliedKeyControls: {
      label: 'Component-appliedKeyControls',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    },
    appliedKey: {
      label: 'Component-appliedKey',
      cursor: isDual ? 'pointer' : 'default',
      '& *': {
        cursor: isDual ? 'pointer' : 'default',
      },
      '& > svg': {
        g: {
          'text, svg': {
            fill: `${theme.keyboard.simpleRemap}`,
          },
        },
      },
      '&.dual > svg': {
        g: {
          'text, svg': {
            fill: `${theme.keyboard.simpleRemapDual}`,
          },
        },
      },
    },
    resetButton: {
      label: 'Component-resetButton',
      margin: '8px 0px',
      width: 100,
      '&.hide': {
        visibility: 'hidden',
      },
    },
    checkbox: {
      label: 'Component-checkbox',
      '& > span': {
        whiteSpace: 'nowrap',
      },
    },
    select: { label: 'Component-select', width: 110 },
  }) satisfies Record<string, CSSObject>;
