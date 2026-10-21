import { types, type Instance, type SnapshotIn } from 'mobx-state-tree';
/** IdleTimeout. Recovered from src/renderer/models/common/IdleTimeout.ts. */
const IdleTimeout = types
  .model('IdleTimeout', {
    disabled: types.boolean,
    timeoutSeconds: types.number,
  })
  .actions((self) => ({
    setDisabled(state: typeof self.disabled) {
      self.disabled = state;
    },
    setTimeoutSeconds(timeoutSeconds: typeof self.timeoutSeconds) {
      self.timeoutSeconds = timeoutSeconds;
    },
  }));
export { IdleTimeout };

export type IdleTimeoutInstance = Instance<typeof IdleTimeout>;
export type IdleTimeoutSnapshot = SnapshotIn<typeof IdleTimeout>;
