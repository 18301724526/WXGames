#!/usr/bin/env node
'use strict';

const {
  buildImportClosure,
  collectEntryFiles,
  scanForbiddenPatterns,
} = require('./step4-debt-catalog/boundary-utils');

const HANDLER_ROOTS = Object.freeze([
  'backend/application/commands',
  'backend/actions',
]);

const COMMAND_INFRASTRUCTURE_FILES = new Set([
  'backend/application/commands/CommandCommitter.js',
  'backend/application/commands/CommandEntryContext.js',
  'backend/application/commands/CommandEnvelope.js',
  'backend/application/commands/CommandExecutionPipeline.js',
  'backend/application/commands/CommandIdempotencyStore.js',
  'backend/application/commands/CommandOwnerContext.js',
  'backend/application/commands/CommandOwnerResolver.js',
  'backend/application/commands/CommandTrace.js',
]);

const FORBIDDEN_HANDLER_PATTERNS = Object.freeze([
  {
    kind: 'repository-save',
    pattern: /\b(?:this\.)?repository\.(?:save|upsert|set|delete)\s*\(/,
    message: 'handler/import closure persists through repository outside CommandCommitter',
  },
  {
    kind: 'gamestate-repository-write',
    pattern: /\bGameStateRepository\.(?:save|upsert|set|delete|withOwnerLocks)\s*\(/,
    message: 'handler/import closure calls GameStateRepository write/lock API',
  },
  {
    kind: 'owner-lock-repository',
    pattern: /\bOwnerLockRepository\b|\bownerLockRepository\.(?:acquire|withOwnerLocks)\s*\(/,
    message: 'handler/import closure touches OwnerLockRepository',
  },
  {
    kind: 'owner-lock-api',
    pattern: /\b(?:this\.)?repository\.withOwnerLocks\s*\(|\bwithOwnerLocks\s*\(/,
    message: 'handler/import closure acquires owner locks directly',
  },
  {
    kind: 'player-state-lock',
    pattern: /\b(?:this\.)?repository\.withPlayerStateLock\s*\(|\bwithPlayerStateLock\s*\(/,
    message: 'handler/import closure acquires player state lock directly',
  },
]);

function parseArgs(argv) {
  const options = { json: false };
  for (const arg of argv) {
    if (arg === '--json') options.json = true;
    else if (arg === '--blocking') options.blocking = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function isHandlerEntry(file) {
  if (COMMAND_INFRASTRUCTURE_FILES.has(file)) return false;
  return file.startsWith('backend/actions/')
    || /Handler\.js$/.test(file)
    || file === 'backend/application/commands/GameCommandDefinitionFactory.js';
}

function shouldTraverse(file) {
  if (COMMAND_INFRASTRUCTURE_FILES.has(file)) return false;
  if (file.startsWith('backend/repositories/')) return false;
  if (file.startsWith('backend/tests/')) return false;
  return true;
}

function inspectHandlerBoundary({
  repoRoot = process.cwd(),
  files = collectEntryFiles(HANDLER_ROOTS, repoRoot),
  sources = {},
} = {}) {
  const entryFiles = files.filter(isHandlerEntry);
  const closureFiles = buildImportClosure(entryFiles, {
    repoRoot,
    sources,
    shouldTraverse,
  });
  const findings = scanForbiddenPatterns(closureFiles, FORBIDDEN_HANDLER_PATTERNS, {
    repoRoot,
    sources,
    allowFile: (file) => COMMAND_INFRASTRUCTURE_FILES.has(file) || file.startsWith('backend/repositories/'),
  });
  return {
    summary: {
      entryFiles: entryFiles.length,
      filesScanned: closureFiles.length,
      totalViolations: findings.length,
    },
    entryFiles,
    filesScanned: closureFiles,
    violations: findings,
  };
}

function renderText(report) {
  const lines = [
    '[handler-boundary] handler lock/persistence ownership gate',
    `entry files: ${report.summary.entryFiles}`,
    `files scanned: ${report.summary.filesScanned}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  report.violations.forEach((finding) => {
    lines.push(`  ${finding.file}:${finding.line} ${finding.kind} ${finding.message}: ${finding.evidence}`);
  });
  lines.push(report.summary.totalViolations === 0 ? 'passed' : 'FAILED');
  return lines.join('\n');
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = inspectHandlerBoundary();
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(`${renderText(report)}\n`);
    process.exit(report.summary.totalViolations === 0 ? 0 : 1);
  } catch (error) {
    process.stderr.write(`[handler-boundary] failed: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  COMMAND_INFRASTRUCTURE_FILES,
  FORBIDDEN_HANDLER_PATTERNS,
  HANDLER_ROOTS,
  inspectHandlerBoundary,
  isHandlerEntry,
  parseArgs,
  renderText,
};
