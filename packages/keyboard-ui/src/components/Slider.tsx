/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import {
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  Slider as CompoundSlider,
  Rail,
  Handles,
  Tracks,
  Ticks,
  type SliderProps as CompoundSliderProps,
  type GetRailProps,
  type GetHandleProps,
  type GetTrackProps,
  type SliderItem,
  type TrackItem,
} from 'react-compound-slider';
import { ValueUnit } from './ValueUnit.js';
import { sliderStyles } from './sliderStyles.js';
import type { ThemeColor } from '../theme/types.js';

interface RailProps extends HTMLAttributes<HTMLDivElement> {
  getRailProps: GetRailProps;
  tooltip?: ReactNode;
}
export function SliderRail({ getRailProps, tooltip, ...props }: RailProps) {
  return (
    <>
      {tooltip}
      <div {...getRailProps()} {...props} />
    </>
  );
}

interface HandleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  getHandleProps: GetHandleProps;
  handle: SliderItem;
  domain: readonly [number, number];
  spanStyle?: CSSProperties;
  tooltip?: ReactNode;
  vertical?: boolean;
}
/** Native keyboard focus and ARIA values are retained while the library handles drag/keys. */
export function SliderHandle({
  getHandleProps,
  handle,
  domain: [min, max],
  style,
  spanStyle,
  tooltip,
  vertical,
  ...props
}: HandleProps) {
  return (
    <>
      {tooltip}
      <button
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={handle.value}
        style={{
          ...(vertical ? { top: `${handle.percent}%` } : { left: `${handle.percent}%` }),
          ...style,
        }}
        {...getHandleProps(handle.id)}
        {...props}
      >
        <span style={spanStyle} />
        <span style={spanStyle} />
        <span style={spanStyle} />
      </button>
    </>
  );
}

interface TrackProps extends HTMLAttributes<HTMLDivElement> {
  getTrackProps: GetTrackProps;
  track: TrackItem;
  vertical?: boolean;
}
export function SliderTrack({
  getTrackProps,
  track: { source, target },
  style,
  vertical,
  ...props
}: TrackProps) {
  const position = vertical
    ? { top: `${source.percent}%`, height: `${target.percent - source.percent}%` }
    : { left: `${source.percent}%`, width: `${target.percent - source.percent}%` };
  return <div style={{ ...position, ...style }} {...getTrackProps()} {...props} />;
}

interface TickProps extends HTMLAttributes<HTMLDivElement> {
  tick: Pick<SliderItem, 'percent'>;
}
export function SliderTick({ tick, style, ...props }: TickProps) {
  return <div style={{ left: `${tick.percent}%`, ...style }} {...props} />;
}

export interface SliderProps extends Omit<
  CompoundSliderProps,
  'values' | 'domain' | 'onChange' | 'onUpdate' | 'children'
> {
  min: number;
  max: number;
  value: number;
  onChange?: (value: number) => void;
  onAfterChange?: (value: number) => void;
  containerClassName?: string;
  color?: string | ThemeColor;
  backgroundColor?: string | ThemeColor;
  trackBackgroundColor?: string | ThemeColor;
  unit?: ReactNode;
  drawTickValues?: readonly number[];
  aboveSliderRenderer?: () => ReactNode;
  belowSliderRenderer?: () => ReactNode;
  formatTooltipValue?: (value: number) => ReactNode;
  trackName?: string;
  trackChannelName?: string;
  trackDeviceName?: string;
  trackLabel?: string;
}

/** Controlled single-value slider: updates report continuously; commits report after a change.
 * Units/formatting affect tooltips only. Domain, step, orientation and library callbacks retain
 * their original meanings; this component never converts physical depth or writes to hardware.
 */
