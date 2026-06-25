const fs = require('node:fs');
const path = require('node:path');

const FRONTEND_SOURCE_ROOT = 'frontend/js';

const EXACT_MODE_SYMBOLS = Object.freeze([
  'activeTab',
  'militaryView',
  'entityBattle',
  'techDetailOpen',
  'armyFormationEditor',
  'naming',
  'rewardReveal',
  'confirmDialog',
  'activeEventId',
]);

const TUTORIAL_SYMBOLS = Object.freeze([
  'isTutorialInputActive',
  'isTutorialActionAllowed',
  'allowedAction',
]);

const RUNTIME_ROUTE_SYMBOLS = Object.freeze([
  'shouldRouteTapThroughWorldMapRuntime',
  'handleTap',
  'handleDrag',
  'worldMapRuntime',
]);

const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /\.test\.js$/,
  /\.contract\.test\.js$/,
]);

const INPUT_FILE_PATTERNS = Object.freeze([
  /InputRouter\.js$/,
  /H5CanvasInputController\.js$/,
  /CanvasActionController\.js$/,
  /CanvasActionDispatcher\.js$/,
  /CanvasActionDispatchRegistry\.js$/,
  /ActionHandlers\.js$/,
  /Commands\.js$/,
  /WorldMapInputActionMap\.js$/,
  /WorldMapInputIntent\.js$/,
]);

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function isInputBranchSurface(filePath) {
  const normalized = normalizePath(filePath);
  if (!isProductionFrontendSource(normalized)) return false;
  const basename = path.basename(normalized);
  return INPUT_FILE_PATTERNS.some((pattern) => pattern.test(basename));
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

function classifySurface(filePath) {
  const basename = path.basename(normalizePath(filePath));
  if (/InputRouter\.js$/.test(basename)) return 'input-router';
  if (/ActionDispatcher\.js$|ActionDispatchRegistry\.js$/.test(basename)) return 'action-dispatch';
  if (/ActionController\.js$|ActionHandlers\.js$|Commands\.js$/.test(basename))
    return 'command-handler';
  return 'domain-input';
}

function extractSymbols(line = '') {
  const symbols = new Set();
  const exactPattern = new RegExp(
    `\\b(${[...EXACT_MODE_SYMBOLS, ...TUTORIAL_SYMBOLS, ...RUNTIME_ROUTE_SYMBOLS]
      .map(escapeRegExp)
      .join('|')})\\b`,
    'g',
  );
  for (const match of String(line || '').matchAll(exactPattern)) symbols.add(match[1]);
  for (const match of String(line || '').matchAll(/\bshow[A-Z][A-Za-z0-9_$]*\b/g)) {
    symbols.add(match[0]);
  }
  if (/\baction\.type\b/.test(line)) symbols.add('action.type');
  if (/\bdispatch\s*\(/.test(line)) symbols.add('dispatch');
  return Array.from(symbols).sort();
}

function extractActionTypes(line = '') {
  const actionTypes = new Set();
  const patterns = [
    /\btype\s*:\s*['"`]([^'"`]+)['"`]/g,
    /\baction\.type\s*(?:={2,3}|!==?)\s*['"`]([^'"`]+)['"`]/g,
    /\bcase\s+['"`]([^'"`]+)['"`]\s*:/g,
    /\bregister(?:Action|Command|Handler)?\s*\(\s*['"`]([^'"`]+)['"`]/g,
  ];
  patterns.forEach((pattern) => {
    for (const match of String(line || '').matchAll(pattern)) actionTypes.add(match[1]);
  });
  return Array.from(actionTypes).sort();
}

function hasBranchSignal(line = '') {
  return /\bif\s*\(|\belse\s+if\s*\(|\bswitch\s*\(|\bcase\b|&&|\|\||\?\s*[^.:]/.test(line);
}

function hasActionDispatchSignal(line = '') {
  return /\b(action\.type|dispatch\s*\(|register(?:Action|Command|Handler)?\s*\(|handler|command|allowedActions?)\b/.test(
    line,
  );
}

function classifyBranchKind(symbols = [], actionTypes = []) {
  if (symbols.some((symbol) => TUTORIAL_SYMBOLS.includes(symbol))) return 'tutorial';
  if (symbols.some((symbol) => RUNTIME_ROUTE_SYMBOLS.includes(symbol))) return 'runtime-route';
  if (symbols.some((symbol) => symbol.startsWith('show'))) return 'panel';
  if (
    symbols.some((symbol) =>
      ['naming', 'rewardReveal', 'confirmDialog', 'activeEventId', 'techDetailOpen'].includes(
        symbol,
      ),
    )
  )
    return 'panel';
  if (symbols.some((symbol) => EXACT_MODE_SYMBOLS.includes(symbol))) return 'mode';
  if (symbols.includes('action.type') || symbols.includes('dispatch') || actionTypes.length > 0)
    return 'action';
  return 'action';
}

function noteForFinding(branchKind, symbols = []) {
  if (branchKind === 'tutorial') return 'tutorial input gate branch';
  if (branchKind === 'runtime-route') return 'world-map runtime route branch';
  if (branchKind === 'panel') return 'panel/modal input branch';
  if (branchKind === 'mode') return 'mode-dependent input branch';
  if (symbols.includes('dispatch') || symbols.includes('action.type'))
    return 'action dispatch branch';
  return 'command/action routing branch';
}

function isSkippableLine(line = '') {
  return /^\s*\/\//.test(line) || /^\s*\*/.test(line);
}

function findInputBranchesInText(filePath, text = '') {
  const findings = [];
  if (!isInputBranchSurface(filePath)) return findings;

  const surface = classifySurface(filePath);
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (isSkippableLine(line)) return;
    const symbols = extractSymbols(line);
    const actionTypes = extractActionTypes(line);
    if (symbols.length === 0 && actionTypes.length === 0) return;
    if (!hasBranchSignal(line) && !hasActionDispatchSignal(line)) return;

    const branchKind = classifyBranchKind(symbols, actionTypes);
    findings.push({
      file: normalizePath(filePath),
      line: index + 1,
      surface,
      branchKind,
      symbols,
      actionType: actionTypes.join(', '),
      evidence: line.trim().replace(/\s+/g, ' '),
      note: noteForFinding(branchKind, symbols),
    });
  });
  return findings;
}

function buildSummary(findings = []) {
  const bySurface = new Map();
  const byBranchKind = new Map();
  findings.forEach((finding) => {
    bySurface.set(finding.surface, (bySurface.get(finding.surface) || 0) + 1);
    byBranchKind.set(finding.branchKind, (byBranchKind.get(finding.branchKind) || 0) + 1);
  });
  return {
    totalFindings: findings.length,
    bySurface: Object.fromEntries(Array.from(bySurface.entries()).sort()),
    byBranchKind: Object.fromEntries(Array.from(byBranchKind.entries()).sort()),
  };
}

function scanInputBranches(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const sourceRoot = path.join(repoRoot, FRONTEND_SOURCE_ROOT);
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`frontend source root not found: ${FRONTEND_SOURCE_ROOT}`);
  }
  const files = collectFiles(sourceRoot)
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isInputBranchSurface)
    .sort();
  const findings = files.flatMap((file) => {
    const fullPath = path.join(repoRoot, file);
    return findInputBranchesInText(file, fs.readFileSync(fullPath, 'utf8'));
  });
  return {
    report: 'frontend-ecs-input-branch',
    mode: 'report-only',
    sourceRoot: FRONTEND_SOURCE_ROOT,
    filesScanned: files.length,
    findings,
    summary: buildSummary(findings),
  };
}

function escapeMarkdownCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function renderSummary(report) {
  const lines = [
    '[frontend-ecs-input-branch] report-only baseline',
    `source root: ${report.sourceRoot}`,
    `files scanned: ${report.filesScanned}`,
    `findings: ${report.summary.totalFindings}`,
    'by surface:',
  ];
  Object.entries(report.summary.bySurface).forEach(([surface, count]) => {
    lines.push(`- ${surface}: ${count}`);
  });
  lines.push('by branch kind:');
  Object.entries(report.summary.byBranchKind).forEach(([branchKind, count]) => {
    lines.push(`- ${branchKind}: ${count}`);
  });
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(report) {
  const lines = [
    '# Frontend ECS Input Branch Report',
    '',
    'Mode: report-only. Historical findings do not fail the architecture gate.',
    '',
    '## Summary',
    '',
    '| Dimension | Key | Findings |',
    '| --- | --- | ---: |',
  ];
  Object.entries(report.summary.bySurface).forEach(([surface, count]) => {
    lines.push(`| Surface | ${escapeMarkdownCell(surface)} | ${count} |`);
  });
  Object.entries(report.summary.byBranchKind).forEach(([branchKind, count]) => {
    lines.push(`| Branch Kind | ${escapeMarkdownCell(branchKind)} | ${count} |`);
  });
  lines.push(
    '',
    '## Findings',
    '',
    '| File | Line | Surface | Branch Kind | Symbols | Action Type | Evidence | Note |',
    '| --- | ---: | --- | --- | --- | --- | --- | --- |',
  );
  report.findings.forEach((finding) => {
    lines.push(
      `| ${escapeMarkdownCell(finding.file)} | ${finding.line} | ${escapeMarkdownCell(finding.surface)} | ${escapeMarkdownCell(finding.branchKind)} | ${escapeMarkdownCell(finding.symbols.join(', '))} | ${escapeMarkdownCell(finding.actionType)} | \`${escapeMarkdownCell(finding.evidence)}\` | ${escapeMarkdownCell(finding.note)} |`,
    );
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
    const report = scanInputBranches();
    if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else if (format === 'markdown') process.stdout.write(renderMarkdown(report));
    else process.stdout.write(renderSummary(report));
  } catch (error) {
    console.error(`[frontend-ecs-input-branch] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  EXACT_MODE_SYMBOLS,
  EXCLUDED_PATH_PATTERNS,
  buildSummary,
  classifyBranchKind,
  classifySurface,
  extractActionTypes,
  extractSymbols,
  findInputBranchesInText,
  isInputBranchSurface,
  isProductionFrontendSource,
  parseFormat,
  renderMarkdown,
  renderSummary,
  scanInputBranches,
};
