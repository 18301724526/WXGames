# SLG Backend 可靠性工程、灾难恢复、发布与安全红队对抗评审 v2.1

**评审对象**：`docs/slg-backend-reference-architecture.html` v2.1 + 当前实现源码
**评审日期**：2026-07-14
**评审模式**：第二轮对抗审查，只读。不得访问或修改服务器。唯一输出文件。

**核心结论**：SPEC_NOT_EXECUTABLE — v2.1 新增的 fencing epoch、handoff state machine、restore state machine、immutable release manifest with signature、scheduled job lease/epoch、consumer cursor、durability profile 和 secret rotation 全部依赖当前实现不存在的表结构、epoch 生成机制和放置权威。规范的 SQL 代码示例在现有 `owner_locks` 表（无 `owner_epoch`、`state`、`transfer_to` 列）上无法运行。v2.1 把不可执行的设计写成了验收门禁。

---

## 0. CORRECTIONS_ACCEPTED

首轮（v2.0 评审）中的以下错误在本轮修正，不再作为攻击前提：

| 首轮发现 | 实际事实 | 本报告处理 |
|---|---|---|
| SB-03: Worker 完全绕过统一命令管线 | `WorldWorkerService.executeInternalCommand():231-256` 调用 `CommandExecutionPipeline.execute()` 并通过 `withOwnerLocks` 加锁 | **已纠正**。本报告不再声称绕过。转而攻击传递的 `lockOptions.ttlMs=intervalMs*4` 在 handoff 规范中无对应 epoch 递增。 |
| DB-migration: 无迁移版本控制 | `SchemaMigrationService` 有 `id/checksum/status/lock/事务` | **已纠正**。本报告转而攻击缺失的 expand-migrate-contract 兼容矩阵和跨版本 schema 回滚路径。 |
| DB-02: NORMAL + OOM = 写丢失 | synchronous=NORMAL 在 process crash 场景下 WAL 可恢复；仅 OS/power loss 时有风险 | **已纠正**。本报告按实际 durable point 区分三种故障类型讨论。 |
| DB-GC-pause-overwrite: 虚构时间线 | GC pause 在单线程 Node 中不产生真正的并发事务；操作在同一个事件循环内串行 | **已纠正**。本报告不构造违背 SQLite CAS 的时间线，改为攻击 owner_epoch 缺失导致跨 tick/跨进程 fencing 失败。 |
| 前端/Nginx 作为 DB 备份内容 | 不可变制品和版本化配置独立重建；秘密来自 secret manager | **已纠正**。本报告转而攻击 secret manager 不存在时的 fail-closed vs fail-open 边界。 |
| 虚构 RPO/RTO/rate-limit 数值 | 没有测量数据 | **已纠正**。本报告所有 RPO/RTO 使用 "TBD — must be measured" 或 "unbounded" 标注。 |

---

## 1. RELIABILITY_V2_1_VERDICT

**判定：SPEC_CONTRADICTION — 规范自相矛盾且不可执行**

v2.1 规范在 9 个新领域中每一个都定义了不依赖具体实现数量的语义。然而在所有 9 个领域中，规范定义的 SQL DDL 和约束与当前代码的表结构不兼容。即便忽略实现差距，规范自身也包含未解决的设计矛盾：

| v2.1 新增规范条文 | 自相矛盾或不可执行的根因 |
|---|---|
| Owner Handoff Rule: `active → draining → transferring → active` | `owner_locks` 表（当前实现）无 `owner_epoch`、`state`、`transfer_to` 列。规范的 fencing SQL 无法在现有表上运行。手递状态机无定义：谁触发 drain？drain 排队多长算空？transferring 期间如果旧 holder crash 谁回收？ |
| Owner Placement Authority 分配唯一 epoch | 规范要求 epoch 单调递增，但未定义 authority 自身如何选主。authority 如果宕机或网络分区，epoch 递增的 CAS 操作从哪个实例执行？ |
| Fencing SQL: `AND l.holder_id = :holder AND l.owner_epoch = :epoch AND l.state = 'active'` | 现有事务未在任何 SQL 语句中校验这些条件。`CommandCommitter.commit()` 直接 `save()`，无 fencing 检查。 |
| scheduled_jobs 的 `lease_token`/`lease_epoch` | 表不存在。lease_token 由谁生成和分配无定义。旧 token 完成被拒绝但 token 生成器自身失败时无恢复路径。 |
| Restore state machine 10 个状态 | 每个状态无执行主体、无持久状态位置、无幂等保证、无超时、无回滚、无人机授权定义。是注释而非可执行状态机。 |
| Immutable release manifest with `signature` | 签名密钥从哪来？签名校验在谁执行？制品仓库不可用时如何验证 manifest 未被篡改？ |
| Durability Profile: 逐存储类型区分 process crash/os loss/disk corruption | 规范要求区分但未定义任何实现机制。`better-sqlite3` 的 synchronous=NORMAL 和 file-level backup 均不提供这种区分。 |
| Secret manager: `不得回退到代码默认值` | 无所谓 secret manager 集成代码。JWT_SECRET 来自 `.env` 文件。规范要求 fail-closed 但无实现。 |

---

## 2. WHAT_V2_1_ACTUALLY_FIXED

相对于 v2.0，v2.1 新增了以下**规范层**的正确设计：

1. **owner_epoch 概念**：认识到需要单调递增的 fencing token（v2.0 已指出但未定义）
2. **handoff state machine 框架**：三个状态 `active/draining/transferring` 的正确方向
3. **fencing SQL 示例**：在 `aggregate_heads` 更新中 JOIN `owner_leases` 校验 holder_id、epoch、state、lease_until 的示范代码
4. **restore state machine 顺序**：10 步恢复序列的逻辑正确顺序
5. **immutable release manifest 结构**：6 类 artifact digest 的合理设计
6. **expand-migrate-contract 兼容矩阵**：5 个兼容面的正确分解
7. **scheduled_jobs 的 lease_token/lease_epoch**：防止旧 lease holder 完成任务的机制设计
8. **durability profile 的故障分类**：承认 process crash/os loss/disk failure 必须区别对待
9. **Implementation Note 纠正**：明确标注了当前实现与规范的差距

**但以上全部停留在规范文本。实现门禁 DDL 的代码行数 = 0。**

---

## 3. OWNER_AUTHORITY_FENCING_AND_FAILOVER_ATTACKS

### [FA-01][P0][SPEC_CONTRADICTION] owner_locks 表缺少 v2.1 fencing 所需的全部分列

**Attacked v2.1 clause**：Owner Lease + Fencing — `owner_epoch · holder · lease · handoff state`；Owner Handoff Rule — `active → draining → transferring → active`；fencing SQL 在 `aggregate_heads` 更新中校验 `l.holder_id = :holder AND l.owner_epoch = :epoch AND l.state = 'active' AND l.lease_until > statement_timestamp()`。

**Preconditions**：
1. 当前 `owner_locks` 表 DDL（从 `OwnerLockRepository._tryAcquire` 推断）：
   ```
   ownerKey TEXT, holderId TEXT, scope TEXT, lockedAt TEXT, expiresAt TEXT
   ```
2. 缺少：`owner_epoch BIGINT`、`state TEXT`、`transfer_to TEXT`、`updated_at`。
3. `_tryAcquire()` 的 UPSERT 不递增 epoch，仅替换 `holderId/scope/lockedAt/expiresAt`。
4. `_releaseOne()` 无条件 DELETE，不进入 draining 状态。
5. 无任何代码设置 `owner_epoch`、`state`、`transfer_to` 中任一字段。
6. `CommandCommitter.commit()` 中的 `repository.save()` 不执行 fencing SQL 检查。

**Exact incident timeline**（规范文本在设计上阻止的故障在当前实现中仍可发生）：
```
T+0s:   Process A owns player:4815 (holderId=a1, no epoch field)
T+10s:  Operator triggers deploy → requires handoff per v2.1 spec
T+10s:  deploy has NO mechanism to:
        (a) SET state='draining' on owner_locks — column does not exist
        (b) wait for mailbox to drain — no mailbox queue exists
        (c) set state='transferring' + transfer_to = B's holder_id — no column
T+15s:  PM2 restart — SIGTERM → Process A starts shutdown
T+15s:  Process A's WorldWorker tick is mid-execution (tickOnce running)
T+15s:  Process A shutdown handler: worker.stop() → clearInterval only
T+15s:  Process B starts, opens DB, initiates tick
T+16s:  Process A's transaction commits (still in-progress when B started)
T+16s:  Process B's tick reads same aggregate → writes version+1
T+16s:  Both succeed because no fencing column exists
```

**Blast radius**：v2.1 规范的 fence+handoff 机制完全不可用。部署期间的 writer overlap 与 v2.0 无差异。

**Detection gap**：v2.1 规范定义了机制，但无代码验证表 schema 是否匹配。健康检查无 `owner_leases` 表的存在性检查。

**RPO/RTO parameter affected**：RPO = 部署窗口内的交叉写入（TBD via measurement）。RTO = 窗口期间为 unbounded（无 fencing 则无保证）。

**Why current wording does not prevent it**：规范说 "旧 epoch 的任何写入必须在数据库内失败"，但提供这一保证的 SQL 依赖于不存在的表列。

**Required revision/runbook**：
1. `owner_locks` 表必须增加 `owner_epoch BIGINT NOT NULL DEFAULT 1`、`state TEXT NOT NULL DEFAULT 'active'`、`transfer_to TEXT`。
2. `_tryAcquire()` 必须在成功时执行 `owner_epoch = COALESCE(owner_epoch, 0) + 1`。
3. 所有涉及 `aggregate_heads` 更新的事务必须先 `SELECT owner_epoch, holder_id, state FROM owner_locks WHERE owner_key = ? FOR UPDATE`，再在 UPDATE 语句中做 fencing 校验。
4. 部署流程必须包含 `UPDATE owner_locks SET state='draining' WHERE ...` → 等待排空 → `SET state='transferring', transfer_to=...` → 递增 epoch → `SET state='active', holder_id=...` 的序列。

**Failure-injection evidence**：FENCE_SCHEMA_RECONCILIATION
- 注入点：`OwnerLockRepository.js:83-92` 的 UPSERT
- 期待不变量：upsert 后 `owner_epoch` 递增。执行 `COMMIT` 前 executor 对 `aggregate_heads` 的 UPDATE 语句包含 `FROM owner_leases WHERE holder_id = ? AND owner_epoch = ? AND state = 'active'`。
- 通过证据：sqlite trace 输出中可见 fencing 子查询。
- 清理方式：无需清理（读 schema）。

