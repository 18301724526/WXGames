#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const {
  classifyPlayer,
  readCapitalCoord,
  readWorldOrigin,
} = require('./plan-legacy-spawn-repair');

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

function loadBackendModule(relativePath) {
  const candidates = [
    path.join(__dirname, '..', 'backend', relativePath),
    path.join('/opt/wxgame-workspace/backend', relativePath),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      if (error?.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error(`Unable to load backend module: ${relativePath}`);
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function normalizePlayerId(value) {
  return String(value || '').trim();
}

function expectedConfirmation(playerId) {
  return `repair-legacy-spawn:${playerId}`;
}

function parseArgs(argv = []) {
  const result = {
    dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'backend', 'civilization.db'),
    playerId: '',
    write: false,
    json: false,
    confirm: process.env.WXGAME_CONFIRM_LEGACY_SPAWN_REPAIR || '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--db') {
      result.dbPath = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--db=')) {
      result.dbPath = arg.slice('--db='.length);
    } else if (arg === '--player') {
      result.playerId = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--player=')) {
      result.playerId = arg.slice('--player='.length);
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
  result.playerId = normalizePlayerId(result.playerId);
  return result;
}

function readPlayerRow(db, playerId) {
  return db.prepare(`
    SELECT
      game_states.playerId,
      players.createdAt,
      players.lastActiveAt,
      game_states.worldMap,
      game_states.territories,
      psa.q AS spawnQ,
      psa.r AS spawnR,
      psa.spawnKey AS spawnKey,
      psa.status AS spawnStatus
    FROM game_states
    LEFT JOIN players ON players.playerId = game_states.playerId
    LEFT JOIN player_spawn_allocations psa ON psa.playerId = game_states.playerId
    WHERE game_states.playerId = ?
  `).get(playerId);
}

function summarizeRawRow(row) {
  if (!row) return null;
  const territories = parseJson(row.territories, []);
  const ownedTerritories = Array.isArray(territories)
    ? territories.filter((territory) => (
      territory
      && typeof territory === 'object'
      && (
        territory.ownerPlayerId === row.playerId
        || (territory.owner === 'player' && territory.status === 'occupied')
        || territory.id === 'capital'
      )
    )).map((territory) => ({
      id: territory.id || '',
      type: territory.type || '',
      q: territory.q ?? territory.x ?? null,
      r: territory.r ?? territory.y ?? null,
      owner: territory.owner || '',
      ownerPlayerId: territory.ownerPlayerId || '',
      status: territory.status || '',
    }))
    : [];
  const worldMap = parseJson(row.worldMap, {});
  return {
    playerId: row.playerId,
    createdAt: row.createdAt || null,
    lastActiveAt: row.lastActiveAt || null,
    origin: readWorldOrigin(row.worldMap),
    capital: readCapitalCoord(row.territories),
    visibleTileCount: Array.isArray(worldMap.tiles) ? worldMap.tiles.length : 0,
    spawn: row.spawnKey
      ? {
        q: row.spawnQ,
        r: row.spawnR,
        spawnKey: row.spawnKey,
        status: row.spawnStatus || '',
      }
      : null,
    ownedTerritories,
  };
}

function summarizeState(gameState, repository) {
  const worldMap = gameState?.worldMap || {};
  const territories = Array.isArray(gameState?.territories) ? gameState.territories : [];
  const capital = territories.find((territory) => territory?.id === 'capital' || territory?.type === 'capital') || null;
  const spawn = repository.getSpawnForPlayer?.(gameState.playerId) || null;
  return {
    playerId: gameState.playerId,
    origin: worldMap.origin || null,
    capital: capital
      ? {
        q: capital.q ?? capital.x ?? null,
        r: capital.r ?? capital.y ?? null,
      }
      : null,
    visibleTileCount: Array.isArray(worldMap.tiles) ? worldMap.tiles.length : 0,
    spawn: spawn
      ? {
        q: spawn.q,
        r: spawn.r,
        spawnKey: spawn.spawnKey,
        status: spawn.status,
      }
      : null,
    ownedTerritories: territories
      .filter((territory) => territory?.id === 'capital' || territory?.ownerPlayerId === gameState.playerId || territory?.owner === 'player')
      .map((territory) => ({
        id: territory.id || '',
        type: territory.type || '',
        q: territory.q ?? territory.x ?? null,
        r: territory.r ?? territory.y ?? null,
        owner: territory.owner || '',
        ownerPlayerId: territory.ownerPlayerId || '',
        status: territory.status || '',
      })),
    revision: gameState.revision ?? null,
    updatedAt: gameState.updatedAt || null,
  };
}

function countSharedOwned(db, playerId) {
  return db.prepare('SELECT COUNT(*) AS count FROM shared_world_territories WHERE ownerPlayerId = ?')
    .get(playerId).count || 0;
}

function createRepairContext(db) {
  const GameStateRepository = loadBackendModule('repositories/GameStateRepository');
  const GameStateService = loadBackendModule('services/GameStateService');
  const { SpawnLifecycleService } = loadBackendModule('services/spawn/SpawnLifecycleService');
  const repository = new GameStateRepository(db);
  const spawnLifecycleService = new SpawnLifecycleService({
    repository,
    gameStateService: GameStateService,
  });
  return {
    repository,
    spawnLifecycleService,
  };
}

function repairLegacySpawnAccount(db, options = {}) {
  const playerId = normalizePlayerId(options.playerId);
  if (!playerId) throw new Error('A --player value is required.');

  const beforeRow = readPlayerRow(db, playerId);
  if (!beforeRow) {
    const error = new Error(`Player game state not found: ${playerId}`);
    error.code = 'PLAYER_NOT_FOUND';
    throw error;
  }

  const classification = classifyPlayer(beforeRow);
  const before = summarizeRawRow(beforeRow);
  const beforeSharedOwnedCount = countSharedOwned(db, playerId);
  const write = Boolean(options.write);
  const requiredConfirm = expectedConfirmation(playerId);
  const confirmationAccepted = options.confirm === requiredConfirm;

  const base = {
    schema: 'legacy-spawn-account-repair-v1',
    generatedAt: new Date().toISOString(),
    playerId,
    writeRequested: write,
    requiredConfirm,
    confirmationAccepted,
    repairMode: classification.repairMode,
    reasons: classification.reasons,
    before,
    beforeSharedOwnedCount,
    after: null,
    afterSharedOwnedCount: null,
    writesPerformed: false,
  };

  if (classification.repairMode !== 'eligible-reset-style-repair') {
    return {
      ...base,
      skipped: true,
      skipReason: `Player is ${classification.repairMode}, not eligible-reset-style-repair.`,
    };
  }

  if (!write) {
    return {
      ...base,
      dryRun: true,
      nextAction: `rerun with --write --confirm ${requiredConfirm}`,
    };
  }

  if (!confirmationAccepted) {
    const error = new Error(`Write requires --confirm ${requiredConfirm}`);
    error.code = 'CONFIRMATION_REQUIRED';
    error.plan = base;
    throw error;
  }

  const { repository, spawnLifecycleService } = createRepairContext(db);
  const freshState = spawnLifecycleService.resetInitialStateForPlayer(playerId);
  const savedState = repository.resetPlayerState(playerId, freshState);
  const reloaded = repository.findByPlayerId(playerId) || savedState;
  const after = summarizeState(reloaded, repository);
  const afterSharedOwnedCount = countSharedOwned(db, playerId);

  return {
    ...base,
    after,
    afterSharedOwnedCount,
    writesPerformed: true,
    dryRun: false,
    releasedSharedOwnedCount: Math.max(0, beforeSharedOwnedCount - afterSharedOwnedCount),
  };
}

function formatTextReport(report) {
  const lines = [
    'Legacy spawn account repair',
    `Player: ${report.playerId}`,
    `Mode: ${report.repairMode}`,
    `Write requested: ${report.writeRequested}`,
    `Writes performed: ${report.writesPerformed}`,
    `Required confirm: ${report.requiredConfirm}`,
    '',
    `Before origin: ${report.before?.origin ? `${report.before.origin.q},${report.before.origin.r}` : 'unknown'}`,
    `Before capital: ${report.before?.capital ? `${report.before.capital.q},${report.before.capital.r}` : 'unknown'}`,
    `Before shared owned count: ${report.beforeSharedOwnedCount}`,
  ];
  if (report.after) {
    lines.push(
      '',
      `After origin: ${report.after.origin ? `${report.after.origin.q},${report.after.origin.r}` : 'unknown'}`,
      `After capital: ${report.after.capital ? `${report.after.capital.q},${report.after.capital.r}` : 'unknown'}`,
      `After visible tile count: ${report.after.visibleTileCount}`,
      `After shared owned count: ${report.afterSharedOwnedCount}`,
      `After spawn: ${report.after.spawn?.spawnKey || 'none'}`,
    );
  }
  if (report.dryRun) {
    lines.push('', `Dry run only. ${report.nextAction}`);
  }
  if (report.skipped) {
    lines.push('', `Skipped: ${report.skipReason}`);
  }
  return lines.join('\n');
}

function printHelp() {
  console.log([
    'Usage: node scripts/repair-legacy-spawn-account.js --player <id> [--db path] [--write --confirm repair-legacy-spawn:<id>] [--json]',
    '',
    'Default mode is dry-run. Write mode performs a reset-style repair for one eligible legacy account.',
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
    const report = repairLegacySpawnAccount(db, options);
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
    if (error?.plan) {
      console.error(JSON.stringify(error.plan, null, 2));
    }
    console.error(`[legacy-spawn-repair] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  expectedConfirmation,
  formatTextReport,
  parseArgs,
  repairLegacySpawnAccount,
  summarizeRawRow,
  summarizeState,
};
