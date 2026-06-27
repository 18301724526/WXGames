'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Blocking gate: the blocking-panel snapshot delegating wrappers
// (openBlockingPanelSnapshot / closeBlockingPanelSnapshot / isBlockingPanelSnapshotOpen)
// have ONE source -- frontend/js/platform/CanvasBlockingPanelSnapshotCalls.js. They were
// previously copy-pasted byte-identically into 13 files; this guard forbids any frontend
// file from re-defining them so the "change one, forget the other 12" class cannot return.
// Only two files may define them: the single-source module, and CanvasModalSnapshotAdapter
// (the real owner that holds the actual modal-payload logic the wrappers delegate to).
const SCAN_ROOT = 'frontend';
const HELPERS = Object.freeze([
  'openBlockingPanelSnapshot',
  'closeBlockingPanelSnapshot',
  'isBlockingPanelSnapshotOpen',
]);
const CANONICAL = 'frontend/js/platform/CanvasBlockingPanelSnapshotCalls.js';
const ALLOWED_DEFINERS = Object.freeze([
  CANONICAL,
  'frontend/js/platform/CanvasModalSnapshotAdapter.js',
]);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
]);
const DEF_PATTERN = new RegExp(`\\bfunction\\s+(${HELPERS.join('|')})\\s*\\(`);

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

function findBlockingPanelDefsInText(relativePath, text) {
  const findings = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    const match = DEF_PATTERN.exec(line);
    if (match) findings.push({ file: relativePath, symbol: match[1], line: i + 1 });
  }
  return findings;
}

function scanBlockingPanelCalls({ repoRoot = process.cwd() } = {}) {
  const allowed = new Set(ALLOWED_DEFINERS);
  const violations = [];
  for (const file of collectFiles(path.join(repoRoot, SCAN_ROOT), repoRoot)) {
    const rel = toPosixRelative(file, repoRoot);
    if (allowed.has(rel)) continue;
    violations.push(...findBlockingPanelDefsInText(rel, fs.readFileSync(file, 'utf8')));
  }
  return { summary: { totalViolations: violations.length }, violations };
}

function renderText(report) {
  const lines = ['[frontend-blocking-panel-snapshot-calls] blocking gate', `canonical: ${CANONICAL}`, `violations: ${report.summary.totalViolations}`];
  for (const v of report.violations) lines.push(`  ${v.file}:${v.line} re-defines ${v.symbol} -- use ${CANONICAL}`);
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
  const report = scanBlockingPanelCalls();
  console.log(format === 'json' ? JSON.stringify(report, null, 2) : renderText(report));
  process.exit(report.summary.totalViolations === 0 ? 0 : 1);
}

module.exports = {
  HELPERS,
  CANONICAL,
  ALLOWED_DEFINERS,
  findBlockingPanelDefsInText,
  scanBlockingPanelCalls,
  renderText,
  parseFormat,
};
