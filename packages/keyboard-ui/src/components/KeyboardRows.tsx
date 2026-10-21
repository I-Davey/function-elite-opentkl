/** @jsxImportSource @emotion/react */
import { useTheme, type CSSObject } from '@emotion/react';
import { memo, useMemo, type ReactNode } from 'react';
import { observer } from 'mobx-react';
import fastDeepEqual from 'fast-deep-equal';
import { KeyboardKey } from './KeyboardKey.js';
import { KeyboardISOEnterKey } from './KeyboardISOEnterKey.js';
import { getKeyInfo } from '../layouts/keyInfo.js';
import type { KeyGeometry, KeyboardLayout } from '../layouts/types.js';
import type { KeyboardTheme } from '../theme/types.js';
import { zIndex } from '../theme/layers.js';

export const DEFAULT_KEY_COLOR = '#000';
export interface PreviewStyles {
  keyboardKey: CSSObject;
  selectedKey: CSSObject;
  opaqueKey: CSSObject;
}
export interface KeyWrapperProps {
  keyItem: KeyGeometry;
  dataCode: string;
  keyIndex: number;
  selected: boolean;
  styles: PreviewStyles;
  keyColor: readonly string[];
  labelColor?: string;
  borderColor?: string;
  children?: ReactNode;
}
export interface KeyboardRowsProps {
  className?: string;
  layout: KeyboardLayout;
  scalar: number;
  selectedKeys: Pick<ReadonlySet<number>, 'has'>;
  labelColors?: Partial<Record<number | '', string>>;
  borderColors?: Partial<Record<number | '', string>>;
  keyColors?: Partial<Record<number | '', readonly string[]>>;
  children: (key: KeyWrapperProps) => ReactNode;
}
export interface KeyPreviewProps {
  keyboardInfo: { layout: string; region: string };
  keyItem: KeyGeometry;
  keyIndex: number;
  scalar: number;
  theme: KeyboardTheme;
  borderColor?: string;
  isShortLabel?: boolean;
}
/** A layout entry may be a gap or a joined ISO segment, not a physical key. */
export function KeyPreview({
  keyboardInfo,
  keyItem,
  keyIndex,
  scalar,
  theme,
  borderColor,
  isShortLabel = false,
}: KeyPreviewProps) {
  const size = useMemo(
    () => ({
      width: keyItem.x ? keyItem.x * scalar : (keyItem.width || 1) * scalar,
      height: (keyItem.height || 1) * scalar,
    }),
    [keyItem, scalar],
  );
  const original = useMemo(
    () => getKeyInfo(keyItem.code, keyboardInfo.layout, keyboardInfo.region),
    [keyItem.code, keyboardInfo],
  );
  const keyInfo = isShortLabel
    ? { ...original, label: original.shortLabel ?? original.label, label2: original.shortLabel2 }
    : original;
  return keyItem.w2 !== undefined && keyItem.h2 !== undefined ? (
    <KeyboardISOEnterKey
      key={`keyboard-key-wrapper-${keyIndex}`}
      size={size}
      keyItem={{ ...keyItem, h2: keyItem.h2, w2: keyItem.w2 }}
      keyInfo={keyInfo}
      scalar={scalar}
      theme={theme}
      borderColor={borderColor}
    />
  ) : (
    <KeyboardKey
      code={keyItem.code}
      keyInfo={keyInfo}
      size={size}
      padding={scalar / 10}
      theme={theme}
      borderColor={borderColor}
    />
  );
}
export function getBackground(keyColor: readonly string[]) {
  return keyColor.length >= 2
    ? `linear-gradient(to right, ${keyColor[0]}, ${keyColor[1]})`
    : keyColor.length
      ? keyColor[0]
      : DEFAULT_KEY_COLOR;
}
export function getKeyBorder(
  keyItem: KeyGeometry,
  keyColor: readonly string[] = [DEFAULT_KEY_COLOR],
): CSSObject {
  return {
    position: 'relative',
    zIndex: `${keyItem.w2 && keyItem.h2 ? zIndex('key') : 0}`,
    '&::before': {
      content: '""',
      position: 'absolute',
      top: -1,
      left: -1,
      right: -1,
      bottom: -1,
      zIndex: -1,
      background: getBackground(keyColor),
    },
  };
}
export const getKeyLabelStyle = (fill: string): CSSObject => ({ g: { 'text, svg': { fill } } });
/** Retain the original memoization boundary; selection and remapped code drive label updates. */
export const LightingKeyWrapper = memo(
  function LightingKeyWrapper({
    keyItem,
    dataCode,
    keyColor,
    selected,
    styles,
    children,
  }: KeyWrapperProps & { code?: number }) {
    const isKey = keyItem.code !== undefined || keyItem.joinedWith !== undefined;
    const border = useMemo(() => getKeyBorder(keyItem, keyColor), [keyItem, keyColor]);
    return (
      <div
        data-code={dataCode}
        css={[
          isKey && styles.keyboardKey,
          selected && styles.selectedKey,
          !selected && styles.opaqueKey,
          isKey && border,
        ]}
      >
        {children}
      </div>
    );
  },
  (previous, next) =>
    fastDeepEqual(previous.keyColor, next.keyColor) &&
    previous.selected === next.selected &&
    previous.code === next.code,
);

