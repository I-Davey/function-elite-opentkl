/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { SegmentedPicker } from '../../components/SegmentedPicker.js';
import { useKeyboardViewState } from '../../models/useKeyboardViewState.js';
import { KeyboardEffectLayer } from '../../models/lightingConstants.js';
import { BACKGROUND_TYPES, POSITION_TYPES } from '../../models/Toaster.js';
import {
  KeyboardLightingLayerControls,
  type KeyboardLightingProps,
} from './KeyboardLightingLayerControls.js';
import { KeyboardLightingSettings } from './KeyboardLightingSettings.js';
import { lightingControlStyles } from './lightingStyles.js';

/** Two lighting columns share the existing profile model and its zone-limit notifications. */
export const KeyboardLightingControls = observer(
  function KeyboardLightingControls(props: KeyboardLightingProps) {
    const { keyboardDeviceProfile: profile } = props;
    const theme = useTheme(),
      styles = lightingControlStyles(theme),
      { t } = useTranslation();
    const { keyboard, toaster } = useKeyboardViewState();
    const { selectedEffectLayer, setSelectedEffectLayer } = keyboard;
    const {
      deniedBaseZoneMax,
      deniedReactiveZoneMax,
      setDenyBaseZoneMax,
      setDenyReactiveZoneMax,
    } = profile.activeProfile;
    const message = useMemo(
      () => ({
        message: t(
          'keyboard:unableToCreateMoreLightingZonesPleaseModifyOrRemoveExistingZones',
        ),
        backgroundType: BACKGROUND_TYPES.INFO,
        positionType: POSITION_TYPES.FIXED,
        showCloseButton: true,
      }),
      [t],
    );
    useEffect(() => {
      if (deniedBaseZoneMax)
        toaster.showToaster({
          ...message,
          onClose: () => setDenyBaseZoneMax(false),
        });
      else toaster.hideToaster();
    }, [deniedBaseZoneMax, setDenyBaseZoneMax, toaster, message]);
    useEffect(() => {
      if (deniedReactiveZoneMax)
        toaster.showToaster({
          ...message,
          onClose: () => setDenyReactiveZoneMax(false),
        });
      else toaster.hideToaster();
    }, [deniedReactiveZoneMax, setDenyReactiveZoneMax, toaster, message]);
    const perimeter = profile.isPerimeterSelected;
    const options = perimeter
      ? [
          {
            label: t('keyboard:perimeter'),
            onClick: () => {},
            isSelected: true,
          },
        ]
      : [
          {
            label: t('keyboard:base'),
            onClick: () => setSelectedEffectLayer(KeyboardEffectLayer.Base),
            isSelected: selectedEffectLayer === KeyboardEffectLayer.Base,
          },
          {
            label: t('keyboard:reactive'),
            onClick: () => setSelectedEffectLayer(KeyboardEffectLayer.Reactive),
            isSelected: selectedEffectLayer === KeyboardEffectLayer.Reactive,
          },
        ];
    return (
      <div css={styles.container}>
        <div css={styles.section}>
          <SegmentedPicker options={options} />
          <KeyboardLightingLayerControls {...props} />
        </div>
        <div css={styles.section}>
          <KeyboardLightingSettings keyboardDeviceProfile={profile} />
        </div>
      </div>
    );
  },
);
