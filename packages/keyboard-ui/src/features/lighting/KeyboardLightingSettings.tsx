/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { useRef, useState } from 'react';
import { observer } from 'mobx-react';
import { getSnapshot } from 'mobx-state-tree';
import { useTranslation } from 'react-i18next';
import type { GroupBase } from 'react-select';
import { Checkbox } from '../../components/Checkbox.js';
import { SecondarySelect } from '../../components/Select.js';
import { getSecondaryStyles } from '../../components/selectStyles.js';
import { SliderWithTickValues } from '../../components/SliderWithTickValues.js';
import { inspect, adjust } from '../../logic/key-brightness.js';
import { useKeyboardViewState } from '../../models/useKeyboardViewState.js';
import type { KeyboardDeviceProfileInstance } from '../../models/KeyboardDeviceProfile.js';
import {
  KeyboardBaseZone,
  KeyboardReactiveZone,
} from '../../models/KeyboardZone.js';
import { recordKeyBrightnessControl } from '../../../../ui-platform/src/brightness-diagnostics.cjs';
import type { Zone } from '../../../../backend/src/contracts.cjs';
import { lightingSettingsStyles } from './lightingStyles.js';

interface LightingSettingsProps {
  keyboardDeviceProfile: KeyboardDeviceProfileInstance;
}
interface BrightnessSession {
  identity: string;
  fingerprint: string;
  zones: Zone[];
  value: number;
  error: string | null;
}

/** Idle timeout values are seconds; the retained choices display one through sixty minutes. */
export const KeyboardIdleLighting = observer(function KeyboardIdleLighting({
  keyboardDeviceProfile: profile,
}: LightingSettingsProps) {
  const theme = useTheme(),
    styles = lightingSettingsStyles(theme),
    { t } = useTranslation();
  const { disabled, timeoutSeconds, setDisabled, setTimeoutSeconds } =
    profile.activeProfile.settings.idleTimeout;
  const options = [1, 5, 10, 15, 30, 60].map((duration) => ({
    value: duration * 60,
    label: t(
      duration === 1 ? 'common:minuteWithValue' : 'common:minutesWithValue',
      { value: duration },
    ),
  }));
  type DurationChoice = (typeof options)[number];
  return (
    <>
      <Checkbox
        css={styles.label}
        checked={!disabled}
        onChange={() => setDisabled(!disabled)}
        label={t('keyboard:dimRGBWhenAFK')}
      />
      <SecondarySelect<DurationChoice>
        value={options.find((option) => option.value === timeoutSeconds)}
        defaultValue={options[3]}
        onChange={(option) => {
          if (option) setTimeoutSeconds(option.value);
        }}
        options={options}
        isDisabled={disabled}
        maxMenuHeight={160}
        styles={getSecondaryStyles<
          DurationChoice,
          false,
          GroupBase<DurationChoice>
        >(theme)}
      />
    </>
  );
});

/** A partial physical selection scales RGB palettes; the firmware master remains a separate control.
 * Keep each drag's original palette so repeated slider commits do not compound the scaling.
 */
export const KeyboardLightingSettings = observer(
  function KeyboardLightingSettings({
    keyboardDeviceProfile: profile,
  }: LightingSettingsProps) {
    const theme = useTheme(),
      styles = lightingSettingsStyles(theme),
      { t } = useTranslation();
    const layer = useKeyboardViewState().keyboard.selectedEffectLayer;
    const selected = profile.selected;
    const scoped =
      selected.length > 0 &&
      selected.length < 88 &&
      !profile.isPerimeterSelected;
    const reactive = layer === 'Reactive';
    const name = reactive ? 'reactiveZones' : 'baseZones';
    const settings = profile.activeProfile.settings;
    const zones = getSnapshot(settings[name]);
    const fingerprint = JSON.stringify(zones);
    const identity = `${profile.activeProfile.id}:${name}:${[...selected].sort((a, b) => a - b).join(',')}`;
    const session = useRef<BrightnessSession | null>(null);
    const [, refresh] = useState(0);
    if (
      !session.current ||
      session.current.identity !== identity ||
      session.current.fingerprint !== fingerprint
    ) {
      let value = 1,
        error: string | null = null;
      if (scoped) {
        try {
          value = inspect(zones, selected);
        } catch (failure) {
          error = failure instanceof Error ? failure.message : String(failure);
        }
      }
      session.current = { identity, fingerprint, zones, value, error };
    }
    const context = session.current;
    const keyBrightness = profile.keyBrightness,
      perimeterBrightness = profile.perimeterBrightness;
    const changeKeys = (level: number) => {
      if (!scoped) {
        profile.setKeyBrightness(level, { fromDevice: false });
        return;
      }
      try {
        const adjusted = adjust(
          context.zones,
          selected,
          level,
          reactive ? 2 : 10,
        );
        // The palette helper returns wire-shaped JSON; validate against the actual destination model.
        if (reactive)
          settings.setReactiveZones(
            adjusted.map((zone) => {
              if (!KeyboardReactiveZone.is(zone))
                throw Error('Invalid reactive lighting group.');
              return zone;
            }),
          );
        else
          settings.setBaseZones(
            adjusted.map((zone) => {
              if (!KeyboardBaseZone.is(zone))
                throw Error('Invalid base lighting group.');
              return zone;
            }),
          );
        context.fingerprint = JSON.stringify(getSnapshot(settings[name]));
        context.value = level;
        context.error = null;
      } catch (failure) {
        context.error =
          failure instanceof Error ? failure.message : String(failure);
      }
      refresh((value) => value + 1);
    };
    recordKeyBrightnessControl({
      apply: changeKeys,
      selected: scoped,
      keys: [...selected],
      layer,
    });
    return (
      <div css={styles.container}>
        <h1 css={styles.title}>{t('keyboard:brightnessSettings')}</h1>
        <KeyboardIdleLighting keyboardDeviceProfile={profile} />
        <div data-testid="key-brightness">
          {keyBrightness !== undefined && (
            <SliderWithTickValues
              label={scoped ? 'Selected key brightness' : 'All key brightness'}
              disabled={scoped && !!context.error}
              tickValues={['0%', '100%']}
              labelVariant="ALT"
              min={0}
              max={1}
              step={0.01}
              value={scoped ? context.value : keyBrightness}
              onAfterChange={changeKeys}
              unit="%"
              formatTooltipValue={(value) => Math.floor(100 * value)}
            />
          )}
        </div>
        {scoped && context.error && <p role="status">{context.error}</p>}
        {perimeterBrightness !== undefined && (
          <SliderWithTickValues
            label={t('keyboard:perimeterBrightness')}
            labelVariant="ALT"
            tickValues={['0%', '100%']}
            min={0}
            max={1}
            step={0.01}
            value={perimeterBrightness}
            unit="%"
            onAfterChange={(value) =>
              profile.setPerimeterBrightness(value, { fromDevice: false })
            }
            formatTooltipValue={(value) => Math.floor(100 * value)}
          />
        )}
      </div>
    );
  },
);
