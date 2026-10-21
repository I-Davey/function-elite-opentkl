/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { observer } from 'mobx-react';
import { Redirect, Route, Switch } from 'react-router';
import { KeyboardRows, KeyPreview, LightingKeyWrapper } from './KeyboardRows.js';
import { KeyboardPerimeter } from './KeyboardPerimeter.js';
import { getKeyboardInfo } from '../layouts/keyboardInfo.js';
import { getRemappedCode } from '../models/remapPreview.js';
import { useKeyboardViewState } from '../models/useKeyboardViewState.js';
import type { KeyboardReadyDevice } from '../models/deviceTypes.js';
import type { KeyboardDeviceProfileInstance } from '../models/KeyboardDeviceProfile.js';
import { keyboardRoutes } from '../keyboardRoutes.js';

/** Lighting key surface; the surrounding lighting view continues to own drag selection. */
export const KeyboardLightingKeys = observer(function KeyboardLightingKeys({
  readyKeyboardDevice: device,
  keyboardDeviceProfile: profile,
  scalar = 50,
}: {
  readyKeyboardDevice: KeyboardReadyDevice;
  keyboardDeviceProfile: KeyboardDeviceProfileInstance;
  scalar?: number;
}) {
  const theme = useTheme();
  const {
    keyboard: { selectedEffectLayer },
  } = useKeyboardViewState();
  const { layout } = getKeyboardInfo(device)!;
  const keyboardInfo = {
    layout: device.capabilityData.physicalKeys?.physicalKeysLayout?.layout ?? 'ANSI',
    region: profile.keyboardRegion,
  };
  const keyColors = profile.getColorsByKey(device, selectedEffectLayer);
  const gradient = profile.getPerimeterGradient();
  return (
    <Switch>
      <Route path={keyboardRoutes.keyboardDeviceLighting}>
        {device.supportedCapabilities.keyboardMouseLighting ? (
          <>
            <KeyboardRows
              layout={layout}
              scalar={scalar}
              selectedKeys={profile.selectedKeys}
              keyColors={keyColors}
            >
              {(wrapper) => {
                const code = getRemappedCode(
                  'Base',
                  profile.keyremapProfile?.activeProfile,
                  wrapper.keyItem.code,
                );
                return (
                  <LightingKeyWrapper
                    key={`keyboard-key-${wrapper.keyIndex}`}
                    code={code}
                    {...wrapper}
                  >
                    <KeyPreview
                      keyIndex={wrapper.keyIndex}
                      keyItem={{ ...wrapper.keyItem, code }}
                      keyboardInfo={keyboardInfo}
                      theme={theme}
                      scalar={scalar}
                    />
                  </LightingKeyWrapper>
                );
              }}
            </KeyboardRows>
            <KeyboardPerimeter gradient={gradient} />
          </>
        ) : (
          <Redirect to={keyboardRoutes.keyboardDeviceRemaps} />
        )}
      </Route>
    </Switch>
  );
});