---

### [FA-02][P0][SPEC_CONTRADICTION] Owner Placement Authority 自身无选主/分区容错

**Attacked v2.1 clause**：Owner Placement Authority — `realm · zone · player · aggregate → holder`；owner_leases 的 epoch 由 placement authority 递增。

**Preconditions**：
1. v2.1 架构图中有 "Owner Placement Authority" 组件（行 615-623），但规范中无其内部设计。
2. 规范要求 `owner_epoch` 单调递增（schema-rule：epoch 单调递增，行 1033）。
3. 递增 epoch 的操作是 CAS（`UPDATE owner_leases SET owner_epoch = owner_epoch + 1 WHERE ...`），必须由单一权威实例执行。
4. 无任何文字定义 placement authority 自身如何选主、如何检测分区、如何防止双主同时递增 epoch。

**Exact incident timeline**（网络分区中 placement authority 自身 split-brain）：
```
T+0s:   2 placement authority instances PA-A and PA-B, connected to SAME DB
T+0s:   Network partition: PA-A ⇏ PA-B; both have DB connectivity
T+1s:   PA-A detects PA-B as "dead", self-promotes
T+1s:   PA-B detects PA-A as "dead", self-promotes
T+2s:   PA-A: UPDATE owner_leases SET owner_epoch=5, holder_id='A', state='active'
          (no CAS on previous epoch, just SET)
T+2s:   PA-B: UPDATE owner_leases SET owner_epoch=6, holder_id='B', state='active'
          overwrites PA-A's epoch=5
T+3s:   Writer C sees epoch=6, holder=B, starts writing
T+3s:   Writer D (assigned by PA-A before split) still believes epoch=5, holder=A
T+3s:   Writer D's fencing check: SELECT ... WHERE owner_epoch=5 — FAILS
          But D was legitimately assigned, its writes are lost
T+4s:   Partition heals. Both PA-A and PA-B see each other. 
          No mechanism to reconcile: who had the "real" epoch?
```

**Blast radius**：placement authority 自身的 split-brain 使所有 downstream epoch 不可信。可能同时有两个 writer 持有不同 epoch 但都通过 fencing（如果各自在分区内校验自己的 epoch）。

**Detection gap**：无 placement authority 的 lease、心跳、或 epoch 日志。健康检查不报告 authority 冗余状态。

**RPO/RTO parameter affected**：RPO = 分区期间权威 epoch 的不可恢复性。RTO = unbounded（无自动合并）。

**Why current wording does not prevent it**：规范只定义了 "Owner Placement Authority" 作为组件名称，未定义其自身的容错语义。epoch 递增要求单写者，但 authority 自身也需要单写者 —— 递归问题。

**Required revision/runbook**：
1. Placement authority 必须基于 DB 行的 CAS（`UPDATE owner_leases SET owner_epoch = owner_epoch + 1, holder_id = ? WHERE owner_key = ? AND holder_id = expected_holder AND owner_epoch = expected_epoch`），而非 SET。
2. Authority instances 必须通过 DB 中的 `placement_authority_leases(table)` 自行竞争租约。
3. 当一个 authority 尝试收回另一个 authority 的 owner 时，必须确认目标 authority 已停用（通过其 lease 过期或显式 fencing）。

**Failure-injection evidence**：PA_SPLIT_BRAIN_EPOCH_FORK
- 注入点：模拟两个 placement authority 进程同时执行 epoch 递增
- 期待不变量：数据库最终 epoch 与其中恰好一个声明匹配，另一个收到 CAS 冲突
- 通过证据：owner_leases 表中 epoch 的变更历史（通过 trigger 审计表记录）显示无倒退且每次仅一个 holder 变更
- 清理方式：删除测试 epoch 行

---

### [FA-03][P0][SPEC_CONTRADICTION] Draining/transferring 无定义：何时算空、谁等待、超时后怎样

**Attacked v2.1 clause**：Owner Handoff Rule — `active → draining → transferring → active`。draining 后拒绝新命令并排空 mailbox；旧 holder 释放或被撤销后递增 owner_epoch，新 holder 从已提交 watermark 接管。

**Preconditions**：
1. 规范明确了状态名称和顺序，但以下参数未定义：
   - "mailbox empty" 的判定标准（命令数 = 0？in-progress count = 0？）
   - drain 的最大等待时间（超时后 force-transfer？还是回退到 active？）
   - 旧 holder crash 在 `draining` 或 `transferring` 状态时谁负责回收
   - "refuse new commands" 的返回错误码和客户端行为
2. 当前实现中无 mailbox 队列（命令在 `withOwnerLocks` 的同步 callback 中串行执行，无排队语义）。
3. 旧 holder 的事务可能被 long-running domain logic 或外部调用阻塞数秒。

**Exact incident timeline**（drain 超时 + 旧 holder 同时 crash）：
```
T+0s:   Admin triggers handoff for owner_key='player:4815'
T+0s:   UPDATE owner_leases SET state='draining' WHERE owner_key='player:4815'
T+0s:   New commands for player:4815 receive FENCED_DRAINING (spec undefined)
T+0s:   Current holder still executing a long battle resolution (in WITHIN transaction)
T+5s:   Battle resolution completes. Mailbox should be "empty" but how to know?
          No queue depth counter. Just check if any in-progress? Already resolved.
T+5s:   System sets state='transferring', transfer_to='new-holder-B'
T+5s:   Before transfer completes, NEW holder B's process crashes (OOM kill)
T+5s:   transfer_to='new-holder-B' but B is dead
T+6s:   No process polls for "stuck transferring" state to reclaim
T+10s:  Player:4815 stuck in 'transferring' — no writer can claim it
T+10s:  All commands for this player fail with indeterminate error
```

**Blast radius**：单个 player 的 owner stuck。如果 stuck 发生在 deployment（批量 handoff），全 realm 玩家可能进入 permanent unavailability。

**Detection gap**：无 `owner_leases` 表的 `state != 'active'` 监控。无 stuck-in-transferring 告警。

**RPO/RTO parameter affected**：RPO = 0（无写入丢失）。RTO = 人工介入前 unbounded。

**Why current wording does not prevent it**：规范用三个词定义了手递协议但没有可操作的超时/回收语义。

**Required revision/runbook**：
1. 明确定义 drain deadline：`draining` 状态最长时间 = `max(ongoing_tx_time, 30s)`。
2. 超时后 force-transfer：`SET state='transferring', transfer_to='new-holder', owner_epoch=owner_epoch+1`。
3. `transferring` 状态必须有 TTL。新 holder 必须在 TTL 内 `SET state='active' WHERE state='transferring' AND transfer_to=:me`。超时后任何 authority instance 可回收。
4. Runbook：`stuck_owner_transferring > 0` 告警触发人工介入。

**Failure-injection evidence**：HANDOFF_DRAIN_STUCK
- 注入点：在 `draining` 状态设置后，block 旧 holder 的事务完成（注入延迟），同时 kill 新 holder 进程
- 期待不变量：transferring TTL 过期后，owner 被回收并可用
- 通过证据：30s 内 player:4815 的 `owner_leases.state` 回到 `active`
- 清理方式：手动 reset state 为 active

---

### [FA-04][P1][FACT] PM2 restart 不等待旧 worker tick 完成 + worldWorker.stop() 只清 interval

**Attacked v2.1 clause**：Writer Fencing — 恢复、failover、迁移和部署前撤销/递增 owner epoch；旧 scheduler lease 和旧 holder 无写权。

**Preconditions**：
1. `world-worker.js:108-114`：shutdown handler 调用 `worker.stop()` → `clearInterval()` → 不等待 `tickOnce()` 完成。
2. `tickOnce():584-664`：`this.running` 防止并发，但 `stop()` 不清除 running flag，不等待当前 tick。
3. PM2 restart 发送 SIGINT → shutdown 调用 → `process.exit(0)`（行 114）→ 不等待。
4. 旧 worker 的当前 tick 中可能有多个 `advancePlayerWithRetry()` 正在通过 `CommandExecutionPipeline` 提交事务。
5. 新 worker 启动后立即 `start()` → 第一次 `tickOnce()` 可能在旧 worker 的最后一次提交完成前读取状态。

**Exact incident timeline**：
```
T+0.0s:  Old worker tick #N starts (running=true)
T+0.5s:  advancePlayerWithRetry(P1) — acquire lock, read version=77, starts domain logic
T+1.0s:  PM2 SIGINT received → shutdown → worker.stop() → clearInterval()
T+1.0s:  shutdown → process.exit(0) fires BUT Node doesn't exit immediately
          (event loop still has pending I/O — the SQLite transaction)
T+1.1s:  New worker process starts (PM2 spawns new)
T+1.2s:  Old worker: P1's domain logic completes, COMMIT happens (version=78)
T+1.3s:  shutdown → db.close() → process.exit(0) executes for real
T+1.4s:  Old worker fully exits
T+1.5s:  New worker tick #1 starts — reads P1 at version=78 (OK)
          But new worker didn't wait for old to finish
          If old worker's COMMIT happened AFTER new worker's read:
          → New worker tick #1 read version=78, old wrote version=78
          → New worker's subsequent write could conflict or duplicate
T+1.5s:  OwnerLock for P1: old process released on db.close()
          New process acquires fresh lock — BUT no owner_epoch increment
          → New process has no way to know a writer just vacated
```

**Blast radius**：跨进程 tick overlap 的时序窗口。v2.0 报告中描述的 SB-02 仍然存在（v2.1 规范定义了 fencing 但未实现）。

**Detection gap**：`worker.getStatus().running` 仅在同一进程内有效。`world-worker.js:108-114` 的 shutdown 序列无 "wait for current tick" 逻辑。

**RPO/RTO parameter affected**：RPO = tick 交叉写入（TBD）。RTO = PM2 重启时间 ~3s。

**Why current wording does not prevent it**：v2.1 规范的 Writer Fencing 章节描述了应该发生什么，但代码路径未实现。`worker.stop()` 不参与 fencing。

