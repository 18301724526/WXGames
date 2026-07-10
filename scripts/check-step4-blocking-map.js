#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const { getDebtItems } = require('./step4-debt-catalog');
const {
  RETIRED_DEBT_IDS,
  RETIREMENT_EVIDENCE,
} = require('./step4-debt-catalog/retirement-evidence');

function parseArgs(argv) {
  const options = { json: false };
  for (const arg of argv) {
    if (arg === '--json') options.json = true;
    else if (arg === '--blocking') options.blocking = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function inspectStep4BlockingMap({
  debtItems = getDebtItems(),
  retiredDebtIds = RETIRED_DEBT_IDS,
  evidence = RETIREMENT_EVIDENCE,
} = {}) {
  const violations = [];
  const debtById = new Map(debtItems.map((item) => [item.debtId, item]));
  const evidenceByDebtId = new Map(evidence.map((item) => [item.debtId, item]));

  retiredDebtIds.forEach((debtId) => {
    const debt = debtById.get(debtId);
    const record = evidenceByDebtId.get(debtId);
    if (!debt) {
      violations.push(`${debtId} is retired but missing from Step4 debt catalog`);
      return;
    }
    if (debt.currentStatus !== 'retired') {
      violations.push(`${debtId} is in retired map but catalog status is ${debt.currentStatus}`);
    }
    if (!debt.retiredStep4) {
      violations.push(`${debtId} is retired without retired-step4 metadata`);
    }
    if (!record) {
      violations.push(`${debtId} missing retirement evidence record`);
      return;
    }
    if (!record.blockingGate || !fs.existsSync(record.blockingGate)) {
      violations.push(`${debtId} blocking gate missing: ${record.blockingGate || '(empty)'}`);
    }
    if (!record.fireProbe) {
      violations.push(`${debtId} missing FIRE probe identifier`);
    }
    if (!Array.isArray(record.tests) || record.tests.length === 0) {
      violations.push(`${debtId} missing FIRE/coverage tests`);
    } else {
      record.tests.forEach((file) => {
        if (!fs.existsSync(file)) violations.push(`${debtId} test file missing: ${file}`);
      });
    }
  });

  evidence.forEach((record) => {
    if (!retiredDebtIds.includes(record.debtId)) {
      violations.push(`${record.debtId} has retirement evidence but is not in retired map`);
    }
  });

  return {
    summary: {
      retiredDebtIds: retiredDebtIds.length,
      evidenceRecords: evidence.length,
      totalViolations: violations.length,
    },
    violations,
  };
}

function renderText(report) {
  const lines = [
    '[step4-blocking-map] retired debt blocking map gate',
    `retired debt ids: ${report.summary.retiredDebtIds}`,
    `evidence records: ${report.summary.evidenceRecords}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  report.violations.forEach((violation) => lines.push(`  ${violation}`));
  lines.push(report.summary.totalViolations === 0 ? 'passed' : 'FAILED');
  return lines.join('\n');
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = inspectStep4BlockingMap();
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(`${renderText(report)}\n`);
    process.exit(report.summary.totalViolations === 0 ? 0 : 1);
  } catch (error) {
    process.stderr.write(`[step4-blocking-map] failed: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  inspectStep4BlockingMap,
  parseArgs,
  renderText,
};
