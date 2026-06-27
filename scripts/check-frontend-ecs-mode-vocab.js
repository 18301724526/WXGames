'use strict';

const path = require('node:path');

// Blocking gate: the ECS mode-key vocabulary has ONE canonical source --
// frontend/js/ecs/mode/ModeKeys.js. Four other lists were hand-maintained copies
// that silently drifted ("edit one, forget the others"):
//   - EcsBoundaryManifest.modeKeys      (must equal MODE_KEYS, order-sensitive:
//                                         MODE_ID_BY_KEY is index-based, so order
//                                         is load-bearing for modalMask persistence)
//   - RendererSnapshotBoundary.MODAL_SUBTYPES   (set-equal MODAL_MODE_KEYS)
//   - ModeResolver.BLOCKING_MODAL_KEYS          (MODAL_MODE_KEYS minus the
//                                                deliberately non-blocking set)
//   - ModeKeys.CAPTURE_PRIORITY                 (a permutation of BASE+MODAL; its
//                                                ORDER is semantic so we can only
//                                                assert completeness, not order)
//   - RendererSnapshotBoundary.PANEL_KEYS       (the 12 panel-tier view keys)
// This guard re-derives the expectations from the canonical and fails on any drift.

// Modals that are intentionally NON-blocking (commandPanel carries a payload and is
// handled separately). If another conditional-blocking modal is added, update here.
const NON_BLOCKING_MODAL_KEYS = Object.freeze(['modal:commandPanel']);

// The 12 panel-tier view keys, in canonical order. Locked so a panel cannot be
// added/removed/renamed without a conscious edit here (which forces the matching
// ModeKeys subtype + snapshot wiring to be reviewed together).
const CANONICAL_PANEL_KEYS = Object.freeze([
  'showSettings',
  'showLogs',
  'showResourceDetails',
  'showCitySwitcher',
  'showSubcityList',
  'showCityManagement',
  'showAdvisor',
  'showTaskCenter',
  'showGuidebook',
  'showFamousPersons',
  'activeCommandPanel',
  'techDetailOpen',
]);

function arrayEqual(a, b) {
  return (
    Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i])
  );
}

function setEqual(a, b) {
  return arrayEqual([...a].sort(), [...b].sort());
}

// Pure check: given the four derived lists + the canonical lists, return violations.
function findVocabViolations(actual, canonical) {
  const violations = [];
  const push = (check, detail) => violations.push({ check, detail });

  if (!arrayEqual(actual.modeKeys, canonical.MODE_KEYS)) {
    push(
      'EcsBoundaryManifest.modeKeys',
      `must deep-equal ModeKeys.MODE_KEYS in order (got ${actual.modeKeys.length} keys vs ${canonical.MODE_KEYS.length})`,
    );
  }
  if (!setEqual(actual.modalSubtypes, canonical.MODAL_MODE_KEYS)) {
    push(
      'RendererSnapshotBoundary.MODAL_SUBTYPES',
      `must be the same SET as ModeKeys.MODAL_MODE_KEYS (got ${actual.modalSubtypes.length} vs ${canonical.MODAL_MODE_KEYS.length})`,
    );
  }
  const expectedBlocking = canonical.MODAL_MODE_KEYS.filter(
    (k) => !NON_BLOCKING_MODAL_KEYS.includes(k),
  );
  if (!setEqual(actual.blockingModalKeys, expectedBlocking)) {
    push(
      'ModeResolver.BLOCKING_MODAL_KEYS',
      `must equal MODAL_MODE_KEYS minus [${NON_BLOCKING_MODAL_KEYS.join(', ')}] (got ${actual.blockingModalKeys.length} vs ${expectedBlocking.length})`,
    );
  }
  const baseAndModal = [...canonical.BASE_MODE_KEYS, ...canonical.MODAL_MODE_KEYS];
  if (!setEqual(canonical.CAPTURE_PRIORITY, baseAndModal)) {
    push(
      'ModeKeys.CAPTURE_PRIORITY',
      `must be a permutation of BASE+MODAL keys (got ${canonical.CAPTURE_PRIORITY.length} vs ${baseAndModal.length}) -- a base/modal key is missing or extra`,
    );
  }
  if (!arrayEqual(actual.panelKeys, CANONICAL_PANEL_KEYS)) {
    push(
      'RendererSnapshotBoundary.PANEL_KEYS',
      `must deep-equal the locked 12-panel list (got [${actual.panelKeys.join(', ')}])`,
    );
  }
  return violations;
}

function loadModules(repoRoot = process.cwd()) {
  const r = (rel) => require(path.join(repoRoot, rel));
  const ModeKeys = r('frontend/js/ecs/mode/ModeKeys');
  const ModeResolver = r('frontend/js/ecs/mode/ModeResolver');
  const RendererSnapshotBoundary = r('frontend/js/ecs/snapshot/RendererSnapshotBoundary');
  const EcsBoundaryManifest = r('frontend/js/ecs/registry/EcsBoundaryManifest');
  return {
    actual: {
      modeKeys: EcsBoundaryManifest.modeKeys,
      modalSubtypes: RendererSnapshotBoundary.MODAL_SUBTYPES,
      blockingModalKeys: ModeResolver.BLOCKING_MODAL_KEYS,
      panelKeys: RendererSnapshotBoundary.PANEL_KEYS,
    },
    canonical: {
      MODE_KEYS: ModeKeys.MODE_KEYS,
      MODAL_MODE_KEYS: ModeKeys.MODAL_MODE_KEYS,
      BASE_MODE_KEYS: ModeKeys.BASE_MODE_KEYS,
      CAPTURE_PRIORITY: ModeKeys.CAPTURE_PRIORITY,
    },
  };
}

function scanModeVocab({ repoRoot = process.cwd() } = {}) {
  const { actual, canonical } = loadModules(repoRoot);
  const violations = findVocabViolations(actual, canonical);
  return { summary: { totalViolations: violations.length }, violations };
}

function renderText(report) {
  const lines = [
    '[frontend-ecs-mode-vocab] blocking gate',
    `violations: ${report.summary.totalViolations}`,
  ];
  for (const v of report.violations) lines.push(`  ${v.check}: ${v.detail}`);
  lines.push(report.summary.totalViolations === 0 ? 'passed' : 'FAILED');
  return lines.join('\n');
}

function parseFormat(argv) {
  const rest = argv.filter((arg) => arg !== '--json');
  if (rest.length > 0) throw new Error(`unknown arguments: ${rest.join(', ')}`);
  return argv.includes('--json') ? 'json' : 'text';
}

if (require.main === module) {
  const format = parseFormat(process.argv.slice(2));
  const report = scanModeVocab();
  console.log(format === 'json' ? JSON.stringify(report, null, 2) : renderText(report));
  process.exit(report.summary.totalViolations === 0 ? 0 : 1);
}

module.exports = {
  NON_BLOCKING_MODAL_KEYS,
  CANONICAL_PANEL_KEYS,
  findVocabViolations,
  scanModeVocab,
  renderText,
  parseFormat,
};
