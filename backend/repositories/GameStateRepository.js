const PerformanceCapacityBudget = require('../services/PerformanceCapacityBudget');
const { WorldMapAuthorityRepository } = require('./WorldMapAuthorityRepository');

class GameStateRepository {
  constructor(db) {
    this.db = db;
    this.worldMapAuthority = new WorldMapAuthorityRepository(db);
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
        regularEventState TEXT,
        threatEventState TEXT,
        activeBuffs TEXT,
        offlineSnapshot TEXT,
        offlineEventLog TEXT,
        negativeStreak INTEGER,
        lastEventAt TEXT,
        tutorial TEXT,
        softGuideState TEXT,
        talentPolicies TEXT,
        famousPeople TEXT,
        famousPersonState TEXT,
        taskProgress TEXT,
        military TEXT,
        polity TEXT,
        territories TEXT,
        worldMap TEXT,
        activeCityId TEXT,
        cities TEXT,
        scoutedCoordinates TEXT,
        scoutState TEXT,
        exploreMissions TEXT,
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
    this.worldMapAuthority.init();

    const columns = this.db.prepare("PRAGMA table_info(game_states)").all();
    if (!columns.some((column) => column.name === 'revision')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN revision INTEGER DEFAULT 0').run();
    }
    if (!columns.some((column) => column.name === 'tutorial')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN tutorial TEXT').run();
    }
    if (!columns.some((column) => column.name === 'saveMetadata')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN saveMetadata TEXT').run();
    }
    if (!columns.some((column) => column.name === 'softGuideState')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN softGuideState TEXT').run();
    }
    if (!columns.some((column) => column.name === 'talentPolicies')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN talentPolicies TEXT').run();
    }
    if (!columns.some((column) => column.name === 'famousPeople')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN famousPeople TEXT').run();
    }
    if (!columns.some((column) => column.name === 'famousPersonState')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN famousPersonState TEXT').run();
    }
    if (!columns.some((column) => column.name === 'taskProgress')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN taskProgress TEXT').run();
    }
    if (!columns.some((column) => column.name === 'military')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN military TEXT').run();
    }
    if (!columns.some((column) => column.name === 'regularEventState')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN regularEventState TEXT').run();
    }
    if (!columns.some((column) => column.name === 'activeBuffs')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN activeBuffs TEXT').run();
    }
    if (!columns.some((column) => column.name === 'threatEventState')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN threatEventState TEXT').run();
    }
    if (!columns.some((column) => column.name === 'polity')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN polity TEXT').run();
    }
    if (!columns.some((column) => column.name === 'territories')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN territories TEXT').run();
    }
    if (!columns.some((column) => column.name === 'worldMap')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN worldMap TEXT').run();
    }
    if (!columns.some((column) => column.name === 'activeCityId')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN activeCityId TEXT').run();
    }
    if (!columns.some((column) => column.name === 'cities')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN cities TEXT').run();
    }
    if (!columns.some((column) => column.name === 'scoutedCoordinates')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN scoutedCoordinates TEXT').run();
    }
    if (!columns.some((column) => column.name === 'scoutState')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN scoutState TEXT').run();
    }
    if (!columns.some((column) => column.name === 'exploreMissions')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN exploreMissions TEXT').run();
    }
    if (!columns.some((column) => column.name === 'worldAi')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN worldAi TEXT').run();
    }
    if (!columns.some((column) => column.name === 'warMissions')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN warMissions TEXT').run();
    }
    if (!columns.some((column) => column.name === 'scoutReports')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN scoutReports TEXT').run();
    }
    this.worldMapAuthority.migrateLegacyPlayerWorldMaps();
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
      regularEventState: row.regularEventState ? JSON.parse(row.regularEventState) : null,
      threatEventState: row.threatEventState ? JSON.parse(row.threatEventState) : null,
      activeBuffs: JSON.parse(row.activeBuffs || '[]'),
      offlineSnapshot: JSON.parse(row.offlineSnapshot || '{}'),
      offlineEventLog: JSON.parse(row.offlineEventLog || '[]'),
      negativeStreak: row.negativeStreak || 0,
      lastEventAt: row.lastEventAt ? Number(row.lastEventAt) || 0 : 0,
      tutorial: row.tutorial ? JSON.parse(row.tutorial) : null,
      softGuideState: row.softGuideState ? JSON.parse(row.softGuideState) : null,
      talentPolicies: row.talentPolicies ? JSON.parse(row.talentPolicies) : null,
      famousPeople: row.famousPeople ? JSON.parse(row.famousPeople) : null,
      famousPersonState: row.famousPersonState ? JSON.parse(row.famousPersonState) : null,
      taskProgress: row.taskProgress ? JSON.parse(row.taskProgress) : null,
      military: row.military ? JSON.parse(row.military) : null,
      polity: row.polity ? JSON.parse(row.polity) : null,
      territories: row.territories ? JSON.parse(row.territories) : null,
      worldMap: row.worldMap ? JSON.parse(row.worldMap) : null,
      activeCityId: row.activeCityId || null,
      cities: row.cities ? JSON.parse(row.cities) : null,
      scoutedCoordinates: row.scoutedCoordinates ? JSON.parse(row.scoutedCoordinates) : null,
      scoutState: row.scoutState ? JSON.parse(row.scoutState) : null,
      exploreMissions: row.exploreMissions ? JSON.parse(row.exploreMissions) : null,
      worldAi: row.worldAi ? JSON.parse(row.worldAi) : undefined,
      warMissions: row.warMissions ? JSON.parse(row.warMissions) : null,
      scoutReports: row.scoutReports ? JSON.parse(row.scoutReports) : null,
      updatedAt: row.updatedAt,
    };
    state.sharedWorldTerritories = this.getSharedWorldTerritories({
      excludePlayerId: state.playerId,
    });
    state.worldMap = this.worldMapAuthority.hydrateWorldMapForPlayer(
      state.playerId,
      state.worldMap,
    );
    return state;
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
        offlineEventLog, negativeStreak, lastEventAt, tutorial, softGuideState, talentPolicies,
        famousPeople, famousPersonState, taskProgress, military,
        regularEventState, threatEventState, activeBuffs, polity, territories, worldMap, activeCityId, cities,
        scoutedCoordinates, scoutState, exploreMissions, worldAi, warMissions, scoutReports, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        tutorial = excluded.tutorial,
        softGuideState = excluded.softGuideState,
        talentPolicies = excluded.talentPolicies,
        famousPeople = excluded.famousPeople,
        famousPersonState = excluded.famousPersonState,
        taskProgress = excluded.taskProgress,
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
        worldAi = excluded.worldAi,
        warMissions = excluded.warMissions,
        scoutReports = excluded.scoutReports,
        updatedAt = excluded.updatedAt
    `).run(
      gameState.playerId,
      revision,
      JSON.stringify(saveMetadata),
      JSON.stringify(gameState.resources || {}),
      JSON.stringify(gameState.buildings || {}),
      JSON.stringify(gameState.population || {}),
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
      JSON.stringify(gameState.tutorial || {}),
      JSON.stringify(gameState.softGuideState || {}),
      JSON.stringify(gameState.talentPolicies || {}),
      JSON.stringify(gameState.famousPeople || []),
      JSON.stringify(gameState.famousPersonState || {}),
      JSON.stringify(gameState.taskProgress || {}),
      JSON.stringify(gameState.military || {}),
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
      JSON.stringify(gameState.worldAi || {}),
      JSON.stringify(gameState.warMissions || []),
      JSON.stringify(gameState.scoutReports || []),
      updatedAt,
    );
  }

  saveWithinTransaction(gameState, options = {}) {
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
    this.saveSharedWorldTerritories(savedState);
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

  resetPlayerState(playerId, gameState) {
    const transaction = this.db.transaction((id, state) => {
      this.db.prepare('DELETE FROM game_states WHERE playerId = ?').run(id);
      this.db.prepare('DELETE FROM shared_world_territories WHERE ownerPlayerId = ?').run(id);
      this.worldMapAuthority.clearPlayerVisibility(id);
      return this.saveWithinTransaction({ ...(state || {}), playerId: id }, { expectedRevision: null });
    });
    const savedState = transaction(playerId, gameState);
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

  getSharedTerritoryOwner(gameState, territory) {
    if (!territory || typeof territory !== 'object') return '';
    if (territory.type === 'capital' || territory.id === 'capital') return '';
    if (typeof territory.ownerPlayerId === 'string' && territory.ownerPlayerId) return territory.ownerPlayerId;
    if (territory.owner === 'player' && territory.status === 'occupied') return gameState.playerId || '';
    return '';
  }

  saveSharedWorldTerritories(gameState) {
    const now = new Date().toISOString();
    const territories = Array.isArray(gameState?.territories) ? gameState.territories : [];
    const ownedIds = [];
    const upsert = this.db.prepare(`
      INSERT OR REPLACE INTO shared_world_territories (id, territory, ownerPlayerId, updatedAt)
      VALUES (?, ?, ?, ?)
    `);
    for (const territory of territories) {
      const ownerPlayerId = this.getSharedTerritoryOwner(gameState, territory);
      if (!ownerPlayerId) continue;
      const id = territory.id || `site_${territory.x ?? territory.q}_${territory.y ?? territory.r}`;
      if (ownerPlayerId === gameState.playerId) ownedIds.push(id);
      upsert.run(id, JSON.stringify({ ...territory, id, ownerPlayerId }), ownerPlayerId, now);
    }
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
}

module.exports = GameStateRepository;
