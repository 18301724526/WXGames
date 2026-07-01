const fs = require('node:fs');
const path = require('node:path');

// check-frontend-single-source-redline.js -- CUT 9 blocking redline guard.
//
// Locks the single-source gains earned by cuts 1-7 so the "套壳套壳再套壳"
// (shell-on-shell mirror) pattern cannot silently regress. The deleted shells
// (FogOwner/BattleOwner/ModalWorld/WorldMarchOptimisticState + the whole
// frontend/js/ecs/owner/ dir) each (a) lived under ecs/ with an *Owner* name,
// (b) mounted themselves on globalThis.Ecs<Name>Owner, and (c) duplicated the
// host game-state slot. After 刀6 every host-state write routes through the
// single writer state/StateWriter.js. This guard fails the build (exit 1) when
// any of those recurrence signatures reappears.
//
// RULES (each is green on the current HEAD -- zero violations):
//   1) NO ecs owner shells: no file under frontend/js/ecs/owner/ and no
//      frontend/js/ecs/**/*Owner*.js (the deleted FogOwner/BattleOwner shape).
//      Projection/Store/etc. under ecs/ are fine -- only "Owner" filenames are
//      banned.
//   2) NO re-introduction of the deleted shell modules by basename anywhere
//      under frontend/js/ecs/: ModalWorld.js, BattleOwner.js, FogOwner.js,
//      WorldMarchOptimisticState.js.
//   3) NO globalThis.Ecs<Name>Owner / global.Ecs<Name>Owner mounts in
//      frontend/js -- the deleted shells mounted themselves this way.
//   4) SINGLE state-write point: production frontend code must not assign the
//      host game-state slot directly outside state/StateWriter.js. We match the
//      host-state receivers (host|lastGame|owner|app|game|shell|canvasShell).state =
//      and not `this.state =`, which is the legitimate "own this object's state"
//      pattern used by many classes. The receiver list is intentionally narrow
//      to stay low-false-positive; the allowlist below documents the only files
//      that legitimately assign their OWN distinct .state.
//   5) SINGLE territory UI owner router: production frontend code must not
//      rebind game/shell/controller territory UI mirrors directly. Creation,
//      normalization, and aliasing route through state/TerritoryUiStateStore.js.
//
// HONEST LIMIT: a fully general "zero-mirror" proof is NOT machine-provable --
// a determined author can mirror host state through an aliased local, a computed
// member, or a helper this regex cannot see. This guard catches the KNOWN
// recurrence signatures (the exact shapes the deleted shells used). The real
// backstop is the per-store characterization tests (StateWriter.test.js,
// BattleStore.test.js, ModalStore.test.js, the optimistic March*.test.js) that
// pin each store to a single owner; this guard exists so those gains cannot be
// regressed without a loud, intentional edit to the rules below.

const SOURCE_ROOTS = Object.freeze(['frontend/js']);
const ECS_ROOT = 'frontend/js/ecs';
const STATE_WRITER = 'frontend/js/state/StateWriter.js';
const TERRITORY_UI_STATE_STORE = 'frontend/js/state/TerritoryUiStateStore.js';

const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /(^|\/)vendor\//,
  /(^|\/)node_modules\//,
]);

// Rule 1: any file under ecs/ whose basename contains "Owner" is a banned shell.
const ECS_OWNER_BASENAME = /Owner.*\.js$/;
// Rule 1 (dir form): the deleted ecs/owner/ directory must stay gone.
const ECS_OWNER_DIR = `${ECS_ROOT}/owner/`;

// Rule 2: deleted shell modules, banned by basename anywhere under ecs/.
const RETIRED_SHELL_BASENAMES = Object.freeze([
  'ModalWorld.js',
  'BattleOwner.js',
  'FogOwner.js',
  'WorldMarchOptimisticState.js',
]);

