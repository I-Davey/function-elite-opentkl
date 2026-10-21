/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { effectColors, presetColors } from '../theme/colors.js';
import { removeHexPound, type Color } from '../theme/color.js';
import { zIndex } from '../theme/layers.js';
import { convertHexToColorObject } from '../logic/colorPicker.js';
import { useColorPickerStore } from '../models/useColorPickerStore.js';
import { Tooltip, type TooltipProps } from './Tooltip.js';
import { ColorPickerButton, type ColorPickerButtonProps } from './ColorPickerButton.js';
import { ColorPickerHeader, type ColorPickerTab } from './ColorPickerHeader.js';
import { ColorPickerSimple } from './ColorPickerSimple.js';
import { ColorPickerAdvanced, type PendingColorEdit } from './ColorPickerAdvanced.js';
import { SecondaryButton } from './Button.js';
import { colorPickerStyles } from './advancedColorStyles.js';

export interface ColorPickerProps extends Pick<
  TooltipProps,
  'placement' | 'fallbackPlacements' | 'containerType'
> {
  buttonRenderer?: (actions: { openPicker: () => void }) => ReactNode;
  defaultColors?: Color[];
  defaultOutlineColors?: Color[];
  hex?: string;
  outlineHex?: string;
  onSelect?: (color: Color) => void;
  onSave?: (color: Color) => void;
  onAfterCancel?: () => void;
  onOutlineSelect?: (color: Color | undefined) => void;
  onOutlineSave?: (color: Color | undefined) => void;
  className?: string;
  buttonClassName?: string;
  zIndexContext?: string;
  flavor?: ColorPickerButtonProps['flavor'];
  disabled?: boolean;
  enableOutline?: boolean;
}
const noop = () => {};
/** Retain live selection, explicit save/close, rollback and separate text/outline history. */
export function ColorPicker({
  buttonRenderer,
  defaultColors = effectColors,
  defaultOutlineColors = presetColors,
  hex = '#000000',
  outlineHex,
  onSelect = noop,
  onSave = noop,
  onAfterCancel = noop,
  onOutlineSelect = noop,
  onOutlineSave = noop,
  className = '',
  buttonClassName = '',
  containerType = 'html',
  zIndexContext = 'base',
  flavor = 'normal',
  disabled = false,
  placement = 'top-start',
  fallbackPlacements = ['top-start', 'bottom-start'],
  enableOutline = false,
}: ColorPickerProps) {
  const { t } = useTranslation(['common']),
    styles = colorPickerStyles(useTheme()),
    store = useColorPickerStore();
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [startingHex, setStartingHex] = useState(hex),
    [startingOutlineHex, setStartingOutlineHex] = useState(outlineHex);
  const [colorChanged, setColorChanged] = useState(false),
    [outlineChanged, setOutlineChanged] = useState(false);
  const [tab, setTab] = useState<ColorPickerTab>('text');
  const advanced = useRef<PendingColorEdit>(null);
  const changeColor = (color: Color | undefined) => {
    if (color) {
      onSelect(color);
      setColorChanged(true);
    }
  };
  const changeOutline = (color: Color | undefined) => {
    onOutlineSelect(color);
    setOutlineChanged(true);
  };
  const save = () => {
    const pending = advanced.current?.takePendingColor();
    const nextHex = tab === 'text' ? pending ?? hex : hex;
    const nextOutlineHex = tab === 'outline' ? pending ?? outlineHex : outlineHex;
    if (pending !== undefined) {
      const color = convertHexToColorObject(pending);
      if (tab === 'text') onSelect(color);
      else onOutlineSelect(color);
    }
    setOpen(false);
    setMode('simple');
    if (nextHex !== startingHex) store.addColor(nextHex);
    if (nextOutlineHex && nextOutlineHex !== startingOutlineHex) store.addColor(nextOutlineHex);
    if (colorChanged || (pending !== undefined && tab === 'text'))
      onSave(convertHexToColorObject(nextHex));
    if (outlineChanged || (pending !== undefined && tab === 'outline'))
      onOutlineSave(nextOutlineHex === undefined ? undefined : convertHexToColorObject(nextOutlineHex));
  };
  const toggle = () => {
    if (open) save();
    else {
      setOpen(true);
      setStartingHex(hex);
      setStartingOutlineHex(outlineHex);
      setColorChanged(false);
      setOutlineChanged(false);
    }
  };
  const cancel = () => {
    onSelect(convertHexToColorObject(removeHexPound(startingHex)));
    if (startingOutlineHex === undefined) onOutlineSelect(undefined);
    else if (startingOutlineHex)
      onOutlineSelect(convertHexToColorObject(removeHexPound(startingOutlineHex)));
    setOpen(false);
    setMode('simple');
    onAfterCancel();
  };
  const onColorChange = tab === 'text' ? changeColor : changeOutline;
  return (
    <ClassNames>
      {({ css }) => (
        <Tooltip
          open={open}
          onRequestClose={save}
          innerClassName={css(styles.tooltipInner)}
          containerClassName={className}
          containerType={containerType}
          placement={placement}
          fallbackPlacements={fallbackPlacements}
          zIndex={Math.max(zIndex(zIndexContext) + 1, zIndex('tooltip'))}
          tooltip={
            <div css={styles.pickerContainer}>
              {mode === 'simple' ? (
                <div css={styles.pickerMode}>
                  <ColorPickerHeader
                    tab={tab}
                    setTab={setTab}
                    recentColors={store.recentColors}
                    onColorChange={onColorChange}
                    enableOutline={enableOutline}
                  />
                  <ColorPickerSimple
                    onColorChange={onColorChange}
                    defaultColors={tab === 'text' ? defaultColors : defaultOutlineColors}
                    addTransparentSwatch={tab !== 'text'}
                  />
                </div>
              ) : (
                <div css={styles.pickerMode}>
                  <ColorPickerAdvanced
                    ref={advanced}
                    hex={tab === 'text' ? hex : outlineHex}
                    onColorChange={onColorChange}
                  />
                </div>
              )}
              <div css={styles.buttons}>
                <SecondaryButton
                  onClick={() => setMode(mode === 'simple' ? 'advanced' : 'simple')}
                  css={styles.buttonPicker}
                >
                  {t(mode === 'simple' ? 'common:colorPicker-custom' : 'common:colorPicker-swatch')}
                </SecondaryButton>
                <SecondaryButton onClick={cancel} css={styles.buttonPicker}>
                  {t('common:cancel')}
                </SecondaryButton>
              </div>
            </div>
          }
        >
          {buttonRenderer ? (
            buttonRenderer({ openPicker: toggle })
          ) : (
            <ColorPickerButton
              hex={hex}
              toggle={toggle}
              disabled={disabled}
              flavor={flavor}
              buttonClassName={buttonClassName}
              outlineHex={outlineHex}
              enableOutline={enableOutline}
            />
          )}
        </Tooltip>
      )}
    </ClassNames>
  );
}
