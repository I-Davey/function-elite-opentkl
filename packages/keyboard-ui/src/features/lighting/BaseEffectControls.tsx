import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import type { SnapshotIn } from 'mobx-state-tree';
import type {
  ColorEffect,
  CoveringMarqueeEffect,
  PulseColorEffect,
  ShiftColorEffect,
  SolidGradient2Effect,
  WaveEffect,
} from '../../models/BaseZoneEffects.js';
import type { ColorTypeNoPicker } from '../../models/KeyEffectColors.js';
import { DEFAULT_COLOR, DEFAULT_PULSE_COLORS } from '../../models/lightingConstants.js';
import {
  KeyboardMouseLightingDirection,
  KeyboardMouseGradientType,
} from '../../models/keyboardEnums.js';
import { getMaxWaveSize } from '../../models/effectUtils.js';
import { rgbFromHex, rgbToHex } from '../../theme/color.js';
import { cloneGradient, defaultMulticolor, defaultGradients } from '../../theme/gradients.js';
import { ColorPicker } from '../../components/ColorPicker.js';
import { GradientPicker } from '../../components/GradientPicker.js';
import { SecondarySelect } from '../../components/Select.js';
import { KeyboardDirection } from './KeyboardDirection.js';
import { KeyboardGradientType } from './KeyboardGradientType.js';
import { KeyboardSize } from './KeyboardSize.js';
import { KeyboardSpeed } from './KeyboardSpeed.js';
import type { EffectControlProps, BaseControlClasses } from './types.js';

const gradientColor = (
  kind: 'Gradient' | 'Rainbow' | 'Random',
): SnapshotIn<typeof ColorTypeNoPicker> =>
  kind === 'Gradient' ? { kind, gradient: cloneGradient(defaultMulticolor) } : { kind };

/** Solid base colour emits the same RGB snapshot through its owning lighting surface. */
export const ColorControls = observer(function ColorControls({
  effectSettings: effect,
  onSelect,
}: Pick<EffectControlProps<typeof ColorEffect>, 'effectSettings' | 'onSelect'>) {
  return (
    <ColorPicker
      hex={rgbToHex(effect.color.r, effect.color.g, effect.color.b)}
      onSelect={(color) => onSelect({ ...effect, color: color.toRgb() })}
      flavor="normal"
      zIndexContext="base"
    />
  );
});

