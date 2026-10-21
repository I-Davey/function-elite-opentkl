/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { useState } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import type { GroupBase } from 'react-select';
import { KeyboardRegion, ISO_KeyboardRegions } from '../../models/KeyboardRegion.js';
import { Tooltip } from '../../components/Tooltip.js';
import { InfoIcon } from '../../components/icons/InfoIcon.js';
import { PrimarySelect } from '../../components/Select.js';
import { getSecondaryStyles } from '../../components/selectStyles.js';
import { zIndex } from '../../theme/layers.js';
import { ActuationSettingPanel } from './ActuationSettingPanel.js';
import { ActuationPresetsPanel } from './ActuationPresetsPanel.js';
import { SnapOverrides } from './SnapOverrides.js';
import { PollingRateSlider } from './PollingRateSlider.js';
import { AdvancedSettingsPanel } from './AdvancedSettingsPanel.js';
import { performanceControlStyles } from './performanceStyles.js';
import type { PerformanceProps } from './types.js';

/** Performance composition uses the linked remap model; transactions still belong to the renderer. */
export const KeyboardPerformanceControls = observer(function KeyboardPerformanceControls({
  readyKeyboardDevice: device,
  keyboardDeviceProfile: profile,
}: Omit<PerformanceProps, 'keyRemapDeviceProfile'>) {
  const theme = useTheme(),
    styles = performanceControlStyles(theme),
    { t } = useTranslation();
  const [pollingInfo, setPollingInfo] = useState(false),
    [presetInfo, setPresetInfo] = useState(false);
  if (!device.capabilityData.uniqueId.id)
    throw Error(`${device.deviceType}: Device uniqueId is not available`);
  const remaps = profile.keyremapProfile;
  if (!remaps) throw Error(`${device.deviceType}: Keyboard remap profile is not available`);
  const props = {
    readyKeyboardDevice: device,
    keyboardDeviceProfile: profile,
    keyRemapDeviceProfile: remaps,
  };
  const hasRegions = device.capabilityData.physicalKeys?.physicalKeysLayout?.layout === 'ISO';
  const regions = Object.values(KeyboardRegion)
    .filter((value) => ISO_KeyboardRegions.has(value))
    .map((value) => ({ value, label: t(`keyboard:keyboardRegion-${value}`) }));
  const region = profile.keyboardRegion;
  type RegionOption = (typeof regions)[number];
  return (
    <div css={styles.container}>
      <div css={styles.title}>{t('keyboard:actuation')}</div>
      <div css={styles.section}>
        <div>
          <ActuationSettingPanel {...props} />
        </div>
        <div>
          <div css={styles.title}>
            {t('keyboard:performancePresets')}
            <ClassNames>
              {({ css }) => (
                <Tooltip
                  open={presetInfo}
                  onRequestClose={() => setPresetInfo(false)}
                  tooltip={t('keyboard:performancePresetsInfo')}
                  innerClassName={css(styles.tooltipInner)}
                  containerClassName={css({ marginRight: 'auto' })}
                  containerType="html"
                  placement="top-start"
                  offset={[0, 6]}
                >
                  <InfoIcon
                    css={styles.infoIcon}
                    onMouseLeave={() => setPresetInfo(false)}
                    onMouseOver={() => setPresetInfo(true)}
                  />
                </Tooltip>
              )}
            </ClassNames>
          </div>
          <ActuationPresetsPanel {...props} />
        </div>
      </div>
      <div css={styles.title}>{t('keyboard:advancedSettings')}</div>
      <div css={styles.section}>
        <div>
          <SnapOverrides keyRemapDeviceProfile={remaps} />
        </div>
        <div>
          {device.supportedCapabilities.pollingRate && (
            <>
              <div css={styles.title}>
                {t('keyboard:pollingRate')}
                <ClassNames>
                  {({ css }) => (
                    <Tooltip
                      open={pollingInfo}
                      onRequestClose={() => setPollingInfo(false)}
                      tooltip={t('keyboard:pollingRateInfo')}
                      innerClassName={css(styles.tooltipInner)}
                      containerType="html"
                      placement="top-start"
                      offset={[0, 6]}
                    >
                      <div
                        css={styles.moreInfo}
                        onMouseOver={() => setPollingInfo(true)}
                        onMouseLeave={() => setPollingInfo(false)}
                      >
                        {t('keyboard:moreInfo')}
                      </div>
                    </Tooltip>
                  )}
                </ClassNames>
              </div>
              <PollingRateSlider readyKeyboardDevice={device} keyboardDeviceProfile={profile} />
              {device.supportedCapabilities.keyLock && (
                <AdvancedSettingsPanel
                  settings={profile.activeProfile.settings}
                  disableFnLabel={t('keyboard:disableFnKey')}
                  gameModeLabel={t('keyboard:gameMode')}
                />
              )}
            </>
          )}
          {hasRegions && (
            <div css={styles.keyboardRegion}>
              <div css={styles.title}>{t('keyboard:region')}</div>
              <div css={styles.regionDescription}>{t('keyboard:regionDescription')}</div>
              <ClassNames>
                {({ css }) => (
                  <PrimarySelect<RegionOption>
                    value={regions.find((option) => option.value === region)}
                    onChange={(option) => {
                      if (option) profile.setKeyboardRegion(option.value);
                    }}
                    options={regions}
                    className={css(styles.keyboardRegionSelect)}
                    styles={{
                      ...getSecondaryStyles<RegionOption, false, GroupBase<RegionOption>>(theme),
                      menuPortal: (base) => ({ ...base, zIndex: zIndex('select') }),
                    }}
                    maxMenuHeight={150}
                  />
                )}
              </ClassNames>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
