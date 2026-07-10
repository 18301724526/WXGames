#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const { getDebtItems } = require('./step4-debt-catalog');
const { PERMANENT_EXCEPTIONS } = require('./step4-debt-catalog/permanent-exceptions');

function parseArgs(argv) {
  const options = { json: false };
  for (const arg of argv) {
    if (arg === '--json') options.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function inspectPermanentExceptions({
  debtItems = getDebtItems(),
  exceptions = PERMANENT_EXCEPTIONS,
} = {}) {
  const violations = [];
  const debtById = new Map(debtItems.map((item) => [item.debtId, item]));
  const seenExceptionIds = new Set();
  const exceptionDebtIds = new Set();

  for (const exception of exceptions) {
    const label = exception.exceptionId || '(missing exceptionId)';
    if (!/^PERM-EXC-\d{3}$/.test(label)) violations.push(`${label} invalid exceptionId`);
    if (seenExceptionIds.has(label)) violations.push(`${label} duplicate exceptionId`);
    seenExceptionIds.add(label);
    if (!exception.debtId || !debtById.has(exception.debtId)) violations.push(`${label} references unknown debtId ${exception.debtId}`);
    exceptionDebtIds.add(exception.debtId);
    ['inventoryId', 'owner', 'reason', 'retirementCondition', 'growthPreventionTest', 'lastReviewed'].forEach((field) => {
      if (!exception[field]) violations.push(`${label} missing ${field}`);
    });
    if (!Array.isArray(exception.contracts) || exception.contracts.length === 0) {
      violations.push(`${label} missing contracts`);
    }
    if (exception.growthPreventionTest && !fs.existsSync(exception.growthPreventionTest)) {
      violations.push(`${label} growthPreventionTest does not exist: ${exception.growthPreventionTest}`);
    }
    const item = debtById.get(exception.debtId);
    if (item && item.currentStatus !== 'permanent-exception') {
      violations.push(`${label} debt ${exception.debtId} status is ${item.currentStatus}, not permanent-exception`);
    }
  }

  debtItems
    .filter((item) => item.currentStatus === 'permanent-exception')
    .forEach((item) => {
      if (!exceptionDebtIds.has(item.debtId)) {
        violations.push(`${item.debtId} is permanent-exception without exception record`);
      }
    });

  return {
    summary: {
      totalExceptions: exceptions.length,
      totalViolations: violations.length,
    },
    violations,
  };
}

function renderText(report) {
  const lines = [
    '[permanent-exceptions] blocking gate',
    `exceptions: ${report.summary.totalExceptions}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  report.violations.forEach((violation) => lines.push(`  ${violation}`));
  lines.push(report.summary.totalViolations === 0 ? 'passed' : 'FAILED');
  return lines.join('\n');
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = inspectPermanentExceptions();
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(`${renderText(report)}\n`);
    process.exit(report.summary.totalViolations === 0 ? 0 : 1);
  } catch (error) {
    process.stderr.write(`[permanent-exceptions] failed: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  inspectPermanentExceptions,
  parseArgs,
  renderText,
};
