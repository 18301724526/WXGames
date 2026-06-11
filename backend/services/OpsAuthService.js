const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DEFAULT_DEV_OPS_USERNAME = 'opsadmin';
const DEFAULT_DEV_OPS_PASSWORD = 'opsadmin';
const DEFAULT_DEV_OPS_SECRET = 'civilization-fire-dev-ops-secret';
const DEFAULT_SESSION_TTL = '12h';

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function sanitizeText(value, maxLength = 200) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function safeTextEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ''), 'utf8');
  const rightBuffer = Buffer.from(String(right ?? ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    crypto.timingSafeEqual(
      crypto.createHash('sha256').update(leftBuffer).digest(),
      crypto.createHash('sha256').update(rightBuffer).digest(),
    );
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
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
  const missing = [];

  if (!username) missing.push('OPS_ADMIN_USERNAME');
  if (!passwordHash && !plaintextPassword) missing.push('OPS_ADMIN_PASSWORD_HASH');
  if (!jwtSecret) missing.push('OPS_JWT_SECRET or JWT_SECRET');
  if (production && plaintextPassword && !passwordHash && !allowPlaintextProduction) {
    missing.push('OPS_ADMIN_PASSWORD_HASH (plaintext password is disabled in production)');
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
    production,
  };
}

class OpsAuthService {
  constructor(options = {}) {
    this.env = options.env || process.env;
    this.config = options.config || resolveOpsAuthConfig(this.env);
    this.now = options.now || (() => new Date());
  }

  getConfigStatus() {
    return {
      schema: this.config.schema,
      configured: this.config.configured,
      missing: this.config.missing,
      username: this.config.username,
      sessionTtl: this.config.sessionTtl,
      production: this.config.production,
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
        iat_ms: this.now().getTime(),
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
    if (!safeTextEqual(username, this.config.username) || !this.verifyPassword(password)) {
      return {
        success: false,
        statusCode: 401,
        error: 'InvalidOpsCredentials',
        message: 'Invalid ops admin credentials.',
      };
    }

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
      if (decoded.purpose !== 'ops-admin' || username !== this.config.username) {
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
