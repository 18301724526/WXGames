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

test('H5 auth runtime adapter binds runtime confirm and alert to avoid illegal invocation', () => {
  const calls = [];
  const runtime = {
    prefix: 'runtime-bound',
    confirm(message) {
      calls.push(`confirm:${this.prefix}:${message}`);
      return true;
    },
    alert(message) {
      calls.push(`alert:${this.prefix}:${message}`);
    },
  };
  const adapter = H5AuthRuntimeAdapter.fromRuntime(runtime);

  assert.equal(adapter.confirmReset(), true);
  adapter.alertMessage('done');

  assert.equal(calls[0], 'confirm:runtime-bound:⚠️ 确定重置游戏进度？\n当前账号的所有发展将回到初始状态。');
  assert.equal(calls[1], 'alert:runtime-bound:done');
});

test('auth module delegates browser runtime to H5 auth runtime adapter', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const authJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'auth.js'), 'utf8');

  assert.match(html, /js\/ui\/H5AuthRuntimeAdapter\.js\?v=h5-auth-runtime-v2/);
  assert.match(html, /H5AuthRuntimeAdapter\.js\?v=h5-auth-runtime-v2[\s\S]*H5ShellAdapter\.js\?v=h5-shell-registry-v1[\s\S]*auth\.js\?v=h5-module-deps-v1/);
  assert.match(authJs, /const authRuntime = deps\.authRuntime \|\| game\.authRuntime/);
  assert.doesNotMatch(authJs, /H5AuthRuntimeAdapter\?\.fromRuntime\(window\)/);
  assert.doesNotMatch(authJs, /\bconfirm\(|\balert\(|location\.reload/);
  assert.match(authJs, /const authRuntime = deps\.authRuntime \|\| game\.authRuntime/);
});
