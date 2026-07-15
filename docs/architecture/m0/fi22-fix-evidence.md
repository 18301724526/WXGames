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

## FI22-T3 — 全量门禁

### npm test

命令：

```powershell
npm test
```

原始开头与汇总输出：

```text
> wxgameslocal@1.0.0 test
> node scripts/run-node-tests.js

[test] Running 294 all test files
ℹ tests 2249
ℹ suites 0
ℹ pass 2249
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7416.3024
```

### npm run lint

命令：

```powershell
npm run lint
```

原始输出：

```text
> wxgameslocal@1.0.0 lint
> eslint . --suppressions-location eslint-suppressions.json
```

进程退出码：`0`。

### architecture-smoke

命令：

```powershell
node scripts/run-architecture-smoke.js
```

原始末段输出：

```text
[architecture-smoke] shell script syntax guard
[shell-scripts] passed: 14 scripts via C:\Program Files\Git\bin\bash.exe
[architecture-smoke] config pipeline validation guard
[config-pipeline] registries: 6
[config-pipeline] battle-config version=1.0.0 schema=battle-config-registry@1 entries=9 hash=439aa4a3d614 source=backend/config/BattleConfig.js
[config-pipeline] building-config version=2.5 schema=building-config-registry@1 entries=10 hash=9f99e47710a9 source=shared/buildingConfig.json
[config-pipeline] era-config version=1.0.0 schema=era-config-registry@1 entries=6 hash=857323ac7add source=backend/config/EraConfig.js
[config-pipeline] game-config version=1.2.0 schema=game-config-registry@1 entries=3 hash=dd182768b8c7 source=backend/config/GameConfig.js
[config-pipeline] task-definitions version=1.2.0 schema=task-definition-registry@1 entries=6 hash=83a9b73fe010 source=backend/config/defaultTaskDefinitions.json
[config-pipeline] tech-tree-config version=1.1.0 schema=tech-tree-config-registry@1 entries=28 hash=a84734d721bc source=backend/config/TechTreeConfig.js
[config-pipeline] changed=4 added=0 removed=0
[config-pipeline] diff building-config 2.4->2.5 contentChanged=true schemaChanged=false addedEntries=0 removedEntries=0 recommended=minor:2.5.0 ok=true
[config-pipeline] diff game-config 1.0.0->1.2.0 contentChanged=true schemaChanged=false addedEntries=1 removedEntries=0 recommended=minor:1.1.0 ok=true
[config-pipeline] diff task-definitions 0.1.0->1.2.0 contentChanged=true schemaChanged=false addedEntries=3 removedEntries=0 recommended=minor:0.2.0 ok=true
[config-pipeline] diff tech-tree-config 1.0.0->1.1.0 contentChanged=true schemaChanged=false addedEntries=0 removedEntries=0 recommended=minor:1.1.0 ok=true
[architecture-smoke] config tables freshness guard
[config-tables] check passed: 8 table(s) fresh
[architecture-smoke] git diff --check
[architecture-smoke] passed
```

进程退出码：`0`；完整命令输出共 `2666` 行。

### shellcheck deploy.sh

Windows 原始输出：

```text
SHELLCHECK_EXIT=0
GIT_DIFF_CHECK_EXIT=0
```

WSL 原始输出：

```text
WSL_SHELLCHECK_EXIT=0
GIT_DIFF_CHECK_EXIT=0
```

### git diff --check

命令无标准输出，进程退出码：`0`。

## FI22-T4 — WSL 镜像端到端部署验证

目标仅为本机 `local` remote：`http://localhost:3001/wxgame.git`。未连接或操作 `private` remote、`47.116.32.216` 或 `kodagame.top`。

### 第一次部署当前 main

命令：

```powershell
wxpush main
```

部署关键原始输出：

```text
remote: [hook] deploying branch: main
remote: [deploy-test-server] Deploying branch main to isolated test server
remote: HEAD is now at c85a8f6c chore(deploy): FI22-T3 通过全量门禁
remote: [Deploy] Running post-backend sync script: /root/wxgame-test/worktree/scripts/prepare-test-server-runtime.sh
remote: [Deploy] Publishing runtime config release: deploy:c85a8f6c5b9ec2d67f2591c931b94a829eaa5f1e
remote: [Deploy] 已创建回滚快照: /root/wxgame-test/.wxgame/backend.rollback-prev
remote: [Deploy] PM2 listener confirmed: app=wxgame-test-server pid=1473 port=3002 cwd=/root/wxgame-test/backend script=/root/wxgame-test/backend/server.js
remote: [Deploy] PM2 process confirmed: app=wxgame-test-world-worker pid=1499 cwd=/root/wxgame-test/backend script=/root/wxgame-test/backend/world-worker.js
remote: [Deploy] 部署完成
To http://localhost:3001/wxgame.git
   c7b19303..c85a8f6c  main -> main
```

进程退出码：`0`。

### 迁移表、迁移记录与真实写事务

第一次部署后，直接打开镜像 `/root/wxgame-test/backend/civilization.db` 查询并执行 `BEGIN IMMEDIATE` + DDL + `ROLLBACK`。原始输出：

