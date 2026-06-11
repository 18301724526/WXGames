const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const DEFAULT_RUNTIME_STATE_DIR = '/opt/wxgame-workspace/.wxgame';
const REPO_ROOT = path.join(__dirname, '..', '..');
const LOCAL_DEFAULT_DATA_DIR = path.join(REPO_ROOT, 'data', 'ops');
const DEFAULT_PM2_APP = 'server';
const DEFAULT_HEALTH_URL = 'http://127.0.0.1:3000/api/health';
const DEFAULT_LOG_LINES = 80;

function sanitizeText(value, maxLength = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function sanitizeCommandOutput(value, maxLength = 20000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function joinRuntimePath(basePath, ...parts) {
  return String(basePath || '').startsWith('/')
    ? path.posix.join(basePath, ...parts)
    : path.join(basePath, ...parts);
}

function getDefaultOpsDataDir(env = process.env) {
  const configuredStateDir = sanitizeText(env.WXGAME_DEPLOY_STATE_DIR || env.DEPLOY_STATE_DIR);
  if (configuredStateDir) return joinRuntimePath(configuredStateDir, 'ops');
  const nodeEnv = sanitizeText(env.NODE_ENV, 64).toLowerCase();
  if (nodeEnv === 'production') return joinRuntimePath(DEFAULT_RUNTIME_STATE_DIR, 'ops');
  return LOCAL_DEFAULT_DATA_DIR;
}

function getDefaultMaintenancePath(env = process.env) {
  return joinRuntimePath(getDefaultOpsDataDir(env), 'maintenance.json');
}

function getDefaultAuditLogPath(env = process.env) {
  return joinRuntimePath(getDefaultOpsDataDir(env), 'ops-audit.log');
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonFile(filePath, fallback) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return {
      ...fallback,
      readError: error.message,
    };
  }
}

function writeJsonFile(filePath, value) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readTextFile(filePath, fallback = '') {
  try {
    if (!filePath || !fs.existsSync(filePath)) return fallback;
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return fallback;
  }
}

function readLastLines(filePath, lineLimit = DEFAULT_LOG_LINES) {
  const text = readTextFile(filePath, '');
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).slice(-lineLimit);
}

