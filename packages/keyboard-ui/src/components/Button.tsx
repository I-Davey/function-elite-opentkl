import styled from '@emotion/styled/base';
import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { palette } from '../theme/palette.js';
import type {} from '../theme/types.js';

interface ButtonDimensions {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
}

/** Native button props, events and ref are forwarded by Emotion. Dimensions accept CSS units. */
export type ButtonProps = ComponentPropsWithRef<typeof Button>;

// Retain target classes while recovered parent styles still use component selectors.
export const Button = styled('button', { target: 'e1dsbuos9' })<ButtonDimensions>(
  ({ width, height, disabled }) => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: 0,
    borderRadius: 6,
    background: 'none',
    fontSize: 13,
    minHeight: 30,
    fontWeight: 500,
    width,
    height,
    padding: 0,
    transition:
      'border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
    cursor: disabled ? 'default' : 'pointer',
    '&:focus': { outline: 'none' },
    '&[disabled]': { cursor: 'default', '& *': { cursor: 'default' } },
  }),
);

/** Text action with the primary colour and a visible keyboard focus ring. */
export const PrimaryShimlessButton = styled(Button, { target: 'e1dsbuos8' })(({ theme }) => ({
  color: `${theme.primaryShimlessButton.color}`,
  '&:focus-visible': { outline: 'none', boxShadow: `0 0 0 2px ${palette.primary}` },
  '&:not([disabled]):hover': { color: `${theme.primaryShimlessButton.hoverColor}` },
  '&:not([disabled]):active': { color: `${theme.primaryShimlessButton.activeColor}` },
  '&[disabled]': { color: `${theme.primaryShimlessButton.color.alpha(0.3)}` },
}));

/** Secondary text action; disabled text keeps the original 30% opacity. */
export const SecondaryShimlessButton = styled(Button, { target: 'e1dsbuos7' })(({ theme }) => ({
  color: `${theme.secondaryShimlessButton.color}`,
  '&:focus-visible': { outline: 'none' },
  '&:not([disabled]):hover': { color: `${theme.secondaryShimlessButton.hoverColor}` },
  '&:not([disabled]):active': { color: `${theme.secondaryShimlessButton.activeColor}` },
  '&[disabled]': { opacity: 0.3 },
}));

/** Filled primary action with theme-controlled hover, pressed and disabled colours. */
export const PrimaryButton = styled(Button, { target: 'e1dsbuos6' })(({ theme }) => ({
  padding: '6px 12px',
  backgroundColor: `${theme.body.primary}`,
  border: `1px solid ${theme.body.primary}`,
  color: palette.white,
  '&:not([disabled]):hover': {
    backgroundColor: `${theme.body.primary.lighten(0.2)}`,
    borderColor: `${theme.body.primary.lighten(0.2)}`,
    color: palette.white,
  },
  '&:not([disabled]):active': {
    backgroundColor: `${theme.body.primary.lighten(0.1)}`,
    borderColor: `${theme.body.primary.lighten(0.1)}`,
    color: palette.white,
  },
  '&[disabled]': {
    backgroundColor: `${theme.ui.disabledColor}`,
    borderColor: `${theme.ui.disabledColor}`,
    color: `${theme.ui.disabledText}`,
  },
}));

/** Dialog-sized primary action. */
export const LargePrimaryButton = styled(PrimaryButton, { target: 'e1dsbuos5' })({
  width: 200, height: 48,
});

/** Bordered secondary action, sharing the native primary button behaviour. */
export const SecondaryButton = styled(PrimaryButton, { target: 'e1dsbuos4' })(({ theme }) => ({
  padding: '6px 12px',
  backgroundColor: `${theme.secondaryButton.backgroundColor}`,
  borderColor: `${theme.secondaryButton.borderColor}`,
  color: `${theme.secondaryButton.color}`,
  '&:not([disabled]):hover': {
    backgroundColor: `${theme.secondaryButton.hoverBackgroundColor}`,
    borderColor: `${theme.secondaryButton.hoverBorderColor}`,
    color: `${theme.secondaryButton.hoverColor}`,
  },
  '&:not([disabled]):active': {
    backgroundColor: `${theme.secondaryButton.hoverBackgroundColor.lighten(0.1)}`,
    borderColor: `${theme.secondaryButton.hoverBorderColor}`,
    color: `${theme.secondaryButton.hoverColor}`,
  },
}));

/** Circular icon action; callers supply an accessible label. */
export const SecondaryIconButton = styled(SecondaryButton, { target: 'e1dsbuos3' })({
  padding: 0, width: 30, height: 30, borderRadius: '50%', fontSize: 12,
});

/** Dialog-sized secondary action. */
export const LargeSecondaryButton = styled(SecondaryButton, { target: 'e1dsbuos2' })({
  width: 200, height: 48,
});
