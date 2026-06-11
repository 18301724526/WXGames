const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const OpsAgentService = require('../ops-agent/OpsAgentService');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wxgame-ops-agent-'));
}

function createService(options = {}) {
  const dir = createTempDir();
  const commands = [];
  let pm2State = options.pm2State || 'online';
  const service = new OpsAgentService({
    env: { NODE_ENV: 'test' },
    pm2AppName: 'server',
    backendCwd: '/opt/wxgame-workspace/backend',
    backendScript: '/opt/wxgame-workspace/backend/server.js',
    auditLogPath: path.join(dir, 'ops-agent-audit.log'),
    now: () => new Date('2026-06-12T08:00:00.000Z'),
    executeCommand(command, args) {
      commands.push([command, args]);
      if (command === 'pm2' && args[0] === 'jlist') {
        if (pm2State === 'missing') {
          return { ok: true, status: 0, stdout: '[]', stderr: '' };
        }
        return {
          ok: true,
          status: 0,
          stdout: JSON.stringify([{
            name: 'server',
            pm_id: 0,
            pid: pm2State === 'stopped' ? 0 : 2345,
            monit: { cpu: 2, memory: 32 * 1024 * 1024 },
            pm2_env: {
              status: pm2State,
              restart_time: 3,
              unstable_restarts: 0,
              pm_uptime: Date.now() - 3000,
              node_version: '20.20.2',
              pm_exec_path: '/opt/wxgame-workspace/backend/server.js',
              pm_cwd: '/opt/wxgame-workspace/backend',
              exec_mode: 'fork_mode',
            },
          }]),
          stderr: '',
        };
      }
      if (command === 'pm2' && ['start', 'stop', 'restart'].includes(args[0])) {
        if (args[0] === 'stop') pm2State = 'stopped';
        if (args[0] === 'start' || args[0] === 'restart') pm2State = 'online';
        return { ok: true, status: 0, stdout: `${args[0]} ok`, stderr: '' };
      }
      return { ok: false, status: 1, stdout: '', stderr: 'unexpected command' };
    },
    ...options,
  });
  return { service, dir, commands };
}

test('OpsAgentService exposes status for one fixed PM2 app', () => {
  const { service } = createService();
  const status = service.getStatus();

  assert.equal(status.success, true);
  assert.equal(status.schema, 'ops-agent-status-v1');
  assert.equal(status.config.pm2AppName, 'server');
  assert.equal(status.config.arbitraryCommandsAllowed, false);
  assert.equal(status.pm2.found, true);
  assert.equal(status.pm2.status, 'online');
  assert.equal(status.pm2.nodeVersion, '20.20.2');
});

test('OpsAgentService rejects unsafe PM2 app names', () => {
  assert.throws(
    () => new OpsAgentService({ pm2AppName: 'server; rm -rf /' }),
    /OPS_AGENT_PM2_APP/,
  );
});

test('OpsAgentService starts an existing stopped PM2 app with audited fixed args', () => {
  const { service, commands } = createService({ pm2State: 'stopped' });
  const result = service.startService({ operator: 'opsroot' });

  assert.equal(result.success, true);
  assert.deepEqual(commands.find(([command, args]) => command === 'pm2' && args[0] === 'start'), [
    'pm2',
    ['start', 'server', '--update-env'],
  ]);
  assert.equal(service.getAuditLog()[0].action, 'pm2:start');
  assert.equal(service.getAuditLog()[0].operator, 'opsroot');
});

test('OpsAgentService starts a missing PM2 app from configured backend script only', () => {
  const { service, commands } = createService({ pm2State: 'missing' });
  const result = service.startService({ operator: 'opsroot' });

  assert.equal(result.success, true);
  assert.deepEqual(commands.find(([command, args]) => command === 'pm2' && args[0] === 'start'), [
    'pm2',
    ['start', '/opt/wxgame-workspace/backend/server.js', '--name', 'server', '--cwd', '/opt/wxgame-workspace/backend', '--update-env'],
  ]);
  assert.equal(service.getAuditLog()[0].action, 'pm2:start');
});

test('OpsAgentService stops and restarts only the configured PM2 app', () => {
  const { service, commands } = createService();

  assert.equal(service.stopService({ operator: 'opsroot' }).success, true);
  assert.equal(service.restartService({ operator: 'opsroot' }).success, true);

  assert.deepEqual(commands.filter(([command, args]) => command === 'pm2' && args[0] !== 'jlist'), [
    ['pm2', ['stop', 'server']],
    ['pm2', ['restart', 'server', '--update-env']],
  ]);
  assert.deepEqual(service.getAuditLog().map((entry) => entry.action), ['pm2:restart', 'pm2:stop']);
});

test('OpsAgentService tells operators to use start when restart target is missing', () => {
  const { service } = createService({ pm2State: 'missing' });
  const result = service.restartService({ operator: 'opsroot' });

  assert.equal(result.success, false);
  assert.equal(result.error, 'Pm2AppNotFound');
  assert.equal(service.getAuditLog()[0].action, 'pm2:restart:not-found');
});
