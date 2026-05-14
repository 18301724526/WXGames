const jwt = require('jsonwebtoken');

class AuthService {
  constructor(db, jwtSecret) {
    this.db = db;
    this.JWT_SECRET = jwtSecret;
  }

  authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Unauthorized', message: 'Token missing' });
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, { clockTolerance: 60 });
      // 校验token合法后，再确认玩家是否还存在
      const player = this.db.prepare('SELECT playerId FROM players WHERE playerId = ?').get(decoded.playerId);
      if (!player) {
        return res.status(401).json({ error: 'AccountInvalid', message: '账号已失效，请重新注册' });
      }
      req.playerId = decoded.playerId;
      req.deviceId = decoded.deviceId;
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'TokenExpired', message: '登录已过期，请重新登录' });
      if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'InvalidToken', message: 'Token格式错误或签名无效' });
      return res.status(401).json({ error: 'Unauthorized', message: err.message });
    }
  }

  generateToken(playerId, deviceId) {
    return jwt.sign({ playerId, deviceId }, this.JWT_SECRET, { expiresIn: '30d' });
  }

  getPlayerByDeviceId(deviceId) {
    const row = this.db.prepare('SELECT playerId, deviceId, token FROM players WHERE deviceId = ?').get(deviceId);
    return row || null;
  }

  registerPlayer(deviceId, getDefaultGameState, saveGameState) {
    let player = this.getPlayerByDeviceId(deviceId);
    if (!player) {
      const playerId = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const token = this.generateToken(playerId, deviceId);
      const now = new Date().toISOString();
      this.db.prepare('INSERT INTO players (playerId, deviceId, token, createdAt, lastActiveAt) VALUES (?, ?, ?, ?, ?)').run(playerId, deviceId, token, now, now);
      const gameState = getDefaultGameState(playerId);
      saveGameState(gameState);
      player = { playerId, deviceId, token };
    }
    return player;
  }

  loginPlayer(deviceId, getGameState, calculateOfflineIncome, saveGameState) {
    const player = this.getPlayerByDeviceId(deviceId);
    if (!player) return { error: 'Player not found' };
    const gameState = getGameState(player.playerId);
    if (!gameState) return { error: 'Game state not found' };
    const lastOnline = new Date(gameState.updatedAt);
    const now = new Date();
    const offlineSeconds = Math.floor((now - lastOnline) / 1000);
    let offlineIncome = null;
    if (offlineSeconds > 60) {
      offlineIncome = calculateOfflineIncome(gameState, offlineSeconds);
      gameState.resources.food += offlineIncome.food;
      gameState.resources.knowledge += offlineIncome.knowledge;
      gameState.offlineSnapshot = { timestamp: now.toISOString(), offlineSeconds, income: offlineIncome };
      saveGameState(gameState);
    }
    this.db.prepare('UPDATE players SET lastActiveAt = ? WHERE playerId = ?').run(now.toISOString(), player.playerId);
    return { playerId: player.playerId, token: player.token, gameState, offlineIncome };
  }

  resetPlayer(playerId) {
    this.db.prepare('DELETE FROM game_states WHERE playerId = ?').run(playerId);
    this.db.prepare('DELETE FROM players WHERE playerId = ?').run(playerId);
    console.log(`[Reset] Player ${playerId} data cleared`);
    return { success: true, message: '游戏数据已清空，请重新注册' };
  }
}

module.exports = AuthService;
