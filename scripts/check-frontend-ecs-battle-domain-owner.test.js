const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findBattleSceneMirrorAccessInText,
  findBattleDomainWritesInText,
  isApprovedPath,
  isGrandfatheredPath,
  parseFormat,
  scanBattleDomainOwner,
} = require('./check-frontend-ecs-battle-domain-owner');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-battle-domain-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('battle domain owner guard allows approved owner and canonical adapter paths', () => {
  assert.equal(isApprovedPath('frontend/js/ecs/domain/BattleDomainOwner.js'), true);
  assert.equal(isApprovedPath('frontend/js/platform/CanvasGameAppBattleScene.js'), true);
  assert.equal(isApprovedPath('frontend/js/platform/CanvasGameAppRenderingRuntime.js'), false);
  assert.equal(isGrandfatheredPath('frontend/js/platform/CanvasGameShellSystemUi.js'), false);
});

test('battle domain owner guard blocks non-owner canonical writes', () => {
  const findings = findBattleDomainWritesInText(
    'frontend/js/platform/CanvasGameAppRenderingRuntime.js',
    [
      'this.battleScene = { visible: true };',
      'canvasShell.entityBattle = session;',
      'const readOnly = this.entityBattle;',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => finding.symbol),
    ['entityBattle'],
  );
});

test('battle domain owner guard blocks removed battleScene mirror reads and writes', () => {
  const findings = findBattleSceneMirrorAccessInText(
    'frontend/js/platform/CanvasGameAppRenderingRuntime.js',
    [
      'this.battleScene = { visible: true };',
      'const removed = this.battleScene;',
      'const shellRemoved = lastGame?.battleScene?.visible;',
      'const localBattleScene = snapshot.battle.battleScene;',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => [finding.symbol, finding.access]),
    [
      ['battleScene', 'write'],
      ['battleScene', 'read'],
      ['battleScene', 'read'],
    ],
  );
});

test('battle domain owner guard scans production frontend files', () =>
  withTempRepo((repoRoot) => {
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasGameAppRenderingRuntime.js',
      'this.battleScene = { visible: true };\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasGameShellSystemUi.js',
      'this.battleScene = { visible: true };\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasGameAppBattleScene.js',
      'this.battleScene = { visible: true };\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasGameAppRenderingRuntime.test.js',
      'this.battleScene = { visible: true };\n',
    );

    const report = scanBattleDomainOwner({ repoRoot });
    assert.equal(report.summary.totalViolations, 3);
    assert.deepEqual(report.violations.map((violation) => violation.file).sort(), [
      'frontend/js/platform/CanvasGameAppBattleScene.js',
      'frontend/js/platform/CanvasGameAppRenderingRuntime.js',
      'frontend/js/platform/CanvasGameShellSystemUi.js',
    ]);
  }));

test('battle domain owner guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
