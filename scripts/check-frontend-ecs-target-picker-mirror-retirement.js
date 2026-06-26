const fs = require('node:fs');
const path = require('node:path');

const SOURCE_ROOTS = Object.freeze(['frontend/js']);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /\.contract\.test\.js$/,
  /(^|\/)vendor\//,
  /(^|\/)node_modules\//,
  // TerritoryController owns the world-march DOMAIN target (worldMarchTarget) on
  // its uiState. Batch 8E removed its picker mirror seed/writes; the modal close
  // now routes through the action layer / owner. It is excluded the way
  // EventController.js was excluded from the event-mirror retirement guard.
  /(^|\/)controllers\/TerritoryController\.js$/,
]);
const MIRROR_HOSTS = Object.freeze([
  'this',
  'app',
  'canvasShell',
  'game',
  'host',
  'lastGame',
  'shell',
  'uiHost',
  'uiState',
  'territoryUiState',
]);
const RETIRED_WRAPPERS = Object.freeze([
  'openWorldTargetPickerOwner',
  'openWorldMarchFormationPickerOwner',
  'closeTargetPickerOwner',
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

function stripLineComment(line = '') {
  const index = line.indexOf('//');
  return index < 0 ? line : line.slice(0, index);
}

function stripStringLiterals(line = '') {
  return String(line || '').replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''");
}

function isSkippableLine(line = '') {
  return /^\s*\/\//.test(line) || /^\s*\*/.test(line);
}

function findTargetPickerMirrorRetirementViolationsInText(filePath, text = '') {
  const findings = [];
  // Any property assignment to worldTargetPicker, INCLUDING = null clears. Anchors
  // on `.worldTargetPicker =` (covers host.x.worldTargetPicker = and
  // host.getUiState().worldTargetPicker = alike). Bare reads (Boolean(uiState
  // ?.worldTargetPicker)) carry no `=`, and the `pickerKind: 'worldTargetPicker'`
  // payload string is string-stripped, so neither is flagged.
  const mirrorPattern = /\.worldTargetPicker\s*=(?!=)/;
  // the worldMarchTarget DOMAIN object must not carry a pickerOpen modal flag write.
  const marchPickerOpenPattern = /\bworldMarchTarget(?:\??\.[A-Za-z0-9_$]+)*\.pickerOpen\s*=(?!=)/;
  // the modal-flag object literal `pickerOpen: true|false` (the open/closed signal
  // that now lives in the owner). `pickerOpen: Boolean(...)` reads are NOT matched.
  const pickerOpenLiteralPattern = /\bpickerOpen\s*:\s*(?:true|false)\b/;
  const wrapperPattern = new RegExp(`\\b(?:${RETIRED_WRAPPERS.join('|')})\\b`);
  const lines = String(text || '').split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    if (isSkippableLine(rawLine)) return;
    const codeLine = stripLineComment(rawLine);
    const strippedLine = stripStringLiterals(codeLine);
    const evidence = rawLine.trim().replace(/\s+/g, ' ');
    if (!evidence) return;

    if (mirrorPattern.test(strippedLine)) {
      findings.push({
        file: normalizePath(filePath),
        line: index + 1,
        kind: 'mirror',
        symbol: 'worldTargetPicker',
        evidence,
      });
      return;
    }
    if (marchPickerOpenPattern.test(strippedLine) || pickerOpenLiteralPattern.test(strippedLine)) {
      findings.push({
        file: normalizePath(filePath),
        line: index + 1,
        kind: 'mirror',
        symbol: 'worldMarchTarget.pickerOpen',
        evidence,
      });
      return;
    }
    const wrapperMatch = wrapperPattern.exec(strippedLine);
    if (wrapperMatch) {
      findings.push({
        file: normalizePath(filePath),
        line: index + 1,
        kind: 'wrapper',
        symbol: wrapperMatch[0],
        evidence,
      });
    }
  });

  return findings;
}

function scanTargetPickerMirrorRetirement(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const files = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isProductionSource)
    .sort();
  const findings = files.flatMap((file) =>
    findTargetPickerMirrorRetirementViolationsInText(
      file,
      fs.readFileSync(path.join(repoRoot, file), 'utf8'),
    ),
  );
  return {
    report: 'frontend-ecs-target-picker-mirror-retirement',
    mode: 'blocking',
    filesScanned: files.length,
    forbiddenMirrorHosts: MIRROR_HOSTS,
    retiredWrappers: RETIRED_WRAPPERS,
    violations: findings.map((finding) => ({
      ...finding,
      note:
        finding.kind === 'mirror'
          ? 'targetPicker modal mirror was retired in Batch 8E; use the snapshot adapter (openTargetPickerSnapshot/closeTargetPickerSnapshot/getTargetPickerSnapshot/isTargetPickerSnapshotOpen) instead of writing host.worldTargetPicker / worldMarchTarget.pickerOpen / { pickerOpen: true|false }'
          : 'targetPicker-specific bridge wrappers were retired; use the modal snapshot adapter helpers',
    })),
    summary: { totalViolations: findings.length },
  };
}

function renderText(report) {
  const lines = [
    '[frontend-ecs-target-picker-mirror-retirement] blocking gate',
    `files scanned: ${report.filesScanned}`,
    `forbidden mirror hosts: ${report.forbiddenMirrorHosts.join(', ')}`,
    `retired wrappers: ${report.retiredWrappers.join(', ')}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length) {
    lines.push('', 'Blocked targetPicker mirror retirement regressions:');
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
    const report = scanTargetPickerMirrorRetirement();
    if (parseFormat() === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length) process.exit(1);
  } catch (error) {
    console.error(`[frontend-ecs-target-picker-mirror-retirement] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  MIRROR_HOSTS,
  RETIRED_WRAPPERS,
  findTargetPickerMirrorRetirementViolationsInText,
  parseFormat,
  renderText,
  scanTargetPickerMirrorRetirement,
  stripStringLiterals,
};
