/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { KeyboardRows, KeyPreview, RemapKeyWrapper } from './KeyboardRows.js';
import { keyboardPreviewStyles } from './keyboardPreviewStyles.js';
import { useResizeObserver } from './useResizeObserver.js';
import type { KeyboardLayout } from '../layouts/types.js';
import { feedbackColor, isMapped, type AnalogueProfile } from '../../../contracts/desktop-analogue.cjs';
import { keyboardOutputs } from '../../../contracts/desktop-keyboard.cjs';
import { getKeyInfo } from '../layouts/keyInfo.js';

/** The normal remapping keycaps and responsive preview surface, with live travel overlays. */
export function KeyboardAnaloguePreview({ layout, keyboardInfo, bindings, selected, depths, overriddenKeys, pendingKeys, feedback, onSelect }: {
  layout: KeyboardLayout; keyboardInfo: { layout: string; region: string };
  bindings: AnalogueProfile['bindings']; selected: number; depths: Record<string, number>;
  overriddenKeys: number[]; feedback: AnalogueProfile['feedback'];
  pendingKeys: number[];
  onSelect(key: number): void;
}) {
  const theme = useTheme();
  const [ref, { width }] = useResizeObserver();
  const styles = keyboardPreviewStyles('MiniTkl', width, false);
  return <div css={styles.container}>
    <div ref={ref} css={styles.content}>
      <div css={styles.keyboard}>
        <KeyboardRows layout={layout} scalar={50} selectedKeys={new Set([selected])}>
          {(wrapper) => {
            const key = wrapper.keyItem.code, mapped = key !== undefined && isMapped(bindings[String(key)]);
            const overridden = key !== undefined && overriddenKeys.includes(key);
            const pending = key !== undefined && pendingKeys.includes(key);
            const color = mapped ? feedbackColor(bindings[String(key)], overridden, feedback) : undefined;
            const borderColor = key === selected ? '#c7a5ff' : mapped ? color : '#48434e';
            return <div key={wrapper.dataCode} className="analogue-preview-key" role={key !== undefined ? 'button' : undefined}
              tabIndex={key !== undefined ? 0 : undefined} aria-pressed={key !== undefined ? key === selected : undefined}
              aria-label={key !== undefined ? 'Map ' + getKeyInfo(key, keyboardInfo.layout, keyboardInfo.region).label : undefined}
              title={pending ? 'Release this key to complete the mode switch' : mapped ? overridden ? 'Output off · normal key enabled' : (bindings[String(key)].extraKey !== undefined ? 'Extra key: ' + keyboardOutputs[bindings[String(key)].extraKey!].label + ' · ' : '') + (bindings[String(key)].overwriteDefault ? 'Normal key suppressed' : 'Normal key enabled') : undefined}
              onKeyDown={(event) => { if (key !== undefined && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onSelect(key); } }}>
              <RemapKeyWrapper {...wrapper} labelColor={key === selected ? '#f4ecff' : mapped ? '#c7acee' : '#aaa3b3'} onClick={onSelect}
                infoBadge={<>{mapped && <span className={'analogue-preview-mapped' + (pending ? ' is-pending' : '')} style={{ background: overridden || pending ? feedback.overrideColor : bindings[String(key)].overwriteDefault ? feedback.suppressedColor : feedback.activeColor }} />}
                  {mapped && feedback.enabled && <span className="analogue-preview-feedback" style={{ background: color }} />}
                  {key !== undefined && depths[String(key)] > 0 && <span className="analogue-preview-travel" style={{ height: Math.min(1, depths[String(key)] / 4) * 37 }} />}</>}>
                <KeyPreview keyItem={wrapper.keyItem} keyIndex={wrapper.keyIndex} scalar={50} theme={theme} keyboardInfo={keyboardInfo} borderColor={borderColor} />
              </RemapKeyWrapper>
            </div>;
          }}
        </KeyboardRows>
      </div>
    </div>
    <div css={styles.footer} aria-hidden="true" />
  </div>;
}
