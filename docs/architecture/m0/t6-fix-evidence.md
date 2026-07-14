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
