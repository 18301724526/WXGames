# FI-22 硬链快照根治证据

日期：2026-07-15  
范围：仅本地与 WSL 镜像；未连接或操作生产服务器。

## FI22-T1 — 拆除 chmod、排除可变数据

提交：`7a1d33e1 fix(deploy): FI22-T1 排除硬链快照运行时数据`

隔离演练原始输出：

```text
[Deploy] 已创建回滚快照: /tmp/tmp.Mr1KWYy7MP/state/backend.rollback-prev
db_mode=644 code_hardlink_inode=9570149209271328 db_snapshot=absent logs_snapshot=absent replacement_snapshot=old-code
```

## FI22-T2 — 机械回归测试

### 负控：T1 前的 deploy.sh（预期失败）

命令：

```powershell
$env:FI22_DEPLOY_SH_REF = '7a1d33e1^'
node --test --test-name-pattern="deploy hardlink snapshot" scripts/check-shell-scripts.test.js
```

原始输出：

```text
✖ deploy hardlink snapshot forbids chmod and excludes database runtime data (26.5037ms)
✖ deploy hardlink snapshot drill preserves live database and replaced code snapshot (139.0575ms)
ℹ tests 2
ℹ suites 0
ℹ pass 0
ℹ fail 2
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 213.8392

✖ failing tests:

test at scripts\check-shell-scripts.test.js:117:1
✖ deploy hardlink snapshot forbids chmod and excludes database runtime data (26.5037ms)
  AssertionError [ERR_ASSERTION]: deploy.sh must not chmod a hardlink snapshot: chmod -R u+w -- "$snapshot_dir
      at TestContext.<anonymous> (F:\AI Project\WXGamesLocal\scripts\check-shell-scripts.test.js:129:10)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1201:25)
      at Test.start (node:internal/test_runner/test:1096:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:385:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at scripts\check-shell-scripts.test.js:135:1
✖ deploy hardlink snapshot drill preserves live database and replaced code snapshot (139.0575ms)
  Error: EPERM: operation not permitted, open 'C:\Users\18301\AppData\Local\Temp\wxgame-hardlink-snapshot-R4vbGf\backend\civilization.db'
      at Object.writeFileSync (node:fs:2414:20)
      at Object.appendFileSync (node:fs:2496:6)
      at TestContext.<anonymous> (F:\AI Project\WXGamesLocal\scripts\check-shell-scripts.test.js:177:8)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1201:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:831:18)
      at Test.postRun (node:internal/test_runner/test:1330:19)
      at Test.run (node:internal/test_runner/test:1258:12)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:385:3) {
    errno: -4048,
    code: 'EPERM',
    syscall: 'open',
    path: 'C:\\Users\\18301\\AppData\\Local\\Temp\\wxgame-hardlink-snapshot-R4vbGf\\backend\\civilization.db'
  }
NEGATIVE_EXIT=1
```

### 修复后的 deploy.sh（预期通过）

命令：

```powershell
Remove-Item Env:FI22_DEPLOY_SH_REF
node --test --test-name-pattern="deploy hardlink snapshot" scripts/check-shell-scripts.test.js
```

原始输出：

```text
✔ deploy hardlink snapshot forbids chmod and excludes database runtime data (1.4452ms)
✔ deploy hardlink snapshot drill preserves live database and replaced code snapshot (355.9943ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 407.5123
POSITIVE_EXIT=0
```

### 测试文件全量

命令：

```powershell
node --test scripts/check-shell-scripts.test.js
```

原始输出：

```text
✔ shell script guard tracks project-owned shell entrypoints (0.7901ms)
✔ shell script guard can find bash in PATH or Git for Windows fallback (33.9122ms)
✔ shell script guard keeps Git for Windows fallback paths documented (0.0994ms)
✔ deploy rollback entrypoints keep ref and commit deployment support (7.3976ms)
✔ deploy hardlink snapshot forbids chmod and excludes database runtime data (0.3685ms)
✔ deploy hardlink snapshot drill preserves live database and replaced code snapshot (389.1514ms)
✔ deploy release marker is written only after backend health passes (0.9227ms)
✔ pre-deploy gate auto-installs architecture dependencies for server hooks (6.4534ms)
✔ runtime backup and restore scripts keep explicit safety contracts (2.1368ms)
✔ ops-agent PM2 installer keeps localhost bind and fixed target app contract (0.812ms)
✔ runtime backup cron installer writes normal quoted paths (394.6845ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 888.1657
```
