/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { observer } from 'mobx-react';
import { getSnapshot, type SnapshotIn } from 'mobx-state-tree';
import type { ReactiveZoneEffectSettings } from '../../models/ReactiveZoneEffects.js';
import type { KeyboardDeviceProfileInstance } from '../../models/KeyboardDeviceProfile.js';
import type { KeyboardReadyDevice } from '../../models/deviceTypes.js';
import {
  FadeControls,
  LineReactiveControls,
  RippleReactiveControls,
} from './ReactiveEffectControls.js';
import { lightingReactiveStyles } from './lightingStyles.js';

export interface KeyboardLightingReactiveControlsProps {
  keyboardDeviceProfile: KeyboardDeviceProfileInstance;
  readyKeyboardDevice: KeyboardReadyDevice;
  onSelect: (settings: SnapshotIn<typeof ReactiveZoneEffectSettings>) => void;
}

/** Only the selected reactive zone supplies editor values; mixed selections stay collapsed. */
export const KeyboardLightingReactiveControls = observer(
  function KeyboardLightingReactiveControls({
    keyboardDeviceProfile: profile,
    readyKeyboardDevice,
    onSelect,
  }: KeyboardLightingReactiveControlsProps) {
    const theme = useTheme(),
      rules = lightingReactiveStyles(theme);
    const effectSettings = getSnapshot(
      profile.selectedReactiveZone.effectSettings,
    );
    if (profile.selectedReactiveEffectInfo.effectName === 'Mixed') return null;
    return (
      <ClassNames>
        {({ css }) => {
          const common = {
            readyKeyboardDevice,
            onSelect,
            theme,
            styles: {
              container: css(rules.container),
              label: css(rules.label),
            },
          };
          switch (effectSettings.kind) {
            case 'Line':
              return (
                <LineReactiveControls
                  {...common}
                  effectSettings={effectSettings}
                />
              );
            case 'Ripple':
              return (
                <RippleReactiveControls
                  {...common}
                  effectSettings={effectSettings}
                />
              );
            case 'Fade':
              return (
                <FadeControls {...common} effectSettings={effectSettings} />
              );
            default:
              return null;
          }
        }}
      </ClassNames>
    );
  },
);
