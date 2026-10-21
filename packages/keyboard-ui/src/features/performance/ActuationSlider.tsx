/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import type { ReactNode } from 'react';
import {
  Slider,
  Rail,
  Handles,
  Tracks,
  Ticks,
  type SliderItem,
  type GetRailProps,
  type GetHandleProps,
  type GetTrackProps,
  type SliderProps,
} from 'react-compound-slider';
import { zIndex } from '../../theme/layers.js';
import { displayLevelTicks, levelColorScale } from '../../models/actuationColors.js';

/** Vertical actuation hit area and its visible three-pixel rail. */
export function ActuationRail({ getRailProps }: { getRailProps: GetRailProps }) {
  const theme = useTheme();
  return (
    <>
      <div
        css={{
          position: 'absolute',
          height: '100%',
          width: 42,
          transform: 'translate(-50%, 0%)',
          cursor: 'pointer',
        }}
        {...getRailProps()}
      />
      <div
        css={{
          position: 'absolute',
          height: '100%',
          width: 3,
          transform: 'translate(-50%, 0%)',
          pointerEvents: 'none',
          backgroundColor: `${theme.slider.backgroundColor}`,
          borderRadius: 4,
        }}
      />
    </>
  );
}

interface ActuationHandleProps {
  tickFormat: (value: number) => ReactNode;
  domain: readonly [number, number];
  handle: SliderItem;
  getHandleProps: GetHandleProps;
}
export function ActuationHandle({
  tickFormat,
  domain: [min, max],
  handle: { id, value, percent },
  getHandleProps,
}: ActuationHandleProps) {
  const theme = useTheme();
  return (
    <>
      <div
        css={{
          top: `${percent}%`,
          position: 'absolute',
          transform: 'translate(-50%, -50%)',
          zIndex: zIndex('sliderHandle') + 1,
          width: 42,
          height: 28,
          cursor: 'pointer',
          backgroundColor: 'transparent',
          '&:hover > .value': { opacity: 1 },
          '& > .value': {
            opacity: 0,
            transform: 'translate(-45px, 3px)',
            transition: 'opacity 0.2s ease-out',
            fontSize: 14,
            width: 55,
          },
        }}
        {...getHandleProps(id)}
      >
        <div className="value">{tickFormat(value)}</div>
      </div>
      <div
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        css={{
          top: `${percent}%`,
          position: 'absolute',
          transform: 'translate(-50%, -50%)',
          zIndex: zIndex('sliderHandle'),
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: `1px solid ${theme.slider.hintTextColor}`,
          backgroundColor: `${theme.slider.sliderColor}`,
        }}
      />
    </>
  );
}

interface ActuationTrackProps {
  source: SliderItem;
  target: SliderItem;
  getTrackProps: GetTrackProps;
  index: number;
}
export function ActuationTrack({ source, target, getTrackProps, index }: ActuationTrackProps) {
  const theme = useTheme();
  return (
    <div
      css={{
        position: 'absolute',
        zIndex: zIndex('sliderRail'),
        backgroundColor: `${index === 0 ? theme.body.primary : theme.body.secondary}`,
        cursor: 'pointer',
        width: 3,
        transform: 'translate(-50%, 0%)',
        top: `${source.percent}%`,
        height: `${target.percent - source.percent}%`,
        borderRadius: 4,
      }}
      {...getTrackProps()}
    />
  );
}

export function ActuationTick({
  tick,
  format = (value) => value,
}: {
  tick: SliderItem;
  format?: (value: number) => ReactNode;
}) {
  const theme = useTheme(),
    color = levelColorScale(tick.value);
  return (
    <div>
      <div
        css={{
          position: 'absolute',
          marginLeft: 20,
          height: 5,
          width: 12,
          backgroundColor: color,
          top: `${tick.percent}%`,
          borderRadius: 15,
          transform: 'translate(0, -50%)',
        }}
      />
      {displayLevelTicks.includes(tick.value) && (
        <div
          css={{
            position: 'absolute',
            marginLeft: 42,
            fontSize: 10,
            top: `${tick.percent}%`,
            display: 'flex',
            alignItems: 'center',
            transform: 'translate(0, -50%)',
          }}
        >
          <div
            css={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: color,
              margin: 3,
              border: `2px solid ${theme.body.text2}`,
              '&::before': {
                content: '""',
                display: 'block',
                transform: 'translate(-12px, 1.5px)',
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderRight: `6px solid ${theme.body.text2}`,
              },
            }}
          />
          <span>{format(tick.value)}</span>
        </div>
      )}
    </div>
  );
}

export interface ActuationSliderProps {
  domain: readonly [number, number];
  onChange: SliderProps['onChange'];
  values: readonly number[];
  step?: number;
  tickCount?: number;
  tickFormat: (value: number) => ReactNode;
}

/** Multi-handle vertical actuation control. Mode 3 retains the original handle-pushing rules.
 * Values are caller-owned device-table indices; tickFormat supplies their display units.
 */
export function ActuationSlider({
  domain,
  onChange,
  values,
  step,
  tickCount,
  tickFormat,
}: ActuationSliderProps) {
  return (
    <Slider
      vertical
      mode={3}
      step={step}
      domain={domain}
      values={values}
      onChange={onChange}
      rootStyle={{ position: 'relative', height: 'inherit', touchAction: 'none', minWidth: 110 }}
    >
      <Rail>{({ getRailProps }) => <ActuationRail getRailProps={getRailProps} />}</Rail>
      <Handles>
        {({ handles, getHandleProps }) => (
          <div className="slider-handles">
            {handles.map((handle) => (
              <ActuationHandle
                key={handle.id}
                handle={handle}
                domain={domain}
                tickFormat={tickFormat}
                getHandleProps={getHandleProps}
              />
            ))}
          </div>
        )}
      </Handles>
      <Tracks right={false}>
        {({ tracks, getTrackProps }) => (
          <div className="slider-tracks">
            {tracks.map(({ id, source, target }, index) => (
              <ActuationTrack
                key={id}
                source={source}
                target={target}
                index={index}
                getTrackProps={getTrackProps}
              />
            ))}
          </div>
        )}
      </Tracks>
      <Ticks count={tickCount}>
        {({ ticks }) => (
          <div className="slider-ticks">
            {ticks.map((tick) => (
              <ActuationTick key={tick.id} tick={tick} format={tickFormat} />
            ))}
          </div>
        )}
      </Ticks>
    </Slider>
  );
}
