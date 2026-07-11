const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const espree = require('espree');

const REPO_ROOT = path.resolve(__dirname, '..');
const TUTORIAL_ROOT = 'frontend/js/tutorial';
const ADAPTER_FILE = `${TUTORIAL_ROOT}/TutorialHostContext.js`;
const DEFAULT_OUTPUT = 'docs/architecture/artifacts/northstar-s3-tutorial-host-surface.json';
const ROOT_NAMES = new Set(['host', 'game', 'canvasShell', 'shell', 'controller', 'renderer']);
const HOST_HELPERS = new Set([
  'CanvasModalSnapshotAdapter',
  'CanvasModeOwnershipRuntime',
  'StateWriter',
  'TerritoryUiStateStore',
  'UiRuntimeStateStore',
]);

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function unwrap(node) {
  return node?.type === 'ChainExpression' ? node.expression : node;
}

function visit(node, callback, parent = null) {
  if (!node || typeof node !== 'object') return;
  callback(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'range' || key === 'parent') continue;
    if (Array.isArray(value)) value.forEach((entry) => visit(entry, callback, node));
    else if (value && typeof value === 'object' && value.type) visit(value, callback, node);
  }
}

function staticPropertyName(member) {
  if (!member?.computed && member?.property?.type === 'Identifier') return member.property.name;
  if (member?.property?.type === 'Literal') return String(member.property.value);
  return '*dynamic*';
}

function expressionShape(node) {
  const value = unwrap(node);
  if (!value) return '';
  if (value.type === 'Identifier') return value.name;
  if (value.type === 'ThisExpression') return 'this';
  if (value.type === 'Literal') return JSON.stringify(value.value);
  if (value.type === 'MemberExpression') {
    const object = expressionShape(value.object);
    const property = staticPropertyName(value);
    return property === '*dynamic*' ? `${object}[*dynamic*]` : `${object}.${property}`;
  }
  if (value.type === 'CallExpression') return `${expressionShape(value.callee)}()`;
  if (value.type === 'AwaitExpression') return expressionShape(value.argument);
  if (value.type === 'LogicalExpression') {
    return `${expressionShape(value.left)} ${value.operator} ${expressionShape(value.right)}`;
  }
  return value.type;
}

function directRoot(node, aliases) {
  const value = unwrap(node);
  if (!value) return '';
  if (value.type === 'Identifier') {
    if (aliases.has(value.name)) return aliases.get(value.name);
    if (ROOT_NAMES.has(value.name)) return value.name;
    return '';
  }
  if (value.type === 'MemberExpression') {
    if (
      value.object?.type === 'ThisExpression'
      && ROOT_NAMES.has(staticPropertyName(value))
    ) {
      return `this.${staticPropertyName(value)}`;
    }
    return directRoot(value.object, aliases);
  }
  if (value.type === 'CallExpression') return directRoot(value.callee, aliases);
  if (value.type === 'AwaitExpression') return directRoot(value.argument, aliases);
  if (value.type === 'LogicalExpression') {
    return directRoot(value.left, aliases) || directRoot(value.right, aliases);
  }
  return '';
}

function collectAliases(ast) {
  const aliases = new Map();
  let changed = true;
  while (changed) {
    changed = false;
    visit(ast, (node) => {
      if (node.type !== 'VariableDeclarator' || node.id?.type !== 'Identifier' || !node.init) return;
      const root = directRoot(node.init, aliases);
      if (root && aliases.get(node.id.name) !== root) {
        aliases.set(node.id.name, root);
        changed = true;
      }
    });
  }
  return aliases;
}

function operationFor(node, parent) {
  const value = unwrap(node);
  const parentValue = unwrap(parent);
  if (parentValue?.type === 'AssignmentExpression' && parentValue.left === value) return 'write';
  if (parentValue?.type === 'UpdateExpression' && parentValue.argument === value) return 'write';
  if (parentValue?.type === 'UnaryExpression' && parentValue.operator === 'delete') return 'write';
  if (parentValue?.type === 'CallExpression' && parentValue.callee === value) return 'call';
  return 'read';
}

function helperName(call) {
  const callee = unwrap(call?.callee);
  if (callee?.type !== 'MemberExpression') return '';
  const object = unwrap(callee.object);
  return object?.type === 'Identifier' && HOST_HELPERS.has(object.name) ? object.name : '';
}

