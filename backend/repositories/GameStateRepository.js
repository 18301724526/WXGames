const PerformanceCapacityBudget = require('../services/PerformanceCapacityBudget');
const { SchemaMigrationService } = require('../services/SchemaMigrationService');
const { SpawnAuthorityRepository } = require('./SpawnAuthorityRepository');
const { WorldMapAuthorityRepository } = require('./WorldMapAuthorityRepository');
const { OwnerLockRepository } = require('./OwnerLockRepository');
const { FactionRepository } = require('./FactionRepository');
const { FactionDiplomacyRepository } = require('./FactionDiplomacyRepository');
const { WorldPeopleRepository } = require('./WorldPeopleRepository');
const { WorldCityRepository } = require('./WorldCityRepository');
const { WorldEncounterRepository } = require('./WorldEncounterRepository');
const { DEFAULT_WORLD_SEED } = require('../services/worldMap/WorldMapConstants');
const WorldExplorerVision = require('../services/worldExplorer/WorldExplorerVision');
const WorldMapService = require('../services/WorldMapService');
const {
  GAME_STATE_BASELINE_MIGRATION,
  TASK_REWARD_GRANTS_MIGRATION,
} = require('../migrations/immutableGameStateMigrations');
const {
  CURRENT_GAME_STATE_SCHEMA_MIGRATION,
} = require('../migrations/currentGameStateSchemaMigration');
const {
  RELEASE_MANIFESTS_MIGRATION,
} = require('../migrations/releaseManifestMigration');
const {
  COMMAND_RECEIPTS_MIGRATION,
} = require('../migrations/commandReceiptsMigration');
const {
  COMMAND_EXECUTION_PLANS_MIGRATION,
} = require('../migrations/commandExecutionPlansMigration');

