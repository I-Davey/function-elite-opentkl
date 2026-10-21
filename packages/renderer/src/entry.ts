import { applicationReady } from './mount.js';
import { runVerification } from './verification.js';

const query = new URLSearchParams(window.location.search);
if (query.has('test')) {
  void runVerification(query.get('checks'), applicationReady).catch((error: unknown) => {
    window.keyboardHost.testReport({
      status: 'failed',
      cases: [{ name: 'verification bootstrap', status: 'failed', error: String(error) }],
    });
  });
}
