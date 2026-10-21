import { configureVerification } from './runtime.js';
import type { VerificationServices } from '../src/verification.js';

/** Select one suite after the real renderer has completed composition. */
export async function runChecks(services: VerificationServices): Promise<void> {
  configureVerification(services);
  const query = new URLSearchParams(location.search);
  if (query.has('analogueTest')) await import('./analogue-selftest.js');
  else if (query.has('brightness')) await import('./brightness-selftest.js');
  else if (query.has('parity')) await import('./parity-selftest.js');
  else if (query.has('live')) await import('./live-native-checks.js');
  else await import('./selftest.js');
}
