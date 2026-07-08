const fs = require('node:fs');
const path = require('node:path');

const SOURCE_ROOTS = Object.freeze(['frontend/js', 'frontend/minigame']);
const ENTRY_FILES = Object.freeze(['frontend/index.html', 'frontend/minigame/game.js']);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /(^|\/)vendor\//,
  /(^|\/)node_modules\//,
]);
const RETIRED_LAYER_NAME = ['do', 'main'].join('');
const RETIRED_PATH_SEGMENT = `/${RETIRED_LAYER_NAME}/`;
const RETIRED_REQUIRE_PATTERNS = Object.freeze([
  new RegExp(`require\\(['"][^'"]*/${RETIRED_LAYER_NAME}/`),
  new RegExp(`from\\s+['"][^'"]*/${RETIRED_LAYER_NAME}/`),
  new RegExp(`src=["'][^"']*/${RETIRED_LAYER_NAME}/`),
]);
const RETIRED_MODEL_TOKEN = `${'Do'}${'main'}`;
const RETIRED_SYMBOL_PATTERNS = Object.freeze([
  new RegExp(`\\b${RETIRED_MODEL_TOKEN}Namespace\\b`),
  new RegExp(`\\b[A-Za-z_$][\\w$]*${RETIRED_MODEL_TOKEN}Owner\\b`),
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

function isProductionFile(filePath = '') {
  const normalized = normalizePath(filePath);
  if (!/\.(js|html)$/.test(normalized)) return false;
  if (!SOURCE_ROOTS.some((root) => normalized.startsWith(`${root}/`))) return false;
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function findRetiredLayerReferencesInText(filePath, text = '') {
  const normalized = normalizePath(filePath);
  const findings = [];
  if (
    normalized.includes(RETIRED_PATH_SEGMENT) ||
    normalized.startsWith(`frontend/js/${RETIRED_LAYER_NAME}/`)
  ) {
    findings.push({
      file: normalized,
      line: 1,
      kind: 'retired-path',
      evidence: normalized,
    });
  }
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const evidence = rawLine.trim().replace(/\s+/g, ' ');
    if (!evidence) return;
    if (RETIRED_REQUIRE_PATTERNS.some((pattern) => pattern.test(rawLine))) {
      findings.push({
        file: normalized,
        line: index + 1,
        kind: 'retired-import',
        evidence,
      });
    }
    if (RETIRED_SYMBOL_PATTERNS.some((pattern) => pattern.test(rawLine))) {
      findings.push({
        file: normalized,
        line: index + 1,
        kind: 'retired-symbol',
        evidence,
      });
    }
  });
  return findings;
}

function scanFrontendEcsSourceLayout(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const sourceFiles = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isProductionFile);
  const entryFiles = ENTRY_FILES.filter((file) => fs.existsSync(path.join(repoRoot, file)));
  const files = Array.from(new Set([...sourceFiles, ...entryFiles])).sort();
  const violations = files.flatMap((file) =>
    findRetiredLayerReferencesInText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')),
  );
  return {
    report: 'frontend-ecs-source-layout',
    mode: 'blocking',
    retiredLayerName: 'retired',
    filesScanned: files.length,
    violations: violations.map((violation) => ({
      ...violation,
      note: 'runtime gameplay/data derivation must live in ECS modules; the retired layer cannot remain as a source path or dependency',
    })),
    summary: { totalViolations: violations.length },
  };
}

function renderText(report) {
  const lines = [
    '[frontend-ecs-source-layout] blocking gate',
    `retired layer: ${report.retiredLayerName}`,
    `files scanned: ${report.filesScanned}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length) {
    lines.push('', 'Blocked retired layer references:');
    report.violations.forEach((violation) => {
      lines.push(`- ${violation.file}:${violation.line} ${violation.kind}: ${violation.evidence}`);
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
    const report = scanFrontendEcsSourceLayout();
    if (parseFormat() === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length) process.exit(1);
  } catch (error) {
    console.error(`[frontend-ecs-source-layout] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  ENTRY_FILES,
  RETIRED_LAYER_NAME,
  RETIRED_SYMBOL_PATTERNS,
  findRetiredLayerReferencesInText,
  isProductionFile,
  parseFormat,
  renderText,
  scanFrontendEcsSourceLayout,
};
