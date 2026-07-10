#!/usr/bin/env node
'use strict';

const {
  buildImportClosure,
  scanForbiddenPatterns,
} = require('./step4-debt-catalog/boundary-utils');
const { readText } = require('./step4-debt-catalog/source-utils');

const WORKER_ENTRY_FILES = Object.freeze([
  'backend/world-worker.js',
  'backend/services/realtime/WorldWorkerService.js',
]);

const REQUIRED_WORKER_COMMAND_TYPES = Object.freeze([
  'worldWorkerPlayerTick',
  'worldWorkerPersonUpdate',
  'worldWorkerDiplomacyTick',
]);

const WORKER_INFRASTRUCTURE_SKIP_PREFIXES = Object.freeze([
  'backend/repositories/',
  'backend/application/commands/',
  'backend/config/',
  'shared/',
]);

const FORBIDDEN_WORKER_PATTERNS = Object.freeze([
  {
    kind: 'repository-save',
    pattern: /\b(?:this\.)?repository\.(?:save|upsert|set|delete)\s*\(/,
    message: 'worker/import closure persists through repository outside CommandExecutionPipeline',
  },
  {
    kind: 'gamestate-repository-write',
    pattern: /\bGameStateRepository\.(?:save|upsert|set|delete|withOwnerLocks)\s*\(/,
    message: 'worker/import closure calls GameStateRepository write/lock API',
  },
  {
    kind: 'owner-lock-repository',
    pattern: /\bOwnerLockRepository\b|\bownerLockRepository\.(?:acquire|withOwnerLocks)\s*\(/,
    message: 'worker/import closure touches OwnerLockRepository',
  },
  {
    kind: 'owner-lock-api',
    pattern: /\b(?:this\.)?repository\.withOwnerLocks\s*\(|\bwithOwnerLocks\s*\(/,
    message: 'worker/import closure acquires owner locks directly',
  },
  {
    kind: 'player-state-lock',
    pattern: /\b(?:this\.)?repository\.withPlayerStateLock\s*\(|\bwithPlayerStateLock\s*\(/,
    message: 'worker/import closure acquires player state lock directly',
  },
  {
    kind: 'direct-definition-execute',
    pattern: /\bdefinition\.execute\s*\(/,
    message: 'worker bypasses CommandExecutionPipeline and executes a definition directly',
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

function shouldSkipInfrastructure(file) {
  return WORKER_INFRASTRUCTURE_SKIP_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function shouldTraverse(file) {
  if (shouldSkipInfrastructure(file)) return false;
  if (file.startsWith('backend/tests/')) return false;
  return true;
}

function readSource(repoRoot, sources, file) {
  return Object.prototype.hasOwnProperty.call(sources, file)
    ? sources[file]
    : readText(repoRoot, file);
}

function inspectWorkerPipelineShape(repoRoot, sources = {}) {
  const violations = [];
  const source = readSource(repoRoot, sources, 'backend/services/realtime/WorldWorkerService.js');
  REQUIRED_WORKER_COMMAND_TYPES.forEach((commandType) => {
    if (!source.includes(`'${commandType}'`) && !source.includes(`"${commandType}"`)) {
      violations.push({
        file: 'backend/services/realtime/WorldWorkerService.js',
        line: 1,
        kind: 'missing-worker-command',
        evidence: commandType,
        message: `${commandType} is missing from WorldWorkerService`,
      });
    }
  });
  if (!/this\.commandExecutionPipeline\.execute\s*\(/.test(source)) {
    violations.push({
      file: 'backend/services/realtime/WorldWorkerService.js',
      line: 1,
      kind: 'missing-pipeline-execute',
      evidence: 'this.commandExecutionPipeline.execute',
      message: 'WorldWorkerService does not execute internal commands through CommandExecutionPipeline',
    });
  }
  if (!/WORLD_WORKER_COMMAND_PIPELINE_REQUIRED/.test(source)) {
    violations.push({
      file: 'backend/services/realtime/WorldWorkerService.js',
      line: 1,
      kind: 'missing-pipeline-required-guard',
      evidence: 'WORLD_WORKER_COMMAND_PIPELINE_REQUIRED',
      message: 'WorldWorkerService no longer requires CommandExecutionPipeline',
    });
  }
  return violations;
}

function inspectWorkerWriteOwnership({
  repoRoot = process.cwd(),
  sources = {},
  entryFiles = WORKER_ENTRY_FILES,
} = {}) {
  const closureFiles = buildImportClosure(entryFiles, {
    repoRoot,
    sources,
    shouldTraverse,
  });
  const ownershipViolations = scanForbiddenPatterns(closureFiles, FORBIDDEN_WORKER_PATTERNS, {
    repoRoot,
    sources,
    allowFile: shouldSkipInfrastructure,
  });
  const pipelineViolations = inspectWorkerPipelineShape(repoRoot, sources);
  const violations = [...ownershipViolations, ...pipelineViolations];
  return {
    summary: {
      entryFiles: entryFiles.length,
      filesScanned: closureFiles.length,
      totalViolations: violations.length,
    },
    entryFiles,
    filesScanned: closureFiles,
    violations,
  };
}

function renderText(report) {
  const lines = [
    '[worker-write-ownership] worker write ownership gate',
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
    const report = inspectWorkerWriteOwnership();
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(`${renderText(report)}\n`);
    process.exit(report.summary.totalViolations === 0 ? 0 : 1);
  } catch (error) {
    process.stderr.write(`[worker-write-ownership] failed: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  FORBIDDEN_WORKER_PATTERNS,
  REQUIRED_WORKER_COMMAND_TYPES,
  WORKER_ENTRY_FILES,
  inspectWorkerPipelineShape,
  inspectWorkerWriteOwnership,
  parseArgs,
  renderText,
};
