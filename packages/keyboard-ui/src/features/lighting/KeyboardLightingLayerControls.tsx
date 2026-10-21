/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { components, type GroupBase, type OptionProps } from 'react-select';
import { PrimarySelect } from '../../components/Select.js';
import { getSecondaryStyles } from '../../components/selectStyles.js';
import { useKeyboardViewState } from '../../models/useKeyboardViewState.js';
import {
  KeyboardEffectLayer,
  KEYBOARD_BASE_EFFECT_INFO_MAP,
  KEYBOARD_REACTIVE_EFFECT_INFO_MAP,
} from '../../models/lightingConstants.js';
import type { LightingEffectInfo } from '../../models/defaultEffects.js';
import type { KeyboardDeviceProfileInstance } from '../../models/KeyboardDeviceProfile.js';
import type { KeyboardReadyDevice } from '../../models/deviceTypes.js';
import { KeyboardLightingBaseControls } from './KeyboardLightingBaseControls.js';
import { KeyboardLightingReactiveControls } from './KeyboardLightingReactiveControls.js';
import { lightingLayerStyles } from './lightingStyles.js';

interface LightingModeChoice {
  label: string;
  value: LightingEffectInfo['effectName'];
  modeInfo: LightingEffectInfo;
}
export interface KeyboardLightingProps {
  keyboardDeviceProfile: KeyboardDeviceProfileInstance;
  readyKeyboardDevice: KeyboardReadyDevice;
}

/** Retained keyboard modes have text labels only; CAM's other-device image registry is unused. */
export function LightingModeOption(
  props: OptionProps<LightingModeChoice, false>,
) {
  return (
    <components.Option {...props}>
      <p title={props.data.label} style={{ justifySelf: 'flex-start' }}>
        {props.data.label}
      </p>
    </components.Option>
  );
}

/** Capability-filtered modes retain metadata order and always include Off. Model actions own edits. */
export const KeyboardLightingLayerControls = observer(
  function KeyboardLightingLayerControls({
    keyboardDeviceProfile: profile,
    readyKeyboardDevice: device,
  }: KeyboardLightingProps) {
    const theme = useTheme(),
      styles = lightingLayerStyles(theme),
      { t } = useTranslation();
    const { selectedEffectLayer } = useKeyboardViewState().keyboard;
    const capabilities = device.capabilityData.keyboardMouseLighting;
    const toOption = (info: LightingEffectInfo): LightingModeChoice => ({
      label: t(`keyboard:keyboardEffect-${info.effectName}`),
      value: info.effectName,
      modeInfo: info,
    });
    const optionsFor = (
      map: Record<string, LightingEffectInfo>,
      supported: readonly string[],
    ) =>
      Object.values(map)
        .filter(
          (info) =>
            supported.includes(info.effectName) || info.effectName === 'Off',
        )
        .map(toOption);
    const perimeter = profile.isPerimeterSelected;
    const reactive =
      !perimeter && selectedEffectLayer === KeyboardEffectLayer.Reactive;
    if (
      !perimeter &&
      selectedEffectLayer !== KeyboardEffectLayer.Base &&
      !reactive
    )
      return null;
    const info = perimeter
      ? profile.selectedPerimeterEffectInfo
      : reactive
        ? profile.selectedReactiveEffectInfo
        : profile.selectedBaseEffectInfo;
    const options = perimeter
      ? optionsFor(
          KEYBOARD_BASE_EFFECT_INFO_MAP,
          capabilities.supportedRingEffects.effects,
        )
      : reactive
        ? optionsFor(
            KEYBOARD_REACTIVE_EFFECT_INFO_MAP,
            capabilities.supportedReactiveEffects,
          )
        : optionsFor(
            KEYBOARD_BASE_EFFECT_INFO_MAP,
            capabilities.supportedBaseEffects,
          );
    const choice = toOption(info);
    const changeMode = (option: LightingModeChoice | null) => {
      if (!option) return;
      if (perimeter)
        profile.applyEffectsToPerimeter(
          capabilities.supportedRingEffects.ledCount,
          option.modeInfo,
        );
      else profile.applyEffectsToSelection(device, option.modeInfo);
    };
    return (
      <div css={styles.controls}>
        <div css={styles.label}>{t('keyboard:colorMode')}</div>
        <ClassNames>
          {({ css }) => (
            <PrimarySelect<LightingModeChoice>
              value={choice}
              options={options}
              onChange={changeMode}
              components={{ Option: LightingModeOption }}
              styles={getSecondaryStyles<
                LightingModeChoice,
                false,
                GroupBase<LightingModeChoice>
              >(theme)}
              className={css(styles.modeSelect)}
            />
          )}
        </ClassNames>
        {reactive ? (
          <KeyboardLightingReactiveControls
            keyboardDeviceProfile={profile}
            readyKeyboardDevice={device}
            onSelect={(settings) =>
              profile.updateReactiveEffectSettings(device, settings)
            }
          />
        ) : (
          <KeyboardLightingBaseControls
            selectedBaseEffectInfo={info}
            selectedBaseZone={
              perimeter
                ? profile.selectedPerimeterZone
                : profile.selectedBaseZone
            }
            readyKeyboardDevice={device}
            perimeter={perimeter}
            onSelect={(settings) =>
              perimeter
                ? profile.updatePerimeterEffectSettings(
                    capabilities.supportedRingEffects.ledCount,
                    settings,
                  )
                : profile.updateBaseEffectSettings(device, settings)
            }
          />
        )}
      </div>
    );
  },
);
