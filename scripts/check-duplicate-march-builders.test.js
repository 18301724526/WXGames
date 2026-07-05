const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  ALLOWLIST,
  findBespokeMarchBuildersInText,
  isScannableSource,
  scanDuplicateMarchBuilders,
} = require('./check-duplicate-march-builders');

const REPO_ROOT = path.resolve(__dirname, '..');

test('check-duplicate-march-builders passes on the current tree (march geometry is single-source)', () => {
  const report = scanDuplicateMarchBuilders({ repoRoot: REPO_ROOT });
  assert.equal(
    report.summary.totalViolations,
    0,
    `bespoke march stepping loop(s) found: ${report.violations
      .map((v) => `${v.file}:${v.line}`)
      .join(', ')}`,
  );
  assert.equal(report.canonical, 'shared/worldMarchCore.js');
  assert.ok(report.filesScanned > 0);
});

test('check-duplicate-march-builders flags a copied q/r stepping loop', () => {
  const findings = findBespokeMarchBuildersInText('frontend/js/state/optimistic/Copy.js', [
    'let remainingQ = end.q - start.q;',
    'let remainingR = end.r - start.r;',
    'const stepQ = Math.sign(remainingQ);',
  ].join('\n'));
  assert.equal(findings.length, 3);
  assert.equal(findings[0].line, 1);
  assert.match(findings[0].note, /delegate to WorldMarchCore/);
});

test('check-duplicate-march-builders does NOT flag a delegating wrapper', () => {
  // The optimistic entry point named buildLinearRoute is fine when it delegates.
  const findings = findBespokeMarchBuildersInText('frontend/js/state/optimistic/MarchCommandBuilder.js', [
    'function buildLinearRoute(origin = {}, target = {}, maxLength = 0) {',
    '  return WorldMarchCore.evaluateLinearMarchRoute(start, end, { axisAligned: true });',
    '}',
  ].join('\n'));
  assert.equal(findings.length, 0);
});

test('check-duplicate-march-builders scopes to source files and honors the allowlist', () => {
  assert.equal(isScannableSource('frontend/js/state/optimistic/MarchCommandBuilder.js'), true);
  assert.equal(isScannableSource('shared/worldMarchCore.js'), false); // canonical, allowlisted
  assert.equal(isScannableSource('frontend/js/shared/WorldMarchCoreAdapter.js'), false); // fallback mirror
  assert.equal(isScannableSource('frontend/js/ecs/runtime/EcsModeRuntimeBundle.js'), false); // generated
  assert.equal(isScannableSource('shared/worldMarchCore.test.js'), false); // test
  assert.equal(isScannableSource('frontend/js/vendor/spine-3.8/spine-webgl.js'), false); // vendor
  assert.ok(ALLOWLIST.includes('shared/worldMarchCore.js'));
});
