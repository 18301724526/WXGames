const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const OpsControlService = require('../services/OpsControlService');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wxgame-ops-'));
}

function createService(options = {}) {
  const dir = createTempDir();
  const commands = [];
  const service = new OpsControlService({
    env: { NODE_ENV: 'test' },
    maintenancePath: path.join(dir, 'maintenance.json'),
    auditLogPath: path.join(dir, 'ops-audit.log'),
    deployStateDir: dir,
    backendDir: dir,
    platform: 'linux',
    now: () => new Date('2026-06-11T16:00:00.000Z'),
    executeCommand(command, args) {
      commands.push([command, args]);
      if (command === 'pm2' && args[0] === 'jlist') {
        return {
          ok: true,
          status: 0,
          stdout: JSON.stringify([{
            name: 'server',
            pm_id: 0,
            pid: 1234,
            monit: { cpu: 3, memory: 64 * 1024 * 1024 },
            pm2_env: {
              status: 'online',
              restart_time: 2,
              unstable_restarts: 0,
              pm_uptime: Date.now() - 5000,
              node_version: '20.20.2',
              pm_exec_path: '/opt/wxgame-workspace/backend/server.js',
              pm_cwd: '/opt/wxgame-workspace/backend',
              exec_mode: 'fork_mode',
              pm_out_log_path: path.join(dir, 'out.log'),
              pm_err_log_path: path.join(dir, 'err.log'),
            },
          }]),
          stderr: '',
        };
      }
      if (command === 'curl') {
        return {
          ok: true,
          status: 0,
          stdout: JSON.stringify({ status: 'ok', configRuntime: { status: 'matched' } }),
          stderr: '',
        };
      }
      if (command === 'df') {
        return {
          ok: true,
          status: 0,
          stdout: 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/vda1 1000 250 750 25% /\n',
          stderr: '',
        };
      }
      if (command === 'pm2' && args[0] === 'restart') {
        return { ok: true, status: 0, stdout: 'restarted', stderr: '' };
      }
      return { ok: false, status: 1, stdout: '', stderr: 'unexpected command' };
    },
    repository: {
      getPlayerActivitySummary() {
        return { totalPlayers: 3, windows: { last2m: 1, last10m: 2 } };
      },
    },
    observabilityService: {
      getSnapshot() {
        return { status: 'ok', totals: { requestCount: 1 } };
      },
      getHealthSummary() {
        return { status: 'ok', recentRequestCount: 1, alerts: [] };
      },
    },
    configReleaseService: {
      getRuntimeStatus() {
        return { schema: 'config-runtime-status-v1', status: 'matched', matchesCurrent: true, errors: [], warnings: [] };
      },
      resolveRuntimeGatePolicy() {
        return { mode: 'required', required: true, source: 'test' };
      },
    },
    configRuntimeLoader: {
      getRuntimeLoaderStatus() {
        return { schema: 'config-runtime-loader-status-v1', status: 'ready', ready: true, errors: [], warnings: [] };
      },
    },
    versionService: {
      getVersionInfo() {
        return { version: '1.0.0', deployedCommit: 'test-commit' };
      },
    },
    getGameplayConfigStatus() {
      return { schema: 'gameplay-config-runtime-v1', source: 'active-release-bundle', bundleReady: true, errors: [], warnings: [] };
    },
    getBuildingConfigVersion() {
      return 'test-building-config';
    },
    getBuildingConfigPath() {
      return '/tmp/BuildingConfig.js';
    },
    ...options,
  });
  return { service, dir, commands };
}

test('OpsControlService persists maintenance state and audit records', () => {
  const { service } = createService();

  const enabled = service.setMaintenanceState({
    enabled: true,
    reason: 'deploy-window',
    message: '维护中',
  }, { operator: 'codexqa' });

  assert.equal(enabled.success, true);
  assert.equal(enabled.maintenance.enabled, true);
  assert.equal(enabled.maintenance.reason, 'deploy-window');
  assert.equal(service.getMaintenanceState().message, '维护中');

  const audit = service.getAuditLog();
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'maintenance:enable');
  assert.equal(audit[0].operator, 'codexqa');
});

test('OpsControlService builds dashboard from system, PM2, health, players, and config runtime', () => {
  const { service } = createService();
  const dashboard = service.getDashboard({ includeLogs: true, logLines: 5 });

  assert.equal(dashboard.success, true);
  assert.equal(dashboard.schema, 'ops-dashboard-v1');
  assert.equal(dashboard.pm2.status, 'online');
  assert.equal(dashboard.pm2.nodeVersion, '20.20.2');
  assert.equal(dashboard.health.status, 'ok');
  assert.equal(dashboard.health.source, 'local-process');
  assert.equal(dashboard.health.health.configRuntime.status, 'matched');
  assert.equal(dashboard.system.disk.usedPercent, 25);
  assert.equal(dashboard.system.disk.availableText, '750 KiB');
  assert.equal(dashboard.players.totalPlayers, 3);
  assert.equal(dashboard.configRuntime.loaderStatus.ready, true);
});

test('OpsControlService default dashboard health does not synchronously curl itself', () => {
  const { service, commands } = createService();
  const dashboard = service.getDashboard();

  assert.equal(dashboard.health.status, 'ok');
  assert.equal(dashboard.health.source, 'local-process');
  assert.equal(dashboard.environment.healthUrl, '');
  assert.equal(commands.some(([command]) => command === 'curl'), false);
});

test('OpsControlService uses external health probe only when explicitly configured', () => {
  const { service, commands } = createService({ healthUrl: 'https://ops.example.test/health' });
  const health = service.getHealthSummary();

  assert.equal(health.status, 'ok');
  assert.equal(health.source, 'external-url');
  assert.equal(health.url, 'https://ops.example.test/health');
  assert.equal(commands.some(([command, args]) => command === 'curl' && args.includes('https://ops.example.test/health')), true);
});

test('OpsControlService restarts PM2 app through explicit audited command', () => {
  const { service, commands } = createService();
  const result = service.restartService({ operator: 'codexqa' });

  assert.equal(result.success, true);
  assert.deepEqual(commands.at(-1), ['pm2', ['restart', 'server', '--update-env']]);
  assert.equal(service.getAuditLog()[0].action, 'pm2:restart');
});
