import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import type { SnapshotIn } from 'mobx-state-tree';
import type { FadeEffect, LineEffect, RippleEffect } from '../../models/ReactiveZoneEffects.js';
import { DEFAULT_COLOR, MAX_RIPPLE_SIZE } from '../../models/lightingConstants.js';
import { rgbFromHex, rgbToHex } from '../../theme/color.js';
import { cloneGradient, defaultMulticolor } from '../../theme/gradients.js';
import { SecondarySelect } from '../../components/Select.js';
import { ColorPicker } from '../../components/ColorPicker.js';
import { GradientPicker } from '../../components/GradientPicker.js';
import { KeyboardKeyEvent } from './KeyboardKeyEvent.js';
import { KeyboardSpeed } from './KeyboardSpeed.js';
import { KeyboardSize } from './KeyboardSize.js';
import type { EffectControlProps } from './types.js';

/** Fade's solid-colour mode intentionally starts with the model's RGB defaults. */
export const FadeControls = observer(function FadeControls({
  effectSettings: effect,
  onSelect,
  styles,
  theme,
}: Omit<EffectControlProps<typeof FadeEffect>, 'readyKeyboardDevice'>) {
  const { t } = useTranslation();
  const modes = (['Color', 'Rainbow', 'Random'] as const).map((value) => ({
    value,
    label: t(value === 'Color' ? 'keyboard:solidColor' : `keyboard:${value.toLowerCase()}`),
  }));
  const current = modes.find((option) => option.value === effect.color.kind) ?? modes[0];
  return (
    <div className={styles.container}>
      <KeyboardKeyEvent
        keyEvent={effect.keyEvent}
        onChange={(keyEvent) => onSelect({ ...effect, keyEvent })}
        containerClass={styles.container}
        labelClass={styles.label}
        theme={theme}
      />
      <SecondarySelect
        value={current}
        defaultValue={current}
        options={modes}
        onChange={(option) => {
          if (option && option.value !== effect.color.kind)
            onSelect({ ...effect, color: { kind: option.value } });
        }}
      />
      {effect.color.kind === 'Color' && (
        <ColorPicker
          hex={rgbToHex(effect.color.r, effect.color.g, effect.color.b)}
          onSelect={(color) => onSelect({ ...effect, color: { kind: 'Color', ...color.toRgb() } })}
          flavor="normal"
          zIndexContext="base"
        />
      )}
      <KeyboardSpeed
        speedPercent={effect.speedPercent}
        onChangeSpeed={(speedPercent) => onSelect({ ...effect, speedPercent })}
        containerClass={styles.container}
        labelClass={styles.label}
      />
    </div>
  );
});

/** Line keeps its flat RGB colour representation and cloned gradient snapshots. */
export const LineReactiveControls = observer(function LineReactiveControls({
  effectSettings: effect,
  onSelect,
  readyKeyboardDevice: device,
  styles,
  theme,
}: EffectControlProps<typeof LineEffect>) {
  const { t } = useTranslation();
  const modes = (['Gradient', 'Color', 'Rainbow', 'Random'] as const).map((value) => ({
    value,
    label: t(value === 'Color' ? 'keyboard:solidColor' : `keyboard:${value.toLowerCase()}`),
  }));
  const current = modes.find((option) => option.value === effect.color.kind) ?? modes[0];
  return (
    <div className={styles.container}>
      <KeyboardKeyEvent
        keyEvent={effect.keyEvent}
        onChange={(keyEvent) => onSelect({ ...effect, keyEvent })}
        containerClass={styles.container}
        labelClass={styles.label}
        theme={theme}
      />
      <SecondarySelect
        value={current}
        defaultValue={current}
        options={modes}
        onChange={(option) => {
          if (!option || option.value === effect.color.kind) return;
          const color =
            option.value === 'Gradient'
              ? { kind: option.value, gradient: cloneGradient(defaultMulticolor) }
              : option.value === 'Color'
                ? { kind: option.value, ...rgbFromHex(DEFAULT_COLOR) }
                : { kind: option.value };
          onSelect({ ...effect, color });
        }}
      />
      {effect.color.kind === 'Color' && (
        <ColorPicker
          hex={rgbToHex(effect.color.r, effect.color.g, effect.color.b)}
          onSelect={(color) => onSelect({ ...effect, color: { kind: 'Color', ...color.toRgb() } })}
          flavor="normal"
          zIndexContext="base"
        />
      )}
      {effect.color.kind === 'Gradient' && (
        <GradientPicker
          containerType="html"
          maxStops={device.capabilityData.keyboardMouseLighting.maxGradientCount}
          gradient={cloneGradient(effect.color.gradient)}
          onSelect={(gradient) =>
            onSelect({ ...effect, color: { kind: 'Gradient', gradient: cloneGradient(gradient) } })
          }
          zIndexContext="base"
          flavor="normal"
          disabled={false}
        />
      )}
      <KeyboardSpeed
        speedPercent={effect.speedPercent}
        onChangeSpeed={(speedPercent) => onSelect({ ...effect, speedPercent })}
        containerClass={styles.container}
        labelClass={styles.label}
      />
    </div>
  );
});

