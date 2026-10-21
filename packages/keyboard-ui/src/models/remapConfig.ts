import { toJS } from 'mobx';
import type { Remap } from '../../../backend/src/contracts.cjs';
import type { RemapInstance } from './Remap.js';
import type { PhysicalKeyInstance } from './KeyRemapSettings.js';
import type { ValidActuationTypes } from './remapKeyUtils.js';
import type { ActuationConfig } from '../../../backend/src/contracts.cjs';
import type { PhysicalKeySnapshot } from './KeyRemapSettings.js';

export interface MacroSlotInfo {
  name?: string;
  macroId?: string;
  fnName?: string;
  fnMacroId?: string;
}

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined) throw Error(`Missing ${field} in remapConfig`);
  return value;
}

/** Attach local macro names/IDs to wire actions, preserving base and Fn slot identity. */
export function fromCoreRemapConfig(
  config: ActuationConfig | { kind: 'NoConfigurableActuation'; remap: Remap },
  macroInfo: MacroSlotInfo[],
  valid: ValidActuationTypes,
): PhysicalKeySnapshot['active'] {
  const output = (remap: Remap, index: number, isFn = false) => {
    if (remap.kind !== 'Macro') return remap;
    const info = macroInfo[index];
    return {
      ...remap,
      ...(info
        ? isFn
          ? { name: info.fnName, id: info.fnMacroId }
          : { name: info.name, id: info.macroId }
        : {}),
    };
  };
  switch (config.kind) {
    case 'NoConfigurableActuation':
      return { kind: config.kind, remapTo: output(config.remap, 0) };
    case 'Dual': {
      const level1 =
        valid.Dual.reverseValidLevels[required(config.level1, 'level1').valueMicroMeters];
      const level2 =
        valid.Dual.reverseValidLevels[required(config.level2, 'level2').valueMicroMeters];
      const remap1 = required(config.remapLevel1, 'remapLevel1');
      const remap2 = required(config.remapLevel2, 'remapLevel2');
      if (level1 === undefined || level2 === undefined)
        throw Error('Invalid actuation level provided in remapConfig');
      return {
        kind: 'Dual',
        actuation: { level1, level2 },
        remapTo: [output(remap1.nonePressed, 0), output(remap2.nonePressed, 1)],
        fnPressed: {
          remapTo: [output(remap1.fnPressed, 0, true), output(remap2.fnPressed, 1, true)],
        },
      };
    }
    case 'Rapid':
    case 'Single': {
      // CAM resolves both kinds through the Single table; retain that lookup.
      const level =
        valid.Single.reverseValidLevels[required(config.level, 'level').valueMicroMeters];
      const remap = required(config.remap, 'remap');
      if (level === undefined) throw Error('Invalid level provided in remapConfig');
      return {
        kind: 'Single',
        actuation: {
          level,
          isRapidTrigger: config.kind === 'Rapid',
          rapidSensitivity:
            config.kind === 'Rapid'
              ? valid.Rapid.reverseValidSensitivity[
                  required(config.sensitivity, 'sensitivity').valueMicroMeters
                ]
              : 4,
        },
        remapTo: output(remap.nonePressed, 0),
        fnPressed: { remapTo: output(required(remap.fnPressed, 'Fn remap'), 0, true) },
      };
    }
  }
}

function toCoreRemapType(remap: RemapInstance): Remap {
  switch (remap.kind) {
    case 'SimpleRemap':
      return { kind: remap.kind, targetKeyId: remap.targetKeyId };
    case 'Modifier':
      return { kind: remap.kind, modifier: remap.modifier };
    case 'Macro':
      return {
        kind: remap.kind,
        action: {
          repeatCount: toJS(remap.action.repeatCount),
          targetKeys: remap.action.targetKeys.map(({ targetKeyId, state, delaySeconds }) => ({
            targetKeyId,
            state,
            delaySeconds,
          })),
        },
      };
  }
}

/** Translate stored base/Fn outputs; a missing Fn model falls back to the base output. */
export function toCoreRemapConfig(active: PhysicalKeyInstance['active'], isFn = false) {
  switch (active.kind) {
    case 'NoConfigurableActuation':
      return { kind: active.kind, remap: toCoreRemapType(active.remapTo) };
    case 'Single': {
      const remapTo = isFn && active.fnPressed ? active.fnPressed.remapTo : active.remapTo;
      const modifier = isFn && active.fnPressed ? ('Fn' as const) : ('NonePressed' as const);
      return {
        kind: active.actuation.isRapidTrigger ? ('Rapid' as const) : active.kind,
        remap: toCoreRemapType(remapTo),
        modifier,
      };
    }
    case 'Dual': {
      const remaps = isFn && active.fnPressed ? active.fnPressed.remapTo : active.remapTo;
      if (remaps[0] === undefined || remaps[1] === undefined)
        throw Error('Dualstep requires two remaps');
      return {
        kind: active.kind,
        remapLevel1: toCoreRemapType(remaps[0]),
        remapLevel2: toCoreRemapType(remaps[1]),
        modifier: isFn && active.fnPressed ? ('Fn' as const) : ('NonePressed' as const),
      };
    }
  }
}

/** Resolve model indices against advertised micrometre tables; retain invalid-index errors. */
export function toCoreActuationConfig(
  active: PhysicalKeyInstance['active'],
  valid: ValidActuationTypes,
) {
  switch (active.kind) {
    case 'NoConfigurableActuation':
      throw Error('NoConfigurableActuation cannot be converted to ActuationConfig');
    case 'Single': {
      if (active.actuation.isRapidTrigger) {
        const level = valid.Rapid.validLevels[active.actuation.level];
        const sensitivity = valid.Rapid.validSensitivity[active.actuation.rapidSensitivity];
        if (level == null || sensitivity === undefined)
          throw Error('Invalid level or sensitivity provided in actuationConfig');
        return {
          kind: 'Rapid' as const,
          level: { valueMicroMeters: level },
          sensitivity: { valueMicroMeters: sensitivity },
        };
      }
      const level = valid.Single.validLevels[active.actuation.level];
      if (level === undefined) throw Error('Invalid level provided in actuationConfig');
      return { kind: active.kind, level: { valueMicroMeters: level } };
    }
    case 'Dual': {
      const level1 = valid.Dual.validLevels[active.actuation.level1];
      const level2 = valid.Dual.validLevels[active.actuation.level2];
      if (level1 === undefined || level2 === undefined)
        throw Error('Invalid level provided in actuationConfig');
      return {
        kind: active.kind,
        level1: { valueMicroMeters: level1 },
        level2: { valueMicroMeters: level2 },
      };
    }
  }
}
