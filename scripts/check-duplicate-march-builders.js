const fs = require('node:fs');
const path = require('node:path');

// Blocking gate: world-march route geometry has ONE source of truth — shared/worldMarchCore.js
// (buildLinearMarchRoute / buildAxisAlignedRoute / evaluateLinearMarchRoute). Every caller — the
// server planner (WorldExplorerRoutePlanner.buildManualRoute), the client preview policy
// (WorldMarchRoutePolicy), and the client optimistic builder (MarchCommandBuilder.buildLinearRoute)
// — MUST delegate to it, never re-implement the q/r stepping. A hand-written stepping loop is
// exactly what silently diverged the client's optimistic route (diagonal) from the server's
// authoritative route (grid-axis staircase) and rubber-banded marching units: the tests, lint,
// and other gates all passed because none of them detect a *duplicated algorithm*. This gate is
// that missing detector — the tell-tale of a copied march stepper is the `remainingQ`/`remainingR`
// accumulator pair (or a re-defined route-builder function). Its presence outside the canonical
// source turns the gate red and points the author back to the single source.
const SOURCE_ROOTS = Object.freeze(['frontend/js', 'backend/services', 'shared']);
const CANONICAL = 'shared/worldMarchCore.js';

// Paths permitted to implement the march stepping loop directly:
const ALLOWLIST = Object.freeze([
  'shared/worldMarchCore.js', // the single source of march route geometry
]);

// The signature of a copied march route stepper is the `remainingQ` / `remainingR` delta
// accumulator pair — the exact tuple the canonical worldMarchCore stepper uses and the one the
// diverged MarchCommandBuilder.buildLinearRoute carried. A thin wrapper that DELEGATES to
// WorldMarchCore (e.g. the optimistic entry point) is fine and must NOT trip — only the copied
// stepping loop does. Matching the accumulator pair (not the function name) is what distinguishes
// a duplicated algorithm from a legitimate delegating caller.
const FORBIDDEN_PATTERNS = Object.freeze([
  {
    pattern: /\bremaining[QR]\b/,
    note: 'bespoke q/r march stepping loop; delegate to WorldMarchCore.evaluateLinearMarchRoute({ axisAligned: true, ... }) — the single source the server planner and client preview also use — instead of re-implementing the stepping (this is what diverged optimistic vs authoritative routes and rubber-banded units)',
  },
]);

const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  // Generated ECS runtime bundle: a derived artifact that bundles the already-guarded canonical
  // shared/worldMarchCore.js. The source is guarded; the bundle is rebuilt from it.
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

function findBespokeMarchBuildersInText(filePath, text = '') {
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    for (const { pattern, note } of FORBIDDEN_PATTERNS) {
      if (!pattern.test(rawLine)) continue;
      findings.push({
        file: normalizePath(filePath),
        line: index + 1,
        evidence: rawLine.trim().replace(/\s+/g, ' ').slice(0, 200),
        note,
      });
      break;
    }
  });
  return findings;
}

function scanDuplicateMarchBuilders(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const files = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isScannableSource)
    .sort();
  const findings = files.flatMap((file) =>
    findBespokeMarchBuildersInText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')),
  );
  return {
    report: 'duplicate-march-builders',
    mode: 'blocking',
    canonical: CANONICAL,
    allowlist: ALLOWLIST,
    filesScanned: files.length,
    violations: findings,
    summary: { totalViolations: findings.length },
  };
}

function renderText(report) {
  const lines = [
    '[duplicate-march-builders] blocking gate',
    `canonical: ${report.canonical}`,
    `allowlist: ${report.allowlist.join(', ')}`,
    `files scanned: ${report.filesScanned}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length) {
    lines.push('', 'Blocked bespoke march route builders:');
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
    const report = scanDuplicateMarchBuilders();
    if (parseFormat() === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length) process.exit(1);
  } catch (error) {
    console.error(`[duplicate-march-builders] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  ALLOWLIST,
  CANONICAL,
  FORBIDDEN_PATTERNS,
  findBespokeMarchBuildersInText,
  isScannableSource,
  parseFormat,
  renderText,
  scanDuplicateMarchBuilders,
};
