const jwt = require('jsonwebtoken');
const MilitaryService = require('./MilitaryService');

const ACCOUNT_WHITELIST = Object.freeze({
  test1: '123456',
  test2: '123456',
  test3: '123456',
});

class AuthService {
  constructor(db, jwtSecret) {
    this.db = db;
    this.JWT_SECRET = jwtSecret;
  }

  normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
  }

  isWhitelisted(username) {
    return Object.prototype.hasOwnProperty.call(ACCOUNT_WHITELIST, username);
  }

  isPasswordValid(username, password) {
    return this.isWhitelisted(username) && ACCOUNT_WHITELIST[username] === String(password || '');
  }

  authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Unauthorized', message: 'Token missing' });
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, { clockTolerance: 60 });
      const username = this.normalizeUsername(decoded.username || decoded.playerId);
      if (!this.isWhitelisted(username)) {
        return res.status(401).json({ error: 'AccountNotAllowed', message: '该账号不在白名单中' });
      }
      // 校验token合法后，再确认玩家是否还存在
      const player = this.db.prepare('SELECT playerId FROM players WHERE playerId = ?').get(decoded.playerId);
      if (!player) {
        return res.status(401).json({ error: 'AccountInvalid', message: '账号已失效，请重新登录' });
      }
      req.playerId = decoded.playerId;
      req.username = username;
      req.deviceId = username;
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'TokenExpired', message: '登录已过期，请重新登录' });
      if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'InvalidToken', message: 'Token格式错误或签名无效' });
      return res.status(401).json({ error: 'Unauthorized', message: err.message });
    }
  }

  generateToken(playerId, username) {
    return jwt.sign({ playerId, username }, this.JWT_SECRET, { expiresIn: '30d' });
  }

  getPlayerByPlayerId(playerId) {
    const row = this.db.prepare('SELECT playerId, deviceId, token FROM players WHERE playerId = ?').get(playerId);
    return row || null;
  }

  ensureWhitelistPlayer(username, getDefaultGameState, saveGameState) {
    const playerId = username;
    const deviceId = `whitelist:${username}`;
    const token = this.generateToken(playerId, username);
    const now = new Date().toISOString();
    let player = this.getPlayerByPlayerId(playerId);
    if (!player) {
      this.db.prepare('INSERT INTO players (playerId, deviceId, token, createdAt, lastActiveAt) VALUES (?, ?, ?, ?, ?)').run(playerId, deviceId, token, now, now);
      saveGameState(getDefaultGameState(playerId));
      player = { playerId, deviceId, token };
    } else {
      this.db.prepare('UPDATE players SET deviceId = ?, token = ?, lastActiveAt = ? WHERE playerId = ?').run(deviceId, token, now, playerId);
      player = { ...player, deviceId, token };
      if (!this.db.prepare('SELECT playerId FROM game_states WHERE playerId = ?').get(playerId)) {
        saveGameState(getDefaultGameState(playerId));
      }
    }
    return player;
  }

  loginPlayer(usernameInput, password, getGameState, calculateOfflineIncome, saveGameState, getDefaultGameState) {
    const username = this.normalizeUsername(usernameInput);
    if (!this.isWhitelisted(username)) {
      return { error: 'ACCOUNT_NOT_ALLOWED', message: '该账号不在白名单中' };
    }
    if (!this.isPasswordValid(username, password)) {
      return { error: 'INVALID_CREDENTIALS', message: '用户名或密码错误' };
    }
    const player = this.ensureWhitelistPlayer(username, getDefaultGameState, saveGameState);
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
      gameState.resources.wood += offlineIncome.wood;
      MilitaryService.advanceTraining(gameState, offlineSeconds);
      gameState.offlineSnapshot = { timestamp: now.toISOString(), offlineSeconds, income: offlineIncome };
      saveGameState(gameState);
    }
    this.db.prepare('UPDATE players SET lastActiveAt = ? WHERE playerId = ?').run(now.toISOString(), player.playerId);
    return { playerId: player.playerId, username, token: player.token, gameState, offlineIncome };
  }

  resetPlayer(playerId, getDefaultGameState, saveGameState) {
    this.db.prepare('DELETE FROM game_states WHERE playerId = ?').run(playerId);
    const gameState = getDefaultGameState(playerId);
    saveGameState(gameState);
    console.log(`[Reset] Player ${playerId} progress reset`);
    return { success: true, message: '游戏进度已重置', gameState };
  }

  getAllowedUsernames() {
    return Object.keys(ACCOUNT_WHITELIST);
  }
}

module.exports = AuthService;
