const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const espree = require('espree');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = 'frontend/js/tutorial/TutorialGuideEventRegistry.js';
const DEFAULT_OUTPUT = 'docs/architecture/artifacts/northstar-s4-tutorial-event-contracts.json';
const SERVER_RESULT_EVENTS = new Set([
  'eraAdvanced',
  'taskRewardClaimed',
  'tutorialStateChanged',
  'armyFormationSaved',
  'exploreStarted',
]);
const ALIAS_GROUPS = Object.freeze({
  tabClicked: { tabId: ['panelId', 'tab'] },
  commandPanelOpened: { panelId: ['tabId', 'panel'] },
  cityManagementOpened: { tab: ['tabId'] },
});

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  callback(node);
  Object.entries(node).forEach(([key, value]) => {
    if (key === 'loc' || key === 'range') return;
    if (Array.isArray(value)) value.forEach((entry) => visit(entry, callback));
    else if (value && typeof value === 'object' && value.type) visit(value, callback);
  });
}

function propertyName(property) {
  if (!property) return '';
  if (!property.computed && property.key?.type === 'Identifier') return property.key.name;
  if (property.key?.type === 'Literal') return String(property.key.value);
  return '';
}

function findHandlerObject(ast) {
  let handlerObject = null;
  visit(ast, (node) => {
    if (handlerObject || node.type !== 'FunctionDeclaration' || node.id?.name !== 'createDefaultHandlers') return;
    visit(node.body, (child) => {
      if (!handlerObject && child.type === 'ReturnStatement' && child.argument?.type === 'ObjectExpression') {
        handlerObject = child.argument;
      }
    });
  });
  if (!handlerObject) throw new Error('createDefaultHandlers return object not found');
  return handlerObject;
}

function payloadField(member) {
  if (member?.type !== 'MemberExpression') return '';
  if (member.object?.type !== 'Identifier' || member.object.name !== 'payload') return '';
  if (!member.computed && member.property?.type === 'Identifier') return member.property.name;
  if (member.property?.type === 'Literal') return String(member.property.value);
  return '';
}

function canonicalFields(eventName, observedFields) {
  const aliases = ALIAS_GROUPS[eventName] || {};
  const excludedAliases = new Set(Object.values(aliases).flat());
  return observedFields
    .filter((field) => !excludedAliases.has(field))
    .map((field) => ({
      name: field,
      source: 'generated',
      aliases: aliases[field] || [],
      description: field === 'result' && SERVER_RESULT_EVENTS.has(eventName)
        ? '服务端命令结果对象'
        : '',
    }));
}

function buildContracts() {
  const source = fs.readFileSync(path.join(REPO_ROOT, SOURCE_FILE), 'utf8').replace(/\r\n/g, '\n');
  const ast = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'script', loc: true });
  const handlers = findHandlerObject(ast);
  const events = handlers.properties.map((property) => {
    const eventName = propertyName(property);
    const observed = new Set();
    let callsSyncFromResult = false;
    visit(property.value, (node) => {
      const field = payloadField(node);
      if (field) observed.add(field);
      if (node.type === 'CallExpression' && node.callee?.type === 'Identifier') {
        if (node.callee.name === 'syncFromResult') callsSyncFromResult = true;
      }
    });
    const observedFields = [...observed];
    return {
      eventName,
      requiredFields: canonicalFields(eventName, observedFields),
      observedPayloadFields: observedFields,
      carriesServerCommandResult: callsSyncFromResult,
      extraction: 'generated',
    };
  });
  return {
    schema: 'northstar-s4-tutorial-event-contracts/v1',
    generatedBy: 'scripts/generate-tutorial-event-contracts.js',
    source: {
      file: SOURCE_FILE,
      sha256: crypto.createHash('sha256').update(source).digest('hex'),
    },
    events,
    exclusions: [
      {
        name: 'canOpenTab',
        reason: '否决式询问，不上事件总线',
        onlyVetoSeam: 'CanvasPanelActionRunner descriptor hooks',
        hooks: ['tutorialCanOpenTab', 'tutorialVetoFeedback'],
      },
    ],
  };
}

function writeContracts(output = DEFAULT_OUTPUT) {
  const absolute = path.resolve(REPO_ROOT, output);
  const contracts = buildContracts();
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(contracts, null, 2)}\n`);
  return { absolute, contracts };
}

if (require.main === module) {
  const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
  const output = outputArg ? outputArg.slice('--output='.length) : DEFAULT_OUTPUT;
  const checkOnly = process.argv.includes('--check');
  const result = checkOnly
    ? { absolute: path.resolve(REPO_ROOT, output), contracts: buildContracts() }
    : writeContracts(output);
  if (checkOnly) {
    const expected = `${JSON.stringify(result.contracts, null, 2)}\n`;
    const actual = fs.existsSync(result.absolute)
      ? fs.readFileSync(result.absolute, 'utf8').replace(/\r\n/g, '\n')
      : '';
    if (actual !== expected) {
      console.error(`Tutorial event contracts are stale: ${output}`);
      process.exitCode = 1;
    }
  }
  console.log(JSON.stringify({ output, checked: checkOnly, events: result.contracts.events.length }));
}

module.exports = { DEFAULT_OUTPUT, SERVER_RESULT_EVENTS, buildContracts, writeContracts };
