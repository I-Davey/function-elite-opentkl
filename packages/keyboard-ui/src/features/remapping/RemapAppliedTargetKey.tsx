/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../../components/Checkbox.js';
import { KeyboardKey } from '../../components/KeyboardKey.js';
import { SecondarySelect } from '../../components/Select.js';
import { SecondaryButton } from '../../components/Button.js';
import { getKeyInfo } from '../../layouts/keyInfo.js';
import {
  appliedKeyState,
  modifierOptions,
  NoModifier,
  type ModifierOption,
} from './appliedKeyState.js';
import { appliedKeyStyles } from './remapStyles.js';
import type { RemapTargetProps } from './types.js';

/** Base/Fn output labels, dual-level selection, modifier assignment and reset retain their model actions. */
export const RemapAppliedTargetKey = observer(function RemapAppliedTargetKey({
  isFnLayerSelected,
  keyRemapDeviceProfile: remaps,
  selectedKey,
  selectedLevel,
  setSelectedLevel,
  keyboardInfo,
}: Omit<RemapTargetProps, 'selectedKey'> & {
  isFnLayerSelected: boolean;
  selectedKey?: RemapTargetProps['selectedKey'];
  setSelectedLevel: (level: number) => void;
  keyboardInfo: { layout: string; region: string };
}) {
  const theme = useTheme(),
    styles = appliedKeyStyles(theme, selectedKey?.physicalKeyModel.active.kind === 'Dual'),
    { t } = useTranslation();
  if (!selectedKey)
    return (
      <div css={styles.hintText}>
        <p>{t('keyboard:nothingSelected')}</p>
      </div>
    );
  const { remapped, modifier1, modifier2, isDualEnabled, shouldHideReset } = appliedKeyState(
    selectedKey,
    isFnLayerSelected,
  );
  const key = selectedKey.physicalKeyModel,
    modifiers = [modifier1, modifier2];
  const changeModifier = (option: ModifierOption | null, level: number) => {
    if (option)
      remaps.updateSimpleRemap(
        key.physicalKey,
        key.physicalKey,
        level,
        selectedKey.isFn,
        option.value === 'None' ? undefined : option.value,
      );
  };
  const reset = () =>
    runInAction(() => {
      if (key.active.kind === 'Single')
        remaps.reserveReplacedMacro(
          selectedKey.isFn && key.active.fnPressed !== null
            ? key.active.fnPressed.remapTo
            : key.active.remapTo,
        );
      remaps.updateSimpleRemap(key.physicalKey, key.physicalKey, 0, selectedKey.isFn);
      if (isDualEnabled)
        remaps.updateSimpleRemap(key.physicalKey, key.physicalKey, 1, selectedKey.isFn);
    });
  return (
    <div css={styles.flexCenter}>
      <div css={styles.enableDual}>
        <Checkbox
          label={t('keyboard:enableDual')}
          css={styles.checkbox}
          checked={isDualEnabled}
          onChange={() => {
            setSelectedLevel(0);
            remaps.switchActuation([key], isDualEnabled ? 'Single' : 'Dual');
          }}
        />
      </div>
      <div css={styles.flexCenter}>
        <div css={styles.modifier}>
          <div style={{ gridColumn: 2 }}>{t('keyboard:modifier')}</div>
        </div>
        <div css={styles.appliedKeys}>
          {remapped.slice(0, isDualEnabled ? 2 : 1).map((code, level) => {
            const info = getKeyInfo(code, keyboardInfo.layout, keyboardInfo.region);
            return (
              <div key={level} css={styles.appliedKeyControls}>
                <div
                  className={level === 1 ? 'dual' : undefined}
                  css={styles.appliedKey}
                  onClick={() => setSelectedLevel(level)}
                >
                  <KeyboardKey
                    code={code}
                    size={{ width: 65, height: 65 }}
                    padding={5}
                    keyInfo={{
                      ...info,
                      label: info.shortLabel ?? info.label,
                      label2: info.shortLabel2,
                    }}
                    theme={theme}
                    borderColor={
                      selectedLevel === level
                        ? `#${theme.keyboard.selectedKeyText.toHex()}`
                        : undefined
                    }
                  />
                </div>
                <ClassNames>
                  {({ css }) => (
                    <SecondarySelect<ModifierOption>
                      value={
                        modifierOptions.find((option) => option.value === modifiers[level]) ??
                        NoModifier
                      }
                      options={modifierOptions}
                      onChange={(option) => changeModifier(option, level)}
                      className={css(styles.select)}
                    />
                  )}
                </ClassNames>
              </div>
            );
          })}
        </div>
        <SecondaryButton
          className={shouldHideReset ? 'hide' : undefined}
          css={styles.resetButton}
          onClick={reset}
        >
          {t('common:reset')}
        </SecondaryButton>
      </div>
    </div>
  );
});
