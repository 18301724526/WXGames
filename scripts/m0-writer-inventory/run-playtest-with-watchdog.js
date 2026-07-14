'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_STALL_MS = 30000;
const DEFAULT_WALL_MS = 60000;

function positiveInteger(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function killProcessGroup(child, signal) {
  if (!child?.pid || child.exitCode !== null) return false;
  try {
    if (process.platform === 'win32') return child.kill(signal);
    process.kill(-child.pid, signal);
    return true;
  } catch (_) {
    return child.kill(signal);
  }
}

function runPlaytest(options = {}) {
  const env = options.env || process.env;
  const stallMs = positiveInteger(env.M0_PLAYTEST_STALL_MS, DEFAULT_STALL_MS);
  const wallMs = positiveInteger(env.M0_PLAYTEST_WALL_MS, DEFAULT_WALL_MS);
  const command = options.command || process.execPath;
  const args = options.args || ['scripts/playtest-game-smoke.js'];
  const startedAt = Date.now();
  let stopReason = '';
  let stallTimer = null;
  let forceTimer = null;

  const child = spawn(command, args, {
    cwd: options.cwd || REPO_ROOT,
    env: {
      ...env,
      PLAYTEST_PROGRESS: '1',
    },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const armStallTimer = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      stopReason = `stall>${stallMs}ms`;
      process.stderr.write(`[stall-watchdog] ${stopReason}; terminating child\n`);
      killProcessGroup(child, 'SIGTERM');
      forceTimer = setTimeout(() => killProcessGroup(child, 'SIGKILL'), 5000);
    }, stallMs);
  };
  const forward = (stream, target) => {
    stream.on('data', (chunk) => {
      armStallTimer();
      target.write(chunk);
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  armStallTimer();

  const wallTimer = setTimeout(() => {
    stopReason = `wall>${wallMs}ms`;
    process.stderr.write(`[stall-watchdog] ${stopReason}; terminating child\n`);
    killProcessGroup(child, 'SIGTERM');
    forceTimer = setTimeout(() => killProcessGroup(child, 'SIGKILL'), 5000);
  }, wallMs);

  process.stdout.write(
    `[stall-watchdog] started pid=${child.pid} stallMs=${stallMs} wallMs=${wallMs}\n`,
  );

  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      clearTimeout(stallTimer);
      clearTimeout(wallTimer);
      clearTimeout(forceTimer);
      const result = {
        code: Number.isInteger(code) ? code : (stopReason ? 124 : 1),
        signal: signal || '',
        stopReason,
        wallMs: Date.now() - startedAt,
      };
      process.stdout.write(
        `[stall-watchdog] exited code=${result.code} signal=${result.signal || 'none'} `
          + `wallMs=${result.wallMs} stopReason=${result.stopReason || 'none'}\n`,
      );
      resolve(result);
    });
  });
}

async function main() {
  const result = await runPlaytest();
  process.exitCode = result.code;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`[stall-watchdog] ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_STALL_MS,
  DEFAULT_WALL_MS,
  killProcessGroup,
  positiveInteger,
  runPlaytest,
};
