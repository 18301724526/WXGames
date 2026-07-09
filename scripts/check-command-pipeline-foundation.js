'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { OwnerLockRepository } = require('../backend/repositories/OwnerLockRepository');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_FILES = Object.freeze([
  'backend/repositories/OwnerLockRepository.js',
  'backend/repositories/GameStateRepository.js',
  'backend/application/commands/CommandIdempotencyStore.js',
  'backend/application/commands/CommandOwnerContext.js',
  'backend/application/commands/CommandCommitter.js',
  'backend/application/commands/CommandExecutionPipeline.js',
  'backend/application/commands/CommandTrace.js',
  'backend/server.js',
]);

function collectProductionJs(root, files = []) {
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'tests' || entry.name === 'node_modules') continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) collectProductionJs(fullPath, files);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
  }
  return files;
}

function readSources(overrides = {}) {
  return Object.fromEntries(CORE_FILES.map((file) => [
    file,
    overrides[file] ?? fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'),
  ]));
}

function inspectStageOrder(source, markers) {
  const violations = [];
  let previous = -1;
  for (const marker of markers) {
    const index = source.indexOf(marker);
    if (index < 0) violations.push(`pipeline stage marker is missing: ${marker}`);
    else if (index <= previous) violations.push(`pipeline stage is out of order: ${marker}`);
    previous = Math.max(previous, index);
  }
  return violations;
}

