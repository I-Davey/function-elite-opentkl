import type { VerificationServices } from '../src/verification.js';

let services: VerificationServices | null = null;

/** Test-only module state; values are the exact references supplied by the running application. */
export function configureVerification(actual: VerificationServices): void {
  if (services) throw Error('Verification services already configured');
  services = actual;
}

export function getVerificationServices(): VerificationServices {
  if (!services) throw Error('Verification services have not been configured');
  return services;
}

/** A receipt proves the result came from this run's external instrumentation, not an older embedded suite. */
export function reportVerification(
  result: Parameters<VerificationServices['activeContext']['host']['testReport']>[0],
): void {
  const verificationToken = new URLSearchParams(location.search).get('verificationToken');
  if (!verificationToken) throw Error('Verification launch token is missing');
  getVerificationServices().activeContext.host.testReport({ ...result, verificationToken });
}
