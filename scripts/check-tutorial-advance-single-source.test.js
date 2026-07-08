const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  ALLOWLIST_DIR_PREFIXES,
  findTutorialStateConstructionsInText,
  isScannableSource,
  parseFormat,
  scanTutorialAdvanceSingleSource,
} = require('./check-tutorial-advance-single-source');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-advance-single-source-'));
  try {
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('tutorial-advance guard flags a hand-built phaseCompleted object key', () => {
  const findings = findTutorialStateConstructionsInText(
    'backend/services/MilitaryService.js',
    [
      'return {',
      '  ...tutorial,',
      '  currentStep: step,',
      '  phaseCompleted: { ...(tutorial.phaseCompleted || {}), era2: true },',
      '};',
    ].join('\n'),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 4);
});

test('tutorial-advance guard ignores phaseCompleted member reads', () => {
  const findings = findTutorialStateConstructionsInText(
    'backend/services/MilitaryService.js',
    [
      'const done = tutorial.phaseCompleted?.era2;',
      'const next = cond ? tutorial.phaseCompleted : null;',
      'const tutorial = manualAdvance(gameState.tutorial, step);',
    ].join('\n'),
  );
  assert.deepEqual(findings, []);
});

test('tutorial-advance guard exempts the canonical tutorial modules and tests', () => {
  assert.ok(ALLOWLIST_DIR_PREFIXES.includes('backend/services/tutorial/'));
  assert.equal(isScannableSource('backend/services/tutorial/TutorialProgression.js'), false);
  assert.equal(isScannableSource('backend/services/tutorial/TutorialState.js'), false);
  assert.equal(isScannableSource('backend/services/MilitaryService.js'), true);
  assert.equal(isScannableSource('backend/services/TaskCenterService.test.js'), false);
});

test('tutorial-advance guard scans backend production files, skipping tutorial dir + tests', () =>
  withTempRepo((repoRoot) => {
    writeFile(repoRoot, 'backend/services/Bad.js', '  phaseCompleted: { era2: true },\n');
    writeFile(repoRoot, 'backend/services/Good.js', 'const t = manualAdvance(tutorial, step);\n');
    writeFile(
      repoRoot,
      'backend/services/tutorial/TutorialState.js',
      '  phaseCompleted: createPhaseCompleted(step),\n',
    );
    writeFile(repoRoot, 'backend/services/Bad.test.js', '  phaseCompleted: { era2: true },\n');

    const report = scanTutorialAdvanceSingleSource({ repoRoot });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'backend/services/Bad.js');
  }));

test('tutorial-advance guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
