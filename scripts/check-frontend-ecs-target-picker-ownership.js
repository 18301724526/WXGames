const fs = require('node:fs');
const path = require('node:path');

const SOURCE_ROOTS = Object.freeze(['frontend/js']);
const APPROVED_PATHS = Object.freeze(['frontend/js/platform/CanvasModeOwnershipBridge.js']);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /(^|\/)vendor\//,
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

function isApprovedPath(filePath = '') {
  return APPROVED_PATHS.includes(normalizePath(filePath));
}

function isNullClear(line = '') {
  return /=\s*null\s*;?/.test(line);
}

function findTargetPickerWritesInText(filePath, text = '') {
  if (isApprovedPath(filePath)) return [];
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/^\s*\/\//.test(line)) return;
    const evidence = line.trim().replace(/\s+/g, ' ');
    if (/\bworldTargetPicker\s*=/.test(line) && !isNullClear(line)) {
      findings.push({
        file: normalizePath(filePath),
        line: index + 1,
        symbol: 'worldTargetPicker',
        evidence,
      });
    }
    if (/\bpickerOpen\s*:\s*true\b/.test(line)) {
      findings.push({
        file: normalizePath(filePath),
        line: index + 1,
        symbol: 'worldMarchTarget.pickerOpen',
        evidence,
      });
    }
  });
  return findings;
}

function scanTargetPickerOwnership(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const files = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isProductionSource)
    .sort();
  const findings = files.flatMap((file) =>
    findTargetPickerWritesInText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')),
  );
  return {
    report: 'frontend-ecs-target-picker-ownership',
    mode: 'blocking',
    filesScanned: files.length,
    approvedPaths: APPROVED_PATHS,
    violations: findings.map((finding) => ({
      ...finding,
      note: 'targetPicker modal opens must route through CanvasModeOwnershipBridge; null clears remain legacy mirror clearing',
    })),
    summary: { totalViolations: findings.length },
  };
}

function renderText(report) {
  const lines = [
    '[frontend-ecs-target-picker-ownership] blocking gate',
    `files scanned: ${report.filesScanned}`,
    `approved paths: ${report.approvedPaths.join(', ')}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length) {
    lines.push('', 'Blocked targetPicker owner growth:');
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
    const report = scanTargetPickerOwnership();
    if (parseFormat() === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length) process.exit(1);
  } catch (error) {
    console.error(`[frontend-ecs-target-picker-ownership] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  APPROVED_PATHS,
  findTargetPickerWritesInText,
  isApprovedPath,
  parseFormat,
  renderText,
  scanTargetPickerOwnership,
};
