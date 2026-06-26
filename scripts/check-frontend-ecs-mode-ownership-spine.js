const fs = require('node:fs');
const path = require('node:path');

const { scanModeOwnership } = require('./report-frontend-ecs-mode-ownership');

const BASELINE_PATH = 'docs/development_logs/2026-06-25-frontend-ecs-0a-mode-ownership-baseline.md';
const APPROVED_MODE_OWNER_PATHS = Object.freeze([
  'frontend/js/ecs/mode/',
  'frontend/js/ecs/domain/',
  'frontend/js/ecs/snapshot/',
  'frontend/js/ecs/runtime/EcsModeRuntimeBundle.js',
]);
const APPROVED_MODE_BRIDGE_PATHS = Object.freeze([
  'frontend/js/platform/CanvasModeOwnershipBridge.js',
  'frontend/js/platform/CanvasGameAppBattleScene.js',
  'frontend/js/platform/CanvasGameAppRenderingRuntime.js',
  'frontend/js/platform/CanvasGameShellRenderingRuntime.js',
]);
const APPROVED_MODE_VOCABULARY_PATHS = Object.freeze([
  'frontend/js/ecs/registry/EcsBoundaryManifest.js',
]);
const MODE_OWNER = 'frontend/js/ecs/mode/ModeWorld.js';
const LEGACY_MODE_BRIDGE = 'frontend/js/platform/CanvasModeOwnershipBridge.js';

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function isApprovedModeOwnerPath(filePath = '') {
  const normalized = normalizePath(filePath);
  return APPROVED_MODE_OWNER_PATHS.some((allowed) =>
    allowed.endsWith('/') ? normalized.startsWith(allowed) : normalized === allowed,
  );
}

function isApprovedModeBridgePath(filePath = '') {
  const normalized = normalizePath(filePath);
  return APPROVED_MODE_BRIDGE_PATHS.includes(normalized);
}

function isApprovedModeVocabularyPath(filePath = '') {
  const normalized = normalizePath(filePath);
  return APPROVED_MODE_VOCABULARY_PATHS.includes(normalized);
}

function isApprovedGrowthPath(filePath = '') {
  return (
    isApprovedModeOwnerPath(filePath) ||
    isApprovedModeBridgePath(filePath) ||
    isApprovedModeVocabularyPath(filePath)
  );
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
  const findings = [];
  if (startIndex < 0) return findings;

  lines.slice(startIndex + 1).forEach((line) => {
    const match = /^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|/.exec(line);
    if (!match) return;
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
    throw new Error(`mode ownership baseline not found: ${baselinePath}`);
  }
  return parseBaselineFindings(fs.readFileSync(fullPath, 'utf8'));
}

function makeViolation({ finding, currentCount, baselineCount }) {
  return {
    file: normalizePath(finding.file),
    line: finding.line,
    symbol: finding.symbol,
    currentCount,
    baselineCount,
    role: finding.role,
    access: finding.access,
    evidence: finding.evidence,
    note: 'mode/panel/tutorial decisions outside the ECS mode owner or approved bridge cannot grow after Batch 3',
  };
}

function scanModeOwnershipSpine(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const baselineFindings = loadBaselineFindings(repoRoot, options.baselinePath || BASELINE_PATH);
  const currentReport = scanModeOwnership({ repoRoot });
  const baselineCounts = countByFileSymbol(baselineFindings);
  const currentLegacyFindings = currentReport.findings.filter(
    (finding) => !isApprovedGrowthPath(finding.file),
  );
  const currentLegacyCounts = countByFileSymbol(currentLegacyFindings);
  const emittedKeys = new Set();
  const violations = [];

  currentLegacyFindings.forEach((finding) => {
    const key = keyForFinding(finding);
    if (emittedKeys.has(key)) return;
    emittedKeys.add(key);
    const currentCount = currentLegacyCounts.get(key) || 0;
    const baselineCount = baselineCounts.get(key) || 0;
    if (currentCount <= baselineCount) return;
    violations.push(makeViolation({ finding, currentCount, baselineCount }));
  });

  const approvedOwnerFindings = currentReport.findings.filter((finding) =>
    isApprovedModeOwnerPath(finding.file),
  );
  const approvedBridgeFindings = currentReport.findings.filter((finding) =>
    isApprovedModeBridgePath(finding.file),
  );
  const approvedVocabularyFindings = currentReport.findings.filter((finding) =>
    isApprovedModeVocabularyPath(finding.file),
  );

  return {
    report: 'frontend-ecs-mode-ownership-spine',
    mode: 'blocking',
    baselinePath: options.baselinePath || BASELINE_PATH,
    modeOwner: MODE_OWNER,
    approvedModeOwnerPaths: APPROVED_MODE_OWNER_PATHS,
    approvedBridgePaths: APPROVED_MODE_BRIDGE_PATHS,
    approvedVocabularyPaths: APPROVED_MODE_VOCABULARY_PATHS,
    legacyBridge: LEGACY_MODE_BRIDGE,
    filesScanned: currentReport.filesScanned,
    currentFindings: currentReport.summary.totalFindings,
    currentLegacyFindings: currentLegacyFindings.length,
    baselineLegacyFindings: baselineFindings.length,
    approvedOwnerFindings: approvedOwnerFindings.length,
    approvedBridgeFindings: approvedBridgeFindings.length,
    approvedVocabularyFindings: approvedVocabularyFindings.length,
    violations,
    summary: {
      totalViolations: violations.length,
      blockedLegacyKeys: violations.length,
    },
  };
}

function renderText(report) {
  const lines = [
    '[frontend-ecs-mode-ownership-spine] blocking gate',
    `mode owner: ${report.modeOwner}`,
    `legacy bridge: ${report.legacyBridge}`,
    `baseline: ${report.baselinePath}`,
    `files scanned: ${report.filesScanned}`,
    `current findings: ${report.currentFindings}`,
    `legacy findings after approved owner/bridge paths: ${report.currentLegacyFindings}`,
    `approved owner findings: ${report.approvedOwnerFindings}`,
    `approved bridge findings: ${report.approvedBridgeFindings}`,
    `approved vocabulary findings: ${report.approvedVocabularyFindings}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length > 0) {
    lines.push('', 'Blocked mode ownership growth:');
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
  if (unknown.length > 0) throw new Error(`unknown arguments: ${unknown.join(', ')}`);
  return argv.includes('--json') ? 'json' : 'text';
}

function main() {
  try {
    const format = parseFormat();
    const report = scanModeOwnershipSpine();
    if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length > 0) process.exit(1);
  } catch (error) {
    console.error(`[frontend-ecs-mode-ownership-spine] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  APPROVED_MODE_BRIDGE_PATHS,
  APPROVED_MODE_OWNER_PATHS,
  APPROVED_MODE_VOCABULARY_PATHS,
  BASELINE_PATH,
  LEGACY_MODE_BRIDGE,
  MODE_OWNER,
  countByFileSymbol,
  isApprovedGrowthPath,
  isApprovedModeBridgePath,
  isApprovedModeOwnerPath,
  isApprovedModeVocabularyPath,
  loadBaselineFindings,
  parseBaselineFindings,
  parseFormat,
  renderText,
  scanModeOwnershipSpine,
};
