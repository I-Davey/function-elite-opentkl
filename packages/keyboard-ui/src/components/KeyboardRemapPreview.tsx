/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { KeyboardRows, KeyPreview, RemapKeyWrapper, DEFAULT_KEY_COLOR } from './KeyboardRows.js';
import { Tooltip } from './Tooltip.js';
import { useResizeObserver } from './useResizeObserver.js';
import { keyboardPreviewStyles } from './keyboardPreviewStyles.js';
import { KeyboardPreviewKeyLayerSelect } from './KeyboardPreviewKeyLayerSelect.js';
import { getKeyboardInfo } from '../layouts/keyboardInfo.js';
import { getValidPhysicalKeysForRemapForDevice } from '../models/remapKeyUtils.js';
import { getRemapAppearance, type RemapPreviewKind } from '../models/remapPreview.js';
import type { KeyboardReadyDevice } from '../models/deviceTypes.js';
import type { KeyboardDeviceProfileInstance } from '../models/KeyboardDeviceProfile.js';
import type { KeyRemapDeviceProfileInstance } from '../models/KeyRemapDeviceProfile.js';
import { keyboardRoutes } from '../keyboardRoutes.js';

interface PreviewProps {
  readyKeyboardDevice: KeyboardReadyDevice;
  keyboardDeviceProfile: KeyboardDeviceProfileInstance;
  keyRemapDeviceProfile: KeyRemapDeviceProfileInstance;
}
interface BadgeProps {
  kind: RemapPreviewKind;
  isDoubleColor: boolean;
}
/** Dual remaps use two overlapping dots; other configured states retain one status dot. */
export function InfoBadge({ kind, isDoubleColor }: BadgeProps) {
  const theme = useTheme();
  if (kind === 'None') return <></>;
  const colors = {
    Disabled: `#${theme.keyboard.keyBackground.toHex()}`,
    Single: `#${theme.keyboard.simpleRemap.toHex()}`,
    Dual: `#${theme.keyboard.simpleRemapDual.toHex()}`,
    Macro: `#${theme.keyboard.macro.toHex()}`,
    Snap: `#${theme.keyboard.snapOverride.toHex()}`,
  };
  return (
    <ClassNames>
      {({ css }) => {
        const className = css({
          position: 'absolute',
          bottom: 8,
          right: 8,
          width: 10,
          height: 10,
          borderRadius: '50%',
        });
        return kind === 'Dual' && isDoubleColor ? (
          <>
            <div
              className={className}
              style={{ backgroundColor: colors.Single, transform: 'translateX(-5px)' }}
            />
            <div className={className} style={{ backgroundColor: colors.Dual }} />
          </>
        ) : (
          <div className={className} style={{ backgroundColor: colors[kind] }} />
        );
      }}
    </ClassNames>
  );
}
export function InfoTooltip({
  kind,
  isDoubleColor,
  children,
}: BadgeProps & { children: ReactNode }) {
  const theme = useTheme();
  const { t } = useTranslation('keyboard');
  const [open, setOpen] = useState(false);
  if (kind === 'None') return <>{children}</>;
  const messages = {
    Disabled: t('keyboard:previewKeyStatus-disabled'),
    Single: t('keyboard:previewKeyStatus-remapped'),
    Dual: t('keyboard:previewKeyStatus-dual'),
    Macro: t('keyboard:previewKeyStatus-macro'),
    Snap: t('keyboard:previewKeyStatus-snap'),
  };
  return (
    <ClassNames>
      {({ css }) => (
        <Tooltip
          open={open}
          onRequestClose={() => setOpen(false)}
          tooltip={
            kind === 'Dual' && isDoubleColor
              ? t('keyboard:previewKeyStatus-dualRemapped')
              : messages[kind]
          }
          innerClassName={css({
            backgroundColor: `${theme.colorPicker.backgroundColor}`,
            color: `${theme.body.text3}`,
            fontSize: 13,
            padding: 8,
          })}
          strategy="absolute"
          placement="top"
          offset={[0, 3]}
        >
          <div
            css={{ height: '100%' }}
            onMouseOver={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            {children}
          </div>
        </Tooltip>
      )}
    </ClassNames>
  );
}
/** Selection is reset at mount. Macro keys and macro-tab keys keep their original click policy. */
export const KeyboardRemapKeys = observer(function KeyboardRemapKeys({
  readyKeyboardDevice: device,
  keyboardDeviceProfile: profile,
  keyRemapDeviceProfile: remaps,
  className,
}: PreviewProps & { className?: string }) {
  const theme = useTheme(),
    location = useLocation();
  const keyboardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    profile.clearSelection();
  }, []);
  const isMacroTab = location.pathname === keyboardRoutes.keyboardDeviceMacros;
  const active = remaps.activeProfile;
  const { layout } = getKeyboardInfo(device)!;
  const { selectedKeys, keyremapLayer: layer } = profile;
  const borderColors: Partial<Record<number, string>> = {};
  if (!isMacroTab)
    selectedKeys.forEach((code) => {
      if (active?.physicalKeys.has(String(code)))
        borderColors[code] = `#${theme.keyboard.selectedKeyText.toHex()}`;
    });
  const keyboardInfo = {
    layout: device.capabilityData.physicalKeys?.physicalKeysLayout?.layout ?? 'ANSI',
    region: profile.keyboardRegion,
  };
  const validKeys = getValidPhysicalKeysForRemapForDevice(device)[layer].map((key) => key.keyId);
  const onKeyClick = (code: number) => {
    const key = active?.physicalKeys.get(String(code));
    const output =
      key?.active.kind === 'Single'
        ? layer === 'Base'
          ? key.active.remapTo
          : key.active.fnPressed?.remapTo
        : undefined;
    if (isMacroTab || output?.kind === 'Macro' || !validKeys.includes(code)) return;
    if (selectedKeys.has(code)) profile.removeKey(code);
    else {
      profile.clearSelection();
      profile.addKey(code);
    }
  };
  return (
    <div ref={keyboardRef} className={className}>
      <ClassNames>
        {({ css }) => (
          <KeyboardRows
            className={css({ '&:not(:last-child)': { backgroundColor: DEFAULT_KEY_COLOR } })}
            layout={layout}
            selectedKeys={selectedKeys}
            borderColors={borderColors}
            scalar={50}
          >
            {(wrapper) => {
              const appearance = getRemapAppearance(
                active,
                validKeys,
                layer,
                wrapper.keyItem.code,
                theme,
              );
              return (
                <InfoTooltip
                  key={`keyboard-key-${wrapper.keyIndex}-tooltip`}
                  kind={appearance.kind}
                  isDoubleColor={appearance.isDoubleColor}
                >
                  <RemapKeyWrapper
                    {...wrapper}
                    labelColor={appearance.labelColor}
                    onClick={onKeyClick}
                    infoBadge={
                      <InfoBadge kind={appearance.kind} isDoubleColor={appearance.isDoubleColor} />
                    }
                  >
                    <KeyPreview
                      keyIndex={wrapper.keyIndex}
                      keyItem={{ ...wrapper.keyItem, code: appearance.remappedCode }}
                      borderColor={wrapper.borderColor}
                      isShortLabel
                      keyboardInfo={keyboardInfo}
                      theme={theme}
                      scalar={50}
                    />
                  </RemapKeyWrapper>
                </InfoTooltip>
              );
            }}
          </KeyboardRows>
        )}
      </ClassNames>
    </div>
  );
});
/** Responsive remap surface; scaling and the delayed transform transition match the original. */
export const KeyboardRemapPreview = observer(function KeyboardRemapPreview(props: PreviewProps) {
  const [ref, { width }] = useResizeObserver();
  const info = getKeyboardInfo(props.readyKeyboardDevice)!;
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTransitionEnabled(true), 200);
    return () => clearTimeout(timer);
  }, []);
  const styles = keyboardPreviewStyles(info.formFactor, width, transitionEnabled);
  return (
    <div css={styles.container}>
      <div ref={ref} css={styles.content}>
        <ClassNames>
          {({ css }) => (
            <KeyboardRemapKeys
              {...props}
              className={css({
                ...styles.keyboard,
                width: 'fit-content',
                height: 'fit-content',
              })}
            />
          )}
        </ClassNames>
      </div>
      <div css={styles.footer}>
        <KeyboardPreviewKeyLayerSelect keyboardDeviceProfile={props.keyboardDeviceProfile} />
      </div>
    </div>
  );
});
