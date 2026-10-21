/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import type { ChangeEventHandler } from 'react';
import type {} from '../theme/types.js';

export interface CheckboxProps {
  label: string;
  checked?: boolean;
  disabled?: boolean;
  className?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}

// Original check glyph, kept as an inline asset so the control has no CAM asset loader dependency.
const checkMask = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="9" viewBox="0 0 12 9"><polygon points="4.36363636 8.63636364 11.5454545 1.45454545 10.0909091 0 4.36363636 5.72727273 1.45454545 2.81818182 0 4.27272727"/></svg>',
);

/** Controlled native checkbox. Label clicks, keyboard toggling and disabled behaviour stay native. */
export function Checkbox({ label, checked, disabled = false, className, onChange }: CheckboxProps) {
  const theme = useTheme();
  return (
    <label
      className={className}
      css={{ display: 'flex', lineHeight: '22px', color: `${theme.body.labelColor}`,
        ...(disabled ? { opacity: 0.4 } : {}) }}
    >
      <input
        aria-label={label}
        onChange={onChange}
        checked={checked}
        type="checkbox"
        disabled={disabled}
        data-testid={`${label}-checkbox`}
        css={{
          WebkitAppearance: 'none', flexShrink: 0, position: 'relative',
          width: 20, height: 20, margin: '1px 8px 1px 0', borderRadius: 3,
          border: `1px solid ${theme.ui.borderColor}`,
          ':focus': { outline: 'none', borderColor: `${theme.ui.focusedBorderColor}` },
          '&::after': {
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'inline-block', content: '""',
            backgroundColor: `${theme.body.backgroundColor}`, borderRadius: 3,
          },
          '&:checked': {
            backgroundColor: `${theme.ui.selectedBackgroundColor}`,
            border: `1px solid ${theme.ui.borderColor}`,
          },
          '&:checked::after': {
            WebkitMask: `url('${checkMask}') no-repeat center`,
            backgroundColor: `${theme.ui.selectedIndicatorColor}`,
          },
        }}
      />
      <span>{label}</span>
    </label>
  );
}
