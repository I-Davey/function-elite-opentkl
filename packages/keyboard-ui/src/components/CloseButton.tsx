/** @jsxImportSource @emotion/react */
import type { ComponentPropsWithoutRef } from 'react';
import { SecondaryIconButton } from './Button.js';
import { CloseXIcon } from './icons/CloseXIcon.js';

export type CloseButtonProps = ComponentPropsWithoutRef<typeof SecondaryIconButton> & {
  iconClassName?: string;
};

/** Native icon button with the retained hover rotation; caller events/disabled props pass through. */
export function CloseButton({ className, iconClassName, ...props }: CloseButtonProps) {
  return (
    <SecondaryIconButton
      {...props}
      className={className}
      css={{ ':hover': { transform: 'rotate(90deg)' } }}
    >
      <CloseXIcon className={iconClassName} />
    </SecondaryIconButton>
  );
}