function createGameStateSchemaMigrations() {
  return [GAME_STATE_BASELINE_MIGRATION, {
    // ②b: pending captured-general decisions (斩杀/招降/放生). A new column (not a compat backfill),
    // so it needs its own migration to land on existing DBs; fresh DBs get it from CREATE TABLE.
    id: '002-capture-decisions-column',
    description: 'Add captureDecisions column for the garrison-capture (②b) decision queue.',
    statements: ['ALTER TABLE game_states ADD COLUMN captureDecisions TEXT'],
    apply(db) {
      const columns = new Set(db.prepare('PRAGMA table_info(game_states)').all().map((column) => column.name));
      if (!columns.has('captureDecisions')) {
        db.prepare('ALTER TABLE game_states ADD COLUMN captureDecisions TEXT').run();
      }
    },
  }, {
    id: '003-owner-locks-generalization',
    description: 'Generalize player lease locks into canonical multi-owner lease locks.',
    statements: [
      'CREATE TABLE owner_locks (ownerKey TEXT PRIMARY KEY, holderId TEXT NOT NULL, scope TEXT, lockedAt TEXT NOT NULL, expiresAt TEXT NOT NULL)',
      'CREATE INDEX idx_owner_locks_expires_at ON owner_locks(expiresAt)',
      "INSERT INTO owner_locks SELECT 'player:' || playerId, ownerId, scope, lockedAt, expiresAt FROM player_state_locks",
      'DROP TABLE player_state_locks',
    ],
    apply(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS owner_locks (
          ownerKey TEXT PRIMARY KEY,
          holderId TEXT NOT NULL,
          scope TEXT,
          lockedAt TEXT NOT NULL,
          expiresAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_owner_locks_expires_at
          ON owner_locks(expiresAt);
      `);
      const legacy = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = 'player_state_locks'
      `).get();
      if (legacy) {
        db.prepare(`
          INSERT OR IGNORE INTO owner_locks (ownerKey, holderId, scope, lockedAt, expiresAt)
          SELECT 'player:' || playerId, ownerId, scope, lockedAt, expiresAt
          FROM player_state_locks
        `).run();
        db.exec(`
          DROP INDEX IF EXISTS idx_player_state_locks_expires_at;
          DROP TABLE player_state_locks;
        `);
      }
    },
  }, {
    id: '004-command-idempotency-store',
    description: 'Create the persistent command idempotency result store.',
    statements: [
      'CREATE TABLE command_idempotency (playerId TEXT NOT NULL, idempotencyKey TEXT NOT NULL, commandId TEXT NOT NULL, ownerKey TEXT, payloadDigest TEXT NOT NULL, status TEXT NOT NULL, responseDigest TEXT, responsePayload TEXT, statusCode INTEGER, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, PRIMARY KEY(playerId, idempotencyKey))',
      'CREATE INDEX idx_command_idempotency_status_updated_at ON command_idempotency(status, updatedAt)',
      'CREATE INDEX idx_command_idempotency_command_id ON command_idempotency(commandId)',
    ],
    apply(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS command_idempotency (
          playerId TEXT NOT NULL,
          idempotencyKey TEXT NOT NULL,
          commandId TEXT NOT NULL,
          ownerKey TEXT,
          payloadDigest TEXT NOT NULL,
          status TEXT NOT NULL,
          responseDigest TEXT,
          responsePayload TEXT,
          statusCode INTEGER,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          PRIMARY KEY(playerId, idempotencyKey)
        );
        CREATE INDEX IF NOT EXISTS idx_command_idempotency_status_updated_at
          ON command_idempotency(status, updatedAt);
        CREATE INDEX IF NOT EXISTS idx_command_idempotency_command_id
          ON command_idempotency(commandId);
      `);
    },
  }, TASK_REWARD_GRANTS_MIGRATION, CURRENT_GAME_STATE_SCHEMA_MIGRATION, RELEASE_MANIFESTS_MIGRATION,
  COMMAND_RECEIPTS_MIGRATION, COMMAND_EXECUTION_PLANS_MIGRATION];
}

function parseJsonField(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

class GameStateRepository {
  constructor(db) {
    this.db = db;
    this.ownerLocks = new OwnerLockRepository(db);
    this.spawnAuthority = new SpawnAuthorityRepository(db);
    this.worldMapAuthority = new WorldMapAuthorityRepository(db);
    // Shared-world AI + neutral 势力 registry (docs/design/01). Player factions derive from
    // game_states; this holds the world-authored ones. Additive — see FactionRepository.
    this.factionRepo = new FactionRepository(db);
    this.factionDiplomacyRepo = new FactionDiplomacyRepository(db);
    // Shared-world people registry (docs/design/02): 在野武将 + AI-faction officers. Player rosters
    // stay in game_states.famousPeople; the logical registry = this table ∪ every player's roster.
    this.worldPeopleRepo = new WorldPeopleRepository(db);
    // Shared-world PRE-PLACED NEUTRAL cities (docs/design/10 §3.2, march-discovery refactor S3). One
    // canonical copy every player shares; per-player world-map visibility controls what each player sees.
    this.worldCityRepo = new WorldCityRepository(db, { worldSeed: DEFAULT_WORLD_SEED });
    this.worldEncounterRepo = new WorldEncounterRepository(db, { worldSeed: DEFAULT_WORLD_SEED });
  }

  stripProjectionFields(gameState) {
    if (!gameState || typeof gameState !== 'object') return gameState;
    delete gameState.sharedWorldTerritories;
    delete gameState.sharedWorldEncounters;
    return gameState;
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        playerId TEXT PRIMARY KEY,
        deviceId TEXT UNIQUE,
        token TEXT,
        createdAt TEXT,
        lastActiveAt TEXT
      );
      CREATE TABLE IF NOT EXISTS game_states (
        playerId TEXT PRIMARY KEY,
        revision INTEGER DEFAULT 0,
        saveMetadata TEXT,
        resources TEXT,
        buildings TEXT,
        population TEXT,
        techs TEXT,
        techEffects TEXT,
        currentEra INTEGER,
        eraHistory TEXT,
        happiness INTEGER,
        gameDay INTEGER,
        eventQueue TEXT,
        eventHistory TEXT,
        captureDecisions TEXT,
        regularEventState TEXT,
        threatEventState TEXT,
        activeBuffs TEXT,
        offlineSnapshot TEXT,
        offlineEventLog TEXT,
        negativeStreak INTEGER,
        lastEventAt TEXT,
        talentPolicies TEXT,
        famousPeople TEXT,
        famousPersonState TEXT,
        taskProgress TEXT,
        taskRewardGrants TEXT,
        military TEXT,
        polity TEXT,
        territories TEXT,
        worldMap TEXT,
        activeCityId TEXT,
        cities TEXT,
        scoutedCoordinates TEXT,
        scoutState TEXT,
        exploreMissions TEXT,
        worldMarchClientReports TEXT,
        worldMarchVerification TEXT,
        worldCombat TEXT,
        worldAi TEXT,
        warMissions TEXT,
        scoutReports TEXT,
        updatedAt TEXT
      );
      CREATE TABLE IF NOT EXISTS shared_world_territories (
        id TEXT PRIMARY KEY,
        territory TEXT,
        ownerPlayerId TEXT,
        updatedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_players_last_active_at ON players(lastActiveAt DESC);
      CREATE INDEX IF NOT EXISTS idx_shared_world_territories_owner ON shared_world_territories(ownerPlayerId);
    `);
    this.spawnAuthority.init();
    this.worldMapAuthority.init();
    this.factionRepo.init();
    this.factionDiplomacyRepo.init();
    this.worldPeopleRepo.init();
    this.worldCityRepo.init();
    this.worldEncounterRepo.init();
    new SchemaMigrationService(this.db, createGameStateSchemaMigrations()).migrate();
    this.worldMapAuthority.migrateLegacyPlayerWorldMaps();
    this.ensureWorldCitiesSeeded();
  }

  // Idempotent one-time lay-down of the shared PRE-PLACED NEUTRAL city layer (docs/design/10 §3.2,
  // §6-R8). World-level (not per-player) — the cities are a shared single copy off the fixed world
  // anchor, so this seeds once at world init, mirroring where the faction/people world registries are
  // initialized. WorldCityRepository.ensureSeeded short-circuits on hasAny, so re-running init (a fresh
  // GameStateRepository over the same DB) never grows or duplicates the set. Placement reserves against
  // every already-occupied spawn coordinate (player capitals + shared occupied territories + reserved
  // spawns — §6-R3) so a neutral city never lands on a spawn/capital tile.
  ensureWorldCitiesSeeded() {
    const occupiedTileIds = new Set();
    for (const coordinate of this.spawnAuthority.getOccupiedSpawnCoordinates()) {
      const q = Number(coordinate?.q);
      const r = Number(coordinate?.r);
      if (Number.isFinite(q) && Number.isFinite(r)) {
        occupiedTileIds.add(`tile_${Math.floor(q)}_${Math.floor(r)}`);
      }
    }
    return this.worldCityRepo.ensureSeeded({ occupiedTileIds });
  }

  getWorldEncounterPlanOptions() {
    const occupiedTileIds = new Set();
    for (const coordinate of this.getOccupiedSpawnCoordinates()) {
      const q = Number(coordinate?.q);
      const r = Number(coordinate?.r);
      if (Number.isFinite(q) && Number.isFinite(r)) {
        occupiedTileIds.add(`tile_${Math.floor(q)}_${Math.floor(r)}`);
      }
    }
    return {
      occupiedTileIds,
      activitySources: this.getWorldEncounterActivitySources(),
    };
  }

  planWorldEncounters() {
    const options = this.getWorldEncounterPlanOptions();
    if (typeof this.worldEncounterRepo.planSeeded === 'function') {
      return this.worldEncounterRepo.planSeeded(options);
    }
    return this.worldEncounterRepo.getAllEncounters({
      ...options,
      refreshRespawns: false,
      projectRespawns: true,
    });
  }

  getProjectedActiveWorldEncounterAt(coord = {}) {
    const q = Math.floor(Number(coord.q ?? coord.x) || 0);
    const r = Math.floor(Number(coord.r ?? coord.y) || 0);
    const tileId = WorldMapService.getTileId(q, r);
    return this.planWorldEncounters().find((encounter) => (
      encounter?.status === 'active' && encounter.tileId === tileId
    )) || null;
  }

  readWorldEncounterActivityStates() {
    return this.db.prepare(`
      SELECT playerId, territories, worldMap, exploreMissions
      FROM game_states
      ORDER BY playerId ASC
    `).all()
      .map((row) => ({
        playerId: row.playerId,
        territories: parseJsonField(row.territories, []),
        worldMap: parseJsonField(row.worldMap, {}),
        exploreMissions: parseJsonField(row.exploreMissions, []),
      }));
  }

  getWorldEncounterActivitySources() {
    return this.readWorldEncounterActivityStates()
      .flatMap((state) => WorldExplorerVision.getActivitySources(state));
  }

  getOccupiedWorldCityCoordinates() {
    return this.worldCityRepo.getAllCities()
      .map((city) => {
        const q = Number(city?.x ?? city?.q);
        const r = Number(city?.y ?? city?.r);
        if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
        return {
          q: Math.floor(q),
          r: Math.floor(r),
          territoryId: city.id,
          source: 'world-city',
          blocksTile: true,
          blocksDistance: false,
        };
      })
      .filter(Boolean);
  }

  getOccupiedSpawnCoordinates(options = {}) {
    return [
      ...this.spawnAuthority.getOccupiedSpawnCoordinates(options),
      ...(options.includeWorldCities === false ? [] : this.getOccupiedWorldCityCoordinates()),
    ];
  }

  getSpawnForPlayer(playerId) {
    return this.spawnAuthority.getSpawnForPlayer(playerId);
  }

  reserveSpawnForPlayer(playerId, assignment, options = {}) {
    return this.spawnAuthority.reserveSpawn(playerId, assignment, options);
  }

  ensureCompanionCityForPlayerSpawn(playerId, spawn, options = {}) {
    return this.worldCityRepo.ensureCompanionCityForSpawn(playerId, spawn, options);
  }

  releaseSpawnForPlayer(playerId) {
    return this.spawnAuthority.releaseSpawnForPlayer(playerId);
  }

  findByPlayerId(playerId) {
    const row = this.db.prepare('SELECT * FROM game_states WHERE playerId = ?').get(playerId);
    if (!row) return null;
    const state = {
      playerId: row.playerId,
      revision: Number.isFinite(Number(row.revision)) ? Number(row.revision) : 0,
      saveMetadata: row.saveMetadata ? JSON.parse(row.saveMetadata) : null,
      resources: JSON.parse(row.resources || '{}'),
      buildings: JSON.parse(row.buildings || '{}'),
      population: JSON.parse(row.population || '{}'),
      techs: JSON.parse(row.techs || '{}'),
      techEffects: JSON.parse(row.techEffects || '{}'),
      currentEra: row.currentEra || 0,
      eraHistory: JSON.parse(row.eraHistory || '[]'),
      happiness: row.happiness || 100,
      gameDay: row.gameDay || 1,
      eventQueue: JSON.parse(row.eventQueue || '[]'),
      eventHistory: JSON.parse(row.eventHistory || '[]'),
      captureDecisions: JSON.parse(row.captureDecisions || '[]'),
      regularEventState: row.regularEventState ? JSON.parse(row.regularEventState) : null,
      threatEventState: row.threatEventState ? JSON.parse(row.threatEventState) : null,
      activeBuffs: JSON.parse(row.activeBuffs || '[]'),
      offlineSnapshot: JSON.parse(row.offlineSnapshot || '{}'),
      offlineEventLog: JSON.parse(row.offlineEventLog || '[]'),
      negativeStreak: row.negativeStreak || 0,
      lastEventAt: row.lastEventAt ? Number(row.lastEventAt) || 0 : 0,
      talentPolicies: row.talentPolicies ? JSON.parse(row.talentPolicies) : null,
      famousPeople: row.famousPeople ? JSON.parse(row.famousPeople) : null,
      famousPersonState: row.famousPersonState ? JSON.parse(row.famousPersonState) : null,
      taskProgress: row.taskProgress ? JSON.parse(row.taskProgress) : null,
      taskRewardGrants: row.taskRewardGrants ? JSON.parse(row.taskRewardGrants) : null,
      military: row.military ? JSON.parse(row.military) : null,
      polity: row.polity ? JSON.parse(row.polity) : null,
      territories: row.territories ? JSON.parse(row.territories) : null,
      worldMap: row.worldMap ? JSON.parse(row.worldMap) : null,
      activeCityId: row.activeCityId || null,
      cities: row.cities ? JSON.parse(row.cities) : null,
      scoutedCoordinates: row.scoutedCoordinates ? JSON.parse(row.scoutedCoordinates) : null,
      scoutState: row.scoutState ? JSON.parse(row.scoutState) : null,
      exploreMissions: row.exploreMissions ? JSON.parse(row.exploreMissions) : null,
      worldMarchClientReports: row.worldMarchClientReports ? JSON.parse(row.worldMarchClientReports) : null,
      worldMarchVerification: row.worldMarchVerification ? JSON.parse(row.worldMarchVerification) : null,
      worldCombat: row.worldCombat ? JSON.parse(row.worldCombat) : null,
      worldAi: row.worldAi ? JSON.parse(row.worldAi) : undefined,
      warMissions: row.warMissions ? JSON.parse(row.warMissions) : null,
      scoutReports: row.scoutReports ? JSON.parse(row.scoutReports) : null,
      updatedAt: row.updatedAt,
    };
    state.worldMap = this.worldMapAuthority.hydrateWorldMapForPlayer(
      state.playerId,
      state.worldMap,
      { territories: state.territories },
    );
    return state;
  }

  getClientProjectionForPlayer(playerId) {
    // The player-OWNED shared territories (occupied cities of every OTHER player) — the pre-existing
    // projection, unchanged.
    const ownedShared = this.getSharedWorldTerritories({ excludePlayerId: playerId });
    // The shared PRE-PLACED NEUTRAL cities (one canonical copy, docs/design/10 §3.2). Every player
    // gets the SAME set, so this reads the whole world_cities table with no per-player exclusion. Both
    // consumers of `sharedWorldTerritories` receive the FULL set: the route/discovery planning context
    // (WorldExplorerProgression / WorldExplorerRoutePlanner) needs to reserve against and discover
    // undiscovered cities, so it must see them all. The CLIENT map DTO is visibility-gated separately,
    // inside TerritoryClientAssembler.getClientTerritoryState (§6-R2): a neutral city whose tile the
    // player has not revealed is dropped there; a spawn companion city is visible because spawn
    // materialization binds its tile in that player's world map.
    const neutralCities = this.worldCityRepo.getAllCities();
    const sharedWorldEncounters = this.planWorldEncounters();
    return {
      sharedWorldTerritories: [...ownedShared, ...neutralCities],
      sharedWorldEncounters,
    };
  }

  findAll() {
    const rows = this.db.prepare(`
      SELECT game_states.playerId
      FROM game_states
      INNER JOIN players ON players.playerId = game_states.playerId
    `).all();
    return rows.map((row) => this.findByPlayerId(row.playerId)).filter(Boolean);
  }

  findRecentlyActive(activeSinceIso, limit = 50) {
    const rows = this.db.prepare(`
      SELECT game_states.playerId
      FROM game_states
      INNER JOIN players ON players.playerId = game_states.playerId
      WHERE players.lastActiveAt >= ?
      ORDER BY players.lastActiveAt DESC
      LIMIT ?
    `).all(activeSinceIso, limit);
    return rows.map((row) => this.findByPlayerId(row.playerId)).filter(Boolean);
  }

  getPlayerActivitySummary(options = {}) {
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const windowsMinutes = Array.isArray(options.windowsMinutes) && options.windowsMinutes.length
      ? options.windowsMinutes
      : [2, 10, 60, 1440];
    const recentLimit = Math.max(1, Math.min(100, Math.floor(Number(options.recentLimit) || 12)));
    const total = this.db.prepare('SELECT COUNT(*) AS count FROM players').get()?.count || 0;
    const windows = {};
    for (const minutes of windowsMinutes) {
      const normalizedMinutes = Math.max(1, Math.floor(Number(minutes) || 1));
      const since = new Date(now.getTime() - normalizedMinutes * 60 * 1000).toISOString();
      windows[`last${normalizedMinutes}m`] = this.db.prepare(
        'SELECT COUNT(*) AS count FROM players WHERE lastActiveAt >= ?',
      ).get(since)?.count || 0;
    }
    const recentPlayers = this.db.prepare(`
      SELECT playerId, deviceId, createdAt, lastActiveAt
      FROM players
      ORDER BY lastActiveAt DESC
      LIMIT ?
    `).all(recentLimit);
    return {
      schema: 'player-activity-summary-v1',
      generatedAt: now.toISOString(),
      totalPlayers: total,
      windows,
      recentPlayers,
    };
  }

  createRevisionConflictError(playerId, expectedRevision, actualRevision) {
    const error = new Error('Game state revision conflict');
    error.code = 'GAME_STATE_REVISION_CONFLICT';
    error.playerId = playerId;
    error.expectedRevision = expectedRevision;
    error.actualRevision = actualRevision;
    return error;
  }

  getExistingRevision(playerId) {
    const row = this.db.prepare('SELECT revision FROM game_states WHERE playerId = ?').get(playerId);
    if (!row) return null;
    const revision = Number(row.revision);
    return Number.isFinite(revision) ? revision : 0;
  }

  writeGameStateRow(gameState, revision, updatedAt) {
    const worldMapForSave = this.worldMapAuthority.sanitizeWorldMapForSave(gameState.worldMap);
    const saveMetadata = {
      ...(gameState.saveMetadata || {}),
      performanceCapacity: PerformanceCapacityBudget.summarizeReport(
        PerformanceCapacityBudget.checkSaveState({
          ...gameState,
          worldMap: worldMapForSave,
          revision,
          updatedAt,
        }),
      ),
    };
    this.db.prepare(`
      INSERT INTO game_states (
        playerId, revision, saveMetadata, resources, buildings, population, techs, techEffects, currentEra,
        eraHistory, happiness, gameDay, eventQueue, eventHistory, offlineSnapshot,
        offlineEventLog, negativeStreak, lastEventAt, talentPolicies,
        famousPeople, famousPersonState, taskProgress, taskRewardGrants, military,
        regularEventState, threatEventState, activeBuffs, polity, territories, worldMap, activeCityId, cities,
        scoutedCoordinates, scoutState, exploreMissions, worldMarchClientReports, worldMarchVerification,
        worldCombat, worldAi, warMissions, scoutReports, updatedAt, captureDecisions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(playerId) DO UPDATE SET
        revision = excluded.revision,
        saveMetadata = excluded.saveMetadata,
        resources = excluded.resources,
        buildings = excluded.buildings,
        population = excluded.population,
        techs = excluded.techs,
        techEffects = excluded.techEffects,
        currentEra = excluded.currentEra,
        eraHistory = excluded.eraHistory,
        happiness = excluded.happiness,
        gameDay = excluded.gameDay,
        eventQueue = excluded.eventQueue,
        eventHistory = excluded.eventHistory,
        offlineSnapshot = excluded.offlineSnapshot,
        offlineEventLog = excluded.offlineEventLog,
        negativeStreak = excluded.negativeStreak,
        lastEventAt = excluded.lastEventAt,
        talentPolicies = excluded.talentPolicies,
        famousPeople = excluded.famousPeople,
        famousPersonState = excluded.famousPersonState,
        taskProgress = excluded.taskProgress,
        taskRewardGrants = excluded.taskRewardGrants,
        military = excluded.military,
        regularEventState = excluded.regularEventState,
        threatEventState = excluded.threatEventState,
        activeBuffs = excluded.activeBuffs,
        polity = excluded.polity,
        territories = excluded.territories,
        worldMap = excluded.worldMap,
        activeCityId = excluded.activeCityId,
        cities = excluded.cities,
        scoutedCoordinates = excluded.scoutedCoordinates,
        scoutState = excluded.scoutState,
        exploreMissions = excluded.exploreMissions,
        worldMarchClientReports = excluded.worldMarchClientReports,
        worldMarchVerification = excluded.worldMarchVerification,
        worldCombat = excluded.worldCombat,
        worldAi = excluded.worldAi,
        warMissions = excluded.warMissions,
        scoutReports = excluded.scoutReports,
        updatedAt = excluded.updatedAt,
        captureDecisions = excluded.captureDecisions
    `).run(
      gameState.playerId,
      revision,
      JSON.stringify(saveMetadata),
      // Legacy top-level resources/buildings/population/military columns are vestigial: the
      // sole truth now lives in the cities[] column. Persist null so nothing perpetuates the
      // old dual-write mirror. (CUT 7 — columns kept for backward-compatible reads of pre-cities rows.)
      null,
      null,
      null,
      JSON.stringify(gameState.techs || {}),
      JSON.stringify(gameState.techEffects || {}),
      gameState.currentEra || 0,
      JSON.stringify(gameState.eraHistory || []),
      gameState.happiness || 100,
      gameState.gameDay || 1,
      JSON.stringify(gameState.eventQueue || []),
      JSON.stringify(gameState.eventHistory || []),
      JSON.stringify(gameState.offlineSnapshot || {}),
      JSON.stringify(gameState.offlineEventLog || []),
      gameState.negativeStreak || 0,
      gameState.lastEventAt || 0,
      JSON.stringify(gameState.talentPolicies || {}),
      JSON.stringify(gameState.famousPeople || []),
      JSON.stringify(gameState.famousPersonState || {}),
      JSON.stringify(gameState.taskProgress || {}),
      JSON.stringify(gameState.taskRewardGrants || {}),
      null,
      JSON.stringify(gameState.regularEventState || {}),
      JSON.stringify(gameState.threatEventState || {}),
      JSON.stringify(gameState.activeBuffs || []),
      JSON.stringify(gameState.polity || {}),
      JSON.stringify(gameState.territories || []),
      JSON.stringify(worldMapForSave || {}),
      gameState.activeCityId || 'capital',
      JSON.stringify(gameState.cities || {}),
      JSON.stringify(gameState.scoutedCoordinates || []),
      JSON.stringify(gameState.scoutState || {}),
      JSON.stringify(gameState.exploreMissions || []),
      JSON.stringify(gameState.worldMarchClientReports || {}),
      JSON.stringify(gameState.worldMarchVerification || null),
      JSON.stringify(gameState.worldCombat || null),
      JSON.stringify(gameState.worldAi || {}),
      JSON.stringify(gameState.warMissions || []),
      JSON.stringify(gameState.scoutReports || []),
      updatedAt,
      JSON.stringify(gameState.captureDecisions || []),
    );
  }

  saveWithinTransaction(gameState, options = {}) {
    this.stripProjectionFields(gameState);
    const playerId = gameState?.playerId || '';
    if (!playerId) throw new Error('Game state playerId is required');
    const existingRevision = this.getExistingRevision(playerId);
    const expectedRevision = options.expectedRevision ?? gameState.revision;
    const hasExpectedRevision = expectedRevision !== null
      && expectedRevision !== undefined
      && Number.isFinite(Number(expectedRevision));
    if (existingRevision !== null && hasExpectedRevision && Number(expectedRevision) !== existingRevision) {
      throw this.createRevisionConflictError(playerId, Number(expectedRevision), existingRevision);
    }
    const revision = existingRevision === null ? 1 : existingRevision + 1;
    const updatedAt = new Date().toISOString();
    this.worldMapAuthority.commitWorldMapForPlayer(gameState, updatedAt);
    this.writeGameStateRow(gameState, revision, updatedAt);
    const savedState = {
      ...gameState,
      revision,
      updatedAt,
    };
    this.saveSharedWorldTerritories(savedState, options);
    return savedState;
  }

  saveAtomic(gameState, options = {}) {
    const transaction = this.db.transaction((state, opts) => this.saveWithinTransaction(state, opts));
    const savedState = transaction(gameState, options);
    gameState.revision = savedState.revision;
    gameState.updatedAt = savedState.updatedAt;
    return savedState;
  }

  save(gameState, options = {}) {
    return this.saveAtomic(gameState, options);
  }

  applySharedMutationsWithinTransaction(mutations = {}, options = {}) {
    const encounters = Array.isArray(mutations.encounters) ? mutations.encounters : [];
    const people = Array.isArray(mutations.people) ? mutations.people : [];
    const diplomacyEdges = Array.isArray(mutations.diplomacyEdges)
      ? mutations.diplomacyEdges
      : [];
    const playerStates = Array.isArray(mutations.playerStates) ? mutations.playerStates : [];
    playerStates.forEach((mutation) => {
      const state = mutation?.state || mutation;
      this.saveWithinTransaction(state, {
        ...options,
        expectedRevision: mutation?.expectedRevision ?? state?.revision,
      });
    });
    encounters.forEach((mutation) => {
      const encounter = mutation?.encounter || mutation;
      this.worldEncounterRepo.upsertEncounter(encounter, mutation?.now || null);
    });
    people.forEach((mutation) => {
      const person = mutation?.person || mutation;
      this.worldPeopleRepo.upsertPerson(person, mutation?.now || null);
    });
    diplomacyEdges.forEach((mutation) => {
      this.factionDiplomacyRepo.upsertEdge(
        mutation.fromFactionId,
        mutation.toFactionId,
        mutation.edge,
        mutation.now || null,
      );
    });
    return {
      encounterCount: encounters.length,
      peopleCount: people.length,
      diplomacyEdgeCount: diplomacyEdges.length,
      playerStateCount: playerStates.length,
    };
  }

  commitCommandState(gameState, mutations = {}, options = {}) {
    const persistState = options.persistState !== false;
    const transaction = this.db.transaction((state, sharedMutations, commitOptions) => {
      const savedState = persistState
        ? this.saveWithinTransaction(state, commitOptions)
        : state;
      const shared = this.applySharedMutationsWithinTransaction(sharedMutations, commitOptions);
      return { savedState, shared };
    });
    const result = transaction(gameState, mutations, options);
    if (persistState && gameState && typeof gameState === 'object') {
      gameState.revision = result.savedState.revision;
      gameState.updatedAt = result.savedState.updatedAt;
    }
    return result;
  }

  resetPlayerState(playerId, gameState, options = {}) {
    if (Array.isArray(options.ownerKeys)) {
      const requiredOwnerKeys = [
        `player:${playerId}`,
        `territory-owner:${playerId}`,
      ];
      const missingOwnerKeys = requiredOwnerKeys.filter((ownerKey) => (
        !options.ownerKeys.includes(ownerKey)
      ));
      if (missingOwnerKeys.length) {
        const error = new Error(`Player reset did not lock ${missingOwnerKeys.join(', ')}`);
        error.code = 'COMMAND_SHARED_MUTATION_OWNER_NOT_LOCKED';
        error.missingOwnerKeys = missingOwnerKeys;
        throw error;
      }
    }
    const transaction = this.db.transaction((id, state, opts) => {
      const resetState = typeof opts.createState === 'function'
        ? opts.createState(id)
        : state;
      if (!resetState || typeof resetState !== 'object') {
        const error = new Error('Player reset state is required');
        error.code = 'COMMAND_RESET_STATE_MISSING';
        throw error;
      }
      this.db.prepare('DELETE FROM game_states WHERE playerId = ?').run(id);
      this.db.prepare('DELETE FROM shared_world_territories WHERE ownerPlayerId = ?').run(id);
      this.worldMapAuthority.clearPlayerVisibility(id);
      return this.saveWithinTransaction({ ...resetState, playerId: id }, {
        expectedRevision: null,
        ownerKeys: opts.ownerKeys,
      });
    });
    const savedState = transaction(playerId, gameState, options);
    if (gameState && typeof gameState === 'object') {
      gameState.playerId = savedState.playerId;
      gameState.revision = savedState.revision;
      gameState.updatedAt = savedState.updatedAt;
    }
    return savedState;
  }

  getSharedWorldTerritories(options = {}) {
    const excludePlayerId = String(options.excludePlayerId || '');
    return this.db.prepare('SELECT territory, ownerPlayerId FROM shared_world_territories ORDER BY id ASC').all()
      .map((row) => {
        try {
          const territory = JSON.parse(row.territory || 'null');
          if (!territory || typeof territory !== 'object') return null;
          return {
            ...territory,
            ownerPlayerId: territory.ownerPlayerId || row.ownerPlayerId || '',
          };
        } catch (_) {
          return null;
        }
      })
      .filter((territory) => (
        territory
        && typeof territory === 'object'
        && (!excludePlayerId || territory.ownerPlayerId !== excludePlayerId)
      ));
  }

  getSharedWorldTerritory(territoryId) {
    const id = String(territoryId || '');
    if (!id) return null;
    const row = this.db.prepare(`
      SELECT territory, ownerPlayerId
      FROM shared_world_territories
      WHERE id = ?
    `).get(id);
    if (!row) return null;
    try {
      const territory = JSON.parse(row.territory || 'null');
      return territory && typeof territory === 'object'
        ? { ...territory, ownerPlayerId: territory.ownerPlayerId || row.ownerPlayerId || '' }
        : null;
    } catch (_) {
      return null;
    }
  }

  getSharedTerritoryOwner(gameState, territory) {
    if (!territory || typeof territory !== 'object') return '';
    if (territory.type === 'capital' || territory.id === 'capital') return '';
    if (typeof territory.ownerPlayerId === 'string' && territory.ownerPlayerId) return territory.ownerPlayerId;
    if (territory.owner === 'player' && territory.status === 'occupied') return gameState.playerId || '';
    return '';
  }

  saveSharedWorldTerritories(gameState, options = {}) {
    const now = new Date().toISOString();
    const territories = Array.isArray(gameState?.territories) ? gameState.territories : [];
    const scopedOwnerKeys = Array.isArray(options.ownerKeys);
    const authorizedTerritoryIds = new Set(
      (options.ownerKeys || [])
        .filter((ownerKey) => String(ownerKey).startsWith('territory:'))
        .map((ownerKey) => String(ownerKey).slice('territory:'.length)),
    );
    if (scopedOwnerKeys && authorizedTerritoryIds.size === 0) return;
    const ownedIds = [];
    const upsert = this.db.prepare(`
      INSERT OR REPLACE INTO shared_world_territories (id, territory, ownerPlayerId, updatedAt)
      VALUES (?, ?, ?, ?)
    `);
    const readCurrentOwner = this.db.prepare(`
      SELECT ownerPlayerId
      FROM shared_world_territories
      WHERE id = ?
    `);
    for (const territory of territories) {
      const id = territory.id || `site_${territory.x ?? territory.q}_${territory.y ?? territory.r}`;
      if (scopedOwnerKeys && !authorizedTerritoryIds.has(String(id))) continue;
      const ownerPlayerId = this.getSharedTerritoryOwner(gameState, territory);
      if (!ownerPlayerId) continue;
      const currentOwnerPlayerId = String(readCurrentOwner.get(id)?.ownerPlayerId || '');
      const requiredOwnerKeys = Array.from(new Set([
        currentOwnerPlayerId ? `territory-owner:${currentOwnerPlayerId}` : '',
        `territory-owner:${ownerPlayerId}`,
      ].filter(Boolean)));
      const missingOwnerKeys = scopedOwnerKeys
        ? requiredOwnerKeys.filter((ownerKey) => !options.ownerKeys.includes(ownerKey))
        : [];
      if (missingOwnerKeys.length) {
        const error = new Error(`Territory command did not lock ${missingOwnerKeys.join(', ')}`);
        error.code = 'COMMAND_SHARED_MUTATION_OWNER_NOT_LOCKED';
        error.missingOwnerKeys = missingOwnerKeys;
        throw error;
      }
      if (ownerPlayerId === gameState.playerId) ownedIds.push(id);
      upsert.run(id, JSON.stringify({ ...territory, id, ownerPlayerId }), ownerPlayerId, now);
    }
    if (scopedOwnerKeys) return;
    const playerId = gameState?.playerId || '';
    if (!playerId) return;
    if (!ownedIds.length) {
      this.db.prepare('DELETE FROM shared_world_territories WHERE ownerPlayerId = ?').run(playerId);
      return;
    }
    const placeholders = ownedIds.map(() => '?').join(', ');
    this.db.prepare(`
      DELETE FROM shared_world_territories
      WHERE ownerPlayerId = ? AND id NOT IN (${placeholders})
    `).run(playerId, ...ownedIds);
  }

  touchPlayerActiveAt(playerId) {
    this.db.prepare('UPDATE players SET lastActiveAt = ? WHERE playerId = ?').run(new Date().toISOString(), playerId);
  }

  withPlayerStateLock(playerId, callback, options = {}) {
    const normalizedPlayerId = String(playerId || '').trim();
    if (!normalizedPlayerId) {
      const error = new Error('Player state lock requires playerId');
      error.code = 'OWNER_KEY_INVALID';
      throw error;
    }
    try {
      return this.withOwnerLocks(
        [`player:${normalizedPlayerId}`],
        options.scope || 'player-state',
        callback,
        options,
      );
    } catch (error) {
      if (error?.code === 'OWNER_LOCK_TIMEOUT') error.playerId = normalizedPlayerId;
      throw error;
    }
  }

  withOwnerLocks(ownerKeys, scope, callback, options = {}) {
    return this.ownerLocks.withOwnerLocks(ownerKeys, scope, callback, options);
  }
}

module.exports = GameStateRepository;
