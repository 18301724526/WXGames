const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const H5GameBootstrap = require('../js/ui/H5GameBootstrap');

const projectRoot = path.join(__dirname, '..', '..');

test('H5 game bootstrap owns DOMContentLoaded startup binding', () => {
  let boundType = null;
  let boundHandler = null;
  let boundOptions = null;
  const runtime = {};
  const doc = {
    readyState: 'loading',
    addEventListener(type, handler, options) {
      boundType = type;
      boundHandler = handler;
      boundOptions = options;
    },
  };
  const game = {
    initCount: 0,
    init() {
      this.initCount += 1;
    },
  };

  const bootstrap = new H5GameBootstrap({ document: doc, runtime });

  assert.equal(bootstrap.mount(game), true);
  assert.equal(runtime.Game, game);
  assert.equal(boundType, 'DOMContentLoaded');
  assert.deepEqual(boundOptions, { once: true });
  assert.equal(game.initCount, 0);

  boundHandler();
  boundHandler();
  assert.equal(game.initCount, 1);
});

test('app delegates startup to H5GameBootstrap instead of binding document directly', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');

  assert.match(html, /js\/ui\/H5GameBootstrap\.js\?v=h5-bootstrap-v1/);
  assert.match(html, /js\/ui\/H5GameBootstrap\.js\?v=h5-bootstrap-v1[\s\S]*app\.js\?v=h5-text-adapter-v1/);
  assert.match(appJs, /H5GameBootstrap\?\.mount\(Game\)/);
  assert.doesNotMatch(appJs, /document\.addEventListener\(['"]DOMContentLoaded/);
});
