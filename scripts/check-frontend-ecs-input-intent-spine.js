const fs = require('node:fs');
const path = require('node:path');

const { scanInputBranches } = require('./report-frontend-ecs-input-branch');

// Batch 4 blocking gate. It diffs CURRENT input-router branches against the 0B
// input-branch baseline, scoped to the covered-mode routing surface only:
// Surface === 'input-router' AND Branch Kind in {mode, runtime-route}. Net-new
// such branches in legacy router files (i.e. outside the approved ECS input
// owner, the generated runtime bundle, or the mode ownership runtime) fail the
// gate. Panel / tutorial / action branch kinds stay report-only this batch.
const BASELINE_PATH = 'docs/development_logs/2026-06-25-frontend-ecs-0b-input-branch-baseline.md';
const IN_SCOPE_SURFACE = 'input-router';
const IN_SCOPE_BRANCH_KINDS = Object.freeze(['mode', 'runtime-route']);

// Approved growth paths, mirroring the mode-ownership-spine guard. These are a
// forward-looking safety net: today report-frontend-ecs-input-branch only scans
// files whose basename matches *InputRouter.js / *ActionController.js / etc., so
// the ECS input owner, the generated bundle, and the mode runtime are never surfaced
// as input-router findings and the exemption is inert (approved-path findings: 0).
// The allowlist keeps the gate correct if the scanner's file set ever widens.
const APPROVED_INTENT_PATHS = Object.freeze(['frontend/js/ecs/input/']);
const APPROVED_RUNTIME_PATHS = Object.freeze(['frontend/js/ecs/runtime/EcsModeRuntimeBundle.js']);
const APPROVED_MODE_RUNTIME_PATHS = Object.freeze([
  'frontend/js/platform/CanvasModeOwnershipRuntime.js',
]);

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function matchesAllowlist(filePath, allowlist) {
  const normalized = normalizePath(filePath);
  return allowlist.some((allowed) =>
    allowed.endsWith('/') ? normalized.startsWith(allowed) : normalized === allowed,
  );
}

function isApprovedGrowthPath(filePath = '') {
  return (
    matchesAllowlist(filePath, APPROVED_INTENT_PATHS) ||
    matchesAllowlist(filePath, APPROVED_RUNTIME_PATHS) ||
    matchesAllowlist(filePath, APPROVED_MODE_RUNTIME_PATHS)
  );
}

function isInScopeFinding(finding = {}) {
  return finding.surface === IN_SCOPE_SURFACE && IN_SCOPE_BRANCH_KINDS.includes(finding.branchKind);
}

function keyForFinding(finding = {}) {
  return `${normalizePath(finding.file)}\0${finding.branchKind || ''}`;
}

function countByKey(findings = []) {
  const counts = new Map();
  findings.forEach((finding) => {
    const key = keyForFinding(finding);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

// The 0B input-branch baseline table is `| File | Line | Surface | Branch Kind | ... |`
// (File is the FIRST column, not a backtick-wrapped symbol), so this parser is
// intentionally different from the mode-ownership-spine baseline parser.
function parseBaselineFindings(markdown = '') {
  const lines = String(markdown || '').split(/\r?\n/);
  const startIndex = lines.findIndex((line) => /^## Findings\b/.test(line));
  const findings = [];
  if (startIndex < 0) return findings;

  lines.slice(startIndex + 1).forEach((line) => {
    const match = /^\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/.exec(line);
    if (!match) return;
    findings.push({
      file: normalizePath(match[1].trim()),
      line: Number(match[2]) || 1,
      surface: match[3].trim(),
      branchKind: match[4].trim(),
    });
  });
  return findings;
}

function loadBaselineFindings(repoRoot = process.cwd(), baselinePath = BASELINE_PATH) {
  const fullPath = path.join(repoRoot, baselinePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`input branch baseline not found: ${baselinePath}`);
  }
  return parseBaselineFindings(fs.readFileSync(fullPath, 'utf8'));
}

function makeViolation({ finding, currentCount, baselineCount }) {
  return {
    file: normalizePath(finding.file),
    line: finding.line,
    branchKind: finding.branchKind,
    symbols: finding.symbols,
    currentCount,
    baselineCount,
    evidence: finding.evidence,
    note: 'input-router mode/runtime-route routing cannot grow outside ecs/input, EcsModeRuntimeBundle, or CanvasModeOwnershipRuntime after Batch 4',
  };
}

function scanInputIntentSpine(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const baselineFindings = loadBaselineFindings(
    repoRoot,
    options.baselinePath || BASELINE_PATH,
  ).filter(isInScopeFinding);
  const currentReport = scanInputBranches({ repoRoot });
  const currentInScope = currentReport.findings.filter(isInScopeFinding);
  const currentLegacyFindings = currentInScope.filter(
    (finding) => !isApprovedGrowthPath(finding.file),
  );
  const baselineCounts = countByKey(baselineFindings);
  const currentLegacyCounts = countByKey(currentLegacyFindings);
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

  const approvedFindings = currentInScope.filter((finding) => isApprovedGrowthPath(finding.file));

  return {
    report: 'frontend-ecs-input-intent-spine',
    mode: 'blocking',
    baselinePath: options.baselinePath || BASELINE_PATH,
    inScopeSurface: IN_SCOPE_SURFACE,
    inScopeBranchKinds: IN_SCOPE_BRANCH_KINDS,
    approvedIntentPaths: APPROVED_INTENT_PATHS,
    approvedRuntimePaths: APPROVED_RUNTIME_PATHS,
    approvedModeRuntimePaths: APPROVED_MODE_RUNTIME_PATHS,
    filesScanned: currentReport.filesScanned,
    currentInScopeFindings: currentInScope.length,
    currentLegacyFindings: currentLegacyFindings.length,
    baselineInScopeFindings: baselineFindings.length,
    approvedFindings: approvedFindings.length,
    violations,
    summary: {
      totalViolations: violations.length,
    },
  };
}

function renderText(report) {
  const lines = [
    '[frontend-ecs-input-intent-spine] blocking gate',
    `baseline: ${report.baselinePath}`,
    `scope: surface=${report.inScopeSurface} branchKinds=${report.inScopeBranchKinds.join('|')}`,
    `files scanned: ${report.filesScanned}`,
    `current in-scope findings: ${report.currentInScopeFindings}`,
    `current legacy findings after approved paths: ${report.currentLegacyFindings}`,
    `baseline in-scope findings: ${report.baselineInScopeFindings}`,
    `approved-path findings: ${report.approvedFindings}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length > 0) {
    lines.push('', 'Blocked input intent routing growth:');
    report.violations.forEach((violation) => {
      lines.push(
        `- ${violation.file} ${violation.branchKind} current=${violation.currentCount} baseline=${violation.baselineCount}`,
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
    const report = scanInputIntentSpine();
    if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length > 0) process.exit(1);
  } catch (error) {
    console.error(`[frontend-ecs-input-intent-spine] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  APPROVED_INTENT_PATHS,
  APPROVED_MODE_RUNTIME_PATHS,
  APPROVED_RUNTIME_PATHS,
  BASELINE_PATH,
  IN_SCOPE_BRANCH_KINDS,
  IN_SCOPE_SURFACE,
  countByKey,
  isApprovedGrowthPath,
  isInScopeFinding,
  loadBaselineFindings,
  parseBaselineFindings,
  parseFormat,
  renderText,
  scanInputIntentSpine,
};
