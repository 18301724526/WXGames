const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');
const SHELL_SCRIPTS = Object.freeze([
  'deploy.sh',
  'scripts/pre-deploy-gate.sh',
  'scripts/verify-deploy-hook.sh',
  'scripts/rollback-deploy.sh',
  'scripts/backup-runtime-state.sh',
  'scripts/restore-runtime-state.sh',
  'scripts/install-runtime-backup-cron.sh',
  'scripts/verify-runtime-backup.sh',
  'scripts/rotate-production-secrets.sh',
]);

const FALLBACK_BASH_PATHS = Object.freeze([
  'C:/Program Files/Git/bin/bash.exe',
  'C:/Program Files/Git/usr/bin/bash.exe',
  'C:/Program Files (x86)/Git/bin/bash.exe',
  'C:/Program Files (x86)/Git/usr/bin/bash.exe',
]);

function findBash() {
  const command = process.platform === 'win32' ? 'where' : 'command';
  const args = process.platform === 'win32' ? ['bash'] : ['-v', 'bash'];
  const result = spawnSync(command, args, { encoding: 'utf8', shell: process.platform !== 'win32' });
  const candidate = String(result.stdout || '').split(/\r?\n/).find(Boolean);
  if (candidate) return candidate.trim();
  return FALLBACK_BASH_PATHS.find((fallbackPath) => fs.existsSync(fallbackPath)) || '';
}

function checkScript(bashPath, script) {
  const scriptPath = path.join(repoRoot, script);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Missing shell script: ${script}`);
  }
  const result = spawnSync(bashPath, ['-n', scriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`bash -n failed for ${script}${detail ? `\n${detail}` : ''}`);
  }
}

function main() {
  const bashPath = findBash();
  if (!bashPath) {
    throw new Error('Missing bash. Install Git for Windows or add bash to PATH before running architecture checks.');
  }
  SHELL_SCRIPTS.forEach((script) => checkScript(bashPath, script));
  console.log(`[shell-scripts] passed: ${SHELL_SCRIPTS.length} scripts via ${bashPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[shell-scripts] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  FALLBACK_BASH_PATHS,
  SHELL_SCRIPTS,
  findBash,
  checkScript,
};