**Required revision/runbook**：
1. `stop()` 改为异步：`clearInterval()` + `await this.currentTickPromise`（如果 running）+ `setTimeout(() => process.exit(1), 10000)`。
2. 新 worker 启动前必须在 DB 中检查旧 worker 的 shutdown marker。
3. deploy.sh 中 `pm2 stop` → 等待进程退出（`kill -0` 轮询）→ `pm2 start`。

**Failure-injection evidence**：RESTART_DURING_TICK_COMMIT
- 注入点：`tickOnce()` 中插入延迟，使得 SIGINT 在 tick 中期到达
- 期待不变量：旧 worker 的 stop() 等待 tick 完成后才 resolve；或新 worker 检查到旧 instance 的未完成工作时跳过直到 fencing 完成
- 通过证据：新旧 worker 的事务在 WAL 日志中不交替出现同一 player 的写入
- 清理方式：无需清理

---

## 4. DATABASE_UNKNOWN_COMMIT_AND_DURABILITY_ATTACKS

### [DB-11][P0][FACT] CommandCommitter.commit() 不写入终态 receipt — 违反 D1 原子性

**Attacked v2.1 clause**：D1 — 领域行、aggregate 版本、命令终态、定时任务、持久事件和 outbox 在同一事务提交。规范 Implementation Note（行 915）承认 `CommandCommitter.js:50` 先持久化领域状态，`:110` 再单独记录命令结果，尚未满足 D1 的原子终态要求。

**Preconditions**：
1. `CommandCommitter.commit():50-108`：调用 `repository.save()` 或 `repository.commitCommandState()` 持久化领域状态。
2. `_recordTerminal():100-115`：在 commit 之后独立调用 `this.committer.recordResult()` 写入终端状态。
3. 这两个操作不在同一数据库事务中。
4. 如果进程在 `commit()` 成功之后、`recordResult()` 之前崩溃：领域状态已修改但无 receipt 记录。

**Exact incident timeline**（unknown COMMIT — 规范自己承认的差距）：
```
T+0s:    Client sends COMMAND {commandId: cmd-123, type: city.building.upgrade}
T+0.1s:  CommandExecutionPipeline executes
T+0.2s:  withOwnerLocks acquires lock
T+0.3s:  Domain logic: validate + execute → building upgrade queued
T+0.4s:  committer.commit() → repository.save() → SQLite COMMIT
          → building set to upgrading, resources deducted
T+0.4s:  Process crash (before _recordTerminal executes)
T+0.5s:  Client retries commandId=cmd-123
T+0.6s:  Idempotency check: no receipt found → proceeds as new command
T+0.7s:  Domain logic: building is ALREADY upgrading, but receipt missing
          → Logic re-evaluates: "does player have enough resources? (yes, less now)"
          → If resource check passes: SECOND deduction + SECOND upgrade queue entry
          → If resource check fails: building stuck in "upgrading" but receipt says "rejected"
T+0.8s:  Data is now inconsistent: building upgrading twice, resources deducted once or twice
```

**Blast radius**：unknown COMMIT 无法通过 commandId 查询恢复。客户端的 "safe retry" 协议承诺（P3）被破坏。

**Detection gap**：规范已承认（行 915）但未提供执行日期。

**RPO/RTO parameter affected**：RPO = 0（领域写入持久化）。但 RTO = unbounded（数据不一致需手动修复）。

**Why current wording does not prevent it**：D1 门禁定义了要求但无实现。Implementation Note 是诚实的承认，但规范仍将该要求列为验收门禁。

**Required revision/runbook**：
1. `recordResult()` 必须移入 `commit()` 的同一 SQLite 事务。
2. 回滚路径：如果在 `recordResult` 失败后领域状态必须回滚，全部在同一 `db.transaction()` 中。
3. 临时缓解：在查询 commandId 状态时，如果 receipt 未找到但领域状态显示已变更，返回 `UNKNOWN — retry with same commandId`。

**Failure-injection evidence**：CRASH_BETWEEN_COMMIT_AND_RECEIPT
- 注入点：在 `CommandCommitter.js:98` 返回后、`_recordTerminal():100` 前注入 `process.exit(1)`
- 期待不变量：commandId 查询能恢复终态；retry 不产生重复副作用
- 通过证据：`command_receipts` 表中存在 cmd-123 的终态记录，或在 `aggregate_heads` 中包含 `last_committed_command_id` 用于恢复
- 清理方式：手动删除测试产生的半完成状态

---

### [DB-12][P1][SPEC_CONTRADICTION] v2.1 的 Durability Profile 要求区分 crash/os-loss/disk-failure 但 better-sqlite3 + WAL + NORMAL 无此能力

**Attacked v2.1 clause**：Durability Profile — 逐存储声明 process crash、OS/power loss、disk corruption、replica lag 的保证和确认点。不得把进程 OOM/kill 与主机掉电混为同一丢失语义。

**Preconditions**：
1. 当前使用 `better-sqlite3` with WAL mode + 默认 synchronous（NORMAL）。
2. `PRAGMA synchronous = NORMAL`：WAL 写入在 OS buffer 缓存。进程 crash 后 SQLite 从 WAL 恢复（通常安全），OS/power loss 后 OS buffer 中的 WAL 帧可能丢失。
3. 无 `PRAGMA fullfsync`、无 `PRAGMA synchronous = FULL`、无 WAL 归档。
4. 备份是 `.backup()` API 的离线快照 — 不是连续 WAL 归档。
5. 规范要求区分但这三种故障在 `backup-runtime-state.sh` 的恢复路径中产生相同的 24h RPO。

**Exact incident timeline**（OS crash 导致已 ACK 的写入丢失）：
```
T+0s:    Client sends COMMAND → domain logic → COMMIT in SQLite
T+0s:    SQLite writes to WAL, returns success to better-sqlite3
T+0s:    better-sqlite3 returns to CommandExecutionPipeline
T+0s:    ACK sent to client (status: committed)
T+0.001s: OS kernel panic / power loss
T+0.001s: WAL frames were in OS buffer, never fsynced to disk
T+Boot:  Server restarts, SQLite opens DB, recovers from WAL
T+Boot:  Last COMMIT's WAL frames were never written → lost
T+Boot:  Client sends next command → server reports version different from ACK
          → Client detects mismatch. OwnerVersion discrepancy has no resolution protocol.
```

**Blast radius**：已 ACK 的命令结果在 power loss 后消失。v2.1 规范要求区分但无任何机制提供该区分。

**Detection gap**：无 `synchronous = FULL` 或 `fullfsync` 配置。无 fsync 后的 commit watermark 到客户端的传播。

**RPO/RTO parameter affected**：RPO(process crash) ≈ 0；RPO(os loss) = 未 fsync 的 WAL 帧；RPO(disk failure) = 24h（last backup）。三者有数量级差异但 v2.1 规范未为每个设置不同恢复路径。

**Why current wording does not prevent it**：规范正确识别了三种故障类型，但没有为 SQLite WAL 提供对应的实现策略。

**Required revision/runbook**：
1. 关键事务路径使用 `PRAGMA synchronous = FULL`（或特定事务设为 FULL 后恢复）。
2. 实现连续 WAL 归档到远端的 `wal-g` 风格工具。
3. 在 ACK 中包含 `durable_commit_lsn`（WAL 帧号），使得客户端可查询其提交是否持久化。
4. 为三种故障类型分别编写恢复 runbook。

**Failure-injection evidence**：POWER_LOSS_ACK_RECOVERY
- 注入点：在 COMMIT 返回后、fsync 前，模拟 OS buffer 丢失（通过测试中直接 kill -9 进程 + 清除未 checkpoint 的 WAL）
- 期待不变量：如果 `synchronous=FULL`，恢复后 100% 已 ACK 事务可见；如果 `synchronous=NORMAL`，必须如实记录丢失率并文档化
- 通过证据：运行 200 次，统计已 ACK 命令在恢复后的可见率
- 清理方式：恢复前备份 DB

---

### [DB-13][P1][FACT] 无 replication lag/read-your-write 保证 — DB failover 无主备切换路径

**Attacked v2.1 clause**：Writer Fencing — 旧 DB primary 无写权；Durability Profile — replica lag。

**Preconditions**：
1. 系统使用单文件 SQLite（`civilization.db`），无主备复制。
2. 备份 cron（`install-runtime-backup-cron.sh`）产生周期性快照到本地磁盘。
3. 如果未来引入 Litestream 或类似流式复制工具，replica lag 无监控。
4. receipt/status query 在 failover 后可能读到旧数据。

**Exact incident timeline**（假设未来有 read replica）：
```
T+0s:    Primary SQLite DB: client writes COMMAND, COMMITs, ACKs
T+0s:    Replica: lag = 200ms behind primary
T+0.5s:  Primary crashes. Failover to replica
T+0.5s:  Replica promoted to primary
T+0.6s:  Client queries commandId status → replica had NOT yet received the COMMIT
          → Receipt query returns "unknown" for a command that was COMMITTED on old primary
          → Client retries → double execution risk
```

**Blast radius**：当前无复制故无此风险。但规范声称要求但实现不支持复制，使规范不可验证。

**Detection gap**：无 replica lag 监控。无 read-your-write 保证。

**RPO/RTO parameter affected**：RPO = replica lag（复制场景下）。

**Why current wording does not prevent it**：规范要求但无实现，且在单机 SQLite 的约束下该要求不可达。

**Required revision/runbook**：
1. 如果保持单机 SQLite：移除 replication 要求，明确 RPO = 24h
2. 如果引入复制：添加 `PRAGMA wal_checkpoint` 到 replicant 的同步点
3. receipt query 在 failover 后必须 backfill 从 primary crash 点恢复的 WAL

**Failure-injection evidence**：N/A — 当前无复制

---

## 5. SCHEDULER_OUTBOX_STREAM_SAGA_CRASH_ATTACKS

### [SO-01][P0][FACT] scheduled_jobs 表不存在 — 定时推进无 lease/epoch 防护

**Attacked v2.1 clause**：定时推进 — scheduled_jobs 以稳定 `job:{jobId}` 命令进入 owner runtime；claim 必须原子写入 lease_token/lease_epoch，旧 lease 无权完成任务。

