const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ADAPTER_FILE,
  inspectTutorialHostContextBoundary,
  scanTutorialHostBoundarySource,
} = require('./check-tutorial-host-context-boundary');

test('tutorial host context boundary accepts the live repo', () => {
  const report = inspectTutorialHostContextBoundary();
  assert.deepEqual(report.findings, []);
  assert.equal(report.adapterExemption, ADAPTER_FILE);
});

test('tutorial host context boundary FIRE: direct game and canvasShell access is blocked', () => {
  const findings = scanTutorialHostBoundarySource(
    'frontend/js/tutorial/SyntheticGuide.js',
    [
      'function probe(host, game, canvasShell) {',
      '  game.renderCanvasSurface();',
      '  canvasShell.hideTutorialHighlight();',
      '  return host.game.state.tutorial || host.canvasShell.tutorialHighlight;',
      '}',
    ].join('\n'),
  );

  assert.equal(findings.length, 4);
  assert.ok(findings.some((finding) => finding.access === 'game.renderCanvasSurface'));
  assert.ok(findings.some((finding) => finding.access === 'canvasShell.hideTutorialHighlight'));
  assert.ok(findings.some((finding) => finding.access === 'host.game.state.tutorial'));
  assert.ok(findings.some((finding) => finding.access === 'host.canvasShell.tutorialHighlight'));
});

test('tutorial host context boundary keeps the adapter as the only exemption', () => {
  const findings = scanTutorialHostBoundarySource(
    ADAPTER_FILE,
    'function allowed(game) { return game.state; }',
  );
  assert.deepEqual(findings, []);
});
