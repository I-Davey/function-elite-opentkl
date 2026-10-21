/** @jsxImportSource @emotion/react */
import { observer } from 'mobx-react';
import { Redirect, Route, Switch } from 'react-router';
import { keyboardRoutes } from '../../keyboardRoutes.js';
import { KeyboardLightingControls } from '../lighting/KeyboardLightingControls.js';
import { KeyboardRemapControls } from '../remapping/KeyboardRemapControls.js';
import { KeyboardMacroControls } from '../macros/KeyboardMacroControls.js';
import { KeyboardPerformanceControls } from '../performance/KeyboardPerformanceControls.js';
import type { KeyboardWorkspaceProps } from './KeyboardPreviewRouter.js';

/** Retain route order and capability redirects without recreating component types on each render. */
export const KeyboardControlsRouter = observer(function KeyboardControlsRouter(
  props: KeyboardWorkspaceProps,
) {
  const capabilities = props.readyKeyboardDevice.supportedCapabilities;
  const lighting = ['profile', 'keyboardMouseLighting', 'physicalKeys'].every(
    (key) => capabilities[key],
  );
  const remapping = ['uniqueId', 'keyRemap', 'physicalKeys'].every(
    (key) => capabilities[key],
  );
  const unavailable = () => <Redirect to={keyboardRoutes.keyboard} />;
  return (
    <Switch>
      <Route
        path={keyboardRoutes.keyboardDeviceLighting}
        render={() =>
          lighting ? <KeyboardLightingControls {...props} /> : unavailable()
        }
      />
      <Route
        path={keyboardRoutes.keyboardDeviceRemaps}
        render={() =>
          remapping ? <KeyboardRemapControls {...props} /> : unavailable()
        }
      />
      <Route
        path={keyboardRoutes.keyboardDeviceMacros}
        render={() =>
          remapping ? <KeyboardMacroControls {...props} /> : unavailable()
        }
      />
      <Route
        path={keyboardRoutes.keyboardDevicePerformance}
        render={() =>
          remapping ? <KeyboardPerformanceControls {...props} /> : unavailable()
        }
      />
    </Switch>
  );
});
