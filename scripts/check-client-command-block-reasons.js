const fs = require('node:fs');
const path = require('node:path');
const espree = require('espree');

const ClientCommandSemantics = require('../frontend/js/platform/ClientCommandSemantics');

const ROOT = path.resolve(process.env.CLIENT_COMMAND_GUARD_ROOT || path.resolve(__dirname, '..'));
const SCAN_ROOTS = [path.join(ROOT, 'frontend/js')];
const ALLOWED_REASONS = new Set(ClientCommandSemantics.LOCAL_BLOCK_REASONS);
const COMMAND_ACTION_TYPES = new Set(ClientCommandSemantics.COMMAND_ACTION_TYPES);
const DOMAIN_SIGNALS = /resources?|tutorial|era|tech|cooldown|march|candidate|territory|reward|encounter|loot|boss|eligib|claimable|ready|locked/i;
const DISPATCH_METHODS = new Map([
  ['frontend/js/platform/CanvasActionDispatcher.js', new Set(['handle'])],
  ['frontend/js/platform/CanvasActionController.js', new Set(['handle', 'handleBuilding'])],
  ['frontend/js/platform/CanvasGameShell.js', new Set([
    'handleTap',
    'startWorldMarch',
    'returnWorldMarch',
    'stopWorldMarch',
  ])],
  ['frontend/js/platform/GameCommandService.js', new Set(['handleBuildingAction'])],
  ['frontend/js/platform/WorldMarchActionHandler.js', new Set(['startMarch'])],
]);
const ALLOWED_DOMAIN_RETURN_MARKERS = new Set(['openWorldMarchDeploymentWarning']);
const failures = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function traverse(node, visitor, parent = null) {
  if (!node || typeof node !== 'object') return;
  visitor(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    if (Array.isArray(value)) {
      value.forEach((item) => traverse(item, visitor, node));
    } else if (value && typeof value.type === 'string') {
      traverse(value, visitor, node);
    }
  }
}

function traverseMethodBody(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'range') continue;
    const children = Array.isArray(value) ? value : [value];
    children.forEach((child) => {
      if (!child || typeof child.type !== 'string') return;
      if (
        child.type === 'ArrowFunctionExpression'
        || child.type === 'FunctionExpression'
        || child.type === 'FunctionDeclaration'
      ) return;
      traverseMethodBody(child, visitor);
    });
  }
}

function getPropertyName(property = {}) {
  if (!property.computed && property.key?.type === 'Identifier') return property.key.name;
  if (property.key?.type === 'Literal') return String(property.key.value || '');
  return '';
}

function getLiteralString(node = {}) {
  return node.type === 'Literal' && typeof node.value === 'string' ? node.value : '';
}

function getObjectActionType(node = {}) {
  if (node.type !== 'ObjectExpression') return '';
  const typeProperty = node.properties.find((property) => (
    property.type === 'Property' && getPropertyName(property) === 'type'
  ));
  return typeProperty ? getLiteralString(typeProperty.value) : '';
}

function getConditionalActionTypes(node, parent) {
  const objectTypes = [getObjectActionType(node.consequent), getObjectActionType(node.alternate)];
  if (objectTypes.every(Boolean)) return objectTypes;
  if (parent?.type === 'Property' && getPropertyName(parent) === 'type') {
    const literalTypes = [getLiteralString(node.consequent), getLiteralString(node.alternate)];
    if (literalTypes.every(Boolean)) return literalTypes;
  }
  return [];
}

function containsReturn(node) {
  let found = false;
  traverseMethodBody(node, (child) => {
    if (child.type === 'ReturnStatement') found = true;
  });
  return found;
}

function hasDomainSignal(node) {
  let found = false;
  traverse(node, (child) => {
    if (child.type === 'Identifier' && DOMAIN_SIGNALS.test(child.name)) found = true;
  });
  return found;
}

function inspectDispatchMethod(relative, methodName, body, source) {
  traverseMethodBody(body, (node) => {
    if (node.type !== 'IfStatement' || !containsReturn(node.consequent)) return;
    const testSource = source.slice(node.test.range[0], node.test.range[1]);
    if (!hasDomainSignal(node.test) || /isCommandAction/.test(testSource)) return;
    const consequentSource = source.slice(node.consequent.range[0], node.consequent.range[1]);
    if ([...ALLOWED_DOMAIN_RETURN_MARKERS].some((marker) => consequentSource.includes(marker))) return;
    failures.push(
      `${relative}:${node.loc.start.line} domain-conditioned early return in ${methodName}`,
    );
  });
}

function inspectStructure(relative, source) {
  let ast;
  try {
    ast = espree.parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      allowHashBang: true,
      loc: true,
      range: true,
    });
  } catch (error) {
    failures.push(`${relative}:${error.lineNumber || 1} guard parse failed: ${error.message}`);
    return;
  }

  const dispatchMethods = DISPATCH_METHODS.get(relative) || new Set();
  traverse(ast, (node, parent) => {
    if (node.type === 'MethodDefinition') {
      const methodName = node.key?.name || getLiteralString(node.key);
      if (dispatchMethods.has(methodName)) {
        inspectDispatchMethod(relative, methodName, node.value.body, source);
      }
      return;
    }
    if (node.type !== 'ConditionalExpression') return;
    const actionTypes = getConditionalActionTypes(node, parent);
    if (actionTypes.length !== 2) return;
    if (!hasDomainSignal(node.test)) return;
    const commandType = actionTypes.find((type) => COMMAND_ACTION_TYPES.has(type));
    const replacementType = actionTypes.find((type) => type !== commandType);
    if (!commandType || !replacementType || replacementType === commandType) return;
    failures.push(
      `${relative}:${node.loc.start.line} command action ${commandType} conditionally replaced by ${replacementType}`,
    );
  });
}

for (const file of SCAN_ROOTS.flatMap(walk).filter((item) => item.endsWith('.js') && !item.endsWith('.test.js'))) {
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.includes('commandDisabled')) return;
    const literal = line.match(/commandDisabled\s*:\s*['"]([^'"]+)['"]/);
    if (literal && !ALLOWED_REASONS.has(literal[1])) {
      failures.push(`${relative}:${index + 1} invalid commandDisabled reason ${literal[1]}`);
    }
    if (
      DOMAIN_SIGNALS.test(line)
      && !/commandDisabled\s*:\s*(?:false|['"](?:IN_FLIGHT|DUPLICATE_COMMAND_ID|PAYLOAD_SHAPE|UI_NOT_READY)['"])/.test(line)
    ) {
      failures.push(`${relative}:${index + 1} domain signal appears in commandDisabled`);
    }
  });
  inspectStructure(relative, source);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('client command block reason guard passed');