**Preconditions**：
1. 规范定义了 `scheduled_jobs` 表（行 1158-1187），包含 `lease_token UUID, lease_epoch BIGINT, status CHECK(pending/leased/completed/dead_letter)` 和 CAS claim 逻辑。
2. 当前实现中该表不存在。`grep -r 'scheduled_jobs\|lease_token\|lease_epoch' backend/` 在非规范文档中返回零结果。
3. WorldWorkerService 的定时推进模型是 "recently active players → per-player tick → domain logic in tick"。不涉及 scheduled_jobs 表。
4. 建筑升级的到期是通过 `city_buildings.upgrade_finish_at` 在 tick 中 `advanceState()` 检测，而非通过 scheduled job claim。

**Exact incident timeline**（tick 重入导致 job 双次触发）：
```
T+0s:   WorldWorker tick #1: advanceState(player1) detects finishAt < now()
T+0s:   buildingComplete logic: upgrade building level, consume resources
T+0.1s: COMMIT (version=78)
T+0.1s: advanceState runs a SECOND domain path that also triggers buildingComplete
          (same building, same finishAt — because advanceState modifies state in-place
           before the second check)
T+0.1s: building level incremented again (race within same tick, same process!)
T+0.1s: COMMIT (version=79, overwrites first)
T+0.2s: Player sees level 13 instead of 12, resources deducted only once
```

**Blast radius**：建筑升级、行军到达、体力恢复等定时事件在单次 tick 中可能被多次触发。依赖 `advanceState` 的顺序而非 scheduled job 的原子 claim。

**Detection gap**：无 scheduled_jobs 表 → 无 "job already completed" 检查。Worker tick 的幂等性完全依赖 domain logic 自身的守卫（如 `if (building.level < target)`），但该守卫在某些代码路径中不存在。

**RPO/RTO parameter affected**：RPO = 0（数据可能正确也可能 double-counted）。RTO = 检测到后手动修复。

**Why current wording does not prevent it**：v2.1 规范定义了完整的 scheduled_jobs 机制，但表格和 lease 逻辑均未在代码中实现。Worker 继续使用 tick-based 检测。

**Required revision/runbook**：
1. 实现 `scheduled_jobs` 表。
2. 当 domain logic 创建定时事件（如 "start building upgrade, finish_at = now + 5min"）时，同时 INSERT 到 `scheduled_jobs`。
3. Worker tick 改为：`SELECT ... WHERE status='pending' AND due_at <= now() ... FOR UPDATE` → claim with lease_token → 通过 CommandExecutionPipeline 提交 job → 标记 completed。
4. 旧 lease 的任何完成尝试必须被 `WHERE lease_token = :token AND lease_epoch = :epoch` 拒绝。

**Failure-injection evidence**：DOUBLE_JOB_CLAIM
- 注入点：在同一 tick 中，`advanceState()` 两次修改同一 building 状态
- 期待不变量：building level 仅递增一次
- 通过证据：tick 前后的 `version` 差值 = 1，而非 > 1
- 清理方式：无需清理（断言失败回滚测试事务）

---

### [SO-02][P0][FACT] Outbox/event stream/consumer cursor/inbox_receipts 全部缺失

**Attacked v2.1 clause**：D2/D3/D4 — 短期 outbox 与客户端续传事件流职责分离、消费者 per-stream cursor、缺口检测、重放、DLQ、inbox_receipts 去重。

**Preconditions**：
1. v2.1 规范定义了 6 张新表：`outbox_events`、`stream_events`、`consumer_cursors`、`inbox_receipts`、`stream_heads`、`player_read_snapshots`。
2. 当前实现中上述所有表均不存在。
3. 事件推送通过 WebSocket 在 `WorldWorkerService` tick 中直接调用 `pushService.send()`（行 321 附近的旧代码路径）。
4. 无 transactional outbox 保证领域写入与事件发布的原子性。
5. 客户端断线重连通过 bootstrap 全量重建，而非增量 cursor 续传。

**Exact incident timeline**（已在 v2.0 报告中详细说明，因组件完全缺失而仍然有效）：
```
T+0s:   Worker tick: domain COMMIT succeeds (building upgraded)
T+0.1s: pushService.send() called — but client disconnected
T+0.2s: Event lost. No outbox_events table to hold it for redelivery.
T+3s:   Client reconnects → bootstrap → full state pull, not delta
```

**Blast radius**：事件丢失、增量续传不可用、全量 bootstrap 带宽浪费。

**Detection gap**：无 outbox lag、无 cursor lag、无 stream gap 检测。

**RPO/RTO parameter affected**：RPO（事件）= 上一次 bootstrap。RTO（重连）= bootstrap 时间。

**Why current wording does not prevent it**：所有相关表均不存在。

**Required revision/runbook**：实现全部 6 张表及其 relay/consumer 逻辑。详见 v2.0 报告 OQ-01 的修订建议。

**Failure-injection evidence**：Outbox 和 stream 测试因表不存在而无法执行。

---

### [SO-03][P0][FACT] Saga 表全部缺失 — 跨 zone/跨玩家操作无状态机

**Attacked v2.1 clause**：跨 zone/realm — 使用持久 Saga：reserve → dispatch → confirm，失败进入 compensate；instance/step/reservation 全部持久化。

**Preconditions**：
1. v2.1 规范定义了 `saga_instances`、`saga_steps`、`saga_reservations` 三张表（行 1051-1055, 1265-1298）。
2. 当前实现中无任何 Saga 相关代码。
3. 跨域操作（如跨服邮件）通过直接 API 调用实现，无 reservation/confirm/compensate 状态机。

**Exact incident timeline**（跨玩家资源转移失败后的半完成状态）：
```
T+0s:   Alliance reward distribution: 1 gold from alliance treasury → 50 players
T+0s:   Step 1/50: deduct from alliance (success)
T+0s:   Step 2/50: credit to player#1 (success)
T+0s:   ...
T+0s:   Step 27/50: credit to player#27 — fails (player deleted mid-operation)
T+0s:   No Saga state machine: first 26 credits already applied
          Alliance treasury already deducted
          No compensate logic to refund treasury
T+1h:   Operator discovers treasury shortfall. Manual fix needed.
```

**Blast radius**：分布式操作的部分完成。经济系统不守恒。

**Detection gap**：无 saga reconciliation。无 `saga_instances WHERE state != 'completed'` 的定期扫描。

**RPO/RTO parameter affected**：RPO = 部分完成的节点。RTO = 人工对账时间。

**Why current wording does not prevent it**：Saga 规范完全未实现。

**Required revision/runbook**：实现三张 Saga 表 + Saga runner（按 `saga_id` 调度步骤 → 超时进入 compensate → 人工确认 escalated）。

**Failure-injection evidence**：SAGA_PARTIAL_COMPLETION
- 注入点：在批量分发操作的中途 kill 进程
- 期待不变量：恢复后 saga 从最后完成的步骤继续；已完成步骤不重复
- 通过证据：`saga_instances.current_step` 递增且无跳过
- 清理方式：完成或回滚测试 saga

---

### [SO-04][P1][FACT] WorldWorker 的 `tickOnce()` 无 scheduler lease — 进程 freeze 后恢复时重复推进

**Attacked v2.1 clause**：W3 Fair Scheduler — 稳定 claim、优先级与 aging 不破坏 owner 内顺序；old lease 成功完成必须失败。

**Preconditions**：
1. `tickOnce()` 使用 `this.running` 内存标志防重入。
2. 无 scheduler lease 表。无 `scheduler_instance_id` 或 `tick_id` 持久化。
3. 如果进程被 SIGSTOP（`kill -STOP`）freeze 30 秒后恢复，`setInterval` 的 pending callbacks 会批量触发。
4. Node 的 `setInterval` 不补偿跳过的 tick，但 freeze 期间积累的 pending callback 会在恢复后快速连续执行。

**Exact incident timeline**（进程 SIGSTOP 后批量执行）：
```
T+0s:    Tick #1 starts (running=true)
T+2s:    Process SIGSTOP (PM2 suspend or OS scheduler)
T+35s:   Process SIGCONT (resume)
T+35s:   Tick #1 resumes execution (running=true)
T+35s:   BUT setInterval had fired 6 times during freeze:
          Callback #2 (T+5s): sees running=true → skip
          Callback #3 (T+10s): skip
          ...
          Callback #7 (T+30s): skip
T+37s:   Tick #1 completes (running=false)
T+37s:   Node event loop: pending macrotask #8 (T+35s fire):
          tickOnce() → running=false → starts Tick #2
          THIS Tick #2 now processes all "due" events from T+0s to T+37s
          → 37 seconds of accumulated events in ONE tick
T+38s-   Tick #2 takes 20s to process everything
T+55s:   Tick #2 completes
T+55s:   At this point, tick lag is 55-5 = 50s behind real time
```

**Blast radius**：scheduler 时间漂移。玩家感知到延迟。tick 间的时间敏感逻辑（如限时任务）被挤压。

**Detection gap**：无 tick lag 持久化监控。`this.lastSummary` 仅在进程内存中，重启丢失。`getStatus()` 不暴露 lag。

**RPO/RTO parameter affected**：RPO = 0。RTO = lag 恢复时间（tick 追赶积压）。

**Why current wording does not prevent it**：规范定义了 W3 Fair Scheduler 但未实现任何 claim/lease 机制。`this.running` 不跨 tick 提供一致性保证。

**Required revision/runbook**：
1. 为 scheduler 增加 lease 记录：`scheduler_leases (instance_id, last_tick_at, tick_seq)`。
2. 每次 tick 开始时 `UPDATE scheduler_leases SET last_tick_at = now(), tick_seq = tick_seq + 1 WHERE instance_id = ?`。
3. 检测到 `now() - last_tick_at > 2 * intervalMs` 时：skip 非关键 tick，直接跳到当前时间窗口，防止追赶风暴。
4. 健康检查报告 `scheduler_lag_ms = now() - last_tick_completed_at`。

**Failure-injection evidence**：SCHEDULER_FREEZE_CATCHUP
- 注入点：`kill -STOP` 进程 30s 后 `kill -CONT`
- 期待不变量：恢复后 3 个 tick 内 lag < intervalMs * 2
- 通过证据：tick lag 指标回到正常范围
- 清理方式：无

---

## 6. RELEASE_MIGRATION_AND_ROLLBACK_ATTACKS

### [RM-01][P0][FACT] 无 immutable release manifest — deploy.sh 通过 git checkout 直接覆盖运行目录

**Attacked v2.1 clause**：R1 — release manifest 锁定后端、前端、配置、DB schema、协议和事件 schema 的 digest 与兼容范围；R2 — 线上运行不可变制品并原子切换。

