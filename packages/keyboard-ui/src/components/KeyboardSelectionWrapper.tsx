/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import SelectionArea from '@viselect/react';
import type { ComponentProps } from 'react';
import { zIndex } from '../theme/layers.js';

/** Native selection options/callbacks remain overrideable after the keyboard defaults. */
export function KeyboardSelectionWrapper({
  children,
  onStart,
  onMove,
  onStop,
  ...rest
}: ComponentProps<typeof SelectionArea>) {
  const theme = useTheme();
  return (
    <ClassNames>
      {({ css }) => (
        <SelectionArea
          selectionAreaClass={css({
            label: 'Component-selectionArea',
            background: `${theme.keyboard.selectionBackground}`,
            border: `2px solid ${theme.keyboard.selectionBorder}`,
            zIndex: zIndex('selection-area'),
          })}
          selectables={['div[data-code]']}
          onStart={onStart}
          onMove={onMove}
          onStop={onStop}
          features={{ range: false, touch: false, singleTap: { allow: true, intersect: 'touch' } }}
          behaviour={{
            startThreshold: 1,
            overlap: 'keep',
            intersect: 'touch',
            triggers: [0],
            scrolling: { speedDivider: 10, manualSpeed: 750, startScrollMargins: { x: 0, y: 0 } },
          }}
          {...rest}
        >
          {children}
        </SelectionArea>
      )}
    </ClassNames>
  );
}
