/** @jsxImportSource @emotion/react */
import { useTheme, type CSSObject } from '@emotion/react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useSelection } from '@viselect/react';
import { observer } from 'mobx-react';
import { KeyboardRows, ActuationWrapper, KeyPreview } from './KeyboardRows.js';
import { KeyboardSelectionWrapper } from './KeyboardSelectionWrapper.js';
import { KeyboardPreviewQuickSelect } from './KeyboardPreviewQuickSelect.js';
import { useResizeObserver } from './useResizeObserver.js';
import { keyboardPreviewStyles } from './keyboardPreviewStyles.js';
import { actuationKeyCode, selectableKeyCodes } from '../logic/keyboardSelection.js';
import { getKeyboardInfo } from '../layouts/keyboardInfo.js';
import { getRemappedCode } from '../models/remapPreview.js';
import { levelColorScale, rapidColorScale } from '../models/actuationColors.js';
import type { KeyboardReadyDevice } from '../models/deviceTypes.js';
import type { KeyboardDeviceProfileInstance } from '../models/KeyboardDeviceProfile.js';
import type { KeyRemapDeviceProfileInstance } from '../models/KeyRemapDeviceProfile.js';

interface PreviewProps {
  readyKeyboardDevice: KeyboardReadyDevice;
  keyboardDeviceProfile: KeyboardDeviceProfileInstance;
  keyRemapDeviceProfile: KeyRemapDeviceProfileInstance;
}
/** Selected single-actuation keys display level colours and rapid-trigger sensitivity borders. */
export const KeyboardActuationPreviewContent = observer(function KeyboardActuationPreviewContent({
  readyKeyboardDevice: device,
  keyboardDeviceProfile: profile,
  keyRemapDeviceProfile: remaps,
  contentRef,
  selectAllKeys,
  keyboardStyle,
}: PreviewProps & {
  contentRef: RefObject<HTMLDivElement>;
  selectAllKeys: () => void;
  keyboardStyle: CSSObject;
}) {
  const theme = useTheme(),
    selection = useSelection(),
    keyboardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const clickAway = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        selection &&
        contentRef.current?.contains(event.target) &&
        keyboardRef.current &&
        !keyboardRef.current.contains(event.target) &&
        !event.shiftKey &&
        !event.ctrlKey
      )
        selectAllKeys();
    };
    document.addEventListener('mousedown', clickAway);
    return () => document.removeEventListener('mousedown', clickAway);
  }, [contentRef, keyboardRef, selection, selectAllKeys]);
  useEffect(() => {
    profile.clearSelection();
    selectAllKeys();
  }, []);
  const active = remaps.activeProfile,
    { layout } = getKeyboardInfo(device)!;
  const borderColors: Partial<Record<number, string>> = {},
    labelColors: Partial<Record<number, string>> = {};
  profile.selectedKeys.forEach((code) => {
    const key = active?.physicalKeys.get(String(code));
    if (key?.active.kind === 'Single') {
      labelColors[code] = levelColorScale(key.active.actuation.level) ?? '';
      borderColors[code] = key.active.actuation.isRapidTrigger
        ? (rapidColorScale(key.active.actuation.rapidSensitivity) ?? '')
        : `#${theme.keyboard.keyBackground.toHex()}`;
    }
  });
  const keyboardInfo = {
    layout: device.capabilityData.physicalKeys?.physicalKeysLayout?.layout ?? 'ANSI',
    region: profile.keyboardRegion,
  };
  return (
    <div ref={keyboardRef} css={keyboardStyle}>
      <KeyboardRows
        layout={layout}
        selectedKeys={profile.selectedKeys}
        scalar={50}
        borderColors={borderColors}
        labelColors={labelColors}
      >
        {(wrapper) => (
          <ActuationWrapper key={`keyboard-key-${wrapper.keyIndex}`} {...wrapper}>
            <KeyPreview
              keyboardInfo={keyboardInfo}
              keyIndex={wrapper.keyIndex}
              keyItem={{
                ...wrapper.keyItem,
                code: getRemappedCode(
                  'Base',
                  profile.keyremapProfile?.activeProfile,
                  wrapper.keyItem.code,
                ),
              }}
              borderColor={wrapper.borderColor}
              theme={theme}
              scalar={50}
            />
          </ActuationWrapper>
        )}
      </KeyboardRows>
    </div>
  );
});
/** Ctrl/Shift retain accumulated selection; an empty unmodified stop restores all keys. */
export const KeyboardActuationPreview = observer(function KeyboardActuationPreview(
  props: PreviewProps,
) {
  const { readyKeyboardDevice: device, keyboardDeviceProfile: profile } = props;
  const [ref, { width }] = useResizeObserver(),
    info = getKeyboardInfo(device)!;
  const [transition, setTransition] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTransition(true), 200);
    return () => clearTimeout(timer);
  }, []);
  const styles = keyboardPreviewStyles(info.formFactor, width, transition);
  const selectAllKeys = () => profile.addKeys(selectableKeyCodes(actuationKeyCode));
  return (
    <div css={styles.container}>
      <KeyboardSelectionWrapper
        onStart={({ event, selection }) => {
          profile.setIsSelecting(true);
          if (!event?.ctrlKey && !event?.shiftKey) {
            profile.clearSelection();
            selection.clearSelection(true, true);
          }
        }}
        onMove={({ store: { changed } }) => {
          if (changed.added.length)
            profile.addKeys(changed.added.flatMap((element) => actuationKeyCode(element) ?? []));
          if (changed.removed.length)
            profile.removeKeys(
              changed.removed.flatMap((element) => actuationKeyCode(element) ?? []),
            );
        }}
        onStop={({ event, store }) => {
          profile.setIsSelecting(false);
          if (!store.stored.length && !event?.shiftKey && !event?.ctrlKey) selectAllKeys();
        }}
      >
        <div css={styles.content} ref={ref}>
          <KeyboardActuationPreviewContent
            {...props}
            contentRef={ref}
            selectAllKeys={selectAllKeys}
            keyboardStyle={styles.keyboard}
          />
        </div>
      </KeyboardSelectionWrapper>
      <div css={styles.footer}>
        <KeyboardPreviewQuickSelect
          buttons={['all', 'key', 'deselectAll']}
          keyboardDeviceProfile={profile}
          keys={info.keys}
        />
      </div>
    </div>
  );
});
