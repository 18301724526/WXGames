'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Portable (Linux-CI-safe) source-encoding blocking gate. Two regression locks:
//   1. No UTF-8 BOM in source .js -- the toolchain occasionally saved a BOM,
//      which leaks into the first token and trips some parsers.
//   2. No known UTF-8-as-GBK mojibake string. The DETERMINISTIC detector that
//      found these needs the GBK codepage (scripts/scan-mojibake.ps1, a Windows
//      dev-time tool). CI cannot rely on that codepage, so this denylist locks
//      the exact strings we recovered so they cannot silently return. When
//      scan-mojibake.ps1 surfaces new ones, fix them and add them here.
const SCAN_ROOTS = Object.freeze(['backend', 'frontend', 'shared']);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
]);

// Confirmed garbled strings (recovered form in the trailing comment).
const MOJIBAKE_DENYLIST = Object.freeze([
  '鍙湁涓诲煄鍙互鎺ㄥ姩鏂囨槑杩涢樁', // 只有主城可以推动文明进阶
  '鏈煡鎿嶄綔', // 未知操作
  '鏈煡鍦扮偣', // 未知地点
  '棣栭兘', // 首都
  '宸茶揪鍒版渶楂樼骇', // 已达到最高级
  '璧勬簮涓嶈冻', // 资源不足
  '鍗犻', // 占领
  '棰嗗湡', // 领土
  '鐤嗗煙', // 疆域
  '涓栫晫', // 世界
  '渚﹀療', // 侦察
  '鎺㈢储', // 探索
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

function findEncodingIssuesInBuffer(relativePath, buffer) {
  const issues = [];
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    issues.push({ file: relativePath, kind: 'bom', detail: 'UTF-8 BOM at start of file' });
  }
  const text = buffer.toString('utf8');
  for (const garbled of MOJIBAKE_DENYLIST) {
    if (text.includes(garbled)) {
      issues.push({ file: relativePath, kind: 'mojibake', detail: `garbled string "${garbled}"` });
    }
  }
  return issues;
}

function scanSourceEncoding({ repoRoot = process.cwd() } = {}) {
  const violations = [];
  for (const rootName of SCAN_ROOTS) {
    const files = collectFiles(path.join(repoRoot, rootName), repoRoot);
    for (const file of files) {
      const rel = toPosixRelative(file, repoRoot);
      violations.push(...findEncodingIssuesInBuffer(rel, fs.readFileSync(file)));
    }
  }
  return { summary: { totalViolations: violations.length }, violations };
}

function renderText(report) {
  const lines = ['[source-encoding] blocking gate', `violations: ${report.summary.totalViolations}`];
  for (const v of report.violations) lines.push(`  ${v.file}: ${v.kind} -- ${v.detail}`);
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
  const report = scanSourceEncoding();
  console.log(format === 'json' ? JSON.stringify(report, null, 2) : renderText(report));
  process.exit(report.summary.totalViolations === 0 ? 0 : 1);
}

module.exports = {
  SCAN_ROOTS,
  MOJIBAKE_DENYLIST,
  findEncodingIssuesInBuffer,
  scanSourceEncoding,
  renderText,
  parseFormat,
};