/** Ripple preserves size across colour-mode changes and clamps gradient size to its stop count. */
export const RippleReactiveControls = observer(function RippleReactiveControls({
  effectSettings: effect,
  onSelect,
  readyKeyboardDevice: device,
  styles,
  theme,
}: EffectControlProps<typeof RippleEffect>) {
  const { t } = useTranslation();
  const minSize =
    effect.color.kind === 'Gradient' && effect.color.gradient
      ? Math.min(effect.color.gradient.length, MAX_RIPPLE_SIZE)
      : 1;
  const size =
    effect.color.kind === 'Gradient' || effect.color.kind === 'Color'
      ? effect.color.size.value
      : effect.color.value;
  const currentSize = Math.max(
    effect.color.kind === 'Gradient' ? minSize : 1,
    Math.min(size, MAX_RIPPLE_SIZE),
  );
  const modes = (['Gradient', 'Color', 'Rainbow', 'Random'] as const).map((value) => ({
    value,
    label: t(value === 'Color' ? 'keyboard:solidColor' : `keyboard:${value.toLowerCase()}`),
  }));
  const current = modes.find((option) => option.value === effect.color.kind) ?? modes[0];
  return (
    <div className={styles.container}>
      <KeyboardKeyEvent
        keyEvent={effect.keyEvent}
        onChange={(keyEvent) => onSelect({ ...effect, keyEvent })}
        containerClass={styles.container}
        labelClass={styles.label}
        theme={theme}
      />
      <SecondarySelect
        value={current}
        defaultValue={current}
        options={modes}
        onChange={(option) => {
          if (!option || option.value === effect.color.kind) return;
          const color =
            option.value === 'Gradient'
              ? {
                  kind: option.value,
                  gradient: cloneGradient(defaultMulticolor),
                  size: { value: currentSize },
                }
              : option.value === 'Color'
                ? {
                    kind: option.value,
                    color: rgbFromHex(DEFAULT_COLOR),
                    size: { value: currentSize },
                  }
                : { kind: option.value, value: currentSize };
          onSelect({ ...effect, color });
        }}
      />
      {effect.color.kind === 'Color' && (
        <ColorPicker
          hex={rgbToHex(effect.color.color.r, effect.color.color.g, effect.color.color.b)}
          onSelect={(color) =>
            onSelect({
              ...effect,
              color: { kind: 'Color', color: color.toRgb(), size: { value: currentSize } },
            })
          }
          flavor="normal"
          zIndexContext="base"
        />
      )}
      {effect.color.kind === 'Gradient' && (
        <GradientPicker
          containerType="html"
          maxStops={device.capabilityData.keyboardMouseLighting.maxGradientCount}
          gradient={cloneGradient(effect.color.gradient)}
          onSelect={(gradient) =>
            onSelect({
              ...effect,
              color: {
                kind: 'Gradient',
                gradient: cloneGradient(gradient),
                size: {
                  value: Math.max(
                    Math.min(gradient.length, MAX_RIPPLE_SIZE),
                    Math.min(currentSize, MAX_RIPPLE_SIZE),
                  ),
                },
              },
            })
          }
          zIndexContext="base"
          flavor="normal"
          disabled={false}
        />
      )}
      <KeyboardSize
        minSize={minSize}
        maxSize={MAX_RIPPLE_SIZE}
        size={currentSize}
        onChangeTailSize={(value) => {
          const clamped = Math.max(minSize, Math.min(value, MAX_RIPPLE_SIZE));
          const color: SnapshotIn<typeof RippleEffect>['color'] =
            effect.color.kind === 'Gradient' || effect.color.kind === 'Color'
              ? { ...effect.color, size: { value: clamped } }
              : { ...effect.color, value: clamped };
          onSelect({ ...effect, color });
        }}
        containerClass={styles.container}
        labelClass={styles.label}
      />
      <KeyboardSpeed
        speedPercent={effect.speedPercent}
        onChangeSpeed={(speedPercent) => onSelect({ ...effect, speedPercent })}
        containerClass={styles.container}
        labelClass={styles.label}
      />
    </div>
  );
});
