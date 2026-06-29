const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  RETIRED_FILE,
  findRetiredBridgeReferencesInText,
  scanRendererHostBridgeRetirement,
  parseFormat,
} = require('./check-renderer-host-bridge-retired');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'renderer-host-bridge-retired-'));
  try {
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('flags retired host bridge symbols and proxy forms', () => {
  const findings = findRetiredBridgeReferencesInText(
    'frontend/js/platform/renderers/Foo.js',
    [
      'const HostBridge = global.WorldMapRendererHostBridge;',
      'return HostBridge.createProxy(this);',
      'return new Proxy(this, {});',
      'return new Proxy(renderer, {});',
      'return new Proxy(Object.create(null), {});',
    ].join('\n'),
  );

  assert.deepEqual(findings.map((finding) => finding.kind), [
    'retired-host-bridge-symbol',
    'retired-host-bridge-alias',
    'retired-host-bridge-alias',
    'retired-create-proxy-call',
    'inline-this-proxy',
    'inline-renderer-proxy',
    'inline-child-host-proxy',
  ]);
});

test('ignores comments and non-host proxy usage outside scanned source roots', () =>
  withTempRepo((repoRoot) => {
    writeFile(repoRoot, 'frontend/js/platform/renderers/Ok.js', '// new Proxy(this, {})\n');
    writeFile(repoRoot, 'frontend/js/ecs/runtime/EcsModeRuntimeBundle.js', 'new Proxy(x, {});\n');

    const report = scanRendererHostBridgeRetirement({ repoRoot });

    assert.equal(report.summary.totalViolations, 0);
  }));

test('flags the retired bridge file and runtime entry references', () =>
  withTempRepo((repoRoot) => {
    writeFile(repoRoot, RETIRED_FILE, 'module.exports = {};\n');
    writeFile(repoRoot, 'frontend/index.html', '<script src="WorldMapRendererHostBridge.js"></script>\n');
    writeFile(repoRoot, 'frontend/minigame/game.js', "require('../js/platform/renderers/WorldMapRendererHostBridge');\n");

    const report = scanRendererHostBridgeRetirement({ repoRoot });

    assert.equal(report.summary.totalViolations, 3);
    assert.deepEqual(report.violations.map((violation) => violation.kind), [
      'retired-host-bridge-file',
      'retired-host-bridge-symbol',
      'retired-host-bridge-symbol',
    ]);
  }));

test('passes against the real repo', () => {
  const report = scanRendererHostBridgeRetirement();
  assert.equal(report.summary.totalViolations, 0);
});

test('retired path points at the deleted bridge', () => {
  assert.equal(RETIRED_FILE, 'frontend/js/platform/renderers/WorldMapRendererHostBridge.js');
});

test('rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--nope']), /unknown arguments/);
});
