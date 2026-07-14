const DEFAULT_DEV_JWT_SECRET = 'civilization-fire-dev-secret';

function parseAllowedOrigins(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveJwtSecret(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const configuredSecret = String(env.JWT_SECRET || '').trim();
  if (configuredSecret) return configuredSecret;
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return DEFAULT_DEV_JWT_SECRET;
}

function resolveCorsOptions(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const allowedOrigins = parseAllowedOrigins(env.CORS_ORIGINS || env.ALLOWED_ORIGINS);
  if (nodeEnv === 'production' && allowedOrigins.length === 0) {
    throw new Error('CORS_ORIGINS is required in production');
  }
  return {
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-World-March-Trace', 'X-Client-Request-ID'],
  };
}

module.exports = {
  DEFAULT_DEV_JWT_SECRET,
  parseAllowedOrigins,
  resolveJwtSecret,
  resolveCorsOptions,
};
