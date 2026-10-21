import { createDesktopLifecycleMirror } from './desktop-lifecycle.js';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import ReactModal from 'react-modal';
import { createMemoryHistory } from 'history';
import {
  KeyboardWorkspace,
  keyboardRoutes,
  getKeyboardTheme,
  styleCache,
  globalStyles,
} from '../../keyboard-ui/src/index.js';
import { i18n } from '../../ui-platform/src/i18n.cjs';
import { MacroKeyNames } from '../../keyboard-ui/src/models/macroKeyNames.js';
import type { KeyboardUiStores } from '../../keyboard-ui/src/models/KeyboardUiStores.js';
import { KeyboardViewState } from '../../keyboard-ui/src/models/KeyboardViewState.js';
import { KeyboardMacroEdit } from '../../keyboard-ui/src/features/macros/KeyboardMacroEdit.js';
import {
  KeyboardRows,
  KeyPreview,
  ActuationWrapper,
} from '../../keyboard-ui/src/components/KeyboardRows.js';
import { getKeyboardInfo } from '../../keyboard-ui/src/layouts/keyboardInfo.js';
import { MacroRecordStore } from '../../keyboard-ui/src/models/MacroRecordStore.js';
import { configureKeyNames } from '../../keyboard-ui/src/models/remapKeyUtils.js';
import { KeyRemapDeviceProfile } from '../../keyboard-ui/src/models/KeyRemapDeviceProfile.js';
import {
  KeyboardDeviceProfile,
  type KeyboardProfileEnvironment,
} from '../../keyboard-ui/src/models/KeyboardDeviceProfile.js';
import { createDefaultKeyboardProfile } from '../../keyboard-ui/src/models/profileDefaults.js';
import { KeyboardSettings } from '../../keyboard-ui/src/models/KeyboardSettings.js';
import { validatedSnapshot } from '../../keyboard-ui/src/models/validation.js';
import { ColorPickerStore } from '../../keyboard-ui/src/models/ColorPickerStore.js';
import { getSnapshot, onSnapshot } from 'mobx-state-tree';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { observable, reaction } from 'mobx';
import { observer, Provider } from 'mobx-react';
import { Observer } from 'mobx-react-lite';
import { CacheProvider, ThemeProvider, Global } from '@emotion/react';
import { Router, useLocation } from 'react-router';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import logger from '../../ui-platform/src/logger.cjs';
import { defaultKeyboardDevice } from '../../keyboard-ui/src/data/device.js';
import { initialRemaps } from '../../keyboard-ui/src/data/initialRemaps.js';
import { resources } from '../../keyboard-ui/src/i18n/resources.js';
import { depthCurve } from '../../sensor-monitor/src/data/depthCurve.js';
import { defaultRestStudy } from '../../sensor-monitor/src/data/restStudy.js';
import { createApplicationState } from '../../application-state/src/index.js';
import {
  createDeviceControls,
  type DeviceControls,
  type DeviceEditIntent,
  type DeviceEditOutcome,
} from '../../renderer-state/src/device-controls.js';
import {
  DepthPanel,
  DeviceStatePanel,
} from '../../sensor-monitor/src/index.js';
import type {
  DeviceStateSnapshot,
  SensorMonitorContext,
  DeviceStateContext,
} from '../../sensor-monitor/src/types.js';
import { ApplicationShell, type WorkspaceAction } from './application-shell.js';
import { AnalogueControls, AnalogueLightingFeedback } from './analogue-controls.js';
import { createProfileSync } from './profile-sync.js';
import {
  publishContext,
  type RendererContext,
  type RendererApi,
} from './context.js';
import {
  errorMessage,
  jsonObject,
  type ProfileDocument,
  type StoredProfiles,
} from '../../contracts/desktop.cjs';
import type { RemapSnapshot } from './model-types.js';
import { object } from '../../contracts/desktop.cjs';
import {
  keyboardSnapshot,
  remapSnapshot,
  profileDocument,
} from './profile-storage.js';
import { captureControlSnapshot } from './control-model-adapter.js';
import { createMacroRecorderAdapter } from './macro-recorder.js';
import { createProfiles, type Profiles } from './profiles.js';
import { flushAnalogueChanges } from './analogue-controls.js';

export { activeContext } from './context.js';

function requiredElement<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw Error('Missing application element: ' + selector);
  return element;
}

