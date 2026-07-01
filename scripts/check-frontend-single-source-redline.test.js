const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findPathViolations,
  findTextViolationsInFile,
  parseFormat,
  scanSingleSourceRedline,
  TERRITORY_UI_STATE_ALLOWLIST,
} = require('./check-frontend-single-source-redline');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'single-source-redline-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

// ---- Rule 1: ecs owner shells -------------------------------------------------

test('rule 1 catches *Owner*.js under ecs/ and the ecs/owner/ directory', () => {
  const findings = findPathViolations([
    'frontend/js/ecs/owner/BattleOwner.js',
    'frontend/js/ecs/projection/FogOwner.js',
    'frontend/js/ecs/state/SomeOwnerThing.js',
  ]);
  const byRule = findings.map((finding) => [finding.rule, finding.symbol]);
  assert.deepEqual(byRule, [
    ['ecs-owner-shell', 'ecs/owner/'],
    ['retired-shell-module', 'FogOwner.js'],
    ['ecs-owner-shell', 'SomeOwnerThing.js'],
  ]);
});

test('rule 1 passes clean Store/Projection filenames under ecs/', () => {
  const findings = findPathViolations([
    'frontend/js/ecs/state/BattleStore.js',
    'frontend/js/ecs/projection/FogProjection.js',
    'frontend/js/state/StateWriter.js',
  ]);
  assert.deepEqual(findings, []);
});

// ---- Rule 2: deleted shell modules by basename --------------------------------

test('rule 2 catches re-introduced deleted shell modules by basename', () => {
  const findings = findPathViolations([
    'frontend/js/ecs/mode/ModalWorld.js',
    'frontend/js/ecs/state/WorldMarchOptimisticState.js',
  ]);
  assert.deepEqual(
    findings.map((finding) => [finding.rule, finding.symbol]),
    [
      ['retired-shell-module', 'ModalWorld.js'],
      ['retired-shell-module', 'WorldMarchOptimisticState.js'],
    ],
  );
});

test('rule 2 ignores same-named modules outside ecs/', () => {
  const findings = findPathViolations([
    'frontend/js/state/optimistic/MarchOptimisticState.test.js',
    'frontend/js/platform/ModalCallbackRegistry.js',
  ]);
  assert.deepEqual(findings, []);
});

// ---- Rule 3: globalThis.Ecs<Name>Owner mount ---------------------------------

test('rule 3 catches globalThis/global Ecs*Owner mounts', () => {
  const findings = findTextViolationsInFile(
    'frontend/js/ecs/state/BattleStore.js',
    ['globalThis.EcsBattleOwner = api;', 'global.EcsFogOwner = makeOwner();'].join('\n'),
  );
  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ['global-owner-mount', 'global-owner-mount'],
  );
});

test('rule 3 passes legitimate global store mounts', () => {
  const findings = findTextViolationsInFile(
    'frontend/js/state/StateWriter.js',
    [
      'global.StateWriter = api;',
      'globalThis.BattleStore = store;',
      'globalThis.EcsModeRuntime = bundle;',
    ].join('\n'),
  );
  assert.deepEqual(findings, []);
});

// ---- Rule 4: single host-state write point ------------------------------------

test('rule 4 catches direct host game-state assignment outside StateWriter', () => {
  const findings = findTextViolationsInFile(
    'frontend/js/platform/CanvasGameApp.js',
    ['host.state = nextState;', 'this.lastGame.state = patch;', 'app.state = { currentTab };'].join(
      '\n',
    ),
  );
  assert.deepEqual(
    findings.map((finding) => [finding.rule, finding.line]),
    [
      ['host-state-write', 1],
      ['host-state-write', 2],
      ['host-state-write', 3],
    ],
  );
});

test('rule 4 allows the single writer and own-state (this.state) assignments', () => {
  const writerFindings = findTextViolationsInFile(
    'frontend/js/state/StateWriter.js',
    'owner.state = next;\n',
  );
  assert.deepEqual(writerFindings, []);

  const ownStateFindings = findTextViolationsInFile(
    'frontend/js/state/GameStateManager.js',
    'this.state = state;\n',
  );
  assert.deepEqual(ownStateFindings, []);

  // `this.state =` is the own-state pattern and is not in the receiver set, so
  // it does not trip the rule even in a non-allowlisted file.
  const arbitraryThis = findTextViolationsInFile(
    'frontend/js/platform/SomePresenter.js',
    'this.state = computeState();\n',
  );
  assert.deepEqual(arbitraryThis, []);
});

test('rule 4 allows .state comparisons and reads (only assignments fire)', () => {
  const findings = findTextViolationsInFile(
    'frontend/js/platform/CanvasGameApp.js',
    [
      'if (host.state === next) return;',
      'const current = app.state;',
      'return game.state == null;',
    ].join('\n'),
  );
  assert.deepEqual(findings, []);
});

