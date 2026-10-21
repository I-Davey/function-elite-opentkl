/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import numeral from 'numeral';
import { ACTUATION_PRESETS, type ActuationPreset } from '../../models/actuationPresets.js';
import { getValidActuationTypesForDevice } from '../../models/remapKeyUtils.js';
import { levelColorScale } from '../../models/actuationColors.js';
import type { PhysicalKeyInstance } from '../../models/KeyRemapSettings.js';
import { actuationPresetsStyles } from './performanceStyles.js';
import type { PerformanceProps } from './types.js';

/** Presets apply only to single-actuation keys; -1 disables rapid without requiring a sensitivity match. */
export const ActuationPresetsPanel = observer(function ActuationPresetsPanel({
  readyKeyboardDevice: device,
  keyboardDeviceProfile: profile,
  keyRemapDeviceProfile: remaps,
}: PerformanceProps) {
  const styles = actuationPresetsStyles(useTheme()),
    { t } = useTranslation(),
    active = remaps.activeProfile;
  const keys: PhysicalKeyInstance[] = [];
  active?.physicalKeys.forEach((key) => {
    if (key.active.kind === 'Single') keys.push(key);
  });
  const selected = (preset: ActuationPreset) => {
    const checked = new Set<number>();
    for (const custom of preset.custom) {
      checked.add(custom.code);
      const key = active?.physicalKeys.get(String(custom.code));
      if (
        key?.active.kind !== 'Single' ||
        key.active.actuation.level !== custom.level ||
        (custom.rapidSensitivity !== -1 &&
          key.active.actuation.rapidSensitivity !== custom.rapidSensitivity)
      )
        return false;
    }
    for (const key of keys) {
      if (checked.has(key.physicalKey)) continue;
      if (
        key.active.kind !== 'Single' ||
        key.active.actuation.level !== preset.baseLevel ||
        (preset.rapidSensitivity !== -1 &&
          key.active.actuation.rapidSensitivity !== preset.rapidSensitivity)
      )
        return false;
    }
    return true;
  };
  const presets = ACTUATION_PRESETS.map((preset) => ({ preset, selected: selected(preset) }));
  const {
    Single: { validLevels },
    Rapid: { validSensitivity },
  } = getValidActuationTypesForDevice(device);
  const update = (keys: PhysicalKeyInstance[], level: number, sensitivity: number) => {
    remaps.updateActuationLevel(keys, level);
    if (sensitivity >= 0) remaps.updateActuationRapid(keys, true, sensitivity);
    else remaps.updateActuationRapid(keys, false);
  };
  const apply = (preset: ActuationPreset) => {
    runInAction(() => {
      update(keys, preset.baseLevel, preset.rapidSensitivity);
      for (const custom of preset.custom) {
        const key = keys.find((key) => key.physicalKey === custom.code);
        if (key) update([key], custom.level, custom.rapidSensitivity);
      }
    });
    profile.addKeys(keys.map((key) => key.physicalKey));
  };
  return (
    <div css={styles.container}>
      {presets.map(({ preset, selected }) => (
        <div
          key={preset.id}
          className={selected ? 'selected' : undefined}
          css={styles.presetItem}
          onClick={() => apply(preset)}
        >
          <div css={styles.presetName}>{t(`keyboard:gameType-${preset.id}`)}</div>
          <div css={styles.presetValuesWrapper}>
            {(
              [
                ['base', preset.baseLevel],
                ['wasd', preset.displayed.wasdLevel],
                ['space', preset.displayed.spaceLevel],
              ] as const
            ).map(([name, level]) => (
              <div css={styles.presetValue} key={name}>
                <span className="label">{t(`keyboard:keyGroup-${name}`)}</span>
                <span className="value" style={{ color: levelColorScale(level) }}>
                  {numeral((validLevels[level] ?? 0) / 1000).format('0.00')}
                </span>
              </div>
            ))}
            <div css={styles.presetValue}>
              <span className="label">{t('keyboard:keyGroup-rapidT')}</span>
              <span className="value">
                {preset.displayed.rapidSensitivity === -1
                  ? t('common:off')
                  : numeral(
                      (validSensitivity[preset.displayed.rapidSensitivity] ?? 0) / 1000,
                    ).format('0.00')}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
