'use strict';

const path = require('node:path');

const { CONTRACT_IDS, MODE, REPORT_NAME, STEP1_CHECKS } = require('./contracts');
const inventories = require('./inventories');
const { assertAntiEvasionFixtures } = require('./anti-evasion');

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function escapeMarkdownCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function buildContractCoverageIndex(checks = STEP1_CHECKS) {
  return CONTRACT_IDS.map((contractId) => {
    const coveredBy = checks
      .filter((check) => check.contracts.includes(contractId))
      .map((check) => check.id);
    return {
      contractId,
      coveredBy,
      status: coveredBy.length ? 'mapped-to-step1-report' : 'missing-step1-report',
    };
  });
}

function finding(checkId, item, detail = {}) {
  return {
    checkId,
    inventoryId: item.inventoryId || item.action || item.helper || detail.inventoryId || '',
    classification: detail.classification || item.classification || item.idempotencyClassification || '',
    contracts: detail.contracts || item.contracts || [],
    evidence: detail.evidence || item.evidence || [],
    summary: detail.summary || item.notes || '',
  };
}

function buildCheckFindings(checkId) {
  if (checkId === 'write-command-inventory') {
    return [
      ...inventories.SERVER_WRITE_ENTRIES.map((item) => finding(checkId, item, {
        classification: item.writeEntryKind,
        summary: `${item.method} ${item.route} -> ${item.commandType}`,
      })),
      ...inventories.GAME_ACTIONS.map((item) => finding(checkId, item, {
        classification: 'game-action-inventory',
        summary: `${item.action} -> ${item.handler}`,
      })),
      ...inventories.FRONTEND_WRITE_HELPERS.map((item) => finding(checkId, item, {
        classification: item.submissionClassification,
        summary: `GameAPI.${item.helper} -> ${item.endpoint} ${item.commandType}`,
      })),
    ];
  }
  if (checkId === 'client-command-domain-blockers' || checkId === 'client-disabled-command-path') {
    return inventories.CLIENT_LOCAL_BLOCKS
      .filter((item) => item.classification === 'domain-blocker')
      .map((item) => finding(checkId, item, { summary: `${item.producer} -> ${item.consumer}: ${item.reason}` }));
  }
  if (checkId === 'frontend-write-submission-path') {
    return [
      ...inventories.FRONTEND_WRITE_HELPERS,
      ...inventories.FRONTEND_COMMAND_PATHS,
    ].map((item) => finding(checkId, item, {
      classification: item.submissionClassification,
      summary: item.helper ? `GameAPI.${item.helper}` : `${item.producer} -> ${item.consumer}`,
    }));
  }
  if (checkId === 'route-write-orchestration') {
    return inventories.ROUTE_ORCHESTRATION_DEBT.map((item) => finding(checkId, item, {
      summary: item.orchestration,
    }));
  }
  if (checkId === 'handler-lock-persistence') {
    return inventories.HANDLER_LOCK_PERSISTENCE_DEBT.map((item) => finding(checkId, item, {
      summary: `${item.handler}: lock=${item.lockOwner}; persistence=${item.persistenceOwner}`,
    }));
  }
  if (checkId === 'owner-key-coverage') {
    return inventories.GAME_ACTIONS.map((item) => finding(checkId, item, {
      classification: item.provisionalOwnerKey.includes('{')
        ? 'provisional-owner-declared'
        : 'owner-resolution-blocker',
      contracts: ['COP-OWNER-001', 'COP-OWNER-002', 'COP-SHARED-001'],
      summary: `${item.action} owner=${item.provisionalOwnerKey}`,
    }));
  }
  if (checkId === 'shared-owner-lookup-coverage') {
    return inventories.SHARED_OWNER_LOOKUPS.map((item) => finding(checkId, item, {
      summary: `${item.commandType} owner=${item.ownerKeyType}; missing=${item.missingTargetError}`,
    }));
  }
  if (checkId === 'idempotency-coverage' || checkId === 'server-fallback-id-classification') {
    return [
      ...inventories.SERVER_WRITE_ENTRIES,
      ...inventories.FRONTEND_WRITE_HELPERS,
    ].map((item) => finding(checkId, item, {
      classification: item.idempotencyClassification,
      contracts: ['COP-IDEMP-001', 'COP-ENVELOPE-001'],
      summary: `${item.inventoryId || item.helper} idempotency=${item.idempotencyClassification}`,
    }));
  }
  if (checkId === 'shared-owner-write-coverage') {
    return inventories.SHARED_OWNER_WRITES.map((item) => finding(checkId, item, {
      summary: `${item.ownerType}: ${item.currentOwnerModel} -> ${item.requiredOwnerModel}`,
    }));
  }
  if (checkId === 'allowlist-debt-record') {
    return inventories.ALLOWLIST_DEBT_RECORDS.map((item) => finding(checkId, item));
  }
  return [];
}

