import type { CSSObject } from '@emotion/react';
import type { KeyboardTheme } from '../../theme/types.js';
export const activationKeyStyles = (theme: KeyboardTheme) =>
  ({
    container: {
      label: 'Component-container',
      display: 'flex',
      position: 'relative',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
      border: `1px solid ${theme.body.borderColor}`,
      backgroundColor: `${theme.body.backgroundColor}`,
      flex: 1,
      height: '100%',
      boxSizing: 'border-box',
      borderRadius: 3,
      '&.with-innerLabel': {
        padding: '14px 16px',
      },
    },
    entry: {
      label: 'Component-entry',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    innerLabel: {
      label: 'Component-innerLabel',
      marginBottom: 5,
      fontSize: 15,
      color: `${theme.body.text1}`,
    },
    labelContainer: {
      label: 'Component-labelContainer',
      width: '100%',
      flex: 1,
    },
    prompt: {
      label: 'Component-prompt',
      border: 0,
      color: `${theme.body.text3}`,
      backgroundColor: 'transparent',
      width: '100%',
      minHeight: 32,
      height: '100%',
      cursor: 'text',
      padding: '2px 8px',
      fontSize: 15,
      '&.with-innerLabel': {
        outline: 'none !important',
        padding: 0,
        fontSize: 24,
      },
    },
    containerWarning: {
      label: 'Component-containerWarning',
      border: `1px solid ${theme.macroUI.activationKeyWarning}`,
    },
    promptWarning: {
      label: 'Component-promptWarning',
      color: `${theme.macroUI.activationKeyWarning}`,
    },
    noActivationKeyPrompt: {
      label: 'Component-noActivationKeyPrompt',
      fontStyle: 'italic',
      color: `${theme.body.text3}`,
    },
    errorSvg: {
      label: 'Component-errorSvg',
      color: `${theme.macroUI.activationKeyWarning}`,
      width: 20,
      height: 20,
    },
    focusedBorder: {
      label: 'Component-focusedBorder',
      border: `1px solid ${theme.ui.focusedBorderColor}`,
    },
    disabled: { label: 'Component-disabled', opacity: 0.4 },
  }) satisfies Record<string, CSSObject>;
export const macroListItemStyles = (theme: KeyboardTheme) =>
  ({
    inputField: {
      label: 'Component-inputField',
      backgroundColor: `${theme.settings.navBackgroundColor}`,
      height: 38,
    },
    nameFieldText: { label: 'Component-nameFieldText', fontSize: 15 },
    nameColumn: { label: 'Component-nameColumn', gridColumnStart: 'name' },
    activationButtonColumn: {
      label: 'Component-activationButtonColumn',
      gridColumnStart: 'activationButton',
    },
    macroListItem: {
      label: 'Component-macroListItem',
      display: 'grid',
      marginBottom: 16,
      gridTemplateAreas: "'name activationButton optionIcon deleteIcon'",
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto auto',
      gap: '8px 16px',
      alignItems: 'center',
      '&:last-child': {
        marginBottom: 0,
      },
    },
    iconButton: {
      label: 'Component-iconButton',
      cursor: 'pointer',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: 16,
      height: 16,
      '&.with-border': {
        border: 'solid',
        borderRadius: '50%',
        borderWidth: 1,
        borderColor: `${theme.body.text1}`,
        '& svg': {
          width: 8,
          height: 8,
        },
      },
    },
    icon: {
      label: 'Component-icon',
      width: 16,
      height: 16,
      color: `${theme.body.text1}`,
      cursor: 'pointer',
    },
  }) satisfies Record<string, CSSObject>;
export const macroControlStyles = (theme: KeyboardTheme) =>
  ({
    container: {
      label: 'Component-container',
      display: 'flex',
      flexDirection: 'row',
      gap: 20,
    },
    section: {
      label: 'Component-section',
      minHeight: 340,
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
      alignItems: 'flex-start',
      lineHeight: 'normal',
      fontSize: 16,
      fontWeight: 700,
      color: `${theme.body.text2}`,
      marginBottom: 16,
    },
    macroContent: { label: 'Component-macroContent', marginBottom: 16 },
    macroList: {
      label: 'Component-macroList',
      height: 240,
      overflowY: 'auto',
      paddingRight: 12,
    },
    label: {
      label: 'Component-label',
      fontSize: 15,
      width: 289,
      color: `${theme.body.labelColor}`,
    },
    macroListItem: {
      label: 'Component-macroListItem',
      display: 'grid',
      marginBottom: 8,
      gridTemplateAreas: "'name activationButton'",
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 48px',
      gap: '8px 16px',
      alignItems: 'center',
    },
    nameColumn: {
      label: 'Component-nameColumn',
      gridColumnStart: 'name',
      paddingLeft: 4,
    },
    activationButtonColumn: {
      label: 'Component-activationButtonColumn',
      gridColumnStart: 'activationButton',
    },
    macroDescription: {
      label: 'Component-macroDescription',
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
  }) satisfies Record<string, CSSObject>;
export const macroCreationStyles = (theme: KeyboardTheme) =>
  ({
    modalContent: { label: 'Component-modalContent', overflow: 'hidden' },
    radioContainer: {
      label: 'Component-radioContainer',
      height: 25,
      display: 'flex',
      alignItems: 'center',
      color: `${theme.body.labelColor}`,
      marginRight: 16,
    },
    radio: {
      label: 'Component-radio',
      WebkitAppearance: 'none',
      position: 'relative',
      width: 20,
      height: 20,
      margin: 0,
      marginRight: 8,
      cursor: 'pointer',
      borderRadius: 20,
      border: `1px solid ${theme.ui.borderColor}`,
      '&::after': {
        position: 'absolute',
        top: 6,
        left: 6,
        content: '""',
        borderRadius: '50%',
        height: 6,
        width: 6,
      },
      '&:checked': {
        backgroundColor: `${theme.ui.selectedBackgroundColor}`,
      },
      '&:checked::after': {
        backgroundColor: `${theme.ui.selectedIndicatorColor}`,
      },
      '&:focus': {
        outlineWidth: 0,
        borderRadius: '50%',
        boxShadow: `0 0 0 1px ${theme.ui.focusedBorderColor}`,
      },
    },
    optionsContainer: {
      label: 'Component-optionsContainer',
      display: 'flex',
      flexDirection: 'column',
    },
    textField: {
      label: 'Component-textField',
      marginBottom: 16,
      backgroundColor: `${theme.settings.navBackgroundColor}`,
    },
    existingMacroItem: {
      label: 'Component-existingMacroItem',
      display: 'flex',
      alignItems: 'center',
    },
    item: { label: 'Component-item', marginBottom: 16 },
    macroDropdown: { label: 'Component-macroDropdown', width: 212 },
  }) satisfies Record<string, CSSObject>;
