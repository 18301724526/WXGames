'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RETIRED_FILE = 'frontend/js/platform/renderers/WorldMapRendererHostBridge.js';
const SCAN_ROOTS = Object.freeze([
  'frontend/index.html',
  'frontend/minigame/game.js',
  'frontend/js/platform',
]);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
]);
const FORBIDDEN_PATTERNS = Object.freeze([
  { kind: 'retired-host-bridge-symbol', pattern: /\bWorldMapRendererHostBridge\b/ },
  { kind: 'retired-host-bridge-alias', pattern: /\bHostBridge\b/ },
  { kind: 'retired-create-proxy-call', pattern: /\.createProxy\s*\(/ },
  { kind: 'inline-this-proxy', pattern: /\bnew\s+Proxy\s*\(\s*this\s*,/ },
  { kind: 'inline-renderer-proxy', pattern: /\bnew\s+Proxy\s*\(\s*renderer\s*,/ },
  {
    kind: 'inline-child-host-proxy',
    pattern: /\bnew\s+Proxy\s*\(\s*Object\.create\s*\(\s*null\s*\)\s*,/,
  },
]);

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function toPosixRelative(filePath, repoRoot = process.cwd()) {
  return normalizePath(path.relative(repoRoot, filePath));
}

function isExcluded(relativePath) {
  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function collectFiles(entryPath, repoRoot, files = []) {
  if (!fs.existsSync(entryPath)) return files;
  const stat = fs.statSync(entryPath);
  if (stat.isFile()) {
    const rel = toPosixRelative(entryPath, repoRoot);
    if (!isExcluded(rel) && /\.(?:html|js)$/.test(rel)) files.push(entryPath);
    return files;
  }
  if (!stat.isDirectory()) return files;
  for (const entry of fs.readdirSync(entryPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'vendor') continue;
    collectFiles(path.join(entryPath, entry.name), repoRoot, files);
  }
  return files;
}

function findRetiredBridgeReferencesInText(relativePath, text) {
  const findings = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(line))
        findings.push({ file: relativePath, line: i + 1, kind: rule.kind });
    }
  }
  return findings;
}

function scanRendererHostBridgeRetirement({ repoRoot = process.cwd() } = {}) {
  const violations = [];
  const retiredPath = path.join(repoRoot, RETIRED_FILE);
  if (fs.existsSync(retiredPath)) {
    violations.push({ file: RETIRED_FILE, line: 1, kind: 'retired-host-bridge-file' });
  }
  for (const scanRoot of SCAN_ROOTS) {
    const absoluteRoot = path.join(repoRoot, scanRoot);
    for (const file of collectFiles(absoluteRoot, repoRoot)) {
      const relativePath = toPosixRelative(file, repoRoot);
      violations.push(
        ...findRetiredBridgeReferencesInText(relativePath, fs.readFileSync(file, 'utf8')),
      );
    }
  }
  return { summary: { totalViolations: violations.length }, violations };
}

function renderText(report) {
  const lines = [
    '[renderer-host-bridge-retired] blocking gate',
    `retired: ${RETIRED_FILE}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  for (const v of report.violations) {
    lines.push(`  ${v.file}:${v.line} ${v.kind}`);
  }
  lines.push(report.summary.totalViolations === 0 ? 'passed' : 'FAILED');
  return lines.join('\n');
}

function parseFormat(argv) {
  const rest = argv.filter((arg) => arg !== '--json');
  if (rest.length > 0) throw new Error(`unknown arguments: ${rest.join(', ')}`);
  return argv.includes('--json') ? 'json' : 'text';
}

if (require.main === module) {
  const format = parseFormat(process.argv.slice(2));
  const report = scanRendererHostBridgeRetirement();
  console.log(format === 'json' ? JSON.stringify(report, null, 2) : renderText(report));
  process.exit(report.summary.totalViolations === 0 ? 0 : 1);
}

module.exports = {
  RETIRED_FILE,
  FORBIDDEN_PATTERNS,
  findRetiredBridgeReferencesInText,
  scanRendererHostBridgeRetirement,
  renderText,
  parseFormat,
};