// Rule 3: the shells mounted globalThis.Ecs<Name>Owner / global.Ecs<Name>Owner.
const GLOBAL_OWNER_MOUNT = /\bglobal(This)?\.Ecs\w*Owner\b/;

// Rule 4: direct host game-state assignment outside the single writer.
const HOST_STATE_RECEIVERS = Object.freeze([
  'host',
  'lastGame',
  'owner',
  'app',
  'game',
  'shell',
  'canvasShell',
]);
const HOST_STATE_WRITE = new RegExp(
  `\\b(?:${HOST_STATE_RECEIVERS.join('|')})\\.state\\s*=\\s*[^=]`,
);
const TERRITORY_UI_STATE_REBIND = /(?:\b(?:this|app|canvasShell|game|host|lastGame|owner|shell)\.territoryUiState|\bterritoryController\.uiState)\s*=\s*[^=]/;

// Allowlist for Rule 4: the ONLY production files that legitimately assign their
// own distinct .state slot. Documented per the CUT 9 spec.
const STATE_WRITE_ALLOWLIST = Object.freeze([
  // The single host-state writer itself -- this is the one place allowed to
  // assign the live owner's .state (`owner.state = next`).
  STATE_WRITER,
  // Its own last-result cache (`this.state = ...`); a distinct owner, not the
  // host game-state slot. Kept here to document the exemption even though it
  // uses `this.` (not in the receiver set) and so does not currently match.
  'frontend/js/state/GameStateManager.js',
  // Tutorial guide state (`this.state = ...`); a distinct owner, not the host
  // game-state slot. Same documentation note as above.
  'frontend/js/tutorial/TutorialGuideController.js',
]);
const TERRITORY_UI_STATE_ALLOWLIST = Object.freeze([
  TERRITORY_UI_STATE_STORE,
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

function isUnderEcs(filePath = '') {
  return normalizePath(filePath).startsWith(`${ECS_ROOT}/`);
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

// Rules 1 & 2 are pure path checks: they fire on the existence of a banned file
// regardless of whether it is a *.test.js (a shell re-introduced as a test
// fixture is still a re-introduction). Rule 4 scans production source only.
function findPathViolations(files) {
  const findings = [];
  files.forEach((file) => {
    const normalized = normalizePath(file);
    if (!normalized.endsWith('.js')) return;
    if (!isUnderEcs(normalized)) return;
    const base = path.posix.basename(normalized);
    // Rule 1 (dir): anything under ecs/owner/.
    if (normalized.startsWith(ECS_OWNER_DIR)) {
      findings.push({
        file: normalized,
        rule: 'ecs-owner-shell',
        symbol: 'ecs/owner/',
        evidence: normalized,
        note: 'the ecs/owner/ shell directory was deleted in cuts 1-7 and must stay gone',
      });
      return;
    }
    // Rule 2: deleted shell module by basename (checked before the generic
    // Owner-basename rule so the message points at the specific retired shell).
    if (RETIRED_SHELL_BASENAMES.includes(base)) {
      findings.push({
        file: normalized,
        rule: 'retired-shell-module',
        symbol: base,
        evidence: normalized,
        note: `${base} was a deleted single-source shell; do not re-introduce it under ecs/`,
      });
      return;
    }
    // Rule 1 (basename): any *Owner*.js under ecs/.
    if (ECS_OWNER_BASENAME.test(base)) {
      findings.push({
        file: normalized,
        rule: 'ecs-owner-shell',
        symbol: base,
        evidence: normalized,
        note: 'ecs/ *Owner*.js shells were deleted (FogOwner/BattleOwner pattern); use a Store/Projection instead',
      });
    }
  });
  return findings;
}

function findTextViolationsInFile(filePath, text = '') {
  const findings = [];
  const normalized = normalizePath(filePath);
  const allowStateWrite = STATE_WRITE_ALLOWLIST.includes(normalized);
  const allowTerritoryUiStateWrite = TERRITORY_UI_STATE_ALLOWLIST.includes(normalized);
  const lines = String(text || '').split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    if (isSkippableLine(rawLine)) return;
    const line = stripStringLiterals(stripLineComment(rawLine));
    const evidence = rawLine.trim().replace(/\s+/g, ' ');
    if (!evidence) return;

    // Rule 3: globalThis.Ecs<Name>Owner / global.Ecs<Name>Owner mount.
    if (GLOBAL_OWNER_MOUNT.test(line)) {
      findings.push({
        file: normalized,
        line: index + 1,
        rule: 'global-owner-mount',
        symbol: 'global.Ecs*Owner',
        evidence,
        note: 'the deleted shells mounted themselves on globalThis.Ecs<Name>Owner; this mount is banned',
      });
      return;
    }

    // Rule 4: direct host game-state assignment outside the single writer.
    if (!allowStateWrite && HOST_STATE_WRITE.test(line)) {
      findings.push({
        file: normalized,
        line: index + 1,
        rule: 'host-state-write',
        symbol: '<host>.state =',
        evidence,
        note: 'host game-state writes must route through state/StateWriter.js (single write point, 刀6)',
      });
    }
    if (!allowTerritoryUiStateWrite && TERRITORY_UI_STATE_REBIND.test(line)) {
      findings.push({
        file: normalized,
        line: index + 1,
        rule: 'territory-ui-state-rebind',
        symbol: '<host>.territoryUiState =',
        evidence,
        note: 'territory UI state owner aliasing must route through state/TerritoryUiStateStore.js; do not rebind shell/game/controller mirrors directly',
      });
    }
  });

  return findings;
}

function scanSingleSourceRedline(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const allFiles = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .sort();

  const pathViolations = findPathViolations(allFiles);

  const productionFiles = allFiles.filter(isProductionSource);
  const textViolations = productionFiles.flatMap((file) =>
    findTextViolationsInFile(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')),
  );

  const violations = [...pathViolations, ...textViolations];

  return {
    report: 'frontend-single-source-redline',
    mode: 'blocking',
    filesScanned: allFiles.length,
    productionFilesScanned: productionFiles.length,
    hostStateReceivers: HOST_STATE_RECEIVERS,
    retiredShellBasenames: RETIRED_SHELL_BASENAMES,
    stateWriteAllowlist: STATE_WRITE_ALLOWLIST,
    territoryUiStateAllowlist: TERRITORY_UI_STATE_ALLOWLIST,
    violations,
    summary: { totalViolations: violations.length },
  };
}

function renderText(report) {
  const lines = [
    '[frontend-single-source-redline] blocking gate',
    `files scanned: ${report.filesScanned}`,
    `production files scanned: ${report.productionFilesScanned}`,
    `host-state receivers: ${report.hostStateReceivers.join(', ')}`,
    `retired shell basenames: ${report.retiredShellBasenames.join(', ')}`,
    `state-write allowlist: ${report.stateWriteAllowlist.join(', ')}`,
    `territory-ui-state allowlist: ${report.territoryUiStateAllowlist.join(', ')}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length) {
    lines.push('', 'Blocked single-source redline regressions:');
    report.violations.forEach((violation) => {
      const where = violation.line ? `${violation.file}:${violation.line}` : violation.file;
      lines.push(`- [${violation.rule}] ${where} ${violation.symbol}: ${violation.evidence}`);
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
    const report = scanSingleSourceRedline();
    if (parseFormat() === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length) process.exit(1);
  } catch (error) {
    console.error(`[frontend-single-source-redline] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  ECS_OWNER_DIR,
  GLOBAL_OWNER_MOUNT,
  HOST_STATE_RECEIVERS,
  RETIRED_SHELL_BASENAMES,
  STATE_WRITE_ALLOWLIST,
  TERRITORY_UI_STATE_ALLOWLIST,
  findPathViolations,
  findTextViolationsInFile,
  parseFormat,
  renderText,
  scanSingleSourceRedline,
  stripStringLiterals,
};
