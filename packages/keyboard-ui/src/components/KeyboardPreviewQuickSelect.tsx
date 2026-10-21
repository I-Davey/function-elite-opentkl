/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { KeyboardAllKeysIcon } from './icons/KeyboardAllKeysIcon.js';
import { KeyboardByKeyIcon } from './icons/KeyboardByKeyIcon.js';
import { KeyboardPerimeterIcon } from './icons/KeyboardPerimeterIcon.js';
import { WASD_KEYS } from '../models/actuationPresets.js';
import type { KeyboardDeviceProfileInstance } from '../models/KeyboardDeviceProfile.js';
import { quickSelectStyles } from './quickSelectStyles.js';

type QuickSelection = 'all' | 'key' | 'perimeter' | 'deselectAll';
/** The per-key shortcut seeds WASD; selected state still reflects any partial key selection. */
export const KeyboardPreviewQuickSelect = observer(function KeyboardPreviewQuickSelect({
  buttons,
  keyboardDeviceProfile: profile,
  keys,
}: {
  buttons: readonly QuickSelection[];
  keyboardDeviceProfile: KeyboardDeviceProfileInstance;
  keys: number[];
}) {
  const styles = quickSelectStyles(useTheme()),
    { t } = useTranslation();
  const { selectedKeys, isPerimeterSelected } = profile;
  const selected = (kind: QuickSelection) => {
    switch (kind) {
      case 'all':
        return selectedKeys.size === keys.length;
      case 'key':
        return selectedKeys.size > 0 && selectedKeys.size !== keys.length && !isPerimeterSelected;
      case 'perimeter':
        return isPerimeterSelected;
      case 'deselectAll':
        return selectedKeys.size === 0 && !isPerimeterSelected;
    }
  };
  const select = (kind: QuickSelection) => {
    profile.clearSelection();
    profile.setIsPerimeterSelected(false);
    if (kind === 'all') profile.addKeys(keys);
    if (kind === 'key') profile.addKeys(WASD_KEYS);
    if (kind === 'perimeter') profile.setIsPerimeterSelected(true);
  };
  return (
    <div css={styles.container}>
      {buttons.map((button) => (
        <button
          key={button}
          type="button"
          aria-pressed={selected(button)}
          onClick={() => select(button)}
          css={[styles.item, selected(button) && styles.selected]}
        >
          {button === 'all' ? (
            <KeyboardAllKeysIcon css={styles.icon} />
          ) : button === 'key' ? (
            <KeyboardByKeyIcon css={styles.icon} />
          ) : button === 'perimeter' ? (
            <KeyboardPerimeterIcon css={styles.icon} />
          ) : null}
          {t(
            button === 'all'
              ? 'keyboard:allKeys'
              : button === 'key'
                ? 'keyboard:perKey'
                : button === 'perimeter'
                  ? 'keyboard:perimeter'
                  : 'keyboard:deselectAll',
          )}
        </button>
      ))}
    </div>
  );
});
