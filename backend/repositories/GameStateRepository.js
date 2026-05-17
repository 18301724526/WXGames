class GameStateRepository {
  constructor(db) {
    this.db = db;
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
        military TEXT,
        polity TEXT,
        territories TEXT,
        warMissions TEXT,
        updatedAt TEXT
      );
    `);

    const columns = this.db.prepare("PRAGMA table_info(game_states)").all();
    if (!columns.some((column) => column.name === 'tutorial')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN tutorial TEXT').run();
    }
    if (!columns.some((column) => column.name === 'softGuideState')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN softGuideState TEXT').run();
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
    if (!columns.some((column) => column.name === 'warMissions')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN warMissions TEXT').run();
    }
  }

  findByPlayerId(playerId) {
    const row = this.db.prepare('SELECT * FROM game_states WHERE playerId = ?').get(playerId);
    if (!row) return null;
    return {
      playerId: row.playerId,
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
      military: row.military ? JSON.parse(row.military) : null,
      polity: row.polity ? JSON.parse(row.polity) : null,
      territories: row.territories ? JSON.parse(row.territories) : null,
      warMissions: row.warMissions ? JSON.parse(row.warMissions) : null,
      updatedAt: row.updatedAt,
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

  save(gameState) {
    this.db.prepare(`
      INSERT OR REPLACE INTO game_states (
        playerId, resources, buildings, population, techs, techEffects, currentEra,
        eraHistory, happiness, gameDay, eventQueue, eventHistory, offlineSnapshot,
        offlineEventLog, negativeStreak, lastEventAt, tutorial, softGuideState, military,
        regularEventState, threatEventState, activeBuffs, polity, territories, warMissions, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      gameState.playerId,
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
      JSON.stringify(gameState.military || {}),
      JSON.stringify(gameState.regularEventState || {}),
      JSON.stringify(gameState.threatEventState || {}),
      JSON.stringify(gameState.activeBuffs || []),
      JSON.stringify(gameState.polity || {}),
      JSON.stringify(gameState.territories || []),
      JSON.stringify(gameState.warMissions || []),
      new Date().toISOString(),
    );
  }

  touchPlayerActiveAt(playerId) {
    this.db.prepare('UPDATE players SET lastActiveAt = ? WHERE playerId = ?').run(new Date().toISOString(), playerId);
  }
}

module.exports = GameStateRepository;
