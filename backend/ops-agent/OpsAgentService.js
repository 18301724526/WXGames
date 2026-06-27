const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const { nowIso } = require('../../shared/timeUtils');

const DEFAULT_RUNTIME_STATE_DIR = '/opt/wxgame-workspace/.wxgame';
const DEFAULT_BACKEND_DIR = '/opt/wxgame-workspace/backend';
const DEFAULT_PM2_APP = 'server';
const DEFAULT_AUDIT_LIMIT = 40;

function sanitizeText(value, maxLength = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function sanitizeCommandOutput(value, maxLength = 20000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function joinRuntimePath(basePath, ...parts) {
  return String(basePath || '').startsWith('/')
    ? path.posix.join(basePath, ...parts)
    : path.join(basePath, ...parts);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readLastLines(filePath, limit = DEFAULT_AUDIT_LIMIT) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-Math.max(1, Math.min(200, Number(limit) || DEFAULT_AUDIT_LIMIT)));
  } catch (_) {
    return [];
  }
}

function executeCommand(command, args = [], options = {}) {
  try {
    const result = childProcess.spawnSync(command, args, {
      cwd: options.cwd || undefined,
      env: options.env || process.env,
      encoding: 'utf8',
      timeout: Math.max(1000, Number(options.timeoutMs) || 8000),
      shell: false,
      windowsHide: true,
    });
    return {
      ok: result.status === 0,
      status: result.status,
      stdout: sanitizeCommandOutput(result.stdout, options.maxOutput || 20000),
      stderr: sanitizeCommandOutput(result.stderr, options.maxOutput || 20000),
      error: result.error ? result.error.message : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      stdout: '',
      stderr: '',
      error: error.message,
    };
  }
}

