import type { CSSObject } from '@emotion/react';
import type { KeyboardTheme } from '../../theme/types.js';
/** Compact profile bar; the application shell owns the page heading. */
export const profileHeaderStyles = (theme: KeyboardTheme) =>
  ({
    container: {
      label: 'Component-container',
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      minWidth: 0,
    },
    header: {
      label: 'Component-header',
      display: 'flex',
      justifyContent: 'space-between',
      minHeight: 38,
      width: '100%',
      '& h1': { fontSize: 12, fontWeight: 500, color: `${theme.body.text3}`, marginRight: 20 },
    },
    headerContent: {
      label: 'Component-headerContent',
      display: 'flex',
      justifyContent: 'flex-end',
      minWidth: 0,
    },
    profileControls: {
      label: 'Component-profileControls',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 10,
    },
    tooltipContainer: {
      label: 'Component-tooltipContainer',
      display: 'flex',
      alignItems: 'center',
    },
    profileSelection: {
      label: 'Component-profileSelection',
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 12,
    },
    profileSelect: { label: 'Component-profileSelect', width: 220, fontSize: 12 },
    editButton: {
      label: 'Component-editButton',
      width: 'auto',
      height: '100%',
      padding: '0 6px',
    },
    editButtonContainer: { label: 'Component-editButtonContainer' },
    tooltipInner: {
      label: 'Component-tooltipInner',
      background: `${theme.tooltip.backgroundColor}`,
      color: `${theme.body.text2}`,
      width: 310,
      fontSize: 15,
      lineHeight: '20px',
    },
    tooltipHeader: {
      label: 'Component-tooltipHeader',
      fontWeight: 700,
      paddingBottom: 16,
    },
    tooltipBody: {
      label: 'Component-tooltipBody',
      color: `${theme.ui.tooltipSecondaryColor}`,
      fontStyle: 'italic',
      paddingBottom: 16,
      whiteSpace: 'normal',
    },
    hardwareInfo: {
      label: 'Component-hardwareInfo',
      fontSize: 13,
      fontWeight: 600,
      color: `${theme.body.text3}`,
      paddingRight: 0,
    },
    copyToHardwareButton: {
      label: 'Component-copyToHardwareButton',
      fontSize: 12,
    },
  }) satisfies Record<string, CSSObject>;
export const profileEditStyles = (theme: KeyboardTheme) =>
  ({
    modalContent: {
      label: 'Component-modalContent',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    content: {
      label: 'Component-content',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      color: `${theme.body.text3}`,
      lineHeight: 1.4,
      '& h1': {
        marginBottom: 20,
        fontSize: 34,
      },
      '& h2': {
        marginBottom: 20,
        fontSize: 24,
      },
    },
    heading: { label: 'Component-heading', color: `${theme.body.text2}` },
    body: {
      label: 'Component-body',
      flex: 1,
      overflow: 'auto',
      marginBottom: 20,
    },
    textField: { label: 'Component-textField', marginBottom: 16 },
    copyProfileSection: {
      label: 'Component-copyProfileSection',
      marginTop: 12,
      paddingTop: 12,
      borderTop: `1px solid ${theme.ui.borderColor}`,
      display: 'flex',
      alignItems: 'center',
    },
    profileSelect: {
      label: 'Component-profileSelect',
      width: 250,
      marginLeft: 8,
    },
  }) satisfies Record<string, CSSObject>;
export const copyToOnboardStyles = (theme: KeyboardTheme) =>
  ({
    modalContent: { label: 'Component-modalContent', overflow: 'hidden' },
    optionsContainer: {
      label: 'Component-optionsContainer',
      display: 'flex',
      flexDirection: 'column',
    },
    control: { label: 'Component-control', marginBottom: 16 },
    disabledTextInput: {
      label: 'Component-disabledTextInput',
      pointerEvents: 'none',
    },
    dropdownLabel: {
      label: 'Component-dropdownLabel',
      marginBottom: 8,
      color: `${theme.body.labelColor}`,
    },
  }) satisfies Record<string, CSSObject>;
