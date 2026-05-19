const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const H5UpdateRuntimeAdapter = require('../js/ui/H5UpdateRuntimeAdapter');

const projectRoot = path.join(__dirname, '..', '..');

test('H5 update runtime adapter owns confirmation cache clearing and reload', async () => {
  const confirmed = [];
  const deletedCaches = [];
  const unregistered = [];
  const replaced = [];
  const adapter = new H5UpdateRuntimeAdapter({}, {
    confirm(message) {
      confirmed.push(message);
      return true;
    },
    caches: {
      async keys() {
        return ['frontend-v1', 'runtime-v1'];
      },
      async delete(key) {
        deletedCaches.push(key);
      },
    },
    navigator: {
      serviceWorker: {
        async getRegistrations() {
          return [
            { unregister: async () => unregistered.push('sw-a') },
            { unregister: async () => unregistered.push('sw-b') },
          ];
        },
      },
    },
    location: {
      href: 'https://kodagame.top/index.html?foo=bar',
      replace(url) {
        replaced.push(url);
      },
    },
    now: () => 12345,
  });

  const nextUrl = await adapter.promptAndReload({ version: '1.2.3' });

  assert.deepEqual(confirmed, ['游戏有更新，需要重启后继续。\n版本：1.2.3']);
  assert.deepEqual(deletedCaches, ['frontend-v1', 'runtime-v1']);
  assert.deepEqual(unregistered, ['sw-a', 'sw-b']);
  assert.equal(nextUrl, 'https://kodagame.top/index.html?foo=bar&reload=12345');
  assert.deepEqual(replaced, [nextUrl]);
});

test('app delegates update reload runtime instead of touching browser globals directly', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');

  assert.match(html, /js\/ui\/H5UpdateRuntimeAdapter\.js\?v=h5-update-runtime-v1/);
  assert.match(html, /H5UpdateRuntimeAdapter\.js\?v=h5-update-runtime-v1[\s\S]*H5ShellAdapter\.js\?v=config-injection-v1[\s\S]*app\.js\?v=config-injection-v1/);
  assert.match(appJs, /this\.updateRuntime\?\.promptAndReload\(version\)/);
  assert.doesNotMatch(appJs, /window\.confirm|window\.caches|navigator\.serviceWorker|window\.location|new URL\(window\.location/);
});