function parseJsonCommand(commandResult, fallback) {
  if (!commandResult.ok || !commandResult.stdout) return fallback;
  try {
    return JSON.parse(commandResult.stdout);
  } catch (error) {
    return {
      ...fallback,
      parseError: error.message,
    };
  }
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let current = Math.max(0, bytes);
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${Math.round(current * 10) / 10} ${units[unitIndex]}`;
}

function normalizePm2AppName(value) {
  const appName = sanitizeText(value || DEFAULT_PM2_APP, 80);
  if (!/^[A-Za-z0-9._:-]+$/.test(appName)) {
    throw new Error('OPS_AGENT_PM2_APP may only contain letters, numbers, dot, underscore, colon, or hyphen.');
  }
  return appName;
}

function getDefaultOpsAgentDataDir(env = process.env) {
  const configuredStateDir = sanitizeText(env.WXGAME_DEPLOY_STATE_DIR || env.DEPLOY_STATE_DIR);
  const stateDir = configuredStateDir || DEFAULT_RUNTIME_STATE_DIR;
  return joinRuntimePath(stateDir, 'ops-agent');
}

function getDefaultOpsAgentAuditLogPath(env = process.env) {
  return joinRuntimePath(getDefaultOpsAgentDataDir(env), 'ops-agent-audit.log');
}

function summarizePm2Process(processInfo = {}, appName = DEFAULT_PM2_APP) {
  const env = processInfo.pm2_env || {};
  return {
    schema: 'ops-agent-pm2-process-v1',
    appName,
    found: true,
    pmId: processInfo.pm_id,
    name: processInfo.name || appName,
    status: env.status || '',
    pid: processInfo.pid || 0,
    restarts: env.restart_time || 0,
    unstableRestarts: env.unstable_restarts || 0,
    uptimeMs: env.pm_uptime ? Math.max(0, Date.now() - env.pm_uptime) : 0,
    nodeVersion: env.node_version || '',
    scriptPath: env.pm_exec_path || '',
    cwd: env.pm_cwd || '',
    execMode: env.exec_mode || '',
    cpu: processInfo.monit?.cpu || 0,
    memoryBytes: processInfo.monit?.memory || 0,
    memoryText: formatBytes(processInfo.monit?.memory || 0),
  };
}

class OpsAgentService {
  constructor(options = {}) {
    this.env = options.env || process.env;
    this.pm2AppName = normalizePm2AppName(options.pm2AppName || this.env.OPS_AGENT_PM2_APP || this.env.PM2_APP_NAME || DEFAULT_PM2_APP);
    this.backendCwd = sanitizeText(options.backendCwd || this.env.OPS_AGENT_BACKEND_CWD || this.env.BACKEND_DIR || DEFAULT_BACKEND_DIR, 2048);
    this.backendScript = sanitizeText(options.backendScript || this.env.OPS_AGENT_BACKEND_SCRIPT || path.join(this.backendCwd, 'server.js'), 2048);
    this.auditLogPath = options.auditLogPath || this.env.OPS_AGENT_AUDIT_LOG_PATH || getDefaultOpsAgentAuditLogPath(this.env);
    this.now = options.now || (() => new Date());
    this.executeCommand = options.executeCommand || executeCommand;
  }

  getConfigSummary() {
    return {
      schema: 'ops-agent-config-v1',
      pm2AppName: this.pm2AppName,
      backendCwd: this.backendCwd,
      backendScript: this.backendScript,
      auditLogPath: this.auditLogPath,
      arbitraryCommandsAllowed: false,
    };
  }

  appendAudit(entry = {}) {
    const record = {
      schema: 'ops-agent-audit-record-v1',
      at: nowIso(this.now()),
      action: sanitizeText(entry.action || 'ops-agent:unknown', 80),
      operator: sanitizeText(entry.operator || 'system', 80),
      target: this.pm2AppName,
      detail: entry.detail || undefined,
    };
    ensureDir(this.auditLogPath);
    fs.appendFileSync(this.auditLogPath, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }

  getAuditLog(options = {}) {
    return readLastLines(this.auditLogPath, options.limit || DEFAULT_AUDIT_LIMIT)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (_) {
          return { schema: 'ops-agent-audit-record-v1', at: '', action: 'unparsed', target: this.pm2AppName };
        }
      })
      .reverse();
  }

  getSystemSummary() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    return {
      schema: 'ops-agent-system-summary-v1',
      generatedAt: nowIso(this.now()),
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptimeSeconds: Math.round(os.uptime()),
      loadAverage: os.loadavg(),
      cpuCount: (os.cpus() || []).length,
      memory: {
        totalBytes: totalMemory,
        freeBytes: freeMemory,
        usedBytes: Math.max(0, totalMemory - freeMemory),
        usedPercent: totalMemory ? Math.round(((totalMemory - freeMemory) / totalMemory) * 1000) / 10 : 0,
        totalText: formatBytes(totalMemory),
        freeText: formatBytes(freeMemory),
        usedText: formatBytes(Math.max(0, totalMemory - freeMemory)),
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        cwd: process.cwd(),
      },
    };
  }

  getPm2List() {
    const command = this.executeCommand('pm2', ['jlist'], { timeoutMs: 5000, maxOutput: 120000 });
    const parsed = parseJsonCommand(command, []);
    const list = Array.isArray(parsed) ? parsed : [];
    return { command, list };
  }

  getPm2Summary() {
    const { command, list } = this.getPm2List();
    const match = list.find((item) => item && item.name === this.pm2AppName) || null;
    if (!match) {
      return {
        schema: 'ops-agent-pm2-process-v1',
        appName: this.pm2AppName,
        found: false,
        command: {
          ok: command.ok,
          error: command.stderr || command.error || '',
        },
      };
    }
    return summarizePm2Process(match, this.pm2AppName);
  }

  getHealth() {
    return {
      success: true,
      schema: 'ops-agent-health-v1',
      status: 'ok',
      generatedAt: nowIso(this.now()),
      config: {
        pm2AppName: this.pm2AppName,
        arbitraryCommandsAllowed: false,
      },
    };
  }

  getStatus(options = {}) {
    return {
      success: true,
      schema: 'ops-agent-status-v1',
      generatedAt: nowIso(this.now()),
      config: this.getConfigSummary(),
      system: this.getSystemSummary(),
      pm2: this.getPm2Summary(),
      audit: this.getAuditLog({ limit: options.auditLimit || DEFAULT_AUDIT_LIMIT }),
    };
  }

  runPm2Command(action, args, options = {}) {
    const operator = sanitizeText(options.operator || 'ops-admin', 80);
    const result = this.executeCommand('pm2', args, {
      timeoutMs: Math.max(5000, Number(options.timeoutMs) || 15000),
      maxOutput: 40000,
    });
    const audit = this.appendAudit({
      action,
      operator,
      detail: {
        ok: result.ok,
        status: result.status,
        command: ['pm2', ...args],
        stdout: result.stdout.slice(-2000),
        stderr: result.stderr.slice(-2000),
        error: result.error,
      },
    });
    return {
      success: result.ok,
      schema: 'ops-agent-command-result-v1',
      action,
      target: this.pm2AppName,
      audit,
      command: result,
      pm2: this.getPm2Summary(),
    };
  }

  startService(options = {}) {
    const pm2 = this.getPm2Summary();
    if (pm2.found && pm2.status === 'online') {
      const audit = this.appendAudit({
        action: 'pm2:start:already-online',
        operator: options.operator || 'ops-admin',
        detail: { status: pm2.status },
      });
      return {
        success: true,
        schema: 'ops-agent-command-result-v1',
        action: 'pm2:start',
        target: this.pm2AppName,
        audit,
        command: { ok: true, status: 0, stdout: 'already online', stderr: '' },
        pm2,
      };
    }
    const args = pm2.found
      ? ['start', this.pm2AppName, '--update-env']
      : ['start', this.backendScript, '--name', this.pm2AppName, '--cwd', this.backendCwd, '--update-env'];
    return this.runPm2Command('pm2:start', args, options);
  }

  stopService(options = {}) {
    const pm2 = this.getPm2Summary();
    if (!pm2.found || pm2.status === 'stopped') {
      const audit = this.appendAudit({
        action: pm2.found ? 'pm2:stop:already-stopped' : 'pm2:stop:not-found',
        operator: options.operator || 'ops-admin',
        detail: { status: pm2.status || 'not-found' },
      });
      return {
        success: true,
        schema: 'ops-agent-command-result-v1',
        action: 'pm2:stop',
        target: this.pm2AppName,
        audit,
        command: { ok: true, status: 0, stdout: pm2.found ? 'already stopped' : 'not found', stderr: '' },
        pm2,
      };
    }
    return this.runPm2Command('pm2:stop', ['stop', this.pm2AppName], options);
  }

  restartService(options = {}) {
    const pm2 = this.getPm2Summary();
    if (!pm2.found) {
      const audit = this.appendAudit({
        action: 'pm2:restart:not-found',
        operator: options.operator || 'ops-admin',
        detail: { error: 'Pm2AppNotFound' },
      });
      return {
        success: false,
        schema: 'ops-agent-command-result-v1',
        action: 'pm2:restart',
        target: this.pm2AppName,
        audit,
        error: 'Pm2AppNotFound',
        message: `PM2 app ${this.pm2AppName} was not found. Use start instead.`,
        pm2,
      };
    }
    return this.runPm2Command('pm2:restart', ['restart', this.pm2AppName, '--update-env'], options);
  }
}

module.exports = OpsAgentService;
module.exports.DEFAULT_PM2_APP = DEFAULT_PM2_APP;
module.exports.getDefaultOpsAgentDataDir = getDefaultOpsAgentDataDir;
module.exports.getDefaultOpsAgentAuditLogPath = getDefaultOpsAgentAuditLogPath;
module.exports.normalizePm2AppName = normalizePm2AppName;
