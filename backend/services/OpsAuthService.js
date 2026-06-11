const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DEFAULT_DEV_OPS_USERNAME = 'opsadmin';
const DEFAULT_DEV_OPS_PASSWORD = 'opsadmin';
const DEFAULT_DEV_OPS_SECRET = 'civilization-fire-dev-ops-secret';
const DEFAULT_SESSION_TTL = '12h';
const DEFAULT_SESSION_VERSION = '1';
const DEFAULT_LOGIN_MAX_ATTEMPTS = 5;
const DEFAULT_LOGIN_WINDOW_MS = 15 * 60 * 1000;

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function sanitizeText(value, maxLength = 200) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function safeTextEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ''), 'utf8');
  const rightBuffer = Buffer.from(String(right ?? ''), 'utf8');
  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    crypto.timingSafeEqual(
      crypto.createHash('sha256').update(leftBuffer).digest(),
      crypto.createHash('sha256').update(rightBuffer).digest(),
    );
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parsePositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function isWeakPlaintextPassword(password, username) {
  const value = String(password || '');
  const normalized = value.trim().toLowerCase();
  if (value.length < 14) return true;
  return [
    DEFAULT_DEV_OPS_PASSWORD,
    'password',
    'admin',
    'administrator',
    'changeme',
    normalizeUsername(username),
  ].filter(Boolean).includes(normalized);
}

function isWeakSecret(secret) {
  const value = String(secret || '');
  const normalized = value.trim().toLowerCase();
  if (value.length < 32) return true;
  return [
    DEFAULT_DEV_OPS_SECRET,
    'secret',
    'jwt-secret',
    'changeme',
  ].includes(normalized);
}

function resolveJwtSecret(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const configured = String(env.OPS_JWT_SECRET || env.JWT_SECRET || '').trim();
  if (configured) return configured;
  return nodeEnv === 'production' ? '' : DEFAULT_DEV_OPS_SECRET;
}

function resolveOpsAuthConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const production = nodeEnv === 'production';
  const username = normalizeUsername(env.OPS_ADMIN_USERNAME || (!production ? DEFAULT_DEV_OPS_USERNAME : ''));
  const passwordHash = String(env.OPS_ADMIN_PASSWORD_HASH || '').trim();
  const plaintextPassword = String(env.OPS_ADMIN_PASSWORD || (!production ? DEFAULT_DEV_OPS_PASSWORD : ''));
  const allowPlaintextProduction = env.OPS_ALLOW_PLAINTEXT_PASSWORD === '1';
  const jwtSecret = resolveJwtSecret(env);
  const sessionTtl = sanitizeText(env.OPS_SESSION_TTL || DEFAULT_SESSION_TTL, 32);
  const sessionVersion = sanitizeText(env.OPS_SESSION_VERSION || env.OPS_TOKEN_VERSION || DEFAULT_SESSION_VERSION, 80);
  const loginMaxAttempts = parsePositiveInteger(env.OPS_LOGIN_MAX_ATTEMPTS, DEFAULT_LOGIN_MAX_ATTEMPTS, 50);
  const loginWindowMs = parsePositiveInteger(env.OPS_LOGIN_WINDOW_MS, DEFAULT_LOGIN_WINDOW_MS, 60 * 60 * 1000);
  const missing = [];

  if (!username) missing.push('OPS_ADMIN_USERNAME');
  if (!passwordHash && !plaintextPassword) missing.push('OPS_ADMIN_PASSWORD_HASH');
  if (!jwtSecret) missing.push('OPS_JWT_SECRET or JWT_SECRET');
  if (production && isWeakSecret(jwtSecret)) {
    missing.push('OPS_JWT_SECRET or JWT_SECRET (weak secret is disabled in production)');
  }
  if (production && plaintextPassword && !passwordHash && !allowPlaintextProduction) {
    missing.push('OPS_ADMIN_PASSWORD_HASH (plaintext password is disabled in production)');
  }
  if (production && plaintextPassword && !passwordHash && allowPlaintextProduction
    && isWeakPlaintextPassword(plaintextPassword, username)) {
    missing.push('OPS_ADMIN_PASSWORD_HASH (weak plaintext password is disabled in production)');
  }

  return {
    schema: 'ops-auth-config-v1',
    configured: missing.length === 0,
    missing,
    username,
    passwordHash,
    plaintextPassword: passwordHash ? '' : plaintextPassword,
    jwtSecret,
    sessionTtl,
    sessionVersion,
    loginMaxAttempts,
    loginWindowMs,
    production,
  };
}

class OpsAuthService {
  constructor(options = {}) {
    this.env = options.env || process.env;
    this.config = options.config || resolveOpsAuthConfig(this.env);
    this.now = options.now || (() => new Date());
    this.failedLogins = new Map();
  }

  getConfigStatus() {
    return {
      schema: this.config.schema,
      configured: this.config.configured,
      missing: this.config.missing,
      username: this.config.username,
      sessionTtl: this.config.sessionTtl,
      sessionVersion: this.config.sessionVersion,
      loginMaxAttempts: this.config.loginMaxAttempts,
      loginWindowMs: this.config.loginWindowMs,
      production: this.config.production,
    };
  }

  getNowMs() {
    const now = this.now();
    return now instanceof Date ? now.getTime() : new Date(now).getTime();
  }

