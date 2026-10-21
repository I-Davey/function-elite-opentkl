/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import {
  useRef,
  useState,
  type ReactNode,
  type KeyboardEventHandler,
  type MouseEventHandler,
} from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import {
  Slider,
  Rail,
  Handles,
  type SliderItem,
  type GetHandleProps,
  type SliderProps,
} from 'react-compound-slider';
import { debounce, type DebouncedFunc } from 'lodash';
import { v4 } from 'uuid';
import { Tooltip, type TooltipProps } from './Tooltip.js';
import { SecondaryButton, SecondaryShimlessButton } from './Button.js';
import { AngleDownIcon } from './icons/AngleDownIcon.js';
import { RGBColorInput } from './RGBColorInput.js';
import { ColorStopTooltip } from './ColorStopTooltip.js';
import type { ColorPickerButtonProps } from './ColorPickerButton.js';
import { useDidUpdateEffect } from './useDidUpdateEffect.js';
import { gradientPickerStyles, nzxtColorPickerStyle } from './advancedColorStyles.js';
import { useColorPickerStore } from '../models/useColorPickerStore.js';
import {
  formatHex,
  removeHexPound,
  getColorFromGradient,
  type GradientStop,
} from '../theme/color.js';
import {
  convertGradientToCSS,
  defaultGradients,
  areGradientsEqual,
  cloneGradient,
} from '../theme/gradients.js';
import { updateGradientPositions } from '../logic/gradientPicker.js';
import { zIndex } from '../theme/layers.js';

export const GradientSwatch = observer(function GradientSwatch({
  gradient,
  children,
  onClick,
  componentType = 'button',
  className,
}: {
  gradient: GradientStop[];
  children?: ReactNode;
  onClick?: (gradient: GradientStop[]) => void;
  componentType?: 'button' | 'div';
  className?: string;
}) {
  const theme = useTheme(),
    styles = gradientPickerStyles(theme);
  const style = {
    background: gradient.length ? convertGradientToCSS(gradient) : 'black',
    borderColor: theme.body.borderColor.toString(),
  };
  return componentType === 'button' || onClick ? (
    <button
      className={className}
      css={styles.swatch}
      style={style}
      onClick={() => onClick?.([...gradient])}
    >
      {children}
    </button>
  ) : (
    <div className={className} css={styles.swatch} style={style}>
      {children}
    </div>
  );
});
export function GradientSliderHandle({
  handle: { id, value },
  domain: [min, max],
  getHandleProps,
  color,
  onClick,
  onContextMenu,
  percent,
  isSelected,
  onKeyDown,
}: {
  handle: SliderItem;
  domain: readonly [number, number];
  getHandleProps: GetHandleProps;
  color: string;
  percent: number;
  isSelected: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onContextMenu?: MouseEventHandler<HTMLButtonElement>;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
}) {
  const styles = gradientPickerStyles(useTheme());
  return (
    <SecondaryShimlessButton
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      {...getHandleProps(id)}
      css={styles.handle}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
      style={{
        left: `${percent}%`,
        backgroundColor: isSelected ? formatHex(color) : 'white',
        borderColor: isSelected ? 'white' : formatHex(color),
      }}
    />
  );
}
export const GradientSlider = observer(function GradientSlider({
  gradient,
  selectedHandle,
  onSlideEnd,
  onUpdate,
  onClickHandle,
  onCtxClickHandle,
  onClickRail,
  onHandleKeyDown,
}: {
  gradient: GradientStop[];
  selectedHandle?: string;
  onSlideEnd?: SliderProps['onSlideEnd'];
  onUpdate?: SliderProps['onUpdate'];
  onClickHandle?: (id: string | undefined) => void;
  onCtxClickHandle?: (id: string) => void;
  onClickRail?: (position: number) => void;
  onHandleKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
}) {
  const styles = gradientPickerStyles(useTheme()),
    ref = useRef<HTMLDivElement>(null);
  const values = gradient.map((stop) => stop.position),
    background = convertGradientToCSS(gradient, 90);
  // Read stop fields inside the observer, before the library invokes its render callbacks.
  const stops = gradient.map((stop) => ({ ...stop }));
  return (
    <ClassNames>
      {({ css }) => (
        <Slider
          domain={[0, 100]}
          className={css(styles.slider)}
          values={values}
          step={1}
          onSlideEnd={onSlideEnd}
          onUpdate={onUpdate}
        >
          <Rail>
            {() => (
              <div
                ref={ref}
                css={styles.rail}
                style={{ background }}
                onClick={(event) => {
                  event.preventDefault();
                  if (ref.current && onClickRail)
                    onClickRail(
                      Math.ceil((event.nativeEvent.offsetX / ref.current.clientWidth) * 100),
                    );
                }}
              />
            )}
          </Rail>
          <Handles>
            {({ handles, getHandleProps }) => (
              <>
                {handles.map((handle, index) => {
                  const stop = stops[index];
                  // Native handles can lag one render while a stop is added or removed.
                  return stop ? (
                    <GradientSliderHandle
                      key={handle.id}
                      handle={handle}
                      color={stop.color}
                      getHandleProps={getHandleProps}
                      domain={[0, 100]}
                      percent={stop.position}
                      isSelected={selectedHandle === stop.id}
                      onKeyDown={(event) => {
                        event.preventDefault();
                        onHandleKeyDown?.(event);
                      }}
                      onContextMenu={() => {
                        if (stop.id) onCtxClickHandle?.(stop.id);
                      }}
                      onClick={() => onClickHandle?.(stop.id)}
                    />
                  ) : null;
                })}
              </>
            )}
          </Handles>
        </Slider>
      )}
    </ClassNames>
  );
});
export interface GradientPickerProps extends Pick<
  TooltipProps,
  'placement' | 'fallbackPlacements' | 'containerType'
