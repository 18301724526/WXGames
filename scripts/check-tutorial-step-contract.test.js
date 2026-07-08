'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  CANONICAL,
  TABLE_ALLOWLIST,
  findStepContractViolationsInText,
  scanTutorialStepContract,
  parseFormat,
} = require('./check-tutorial-step-contract');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-step-contract-'));
  try {
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('flags a re-declared step-name -> number table', () => {
  const findings = findStepContractViolationsInText(
    'frontend/js/state/presenters/Foo.js',
    [
      'const tutorialSteps = {',
      '  houseGuideReady: 3,',
      '  houseBuilt: 4,',
      '  lumbermillBuilt: 15,',
      '};',
    ].join('\n'),
  );
  assert.deepEqual(
    findings.map((finding) => finding.kind),
    ['step-name-number-table', 'step-name-number-table', 'step-name-number-table'],
  );
});

test('flags a reverse number -> step-name table', () => {
  const findings = findStepContractViolationsInText(
    'scripts/some-playtest.js',
    ["const STEP_NAMES = { 0: 'initial', 22: 'scoutFormationSaved' };"].join('\n'),
  );
  assert.equal(
    findings.some((finding) => finding.kind === 'number-step-name-table'),
    true,
  );
});

test('flags relational comparisons against TUTORIAL_STEPS and .currentStep', () => {
  const findings = findStepContractViolationsInText(
    'backend/services/Foo.js',
    [
      'if (step < TUTORIAL_STEPS.houseBuilt) return false;',
      'if (step >= tutorialSteps.farmBuilt) return true;',
      'if (tutorial.currentStep <= 22) return true;',
      'if (22 > tutorial.currentStep) return true;',
      'const step = Math.floor(Number(tutorial.currentStep) || 0);',
    ].join('\n'),
  );
  assert.deepEqual(
    findings.map((finding) => finding.kind),
    [
      'relational-vs-tutorial-steps',
      'relational-vs-tutorial-steps',
      'relational-vs-current-step',
      'relational-vs-current-step',
      'numeric-math-on-current-step',
    ],
  );
});

test('allows helper usage, arrow functions, generic keys, and comments', () => {
  const findings = findStepContractViolationsInText(
    'frontend/js/platform/Bar.js',
    [
      'if (stepBefore(tutorial.currentStep, TUTORIAL_STEPS.houseBuilt)) return false;',
      'if (TutorialFlowShared.compareSteps(next, state.currentStep) <= 0) return state;',
      'const pick = (host) => host.tutorial?.currentStep;',
      'onProgress?.({ total: 0, completed: 0, loaded: 0, failed: 0 });',
      'const anim = { initial: 0, from: 1 };',
      '// step < TUTORIAL_STEPS.houseBuilt (historical comment)',
    ].join('\n'),
  );
  assert.deepEqual(findings, []);
});

test('the canonical module and thin readers may declare the table; others may not', () =>
  withTempRepo((repoRoot) => {
    const table = 'const T = {\n  houseBuilt: 4,\n  farmBuilt: 9,\n};\n';
    writeFile(repoRoot, CANONICAL, table);
    writeFile(repoRoot, 'backend/config/TutorialFlowConfig.js', table);
    writeFile(repoRoot, 'frontend/js/tutorial/TutorialGuideStepPolicy.js', table);
    writeFile(repoRoot, 'frontend/js/state/presenters/Violating.js', table);

    const report = scanTutorialStepContract({ repoRoot });

    assert.equal(report.summary.totalViolations, 2);
    assert.deepEqual(
      report.violations.map((violation) => violation.file),
      ['frontend/js/state/presenters/Violating.js', 'frontend/js/state/presenters/Violating.js'],
    );
  }));

test('test files are excluded from the scan', () =>
  withTempRepo((repoRoot) => {
    writeFile(
      repoRoot,
      'backend/tests/Legacy.test.js',
      'const T = { houseBuilt: 4 };\nif (step < TUTORIAL_STEPS.houseBuilt) {}\n',
    );

    const report = scanTutorialStepContract({ repoRoot });

    assert.equal(report.summary.totalViolations, 0);
  }));

test('passes against the real repo', () => {
  const report = scanTutorialStepContract();
  assert.equal(report.summary.totalViolations, 0);
});

test('allowlist covers exactly the canonical module and its two thin readers', () => {
  assert.deepEqual(
    [...TABLE_ALLOWLIST],
    [
      'shared/tutorialFlowConfig.js',
      'backend/config/TutorialFlowConfig.js',
      'frontend/js/tutorial/TutorialGuideStepPolicy.js',
    ],
  );
});

test('rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--nope']), /unknown arguments/);
});
