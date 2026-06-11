const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  FALLBACK_BASH_PATHS,
  SHELL_SCRIPTS,
  findBash,
} = require('./check-shell-scripts');

test('shell script guard tracks project-owned shell entrypoints', () => {
  assert.deepEqual(SHELL_SCRIPTS, [
    'deploy.sh',
    'scripts/pre-deploy-gate.sh',
    'scripts/verify-deploy-hook.sh',
    'scripts/rollback-deploy.sh',
    'scripts/backup-runtime-state.sh',
    'scripts/restore-runtime-state.sh',
    'scripts/install-runtime-backup-cron.sh',
    'scripts/verify-runtime-backup.sh',
  ]);
});

test('shell script guard can find bash in PATH or Git for Windows fallback', () => {
  const bashPath = findBash();
  assert.equal(typeof bashPath, 'string');
  assert.notEqual(bashPath, '');
  assert.equal(fs.existsSync(bashPath), true);
});

test('shell script guard keeps Git for Windows fallback paths documented', () => {
  assert.equal(FALLBACK_BASH_PATHS.some((item) => item.includes('Git/bin/bash.exe')), true);
});

test('deploy rollback entrypoints keep ref and commit deployment support', () => {
  const repoRoot = path.join(__dirname, '..');
  const deployScript = fs.readFileSync(path.join(repoRoot, 'deploy.sh'), 'utf8');
  const rollbackScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'rollback-deploy.sh'), 'utf8');
  const verifyHookScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'verify-deploy-hook.sh'), 'utf8');

  assert.match(deployScript, /rev-parse --verify "\$BRANCH\^\{commit\}"/);
  assert.match(deployScript, /checkout -f "\$DEPLOY_COMMIT"/);
  assert.match(rollbackScript, /rev-parse --verify "\$TARGET_REF\^\{commit\}"/);
  assert.match(rollbackScript, /bash "\$DEPLOY_SCRIPT" "\$TARGET_COMMIT"/);
  assert.match(verifyHookScript, /bash -n "\$HOOK_PATH"/);
  assert.match(verifyHookScript, /current deploy commit is reachable/);
});

test('pre-deploy gate auto-installs architecture dependencies for server hooks', () => {
  const repoRoot = path.join(__dirname, '..');
  const gateScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'pre-deploy-gate.sh'), 'utf8');

  assert.match(gateScript, /WXGAME_GATE_INSTALL="\$\{WXGAME_GATE_INSTALL:-auto\}"/);
  assert.match(gateScript, /git --git-dir="\$REPO_GIT_DIR" --work-tree="\$REPO_ROOT"/);
  assert.match(gateScript, /node_modules\/\.wxgame-lock-sha256/);
  assert.match(gateScript, /backend\/node_modules\/\.wxgame-lock-sha256/);
  assert.match(gateScript, /npm ci --prefix "\$work_dir" --no-audit --no-fund/);
  assert.match(gateScript, /require\('xlsx'\); require\('better-sqlite3'\);/);
});

test('runtime backup and restore scripts keep explicit safety contracts', () => {
  const repoRoot = path.join(__dirname, '..');
  const backupScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'backup-runtime-state.sh'), 'utf8');
  const restoreScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'restore-runtime-state.sh'), 'utf8');
  const cronScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'install-runtime-backup-cron.sh'), 'utf8');
  const verifyScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'verify-runtime-backup.sh'), 'utf8');

  assert.match(backupScript, /RETENTION_DAYS="\$\{RETENTION_DAYS:-14\}"/);
  assert.match(backupScript, /db\.backup\(targetPath\)/);
  assert.match(backupScript, /backup-manifest\.json/);
  assert.match(backupScript, /wxgame-runtime-\$\(date -u/);
  assert.match(backupScript, /sha256/);

  assert.match(restoreScript, /WXGAME_RESTORE_CONFIRM=restore-runtime-state/);
  assert.match(restoreScript, /SKIP_PRE_RESTORE_BACKUP/);
  assert.match(restoreScript, /ALLOW_RESTORE_WITHOUT_PM2_STOP=1/);
  assert.match(restoreScript, /PM2 stop skipped by ALLOW_RESTORE_WITHOUT_PM2_STOP=1/);
  assert.match(restoreScript, /PM2 restart skipped by ALLOW_RESTORE_WITHOUT_PM2_STOP=1/);
  assert.match(restoreScript, /RESTORE_DEPLOY_STATE=1/);
  assert.match(restoreScript, /rm -f "\$DB_PATH-wal" "\$DB_PATH-shm"/);

  assert.match(cronScript, /BACKUP_CRON_SCHEDULE="\$\{BACKUP_CRON_SCHEDULE:-17 3 \* \* \*\}"/);
  assert.match(cronScript, /CRON_MARKER="\$\{CRON_MARKER:-WXGAME_RUNTIME_BACKUP\}"/);
  assert.match(cronScript, /crontab "\$next_cron"/);
  assert.match(cronScript, /# \$CRON_MARKER/);

  assert.match(verifyScript, /MAX_BACKUP_AGE_HOURS="\$\{MAX_BACKUP_AGE_HOURS:-26\}"/);
  assert.match(verifyScript, /REQUIRE_BACKUP_DB="\$\{REQUIRE_BACKUP_DB:-1\}"/);
  assert.match(verifyScript, /sha256sum -c/);
  assert.match(verifyScript, /backup-manifest\.json/);
  assert.match(verifyScript, /backend-db\/civilization\.db/);
});