export function Slider({
  containerClassName,
  color: colorProp,
  backgroundColor: backgroundColorProp,
  trackBackgroundColor: trackBackgroundColorProp,
  disabled,
  unit,
  value,
  min,
  max,
  drawTickValues,
  aboveSliderRenderer,
  belowSliderRenderer,
  formatTooltipValue,
  vertical = false,
  onChange,
  onAfterChange,
  trackName,
  trackChannelName,
  trackDeviceName,
  trackLabel,
  ...props
}: SliderProps) {
  const theme = useTheme(),
    styles = sliderStyles(theme);
  const [showRail, setShowRail] = useState(false),
    [showHandle, setShowHandle] = useState(false);
  const [railValue, setRailValue] = useState<number | null>(null),
    [railPercent, setRailPercent] = useState<number | null>(null);
  // Preserve CAM's override precedence: a supplied colour selects the disabled palette.
  const color = colorProp || disabled ? theme.slider.disableIconColor : theme.slider.iconColor;
  const background =
    backgroundColorProp || disabled ? theme.slider.disableIconColor : theme.slider.iconColor;
  const trackBackground = trackBackgroundColorProp || 'transparent';
  const hideRail = () => {
    setShowRail(false);
    setRailValue(null);
    setRailPercent(null);
  };
  const hideHandle = () => {
    setShowHandle(false);
    setRailValue(null);
    setRailPercent(null);
  };
  const tooltip = (position: number | null, tooltipValue: number) => (
    <div
      css={[styles.tooltipContainer, styles.tooltipContainerShow]}
      style={
        vertical
          ? { top: `${position}%`, marginTop: '-100%', marginLeft: 7 }
          : { left: `${position}%` }
      }
    >
      <ValueUnit
        value={formatTooltipValue ? formatTooltipValue(tooltipValue) : tooltipValue}
        unit={unit}
      />
    </div>
  );
  return (
    <div className={containerClassName}>
      {aboveSliderRenderer?.()}
      <CompoundSlider
        {...props}
        onChange={(values) => {
          if (values.length) onAfterChange?.(values[0]);
        }}
        onUpdate={(values) => {
          if (values.length) onChange?.(values[0]);
        }}
        domain={[min, max]}
        values={[value]}
        disabled={disabled}
        vertical={vertical}
        css={[styles.slider, vertical && styles.sliderV]}
      >
        <Rail>
          {({ getRailProps, getEventData }) => (
            <SliderRail
              getRailProps={getRailProps}
              css={[styles.rail, vertical && styles.railV]}
              onMouseEnter={() => setShowRail(true)}
              onMouseLeave={hideRail}
              onMouseMove={(event: MouseEvent<HTMLDivElement>) => {
                const data = getEventData(event);
                setRailValue(data.value);
                setRailPercent(data.percent);
              }}
              tooltip={
                showRail && railValue !== null && !disabled && tooltip(railPercent, railValue)
              }
            />
          )}
        </Rail>
        <Handles>
          {({ handles, getHandleProps, activeHandleID }) => (
            <>
              {handles.map((handle) => (
                <SliderHandle
                  key={handle.id}
                  handle={handle}
                  getHandleProps={getHandleProps}
                  domain={[min, max]}
                  disabled={disabled}
                  vertical={vertical}
                  css={[
                    styles.handle,
                    vertical && styles.handleV,
                    disabled && styles.handleDisabled,
                  ]}
                  onMouseEnter={() => setShowHandle(true)}
                  onMouseLeave={hideHandle}
                  tooltip={
                    (showHandle || handle.id === activeHandleID) &&
                    !disabled &&
                    tooltip(handle.percent, handle.value)
                  }
                />
              ))}
            </>
          )}
        </Handles>
        {!!drawTickValues && (
          <Ticks values={drawTickValues}>
            {({ ticks }) => (
              <div>
                {ticks.map((tick) => (
                  <SliderTick
                    key={tick.id}
                    tick={tick}
                    css={[styles.tick, disabled && styles.tickDisabled]}
                    style={{ backgroundColor: `${color}` }}
                  />
                ))}
              </div>
            )}
          </Ticks>
        )}
        <Tracks>
          {({ tracks, getTrackProps }) => (
            <div css={[styles.tracks, vertical && styles.tracksV]}>
              {tracks.map((track, index) => (
                <SliderTrack
                  key={track.id}
                  track={track}
                  getTrackProps={getTrackProps}
                  vertical={vertical}
                  css={[styles.track, vertical && styles.trackV]}
                  style={{
                    boxSizing: 'border-box',
                    backgroundColor: `${(vertical ? [trackBackground, background] : [background, trackBackground])[index]}`,
                    borderColor: `${background}`,
                    borderWidth: 1.4 * window.devicePixelRatio,
                    borderStyle: 'solid',
                  }}
                />
              ))}
            </div>
          )}
        </Tracks>
      </CompoundSlider>
      {belowSliderRenderer?.()}
    </div>
  );
}
