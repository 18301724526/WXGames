const fs = require('node:fs');
const path = require('node:path');

const FRONTEND_SOURCE_ROOT = 'frontend/js';
const BASELINE_PATH = 'docs/development_logs/2026-06-25-frontend-ecs-batch-6a-snapshot-boundary.md';
const APPROVED_PATHS = Object.freeze([
  'frontend/js/ecs/snapshot/RendererSnapshotBoundary.js',
  'frontend/js/platform/CanvasModeOwnershipBridge.js',
  'frontend/js/ecs/runtime/EcsModeRuntimeBundle.js',
]);
const COVERED_SYMBOLS = Object.freeze([
  'naming',
  'activeEventId',
  'rewardReveal',
  'confirmDialog',
  'territoryUiState',
  'showSettings',
  'showLogs',
  'showResourceDetails',
  'showCitySwitcher',
  'showSubcityList',
  'showCityManagement',
  'showAdvisor',
  'showTaskCenter',
  'showGuidebook',
  'showFamousPersons',
  'activeCommandPanel',
  'techDetailOpen',
]);
const RENDERER_FILE_PATTERN =
  /(Renderer|RenderingRuntime|RenderPipeline|Layer|Cache|WorldMapRuntime)/;
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /\.test\.js$/,
  /\.contract\.test\.js$/,
]);

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function isProductionFrontendSource(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized.startsWith(`${FRONTEND_SOURCE_ROOT}/`)) return false;
  if (!normalized.endsWith('.js')) return false;
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isRendererSnapshotSurface(filePath) {
  const normalized = normalizePath(filePath);
  if (!isProductionFrontendSource(normalized)) return false;
  if (/frontend\/js\/platform\/renderers\//.test(normalized)) return true;
  return RENDERER_FILE_PATTERN.test(path.basename(normalized));
}

function isApprovedPath(filePath = '') {
  return APPROVED_PATHS.includes(normalizePath(filePath));
}

function keyForFinding(finding = {}) {
  return `${normalizePath(finding.file)}\0${finding.symbol || ''}`;
}

function countByFileSymbol(findings = []) {
  const counts = new Map();
  findings.forEach((finding) => {
    const key = keyForFinding(finding);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

function parseBaselineCounts(markdown = '') {
  const lines = String(markdown || '').split(/\r?\n/);
  const startIndex = lines.findIndex((line) => /^## Guard Baseline\b/.test(line));
  const counts = new Map();
  if (startIndex < 0) return counts;

  lines.slice(startIndex + 1).forEach((line) => {
    const match = /^\|\s*`([^`]+)`\s*\|\s*`?([^`|]+)`?\s*\|\s*(\d+)\s*\|/.exec(line);
    if (!match || !COVERED_SYMBOLS.includes(match[1])) return;
    const key = `${normalizePath(match[2].trim())}\0${match[1]}`;
    counts.set(key, Number(match[3]) || 0);
  });
  return counts;
}

function loadBaselineCounts(repoRoot = process.cwd(), baselinePath = BASELINE_PATH) {
  const fullPath = path.join(repoRoot, baselinePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`renderer snapshot boundary baseline not found: ${baselinePath}`);
  }
  return parseBaselineCounts(fs.readFileSync(fullPath, 'utf8'));
}

function stripLineComment(line = '') {
  const index = line.indexOf('//');
  return index < 0 ? line : line.slice(0, index);
}

function isSkippableLine(line = '') {
  return /^\s*\/\//.test(line) || /^\s*\*/.test(line);
}

function isWriteAccess(line = '', matchIndex = 0, matchText = '') {
  const before = line.slice(0, matchIndex);
  const after = line.slice(matchIndex + matchText.length);
  if (/(?:\+\+|--)\s*$/.test(before)) return true;
  return /^\s*(=(?!=|>)|\+=|-=|\*=|\/=|%=|\|\|=|&&=|\?\?=|\+\+|--)/.test(after);
}

function findRendererSnapshotReadsInText(filePath, text = '') {
  if (!isRendererSnapshotSurface(filePath) || isApprovedPath(filePath)) return [];
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    if (isSkippableLine(rawLine)) return;
    const line = stripLineComment(rawLine);
    const evidence = rawLine.trim().replace(/\s+/g, ' ');
    if (!evidence) return;

    COVERED_SYMBOLS.forEach((symbol) => {
      const pattern = new RegExp(
        `\\b(?:this|[A-Za-z_$][\\w$]*)\\??\\.${escapeRegExp(symbol)}\\b`,
        'g',
      );
      for (const match of line.matchAll(pattern)) {
        if (isWriteAccess(line, match.index || 0, match[0])) continue;
        findings.push({
          file: normalizePath(filePath),
          line: index + 1,
          symbol,
          expression: match[0],
          evidence,
        });
      }
    });
  });

  return findings;
}

function collectCurrentFindings(repoRoot = process.cwd()) {
  const sourceRoot = path.join(repoRoot, FRONTEND_SOURCE_ROOT);
  if (!fs.existsSync(sourceRoot))
    throw new Error(`frontend source root not found: ${FRONTEND_SOURCE_ROOT}`);
  const files = collectFiles(sourceRoot)
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isRendererSnapshotSurface)
    .sort();
  const findings = files.flatMap((file) =>
    findRendererSnapshotReadsInText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')),
  );
  return { files, findings };
}

function makeViolation({ finding, currentCount, baselineCount }) {
  return {
    ...finding,
    currentCount,
    baselineCount,
    note: 'renderer reads of sealed modal/panel facts must move through the renderer snapshot boundary; current baseline reads are grandfathered for Batch 6A',
  };
}

function scanRendererSnapshotBoundary(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const { files, findings } = collectCurrentFindings(repoRoot);
  const baselineCounts = loadBaselineCounts(repoRoot, options.baselinePath || BASELINE_PATH);
  const currentCounts = countByFileSymbol(findings);
  const emittedKeys = new Set();
  const violations = [];

  findings.forEach((finding) => {
    const key = keyForFinding(finding);
    if (emittedKeys.has(key)) return;
    emittedKeys.add(key);
    const currentCount = currentCounts.get(key) || 0;
    const baselineCount = baselineCounts.get(key) || 0;
    if (currentCount <= baselineCount) return;
    violations.push(makeViolation({ finding, currentCount, baselineCount }));
  });

  const baselineTotal = Array.from(baselineCounts.values()).reduce((sum, count) => sum + count, 0);

  return {
    report: 'frontend-ecs-renderer-snapshot-boundary',
    mode: 'blocking',
    baselinePath: options.baselinePath || BASELINE_PATH,
    sourceRoot: FRONTEND_SOURCE_ROOT,
    symbols: COVERED_SYMBOLS,
    approvedPaths: APPROVED_PATHS,
    filesScanned: files.length,
    baselineFindings: baselineTotal,
    currentFindings: findings.length,
    violations,
    summary: { totalViolations: violations.length },
  };
}

function renderText(report) {
  const lines = [
    '[frontend-ecs-renderer-snapshot-boundary] blocking gate',
    `baseline: ${report.baselinePath}`,
    `source root: ${report.sourceRoot}`,
    `files scanned: ${report.filesScanned}`,
    `approved paths: ${report.approvedPaths.join(', ')}`,
    `baseline findings: ${report.baselineFindings}`,
    `current findings: ${report.currentFindings}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length) {
    lines.push('', 'Blocked renderer snapshot boundary growth:');
    report.violations.forEach((violation) => {
      lines.push(
        `- ${violation.file}:${violation.line} ${violation.symbol} current=${violation.currentCount} baseline=${violation.baselineCount}: ${violation.evidence}`,
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
    const report = scanRendererSnapshotBoundary();
    if (parseFormat() === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length) process.exit(1);
  } catch (error) {
    console.error(`[frontend-ecs-renderer-snapshot-boundary] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  APPROVED_PATHS,
  BASELINE_PATH,
  COVERED_SYMBOLS,
  collectCurrentFindings,
  countByFileSymbol,
  findRendererSnapshotReadsInText,
  isApprovedPath,
  isRendererSnapshotSurface,
  loadBaselineCounts,
  parseBaselineCounts,
  parseFormat,
  renderText,
  scanRendererSnapshotBoundary,
};
