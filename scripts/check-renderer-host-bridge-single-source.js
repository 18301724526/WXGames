'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Blocking gate: the renderer host-fallback bridge (a Proxy that reads/writes
// fall through to `this.host`) has ONE source --
// frontend/js/platform/renderers/WorldMapRendererHostBridge.js
// (`WorldMapRendererHostBridge.createProxy(this)`). It was previously
// hand-rolled as an inline `new Proxy(this, { get, set })` in 17 renderers,
// which drifted into 3 behavioral variants (worldTile* routing, function
// binding, unknown-prop write destination). This guard forbids any renderer
// from re-introducing an inline `new Proxy(this, ...)` so the "fix the trap in
// one renderer, forget the other 16" class cannot return. The canonical itself
// proxies `renderer` (not `this`) and the composition factory proxies
// `Object.create(null)`, so neither trips the pattern.
const SCAN_ROOT = 'frontend/js/platform/renderers';
const CANONICAL = 'frontend/js/platform/renderers/WorldMapRendererHostBridge.js';
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
]);
// matches `new Proxy(this,` with arbitrary inner whitespace
const INLINE_PROXY_PATTERN = /\bnew\s+Proxy\s*\(\s*this\s*,/;

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function toPosixRelative(filePath, repoRoot = process.cwd()) {
  return normalizePath(path.relative(repoRoot, filePath));
}

function isExcluded(relativePath) {
  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function collectFiles(root, repoRoot, files = []) {
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'vendor') continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) collectFiles(entryPath, repoRoot, files);
    else if (entry.isFile() && entry.name.endsWith('.js')) {
      const rel = toPosixRelative(entryPath, repoRoot);
      if (!isExcluded(rel)) files.push(entryPath);
    }
  }
  return files;
}

function findInlineProxyInText(relativePath, text) {
  const findings = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    if (INLINE_PROXY_PATTERN.test(line)) findings.push({ file: relativePath, line: i + 1 });
  }
  return findings;
}

function scanRendererHostBridge({ repoRoot = process.cwd() } = {}) {
  const violations = [];
  for (const file of collectFiles(path.join(repoRoot, SCAN_ROOT), repoRoot)) {
    violations.push(
      ...findInlineProxyInText(toPosixRelative(file, repoRoot), fs.readFileSync(file, 'utf8')),
    );
  }
  return { summary: { totalViolations: violations.length }, violations };
}

function renderText(report) {
  const lines = [
    '[renderer-host-bridge-single-source] blocking gate',
    `canonical: ${CANONICAL}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  for (const v of report.violations)
    lines.push(
      `  ${v.file}:${v.line} hand-rolls new Proxy(this, ...) -- use WorldMapRendererHostBridge.createProxy(this)`,
    );
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
  const report = scanRendererHostBridge();
  console.log(format === 'json' ? JSON.stringify(report, null, 2) : renderText(report));
  process.exit(report.summary.totalViolations === 0 ? 0 : 1);
}

module.exports = {
  SCAN_ROOT,
  CANONICAL,
  INLINE_PROXY_PATTERN,
  findInlineProxyInText,
  scanRendererHostBridge,
  renderText,
  parseFormat,
};
