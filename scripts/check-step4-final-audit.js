#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const { getDebtItems, summarizeDebtItems } = require('./step4-debt-catalog');
const {
  CLASSIFIED_UI_LOCAL_DEBT_IDS,
  REMAINING_DEBT_IDS,
  RETIRED_DEBT_IDS,
  RETIREMENT_EVIDENCE,
} = require('./step4-debt-catalog/retirement-evidence');
const { inspectCatalog } = require('./check-step4-debt-catalog');
const { inspectPermanentExceptions } = require('./check-permanent-exceptions');
const { scanRouteOwnedPersistence } = require('./check-route-owned-persistence');
const { inspectHandlerBoundary } = require('./check-handler-boundary');
const { inspectWorkerWriteOwnership } = require('./check-worker-write-ownership');
const { inspectFrontendCommandSemantics } = require('./check-frontend-command-semantics');
const { inspectProjectionWriteBoundary } = require('./check-projection-write-boundary');
const { inspectStep4BlockingMap } = require('./check-step4-blocking-map');

const BASELINE_DEBT_COUNT = 20;

function parseArgs(argv) {
  const options = { json: false };
  for (const arg of argv) {
    if (arg === '--json') options.json = true;
    else if (arg === '--blocking') options.blocking = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function push(violations, message) {
  violations.push(message);
}

function normalizeGateReport(report) {
  if (!report) return { totalViolations: 0, violations: [] };
  return {
    totalViolations: report.summary?.totalViolations ?? report.violations?.length ?? 0,
    violations: report.violations || [],
  };
}

function buildLiveGateReports() {
  return {
    catalog: inspectCatalog(),
    permanentExceptions: inspectPermanentExceptions(),
    routeOwnedPersistence: scanRouteOwnedPersistence(),
    handlerBoundary: inspectHandlerBoundary(),
    workerWriteOwnership: inspectWorkerWriteOwnership(),
    frontendCommandSemantics: inspectFrontendCommandSemantics(),
    projectionWriteBoundary: inspectProjectionWriteBoundary(),
    step4BlockingMap: inspectStep4BlockingMap(),
  };
}

function inspectStep4FinalAudit({
  debtItems = getDebtItems(),
  retiredDebtIds = RETIRED_DEBT_IDS,
  classifiedUiLocalDebtIds = CLASSIFIED_UI_LOCAL_DEBT_IDS,
  remainingDebtIds = REMAINING_DEBT_IDS,
  retirementEvidence = RETIREMENT_EVIDENCE,
  gateReports = null,
} = {}) {
  const violations = [];
  const summary = summarizeDebtItems(debtItems);
  const debtById = new Map(debtItems.map((item) => [item.debtId, item]));
  const evidenceByDebtId = new Map(retirementEvidence.map((item) => [item.debtId, item]));

  if (debtItems.length !== BASELINE_DEBT_COUNT) {
    push(violations, `Phase 0 baseline debt count changed: expected ${BASELINE_DEBT_COUNT}, got ${debtItems.length}`);
  }
  if (remainingDebtIds.length >= BASELINE_DEBT_COUNT) {
    push(violations, `remaining debt count ${remainingDebtIds.length} is not below baseline ${BASELINE_DEBT_COUNT}`);
  }

  retiredDebtIds.forEach((debtId) => {
    const item = debtById.get(debtId);
    const evidence = evidenceByDebtId.get(debtId);
    if (!item) {
      push(violations, `${debtId} retired id missing from catalog`);
      return;
    }
    if (item.currentStatus !== 'retired') {
      push(violations, `${debtId} retired id has status ${item.currentStatus}`);
    }
    if (!item.retiredStep4) push(violations, `${debtId} missing retired-step4 metadata`);
    if (!evidence) {
      push(violations, `${debtId} missing retirement evidence`);
      return;
    }
    if (!evidence.blockingGate || !fs.existsSync(evidence.blockingGate)) {
      push(violations, `${debtId} missing existing blocking gate ${evidence.blockingGate || '(empty)'}`);
    }
    if (!evidence.fireProbe) push(violations, `${debtId} missing FIRE probe`);
    if (!Array.isArray(evidence.tests) || !evidence.tests.length) {
      push(violations, `${debtId} missing FIRE tests`);
    }
  });

  classifiedUiLocalDebtIds.forEach((debtId) => {
    const item = debtById.get(debtId);
    if (!item) {
      push(violations, `${debtId} classified-ui-local id missing from catalog`);
      return;
    }
    const meta = item.classifiedUiLocal || {};
    ['actionType', 'reason', 'proofNotClientCommandSender', 'owner', 'growthPreventionTest'].forEach((field) => {
      if (!meta[field]) push(violations, `${debtId} classified-ui-local missing ${field}`);
    });
    if (meta.growthPreventionTest && !fs.existsSync(meta.growthPreventionTest)) {
      push(violations, `${debtId} classified-ui-local growthPreventionTest missing: ${meta.growthPreventionTest}`);
    }
  });

  remainingDebtIds.forEach((debtId) => {
    const item = debtById.get(debtId);
    if (!item) {
      push(violations, `${debtId} remaining id missing from catalog`);
      return;
    }
    ['owner', 'reason', 'retirementCondition', 'growthPreventionTest'].forEach((field) => {
      if (!item[field]) push(violations, `${debtId} remaining debt missing ${field}`);
    });
    if (item.growthPreventionTest && !fs.existsSync(item.growthPreventionTest)) {
      push(violations, `${debtId} remaining debt growthPreventionTest missing: ${item.growthPreventionTest}`);
    }
  });

  const reports = gateReports || buildLiveGateReports();
  Object.entries(reports).forEach(([name, report]) => {
    const normalized = normalizeGateReport(report);
    if (normalized.totalViolations > 0) {
      push(violations, `${name} gate has ${normalized.totalViolations} violation(s)`);
    }
  });

  return {
    summary: {
      baselineDebtCount: BASELINE_DEBT_COUNT,
      totalDebtItems: debtItems.length,
      retiredDebtIds: retiredDebtIds.length,
      classifiedUiLocalDebtIds: classifiedUiLocalDebtIds.length,
      remainingDebtIds: remainingDebtIds.length,
      catalogRemainingCount: summary.remainingCount,
      totalViolations: violations.length,
    },
    violations,
  };
}

function renderText(report) {
  const lines = [
    '[step4-final-audit] final self-audit gate',
    `baseline debt count: ${report.summary.baselineDebtCount}`,
    `total debt items: ${report.summary.totalDebtItems}`,
    `retired debt ids: ${report.summary.retiredDebtIds}`,
    `classified-ui-local debt ids: ${report.summary.classifiedUiLocalDebtIds}`,
    `remaining debt ids: ${report.summary.remainingDebtIds}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  report.violations.forEach((violation) => lines.push(`  ${violation}`));
  lines.push(report.summary.totalViolations === 0 ? 'passed' : 'FAILED');
  return lines.join('\n');
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = inspectStep4FinalAudit();
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(`${renderText(report)}\n`);
    process.exit(report.summary.totalViolations === 0 ? 0 : 1);
  } catch (error) {
    process.stderr.write(`[step4-final-audit] failed: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  BASELINE_DEBT_COUNT,
  inspectStep4FinalAudit,
  parseArgs,
  renderText,
};
