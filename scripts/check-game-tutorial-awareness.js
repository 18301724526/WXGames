'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOTS = Object.freeze(['backend', 'frontend']);
const EXEMPT_ROOTS = Object.freeze([
  Object.freeze({
    path: 'frontend/js/lib/tutorial-engine',
    reason: 'portable tutorial engine library',
  }),
  Object.freeze({
    path: 'frontend/js/integrations/tutorial',
    reason: 'game adapter tables and one-line assembly boundary',
  }),
  Object.freeze({
    path: 'frontend/js/config/tutorial',
    reason: 'data-only 56-row tutorial specification',
  }),
]);
const SYMBOL_PATTERN = /tutorial|\u65b0\u624b|\u5f15\u5bfc/i;

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function isUnder(relativePath, root) {
  const normalized = normalizePath(relativePath);
  const normalizedRoot = normalizePath(root).replace(/\/$/, '');
  return normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`);
}

function isProductionSource(relativePath) {
  const normalized = normalizePath(relativePath);
  if (!normalized.endsWith('.js')) return false;
  if (normalized.endsWith('.test.js') || normalized.includes('/tests/')) return false;
  if (normalized.includes('/test-support/') || normalized.includes('/tools/')) return false;
  if (EXEMPT_ROOTS.some((entry) => isUnder(normalized, entry.path))) return false;
  return SOURCE_ROOTS.some((root) => isUnder(normalized, root));
}

function collectFiles(root, current = root, output = []) {
  if (!fs.existsSync(current)) return output;
  fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) collectFiles(root, absolute, output);
    else output.push(normalizePath(path.relative(root, absolute)));
  });
  return output;
}

function inspectGameTutorialAwareness(repoRoot = DEFAULT_REPO_ROOT) {
  const sourceFiles = collectFiles(repoRoot)
    .filter(isProductionSource)
    .sort();
  const violations = [];
  sourceFiles.forEach((relativePath) => {
    if (SYMBOL_PATTERN.test(relativePath)) {
      violations.push(`${relativePath}: path contains a tutorial symbol`);
    }
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    source.split(/\r?\n/).forEach((line, index) => {
      if (SYMBOL_PATTERN.test(line)) {
        violations.push(`${relativePath}:${index + 1}: ${line.trim()}`);
      }
    });
  });
  return {
    report: 'game-tutorial-awareness',
    mode: 'blocking',
    sourceFiles,
    exemptRoots: EXEMPT_ROOTS,
    violations,
  };
}

function renderText(report) {
  const lines = [
    '[game-tutorial-awareness] blocking gate',
    `production files scanned: ${report.sourceFiles.length}`,
  ];
  report.exemptRoots.forEach((entry) => {
    lines.push(`declared exemption: ${entry.path} - ${entry.reason}`);
  });
  lines.push(`violations: ${report.violations.length}`);
  if (report.violations.length) report.violations.forEach((violation) => lines.push(`- ${violation}`));
  else lines.push('passed');
  return `${lines.join('\n')}\n`;
}

function main() {
  const report = inspectGameTutorialAwareness();
  process.stdout.write(renderText(report));
  if (report.violations.length) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  DEFAULT_REPO_ROOT,
  EXEMPT_ROOTS,
  SOURCE_ROOTS,
  SYMBOL_PATTERN,
  collectFiles,
  inspectGameTutorialAwareness,
  isProductionSource,
  normalizePath,
  renderText,
};