function inspectFoundation(options = {}) {
  const sources = readSources(options.sources || {});
  const violations = [];
  const ownerSource = sources['backend/repositories/OwnerLockRepository.js'];
  const repositorySource = sources['backend/repositories/GameStateRepository.js'];
  const storeSource = sources['backend/application/commands/CommandIdempotencyStore.js'];
  const contextSource = sources['backend/application/commands/CommandOwnerContext.js'];
  const committerSource = sources['backend/application/commands/CommandCommitter.js'];
  const pipelineSource = sources['backend/application/commands/CommandExecutionPipeline.js'];
  const traceSource = sources['backend/application/commands/CommandTrace.js'];
  const serverSource = sources['backend/server.js'];

  const legacyPath = path.join(REPO_ROOT, 'backend', 'repositories', 'PlayerStateLockRepository.js');
  const legacyExists = options.legacyExists ?? fs.existsSync(legacyPath);
  if (legacyExists) violations.push('retired PlayerStateLockRepository.js still exists');

  const publicMethods = Object.getOwnPropertyNames(OwnerLockRepository.prototype)
    .filter((name) => name !== 'constructor' && !name.startsWith('_'));
  if (JSON.stringify(publicMethods) !== JSON.stringify(['withOwnerLocks'])) {
    violations.push(`OwnerLockRepository public methods must be withOwnerLocks only: ${publicMethods.join(', ')}`);
  }
  if (!/Array\.from\(new Set\(normalized\)\)\.sort\(\)/.test(ownerSource)) {
    violations.push('owner keys are not deduplicated and sorted by one canonical order');
  }
  if (!/withOwnerLocks\(ownerKeys, scope, callback, options = \{\}\)/.test(ownerSource)) {
    violations.push('withOwnerLocks(ownerKeys, scope, callback, options) is missing');
  }
  if (!ownerSource.includes("error.code = 'OWNER_LOCK_TIMEOUT'")) {
    violations.push('owner lock timeout does not use OWNER_LOCK_TIMEOUT');
  }
  if (!ownerSource.includes('for (const ownerKey of normalizedOwnerKeys)')) {
    violations.push('owner locks are not acquired upfront in canonical order');
  }
  if (!ownerSource.includes('for (let index = acquired.length - 1; index >= 0; index -= 1)')) {
    violations.push('owner locks are not released in reverse order');
  }
  if (!ownerSource.includes('OWNER_LOCK_ASYNC_CALLBACK_UNSUPPORTED')) {
    violations.push('owner lock boundary does not reject unsafe async callbacks');
  }

  const requiredOwnerSchema = [
    'ownerKey TEXT PRIMARY KEY',
    'holderId TEXT NOT NULL',
    'scope TEXT',
    'lockedAt TEXT NOT NULL',
    'expiresAt TEXT NOT NULL',
    'idx_owner_locks_expires_at',
  ];
  requiredOwnerSchema.forEach((token) => {
    if (!repositorySource.includes(token)) violations.push(`owner_locks schema is missing ${token}`);
  });
  if (!repositorySource.includes("SELECT 'player:' || playerId, ownerId, scope, lockedAt, expiresAt")) {
    violations.push('legacy player lock rows are not migrated into owner_locks');
  }
  if (!repositorySource.includes('DROP TABLE player_state_locks')) {
    violations.push('legacy player_state_locks table is not retired');
  }
  if (!/withPlayerStateLock\([\s\S]*?return this\.withOwnerLocks\(/.test(repositorySource)) {
    violations.push('withPlayerStateLock is not a thin withOwnerLocks delegate');
  }
  if (repositorySource.includes('playerStateLocks')) {
    violations.push('GameStateRepository still owns the retired player lock system');
  }

  const productionSources = options.productionSources || Object.fromEntries(
    collectProductionJs(path.join(REPO_ROOT, 'backend')).map((file) => [
      path.relative(REPO_ROOT, file).replace(/\\/g, '/'),
      fs.readFileSync(file, 'utf8'),
    ]),
  );
  Object.entries(productionSources).forEach(([file, source]) => {
    if (file === 'backend/repositories/GameStateRepository.js') return;
    if (source.includes('player_state_locks') || source.includes('PlayerStateLockRepository')) {
      violations.push(`${file} references the retired player lock system`);
    }
  });

  [
    'IDEMPOTENCY_CLIENT_KEY_REQUIRED',
    'IDEMPOTENCY_KEY_CONFLICT',
    "status: 'replay'",
    "status: 'in-progress'",
    'recordResult(record = {}, response = {}, options = {})',
    'abandon(record = {})',
  ].forEach((token) => {
    if (!storeSource.includes(token)) violations.push(`idempotency store is missing ${token}`);
  });
  if (!repositorySource.includes('004-command-idempotency-store')
      || !repositorySource.includes('CREATE TABLE IF NOT EXISTS command_idempotency')) {
    violations.push('command idempotency table is not owned by schema migration');
  }

  if (!contextSource.includes('AsyncLocalStorage')
      || !contextSource.includes('OWNER_CONTEXT_REQUIRED')) {
    violations.push('pipeline owner context enforcement is missing');
  }
  if (!committerSource.includes('requireOwnerContext')
      || !committerSource.includes('this.repository.save(context.state)')
      || !committerSource.includes('this.idempotencyStore.recordResult')) {
    violations.push('CommandCommitter does not own persistence and idempotency recording');
  }
  if (pipelineSource.includes('repository.save(')) {
    violations.push('CommandExecutionPipeline persists state outside CommandCommitter');
  }

  violations.push(...inspectStageOrder(pipelineSource, [
    "trace.mark('idempotency_checking')",
    "trace.mark('owner_resolving')",
    "trace.mark('owner_lock_waiting')",
    "trace.mark('state_loading')",
    "trace.mark('validating')",
    "trace.mark('domain_executing')",
    "trace.mark('committing')",
    "trace.mark('projecting')",
    "trace.mark('response_building')",
  ]));
  if (!pipelineSource.includes("trace.mark('responding')")
      || !pipelineSource.includes('this.committer.recordResult')) {
    violations.push('pipeline response does not record a terminal idempotency result');
  }
  if (!pipelineSource.includes('this.repository.withOwnerLocks(')
      || !pipelineSource.includes('runWithOwnerContext({')) {
    violations.push('pipeline does not enter locks and owner context before domain execution');
  }
  [
    'ownerKey: this.ownerKey',
    'idempotencyStatus: this.idempotencyStatus',
    'ownerQueueWaitMs: this.ownerQueueWaitMs',
    'executionDurationMs: this.executionDurationMs',
    'validatorResult:',
    'commitResult:',
    'responseStatus: this.responseStatus',
  ].forEach((token) => {
    if (!traceSource.includes(token)) violations.push(`CommandTrace is missing ${token}`);
  });
  if (!serverSource.includes('new CommandIdempotencyStore(db)')
      || !serverSource.includes('new CommandExecutionPipeline({')) {
    violations.push('real server does not construct the Phase 4 pipeline foundation');
  }

  return { violations, publicMethods };
}

function runCheck(options = {}) {
  return inspectFoundation(options);
}

function main() {
  const result = runCheck();
  console.log('[command-pipeline-foundation] blocking gate');
  console.log(`OwnerLockRepository public methods: ${result.publicMethods.join(', ')}`);
  console.log(`violations: ${result.violations.length}`);
  result.violations.forEach((violation) => console.error(`- ${violation}`));
  if (result.violations.length > 0) process.exit(1);
  console.log('passed');
}

if (require.main === module) main();

module.exports = {
  CORE_FILES,
  inspectFoundation,
  inspectStageOrder,
  runCheck,
};
