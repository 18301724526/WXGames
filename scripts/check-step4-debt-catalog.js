#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const { getDebtItems, summarizeDebtItems } = require('./step4-debt-catalog');
const { PERMANENT_EXCEPTIONS } = require('./step4-debt-catalog/permanent-exceptions');
const {
  lineRangeText,
  lineRangeValid,
  readText,
  resolveRepoPath,
} = require('./step4-debt-catalog/source-utils');

const REQUIRED_DOMAIN_BLOCKER_IDS = Object.freeze([
  'frontend:canvas-action-dispatcher-disabled-drop',
  'frontend:canvas-panel-action-runner-disabled-drop',
  'frontend:canvas-game-app-advance-era-local-block',
  'frontend:tech-research-local-canresearch',
  'frontend:building-local-cost-disabled',
  'frontend:famous-candidate-availability',
  'frontend:territory-mission-ready',
  'frontend:world-march-passability',
]);

const REQUIRED_ROUTE_IDS = Object.freeze([
  'server:player-login',
  'admin:config-release-publish',
  'admin:config-release-rollback',
]);

const REQUIRED_PHASE7_IDS = Object.freeze([
  'admin:ops-login-audit',
  'admin:ops-maintenance-state',
  'admin:ops-restart-audit',
  'diagnostic:client-events-ingest',
  'diagnostic:client-operation-log-ingest',
  'COP-OWNER-002: resolveCapture',
  'COP-SHARED-001: loot/boss',
  'COP-CLIENT-001/002: report-only findings',
  'COP-PROJECTION-001: domain business candidates',
]);

