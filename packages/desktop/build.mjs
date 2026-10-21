import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const stageFlag = args.indexOf('--stage');
const destination =
  stageFlag >= 0 ? path.resolve(args[stageFlag + 1]) : path.join(workspace, 'dist/app');
if (!check && stageFlag < 0 && !args.includes('--emit')) {
  throw Error('Use --check, --stage <app directory>, or --emit to update runtime outputs');
}
const compile = spawnSync(
  process.execPath,
  [
    path.join(workspace, 'node_modules/typescript/bin/tsc'),
    '--project',
    path.join(workspace, 'tsconfig.desktop.json'),
    ...(check ? ['--noEmit'] : []),
  ],
  { cwd: workspace, stdio: 'inherit', windowsHide: true },
);
if (compile.error) throw compile.error;
if (compile.status !== 0) process.exit(compile.status ?? 1);
if (check) process.exit(0);

const build = path.join(workspace, '.build/desktop');
const source = path.join(build, 'desktop/src');
// A removed service must not survive as an old compiler/runtime output in the next package.
for (const directory of [path.join(source, 'main'), path.join(destination, 'main')]) {
  for (const extension of ['cjs', 'cjs.map', 'd.cts']) {
    const retired = path.join(directory, 'windows-bridge.' + extension);
    if (fs.existsSync(retired)) fs.unlinkSync(retired);
  }
}
const emitted = [];
function copy(input, relative, contract = false) {
  const target = path.join(destination, relative);
  let text = fs.readFileSync(input, 'utf8');
  // Compiler paths refer to workspace packages. Preserve existing runtime/module layout.
  text = text.replace(/(['"])\.\.\/\.\.\/\.\.\/backend\/src\/([^'"]+)\1/g, '$1../../backend/$2$1');
  text = text.replace(
    /(['"])\.\.\/\.\.\/backend\/src\/([^'"]+)\1/g,
    contract ? '$1../../backend/$2$1' : '$1../backend/$2$1',
  );
  text = text.replace(
    /(['"])(?:\.\.\/){2,3}contracts\/(desktop(?:-[a-z]+)?)\.cjs\1/g,
    (_all, quote, name) =>
      `${quote}${relative.startsWith('main/') ? './' : './main/'}${name === 'desktop' ? 'desktop-contracts' : name}.cjs${quote}`,
  );
  if (contract) text = text.replace(/(['"])\.\/desktop\.cjs\1/g, '$1./desktop-contracts.cjs$1');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
  emitted.push(relative);
}
for (const entry of fs.readdirSync(source, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.cjs')) continue;
  const input = path.join(entry.parentPath, entry.name);
  copy(input, path.relative(source, input).replaceAll('\\', '/'));
}
for (const entry of fs.readdirSync(path.join(build, 'contracts'))) {
  if (!entry.startsWith('desktop') || !entry.endsWith('.cjs')) continue;
  const name = entry === 'desktop.cjs' ? 'desktop-contracts.cjs' : entry;
  copy(path.join(build, 'contracts', entry), 'main/' + name, true);
}
console.log(JSON.stringify({ component: 'desktop', destination, emitted }, null, 2));
