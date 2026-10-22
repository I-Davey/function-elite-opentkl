import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { rendererJsxOptions } from './renderer-compiler-options.mjs';
const workspace = process.cwd(),
  app = path.join(workspace, 'dist/app');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'package.json'), 'utf8'));
fs.mkdirSync(app, { recursive: true });
fs.copyFileSync(
  'packages/sensor-monitor/src/sensor-monitor.css',
  path.join(app, 'sensor-monitor.css'),
);
fs.copyFileSync('packages/renderer/src/application.css', path.join(app, 'application.css'));
fs.writeFileSync(
  path.join(app, 'package.json'),
  JSON.stringify({ name: manifest.name, version: manifest.version, main: 'main.cjs' }),
);
const result = await build({
  entryPoints: ['packages/renderer/src/entry.ts'],
  bundle: true,
  platform: 'browser',
  ...rendererJsxOptions,
  format: 'iife',
  target: 'chrome128',
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      process.argv.includes('--development') ? 'development' : 'production',
    ),
  },
  sourcemap: true,
  minify: false,
  outfile: path.join(app, 'renderer.js'),
  metafile: true,
  logLevel: 'warning',
  logOverride: { 'import-is-undefined': 'error' },
});
const checkInputs = Object.keys(result.metafile.inputs)
  .filter((file) => file.startsWith('packages/renderer/checks/'));
if (checkInputs.length)
  throw Error('Verification suites entered the production renderer: ' + checkInputs.join(', '));
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' file:; style-src 'self' 'unsafe-inline' file:; img-src file: data: blob:; font-src file: data:; connect-src 'none'">
<title>Function Elite OpenTKL</title><link rel="stylesheet" href="./sensor-monitor.css"><link rel="stylesheet" href="./application.css">
</head><body><main id="app"></main><pre id="preview-error" role="alert"></pre><script src="./renderer.js"></script></body></html>`;
fs.writeFileSync(path.join(app, 'index.html'), html);
fs.writeFileSync(
  'reports/renderer-build.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      entry: 'packages/renderer/src/entry.ts',
      inputs: Object.keys(result.metafile.inputs),
      inputDetails: result.metafile.inputs,
      outputs: result.metafile.outputs,
      webpackRegistry: false,
      legacyScriptsLoaded: false,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    status: 'built',
    sourceInputs: Object.keys(result.metafile.inputs).length,
    rendererBytes: fs.statSync(path.join(app, 'renderer.js')).size,
  }),
);
