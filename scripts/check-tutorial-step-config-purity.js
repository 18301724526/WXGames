const path = require('node:path');

const DEFAULT_CONFIG = path.resolve(
  __dirname,
  '..',
  'frontend',
  'js',
  'tutorial-config',
  'TaskPanelStepScripts.js',
);

const EXPECTED_RULE_IDS = Object.freeze([
  'first-era-open-task-center',
  'first-era-claim-supplies',
  'era2-open-civilization',
  'era2-open-events',
  'lumbermill-open-task-center',
  'lumbermill-claim-task',
  'era3-open-civilization',
  'barracks-open-task-center',
  'barracks-claim-supplies',
  'first-army-open-task-center',
  'first-army-claim',
  'scout-officer-open-task-center',
  'scout-officer-claim',
  'final-tech-open',
]);

const ALLOWED_SCRIPT_TYPES = new Set([
  'highlightActionWait',
  'ensureSurfaceThenHighlight',
  'waitEventThenNext',
]);
const ALLOWED_QUERY_NAMES = new Set(['isTaskCenterOpen', 'isCommandPanelOpen']);
const ALLOWED_SCRIPT_KEYS = new Set([
  'type',
  'ruleId',
  'when',
  'clauses',
  'panel',
  'target',
  'messageKey',
  'eventName',
]);
const ALLOWED_CLAUSE_KEYS = new Set([
  'ruleId',
  'when',
  'panel',
  'target',
  'messageKey',
  'eventName',
]);
const ALLOWED_WHEN_KEYS = new Set(['query', 'args', 'equals']);

function inspectFrozenData(value, valuePath = 'config', violations = []) {
  if (typeof value === 'function') {
    violations.push(`${valuePath} contains a function`);
    return violations;
  }
  if (!value || typeof value !== 'object') return violations;
  if (!Object.isFrozen(value)) violations.push(`${valuePath} is not frozen`);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectFrozenData(entry, `${valuePath}[${index}]`, violations));
    return violations;
  }
  Object.entries(value).forEach(([key, entry]) => {
    inspectFrozenData(entry, `${valuePath}.${key}`, violations);
  });
  return violations;
}

function inspectWhen(when, valuePath, violations) {
  if (!when || typeof when !== 'object' || Array.isArray(when)) {
    violations.push(`${valuePath} must be a data object`);
    return;
  }
  Object.keys(when).forEach((key) => {
    if (!ALLOWED_WHEN_KEYS.has(key)) violations.push(`${valuePath}.${key} is not allowed`);
  });
  if (!ALLOWED_QUERY_NAMES.has(when.query)) {
    violations.push(`${valuePath}.query is not in the E1 query table: ${when.query || '(empty)'}`);
  }
  if (when.args !== undefined && !Array.isArray(when.args)) {
    violations.push(`${valuePath}.args must be an array`);
  }
}

function inspectEntry(entry, valuePath, allowedKeys, violations, ruleIds) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    violations.push(`${valuePath} must be a data object`);
    return;
  }
  Object.keys(entry).forEach((key) => {
    if (!allowedKeys.has(key)) violations.push(`${valuePath}.${key} is not an allowed config field`);
  });
  if (entry.ruleId) ruleIds.push(entry.ruleId);
  if (entry.when !== undefined) inspectWhen(entry.when, `${valuePath}.when`, violations);
  ['ruleId', 'panel', 'target', 'messageKey', 'eventName'].forEach((key) => {
    if (entry[key] !== undefined && typeof entry[key] !== 'string') {
      violations.push(`${valuePath}.${key} must be a string`);
    }
  });
}

function inspectConfig(config = {}) {
  const violations = inspectFrozenData(config);
  const ruleIds = [];
  Object.entries(config || {}).forEach(([stepKey, script]) => {
    const valuePath = `config.${stepKey}`;
    inspectEntry(script, valuePath, ALLOWED_SCRIPT_KEYS, violations, ruleIds);
    if (!ALLOWED_SCRIPT_TYPES.has(script?.type)) {
      violations.push(`${valuePath}.type is not registered: ${script?.type || '(empty)'}`);
    }
    if (script?.clauses !== undefined) {
      if (!Array.isArray(script.clauses)) {
        violations.push(`${valuePath}.clauses must be an array`);
      } else {
        script.clauses.forEach((clause, index) => {
          inspectEntry(
            clause,
            `${valuePath}.clauses[${index}]`,
            ALLOWED_CLAUSE_KEYS,
            violations,
            ruleIds,
          );
        });
      }
    }
  });
  const uniqueRuleIds = Array.from(new Set(ruleIds)).sort();
  const expected = [...EXPECTED_RULE_IDS].sort();
  if (JSON.stringify(uniqueRuleIds) !== JSON.stringify(expected)) {
    violations.push(`rule id mapping mismatch: ${uniqueRuleIds.join(', ')}`);
  }
  return {
    ok: violations.length === 0,
    violations,
    stepKeyCount: Object.keys(config || {}).length,
    ruleOccurrenceCount: ruleIds.length,
    uniqueRuleIds,
  };
}

function main() {
  const file = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_CONFIG;
  delete require.cache[file];
  const result = inspectConfig(require(file));
  if (!result.ok) {
    result.violations.forEach((violation) => console.error(violation));
    process.exitCode = 1;
    return;
  }
  console.log(
    `Tutorial StepScript config purity check passed: ${result.stepKeyCount} step key(s), ${result.uniqueRuleIds.length} rule id(s), zero functions.`,
  );
}

if (require.main === module) main();

module.exports = {
  EXPECTED_RULE_IDS,
  inspectConfig,
};
