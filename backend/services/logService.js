class LogService {
  constructor(db) { this.db = db; }

  initLogTable() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playerId TEXT, deviceId TEXT, method TEXT, path TEXT,
      body TEXT, statusCode INTEGER, response TEXT,
      duration INTEGER, timestamp TEXT)`);
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
    const bodyStr = body ? JSON.stringify(body).slice(0, 2000) : '';
    const responseStr = response ? JSON.stringify(response).slice(0, 1000) : '';
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
      bodyStr,
      statusCode,
      responseStr,
      duration,
      new Date().toISOString(),
    );
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
