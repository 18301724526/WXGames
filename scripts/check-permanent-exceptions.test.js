'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { inspectPermanentExceptions } = require('./check-permanent-exceptions');
const { getDebtItems } = require('./step4-debt-catalog');
const { PERMANENT_EXCEPTIONS } = require('./step4-debt-catalog/permanent-exceptions');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('permanent exception records validate current Step4 exceptions', () => {
  const report = inspectPermanentExceptions();
  assert.equal(report.summary.totalExceptions, 8);
  assert.equal(report.summary.totalViolations, 0);
});

test('permanent exception gate rejects missing growth prevention test evidence', () => {
  const exceptions = clone(PERMANENT_EXCEPTIONS);
  exceptions[0].growthPreventionTest = 'scripts/missing-growth-test.js';

  const report = inspectPermanentExceptions({ exceptions });
  assert.equal(report.summary.totalViolations > 0, true);
  assert.match(report.violations.join('\n'), /growthPreventionTest does not exist/);
});

test('permanent exception gate rejects undocumented permanent debts', () => {
  const debtItems = clone(getDebtItems());
  debtItems.find((item) => item.debtId === 'STEP4-DEBT-009').currentStatus = 'permanent-exception';

  const report = inspectPermanentExceptions({ debtItems });
  assert.equal(report.summary.totalViolations > 0, true);
  assert.match(report.violations.join('\n'), /without exception record/);
});
