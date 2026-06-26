const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findBlockingPanelMirrorRetirementViolationsInText,
  parseFormat,
  scanBlockingPanelMirrorRetirement,
} = require('./check-frontend-ecs-blocking-panel-mirror-retirement');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-blocking-panel-retirement-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('blocking-panel mirror guard blocks host mirror writes and reads', () => {
  const findings = findBlockingPanelMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasShellActionHandlers.js',
    [
      'this.showSettings = true;',
      'this.host.showCitySwitcher = false;',
      "game.activeCommandPanel = 'tech';",
      'game.canvasShell.techDetailOpen = false;',
      'if (this.showFamousPersons) return true;',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => [finding.kind, finding.symbol]),
    [
      ['mirror', 'panel'],
      ['mirror', 'panel'],
      ['mirror', 'panel'],
      ['mirror', 'panel'],
      ['mirror', 'panel'],
    ],
  );
});

test('blocking-panel mirror guard catches aliased and computed writes (receiver-agnostic)', () => {
  // The adapter's related-host fan-out uses aliased identifiers (target / relatedHost);
  // a regression that wrote a mirror through one must still be caught even though the
  // receiver is not a fixed mirror-host name.
  const findings = findBlockingPanelMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasSomeConsumer.js',
    [
      'target.showSettings = true;',
      'relatedHost.showTaskCenter = false;',
      "owner['showCitySwitcher'] = true;",
      "node['activeCommandPanel'] = 'tech';",
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => [finding.kind, finding.symbol]),
    [
      ['mirror', 'panel'],
      ['mirror', 'panel'],
      ['mirror', 'panel'],
      ['mirror', 'panel'],
    ],
  );
});

test('blocking-panel mirror guard does not flag comparisons or panel-fact assignments', () => {
  // Receiver-agnostic WRITE detection must not catch `===` comparisons or the
  // option-builder `showX: panel.showX` reads (a write needs `= ` not `==`/`:`).
  const findings = findBlockingPanelMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasGameShellRenderingRuntime.js',
    [
      'if (panel.showSettings === options.showSettings) return;',
      'showResourceDetails: panel.showResourceDetails,',
      "activeCommandPanel: panel.activeCommandPanel || '',",
    ].join('\n'),
  );

  assert.deepEqual(findings, []);
});

test('blocking-panel mirror guard flags a patch-mirror in a non-owner ecs file', () => {
  // The patch suppression is file-scoped to RendererSnapshotBoundary; a stray
  // `{ showX: false }` patch elsewhere under frontend/js/ecs/ must still be flagged.
  const findings = findBlockingPanelMirrorRetirementViolationsInText(
    'frontend/js/ecs/mode/SomeOtherModeFile.js',
    ['  showSettings: false,'].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => finding.kind),
    ['mirror'],
  );
});

test('blocking-panel mirror guard blocks the setIfChanged and patch-key idioms', () => {
  const findings = findBlockingPanelMirrorRetirementViolationsInText(
    'frontend/js/tutorial/TutorialGuideUiStateCoordinator.js',
    [
      "setIfChanged(host, 'showAdvisor', false);",
      'showCityManagement: false,',
      "activeCommandPanel: '',",
      'techDetailOpen: false,',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => finding.kind),
    ['mirror', 'mirror', 'mirror', 'mirror'],
  );
});

test('blocking-panel mirror guard allows adapter calls, snapshot, options, and panel reads', () => {
  const findings = findBlockingPanelMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasGameAppInputRouter.js',
    [
      "openBlockingPanelSnapshot(this.host, 'showSettings', true);",
      "this.host.closeBlockingPanelSnapshot('showTaskCenter');",
      "return this.isBlockingPanelSnapshotOpen('showCitySwitcher');",
      "if (this.getCommandPanelValue() === 'tech') return true;",
      'const panel = this.getRendererSnapshot()?.panel || {};',
      'showSettings: panel.showSettings,',
      'if (options.showGuidebook) this.renderGuidebook(options);',
      'if (snapshot.panel.showAdvisor) return false;',
      'techDetailOpen: panel.techDetailOpen || Boolean(this.state?.techUiState?.detailOpen),',
    ].join('\n'),
  );

  assert.deepEqual(findings, []);
});

test('blocking-panel mirror guard blocks retired bridge wrappers', () => {
  const findings = findBlockingPanelMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasCityActionHandlers.js',
    [
      "openBlockingPanelOwner(this.host, 'showCityManagement', true);",
      "closeBlockingPanelOwner(this.host, 'techDetailOpen');",
      'this.host.closeBlockingPanelsOwner?.(except);',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => finding.symbol),
    ['openBlockingPanelOwner', 'closeBlockingPanelOwner', 'closeBlockingPanelsOwner'],
  );
});

test('blocking-panel mirror guard suppresses PANEL_DEFAULTS declarations in the ECS owner', () => {
  const findings = findBlockingPanelMirrorRetirementViolationsInText(
    'frontend/js/ecs/snapshot/RendererSnapshotBoundary.js',
    ['  showSettings: false,', "  activeCommandPanel: '',", '  techDetailOpen: false,'].join('\n'),
  );

  assert.deepEqual(findings, []);
});

test('blocking-panel mirror guard scans production frontend files and excludes approved paths', () =>
  withTempRepo((repoRoot) => {
    writeFile(repoRoot, 'frontend/js/platform/Legacy.js', 'this.showSettings = true;\n');
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasModeOwnershipBridge.js',
      'showSettings: isOpen(),\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/Allowed.js',
      'const panel = this.getRendererSnapshot()?.panel; const x = panel.showSettings;\n',
    );
    writeFile(repoRoot, 'frontend/js/platform/Legacy.test.js', 'this.showSettings = true;\n');

    const report = scanBlockingPanelMirrorRetirement({ repoRoot });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'frontend/js/platform/Legacy.js');
  }));

test('blocking-panel mirror guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