export const ActuationWrapper = observer(function ActuationWrapper({
  keyItem,
  dataCode,
  labelColor,
  selected,
  styles,
  children,
}: KeyWrapperProps) {
  const isKey = keyItem.code !== undefined || keyItem.joinedWith !== undefined;
  return (
    <div
      data-code={dataCode}
      css={[
        isKey && styles.keyboardKey,
        selected && styles.selectedKey,
        !selected && styles.opaqueKey,
        isKey && getKeyBorder(keyItem),
        labelColor && getKeyLabelStyle(labelColor),
      ]}
    >
      {children}
    </div>
  );
});
export const RemapKeyWrapper = observer(function RemapKeyWrapper({
  keyItem,
  dataCode,
  labelColor,
  selected,
  styles,
  children,
  infoBadge,
  onClick,
}: KeyWrapperProps & { infoBadge?: ReactNode; onClick: (code: number) => void }) {
  const isKey = keyItem.code !== undefined || keyItem.joinedWith !== undefined;
  const iso = keyItem.w2 !== undefined && keyItem.h2 !== undefined;
  return (
    <div
      data-code={dataCode}
      css={[
        !iso && { height: '100%' },
        isKey && styles.keyboardKey,
        selected && styles.selectedKey,
        !selected && styles.opaqueKey,
        isKey && getKeyBorder(keyItem, [iso ? 'transparent' : DEFAULT_KEY_COLOR]),
        labelColor && getKeyLabelStyle(labelColor),
      ]}
      onClick={() => keyItem.code !== undefined && onClick(keyItem.code)}
    >
      {infoBadge}
      {children}
    </div>
  );
});
/** Preserve row scaling, physical selection and joined-segment colour lookup for all consumers. */
export const KeyboardRows = observer(function KeyboardRows({
  className = '',
  layout,
  selectedKeys,
  labelColors,
  borderColors,
  keyColors,
  scalar,
  children,
}: KeyboardRowsProps) {
  const theme = useTheme();
  const styles: PreviewStyles = {
    keyboardKey: {
      label: 'Component-keyboardKey',
      g: { 'text, svg': { fill: `${theme.keyboard.selectedKeyText}` } },
    },
    opaqueKey: {
      label: 'Component-opaqueKey',
      g: { 'text, svg': { fill: `${theme.keyboard.opaqueKey}` } },
    },
    selectedKey: {
      label: 'Component-selectedKey',
      g: { 'text, svg ': { transition: 'fill 0.2s', fill: `${theme.keyboard.selectedKeyText}` } },
    },
  };
  // Invoke render props within this observer so remap/model reads retain MobX subscriptions.
  return layout.map((row, rowIndex) => (
    <div
      key={rowIndex}
      className={className}
      css={[
        { label: 'Component-keyboardRow', display: 'flex', fontSize: 16 },
        { height: scalar * (row[0]?.y || 1) },
      ]}
    >
      {row.map((keyItem, keyIndex) => {
        const code = keyItem.code ?? keyItem.joinedWith ?? '';
        return children({
          keyIndex,
          keyItem,
          dataCode: `key-${keyItem.joinedWith || keyItem.code || ''}`,
          selected: keyItem.code !== undefined && selectedKeys.has(keyItem.code),
          keyColor: keyColors?.[code] ?? [DEFAULT_KEY_COLOR],
          labelColor: labelColors?.[code],
          borderColor: borderColors?.[code],
          styles,
        });
      })}
    </div>
  ));
});
