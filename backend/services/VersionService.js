const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_CACHE_MS = 5000;
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
    this.cacheMs = options.cacheMs ?? DEFAULT_CACHE_MS;
    this.cachedAt = 0;
    this.cachedInfo = null;
  }

  getVersionInfo() {
    const now = Date.now();
    if (this.cachedInfo && now - this.cachedAt < this.cacheMs) return this.cachedInfo;

    const packageJson = readJson(path.join(this.repoRoot, 'backend', 'package.json')) || {};
    const gitCommit = getGitCommit(this.repoRoot);
    const sourceHash = createSourceHash(this.repoRoot);
    const explicitVersion = process.env.APP_VERSION || process.env.GAME_VERSION || null;
    const versionParts = [
      explicitVersion || packageJson.version || '0.0.0',
      gitCommit || 'nogit',
      sourceHash,
    ];
    const deploymentId = crypto.createHash('sha256').update(versionParts.join('|')).digest('hex').slice(0, 16);

    this.cachedInfo = {
      version: explicitVersion || packageJson.version || '0.0.0',
      deploymentId,
      gitCommit,
      sourceHash: sourceHash.slice(0, 16),
      checkedAt: new Date(now).toISOString(),
    };
    this.cachedAt = now;
    return this.cachedInfo;
  }
}

module.exports = VersionService;
