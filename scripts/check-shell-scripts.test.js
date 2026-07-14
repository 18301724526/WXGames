const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  FALLBACK_BASH_PATHS,
  SHELL_SCRIPTS,
  findBash,
} = require('./check-shell-scripts');

test('shell script guard tracks project-owned shell entrypoints', () => {
  assert.deepEqual(SHELL_SCRIPTS, [
    'deploy.sh',
    'scripts/deploy-test-server.sh',
    'scripts/pre-deploy-gate.sh',
    'scripts/prepare-test-server-runtime.sh',
    'scripts/test-server-ci-gate.sh',
    'scripts/verify-deploy-hook.sh',
    'scripts/rollback-deploy.sh',
    'scripts/backup-runtime-state.sh',
    'scripts/restore-runtime-state.sh',
    'scripts/install-runtime-backup-cron.sh',
    'scripts/verify-runtime-backup.sh',
    'scripts/rotate-production-secrets.sh',
    'scripts/install-ops-agent-pm2.sh',
    'scripts/m0-fixture/run-restore-drill.sh',
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
  assert.match(deployScript, /DEPLOY_GATE_SCRIPT="\$\{DEPLOY_GATE_SCRIPT:-scripts\/pre-deploy-gate\.sh\}"/);
  assert.match(deployScript, /run_deploy_gate\(\)/);
  assert.match(deployScript, /REPO_GIT_DIR="\$GIT_DIR_PATH" bash "\$gate_script" "\$WORK_TREE"/);
  assert.match(deployScript, /apply_frontend_environment_overrides/);
  assert.match(deployScript, /FRONTEND_API_BASE="\$\{FRONTEND_API_BASE:-\}"/);
  assert.match(deployScript, /FRONTEND_DEPLOY_STATUS_PATH="\$\{FRONTEND_DEPLOY_STATUS_PATH:-\}"/);
  assert.equal(deployScript.includes("DEPLOY_STATUS_PATH:\\s*['\"][^'\"]+['\"],"), true);
  assert.match(deployScript, /POST_BACKEND_SYNC_SCRIPT="\$\{POST_BACKEND_SYNC_SCRIPT:-\}"/);
  assert.match(deployScript, /run_post_backend_sync_script/);
  assert.match(deployScript, /publish_runtime_config_release\(\)/);
  assert.match(deployScript, /ConfigReleaseService\.publishRelease/);
  assert.match(deployScript, /cleanup-world-explorer-ready-state\.js"\s+set_deploy_stage "config-release"\s+publish_runtime_config_release\s+set_deploy_stage "pm2-restart"/s);
  assert.match(deployScript, /DEPLOY_STATUS_PATH="\$DEPLOY_STATE_DIR\/deploy-status\.json"/);
  assert.match(deployScript, /WXGAME_DEPLOY_STATUS_PATH="\$DEPLOY_STATUS_PATH"/);
  assert.match(deployScript, /set_deploy_stage\(\)/);
  assert.match(deployScript, /run_with_deploy_status_heartbeat\(\)/);
  assert.match(deployScript, /record_deploy_failure\(\)/);
  assert.match(deployScript, /write_deploy_status "failed" "\$message" "\$exit_code"/);
  assert.equal(deployScript.includes('if "$@"; then\n        command_status=0\n    else\n        command_status="$?"'), true);
  assert.equal(deployScript.includes('record_deploy_failure "$command_status" "command failed: $(describe_deploy_command "$@")"'), true);
  assert.equal(
    deployScript.indexOf('kill "$heartbeat_pid"'),
    deployScript.indexOf('kill "$heartbeat_pid"', deployScript.indexOf('run_with_deploy_status_heartbeat()')),
  );
  assert.equal(
    deployScript.indexOf('kill "$heartbeat_pid"', deployScript.indexOf('run_with_deploy_status_heartbeat()'))
      < deployScript.indexOf('record_deploy_failure "$command_status"', deployScript.indexOf('run_with_deploy_status_heartbeat()')),
    true,
  );
  assert.match(deployScript, /record_deploy_failure "\$exit_code" "deploy exited before completion"/);
  assert.match(deployScript, /record_deploy_failure "\$exit_code" "command failed: \$failed_command"/);
  assert.match(deployScript, /return "\$command_status"/);
  assert.match(deployScript, /run_with_deploy_status_heartbeat env REPO_GIT_DIR="\$GIT_DIR_PATH" bash "\$gate_script" "\$WORK_TREE"/);
  assert.match(deployScript, /set_deploy_stage "deploy-gate"/);
  assert.match(deployScript, /set_deploy_stage "health-check"/);
  assert.match(deployScript, /write_deploy_status "running"/);
  assert.match(deployScript, /write_deploy_status "failed"/);
  assert.match(deployScript, /write_deploy_status "succeeded"/);
  assert.match(deployScript, /OPS_AGENT_PM2_NAME="\$\{OPS_AGENT_PM2_NAME:-wxgame-ops-agent\}"/);
  assert.match(deployScript, /restart_ops_agent_if_configured/);
  assert.match(deployScript, /ENABLE_OPS_AGENT:-0/);
  assert.match(deployScript, /bash "\$WORK_TREE\/scripts\/install-ops-agent-pm2\.sh"/);
  assert.match(rollbackScript, /rev-parse --verify "\$TARGET_REF\^\{commit\}"/);
  assert.match(rollbackScript, /bash "\$DEPLOY_SCRIPT" "\$TARGET_COMMIT"/);
  assert.match(verifyHookScript, /bash -n "\$HOOK_PATH"/);
  assert.match(verifyHookScript, /current deploy commit is reachable/);
});

test('deploy release marker is written only after backend health passes', () => {
  const repoRoot = path.join(__dirname, '..');
  const deployScript = fs.readFileSync(path.join(repoRoot, 'deploy.sh'), 'utf8');
  const deployStageStart = deployScript.indexOf('run_deploy_gate');
  const firstHealthCheck = deployScript.indexOf('if health_payload="$(curl -fsS "http://localhost:${API_PORT}/api/health")"; then');
  const verifyRuntimeAfterHealth = deployScript.indexOf('verify_runtime_config "$health_payload"', firstHealthCheck);
  const publishAfterHealth = deployScript.indexOf('publish_frontend_assets', verifyRuntimeAfterHealth);
  const writeVersionAfterPublish = deployScript.indexOf('write_deploy_version', publishAfterHealth);
  const deployComplete = deployScript.indexOf('[Deploy]', writeVersionAfterPublish);
  const beforeHealthRuntimeStage = deployScript.slice(deployStageStart, firstHealthCheck);
  const earlyPublish = beforeHealthRuntimeStage.includes('publish_frontend_assets');
  const earlyVersionWrite = beforeHealthRuntimeStage.includes('write_deploy_version');

  assert.notEqual(deployStageStart, -1);
  assert.notEqual(firstHealthCheck, -1);
  assert.notEqual(verifyRuntimeAfterHealth, -1);
  assert.notEqual(publishAfterHealth, -1);
  assert.notEqual(writeVersionAfterPublish, -1);
  assert.notEqual(deployComplete, -1);
  assert.equal(earlyPublish, false);
  assert.equal(earlyVersionWrite, false);
  assert.match(deployScript, /export WXGAME_DEPLOY_MANIFEST_PATH="\$DEPLOY_STATE_DIR\/current-deploy\.json"/);
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
  assert.match(cronScript, /shell_quote\(\)/);
  assert.match(cronScript, /BACKUP_ROOT=\$\(shell_quote "\$BACKUP_ROOT"\)/);
  assert.match(cronScript, /bash \$\(shell_quote "\$BACKUP_SCRIPT"\)/);
  assert.match(cronScript, />> \$\(shell_quote "\$BACKUP_LOG"\) 2>&1/);
  assert.match(cronScript, /crontab "\$next_cron"/);
  assert.match(cronScript, /# \$CRON_MARKER/);
  assert.doesNotMatch(cronScript, /escape_sed_replacement/);
  assert.doesNotMatch(cronScript, /BACKUP_ROOT=\$escaped_backup_root/);

  assert.match(verifyScript, /MAX_BACKUP_AGE_HOURS="\$\{MAX_BACKUP_AGE_HOURS:-26\}"/);
  assert.match(verifyScript, /REQUIRE_BACKUP_DB="\$\{REQUIRE_BACKUP_DB:-1\}"/);
  assert.match(verifyScript, /sha256sum -c/);
  assert.match(verifyScript, /backup-manifest\.json/);
  assert.match(verifyScript, /backend-db\/civilization\.db/);
});

test('ops-agent PM2 installer keeps localhost bind and fixed target app contract', () => {
  const repoRoot = path.join(__dirname, '..');
  const script = fs.readFileSync(path.join(repoRoot, 'scripts', 'install-ops-agent-pm2.sh'), 'utf8');

  assert.match(script, /OPS_AGENT_BIND_HOST="\$\{OPS_AGENT_BIND_HOST:-127\.0\.0\.1\}"/);
  assert.match(script, /OPS_AGENT_PORT="\$\{OPS_AGENT_PORT:-3101\}"/);
  assert.match(script, /OPS_AGENT_PM2_APP="\$\{OPS_AGENT_PM2_APP:-server\}"/);
  assert.match(script, /pm2 start "\$AGENT_SCRIPT" --name "\$OPS_AGENT_PM2_NAME" --cwd "\$BACKEND_DIR" --update-env/);
  assert.match(script, /proxy_pass http:\/\/127\.0\.0\.1:\$\{OPS_AGENT_PORT\}\//);
});

test('runtime backup cron installer writes normal quoted paths', () => {
  const repoRoot = path.join(__dirname, '..');
  const bashPath = findBash();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgame-cron-test-'));
  const toShellPath = (value) => value.replace(/\\/g, '/');

  try {
    const fakeBin = path.join(tempRoot, 'bin');
    const workTree = path.join(tempRoot, 'work tree');
    const backupScript = path.join(workTree, 'scripts', 'backup-runtime-state.sh');
    const backupRoot = path.join(tempRoot, 'backup root');
    const backupLog = path.join(tempRoot, 'state dir', 'backup log.txt');
    const crontabStore = path.join(tempRoot, 'crontab.txt');
    const fakeCrontab = path.join(fakeBin, 'crontab');

    fs.mkdirSync(path.dirname(backupScript), { recursive: true });
    fs.mkdirSync(fakeBin, { recursive: true });
    fs.writeFileSync(backupScript, '#!/usr/bin/env bash\necho backup\n', 'utf8');
    fs.chmodSync(backupScript, 0o755);
    fs.writeFileSync(fakeCrontab, [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'if [ "${1:-}" = "-l" ]; then',
      '  if [ -f "$FAKE_CRONTAB_STORE" ]; then cat "$FAKE_CRONTAB_STORE"; else exit 1; fi',
      'else',
      '  cp "$1" "$FAKE_CRONTAB_STORE"',
      'fi',
      '',
    ].join('\n'), 'utf8');
    fs.chmodSync(fakeCrontab, 0o755);

    const env = {
      ...process.env,
      PATH: `${toShellPath(fakeBin)}${path.delimiter}${process.env.PATH || ''}`,
      FAKE_CRONTAB_STORE: toShellPath(crontabStore),
      WORK_TREE: toShellPath(workTree),
      BACKUP_ROOT: toShellPath(backupRoot),
      BACKUP_LOG: toShellPath(backupLog),
      BACKUP_CRON_SCHEDULE: '1 2 * * *',
    };
    const result = spawnSync(bashPath, [path.join(repoRoot, 'scripts', 'install-runtime-backup-cron.sh')], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      shell: false,
    });

    assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join('\n'));
    const cron = fs.readFileSync(crontabStore, 'utf8');
    assert.equal(cron.includes('\\/'), false);
    assert.match(cron, /^1 2 \* \* \* /);
    assert.match(cron, /# WXGAME_RUNTIME_BACKUP$/m);
    assert.equal(cron.includes(`BACKUP_ROOT='${toShellPath(backupRoot)}'`), true);
    assert.equal(cron.includes(`bash '${toShellPath(backupScript)}'`), true);
    assert.equal(cron.includes(`>> '${toShellPath(backupLog)}' 2>&1`), true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