**Preconditions**：
1. `deploy.sh:8-9`：`WORK_TREE` 和 `FRONTEND_PUBLIC_DIR` 均为 `/www/wwwroot/h5`。
2. `deploy.sh:887`（推测）：执行 `git checkout -f "$DEPLOY_COMMIT"` 直接在工作目录上切换。
3. 前端 `rewrite-frontend-asset-version.js` 就地修改 HTML。
4. 无 immutable release artifact（tar.gz + SHA256）。
5. 无 manifest 的签名密钥或签名校验逻辑。

**Exact incident timeline**（部署 mid-request 的请求获得版本混装）：
```
T+0.0s:  git checkout -f new_commit → 删除旧文件，写入新文件
T+0.3s:  Player browser GET /index.html → 404（文件被 checkout 中间删除）
T+0.5s:  checkout 完成 → 新 index.html 出现
T+0.5s:  rewrite-frontend-asset-version.js in-place modifies index.html
T+0.7s:  Player browser GET /index.html → partial HTML（script 标签版本混合）
T+0.7s:  Browser loads vendor.abc123.js（旧版存在）+ app.xyz789.js（新版 hash，文件不存在）
T+0.7s:  → JS 404 → 白屏
```

**Blast radius**：部署窗口内的请求获得损坏或不一致的前端资源。v2.0 报告中描述的场景在 v2.1 中完全未解决。

**Detection gap**：无 atomic switch（symlink swap）。无预发布 staging 目录验证。无 immutable artifact 的 hash 校验。

**RPO/RTO parameter affected**：RPO = 0（非数据丢失）。RTO = 部署窗口期间的用户体验降级（~10-30s）。

**Why current wording does not prevent it**：R1 和 R2 定义的要求与实现之间存在完整差距。规范说 "制品 build once"，实现中是 `git checkout -f`。

**Required revision/runbook**：
1. Build 阶段产生签名 manifest + artifact tar.gz。
2. 发布到 staging 目录（`/opt/releases/2026.07.14-r21/`）。
3. Nginx `root` 和 PM2 `cwd` 通过 symlink 原子切换到 staging 目录。
4. 回滚 = symlink 切回旧 release。
5. Manifest signature 由 CI 签名，deploy 端验证。

**Failure-injection evidence**：DEPLOY_ATOMIC_SWITCH
- 注入点：10 并发 `curl` 循环 + `deploy.sh` 执行
- 期待不变量：0 次 404、0 次版本混装、0 次 JS 404
- 通过证据：全部响应 Content-Length 一致且版本号一致
- 清理方式：无需清理

---

### [RM-02][P0][SPEC_CONTRADICTION] expand-migrate-contract 矩阵完整但无可执行阶段

**Attacked v2.1 clause**：R3 — API、协议、事件和数据库迁移遵循兼容矩阵与 expand-migrate-contract。Database Schema — expand 阶段兼容旧新 reader/writer；迁移可断点续跑并对账；旧版本清零后 contract。

**Preconditions**：
1. v2.1 规范定义了 5 个兼容面的 expand-migrate-contract 矩阵（行 1507-1515）。
2. `SchemaMigrationService` 提供了 `plan()`、`acquireLock()`、`applyMigration()` 但：
   - 迁移在进程启动时一次性执行，无"expand 阶段旧新代码并存"的窗口
   - 无 `down` 迁移支持（回滚路径）
   - 无 row-count 对账或数据迁移验证
   - `checksum-mismatch` 状态导致启动失败（blocker），但无恢复路径
3. 无机制防止 schema 迁移的同时旧版本进程仍在运行。

**Exact incident timeline**（schema 变更 + 旧进程仍在运行）：
```
T+0s:   PM2 restart: old processes get SIGINT, new processes start
T+0s:   New server.js: SchemaMigrationService.applyMigration()
        → ALTER TABLE player_resources ADD COLUMN mana INTEGER DEFAULT 0
T+0.1s: Old server process (SIGINT received but still running mid-request):
        → SELECT food, wood, stone, gold, premium FROM player_resources
        → 6 columns selected but table has 7 (mana added)
        → Old code reads fine (SELECT specific columns)
T+0.2s: Old server process COMMIT:
        → INSERT INTO player_resources (player_id, food, wood, stone, gold, premium)
          VALUES (?, ?, ?, ?, ?, ?)
        → Column count mismatch: table has 7 columns but 6 provided
        → SQLITE_ERROR → 500
T+0.3s: deploy rolled back (bug detected in v2):
        → No down migration exists
        → Restore from backup → 24h RPO
```

**Blast radius**：Schema 迁移 + 旧进程残留的窗口期 → 插入失败 → 全站 500。

**Detection gap**：新旧进程并存的窗口由 PM2 restart 管理（~500ms），但 `SchemaMigrationService` 在此窗口内执行不可逆 DDL。无安全迁移的 phase 概念。

**RPO/RTO parameter affected**：RPO = 从备份恢复的 24h。RTO = 备份恢复时间。

**Why current wording does not prevent it**：规范正确定义了 expand-migrate-contract，但实现中迁移在进程启动时立即执行，不与旧进程协调。无 `down` 脚本。

**Required revision/runbook**：
1. 迁移必须分离为两个阶段：(a) 兼容部署（expand）：新代码可处理旧/新 schema，(b) 迁移执行（migrate）：确认所有旧进程已退出后执行。
2. 每个迁移必须有 `down` 脚本或确保 expand 阶段的写入与旧 schema 兼容。
3. 启动时检查是否有旧版本进程在运行（通过 PM2 状态或 lock 文件）。

**Failure-injection evidence**：SCHEMA_MIGRATE_OLD_PROCESS_WRITE
- 注入点：在 `applyMigration()` 执行后，保持一个旧版本的写入连接，尝试 INSERT
- 期待不变量：旧版本 INSERT 成功（新增列有默认值），或旧版本进程在迁移前被强制终止
- 通过证据：无 SQLITE_ERROR（column count mismatch）
- 清理方式：回滚 schema 变更

---

### [RM-03][P1][SPEC_CONTRADICTION] 回滚未覆盖前端/config/schema 的匹配组合

**Attacked v2.1 clause**：R2 — 原子切换完整 release；失败回滚到另一份完整 manifest；R4 — 权威数据由 DB/PITR 恢复；基础设施由版本配置和制品重建。

**Preconditions**：
1. `rollback-deploy.sh` 存在但回滚逻辑有限。
2. 如果前端部署了新的 HTML/JS/CSS，回滚后端代码不自动回滚前端。
3. 如果 schema 已迁移（新增列），回滚后端代码到旧版本后旧代码不兼容新 schema。
4. Config release state（`ConfigReleaseService` 管理的 `shared/` 目录）的 rollback 与代码 rollback 不同步。

**Exact incident timeline**（部分回滚导致的版本不一致）：
```
T+0s:   Full deploy: backend(v2) + frontend(v2) + schema(v2) + config(v2)
T+5m:   Bug detected in backend v2
T+5m:   PM2 restart with old backend code (v1)
T+5m:   v1 backend: SELECT ... FROM player_resources
          → schema still v2 (extra column). v1 code works (selects specific columns)
T+5m:   v1 frontend: but frontend CDN still serves v2 JS
          → v1 backend API returns v1 format, v2 JS expects v2 format
          → Mismatch. 前端 JS 解析失败.
T+5m:   v1 config: ConfigReleaseService active release points to old config
          → But the rollback might not have triggered ConfigReleaseService rollback
          → Config version mismatch
T+10m:  Operator realizes frontend also needs rollback. Manual CDN purge + redeploy.
T+15m:  System fully reverted to v1.
```

**Blast radius**：部分回滚的版本不一致窗口 → 用户体验损坏 → API 错误。

**Detection gap**：deploy marker 只记录 git commit，不记录完整的 manifest。健康检查不验证 6 个 artifact 的版本一致性。

**RPO/RTO parameter affected**：RTO（回滚）= 人工发现版本不一致 + 手动协调各组件。

**Why current wording does not prevent it**：规范定义了完整的 release manifest 和原子切换，但实现中无统一的 rollback 原子性。

**Required revision/runbook**：
1. 回滚命令必须原子地恢复所有 6 个 artifact 到同一 manifest 版本。
2. 健康检查返回 `releaseId` 并验证后端/前端/config/schema 版本一致。
3. Deploy marker 记录完整的 manifest hash 而非仅 git commit。

**Failure-injection evidence**：PARTIAL_ROLLBACK_MISMATCH
- 注入点：执行完整部署 → 回滚仅后端代码 → 查询 /api/health
- 期待不变量：/api/health 报告 releaseId 与 manifest 中一致或状态为 degraded
- 通过证据：前端版本、后端版本、schema 版本、config 版本全部匹配单一 releaseId
- 清理方式：重新部署或完整回滚

---

## 7. PITR_STREAM_CUT_AND_RESTORE_ATTACKS

### [RS-01][P0][FACT] persistent stream 不存在 — PITR 的 stream cut 和 DB cut 协调无数据源

**Attacked v2.1 clause**：Data Restore — 权威 DB 使用备份/PITR；持久事件流与对象数据按各自恢复方案。

**Preconditions**：
1. 无 `stream_events` 表。无 persistent stream 可供恢复。
2. 无 PITR（point-in-time recovery）能力 — 仅有每日全量备份。
3. 规范描述 PITR + stream replay 的恢复流程，但 stream 数据仅存在于进程内存和 WebSocket 推送中。
4. 恢复流程中的 `STREAMS_REPLAYED` 步骤没有可 replay 的数据。

**Exact incident timeline**（规范假定的恢复路径在现实中完全不可执行）：
```
T+0s:    ECS 数据盘故障。全量丢失。
T+2h:   运行 restore-runtime-state.sh → 恢复 24h 前的 civilization.db
T+2h:  规范要求的后续步骤：
          INTEGRITY_VERIFIED → 可执行（sqlite3 integrity_check）
          STREAMS_REPLAYED → 不可执行（无 stream_events 表，无持久事件数据）
          RECEIPTS_JOBS_SAGAS_RECONCILED → 不可执行（无 scheduled_jobs / saga 表）
          GAMEPLAY_SMOKE_PASSED → 可手动执行
T+2h:  恢复的 DB 中的玩家进度比客户端已知的旧 24h
T+2h:  客户端重连 → 服务端 ownerVersion = 300, 客户端 knownVersion = 1200
          → 无 "服务端版本 < 客户端版本" 的强制恢复协议
          → 客户端可能覆盖服务端状态或进入不一致
```

