'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  inspectGameTutorialAwareness,
  isProductionSource,
} = require('./check-game-tutorial-awareness');

function write(repoRoot, relativePath, source) {
  const absolute = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, source);
}

test('game tutorial awareness gate scans production JS and skips tests and declared boundaries', () => {
  assert.equal(isProductionSource('backend/services/GameService.js'), true);
  assert.equal(isProductionSource('frontend/js/platform/GameShell.js'), true);
  assert.equal(isProductionSource('backend/tests/TutorialService.test.js'), false);
  assert.equal(isProductionSource('backend/migrations/immutableGameStateMigrations.js'), false);
  assert.equal(isProductionSource('frontend/js/lib/tutorial-engine/Runtime.js'), false);
  assert.equal(isProductionSource('frontend/js/integrations/tutorial/WxGameAdapter.js'), false);
});

test('game tutorial awareness gate blocks tutorial symbols in game production code', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'game-tutorial-awareness-'));
  try {
    write(repoRoot, 'backend/services/GameService.js', 'const tutorialState = {};\n');
    write(repoRoot, 'frontend/js/platform/GameShell.js', 'const guidebook = {};\n');
    write(repoRoot, 'frontend/js/lib/tutorial-engine/Runtime.js', 'const tutorialCursor = {};\n');
    const report = inspectGameTutorialAwareness(repoRoot);
    assert.equal(report.violations.length, 1);
    assert.match(report.violations[0], /backend\/services\/GameService\.js:1/);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('game tutorial awareness gate reports a tutorial-named production file', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'game-tutorial-path-'));
  try {
    write(repoRoot, 'backend/services/TutorialBridge.js', 'module.exports = {};\n');
    const report = inspectGameTutorialAwareness(repoRoot);
    assert.deepEqual(report.violations, [
      'backend/services/TutorialBridge.js: path contains a tutorial symbol',
    ]);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});
