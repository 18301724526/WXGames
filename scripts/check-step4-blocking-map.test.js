'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { getDebtItems } = require('./step4-debt-catalog');
const { inspectStep4BlockingMap } = require('./check-step4-blocking-map');
const {
  RETIRED_DEBT_IDS,
  RETIREMENT_EVIDENCE,
} = require('./step4-debt-catalog/retirement-evidence');

test('Step4 blocking map accepts live retired debt evidence', () => {
  const report = inspectStep4BlockingMap();

  assert.equal(report.summary.totalViolations, 0, report.violations.join('\n'));
});

test('Step4 blocking map fires when a retired debt id lacks evidence', () => {
  const report = inspectStep4BlockingMap({
    evidence: RETIREMENT_EVIDENCE.filter((record) => record.debtId !== RETIRED_DEBT_IDS[0]),
  });

  assert.ok(report.violations.some((violation) => violation.includes('missing retirement evidence')));
});

test('Step4 blocking map fires when catalog status is not retired', () => {
  const debtItems = getDebtItems().map((item) => (
    item.debtId === RETIRED_DEBT_IDS[0] ? { ...item, currentStatus: 'remaining-explicit' } : item
  ));
  const report = inspectStep4BlockingMap({ debtItems });

  assert.ok(report.violations.some((violation) => violation.includes('catalog status is remaining-explicit')));
});
