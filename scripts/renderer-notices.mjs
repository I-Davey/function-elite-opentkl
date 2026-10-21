import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slash = (value) => value.replaceAll('\\', '/');
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceFeature = (file) => file.match(/\/features\/([^/]+)\//)?.[1] ??
  file.match(/^packages\/([^/]+)\//)?.[1] ?? 'application';

/** Resolve notices from the exact installed package copies used by the current renderer graph. */
export function collectRendererNotices(root = workspace) {
  const local = (file) => {
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root + path.sep)) throw Error('Notice input escapes workspace: ' + file);
    return absolute;
  };
  const build = JSON.parse(fs.readFileSync(local('reports/renderer-build.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(local('package-lock.json'), 'utf8'));
  if (!build.inputDetails) throw Error('Rebuild renderer to collect its actual dependency edges');
  const consumers = new Map();
  for (const caller of build.inputs.filter((file) => file.startsWith('packages/'))) {
    const pending = [caller], seen = new Set();
    while (pending.length) {
      const file = pending.pop();
      if (seen.has(file)) continue;
      seen.add(file);
      if (file.startsWith('node_modules/')) {
        const users = consumers.get(file) ?? new Set();
        users.add(caller);
        consumers.set(file, users);
      }
      pending.push(...(build.inputDetails[file]?.imports ?? []).filter((entry) => !entry.external).map((entry) => entry.path));
    }
  }
  const extras = JSON.parse(fs.readFileSync(local('resources/notices/receipt.json'), 'utf8')).files;
  for (const entry of extras) {
    const file = local(entry.path);
    if (fs.statSync(file).size !== entry.bytes || hash(file) !== entry.sha256)
      throw Error('Pinned renderer notice changed: ' + entry.path);
  }
  const installed = new Map();
  for (const input of build.inputs.filter((file) => file.startsWith('node_modules/'))) {
    let directory = path.dirname(local(input)), found = false;
    while (directory.startsWith(path.join(root, 'node_modules') + path.sep)) {
      const manifestFile = path.join(directory, 'package.json');
      if (fs.existsSync(manifestFile)) {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        if (manifest.name && manifest.version) {
          const relative = slash(path.relative(root, directory));
          if (lock.packages[relative]?.version !== manifest.version)
            throw Error('Renderer package differs from lockfile: ' + relative);
          const item = installed.get(relative) ?? { root: relative, manifest, inputs: [] };
          item.inputs.push(input);
          installed.set(relative, item);
          found = true;
          break;
        }
      }
      directory = path.dirname(directory);
    }
    if (!found) throw Error('No installed package manifest for renderer input: ' + input);
  }
  const packages = [];
  for (const item of installed.values()) {
    const { name, version } = item.manifest;
    if (!/^(?:@[\w.-]+\/)?[\w.-]+$/.test(name) || !/^[\w.+-]+$/.test(version))
      throw Error('Invalid notice package identity: ' + name + '@' + version);
    const license = item.manifest.license ?? item.manifest.licenses;
    if (!license) throw Error('Renderer package has no license declaration: ' + item.root);
    const directory = local(item.root);
    const noticeFiles = fs.readdirSync(directory).filter((file) =>
      /^(?:licen[cs]e|copying|notice)(?:\.|$|-)/i.test(file) &&
      fs.statSync(path.join(directory, file)).isFile());
    let sources = noticeFiles.map((file) => ({ source: item.root + '/' + file }));
    if (!sources.length) {
      const readme = fs.readdirSync(directory).find((file) => /^readme(?:\.|$)/i.test(file));
      const text = readme ? fs.readFileSync(path.join(directory, readme), 'utf8') : '';
      const pinned = extras.filter((entry) => entry.package === name && entry.version === version);
      if (!pinned.length && !(text.includes('Permission is hereby granted') &&
          text.includes('THE SOFTWARE IS PROVIDED')))
        throw Error('Renderer package needs an original notice: ' + name + '@' + version);
      sources = [...(readme ? [{ source: item.root + '/' + readme }] : []),
        ...pinned.map((entry) => ({ source: entry.path, upstream: entry.source }))];
    }
    const notices = sources.map((entry) => ({
      ...entry,
      // Physical package paths keep notices separate when nested copies share a name/version.
      destination: 'notices/npm/' + item.root.slice('node_modules/'.length) + '/' + path.basename(entry.source),
      bytes: fs.statSync(local(entry.source)).size,
      sha256: hash(local(entry.source)),
    }));
    const callers = [...new Set(item.inputs.flatMap((file) => [...(consumers.get(file) ?? [])]))].sort();
    const typesRoot = 'node_modules/@types/' + name.replace(/^@/, '').replace('/', '__');
    const typesManifest = path.join(root, typesRoot, 'package.json');
    const externalTypes = fs.existsSync(typesManifest) ? JSON.parse(fs.readFileSync(typesManifest, 'utf8')) : null;
    packages.push({ name, version, license, installedRoot: item.root, inputs: item.inputs, notices,
      consumers: callers,
      features: [...new Set(callers.map(sourceFeature))].sort(),
      types: item.manifest.types || item.manifest.typings
        ? { source: item.root + '/' + (item.manifest.types ?? item.manifest.typings), version }
        : externalTypes ? { source: typesRoot + '/' + (externalTypes.types ?? externalTypes.typings ?? 'index.d.ts'), version: externalTypes.version } : null,
    });
  }
  packages.sort((a, b) => a.installedRoot.localeCompare(b.installedRoot));
  return {
    at: new Date().toISOString(),
    rendererSha256: hash(local('dist/app/renderer.js')),
    rendererBuildAt: build.at,
    lockfileSha256: hash(local('package-lock.json')),
    installedCopies: packages.length,
    packageVersions: new Set(packages.map((item) => item.name + '@' + item.version)).size,
    noticeFiles: packages.reduce((sum, item) => sum + item.notices.length, 0),
    packages,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = collectRendererNotices();
  fs.mkdirSync(path.join(workspace, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'reports/renderer-notices.json'),
    JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ installedCopies: report.installedCopies,
    packageVersions: report.packageVersions, notices: report.noticeFiles }));
}