function parseArgs(argv) {
  const options = { reportOnly: false, json: false };
  for (const arg of argv) {
    if (arg === '--report-only') options.reportOnly = true;
    else if (arg === '--blocking') options.reportOnly = false;
    else if (arg === '--json') options.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function symbolTokens(pattern = '') {
  return String(pattern)
    .split(/[^A-Za-z0-9_.-]+/)
    .filter((token) => token.length >= 4 && !['with', 'from', 'only', 'path', 'line'].includes(token));
}

function sourcePatternMatches(range, _fullText, pattern = '', inventoryId = '') {
  const candidates = [inventoryId, ...symbolTokens(pattern)];
  return candidates.some((token) => token && range.includes(token));
}

function collectExpectedInventoryIds(inventories) {
  const ids = new Set();
  (inventories.CLIENT_LOCAL_BLOCKS || [])
    .filter((item) => item.classification === 'domain-blocker' || item.classification === 'retired-step4' || item.classification === 'classified-ui-local')
    .forEach((item) => ids.add(item.inventoryId));
  (inventories.FRONTEND_COMMAND_PATHS || [])
    .filter((item) => REQUIRED_DOMAIN_BLOCKER_IDS.includes(item.inventoryId))
    .forEach((item) => ids.add(item.inventoryId));
  (inventories.ROUTE_ORCHESTRATION_DEBT || [])
    .forEach((item) => ids.add(item.inventoryId));
  [...REQUIRED_PHASE7_IDS].forEach((id) => ids.add(id));
  return ids;
}

function inspectCatalog({ repoRoot = process.cwd(), items = getDebtItems(), inventories = require('./command-owner-step1/inventories') } = {}) {
  const violations = [];
  const warnings = [];
  const seen = new Map();
  const expectedIds = collectExpectedInventoryIds(inventories);
  const exceptionDebtIds = new Set(PERMANENT_EXCEPTIONS.map((item) => item.debtId));

  for (const item of items) {
    if (!item.debtId || !/^STEP4-DEBT-\d{3}$/.test(item.debtId)) {
      violations.push(`${item.debtId || '(missing debtId)'} has invalid debtId`);
    }
    if (!item.inventoryId) violations.push(`${item.debtId} has no inventoryId`);
    if (seen.has(item.inventoryId)) {
      violations.push(`${item.inventoryId} appears in both ${seen.get(item.inventoryId)} and ${item.debtId}`);
    } else {
      seen.set(item.inventoryId, item.debtId);
    }
    if (!Array.isArray(item.contracts) || item.contracts.length === 0) {
      violations.push(`${item.debtId} has no COP contracts`);
    }
    if (!Array.isArray(item.sourceRefs) || item.sourceRefs.length === 0) {
      violations.push(`${item.debtId} has no sourceRefs`);
      continue;
    }
    for (const [index, ref] of item.sourceRefs.entries()) {
      const label = `${item.debtId}.sourceRefs[${index}]`;
      if (ref.inventoryId !== item.inventoryId) {
        violations.push(`${label} inventoryId ${ref.inventoryId} does not match item ${item.inventoryId}`);
      }
      if (!ref.file || !fs.existsSync(resolveRepoPath(repoRoot, ref.file))) {
        violations.push(`${label} file missing: ${ref.file}`);
        continue;
      }
      const text = readText(repoRoot, ref.file);
      if (!lineRangeValid(text, ref.startLine, ref.endLine)) {
        violations.push(`${label} invalid line range ${ref.startLine}-${ref.endLine}`);
        continue;
      }
      const range = lineRangeText(text, ref.startLine, ref.endLine);
      if (!sourcePatternMatches(range, text, ref.symbolOrPattern, ref.inventoryId)) {
        violations.push(`${label} pattern/inventoryId cannot be relocated in source`);
      }
    }
    if (item.currentStatus === 'permanent-exception' && !exceptionDebtIds.has(item.debtId)) {
      violations.push(`${item.debtId} is permanent-exception without permanent exception record`);
    }
    if (item.currentStatus === 'retired' && !item.retiredStep4) {
      violations.push(`${item.debtId} is retired without retired-step4 metadata`);
    }
    if (item.currentStatus === 'classified-ui-local' && !item.classifiedUiLocal) {
      violations.push(`${item.debtId} is classified-ui-local without metadata`);
    }
  }

  for (const id of expectedIds) {
    if (!seen.has(id)) violations.push(`expected Step4 debt inventoryId missing from catalog: ${id}`);
  }
  for (const id of REQUIRED_DOMAIN_BLOCKER_IDS) {
    const client = (inventories.CLIENT_LOCAL_BLOCKS || []).find((item) => item.inventoryId === id);
    if (!client) violations.push(`CLIENT_LOCAL_BLOCKS missing expected id ${id}`);
  }
  for (const id of REQUIRED_ROUTE_IDS) {
    const routeDebt = (inventories.ROUTE_ORCHESTRATION_DEBT || []).find((item) => item.inventoryId === id);
    if (!routeDebt && !seen.has(id)) violations.push(`ROUTE_ORCHESTRATION_DEBT missing expected id ${id}`);
  }

  const dispatcher = (inventories.FRONTEND_COMMAND_PATHS || []).find((item) => item.inventoryId === 'frontend:canvas-action-dispatcher-disabled-drop');
  if (dispatcher?.classification === 'domain-blocker' && dispatcher?.domainDisplayCanSuppressCall !== false) {
    warnings.push('inventory stale: frontend:canvas-action-dispatcher-disabled-drop still says domainDisplayCanSuppressCall=true');
  }
  const advanceEra = (inventories.FRONTEND_COMMAND_PATHS || []).find((item) => item.inventoryId === 'frontend:canvas-game-app-advance-era-local-block');
  if (advanceEra?.classification === 'domain-blocker' && advanceEra?.domainDisplayCanSuppressCall !== false) {
    warnings.push('inventory stale: frontend:canvas-game-app-advance-era-local-block still says local advanceEra guard suppresses submit');
  }

  return {
    summary: {
      ...summarizeDebtItems(items),
      totalViolations: violations.length,
      totalWarnings: warnings.length,
    },
    violations,
    warnings,
  };
}

function renderText(report, mode) {
  const lines = [
    '[step4-debt-catalog] debt catalog gate',
    `mode: ${mode}`,
    `items: ${report.summary.total}`,
    `retired: ${report.summary.retiredCount}`,
    `classified-ui-local: ${report.summary.classifiedUiLocalCount}`,
    `remaining: ${report.summary.remainingCount}`,
    `violations: ${report.summary.totalViolations}`,
    `warnings: ${report.summary.totalWarnings}`,
  ];
  report.violations.forEach((violation) => lines.push(`  violation: ${violation}`));
  report.warnings.forEach((warning) => lines.push(`  warning: ${warning}`));
  lines.push(report.summary.totalViolations === 0 ? 'passed' : 'FAILED');
  return lines.join('\n');
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = inspectCatalog();
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(`${renderText(report, options.reportOnly ? 'report-only' : 'blocking')}\n`);
    process.exit(report.summary.totalViolations === 0 || options.reportOnly ? 0 : 1);
  } catch (error) {
    process.stderr.write(`[step4-debt-catalog] failed: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  REQUIRED_DOMAIN_BLOCKER_IDS,
  REQUIRED_PHASE7_IDS,
  REQUIRED_ROUTE_IDS,
  inspectCatalog,
  parseArgs,
  renderText,
};
