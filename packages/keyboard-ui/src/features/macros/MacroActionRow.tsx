/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { Redirect } from 'react-router';
import { useDrag, useDrop } from 'react-dnd';
import { HandleIcon } from '../../components/icons/HandleIcon.js';
import { Warning2Icon } from '../../components/icons/Warning2Icon.js';
import { CloseXIcon } from '../../components/icons/CloseXIcon.js';
import { Tooltip } from '../../components/Tooltip.js';
import { SecondarySelect } from '../../components/Select.js';
import { TextField } from '../../components/TextField.js';
import { SecondaryShimlessButton } from '../../components/Button.js';
import type { KeyboardReadyDevice } from '../../models/deviceTypes.js';
import type { KeyRemapDeviceProfileInstance } from '../../models/KeyRemapDeviceProfile.js';
import type { MacroActionTargetKeyInstance } from '../../models/RemapMacro.js';
import {
  getValidMacroTargetKeysForDevice,
  getKeyById,
} from '../../models/remapKeyUtils.js';
import { TargetKeyState } from '../../models/keyboardEnums.js';
import { MACRO_DELAY_MINIMUM } from '../../models/macroConstants.js';
import { getKeyInfo } from '../../layouts/keyInfo.js';
import { macroActionStyles } from './macroEditorStyles.js';
import {
  MACRO_ACTION_DRAG_TYPE,
  clampMacroDelay,
  queueMacroRemap,
  type MacroActionDragItem,
} from './macroEditorLogic.js';
import type { MacroKeyboardInfo } from './types.js';

export interface MacroActionRowProps {
  isRecordingMacro: boolean;
  macroEvent: MacroActionTargetKeyInstance;
  index: number;
  device: KeyboardReadyDevice;
  keyRemapDeviceProfile: KeyRemapDeviceProfileInstance;
  noReleaseEvent: boolean;
  keyboardInfo?: MacroKeyboardInfo;
  backRoute: string;
  isFnLayer: boolean;
}