  getRateLimitKey(input = {}) {
    const username = normalizeUsername(input.username) || 'unknown';
    const clientIp = sanitizeText(input.clientIp || input.ip || '', 80) || 'unknown-ip';
    return `${username}|${clientIp}`;
  }

  getRateLimitState(key, nowMs = this.getNowMs()) {
    const state = this.failedLogins.get(key);
    if (!state) return { limited: false, retryAfterMs: 0 };
    if (state.lockedUntil && state.lockedUntil > nowMs) {
      return { limited: true, retryAfterMs: state.lockedUntil - nowMs };
    }
    if ((nowMs - state.firstFailedAt) > this.config.loginWindowMs) {
      this.failedLogins.delete(key);
      return { limited: false, retryAfterMs: 0 };
    }
    return { limited: false, retryAfterMs: 0 };
  }

  registerFailedLogin(key, nowMs = this.getNowMs()) {
    const existing = this.failedLogins.get(key);
    const expired = !existing || (nowMs - existing.firstFailedAt) > this.config.loginWindowMs;
    const state = expired
      ? { firstFailedAt: nowMs, count: 0, lockedUntil: 0 }
      : existing;
    state.count += 1;
    if (state.count >= this.config.loginMaxAttempts) {
      state.lockedUntil = nowMs + this.config.loginWindowMs;
    }
    this.failedLogins.set(key, state);
    return {
      count: state.count,
      locked: Boolean(state.lockedUntil && state.lockedUntil > nowMs),
      retryAfterMs: state.lockedUntil && state.lockedUntil > nowMs ? state.lockedUntil - nowMs : 0,
    };
  }

  verifyPassword(password) {
    if (!this.config.configured) return false;
    if (this.config.passwordHash) {
      return bcrypt.compareSync(String(password || ''), this.config.passwordHash);
    }
    return safeTextEqual(password, this.config.plaintextPassword);
  }

  generateToken(username) {
    return jwt.sign(
      {
        purpose: 'ops-admin',
        username: normalizeUsername(username),
        tokenVersion: this.config.sessionVersion,
        iat_ms: this.getNowMs(),
      },
      this.config.jwtSecret,
      { expiresIn: this.config.sessionTtl },
    );
  }

  login(input = {}) {
    if (!this.config.configured) {
      return {
        success: false,
        statusCode: 503,
        error: 'OpsAuthNotConfigured',
        message: 'Ops admin authentication is not configured.',
        config: this.getConfigStatus(),
      };
    }

    const username = normalizeUsername(input.username);
    const password = String(input.password || '');
    const rateLimitKey = this.getRateLimitKey(input);
    const rateLimit = this.getRateLimitState(rateLimitKey);
    if (rateLimit.limited) {
      return {
        success: false,
        statusCode: 429,
        error: 'OpsLoginRateLimited',
        message: 'Too many failed ops login attempts.',
        retryAfterSeconds: Math.ceil(rateLimit.retryAfterMs / 1000),
      };
    }

    if (!safeTextEqual(username, this.config.username) || !this.verifyPassword(password)) {
      const failure = this.registerFailedLogin(rateLimitKey);
      return {
        success: false,
        statusCode: failure.locked ? 429 : 401,
        error: failure.locked ? 'OpsLoginRateLimited' : 'InvalidOpsCredentials',
        message: failure.locked ? 'Too many failed ops login attempts.' : 'Invalid ops admin credentials.',
        retryAfterSeconds: failure.locked ? Math.ceil(failure.retryAfterMs / 1000) : undefined,
      };
    }

    this.failedLogins.delete(rateLimitKey);
    return {
      success: true,
      schema: 'ops-admin-session-v1',
      token: this.generateToken(username),
      tokenType: 'Bearer',
      expiresIn: this.config.sessionTtl,
      operator: {
        username,
        role: 'ops-admin',
      },
    };
  }

  authMiddleware(req, res, next) {
    if (!this.config.configured) {
      return res.status(503).json({
        error: 'OpsAuthNotConfigured',
        message: 'Ops admin authentication is not configured.',
        config: this.getConfigStatus(),
      });
    }

    const authHeader = req.headers?.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ error: 'OpsUnauthorized', message: 'Ops token missing' });
    }

    try {
      const decoded = jwt.verify(token, this.config.jwtSecret, { clockTolerance: 30 });
      const username = normalizeUsername(decoded.username);
      const tokenVersion = sanitizeText(decoded.tokenVersion || decoded.sessionVersion || '', 80);
      if (decoded.purpose !== 'ops-admin' || username !== this.config.username
        || tokenVersion !== this.config.sessionVersion) {
        return res.status(401).json({ error: 'InvalidOpsToken', message: 'Ops token is invalid' });
      }
      req.opsAdminUser = username;
      req.adminUser = username;
      return next();
    } catch (error) {
      const expired = error.name === 'TokenExpiredError';
      return res.status(401).json({
        error: expired ? 'OpsTokenExpired' : 'InvalidOpsToken',
        message: expired ? 'Ops token expired' : 'Ops token is invalid',
      });
    }
  }
}

module.exports = OpsAuthService;
module.exports.DEFAULT_DEV_OPS_USERNAME = DEFAULT_DEV_OPS_USERNAME;
module.exports.DEFAULT_DEV_OPS_PASSWORD = DEFAULT_DEV_OPS_PASSWORD;
module.exports.resolveOpsAuthConfig = resolveOpsAuthConfig;
module.exports.normalizeUsername = normalizeUsername;
