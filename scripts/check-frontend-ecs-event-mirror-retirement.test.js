const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findEventMirrorRetirementViolationsInText,
  parseFormat,
  scanEventMirrorRetirement,
} = require('./check-frontend-ecs-event-mirror-retirement');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-event-retirement-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('event mirror retirement guard blocks host mirror writes and reads', () => {
  const findings = findEventMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasCityActionHandlers.js',
    [
      'this.activeEventId = null;',
      'this.host.activeEventId = null;',
      'game.activeEventId = null;',
      'game.canvasShell.activeEventId = null;',
      "const id = snapshot.modal['modal:event'];",
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => [finding.kind, finding.symbol]),
    [
      ['mirror', 'activeEventId'],
      ['mirror', 'activeEventId'],
      ['mirror', 'activeEventId'],
      ['mirror', 'activeEventId'],
    ],
  );
});

test('event mirror retirement guard blocks the setIfChanged and patch-key idioms', () => {
  const findings = findEventMirrorRetirementViolationsInText(
    'frontend/js/tutorial/TutorialGuideController.js',
    [
      "setIfChanged(game, 'activeEventId', null);",
      "setIfChanged(shell, 'activeEventId', null);",
      'activeEventId: null,',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => [finding.kind, finding.symbol]),
    [
      ['mirror', 'activeEventId'],
      ['mirror', 'activeEventId'],
      ['mirror', 'activeEventId'],
    ],
  );
});

test('event mirror retirement guard allows cursor, options, snapshot, and string-token reads', () => {
  const findings = findEventMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasCityActionHandlers.js',
    [
      'return this.game?.eventController?.activeEventId || "";',
      'if (options.activeEventId) this.renderEventModal(state, options.activeEventId);',
      'renderEventModal(state = {}, activeEventId = null) {',
      "this.closePanels(['activeEventId']);",
      "if (!keep.has('activeEventId')) this.host?.closeEventSnapshot?.();",
      'activeEventId: snapshotEvent?.eventId ?? null,',
      'const id = this.game?.getEventSnapshot?.()?.eventId || "";',
    ].join('\n'),
  );

  assert.deepEqual(findings, []);
});

test('event mirror retirement guard blocks retired bridge wrappers', () => {
  const findings = findEventMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasModeOwnershipBridge.js',
    [
      'openEventModal(eventId) { return this.openModal(eventId); }',
      'this.closeEventOwner?.();',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => finding.symbol),
    ['openEventModal', 'closeEventOwner'],
  );
});

test('event mirror retirement guard scans production frontend files but excludes the EventController cursor', () =>
  withTempRepo((repoRoot) => {
    writeFile(repoRoot, 'frontend/js/platform/Legacy.js', 'this.activeEventId = null;\n');
    writeFile(
      repoRoot,
      'frontend/js/controllers/EventController.js',
      'this.activeEventId = eventId;\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/Allowed.js',
      "const x = snapshot.modal['modal:event'];\n",
    );
    writeFile(repoRoot, 'frontend/js/platform/Legacy.test.js', 'this.activeEventId = null;\n');

    const report = scanEventMirrorRetirement({ repoRoot });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'frontend/js/platform/Legacy.js');
  }));

test('event mirror retirement guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
