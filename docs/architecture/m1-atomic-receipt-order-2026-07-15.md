# M1 Order — 原子 receipt 与命令恢复所有权（Expand 切片，2026-07-15）

Status: **READY FOR DISPATCH（owner 授权过夜自主执行，约 4 小时工作量）。**
Authority: owner 指令 2026-07-15。M0 已完结并入 main（65df4bd6）。
规范基准: `7月14日后端架构/当前实现迁移路线图-v2.3.md` §6（M1）；`成熟SLG后端参考架构-v2.3.html` §01 命令事务序列 + command_receipts/command_execution_plans 表定义。
范围界定: **本单只做 M1 的 expand 阶段（加结构 + 影子写 + 特征/故障测试），零权威写入切换、零领域行为变化。** 把"领域写与 terminal receipt 塌进同一事务""guardian 真正接管在线命令"这类会改既有行为、需真机终验的 contract 阶段留给下一张单（M1b，需 owner 在场一次性终验）。这样过夜自主跑的每一步都有机械判据、不需要中途人工判断——符合 [[refactor-no-debt-for-safety]]："需要中途人工验证=红旗"。

## 纪律（与 M0 同）

- 按序执行，一任务一 commit，commit 信息引用任务编号；判据在单内，完成即自验。
- 遵循 AGENTS.md 检索纪律：先 codegraph explore 定位，禁大面积通读，只读编辑区段。
- 测试数字禁转述，以命令原始输出为准；每任务过 `npm test`、`npm run lint`、`node scripts/run-architecture-smoke.js` 三门禁。LF 换行、UTF-8。
- **不改已发布迁移**（append-only，走 SchemaMigrationService 契约新增迁移文件）；不删既有门禁；不碰教程拆除后的 append-only 残留列。
- **expand 纪律铁律**：新表新列只增不改；旧 `CommandIdempotencyStore`/`CommandCommitter` 现有行为**保持不变**，receipt 新表以**影子写**并行（写失败只告警不阻断领域结果），本单不切换任何权威 reader/writer。
- 运行时验证只许 WSL 镜像/本地隔离进程（**禁打公网服务器，含 47.116.32.216**）；部署用 `wxpush main`（自唤醒），或自包含 `wsl -d Ubuntu-24.04 -u root -- true; Start-Sleep 8; git push local main`。网络政策：禁网仅指禁碰生产/公网服务器；联网装工具允许。
- **遇阻立即停手报告最小复现，禁试修-撤回循环**；单次验证 wall-clock 超正常 1.5 倍即判异常停手。做完 M1a-T6 即停等审查。**禁止 spawn 子 agent。**

## 已核实的当前事实（发单前核对，执行者仍须自查）

- 现有 `backend/application/commands/CommandIdempotencyStore.js`：`begin()` 先持久化 `in_progress`，崩溃窗口残留 `COMMAND_IN_FLIGHT`，无 recovery guardian。
- `backend/application/commands/CommandCommitter.js`：`commit()`(领域写) 与 `recordResult()`(终态) 两步分离——这是 M1 contract 阶段要塌成一事务的目标，**本单不动它**。
- 迁移走 `backend/services/SchemaMigrationService.js` 的 id/checksum/lock 契约；最近迁移编号见 `backend/migrations/`（M0 已加到 007-create-release-manifests，本单顺延）。
- 命令注册表 `CommandOwnerResolver.COMMAND_OWNER_RULES`（44 命令类型，M0 已建清单 `docs/architecture/m0/command-invariants.md`）。

## 任务（按序，每任务一 commit）

### M1a-T1 — expand migration：command_receipts 表
- 新迁移文件（顺延编号，如 008-create-command-receipts），走 SchemaMigrationService 契约。
- 列（对齐参考架构 §01 + 迁移路线图 §6 交付）：`command_id`(PK)、`payload_hash`、`session_id`、`client_seq`、`status`(accepted/in_progress/terminal_success/terminal_failed)、`result_json`(nullable)、`plan_attempt`(默认 0)、`admission_credential_version`、`admission_session_epoch`、`admission_authz_epoch`、`created_at`、`updated_at`。
- 约束：`UNIQUE(session_id, client_seq)`；`UNIQUE(command_id)`；三个 admission epoch 列 `NOT NULL`。
- 判据：迁移 checksum 契约测试绿；`node scripts/run-architecture-smoke.js` 过；隔离库跑迁移 up 成功、表结构与约束存在（自写一次性校验脚本或测试断言）。

### M1a-T2 — expand migration：command_execution_plans 表
- 新迁移（009-…）。列：`command_id`、`plan_attempt`、`owner_set_json`、`owner_set_hash`、`expected_version_source`、`superseded_by`(nullable)、`created_at`；`UNIQUE(command_id, plan_attempt)`。
- 判据：同 T1（迁移契约 + 结构校验）。

