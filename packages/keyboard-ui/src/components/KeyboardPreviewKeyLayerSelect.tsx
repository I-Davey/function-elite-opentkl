/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import type { KeyboardDeviceProfileInstance } from '../models/KeyboardDeviceProfile.js';

/** Base/Fn selection retains the recovered click targets, colours and responsive layout. */
export const KeyboardPreviewKeyLayerSelect = observer(function KeyboardPreviewKeyLayerSelect({
  keyboardDeviceProfile: profile,
}: {
  keyboardDeviceProfile: KeyboardDeviceProfileInstance;
}) {
  const theme = useTheme(),
    { t } = useTranslation();
  return (
    <div
      css={{
        label: 'Component-container',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        '@media (max-width: 1180px)': { flexDirection: 'row' },
      }}
    >
      {(['Base', 'Fn'] as const).map((layer) => (
        <div
          key={layer}
          onClick={() => profile.updateKeyremapLayer(layer)}
          css={[
            {
              label: 'Component-item',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: 130,
              height: 48,
              borderRadius: 10,
              border: `2px solid ${theme.keyboard.quickSelectBorder}`,
              transition: 'border-color 0.2s ease',
              background: `${theme.lightingAccessory.expandedBackgroundColor}`,
              fontWeight: 400,
              cursor: 'pointer',
              color: `${theme.body.text1}`,
              fontSize: 14,
            },
            profile.keyremapLayer === layer && {
              label: 'Component-selected',
              borderColor: `${theme.body.primary}`,
              transition: 'border-color 0.5s ease',
              ':hover': { borderColor: `${theme.body.primary}` },
            },
          ]}
        >
          {t(layer === 'Base' ? 'keyboard:baseLayer' : 'keyboard:functionLayer')}
        </div>
      ))}
    </div>
  );
});
