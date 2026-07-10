#!/usr/bin/env node
'use strict';

const {
  collectJsFiles,
  readText,
  splitLines,
} = require('./step4-debt-catalog/source-utils');

const TRACE_FILE = 'backend/application/commands/CommandTrace.js';
const PIPELINE_FILE = 'backend/application/commands/CommandExecutionPipeline.js';
const COMMITTER_FILE = 'backend/application/commands/CommandCommitter.js';
const REPOSITORY_FILE = 'backend/repositories/GameStateRepository.js';

const PROJECTION_FILES = Object.freeze([
  'backend/application/projections/GameActionProjection.js',
  'backend/services/GameStateService.js',
  'backend/services/ClientGameStateAssembler.js',
]);

const REQUIRED_TRACE_FIELDS = Object.freeze([
  'schema',
  'retryAttempt',
  'phase',
  'committed',
  'revisionBefore',
  'revisionAfter',
  'ownerKey',
  'ownerKeys',
  'idempotencyStatus',
  'ownerQueueWaitMs',
  'executionDurationMs',
  'validatorResult',
  'commitResult',
  'responseStatus',
  'phases',
]);

const REQUIRED_TRACE_PHASES = Object.freeze([
  'received',
  'idempotency_checking',
  'owner_resolving',
  'owner_lock_waiting',
  'owner_locked',
  'state_loading',
  'validating',
  'domain_executing',
  'committing',
  'projecting',
  'response_building',
  'responding',
]);

const PROJECTION_WRITE_PATTERN = /\b(?:repository|this\.repository)\.(?:save|upsert|set|delete|commitCommandState|resetPlayerState)\s*\(|\bGameStateRepository\.(?:save|upsert|set|delete)\s*\(/;

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

function readSource(repoRoot, sources, file) {
  if (Object.prototype.hasOwnProperty.call(sources, file)) return sources[file];
  return readText(repoRoot, file);
}

function pushViolation(violations, file, line, kind, message, evidence = '') {
  violations.push({ file, line, kind, message, evidence });
}

function inspectTrace(violations, repoRoot, sources) {
  const trace = readSource(repoRoot, sources, TRACE_FILE);
  REQUIRED_TRACE_FIELDS.forEach((field) => {
    const fieldPattern = new RegExp(`\\b${field}\\s*:`);
    if (!fieldPattern.test(trace)) {
      pushViolation(violations, TRACE_FILE, 1, 'missing-trace-field', `CommandTrace is missing ${field}`, field);
    }
  });
  ['durationMs', 'status'].forEach((field) => {
    if (!new RegExp(`\\b${field}\\b`).test(trace)) {
      pushViolation(violations, TRACE_FILE, 1, 'missing-trace-phase-field', `CommandTrace phases are missing ${field}`, field);
    }
  });

  const pipeline = readSource(repoRoot, sources, PIPELINE_FILE);
  REQUIRED_TRACE_PHASES.forEach((phase) => {
    if (!pipeline.includes(`'${phase}'`) && !trace.includes(`'${phase}'`)) {
      pushViolation(violations, PIPELINE_FILE, 1, 'missing-trace-phase', `pipeline trace is missing phase ${phase}`, phase);
    }
  });
  [
    'trace.setOwner(',
    'trace.setIdempotencyStatus(',
    'trace.setOwnerQueueWaitMs(',
    'trace.setRevisionBefore(',
    'trace.setValidatorResult(',
    'trace.setCommitted(',
    'trace.setCommitResult(',
    'trace.setResponseStatus(',
    'trace.setExecutionDurationMs(',
  ].forEach((call) => {
    if (!pipeline.includes(call)) {
      pushViolation(violations, PIPELINE_FILE, 1, 'missing-trace-call', `CommandExecutionPipeline is missing ${call}`, call);
    }
  });
}

function inspectProjectionWrites(violations, repoRoot, sources, files = PROJECTION_FILES) {
  files.forEach((file) => {
    const source = readSource(repoRoot, sources, file);
    splitLines(source).forEach((line, index) => {
      if (/^\s*(?:\/\/|\*)/.test(line)) return;
      PROJECTION_WRITE_PATTERN.lastIndex = 0;
      if (!PROJECTION_WRITE_PATTERN.test(line)) return;
      pushViolation(
        violations,
        file,
        index + 1,
        'projection-write',
        'projection/read boundary calls write persistence API',
        line.trim(),
      );
    });
  });
}

function inspectCommitterSolePersistence(violations, repoRoot, sources) {
  const committer = readSource(repoRoot, sources, COMMITTER_FILE);
  if (!/commitCommandState\s*\(/.test(committer)) {
    pushViolation(violations, COMMITTER_FILE, 1, 'committer-missing-commit-command-state', 'CommandCommitter no longer calls commitCommandState');
  }
  const allCommandFiles = collectJsFiles(['backend/application/commands'], repoRoot)
    .filter((file) => file !== COMMITTER_FILE);
  allCommandFiles.forEach((file) => {
    const source = readSource(repoRoot, sources, file);
    splitLines(source).forEach((line, index) => {
      if (/^\s*(?:\/\/|\*)/.test(line)) return;
      if (/\b(?:repository|this\.repository)\.(?:save|commitCommandState|resetPlayerState)\s*\(/.test(line)) {
        pushViolation(
          violations,
          file,
          index + 1,
          'non-committer-command-persistence',
          'command file outside CommandCommitter owns persistence',
          line.trim(),
        );
      }
    });
  });
  const repository = readSource(repoRoot, sources, REPOSITORY_FILE);
  if (!/commitCommandState\s*\(gameState, mutations/.test(repository)) {
    pushViolation(violations, REPOSITORY_FILE, 1, 'repository-missing-atomic-commit', 'GameStateRepository lacks commitCommandState atomic entry');
  }
}

function inspectProjectionWriteBoundary({
  repoRoot = process.cwd(),
  sources = {},
  projectionFiles = PROJECTION_FILES,
} = {}) {
  const violations = [];
  inspectTrace(violations, repoRoot, sources);
  inspectProjectionWrites(violations, repoRoot, sources, projectionFiles);
  inspectCommitterSolePersistence(violations, repoRoot, sources);
  return {
    summary: {
      projectionFiles: projectionFiles.length,
      requiredTraceFields: REQUIRED_TRACE_FIELDS.length,
      requiredTracePhases: REQUIRED_TRACE_PHASES.length,
      totalViolations: violations.length,
    },
    violations,
  };
}

function renderText(report, mode) {
  const lines = [
    '[projection-write-boundary] projection/write/trace boundary gate',
    `mode: ${mode}`,
    `projection files: ${report.summary.projectionFiles}`,
    `required trace fields: ${report.summary.requiredTraceFields}`,
    `required trace phases: ${report.summary.requiredTracePhases}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  report.violations.forEach((finding) => {
    lines.push(`  ${finding.file}:${finding.line} ${finding.kind} ${finding.message}${finding.evidence ? `: ${finding.evidence}` : ''}`);
  });
  lines.push(report.summary.totalViolations === 0 ? 'passed' : 'FAILED');
  return lines.join('\n');
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = inspectProjectionWriteBoundary();
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(`${renderText(report, options.reportOnly ? 'report-only' : 'blocking')}\n`);
    process.exit(report.summary.totalViolations === 0 || options.reportOnly ? 0 : 1);
  } catch (error) {
    process.stderr.write(`[projection-write-boundary] failed: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  PROJECTION_FILES,
  REQUIRED_TRACE_FIELDS,
  REQUIRED_TRACE_PHASES,
  inspectProjectionWriteBoundary,
  parseArgs,
  renderText,
};
