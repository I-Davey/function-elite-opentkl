/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import type { ReactNode } from 'react';
import { Slider, type SliderProps } from './Slider.js';
import { sliderTickLabelStyles } from './sliderStyles.js';

export interface SliderWithTickValuesProps extends SliderProps {
  label?: ReactNode;
  labelVariant?: 'DEFAULT' | 'ALT';
  tickValues: readonly ReactNode[];
  hintText?: ReactNode;
}

/** Decorates the same slider with a label/hint and caller-provided tick labels. */
export function SliderWithTickValues({
  label = '',
  labelVariant = 'DEFAULT',
  tickValues,
  hintText,
  belowSliderRenderer,
  ...props
}: SliderWithTickValuesProps) {
  const styles = sliderTickLabelStyles(useTheme());
  return (
    <Slider
      {...props}
      aboveSliderRenderer={() => (
        <div css={styles.aboveSlider}>
          {labelVariant === 'DEFAULT' && <label css={styles.label}>{label}</label>}
          {labelVariant === 'ALT' && <label css={styles.labelAlt}>{label}</label>}
          <p css={styles.hintText}>{hintText}</p>
        </div>
      )}
      belowSliderRenderer={
        belowSliderRenderer ||
        (() => (
          <div css={styles.belowSlider}>
            {tickValues.map((label, index) => (
              <span key={index}>{label}</span>
            ))}
          </div>
        ))
      }
    />
  );
}
