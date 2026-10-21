/** @jsxImportSource @emotion/react */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useSelection } from '@viselect/react';
import { observer } from 'mobx-react';
import type { CSSObject } from '@emotion/react';
import { KeyboardLightingKeys } from './KeyboardLightingKeys.js';
import { KeyboardSelectionWrapper } from './KeyboardSelectionWrapper.js';
import { KeyboardPreviewQuickSelect } from './KeyboardPreviewQuickSelect.js';
import { useResizeObserver } from './useResizeObserver.js';
import { keyboardPreviewStyles } from './keyboardPreviewStyles.js';
import { lightingKeyCode, selectableKeyCodes } from '../logic/keyboardSelection.js';
import { getKeyboardInfo } from '../layouts/keyboardInfo.js';
import type { KeyboardReadyDevice } from '../models/deviceTypes.js';
import type { KeyboardDeviceProfileInstance } from '../models/KeyboardDeviceProfile.js';

interface PreviewProps {
  readyKeyboardDevice: KeyboardReadyDevice;
  keyboardDeviceProfile: KeyboardDeviceProfileInstance;
}
/** Empty space inside the lighting surface restores all keys and clears perimeter selection. */
export const KeyboardLightingPreviewContent = observer(function KeyboardLightingPreviewContent({
  readyKeyboardDevice,
  keyboardDeviceProfile: profile,
  contentRef,
  selectAllKeys,
  keyboardStyle,
}: PreviewProps & {
  contentRef: RefObject<HTMLDivElement>;
  selectAllKeys: () => void;
  keyboardStyle: CSSObject;
}) {
  const selection = useSelection(),
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
      ) {
        selectAllKeys();
        profile.setIsPerimeterSelected(false);
        selection.clearSelection(true, true);
      }
    };
    document.addEventListener('mousedown', clickAway);
    return () => document.removeEventListener('mousedown', clickAway);
  }, [contentRef, keyboardRef, selection, selectAllKeys, profile]);
  useEffect(() => {
    profile.clearSelection();
    selectAllKeys();
  }, []);
  return (
    <div ref={keyboardRef} css={keyboardStyle}>
      <KeyboardLightingKeys
        readyKeyboardDevice={readyKeyboardDevice}
        keyboardDeviceProfile={profile}
      />
    </div>
  );
});
/** Drag updates key membership; a sole perimeter rectangle selects perimeter lighting. */
export const KeyboardLightingPreview = observer(function KeyboardLightingPreview(
  props: PreviewProps,
) {
  const { keyboardDeviceProfile: profile, readyKeyboardDevice: device } = props;
  const [ref, { width }] = useResizeObserver(),
    info = getKeyboardInfo(device)!;
  const [transition, setTransition] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTransition(true), 200);
    return () => clearTimeout(timer);
  }, []);
  const styles = keyboardPreviewStyles(info.formFactor, width, transition);
  const selectAllKeys = () => profile.addKeys(selectableKeyCodes(lightingKeyCode));
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
        onMove={({ store: { changed, selected } }) => {
          if (changed.added.length)
            profile.addKeys(changed.added.flatMap((element) => lightingKeyCode(element) ?? []));
          if (changed.removed.length)
            profile.removeKeys(
              changed.removed.flatMap((element) => lightingKeyCode(element) ?? []),
            );
          profile.setIsPerimeterSelected(
            selected.length === 1 && selected[0]?.getAttribute('data-code') === 'perimeter',
          );
        }}
        onStop={({ event, store }) => {
          profile.setIsSelecting(false);
          if (!store.stored.length && !event?.shiftKey && !event?.ctrlKey) selectAllKeys();
        }}
      >
        <div css={styles.content} ref={ref}>
          <KeyboardLightingPreviewContent
            {...props}
            contentRef={ref}
            selectAllKeys={selectAllKeys}
            keyboardStyle={styles.keyboard}
          />
        </div>
      </KeyboardSelectionWrapper>
      <div css={styles.footer}>
        <KeyboardPreviewQuickSelect
          buttons={['all', 'key', 'perimeter']}
          keyboardDeviceProfile={profile}
          keys={info.keys}
        />
      </div>
    </div>
  );
});
