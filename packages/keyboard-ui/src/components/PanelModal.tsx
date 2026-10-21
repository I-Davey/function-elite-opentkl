/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import type { ReactNode } from 'react';
import ReactModal from 'react-modal';
import { CloseButton } from './CloseButton.js';
import { PrimaryButton, SecondaryButton } from './Button.js';
import type { ModalProps } from './Modal.js';
import { panelModalStyles, modalOverlay } from './modalStyles.js';

export interface PanelModalProps extends Omit<ModalProps, 'closeOnAction'> {
  heading?: ReactNode;
  subheading?: ReactNode;
  footer?: ReactNode;
}

/** Centered heading/footer variant. Confirm/cancel callbacks own closing, as before. */
export function PanelModal({
  heading,
  subheading,
  showCloseButton = true,
  confirmButtonText = '',
  cancelButtonText = '',
  confirmDisabled = false,
  cancelDisabled = false,
  onRequestClose = () => null,
  onConfirm = () => null,
  onCancel = () => null,
  className = '',
  contentClassName = '',
  closeClassName = '',
  maxWidth = 500,
  maxHeight = 500,
  width = '100%',
  height = '100%',
  scrollableRef = null,
  footer,
  children,
  ...props
}: PanelModalProps) {
  const styles = panelModalStyles(useTheme()),
    dimensions = { maxWidth, maxHeight, width, height };
  return (
    <ClassNames>
      {({ css, cx }) => {
        const overlay = css({ ...modalOverlay, pointerEvents: 'auto' });
        return (
          <ReactModal
            className={css(styles.modalContent)}
            overlayClassName={{
              base: overlay,
              afterOpen: cx(overlay, css({ opacity: 1 })),
              beforeClose: cx(overlay, css({ opacity: 0 })),
            }}
            style={{ content: dimensions }}
            closeTimeoutMS={150}
            {...props}
          >
            <section className={cx(css(styles.contentWrapper), className)} style={dimensions}>
              {showCloseButton && (
                <CloseButton
                  onClick={onRequestClose}
                  className={cx(css(styles.close), closeClassName)}
                />
              )}
              <div className={css(styles.header)}>
                <h1 className={css(styles.heading)}>{heading}</h1>
                {subheading && <h2 className={css(styles.subheading)}>{subheading}</h2>}
              </div>
              <div ref={scrollableRef} className={cx(css(styles.content), contentClassName)}>
                {children}
              </div>
              {(confirmButtonText || cancelButtonText) && (
                <div className={css(styles.footer)}>
                  {confirmButtonText && (
                    <PrimaryButton
                      onClick={onConfirm}
                      disabled={confirmDisabled}
                      className={css(styles.footerButton)}
                      data-testid="confirm-button"
                    >
                      {confirmButtonText}
                    </PrimaryButton>
                  )}
                  {cancelButtonText && (
                    <SecondaryButton
                      onClick={onCancel}
                      disabled={cancelDisabled}
                      className={css(styles.footerButton)}
                      data-testid="cancel-button"
                    >
                      {cancelButtonText}
                    </SecondaryButton>
                  )}
                  {footer}
                </div>
              )}
            </section>
          </ReactModal>
        );
      }}
    </ClassNames>
  );
}
