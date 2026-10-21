import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript-ast';
import { libraryImportProblems } from './audit-library-imports.mjs';
const roots = [
  'packages/backend/src',
  'packages/desktop/src',
  'packages/contracts',
  'packages/device-client/src',
  'packages/application-state/src',
  'packages/renderer-state/src',
  'packages/renderer/src',
  'packages/renderer/checks',
  'packages/keyboard-ui/src',
  'packages/sensor-monitor/src',
  'packages/ui-platform/src',
];
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    const normalized = file.replaceAll('\\', '/');
    if (normalized === 'packages/keyboard-ui/src/platform' ||
        normalized.startsWith('packages/keyboard-ui/src/platform/')) continue;
    if (item.isDirectory()) walk(file);
    else if (/\.[cm]?[jt]sx?$/.test(file)) files.push(file);
  }
}
for (const root of roots) walk(root);
const violations = [];
for (const file of files) {
  const body = fs.readFileSync(file, 'utf8'),
    source = ts.createSourceFile(
      file,
      body,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
  if (!/\.(?:[cm]?ts|tsx)$/.test(file) && !file.replaceAll('\\', '/').includes('/renderer/checks/'))
    violations.push({ file, kind: 'untyped production source' });
  for (const diagnostic of source.parseDiagnostics)
    violations.push({ file, kind: 'invalid syntax', detail: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n') });
  for (const problem of libraryImportProblems(body, file)) violations.push({ file, kind: problem });
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword)
      violations.push({
        file,
        kind: 'explicit any',
        line: source.getLineAndCharacterOfPosition(node.pos).line + 1,
      });
    const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
      ? node.moduleSpecifier : ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' ? node.arguments[0] : null;
    if (specifier && ts.isStringLiteralLike(specifier) && specifier.text.startsWith('.')) {
      const resolved = path.resolve(path.dirname(file), specifier.text).replaceAll('\\', '/');
      if (/\/keyboard-ui\/src\/(?:recovered|shared|vendor|bindings|cycles|typecheck\/generated)(?:\/|$)/.test(resolved) ||
          /\/(?:reference|archive)\//.test(resolved))
        violations.push({ file, kind: 'retired production import', source: specifier.text });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (/@ts-(?:ignore|nocheck)/.test(body)) violations.push({ file, kind: 'suppression' });
}
const report = {
  strictSources: files.filter((file) => /\.(?:[cm]?ts|tsx)$/.test(file)).length,
  verificationJavaScriptSources: files.filter((file) => file.endsWith('.js')).length,
  roots,
  violations,
  configs: [
    'tsconfig.json',
    'tsconfig.backend.json',
    'tsconfig.desktop.json',
    'tsconfig.state.json',
    'packages/renderer-state/tsconfig.json',
    'tsconfig.sensor.json',
    'tsconfig.renderer.json',
    'tsconfig.platform.json',
    'tsconfig.verification.json',
  ],
  sourceBoundary:
    'All owned production package roots are audited, including keyboard index/routes/data/translations. Strict compilation is a separate build/check gate. No explicit any, suppression, opaque library alias/proxy, retired import or untyped production source is allowed.',
  generatedBoundary:
    'keyboard-ui/src/platform contains only emitted output/declarations/maps from the audited ui-platform TypeScript sources; generated output is not counted twice.',
};
fs.writeFileSync('reports/type-coverage.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ strictSources: report.strictSources, verificationJavaScriptSources: report.verificationJavaScriptSources, violations }));
if (violations.length) process.exitCode = 1;
