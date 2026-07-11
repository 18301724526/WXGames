const fs = require('node:fs');
const path = require('node:path');
const espree = require('espree');

const REPO_ROOT = path.resolve(__dirname, '..');
const ENGINE_ROOT = path.join(REPO_ROOT, 'frontend', 'js', 'tutorial-engine');

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  callback(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'range') continue;
    if (Array.isArray(value)) value.forEach((entry) => visit(entry, callback));
    else if (value && typeof value === 'object' && value.type) visit(value, callback);
  }
}

function staticSpecifier(node) {
  return node?.type === 'Literal' && typeof node.value === 'string' ? node.value : '';
}

function collectImports(source = '') {
  const ast = espree.parse(String(source), {
    ecmaVersion: 'latest',
    sourceType: 'module',
    loc: true,
  });
  const imports = [];
  visit(ast, (node) => {
    if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
      if (node.source) imports.push({ specifier: staticSpecifier(node.source), line: node.loc.start.line });
      return;
    }
    if (node.type === 'ImportExpression') {
      imports.push({ specifier: staticSpecifier(node.source), line: node.loc.start.line, dynamic: true });
      return;
    }
    if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'require') {
      imports.push({ specifier: staticSpecifier(node.arguments[0]), line: node.loc.start.line, dynamic: true });
    }
  });
  return imports;
}

function isWithinEngine(file) {
  const relative = path.relative(ENGINE_ROOT, file);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function inspectSource(source = '', file = path.join(ENGINE_ROOT, 'Synthetic.js')) {
  const isTest = file.endsWith('.test.js');
  const violations = collectImports(source).flatMap((entry) => {
    if (!entry.specifier) return [{ ...entry, reason: 'dynamic import specifier is forbidden' }];
    if (isTest && entry.specifier.startsWith('node:')) return [];
    if (!entry.specifier.startsWith('.')) {
      return [{ ...entry, reason: `non-local import is forbidden: ${entry.specifier}` }];
    }
    const resolved = path.resolve(path.dirname(file), entry.specifier);
    if (isWithinEngine(resolved)) return [];
    return [{ ...entry, reason: `import escapes tutorial-engine: ${entry.specifier}` }];
  });
  return { ok: violations.length === 0, violations };
}

function collectFiles(root = ENGINE_ROOT) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visitDirectory = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) visitDirectory(child);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(child);
    }
  };
  visitDirectory(root);
  return files.sort();
}

function checkDirectory(root = ENGINE_ROOT) {
  const files = collectFiles(root);
  const violations = files.flatMap((file) => {
    const result = inspectSource(fs.readFileSync(file, 'utf8'), file);
    return result.violations.map((violation) => ({ file, ...violation }));
  });
  return { ok: violations.length === 0, files, violations };
}

function main() {
  const result = checkDirectory();
  if (!result.ok) {
    result.violations.forEach((violation) => {
      const file = path.relative(REPO_ROOT, violation.file).replace(/\\/g, '/');
      console.error(`${file}:${violation.line} ${violation.reason}`);
    });
    process.exitCode = 1;
    return;
  }
  console.log(`Tutorial engine purity check passed: ${result.files.length} file(s), zero imports outside tutorial-engine.`);
}

if (require.main === module) main();

module.exports = {
  ENGINE_ROOT,
  checkDirectory,
  collectImports,
  inspectSource,
};
