/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { ErrorIcon } from '../../components/icons/ErrorIcon.js';
import {
  BACKGROUND_TYPES,
  POSITION_TYPES,
  JUSTIFY_CONTENT_TYPES,
} from '../../models/Toaster.js';
import { useKeyboardViewState } from '../../models/useKeyboardViewState.js';
import { getKeyInfo } from '../../layouts/keyInfo.js';
import { jsKeyToKeyMap } from '../../layouts/keyboardInfo.js';
import { activationKeyStyles } from './macroControlStyles.js';
import type { MacroActivationProps } from './types.js';

/** Capture a physical HID key on release, preserving ISO backslash and right-Shift fallbacks.
 * Invalid candidates remain visible until blur; only eligible changed keys reach the model.
 */
export const ActivationKeyInput = observer(function ActivationKeyInput({
  isFnLayer,
  triggerKey,
  setTriggerKey,
  isNoAction,
  isRecordingMacro = false,
  innerLabel,
  keyboardInfo,
  validPhysicalKeys,
  unavailablePhysicalKeys,
}: MacroActivationProps) {
  const styles = activationKeyStyles(useTheme()),
    { t } = useTranslation(['macro']);
  const { toaster } = useKeyboardViewState();
  const input = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false),
    [invalid, setInvalid] = useState(false);
  const [candidate, setCandidate] = useState(triggerKey);
  const disabled = isNoAction || isRecordingMacro;
  useEffect(() => {
    toaster.hideToaster();
    if (invalid)
      toaster.showToaster({
        message: t(
          candidate && !validPhysicalKeys.includes(candidate)
            ? 'macroKeyUnusable'
            : 'macroKeyAlreadyTaken',
        ),
        backgroundType: BACKGROUND_TYPES.INFO,
        positionType: POSITION_TYPES.FIXED,
        showCloseButton: true,
        justifyContent: JUSTIFY_CONTENT_TYPES.CENTER,
      });
  }, [invalid]);
  useEffect(() => {
    setCandidate(triggerKey);
  }, [triggerKey]);
  let value = t(isNoAction ? 'disabledForNoFunctions' : 'noActivationKey');
  if (!isNoAction && candidate !== undefined)
    value =
      (isFnLayer ? 'FN + ' : '') +
      getKeyInfo(candidate, keyboardInfo.layout, keyboardInfo.region)
        .activationKeyText;
  return (
    <div
      className={innerLabel ? 'with-innerLabel' : undefined}
      css={[
        styles.container,
        focused && styles.focusedBorder,
        invalid && styles.containerWarning,
        disabled && styles.disabled,
      ]}
    >
      <div
        css={styles.labelContainer}
        onClick={() => {
          if (!disabled) input.current?.focus();
        }}
      >
        {innerLabel && <div css={styles.innerLabel}>{innerLabel}</div>}
        <div css={styles.entry}>
          <div
            css={[
              styles.entry,
              styles.prompt,
              invalid && styles.promptWarning,
              !candidate && styles.noActivationKeyPrompt,
            ]}
            className={innerLabel ? 'with-innerLabel' : undefined}
            ref={input}
            tabIndex={disabled ? undefined : 0}
            onKeyUp={(event) => {
              if (disabled) return;
              setInvalid(false);
              const code = event.nativeEvent.code;
              if (code === 'Tab' || code === 'Escape') event.preventDefault();
              let hid = jsKeyToKeyMap[code];
              if (code === '' && event.key === 'Shift')
                hid = jsKeyToKeyMap.ShiftRight;
              if (code === 'Backslash' && keyboardInfo.layout === 'ISO')
                hid = jsKeyToKeyMap.BackslashNonUs;
              if (hid === undefined) return;
              setCandidate(hid);
              if (triggerKey === hid) return;
              if (
                unavailablePhysicalKeys.includes(hid) ||
                !validPhysicalKeys.includes(hid)
              ) {
                setInvalid(true);
                return;
              }
              setTriggerKey(hid);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setInvalid(false);
              setCandidate(triggerKey);
            }}
          >
            {value}
            {invalid && <ErrorIcon css={styles.errorSvg} />}
          </div>
        </div>
      </div>
    </div>
  );
});
