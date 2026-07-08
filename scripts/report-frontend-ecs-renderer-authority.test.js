const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  classifySurface,
  classifyTarget,
  findRendererAuthorityInText,
  isProductionFrontendSource,
  isRendererAuthoritySurface,
  parseFormat,
  scanRendererAuthority,
} = require('./report-frontend-ecs-renderer-authority');

test('renderer authority report scans renderer production surfaces only', () => {
  assert.equal(isProductionFrontendSource('frontend/js/platform/renderers/HudRenderer.js'), true);
  assert.equal(isRendererAuthoritySurface('frontend/js/platform/renderers/HudRenderer.js'), true);
  assert.equal(isRendererAuthoritySurface('frontend/js/platform/WorldMapRuntime.js'), true);
  assert.equal(isRendererAuthoritySurface('frontend/js/vendor/spine.js'), false);
  assert.equal(isRendererAuthoritySurface('frontend/js/platform/HudRenderer.test.js'), false);
  assert.equal(isRendererAuthoritySurface('frontend/js/platform/CanvasGameApp.js'), false);
});

test('renderer authority report classifies surface and targets', () => {
  assert.equal(
    classifySurface('frontend/js/platform/WorldMapRuntimeRenderPipeline.js'),
    'render-pipeline',
  );
  assert.equal(classifySurface('frontend/js/platform/FooRenderingRuntime.js'), 'render-runtime');
  assert.equal(classifySurface('frontend/js/platform/renderers/FooRenderer.js'), 'renderer');
  assert.equal(classifyTarget('host', 'lastLayout'), 'host');
  assert.equal(classifyTarget('state', 'activeTab'), 'state');
  assert.equal(classifyTarget('this', 'mapBakeDirty'), 'self-cache');
});

test('renderer authority report detects write-through and self-cache rows', () => {
  const findings = findRendererAuthorityInText(
    'frontend/js/platform/WorldMapRuntimeRenderPipeline.js',
    [
      'host.lastLayout = layout;',
      'this.mapBakeDirty = false;',
      'controller.hoverPoint = point;',
      'const readOnly = host.lastLayout;',
    ].join('\n'),
  );

  assert.equal(findings.length, 3);
  assert.deepEqual(findings.map((finding) => finding.target).sort(), [
    'controller',
    'host',
    'self-cache',
  ]);
  assert.equal(
    findings.some((finding) => finding.role === 'write-through'),
    true,
  );
  assert.equal(
    findings.some((finding) => finding.role === 'cache'),
    true,
  );
});

test('renderer authority report can scan a temporary repo baseline', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-renderer-authority-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'platform', 'renderers'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'vendor'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'platform', 'renderers', 'HudRenderer.js'),
      'host.activeTooltip = tooltip;\nthis.hitTargets = [];\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'platform', 'HudRenderer.test.js'),
      'host.activeTooltip = tooltip;\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'vendor', 'ignored.js'),
      'host.activeTooltip = tooltip;\n',
    );

    const report = scanRendererAuthority({ repoRoot });
    assert.equal(report.filesScanned, 1);
    assert.equal(report.summary.totalFindings, 2);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('renderer authority report rejects unknown CLI flags', () => {
  assert.throws(() => parseFormat(['--wat']), /unknown arguments/);
  assert.equal(parseFormat(['--json', '--summary']), 'json');
  assert.equal(parseFormat(['--markdown']), 'markdown');
});
