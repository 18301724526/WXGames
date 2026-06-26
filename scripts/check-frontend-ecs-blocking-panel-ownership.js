const fs = require('node:fs');
const path = require('node:path');

const SOURCE_ROOTS = Object.freeze(['frontend/js']);
const BASELINE_PATH = 'docs/development_logs/2026-06-25-frontend-ecs-0a-mode-ownership-baseline.md';
const APPROVED_PATHS = Object.freeze(['frontend/js/platform/CanvasModeOwnershipBridge.js']);
const GRANDFATHERED_PATHS = Object.freeze([
  'frontend/js/tutorial/TutorialGuideUiStateCoordinator.js',
]);
const BLOCKING_PANEL_SYMBOLS = Object.freeze([
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
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /(^|\/)vendor\//,
  /(^|\/)node_modules\//,
  /^frontend\/js\/ecs\/runtime\/EcsModeRuntimeBundle\.js$/,
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

function isApprovedPath(filePath = '') {
  return APPROVED_PATHS.includes(normalizePath(filePath));
}

function isGrandfatheredPath(filePath = '') {
  return GRANDFATHERED_PATHS.includes(normalizePath(filePath));
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

function parseBaselineFindings(markdown = '') {
  const lines = String(markdown || '').split(/\r?\n/);
  const startIndex = lines.findIndex((line) => /^## Findings\b/.test(line));
  const symbols = new Set(BLOCKING_PANEL_SYMBOLS);
  const findings = [];
  if (startIndex < 0) return findings;

  lines.slice(startIndex + 1).forEach((line) => {
    const match = /^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|/.exec(line);
    if (!match || !symbols.has(match[1])) return;
    findings.push({
      symbol: match[1],
      file: normalizePath(match[2].trim()),
      line: Number(match[3]) || 1,
    });
  });
  return findings;
}

function loadBaselineFindings(repoRoot = process.cwd(), baselinePath = BASELINE_PATH) {
  const fullPath = path.join(repoRoot, baselinePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`blockingPanel baseline not found: ${baselinePath}`);
  }
  return parseBaselineFindings(fs.readFileSync(fullPath, 'utf8'));
}

function stripLineComment(line = '') {
  const index = line.indexOf('//');
  return index < 0 ? line : line.slice(0, index);
}

function isTruthyShowWrite(line = '', symbol = '') {
  return new RegExp(`\\b${symbol}\\s*=\\s*true\\b`).test(line);
}

function isCommandPanelOpenWrite(line = '') {
  const match = /\bactiveCommandPanel\s*=(?!=)\s*([^;]+)/.exec(line);
  if (!match) return false;
  const value = match[1].trim();
  return !/^(['"])\1$/.test(value);
}

function isTechDetailOpenWrite(line = '') {
  return /\btechDetailOpen\s*=\s*(true\b|Boolean\s*\()/.test(line);
}

function findBlockingPanelOpensInText(filePath, text = '') {
  if (isApprovedPath(filePath) || isGrandfatheredPath(filePath)) return [];
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    if (/^\s*\/\//.test(rawLine)) return;
    const line = stripLineComment(rawLine);
    const evidence = rawLine.trim().replace(/\s+/g, ' ');
    if (!evidence) return;

    BLOCKING_PANEL_SYMBOLS.forEach((symbol) => {
      let matched = false;
      if (symbol.startsWith('show')) matched = isTruthyShowWrite(line, symbol);
      else if (symbol === 'activeCommandPanel') matched = isCommandPanelOpenWrite(line);
      else if (symbol === 'techDetailOpen') matched = isTechDetailOpenWrite(line);
      if (!matched) return;
      findings.push({
        file: normalizePath(filePath),
        line: index + 1,
        symbol,
        evidence,
      });
    });
  });
  return findings;
}

function makeViolation({ finding, currentCount, baselineCount }) {
  return {
    ...finding,
    currentCount,
    baselineCount,
    note: 'blockingPanel canonical opens must route through CanvasModeOwnershipBridge; legacy clears and baseline opens remain grandfathered',
  };
}

function scanBlockingPanelOwnership(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const baselineFindings = loadBaselineFindings(repoRoot, options.baselinePath || BASELINE_PATH);
  const baselineCounts = countByFileSymbol(baselineFindings);
  const files = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isProductionSource)
    .sort();
  const findings = files.flatMap((file) =>
    findBlockingPanelOpensInText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')),
  );
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

  return {
    report: 'frontend-ecs-blocking-panel-ownership',
    mode: 'blocking',
    baselinePath: options.baselinePath || BASELINE_PATH,
    symbols: BLOCKING_PANEL_SYMBOLS,
    approvedPaths: APPROVED_PATHS,
    grandfatheredPaths: GRANDFATHERED_PATHS,
    filesScanned: files.length,
    baselineFindings: baselineFindings.length,
    currentFindings: findings.length,
    violations,
    summary: { totalViolations: violations.length },
  };
}

function renderText(report) {
  const lines = [
    '[frontend-ecs-blocking-panel-ownership] blocking gate',
    `baseline: ${report.baselinePath}`,
    `files scanned: ${report.filesScanned}`,
    `approved paths: ${report.approvedPaths.join(', ')}`,
    `grandfathered paths: ${report.grandfatheredPaths.join(', ')}`,
    `baseline findings: ${report.baselineFindings}`,
    `current findings: ${report.currentFindings}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length) {
    lines.push('', 'Blocked blockingPanel owner growth:');
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
    const report = scanBlockingPanelOwnership();
    if (parseFormat() === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length) process.exit(1);
  } catch (error) {
    console.error(`[frontend-ecs-blocking-panel-ownership] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  APPROVED_PATHS,
  BASELINE_PATH,
  BLOCKING_PANEL_SYMBOLS,
  GRANDFATHERED_PATHS,
  countByFileSymbol,
  findBlockingPanelOpensInText,
  isApprovedPath,
  isGrandfatheredPath,
  loadBaselineFindings,
  parseBaselineFindings,
  parseFormat,
  renderText,
  scanBlockingPanelOwnership,
};
