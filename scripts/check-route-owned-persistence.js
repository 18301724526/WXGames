#!/usr/bin/env node
'use strict';

const { PERMANENT_EXCEPTIONS } = require('./step4-debt-catalog/permanent-exceptions');
const {
  collectJsFiles,
  readText,
  splitLines,
} = require('./step4-debt-catalog/source-utils');

const ROUTE_ROOTS = Object.freeze(['backend/routes']);
const FORBIDDEN_PATTERNS = Object.freeze([
  { kind: 'repository-save', pattern: /\brepository\.(?:save|upsert|set|delete)\s*\(/ },
  { kind: 'gamestate-repository-write', pattern: /\bGameStateRepository\.(?:save|upsert|set|delete|withOwnerLocks)\s*\(/ },
  { kind: 'owner-lock-repository', pattern: /\bOwnerLockRepository\b|\bownerLockRepository\.(?:acquire|withOwnerLocks)\s*\(/ },
  { kind: 'player-state-lock', pattern: /\bwithPlayerStateLock\s*\(/ },
]);

const CLASSIFIED_EXCEPTION_RANGES = Object.freeze([
  {
    inventoryId: 'server:player-login',
    file: 'backend/routes/playerRoutes.js',
    startLine: 61,
    endLine: 99,
    allowedKinds: new Set(['repository-save', 'player-state-lock']),
  },
]);

function parseArgs(argv) {
  const options = { json: false, reportOnly: false };
  for (const arg of argv) {
    if (arg === '--json') options.json = true;
    else if (arg === '--report-only') options.reportOnly = true;
    else if (arg === '--blocking') options.reportOnly = false;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function isInsideRange(finding, range) {
  return finding.file === range.file
    && finding.line >= range.startLine
    && finding.line <= range.endLine
    && range.allowedKinds.has(finding.kind);
}

function classifyFinding(finding, exceptions = PERMANENT_EXCEPTIONS) {
  const matched = CLASSIFIED_EXCEPTION_RANGES.find((range) => isInsideRange(finding, range));
  if (!matched) return { ...finding, classification: 'violation', inventoryId: '' };
  const exception = exceptions.find((item) => item.inventoryId === matched.inventoryId);
  if (!exception) return { ...finding, classification: 'violation', inventoryId: matched.inventoryId, reason: 'missing permanent exception' };
  return { ...finding, classification: 'classified-permanent-exception', inventoryId: matched.inventoryId };
}

function scanRouteOwnedPersistence({
  repoRoot = process.cwd(),
  files = collectJsFiles(ROUTE_ROOTS, repoRoot),
  readFile = (file) => readText(repoRoot, file),
  exceptions = PERMANENT_EXCEPTIONS,
} = {}) {
  const findings = [];
  for (const file of files) {
    const lines = splitLines(readFile(file));
    lines.forEach((line, index) => {
      if (/^\s*(?:\/\/|\*)/.test(line)) return;
      for (const rule of FORBIDDEN_PATTERNS) {
        if (rule.pattern.test(line)) {
          findings.push(classifyFinding({
            file,
            line: index + 1,
            kind: rule.kind,
            evidence: line.trim(),
          }, exceptions));
        }
      }
    });
  }
  const violations = findings.filter((finding) => finding.classification === 'violation');
  const classified = findings.filter((finding) => finding.classification === 'classified-permanent-exception');
  return {
    summary: {
      filesScanned: files.length,
      totalFindings: findings.length,
      classifiedPermanentExceptions: classified.length,
      totalViolations: violations.length,
    },
    findings,
    violations,
  };
}

function renderText(report, mode) {
  const lines = [
    '[route-owned-persistence] route persistence ownership gate',
    `mode: ${mode}`,
    `files scanned: ${report.summary.filesScanned}`,
    `classified permanent exception findings: ${report.summary.classifiedPermanentExceptions}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  report.findings.forEach((finding) => {
    lines.push(`  ${finding.file}:${finding.line} ${finding.kind} ${finding.classification}${finding.inventoryId ? ` ${finding.inventoryId}` : ''}`);
  });
  lines.push(report.summary.totalViolations === 0 ? 'passed' : 'FAILED');
  return lines.join('\n');
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = scanRouteOwnedPersistence();
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(`${renderText(report, options.reportOnly ? 'report-only' : 'blocking')}\n`);
    process.exit(report.summary.totalViolations === 0 || options.reportOnly ? 0 : 1);
  } catch (error) {
    process.stderr.write(`[route-owned-persistence] failed: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  CLASSIFIED_EXCEPTION_RANGES,
  FORBIDDEN_PATTERNS,
  scanRouteOwnedPersistence,
  parseArgs,
  renderText,
};