function buildReport(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const antiEvasion = assertAntiEvasionFixtures();
  const checks = STEP1_CHECKS.map((check) => ({
    ...check,
    mode: MODE,
    status: 'report-only',
    findings: buildCheckFindings(check.id),
  }));
  const contractCoverage = buildContractCoverageIndex(checks);
  const totalFindings = checks.reduce((total, check) => total + check.findings.length, 0);
  return {
    report: REPORT_NAME,
    mode: MODE,
    generatedAt: new Date().toISOString(),
    repoRoot: normalizePath(path.resolve(repoRoot)),
    step: 'Step1 prerequisite staging only',
    nonGoals: [
      'No Step2 admission judgment',
      'No Step3 formal command owner pipeline',
      'No route migration',
      'No ClientCommandSender behavior',
      'No frontend command behavior change',
    ],
    contractCoverage,
    checks,
    inventories,
    antiEvasion,
    summary: {
      totalContracts: contractCoverage.length,
      mappedContracts: contractCoverage.filter((item) => item.coveredBy.length > 0).length,
      totalChecks: checks.length,
      totalFindings,
      antiEvasionAssertions: antiEvasion.length,
      serverWriteEntries: inventories.SERVER_WRITE_ENTRIES.length,
      gameActions: inventories.GAME_ACTIONS.length,
      frontendWriteHelpers: inventories.FRONTEND_WRITE_HELPERS.length,
      frontendCommandPaths: inventories.FRONTEND_COMMAND_PATHS.length,
    },
  };
}

function renderSummary(report) {
  const lines = [
    `[${REPORT_NAME}] ${MODE} Step1 staging report`,
    report.step,
    `contracts mapped: ${report.summary.mappedContracts}/${report.summary.totalContracts}`,
    `checks defined: ${report.summary.totalChecks}`,
    `server write entries inventoried: ${report.summary.serverWriteEntries}`,
    `game actions inventoried: ${report.summary.gameActions}`,
    `frontend write helpers inventoried: ${report.summary.frontendWriteHelpers}`,
    `frontend command paths inventoried: ${report.summary.frontendCommandPaths}`,
    `findings: ${report.summary.totalFindings}`,
    `anti-evasion assertions: ${report.summary.antiEvasionAssertions}`,
  ];
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(report) {
  const lines = [
    '# Command Owner Pipeline Step1 Evidence Package',
    '',
    `Mode: ${report.mode}. This package is Step1 evidence for later Step2 review, not a Step2 admission decision.`,
    '',
    '## Summary',
    '',
    `- Contracts mapped: ${report.summary.mappedContracts}/${report.summary.totalContracts}`,
    `- Step1 checks: ${report.summary.totalChecks}`,
    `- Report-only findings: ${report.summary.totalFindings}`,
    `- Anti-evasion assertions: ${report.summary.antiEvasionAssertions}`,
    '',
    '## Contract Coverage',
    '',
    '| Contract | Status | Step1 Checks |',
    '| --- | --- | --- |',
  ];
  report.contractCoverage.forEach((item) => {
    lines.push(`| ${escapeMarkdownCell(item.contractId)} | ${escapeMarkdownCell(item.status)} | ${escapeMarkdownCell(item.coveredBy.join(', '))} |`);
  });
  lines.push('', '## Checks', '', '| Check | Mode | Findings | Contracts |', '| --- | --- | ---: | --- |');
  report.checks.forEach((check) => {
    lines.push(`| ${escapeMarkdownCell(check.id)} | ${escapeMarkdownCell(check.mode)} | ${check.findings.length} | ${escapeMarkdownCell(check.contracts.join(', '))} |`);
  });
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const result = { format: 'summary' };
  for (const arg of argv) {
    if (arg === '--summary') result.format = 'summary';
    else if (arg === '--json') result.format = 'json';
    else if (arg === '--markdown') result.format = 'markdown';
    else throw new Error(`unknown argument: ${arg}`);
  }
  return result;
}

module.exports = {
  CONTRACT_IDS,
  MODE,
  REPORT_NAME,
  STEP1_CHECKS,
  buildContractCoverageIndex,
  buildReport,
  buildCheckFindings,
  normalizePath,
  parseArgs,
  renderMarkdown,
  renderSummary,
};
