/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import {
  useEffect,
  useMemo,
  useRef,
  type ChangeEventHandler,
  type FocusEventHandler,
  type ReactNode,
} from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { Redirect, useHistory } from 'react-router';
import { useDrop } from 'react-dnd';
import { throttle } from 'lodash';
import { Header } from '../../components/Header.js';
import { SecondaryButton } from '../../components/Button.js';
import { useKeyboardViewState } from '../../models/useKeyboardViewState.js';
import { useMacroRecorder } from '../../models/useMacroRecorder.js';
import type { KeyboardReadyDevice } from '../../models/deviceTypes.js';
import type { KeyRemapDeviceProfileInstance } from '../../models/KeyRemapDeviceProfile.js';
import type { RemapMacroInstance } from '../../models/RemapMacro.js';
import {
  BACKGROUND_TYPES,
  POSITION_TYPES,
  JUSTIFY_CONTENT_TYPES,
} from '../../models/Toaster.js';
import { MacroActionRow } from './MacroActionRow.js';
import { MacroRecordingButtons } from './MacroRecordingButtons.js';
import {
  getMacroScrollParent,
  MACRO_ACTION_DRAG_TYPE,
  matchedMacroPresses,
  queueMacroRemap,
  type MacroActionDragItem,
} from './macroEditorLogic.js';
import { macroEditorStyles } from './macroEditorStyles.js';
import type { MacroKeyboardInfo } from './types.js';

export interface MacroEditorOptions {
  isRecordingMacro: boolean;
  macro: RemapMacroInstance;
  onChangeMacroName: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onBlurMacroName: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  setTriggerKey: (key: number | undefined) => void;
  switchLayerToTriggerKey: (key: number, oldLayerIsFn: boolean) => void;
  triggerKey?: number;
}
export interface MacroEditorProps {
  readyDevice?: KeyboardReadyDevice;
  keyRemapDeviceProfile: KeyRemapDeviceProfileInstance;
  isFnLayer?: boolean;
  backRoute: string;
  keyboardInfo?: MacroKeyboardInfo;
  ignoreMouseEvents?: boolean;
  children: (options: MacroEditorOptions) => ReactNode;
}

