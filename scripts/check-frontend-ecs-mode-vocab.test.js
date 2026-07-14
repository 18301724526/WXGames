const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CANONICAL_PANEL_KEYS,
  findVocabViolations,
  scanModeVocab,
  parseFormat,
} = require('./check-frontend-ecs-mode-vocab');

const canonical = {
  MODE_KEYS: ['boot', 'modal:a', 'modal:commandPanel'],
  MODAL_MODE_KEYS: ['modal:a', 'modal:commandPanel'],
  BASE_MODE_KEYS: ['boot'],
  CAPTURE_PRIORITY: ['modal:a', 'modal:commandPanel', 'boot'],
};

function cleanActual() {
  return {
    modeKeys: [...canonical.MODE_KEYS],
    modalSubtypes: ['modal:commandPanel', 'modal:a'],
    blockingModalKeys: ['modal:a'],
    panelKeys: [...CANONICAL_PANEL_KEYS],
  };
}

test('no violations when every derived list matches the canonical', () => {
  assert.deepEqual(findVocabViolations(cleanActual(), canonical), []);
});

test('flags a drifted manifest modeKeys list (order/content)', () => {
  const actual = cleanActual();
  actual.modeKeys = [...canonical.MODE_KEYS, 'modal:extra'];
  const checks = findVocabViolations(actual, canonical).map((v) => v.check);
  assert.ok(checks.includes('EcsBoundaryManifest.modeKeys'));
});

test('flags a blocking-modal set that wrongly includes the non-blocking modal', () => {
  const actual = cleanActual();
  actual.blockingModalKeys = ['modal:a', 'modal:commandPanel'];
  const checks = findVocabViolations(actual, canonical).map((v) => v.check);
  assert.ok(checks.includes('ModeResolver.BLOCKING_MODAL_KEYS'));
});

test('flags a renamed panel key', () => {
  const actual = cleanActual();
  actual.panelKeys = [...CANONICAL_PANEL_KEYS.slice(0, -1), 'showTechDetailRenamed'];
  const checks = findVocabViolations(actual, canonical).map((v) => v.check);
  assert.ok(checks.includes('RendererSnapshotBoundary.PANEL_KEYS'));
});

test('the REAL ecs modules are in sync (0 violations)', () => {
  const report = scanModeVocab();
  assert.equal(report.summary.totalViolations, 0);
});

test('rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--x']), /unknown arguments/);
});
