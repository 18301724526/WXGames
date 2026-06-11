const test = require('node:test');
const assert = require('node:assert/strict');

const SecurityConfig = require('../config/SecurityConfig');

test('SecurityConfig requires JWT_SECRET and explicit CORS origins in production', () => {
  assert.throws(
    () => SecurityConfig.resolveJwtSecret({ NODE_ENV: 'production' }),
    /JWT_SECRET is required in production/,
  );
  assert.throws(
    () => SecurityConfig.resolveCorsOptions({ NODE_ENV: 'production' }),
    /CORS_ORIGINS is required in production/,
  );
});

test('SecurityConfig keeps development runnable without wildcard production policy', () => {
  assert.equal(
    SecurityConfig.resolveJwtSecret({ NODE_ENV: 'development' }),
    SecurityConfig.DEFAULT_DEV_JWT_SECRET,
  );
  assert.deepEqual(
    SecurityConfig.resolveCorsOptions({ NODE_ENV: 'development' }),
    {
      origin: true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-World-March-Trace', 'X-Client-Request-ID'],
    },
  );
});

test('SecurityConfig parses configured origins', () => {
  assert.deepEqual(
    SecurityConfig.parseAllowedOrigins('https://a.example, https://b.example ,,'),
    ['https://a.example', 'https://b.example'],
  );
  assert.equal(
    SecurityConfig.resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'secret-1' }),
    'secret-1',
  );
  assert.deepEqual(
    SecurityConfig.resolveCorsOptions({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://game.example',
    }).origin,
    ['https://game.example'],
  );
});
