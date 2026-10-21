import type { CSSObject } from '@emotion/react';
import type { KeyboardTheme } from '../theme/types.js';
import { colors } from '../theme/colors.js';

export const textFieldStyles = (theme: KeyboardTheme) =>
  ({
    container: {
      label: 'TextField-container',
      display: 'flex',
      position: 'relative',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
      border: `1px solid ${theme.body.borderColor}`,
      backgroundColor: `${theme.settings.navBackgroundColor}`,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 14,
      paddingBottom: 14,
      flex: 1,
      boxSizing: 'border-box',
      borderRadius: 6,
    },
    issueIcon: {
      label: 'TextField-issueIcon',
      position: 'absolute',
      right: 12,
      color: `${colors.red}`,
    },
    focused: { label: 'TextField-focused', border: `1px solid ${theme.ui.focusedBorderColor}` },
    error: { label: 'TextField-error', border: `1px solid ${colors.red}`, borderRadius: 2 },
    label: {
      label: 'TextField-label',
      marginBottom: 5,
      fontSize: 15,
      color: `${theme.body.labelColor}`,
    },
    labelContainer: {
      label: 'TextField-labelContainer',
      width: '100%',
      flex: 1,
      display: 'inline-block',
    },
    errorLabel: { label: 'TextField-errorLabel', color: `${colors.red}` },
    prompt: {
      label: 'TextField-prompt',
      border: 0,
      fontSize: 24,
      color: `${theme.body.text3}`,
      backgroundColor: `${theme.settings.navBackgroundColor}`,
      width: '100%',
      '&:focus': {
        outline: 'none',
      },
    },
    promptTextArea: { label: 'TextField-promptTextArea', fontSize: 16 },
    icon: {
      label: 'TextField-icon',
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: `${theme.settings.navBackgroundColor}`,
    },
    iconLeft: { label: 'TextField-iconLeft', top: 10, left: 10, right: 0, height: 24, width: 24 },
    iconLeftText: { label: 'TextField-iconLeftText', paddingLeft: 32 },
    inputContainer: { label: 'TextField-inputContainer', display: 'flex' },
    disabled: { label: 'TextField-disabled', opacity: 0.4 },
  }) satisfies Record<string, CSSObject>;

export const defaultSegmentedStyles = (theme: KeyboardTheme) =>
  ({
    optionContainer: {
      label: 'Component-optionContainer',
      display: 'flex',
      borderRadius: 5,
      backgroundColor: `${theme.controlTabs.background}`,
      width: '100%',
      height: 36,
      borderTop: `1px solid ${theme.segmentedPicker.borderColor}`,
      borderBottom: `1px solid ${theme.segmentedPicker.borderColor}`,
    },
    lastOption: {
      label: 'Component-lastOption',
      borderLeft: `1px solid ${theme.segmentedPicker.borderColor}`,
    },
    firstOption: {
      label: 'Component-firstOption',
      borderRight: `1px solid ${theme.segmentedPicker.borderColor}`,
    },
    segmentOption: {
      label: 'Component-segmentOption',
      color: `${theme.body.text1}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 36,
      width: '100%',
      margin: 'auto',
      borderRadius: 5,
      cursor: 'pointer',
    },
    selectedSegmentOption: {
      label: 'Component-selectedSegmentOption',
      margin: 'auto',
      backgroundColor: `${theme.controlTabs.selectedBackground}`,
      color: `${theme.controlTabs.selected}`,
    },
  }) satisfies Record<string, CSSObject>;

export const underlineSegmentedStyles = (theme: KeyboardTheme) =>
  ({
    optionContainer: {
      label: 'Component-optionContainer',
      display: 'flex',
      backgroundColor: `${theme.segmentedPicker.underline.background}`,
      width: '100%',
      height: 55,
      borderBottom: '2px solid transparent',
      position: 'relative',
    },
    segmentOption: {
      label: 'Component-segmentOption',
      color: `${theme.body.text1}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 55,
      paddingLeft: 36,
      paddingRight: 36,
      cursor: 'pointer',
      letterSpacing: 0.25,
    },
    underline: {
      label: 'Component-underline',
      position: 'absolute',
      top: '100%',
      height: 2,
      backgroundColor: `${theme.segmentedPicker.underline.selected}`,
    },
    selectedSegmentOption: {
      label: 'Component-selectedSegmentOption',
      textShadow: `0.25px 0px 0px ${theme.body.text1}, -0.25px 0px 0px ${theme.body.text1}`,
    },
  }) satisfies Record<string, CSSObject>;

export const headerStyles = (theme: KeyboardTheme) =>
  ({
    container: {
      label: 'Component-container',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
      width: '100%',
    },
    title: {
      label: 'Component-title',
      padding: '5px 0 5px 0',
      fontSize: 24,
      fontWeight: 200,
      marginRight: 12,
      color: `${theme.body.text2}`,
      lineHeight: 1.2,
    },
    BackButton: { label: 'Component-BackButton', paddingTop: 6, paddingRight: 12 },
    divider: {
      label: 'Component-divider',
      paddingBottom: 16,
      borderBottom: `1px solid ${theme.body.borderColor}`,
    },
    content: {
      label: 'Component-content',
      display: 'flex',
      flex: '1 0 auto',
      alignItems: 'stretch',
    },
  }) satisfies Record<string, CSSObject>;

export const backButtonStyles = () =>
  ({
    container: {
      label: 'Component-container',
      outline: 'none',
      ':active': {
        outline: 'none',
      },
      ':visited': {
        outline: 'none',
      },
    },
    icon: { label: 'Component-icon', marginRight: '0.5em', fontSize: 13 },
  }) satisfies Record<string, CSSObject>;