/** Pulse pads added colours from the preset palette and preserves count-selection defaults. */
export const PulseColorControls = observer(function PulseColorControls({
  effectSettings: effect,
  onSelect,
  readyKeyboardDevice: device,
  styles,
}: Omit<EffectControlProps<typeof PulseColorEffect>, 'theme'> & { styles: BaseControlClasses }) {
  const { t } = useTranslation();
  const counts = Array.from(
    { length: device.capabilityData.keyboardMouseLighting.maxGradientCount },
    (_, index) => ({
      value: index + 1,
      label:
        index === 0 ? t('keyboard:1Color') : t('keyboard:xColors', { numberOfColors: index + 1 }),
    }),
  );
  const modes = (['Colors', 'Rainbow', 'Random'] as const).map((value) => ({
    value,
    label: t(`keyboard:${value.toLowerCase()}`),
  }));
  const current = modes.find((option) => option.value === effect.color.kind) ?? modes[0];
  return (
    <div className={styles.container}>
      <SecondarySelect
        value={current}
        defaultValue={current}
        options={modes}
        onChange={(option) => {
          if (option && effect.color.kind !== option.value)
            onSelect({
              ...effect,
              color:
                option.value === 'Colors'
                  ? { kind: 'Colors', colors: DEFAULT_PULSE_COLORS.map(rgbFromHex) }
                  : { kind: option.value },
            });
        }}
      />
      {effect.color.kind === 'Colors' && (
        <>
          <h2 className={styles.label}>{t('keyboard:numberOfColors')}</h2>
          <SecondarySelect
            value={counts.find(
              (option) =>
                option.value ===
                (effect.color.kind === 'Colors' ? effect.color.colors.length || 2 : 2),
            )}
            defaultValue={counts[0]}
            options={counts}
            menuPlacement="top"
            onChange={(option) => {
              if (!option || effect.color.kind !== 'Colors') return;
              const colors = effect.color.colors,
                count = option.value;
              const extra = Array.from(
                { length: Math.max(0, count - colors.length) },
                (_, index) => {
                  const colorIndex = colors.length + index,
                    repeated =
                      colorIndex < DEFAULT_PULSE_COLORS.length
                        ? colorIndex
                        : colorIndex - DEFAULT_PULSE_COLORS.length;
                  return rgbFromHex(DEFAULT_PULSE_COLORS[repeated] ?? DEFAULT_PULSE_COLORS[0]);
                },
              );
              onSelect({
                ...effect,
                color: {
                  kind: 'Colors',
                  colors: count < colors.length ? colors.slice(0, count) : [...colors, ...extra],
                },
              });
            }}
          />
          <div className={styles.colorPickers}>
            {effect.color.colors.map((color, index) => (
              <ColorPicker
                key={index}
                hex={rgbToHex(color.r, color.g, color.b)}
                flavor="minimal"
                onSelect={(value) => {
                  if (effect.color.kind === 'Colors') {
                    const colors = effect.color.colors.slice();
                    colors[index] = value.toRgb();
                    onSelect({ ...effect, color: { ...effect.color, colors } });
                  }
                }}
              />
            ))}
          </div>
        </>
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

/** Shift changes colour modes without dropping the selected effect's speed. */
export const ShiftColorControls = observer(function ShiftColorControls({
  effectSettings: effect,
  onSelect,
  readyKeyboardDevice: device,
  styles,
}: Omit<EffectControlProps<typeof ShiftColorEffect>, 'theme'>) {
  const { t } = useTranslation();
  const modes = (['Gradient', 'Rainbow', 'Random'] as const).map((value) => ({
    value,
    label: t(`keyboard:${value.toLowerCase()}`),
  }));
  const current = modes.find((option) => option.value === effect.color.kind) ?? modes[0];
  return (
    <div className={styles.container}>
      <SecondarySelect
        value={current}
        defaultValue={current}
        options={modes}
        onChange={(option) => {
          if (option && option.value !== effect.color.kind)
            onSelect({ ...effect, color: gradientColor(option.value) });
        }}
      />
      {effect.color.kind === 'Gradient' && (
        <GradientPicker
          containerType="html"
          maxStops={device.capabilityData.keyboardMouseLighting.maxGradientCount}
          gradient={cloneGradient(effect.color.gradient)}
          onSelect={(gradient) => onSelect({ ...effect, color: { kind: 'Gradient', gradient } })}
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

/** Marquee perimeter movement remains restricted to Left/Right. */
export const CoveringMarqueeControls = observer(function CoveringMarqueeControls({
  effectSettings: effect,
  onSelect,
  readyKeyboardDevice: device,
  perimeter,
  styles,
  theme,
}: EffectControlProps<typeof CoveringMarqueeEffect>) {
  const { t } = useTranslation();
  const directions = [
    KeyboardMouseLightingDirection.Left,
    KeyboardMouseLightingDirection.Right,
  ].map((value) => ({ value, label: t(`keyboard:direction-${value}`) }));
  const modes = (['Gradient', 'Rainbow', 'Random'] as const).map((value) => ({
    value,
    label: t(`keyboard:${value.toLowerCase()}`),
  }));
  return (
    <div className={styles.container}>
      <KeyboardDirection
        direction={effect.direction}
        onChange={(direction) => onSelect({ ...effect, direction })}
        containerClass={styles.container}
        labelClass={styles.label}
        theme={theme}
        options={perimeter ? directions : undefined}
      />
      <SecondarySelect
        value={modes.find((option) => option.value === effect.color.kind)}
        defaultValue={modes[0]}
        options={modes}
        onChange={(option) => {
          if (option && option.value !== effect.color.kind)
            onSelect({ ...effect, color: gradientColor(option.value) });
        }}
      />
      {effect.color.kind === 'Gradient' && (
        <GradientPicker
          containerType="html"
          maxStops={device.capabilityData.keyboardMouseLighting.maxGradientCount}
          gradient={cloneGradient(effect.color.gradient)}
          onSelect={(gradient) => onSelect({ ...effect, color: { kind: 'Gradient', gradient } })}
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

/** Static gradient keeps the separate 0–100 editor data and Horizontal/Radial perimeter options. */
export const SolidGradient2Controls = observer(function SolidGradient2Controls({
  effectSettings: effect,
  onSelect,
  readyKeyboardDevice: device,
  perimeter,
  styles,
}: Omit<EffectControlProps<typeof SolidGradient2Effect>, 'theme'>) {
  const { t } = useTranslation();
  const directions = [KeyboardMouseGradientType.Horizontal, KeyboardMouseGradientType.Radial].map(
    (value) => ({ value, label: t(`keyboard:direction-${value}`) }),
  );
  return (
    <div className={styles.container}>
      <GradientPicker
        containerType="html"
        maxStops={device.capabilityData.keyboardMouseLighting.maxGradientCount}
        gradient={cloneGradient(effect.gradient)}
        onSelect={(gradient) => onSelect({ ...effect, gradient: cloneGradient(gradient) })}
        zIndexContext="base"
        flavor="normal"
        disabled={false}
      />
      <KeyboardGradientType
        gradientType={effect.gradientType}
        onChange={(gradientType) => onSelect({ ...effect, gradientType })}
        containerClass={styles.container}
        labelClass={styles.label}
        options={perimeter ? directions : undefined}
      />
    </div>
  );
});

/** Wave size stays tied to the selected colour mode, direction and physical keyboard width. */
export const WaveControls = observer(function WaveControls({
  effectSettings: effect,
  readyKeyboardDevice: device,
  onSelect,
  perimeter,
  styles,
  theme,
}: EffectControlProps<typeof WaveEffect> & { styles: BaseControlClasses }) {
  const { t } = useTranslation();
  const directions = [
    KeyboardMouseLightingDirection.Left,
    KeyboardMouseLightingDirection.Right,
  ].map((value) => ({ value, label: t(`keyboard:direction-${value}`) }));
  const modes = (['Rainbow', 'Color', 'Gradient'] as const).map((value) => ({
    value,
    label: t(`keyboard:${value.toLowerCase()}`),
  }));
  const current = modes.find((option) => option.value === effect.color.kind) ?? modes[0];
  return (
    <div className={styles.container}>
      <KeyboardDirection
        direction={effect.direction}
        onChange={(direction) => onSelect({ ...effect, direction })}
        containerClass={styles.container}
        labelClass={styles.label}
        theme={theme}
        options={perimeter ? directions : undefined}
      />
      <SecondarySelect
        value={current}
        defaultValue={current}
        options={modes}
        onChange={(option) => {
          if (!option || option.value === effect.color.kind) return;
          const color =
            option.value === 'Gradient'
              ? { kind: option.value, gradient: defaultMulticolor }
              : option.value === 'Color'
                ? {
                    kind: option.value,
                    color: rgbFromHex(DEFAULT_COLOR),
                    size: { value: getMaxWaveSize(device, option.value, effect.direction)! },
                  }
                : {
                    kind: option.value,
                    value: getMaxWaveSize(device, option.value, effect.direction)!,
                  };
          onSelect({ ...effect, color });
        }}
      />
      {effect.color.kind === 'Color' && (
        <ColorPicker
          hex={rgbToHex(effect.color.color.r, effect.color.color.g, effect.color.color.b)}
          onSelect={(color) => {
            if (effect.color.kind === 'Color')
              onSelect({
                ...effect,
                color: {
                  kind: 'Color',
                  color: color.toRgb(),
                  size: { value: effect.color.size.value },
                },
              });
          }}
          flavor="normal"
          zIndexContext="base"
        />
      )}
      {effect.color.kind === 'Gradient' && (
        <div className={styles.row}>
          <GradientPicker
            containerType="html"
            maxStops={device.capabilityData.keyboardMouseLighting.maxGradientCount}
            gradient={cloneGradient(effect.color.gradient || defaultGradients[0])}
            onSelect={(gradient) => {
              if (effect.color.kind === 'Gradient')
                onSelect({ ...effect, color: { kind: 'Gradient', gradient } });
            }}
            zIndexContext="base"
            flavor="normal"
            disabled={false}
          />
        </div>
      )}
      {effect.color.kind !== 'Gradient' && (
        <KeyboardSize
          maxSize={getMaxWaveSize(device, effect.color.kind, effect.direction)!}
          size={effect.color.kind === 'Color' ? effect.color.size.value : effect.color.value}
          onChangeTailSize={(value) => {
            const color =
              effect.color.kind === 'Color'
                ? { ...effect.color, size: { value } }
                : { ...effect.color, value };
            onSelect({ ...effect, color });
          }}
          containerClass={styles.container}
          labelClass={styles.label}
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