**Blast radius**：PITR 恢复不完整。恢复后玩家客户端与服务器状态巨大差异，无可应用于增量的持久事件流。

**Detection gap**：无 stream retention 监控。无 PITR capablity 检查。

**RPO/RTO parameter affected**：RPO = 24h（备份间隔）。RTO = 备份恢复时间 + 手动修复时间。

**Why current wording does not prevent it**：规范假定存在 persistent stream 用于增量恢复，但 stream 数据从未持久化。

**Required revision/runbook**：
1. 实现 `stream_events` 表，所有领域事件在 COMMIT 时写入。
2. 备份策略增加连续 WAL 归档（近实时 PITR）。
3. 恢复时 apply WAL 到最近 point，再 replay 持久事件流以恢复下游 projection。
4. 在无 stream 数据的当前状态下，恢复后客户端必须接受 full resync（bootstrap）。

**Failure-injection evidence**：RESTORE_STREAM_GAP
- 注入点：无（stream 表不存在，无法注入）
- 通过证据：N/A — 规范要求的恢复步骤在实现中不可执行

---

### [RS-02][P0][SPEC_CONTRADICTION] Restore state machine 的 10 个状态全部无执行主体、无持久状态、无超时、无回滚

**Attacked v2.1 clause**：restore state machine（行 1673-1687）。

**Preconditions**：
1. 规范定义了 10 状态机：`REQUESTED → WRITERS_FENCED → SCHEDULERS_AND_RELAYS_STOPPED → DATA_RESTORED → INTEGRITY_VERIFIED → STREAMS_REPLAYED → RECEIPTS_JOBS_SAGAS_RECONCILED → GAMEPLAY_SMOKE_PASSED → NEW_OWNER_EPOCHS_ISSUED → TRAFFIC_REOPENED`。
2. 规范说明 "Any failed step → RESTORE_BLOCKED" 和 "No manual traffic reopen without recorded evidence"。
3. **但以下核心参数全部未定义**，使状态机从注释降为不可执行设计：

**每步分析**：

| Step | 谁执行 | 状态存哪里 | 重复执行怎样 | 失败停在哪里 | 回滚怎样 |
|---|---|---|---|---|---|
| REQUESTED | 人类 or 自动化触发？ | 无定义。规范无 restore_state 表 | 应该幂等（gate） | N/A — 起点 | N/A |
| WRITERS_FENCED | 哪个进程？通过什么机制递增 owner_epoch？ | 无定义。规范假定 owner_leases 表存在该列 | 如果已 fenced 则跳过 | RESTORE_BLOCKED | 如果此步失败但 DB 未被修改，应可重试 |
| SCHEDULERS_AND_RELAYS_STOPPED | 谁 stop？PM2 stop？需人工？ | 无定义 | stop 已 stop 的进程可能失败 | RESTORE_BLOCKED — 但如果进程已死？ | 需要 restart |
| DATA_RESTORED | `restore-runtime-state.sh` 可执行此步 | 脚本的 exit code | 脚本已有 `WXGAME_RESTORE_CONFIRM` gate | RESTORE_BLOCKED | 从 pre-restore 备份再恢复 |
| INTEGRITY_VERIFIED | `sqlite3 ... "PRAGMA integrity_check"` 可执行 | 脚本 stdout | 可重复 | RESTORE_BLOCKED | 无 — integrity check 失败意味着备份损坏 |
| STREAMS_REPLAYED | 无 stream 数据 → 不可执行 | 无 | 无 | 必然 RESTORE_BLOCKED | 无 |
| RECEIPTS_JOBS_SAGAS_RECONCILED | 无 receipt/job/saga 表 → 不可执行 | 无 | 无 | 必然 RESTORE_BLOCKED | 无 |
| GAMEPLAY_SMOKE_PASSED | 人工？自动化脚本？ | 无定义 | 应该可重复 | RESTORE_BLOCKED | 无 |
| NEW_OWNER_EPOCHS_ISSUED | 无 owner_epoch 列 → 不可执行 | 无 | 无 | RESTORE_BLOCKED | 无 |
| TRAFFIC_REOPENED | Nginx reload？PM2 restart？ | 无定义 | 如果已 open 则 skip | 无 — 已到最后一步 | 需重新 fence |

**结论**：10 步中仅 3 步有可执行的对应物（DATA_RESTORED、INTEGRITY_VERIFIED、GAMEPLAY_SMOKE_PASSED 的手动版本）。7 步无任何可供执行的代码、表或脚本。

**Why current wording does not prevent it**：状态机是设计意图的描述，不是可执行规范。缺少执行主体、持久状态和幂等语义意味着两个运维可能同时执行恢复、步骤可能被跳过、或失败的步骤永远不被重试。

**Required revision/runbook**：
1. 在实际脚本中实现每一步，而非仅作为 HTML 注释。
2. 增加 `restore_state` 持久化表：`restore_id, step, status, started_at, completed_at, error, operator`。
3. 恢复脚本必须是幂等的：每一步检查 `restore_state` 表中当前 step 的状态再继续。
4. 增加恢复的显式人工授权 gate（如 `RESTORE_AUTHORIZATION_TOKEN`）。
5. 增加恢复超时（如果某步超过 deadline，自动告警）。

**Failure-injection evidence**：RESTORE_STATE_MACHINE_DOUBLE_EXECUTION
- 注入点：同时启动两个恢复脚本
- 期待不变量：仅一个实际执行，另一个检测到锁或已完成状态后退出
- 通过证据：DB 中 `restore_state` 表显示单次恢复的记录
- 清理方式：删除测试 restore_state 行

---

### [RS-03][P1][FACT] 备份不覆盖 PM2 配置、.env、Nginx 配置、前端文件

**Attacked v2.1 clause**：R4 — 权威数据由 DB/PITR 和持久流恢复；基础设施由版本配置重建，密钥来自 secret manager。

**Preconditions**：
1. `backup-runtime-state.sh` 仅备份：`civilization.db`、`shared/` config、可选的 `deploy-state/`。
2. 不备份：PM2 process list（`ecosystem.config.js`）、`.env` 文件（含 JWT_SECRET、DB_PATH 等）、Nginx 配置、前端静态文件。
3. 规范说基础设施由版本配置重建 — 但版本配置（PM2 ecosystem、Nginx config）本身未被版本化和备份。
4. 规范说密钥来自 secret manager — 但实现中密钥来自 `.env` 文件。

**Exact incident timeline**（全量故障后无法自举）：
```
T+0s:    ECS instance 完全故障。更换新实例。
T+1h:   新实例启动，安装 Node/npm/pm2
T+1h:   git clone → deploy.sh → 部署最新代码
T+1h:   restore-runtime-state.sh → civilization.db ✓
T+1h:   尝试 pm2 start → 失败：无 ecosystem.config.js
T+1h:   尝试启动 server → 失败：.env 不存在，JWT_SECRET 丢失
T+1h:   尝试 Nginx → 失败：无配置
T+2h:   运维从文档/记忆手动重建 .env（风险：错误记忆导致安全漏洞）
T+3h:   系统最终恢复。但 .env 可能是旧版本或不完整。
```

**Blast radius**：恢复不完整导致系统不可用。恢复环境与原始环境不一致。

**Detection gap**：无基础设施配置的版本控制和备份。

**RPO/RTO parameter affected**：RTO = +2h（手动重建配置）。

**Why current wording does not prevent it**：规范说基础设施由版本配置重建，但配置本身不在备份中。

**Required revision/runbook**：
1. PM2 ecosystem 文件、Nginx 配置纳入 git 仓库（`infra/` 目录）并通过 deploy 部署。
2. `.env` 文件不得包含 secrets。Secrets 由环境变量注入（通过 PM2 `--update-env`）或 secret manager。
3. 备份不包括但这些配置的**来源**（git 路径和版本）记录在 deploy marker 中。
4. 恢复 runbook 步骤：`git checkout deploy-config-version` → `apply nginx config` → `pm2 start with env vars from secret manager`。

**Failure-injection evidence**：INFRA_REBUILD_FROM_CONFIG
- 注入点：模拟全新 ECS，git clone + 恢复 backup → 运行 deploy
- 期待不变量：deploy 不需要任何手动创建文件，完整启动所有服务
- 通过证据：`pm2 list` 显示所有进程 online，`nginx -t` 通过
- 清理方式：N/A（全新环境）

---

## 8. SECRET_IDENTITY_RESOURCE_EXHAUSTION_ATTACKS

### [SE-01][P0][FACT] Secret Manager 不存在 — 密钥来自 .env 文件

**Attacked v2.1 clause**：Secrets + Identity — 密钥来自 secret manager，服务到服务使用可轮换身份与最小权限；日志、trace、备份不含明文秘密。轮换支持明确重叠窗口和撤销。secret manager 不可用时按 endpoint 拒绝，不回退到代码默认值。

**Preconditions**：
1. JWT_SECRET 来自 `process.env.JWT_SECRET`（通过 `dotenv` 从 `.env` 文件加载）。
2. 无 secret manager 集成。
3. 无密钥轮换机制。
4. 无服务到服务身份（mTLS、SPIFFE、等）。
5. 日志中可能包含 .env 变量的间接引用但无 redaction。

**Exact incident timeline**（.env 文件泄露 → 全密钥暴露）：
```
T+0s:    运维 git commit 时意外包含 .env（gitignore 缺失或不生效）
T+0s:    .env 推送到 Git remote
T+1h:   攻击者从 git history 提取 JWT_SECRET
T+1h:   攻击者伪造任意玩家 session token
T+1h:   攻击者以任意玩家身份调用 API
T+2h:   检测到异常（或不检测）
T+2h:   无轮换机制 → 必须手动更新 .env + PM2 restart → 所有 session 失效
```

**Blast radius**：所有 session 可伪造。无轮换意味着恢复需要全量登出。

**Detection gap**：无 `.env` 文件的 git tracking 监控。无 secret 扫描。

**RPO/RTO parameter affected**：RPO = 0（数据完整但被滥用）。RTO = 手动轮换 + 全量 session 失效。

