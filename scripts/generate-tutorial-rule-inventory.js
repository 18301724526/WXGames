const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const espree = require('espree');

const REPO_ROOT = path.resolve(__dirname, '..');
const FLOW_FILE = 'frontend/js/tutorial/TutorialGuideFlowRegistry.js';
const EVENT_FILE = 'frontend/js/tutorial/TutorialGuideEventRegistry.js';
const DEFAULT_OUTPUT = 'docs/architecture/artifacts/northstar-s2-tutorial-rule-inventory.json';

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function parseSource(file) {
  const absolute = path.join(REPO_ROOT, file);
  const source = fs.readFileSync(absolute, 'utf8').replace(/\r\n/g, '\n');
  return {
    file,
    source,
    hash: crypto.createHash('sha256').update(source).digest('hex'),
    ast: espree.parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      loc: true,
    }),
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

function findFunction(ast, name) {
  let found = null;
  visit(ast, (node) => {
    if (!found && node.type === 'FunctionDeclaration' && node.id?.name === name) found = node;
  });
  if (!found) throw new Error(`Missing function ${name}`);
  return found;
}

function findReturnValue(functionNode, expectedType) {
  let found = null;
  visit(functionNode.body, (node) => {
    if (!found && node.type === 'ReturnStatement' && node.argument?.type === expectedType) {
      found = node.argument;
    }
  });
  if (!found) throw new Error(`Missing ${expectedType} return in ${functionNode.id?.name || 'function'}`);
  return found;
}

function staticKey(property) {
  if (!property) return '';
  if (!property.computed && property.key?.type === 'Identifier') return property.key.name;
  if (property.key?.type === 'Literal') return String(property.key.value);
  return '';
}

function objectProperty(objectNode, key) {
  return (objectNode?.properties || []).find(
    (property) => property.type === 'Property' && staticKey(property) === key,
  ) || null;
}

function staticString(node) {
  return node?.type === 'Literal' && typeof node.value === 'string' ? node.value : '';
}

function collectVariableDefinitions(functionNode) {
  const definitions = new Map();
  for (const statement of functionNode.body?.body || []) {
    if (statement.type !== 'VariableDeclaration') continue;
    for (const declaration of statement.declarations || []) {
      if (declaration.id?.type === 'Identifier' && declaration.init) {
        definitions.set(declaration.id.name, declaration.init);
      }
    }
  }
  return definitions;
}

function collectStepNames(node, definitions, seen = new Set()) {
  const names = new Set();
  visit(node, (entry) => {
    if (
      entry.type === 'MemberExpression'
      && entry.object?.type === 'Identifier'
      && entry.object.name === 'steps'
    ) {
      const name = entry.computed ? staticString(entry.property) : entry.property?.name;
      if (name) names.add(name);
    }
    if (entry.type === 'Identifier' && definitions.has(entry.name) && !seen.has(entry.name)) {
      seen.add(entry.name);
      collectStepNames(definitions.get(entry.name), definitions, seen).forEach((name) => names.add(name));
    }
  });
  return [...names];
}

function callName(node) {
  if (node?.type !== 'CallExpression') return '';
  if (node.callee?.type === 'Identifier') return node.callee.name;
  if (node.callee?.type === 'MemberExpression') {
    return node.callee.computed ? staticString(node.callee.property) : node.callee.property?.name || '';
  }
  return '';
}

function findCall(node, predicate) {
  let found = null;
  visit(node, (entry) => {
    if (!found && entry.type === 'CallExpression' && predicate(entry, callName(entry))) found = entry;
  });
  return found;
}

function deriveDirectRuleKind(ruleNode) {
  const render = objectProperty(ruleNode, 'render')?.value;
  if (!render) return 'custom';
  if (render.type === 'Identifier') return `renderer:${render.name}`;
  const highlightCall = findCall(render, (_call, name) => name === 'showHighlight');
  const targetType = staticString(highlightCall?.arguments?.[0]);
  if (targetType) return `highlight:${targetType}`;
  const softGuide = findCall(render, (_call, name) => name === 'showSoftGuide');
  if (softGuide) return 'soft-guide';
  const rendererCall = findCall(
    render,
    (call) => call.callee?.type === 'Identifier' && /^render[A-Z]/.test(call.callee.name),
  );
  if (rendererCall) return `renderer:${rendererCall.callee.name}`;
  const transition = findCall(render, (_call, name) => name === 'advanceTo' || name === 'handleEvent');
  return transition ? 'step-transition' : 'custom';
}

function location(file, node) {
  return `${normalizePath(file)}:${node.loc.start.line}`;
}

