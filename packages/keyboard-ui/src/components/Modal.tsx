/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import type { CSSProperties, ReactNode, Ref } from 'react';
import ReactModal from 'react-modal';
import { CloseButton } from './CloseButton.js';
import { LargePrimaryButton, LargeSecondaryButton } from './Button.js';
import { modalStyles, modalOverlay } from './modalStyles.js';

export interface ModalProps extends Omit<ReactModal.Props, 'className' | 'onRequestClose'> {
  showCloseButton?: boolean;
  confirmButtonText?: ReactNode;
  cancelButtonText?: ReactNode;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  onRequestClose?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  closeOnAction?: boolean;
  className?: string;
  contentClassName?: string;
  closeClassName?: string;
  maxWidth?: CSSProperties['maxWidth'];
  maxHeight?: CSSProperties['maxHeight'];
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  scrollableRef?: Ref<HTMLDivElement>;
}

/** Original full-overlay modal. Actions run before optional close; callbacks are not awaited.
 * Request-close remains a manual close/button callback, matching the recovered dismissal policy.
 */
export function Modal({
  showCloseButton = true,
  confirmButtonText = '',
  cancelButtonText = '',
  confirmDisabled = false,
  cancelDisabled = false,
  onRequestClose = () => null,
  onConfirm = () => null,
  onCancel = () => null,
  closeOnAction = true,
  className = '',
  contentClassName = '',
  closeClassName = '',
  maxWidth = 500,
  maxHeight = 500,
  width = '100%',
  height = '100%',
  scrollableRef = null,
  children,
  ...props
}: ModalProps) {
  const styles = modalStyles(useTheme());
  return (
    <ClassNames>
      {({ css, cx }) => {
        const overlay = css(modalOverlay);
        return (
          <ReactModal
            id="tooltip-context"
            shouldFocusAfterRender={false}
            className={css(styles.modalContent)}
            overlayClassName={{
              base: overlay,
              afterOpen: cx(overlay, css({ opacity: 1 })),
              beforeClose: cx(overlay, css({ opacity: 0 })),
            }}
            closeTimeoutMS={150}
            {...props}
          >
            <div
              className={cx(css(styles.contentWrapper), className)}
              style={{ maxWidth, maxHeight, width, height }}
            >
              {showCloseButton && (
                <CloseButton
                  onClick={onRequestClose}
                  className={cx(css(styles.close), closeClassName)}
                />
              )}
              <div ref={scrollableRef} className={cx(css(styles.content), contentClassName)}>
                {children}
              </div>
              {(confirmButtonText || cancelButtonText) && (
                <div className={css(styles.buttons)}>
                  {cancelButtonText && (
                    <LargeSecondaryButton
                      disabled={cancelDisabled}
                      onClick={() => {
                        onCancel();
                        if (closeOnAction) onRequestClose();
                      }}
                    >
                      {cancelButtonText}
                    </LargeSecondaryButton>
                  )}
                  {confirmButtonText && (
                    <LargePrimaryButton
                      className={!cancelButtonText ? css(styles.buttonSpan) : undefined}
                      disabled={confirmDisabled}
                      onClick={() => {
                        onConfirm();
                        if (closeOnAction) onRequestClose();
                      }}
                    >
                      {confirmButtonText}
                    </LargePrimaryButton>
                  )}
                </div>
              )}
            </div>
          </ReactModal>
        );
      }}
    </ClassNames>
  );
}