**Why current wording does not prevent it**：规范要求 secret manager，实现使用 .env 文件。差距为全量。

**Required revision/runbook**：
1. 移除 `.env` 文件中的 secrets。Secrets 必须来自外部 secret manager（如 HashiCorp Vault、AWS Secrets Manager）。
2. 如使用 K8s，使用 `SealedSecrets` 或 ExternalSecrets Operator。
3. 如保持单机：至少使用 PM2 `env` 配置 + 文件权限 600 + gitignore。
4. 每次 deploy 验证无 secret 泄漏（扫描 git diff）。

**Failure-injection evidence**：SECRET_ROTATION_WINDOW
- 注入点：更改 JWT_SECRET，验证轮换窗口（新旧 token 并存时间）
- 期待不变量：deploy 期间新旧 secret 均可验证，直到所有旧 session 过期或 deploy 完成后旧 secret 失效
- 通过证据：轮换窗口中同时有效的旧 session 和新 session 均可正常工作
- 清理方式：恢复原 secret

---

### [SE-02][P1][SPEC_CONTRADICTION] 证书过期 / 服务身份撤销 / 审计存储满 无 fail-closed/fail-open 边界

**Attacked v2.1 clause**：Secrets + Identity — 权限最小化并可审计；O3 — 后端仅私网可达。

**Preconditions**：
1. 当前无 mTLS、无证书管理、无服务身份。
2. 如果未来引入：证书过期时 API 应该 fail-closed（拒绝所有请求）还是 fail-open（警告继续）？
3. 审计存储（`ops-audit.log`）满时是否阻塞 API？

**Exact incident timeline**（审计存储满 → 无法写入 → 如果 fail-closed 则拒绝所有 API）：
```
T+0s:    ops-audit.log 持续增长。磁盘使用 99%。
T+1s:    OpsControlService.appendAudit() → fs.appendFileSync() → ENOSPC
          → 如果 ops 操作调用链中：error propagates, PM2 重启
          → 如果 API 路径中触发 audit 写入：API 500
T+2s:    磁盘满。SQLite 写入也返回 ENOSPC → 全站 500
```

**Blast radius**：磁盘满时全站不可用（无论是否 fail-closed）。当前无隔离策略。

**Detection gap**：无 `ops-audit.log` 的 size 监控和 rotation。

**RPO/RTO parameter affected**：RPO = 0。RTO = 磁盘清理 + 重启。

**Why current wording does not prevent it**：规范定义了 "可审计" 但未定义审计存储的容量限制和满时的处理策略。

**Required revision/runbook**：
1. 审计日志必须 rotate（按大小或时间）。
2. 审计写入失败不得阻塞 API 主路径（fire-and-forget + error log）。
3. 磁盘使用率告警（>85%）触发自动审计日志清理。
4. 规范本节应明确："审计写入失败 → warn, continue API processing" 或 "fail-closed: 503 when audit is unavailable"。

**Failure-injection evidence**：AUDIT_LOG_FULL_BLOCK
- 注入点：填充磁盘到 >99%，触发 audit 写入
- 期待不变量：API 返回正常响应（200），但审计记录丢失（warn logged）
- 通过证据：ENOSPC 不传播到 API 响应
- 清理方式：释放磁盘空间

---

### [SE-03][P1][FACT] Disk full / WAL 无限增长 / FD 耗尽 / 对象存储无隔离策略

**Attacked v2.1 clause**：W4 Bounded Complexity — 热路径不随 P 全扫；Capacity + Backpressure — measured limits · bounded queues · shed load before corruption。

**Preconditions**：
1. `civilization.db` WAL 文件在 `synchronous=NORMAL` 下可无限增长（无自动 checkpoint 限制）。
2. `observability.db` 的 `api_logs` 表每 7 天清理一次，但高流量下 7 天可能超出磁盘。
3. PM2 无最大 FD 限制。
4. 无对象存储集成（当前所有数据在本地文件系统）。
5. 无 per-endpoint 或 per-owner 的磁盘/TCP/DB connection 预算。

**Exact incident timeline**（WAL 无限增长 → 磁盘满 → 全站不可用）：
```
T+0h:  正常运行。WAL 自动 checkpoint（默认每 1000 页）。
T+2h:  高写入负载：1000 活跃玩家持续操作。WAL checkpoint 跟不上。
        WAL 文件增长到 200MB。
T+4h:  WAL 增长到 1GB。checkpoint 更慢（需要回写更多页到主 DB）。
T+6h:  磁盘使用 >95%。WAL 50GB。
T+6.5h: 磁盘满。SQLite ENOSPC → 所有写入失败 → 全站 500。
T+6.5h: 运维介入：手动 `PRAGMA wal_checkpoint(TRUNCATE)` → 磁盘释放 → 恢复。
```

**Blast radius**：全站写入不可用。`observability.db` 继续写入（不同文件）使情况恶化。

**Detection gap**：无 WAL 大小监控。无磁盘使用率趋势告警。无 per-file 的 IO 预算。

**RPO/RTO parameter affected**：RPO = 0（事务回滚）。RTO = 运维介入 + 手动 checkpoint。

**Why current wording does not prevent it**：规范定义了 bounded queues 和 backpressure，但无实现。WAL 文件增长的背压不传回 API。

**Required revision/runbook**：
1. 定期 `PRAGMA wal_checkpoint(PASSIVE)` 限制 WAL 大小。
2. 磁盘使用 >85% 时触发主动 checkpoint + 日志清理。
3. 当磁盘使用 >95% 时 API 返回 503 并告警。
4. WAL 大小和磁盘使用率加入健康检查。

**Failure-injection evidence**：WAL_UNBOUNDED_GROWTH
- 注入点：10K 次写入不触发 checkpoint，观察 WAL 文件大小
- 期待不变量：WAL 文件 < 100MB（或触发被动 checkpoint 后缩小）
- 通过证据：WAL 文件大小 = 0 或 < checkpoint threshold
- 清理方式：手动 checkpoint

---

## 9. HEALTH_RUNBOOK_AND_AUTOMATION_GAPS

### [HR-01][P0][FACT] 健康检查不覆盖 v2.1 规范要求的全部组件

**Attacked v2.1 clause**：O1 — 健康检查覆盖 owner lease、scheduler、outbox、事件流、DB、磁盘和恢复 lag。

**Preconditions**：
1. `OpsControlService.getHealthSummary()` 覆盖：config runtime status、observability、app version、system metrics、disk usage。
2. **不覆盖**：owner_epoch 状态、scheduler tick lag、outbox lag（表不存在）、event stream cursor（表不存在）、DB replication lag（无复制）、恢复 lag（无 PITR）、证书过期（无证书管理）。
3. v2.1 规范 O1 列表中的 7 项中，5 项无任何健康信号。

**Exact incident timeline**（假活：API 健康但关键后台组件停滞）：
```
T+0s:    API 健康检查返回 OK（config status=ok, disk=ok, PM2=online）
T+0s:    但实际上：scheduler tick 因 event loop 阻塞停滞 120s
          → 玩家建筑升级已完成但客户端未收到更新
          → 玩家看到 "升级中" 但实际已完成
          → 行军到达未结算 → 战斗推迟
T+5m:   健康检查仍然 OK。运维不感知。
T+10m:  玩家投诉。运维手动检查 worker 日志发现 lag。
```

**Blast radius**：假活检测失败。关键后台停滞但健康检查通过。

**Detection gap**：健康检查只有 liveness，没有 correctness 信号。无 scheduler lag、outbox lag、cursor lag 的监控。

**RPO/RTO parameter affected**：RPO = 0。RTO = 从玩家投诉到运维排查的时间。

**Why current wording does not prevent it**：O1 定义了 7 个信号但 5 个无实现。剩余的 2 个（DB、disk）只检查资源级别，不检查逻辑正确性。

**Required revision/runbook**：
1. 健康检查增加 `scheduler_lag_ms`、`scheduler_last_tick_at`。
2. 健康检查增加 `owner_leases WHERE state != 'active'`。
3. 健康检查增加 `disk_usage_percent` 和 `wal_size_bytes`。
4. 健康检查的 "ok" 状态必须要求所有覆盖信号通过，任一失败 → "degraded"。

**Failure-injection evidence**：HEALTH_FALSE_POSITIVE
- 注入点：block 事件循环 120s（使 scheduler lag）但保持健康检查路径通畅
- 期待不变量：健康检查返回 "degraded"（scheduler lag > threshold）
- 通过证据：scheduler lag 指标在健康检查响应中可见，且触发 status=degraded
- 清理方式：释放 event loop

---

### [HR-02][P1][FACT] 无自动化恢复 — 所有故障恢复需要人工 SSH

**Attacked v2.1 clause**：Health + Runbooks — liveness 不等于 correctness；假活、cursor 停滞、磁盘趋满和恢复分叉必须在用户错误前触发隔离或降级。

**Preconditions**：
1. PM2 提供 `max_restarts=10` 和 `max_memory_restart=500M`。
2. 无自动告警集成（无 webhook、无 PagerDuty/Opsgenie）。
3. 无自动降级（如 "disk > 95% → stop accepting new writes"）。
4. 所有恢复操作（`restore-runtime-state.sh`、`pm2 restart`）需要人工执行。

**Exact incident timeline**（磁盘趋满 → 无自动降级 → 全站崩溃）：
```
T+0s:   磁盘使用 85% → 无告警
T+1h:   磁盘使用 95% → SQLite 写入间歇性 ENOSPC → API 错误率上升
         无自动降级（仍接受写入）
T+1.5h: 磁盘使用 99% → PM2 开始崩溃循环（某些写入失败触发 unhandled rejection）
         无自动通知运维
T+2h:   玩家投诉 → 运维才感知
```

**Blast radius**：从可预防的降级退化为全站崩溃。

**Detection gap**：无外部监控。无自动化响应。

**RPO/RTO parameter affected**：RTO = 从故障到人工感知的时间（unbounded）。

**Why current wording does not prevent it**：规范要求 "在用户错误前触发隔离或降级"，但无相应的自动化机制。

**Required revision/runbook**：
1. 集成外部监控（Prometheus + Alertmanager 或云监控 + 短信告警）。
2. 磁盘使用 >90%：自动 WAL checkpoint + 日志清理 + API 降级为只读。
3. Disk 使用 >95%：自动停止 accept 新连接，保持已有连接可读。
4. 每次健康检查异常持续 >60s：自动通知运维。

