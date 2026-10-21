/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardPreviewRouter,
  type KeyboardWorkspaceProps,
} from './KeyboardPreviewRouter.js';
import { keyboardContentStyles } from './workspaceStyles.js';

/** Sidebar owns navigation; this card retains the current preview and selection models. */
export const KeyboardContent = observer(function KeyboardContent(
  props: KeyboardWorkspaceProps,
) {
  const styles = keyboardContentStyles(useTheme()),
    { t } = useTranslation(['keyboard']);
  const hasKeys =
    !!props.readyKeyboardDevice.supportedCapabilities.physicalKeys;
  return (
    <div css={styles.container} className="keyboard-preview-card">
      <div className="preview-card-heading">
        <strong>{t('common:keyboard')} <span className="preview-selection-count"> · {props.keyboardDeviceProfile.selectedKeys.size} selected</span></strong>
        <span>Click to select · Ctrl to add · Drag to select a group</span>
      </div>
      <div css={styles.paneContainer}>
        <div css={styles.settingsPreview}>
          {hasKeys && <KeyboardPreviewRouter {...props} />}
        </div>
      </div>
    </div>
  );
});
