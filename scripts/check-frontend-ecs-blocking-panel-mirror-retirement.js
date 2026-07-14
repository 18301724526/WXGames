const fs = require('node:fs');
const path = require('node:path');

// Batch 8F blocking gate. The 12 blocking-panel host mirrors (10 show-star booleans +
// the activeCommandPanel string enum + the techDetailOpen boolean) were retired in
// favour of per-panel ECS modal subtypes owned through the snapshot adapter. This
// guard blocks any regression that writes/reads those fields off a mirror host, the
// setIfChanged / patch-object close idioms, or the retired bridge wrappers.
const SOURCE_ROOTS = Object.freeze(['frontend/js']);
const APPROVED_PATHS = Object.freeze([
  // The owner + adapter legitimately derive the flat-12 facts FROM the modal entries.
  'frontend/js/platform/CanvasModeOwnershipRuntime.js',
  'frontend/js/platform/CanvasModalSnapshotAdapter.js',
]);
// Only RendererSnapshotBoundary's PANEL_DEFAULTS legitimately declares `showX: false`
// as owner state, so the patch-object close heuristic is suppressed for that ONE file
// (not the whole ecs/ subtree -- a stray `{ showX: false }` mirror elsewhere under
// frontend/js/ecs/ must still be flagged).
const APPROVED_PATCH_FILES = Object.freeze([
  'frontend/js/ecs/snapshot/RendererSnapshotBoundary.js',
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
]);
const SHOW_FIELDS = Object.freeze([
  'showSettings',
  'showLogs',
  'showResourceDetails',
  'showCitySwitcher',
  'showSubcityList',
  'showCityManagement',
  'showTaskCenter',
  'showFamousPersons',
]);
const PANEL_FIELDS = Object.freeze([...SHOW_FIELDS, 'activeCommandPanel', 'techDetailOpen']);
const RETIRED_WRAPPERS = Object.freeze([
  'openBlockingPanelOwner',
  'closeBlockingPanelOwner',
  'closeBlockingPanelsOwner',
]);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /\.contract\.test\.js$/,
  /(^|\/)vendor\//,
  /(^|\/)node_modules\//,
  /^frontend\/js\/ecs\/runtime\/EcsModeRuntimeBundle\.js$/,
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
  if (APPROVED_PATHS.includes(normalized)) return false;
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

function findBlockingPanelMirrorRetirementViolationsInText(filePath, text = '') {
  const findings = [];
  const normalized = normalizePath(filePath);
  const isApprovedPatchFile = APPROVED_PATCH_FILES.includes(normalized);
  // Mirror property access (read OR write) off a forbidden host: `host.showX`. Anchored
  // to the mirror hosts so it does NOT flag legit panel.showX / options.showX /
  // snapshot.panel.showX reads.
  const mirrorPattern = new RegExp(
    `\\b(?:${MIRROR_HOSTS.join('|')})\\??\\.(?:${PANEL_FIELDS.join('|')})\\b`,
  );
  // WRITE to ANY receiver's panel field. Receiver-agnostic so aliased fan-out vars
  // (target.showX = ..., relatedHost.showX = ...) -- the exact identifiers the adapter's
  // own related-host fan-out uses -- cannot smuggle a mirror back in. Reads are
  // unaffected (a write needs `= ` not `==`/`:`), so this does NOT flag panel.showX
  // reads or `showX:` option-builder patches; the adapter/bridge are pre-excluded.
  const writeAssignPattern = new RegExp(`\\.(?:${PANEL_FIELDS.join('|')})\\s*=(?!=)`);
  // Computed write `host['showX'] = ...`; the field name lives in a string literal, so
  // this is checked on the comment-stripped (NOT string-stripped) line.
  const computedWritePattern = new RegExp(
    `\\[\\s*['"\`](?:${PANEL_FIELDS.join('|')})['"\`]\\s*\\]\\s*=(?!=)`,
  );
  const wrapperPattern = new RegExp(`\\b(?:${RETIRED_WRAPPERS.join('|')})\\b`);
  // The setIfChanged + patch-key idioms hide the host (it is the first arg, or the
  // mirror is written by applying a patch object), so they are checked on the
  // comment-stripped (NOT string-stripped) line so the field literal stays visible.
  const setIfChangedPattern = new RegExp(
    `setIfChanged\\(\\s*[^,]+,\\s*['"\`](?:${PANEL_FIELDS.join('|')})['"\`]`,
  );
  const patchShowPattern = new RegExp(`\\b(?:${SHOW_FIELDS.join('|')})\\s*:\\s*false\\b`);
  const patchCommandPattern = /\bactiveCommandPanel\s*:\s*(?:''|"")/;
  const patchTechPattern = /\btechDetailOpen\s*:\s*false\b/;
  const lines = String(text || '').split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    if (isSkippableLine(rawLine)) return;
    const codeLine = stripLineComment(rawLine);
    const strippedLine = stripStringLiterals(codeLine);
    const evidence = rawLine.trim().replace(/\s+/g, ' ');
    if (!evidence) return;

    if (
      mirrorPattern.test(strippedLine) ||
      writeAssignPattern.test(strippedLine) ||
      computedWritePattern.test(codeLine)
    ) {
      findings.push({
        file: normalized,
        line: index + 1,
        kind: 'mirror',
        symbol: 'panel',
        evidence,
      });
      return;
    }
    const wrapperMatch = wrapperPattern.exec(strippedLine);
    if (wrapperMatch) {
      findings.push({
        file: normalized,
        line: index + 1,
        kind: 'wrapper',
        symbol: wrapperMatch[0],
        evidence,
      });
      return;
    }
    if (setIfChangedPattern.test(codeLine)) {
      findings.push({
        file: normalized,
        line: index + 1,
        kind: 'mirror',
        symbol: 'setIfChanged',
        evidence,
      });
      return;
    }
    // The patch-object close idiom is suppressed only in the file whose PANEL_DEFAULTS
    // legitimately declares `showX: false` (RendererSnapshotBoundary), not the whole
    // ecs/ subtree.
    if (
      !isApprovedPatchFile &&
      (patchShowPattern.test(codeLine) ||
        patchCommandPattern.test(codeLine) ||
        patchTechPattern.test(codeLine))
    ) {
      findings.push({
        file: normalized,
        line: index + 1,
        kind: 'mirror',
        symbol: 'patch',
        evidence,
      });
    }
  });

  return findings;
}