> {
  className?: string;
  zIndexContext?: string;
  onSelect: (gradient: GradientStop[]) => void;
  flavor?: ColorPickerButtonProps['flavor'];
  gradient: GradientStop[];
  minStops?: number;
  maxStops?: number;
  buttonClassName?: string;
  label?: ReactNode;
  gradients?: GradientStop[][];
  disabled?: boolean;
}
/** Own gradient editing, stop identity, live drag updates, recent history and explicit rollback. */
export const GradientPicker = observer(function GradientPicker({
  className,
  containerType,
  zIndexContext = '',
  onSelect,
  flavor = 'minimal-no-shim',
  gradient,
  minStops = 2,
  maxStops = 5,
  buttonClassName,
  label,
  gradients = defaultGradients,
  placement = 'top-start',
  fallbackPlacements = ['top-start', 'bottom-start'],
  disabled,
}: GradientPickerProps) {
  const store = useColorPickerStore(),
    styles = gradientPickerStyles(useTheme()),
    { t } = useTranslation(['common']);
  const [open, setOpen] = useState(false),
    [starting, setStarting] = useState<GradientStop[]>([]);
  const [selectedStop, setSelectedStop] = useState<string | undefined>(gradient[0]?.id ?? ''),
    [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [infoOpen, setInfoOpen] = useState(false);
  const selectedColor = () =>
    formatHex(gradient.find((stop) => stop.id === selectedStop)?.color ?? 'FFFFFF');
  const [currentColor, setCurrentColor] = useState(selectedColor);
  const pendingColor = useRef<DebouncedFunc<() => void> | null>(null);
  const simple = mode === 'simple',
    withArrow = flavor === 'minimal-with-downArrow',
    noShim = flavor === 'minimal-no-shim';
  const minimal = flavor === 'minimal' || noShim || withArrow;
  const change = (value: GradientStop[]) => onSelect(cloneGradient(value));
  const close = () => {
    pendingColor.current?.flush();
    setOpen(false);
    setMode('simple');
    if (!areGradientsEqual(gradient, starting)) store.addGradient(cloneGradient(gradient));
  };
  const toggle = () => {
    if (open) close();
    else {
      setOpen(true);
      setStarting(cloneGradient(gradient));
      setCurrentColor(selectedColor());
    }
  };
  const cancel = () => {
    pendingColor.current?.cancel();
    onSelect(starting);
    setOpen(false);
    setMode('simple');
  };
  const toggleMode = () => {
    pendingColor.current?.flush();
    setMode(simple ? 'advanced' : 'simple');
    if (gradient.length) setSelectedStop(gradient[0].id);
  };
  const removeStop = (id: string | undefined) => {
    pendingColor.current?.flush();
    if (gradient.length <= minStops) return;
    const index = gradient.findIndex((stop) => stop.id === id);
    if (index === -1) return;
    gradient.splice(index, 1);
    const previous = gradient[index - 1],
      next = gradient[index];
    if (previous) setSelectedStop(previous.id);
    else if (next) setSelectedStop(next.id);
    change(gradient);
  };
  useDidUpdateEffect(() => {
    if (!open || simple) return;
    const commit = debounce(() => {
      const stop = gradient.find((stop) => stop.id === selectedStop);
      if (stop) {
        stop.color = removeHexPound(currentColor);
        change(gradient);
      }
    }, 250);
    pendingColor.current = commit;
    commit();
    return () => commit.cancel();
  }, [currentColor]);
  useDidUpdateEffect(() => {
    setCurrentColor(selectedColor());
  }, [selectedStop]);
  // Build model-backed content here so the observer tracks recent gradient and stop reads.
  const tooltip = (
    <div
      css={styles.pickerContainer}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        if (infoOpen) setInfoOpen(false);
      }}
    >
      {simple ? (
        <div css={styles.pickerMode}>
          <h3 css={[styles.heading, styles.swatchHeading]}>
            {t('common:colorPicker-colorSwatches')}
          </h3>
          <ol css={[styles.swatchGrid, styles.recentSwatches]}>
            {store.recentGradients.map((value) => (
              <li key={convertGradientToCSS(value)}>
                <GradientSwatch gradient={value} onClick={change} />
              </li>
            ))}
          </ol>
          <ol css={styles.swatchGrid}>
            {gradients.map((value) => (
              <li key={convertGradientToCSS(value)}>
                <GradientSwatch gradient={value} onClick={change} />
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div css={styles.pickerMode}>
          <h3 css={[styles.heading, styles.customHeading]}>
            {t('common:colorPicker-custom')}
            <ColorStopTooltip open={infoOpen} setOpen={setInfoOpen} />
          </h3>
          <GradientSlider
            gradient={gradient}
            selectedHandle={selectedStop}
            onSlideEnd={(values) => {
              updateGradientPositions(gradient, values);
              change(gradient);
            }}
            onUpdate={(values) => updateGradientPositions(gradient, values)}
            onClickHandle={(id) => {
              pendingColor.current?.flush();
              setSelectedStop(id);
            }}
            onCtxClickHandle={removeStop}
            onClickRail={(position) => {
              if (
                gradient.length >= maxStops ||
                gradient.some((stop) => Math.abs(stop.position - position) < 6)
              )
                return;
              const value = cloneGradient(gradient),
                id = v4(),
                color = getColorFromGradient(value, position);
              value.push({ color, position, id });
              change(value);
              setSelectedStop(id);
            }}
            onHandleKeyDown={(event) => {
              if (['backspace', 'delete'].includes(event.key.toLowerCase()))
                removeStop(selectedStop);
            }}
          />
          <HexColorPicker
            style={{ width: 250, height: 180 }}
            css={nzxtColorPickerStyle}
            color={currentColor}
            onChange={setCurrentColor}
          />
          <div css={styles.hexContainer}>
            <label css={styles.label}>{t('common:colorPicker-hex')}</label>
            <HexColorInput
              prefixed
              color={formatHex(currentColor)}
              css={styles.textField}
              onChange={setCurrentColor}
            />
            <RGBColorInput hex={currentColor} onChange={setCurrentColor} />
          </div>
        </div>
      )}
      <div css={styles.buttons}>
        <SecondaryButton onClick={toggleMode} css={styles.buttonPicker}>
          {t(simple ? 'common:colorPicker-custom' : 'common:colorPicker-swatch')}
        </SecondaryButton>
        <SecondaryButton onClick={cancel} css={styles.buttonPicker}>
          {t('common:cancel')}
        </SecondaryButton>
      </div>
    </div>
  );
  return (
    <ClassNames>
      {({ css }) => (
        <Tooltip
          open={open}
          onRequestClose={close}
          tooltip={tooltip}
          placement={placement}
          fallbackPlacements={fallbackPlacements}
          innerClassName={css(styles.tooltipInner)}
          containerClassName={className}
          containerType={containerType}
          zIndex={Math.max(zIndex(zIndexContext) + 1, zIndex('tooltip'))}
        >
          <SecondaryButton
            onClick={toggle}
            disabled={disabled}
            className={buttonClassName}
            css={[
              styles.button,
              minimal && styles.buttonMinimal,
              withArrow && styles.buttonMinimalWithDownArrow,
              noShim && styles.noShim,
            ]}
          >
            <div
              css={[
                styles.buttonInner,
                minimal && styles.buttonInnerMinimal,
                noShim && styles.noShim,
              ]}
            >
              <GradientSwatch
                gradient={gradient}
                css={[
                  styles.buttonSwatch,
                  minimal && styles.buttonSwatchMinimal,
                  noShim && styles.biggerIcon,
                ]}
                componentType="div"
              />
              {!minimal && <span>{label || t('common:customGradient')}</span>}
              {(!minimal || withArrow) && <AngleDownIcon css={styles.buttonIcon} />}
            </div>
          </SecondaryButton>
        </Tooltip>
      )}
    </ClassNames>
  );
});
