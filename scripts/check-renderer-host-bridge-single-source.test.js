const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  CANONICAL,
  findInlineProxyInText,
  scanRendererHostBridge,
  parseFormat,
} = require('./check-renderer-host-bridge-single-source');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'renderer-host-bridge-'));
  try {
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('flags an inline new Proxy(this, ...) host bridge', () => {
  const findings = findInlineProxyInText(
    'frontend/js/platform/renderers/Foo.js',
    [
      '    constructor(options = {}) {',
      '      this.host = options.host || null;',
      '      return new Proxy(this, {',
    ].join('\n'),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 3);
});

test('allows the canonical proxy of `renderer` and the factory proxy of Object.create', () => {
  assert.deepEqual(findInlineProxyInText('a.js', '      return new Proxy(renderer, {'), []);
  assert.deepEqual(
    findInlineProxyInText('a.js', '      return new Proxy(Object.create(null), {'),
    [],
  );
});

test('allows the canonical createProxy call site', () => {
  assert.deepEqual(
    findInlineProxyInText('a.js', '      return HostBridge ? HostBridge.createProxy(this) : this;'),
    [],
  );
});

test('ignores commented-out inline proxies', () => {
  assert.deepEqual(findInlineProxyInText('a.js', '      // return new Proxy(this, {'), []);
});

test('scans the renderers dir, skips tests, points at the canonical', () =>
  withTempRepo((repoRoot) => {
    writeFile(
      repoRoot,
      'frontend/js/platform/renderers/WorldMapRendererHostBridge.js',
      '      return new Proxy(renderer, {});\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/renderers/Good.js',
      '      return HostBridge ? HostBridge.createProxy(this) : this;\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/renderers/Bad.js',
      '      return new Proxy(this, { get() {} });\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/renderers/Bad.test.js',
      '      return new Proxy(this, { get() {} });\n',
    );

    const report = scanRendererHostBridge({ repoRoot });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'frontend/js/platform/renderers/Bad.js');
  }));

test('passes against the real repo (all 17 renderers already collapsed)', () => {
  const report = scanRendererHostBridge();
  assert.equal(report.summary.totalViolations, 0);
});

test('canonical path constant points at the single source', () => {
  assert.equal(CANONICAL, 'frontend/js/platform/renderers/WorldMapRendererHostBridge.js');
});

test('rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--nope']), /unknown arguments/);
});