function executeCommand(command, args = [], options = {}) {
  try {
    const result = childProcess.spawnSync(command, args, {
      cwd: options.cwd || undefined,
      env: options.env || process.env,
      encoding: 'utf8',
      timeout: Math.max(1000, Number(options.timeoutMs) || 5000),
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

function getDiskSummary(targetPath = process.cwd(), commandRunner = executeCommand, platform = process.platform) {
  const command = platform === 'win32'
    ? null
    : commandRunner('df', ['-Pk', targetPath], { timeoutMs: 3000 });
  if (!command || !command.ok) {
    return {
      path: targetPath,
      available: false,
      error: command?.stderr || command?.error || 'disk summary unavailable',
    };
  }
  const lines = command.stdout.trim().split(/\r?\n/);
  const last = lines[lines.length - 1] || '';
  const parts = last.split(/\s+/);
  const sizeKb = Number(parts[1]) || 0;
  const usedKb = Number(parts[2]) || 0;
  const availableKb = Number(parts[3]) || 0;
  const usedPercentText = parts[4] || '0%';
  return {
    path: targetPath,
    filesystem: parts[0] || '',
    sizeBytes: sizeKb * 1024,
    usedBytes: usedKb * 1024,
    availableBytes: availableKb * 1024,
    usedPercent: Number(String(usedPercentText).replace('%', '')) || 0,
    sizeText: formatBytes(sizeKb * 1024),
    usedText: formatBytes(usedKb * 1024),
    availableText: formatBytes(availableKb * 1024),
  };
}

function normalizeMaintenance(input = {}, now = new Date()) {
  return {
    schema: 'ops-maintenance-state-v1',
    enabled: Boolean(input.enabled),
    reason: sanitizeText(input.reason || ''),
    message: sanitizeText(input.message || ''),
    startedAt: input.enabled ? sanitizeText(input.startedAt || nowIso(now), 64) : null,
    updatedAt: nowIso(now),
    updatedBy: sanitizeText(input.updatedBy || 'system', 80),
  };
}

class OpsControlService {
  constructor(options = {}) {
    this.env = options.env || process.env;
    this.repository = options.repository || null;
    this.observabilityService = options.observabilityService || null;
    this.configReleaseService = options.configReleaseService || null;
    this.configRuntimeLoader = options.configRuntimeLoader || null;
    this.versionService = options.versionService || null;
    this.pm2AppName = options.pm2AppName || this.env.PM2_APP_NAME || DEFAULT_PM2_APP;
    this.healthUrl = options.healthUrl || this.env.OPS_HEALTH_URL || DEFAULT_HEALTH_URL;
    this.backendDir = options.backendDir || this.env.BACKEND_DIR || path.join(__dirname, '..');
    this.deployStateDir = options.deployStateDir || this.env.WXGAME_DEPLOY_STATE_DIR || this.env.DEPLOY_STATE_DIR || DEFAULT_RUNTIME_STATE_DIR;
    this.maintenancePath = options.maintenancePath || this.env.OPS_MAINTENANCE_PATH || getDefaultMaintenancePath(this.env);
    this.auditLogPath = options.auditLogPath || this.env.OPS_AUDIT_LOG_PATH || getDefaultAuditLogPath(this.env);
    this.now = options.now || (() => new Date());
    this.executeCommand = options.executeCommand || executeCommand;
    this.platform = options.platform || process.platform;
  }

  getMaintenanceState() {
    return normalizeMaintenance(readJsonFile(this.maintenancePath, { enabled: false }), this.now());
  }

  setMaintenanceState(input = {}, options = {}) {
    const previous = this.getMaintenanceState();
    const next = normalizeMaintenance({
      enabled: input.enabled,
      reason: input.reason || previous.reason,
      message: input.message || previous.message,
      startedAt: input.enabled ? (previous.enabled ? previous.startedAt : nowIso(this.now())) : null,
      updatedBy: options.operator || input.updatedBy || 'admin',
    }, this.now());
    writeJsonFile(this.maintenancePath, next);
    this.appendAudit({
      action: next.enabled ? 'maintenance:enable' : 'maintenance:disable',
      operator: next.updatedBy,
      previous: { enabled: previous.enabled, reason: previous.reason },
      next: { enabled: next.enabled, reason: next.reason },
    });
    return { success: true, maintenance: next };
  }

  appendAudit(entry = {}) {
    const record = {
      schema: 'ops-audit-record-v1',
      at: nowIso(this.now()),
      action: sanitizeText(entry.action || 'ops:unknown', 80),
      operator: sanitizeText(entry.operator || 'system', 80),
      detail: entry.detail || undefined,
      previous: entry.previous || undefined,
      next: entry.next || undefined,
    };
    ensureDir(this.auditLogPath);
    fs.appendFileSync(this.auditLogPath, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }

  getAuditLog(options = {}) {
    const lineLimit = Math.max(1, Math.min(200, Number(options.limit) || 40));
    return readLastLines(this.auditLogPath, lineLimit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (_) {
          return { schema: 'ops-audit-record-v1', at: '', action: 'unparsed', detail: line };
        }
      })
      .reverse();
  }

  getSystemSummary() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = Math.max(0, totalMemory - freeMemory);
    const cpus = os.cpus() || [];
    return {
      schema: 'ops-system-summary-v1',
      generatedAt: nowIso(this.now()),
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptimeSeconds: Math.round(os.uptime()),
      loadAverage: os.loadavg(),
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || '',
      memory: {
        totalBytes: totalMemory,
        freeBytes: freeMemory,
        usedBytes: usedMemory,
        usedPercent: totalMemory ? Math.round((usedMemory / totalMemory) * 1000) / 10 : 0,
        totalText: formatBytes(totalMemory),
        freeText: formatBytes(freeMemory),
        usedText: formatBytes(usedMemory),
      },
      disk: getDiskSummary(this.backendDir, this.executeCommand, this.platform),
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        memoryUsage: process.memoryUsage(),
        cwd: process.cwd(),
      },
    };
  }

  getPm2Summary() {
    const result = this.executeCommand('pm2', ['jlist'], { timeoutMs: 5000, maxOutput: 120000 });
    const list = parseJsonCommand(result, []);
    const processList = Array.isArray(list) ? list : [];
    const match = processList.find((item) => item.name === this.pm2AppName) || null;
    if (!match) {
      return {
        schema: 'ops-pm2-summary-v1',
        appName: this.pm2AppName,
        found: false,
        command: { ok: result.ok, error: result.stderr || result.error || '' },
      };
    }
    return {
      schema: 'ops-pm2-summary-v1',
      appName: this.pm2AppName,
      found: true,
      pmId: match.pm_id,
      name: match.name,
      status: match.pm2_env?.status || '',
      pid: match.pid || 0,
      restarts: match.pm2_env?.restart_time || 0,
      unstableRestarts: match.pm2_env?.unstable_restarts || 0,
      uptimeMs: match.pm2_env?.pm_uptime ? Math.max(0, Date.now() - match.pm2_env.pm_uptime) : 0,
      nodeVersion: match.pm2_env?.node_version || '',
      scriptPath: match.pm2_env?.pm_exec_path || '',
      cwd: match.pm2_env?.pm_cwd || '',
      execMode: match.pm2_env?.exec_mode || '',
      watching: Boolean(match.pm2_env?.watch),
      cpu: match.monit?.cpu || 0,
      memoryBytes: match.monit?.memory || 0,
      memoryText: formatBytes(match.monit?.memory || 0),
      outLogPath: match.pm2_env?.pm_out_log_path || '',
      errorLogPath: match.pm2_env?.pm_err_log_path || '',
    };
  }

  getDeploySummary() {
    const currentDeployPath = joinRuntimePath(this.deployStateDir, 'current-deploy.json');
    const deployLogPath = joinRuntimePath(this.deployStateDir, 'deploy.log');
    return {
      schema: 'ops-deploy-summary-v1',
      current: readJsonFile(currentDeployPath, null),
      currentDeployPath,
      deployLogPath,
      recentLogLines: readLastLines(deployLogPath, 30),
    };
  }

  getLogSummary(options = {}) {
    const pm2 = options.pm2 || this.getPm2Summary();
    const lineLimit = Math.max(1, Math.min(200, Number(options.lines) || DEFAULT_LOG_LINES));
    return {
      schema: 'ops-log-summary-v1',
      out: {
        path: pm2.outLogPath || '',
        lines: readLastLines(pm2.outLogPath, lineLimit),
      },
      error: {
        path: pm2.errorLogPath || '',
        lines: readLastLines(pm2.errorLogPath, lineLimit),
      },
    };
  }

  getHealthSummary() {
    const health = this.executeCommand('curl', ['-fsS', '--max-time', '3', this.healthUrl], {
      timeoutMs: 5000,
      maxOutput: 80000,
    });
    const parsed = parseJsonCommand(health, null);
    return {
      schema: 'ops-health-probe-v1',
      url: this.healthUrl,
      ok: Boolean(health.ok && parsed),
      status: parsed?.status || 'unavailable',
      health: parsed,
      error: health.ok ? '' : (health.stderr || health.error || ''),
    };
  }

  getConfigRuntimeSummary() {
    const runtimeStatus = this.configReleaseService?.getRuntimeStatus
      ? this.configReleaseService.getRuntimeStatus()
      : null;
    const loaderStatus = this.configRuntimeLoader?.getRuntimeLoaderStatus
      ? this.configRuntimeLoader.getRuntimeLoaderStatus()
      : null;
    return {
      schema: 'ops-config-runtime-summary-v1',
      runtimeStatus,
      loaderStatus,
    };
  }

  getDashboard(options = {}) {
    const pm2 = this.getPm2Summary();
    const observability = this.observabilityService?.getSnapshot
      ? this.observabilityService.getSnapshot({ pathLimit: 10, eventLimit: 10 })
      : null;
    const players = this.repository?.getPlayerActivitySummary
      ? this.repository.getPlayerActivitySummary({ recentLimit: 12 })
      : null;
    return {
      success: true,
      schema: 'ops-dashboard-v1',
      generatedAt: nowIso(this.now()),
      environment: {
        nodeEnv: this.env.NODE_ENV || 'development',
        pm2AppName: this.pm2AppName,
        healthUrl: this.healthUrl,
      },
      maintenance: this.getMaintenanceState(),
      system: this.getSystemSummary(),
      pm2,
      deploy: this.getDeploySummary(),
      health: this.getHealthSummary(),
      observability,
      players,
      configRuntime: this.getConfigRuntimeSummary(),
      logs: options.includeLogs ? this.getLogSummary({ pm2, lines: options.logLines }) : undefined,
      audit: this.getAuditLog({ limit: 20 }),
    };
  }

  restartService(options = {}) {
    const operator = sanitizeText(options.operator || 'admin', 80);
    const result = this.executeCommand('pm2', ['restart', this.pm2AppName, '--update-env'], {
      timeoutMs: Math.max(5000, Number(options.timeoutMs) || 15000),
      maxOutput: 40000,
    });
    const audit = this.appendAudit({
      action: 'pm2:restart',
      operator,
      detail: {
        ok: result.ok,
        status: result.status,
        stdout: result.stdout.slice(-2000),
        stderr: result.stderr.slice(-2000),
        error: result.error,
      },
    });
    return {
      success: result.ok,
      action: 'pm2:restart',
      audit,
      command: result,
    };
  }
}

module.exports = OpsControlService;
module.exports.getDefaultOpsDataDir = getDefaultOpsDataDir;
module.exports.getDefaultMaintenancePath = getDefaultMaintenancePath;
module.exports.getDefaultAuditLogPath = getDefaultAuditLogPath;
module.exports.normalizeMaintenance = normalizeMaintenance;
