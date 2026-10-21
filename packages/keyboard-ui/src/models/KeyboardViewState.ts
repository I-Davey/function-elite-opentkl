import { types, type Instance } from 'mobx-state-tree';
import { OpenableView } from './OpenableView.js';
import { Toaster } from './Toaster.js';

export type KeyboardLightingLayer = 'Base' | 'Reactive';

/** Only keyboard dialogs and selection belong here; profile data lives in device models. */
export const KeyboardPanelState = types
  .model('KeyboardPanelState', {
    saveAsModal: types.optional(OpenableView, {}),
  })
  .volatile(() => ({
    isNewMacro: false,
    isMacroCreationModalOpen: false,
    selectedEffectLayer: 'Base' as KeyboardLightingLayer,
    isCopyToHardwareModalOpen: false,
  }))
  .actions((self) => ({
    setIsNewMacro(value: boolean) { self.isNewMacro = value; },
    setIsMacroCreationModalOpen(value: boolean) { self.isMacroCreationModalOpen = value; },
    setSelectedEffectLayer(value: KeyboardLightingLayer) { self.selectedEffectLayer = value; },
    setIsCopyToHardwareModalOpen(value: boolean) { self.isCopyToHardwareModalOpen = value; },
  }));

export const DeviceProfileEdit = types
  .model('DeviceProfileEdit', {
    profileId: '',
    deviceProfileUniqueId: '',
    modal: types.optional(OpenableView, {}),
  })
  .actions((self) => ({
    setDeviceProfileUniqueId(value: string) { self.deviceProfileUniqueId = value; },
    setProfileId(value: string) { self.profileId = value; },
  }));

/** The standalone HE app does not create CAM's other device/account view stores. */
export const KeyboardViewState = types.model('KeyboardViewState', {
  keyboard: types.optional(KeyboardPanelState, {}),
  keyboardDeviceProfileEdit: types.optional(DeviceProfileEdit, {}),
  toaster: types.optional(Toaster, {}),
});

export type KeyboardViewStateInstance = Instance<typeof KeyboardViewState>;
