const fs = require('node:fs');
const path = require('node:path');

// Blocking gate: tutorial-state / tutorial-advance construction has a single
// source of truth. P2 collapsed three drifted advance copies (MilitaryService,
// WorldExplorerTutorial, TaskCenterService) onto TutorialProgression.manualAdvance;
// every consumer now CALLS the canonical advance instead of hand-building a new
// tutorial state. The signature of a re-introduced copy is constructing the
// `phaseCompleted:` phase mask in an object literal. That construction is allowed
// only inside backend/services/tutorial/ (TutorialProgression builds it via
// manualAdvance, TutorialState builds it via createInitial/normalize). Anywhere
// else it means someone re-rolled tutorial advance -> gate red, pointing them at
// TutorialProgression.manualAdvance (surfaced as TutorialService.manualAdvance).
const SOURCE_ROOTS = Object.freeze(['backend']);
const CANONICAL = 'backend/services/tutorial/TutorialProgression.js';

// Directory prefix permitted to construct the tutorial phaseCompleted mask:
const ALLOWLIST_DIR_PREFIXES = Object.freeze(['backend/services/tutorial/']);

// `phaseCompleted:` as an object-literal key (line-start or after `{`/`,`).
// A member read (`tutorial.phaseCompleted`) or ternary value (`? a.phaseCompleted : b`)
// is preceded by `.` and never matches.
const FORBIDDEN_PATTERN = /(^|[{,])\s*phaseCompleted\s*:/;

const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
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

function isScannableSource(filePath = '') {
  const normalized = normalizePath(filePath);
  if (!normalized.endsWith('.js')) return false;
  if (!SOURCE_ROOTS.some((root) => normalized.startsWith(`${root}/`))) return false;
  if (ALLOWLIST_DIR_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function findTutorialStateConstructionsInText(filePath, text = '') {
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

function scanTutorialAdvanceSingleSource(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const files = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isScannableSource)
    .sort();
  const findings = files.flatMap((file) =>
    findTutorialStateConstructionsInText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')),
  );
  return {
    report: 'tutorial-advance-single-source',
    mode: 'blocking',
    canonical: CANONICAL,
    allowlist: ALLOWLIST_DIR_PREFIXES,
    filesScanned: files.length,
    violations: findings.map((finding) => ({
      ...finding,
      note: 'hand-built phaseCompleted = a re-rolled tutorial advance; call TutorialProgression.manualAdvance (or TutorialService.manualAdvance) instead of constructing tutorial state outside backend/services/tutorial/',
    })),
    summary: { totalViolations: findings.length },
  };
}

function renderText(report) {
  const lines = [
    '[tutorial-advance-single-source] blocking gate',
    `canonical: ${report.canonical}`,
    `allowlist: ${report.allowlist.join(', ')}`,
    `files scanned: ${report.filesScanned}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length) {
    lines.push('', 'Blocked tutorial-state constructions outside the canonical tutorial modules:');
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
    const report = scanTutorialAdvanceSingleSource();
    if (parseFormat() === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length) process.exit(1);
  } catch (error) {
    console.error(`[tutorial-advance-single-source] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  ALLOWLIST_DIR_PREFIXES,
  CANONICAL,
  FORBIDDEN_PATTERN,
  findTutorialStateConstructionsInText,
  isScannableSource,
  parseFormat,
  renderText,
  scanTutorialAdvanceSingleSource,
};
