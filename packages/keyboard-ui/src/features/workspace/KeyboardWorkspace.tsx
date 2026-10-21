/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { useEffect } from 'react';
import { observer } from 'mobx-react';
import { useHistory, useLocation } from 'react-router';
import { keyboardRoutes } from '../../keyboardRoutes.js';
import { KeyboardContent } from './KeyboardContent.js';
import { KeyboardControlsRouter } from './KeyboardControlsRouter.js';
import type { KeyboardWorkspaceProps } from './KeyboardPreviewRouter.js';
import { keyboardWorkspaceStyles } from './workspaceStyles.js';

/** Keyboard-only shell; hardware transactions, recovery and connection state belong to the renderer. */
export const KeyboardWorkspace = observer(function KeyboardWorkspace(
  props: KeyboardWorkspaceProps,
) {
  const styles = keyboardWorkspaceStyles(useTheme()),
    history = useHistory(),
    { pathname } = useLocation();
  useEffect(() => {
    if (pathname === keyboardRoutes.keyboardDevice)
      history.replace(keyboardRoutes.keyboardDeviceLighting);
  }, [history, pathname]);
  return (
    <div css={styles.keyboardContainer}>
      <div css={styles.overlayWrapper}>
        <KeyboardContent {...props} />
      </div>
      <KeyboardControlsRouter {...props} />
    </div>
  );
});