function extractFlowSourceEntries(parsed) {
  const functionNode = findFunction(parsed.ast, 'createDefaultRules');
  const definitions = collectVariableDefinitions(functionNode);
  const array = findReturnValue(functionNode, 'ArrayExpression');
  const entries = [];

  for (const element of array.elements || []) {
    if (!element) continue;
    if (element.type === 'ObjectExpression') {
      const id = staticString(objectProperty(element, 'id')?.value);
      if (!id) throw new Error(`Direct flow rule at ${location(parsed.file, element)} has no static id`);
      entries.push({
        id,
        stepNames: collectStepNames(objectProperty(element, 'matches')?.value, definitions),
        kind: deriveDirectRuleKind(element),
        source: 'handwritten',
        location: location(parsed.file, element),
      });
      continue;
    }

    const call = element.type === 'SpreadElement' ? element.argument : element;
    if (call?.type !== 'CallExpression' || call.callee?.type !== 'Identifier') {
      throw new Error(`Unsupported flow rule expression at ${location(parsed.file, element)}`);
    }
    const factory = call.callee.name;
    const config = call.arguments?.[0];
    if (config?.type !== 'ObjectExpression') {
      throw new Error(`Factory ${factory} at ${location(parsed.file, call)} needs a static config object`);
    }
    const stepNames = collectStepNames(config, definitions);
    const common = {
      stepNames,
      source: `factory:${factory}`,
      location: location(parsed.file, call),
    };
    if (factory === 'makeTaskClaimPairRules') {
      const openId = staticString(objectProperty(config, 'openId')?.value);
      const claimId = staticString(objectProperty(config, 'claimId')?.value);
      entries.push({ id: openId, kind: 'highlight:openTaskCenter', ...common });
      entries.push({ id: claimId, kind: 'highlight:claimTaskReward', ...common });
      continue;
    }
    const id = staticString(objectProperty(config, 'id')?.value);
    const kinds = {
      makeTabOpenRule: 'highlight:openCommandPanel',
      makeBuildRule: 'highlight:buildBuilding',
    };
    if (!id || !kinds[factory]) {
      throw new Error(`Unsupported factory ${factory} at ${location(parsed.file, call)}`);
    }
    entries.push({ id, kind: kinds[factory], ...common });
  }
  return entries;
}

function deriveHandlerKind(handlerNode) {
  const has = (name) => Boolean(findCall(handlerNode, (_call, call) => call === name));
  if (has('canOpenTab')) return 'veto-and-transition';
  if (has('advanceTo') || has('advanceIf')) return 'step-transition';
  if (has('syncFromResult')) return 'state-sync';
  if (has('refreshCurrentHighlight')) return 'projection-refresh';
  return 'event-handler';
}

function extractEventSourceEntries(parsed) {
  const functionNode = findFunction(parsed.ast, 'createDefaultHandlers');
  const definitions = collectVariableDefinitions(functionNode);
  const object = findReturnValue(functionNode, 'ObjectExpression');
  return (object.properties || []).map((property) => {
    const eventName = staticKey(property);
    if (!eventName) throw new Error(`Event handler at ${location(parsed.file, property)} has no static name`);
    return {
      eventName,
      stepNames: collectStepNames(property.value, definitions),
      kind: deriveHandlerKind(property.value),
      source: 'factory:createDefaultHandlers',
      location: location(parsed.file, property),
    };
  });
}

function assertSameIds(label, generatedIds, runtimeIds) {
  const generated = [...generatedIds].sort();
  const runtime = [...runtimeIds].sort();
  if (JSON.stringify(generated) !== JSON.stringify(runtime)) {
    throw new Error(`${label} source/runtime id mismatch:\ngenerated=${generated.join(',')}\nruntime=${runtime.join(',')}`);
  }
}

function buildInventory() {
  const flowSource = parseSource(FLOW_FILE);
  const eventSource = parseSource(EVENT_FILE);
  const flowRules = extractFlowSourceEntries(flowSource);
  const eventHandlers = extractEventSourceEntries(eventSource);
  const flowRuntime = require(path.join(REPO_ROOT, FLOW_FILE)).createDefaultRules({});
  const eventRuntime = require(path.join(REPO_ROOT, EVENT_FILE)).createDefaultHandlers({});

  assertSameIds('flow rules', flowRules.map((entry) => entry.id), flowRuntime.map((entry) => entry.id));
  assertSameIds('event handlers', eventHandlers.map((entry) => entry.eventName), Object.keys(eventRuntime));

  return {
    schema: 'northstar-s2-tutorial-rule-inventory/v1',
    sources: [
      { file: FLOW_FILE, sha256: flowSource.hash },
      { file: EVENT_FILE, sha256: eventSource.hash },
    ],
    counts: {
      flowRules: flowRules.length,
      eventHandlers: eventHandlers.length,
    },
    flowRules,
    eventHandlers,
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
  extractEventSourceEntries,
  extractFlowSourceEntries,
  parseSource,
  writeInventory,
};
