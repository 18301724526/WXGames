#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function parseArgs(argv = []) {
  const options = {
    dbPath: '',
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--db' || arg === '--db-path') {
      options.dbPath = argv[index + 1] || '';
      index += 1;
    }
  }
  return options;
}

function getDefaultDbPath(env = process.env) {
  return env.DB_PATH || path.join(__dirname, '..', 'civilization.db');
}

function normalizeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function getTileId(q, r) {
  return `tile_${normalizeInteger(q)}_${normalizeInteger(r)}`;
}

function normalizePosition(source = {}, fallback = {}) {
  const q = normalizeInteger(source?.q ?? source?.x, fallback.q ?? 0);
  const r = normalizeInteger(source?.r ?? source?.y, fallback.r ?? 0);
  const hasCoordinate = source
    && typeof source === 'object'
    && (source.q !== undefined || source.x !== undefined || source.r !== undefined || source.y !== undefined);
  return {
    q,
    r,
    tileId: hasCoordinate ? getTileId(q, r) : (source?.tileId || getTileId(q, r)),
  };
}

function normalizeCoordinateRecord(source = null, fallback = {}) {
  if (!source || typeof source !== 'object') return source;
  return {
    ...source,
    ...normalizePosition(source, fallback),
  };
}

function normalizeRoute(route = []) {
  return (Array.isArray(route) ? route : [])
    .map((step) => normalizeCoordinateRecord(step))
    .filter((step) => step && typeof step === 'object');
}

function normalizeMissionCoordinates(mission = {}) {
  const route = normalizeRoute(mission.route);
  const origin = normalizeCoordinateRecord(mission.origin || null);
  const targetFallback = route.length ? route[route.length - 1] : origin || {};
  const target = normalizeCoordinateRecord(mission.target || null, targetFallback);
  const positionFallback = target || targetFallback || origin || {};
  const position = normalizeCoordinateRecord(mission.position || null, positionFallback);
  return {
    ...mission,
    ...(origin ? { origin } : {}),
    ...(target ? { target } : {}),
    ...(position ? { position } : {}),
    route,
  };
}

function getLegacyReadyPosition(mission = {}) {
  const route = Array.isArray(mission.route) ? mission.route : [];
  const revealed = [...route].reverse().find((step) => step?.revealed) || null;
  const target = mission.target && typeof mission.target === 'object' ? mission.target : null;
  const origin = mission.origin && typeof mission.origin === 'object' ? mission.origin : null;
  return normalizePosition(mission.position || revealed || target || origin || {});
}

function cleanupLegacyReadyMission(mission = {}, nowIso = new Date().toISOString()) {
  if (!mission || typeof mission !== 'object') return { changed: false, mission };
  if (mission.status !== 'ready') return { changed: false, mission };
  const normalized = normalizeMissionCoordinates(mission);
  const cleaned = {
    ...normalized,
    status: 'idle',
    position: getLegacyReadyPosition(normalized),
    nextStepAt: null,
    completedAt: normalized.completedAt || normalized.returnedAt || normalized.completesAt || nowIso,
  };
  delete cleaned.claimedAt;
  return {
    changed: true,
    mission: cleaned,
  };
}

function cleanupExploreMissions(rawValue, nowIso = new Date().toISOString()) {
  let missions = [];
  try {
    missions = JSON.parse(rawValue || '[]');
  } catch (error) {
    return {
      changed: false,
      parseError: error.message,
      missions: rawValue,
      readyCount: 0,
    };
  }
  if (!Array.isArray(missions)) {
    return { changed: false, parseError: 'exploreMissions is not an array', missions, readyCount: 0 };
  }
  let changed = false;
  let readyCount = 0;
  const nextMissions = missions.map((mission) => {
    const result = cleanupLegacyReadyMission(mission, nowIso);
    if (result.changed) {
      changed = true;
      readyCount += 1;
    }
    return result.mission;
  });
  return {
    changed,
    parseError: '',
    missions: nextMissions,
    readyCount,
  };
}

function cleanupDatabase(db, options = {}) {
  const nowIso = options.nowIso || new Date().toISOString();
  const dryRun = Boolean(options.dryRun);
  const rows = db.prepare('SELECT playerId, exploreMissions FROM game_states ORDER BY playerId ASC').all();
  const update = db.prepare('UPDATE game_states SET exploreMissions = ?, updatedAt = COALESCE(updatedAt, ?) WHERE playerId = ?');
  const result = {
    schema: 'world-explorer-ready-cleanup-v1',
    checkedPlayers: rows.length,
    changedPlayers: 0,
    changedMissions: 0,
    parseErrors: [],
    dryRun,
  };
  const transaction = db.transaction(() => {
    for (const row of rows) {
      const cleaned = cleanupExploreMissions(row.exploreMissions, nowIso);
      if (cleaned.parseError) {
        result.parseErrors.push({ playerId: row.playerId, error: cleaned.parseError });
        continue;
      }
      if (!cleaned.changed) continue;
      result.changedPlayers += 1;
      result.changedMissions += cleaned.readyCount;
      if (!dryRun) update.run(JSON.stringify(cleaned.missions), nowIso, row.playerId);
    }
  });
  transaction();
  return result;
}

function runCli(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  const dbPath = path.resolve(options.dbPath || getDefaultDbPath(env));
  if (!fs.existsSync(dbPath)) {
    console.log(JSON.stringify({
      schema: 'world-explorer-ready-cleanup-v1',
      skipped: true,
      reason: 'db-not-found',
      dbPath,
    }));
    return 0;
  }
  const db = new Database(dbPath);
  try {
    const result = cleanupDatabase(db, { dryRun: options.dryRun });
    console.log(JSON.stringify({ ...result, dbPath }));
    return result.parseErrors.length ? 1 : 0;
  } finally {
    db.close();
  }
}

if (require.main === module) {
  process.exit(runCli());
}

module.exports = {
  cleanupDatabase,
  cleanupExploreMissions,
  cleanupLegacyReadyMission,
  getDefaultDbPath,
  parseArgs,
  runCli,
};