// ---- Rule 5: single territory UI state owner router ---------------------------

test('rule 5 catches direct territory UI state rebinding outside the store', () => {
  const findings = findTextViolationsInFile(
    'frontend/js/platform/CanvasTerritoryActionHandlers.js',
    [
      'game.territoryUiState = {};',
      'shell.territoryUiState = nextState;',
      'territoryController.uiState = state;',
    ].join('\n'),
  );
  assert.deepEqual(
    findings.map((finding) => [finding.rule, finding.line]),
    [
      ['territory-ui-state-rebind', 1],
      ['territory-ui-state-rebind', 2],
      ['territory-ui-state-rebind', 3],
    ],
  );
});

test('rule 5 allows the territory UI state store as the only rebinding point', () => {
  assert.deepEqual(TERRITORY_UI_STATE_ALLOWLIST, ['frontend/js/state/TerritoryUiStateStore.js']);
  const findings = findTextViolationsInFile(
    'frontend/js/state/TerritoryUiStateStore.js',
    [
      'owner.territoryUiState = createInitialState();',
      'shell.territoryUiState = uiState;',
      'controller.uiState = uiState;',
    ].join('\n'),
  );
  assert.deepEqual(findings, []);
});

test('rule 5 allows territory UI state reads and in-place field writes', () => {
  const findings = findTextViolationsInFile(
    'frontend/js/platform/CanvasTerritoryActionHandlers.js',
    [
      'const uiState = this.getSharedTerritoryUiState();',
      'uiState.worldMarchTarget = nextTarget;',
      'const selected = shell.territoryUiState?.selectedSiteId;',
      'if (game.territoryUiState === ownerUiState) return;',
    ].join('\n'),
  );
  assert.deepEqual(findings, []);
});

// ---- end-to-end scan over a temp repo -----------------------------------------

test('full scan is clean on a well-formed fixture tree', () =>
  withTempRepo((repoRoot) => {
    writeFile(repoRoot, 'frontend/js/state/StateWriter.js', 'owner.state = next;\n');
    writeFile(repoRoot, 'frontend/js/state/TerritoryUiStateStore.js', 'owner.territoryUiState = next;\n');
    writeFile(repoRoot, 'frontend/js/state/BattleStore.js', 'globalThis.BattleStore = store;\n');
    writeFile(repoRoot, 'frontend/js/ecs/projection/FogProjection.js', 'module.exports = {};\n');
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasGameApp.js',
      'StateWriter.commit(host, next);\nthis.state = local;\n',
    );

    const report = scanSingleSourceRedline({ repoRoot });
    assert.equal(report.summary.totalViolations, 0);
  }));

test('full scan flags one violation per recurrence signature in a temp repo', () =>
  withTempRepo((repoRoot) => {
    // Rule 1 + Rule 2 (path-based).
    writeFile(repoRoot, 'frontend/js/ecs/owner/BattleOwner.js', '// shell\n');
    writeFile(repoRoot, 'frontend/js/ecs/mode/ModalWorld.js', '// shell\n');
    writeFile(repoRoot, 'frontend/js/ecs/projection/SomeOwner.js', '// shell\n');
    // Rule 3 (text-based).
    writeFile(repoRoot, 'frontend/js/platform/Mount.js', 'globalThis.EcsBattleOwner = api;\n');
    // Rule 4 (text-based).
    writeFile(repoRoot, 'frontend/js/platform/Writer.js', 'host.state = next;\n');
    // Rule 5 (text-based).
    writeFile(repoRoot, 'frontend/js/platform/TerritoryMirror.js', 'shell.territoryUiState = next;\n');

    const report = scanSingleSourceRedline({ repoRoot });
    const rules = report.violations.map((violation) => violation.rule).sort();
    // BattleOwner.js under ecs/owner/ -> ecs-owner-shell (dir rule);
    // ModalWorld.js -> retired-shell-module; SomeOwner.js -> ecs-owner-shell
    // (basename rule); plus the global mount and the host-state write.
    assert.deepEqual(rules, [
      'ecs-owner-shell',
      'ecs-owner-shell',
      'global-owner-mount',
      'host-state-write',
      'retired-shell-module',
      'territory-ui-state-rebind',
    ]);
  }));

test('full scan ignores host-state writes inside *.test.js fixtures', () =>
  withTempRepo((repoRoot) => {
    writeFile(repoRoot, 'frontend/js/platform/Foo.test.js', 'app.state = { id: 1 };\n');
    const report = scanSingleSourceRedline({ repoRoot });
    assert.equal(report.summary.totalViolations, 0);
  }));

test('cli flag parsing accepts --json and rejects unknown flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
