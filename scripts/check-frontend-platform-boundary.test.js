const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findNewViolations,
  findPlatformBoundaryFindingsInText,
  isAdapterPath,
  parseFormat,
  scanPlatformBoundary,
} = require('./check-frontend-platform-boundary');

test('platform boundary guard allows explicit platform adapter files', () => {
  assert.equal(isAdapterPath('frontend/js/platform/H5CanvasRuntime.js'), true);
  assert.equal(isAdapterPath('frontend/js/platform/PlatformRuntime.js'), true);
  assert.equal(isAdapterPath('frontend/js/platform/CanvasGameApp.js'), false);
});

test('platform boundary guard flags browser globals in shared frontend modules', () => {
  const findings = findPlatformBoundaryFindingsInText(
    'frontend/js/domain/Example.js',
    `
      const value = global.localStorage.getItem('x');
      fetch('/api');
    `,
  );

  assert.deepEqual(
    findings.map((finding) => finding.symbol),
    ['browser-storage', 'browser-network-global'],
  );
});

test('platform boundary guard ignores strings and comments', () => {
  const findings = findPlatformBoundaryFindingsInText(
    'frontend/js/domain/Example.js',
    `
      // global.localStorage.getItem('x')
      const label = "window.document";
    `,
  );

  assert.equal(findings.length, 0);
});

test('platform boundary guard compares findings against a baseline budget', () => {
  const findings = [
    { file: 'frontend/js/domain/Example.js', symbol: 'browser-storage' },
    { file: 'frontend/js/domain/Example.js', symbol: 'browser-storage' },
  ];
  const baseline = {
    'frontend/js/domain/Example.js#browser-storage': 1,
  };

  assert.equal(findNewViolations(findings, baseline).length, 1);
});

test('platform boundary guard passes against the current repository baseline', () => {
  const report = scanPlatformBoundary();

  assert.equal(report.summary.totalViolations, 0);
});

test('platform boundary guard rejects unknown CLI flags', () => {
  assert.throws(() => parseFormat(['--wat']), /unknown arguments/);
});
