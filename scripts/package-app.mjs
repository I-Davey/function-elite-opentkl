import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { collectRendererNotices } from './renderer-notices.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const distribution = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const renderer = collectRendererNotices(root);
const nativeBuild = JSON.parse(fs.readFileSync(path.join(distribution, 'native/keyboard-core/build-report.json'), 'utf8'));
const output = path.join(distribution, 'releases', 'Function-Elite-OpenTKL-' + manifest.version + '-' + new Date().toISOString().replaceAll(':', '-'));
fs.mkdirSync(output, { recursive: true });
for (const directory of ['app', 'backend', 'native', 'resources', 'notices']) {
  fs.cpSync(path.join(distribution, directory), path.join(output, directory), { recursive: true,
    filter: source => !source.startsWith(path.join(distribution, 'native/keyboard-core/bin') + path.sep) || source === path.join(distribution, nativeBuild.output),
  });
}
const copy = (source, destination) => {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};
for (const dependency of renderer.packages) {
  for (const notice of dependency.notices) copy(path.join(root, notice.source), path.join(output, notice.destination));
}
const electron = path.dirname(require('electron'));
for (const entry of fs.readdirSync(electron)) {
  fs.cpSync(path.join(electron, entry), path.join(output, 'runtime', entry === 'electron.exe' ? 'Function Elite OpenTKL.exe' : entry), { recursive: true });
}
const application = path.join(output, 'runtime/resources/app');
fs.mkdirSync(application, { recursive: true });
fs.writeFileSync(path.join(application, 'package.json'), JSON.stringify({ name: manifest.name, version: manifest.version, main: 'main.cjs' }));
fs.writeFileSync(path.join(application, 'main.cjs'), "require('../../../app/main.cjs');\n");
fs.writeFileSync(path.join(output, 'Start Keyboard.cmd'),
  '@echo off\r\nstart "" "%~dp0runtime\\Function Elite OpenTKL.exe"\r\n');
copy(path.join(root, 'README.md'), path.join(output, 'README.md'));
for (const notice of ['LICENSE', 'NOTICE']) copy(path.join(root, notice), path.join(output, notice));
fs.writeFileSync(path.join(output, 'DEPENDENCIES.json'), JSON.stringify({
  renderer,
  rust: JSON.parse(fs.readFileSync(path.join(distribution, 'native/keyboard-core/dependencies.json'), 'utf8')),
  electron: require('electron/package.json').version,
  runtimeNotices: ['runtime/LICENSE', 'runtime/LICENSES.chromium.html'],
}, null, 2) + '\n');
const files = [];
function inventory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) inventory(file);
    else files.push({ file: path.relative(output, file).replaceAll('\\', '/'), bytes: fs.statSync(file).size,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
  }
}
inventory(output);
const report = { status: 'packaged', output, files, bytes: files.reduce((sum, entry) => sum + entry.bytes, 0) };
fs.writeFileSync(path.join(distribution, 'package-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, output, files: files.length }));
