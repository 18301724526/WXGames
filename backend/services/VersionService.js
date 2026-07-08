const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_CACHE_MS = 5000;
const DEFAULT_DEPLOY_RUNNING_STALE_MS = 180000;
const IGNORED_DIRS = new Set(['.git', '.local-logs', '.trae', 'node_modules', 'logs', 'data']);
const IGNORED_EXTENSIONS = new Set([
  '.db',
  '.db-shm',
  '.db-wal',
  '.db-journal',
  '.sqlite',
  '.sqlite-shm',
  '.sqlite-wal',
  '.sqlite-journal',
  '.sqlite3',
  '.sqlite3-shm',
  '.sqlite3-wal',
  '.sqlite3-journal',
  '.bak',
  '.backup',
  '.log',
]);

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function sanitizeDeployManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return null;
  return {
    branch: manifest.branch ? String(manifest.branch) : null,
    commit: manifest.commit ? String(manifest.commit) : null,
    deployedCommit: manifest.deployedCommit ? String(manifest.deployedCommit) : (manifest.commit ? String(manifest.commit) : null),
    deployedAt: manifest.deployedAt ? String(manifest.deployedAt) : null,
    workTree: manifest.workTree ? String(manifest.workTree) : null,
    frontendPublicDir: manifest.frontendPublicDir ? String(manifest.frontendPublicDir) : null,
  };
}

function sanitizeDeployStatus(status, options = {}) {
  if (!status || typeof status !== 'object') return null;
  let normalizedStatus = String(status.status || '').trim();
  if (!['running', 'succeeded', 'failed'].includes(normalizedStatus)) return null;
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const staleMs = Math.max(0, Number(options.runningStaleMs ?? DEFAULT_DEPLOY_RUNNING_STALE_MS) || 0);
  const updatedAtMs = Date.parse(status.updatedAt || '');
  const ageMs = Number.isFinite(updatedAtMs) ? Math.max(0, nowMs - updatedAtMs) : 0;
  const staleRunning = normalizedStatus === 'running' && staleMs > 0 && ageMs >= staleMs;
  if (staleRunning) normalizedStatus = 'failed';
  const error = status.error && typeof status.error === 'object'
    ? {
      stage: status.error.stage ? String(status.error.stage) : null,
      message: status.error.message ? String(status.error.message) : null,
    }
    : (staleRunning
      ? {
        stage: status.stage ? String(status.stage) : null,
        message: `deployment status stale after ${Math.round(ageMs / 1000)}s`,
      }
      : null);
  return {
    schema: status.schema ? String(status.schema) : 'wxgame-deploy-status-v1',
    status: normalizedStatus,
    environment: status.environment ? String(status.environment) : null,
    branch: status.branch ? String(status.branch) : null,
    targetCommit: status.targetCommit ? String(status.targetCommit) : null,
    previousDeployedCommit: status.previousDeployedCommit ? String(status.previousDeployedCommit) : null,
    stage: status.stage ? String(status.stage) : null,
    startedAt: status.startedAt ? String(status.startedAt) : null,
    updatedAt: status.updatedAt ? String(status.updatedAt) : null,
    finishedAt: status.finishedAt ? String(status.finishedAt) : null,
    exitCode: Number.isFinite(Number(status.exitCode)) ? Number(status.exitCode) : null,
    logPath: status.logPath ? String(status.logPath) : null,
    recentLogLines: Array.isArray(status.recentLogLines)
      ? status.recentLogLines.slice(-20).map((line) => String(line).slice(0, 500))
      : [],
    error,
    stale: staleRunning || undefined,
  };
}

function firstExistingPath(paths) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate)) || paths[0];
}

function buildEtag(info) {
  return `"wxgame-${crypto
    .createHash('sha256')
    .update([
      info.version || '',
      info.deploymentId || '',
      info.deployedCommit || '',
      info.deployedAt || '',
      info.deployStatus?.status || '',
      info.deployStatus?.targetCommit || '',
      info.deployStatus?.stage || '',
      info.deployStatus?.updatedAt || '',
      info.deployStatus?.error?.message || '',
    ].join('|'))
    .digest('hex')
    .slice(0, 24)}"`;
}

function getPackedRef(gitDir, ref) {
  try {
    const packedRefsPath = path.join(gitDir, 'packed-refs');
    const packedRefs = fs.readFileSync(packedRefsPath, 'utf8').split(/\r?\n/);
    const matchedLine = packedRefs.find((line) => {
      if (!line || line.startsWith('#') || line.startsWith('^')) return false;
      const [hash, packedRef] = line.trim().split(/\s+/);
      return hash && packedRef === ref;
    });
    return matchedLine ? matchedLine.trim().split(/\s+/)[0] : null;
  } catch (error) {
    return null;
  }
}