function scanBlockingPanelMirrorRetirement(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const files = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isProductionSource)
    .sort();
  const findings = files.flatMap((file) =>
    findBlockingPanelMirrorRetirementViolationsInText(
      file,
      fs.readFileSync(path.join(repoRoot, file), 'utf8'),
    ),
  );
  return {
    report: 'frontend-ecs-blocking-panel-mirror-retirement',
    mode: 'blocking',
    filesScanned: files.length,
    forbiddenMirrorHosts: MIRROR_HOSTS,
    panelFields: PANEL_FIELDS,
    retiredWrappers: RETIRED_WRAPPERS,
    violations: findings.map((finding) => ({
      ...finding,
      note:
        finding.kind === 'wrapper'
          ? 'blockingPanel bridge wrappers were retired in Batch 8F; use the snapshot adapter (openBlockingPanelSnapshot/closeBlockingPanelSnapshot/closeBlockingPanelsSnapshot/isBlockingPanelSnapshotOpen/getCommandPanelValue)'
          : "blocking-panel (showX/activeCommandPanel/techDetailOpen) host mirrors were retired in Batch 8F; route through the snapshot adapter and read snapshot.panel.showX / isBlockingPanelSnapshotOpen / getCommandPanelValue instead of writing/reading host.showX, setIfChanged(host,'showX',...), or { showX: false }",
    })),
    summary: { totalViolations: findings.length },
  };
}

function renderText(report) {
  const lines = [
    '[frontend-ecs-blocking-panel-mirror-retirement] blocking gate',
    `files scanned: ${report.filesScanned}`,
    `forbidden mirror hosts: ${report.forbiddenMirrorHosts.join(', ')}`,
    `retired wrappers: ${report.retiredWrappers.join(', ')}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length) {
    lines.push('', 'Blocked blockingPanel mirror retirement regressions:');
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
    const report = scanBlockingPanelMirrorRetirement();
    if (parseFormat() === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length) process.exit(1);
  } catch (error) {
    console.error(`[frontend-ecs-blocking-panel-mirror-retirement] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  MIRROR_HOSTS,
  PANEL_FIELDS,
  RETIRED_WRAPPERS,
  findBlockingPanelMirrorRetirementViolationsInText,
  parseFormat,
  renderText,
  scanBlockingPanelMirrorRetirement,
  stripStringLiterals,
};
