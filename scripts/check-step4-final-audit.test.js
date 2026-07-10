'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { getDebtItems } = require('./step4-debt-catalog');
const {
  REMAINING_DEBT_IDS,
  RETIRED_DEBT_IDS,
  RETIREMENT_EVIDENCE,
} = require('./step4-debt-catalog/retirement-evidence');
const { inspectStep4FinalAudit } = require('./check-step4-final-audit');

const PASSING_GATE_REPORTS = {
  catalog: { summary: { totalViolations: 0 }, violations: [] },
  permanentExceptions: { summary: { totalViolations: 0 }, violations: [] },
  routeOwnedPersistence: { summary: { totalViolations: 0 }, violations: [] },
  handlerBoundary: { summary: { totalViolations: 0 }, violations: [] },
  workerWriteOwnership: { summary: { totalViolations: 0 }, violations: [] },
  frontendCommandSemantics: { summary: { totalViolations: 0 }, violations: [] },
  projectionWriteBoundary: { summary: { totalViolations: 0 }, violations: [] },
  step4BlockingMap: { summary: { totalViolations: 0 }, violations: [] },
};

test('Step4 final audit accepts live catalog with passing structural gates', () => {
  const report = inspectStep4FinalAudit({ gateReports: PASSING_GATE_REPORTS });

  assert.equal(report.summary.totalViolations, 0, report.violations.join('\n'));
});

test('Step4 final audit fires when remaining count is not reduced below baseline', () => {
  const report = inspectStep4FinalAudit({
    remainingDebtIds: Array.from({ length: 20 }, (_, index) => `STEP4-DEBT-${String(index + 1).padStart(3, '0')}`),
    gateReports: PASSING_GATE_REPORTS,
  });

  assert.ok(report.violations.some((violation) => violation.includes('not below baseline')));
});

test('Step4 final audit fires when retired evidence lacks a FIRE probe', () => {
  const evidence = RETIREMENT_EVIDENCE.map((record) => (
    record.debtId === RETIRED_DEBT_IDS[0] ? { ...record, fireProbe: '' } : record
  ));
  const report = inspectStep4FinalAudit({ retirementEvidence: evidence, gateReports: PASSING_GATE_REPORTS });

  assert.ok(report.violations.some((violation) => violation.includes('missing FIRE probe')));
});

test('Step4 final audit fires when remaining debt lacks owner metadata', () => {
  const debtItems = getDebtItems().map((item) => (
    item.debtId === REMAINING_DEBT_IDS[0] ? { ...item, owner: '' } : item
  ));
  const report = inspectStep4FinalAudit({ debtItems, gateReports: PASSING_GATE_REPORTS });

  assert.ok(report.violations.some((violation) => violation.includes('remaining debt missing owner')));
});

test('Step4 final audit surfaces structural gate regressions', () => {
  const report = inspectStep4FinalAudit({
    gateReports: {
      ...PASSING_GATE_REPORTS,
      handlerBoundary: { summary: { totalViolations: 1 }, violations: ['synthetic handler save'] },
    },
  });

  assert.ok(report.violations.some((violation) => violation.includes('handlerBoundary gate has 1')));
});
