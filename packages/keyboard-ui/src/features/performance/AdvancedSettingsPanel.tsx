/** @jsxImportSource @emotion/react */
import { observer } from 'mobx-react';
import { Checkbox } from '../../components/Checkbox.js';

export interface KeyboardLockSettings {
  readonly fnLockEnabled: boolean;
  readonly gameModeEnabled: boolean;
  setFnLockEnabled(enabled: boolean): void;
  setGameModeEnabled(enabled: boolean, options: { fromDevice: boolean }): void;
}

export interface AdvancedSettingsPanelProps {
  settings: KeyboardLockSettings;
  disableFnLabel: string;
  gameModeLabel: string;
}

/** Fn lock and game mode use the existing profile actions and transaction path.
 * Labels are translated by the owning screen; this control owns no global store.
 */
export const AdvancedSettingsPanel = observer(function AdvancedSettingsPanel({
  settings, disableFnLabel, gameModeLabel,
}: AdvancedSettingsPanelProps) {
  return (
    <div css={{ display: 'flex', flexDirection: 'column', gap: 16,
      '@media (max-width: 1250px)': { minWidth: 250 } }}>
      <div css={{ display: 'flex', flexDirection: 'row', gap: 16, width: '100%',
        '@media (max-width: 1180px)': { flexDirection: 'column' } }}>
        <Checkbox
          label={disableFnLabel}
          checked={settings.fnLockEnabled}
          css={{ '& > span': { whiteSpace: 'nowrap' } }}
          onChange={() => settings.setFnLockEnabled(!settings.fnLockEnabled)}
        />
        <Checkbox
          label={gameModeLabel}
          checked={settings.gameModeEnabled}
          css={{ '& > span': { whiteSpace: 'nowrap' } }}
          onChange={() => settings.setGameModeEnabled(!settings.gameModeEnabled, { fromDevice: false })}
        />
      </div>
    </div>
  );
});
