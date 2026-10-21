/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { observer } from 'mobx-react';
import { getSnapshot, type SnapshotIn } from 'mobx-state-tree';
import type { BaseZoneEffectSettings } from '../../models/BaseZoneEffects.js';
import type {
  KeyboardBaseZoneInstance,
  KeyboardPerimeterZoneInstance,
} from '../../models/KeyboardZone.js';
import type { LightingEffectInfo } from '../../models/defaultEffects.js';
import type { KeyboardReadyDevice } from '../../models/deviceTypes.js';
import {
  ColorControls,
  CoveringMarqueeControls,
  PulseColorControls,
  ShiftColorControls,
  SolidGradient2Controls,
  WaveControls,
} from './BaseEffectControls.js';
import { lightingBaseStyles } from './lightingStyles.js';

export interface KeyboardLightingBaseControlsProps {
  selectedBaseEffectInfo: LightingEffectInfo;
  selectedBaseZone: KeyboardBaseZoneInstance | KeyboardPerimeterZoneInstance;
  readyKeyboardDevice: KeyboardReadyDevice;
  onSelect: (settings: SnapshotIn<typeof BaseZoneEffectSettings>) => void;
  perimeter?: boolean;
}

/** Mixed selections show a mode choice, but no editor until a common effect is chosen. */
export const KeyboardLightingBaseControls = observer(
  function KeyboardLightingBaseControls({
    selectedBaseEffectInfo,
    selectedBaseZone,
    readyKeyboardDevice,
    onSelect,
    perimeter,
  }: KeyboardLightingBaseControlsProps) {
    const theme = useTheme(),
      rules = lightingBaseStyles(theme);
    const effectSettings = getSnapshot(selectedBaseZone.effectSettings);
    if (selectedBaseEffectInfo.effectName === 'Mixed') return null;
    return (
      <ClassNames>
        {({ css }) => {
          const styles = {
            container: css(rules.container),
            colorPickers: css(rules.colorPickers),
            row: css(rules.row),
            label: css(rules.label),
          };
          const common = {
            readyKeyboardDevice,
            styles,
            onSelect,
            theme,
            perimeter,
          };
          switch (effectSettings.kind) {
            case 'Color':
              return (
                <ColorControls
                  effectSettings={effectSettings}
                  onSelect={onSelect}
                />
              );
            case 'CoveringMarquee':
              return (
                <CoveringMarqueeControls
                  {...common}
                  effectSettings={effectSettings}
                />
              );
            case 'PulseColor':
              return (
                <PulseColorControls
                  {...common}
                  effectSettings={effectSettings}
                />
              );
            case 'ShiftColor':
              return (
                <ShiftColorControls
                  {...common}
                  effectSettings={effectSettings}
                />
              );
            case 'SolidGradient2':
              return (
                <SolidGradient2Controls
                  {...common}
                  effectSettings={effectSettings}
                />
              );
            case 'Wave':
              return (
                <WaveControls {...common} effectSettings={effectSettings} />
              );
            default:
              return null;
          }
        }}
      </ClassNames>
    );
  },
);
