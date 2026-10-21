/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../../components/Checkbox.js';
import { Tooltip } from '../../components/Tooltip.js';
import { InfoIcon } from '../../components/icons/InfoIcon.js';
import { KeyboardKeyCodes } from '../../layouts/keyboardKeys.js';
import { BottomMode, ResolutionMethod } from '../../models/keyboardEnums.js';
import type { PhysicalKeyInstance } from '../../models/KeyRemapSettings.js';
import { colors } from '../../theme/colors.js';
import type { KeyboardTheme } from '../../theme/types.js';
import { snapOverrideStyles } from './performanceStyles.js';
import type { PerformanceProps } from './types.js';

type SnapKey = 'A' | 'D';
/** Original three-layer A/D status glyph, independent of device input reporting. */
export function SnapKeyPreview({
  size: { width, height },
  primaryKey,
  secondaryKey,
  pressed,
  theme,
}: {
  size: { width: number; height: number };
  primaryKey: SnapKey;
  secondaryKey: SnapKey;
  pressed: Record<SnapKey, boolean>;
  theme: KeyboardTheme;
}) {
  const down = pressed[primaryKey],
    otherDown = pressed[secondaryKey];
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="2.5636"
        y="2.33704"
        width="51.5518"
        height="51.5518"
        rx="4.98889"
        fill={`${down ? theme.keyboard.snapOverrideFirstRectPressed : theme.keyboard.snapOverrideFirstRect}`}
        strokeWidth="3.32593"
      />
      <rect
        x="8.98828"
        y="8.98901"
        width="38.2481"
        height="36.5852"
        rx="3.32593"
        fill={`${down ? theme.keyboard.snapOverrideSecondRectPressed : theme.keyboard.snapOverrideSecondRect}`}
      />
      {(down || otherDown) && (
        <rect
          opacity="0.7"
          x="4"
          y="4"
          width="48.2259"
          height="48.2259"
          rx="3.32593"
          fill={`${down ? theme.keyboard.snapOverrideThirdRectPressed : theme.keyboard.snapOverridesThirdRect}`}
        />
      )}
      <text textAnchor="middle">
        <tspan
          x="27.5"
          y="32.5"
          fill={`${down || otherDown ? colors.white : theme.keyboard.snapOverrideFontColor}`}
          fontWeight="700"
        >
          {primaryKey}
        </tspan>
      </text>
      <rect x="3.5" y="3.5" width="49.2259" height="49.2259" rx="3.82593" stroke="white" />
    </svg>
  );
}
export function canSnapOverride(key: PhysicalKeyInstance | undefined) {
  if (key?.active.kind !== 'Single') return false;
  const target = key.active.remapTo;
  return (
    target.kind !== 'Modifier' &&
    !(target.kind === 'SimpleRemap' && key.physicalKey !== target.targetKeyId)
  );
}
/** Retain A/D availability, configuration replacement and the original DOM-key illustration. */
export const SnapOverrides = observer(function SnapOverrides({
  keyRemapDeviceProfile: remaps,
}: Pick<PerformanceProps, 'keyRemapDeviceProfile'>) {
  const [open, setOpen] = useState(false),
    [pressed, setPressed] = useState({ A: false, D: false });
  const active = remaps.activeProfile;
  const available =
    canSnapOverride(active?.physicalKeys.get(String(KeyboardKeyCodes.A))) &&
    canSnapOverride(active?.physicalKeys.get(String(KeyboardKeyCodes.D)));
  const theme = useTheme(),
    styles = snapOverrideStyles(theme, available),
    { t } = useTranslation();
  const enabled = active?.snapOverrideConfigs.some(
    (config) =>
      [config.physicalKey1, config.physicalKey2].includes(KeyboardKeyCodes.A) &&
      [config.physicalKey1, config.physicalKey2].includes(KeyboardKeyCodes.D),
  );
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'KeyA') setPressed((previous) => ({ ...previous, A: true }));
      if (event.code === 'KeyD') setPressed((previous) => ({ ...previous, D: true }));
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'KeyA') setPressed((previous) => ({ ...previous, A: false }));
      if (event.code === 'KeyD') setPressed((previous) => ({ ...previous, D: false }));
    };
    if (available) {
      document.addEventListener('keydown', down);
      document.addEventListener('keyup', up);
    }
    return () => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
    };
  }, [available]);
  return (
    <div css={styles.container}>
      <div css={styles.title}>
        <Checkbox
          css={styles.checkbox}
          disabled={!available}
          label={t('keyboard:snapOverrides')}
          checked={enabled}
          onChange={() =>
            remaps.updateSnapOverrideConfigs(
              enabled
                ? []
                : [
                    {
                      physicalKey1: KeyboardKeyCodes.A,
                      physicalKey2: KeyboardKeyCodes.D,
                      bottomMode: BottomMode.EitherOne,
                      resolutionMethod: ResolutionMethod.LastPressed,
                    },
                  ],
            )
          }
        />
        <ClassNames>
          {({ css }) => (
            <Tooltip
              open={open}
              onRequestClose={() => setOpen(false)}
              tooltip={t(
                available ? 'keyboard:snapOverridesInfo' : 'keyboard:snapOverridesInfoUnavailable',
              )}
              innerClassName={css(styles.tooltipInner)}
              containerClassName={css({ marginRight: 'auto' })}
              containerType="html"
              placement="top-start"
              offset={[0, 6]}
            >
              <InfoIcon
                css={styles.infoIcon}
                onMouseLeave={() => setOpen(false)}
                onMouseOver={() => setOpen(true)}
              />
            </Tooltip>
          )}
        </ClassNames>
      </div>
      <p css={styles.description}>{t('keyboard:snapOverridesDescription')}</p>
      <div css={styles.previewKeys}>
        <SnapKeyPreview
          primaryKey="A"
          secondaryKey="D"
          pressed={pressed}
          size={{ width: 40, height: 40 }}
          theme={theme}
        />
        <SnapKeyPreview
          primaryKey="D"
          secondaryKey="A"
          pressed={pressed}
          size={{ width: 40, height: 40 }}
          theme={theme}
        />
      </div>
    </div>
  );
});
