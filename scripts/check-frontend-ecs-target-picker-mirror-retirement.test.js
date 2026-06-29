const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findTargetPickerMirrorRetirementViolationsInText,
  parseFormat,
  scanTargetPickerMirrorRetirement,
} = require('./check-frontend-ecs-target-picker-mirror-retirement');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-target-picker-retirement-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('targetPicker mirror retirement guard blocks host worldTargetPicker writes including null clears', () => {
  const findings = findTargetPickerMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasTerritoryActionHandlers.js',
    [
      'uiState.worldTargetPicker = picker;',
      'this.host.territoryUiState.worldTargetPicker = null;',
      'game.territoryUiState.worldTargetPicker = null;',
      'this.getSharedTerritoryUiState().worldTargetPicker = null;',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => [finding.kind, finding.symbol]),
    [
      ['mirror', 'worldTargetPicker'],
      ['mirror', 'worldTargetPicker'],
      ['mirror', 'worldTargetPicker'],
      ['mirror', 'worldTargetPicker'],
    ],
  );
});

test('targetPicker mirror retirement guard blocks pickerOpen modal-flag writes and literals', () => {
  const findings = findTargetPickerMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasTerritoryActionHandlers.js',
    [
      'const nextTarget = { q, r, pickerOpen: false };',
      'mirror.worldMarchTarget = { ...target, pickerOpen: true };',
      'uiState.worldMarchTarget.pickerOpen = false;',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => [finding.kind, finding.symbol]),
    [
      ['mirror', 'worldMarchTarget.pickerOpen'],
      ['mirror', 'worldMarchTarget.pickerOpen'],
      ['mirror', 'worldMarchTarget.pickerOpen'],
    ],
  );
});

test('targetPicker mirror retirement guard blocks the retired bridge wrappers', () => {
  const findings = findTargetPickerMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasModeOwnershipRuntime.js',
    [
      'function openWorldTargetPickerOwner(host, uiState, picker) {}',
      'function openWorldMarchFormationPickerOwner(host, uiState, target) {}',
      'function closeTargetPickerOwner(host, uiState) {}',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => finding.symbol),
    ['openWorldTargetPickerOwner', 'openWorldMarchFormationPickerOwner', 'closeTargetPickerOwner'],
  );
});

test('targetPicker mirror retirement guard allows snapshot, target, label, and ecs reads', () => {
  const findings = findTargetPickerMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasTerritoryActionHandlers.js',
    [
      'const picker = this.getTargetPickerSnapshot()?.picker || {};',
      "if (!openTargetPickerSnapshot(this.host, { pickerKind: 'worldTargetPicker', picker })) return false;",
      'closeTargetPickerSnapshot(this.host);',
      'uiState.worldMarchTarget = nextTarget;',
      'uiState.worldMarchTarget = null;',
      'const target = options.targetPicker || null;',
      'const open = Boolean(uiState?.worldTargetPicker);',
      'pickerOpen: Boolean(target.pickerOpen),',
      "keys.push('modal:targetPicker');",
      "label: t('world.targetPicker.kind.actor'),",
    ].join('\n'),
  );

  assert.deepEqual(findings, []);
});

test('targetPicker mirror retirement guard scans production frontend files but excludes TerritoryController', () =>
  withTempRepo((repoRoot) => {
    writeFile(repoRoot, 'frontend/js/platform/Legacy.js', 'uiState.worldTargetPicker = null;\n');
    writeFile(
      repoRoot,
      'frontend/js/controllers/TerritoryController.js',
      'this.uiState.worldTargetPicker = null;\n',
    );
    writeFile(repoRoot, 'frontend/js/platform/Allowed.js', "keys.push('modal:targetPicker');\n");
    writeFile(
      repoRoot,
      'frontend/js/platform/Legacy.test.js',
      'uiState.worldTargetPicker = null;\n',
    );

    const report = scanTargetPickerMirrorRetirement({ repoRoot });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'frontend/js/platform/Legacy.js');
  }));

test('targetPicker mirror retirement guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
