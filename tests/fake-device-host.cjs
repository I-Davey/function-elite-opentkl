// Simulated transport for lifecycle tests; never opens a keyboard.
const readline = require('node:readline');
const send = (value) => process.stdout.write(JSON.stringify(value) + '\n');
const ready = () =>
  send({ protocolVersion: 1, event: 'ready', nativeLanguage: 'Rust', maxRequestBytes: 1048576 });
setTimeout(ready, Number(process.argv[2] || 0));
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line),
    payload = request.payload || {};
  if (payload.crash) process.exit(7);
  if (payload.hang) return;
  const response = {
    protocolVersion: 1,
    requestId: request.requestId + (payload.stale ? 1 : 0),
    ok: !payload.fail,
  };
  if (payload.fail) response.error = { code: 'MOCK_FAILURE', message: 'simulated device failure' };
  else
    response.result = {
      nativeLanguage: 'Rust',
      readOnly: !request.operation.startsWith('--apply-'),
      settingsWritePerformed: request.operation.startsWith('--apply-'),
      reportIoPerformed: request.operation !== '--enumerate',
      echo: payload,
    };
  setTimeout(() => send(response), payload.delay || 0);
});
