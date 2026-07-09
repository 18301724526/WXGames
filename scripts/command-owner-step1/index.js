'use strict';

const path = require('node:path');

const { CONTRACT_IDS, MODE, REPORT_NAME, STEP1_CHECKS } = require('./contracts');
const inventories = require('./inventories');
const { assertAntiEvasionFixtures } = require('./anti-evasion');
const { buildDirectSubmitCallSiteKey, scanRepository } = require('./scanner');

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

function driftFinding(checkId, inventoryId, detail = {}) {
  return {
    checkId,
    inventoryId,
    classification: detail.classification || 'inventory-drift',
    contracts: detail.contracts || ['COP-ENTRY-001', 'COP-ALLOWLIST-001'],
    evidence: detail.evidence || [],
    summary: detail.summary || '',
  };
}

function splitMethod(method) {
  return String(method || '')
    .split('|')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function buildDeclaredRouteKeys() {
  const keys = new Set();
  inventories.SERVER_WRITE_ENTRIES.forEach((item) => {
    splitMethod(item.method).forEach((method) => {
      keys.add(`${method} ${item.route}`);
    });
  });
  return keys;
}

function buildServerWriteReconciliationFindings(checkId, scanResults = {}) {
  const scannedRoutes = scanResults.serverWriteRoutes || [];
  const declaredKeys = buildDeclaredRouteKeys();
  const scannedKeys = new Set(scannedRoutes.map((item) => item.key));
  const findings = [];
  scannedRoutes.forEach((item) => {
    if (declaredKeys.has(item.key)) return;
    findings.push(driftFinding(checkId, `scanner:server-write-route:${item.key}`, {
      classification: 'inventory-drift-undeclared-server-write-route',
      contracts: ['COP-ENTRY-001', 'COP-ROUTE-001', 'COP-ALLOWLIST-001'],
      evidence: item.evidence,
      summary: `${item.key} is a scanned write route with no SERVER_WRITE_ENTRIES declaration`,
    }));
  });
  declaredKeys.forEach((key) => {
    if (scannedKeys.has(key)) return;
    findings.push(driftFinding(checkId, `scanner:server-write-route-missing:${key}`, {
      classification: 'inventory-drift-declared-server-write-route-missing',
      contracts: ['COP-ENTRY-001', 'COP-ROUTE-001', 'COP-ALLOWLIST-001'],
      summary: `${key} is declared in SERVER_WRITE_ENTRIES but was not found by the route scanner`,
    }));
  });
  return findings;
}

function buildGameActionReconciliationFindings(checkId, scanResults = {}) {
  const scannedActions = scanResults.gameActions || [];
  const scannedKeys = new Map(scannedActions.map((item) => [`${item.routeEntry}:${item.action}`, item]));
  const declaredKeys = new Map(inventories.GAME_ACTIONS.map((item) => [`${item.routeEntry}:${item.action}`, item]));
  const findings = [];
  scannedKeys.forEach((item, key) => {
    if (declaredKeys.has(key)) return;
    findings.push(driftFinding(checkId, `scanner:game-action:${key}`, {
      classification: 'inventory-drift-undeclared-game-action',
      contracts: ['COP-ENTRY-001', 'COP-OWNER-001', 'COP-ALLOWLIST-001'],
      evidence: item.evidence,
      summary: `${item.action} is scanned as ${item.routeEntry} but has no matching GAME_ACTIONS declaration`,
    }));
  });
  declaredKeys.forEach((item, key) => {
    if (scannedKeys.has(key)) return;
    findings.push(driftFinding(checkId, `scanner:game-action-missing:${key}`, {
      classification: 'inventory-drift-declared-game-action-missing',
      contracts: ['COP-ENTRY-001', 'COP-OWNER-001', 'COP-ALLOWLIST-001'],
      evidence: item.evidence,
      summary: `${item.action} is declared as ${item.routeEntry} but was not found by the action scanner`,
    }));
  });
  return findings;
}

function buildGameApiReconciliationFindings(checkId, scanResults = {}) {
  const scannedHelpers = scanResults.gameApiWriteHelpers || [];
  const scannedByHelper = new Map(scannedHelpers.map((item) => [item.helper, item]));
  const declaredByHelper = new Map(inventories.FRONTEND_WRITE_HELPERS.map((item) => [item.helper, item]));
  const findings = [];
  scannedByHelper.forEach((item, helper) => {
    if (declaredByHelper.has(helper)) return;
    findings.push(driftFinding(checkId, `scanner:gameapi-helper:${helper}`, {
      classification: 'inventory-drift-undeclared-gameapi-write-helper',
      contracts: ['COP-ENTRY-001', 'COP-CLIENT-002', 'COP-ALLOWLIST-001'],
      evidence: item.evidence,
      summary: `GameAPI.${helper} posts to ${item.endpoint} but has no FRONTEND_WRITE_HELPERS declaration`,
    }));
  });
  declaredByHelper.forEach((item, helper) => {
    if (scannedByHelper.has(helper)) return;
    findings.push(driftFinding(checkId, `scanner:gameapi-helper-missing:${helper}`, {
      classification: 'inventory-drift-declared-gameapi-write-helper-missing',
      contracts: ['COP-ENTRY-001', 'COP-CLIENT-002', 'COP-ALLOWLIST-001'],
      evidence: item.evidence,
      summary: `GameAPI.${helper} is declared but no POST helper was found in frontend/js/api/GameAPI.js`,
    }));
  });
  return findings;
}

function buildDirectSubmitReconciliationFindings(checkId, scanResults = {}) {
  const scannedCalls = scanResults.frontendDirectSubmits || [];
  const scannedByKey = new Map(scannedCalls.map((item) => [buildDirectSubmitCallSiteKey(item), item]));
  const declaredCallSiteRows = inventories.FRONTEND_COMMAND_PATHS
    .filter((item) => item.classification === 'command-submit' && item.callSiteKey);
  const declaredByKey = new Map(declaredCallSiteRows.map((item) => [item.callSiteKey, item]));
  const findings = [];
  if (scannedCalls.length > 0 && declaredCallSiteRows.length === 0) {
    findings.push(driftFinding(checkId, 'scanner:frontend-direct-submit:aggregate-declaration', {
      classification: 'inventory-drift-aggregate-direct-submit-declaration',
      contracts: ['COP-ENTRY-001', 'COP-CLIENT-002', 'COP-ALLOWLIST-001'],
      summary: 'frontend direct submits are scanned per call site, but FRONTEND_COMMAND_PATHS still uses aggregate command-submit rows',
    }));
  }
  scannedByKey.forEach((item, key) => {
    if (declaredByKey.has(key)) return;
    findings.push(driftFinding(checkId, `scanner:frontend-direct-submit:${key}`, {
      classification: 'inventory-drift-undeclared-frontend-direct-submit-call-site',
      contracts: ['COP-ENTRY-001', 'COP-CLIENT-002', 'COP-ALLOWLIST-001'],
      evidence: item.evidence,
      summary: `${key} calls GameAPI.${item.helper} directly and has no per-call-site FRONTEND_COMMAND_PATHS row`,
    }));
  });
  declaredByKey.forEach((item, key) => {
    if (scannedByKey.has(key)) return;
    findings.push(driftFinding(checkId, `scanner:frontend-direct-submit-missing:${key}`, {
      classification: 'inventory-drift-declared-frontend-direct-submit-call-site-missing',
      contracts: ['COP-ENTRY-001', 'COP-CLIENT-002', 'COP-ALLOWLIST-001'],
      evidence: item.evidence,
      summary: `${key} is declared in FRONTEND_COMMAND_PATHS but was not found by the direct-submit scanner`,
    }));
  });
  return findings;
}

function buildDisabledFlowFindings(checkId, scanResults = {}) {
  return (scanResults.disabledCommandFlows || [])
    .filter((flow) => flow.consumer)
    .map((flow, index) => driftFinding(checkId, `scanner:disabled-flow:${index + 1}`, {
      classification: flow.classification,
      contracts: ['COP-CLIENT-001', 'COP-CLIENT-002', 'COP-ALLOWLIST-001'],
      evidence: flow.evidence,
      summary: flow.summary,
    }));
}

function buildCheckFindings(checkId, scanResults = {}) {
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
      ...buildServerWriteReconciliationFindings(checkId, scanResults),
      ...buildGameActionReconciliationFindings(checkId, scanResults),
      ...buildGameApiReconciliationFindings(checkId, scanResults),
    ];
  }
  if (checkId === 'client-command-domain-blockers' || checkId === 'client-disabled-command-path') {
    const declared = inventories.CLIENT_LOCAL_BLOCKS
      .filter((item) => item.classification === 'domain-blocker')
      .map((item) => finding(checkId, item, { summary: `${item.producer} -> ${item.consumer}: ${item.reason}` }));
    return checkId === 'client-disabled-command-path'
      ? [...declared, ...buildDisabledFlowFindings(checkId, scanResults)]
      : declared;
  }
  if (checkId === 'frontend-write-submission-path') {
    return [
      ...inventories.FRONTEND_WRITE_HELPERS,
      ...inventories.FRONTEND_COMMAND_PATHS,
    ].map((item) => finding(checkId, item, {
      classification: item.submissionClassification,
      summary: item.helper ? `GameAPI.${item.helper}` : `${item.producer} -> ${item.consumer}`,
    })).concat(buildDirectSubmitReconciliationFindings(checkId, scanResults));
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
  const scanResults = options.scanResults || scanRepository(repoRoot, options.scannerOptions || {});
  const checks = STEP1_CHECKS.map((check) => ({
    ...check,
    mode: MODE,
    status: 'report-only',
    findings: buildCheckFindings(check.id, scanResults),
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
    scanResults,
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
      scannedServerWriteRoutes: scanResults.serverWriteRoutes.length,
      scannedGameActions: scanResults.gameActions.length,
      scannedGameApiWriteHelpers: scanResults.gameApiWriteHelpers.length,
      scannedFrontendDirectSubmits: scanResults.frontendDirectSubmits.length,
      scannedDisabledCommandFlows: scanResults.disabledCommandFlows.length,
      inventoryDriftFindings: checks.reduce((total, check) => (
        total + check.findings.filter((item) => item.classification.startsWith('inventory-drift-')).length
      ), 0),
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
    `scanned server write routes: ${report.summary.scannedServerWriteRoutes}`,
    `scanned GameAPI write helpers: ${report.summary.scannedGameApiWriteHelpers}`,
    `scanned frontend direct submits: ${report.summary.scannedFrontendDirectSubmits}`,
    `inventory drift findings: ${report.summary.inventoryDriftFindings}`,
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
