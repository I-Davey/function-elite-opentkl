import type {
  ApplicationStateCoordinator,
  StateTicket,
} from '../../application-state/src/index.js';
import type { DesktopLifecycleSnapshot } from '../../contracts/desktop.cjs';

/** Desktop queue activity is metadata; renderer intents remain owned by the coordinator. */
export function createDesktopLifecycleMirror<TEdit, TResult>(
  state: ApplicationStateCoordinator<TEdit, TResult>,
) {
  let recoveryTicket: StateTicket | null = null;
  let recoveryStatus = '';
  return (value: DesktopLifecycleSnapshot): void => {
    // Counts change on every native operation even when recovery status is identical.
    state.setDesktopActivity(value);
    const key = JSON.stringify(value.recovery);
    if (key === recoveryStatus) return;
    recoveryStatus = key;
    const reason = value.recovery.reason ?? 'Restore keyboard session';
    if (value.recovery.status === 'waiting') state.requestRecovery(reason);
    else if (value.recovery.status === 'running') recoveryTicket = state.beginRecovery(reason);
    else if (value.recovery.status === 'failed') {
      recoveryTicket ??= state.beginRecovery(reason);
      if (state.isCurrent(recoveryTicket))
        state.finishRecovery(recoveryTicket, Error(value.recovery.error ?? reason));
      recoveryTicket = null;
    } else if (recoveryTicket) {
      if (state.isCurrent(recoveryTicket)) state.finishRecovery(recoveryTicket);
      recoveryTicket = null;
    }
  };
}
