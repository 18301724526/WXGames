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

const SHOW_MODE_SYMBOLS = Object.freeze([
  'showSettings',
  'showLogs',
  'showResourceDetails',
  'showCitySwitcher',
  'showSubcityList',
  'showCityManagement',
  'showTaskCenter',
  'showFamousPersons',
]);

const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /\.test\.js$/,
  /\.contract\.test\.js$/,
]);

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripStringLiterals(line = '') {
  return String(line || '').replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""');
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

function extractModeSymbols(line = '') {
  const symbols = new Set();
  const exactPattern = new RegExp(`\\b(${EXACT_MODE_SYMBOLS.map(escapeRegExp).join('|')})\\b`, 'g');
  for (const match of line.matchAll(exactPattern)) {
    if (!isMeaningfulExactSymbolUsage(line, match[1])) continue;
    symbols.add(match[1]);
  }
  for (const symbol of SHOW_MODE_SYMBOLS) {
    if (!new RegExp(`\\b${escapeRegExp(symbol)}\\b`).test(line)) continue;
    if (!isShowBooleanLikeUsage(line, symbol)) continue;
    symbols.add(symbol);
  }
  return Array.from(symbols).sort();
}

function hasHostLikePropertyUsage(line = '', symbol = '') {
  const text = stripStringLiterals(line);
  const escaped = escapeRegExp(symbol);
  const hostNames = '(?:host|game|shell|state|facts|lastGame|canvasShell)';
  const hostLike = `(?:this(?:\\??\\.[A-Za-z_$][\\w$]*)*|${hostNames})`;
  const propertyAccess = new RegExp(`${hostLike}\\??\\.${escaped}\\b`);
  const hostAssignment = new RegExp(
    `${hostLike}\\??\\.${escaped}\\s*(?:=(?!=|>)|\\+=|-=|\\*=|/=|%=|\\|\\|=|&&=|\\?\\?=|\\+\\+|--)`,
  );
  return propertyAccess.test(text) || hostAssignment.test(text);
}

function hasPropertyLikeUsage(line = '', symbol = '') {
  const text = stripStringLiterals(line);
  const escaped = escapeRegExp(symbol);
  const propertyAccess = new RegExp(`(?:\\bthis|\\b[A-Za-z_$][\\w$]*|\\]|\\))\\??\\.${escaped}\\b`);
  const bareWrite = new RegExp(
    `(^|[^A-Za-z0-9_$])${escaped}\\s*(?:=(?!=|>)|\\+=|-=|\\*=|/=|%=|\\|\\|=|&&=|\\?\\?=|\\+\\+|--)`,
  );
  const objectProperty = new RegExp(`(^|[^A-Za-z0-9_$])${escaped}\\s*:`);
  const quotedObjectProperty = new RegExp(`['"]${escaped}['"]\\s*:`);
  return (
    propertyAccess.test(text) ||
    bareWrite.test(text) ||
    objectProperty.test(text) ||
    quotedObjectProperty.test(line)
  );
}

function isMeaningfulExactSymbolUsage(line = '', symbol = '') {
  return hasHostLikePropertyUsage(line, symbol);
}

function isShowBooleanLikeUsage(line = '', symbol = '') {
  const escaped = escapeRegExp(symbol);
  const methodPattern = new RegExp(`(^|[.\\s])${escaped}\\s*(?:\\?\\.)?\\(`);
  if (methodPattern.test(line)) return false;
  return hasPropertyLikeUsage(line, symbol);
}

function countSymbolOccurrences(line = '', symbol = '') {
  const pattern = new RegExp(`\\b${escapeRegExp(symbol)}\\b`, 'g');
  return Array.from(line.matchAll(pattern)).length;
}

function isWriteLine(line = '', symbol = '') {
  const escaped = escapeRegExp(symbol);
  const assignment = '(?:=(?!=|>)|\\+=|-=|\\*=|/=|%=|\\|\\|=|&&=|\\?\\?=|\\+\\+|--)';
  const propertyWrite = new RegExp(
    `(?:^|[^A-Za-z0-9_$])(?:this|[A-Za-z_$][\\w$]*|\\])\\.${escaped}\\s*${assignment}`,
  );
  return propertyWrite.test(line);
}

function classifyAccess(line = '', symbol = '') {
  const writes = isWriteLine(line, symbol);
  if (!writes) return 'read';
  return countSymbolOccurrences(line, symbol) > 1 ? 'read-write' : 'write';
}

function classifyRole(filePath = '', line = '', access = 'read') {
  const normalized = normalizePath(filePath);
  const writes = access === 'write' || access === 'read-write';
  if (writes) {
    if (/frontend\/js\/platform\/CanvasGameApp\.js$/.test(normalized) && /\bthis\./.test(line)) {
      return 'source-of-truth';
    }
    if (/frontend\/js\/platform\/CanvasGameShell\.js$/.test(normalized) && /\bthis\./.test(line)) {
      return 'mirror';
    }
    if (/\b(canvasShell|shell|lastGame)\./.test(line)) return 'mirror';
    if (/frontend\/js\/state\//.test(normalized)) return 'adapter';
    return 'unknown';
  }
  if (/frontend\/js\/platform\/renderers\//.test(normalized)) return 'consumer';
  if (/frontend\/js\/state\//.test(normalized)) return 'adapter';
  if (
    /frontend\/js\/platform\/.*(InputRouter|Action|Handlers|Commands|Controller|Shell|App)/.test(
      normalized,
    )
  )
    return 'adapter';
  return 'consumer';
}

function noteForFinding(filePath = '', line = '', symbol = '', access = 'read', role = 'consumer') {
  if (role === 'source-of-truth') return 'legacy owner candidate';
  if (role === 'mirror') return 'legacy mirror candidate';
  if (role === 'unknown' && (access === 'write' || access === 'read-write'))
    return 'write outside known owner/mirror path';
  if (symbol.startsWith('show')) return 'show* modal/panel flag candidate';
  if (/renderers\//.test(normalizePath(filePath))) return 'renderer consumes mode/panel state';
  if (/\b(canvasShell|shell|lastGame)\./.test(line)) return 'cross-object state synchronization';
  return 'mode/panel state reference';
}

function findModeOwnershipInText(filePath, text = '') {
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/^\s*\/\//.test(line)) return;
    for (const symbol of extractModeSymbols(line)) {
      const access = classifyAccess(line, symbol);
      const role = classifyRole(filePath, line, access);
      findings.push({
        symbol,
        file: normalizePath(filePath),
        line: index + 1,
        role,
        access,
        evidence: line.trim().replace(/\s+/g, ' '),
        note: noteForFinding(filePath, line, symbol, access, role),
      });
    }
  });
  return findings;
}

function buildSummary(findings = []) {
  const bySymbol = new Map();
  const byRole = new Map();
  const byAccess = new Map();
  for (const finding of findings) {
    const symbolSummary = bySymbol.get(finding.symbol) || {
      symbol: finding.symbol,
      findings: 0,
      roles: {},
      access: {},
    };
    symbolSummary.findings += 1;
    symbolSummary.roles[finding.role] = (symbolSummary.roles[finding.role] || 0) + 1;
    symbolSummary.access[finding.access] = (symbolSummary.access[finding.access] || 0) + 1;
    bySymbol.set(finding.symbol, symbolSummary);
    byRole.set(finding.role, (byRole.get(finding.role) || 0) + 1);
    byAccess.set(finding.access, (byAccess.get(finding.access) || 0) + 1);
  }
  return {
    totalFindings: findings.length,
    symbolCount: bySymbol.size,
    bySymbol: Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol)),
    byRole: Object.fromEntries(Array.from(byRole.entries()).sort()),
    byAccess: Object.fromEntries(Array.from(byAccess.entries()).sort()),
  };
}

function scanModeOwnership(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const sourceRoot = path.join(repoRoot, FRONTEND_SOURCE_ROOT);
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`frontend source root not found: ${FRONTEND_SOURCE_ROOT}`);
  }
  const files = collectFiles(sourceRoot)
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isProductionFrontendSource)
    .sort();
  const findings = files.flatMap((file) => {
    const fullPath = path.join(repoRoot, file);
    return findModeOwnershipInText(file, fs.readFileSync(fullPath, 'utf8'));
  });
  return {
    report: 'frontend-ecs-mode-ownership',
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
    '[frontend-ecs-mode-ownership] report-only baseline',
    `source root: ${report.sourceRoot}`,
    `files scanned: ${report.filesScanned}`,
    `findings: ${report.summary.totalFindings}`,
    `symbols: ${report.summary.symbolCount}`,
    'by symbol:',
  ];
  report.summary.bySymbol.forEach((entry) => {
    const roles = Object.entries(entry.roles)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
    const access = Object.entries(entry.access)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
    lines.push(`- ${entry.symbol}: ${entry.findings} (${roles}; ${access})`);
  });
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(report) {
  const lines = [
    '# Frontend ECS Mode Ownership Report',
    '',
    'Mode: report-only. Historical findings do not fail the architecture gate.',
    '',
    '## Summary',
    '',
    '| Symbol | Findings | Source-of-truth | Mirror | Adapter | Consumer | Unknown | Writes |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  report.summary.bySymbol.forEach((entry) => {
    const writes = (entry.access.write || 0) + (entry.access['read-write'] || 0);
    lines.push(
      `| \`${escapeMarkdownCell(entry.symbol)}\` | ${entry.findings} | ${entry.roles['source-of-truth'] || 0} | ${entry.roles.mirror || 0} | ${entry.roles.adapter || 0} | ${entry.roles.consumer || 0} | ${entry.roles.unknown || 0} | ${writes} |`,
    );
  });
  lines.push(
    '',
    '## Findings',
    '',
    '| Symbol | File | Line | Role | Access | Evidence | Note |',
    '| --- | --- | ---: | --- | --- | --- | --- |',
  );
  report.findings.forEach((finding) => {
    lines.push(
      `| \`${escapeMarkdownCell(finding.symbol)}\` | ${escapeMarkdownCell(finding.file)} | ${finding.line} | ${escapeMarkdownCell(finding.role)} | ${escapeMarkdownCell(finding.access)} | \`${escapeMarkdownCell(finding.evidence)}\` | ${escapeMarkdownCell(finding.note)} |`,
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
    const report = scanModeOwnership();
    if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else if (format === 'markdown') process.stdout.write(renderMarkdown(report));
    else process.stdout.write(renderSummary(report));
  } catch (error) {
    console.error(`[frontend-ecs-mode-ownership] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  EXACT_MODE_SYMBOLS,
  SHOW_MODE_SYMBOLS,
  EXCLUDED_PATH_PATTERNS,
  buildSummary,
  classifyAccess,
  classifyRole,
  extractModeSymbols,
  findModeOwnershipInText,
  isMeaningfulExactSymbolUsage,
  isProductionFrontendSource,
  isShowBooleanLikeUsage,
  hasPropertyLikeUsage,
  hasHostLikePropertyUsage,
  stripStringLiterals,
  parseFormat,
  renderMarkdown,
  renderSummary,
  scanModeOwnership,
};
