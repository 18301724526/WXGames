#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const SecurityConfig = require('../backend/config/SecurityConfig');
const OpsAuthService = require('../backend/services/OpsAuthService');
const ConfigReleaseService = require('../backend/services/config/ConfigReleaseService');
const { parseUserList } = require('../backend/middleware/adminMiddleware');

const REPORT_SCHEMA = 'wxgame-production-security-evidence-v1';
const DEFAULT_MIN_SECRET_LENGTH = 32;
const DEFAULT_COMMON_WEAK_VALUES = Object.freeze([
  '',
  'secret',
  'jwt-secret',
  'changeme',
  'password',
  'admin',
  'opsadmin',
  'civilization-fire-dev-secret',
  'civilization-fire-dev-ops-secret',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function sanitizeText(value, maxLength = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function normalizeBooleanFlag(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    envFiles: [],
    evidencePath: '',
    json: false,
    cwd: process.cwd(),
    rotationId: '',
    serverAccessOwner: '',
    deployCredentialOwner: '',
    now: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      assert(index < argv.length, `Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === '--env-file') options.envFiles.push(next());
    else if (arg === '--evidence') options.evidencePath = next();
    else if (arg === '--cwd') options.cwd = next();
    else if (arg === '--rotation-id') options.rotationId = next();
    else if (arg === '--server-access-owner') options.serverAccessOwner = next();
    else if (arg === '--deploy-credential-owner') options.deployCredentialOwner = next();
    else if (arg === '--now') options.now = new Date(next());
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function unquoteEnvValue(value) {
  const trimmed = String(value || '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvText(text) {
  const env = {};
  String(text || '').split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const separator = normalized.indexOf('=');
    if (separator <= 0) return;
    const key = normalized.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;
    env[key] = unquoteEnvValue(normalized.slice(separator + 1));
  });
  return env;
}

function loadEnvFiles(envFiles = []) {
  return envFiles.reduce((acc, filePath) => {
    const resolvedPath = path.resolve(filePath);
    const parsed = parseEnvText(fs.readFileSync(resolvedPath, 'utf8'));
    return { ...acc, ...parsed };
  }, {});
}

function mergeEnvironment(baseEnv = process.env, envFiles = []) {
  return {
    ...baseEnv,
    ...loadEnvFiles(envFiles),
  };
}

function fingerprintSecret(value) {
  const secret = String(value || '');
  if (!secret) return null;
  return `sha256:${crypto.createHash('sha256').update(secret).digest('hex').slice(0, 12)}`;
}

function summarizeSecret(value) {
  const secret = String(value || '');
  return {
    configured: secret.length > 0,
    length: secret.length,
    fingerprint: fingerprintSecret(secret),
  };
}

function isStrongSecret(value, options = {}) {
  const secret = String(value || '');
  const minLength = Number(options.minLength) || DEFAULT_MIN_SECRET_LENGTH;
  const normalized = secret.trim().toLowerCase();
  if (secret.length < minLength) return false;
  if (DEFAULT_COMMON_WEAK_VALUES.includes(normalized)) return false;
  if (new Set(secret).size < 8) return false;
  return true;
}

function check(id, ok, message, detail = undefined, severity = 'error') {
  return {
    id,
    ok: Boolean(ok),
    severity,
    message,
    detail,
  };
}

function redactRemoteUrl(remoteUrl) {
  const value = String(remoteUrl || '').trim();
  return value.replace(/\/\/([^/@:\s]+)(?::([^/@\s]*))?@/g, (_, username) => `//${username}:***@`);
}

function hasEmbeddedCredential(remoteUrl) {
  const value = String(remoteUrl || '').trim();
  return /\/\/[^/@:\s]+:[^/@\s]*@/.test(value);
}

function parseGitRemoteOutput(stdout) {
  const seen = new Map();
  String(stdout || '').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
    if (!match) return;
    const [, name, url, kind] = match;
    const key = `${name}:${kind}:${url}`;
    if (seen.has(key)) return;
    seen.set(key, {
      name,
      kind,
      url: redactRemoteUrl(url),
      embeddedCredentials: hasEmbeddedCredential(url),
    });
  });
  return Array.from(seen.values());
}

function collectGitRemotes(options = {}) {
  const env = options.env || process.env;
  const args = ['remote', '-v'];
  const gitArgs = env.REPO_GIT_DIR
    ? ['--git-dir', env.REPO_GIT_DIR, ...args]
    : args;
  const result = spawnSync('git', gitArgs, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    return {
      available: false,
      error: sanitizeText(result.stderr || result.stdout || result.error?.message || 'git remote unavailable'),
      remotes: [],
    };
  }
  return {
    available: true,
    error: '',
    remotes: parseGitRemoteOutput(result.stdout),
  };
}

function collectChecks(env, options = {}) {
  const checks = [];
  const nodeEnv = sanitizeText(env.NODE_ENV, 80).toLowerCase();
  const productionEnv = { ...env, NODE_ENV: 'production' };
  const rotationId = sanitizeText(options.rotationId || env.WXGAME_SECRET_ROTATION_ID, 120);
  const serverAccessOwner = sanitizeText(options.serverAccessOwner || env.WXGAME_SERVER_ACCESS_OWNER, 120);
  const deployCredentialOwner = sanitizeText(options.deployCredentialOwner || env.WXGAME_DEPLOY_CREDENTIAL_OWNER, 120);
  const adminUsers = parseUserList(env.ADMIN_USERS);
  const corsOrigins = SecurityConfig.parseAllowedOrigins(env.CORS_ORIGINS || env.ALLOWED_ORIGINS);
  let jwtSecret = '';
  let opsConfig = null;
  let gatePolicy = null;
  let gitRemotes = null;

  checks.push(check('node-env-production', nodeEnv === 'production', 'NODE_ENV must be production for production evidence.', { nodeEnv }));

  try {
    jwtSecret = SecurityConfig.resolveJwtSecret(productionEnv);
    checks.push(check('jwt-secret-present', true, 'JWT_SECRET is configured.'));
    checks.push(check(
      'jwt-secret-strength',
      isStrongSecret(jwtSecret),
      `JWT_SECRET must be at least ${DEFAULT_MIN_SECRET_LENGTH} chars and not a known weak/default value.`,
      summarizeSecret(jwtSecret),
    ));
  } catch (error) {
    checks.push(check('jwt-secret-present', false, error.message));
  }

  try {
    SecurityConfig.resolveCorsOptions(productionEnv);
    checks.push(check('cors-origins-present', true, 'CORS_ORIGINS is configured.'));
    checks.push(check(
      'cors-origins-restricted',
      corsOrigins.length > 0 && !corsOrigins.includes('*'),
      'CORS_ORIGINS must be explicit and must not contain wildcard origin.',
      { count: corsOrigins.length, origins: corsOrigins },
    ));
  } catch (error) {
    checks.push(check('cors-origins-present', false, error.message));
  }

  checks.push(check(
    'admin-users-explicit',
    adminUsers.length > 0,
    'ADMIN_USERS must be explicitly configured in production.',
    { count: adminUsers.length },
  ));
  if (adminUsers.includes('codexqa')) {
    checks.push(check(
      'admin-users-dev-account-review',
      false,
      'ADMIN_USERS includes codexqa; keep it only if this is an intentional named operator.',
      { count: adminUsers.length },
      'warning',
    ));
  }

  opsConfig = OpsAuthService.resolveOpsAuthConfig(productionEnv);
  checks.push(check(
    'ops-auth-configured',
    opsConfig.configured,
    'Ops admin authentication must be fully configured.',
    { missing: opsConfig.missing },
  ));
  checks.push(check(
    'ops-password-hash',
    Boolean(env.OPS_ADMIN_PASSWORD_HASH),
    'OPS_ADMIN_PASSWORD_HASH must be used for production ops login.',
  ));
  checks.push(check(
    'ops-plaintext-disabled',
    !env.OPS_ADMIN_PASSWORD && env.OPS_ALLOW_PLAINTEXT_PASSWORD !== '1',
    'Production ops login must not use plaintext OPS_ADMIN_PASSWORD or OPS_ALLOW_PLAINTEXT_PASSWORD=1.',
  ));
  checks.push(check(
    'ops-jwt-secret-explicit',
    Boolean(env.OPS_JWT_SECRET),
    'OPS_JWT_SECRET must be explicit and independent from player JWT_SECRET.',
  ));
  checks.push(check(
    'ops-jwt-secret-independent',
    Boolean(env.OPS_JWT_SECRET && jwtSecret && env.OPS_JWT_SECRET !== jwtSecret),
    'OPS_JWT_SECRET must differ from JWT_SECRET.',
    {
      jwtSecret: summarizeSecret(jwtSecret),
      opsJwtSecret: summarizeSecret(env.OPS_JWT_SECRET),
    },
  ));
  checks.push(check(
    'ops-jwt-secret-strength',
    isStrongSecret(env.OPS_JWT_SECRET),
    `OPS_JWT_SECRET must be at least ${DEFAULT_MIN_SECRET_LENGTH} chars and not a known weak/default value.`,
    summarizeSecret(env.OPS_JWT_SECRET),
  ));
  checks.push(check(
    'ops-session-version-rotated',
    Boolean((env.OPS_SESSION_VERSION || env.OPS_TOKEN_VERSION) && opsConfig.sessionVersion !== '1'),
    'OPS_SESSION_VERSION must be explicit and bumped during secret rotation so old tokens are invalidated.',
    { sessionVersion: opsConfig.sessionVersion },
  ));

  gatePolicy = ConfigReleaseService.resolveRuntimeGatePolicy(productionEnv);
  checks.push(check(
    'config-release-gate-required',
    gatePolicy.required,
    'CONFIG_RELEASE_GATE must resolve to required in production.',
    gatePolicy,
  ));

  checks.push(check(
    'rotation-id-recorded',
    Boolean(rotationId),
    'WXGAME_SECRET_ROTATION_ID or --rotation-id must be recorded with the evidence.',
    { rotationId },
  ));
  checks.push(check(
    'server-access-owner-recorded',
    Boolean(serverAccessOwner),
    'WXGAME_SERVER_ACCESS_OWNER or --server-access-owner must identify server access ownership.',
    { serverAccessOwner },
  ));
  checks.push(check(
    'deploy-credential-owner-recorded',
    Boolean(deployCredentialOwner),
    'WXGAME_DEPLOY_CREDENTIAL_OWNER or --deploy-credential-owner must identify deploy credential ownership.',
    { deployCredentialOwner },
  ));

  gitRemotes = options.gitRemotes || collectGitRemotes({ cwd: options.cwd, env });
  if (gitRemotes.available) {
    const offenders = gitRemotes.remotes.filter((remote) => remote.embeddedCredentials);
    checks.push(check(
      'git-remotes-no-embedded-passwords',
      offenders.length === 0,
      'Git remotes must not store embedded plaintext passwords.',
      { offenders },
    ));
  } else {
    checks.push(check(
      'git-remotes-no-embedded-passwords',
      false,
      'Git remotes could not be inspected; run from the deploy work tree or set REPO_GIT_DIR.',
      { error: gitRemotes.error },
      'warning',
    ));
  }

  return {
    checks,
    gitRemotes,
    rotationId,
    serverAccessOwner,
    deployCredentialOwner,
    nodeEnv,
    adminUserCount: adminUsers.length,
    corsOrigins,
    secrets: {
      jwtSecret: summarizeSecret(jwtSecret),
      opsJwtSecret: summarizeSecret(env.OPS_JWT_SECRET),
      opsPasswordHashConfigured: Boolean(env.OPS_ADMIN_PASSWORD_HASH),
      opsSessionVersion: opsConfig.sessionVersion,
    },
    gatePolicy,
    opsConfigStatus: {
      configured: opsConfig.configured,
      missing: opsConfig.missing,
      usernameConfigured: Boolean(opsConfig.username),
      sessionTtl: opsConfig.sessionTtl,
      loginMaxAttempts: opsConfig.loginMaxAttempts,
      loginWindowMs: opsConfig.loginWindowMs,
    },
  };
}

function buildReport(env, options = {}) {
  const evidence = collectChecks(env, options);
  const failedErrors = evidence.checks.filter((item) => !item.ok && item.severity === 'error');
  const warnings = evidence.checks.filter((item) => !item.ok && item.severity === 'warning');
  return {
    schema: REPORT_SCHEMA,
    generatedAt: nowIso(options.now || new Date()),
    success: failedErrors.length === 0,
    summary: {
      total: evidence.checks.length,
      failedErrors: failedErrors.length,
      warnings: warnings.length,
    },
    rotationId: evidence.rotationId,
    serverAccessOwner: evidence.serverAccessOwner,
    deployCredentialOwner: evidence.deployCredentialOwner,
    environment: {
      nodeEnv: evidence.nodeEnv,
      adminUserCount: evidence.adminUserCount,
      corsOrigins: evidence.corsOrigins,
      gatePolicy: evidence.gatePolicy,
      opsConfig: evidence.opsConfigStatus,
      secrets: evidence.secrets,
      gitRemotes: evidence.gitRemotes,
    },
    checks: evidence.checks,
  };
}

function writeEvidence(filePath, report) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(path.resolve(filePath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function printHelp() {
  console.log([
    'Usage: node scripts/verify-production-security-config.js [options]',
    '',
    'Options:',
    '  --env-file <path>                Merge environment values from a dotenv-style file',
    '  --evidence <path>                Write redacted JSON evidence to this path',
    '  --rotation-id <id>               Record the production secret rotation id',
    '  --server-access-owner <name>     Record server access ownership',
    '  --deploy-credential-owner <name> Record deploy credential ownership',
    '  --cwd <path>                     Directory used for git remote inspection',
    '  --json                          Print the full redacted report as JSON',
  ].join('\n'));
}

function main() {
  const options = parseArgs();
  if (options.help) {
    printHelp();
    return;
  }
  const env = mergeEnvironment(process.env, options.envFiles);
  const report = buildReport(env, options);
  writeEvidence(options.evidencePath || env.WXGAME_PRODUCTION_SECURITY_EVIDENCE_PATH, report);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[production-security] checks=${report.summary.total} failed=${report.summary.failedErrors} warnings=${report.summary.warnings}`);
    report.checks
      .filter((item) => !item.ok)
      .forEach((item) => console.log(`[production-security] ${item.severity}: ${item.id}: ${item.message}`));
    if (options.evidencePath || env.WXGAME_PRODUCTION_SECURITY_EVIDENCE_PATH) {
      console.log(`[production-security] evidence=${path.resolve(options.evidencePath || env.WXGAME_PRODUCTION_SECURITY_EVIDENCE_PATH)}`);
    }
  }

  if (!report.success) process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[production-security] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  REPORT_SCHEMA,
  parseArgs,
  parseEnvText,
  mergeEnvironment,
  isStrongSecret,
  redactRemoteUrl,
  hasEmbeddedCredential,
  parseGitRemoteOutput,
  collectChecks,
  buildReport,
};
