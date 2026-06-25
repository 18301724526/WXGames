const fs = require('node:fs');
const path = require('node:path');

const FRONTEND_SOURCE_ROOT = 'frontend/js';

const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /\.test\.js$/,
  /\.contract\.test\.js$/,
]);

const BRIDGE_FILE_NAME_PATTERN = /(Facade|Bridge|ActionHandlers|Commands|Delegates)\.js$/;

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function toPosixRelative(filePath, repoRoot = process.cwd()) {
  return normalizePath(path.relative(repoRoot, filePath));
}

function isProductionFrontendSource(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized.startsWith(`${FRONTEND_SOURCE_ROOT}/`)) return false;
  if (!normalized.endsWith('.js')) return false;
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
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

function countBranchTokens(lines = []) {
  return lines.reduce((count, line) => {
    const matches = String(line || '').match(/\bif\s*\(|\belse\s+if\s*\(|\bswitch\s*\(|\bcase\b|\?\s*[^.:]/g);
    return count + (matches ? matches.length : 0);
  }, 0);
}

function collectFieldNames(lines = []) {
  const fields = new Set();
  const fieldPattern = /\bthis\.([A-Za-z_$][\w$]*)\s*(?:=|\+=|-=|\*=|\/=|%=|\|\|=|&&=|\?\?=|\+\+|--)/g;
  const mirrorPattern = /\b(?:canvasShell|shell|game|host|target|lastGame)\.([A-Za-z_$][\w$]*)\s*(?:=|\+=|-=|\*=|\/=|%=|\|\|=|&&=|\?\?=|\+\+|--)/g;
  lines.forEach((line) => {
    for (const match of String(line || '').matchAll(fieldPattern)) fields.add(match[1]);
    for (const match of String(line || '').matchAll(mirrorPattern)) fields.add(match[1]);
  });
  return Array.from(fields).sort();
}

function collectMethodNames(lines = []) {
  const methods = new Set();
  const objectMethodPattern = /^\s{4,}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/;
  const functionPropertyPattern = /^\s{4,}([A-Za-z_$][\w$]*)\s*:\s*(?:async\s+)?function\b/;
  const functionPattern = /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/;
  const classMethodPattern = /^\s{2,}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/;
  lines.forEach((line) => {
    const text = String(line || '');
    const objectMethod = text.match(objectMethodPattern);
    if (objectMethod && !['if', 'for', 'while', 'switch', 'catch'].includes(objectMethod[1])) {
      methods.add(objectMethod[1]);
    }
    const fn = text.match(functionPattern);
    if (fn) methods.add(fn[1]);
    const functionProperty = text.match(functionPropertyPattern);
    if (functionProperty) methods.add(functionProperty[1]);
    const classMethod = text.match(classMethodPattern);
    if (classMethod && !['if', 'for', 'while', 'switch', 'catch'].includes(classMethod[1])) {
      methods.add(classMethod[1]);
    }
  });
  return Array.from(methods).sort();
}

function findRangeEnd(lines, startIndex) {
  let depth = 0;
  let started = false;
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    for (const char of line) {
      if (char === '{') {
        depth += 1;
        started = true;
      } else if (char === '}') {
        depth -= 1;
      }
    }
    if (started && depth <= 0 && index > startIndex) return index;
  }
  return Math.min(lines.length - 1, startIndex + 80);
}

function buildCandidate({ bridge, file, line, surface, lines, role = 'bridge', note }) {
  return {
    bridge,
    file: normalizePath(file),
    line,
    surface,
    fields: collectFieldNames(lines),
    methods: collectMethodNames(lines),
    branchCount: countBranchTokens(lines),
    role,
    retirementTarget: 'ECS owner/adapter target pending Batch 1-2 decision',
    note,
  };
}

function findBridgeCandidatesInText(filePath, text = '') {
  const normalized = normalizePath(filePath);
  const lines = String(text || '').split(/\r?\n/);
  const candidates = [];

  lines.forEach((line, index) => {
    const objectAssign = line.match(/Object\.assign\(\s*([A-Za-z_$][\w$.]*)\.prototype\s*,\s*{/);
    if (objectAssign) {
      const end = findRangeEnd(lines, index);
      candidates.push(buildCandidate({
        bridge: `${objectAssign[1]}.prototype`,
        file: normalized,
        line: index + 1,
        surface: 'Object.assign prototype installer',
        lines: lines.slice(index, end + 1),
        note: 'prototype augmentation surface',
      }));
    }

    const directPrototype = line.match(/([A-Za-z_$][\w$.]*)\.prototype\.([A-Za-z_$][\w$]*)\s*=/);
    if (directPrototype) {
      candidates.push(buildCandidate({
        bridge: `${directPrototype[1]}.prototype.${directPrototype[2]}`,
        file: normalized,
        line: index + 1,
        surface: 'direct prototype assignment',
        lines: lines.slice(index, Math.min(lines.length, index + 20)),
        note: 'direct prototype method bridge candidate',
      }));
    }
  });

  if (BRIDGE_FILE_NAME_PATTERN.test(path.basename(normalized)) && /(?:install|prototype|Facade|Bridge|ActionHandlers|Object\.assign)/.test(text)) {
    candidates.push(buildCandidate({
      bridge: path.basename(normalized, '.js'),
      file: normalized,
      line: 1,
      surface: 'facade/bridge file surface',
      lines,
      role: 'adapter',
      note: 'file-level bridge/facade candidate',
    }));
  }

  return candidates;
}

function buildSummary(candidates = []) {
  const bySurface = new Map();
  const byRole = new Map();
  candidates.forEach((candidate) => {
    bySurface.set(candidate.surface, (bySurface.get(candidate.surface) || 0) + 1);
    byRole.set(candidate.role, (byRole.get(candidate.role) || 0) + 1);
  });
  return {
    totalCandidates: candidates.length,
    bySurface: Object.fromEntries(Array.from(bySurface.entries()).sort()),
    byRole: Object.fromEntries(Array.from(byRole.entries()).sort()),
    totalBranches: candidates.reduce((count, candidate) => count + candidate.branchCount, 0),
  };
}

function scanBridgeShrink(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const sourceRoot = path.join(repoRoot, FRONTEND_SOURCE_ROOT);
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`frontend source root not found: ${FRONTEND_SOURCE_ROOT}`);
  }
  const files = collectFiles(sourceRoot)
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isProductionFrontendSource)
    .sort();
  const candidates = files.flatMap((file) => {
    const fullPath = path.join(repoRoot, file);
    return findBridgeCandidatesInText(file, fs.readFileSync(fullPath, 'utf8'));
  });
  return {
    report: 'frontend-ecs-bridge-shrink',
    mode: 'report-only',
    sourceRoot: FRONTEND_SOURCE_ROOT,
    filesScanned: files.length,
    candidates,
    summary: buildSummary(candidates),
  };
}

function escapeMarkdownCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderSummary(report) {
  const lines = [
    '[frontend-ecs-bridge-shrink] report-only baseline',
    `source root: ${report.sourceRoot}`,
    `files scanned: ${report.filesScanned}`,
    `candidates: ${report.summary.totalCandidates}`,
    `branch tokens: ${report.summary.totalBranches}`,
    'by surface:',
  ];
  Object.entries(report.summary.bySurface).forEach(([surface, count]) => {
    lines.push(`- ${surface}: ${count}`);
  });
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(report) {
  const lines = [
    '# Frontend ECS Bridge Shrink Report',
    '',
    'Mode: report-only. Historical bridge candidates do not fail the architecture gate.',
    '',
    '## Summary',
    '',
    '| Surface | Candidates |',
    '| --- | ---: |',
  ];
  Object.entries(report.summary.bySurface).forEach(([surface, count]) => {
    lines.push(`| ${escapeMarkdownCell(surface)} | ${count} |`);
  });
  lines.push(
    '',
    '## Candidates',
    '',
    '| Bridge | File | Line | Installer/Surface | Fields | Methods | Branch Count | Role | Retirement Target | Note |',
    '| --- | --- | ---: | --- | --- | --- | ---: | --- | --- | --- |',
  );
  report.candidates.forEach((candidate) => {
    lines.push(`| \`${escapeMarkdownCell(candidate.bridge)}\` | ${escapeMarkdownCell(candidate.file)} | ${candidate.line} | ${escapeMarkdownCell(candidate.surface)} | ${escapeMarkdownCell(candidate.fields.join(', '))} | ${escapeMarkdownCell(candidate.methods.join(', '))} | ${candidate.branchCount} | ${escapeMarkdownCell(candidate.role)} | ${escapeMarkdownCell(candidate.retirementTarget)} | ${escapeMarkdownCell(candidate.note)} |`);
  });
  return `${lines.join('\n')}\n`;
}

function parseFormat(argv = process.argv.slice(2)) {
  const formats = argv.filter((arg) => ['--summary', '--json', '--markdown'].includes(arg));
  const unknown = argv.filter((arg) => !['--summary', '--json', '--markdown'].includes(arg));
  if (unknown.length > 0) throw new Error(`unknown arguments: ${unknown.join(', ')}`);
  if (formats.includes('--json')) return 'json';
  if (formats.includes('--markdown')) return 'markdown';
  return 'summary';
}

function main() {
  try {
    const format = parseFormat();
    const report = scanBridgeShrink();
    if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else if (format === 'markdown') process.stdout.write(renderMarkdown(report));
    else process.stdout.write(renderSummary(report));
  } catch (error) {
    console.error(`[frontend-ecs-bridge-shrink] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  BRIDGE_FILE_NAME_PATTERN,
  EXCLUDED_PATH_PATTERNS,
  buildSummary,
  collectFieldNames,
  collectMethodNames,
  countBranchTokens,
  findBridgeCandidatesInText,
  isProductionFrontendSource,
  parseFormat,
  renderMarkdown,
  renderSummary,
  scanBridgeShrink,
};