### M1a-T3 — payload hash 与稳定 commandId 的纯函数
- 在 shared/ 或 backend 无 IO 层加 `computePayloadHash(payload)`（规范化 JSON + sha256，确定性）与 commandId 规范化谓词。
- 判据：单测——同 payload 同 hash、字段顺序无关、不同 payload 不同 hash；纯函数无 IO/DOM（可被 architecture 纯度门禁接受）。

### M1a-T4a — computePayloadHash 硬化（前置于影子写，源自双席审计 finding #5）
- `CommandReceiptIdentity.computePayloadHash` / `CommandEnvelope.stableStringify` 当前对不可序列化输入脆弱（审计实证）：`BigInt` payload 直接 `TypeError` throw 破坏纯函数闭包；`NaN`/`Infinity` 与 `null` 撞同一 hash；NFC/NFD 同一视觉字符串产生不同 hash。
- 修：①序列化前显式拒绝/规范化不可 JSON 序列化值（BigInt/函数/Symbol/循环引用）——用 try/catch 包裹并抛一个**领域错误码**（如 `PAYLOAD_NOT_HASHABLE`），不得裸 throw TypeError；②NaN/Infinity 视为非法 payload 拒绝（不得静默变 null）；③字符串在 hash 前做 Unicode NFC 归一化，消除 NFC/NFD 分叉。
- 判据：单测覆盖 BigInt→领域错误（非裸 TypeError）、NaN/Infinity→拒绝、NFC 与 NFD 同视觉串→同 hash、既有确定性用例仍绿。此项独立 commit，先于 T4b。

### M1a-T4b — admission 影子写（并行，不改权威路径）
- `CommandExecutionPipeline` 在现有 admission 点**额外**以独立小事务写一条 accepted receipt（command_id + payload_hash + session/client_seq + 三 epoch 快照）；epoch 取自现有 session 上下文，任一不可得则**跳过影子写并告警**（本单不 fail-closed 拒绝命令——那是 contract 阶段行为，避免改现有可达性）。
- receipt 写失败**只告警不阻断**现有领域结果（影子纪律）；payload 不可 hash（T4a 的领域错误）时同样只告警跳过影子写，绝不阻断主链。
- 判据：特征测试——现有命令全链行为逐字节不变（对比影子写开/关的响应 DTO 相同）；receipt 表被并行写入且三 epoch 列非空；`UNIQUE(session_id,client_seq)` 冲突时影子写幂等（同命令重试不产生第二行、不抛给主链）。

### M1a-T5 — 恢复所有权只读探针 + guardian 收敛判据（不接管在线命令）
- 加只读分析器：扫 command_receipts 找残留非终态（in_progress 超 lease 阈值）行，产出可收敛清单（哪些可由唯一 guardian CAS 接管）。**本单只报告不执行接管。**
- 加 `accepted->in_progress` 的 lease token/CAS **纯函数谓词**（给定 token/now/lease_until 判定唯一可接管），单测覆盖"恰一个成功/旧 token 影响 0 行/未过期不可接管"三分支。
- 判据：单测三分支绿；探针在隔离库造残留数据后正确列出可收敛集，空库返回空。

### M1a-T6 — 强制故障注入（隔离进程，机械判据）
- 隔离进程演练脚本（复用 M0 的 stall-watchdog 模式，起进程只等自然退出读退出码，**禁 Start-Sleep 人肉轮询**），注入并断言：
  1. admission 影子写后、（模拟）执行前进程 kill → 重启后同 commandId 重放：receipt 仍是 accepted 单行，无重复、无第二 payload。
  2. 同 commandId 不同 payload 提交 → 影子写检出 payload_hash 冲突并告警（不污染主链）。
  3. 迁移中途 kill → 重跑迁移幂等收敛（up 可续跑，checksum 一致）。
- 产出证据 `docs/architecture/m1/expand-fault-evidence.md`（passed/failed 计数 + 每项原始输出摘要）。
- 判据：演练 passed>0 failed=0；三门禁全绿；`git diff --check` 过。

## 退出门禁（M1a 整体，对应路线图 §6 的 expand 子集）

- command_receipts / command_execution_plans 两表 expand 迁移落地，约束（两个 UNIQUE + 三 epoch NOT NULL）在隔离库验证存在。
- 影子写不改变任何现有命令的权威结果（特征测试逐字节相同）——**这是本单最重要的安全门**。
- 同 commandId 相同 payload 幂等、不同 payload 冲突可检出（影子层）。
- 恢复探针 + lease CAS 谓词单测三分支绿；故障注入演练 passed>0 failed=0。
- 全量 `npm test` / `npm run lint` / architecture-smoke 全绿。

## 明确不做（留给 M1b，需 owner 在场终验）

- 不把 `CommandCommitter.commit()` 与 `recordResult()` 塌进同一事务（权威写入切换）。
- 不让 receipt 成为权威 reader，不切换任何 owner 的权威 writer。
- guardian 不实际接管在线命令（只读探针 + 谓词就绪即可）。
- admission epoch 不可得时不改为 fail-closed 拒绝命令（保持现有可达性）。
- 不触碰 M2+ 的 owner_leases / placement / fencing。
