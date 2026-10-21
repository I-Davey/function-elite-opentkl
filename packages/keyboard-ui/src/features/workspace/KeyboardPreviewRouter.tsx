/** @jsxImportSource @emotion/react */
import { observer } from 'mobx-react';
import { Redirect, Route, Switch } from 'react-router';
import { keyboardRoutes } from '../../keyboardRoutes.js';
import { KeyboardLightingPreview } from '../../components/KeyboardLightingPreview.js';
import { KeyboardRemapPreview } from '../../components/KeyboardRemapPreview.js';
import { KeyboardActuationPreview } from '../../components/KeyboardActuationPreview.js';
import type { KeyboardDeviceProfileInstance } from '../../models/KeyboardDeviceProfile.js';
import type { KeyboardReadyDevice } from '../../models/deviceTypes.js';

export interface KeyboardWorkspaceProps {
  readyKeyboardDevice: KeyboardReadyDevice;
  keyboardDeviceProfile: KeyboardDeviceProfileInstance;
}

/** Macros share the remap preview; actual profile links replace the CAM controller lookup. */
export const KeyboardPreviewRouter = observer(function KeyboardPreviewRouter(
  props: KeyboardWorkspaceProps,
) {
  const device = props.readyKeyboardDevice,
    remaps = props.keyboardDeviceProfile.keyremapProfile;
  const lighting = !!device.supportedCapabilities.keyboardMouseLighting;
  const remapping = !!device.supportedCapabilities.keyRemap && !!remaps;
  const unavailable = () => <Redirect to={keyboardRoutes.keyboard} />;
  const remapPreview = () =>
    remapping && remaps ? (
      <KeyboardRemapPreview {...props} keyRemapDeviceProfile={remaps} />
    ) : (
      unavailable()
    );
  return (
    <Switch>
      <Route
        path={keyboardRoutes.keyboardDeviceLighting}
        render={() =>
          lighting ? <KeyboardLightingPreview {...props} /> : unavailable()
        }
      />
      <Route
        path={keyboardRoutes.keyboardDevicePerformance}
        render={() =>
          remapping && remaps ? (
            <KeyboardActuationPreview
              {...props}
              keyRemapDeviceProfile={remaps}
            />
          ) : (
            unavailable()
          )
        }
      />
      <Route path={keyboardRoutes.keyboardDeviceRemaps} render={remapPreview} />
      <Route path={keyboardRoutes.keyboardDeviceMacros} render={remapPreview} />
    </Switch>
  );
});
