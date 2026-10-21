/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import isPropValid from '@emotion/is-prop-valid';
import {
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { IssuesIcon } from './icons/IssuesIcon.js';
import { textFieldStyles } from './controlStyles.js';

type FieldElement = HTMLInputElement | HTMLTextAreaElement;
export interface TextFieldProps extends Omit<InputHTMLAttributes<FieldElement>, 'onChange'> {
  label?: ReactNode;
  inputClassName?: string;
  labelClassName?: string;
  issueClassName?: string;
  errors?: readonly string[];
  multiline?: boolean;
  rows?: number;
  cols?: number;
  wrap?: 'hard' | 'soft' | 'off';
  icon?: ReactNode;
  iconLeft?: boolean;
  unit?: ReactNode;
  autoSelect?: boolean;
  validateFormat?: RegExp;
  validateRequired?: boolean;
  onChange?: (event: ChangeEvent<FieldElement>, localError?: string) => void;
}

/** Input/textarea with translated validation and the original focus/error presentation.
 * Validation reports the local error alongside every change; format errors precede required errors.
 */
export function TextField({
  label,
  className = '',
  inputClassName = '',
  labelClassName = '',
  issueClassName,
  placeholder,
  errors,
  multiline = false,
  type = 'text',
  icon,
  iconLeft,
  unit,
  disabled,
  autoSelect = false,
  validateFormat,
  validateRequired,
  onChange,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const { t } = useTranslation('common');
  const styles = textFieldStyles(useTheme());
  const [localError, setLocalError] = useState<string>();
  const [focused, setFocused] = useState(false);
  const hasErrors = !!errors?.length;
  const invalid = hasErrors || !!localError;
  const nativeProps = Object.fromEntries(Object.entries(props).filter(([key]) => isPropValid(key)));
  const handleChange = (event: ChangeEvent<FieldElement>) => {
    let error: string | undefined;
    if (validateFormat && !validateFormat.test(event.currentTarget.value))
      error = t('formatIncorrect', { label });
    else if (validateRequired && event.currentTarget.value === '')
      error = t('fieldRequired', { label });
    setLocalError(error);
    onChange?.(event, error);
  };
  const fieldProps = {
    ...nativeProps,
    placeholder,
    disabled,
    onChange: handleChange,
    onFocus: (event: FocusEvent<FieldElement>) => {
      if (autoSelect) event.target.select();
      setFocused(true);
      onFocus?.(event);
    },
    onBlur: (event: FocusEvent<FieldElement>) => {
      setFocused(false);
      onBlur?.(event);
    },
  };
  return (
    <div
      className={className}
      css={[
        styles.container,
        focused && styles.focused,
        invalid && styles.error,
        disabled && styles.disabled,
      ]}
    >
      <label className={labelClassName} css={styles.labelContainer}>
        {(label || hasErrors) && (
          <div css={[styles.label, invalid && styles.errorLabel]}>
            {label}
            {hasErrors ? ` (${errors?.[0]}):` : localError ? ` (${localError}):` : ''}
          </div>
        )}
        <div css={styles.inputContainer}>
          {multiline ? (
            <textarea
              {...fieldProps}
              className={inputClassName}
              css={[styles.prompt, styles.promptTextArea]}
            />
          ) : (
            <input
              {...fieldProps}
              type={type}
              className={inputClassName}
              css={[styles.prompt, iconLeft && styles.iconLeftText]}
            />
          )}
          {unit}
        </div>
      </label>
      {invalid && <IssuesIcon className={issueClassName} css={styles.issueIcon} />}
      {icon && <div css={[styles.icon, iconLeft && styles.iconLeft]}>{icon}</div>}
    </div>
  );
}
