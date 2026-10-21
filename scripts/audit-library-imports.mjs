import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript-ast';

const opaqueNames = new Set([
  'ae', 'qt', 'ro', 'lo', 'to', 'oo', 'J', 'K', 'ao', 'so', 'no', 'co', 'uo', 'Ao',
  'Dt', 'le', 'I', 'T', 'te', 'N', 'P', 'ab', 'At', 'Ch', 'ce', 'c', 'D', 'Jt',
  'gd', 'Gr', 'Gw', 'ii', 'kT', 'mt', 'ni', 'qr', 'Tt', 'Yr', 'eb', 'fi', '_styled', '_',
]);
const external = (source) => !source.startsWith('.') && !source.startsWith('/');
const opaque = (name) => opaqueNames.has(name) || /^[A-Za-z]$/.test(name);

/** Detect import proxies even when they are moved outside the old bindings directory. */
export function libraryImportProblems(code, file) {
  const tree = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true,
    /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  // Bind this file's lexical scopes only; resolving packages/types is the strict compiler's job.
  const virtualFile = path.resolve(file);
  const host = ts.createCompilerHost({ noLib: true, noResolve: true, allowJs: true });
  host.getSourceFile = (name) => path.resolve(name) === virtualFile ? tree : undefined;
  const checker = ts.createProgram([virtualFile], { noLib: true, noResolve: true, allowJs: true }, host).getTypeChecker();
  const imported = new Set(), aliases = new Map(), problems = [];
  for (const statement of tree.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const source = statement.moduleSpecifier.text;
      if (/(?:^|\/)bindings\//.test(source)) problems.push('recovered binding import: ' + source);
      const clause = statement.importClause;
      if (!clause || clause.isTypeOnly || !external(source)) continue;
      const locals = [clause.name, clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)
        ? clause.namedBindings.name : undefined,
        ...(clause.namedBindings && ts.isNamedImports(clause.namedBindings)
          ? clause.namedBindings.elements.filter((item) => !item.isTypeOnly).map((item) => item.name) : [])].filter(Boolean);
      for (const local of locals) imported.add(checker.getSymbolAtLocation(local));
      for (const local of locals)
        if (!clause.isTypeOnly && opaque(local.text)) problems.push('opaque library import: ' + local.text);
    }
  }
  const bindings = [];
  function collect(node) {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const names = [];
      function namesIn(binding) {
        if (ts.isIdentifier(binding)) names.push(binding);
        else for (const element of binding.elements)
          if (ts.isBindingElement(element)) namesIn(element.name);
      }
      namesIn(node.name);
      for (const name of names) {
        aliases.set(checker.getSymbolAtLocation(name), node.initializer);
        bindings.push({ name, initializer: node.initializer,
          exported: ts.isVariableStatement(node.parent.parent) &&
            node.parent.parent.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) });
      }
    }
    ts.forEachChild(node, collect);
  }
  collect(tree);
  function isLibrary(node, seen = new Set()) {
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node))
      return isLibrary(node.expression, seen);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
      return isLibrary(node.expression, seen);
    if (!ts.isIdentifier(node)) return false;
    const symbol = ts.isExportSpecifier(node.parent)
      ? checker.getExportSpecifierLocalTargetSymbol(node.parent) : checker.getSymbolAtLocation(node);
    if (!symbol || seen.has(symbol)) return false;
    if (imported.has(symbol)) return true;
    seen.add(symbol);
    return aliases.has(symbol) && isLibrary(aliases.get(symbol), seen);
  }
  for (const binding of bindings) {
    if (!isLibrary(binding.initializer)) continue;
    if (opaque(binding.name.text)) problems.push('opaque local library alias: ' + binding.name.text);
    if (binding.exported) problems.push('library proxy export: ' + binding.name.text);
  }
  for (const statement of tree.statements) {
    if (ts.isExportAssignment(statement) && isLibrary(statement.expression))
      problems.push('library proxy default export');
    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      if (statement.moduleSpecifier && external(statement.moduleSpecifier.text) &&
          ts.isNamespaceExport(statement.exportClause))
        problems.push('library namespace re-export: ' + statement.exportClause.name.text);
      if (statement.moduleSpecifier && external(statement.moduleSpecifier.text) &&
          ts.isNamedExports(statement.exportClause))
        for (const item of statement.exportClause.elements)
          if (item.propertyName && opaque(item.name.text))
            problems.push('opaque library re-export: ' + item.name.text);
      if (!statement.moduleSpecifier && ts.isNamedExports(statement.exportClause))
        for (const item of statement.exportClause.elements)
          if (isLibrary(item.propertyName ?? item.name))
            problems.push('library proxy export: ' + item.name.text);
    }
  }
  return problems;
}

/** All maintained package source, excluding copied dependency implementations and build output. */
export function auditLibraryImports(root = 'packages') {
  const problems = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['vendor', 'node_modules', 'dist', 'target'].includes(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name))
        for (const problem of libraryImportProblems(fs.readFileSync(file, 'utf8'), file))
          problems.push(file + ': ' + problem);
    }
  }
  walk(root);
  return problems;
}