**Failure-injection evidence**：AUTO_DEGRADATION_ON_DISK_CRITICAL
- 注入点：填充磁盘到 >95%（通过写入大文件到同分区）
- 期待不变量：API 自动返回 503（而非 SQLite error → 500 crash loop）
- 通过证据：`GET /api/health` 返回 `status: degraded, reason: disk_critical`
- 清理方式：删除填充文件

---

## 10. FAILURE_INJECTION_MATRIX

以下 12 个故障注入测试覆盖 v2.1 规范中的关键语义差距。每个测试明确注入点、期待不变量、通过证据和清理方式。

| # | 名称 | 注入点 | 期待不变量 | 通过证据 | 清理 | 对应 Finding |
|---|---|---|---|---|---|---|
| FI-01 | FENCE_SCHEMA_RECONCILIATION | `OwnerLockRepository._tryAcquire()` UPSERT | owner_epoch 递增；fencing check 在 aggregage_heads UPDATE 中 | SQL trace 含 fencing JOIN | 无 | FA-01 |
| FI-02 | PA_SPLIT_BRAIN_EPOCH_FORK | 两个 PA 进程同时执行 epoch CAS | 仅一个成功，另一个 CAS 冲突 | owner_leases 行的 epoch 变更无倒退 | 删除测试 epoch 行 | FA-02 |
| FI-03 | HANDOFF_DRAIN_STUCK | draining 后 block 旧 holder + kill 新 holder | 30s 内 owner 被回收至 active | owner_leases.state = 'active' | 手动 reset state | FA-03 |
| FI-04 | RESTART_DURING_TICK_COMMIT | tick 中间 SIGINT，新 worker 同时启动 | 旧 worker stop() 等待 tick 完成；WAL 中无交替写入 | WAL 中同一 player 的写入不来自两个进程 | 无 | FA-04 |
| FI-05 | CRASH_BETWEEN_COMMIT_AND_RECEIPT | `commit()` 后 `recordResult()` 前 `process.exit(1)` | commandId 查询可恢复终态 | command_receipts 存在或 API 返回 UNKNOWN | 删除测试半完成状态 | DB-11 |
| FI-06 | POWER_LOSS_ACK_RECOVERY | kill -9 + 清未 checkpoint WAL | 已 ACK 事务恢复后可见（synchronous=FULL）或丢失率如实记录 | 200 次迭代统计 | 恢复前备份 DB | DB-12 |
| FI-07 | DOUBLE_JOB_CLAIM | tick 中 advanceState() 两次修改同一 building | version 差值 = 1 | version diff per tick | 无（测试事务） | SO-01 |
| FI-08 | SAGA_PARTIAL_COMPLETION | 批量分发中途 kill | 恢复后从最后完成步骤继续 | saga_steps 状态递增无跳过 | 完成或回滚测试 saga | SO-03 |
| FI-09 | SCHEDULER_FREEZE_CATCHUP | kill -STOP 30s → kill -CONT | 3 tick 内 lag < intervalMs*2 | tick lag 指标正常 | 无 | SO-04 |
| FI-10 | DEPLOY_ATOMIC_SWITCH | 10 并发 curl + deploy | 0 次 404/版本混装/JS 404 | 全部响应的版本一致 | 无 | RM-01 |
| FI-11 | SCHEMA_MIGRATE_OLD_PROCESS_WRITE | 迁移后保持旧连接写入 | 旧 INSERT 成功（默认值）或旧进程已终止 | 无 SQLITE_ERROR | 回滚 schema | RM-02 |
| FI-12 | PARTIAL_ROLLBACK_MISMATCH | 部署后仅回滚后端代码 | /api/health 报告版本不匹配 | health 返回一致性验证结果 | 完整回滚 | RM-03 |
| FI-13 | RESTORE_STATE_MACHINE_DOUBLE_EXECUTION | 同时启动两个 restore | 仅一个执行，另一个退出 | restore_state 表单次记录 | 删除测试行 | RS-02 |
| FI-14 | HEALTH_FALSE_POSITIVE | 阻塞 event loop 120s | 健康返回 degraded | scheduler_lag 在 health 中可见 | 释放 event loop | HR-01 |
| FI-15 | AUTO_DEGRADATION_ON_DISK_CRITICAL | 填充磁盘 >95% | API 返回 503 | health.status = degraded | 删除填充文件 | HR-02 |
| FI-16 | WAL_UNBOUNDED_GROWTH | 10K 写入不触发 checkpoint | WAL 文件 < 100MB | WAL 大小受控 | 手动 checkpoint | SE-03 |

---

## 11. REQUIRED_SPEC_REVISIONS_AND_BLOCKING_QUESTIONS

### 11.1 规范修订要求

以下修订是将 v2.1 从不可执行设计变为可执行规范的最小更改：

1. **owner_leases DDL 必须匹配规范**：当前 `owner_locks` 表缺 `owner_epoch`、`state`、`transfer_to` 列。规范中的 fencing SQL 无法运行。必须同步代码或修改规范以匹配代码。

2. **Owner Placement Authority 必须定义自身选主**：规范不能将 placement authority 作为黑盒。其 epoch 递增操作必须通过 DB CAS 实现，且多个 authority instance 的冲突语义必须明确定义。

3. **Handoff state machine 必须定义超时**：`draining` 和 `transferring` 的最大持续时间、超时后的回收主体、和客户端拒绝语义必须明确定义。

4. **Restore state machine 必须成为可执行脚本**：每一步的脚本、幂等 guard、持久状态表、超时、人工授权 gate 和回滚路径必须实现。

5. **Release manifest 必须有签名和验证**：制品仓库不可用时签名验证的降级策略、签名的信任根、和 manifest 中各 artifact 的实际构建过程。

6. **Durability Profile 必须映射到存储层配置**：对于 SQLite WAL + NORMAL synchronous，三种故障类型的保证必须基于真实测试数据，而不是理论声明。

7. **Secret manager 的 fail-closed/fail-open 边界必须决策**：当 secret manager 不可用时，是拒绝所有请求还是使用缓存的旧 secret？这个决策直接影响可用性。

8. **健康检查信号必须从规范要求降为可实现列表**：O1 列表中无实现的信号（outbox lag、event stream cursor、DB replica lag、certificate expiry）应标记为 TBD 而非验收门禁。

### 11.2 阻塞性问题（需要项目组回答后才能推进设计）

1. **owner_epoch 递增是否需要 placement authority 的共识？** 如果两个 placement authority instance 各自认为自己持有权威，epoch 递增的 CAS 如何保证单调？

2. **scheduled_jobs 的 lease_token 由谁生成？** 如果 token 生成器 crash，未完成的 job 如何被重新 claim？token 的生成器自身失败后新的 generator 如何知道什么 jobs 需要重试？

3. **恢复过程中如果 WRITERS_FENCED 失败（owner_leases 表不可用或其他），是 abort 恢复还是跳过？** 跳过的后果是什么？

4. **Stream replay 的 cut point 和 DB PITR 的 cut point 如何保证一致？** 如果 stream 的 committed_seq 和 DB 的备份时间点有偏移，恢复后哪些事件需要 replay 哪些需要 discard？

5. **如果 expand-migrate-contract 的 5 个兼容面中某个面的回滚路径不可行（如 schema migration 无 down 脚本），应该接受前滚修复还是接受数据损失？**

6. **在只有 `.env` 文件作为 secret source 的当前实现中，规范要求的 "secret manager" 的最低可接受替代品是什么？** 是基础设施级的 env var 注入（PM2 ecosystem）还是必须外部 vault？

7. **单机部署中，"replica lag"、"DB failover"、"old primary fencing" 等要求应如何解释？** 这些要求是否仅适用于多机部署？如果是，单机部署的等效保证是什么？

8. **健康检查的 "status=degraded" 是否应自动触发通知/隔离？** 如果应该，自动化的最大半径是什么（不允许自动重启 DB？不允许自动 fence writer？）

---

## 附录 A：规范-实现对照矩阵

| v2.1 规范声明 | 行号 | 实现对应 | 差距 |
|---|---|---|---|
| owner_leases 表 with owner_epoch, state, transfer_to | 1033 | `owner_locks(ownerKey, holderId, scope, lockedAt, expiresAt)` | 缺 4 列 |
| fencing SQL: JOIN owner_leases ON epoch + holder + state + lease_until | 1116-1125 | `CommandCommitter.commit()` → `repository.save()` → 无 fencing SQL | 全量 |
| Owner Placement Authority | 615-623 | 无对应组件 | 全量 |
| Handoff: active→draining→transferring→active | 989 | 无状态机 | 全量 |
| scheduled_jobs with lease_token/lease_epoch | 1051, 1158-1187 | 无表 | 全量 |
| saga_instances/steps/reservations | 1052-1055, 1265-1298 | 无表 | 全量 |
| stream_events / outbox_events / consumer_cursors / inbox_receipts | 1055-1058, 1190-1225 | 无表 | 全量 |
| economy_journals / economy_ledger_entries | 1037-1038, 1229-1260 | 无表 | 全量 |
| command_receipts (规范版本) | 1050, 1129-1153 | `CommandIdempotencyStore` 有限实现 | 原子性与领域写入不在同一事务 |
| Immutable release manifest with signature | 1657-1669 | `deploy.sh` git checkout + `ConfigReleaseService` 有限版本管理 | 无制品、无签名、无原子切换 |
| Expand-migrate-contract 5面矩阵 | 1506-1515 | `SchemaMigrationService` 一次性迁移 | 无兼容窗口、无 down 脚本、无对账 |
| Restore state machine | 1674-1687 | `restore-runtime-state.sh` 仅覆盖 1 步 | 9/10 步无实现 |
| Writer fencing (deploy, failover, migration) | 1646 | 无实现 | 全量 |
| Durability profile per fault type | 1647 | WAL NORMAL, 仅一种恢复路径 | 无区分 |
| Secrets + identity (secret manager, mTLS, audit) | 1648 | .env 文件 | 全量 |
| Health: owner lease, scheduler, outbox, event stream, DB, disk, restore lag | 1649 | system + disk + config + observability | 4/7 无信号 |

---

*报告结束。唯一输出文件：`tmp/architecture-v2.1-adversarial-deepseek-reliability.md`。不得修改其他文件。*
