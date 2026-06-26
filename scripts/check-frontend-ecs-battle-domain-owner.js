const fs = require('node:fs');
const path = require('node:path');

const SOURCE_ROOTS = Object.freeze(['frontend/js']);
const APPROVED_PATHS = Object.freeze([
  'frontend/js/ecs/domain/BattleDomainOwner.js',
  'frontend/js/ecs/snapshot/RendererSnapshotBoundary.js',
  'frontend/js/platform/CanvasGameAppBattleScene.js',
  'frontend/js/ecs/runtime/EcsModeRuntimeBundle.js',
]);
const GRANDFATHERED_PATHS = Object.freeze([
  // entityBattle remains a live mutable gameplay/session mirror after 7B; the
  // removed App/Shell battleScene mirror is never grandfathered.
]);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /(^|\/)vendor\//,
  /(^|\/)node_modules\//,
]);
const BATTLE_SYMBOLS = Object.freeze(['battleScene', 'entityBattle']);
const LIVE_MIRROR_WRITE_SYMBOLS = Object.freeze(['entityBattle']);

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

function stripLineComment(line = '') {
  const index = line.indexOf('//');
  return index < 0 ? line : line.slice(0, index);
}

function findBattleDomainWritesInText(filePath, text = '') {
  if (isApprovedPath(filePath) || isGrandfatheredPath(filePath)) return [];
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    if (/^\s*\/\//.test(rawLine)) return;
    const line = stripLineComment(rawLine);
    const evidence = rawLine.trim().replace(/\s+/g, ' ');
    if (!evidence) return;
    LIVE_MIRROR_WRITE_SYMBOLS.forEach((symbol) => {
      const pattern = new RegExp(
        `\\b(?:this|canvasShell|host|game|shell|lastGame|[A-Za-z_$][\\w$]*)\\??\\.${symbol}\\s*=`,
      );
      if (!pattern.test(line)) return;
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

function findBattleSceneMirrorAccessInText(filePath, text = '') {
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    if (/^\s*\/\//.test(rawLine)) return;
    const line = stripLineComment(rawLine);
    const evidence = rawLine.trim().replace(/\s+/g, ' ');
    if (!evidence) return;
    if (!/\b(?:this|canvasShell|host|game|shell|lastGame)\??\.battleScene\b/.test(line)) {
      return;
    }
    const access = /\b(?:this|canvasShell|host|game|shell|lastGame)\??\.battleScene\s*=/.test(line)
      ? 'write'
      : 'read';
    findings.push({
      file: normalizePath(filePath),
      line: index + 1,
      symbol: 'battleScene',
      access,
      evidence,
    });
  });
  return findings;
}

function scanBattleDomainOwner(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const files = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isProductionSource)
    .sort();
  const findings = files.flatMap((file) => {
    const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    return [
      ...findBattleDomainWritesInText(file, text),
      ...findBattleSceneMirrorAccessInText(file, text),
    ];
  });
  return {
    report: 'frontend-ecs-battle-domain-owner',
    mode: 'blocking',
    filesScanned: files.length,
    symbols: BATTLE_SYMBOLS,
    approvedPaths: APPROVED_PATHS,
    grandfatheredPaths: GRANDFATHERED_PATHS,
    violations: findings.map((finding) => ({
      ...finding,
      note:
        finding.symbol === 'battleScene'
          ? 'App/Shell battleScene mirror was removed in 7B; renderer-facing reads must use getRendererSnapshot().battle.battleScene'
          : 'battle overlay/session canonical writes must route through BattleDomainOwner or the approved canonical BattleScene adapter',
    })),
    summary: { totalViolations: findings.length },
  };
}

function renderText(report) {
  const lines = [
    '[frontend-ecs-battle-domain-owner] blocking gate',
    `files scanned: ${report.filesScanned}`,
    `approved paths: ${report.approvedPaths.join(', ')}`,
    `grandfathered paths: ${report.grandfatheredPaths.join(', ')}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length) {
    lines.push('', 'Blocked battle domain owner growth:');
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
    const report = scanBattleDomainOwner();
    if (parseFormat() === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length) process.exit(1);
  } catch (error) {
    console.error(`[frontend-ecs-battle-domain-owner] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  APPROVED_PATHS,
  BATTLE_SYMBOLS,
  findBattleSceneMirrorAccessInText,
  findBattleDomainWritesInText,
  isApprovedPath,
  isGrandfatheredPath,
  parseFormat,
  renderText,
  scanBattleDomainOwner,
};
