import { getSnapshot } from 'mobx-state-tree';
import { getKeyBrightnessControl } from '../../ui-platform/src/brightness-diagnostics.cjs';
import { captureControlSnapshot } from './control-model-adapter.js';
import type { RendererContext } from './context.js';

/** External checks receive the running app's instances, so bundling cannot create duplicate stores. */
export interface VerificationServices {
  activeContext: RendererContext;
  getSnapshot: typeof getSnapshot;
  getKeyBrightnessControl: typeof getKeyBrightnessControl;
  captureControlSnapshot: typeof captureControlSnapshot;
}

/** Only the desktop's explicit test launch supplies a local check bundle; ordinary startup loads none. */
export async function runVerification(
  bundle: string | null,
  applicationReady: Promise<RendererContext>,
): Promise<void> {
  if (!bundle) throw Error('Test launch requires an external verification bundle');
  const url = new URL(bundle);
  if (url.protocol !== 'file:' || url.search || url.hash)
    throw Error('Verification bundle must be a local file URL without query or fragment');
  const activeContext = await applicationReady;
  const checks: unknown = await import(url.href);
  if (!checks || typeof checks !== 'object' || !('runChecks' in checks) ||
      typeof checks.runChecks !== 'function')
    throw Error('Verification bundle does not export runChecks');
  await checks.runChecks({
    activeContext,
    getSnapshot,
    getKeyBrightnessControl,
    captureControlSnapshot,
  } satisfies VerificationServices);
}
