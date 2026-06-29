const fs = require('node:fs');
const path = require('node:path');

// Blocking gate: the `tile_<x>_<y>` tileId string format has a single source of
// truth per layer. P1 Cluster 2 collapsed ~30 frontend inline copies; the backend
// worldMap/territory copies were then collapsed onto WorldMapTopology.getTileId and
// the dead territory fallbacks removed. Everything in scope must REFERENCE a canonical
// source -- frontend: TileCoord.tileId / TileCoord.normalizeCoord; backend worldMap:
// WorldMapTopology.getTileId; march family: WorldMarchCore.tileId -- never re-build the
// `tile_${...}_${...}` literal. A re-introduced inline format -- the signature of a
// copied coordinate normalizer -- turns the gate red and points the author at the
// canonical. This is the lock against the mirror disease re-spreading, not a substitute
// for the (already done) deletion. Out of scope by design: trace/debug variants
// (deliberately non-floored, e.g. gameRoutes.getTraceTileId), one-off scripts, lab tools.
const SOURCE_ROOTS = Object.freeze(['frontend/js', 'backend/services', 'shared']);
const CANONICAL = 'frontend/js/ecs/foundation/TileCoord.js';

// Paths permitted to construct the `tile_<x>_<y>` format -- the honest variant sources:
const ALLOWLIST = Object.freeze([
  'frontend/js/ecs/foundation/TileCoord.js', // frontend canonical world-map tileId (TileCoord.tileId)
  'frontend/js/shared/WorldMarchCoreAdapter.js', // frontend march family source; loads before TileCoord
  'frontend/js/debug/WorldMarchTrace.js', // frontend debug trace keys, deliberately NON-floored
  'backend/services/worldMap/WorldMapTopology.js', // backend worldMap/territory canonical (getTileId)
  'shared/worldMarchCore.js', // shared march family canonical (worldMarchCore.tileId)
]);

// The tileId format: `tile_${...}_${...}`. Only ever appears as a tileId construction.
const FORBIDDEN_PATTERN = /tile_\$\{/;

const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  // Generated ECS runtime bundle: a derived artifact that bundles already-guarded canonical
  // sources (e.g. ecs/foundation/TileCoord.js). The source files are guarded individually.
  /(^|\/)ecs\/runtime\//,
]);

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function toPosixRelative(filePath, repoRoot = process.cwd()) {
  return normalizePath(path.relative(repoRoot, filePath));
}

function collectFiles(root, files = []) {
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'vendor') continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) collectFiles(entryPath, files);
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function isScannableSource(filePath = '') {
  const normalized = normalizePath(filePath);
  if (!normalized.endsWith('.js')) return false;
  if (!SOURCE_ROOTS.some((root) => normalized.startsWith(`${root}/`))) return false;
  if (ALLOWLIST.includes(normalized)) return false;
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function findInlineTileIdFormatsInText(filePath, text = '') {
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    if (!FORBIDDEN_PATTERN.test(rawLine)) return;
    findings.push({
      file: normalizePath(filePath),
      line: index + 1,
      evidence: rawLine.trim().replace(/\s+/g, ' ').slice(0, 200),
    });
  });
  return findings;
}

function scanDuplicateCoordHelpers(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const files = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isScannableSource)
    .sort();
  const findings = files.flatMap((file) =>
    findInlineTileIdFormatsInText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')),
  );
  return {
    report: 'duplicate-coord-helpers',
    mode: 'blocking',
    canonical: CANONICAL,
    allowlist: ALLOWLIST,
    filesScanned: files.length,
    violations: findings.map((finding) => ({
      ...finding,
      note: 'inline tile_<x>_<y> format is duplicated coordinate logic; reference a canonical tileId source (frontend TileCoord.tileId/normalizeCoord, backend WorldMapTopology.getTileId, or WorldMarchCore for the march family) instead of re-building the literal',
    })),
    summary: { totalViolations: findings.length },
  };
}

function renderText(report) {
  const lines = [
    '[duplicate-coord-helpers] blocking gate',
    `canonical: ${report.canonical}`,
    `allowlist: ${report.allowlist.join(', ')}`,
    `files scanned: ${report.filesScanned}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length) {
    lines.push('', 'Blocked inline tileId-format constructions:');
    report.violations.forEach((violation) => {
      lines.push(`- ${violation.file}:${violation.line} ${violation.evidence}`);
      lines.push(`  ${violation.note}`);
    });
  } else {
    lines.push('passed');
  }
  return `${lines.join('\n')}\n`;
}

function parseFormat(argv = process.argv.slice(2)) {
  const unknown = argv.filter((arg) => arg !== '--json');
  if (unknown.length) throw new Error(`unknown arguments: ${unknown.join(', ')}`);
  return argv.includes('--json') ? 'json' : 'text';
}

function main() {
  try {
    const report = scanDuplicateCoordHelpers();
    if (parseFormat() === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length) process.exit(1);
  } catch (error) {
    console.error(`[duplicate-coord-helpers] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  ALLOWLIST,
  CANONICAL,
  FORBIDDEN_PATTERN,
  findInlineTileIdFormatsInText,
  isScannableSource,
  parseFormat,
  renderText,
  scanDuplicateCoordHelpers,
};
