/** @jsxImportSource @emotion/react */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTheme } from '@emotion/react';
import { useTranslation } from 'react-i18next';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { debounce } from 'lodash';
import type { Color } from '../theme/color.js';
import { convertHexToColorObject } from '../logic/colorPicker.js';
import { RGBColorInput } from './RGBColorInput.js';
import { advancedColorStyles, nzxtColorPickerStyle } from './advancedColorStyles.js';

export interface PendingColorEdit {
  /** Closing accepts the draft; Cancel/unmount simply discards it. */
  takePendingColor(): string | undefined;
}
/** Keep immediate visual updates and the fork's 250ms trailing commit, using normal npm controls. */
export const ColorPickerAdvanced = forwardRef<PendingColorEdit, {
  hex?: string;
  onColorChange: (color: Color) => void;
}>(function ColorPickerAdvanced({
  hex,
  onColorChange,
}, ref) {
  const styles = advancedColorStyles(useTheme()),
    { t } = useTranslation();
  const [internalHex, setInternalHex] = useState(hex ?? 'FFFFFF');
  const pending = useRef<string | undefined>(undefined);
  const [commit] = useState(() =>
    debounce((value: string) => {
      pending.current = undefined;
      onColorChange(convertHexToColorObject(value));
    }, 250),
  );
  useEffect(() => () => commit.cancel(), [commit]);
  useImperativeHandle(ref, () => ({
    takePendingColor() {
      const value = pending.current;
      pending.current = undefined;
      commit.cancel();
      return value;
    },
  }), [commit]);
  const onChangeInput = (value: string) => {
    commit.cancel();
    pending.current = undefined;
    setInternalHex(value);
    onColorChange(convertHexToColorObject(value));
  };
  return (
    <>
      <h3 css={styles.heading}>{t('common:colorPicker-custom')}</h3>
      <HexColorPicker
        style={{ width: 250, height: 180 }}
        css={nzxtColorPickerStyle}
        color={internalHex}
        onChange={(value) => {
          setInternalHex(value);
          pending.current = value;
          commit(value);
        }}
      />
      <div css={styles.hexContainer}>
        <label css={styles.label}>{t('common:colorPicker-hex')}</label>
        <HexColorInput
          prefixed
          color={internalHex}
          css={styles.textField}
          onChange={onChangeInput}
        />
        <RGBColorInput hex={internalHex} onChange={onChangeInput} />
      </div>
    </>
  );
});
