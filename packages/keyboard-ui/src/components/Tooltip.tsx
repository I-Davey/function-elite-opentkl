/** @jsxImportSource @emotion/react */
import { ClassNames } from '@emotion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePopper, type StrictModifier } from 'react-popper';
import type { Placement, PositioningStrategy } from '@popperjs/core';
import { colors } from '../theme/colors.js';
import { zIndex as layerIndex } from '../theme/layers.js';

export interface TooltipProps {
  rightClickAwayEnabled?: boolean;
  open?: boolean;
  onRequestClose?: () => void;
  className?: string;
  innerClassName?: string;
  containerType?: 'html' | 'svg';
  containerClassName?: string;
  fallbackPlacements?: Placement[];
  allowedAutoPlacements?: Placement[];
  children?: ReactNode;
  tooltip?: ReactNode;
  zIndex?: number;
  placement?: Placement;
  offset?: NonNullable<StrictModifier<'offset'>['options']>['offset'];
  strategy?: PositioningStrategy;
  clickAwayEnabled?: boolean;
  modifiers?: NonNullable<Parameters<typeof usePopper>[2]>['modifiers'];
}
const noop = () => {};
/** Controlled body portal; SVG/HTML anchors share native Popper positioning and click-away policy. */
export function Tooltip({
  rightClickAwayEnabled = false,
  open = false,
  onRequestClose = noop,
  className,
  innerClassName,
  containerType = 'html',
  containerClassName,
  fallbackPlacements = ['top-end', 'bottom-start'],
  allowedAutoPlacements = ['top-end', 'bottom-start'],
  children,
  tooltip,
  zIndex = layerIndex('tooltip'),
  placement = 'bottom-end',
  offset = [0, 5],
  strategy = 'fixed',
  clickAwayEnabled = true,
  modifiers = [],
}: TooltipProps) {
  const [referenceElement, setReferenceElement] = useState<Element | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  const { styles, attributes, forceUpdate } = usePopper(referenceElement, popperElement, {
    placement,
    strategy,
    modifiers: [
      { name: 'flip', options: { fallbackPlacements, allowedAutoPlacements } },
      { name: 'eventListeners', options: { scroll: open } },
      {
        name: 'preventOverflow',
        enabled: true,
        options: { altAxis: true, rootBoundary: 'document', padding: { top: 30 } },
      },
      { name: 'offset', options: { offset } },
      ...modifiers,
    ],
  });
  useEffect(() => {
    const observer = new MutationObserver(() => forceUpdate?.());
    if (popperElement)
      observer.observe(popperElement, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [popperElement, forceUpdate]);
  useEffect(() => {
    if (!clickAwayEnabled || !popperElement || !referenceElement) return;
    const targets = [document.getElementById('app'), document.getElementById('tooltip-context')];
    const onMouseDown = (event: MouseEvent) => {
      if (
        open &&
        event.target instanceof Node &&
        !popperElement.contains(event.target) &&
        !referenceElement.contains(event.target) &&
        (rightClickAwayEnabled || event.button !== 2)
      )
        onRequestClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose();
    };
    for (const target of targets) {
      target?.addEventListener('mousedown', onMouseDown);
      target?.addEventListener('keydown', onKeyDown);
    }
    return () => {
      for (const target of targets) {
        target?.removeEventListener('mousedown', onMouseDown);
        target?.removeEventListener('keydown', onKeyDown);
      }
    };
  }, [
    popperElement,
    referenceElement,
    clickAwayEnabled,
    open,
    onRequestClose,
    rightClickAwayEnabled,
  ]);
  return (
    <ClassNames>
      {({ css, cx }) => (
        <>
          {containerType === 'html' ? (
            <div ref={setReferenceElement} className={containerClassName}>
              {children}
            </div>
          ) : (
            <g ref={setReferenceElement} className={containerClassName}>
              {children}
            </g>
          )}
          {createPortal(
            <div
              ref={setPopperElement}
              className={cx(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 1,
                }),
                className,
              )}
              style={{ ...styles.container, ...styles.popper, zIndex }}
              {...attributes.popper}
            >
              {open && (
                <div
                  className={cx(
                    css({
                      opacity: 1,
                      padding: 16,
                      fontSize: 15,
                      boxShadow: `0 0 4px 0 ${colors.border.alpha(0.5)}`,
                      borderRadius: 2,
                      boxSizing: 'border-box',
                      whiteSpace: 'normal',
                    }),
                    innerClassName,
                  )}
                  style={styles.container}
                >
                  {tooltip}
                </div>
              )}
            </div>,
            document.body,
          )}
        </>
      )}
    </ClassNames>
  );
}
