const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../frontend/js/tutorial-config/TaskPanelStepScripts');
const {
  inspectConfig,
} = require('./check-tutorial-step-config-purity');

test('tutorial StepScript config purity gate accepts the live frozen config', () => {
  const result = inspectConfig(config);

  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2));
  assert.equal(result.stepKeyCount, 14);
  assert.equal(result.ruleOccurrenceCount, 23);
  assert.equal(result.uniqueRuleIds.length, 22);
});

test('tutorial StepScript config purity FIRE rejects predicates and functions', () => {
  const result = inspectConfig({
    badStep: {
      type: 'highlightActionWait',
      clauses: [{
        ruleId: 'bad-rule',
        predicate: () => true,
        target: 'badTarget',
      }],
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.violations.some((item) => item.includes('contains a function')), true);
  assert.equal(result.violations.some((item) => item.includes('predicate is not an allowed')), true);
});

test('tutorial StepScript config purity FIRE rejects undeclared queries', () => {
  const result = inspectConfig(Object.freeze({
    badStep: Object.freeze({
      type: 'highlightActionWait',
      ruleId: 'bad-rule',
      when: Object.freeze({ query: 'readArmyCount' }),
      target: 'badTarget',
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.violations.some((item) => item.includes('not in the E1 query table')), true);
});

test('tutorial StepScript config purity FIRE rejects effects outside the frozen host table', () => {
  const result = inspectConfig(Object.freeze({
    badStep: Object.freeze({
      type: 'effectSequence',
      ruleId: 'bad-rule',
      effects: Object.freeze([
        Object.freeze({ effect: 'ensureMapHomeGuideVisible' }),
      ]),
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(
    result.violations.some((item) => item.includes('not in the frozen host table')),
    true,
  );
});
