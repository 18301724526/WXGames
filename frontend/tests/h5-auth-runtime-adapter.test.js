const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const H5AuthRuntimeAdapter = require('../js/ui/H5AuthRuntimeAdapter');

const projectRoot = path.join(__dirname, '..', '..');

test('H5 auth runtime adapter owns reset prompts alerts and reload', () => {
  const confirmed = [];
  const alerts = [];
  let reloads = 0;
  const adapter = H5AuthRuntimeAdapter.fromRuntime({}, {
    confirm(message) {
      confirmed.push(message);
      return true;
    },
    alert(message) {
      alerts.push(message);
    },
    location: {
      reload() {
        reloads += 1;
      },
    },
  });

  assert.equal(adapter.confirmReset(), true);
  adapter.alertMessage('done');
  adapter.reload();

  assert.equal(confirmed.length, 1);
  assert.match(confirmed[0], /确定重置游戏进度/);
  assert.deepEqual(alerts, ['done']);
  assert.equal(reloads, 1);
});

test('auth module delegates browser runtime to H5 auth runtime adapter', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const authJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'auth.js'), 'utf8');

  assert.match(html, /js\/ui\/H5AuthRuntimeAdapter\.js\?v=h5-auth-runtime-v1/);
  assert.match(html, /H5AuthRuntimeAdapter\.js\?v=h5-auth-runtime-v1[\s\S]*H5ShellAdapter\.js\?v=h5-auth-runtime-v1[\s\S]*auth\.js\?v=h5-auth-runtime-v1/);
  assert.match(authJs, /const authRuntime = game\.authRuntime \|\| window\.H5AuthRuntimeAdapter\?\.fromRuntime\(window\)/);
  assert.doesNotMatch(authJs, /\bconfirm\(|\balert\(|location\.reload/);
});
