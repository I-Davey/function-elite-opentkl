/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { useEffect, useRef, useState, type MouseEventHandler, type ReactNode } from 'react';
import { observer } from 'mobx-react';
import { defaultSegmentedStyles, underlineSegmentedStyles } from './controlStyles.js';

export interface SegmentedChoice {
  label: ReactNode;
  isSelected?: boolean;
  onClick: MouseEventHandler<HTMLDivElement>;
}
export interface SegmentedOptionProps extends SegmentedChoice {
  className?: string;
  styleType: 'default' | 'underline';
  onMouseOver?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  initElementInfo?: (width: number, offset: number) => void;
}

/** One option; selected underline geometry is sampled after selection changes, as before. */
export function SegmentedOption({
  label,
  onClick,
  isSelected,
  className,
  styleType,
  onMouseOver,
  onMouseLeave,
  initElementInfo,
}: SegmentedOptionProps) {
  const theme = useTheme(),
    styles =
      styleType === 'default' ? defaultSegmentedStyles(theme) : underlineSegmentedStyles(theme);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (styleType === 'underline' && isSelected && ref.current)
      initElementInfo?.(ref.current.offsetWidth, ref.current.offsetLeft);
  }, [isSelected]);
  return (
    <div
      ref={ref}
      className={className}
      css={[styles.segmentOption, isSelected && styles.selectedSegmentOption]}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseLeave={onMouseLeave}
    >
      {label}
    </div>
  );
}

export interface SegmentedPickerProps {
  options: readonly SegmentedChoice[];
  className?: string;
}

/** Equal-width options preserve the selected end-border behavior and MobX observation. */
export const SegmentedPicker = observer(function SegmentedPicker({
  options,
}: SegmentedPickerProps) {
  const styles = defaultSegmentedStyles(useTheme());
  const first = options[0],
    last = options[options.length - 1];
  const [right, setRight] = useState(true),
    [left, setLeft] = useState(false);
  useEffect(() => {
    if (first?.isSelected) {
      setRight(true);
      setLeft(false);
    } else if (last?.isSelected) {
      setRight(false);
      setLeft(true);
    } else {
      setRight(true);
      setLeft(true);
    }
  }, [first?.isSelected, last?.isSelected]);
  return (
    <div
      css={[styles.optionContainer, right && styles.firstOption, left && styles.lastOption]}
      data-testid="segmented-picker"
    >
      {options.map((option, index) => (
        <SegmentedOption
          key={index}
          {...option}
          styleType="default"
          css={{ minWidth: `${100 / options.length}%` }}
        />
      ))}
    </div>
  );
});

/** Hover follows each option; leaving restores the last selected underline position. */
export const SegmentedPickerUnderline = observer(function SegmentedPickerUnderline({
  options,
  className,
}: SegmentedPickerProps) {
  const styles = underlineSegmentedStyles(useTheme());
  const [width, setWidth] = useState(0),
    [offset, setOffset] = useState(0);
  const [selectedWidth, setSelectedWidth] = useState(0),
    [selectedOffset, setSelectedOffset] = useState(0);
  const [transition, setTransition] = useState('');
  if (options.length < 2) return <></>;
  return (
    <div className={className} css={styles.optionContainer} data-testid="segmented-picker">
      <div
        css={styles.underline}
        style={{ width, transform: `translateX(${offset}px)`, transition }}
      />
      {options.map((option, index) => (
        <SegmentedOption
          key={index}
          styleType="underline"
          label={option.label}
          isSelected={option.isSelected}
          onClick={(event) => {
            option.onClick(event);
            setSelectedWidth(event.currentTarget.offsetWidth);
            setSelectedOffset(event.currentTarget.offsetLeft);
          }}
          onMouseOver={(event) => {
            setWidth(event.currentTarget.offsetWidth);
            setOffset(event.currentTarget.offsetLeft);
            setTransition('transform 0.5s, width 0.5s');
          }}
          onMouseLeave={() => {
            setWidth(selectedWidth);
            setOffset(selectedOffset);
          }}
          initElementInfo={(initialWidth, initialOffset) => {
            setWidth(initialWidth);
            setOffset(initialOffset);
            setSelectedWidth(initialWidth);
            setSelectedOffset(initialOffset);
          }}
        />
      ))}
    </div>
  );
});