/** Builds the same keyboard workspace using ordinary imports and explicit model/state dependencies. */
export async function mountKeyboardApp(): Promise<RendererContext> {
  ReactModal.setAppElement(requiredElement<HTMLElement>('#app'));
  const host = window.keyboardHost;
  if (!host) throw Error('Desktop keyboard interface unavailable');
  logger.configureLogger((event) => host.diagnostic(jsonObject(event)));
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources,
    ns: Object.keys(object(resources.en, 'English translations')),
    defaultNS: 'common',
    keySeparator: ':',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  const saved: StoredProfiles = await host.read();
  const hasSaved = saved.schemaVersion === 1;
  const device = defaultKeyboardDevice;
  const query = new URLSearchParams(window.location.search);
  const ui = observable({
    depth: query.has('depth'),
    analogue: query.has('analogue'),
    tools: query.has('profiles'),
    deviceState: query.has('state'),
    status: 'Keyboard disconnected',
    saving:false,
  });
  const history = createMemoryHistory({
    initialEntries: [keyboardRoutes.keyboardDeviceLighting],
  });
  const appearance = observable({ theme: 'dark' });
  const profileLinks: KeyboardProfileEnvironment['profileLinks'] = {};
  const env: KeyboardProfileEnvironment = {
    keyboardDevice: device,
    profileLinks,
  };
  const initial = createDefaultKeyboardProfile(device);
  const profileData = hasSaved
    ? keyboardSnapshot(saved.keyboard)
    : {
        deviceUniqueId: device.uniqueId,
        deviceType: device.deviceType,
        softwareProfiles: [getSnapshot(initial)],
        activeProfileId: initial.id,
      };
  const requestedHardwareId = profileData.activeProfileId.startsWith(
    'hardware-',
  )
    ? profileData.activeProfileId
    : null;
  let resumeSoftwareId =
    hasSaved && !requestedHardwareId ? profileData.activeProfileId : null;
  if (requestedHardwareId) {
    if (!profileData.softwareProfiles.length)
      profileData.softwareProfiles.push(getSnapshot(initial));
    profileData.activeProfileId = profileData.softwareProfiles[0].id;
  }
  const keyboard = KeyboardDeviceProfile.create(profileData, env);
  const remapData = hasSaved
    ? remapSnapshot(saved.remap)
    : ({
        deviceUniqueId: device.uniqueId,
        deviceType: device.deviceType,
      } as RemapSnapshot);
  if (requestedHardwareId || !remapData.activeProfileId)
    remapData.activeProfileId = {
      id: keyboard.activeProfile.id,
      kind: 'Software',
    };
  const remap = KeyRemapDeviceProfile.create(remapData, env);
  profileLinks.remap = remap;
  remap.attachDevice(device);
  remap.initializeRemaps(initialRemaps);
  if (!remap.softwareKeyRemapSettingsMap.has(keyboard.activeProfile.id))
    remap.addSoftwareKeyRemapSetting(
      device,
      'Single',
      keyboard.activeProfile.id,
      getKeyboardInfo(device)!.keys,
    );
  remap.setLoaded();
  const physicalNames = new Map(
    device.capabilityData.keyRemap.validPhysicalKeysForRemap.flatMap((group) =>
      group.keys.map((key) => [key.physicalKeyId, key.name] as const),
    ),
  );
  configureKeyNames(physicalNames);
  const stores: KeyboardUiStores = {
    localStore: { colorPicker: ColorPickerStore.create({}) },
    viewStateStore: KeyboardViewState.create({}),
    macroRecordStore: new MacroRecordStore(
      createMacroRecorderAdapter(host, physicalNames, MacroKeyNames),
      new Set(Object.values(MacroKeyNames)),
    ),
  };
  keyboard.setKeyBrightness(
    typeof saved.keyBrightness === 'number' ? saved.keyBrightness : 0.8,
    {
      fromDevice: true,
    },
  );
  keyboard.setPerimeterBrightness(
    typeof saved.perimeterBrightness === 'number'
      ? saved.perimeterBrightness
      : 0.8,
    { fromDevice: true },
  );
  let controls: DeviceControls | null = null;
  const state = createApplicationState<DeviceEditIntent, DeviceEditOutcome>({
    execute: (input, ticket) => {
      if (!controls)
        return Promise.reject(Error('Keyboard controls have not initialized'));
      return controls.execute(input, ticket);
    },
    onObserverError: (error) =>
      host.diagnostic({
        kind: 'state-observer-error',
        error: errorMessage(error),
      }),
  });
  const label = (message: string) => {
    ui.status = message;
  };
  let saving: Promise<unknown> = Promise.resolve();
  let pendingSave: ProfileDocument | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let saveRevision=0;
  const snapshot = (): ProfileDocument =>
    profileDocument({
      ...saved,
      schemaVersion: 1,
      keyboard: getSnapshot(keyboard),
      remap: getSnapshot(remap),
      keyBrightness: keyboard.keyBrightness,
      perimeterBrightness: keyboard.perimeterBrightness,
    });
  const flushSave = async () => {
    clearTimeout(saveTimer);
    const value=pendingSave; pendingSave=undefined;
    const revision=saveRevision;
    if(value) saving=saving.then(()=>host.write(value)).catch(fail);
    await saving;
    if(revision===saveRevision&&!pendingSave)ui.saving=false;
  };
  const save = (): void => { pendingSave=snapshot();saveRevision++;ui.saving=true;clearTimeout(saveTimer);saveTimer=setTimeout(()=>void flushSave(),120); };
  let profiles: Profiles;
  const context: RendererContext = {
    host,
    keyboard,
    remap,
    device,
    ui,
    diagnostics: { lastError: null },
    state,
    deviceControls: null,
    get api() {
      return api;
    },
    get profiles() { return profiles; },
    setStatusLabel: label,
  };
  const sync = createProfileSync(context, requestedHardwareId);
  const fail = (error: unknown): void => {
    context.diagnostics.lastError = errorMessage(error);
    requiredElement('#preview-error').textContent =
      context.diagnostics.lastError;
    host.diagnostic({
      kind: 'renderer-error',
      error: context.diagnostics.lastError,
    });
    report();
  };
  class ErrorBoundary extends Component<
    { children?: ReactNode },
    { error: Error | null }
  > {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) {
      return { error };
    }
    componentDidCatch(error: Error, _info: ErrorInfo) {
      fail(error);
    }
    render() {
      return this.state.error ? (
        <section>
          <h2>Keyboard workspace needs repair</h2>
          <pre>{this.state.error.message}</pre>
        </section>
      ) : (
        this.props.children
      );
    }
  }
  const keyboardView = {
    Rows: KeyboardRows,
    Key: KeyPreview,
    Wrapper: ActuationWrapper,
    layout: getKeyboardInfo(device)!.layout,
    theme: getKeyboardTheme('dark'),
    keyboardInfo: {
      layout:
        device.capabilityData.physicalKeys?.physicalKeysLayout?.layout ??
        'ANSI',
      region: keyboard.keyboardRegion,
    },
  };
  const sensorContext: SensorMonitorContext = {
    host,
    curve: depthCurve,
    keyboardView,
    diagnostics: context.diagnostics,
    restStudy: defaultRestStudy,
    report: () => report(),
    setStatusLabel: label,
  };
  const stateContext: DeviceStateContext = {
    host,
    get initialState() {
      return context.diagnostics.deviceState;
    },
    updateState(value) {
      context.diagnostics.deviceState = value;
    },
    importDeviceState: async (value, slot) => {
      await importDeviceState(value, slot);
    },
    report: () => report(),
  };
  const Workspace = observer(function Workspace() {
    const { pathname } = useLocation();
    return (
      <ApplicationShell context={context} actions={actions}>
      <div id="keyboard-workspace">
        {ui.tools ? null : ui.deviceState ? (
          <DeviceStatePanel context={stateContext} />
        ) : ui.depth ? (
          <DepthPanel context={sensorContext} />
        ) : ui.analogue ? (
          <AnalogueControls host={host} keyboardView={keyboardView} profileId={keyboard.activeProfile.id} onLighting={key => {
            keyboard.clearSelection(); keyboard.addKeys([key]); ui.analogue = false;
            history.push(keyboardRoutes.keyboardDeviceLighting);
            requestAnimationFrame(() => {
              const feedback = document.getElementById('analogue-lighting-feedback');
              if (feedback instanceof HTMLDetailsElement) { feedback.open = true; feedback.scrollIntoView({ block: 'nearest' }); }
            });
          }} />
        ) : pathname.startsWith(keyboardRoutes.keyboardMacros) ? (
          <KeyboardMacroEdit
            readyKeyboardDevice={device}
            keyboardDeviceProfile={keyboard}
          />
        ) : (
          <><KeyboardWorkspace
            readyKeyboardDevice={device}
            keyboardDeviceProfile={keyboard}
          />{pathname === keyboardRoutes.keyboardDeviceLighting && <AnalogueLightingFeedback host={host} profileId={keyboard.activeProfile.id} />}</>
        )}
      </div>
      </ApplicationShell>
    );
  });
  const root = createRoot(requiredElement('#app'));
  let generation = 0;
  const render = () => {
    root.render(
      <ErrorBoundary key={++generation}>
        <I18nextProvider i18n={i18n}>
          <CacheProvider value={styleCache}>
            <Provider {...stores}>
              <Observer>
                {() => (
                  <ThemeProvider theme={getKeyboardTheme(appearance.theme)}>
                    <Global styles={globalStyles} />
                    <Router history={history}>
                      {React.createElement(
                        DndProvider,
                        { backend: HTML5Backend },
                        <Workspace />,
                      )}
                    </Router>
                  </ThemeProvider>
                )}
              </Observer>
            </Provider>
          </CacheProvider>
        </I18nextProvider>
      </ErrorBoundary>,
    );
  };
  const discover = async () => {
    const result = await host.devices();
    context.diagnostics.discovery = result;
    label(
      Array.isArray(result.interfaces) && result.interfaces.length
        ? state.getSnapshot().phase === 'ready'
          ? 'Keyboard connected · device controls linked'
          : 'Keyboard detected · loading device settings'
        : 'Keyboard disconnected',
    );
    return result;
  };
  async function importDeviceState(
    value: DeviceStateSnapshot,
    wireIndex = value.activeProfile.wireIndex,
  ): Promise<string | null> {
    if (
      value !== context.diagnostics.deviceState ||
      value.source !== 'direct-hid' ||
      !value.readOnly ||
      value.settingsWritePerformed !== false
    )
      throw Error('Read current keyboard state before import');
    const source = value.profiles.find(
        (profile) => profile.wireIndex === wireIndex,
      ),
      lighting = value.lighting.profiles.find(
        (profile) => profile.wireIndex === wireIndex,
      );
    if (!source || !lighting || value.lighting.source !== 'direct-hid')
      throw Error('Read complete supported settings before import');
    const importedLighting = validatedSnapshot(KeyboardSettings, {
      ...getSnapshot(createDefaultKeyboardProfile(device).settings),
      baseZones: lighting.baseZones,
      perimeterZones: lighting.perimeterZones,
      reactiveZones: lighting.reactiveZones,
    });
    save();
    await flushSave();
    const backup = await host.checkpoint();
    // Import changes the editor only while observers are suspended; no automatic hardware write.
    const hydration = state.beginHydration();
    try {
      hydration.commit(() => {
        const settings = keyboard.activeProfile.settings;
        keyboard.setKeyBrightness(value.brightnessKeys, { fromDevice: true });
        keyboard.setPerimeterBrightness(value.brightnessRing, {
          fromDevice: true,
        });
        const pollingRate = validatedSnapshot(
          KeyboardSettings.properties.pollingRate,
          source.pollingRate,
        );
        if (pollingRate === undefined)
          throw Error('Missing imported polling rate');
        settings.setPollingRate(pollingRate);
        settings.setGameModeEnabled(source.gameModeEnabled, {
          fromDevice: true,
        });
        settings.idleTimeout.setDisabled(source.idleTimeout.disabled);
        if (!source.idleTimeout.disabled)
          settings.idleTimeout.setTimeoutSeconds(
            source.idleTimeout.timeoutSeconds,
          );
        settings.setBaseZones(importedLighting.baseZones ?? []);
        settings.setPerimeterZones(importedLighting.perimeterZones ?? []);
        settings.setReactiveZones(importedLighting.reactiveZones ?? []);
      });
    } finally {
      hydration.close();
    }
    context.diagnostics.importedDeviceValues = {
      source: 'direct-hid',
      wireIndex,
      sampledAt: value.sampledAt,
      backup,
      fields: [
        'brightnessKeys',
        'brightnessRing',
        'pollingRate',
        'gameModeEnabled',
        'idleTimeout',
        'baseZones',
        'perimeterZones',
        'reactiveZones',
      ],
    };
    save();
    await saving;
    return backup;
  }
  function report(): void {
    const diagnostics = context.diagnostics;
    host.report(
      jsonObject({
        status: diagnostics.lastError
          ? 'failed'
          : document.querySelector('#keyboard-workspace, .profiles-page')
            ? 'mounted'
            : 'empty',
        error: diagnostics.lastError,
        route: history.location.pathname,
        profileSource: diagnostics.hardwareSync
          ? 'mixed-native-and-local'
          : 'offline',
        deviceSettingsLinked:
          context.deviceControls !== null &&
          state.getSnapshot().phase !== 'disconnected',
        nativeBackendLinked: 'Rust device controls',
        hardwareSync: diagnostics.hardwareSync,
        deviceStateSource: diagnostics.deviceState?.source ?? 'inactive',
        importedDeviceValues: diagnostics.importedDeviceValues,
        sensorSource:
          ui.depth && diagnostics.depthSnapshot ? 'direct-hid' : 'inactive',
        sensorConnection: ui.depth
          ? diagnostics.depthConnection
          : { status: 'inactive' },
        applicationState: state.getSnapshot(),
        text: document.body.innerText.slice(0, 5000),
      }),
    );
  }
  controls = createDeviceControls({
    state,
    host,
    model: {
      observe: (effect) =>
        reaction(() => captureControlSnapshot(context), effect),
      syncHardwareProfiles: sync.syncHardwareProfiles,
      syncLiveValues: sync.syncLiveValues,
      depthActive: () => ui.depth,
      activeWireSlot: () =>
        keyboard.activeProfile.hardwareProfileId ??
        context.diagnostics.hardwareSync?.activeWireSlot ??
        4,
      didApply: async ({ input, receipt }) => {
        context.diagnostics.lastDeviceEdit = receipt;
        if (input.kind === 'software' && context.diagnostics.hardwareSync)
          context.diagnostics.hardwareSync.activeWireSlot = 4;
        await host.analogueProfile(keyboard.activeProfile.id);
      },
    },
    label,
    report,
    diagnostic: (value) => host.diagnostic(jsonObject(value)),
    ...(query.has('test') ? { pollIntervalMs: 3600000 } : {}),
  });
  context.deviceControls = controls;
  const api: RendererApi = {
    ...sync,
    history,
    stores,
    keyboard,
    remap,
    device,
    ui,
    render,
    discover,
    importDeviceState,
    flushSave,
    save,
    resetError() {
      context.diagnostics.lastError = null;
      requiredElement('#preview-error').textContent = '';
    },
    report,
    connectDeviceControls: () => {
      if (!controls) throw Error('Keyboard controls unavailable');
      return controls;
    },
  };
  profiles = createProfiles(context, await host.profileLibrary());
  let analogueSelection = 0;
  const chooseAnalogueProfile = async () => {
    const selected=keyboard.activeProfile.id, request=++analogueSelection;
    await controls?.flush();
    if(request===analogueSelection && selected===keyboard.activeProfile.id) await host.analogueProfile(selected);
  };
  const disposeProfileSelection = reaction(()=>keyboard.activeProfile.id,()=>void chooseAnalogueProfile().catch(error=>host.diagnostic({kind:'analogue-profile-selection',error:errorMessage(error)})));
  publishContext(context);
  const disposeSnapshots = [
    onSnapshot(keyboard, save),
    onSnapshot(remap, save),
    reaction(
      () => [keyboard.keyBrightness, keyboard.perimeterBrightness],
      save,
    ),
  ];
  const mirrorLifecycle = createDesktopLifecycleMirror(state);
  const removeLifecycle = host.onLifecycleEvent(mirrorLifecycle);
  mirrorLifecycle(await host.lifecycleStatus());
  const actions: WorkspaceAction[] = [
  { id: 'export', label: 'Export profiles', description: 'Save a copy of your local profiles to a file you choose.', complete: 'Profiles exported.', run: async () => {
    save();
    await flushAnalogueChanges(); await flushSave();
    return host.exportProfiles();
  } },
  { id: 'import', label: 'Import profiles', description: 'Load profiles from a previously exported file. Your current settings are backed up first.', complete: 'Profiles imported.', run: async () => {
    const candidate = await host.importProfiles();
    if (!candidate) return null;
    const document = profileDocument(candidate),
      local = keyboardSnapshot(document.keyboard);
    if (!local.softwareProfiles.length)
      throw Error('Profile file contains no editable profiles');
    if (local.activeProfileId.startsWith('hardware-'))
      local.activeProfileId = local.softwareProfiles[0].id;
    KeyboardDeviceProfile.create(local, env);
    KeyRemapDeviceProfile.create(remapSnapshot(document.remap), env);
    controls?.dispose();
    await host.checkpoint();
    await host.importProfileDocument(document);
    window.location.reload();
  } },
  { id: 'restore', label: 'Restore backup', description: 'Choose a device backup and recover its saved keyboard settings.', complete: 'Backup restored.', requiresConnection: true, run: async () => {
    await state.flush();
    const ticket = state.beginRecovery('Restore selected keyboard backup');
    try {
      const result = await host.recoverBackup();
      state.finishRecovery(ticket);
      if (result) await sync.syncHardwareProfiles();
      return result;
    } catch (error) {
      if (state.isCurrent(ticket)) state.finishRecovery(ticket, error);
      throw error;
    }
  } },
  { id: 'rescan', label: 'Rescan keyboard', description: 'Reconnect your keyboard and reload its current configuration.', complete: 'Keyboard reconnected.', run: async () => {
    sync.invalidateHardwareCache();
    await connect(true);
  } },
  { id: 'onboard', label: 'Use onboard profile 1', description: 'Return control to the first profile stored on the keyboard.', complete: 'Onboard profile 1 is active.', requiresConnection: true, run: async () => {
    await host.releaseSoftwareProfile();
    await host.applyField({ field: 'activeProfile', wireIndex: 0, value: 0 });
    await sync.syncHardwareProfiles();
  } },
  { id: 'undo', label: 'Undo device edit', description: 'Restore the settings from before your most recent device edit.', complete: 'Last device edit undone.', requiresConnection: true, run: () => {
    if (!controls) throw Error('Connect the keyboard first');
    return controls.undo();
  } },
  ];
  async function connect(force = false): Promise<void> {
    const phase = state.getSnapshot().phase;
    if (
      phase === 'connecting' ||
      phase === 'hydrating' ||
      phase === 'recovering'
    )
      return;
    if (
      !force &&
      state.getSnapshot().phase !== 'disconnected' &&
      state.getSnapshot().phase !== 'error'
    )
      return;
    const ticket = state.beginConnection();
    try {
      const connection = await host.connection();
      state.connected(
        {
          id: connection.devicePath ?? 'nzxt-function-elite',
          firmware: connection.firmware,
        },
        ticket,
      );
      // Keep writes blocked throughout session release and the first complete read.
      const startupHydration = state.beginHydration();
      try {
        await host.releaseSoftwareProfile();
        await sync.syncHardwareProfiles();
      } finally {
        startupHydration.close();
      }
      if (resumeSoftwareId) {
        const id = resumeSoftwareId;
        resumeSoftwareId = null;
        if (keyboard.softwareProfiles.some((profile) => profile.id === id)) {
          keyboard.setActiveProfileId(id, { fromDevice: false });
          await controls?.flush();
        }
      }
      report();
      await chooseAnalogueProfile();
      void host.prepareSoftwareProfile().catch(error=>host.diagnostic({kind:'software-prepare',error:errorMessage(error)}));
    } catch (error) {
      if (
        state.getSnapshot().connectionGeneration === ticket.connectionGeneration
      )
        state.disconnect();
      label('Keyboard disconnected');
      host.diagnostic({ kind: 'connection-error', error: errorMessage(error) });
      if (force) throw error;
    }
  }
  void discover().catch((error) => {
    label('Keyboard disconnected');
    host.diagnostic({ kind: 'connection-error', error: errorMessage(error) });
  });
  render();
  save();
  if (!query.has('test')) void connect();
  history.listen(() => setTimeout(report, 100));
  setTimeout(report, 800);
  window.addEventListener(
    'beforeunload',
    () => {
      removeLifecycle();
      sync.dispose();
      disposeSnapshots.forEach((dispose) => dispose());
      controls?.dispose();
      disposeProfileSelection(); profiles.dispose(); void flushSave();
    },
    { once: true },
  );
  return context;
}

export const applicationReady: Promise<RendererContext> =
  typeof document === 'undefined'
    ? Promise.reject(Error('Keyboard renderer requires a document'))
    : mountKeyboardApp();
if (typeof document !== 'undefined')
  void applicationReady.catch((error) => {
    const message = errorMessage(error);
    const output = document.getElementById('preview-error');
    if (output) output.textContent = message;
    window.keyboardHost?.report({ status: 'failed', error: message });
  });