function getGitCommit(repoRoot) {
  try {
    const gitDir = path.join(repoRoot, '.git');
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref:')) return head;
    const ref = head.slice(5).trim();
    const looseRefPath = path.join(gitDir, ref);
    if (fs.existsSync(looseRefPath)) return fs.readFileSync(looseRefPath, 'utf8').trim();
    return getPackedRef(gitDir, ref);
  } catch (error) {
    return null;
  }
}

function shouldIgnore(filePath, stats) {
  if (stats.isDirectory()) return IGNORED_DIRS.has(path.basename(filePath));
  if (!stats.isFile()) return true;
  const ext = path.extname(filePath).toLowerCase();
  if (IGNORED_EXTENSIONS.has(ext)) return true;
  return filePath.includes(`${path.sep}.env`);
}

function collectFileFingerprints(root, baseRoot, entries) {
  if (!fs.existsSync(root)) return;
  for (const name of fs.readdirSync(root)) {
    const filePath = path.join(root, name);
    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    if (shouldIgnore(filePath, stats)) continue;
    if (stats.isDirectory()) {
      collectFileFingerprints(filePath, baseRoot, entries);
      continue;
    }
    const contentHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    entries.push([
      path.relative(baseRoot, filePath).replace(/\\/g, '/'),
      stats.size,
      Math.floor(stats.mtimeMs),
      contentHash,
    ].join(':'));
  }
}

function createSourceHash(repoRoot) {
  const entries = [];
  for (const dir of ['frontend', 'backend', 'shared']) {
    collectFileFingerprints(path.join(repoRoot, dir), repoRoot, entries);
  }
  entries.sort();
  return crypto.createHash('sha256').update(entries.join('\n')).digest('hex');
}

class VersionService {
  constructor(options = {}) {
    this.repoRoot = options.repoRoot || path.join(__dirname, '..', '..');
    this.deployManifestPath = options.deployManifestPath || process.env.WXGAME_DEPLOY_MANIFEST_PATH || firstExistingPath([
      path.join(this.repoRoot, '.wxgame', 'current-deploy.json'),
      path.join(this.repoRoot, '.wxgame-deploy-version.json'),
    ]);
    this.deployStatusPath = options.deployStatusPath || process.env.WXGAME_DEPLOY_STATUS_PATH || firstExistingPath([
      path.join(this.repoRoot, '.wxgame', 'deploy-status.json'),
      path.join(path.dirname(this.deployManifestPath || this.repoRoot), 'deploy-status.json'),
      path.join(this.repoRoot, '.wxgame-deploy-status.json'),
    ]);
    this.cacheMs = options.cacheMs ?? DEFAULT_CACHE_MS;
    this.deployRunningStaleMs = options.deployRunningStaleMs ?? DEFAULT_DEPLOY_RUNNING_STALE_MS;
    this.now = typeof options.now === 'function' ? options.now : () => Date.now();
    this.cachedAt = 0;
    this.cachedInfo = null;
  }

  readDeployManifest() {
    return sanitizeDeployManifest(readJson(this.deployManifestPath));
  }

  readDeployStatus() {
    return sanitizeDeployStatus(readJson(this.deployStatusPath), {
      runningStaleMs: this.deployRunningStaleMs,
      nowMs: this.now(),
    });
  }

  getVersionInfo() {
    const now = this.now();
    if (this.cachedInfo && now - this.cachedAt < this.cacheMs) return this.cachedInfo;

    const packageJson = readJson(path.join(this.repoRoot, 'backend', 'package.json')) || {};
    const gitCommit = getGitCommit(this.repoRoot);
    const sourceHash = createSourceHash(this.repoRoot);
    const deployManifest = this.readDeployManifest();
    const deployStatus = this.readDeployStatus();
    const explicitVersion = process.env.APP_VERSION || process.env.GAME_VERSION || null;
    const releaseIdentity = deployManifest?.deployedCommit || deployManifest?.commit || gitCommit || 'nogit';
    const versionParts = [
      explicitVersion || packageJson.version || '0.0.0',
      releaseIdentity,
      deployManifest?.deployedAt || '',
    ];
    const deploymentId = crypto.createHash('sha256').update(versionParts.join('|')).digest('hex').slice(0, 16);

    this.cachedInfo = {
      version: explicitVersion || packageJson.version || '0.0.0',
      deploymentId,
      gitCommit,
      deployedCommit: deployManifest?.deployedCommit || deployManifest?.commit || null,
      deployedAt: deployManifest?.deployedAt || null,
      branch: deployManifest?.branch || null,
      sourceHash: sourceHash.slice(0, 16),
      checkedAt: new Date(now).toISOString(),
      deployStatus,
    };
    this.cachedInfo.etag = buildEtag(this.cachedInfo);
    this.cachedAt = now;
    return this.cachedInfo;
  }

  matchesEtag(candidate, info = this.getVersionInfo()) {
    if (!candidate) return false;
    return String(candidate)
      .split(',')
      .map((value) => value.trim())
      .includes(info.etag);
  }
}

module.exports = VersionService;
