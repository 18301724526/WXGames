const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const espree = require('espree');

const REPO_ROOT = path.resolve(__dirname, '..');
const RENDER_ROOTS = Object.freeze([
  'frontend/js/platform',
  'frontend/js/state/presenters',
]);
const TUTORIAL_ROOT = 'frontend/js/tutorial';
const TUTORIAL_CONFIG_ROOT = 'frontend/js/tutorial-config';
const DEFAULT_OUTPUT = 'docs/architecture/artifacts/northstar-s5-tutorial-hit-target-types.json';

function normalizePath(value = '') {
  return String(value).replace(/\\/g, '/');
}

function collectSourceFiles(root) {
  const files = [];
  const visitDirectory = (relative) => {
    const absolute = path.join(REPO_ROOT, relative);
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const child = normalizePath(path.join(relative, entry.name));
      if (entry.isDirectory()) visitDirectory(child);
      else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) files.push(child);
    }
  };
  visitDirectory(root);
  return files.sort();
}

function parseSource(file, sourceText = null) {
  const source = String(sourceText == null
    ? fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')
    : sourceText).replace(/\r\n/g, '\n');
  return {
    file: normalizePath(file),
    source,
    sha256: crypto.createHash('sha256').update(source).digest('hex'),
    ast: espree.parse(source, { ecmaVersion: 'latest', sourceType: 'script', loc: true }),
  };
}

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  callback(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'range') continue;
    if (Array.isArray(value)) value.forEach((entry) => visit(entry, callback));
    else if (value && typeof value === 'object' && value.type) visit(value, callback);
  }
}

function callName(node) {
  if (node?.type !== 'CallExpression') return '';
  if (node.callee?.type === 'Identifier') return node.callee.name;
  if (node.callee?.type !== 'MemberExpression') return '';
  if (!node.callee.computed && node.callee.property?.type === 'Identifier') return node.callee.property.name;
  return node.callee.property?.type === 'Literal' ? String(node.callee.property.value) : '';
}

function staticString(node) {
  return node?.type === 'Literal' && typeof node.value === 'string' ? node.value : '';
}

function staticStrings(node) {
  const direct = staticString(node);
  if (direct) return [direct];
  if (node?.type === 'ConditionalExpression') {
    return [...staticStrings(node.consequent), ...staticStrings(node.alternate)];
  }
  return [];
}

function objectType(node) {
  if (node?.type !== 'ObjectExpression') return '';
  const property = node.properties.find((entry) => {
    if (entry.type !== 'Property') return false;
    if (!entry.computed && entry.key?.type === 'Identifier') return entry.key.name === 'type';
    return entry.key?.type === 'Literal' && entry.key.value === 'type';
  });
  return staticString(property?.value);
}

function objectTypes(node) {
  if (node?.type !== 'ObjectExpression') return [];
  const property = node.properties.find((entry) => {
    if (entry.type !== 'Property') return false;
    if (!entry.computed && entry.key?.type === 'Identifier') return entry.key.name === 'type';
    return entry.key?.type === 'Literal' && entry.key.value === 'type';
  });
  return staticStrings(property?.value);
}

function collectStaticActionTypes(ast) {
  const definitions = new Map();
  visit(ast, (node) => {
    if (node.type !== 'VariableDeclarator' || node.id?.type !== 'Identifier') return;
    const type = objectType(node.init);
    if (type) definitions.set(node.id.name, type);
  });
  return definitions;
}

function resolveActionType(node, definitions) {
  const direct = objectType(node);
  if (direct) return direct;
  if (node?.type === 'Identifier') return definitions.get(node.name) || '';
  if (node?.type === 'ConditionalExpression') {
    const consequent = resolveActionType(node.consequent, definitions);
    const alternate = resolveActionType(node.alternate, definitions);
    return consequent && consequent === alternate ? consequent : '';
  }
  return '';
}

function location(parsed, node) {
  return `${parsed.file}:${node.loc.start.line}`;
}

function scanRendererSource(parsed) {
  const registrations = [];
  let hasEmitter = false;
  visit(parsed.ast, (node) => {
    if (node.type === 'CallExpression' && callName(node) === 'addHitTarget') hasEmitter = true;
  });
  if (!hasEmitter) return registrations;
  visit(parsed.ast, (node) => {
    objectTypes(node).forEach((type) => registrations.push({ type, location: location(parsed, node) }));
  });
  return registrations;
}

function scanTutorialSource(parsed) {
  const references = [];
  visit(parsed.ast, (node) => {
    if (node.type !== 'CallExpression') return;
    const name = callName(node);
    if (name !== 'showHighlight' && name !== 'getCanvasTarget') return;
    const type = staticString(node.arguments?.[0]);
    if (type) references.push({ type, via: name, location: location(parsed, node) });
  });
  return references;
}

function scanTutorialConfigSource(parsed) {
  const references = [];
  visit(parsed.ast, (node) => {
    if (node.type !== 'Property') return;
    const key = !node.computed && node.key?.type === 'Identifier'
      ? node.key.name
      : staticString(node.key);
    if (key !== 'target') return;
    const target = staticString(node.value);
    const type = target.split(':')[0];
    if (type) references.push({ type, via: 'StepScript.target', location: location(parsed, node) });
  });
  return references;
}

