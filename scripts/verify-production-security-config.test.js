const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseEnvText,
  isStrongSecret,
  redactRemoteUrl,
  hasEmbeddedCredential,
  parseGitRemoteOutput,
  buildReport,
} = require('./verify-production-security-config');

function strongSecret(prefix) {
  return `${prefix}-0123456789-abcdefghijklmnopqrstuvwxyz-ABCDEFGHIJKLMNOPQRSTUVWXYZ`;
}

function secureEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    JWT_SECRET: strongSecret('player'),
    CORS_ORIGINS: 'https://game.example',
    ADMIN_USERS: 'opsroot',
    OPS_ADMIN_USERNAME: 'opsroot',
    OPS_ADMIN_PASSWORD_HASH: '$2a$10$abcdefghijklmnopqrstuuCy9CTfh4iZztT4J4h2aRhNYaR3tTrhC',
    OPS_JWT_SECRET: strongSecret('ops'),
    OPS_SESSION_VERSION: '2026-06-12-rotate-1',
    CONFIG_RELEASE_GATE: 'required',
    WXGAME_SECRET_ROTATION_ID: 'rot-20260612-001',
    WXGAME_SERVER_ACCESS_OWNER: 'primary-host-admin',
    WXGAME_DEPLOY_CREDENTIAL_OWNER: 'git-deploy-owner',
    ...overrides,
  };
}

function cleanGitRemotes() {
  return {
    available: true,
    error: '',
    remotes: [
      {
        name: 'origin',
        kind: 'fetch',
        url: 'git@github.com:org/repo.git',
        embeddedCredentials: false,
      },
    ],
  };
}

test('parseEnvText reads dotenv style values without shell expansion', () => {
  assert.deepEqual(parseEnvText([
    '# comment',
    'export NODE_ENV=production',
    'JWT_SECRET="abc123"',
    "OPS_SESSION_VERSION='v2'",
    'INVALID LINE',
    '',
  ].join('\n')), {
    NODE_ENV: 'production',
    JWT_SECRET: 'abc123',
    OPS_SESSION_VERSION: 'v2',
  });
});

test('secret strength rejects defaults, short values, and low-variety values', () => {
  assert.equal(isStrongSecret('short-secret'), false);
  assert.equal(isStrongSecret('civilization-fire-dev-secret'), false);
  assert.equal(isStrongSecret('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), false);
  assert.equal(isStrongSecret(strongSecret('valid')), true);
});

test('git remote parsing redacts embedded passwords and flags offenders', () => {
  const remotes = parseGitRemoteOutput([
    'private\thttp://wxgame:wxgame123@example.test:3001/wxgame.git (fetch)',
    'origin\tgit@github.com:org/repo.git (push)',
  ].join('\n'));

  assert.equal(hasEmbeddedCredential('http://wxgame:wxgame123@example.test/repo.git'), true);
  assert.equal(redactRemoteUrl('http://wxgame:wxgame123@example.test/repo.git'), 'http://wxgame:***@example.test/repo.git');
  assert.equal(remotes[0].embeddedCredentials, true);
  assert.equal(remotes[0].url.includes('wxgame123'), false);
  assert.equal(remotes[1].embeddedCredentials, false);
});

test('production security report passes with strong independent configuration', () => {
  const report = buildReport(secureEnv(), {
    cwd: __dirname,
    rotationId: 'rot-cli',
    serverAccessOwner: 'server-owner-cli',
    deployCredentialOwner: 'deploy-owner-cli',
    gitRemotes: cleanGitRemotes(),
    now: new Date('2026-06-12T00:00:00.000Z'),
  });

  assert.equal(report.schema, 'wxgame-production-security-evidence-v1');
  assert.equal(report.success, true);
  assert.equal(report.rotationId, 'rot-cli');
  assert.equal(report.environment.secrets.jwtSecret.configured, true);
  assert.equal(report.environment.secrets.jwtSecret.fingerprint.startsWith('sha256:'), true);
  assert.equal(JSON.stringify(report).includes(secureEnv().JWT_SECRET), false);
  assert.equal(report.checks.find((item) => item.id === 'ops-session-version-rotated').ok, true);
});

test('production security report fails missing rotation and shared ops/player secret', () => {
  const shared = strongSecret('shared');
  const report = buildReport(secureEnv({
    JWT_SECRET: shared,
    OPS_JWT_SECRET: shared,
    OPS_SESSION_VERSION: '1',
    WXGAME_SECRET_ROTATION_ID: '',
  }), {
    cwd: __dirname,
    gitRemotes: cleanGitRemotes(),
    now: new Date('2026-06-12T00:00:00.000Z'),
  });
  const failedIds = report.checks.filter((item) => !item.ok && item.severity === 'error').map((item) => item.id);

  assert.equal(report.success, false);
  assert.equal(failedIds.includes('ops-jwt-secret-independent'), true);
  assert.equal(failedIds.includes('ops-session-version-rotated'), true);
  assert.equal(failedIds.includes('rotation-id-recorded'), true);
});

test('production security report warns when dev admin account remains configured', () => {
  const report = buildReport(secureEnv({ ADMIN_USERS: 'codexqa,opsroot' }), {
    cwd: __dirname,
    gitRemotes: cleanGitRemotes(),
    now: new Date('2026-06-12T00:00:00.000Z'),
  });
  const warning = report.checks.find((item) => item.id === 'admin-users-dev-account-review');

  assert.equal(report.success, true);
  assert.equal(warning.ok, false);
  assert.equal(warning.severity, 'warning');
});
