class LogService {
  constructor(db) { this.db = db; }

  initLogTable() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playerId TEXT, deviceId TEXT, method TEXT, path TEXT,
      body TEXT, statusCode INTEGER, response TEXT,
      duration INTEGER, timestamp TEXT);
      CREATE INDEX IF NOT EXISTS idx_api_logs_player_timestamp ON api_logs(playerId, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_logs(timestamp);
      CREATE TABLE IF NOT EXISTS client_operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playerId TEXT NOT NULL,
        deviceId TEXT,
        reason TEXT,
        entryCount INTEGER,
        payload TEXT,
        timestamp TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_client_operation_logs_player_timestamp
        ON client_operation_logs(playerId, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_client_operation_logs_timestamp
        ON client_operation_logs(timestamp)`);
  }

  logApiRequest(req, res, startTime) {
    const duration = Date.now() - startTime;
    const bodyStr = req.body ? JSON.stringify(req.body).slice(0,2000) : '';
    let responseStr = '';
    const oldJson = res.json;
    res.json = function(data) {
      responseStr = JSON.stringify(data).slice(0,1000);
      res.json = oldJson;
      return oldJson.call(res, data);
    };
    res.on('finish', () => {
      try {
        this.db.prepare(`INSERT INTO api_logs (playerId, deviceId, method, path, body, statusCode, response, duration, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(req.playerId||null, req.deviceId||req.body?.deviceId||null, req.method, req.path||req.url, bodyStr, res.statusCode, responseStr, duration, new Date().toISOString());
      } catch(e) { console.error('Log error:', e.message); }
    });
  }

  logApi(playerId, deviceId, method, path, body, statusCode, response, duration) {
    const responseStr = this.stringifyForLog(this.summarizeResponse(response), 600);
    const actionMeta = this.summarizeOperation(body, response);
    const actionBody = {
      ...body,
      operationLog: actionMeta,
    };
    this.db.prepare(
      `INSERT INTO api_logs (
        playerId,
        deviceId,
        method,
        path,
        body,
        statusCode,
        response,
        duration,
        timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      playerId || null,
      deviceId || null,
      method,
      path,
      this.stringifyForLog(actionBody, 1600),
      statusCode,
      responseStr,
      duration,
      new Date().toISOString(),
    );
  }

  summarizeOperation(body = {}, response = {}) {
    const payload = body && typeof body === 'object' ? body : {};
    const result = response && typeof response === 'object' ? response : {};
    return {
      schema: 'server-operation-log-v1',
      at: new Date().toISOString(),
      requestId: payload.requestId || payload.clientRequestId || '',
      action: payload.action || '',
      target: payload.target || payload.territoryId || payload.cityId || payload.missionId || '',
      targetQ: payload.targetQ ?? payload.q ?? payload.x ?? null,
      targetR: payload.targetR ?? payload.r ?? payload.y ?? null,
      formationSlot: payload.formationSlot ?? payload.slot ?? null,
      success: result.success,
      error: result.error || '',
    };
  }

  summarizeResponse(response) {
    if (!response || typeof response !== 'object') return response || {};
    if (Array.isArray(response.logs)) {
      return {
        success: response.success !== false,
        logCount: response.logs.length,
      };
    }
    if (response.gameState && typeof response.gameState === 'object') {
      return {
        success: response.success !== false,
        message: response.message || '',
        error: response.error || '',
        action: response.action || '',
        buildingId: response.buildingId || '',
        gameState: {
          playerId: response.gameState.playerId,
          currentEra: response.gameState.currentEra,
          activeCityId: response.gameState.activeCityId,
          totalBuildings: response.gameState.totalBuildings,
        },
      };
    }
    return response;
  }

  stringifyForLog(value, maxLength = 1000) {
    if (!value) return '';
    try {
      return JSON.stringify(value).slice(0, maxLength);
    } catch (error) {
      return JSON.stringify({ error: 'LOG_STRINGIFY_FAILED', message: error.message }).slice(0, maxLength);
    }
  }

  normalizeClientOperationSnapshot(snapshot = {}) {
    const payload = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const entries = Array.isArray(payload.entries) ? payload.entries.slice(-800) : [];
    const reason = String(payload.reason || 'manual-debug').slice(0, 120);
    return {
      schema: 'client-operation-log-v1',
      exportedAt: payload.exportedAt || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      reason,
      requestId: payload.requestId || '',
      page: payload.page && typeof payload.page === 'object' ? payload.page : {},
      entryCount: entries.length,
      entries,
    };
  }

  logClientOperationSnapshot(playerId, deviceId, snapshot = {}) {
    const normalized = this.normalizeClientOperationSnapshot(snapshot);
    const timestamp = new Date().toISOString();
    const result = this.db.prepare(
      `INSERT INTO client_operation_logs (
        playerId,
        deviceId,
        reason,
        entryCount,
        payload,
        timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      playerId || '',
      deviceId || null,
      normalized.reason,
      normalized.entryCount,
      this.stringifyForLog(normalized, 240000),
      timestamp,
    );
    return {
      id: Number(result.lastInsertRowid || 0),
      reason: normalized.reason,
      entryCount: normalized.entryCount,
      timestamp,
    };
  }

  getPlayerClientOperationLogs(playerId, limit = 5) {
    const safeLimit = Math.max(1, Math.min(20, Math.floor(Number(limit) || 5)));
    return this.db.prepare(
      `SELECT id, reason, entryCount, payload, timestamp
       FROM client_operation_logs
       WHERE playerId = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
    ).all(playerId, safeLimit);
  }

  getPlayerLogs(playerId, limit=20) {
    return this.db.prepare(`SELECT method, path, body, statusCode, response, duration, timestamp FROM api_logs WHERE playerId = ? ORDER BY timestamp DESC LIMIT ?`).all(playerId, limit);
  }

  cleanupOldLogs() {
    try {
      const cutoff = new Date(Date.now() - 7*24*60*60*1000).toISOString();
      const result = this.db.prepare('DELETE FROM api_logs WHERE timestamp < ?').run(cutoff);
      if (result.changes > 0) console.log(`[Log cleanup] Removed ${result.changes} old api_logs`);
      return result.changes;
    } catch(e) { console.error('[Log cleanup error]', e.message); return 0; }
  }

  startCleanupInterval() {
    this.cleanupOldLogs();
    return setInterval(() => this.cleanupOldLogs(), 60*60*1000);
  }
}
module.exports = LogService;
