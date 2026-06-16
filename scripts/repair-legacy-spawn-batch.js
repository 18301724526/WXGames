#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const {
  buildPlanFromDatabase,
} = require('./plan-legacy-spawn-repair');
const {
  expectedConfirmation,
  repairLegacySpawnAccount,
} = require('./repair-legacy-spawn-account');

function loadBetterSqlite3() {
  try {
    return require('better-sqlite3');
  } catch (_) {
    const candidates = [
      path.join(__dirname, '..', 'backend', 'node_modules', 'better-sqlite3'),
      '/opt/wxgame-workspace/backend/node_modules/better-sqlite3',
    ];
    for (const candidate of candidates) {
      try {
        return require(candidate);
      } catch (error) {
        if (error?.code !== 'MODULE_NOT_FOUND') throw error;
      }
    }
    throw _;
  }
}

function parsePositiveInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizePlayerId(value) {
  return String(value || '').trim();
}

function expectedBatchConfirmation(limit) {
  return `repair-legacy-spawn-batch:${limit}`;
}

function parseArgs(argv = []) {
  const result = {
    dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'backend', 'civilization.db'),
    limit: parsePositiveInteger(process.env.WXGAME_LEGACY_SPAWN_BATCH_LIMIT, 1),
    write: false,
    json: false,
    confirm: process.env.WXGAME_CONFIRM_LEGACY_SPAWN_BATCH || '',
    includePlayers: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--db') {
      result.dbPath = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--db=')) {
      result.dbPath = arg.slice('--db='.length);
    } else if (arg === '--limit') {
      result.limit = parsePositiveInteger(argv[index + 1], result.limit);
      index += 1;
    } else if (arg.startsWith('--limit=')) {
      result.limit = parsePositiveInteger(arg.slice('--limit='.length), result.limit);
    } else if (arg === '--player') {
      result.includePlayers.push(normalizePlayerId(argv[index + 1]));
      index += 1;
    } else if (arg.startsWith('--player=')) {
      result.includePlayers.push(normalizePlayerId(arg.slice('--player='.length)));
    } else if (arg === '--write') {
      result.write = true;
    } else if (arg === '--json') {
      result.json = true;
    } else if (arg === '--confirm') {
      result.confirm = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--confirm=')) {
      result.confirm = arg.slice('--confirm='.length);
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  result.includePlayers = [...new Set(result.includePlayers.filter(Boolean))];
  return result;
}

function chooseCandidates(plan, options = {}) {
  const includeSet = new Set((options.includePlayers || []).map(normalizePlayerId).filter(Boolean));
  const allCandidates = plan?.samples?.legacyCandidates || [];
  const filtered = includeSet.size
    ? allCandidates.filter((candidate) => includeSet.has(candidate.playerId))
    : allCandidates;
  return filtered.slice(0, options.limit);
}

function repairLegacySpawnBatch(db, options = {}) {
  const limit = parsePositiveInteger(options.limit, 1);
  const plan = buildPlanFromDatabase(db, { sampleLimit: Math.max(limit, 20) });
  const candidates = chooseCandidates(plan, { ...options, limit });
  const write = Boolean(options.write);
  const requiredConfirm = expectedBatchConfirmation(limit);
  const confirmationAccepted = options.confirm === requiredConfirm;
  const base = {
    schema: 'legacy-spawn-batch-repair-v1',
    generatedAt: new Date().toISOString(),
    writeRequested: write,
    writesPerformed: false,
    limit,
    requiredConfirm,
    confirmationAccepted,
    requestedPlayers: options.includePlayers || [],
    planCounts: plan.counts,
    selectedPlayers: candidates.map((candidate) => candidate.playerId),
    reports: [],
  };

  if (write && !confirmationAccepted) {
    const error = new Error(`Write requires --confirm ${requiredConfirm}`);
    error.code = 'CONFIRMATION_REQUIRED';
    error.plan = base;
    throw error;
  }

  const reports = candidates.map((candidate) => repairLegacySpawnAccount(db, {
    playerId: candidate.playerId,
    write,
    confirm: write ? expectedConfirmation(candidate.playerId) : '',
  }));
  const writesPerformed = reports.some((report) => report.writesPerformed);

  return {
    ...base,
    reports,
    writesPerformed,
    dryRun: !write,
    totals: {
      selected: candidates.length,
      repaired: reports.filter((report) => report.writesPerformed).length,
      skipped: reports.filter((report) => report.skipped).length,
      releasedSharedOwnedCount: reports.reduce((sum, report) => sum + Number(report.releasedSharedOwnedCount || 0), 0),
    },
    nextAction: write
      ? null
      : `rerun with --write --confirm ${requiredConfirm}`,
  };
}

function formatTextReport(report) {
  const lines = [
    'Legacy spawn batch repair',
    `Limit: ${report.limit}`,
    `Write requested: ${report.writeRequested}`,
    `Writes performed: ${report.writesPerformed}`,
    `Required confirm: ${report.requiredConfirm}`,
    `Selected players: ${report.selectedPlayers.join(', ') || 'none'}`,
    '',
    `Eligible remaining in plan: ${report.planCounts?.['eligible-reset-style-repair'] || 0}`,
    `Selected: ${report.totals.selected}`,
    `Repaired: ${report.totals.repaired}`,
    `Skipped: ${report.totals.skipped}`,
    `Released shared owned count: ${report.totals.releasedSharedOwnedCount}`,
  ];
  if (report.dryRun) lines.push('', `Dry run only. ${report.nextAction}`);
  return lines.join('\n');
}

function printHelp() {
  console.log([
    'Usage: node scripts/repair-legacy-spawn-batch.js [--db path] [--limit n] [--player id ...] [--write --confirm repair-legacy-spawn-batch:<limit>] [--json]',
    '',
    'Default mode is dry-run. Write mode repairs at most --limit eligible legacy accounts through the single-account reset-style repair path.',
  ].join('\n'));
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return 0;
  }
  if (!options.dbPath || !fs.existsSync(options.dbPath)) {
    throw new Error(`Database not found: ${options.dbPath}`);
  }
  const Database = loadBetterSqlite3();
  const db = new Database(options.dbPath, { timeout: 10000 });
  try {
    const report = repairLegacySpawnBatch(db, options);
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else console.log(formatTextReport(report));
  } finally {
    db.close();
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    if (error?.plan) console.error(JSON.stringify(error.plan, null, 2));
    console.error(`[legacy-spawn-batch-repair] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  chooseCandidates,
  expectedBatchConfirmation,
  formatTextReport,
  parseArgs,
  repairLegacySpawnBatch,
};
