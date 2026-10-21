import { types, type Instance, type SnapshotIn } from 'mobx-state-tree';
/** SingleActuation. Recovered from src/renderer/capabilities/keyremap/models/Actuation.ts. */
const SingleActuation = types
  .model({
    isRapidTrigger: types.optional(types.boolean, false),
    level: types.number,
    rapidSensitivity: types.optional(types.number, 4),
  })
  .actions((self) => ({
    setLevel(level: typeof self.level) {
      self.level = level;
    },
    setRapidTrigger(isRapidTrigger: typeof self.isRapidTrigger) {
      self.isRapidTrigger = isRapidTrigger;
    },
    setRapidSensitivity(rapidSensitivity: typeof self.rapidSensitivity) {
      self.rapidSensitivity = rapidSensitivity;
    },
  }));
/** DualActuation. Recovered from src/renderer/capabilities/keyremap/models/Actuation.ts. */
const DualActuation = types
  .model({
    level1: types.number,
    level2: types.number,
  })
  .actions((self) => ({
    setLevel1(level: typeof self.level1) {
      self.level1 = level;
    },
    setLevel2(level: typeof self.level2) {
      self.level2 = level;
    },
  }));
export { SingleActuation, DualActuation };

export type SingleActuationInstance = Instance<typeof SingleActuation>;
export type SingleActuationSnapshot = SnapshotIn<typeof SingleActuation>;
export type DualActuationInstance = Instance<typeof DualActuation>;
export type DualActuationSnapshot = SnapshotIn<typeof DualActuation>;
