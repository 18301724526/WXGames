# T6 实现层缺陷修复证据

- 日期：2026-07-15
- 分支：`claude/eloquent-mclaren-e920e2`
- 边界：仅 Windows 工作区与 WSL `Ubuntu-24.04` 本地隔离环境；未部署、未访问生产或公网服务器。

## FI-24 — JWT fallback 环境 allowlist

- 提交：`f7820917 fix(m0): FI-24 限制 JWT fallback 环境`

## FI-21 — SQLite restore 中断可重入

- 恢复顺序：准备固定临时文件 → 清理 WAL → 清理 SHM → 原子替换主库。
- 幂等边界：临时文件、WAL、SHM 均先检查存在性；激活主库前再次检查临时文件。

### Windows ShellCheck 原始输出

命令：

```powershell
%USERPROFILE%\tools\shellcheck\shellcheck.exe --version
%USERPROFILE%\tools\shellcheck\shellcheck.exe --format=gcc scripts/restore-runtime-state.sh
```

版本原始输出：

```text
ShellCheck - shell script analysis tool
version: 0.10.0
license: GNU General Public License, version 3
website: https://www.shellcheck.net
```

检查原始输出：

```text
[shellcheck-exit] 0
```

### WSL ShellCheck 原始输出

命令：

```powershell
wsl.exe -d Ubuntu-24.04 -u root -- shellcheck --version
wsl.exe -d Ubuntu-24.04 -u root -- shellcheck --format=gcc '/mnt/f/AI Project/WXGamesLocal/scripts/restore-runtime-state.sh'
```

版本原始输出：

```text
ShellCheck - shell script analysis tool
version: 0.9.0
license: GNU General Public License, version 3
website: https://www.shellcheck.net
```

检查原始输出：

```text
[shellcheck-exit] 0
```

### 中断点重跑演练原始输出

命令：

```powershell
wsl.exe -d Ubuntu-24.04 -u root -- bash '/mnt/f/AI Project/WXGamesLocal/tmp/m0-fi21/run-restore-interruption-drill.sh'
```

退出码：`0`

```text
[fi21-drill] case=after-copy interrupt_exit=97 retry_exit=0 rerun_exit=0 checksum=05f0b7182beffe4c3907609d4efd0796374085e2f0ebd245b010c42ed75c9561 sidecars=absent result=pass
[fi21-drill] case=after-wal interrupt_exit=97 retry_exit=0 rerun_exit=0 checksum=05f0b7182beffe4c3907609d4efd0796374085e2f0ebd245b010c42ed75c9561 sidecars=absent result=pass
[fi21-drill] case=after-shm interrupt_exit=97 retry_exit=0 rerun_exit=0 checksum=05f0b7182beffe4c3907609d4efd0796374085e2f0ebd245b010c42ed75c9561 sidecars=absent result=pass
[fi21-drill] case=before-move interrupt_exit=97 retry_exit=0 rerun_exit=0 checksum=05f0b7182beffe4c3907609d4efd0796374085e2f0ebd245b010c42ed75c9561 sidecars=absent result=pass
[fi21-drill] case=after-move interrupt_exit=97 retry_exit=0 rerun_exit=0 checksum=05f0b7182beffe4c3907609d4efd0796374085e2f0ebd245b010c42ed75c9561 sidecars=absent result=pass
[fi21-drill] passed=5 failed=0
```

- 隔离原始日志：`tmp/m0-fi21/restore-interruption-drill/<中断点>/{interrupted,retry,rerun}.log`

## FI-22 — hardlink 回滚快照只读保护

- 快照创建顺序：`cp -al` 成功后执行 `chmod -R a-w`；若只读设置失败则清理无效快照。
- 回滚顺序：先执行 `chmod -R u+w`，成功后才执行 `rsync`。
- 既有 ShellCheck 基线：全文件仅有 `SC2317` 与 `SC2034`；与 `HEAD:deploy.sh` 告警集合相同，以下检查排除这两条既有告警。

### 语法与 ShellCheck 原始输出

命令：

```powershell
wsl.exe -d Ubuntu-24.04 -u root -- bash -n '/mnt/f/AI Project/WXGamesLocal/deploy.sh'
wsl.exe -d Ubuntu-24.04 -u root -- shellcheck --format=gcc --exclude=SC2317,SC2034 '/mnt/f/AI Project/WXGamesLocal/deploy.sh'
wsl.exe -d Ubuntu-24.04 -u root -- bash -n '/mnt/f/AI Project/WXGamesLocal/tmp/m0-fi22/run-hardlink-snapshot-drill.sh'
wsl.exe -d Ubuntu-24.04 -u root -- shellcheck --format=gcc '/mnt/f/AI Project/WXGamesLocal/tmp/m0-fi22/run-hardlink-snapshot-drill.sh'
%USERPROFILE%\tools\shellcheck\shellcheck.exe --format=gcc --exclude=SC2317,SC2034 deploy.sh
```

原始输出：

```text
[wsl-bash-n-deploy-exit] 0
[wsl-shellcheck-deploy-exit] 0
[wsl-bash-n-drill-exit] 0
[wsl-shellcheck-drill-exit] 0
[windows-shellcheck-deploy-exit] 0
```

### shell 守卫测试原始输出

命令：

```powershell
node --test scripts/check-shell-scripts.test.js
```

退出码：`0`

```text
✔ shell script guard tracks project-owned shell entrypoints (0.7913ms)
✔ shell script guard can find bash in PATH or Git for Windows fallback (35.4855ms)
✔ shell script guard keeps Git for Windows fallback paths documented (0.531ms)
✔ deploy rollback entrypoints keep ref and commit deployment support (0.7142ms)
✔ deploy release marker is written only after backend health passes (0.2893ms)
✔ pre-deploy gate auto-installs architecture dependencies for server hooks (0.2244ms)
✔ runtime backup and restore scripts keep explicit safety contracts (0.3672ms)
✔ ops-agent PM2 installer keeps localhost bind and fixed target app contract (0.1458ms)
✔ runtime backup cron installer writes normal quoted paths (383.3739ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 473.8482
```

### WSL hardlink 快照与回滚演练原始输出

命令：

```powershell
wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "bash '/mnt/f/AI Project/WXGamesLocal/tmp/m0-fi22/run-hardlink-snapshot-drill.sh' 2>&1"
```

退出码：`0`

```text
[Deploy] 已创建只读回滚快照: /tmp/wxgame-fi22.fbbICR/runtime/state/backend.rollback-prev
[fi22-drill] hardlink_inode_match=true snapshot_mode=444 backend_mode=444 snapshot_write_exit=1 result=pass
[Deploy] 健康检查失败，自动回滚到上一版本...
[Deploy] 回滚成功：上一版本已恢复运行。
[fi22-drill] rollback_content=previous-release snapshot_mode=644 backend_mode=644 write_restore_exit=0 result=pass
[Deploy] 已创建只读回滚快照: /tmp/wxgame-fi22.fbbICR/runtime/state/backend.rollback-prev
[fi22-drill] resnapshot_mode=444 write_exit=1 cleanup_recreate=pass result=pass
[fi22-drill] passed=3 failed=0
```
