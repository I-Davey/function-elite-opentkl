import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const component = path.join(root, 'native/keyboard-core');
const output = path.join(root, 'dist/native/keyboard-core');
const target = path.join(root, '.build/native');
fs.mkdirSync(path.join(target, 'logs'), { recursive: true });
const environment = { ...process.env, CARGO_TARGET_DIR: target };
environment.CARGO_ENCODED_RUSTFLAGS = [
  ...(process.env.CARGO_ENCODED_RUSTFLAGS?.split('\x1f') ?? process.env.RUSTFLAGS?.split(/\s+/).filter(Boolean) ?? []),
  `--remap-path-prefix=${root}=workspace`,
  ...(process.env.USERPROFILE ? [`--remap-path-prefix=${process.env.USERPROFILE}=user`] : []),
].join('\x1f');
function cargo(args, name) {
  const result = spawnSync('cargo', args, {
    cwd: component, env: environment, windowsHide: true, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(target, 'logs', name + '.log'), (result.stdout ?? '') + (result.stderr ?? ''));
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(result.stderr || result.stdout || 'Cargo failed');
  return result.stdout;
}
if (process.argv.includes('--check')) cargo(['test', '--locked'], 'tests');
cargo(['build', '--release', '--locked'], 'build');
const metadata = JSON.parse(cargo(['metadata', '--format-version', '1', '--locked'], 'metadata'));
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const binary = path.join(target, 'release/nzxt-keyboard-core.exe');
const binaryHash = hash(binary);
const executable = 'native/keyboard-core/bin/nzxt-keyboard-core-' + binaryHash.slice(0, 16) + '.exe';
fs.mkdirSync(path.dirname(path.join(root, 'dist', executable)), { recursive: true });
const installedBinary = path.join(root, 'dist', executable);
if (!fs.existsSync(installedBinary)) fs.copyFileSync(binary, installedBinary);
else if (hash(installedBinary) !== binaryHash) throw Error('Packaged native binary does not match its content hash');
const inputs = ['Cargo.toml', 'Cargo.lock', ...fs.readdirSync(path.join(component, 'src'))
  .filter((name) => name.endsWith('.rs')).sort().map((name) => 'src/' + name)];
for (const file of inputs) {
  fs.mkdirSync(path.dirname(path.join(output, file)), { recursive: true });
  fs.copyFileSync(path.join(component, file), path.join(output, file));
}
fs.cpSync(path.join(root, 'resources/keyboard'), path.join(root, 'dist/resources/keyboard'), { recursive: true });
const sourceInputs = inputs.map((file) => ({ file, sha256: hash(path.join(component, file)) }));
for (const file of ['key-layout.json', 'offline-device.json', 'actuation-read.json']) {
  sourceInputs.push({ file: '../../resources/keyboard/' + file, sha256: hash(path.join(root, 'resources/keyboard', file)) });
}
// Notices come from Cargo's downloaded, locked dependencies, never a private vendor directory.
const dependencies = metadata.packages.filter((entry) => entry.source).map((entry) => {
  const directory = path.dirname(entry.manifest_path);
  const notices = fs.readdirSync(directory).filter((file) => /^(LICENSE|COPYING|NOTICE)/i.test(file) &&
    fs.statSync(path.join(directory, file)).isFile());
  if (!notices.length) throw Error('Missing dependency notices: ' + entry.name);
  for (const file of notices) {
    const destination = path.join(root, 'dist/notices/rust', entry.name + '-' + entry.version, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(directory, file), destination);
  }
  return { name: entry.name, version: entry.version, license: entry.license, notices };
});
fs.writeFileSync(path.join(output, 'dependencies.json'), JSON.stringify(dependencies, null, 2) + '\n');
const report = { status: 'built', nativeLanguage: 'Rust', output: executable, outputSha256: binaryHash,
  sourceInputs, hardwareExecuted: false };
fs.writeFileSync(path.join(output, 'build-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, executable, sourceInputs: sourceInputs.length }));
