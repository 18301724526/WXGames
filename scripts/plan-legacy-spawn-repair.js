#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

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

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function toIntegerOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function normalizeCoord(q, r) {
  const normalizedQ = toIntegerOrNull(q);
  const normalizedR = toIntegerOrNull(r);
  if (normalizedQ === null || normalizedR === null) return null;
  return { q: normalizedQ, r: normalizedR };
}

function readWorldOrigin(worldMapValue) {
  const worldMap = parseJson(worldMapValue, null);
  if (!worldMap || typeof worldMap !== 'object') return null;
  const origin = worldMap.origin;
  if (!origin || typeof origin !== 'object') return null;
  return normalizeCoord(origin.q, origin.r);
}

function readCapitalCoord(territoriesValue) {
  const territories = parseJson(territoriesValue, []);
  if (!Array.isArray(territories)) return null;
  const capital = territories.find((territory) => (
    territory
    && typeof territory === 'object'
    && (territory.id === 'capital' || territory.type === 'capital')
  ));
  if (!capital) return null;
  return normalizeCoord(capital.q ?? capital.x, capital.r ?? capital.y);
}

function isZeroZero(coord) {
  return Boolean(coord && coord.q === 0 && coord.r === 0);
}

function classifyPlayer(row = {}) {
  const origin = readWorldOrigin(row.worldMap);
  const capital = readCapitalCoord(row.territories);
  const hasSpawnAllocation = Boolean(row.spawnKey);
  const originIsZeroZero = isZeroZero(origin);
  const capitalIsZeroZero = isZeroZero(capital);
  const spawn = hasSpawnAllocation
    ? {
      q: toIntegerOrNull(row.spawnQ),
      r: toIntegerOrNull(row.spawnR),
      spawnKey: row.spawnKey,
      status: row.spawnStatus || '',
    }
    : null;

  let repairMode = 'manual-review';
  const reasons = [];

  if (hasSpawnAllocation && !originIsZeroZero && !capitalIsZeroZero) {
    repairMode = 'skip-already-spawned';
    reasons.push('spawn allocation exists and origin/capital are non-legacy');
  } else if (!hasSpawnAllocation && originIsZeroZero && capitalIsZeroZero) {
    repairMode = 'eligible-reset-style-repair';
    reasons.push('missing spawn allocation with legacy origin/capital at 0,0');
  } else if (!originIsZeroZero && !capitalIsZeroZero) {
    repairMode = 'skip-non-legacy';
    reasons.push('origin/capital are non-legacy');
  } else {
    reasons.push('mixed or incomplete spawn/origin/capital state requires manual review');
  }

  return {
    playerId: String(row.playerId || ''),
    createdAt: row.createdAt || null,
    lastActiveAt: row.lastActiveAt || null,
    origin,
    capital,
    spawn,
    originIsZeroZero,
    capitalIsZeroZero,
    hasSpawnAllocation,
    repairMode,
    reasons,
  };
}

