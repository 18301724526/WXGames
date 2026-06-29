const fs = require('node:fs');
const path = require('node:path');

const SOURCE_ROOTS = Object.freeze(['frontend/js']);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /(^|\/)vendor\//,
  /(^|\/)node_modules\//,
]);
const APPROVED_PATHS = Object.freeze([
  'frontend/js/ecs/projection/FogProjection.js',
  'frontend/js/ecs/runtime/EcsModeRuntimeBundle.js',
  'frontend/js/platform/CanvasGameShellWorldMapLayerRuntime.js',
]);
const RETIRED_SYMBOLS = Object.freeze([
  'lastWorldFogContext',
  'renderWorldTileFogMask',
  'WorldMapFogMaskContextRenderer',
]);

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
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

function scanFogOwner(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const files = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => normalizePath(path.relative(repoRoot, filePath)))
    .filter(isProductionSource)
    .filter((filePath) => !APPROVED_PATHS.includes(filePath))
    .sort();
  const violations = [];
  files.forEach((file) => {
    const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    RETIRED_SYMBOLS.forEach((symbol) => {
      if (!text.includes(symbol)) return;
      violations.push({
        file,
        symbol,
        note: 'fog state belongs to FogOwner; world-map renderer fog context handoff is retired',
      });
    });
  });
  return {
    report: 'frontend-ecs-fog-owner',
    mode: 'blocking',
    filesScanned: files.length,
    approvedPaths: APPROVED_PATHS,
    retiredSymbols: RETIRED_SYMBOLS,
    violations,
    summary: { totalViolations: violations.length },
  };
}

function renderText(report) {
  const lines = [
    '[frontend-ecs-fog-owner] blocking gate',
    `files scanned: ${report.filesScanned}`,
    `approved paths: ${report.approvedPaths.join(', ')}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length) {
    lines.push('', 'Blocked fog owner regressions:');
    report.violations.forEach((violation) => {
      lines.push(`- ${violation.file} ${violation.symbol}`);
      lines.push(`  ${violation.note}`);
    });
  } else {
    lines.push('passed');
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const report = scanFogOwner();
  process.stdout.write(renderText(report));
  if (report.violations.length) process.exit(1);
}

if (require.main === module) main();

module.exports = {
  APPROVED_PATHS,
  RETIRED_SYMBOLS,
  renderText,
  scanFogOwner,
};
