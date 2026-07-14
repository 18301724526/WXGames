const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  isIifeWrapped,
  collectTopLevelBindings,
  checkGlobalBindingCollisions,
} = require('./check-frontend-script-manifest');

// Classic <script> files share one global scope: a top-level const declared in two
// files throws at load and silently kills the second file while node tests stay green.

test('isIifeWrapped recognizes the house wrapper shapes and rejects bare scripts', () => {
  assert.equal(isIifeWrapped("(function (global) { 'use strict'; })(globalThis);"), true);
  assert.equal(isIifeWrapped('// comment\n/* block */\n(function (g) {})(window);'), true);
  assert.equal(isIifeWrapped("'use strict';\n(function (g) {})(window);"), true);
  assert.equal(isIifeWrapped("'use strict';\nconst api = {};"), false);
  assert.equal(isIifeWrapped('const api = {};'), false);
});

test('collectTopLevelBindings finds const/let/class but not indented or var bindings', () => {
  const source = [
    'const api = {};',
    'let counter = 0;',
    'class Thing {}',
    '  const indented = 1;',
    'var legacyShared = true;',
    'function fn() {}',
  ].join('\n');
  assert.deepEqual(collectTopLevelBindings(source), ['api', 'counter', 'Thing']);
});

test('checkGlobalBindingCollisions catches a classic-script top-level collision', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-guard-'));
  try {
    fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'js', 'a.js'),
      "'use strict';\nconst api = { one: 1 };\nif (typeof globalThis !== 'undefined') globalThis.A = api;\n",
    );
    fs.writeFileSync(
      path.join(dir, 'js', 'b.js'),
      "'use strict';\nconst api = { two: 2 };\nif (typeof globalThis !== 'undefined') globalThis.B = api;\n",
    );
    const collisions = checkGlobalBindingCollisions(['js/a.js', 'js/b.js'], {
      frontendDir: dir,
      repoRoot: dir,
    });
    assert.equal(collisions.length, 1);
    assert.match(collisions[0], /'api' declared at top level by both js\/a\.js and js\/b\.js/);

    // Wrapping either file in an IIFE resolves it.
    fs.writeFileSync(
      path.join(dir, 'js', 'b.js'),
      "(function (global) {\n  'use strict';\n  const api = { two: 2 };\n  global.B = api;\n})(globalThis);\n",
    );
    assert.deepEqual(
      checkGlobalBindingCollisions(['js/a.js', 'js/b.js'], { frontendDir: dir, repoRoot: dir }),
      [],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the real index.html manifest has zero top-level binding collisions', () => {
  const manifest = require('./check-frontend-script-manifest');
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'frontend', 'index.html'), 'utf8');
  const scripts = manifest
    .extractScripts(html)
    .filter((src) => !/^https?:\/\//i.test(src))
    .map(manifest.stripQuery);
  assert.deepEqual(manifest.checkGlobalBindingCollisions(scripts, {}), []);
});
