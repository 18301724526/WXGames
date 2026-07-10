'use strict';

const { DEBT_ITEMS } = require('./debt-items');
const { DECISIONS } = require('./decisions');
const { PERMANENT_EXCEPTIONS } = require('./permanent-exceptions');
const {
  CLASSIFIED_UI_LOCAL_DEBT_IDS,
  REMAINING_DEBT_IDS,
  RETIRED_DEBT_IDS,
  RETIREMENT_EVIDENCE,
} = require('./retirement-evidence');

function getDebtItems() {
  return [...DEBT_ITEMS].sort((a, b) => a.debtId.localeCompare(b.debtId));
}

function summarizeDebtItems(items = getDebtItems()) {
  const byPhase = {};
  const byStatus = {};
  const byClassification = {};
  for (const item of items) {
    byPhase[item.targetPhase] = (byPhase[item.targetPhase] || 0) + 1;
    byStatus[item.currentStatus] = (byStatus[item.currentStatus] || 0) + 1;
    byClassification[item.classification] = (byClassification[item.classification] || 0) + 1;
  }
  return {
    total: items.length,
    retiredCount: RETIRED_DEBT_IDS.length,
    classifiedUiLocalCount: CLASSIFIED_UI_LOCAL_DEBT_IDS.length,
    remainingCount: REMAINING_DEBT_IDS.length,
    byPhase,
    byStatus,
    byClassification,
  };
}

function buildCatalogReport() {
  const items = getDebtItems();
  return {
    schema: 'step4-debt-catalog-v1',
    generatedAt: '2026-07-10T00:00:00.000Z',
    summary: summarizeDebtItems(items),
    decisions: DECISIONS,
    permanentExceptions: PERMANENT_EXCEPTIONS,
    retirementEvidence: RETIREMENT_EVIDENCE,
    items,
  };
}

if (require.main === module) {
  const report = buildCatalogReport();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

module.exports = {
  buildCatalogReport,
  getDebtItems,
  summarizeDebtItems,
};
