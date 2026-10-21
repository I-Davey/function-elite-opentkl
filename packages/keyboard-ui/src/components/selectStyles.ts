import type { StylesConfig, GroupBase } from 'react-select';
import type { KeyboardTheme } from '../theme/types.js';
import { zIndex } from '../theme/layers.js';

/** Optional presentation flags leave the option/value schema owned by react-select callers. */
function hasOptionFlag(value: unknown, flag: 'isBold' | 'isItalic') {
  const item =
    value !== null && (typeof value === 'object' || typeof value === 'function') ? value : {};
  return flag === 'isBold'
    ? 'isBold' in item && Boolean(item.isBold)
    : 'isItalic' in item && Boolean(item.isItalic);
}

export function getPrimaryStyles<Option, Multi extends boolean, Group extends GroupBase<Option>>(
  theme: KeyboardTheme,
): StylesConfig<Option, Multi, Group> {
  return {
    container: (base, state) => ({
      ...base,
      pointerEvents: 'auto',
      '& *': {
        cursor: state.isDisabled ? 'not-allowed' : 'pointer',
      },
    }),
    control: (base, state) => ({
      ...base,
      opacity: state.isDisabled ? 0.7 : 1,
      backgroundColor: state.isDisabled
        ? `${theme.select.control.disableBackgroundColor}`
        : `${theme.select.control.backgroundColor}`,
      borderColor: `${theme.select.control.borderColor}`,
      borderRadius: 6,
      minHeight: 36,
      caretColor: 'transparent',
      ...(state.isFocused
        ? {
            boxShadow: 'none',
            borderColor: `${theme.select.control.focusedBorderColor}`,
            '&:hover': {
              borderColor: `${theme.select.control.focusedBorderColor.darken(0.1)}`,
            },
          }
        : {}),
      '&:hover': state.isDisabled
        ? {}
        : {
            backgroundColor: `${theme.select.control.hoverBackgroundColor}`,
          },
    }),
    valueContainer: (base) => ({
      ...base,
    }),
    dropdownIndicator: () => ({
      color: `${theme.select.dropdownIndicator.color}`,
      '& > svg': {
        width: 16,
      },
    }),
    singleValue: (base) => ({
      ...base,
      color: `${theme.select.value.color}`,
      fontSize: 13,
      padding: '5px 0',
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: 'transparent',
      width: 0,
    }),
    indicatorsContainer: (base) => ({
      ...base,
      paddingRight: 8,
    }),
    menu: (base) => ({
      ...base,
      marginTop: 6,
      marginBottom: 0,
      border: `1px solid ${theme.select.menu.borderColor}`,
      borderRadius: 7,
      overflow: 'hidden',
      boxShadow: '0 12px 32px #0005',
      zIndex: zIndex('select'),
      backgroundColor: `${theme.select.menu.backgroundColor}`,
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: zIndex('select'),
    }),
    groupHeading: (base) => ({
      ...base,
      color: `${theme.select.option.color}`,
      fontSize: 16,
      fontWeight: 700,
      textTransform: 'none',
    }),
    option: (base, state) => ({
      ...base,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      lineHeight: '36px',
      height: 36,
      fontSize: 16,
      backgroundColor: `${theme.select.option.backgroundColor}`,
      color: `${theme.select.option.color}`,
      fontWeight: hasOptionFlag(state.data, 'isBold') ? 700 : 'normal',
      fontStyle: hasOptionFlag(state.data, 'isItalic') ? 'italic' : 'normal',
      cursor: 'pointer',
      ...(!state.isSelected && {
        '&:hover': {
          backgroundColor: `${theme.select.option.hoverBackgroundColor}`,
          color: `${theme.select.option.focusedColor}`,
        },
      }),
      ...(state.isSelected && {
        backgroundColor: `${theme.select.option.selectedBackgroundColor}`,
        color: `${theme.select.option.focusedColor}`,
      }),
      ...(state.isFocused &&
        !state.isSelected && {
          backgroundColor: `${theme.select.option.hoverBackgroundColor}`,
          color: `${theme.select.option.focusedColor}`,
        }),
    }),
  };
}

export function getSecondaryStyles<Option, Multi extends boolean, Group extends GroupBase<Option>>(
  theme: KeyboardTheme,
): StylesConfig<Option, Multi, Group> {
  return {
    container: (base, state) => ({
      ...base,
      pointerEvents: 'auto',
      '& *': {
        cursor: state.isDisabled ? 'not-allowed' : 'pointer',
      },
    }),
    control: (base, state) => ({
      ...base,
      display: 'flex',
      backgroundColor: `${theme.secondarySelect.control.backgroundColor}`,
      borderColor: `${theme.secondarySelect.control.borderColor}`,
      borderRadius: 4,
      caretColor: 'transparent',
      ...(state.isFocused
        ? {
            boxShadow: 'none',
            borderColor: `${theme.secondarySelect.control.focusedBorderColor}`,
            '&:hover': {
              borderColor: `${theme.secondarySelect.control.focusedBorderColor.darken(0.1)}`,
            },
          }
        : {}),
      opacity: state.isDisabled ? 0.5 : 1,
      '&:hover': state.isDisabled
        ? {}
        : {
            backgroundColor: `${theme.secondarySelect.control.hoverBackgroundColor}`,
          },
    }),
    valueContainer: (base) => ({
      ...base,
    }),
    input: (base) => ({
      ...base,
      color: `${theme.secondarySelect.value.color}`,
    }),
    dropdownIndicator: (_base) => ({
      color: `${theme.secondarySelect.dropdownIndicator.color}`,
      '& > svg': {
        width: 16,
      },
    }),
    singleValue: (base) => ({
      ...base,
      color: `${theme.secondarySelect.value.color}`,
      fontSize: 15,
      padding: '5px 0',
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: 'transparent',
      width: 0,
    }),
    indicatorsContainer: (base) => ({
      ...base,
      paddingLeft: 8,
      paddingRight: 8,
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: zIndex('select'),
    }),
    menu: (base) => ({
      ...base,
      marginTop: -1,
      marginBottom: 0,
      boxShadow: `0 0 4px 0 ${theme.secondarySelect.menu.borderColor}`,
      zIndex: zIndex('select'),
      backgroundColor: `${theme.secondarySelect.menu.backgroundColor}`,
    }),
    menuList: (base) => ({
      ...base,
      padding: '4px 0',
    }),
    groupHeading: (base) => ({
      ...base,
      color: `${theme.select.option.color}`,
      fontSize: 16,
      fontWeight: 700,
      textTransform: 'none',
    }),
    option: (base, state) => ({
      ...base,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      height: 36,
      lineHeight: '36px',
      fontSize: 16,
      backgroundColor: `${theme.secondarySelect.option.backgroundColor}`,
      color: `${theme.secondarySelect.option.color}`,
      fontWeight: hasOptionFlag(state.data, 'isBold') ? 700 : 'normal',
      fontStyle: hasOptionFlag(state.data, 'isItalic') ? 'italic' : 'normal',
      cursor: 'pointer',
      ...(!state.isSelected && {
        '&:hover': {
          backgroundColor: `${theme.secondarySelect.option.hoverBackgroundColor}`,
        },
      }),
      ...(state.isSelected && {
        backgroundColor: `${theme.secondarySelect.option.selectedBackgroundColor}`,
        color: `${theme.secondarySelect.option.focusedColor}`,
      }),
      ...(state.isFocused &&
        !state.isSelected && {
          backgroundColor: `${theme.secondarySelect.option.hoverBackgroundColor}`,
        }),
    }),
  };
}