function categoryFor(file, shape, operation) {
  const lower = shape.toLowerCase();
  if (/advanceto|advancetutorial/.test(lower)) return 'next';
  if (/waitfor|subscribe|addlistener|addeventlistener/.test(lower)) return 'waitFor';
  if (/requestaction|dispatchaction|submitcommand|sendcommand/.test(lower)) return 'requestAction';
  if (
    file.endsWith('/TutorialGuideTargetResolver.js')
    || /resolvetarget|hittarget|worldsiteanchor|softguideid|targetresolver|showhighlight/.test(lower)
  ) {
    return 'resolveTarget';
  }
  if (operation === 'write') return 'effects';
  const segments = lower.split(/[.()[\]]+/).filter(Boolean);
  if (segments.some((segment) => (
    /^(set|open|close|show|hide|render|refresh|ensure|clear|apply|sync|commit|log|focus|center|handle|retry)/.test(segment)
    && segment !== 'renderer'
  ))) {
    return 'effects';
  }
  return 'queries';
}

function isMaximalRootedExpression(node, parent, aliases) {
  const value = unwrap(node);
  const parentValue = unwrap(parent);
  if (!directRoot(value, aliases)) return false;
  if (value.type !== 'MemberExpression') return false;
  if (parentValue?.type === 'MemberExpression' && parentValue.object === value) return false;
  if (parentValue?.type === 'CallExpression' && parentValue.callee === value) return true;
  return true;
}

function sourceFiles() {
  const root = path.join(REPO_ROOT, TUTORIAL_ROOT);
  return fs.readdirSync(root)
    .filter((file) => file.endsWith('.js') && !file.endsWith('.test.js'))
    .map((file) => `${TUTORIAL_ROOT}/${file}`)
    .filter((file) => file !== ADAPTER_FILE)
    .sort();
}

function parseSource(file, sourceText) {
  const source = sourceText.replace(/\r\n/g, '\n');
  return {
    file,
    source,
    sha256: crypto.createHash('sha256').update(source).digest('hex'),
    ast: espree.parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      loc: true,
      range: true,
    }),
  };
}

function parseFile(file) {
  return parseSource(file, fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'));
}

function scanFile(parsed) {
  const aliases = collectAliases(parsed.ast);
  const entries = [];
  const seen = new Set();
  const add = (node, shape, operation, root, note) => {
    const location = `${parsed.file}:${node.loc.start.line}`;
    const key = `${location}|${shape}|${operation}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      location,
      accessShape: shape,
      category: categoryFor(parsed.file, shape, operation),
      note: `${operation}; root=${root}; ${note}`,
    });
  };

  visit(parsed.ast, (node, parent) => {
    const value = unwrap(node);
    if (isMaximalRootedExpression(value, parent, aliases)) {
      const root = directRoot(value, aliases);
      const operation = operationFor(value, parent);
      const shape = expressionShape(value);
      if (shape !== root && !/^this\.(game|host|controller|renderer|canvasShell)$/.test(shape)) {
        add(value, shape, operation, root, 'direct host member access');
      }
    }

    if (value?.type !== 'CallExpression') return;
    const helper = helperName(value);
    if (!helper) return;
    const rootedArguments = value.arguments
      .map((argument) => directRoot(argument, aliases))
      .filter(Boolean);
    if (rootedArguments.length === 0) return;
    add(
      value,
      expressionShape(value),
      'call',
      rootedArguments.join(','),
      `indirect host access through ${helper}`,
    );
  });

  return entries.sort((a, b) => {
    const lineA = Number(a.location.slice(a.location.lastIndexOf(':') + 1));
    const lineB = Number(b.location.slice(b.location.lastIndexOf(':') + 1));
    return lineA - lineB || a.accessShape.localeCompare(b.accessShape);
  });
}

function buildInventory() {
  const parsedFiles = sourceFiles().map(parseFile);
  const entries = parsedFiles.flatMap(scanFile);
  const categories = Object.fromEntries(
    ['effects', 'waitFor', 'requestAction', 'resolveTarget', 'queries', 'next']
      .map((category) => [category, entries.filter((entry) => entry.category === category).length]),
  );
  return {
    schema: 'northstar-s3-tutorial-host-surface/v1',
    generatedBy: 'scripts/generate-tutorial-host-surface-inventory.js',
    sources: parsedFiles.map(({ file, sha256 }) => ({ file, sha256 })),
    counts: { total: entries.length, categories },
    entries,
  };
}

function writeInventory(output = DEFAULT_OUTPUT) {
  const absolute = path.resolve(REPO_ROOT, output);
  const inventory = buildInventory();
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(inventory, null, 2)}\n`);
  return { absolute, inventory };
}

if (require.main === module) {
  const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
  const output = outputArg ? outputArg.slice('--output='.length) : DEFAULT_OUTPUT;
  const result = writeInventory(output);
  console.log(JSON.stringify({
    output: normalizePath(path.relative(REPO_ROOT, result.absolute)),
    ...result.inventory.counts,
  }));
}

module.exports = {
  DEFAULT_OUTPUT,
  buildInventory,
  parseFile,
  parseSource,
  scanFile,
  writeInventory,
};