```json
{
  "dbPath": "/root/wxgame-test/backend/civilization.db",
  "tables": [
    "command_execution_plans",
    "command_receipts",
    "release_manifests"
  ],
  "migrations": [
    {
      "id": "001-game-states-compat-columns",
      "status": "applied",
      "appliedAt": "2026-06-24T18:36:48.913Z"
    },
    {
      "id": "002-capture-decisions-column",
      "status": "applied",
      "appliedAt": "2026-07-06T12:47:13.407Z"
    },
    {
      "id": "003-owner-locks-generalization",
      "status": "applied",
      "appliedAt": "2026-07-14T18:54:13.132Z"
    },
    {
      "id": "004-command-idempotency-store",
      "status": "applied",
      "appliedAt": "2026-07-14T18:54:13.132Z"
    },
    {
      "id": "005-task-reward-grants-column",
      "status": "applied",
      "appliedAt": "2026-07-14T18:54:13.133Z"
    },
    {
      "id": "006-rebuild-game-states-current-schema",
      "status": "applied",
      "appliedAt": "2026-07-14T18:54:13.142Z"
    },
    {
      "id": "007-create-release-manifests",
      "status": "applied",
      "appliedAt": "2026-07-15T14:58:09.810Z"
    },
    {
      "id": "008-create-command-receipts",
      "status": "applied",
      "appliedAt": "2026-07-15T14:58:09.810Z"
    },
    {
      "id": "009-create-command-execution-plans",
      "status": "applied",
      "appliedAt": "2026-07-15T14:58:09.810Z"
    }
  ],
  "writeProbe": "BEGIN IMMEDIATE/DDL/ROLLBACK ok"
}
```

### 第二次部署（同一 commit 幂等）

同一 commit 直接 push 不会触发 `post-receive`。本地镜像钩子已明确在删除分支时跳过部署，因此先删除本地 remote 的 `main`，不切换运行版本，再用 `wxpush main` 重建同一 ref 并触发第二次真实部署。

触发准备的原始输出：

```text
c85a8f6c5b9ec2d67f2591c931b94a829eaa5f1e	refs/heads/main
remote: [hook] branch main deleted; skipping deploy
To http://localhost:3001/wxgame.git
 - [deleted]           main
```

第二次命令：

```powershell
wxpush main
```

部署关键原始输出：

```text
remote: [hook] deploying branch: main
remote: [deploy-test-server] Deploying branch main to isolated test server
remote: HEAD is now at c85a8f6c chore(deploy): FI22-T3 通过全量门禁
remote: [Deploy] Publishing runtime config release: deploy:c85a8f6c5b9ec2d67f2591c931b94a829eaa5f1e
remote: {"schema":"deploy-config-release-v1","action":"skip","status":"matched","activeRelease":{"id":"20260714T185342028Z-c8278a4157b4-156144e4","action":"publish","createdAt":"2026-07-14T18:53:42.028Z","operator":"supervisor-reset","source":"reset:c7b19303d5e839d1c449ecfc7b18bb03b666785a","snapshotHash":"c8278a4157b4","registryCount":6}}
remote: [Deploy] 已创建回滚快照: /root/wxgame-test/.wxgame/backend.rollback-prev
remote: [Deploy] PM2 listener confirmed: app=wxgame-test-server pid=2114 port=3002 cwd=/root/wxgame-test/backend script=/root/wxgame-test/backend/server.js
remote: [Deploy] PM2 process confirmed: app=wxgame-test-world-worker pid=2140 cwd=/root/wxgame-test/backend script=/root/wxgame-test/backend/world-worker.js
remote: [Deploy] 部署完成
To http://localhost:3001/wxgame.git
 * [new branch]        main -> main
```

进程退出码：`0`。

第二次部署后的迁移记录与真实写事务原始输出；`appliedAt` 未变化：

```json
{
  "dbPath": "/root/wxgame-test/backend/civilization.db",
  "migrations": [
    {
      "id": "007-create-release-manifests",
      "status": "applied",
      "appliedAt": "2026-07-15T14:58:09.810Z"
    },
    {
      "id": "008-create-command-receipts",
      "status": "applied",
      "appliedAt": "2026-07-15T14:58:09.810Z"
    },
    {
      "id": "009-create-command-execution-plans",
      "status": "applied",
      "appliedAt": "2026-07-15T14:58:09.810Z"
    }
  ],
  "writeProbe": "second BEGIN IMMEDIATE/DDL/ROLLBACK ok"
}
```

### 最终 DB 权限、快照排除、pm2 与健康

原始输出：

```text
755 root:root /root/wxgame-test/backend/civilization.db
755 root:root /root/wxgame-test/backend/civilization.db-wal
755 root:root /root/wxgame-test/backend/civilization.db-shm
644 root:root /root/wxgame-test/backend/observability.db
644 root:root /root/wxgame-test/backend/observability.db-wal
644 root:root /root/wxgame-test/backend/observability.db-shm
SNAPSHOT_DB_COUNT=0
┌────┬─────────────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name                        │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼─────────────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ wxgame-test-server          │ default     │ 0.2.1   │ fork    │ 2114     │ 83s    │ 2    │ online    │ 0%       │ 84.3mb   │ root     │ disabled │
│ 1  │ wxgame-test-world-worker    │ default     │ 0.2.1   │ fork    │ 2140     │ 83s    │ 2    │ online    │ 0%       │ 57.5mb   │ root     │ disabled │
└────┴─────────────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
{"status":"ok"}
```

最终 remote 与部署状态原始输出：

```text
c85a8f6c5b9ec2d67f2591c931b94a829eaa5f1e	refs/heads/main
{"status":"succeeded","branch":"main","targetCommit":"c85a8f6c5b9ec2d67f2591c931b94a829eaa5f1e","previousDeployedCommit":"c85a8f6c5b9ec2d67f2591c931b94a829eaa5f1e","stage":"complete","exitCode":0}
```