function uniqueBy(items, keyOf) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildInventory(options = {}) {
  const rendererFiles = options.rendererFiles || RENDER_ROOTS.flatMap(collectSourceFiles).sort();
  const tutorialFiles = options.tutorialFiles || collectSourceFiles(TUTORIAL_ROOT);
  const tutorialConfigFiles = options.tutorialConfigFiles
    || (options.tutorialFiles ? [] : collectSourceFiles(TUTORIAL_CONFIG_ROOT));
  const sourceOverride = options.sourceOverride || {};
  const rendererSources = rendererFiles.map((file) => parseSource(file, sourceOverride[file]));
  const tutorialSources = tutorialFiles.map((file) => parseSource(file, sourceOverride[file]));
  const tutorialConfigSources = tutorialConfigFiles
    .map((file) => parseSource(file, sourceOverride[file]));
  const registrations = rendererSources.flatMap((parsed) => {
    if (parsed.file.startsWith('frontend/js/state/presenters/')) {
      const entries = [];
      visit(parsed.ast, (node) => {
        objectTypes(node).forEach((type) => entries.push({ type, location: location(parsed, node) }));
      });
      return entries;
    }
    return scanRendererSource(parsed);
  })
    .sort((a, b) => a.type.localeCompare(b.type) || a.location.localeCompare(b.location));
  const references = [
    ...tutorialSources.flatMap(scanTutorialSource),
    ...tutorialConfigSources.flatMap(scanTutorialConfigSource),
  ]
    .sort((a, b) => a.type.localeCompare(b.type) || a.location.localeCompare(b.location));
  const registeredTypes = [...new Set(registrations.map((entry) => entry.type))].sort();
  const tutorialTypes = [...new Set(references.map((entry) => entry.type))].sort();
  const registered = new Set(registeredTypes);
  const missingTypes = tutorialTypes.filter((type) => !registered.has(type));
  return {
    schema: 'northstar-s5-tutorial-hit-target-types/v1',
    generatedBy: 'scripts/generate-tutorial-hit-target-types.js',
    enumeration: {
      rendererRoots: RENDER_ROOTS,
      tutorialRoot: TUTORIAL_ROOT,
      tutorialConfigRoot: TUTORIAL_CONFIG_ROOT,
      rendererSignal: "literal type action objects in addHitTarget renderer sources plus their state/presenters action sources; forwarding wrappers add no type",
      tutorialSignal: "showHighlight('<literal>', ...) or getCanvasTarget('<literal>', ...)",
      tutorialConfigSignal: "literal target fields in frozen StepScript config; descriptor suffix after ':' is excluded from the action type",
    },
    sources: [...rendererSources, ...tutorialSources, ...tutorialConfigSources]
      .map(({ file, sha256 }) => ({ file, sha256 })),
    counts: {
      rendererFiles: rendererFiles.length,
      tutorialFiles: tutorialFiles.length,
      tutorialConfigFiles: tutorialConfigFiles.length,
      registrationSites: registrations.length,
      registeredTypes: registeredTypes.length,
      tutorialReferenceSites: references.length,
      tutorialTypes: tutorialTypes.length,
      missingTypes: missingTypes.length,
    },
    tutorialTypes: tutorialTypes.map((type) => ({
      type,
      references: references.filter((entry) => entry.type === type),
      registrations: registrations.filter((entry) => entry.type === type),
    })),
    missingTypes,
    duplicateReferenceSitesRemoved: references.length - uniqueBy(references, (entry) => `${entry.type}:${entry.location}:${entry.via}`).length,
  };
}

function expectedText(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

function writeInventory(output = DEFAULT_OUTPUT) {
  const absolute = path.resolve(REPO_ROOT, output);
  const inventory = buildInventory();
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, expectedText(inventory));
  return { absolute, inventory };
}

function main() {
  const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
  const output = outputArg ? outputArg.slice('--output='.length) : DEFAULT_OUTPUT;
  const checkOnly = process.argv.includes('--check');
  const inventory = buildInventory();
  const absolute = path.resolve(REPO_ROOT, output);
  if (inventory.missingTypes.length) {
    console.error(`Tutorial hit-target types missing renderer registrations: ${inventory.missingTypes.join(', ')}`);
    process.exitCode = 1;
  }
  if (checkOnly) {
    const actual = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8').replace(/\r\n/g, '\n') : '';
    if (actual !== expectedText(inventory)) {
      console.error(`Tutorial hit-target type inventory is stale: ${output}`);
      process.exitCode = 1;
    }
  } else {
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, expectedText(inventory));
  }
  console.log(JSON.stringify({ output, checked: checkOnly, ...inventory.counts }));
}

if (require.main === module) main();

module.exports = {
  DEFAULT_OUTPUT,
  buildInventory,
  scanRendererSource,
  scanTutorialSource,
  parseSource,
  scanTutorialConfigSource,
  writeInventory,
};
