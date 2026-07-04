const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const ACCOUNT_WHITELIST = Object.freeze({
  test1: '123456',
  test2: '123456',
  test3: '123456',
  codexqa: '123456',
});
const DEFAULT_BOT_ACCOUNT_COUNT = 0;
const MAX_BOT_ACCOUNT_COUNT = 50000;
const DEFAULT_AUTH_PLAYER_CACHE_TTL_MS = 60 * 1000;
const SESSION_TOKEN_HASH_PREFIX = 'sha256:';

function parseBotAccountCount(value) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_BOT_ACCOUNT_COUNT;
  return Math.min(number, MAX_BOT_ACCOUNT_COUNT);
}

function isBotAccountsEnabled(env = process.env) {
  return env.ENABLE_BOT_ACCOUNTS === '1' || env.ENABLE_LOAD_TEST_BOTS === '1';
}

function getBotAccountId(username) {
  const match = String(username || '').match(/^bot(\d{5})$/);
  return match ? Number(match[1]) : 0;
}

class AuthService {
  constructor(db, jwtSecret, options = {}) {
    this.db = db;
    this.JWT_SECRET = jwtSecret;
    this.env = options.env || process.env;
    this.botAccountCount = isBotAccountsEnabled(this.env)
      ? parseBotAccountCount(this.env.BOT_ACCOUNT_COUNT || this.env.LOAD_TEST_BOT_COUNT)
      : 0;
    this.botAccountPassword = String(this.env.BOT_ACCOUNT_PASSWORD || '');
    this.now = options.now || (() => new Date());
    this.authPlayerCacheTtlMs = Math.max(
      0,
      Math.floor(Number(options.authPlayerCacheTtlMs ?? this.env.AUTH_PLAYER_CACHE_TTL_MS ?? DEFAULT_AUTH_PLAYER_CACHE_TTL_MS)) || 0,
    );
    this.authPlayerCache = new Map();
  }

  normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
  }

  isWhitelisted(username) {
    if (Object.prototype.hasOwnProperty.call(ACCOUNT_WHITELIST, username)) return true;
    const botId = getBotAccountId(username);
    return botId > 0 && botId <= this.botAccountCount;
  }

  isPasswordValid(username, password) {
    if (Object.prototype.hasOwnProperty.call(ACCOUNT_WHITELIST, username)) {
      return ACCOUNT_WHITELIST[username] === String(password || '');
    }
    const botId = getBotAccountId(username);
    return botId > 0
      && botId <= this.botAccountCount
      && Boolean(this.botAccountPassword)
      && this.botAccountPassword === String(password || '');
  }

  getNowMs() {
    const now = this.now();
    const stamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
    return Number.isFinite(stamp) ? stamp : Date.now();
  }

  hasCachedPlayer(playerId, nowMs = this.getNowMs()) {
    if (this.authPlayerCacheTtlMs <= 0) return false;
    const cached = this.authPlayerCache.get(playerId);
    return Boolean(cached && cached.expiresAtMs > nowMs);
  }

  cachePlayer(playerId, nowMs = this.getNowMs()) {
    if (this.authPlayerCacheTtlMs <= 0) return;
    this.authPlayerCache.set(playerId, { expiresAtMs: nowMs + this.authPlayerCacheTtlMs });
  }

  playerExists(playerId) {
    const normalizedPlayerId = String(playerId || '');
    if (!normalizedPlayerId) return false;
    const nowMs = this.getNowMs();
    if (this.hasCachedPlayer(normalizedPlayerId, nowMs)) return true;
    const player = this.db.prepare('SELECT playerId FROM players WHERE playerId = ?').get(normalizedPlayerId);
    if (!player) {
      this.authPlayerCache.delete(normalizedPlayerId);
      return false;
    }
    this.cachePlayer(normalizedPlayerId, nowMs);
    return true;
  }

  hashToken(token) {
    return `${SESSION_TOKEN_HASH_PREFIX}${crypto.createHash('sha256').update(String(token || '')).digest('hex')}`;
  }

  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  isStoredTokenMatch(storedToken, presentedToken) {
    if (!storedToken || !presentedToken) return false;
    const stored = String(storedToken);
    if (stored.startsWith(SESSION_TOKEN_HASH_PREFIX)) {
      const expected = this.hashToken(presentedToken);
      if (stored.length !== expected.length) return false;
      return crypto.timingSafeEqual(
        Buffer.from(stored),
        Buffer.from(expected),
      );
    }
    return stored === presentedToken;
  }

  getPlayerSession(playerId) {
    const row = this.db.prepare('SELECT playerId, token FROM players WHERE playerId = ?').get(playerId);
    return row || null;
  }

  isCurrentSessionToken(playerId, token) {
    const player = this.getPlayerSession(playerId);
    if (!player) return { exists: false, current: false };
    return { exists: true, current: this.isStoredTokenMatch(player.token, token) };
  }

  authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Unauthorized', message: '登录凭证缺失，请重新登录' });
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, { clockTolerance: 60 });
      const username = this.normalizeUsername(decoded.username || decoded.playerId);
      if (!this.isWhitelisted(username)) {
        return res.status(401).json({ error: 'AccountNotAllowed', message: '该账号不在白名单中' });
      }
      const session = this.isCurrentSessionToken(decoded.playerId, token);
      if (!session.exists) {
        this.authPlayerCache.delete(String(decoded.playerId || ''));
        return res.status(401).json({ error: 'AccountInvalid', message: '账号已失效，请重新登录' });
      }
      if (!session.current) {
        return res.status(401).json({ error: 'SESSION_REPLACED', message: '账号已在其他设备登录，请重新登录' });
      }
      this.cachePlayer(decoded.playerId);
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

  generateToken(playerId, username, options = {}) {
    const sessionId = options.sessionId || this.generateSessionId();
    return jwt.sign({ playerId, username, sessionId }, this.JWT_SECRET, { expiresIn: '30d' });
  }

  getPlayerByPlayerId(playerId) {
    const row = this.db.prepare('SELECT playerId, deviceId, token FROM players WHERE playerId = ?').get(playerId);
    return row || null;
  }

  ensureWhitelistPlayer(username, getDefaultGameState, saveGameState) {
    const playerId = username;
    const deviceId = `whitelist:${username}`;
    const token = this.generateToken(playerId, username);
    const tokenHash = this.hashToken(token);
    const now = new Date().toISOString();
    let player = this.getPlayerByPlayerId(playerId);
    if (!player) {
      this.db.prepare('INSERT INTO players (playerId, deviceId, token, createdAt, lastActiveAt) VALUES (?, ?, ?, ?, ?)').run(playerId, deviceId, tokenHash, now, now);
      saveGameState(getDefaultGameState(playerId));
      player = { playerId, deviceId, token };
    } else {
      this.db.prepare('UPDATE players SET deviceId = ?, token = ?, lastActiveAt = ? WHERE playerId = ?').run(deviceId, tokenHash, now, playerId);
      player = { ...player, deviceId, token };
      if (!this.db.prepare('SELECT playerId FROM game_states WHERE playerId = ?').get(playerId)) {
        saveGameState(getDefaultGameState(playerId));
      }
    }
    this.cachePlayer(playerId);
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
    if (!gameState) return { error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在，请重新登录' };
    const lastOnline = new Date(gameState.updatedAt);
    const now = new Date();
    const offlineSeconds = Math.floor((now - lastOnline) / 1000);
    let offlineIncome = null;
    if (offlineSeconds > 60) {
      offlineIncome = calculateOfflineIncome(gameState, offlineSeconds);
      gameState.offlineSnapshot = { timestamp: now.toISOString(), offlineSeconds, income: offlineIncome };
    }
    saveGameState(gameState);
    this.db.prepare('UPDATE players SET lastActiveAt = ? WHERE playerId = ?').run(now.toISOString(), player.playerId);
    return { playerId: player.playerId, username, token: player.token, gameState, offlineIncome };
  }

  resetPlayer(playerId, getDefaultGameState, saveGameState, resetGameState) {
    const gameState = getDefaultGameState(playerId);
    if (typeof resetGameState === 'function') {
      resetGameState(playerId, gameState);
    } else {
      this.db.transaction(() => {
        this.db.prepare('DELETE FROM game_states WHERE playerId = ?').run(playerId);
        this.db.prepare('DELETE FROM shared_world_territories WHERE ownerPlayerId = ?').run(playerId);
        saveGameState(gameState);
      })();
    }
    console.log(`[Reset] Player ${playerId} progress reset`);
    return { success: true, message: '游戏进度已重置', gameState };
  }

  getAllowedUsernames() {
    const staticAccounts = Object.keys(ACCOUNT_WHITELIST);
    if (!this.botAccountCount) return staticAccounts;
    return [
      ...staticAccounts,
      `bot00001..bot${String(this.botAccountCount).padStart(5, '0')}`,
    ];
  }
}

module.exports = AuthService;
