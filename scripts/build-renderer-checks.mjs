import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { rendererJsxOptions } from './renderer-compiler-options.mjs';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Build external instrumentation without changing the production package being verified. */
export async function buildRendererChecks() {
  const file = path.join(workspace, '.build/renderer-checks/checks.mjs');
  const result = await build({
    absWorkingDir: workspace,
    entryPoints: ['packages/renderer/checks/entry.ts'],
    bundle: true,
    platform: 'browser',
    ...rendererJsxOptions,
    format: 'esm',
    target: 'chrome128',
    outfile: file,
    metafile: true,
    logLevel: 'warning',
    logOverride: { 'import-is-undefined': 'error' },
  });
  const inputs = Object.keys(result.metafile.inputs);
  const duplicated = inputs.filter((input) => input.startsWith('packages/renderer/src/') ||
    input.includes('/platform/') || input.startsWith('node_modules/'));
  if (duplicated.length)
    throw Error('External checks bundled application services or dependencies: ' + duplicated.join(', '));
  const hash = (input) => crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex');
  const report = {
    at: new Date().toISOString(),
    file,
    sha256: hash(file),
    bytes: fs.statSync(file).size,
    inputs: inputs.map((input) => ({ file: input, sha256: hash(path.join(workspace, input)) })),
    applicationInstances: 'Supplied by the already-mounted renderer; no bundled stores, React, MST or platform singletons.',
    runtimeVerification: 'not-run-by-this-build',
  };
  fs.mkdirSync(path.join(workspace, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'reports/verification-bundle.json'),
    JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await buildRendererChecks();
  console.log(JSON.stringify({ file: result.file, bytes: result.bytes, inputs: result.inputs.length }));
}