/** The recorder owns host capture; this screen owns notifications, edit commits and recording/scroll cleanup. */
export const MacroEditor = observer(function MacroEditor({
  readyDevice: device,
  keyRemapDeviceProfile: profile,
  isFnLayer = false,
  backRoute,
  keyboardInfo,
  ignoreMouseEvents,
  children,
}: MacroEditorProps) {
  const styles = macroEditorStyles(useTheme()),
    { t } = useTranslation(['macro']);
  const { toaster, keyboard } = useKeyboardViewState(),
    recorder = useMacroRecorder(),
    history = useHistory();
  const header = useRef<HTMLDivElement>(null),
    actions = useRef<HTMLDivElement>(null),
    buttons = useRef<HTMLDivElement>(null);
  const editing = profile.editingMacro,
    macro = editing?.remapTo,
    physicalKey = editing?.physicalKey;
  const count = macro?.action.targetKeys.length ?? 0,
    maxActions = macro?.didReachMaxMacroActions ?? false;
  const recording = recorder.isRecording,
    isNew = keyboard.isNewMacro,
    dragging = profile.isDraggingMacro;
  const commit = () => queueMacroRemap(profile, physicalKey, isFnLayer);
  const stop = () => {
    recorder.endMacroRecording();
    toaster.hideToaster();
  };
  const toggleRecording = () => {
    if (recording) {
      stop();
      return;
    }
    recorder.startMacroRecording(
      (events) => {
        if (macro && !macro.tryAddAction(events)) stop();
      },
      (index, delayMs) =>
        macro?.getAction(index)?.setDelaySeconds(delayMs / 1000),
      count - 1,
      {
        validTimeoutRange:
          device?.capabilityData.keyRemap.validMacroActionTargetKeyTimeoutRange,
        onError: (error) =>
          toaster.showToaster({
            message: t(`recordingError-${error.message.split(':')[0]}`),
            backgroundType: BACKGROUND_TYPES.INFO,
            positionType: POSITION_TYPES.FIXED,
            showCloseButton: false,
          }),
        onEnd: commit,
        ignoreMouseEvents,
      },
    );
    toaster.showToaster({
      message: t('macroRecordingInProgress'),
      backgroundType: BACKGROUND_TYPES.ALERT,
      positionType: POSITION_TYPES.FIXED,
      showCloseButton: false,
      justifyContent: JUSTIFY_CONTENT_TYPES.CENTER,
    });
  };
  useEffect(() => {
    header.current?.scrollIntoView({ behavior: 'instant' });
    return () => {
      recorder.endMacroRecording();
      toaster.hideToaster();
    };
  }, [recorder, toaster]);
  useEffect(() => {
    if (recording && count > 0)
      buttons.current?.scrollIntoView({ behavior: 'instant' });
  }, [count, recording]);
  useEffect(() => {
    if (maxActions && !recording)
      toaster.showToaster({
        message: t('unableToAddMoreItemsToThisMacroRecordingHasStopped'),
        backgroundType: BACKGROUND_TYPES.INFO,
        positionType: POSITION_TYPES.FIXED,
        showCloseButton: true,
        justifyContent: JUSTIFY_CONTENT_TYPES.CENTER,
      });
    else if (!maxActions && !recording) toaster.hideToaster();
  }, [maxActions, recording]);
  const scroll = useMemo(
    () =>
      throttle(
        (speed: number) => {
          getMacroScrollParent(actions.current?.parentNode ?? null)?.scrollBy({
            top: speed,
            behavior: 'auto',
          });
        },
        16,
        { leading: true },
      ),
    [],
  );
  useEffect(() => () => scroll.cancel(), [scroll]);
  useEffect(() => {
    if (!dragging) scroll.cancel();
  }, [dragging, scroll]);
  const [, drop] = useDrop<MacroActionDragItem, void, unknown>({
    accept: MACRO_ACTION_DRAG_TYPE,
    hover(_item, monitor) {
      const offset = monitor.getClientOffset(),
        parent = getMacroScrollParent(actions.current?.parentNode ?? null);
      if (!offset || !parent || recording) return;
      const rect = parent.getBoundingClientRect();
      if (!rect.height) return;
      const middle = rect.top + rect.height / 2,
        modifier = ((offset.y - middle) / (rect.height / 2)) ** 2;
      if (offset.y < middle) scroll(-10 * modifier);
      else if (offset.y > middle) scroll(10 * modifier);
    },
    drop() {
      scroll.cancel();
    },
  });
  drop(actions);
  if (!macro || !device) return <Redirect push to={backRoute} />;
  const matched = matchedMacroPresses(macro.action.targetKeys);
  const clear = () => {
    macro.clearActions();
    if (
      physicalKey !== undefined &&
      profile.activeProfile?.physicalKeys.has(String(physicalKey))
    )
      profile.resetMacroPhysicalKey(macro.id, isFnLayer);
  };
  const add = () => {
    if (!macro.didReachMaxMacroActions) {
      macro.addDefaultActionPair();
      commit();
    }
  };
  const options: MacroEditorOptions = {
    isRecordingMacro: recording,
    macro,
    triggerKey: physicalKey,
    onChangeMacroName: (event) => {
      macro.setName(event.currentTarget.value);
      profile.storeHardwareMacroInfo(
        event.currentTarget.value,
        macro.id,
        physicalKey,
        0,
        isFnLayer,
      );
    },
    onBlurMacroName: (event) => {
      if (!/^(?!\s*$).+/.test(event.currentTarget.value)) {
        const name = t('macro');
        macro.setName(name);
        profile.storeHardwareMacroInfo(
          name,
          macro.id,
          physicalKey,
          0,
          isFnLayer,
        );
      }
    },
    setTriggerKey: (key) =>
      key === undefined
        ? profile.resetMacroPhysicalKey(macro.id, isFnLayer)
        : profile.updateMacroPhysicalKey(macro.id, key, 0, isFnLayer),
    switchLayerToTriggerKey: (key, oldFn) =>
      profile.switchMacroPhysicalKeyLayer(macro.id, key, oldFn),
  };
  // Run the render prop within this observer so option/name/action reads remain subscribed.
  const optionControls = children(options);
  const buttonProps = {
    recorder,
    isRecordingMacro: recording,
    isMaxActions: maxActions,
    ignoreMouseEvents,
    onClickAddFunction: add,
    onClickRecordFunctions: toggleRecording,
  };
  return (
    <div css={styles.container}>
      <ClassNames>
        {({ css }) => (
          <div ref={header}>
            <Header
              contentClassName={css(styles.headerContent)}
              backTo={backRoute}
              sideEffect={stop}
              title={t(isNew ? 'addMacro' : 'editMacro')}
            >
              <SecondaryButton
                css={styles.deleteMacrosButton}
                disabled={recording}
                onClick={() => {
                  history.push(backRoute);
                  profile.deleteMacro(macro.id, isFnLayer);
                }}
              >
                {t('deleteMacro')}
              </SecondaryButton>
            </Header>
          </div>
        )}
      </ClassNames>
      {optionControls}
      <div css={styles.macroFunctionsContainer}>
        {count === 0 ? (
          <div css={styles.subContainerFullHeight}>
            <h2 css={styles.sectionTitle}>{t('macroFunctions')}</h2>
            <div css={styles.selfCenter}>
              <h3 css={styles.subsectionTitle}>
                {t(recording ? 'macroRecordingInProgress' : 'noFunctionsSaved')}
              </h3>
              <h4 css={styles.subsectionDescription}>
                {t(
                  recording
                    ? 'enterKeystrokesToRecordMacroFunctions'
                    : 'getStartedByAddingRecordingFunctionsBelow',
                )}
              </h4>
              <div>
                <MacroRecordingButtons {...buttonProps} />
              </div>
            </div>
          </div>
        ) : (
          <div css={styles.subContainer}>
            <h2 css={styles.sectionTitle}>{t('macroFunctions')}</h2>
            <div css={styles.macroLabels}>
              <div css={styles.label}>{t('macroAction')}</div>
              <div css={styles.delayLabel}>{t('macroDelay')}</div>
            </div>
            <div css={styles.actionsContainer} ref={actions}>
              {macro.action.targetKeys.map((event, index) => (
                <MacroActionRow
                  key={`${event.targetKeyId}-${index}`}
                  backRoute={backRoute}
                  keyboardInfo={keyboardInfo}
                  isRecordingMacro={recording}
                  device={device}
                  keyRemapDeviceProfile={profile}
                  macroEvent={event}
                  isFnLayer={isFnLayer}
                  index={index}
                  noReleaseEvent={!matched.has(index)}
                />
              ))}
            </div>
            <div ref={buttons}>
              <MacroRecordingButtons
                {...buttonProps}
                onCleanMacroFunctions={clear}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
