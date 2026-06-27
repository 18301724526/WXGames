const fs = require('node:fs');
const path = require('node:path');

// Blocking gate: small generic helpers have a single source of truth in shared/.
// This guard forbids any local re-definition of them under backend/ -- a re-copied
// helper turns the gate red and points the author at the canonical module.
// (frontend/ keeps its copies for now: it has no bundler yet. shared/ self-defines
// the canonicals. Both are separate, later slices.)
const SOURCE_ROOTS = Object.freeze(['backend']);
const CANONICAL_BY_HELPER = Object.freeze({
  toNumber: 'shared/numberUtils.js',
  toInteger: 'shared/numberUtils.js',
  toNonNegativeInteger: 'shared/numberUtils.js',
  clamp: 'shared/numberUtils.js',
  clone: 'shared/objectUtils.js',
  cloneIfObject: 'shared/objectUtils.js',
  isPlainObject: 'shared/objectUtils.js',
  nowIso: 'shared/timeUtils.js',
});
const HELPERS = Object.freeze(Object.keys(CANONICAL_BY_HELPER));
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /\.contract\.test\.js$/,
  /(^|\/)node_modules\//,
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
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) collectFiles(entryPath, files);
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function isProductionSource(filePath = '') {
  const normalized = normalizePath(filePath);
  if (!normalized.endsWith('.js')) return false;
  if (!SOURCE_ROOTS.some((root) => normalized.startsWith(`${root}/`))) return false;
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function findDuplicateSharedHelperDefsInText(filePath, text = '') {
  const findings = [];
  const pattern = new RegExp(`\\bfunction\\s+(${HELPERS.join('|')})\\s*\\(`);
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    if (/^\s*\/\//.test(rawLine) || /^\s*\*/.test(rawLine)) return;
    const match = pattern.exec(rawLine);
    if (!match) return;
    findings.push({
      file: normalizePath(filePath),
      line: index + 1,
      symbol: match[1],
      evidence: rawLine.trim().replace(/\s+/g, ' '),
    });
  });
  return findings;
}

function scanDuplicateSharedHelpers(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const files = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isProductionSource)
    .sort();
  const findings = files.flatMap((file) =>
    findDuplicateSharedHelperDefsInText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')),
  );
  return {
    report: 'duplicate-shared-helpers',
    mode: 'blocking',
    canonicalByHelper: CANONICAL_BY_HELPER,
    helpers: HELPERS,
    filesScanned: files.length,
    violations: findings.map((finding) => ({
      ...finding,
      note: `${finding.symbol} has a single source of truth in ${CANONICAL_BY_HELPER[finding.symbol]}; require it (const { ${finding.symbol} } = require('<...>/${CANONICAL_BY_HELPER[finding.symbol].replace(/^shared\//, 'shared/')}')) instead of defining a local copy`,
    })),
    summary: { totalViolations: findings.length },
  };
}

function renderText(report) {
  const lines = [
    '[duplicate-shared-helpers] blocking gate',
    `helpers: ${report.helpers.join(', ')}`,
    `files scanned: ${report.filesScanned}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length) {
    lines.push('', 'Blocked duplicate shared-helper definitions:');
    report.violations.forEach((violation) => {
      lines.push(
        `- ${violation.file}:${violation.line} ${violation.symbol}: ${violation.evidence}`,
      );
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
    const report = scanDuplicateSharedHelpers();
    if (parseFormat() === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length) process.exit(1);
  } catch (error) {
    console.error(`[duplicate-shared-helpers] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  CANONICAL_BY_HELPER,
  HELPERS,
  findDuplicateSharedHelperDefsInText,
  parseFormat,
  renderText,
  scanDuplicateSharedHelpers,
};