function hasTable(db, tableName) {
  const row = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `).get(tableName);
  return Boolean(row);
}

function getCount(db, tableName) {
  if (!hasTable(db, tableName)) return 0;
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count || 0;
}

function readPlayerRows(db) {
  const hasSpawnTable = hasTable(db, 'player_spawn_allocations');
  const spawnSelect = hasSpawnTable
    ? 'psa.q AS spawnQ, psa.r AS spawnR, psa.spawnKey AS spawnKey, psa.status AS spawnStatus'
    : 'NULL AS spawnQ, NULL AS spawnR, NULL AS spawnKey, NULL AS spawnStatus';
  const spawnJoin = hasSpawnTable
    ? 'LEFT JOIN player_spawn_allocations psa ON psa.playerId = game_states.playerId'
    : '';
  return db.prepare(`
    SELECT
      game_states.playerId,
      players.createdAt,
      players.lastActiveAt,
      game_states.worldMap,
      game_states.territories,
      ${spawnSelect}
    FROM game_states
    LEFT JOIN players ON players.playerId = game_states.playerId
    ${spawnJoin}
    ORDER BY players.lastActiveAt DESC, game_states.playerId ASC
  `).all();
}

function summarizeClassifiedRows(classifiedRows) {
  const byRepairMode = classifiedRows.reduce((result, row) => {
    result[row.repairMode] = (result[row.repairMode] || 0) + 1;
    return result;
  }, {});
  const legacyRows = classifiedRows.filter((row) => row.originIsZeroZero && row.capitalIsZeroZero);
  const missingSpawnRows = classifiedRows.filter((row) => !row.hasSpawnAllocation);
  const alreadySpawnedRows = classifiedRows.filter((row) => row.hasSpawnAllocation);

  return {
    legacyOriginAndCapital00: legacyRows.length,
    missingSpawnAllocation: missingSpawnRows.length,
    existingSpawnAllocationRows: alreadySpawnedRows.length,
    repairModes: byRepairMode,
  };
}

function buildPlanFromRows(rows, counts = {}, options = {}) {
  const sampleLimit = Math.max(1, Math.floor(Number(options.sampleLimit) || 20));
  const classifiedRows = rows.map(classifyPlayer);
  const summary = summarizeClassifiedRows(classifiedRows);
  const legacyCandidates = classifiedRows
    .filter((row) => row.repairMode === 'eligible-reset-style-repair')
    .slice(0, sampleLimit);
  const manualReview = classifiedRows
    .filter((row) => row.repairMode === 'manual-review')
    .slice(0, sampleLimit);
  const alreadySpawned = classifiedRows
    .filter((row) => row.repairMode === 'skip-already-spawned')
    .slice(0, sampleLimit);

  return {
    schema: 'legacy-spawn-repair-plan-v1',
    generatedAt: new Date().toISOString(),
    readonly: true,
    writesPerformed: false,
    counts: {
      players: counts.players ?? 0,
      gameStates: counts.gameStates ?? rows.length,
      spawnAllocations: counts.spawnAllocations ?? summary.existingSpawnAllocationRows,
      legacyOriginAndCapital00: summary.legacyOriginAndCapital00,
      missingSpawnAllocation: summary.missingSpawnAllocation,
      ...summary.repairModes,
    },
    samples: {
      legacyCandidates,
      manualReview,
      alreadySpawned,
    },
  };
}

function buildPlanFromDatabase(db, options = {}) {
  const rows = readPlayerRows(db);
  return buildPlanFromRows(rows, {
    players: getCount(db, 'players'),
    gameStates: getCount(db, 'game_states'),
    spawnAllocations: getCount(db, 'player_spawn_allocations'),
  }, options);
}

function parseArgs(argv = []) {
  const result = {
    dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'backend', 'civilization.db'),
    json: false,
    sampleLimit: 20,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--db') {
      result.dbPath = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--db=')) {
      result.dbPath = arg.slice('--db='.length);
    } else if (arg === '--json') {
      result.json = true;
    } else if (arg === '--sample-limit') {
      result.sampleLimit = Number(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--sample-limit=')) {
      result.sampleLimit = Number(arg.slice('--sample-limit='.length));
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return result;
}

function formatTextReport(plan, dbPath) {
  const lines = [
    'Legacy spawn repair planner',
    `Database: ${dbPath}`,
    `Readonly: ${plan.readonly}`,
    `Writes performed: ${plan.writesPerformed}`,
    '',
    'Counts:',
    `  players: ${plan.counts.players}`,
    `  gameStates: ${plan.counts.gameStates}`,
    `  spawnAllocations: ${plan.counts.spawnAllocations}`,
    `  legacyOriginAndCapital00: ${plan.counts.legacyOriginAndCapital00}`,
    `  missingSpawnAllocation: ${plan.counts.missingSpawnAllocation}`,
    `  eligible-reset-style-repair: ${plan.counts['eligible-reset-style-repair'] || 0}`,
    `  skip-already-spawned: ${plan.counts['skip-already-spawned'] || 0}`,
    `  skip-non-legacy: ${plan.counts['skip-non-legacy'] || 0}`,
    `  manual-review: ${plan.counts['manual-review'] || 0}`,
    '',
    'Legacy candidate sample:',
  ];
  for (const row of plan.samples.legacyCandidates) {
    lines.push(`  - ${row.playerId} lastActiveAt=${row.lastActiveAt || ''} origin=(${row.origin?.q},${row.origin?.r}) capital=(${row.capital?.q},${row.capital?.r}) mode=${row.repairMode}`);
  }
  if (!plan.samples.legacyCandidates.length) lines.push('  - none');
  return lines.join('\n');
}

function printHelp() {
  console.log([
    'Usage: node scripts/plan-legacy-spawn-repair.js [--db path] [--json] [--sample-limit n]',
    '',
    'Builds a readonly legacy spawn repair plan. This command never writes database rows.',
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
  const db = new Database(options.dbPath, { readonly: true, fileMustExist: true });
  try {
    const plan = buildPlanFromDatabase(db, options);
    if (options.json) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      console.log(formatTextReport(plan, options.dbPath));
    }
  } finally {
    db.close();
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`[legacy-spawn-repair] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildPlanFromDatabase,
  buildPlanFromRows,
  classifyPlayer,
  formatTextReport,
  parseArgs,
  readCapitalCoord,
  readWorldOrigin,
};