/** Editable stored transition; display delays in milliseconds and notify only at the retained commit points. */
export const MacroActionRow = observer(function MacroActionRow({
  isRecordingMacro: recording,
  macroEvent,
  index,
  device,
  keyRemapDeviceProfile: profile,
  noReleaseEvent,
  keyboardInfo,
  backRoute,
  isFnLayer,
}: MacroActionRowProps) {
  const styles = macroActionStyles(useTheme()),
    { t } = useTranslation(['macro']);
  const row = useRef<HTMLDivElement>(null),
    [warningOpen, setWarningOpen] = useState(false);
  const editing = profile.editingMacro,
    macro = editing?.remapTo,
    physicalKey = editing?.physicalKey;
  const dragging = profile.isDraggingMacro;
  const targetKey = macroEvent.targetKeyId,
    state = macroEvent.state,
    delaySeconds = macroEvent.delaySeconds;
  const showWarning = !dragging && noReleaseEvent && state === 'Pressed';
  const range =
    device.capabilityData.keyRemap.validMacroActionTargetKeyTimeoutRange;
  const commit = () => queueMacroRemap(profile, physicalKey, isFnLayer);
  useEffect(() => {
    if (!dragging) setWarningOpen(false);
  }, [dragging]);
  const [, drop] = useDrop<MacroActionDragItem, void, unknown>({
    accept: MACRO_ACTION_DRAG_TYPE,
    hover(item, monitor) {
      if (!row.current || !macro || recording || item.index === index) return;
      const offset = monitor.getClientOffset();
      if (!offset) return;
      const rect = row.current.getBoundingClientRect(),
        middle = (rect.bottom - rect.top) / 2;
      const relativeY = offset.y - rect.top;
      if (
        (item.index < index && relativeY < middle) ||
        (item.index > index && relativeY > middle)
      )
        return;
      macro.moveAction(item.index, index);
      commit();
      item.index = index;
    },
  });
  const [{ isDragging }, drag, preview] = useDrag<
    MacroActionDragItem,
    void,
    { isDragging: boolean }
  >({
    item: { type: MACRO_ACTION_DRAG_TYPE, index },
    canDrag: !recording,
    begin: () => {
      profile.setIsDraggingMacro(true);
    },
    end: () => {
      profile.setIsDraggingMacro(false);
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });
  drop(preview(row));
  const options = getValidMacroTargetKeysForDevice(device).map((key) => ({
    value: key.keyId,
    label: keyboardInfo
      ? getKeyInfo(key.keyId, keyboardInfo.layout, keyboardInfo.region)
          .activationKeyText
      : (key.name ?? getKeyById(key.keyId)?.name ?? 'Unknown'),
  }));
  const states = Object.values(TargetKeyState).map((value) => ({
    value,
    label: value,
  }));
  if (!macro) return <Redirect push to={backRoute} />;
  return (
    <ClassNames>
      {({ css }) => (
        <div
          ref={row}
          css={styles.macroAction}
          style={{ opacity: isDragging ? 0.5 : 1 }}
        >
          <div
            ref={(element) => {
              drag(element);
            }}
            css={styles.handleContainer}
          >
            {!showWarning ? (
              <HandleIcon
                css={styles.handle}
                className={recording ? 'disabled' : undefined}
              />
            ) : (
              <Tooltip
                open={warningOpen}
                onRequestClose={() => setWarningOpen(false)}
                tooltip={t('macroActionWithoutRelease')}
                innerClassName={css(styles.tooltipInner)}
                containerType="html"
                placement="top-start"
                offset={[0, 6]}
              >
                <Warning2Icon
                  css={styles.warningIcon}
                  className={recording ? 'disabled' : undefined}
                  onClick={() => {
                    setWarningOpen(false);
                    if (!macro.didReachMaxMacroActions) {
                      macro.addReleaseAction(targetKey);
                      commit();
                    }
                  }}
                  onMouseLeave={() => setWarningOpen(false)}
                  onMouseOver={() => setWarningOpen(true)}
                />
              </Tooltip>
            )}
          </div>
          <div css={styles.selectContainer}>
            <SecondarySelect
              value={options.find((option) => option.value === targetKey)}
              className={css(styles.actionSelect)}
              onChange={(option) => {
                if (option)
                  macro.getAction(index)?.setTargetKeyId(option.value);
                commit();
              }}
              options={options}
              isSearchable
              isDisabled={recording}
            />
          </div>
          <div css={styles.selectContainerKeyState}>
            <SecondarySelect
              value={{ value: state, label: state }}
              className={css(styles.actionSelect)}
              onChange={(option) => {
                if (option) macro.getAction(index)?.setState(option.value);
                commit();
              }}
              options={states}
              isDisabled={recording}
            />
          </div>
          <div css={styles.textFieldContainer}>
            <TextField
              value={delaySeconds * 1000}
              type="number"
              label=""
              onChange={(event) => {
                const value = parseFloat(event.currentTarget.value);
                if (Number.isNaN(value)) return;
                macro
                  .getAction(index)
                  ?.setDelaySeconds(
                    (value < MACRO_DELAY_MINIMUM
                      ? value
                      : clampMacroDelay(value)) / 1000,
                  );
              }}
              onBlur={(event) => {
                const value = parseFloat(event.currentTarget.value);
                macro
                  .getAction(index)
                  ?.setDelaySeconds(
                    clampMacroDelay(
                      Number.isFinite(value) ? value : delaySeconds * 1000,
                    ) / 1000,
                  );
                commit();
              }}
              step={range.stepSeconds * 1000}
              min={range.minSeconds * 1000}
              max={range.maxSeconds * 1000}
              className={css(styles.numberField)}
              inputClassName={css(styles.numberFieldText)}
              unit={t('ms')}
              disabled={recording}
            />
          </div>
          <div css={styles.iconContainer}>
            <SecondaryShimlessButton
              css={styles.closeContainer}
              disabled={recording}
              onClick={() => {
                macro.deleteAction(index);
                if (macro.action.targetKeys.length === 0)
                  profile.resetMacroPhysicalKey(macro.id, isFnLayer);
                commit();
              }}
            >
              <CloseXIcon css={styles.xIcon} />
            </SecondaryShimlessButton>
          </div>
        </div>
      )}
    </ClassNames>
  );
});
