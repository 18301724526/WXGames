# 架构 v2.2 第三轮对抗审查报告 — 可靠性工程席 (DeepSeek)

> 审核者：DeepSeek 可靠性与灾难恢复席
> 审核日期：2026-07-14
> 审核基准：`成熟SLG后端参考架构-v2.2.html`、`容量合同-v2.2.schema.json`、
> `容量合同判定器规范-v2.2.md`、`当前实现迁移路线图-v2.2.md`
> 唯一输出：`tmp/architecture-v2.2-adversarial-deepseek-reliability.md`

---

## 1. RELIABILITY_V2_2_VERDICT

```
REFERENCE_V2_2_RELIABILITY_STATUS = NOT_PROVEN
RELIABILITY_CRITICAL_FINDINGS   = 9 SPEC_GAPS + 11 IMPLEMENTATION_GAPS
RELIABILITY_BLOCKING            = 5 (阻止进入可靠性演练的生产候选)
```

规范的可靠性语义在 **coordinator execution lease/**、**restore 凭证链** 和 **secret outage 分类** 三个关键维度存在 SPEC_CONTRADICTION 或 UNDER_SPECIFIED 缺陷。当前实现 (`restore-runtime-state.sh`、`deploy.sh`、`world-worker.js`、`server.js`) 缺少规范定义的 restore 状态机、writer fencing、epoch CAS、release manifest 签名和容量合同证据链 — 均为 IMPLEMENTATION_ONLY_GAP，不构成规范缺陷。

规范本身在可靠性维度的五处阻塞：
1. `restore_runs` 未定义单例约束，无法防止双 coordinator。
2. 未定义 restore coordinator 的崩溃回收主体。
3. `restore_runs.current_step` 未定义 next-step CAS 的具体 WHERE 子句。
4. 发布 manifest signer key rotation 未定义信任根切换协议。
5. secret outage 的 endpoint 分类表缺失，无法做分级的 fail-closed/降级决策。

---

## 2. CONFIRMED_CLOSURES

以下攻击路径（在 v2.1 报告中作为未解决提出）已在 v2.2 中得到充分闭合：

| 攻击路径 | 闭合机制 | 证据位置 |
|---|---|---|
| **Placement epoch 仅靠内存状态** | 规范已要求数据库单行 CAS 作为 epoch 权威 (§03 owner_leases DDL, 行 1135-1142) | `owner_leases.owner_epoch` 通过 `WHERE owner_epoch = :observed_epoch` CAS 递增 |
| **Scheduled job 无 lease token 防护** | `scheduled_jobs` 规范已定义 `lease_token`、`lease_epoch`、`lease_until`，domain 事务内 `WHERE lease_token=:token AND lease_epoch=:epoch` 条件更新 | §03 scheduled_jobs DDL 行 1221-1224 |
| **Command receipt 两步提交不原子** | D1 gate 已要求 receipt terminal 状态与领域写入同一事务；迁移路线图 M1 明确了强制故障注入和退出门禁 | §01 implementation-note 行 917，迁移路线图 §6 |
| **Snapshot cut 使用 published_at** | 规范 P6 gate 和 snapshot 语义已明确 `committed_seq` 为权威 cut，`published_at` 仅为 relay 进度 | §04 protocol-gate P6，§03 stream_events 注释 |
| **未知 writer 可绕过命令入口** | C5 gate 明确禁止调度器、后台任务和管理接口绕过命令入口直接写权威状态 | §cards C5 gate |

---

## 3. COORDINATOR_FENCING_AND_HANDOFF_ATTACKS

### 3.1 双 restore coordinator 并发启动

**攻击描述：** 两个操作员（或自动化脚本重试）几乎同时发起 restore 请求。规范定义 `restore_runs(restore_id, current_step, execution_token, lease_until)` 但 `restore_id` 是 UUID PK，任何插入都成功。没有单例约束（UNIQUE 或 WHERE NOT EXISTS 子查询）阻止多行并存。两个 coordinator 各行推进自己的 restore run，产生冲突的 writer fencing 和 epoch 变更。

**SPEC_GAP:** `restore_runs` 表定义（§03 行 1073）缺少 `WHERE status NOT IN ('REQUESTED','WRITERS_FENCED',...)` 的准入 guard。规范描述 "唯一执行租约" 但没有指定行级单例机制。

**推荐修复：** 在 restore_runs 的 admission 逻辑中增加：
```sql
-- 仅当没有运行中的 restore 时才能插入
INSERT INTO restore_runs (...) SELECT ... WHERE NOT EXISTS (
  SELECT 1 FROM restore_runs WHERE status NOT IN ('RESTORE_BLOCKED','TRAFFIC_REOPENED')
);
```

### 3.2 Restore coordinator 崩溃无回收主体

**攻击描述：** coordinator 持有 `execution_token` 并在 `WRITERS_FENCED` 步骤崩溃。其 `lease_until` 到期后，谁负责扫描过期的 restore run 并接管？规范 §03 定义命令 recovery guardian 可收回过期的 `command_receipts.execution_token`，但没有对应的 restore guardian 定义。恢复可能永久卡在 `RESTORE_BLOCKED` 之前的中间状态。

**SPEC_GAP:** 恢复状态机（§06 restore_runs）定义了 `execution_token` 和 `lease_until` 但没有指定回收主体。迁移路线图 M7 提到 "完整 restore 演练可以从签名请求走到有证据的 traffic reopen，失败步骤稳定停在 RESTORE_BLOCKED" — 但没有说谁推进从 BLOCKED 到重新恢复。

**推荐修复：** 规范必须增加 restore guardian 角色：定时扫描 `lease_until < now()` 且 `status NOT IN ('RESTORE_BLOCKED','TRAFFIC_REOPENED')` 的 restore_runs 行，通过 CAS 接管过期 token。

### 3.3 Old writer 在 WRITERS_FENCED 后恢复

**攻击建模：** 恢复过程已执行 fence（increment epoch CAS），旧 writer 此时因网络分区暂停。当分区恢复后：
- 旧 writer 内存中持有旧的 `holder_id` 和 `owner_epoch`
- 规范 §03 的 fencing SQL（行 1146-1154）在每笔 domain 事务中检查 `l.holder_id = :holder AND l.owner_epoch = :epoch AND l.state = 'active'`
- 因为 fence 已将 epoch 递增且 state 可能已改为 draining/transferring，`aggregate_heads` UPDATE 影响 0 行 → 整个事务回滚

**规范闭合良好。** 当前代码缺少此机制（IMPLEMENTATION_ONLY_GAP 记录于 M2）。

**注意：** 规范没有要求在 fencing 后强制清零旧节点的本地缓存。如果旧 writer 在恢复后仍使用缓存中的旧 epoch 数据做只读（不写），可能返回过期数据给客户端。规范的 `owner_leases.state` 可用于 drive 只读路由决策，但没有强制要求。这被归类为 UNDER_SPECIFIED 读一致性缺口。

### 3.4 部署进程重叠无 fencing

**攻击描述：** `deploy.sh` 的部署流程：`rsync --delete backend/ → npm install → pm2 restart`。如果旧 server 进程仍在处理 inflight 请求时 PM2 restart 发送 SIGINT，`world-worker.js:108-115` 调用 `worker.stop()` 后立即 `process.exit(0)`，不等待内存中 inflight 事务完成。这在规范 §06 "Writer Fencing" (行 1714) 中被要求必须 fencing，但当前实现没有。

**SPEC_CONSISTENT, IMPLEMENTATION_ONLY_GAP:** 规范要求部署前撤销/递增 owner epoch（§06 行 1714），但 `deploy.sh` 没有实现。`world-worker.js` 的 shutdown 路径不参与任何 epoch 机制。

### 3.5 Scheduler/relay 停止与新 epoch 发放的顺序

**攻击描述：** 规范 restore 状态机（§06 行 1747-1755）将 `SCHEDULERS_AND_RELAYS_STOPPED` 放在 `DATA_RESTORED` 之前，但 `NEW_OWNER_EPOCHS_ISSUED_BY_CAS` 放在 `GAMEPLAY_SMOKE_PASSED` 之后。问题：scheduler 停止后，已分配的 scheduled_jobs（`status='leased'`）的 `lease_until` 可能已过期。当 scheduler 重新启动时，这些 job 应被回收。但规范没有定义 restore 完成后的 scheduler 恢复协议 — 应该从 job 队列的哪个位置恢复？

**UNDER_SPECIFIED:** 规范描述了 scheduler 停止但未定义从 restore 后的恢复协议。scheduler 扫描窗口应从 restore 时间点还是 restore 前继续？

---

## 4. DURABILITY_PITR_AND_STREAM_CUT_ATTACKS

### 4.1 PITR cut 与 stream cut 偏移

**攻击建模：**
1. T1 时刻：DB PITR snapshot 创建（包含 stream_events up to seq=N, stream_heads.committed_seq=N）
2. T2 > T1：outbox relay 已将 seq=N+1..M 的事件发布到外部消费者（支付回调、通知服务）
3. 恢复执行到 PITR T1，seq N+1..M 的事件在恢复后的 DB 中不存在
4. 但外部消费者已处理这些事件

**影响链：**
- 消费者 cursor 指向 seq=M+1 但 stream 只有到 seq=N
- 消费者 gap 检测到缺口（N+1..M 缺失）但这是已处理事件的缺口，不是待处理事件的缺口
- 如果 stream replay 从 seq=N+1 重新生成事件，这些事件已经在外界造成副作用

**SPEC_GAP:** 规范 §06 和 §03 定义 stream replay 和 reconciliation，但没有定义 "外部已消费事件与 PITR 切点不一致" 的检测和修复协议。reconciliation 步骤 (`RECEIPTS_JOBS_SAGAS_RECONCILED`) 应该涵盖此情况但未展开语义。

**推荐修复：** 规范必须为 `STREAMS_REPLAYED` 增加外部消费者 reconciliation 子步骤：查询各 consumer_group 的 `acked_seq`，如果 acked_seq > restored stream_heads.committed_seq，对每个超过的部分发出 duplicate-detection marker 或在消费者端做幂等重放。

### 4.2 单机部署无 replica 的 RPO/RTO

**攻击建模：**
- 规范定义 "单机与多机分别声明 process crash、power loss、disk failure 的耐久性 profile"（§06 行 1715）
- 当前单机部署使用 SQLite (better-sqlite3)，ACK 返回在 `db.prepare().run()` 之后
- SQLite 的 WAL mode 默认 synchronous=NORMAL，在 OS crash 时可能丢失最近 1-3 秒的已提交事务
- PM2 的 `max_memory_restart: '500M'` 触发 OOM kill 时，与 OS crash 的语义不同：OOM kill 前 Node 有时间 flush，但 db.close() 在 `worker.stop()` 后被调用时，如果 stop 本身是 async 但 shutdown 不做 await...

**IMPLEMENTATION_ONLY_GAP:** `world-worker.js:108-115` 的 `shutdown()` 函数调用 `worker.stop()` 但从不 await 其完成。`worker.stop()` (WorldWorkerService) 很可能是 async 操作（需要等待当前 tick 完成），但 shutdown 不等待就进入 `db.close()` 和 `process.exit(0)`。这意味着 PM2 graceful restart 可能在 mid-tick 时强制退出。

### 4.3 备份与活动事务的一致性

**攻击描述：** `backup-runtime-state.sh` 使用 `better-sqlite3` 的 `db.backup()` API（行 97），这是一个在线备份 API，确实与 WAL 并发工作。但备份脚本没有先停止 writer — 没有 fencing。备份本身可能是热备份，但：
- 没有 WAL checkpoint 前置操作保证所有已提交事务在备份文件中
- 如果备份期间有大事务正在提交，备份文件可能不包含该事务的数据页
- 备份后缀名没有标记备份时刻的 db position

**IMPLEMENTATION_ONLY_GAP:** 规范要求 "恢复前 fence 所有 writer"（§06 行 1713、F1 gate），但备份脚本不执行任何 fencing。

### 4.4 Stream cut 后 receipt/job/Saga 的状态一致性

规范 §06 restore state machine 将 `RECEIPTS_JOBS_SAGAS_RECONCILED` 列为一步，但仅用 4 个单词描述。以下是该步骤中可能出现的冲突：

| 状态 | 问题 |
|---|---|
| `command_receipts.status = 'in_progress'` | 执行者可能已崩溃，receipt 需要 guardian 回收或标记为 `failed_final` |
| `scheduled_jobs.status = 'leased'` | job 的 `lease_until` 可能已过期，需要重置为 `pending` 或 `dead_letter` |
| `saga_instances.state = 'reserving' / 'confirming' / 'compensating'` | 超时需要推动到明确终态 |
| `saga_reservations` | 过期 reservation 需要释放或 confirm/compensate |

**UNDER_SPECIFIED:** 规范没有为任何上述状态提供 reconciliation SQL 模板或判定逻辑。

---

## 5. RELEASE_MIGRATION_ROLLBACK_ATTACKS

### 5.1 Release manifest 验签失败 / signer key 被撤销

**攻击建模：**
1. Release vN 由 signer key `K1` 签名，已部署运行
2. `K1` 被撤销（私钥泄露），新 signer key `K2` 轮换
3. Release vN 的 manifest 签名现在失效（因为 `K1` 被撤销）
4. 在线运行的 vN 是否应该继续？回滚到 vN-1（也由 `K1` 签名）是否也应该拒绝？

**SPEC_GAP:** 规范 §06 定义 "manifest 不可变且验签；信任根独立于运行目录"（§03 release_manifests 行 1072）但未定义：
- 签名的生效窗口（notBefore/notAfter）
- Key rotation 的重叠期（key 共存窗口）
- 已部署的已签名 manifest 在 signer key 被撤销后的有效规则
- 信任根的物理存储和完整性验证机制

**推荐修复：** 规范应要求 signer key 使用 X.509 式证书（含有效期）或明确 `signature` 字段表示 "签名时刻该 key 有效，manifest 在部署后信任根不校验在线撤销"。如果是后者，撤销策略必须是 "撤销后新部署被阻止，但已运行实例继续信任"。

### 5.2 制品仓库不可用

**攻击描述：** 规范 R2 gate 要求 "线上运行不可变制品并原子切换"，但没有定义制品仓库（如对象存储）不可用时的降级路径。deploy.sh 依赖 `git fetch origin` 和 `git checkout`，如果 Git 仓库不可用，部署失败，但没有定义 "不通过 git checkout 从本地制品缓存启动" 的路径。

**IMPLEMENTATION_ONLY_GAP:** 当前 `deploy.sh` 的唯一部署源是 git（bare repo 或 worktree），没有备份制品路径。规范 R2 "Git worktree 不承担线上目录" 已被遵守（backend_dir 是独立路径），但缺乏从制品缓存部署的能力。

### 5.3 Expand-migrate-contract 每阶段的 reader/writer 范围

**攻击建模（migration 期间旧 writer 仍存活）：**
1. Contract phase：旧表/字段应该已经被所有旧代码路径清零
2. 但实际上还有一个暂未重启的旧 worker 进程仍在写旧的 JSON 字段
3. Contract 删除该 JSON 字段 → 写入丢失且被静默忽略
4. 对账没有检测到丢失的写入，因为对账只比对新旧两条路径

**SPEC_CONSISTENT, IMPLEMENTATION_ONLY_GAP:** 规范 §04 兼容矩阵表（行 1575）要求 "旧 reader 清零后才 contract"，但迁移路线图 §8.6 将这一要求列为退出门禁。当前实现没有 expand-migrate-contract 框架（IMPLEMENTATION_ONLY_GAP 在 M3+ 阶段）。

### 5.4 不可逆 migration 和 forward-fix 决策

规范 §04 要求扩展阶段保持兼容，但某些 migration（如删除列、修改约束、拆分表）是不可逆的。如果 migration 期间发现数据异常：
- 是停在当前阶段做 forward-fix（补数据、修正再继续 contract）？
- 还是 rollback 到前一 release manifest？

**UNDER_SPECIFIED:** 迁移路线图 M3 §8 定义对账和回滚原则，但没有定义 "不可逆 migration 检测到异常后的 forward-fix vs rollback" 决策树。尤其是 "旧 reader 清零后才 contract" — 如果 contract 后发现异常，无法回滚。

---

## 6. RESTORE_STATE_MACHINE_ATTACKS

### 6.1 restore_runs 每一步的幂等 guard、超时、retry 完整性

规范 §06 restore state machine（行 1743-1760）声明：
> "Every step declares executor, idempotency guard, timeout, evidence digest, retry/rollback action and next-step CAS."

但规范正文中 **没有为任何一步提供这些声明的具体内容**。声明了需求但没有履行：

| 步骤 | 幂等 guard | 超时 | retry 策略 | next-step CAS WHERE |
|---|---|---|---|---|
| WRITERS_FENCED | 未定义 | 未定义 | 未定义 | 未定义 |
| SCHEDULERS_AND_RELAYS_STOPPED | 未定义 | 未定义 | 未定义 | 未定义 |
| DATA_RESTORED | 未定义 | 未定义 | 未定义 | 未定义 |
| INTEGRITY_VERIFIED | 未定义 | 未定义 | 未定义 | 未定义 |
| STREAMS_REPLAYED | 未定义 | 未定义 | 未定义 | 未定义 |
| RECEIPTS_JOBS_SAGAS_RECONCILED | 未定义 | 未定义 | 未定义 | 未定义 |
| GAMEPLAY_SMOKE_PASSED | 未定义 | 未定义 | 未定义 | 未定义 |
| NEW_OWNER_EPOCHS_ISSUED_BY_CAS | 未定义 | 未定义 | 未定义 | 未定义 |
| TRAFFIC_REOPENED | 未定义 | 未定义 | 未定义 | 未定义 |

**SPEC_CONTRADICTION:** 规范声明 "Every step declares..." 但未提供任何具体声明。这是规范内部的执行语义缺失。

### 6.2 Restore smoke 失败和 traffic reopen 授权缺失

**攻击描述：**
1. Restore 到 `GAMEPLAY_SMOKE_PASSED` 步骤通过
2. 操作员跳过 `TRAFFIC_REOPENED` 授权，直接重启 PM2 让玩家连接
3. 规范 §06 声明 "Reopen requires signed authorization + complete evidence chain"（行 1760）
4. 但规范没有定义：谁签名、签名什么内容、签名如何被 server 验证、验证失败时 server 行为

**UNDER_SPECIFIED:** `TRAFFIC_REOPENED` 的授权机制完全未定义。如果只是 flag 列，任何人都可以 flip；如果需要签名，签名 payload、验证公钥来源和拒绝逻辑全部缺失。

### 6.3 当前 restore 实现与规范的鸿沟

`restore-runtime-state.sh` 的完整步骤是：
1. 验证 WXGAME_RESTORE_CONFIRM env var
2. 校验备份 checksum
3. 解压 tar.gz
4. 可选：`pm2 stop` (不是 fence，只是进程停止)
5. 拷贝 db 文件到目标路径
6. 拷贝 shared/ 和 deploy-state/
7. `pm2 restart`

这距离规范的 10 步 restore 状态机差 9 步。**IMPLEMENTATION_ONLY_GAP** — 归入附录。

---

## 7. SECRET_IDENTITY_RESOURCE_EXHAUSTION_ATTACKS

### 7.1 Secret manager outage 的 endpoint 分类

**攻击描述：** 规范 §06 (行 1716) 声明：
> "按 endpoint 定义缓存旧凭据、只读降级或 fail closed"

但规范中的 "按 endpoint" 没有提供任何具体的 endpoint 分类表。哪些 endpoint 可以缓存旧凭据？哪些必须 fail closed？不同类型的 secret（JWT signing key、DB password、session encryption key、第三方 API key）的 outage 行为有何不同？

**UNDER_SPECIFIED:** 至少应定义以下分类矩阵：

| Secret 类型 | 依赖 endpoint 类 | Outage 行为 | 缓存 TTL | 备注 |
|---|---|---|---|---|
| JWT_SECRET | 全部玩家 API | Fail closed (401) | 0 (不可缓存，签名验证需要当前密钥) | 已签发的 token 在 TTL 内有效 |
| OPS_JWT_SECRET | ops/admin | Fail closed | 0 | 操作审计不可降级 |
| DB credential | 全站 | 启动时一次性，运行时不刷新 | 进程生命周期 | 改变需要重启 |
| 第三方支付 API Key | 支付 endpoint | Fail closed | 短期缓存 (5min) | 支付状态不可推迟 |

当前 `rotate-production-secrets.sh` 只更新 `.env` 文件，没有以端点分类或逐类 TTL 运行。**IMPLEMENTATION_ONLY_GAP.**

### 7.2 支付/admin/security audit fail closed 边界

规范 §06 (行 1716) 明确："支付、管理员和安全审计写失败默认 fail closed。" 这是正确的安全设计原则，但：
- 当前系统没有区分 "支付写" 和 "普通游戏写" — 所有写走过同一 CommandExecutionPipeline
- 没有 audit store 的独立故障域 — `logService.logApi()` 写入 `observability.db`，失败时 catch error 但继续（行 152-155）
- `ops-agent` 的审计日志是纯文件追加，没有 fail-closed 保护

**IMPLEMENTATION_ONLY_GAP:** `server.js:152-155` 的 `try { logService.logApi(...) } catch {}` 意味着 API 审计日志失败不阻止请求 — 这违反了 "审计写失败 fail closed" 的规范要求。

### 7.3 Disk critical / health 假活

**攻击描述：** `server.js:207-257` 的 `/api/health` 返回：
- `buildingConfigVersion`、`presence summary`、`observability summary`、`configRuntime status`
- **不检查**：磁盘可用空间、WAL 文件大小/增长速度、文件描述符使用数、备份延迟、证书到期

规范 O1 gate 要求健康检查覆盖 "owner lease、scheduler、outbox、事件流、DB、磁盘和恢复 lag"（§cards O1），但当前实现覆盖范围约 15%。**IMPLEMENTATION_ONLY_GAP。**

### 7.4 WAL / backlog 不收敛

**攻击建模：**
1. Outbox relay 速率 < 事件生成速率（例如 relay 挂了）
2. `outbox_events` 表无界增长
3. SQLite WAL 文件无界增长
4. 磁盘满 → 写事务失败 → 所有玩家操作被阻塞

规范 W7 gate 要求 "backlog 不收敛、追赶压垮 DB/consumer" 为 FAIL。当前实现没有 outbox relay（只有一个 world-worker 和 server），所以 WAL 增长的最大来源是 `game_states` 的整行重写。规范已在 W1 gate 禁止，但 `game_states` 尚无窄行替代。**IMPLEMENTATION_ONLY_GAP.**

### 7.5 证书到期无监控

规范 §06 (行 1717) 要求健康覆盖 "证书"。当前 `/api/health` 没有证书到期检查。`deploy.sh` 中的 curl 验证只检查 HTTP 200 响应，不校验 TLS 证书有效期。

**IMPLEMENTATION_ONLY_GAP** — 单机部署时如果使用 TLS（Nginx 反向代理），无监控意味着证书到期导致全站不可用且无预警。

### 7.6 内存耗尽

PM2 配置 `max_memory_restart: '500M'`（ecosystem.config.js:20）。当内存接近 500M 时 PM2 会强杀进程，不等待 graceful shutdown。`world-worker.js:108-115` 的 shutdown 不等待 `worker.stop()` 完成 — 意味着如果 worker.stop() 本身需要 >1 秒（正在处理一个大 tick），PM2 可能在 mid-tick 时杀进程。

**IMPLEMENTATION_ONLY_GAP:** 如果 PM2 强杀发生在领域事务中间：
- 该事务在 SQLite 层面已回滚（WAL checkpoint 未完成 → 数据安全）
- 但 Node 内存中的状态丢失，可能的 domain 逻辑不完整
- 没有一个 "事务边界确认" 机制让 worker 在安全点才接受 kill 信号

---

## 8. FAILURE_INJECTION_MATRIX

每个故障注入场景覆盖：注入点、故障模型、期待不变量、超时、通过证据、清理方式、安全边界。

### F-01: 双 restore coordinator 并发启动

| 属性 | 值 |
|---|---|
| **注入点** | `restore_runs` 准入路径。两个独立的 `POST /admin/restore` 或 CLI 调用几乎同时到达 |
| **故障模型** | 竞态条件（race condition），非 crash。两个请求各自生成 UUID `restore_id`，分别 INSERT 到 `restore_runs` |
| **期待不变量** | 只有一个 restore run 进入 `REQUESTED` 状态；另一个被拒绝（409 Conflict 或 CAS 失败） |
| **超时** | admission 超时 5s；如果第一个 restore run 的 WRITERS_FENCED 在 60s 内未完成，释放 admission 并允许新的 restore |
| **通过证据** | `SELECT count(*) FROM restore_runs WHERE status NOT IN ('RESTORE_BLOCKED','TRAFFIC_REOPENED')` = 1；两个请求中一个收到成功响应，另一个收到拒绝响应 |
| **清理方式** | 成功的 restore run 正常完成或失败进入 RESTORE_BLOCKED；被拒绝的请求不产生任何副作用 |
| **安全边界** | 不能因为 restore admission 的 race condition 导致两个 writer fencing 操作交叉执行或 epoch 回退 |

### F-02: Restore coordinator 在 DATA_RESTORED 后崩溃

| 属性 | 值 |
|---|---|
| **注入点** | 在 `DATA_RESTORED` 步骤完成、`INTEGRITY_VERIFIED` 开始之前 kill -9 恢复 coordinator 进程 |
| **故障模型** | process crash（非 graceful shutdown）。coordinator 的 `execution_token` 和 `lease_until` 已被写入但 coordinator 消失 |
| **期待不变量** | Restore guardian 在 `lease_until + grace_period` 后检测到过期 lease，接管 restore run；当前步骤（DATA_RESTORED）的 evidence digest 已持久化，guardian 从 INTEGRITY_VERIFIED 开始继续；不需要重做 DATA_RESTORED |
| **超时** | guardian 扫描间隔 10s；接管超时 = lease_until + 30s grace |
| **通过证据** | `restore_runs.current_step` 从 `DATA_RESTORED` 推进到 `INTEGRITY_VERIFIED` 或后续步骤；`restore_runs.updated_at` 被 guardian 更新；原 coordinator 的 `execution_token` 被替换 |
| **清理方式** | 成功完成 restore 或停在 RESTORE_BLOCKED；不需要手动清理数据库行 |
| **安全边界** | 旧 coordinator 恢复后（如果）不能使用过期 token 继续执行 — token CAS 已失效 |

### F-03: Old writer 在 WRITERS_FENCED 后恢复写入

| 属性 | 值 |
|---|---|
| **注入点** | Fence 已执行（owner_epoch incremented by CAS），旧 writer 进程从 SIGSTOP 恢复 |
| **故障模型** | 进程暂停 (SIGSTOP 30s + SIGCONT)。旧 writer 持有内存中过期的 `holder_id` 和 `owner_epoch` 值 |
| **期待不变量** | 旧 writer 的任何数据库写入尝试都失败：`aggregate_heads` UPDATE 的 WHERE 子句检查 `l.holder_id = :holder AND l.owner_epoch = :epoch` → 影响 0 行 → 整个事务回滚；旧 writer 收到 epoch mismatch 错误并进入只读/fenced 模式 |
| **超时** | 单次事务超时 10s（数据库级别） |
| **通过证据** | 恢复后在 `command_receipts` 中只有新 epoch holder 的已提交事务；旧 writer 的 attempted writes 没有留下任何领域变更；旧 writer 的日志中出现明确 fencing error |
| **清理方式** | PM2 重启旧 writer 使其加载新配置（或部署脚本已将其重启）；不需要数据库清理 |
| **安全边界** | 确保 fencing 错误不被旧 writer 的 retry 逻辑静默忽略 — retry 必须重新读取 epoch 并在发现 epoch 已变时放弃 |

### F-04: PITR cut at T1, outbox 已发布到 T2 > T1

| 属性 | 值 |
|---|---|
| **注入点** | 恢复使用 T1 时刻的 DB snapshot，但 outbox relay 在 T1..T2 期间已向外部消费者发布了事件 seq M..N |
| **故障模型** | 时间偏移不一致。恢复后 stream_heads 显示 committed_seq=M-1 但消费者 cursor 指向 N+1 |
| **期待不变量** | 恢复后的 STREAMS_REPLAYED 步骤从 seq=M 开始重放事件；对 seq=M..N 的事件，replay 生成与原始完全相同的事件（相同 event_id、payload）；外部消费者检测到 event_id 去重（幂等）或通过 gap detection 请求重放；没有一个 seq=M..N 的事件被静默跳过 |
| **超时** | stream replay 超时 300s（取决于事件量）；消费者 reconciliation 超时 120s |
| **通过证据** | 所有 consumer_cursors.acked_seq >= 恢复后 stream_heads.committed_seq；dlq 中无因 restore 引入的 poison 事件；外部消费者确认重放事件被幂等丢弃或正确处理 |
| **清理方式** | 不需要额外清理 — stream replay 是恢复的常规步骤 |
| **安全边界** | replay 不能生成与原始不同的 event_id（否则外部消费者的去重失效）；replay 不能改变事件顺序 |

### F-05: Migration contract phase 旧 writer 仍存活

| 属性 | 值 |
|---|---|
| **注入点** | expand → migrate → contract 流程中，contract 阶段执行 DROP COLUMN / DROP TABLE 的同时，一台未重启的旧代码实例持续写入旧结构 |
| **故障模型** | 部署不完全。部分进程未被 PM2 restart 覆盖（例如手动启动的调试 worker） |
| **期待不变量** | Contract 前系统验证 `old_reader_count == 0 AND old_writer_count == 0`（通过 writer inventory 自检或数据库写入计数）；任一非零 → contract 被阻止；强制 contract（操作员覆盖）需要审批单和接受数据丢失风险 |
| **超时** | writer inventory 采样窗口 60s |
| **通过证据** | `SELECT count(*) FROM old_path_writes WHERE timestamp > contract_window_start` = 0；对账脚本确认新旧路径数据一致 |
| **清理方式** | 找到并停止剩余旧 writer（kill 或 PM2 delete）；contract 后重新执行对账 |
| **安全边界** | DROP COLUMN 不可逆 — contract 前的零写入验证是防止数据丢失的最后防线 |

### F-06: Release manifest signer key 在部署中途被撤销

| 属性 | 值 |
|---|---|
| **注入点** | 发布 vN 的 manifest 由 signer key K1 签名；部署过程中 K1 被标记为 compromised（CRL/OCSP 更新） |
| **故障模型** | 密钥泄露 + 时间窗口竞态。manifest 已通过预部署门禁验证（签名有效）但部署进行中时 K1 被撤销 |
| **期待不变量** | 已在运行的实例不受影响（按 "签名时有效" 原则）；正在进行的部署完成但不被视为 "已验证安全" — 发布状态标注为 `DEPLOYED_BUT_SIGNER_REVOKED`；系统告警要求操作员验证部署完整性 |
| **超时** | signer revocation 传播延迟 300s（取决于信任根同步机制） |
| **通过证据** | 运行中实例的 release manifest 在 audit log 中记录为 "signer K1 verified at deploy-time T0"；新部署请求被阻止直到 signer K2 重签 |
| **清理方式** | 用新 signer key K2 重新签名 vN manifest 并原子切换（或回滚到 vN-1 如果 vN-1 由未被撤销的 key 签名） |
| **安全边界** | 已部署代码不能因为 signer key 撤销而被自动停止（防止拒绝服务攻击）；但新部署必须被阻止 |

### F-07: Secret manager 在支付交易期间不可用

| 属性 | 值 |
|---|---|
| **注入点** | 支付回调到达，需要验证 API key / HMAC secret，但 secret manager（当前是 .env 文件/进程 env）不可达 |
| **故障模型** | .env 文件被误删或权限变更导致进程无法读取；或网络分区导致外部 KMS 不可达 |
| **期待不变量** | 支付验证 fail closed → 返回 503 并记录 audit 事件；不"默认通过"验证；不影响非支付 endpoint（游戏操作只读缓存中的 session secret） |
| **超时** | 支付验证超时 5s，无可用缓存时立即返回 503 |
| **通过证据** | 支付回调返回 503（不是 200 accepting payment）；audit log 记录 `PAYMENT_VALIDATION_FAILED_SECRET_UNAVAILABLE`；无未验证的支付被标记为 completed |
| **清理方式** | 恢复 secret 文件/KMS 可达性；重试 pending 支付回调（幂等） |
| **安全边界** | 支付、管理员登录、安全审计写必须 fail closed；普通游戏读可降级使用缓存旧 secret（≤5min TTL） |

### F-08: Audit store 满 + 支付处理

| 属性 | 值 |
|---|---|
| **注入点** | `observability.db` 磁盘满或 `logService.logApi()` 写入失败（SQLITE_FULL） |
| **故障模型** | 资源耗尽（disk full）。审计日志写入失败但主游戏数据库仍有空间 |
| **期待不变量** | 审计写入失败时 fail closed：支付操作被阻止（不是静默跳过审计）；已存在的游戏读操作继续正常；`logService.logApi()` 写入失败必须传播为请求失败（不是当前 `catch {}` 行为） |
| **超时** | 支付操作在 30s 超时或返回 503 |
| **通过证据** | 支付操作返回 error（非 200）；audit log 包含 "AUDIT_STORE_FULL" entry（如果物理可能）；管理告警触发 |
| **清理方式** | 扩展磁盘或清理旧日志（在 retention policy 范围内）；重启服务 |
| **安全边界** | 审计日志是合规要求 — 静默跳过审计是不可接受的（当前 `server.js:152-155` 的行为违反了 fail-closed 规范） |

### F-09: Disk critical — 健康信号假活

| 属性 | 值 |
|---|---|
| **注入点** | 磁盘使用率达到 95%，WAL 文件 4GB 且增长中，但 `/api/health` 返回 `status: 'ok'` |
| **故障模型** | 健康信号不完整（假阴性 — 报告健康但实际不健康）。`server.js:207-257` 不检查磁盘、WAL 大小、或 fd 计数 |
| **期待不变量** | 健康检查在磁盘 > 90% 时返回 `degraded`；> 95% 时返回 `unhealthy`；自动降级：拒绝新写入（只读模式）、发送告警 |
| **超时** | 磁盘检查间隔 ≤ 30s；从 95% 到 unhealthy 的响应 ≤ 60s |
| **通过证据** | `/api/health` 返回 degraded/unhealthy 状态码和具体原因；告警在 120s 内触发 |
| **清理方式** | 清理旧备份、WAL checkpoint 合并、扩展磁盘 |
| **安全边界** | 磁盘满时继续接受写入 = 数据损失风险。规范 F1/W7/W8 gate 要求健康检查覆盖磁盘和 backlog |

### F-10: WAL / backlog 不收敛 — 无限增长

| 属性 | 值 |
|---|---|
| **注入点** | Outbox relay 停止（模拟 relay outage），事件继续生成，`outbox_events.status = 'pending'` 行数持续增长 |
| **故障模型** | relay_outage，持续时间 300s。事件生成速率 = 100/s，relay 速率 = 0 |
| **期待不变量** | Outbox backlog 超过阈值 → 触发 backpressure：新事务被限流或拒绝（不能无界排队）；告警触发；WAL 不无界增长（autocheckpoint 或 manual checkpoint 限制 WAL 大小） |
| **超时** | Backpressure 在 backlog > 10000 events 或 oldest event > 60s 时激活 |
| **通过证据** | 拒绝新命令（503 backpressure）在 backlog 超限后 30s 内开始；没有 event 被静默丢弃；relay 恢复后 backlog 在 120s 内排空 |
| **清理方式** | 恢复 relay；等待排空（或手动跳过 poison event → DLQ） |
| **安全边界** | Backpressure 不能拒绝 `accepted` 状态事务的 compenstation 步骤 — Saga compensation 必须正常完成 |

### F-11: Restore smoke 测试失败 + traffic reopen 未授权

| 属性 | 值 |
|---|---|
| **注入点** | GAMEPLAY_SMOKE_PASSED 失败（例如核心玩法命令返回错误），但操作员直接重启 PM2 暴露玩家流量 |
| **故障模型** | 人为错误（跳过门禁）。操作员绕过 TRAFFIC_REOPENED 授权步骤 |
| **期待不变量** | GAMEPLAY_SMOKE_PASSED 失败 → restore 停在 RESTORE_BLOCKED；PM2 启动后被 server 检测到 restore run 未处于 TRAFFIC_REOPENED 状态 → server 拒绝所有写入（只读模式）直到获得有效授权 |
| **超时** | Server 启动后 10s 内检测 restore status 并进入只读模式 |
| **通过证据** | 玩家收到 "游戏维护中" 响应（不是错误或脏数据）；管理端显示 RESTORE_BLOCKED 并附 smoke 失败证据 |
| **清理方式** | 诊断 smoke 失败原因 → 修复 → 重新执行 restore 流程（或从安全备份恢复） |
| **安全边界** | TRAFFIC_REOPENED 授权必须是密码学签名（不是简单 flag）。规范声明 "signed authorization + complete evidence chain" — 如果签名不可得，系统必须阻止流量 |

### F-12: Placement ABA — 双操作员并发快速 handoff

| 属性 | 值 |
|---|---|
| **注入点** | Owner A 的 handoff 从 host1 → host2 执行，同时第二个操作员发起 host2 → host1 的 handoff（回切） |
| **故障模型** | 竞态条件。第一个 handoff：state=draining → transferring，epoch E→E+1。第二个 handoff 在第一个完成 1ms 后启动：epoch E+1→E+2。如果第三个 handoff host1→host2 再次发起，epoch 回到 E+3 但 host 又回到 host1 |
| **期待不变量** | 每次 handoff 产生唯一递增 epoch。E+1、E+2、E+3 的 handoff_id 各不相同（UNIQUE 约束）；没有 ABA 问题 — 因为 holder_id 虽然回到了 host1，但 epoch 是 E+3 不是 E+1 |
| **超时** | CAS 超时 10s |
| **通过证据** | `owner_leases` 中该 owner 的 epoch 严格递增；handoff_id 序列无重复 |
| **清理方式** | 正常 handoff 完成，不需要清理 |
| **安全边界** | D6 gate 规范：影响零行的旧 epoch CAS 整体事务回滚。此场景正常通过，因为 handoff 是 CAS 驱动的 |

### F-13: 部署期间旧 writer 未 fence + 玩家请求通过旧 writer 写入

| 属性 | 值 |
|---|---|
| **注入点** | `deploy.sh` 执行 `pm2 restart` 阶段。旧 server 进程仍在处理请求，新 server 进程同时启动并监听同一端口 |
| **故障模型** | 端口争用 / 双写。PM2 restart 使用 `--update-env` 但没有 kill timeout。如果旧进程的 inflight 请求在 SQLite write lock 上（`better-sqlite3` 串行化），新进程可能立即获得端口并 accept 新请求 |
| **期待不变量** | 在 deployment 切换窗口内：要么旧 writer 完成所有 inflight 事务，要么旧 writer 的事务被拒绝且新 writer 获得独占写入权；没有事务被重复执行（两个 writer 各执行同一 commandId 一次） |
| **超时** | PM2 kill_timeout 5000ms；ready 后 3000ms 内完成健康检查 |
| **通过证据** | 部署后对账 `command_receipts` 确认无重复 commandId 且无残留 in_progress 状态 |
| **清理方式** | Guardian 扫描 in_progress receipts（如有） |
| **安全边界** | 当前实现没有 writer fencing — 完全依赖 PM2 的进程管理。v2.2 规范要求 fencing 但未实现 |

### F-14: 备份进程与活跃写入并发

| 属性 | 值 |
|---|---|
| **注入点** | `backup-runtime-state.sh` 执行 `better-sqlite3` online backup（`db.backup()`）的同时，world worker 正在执行一个多 owner 事务 |
| **故障模型** | 并发访问。Online backup API 与 WAL mode 并发安全，但备份 snapshot 可能不包含在备份开始后才提交的事务 |
| **期待不变量** | 备份包含一个一致性点（consistent point-in-time snapshot）；备份中的 `command_receipts`、领域状态和 `stream_events` 互相一致（同属一个提交点） |
| **超时** | 备份超时 300s |
| **通过证据** | 从备份恢复到隔离环境后执行 integrity check → checksum matched；receipt 与 domain state 一致 |
| **清理方式** | 正常备份完成，对备份执行 verify（`verify-runtime-backup.sh`） |
| **安全边界** | 备份中不能有半完成的事务数据页 — `db.backup()` API 保证此不变量 |

### F-15: 容量合同、release manifest、restore evidence 三元 digest 链伪造

| 属性 | 值 |
|---|---|
| **注入点** | 攻击者伪造一份容量合同 JSON 文件，其中 `release.manifestDigest` 指向已签名的合法 release manifest，但 `evidence.*` digest 指向空文件或伪造的 trace/metrics |
| **故障模型** | 摘要链不完整。合同引用 release manifest 的 digest 是正确的，但 evidence digest 链中的 artifact 不存在或内容不符合其 digest |
| **期待不变量** | 判定器 (§判定器规范 4 节) 重新读取每个 artifact，计算 digest，与合同中的声明值比较；任何不可读取或 digest 不符的 → 整体 NOT_PROVEN；不信任合同中的声明 digest |
| **超时** | 判定器运行超时 600s |
| **通过证据** | 判定器输出 `NOT_PROVEN`，原因码包含 `EVIDENCE_ARTIFACT_DIGEST_MISMATCH` 或 `EVIDENCE_ARTIFACT_UNREADABLE` |
| **清理方式** | 拒绝伪造合同；不基于伪造合同做任何容量或 release 决策 |
| **安全边界** | 判定器规范 (§判定器 4 节) 已要求独立读取和 digest 重算 — 此不变量在规范层面已闭合。实现时不能再信任输入 digest |

### F-16: PM2 配置无 graceful shutdown 等待 — handoff 中途重启

| 属性 | 值 |
|---|---|
| **注入点** | `pm2 restart server --update-env` 发送 SIGINT 给 world-worker。worker 正在处理一个涉及 5 owner 的 march.start 事务中期 |
| **故障模型** | 进程 kill（SIGINT → SIGKILL after kill_timeout）。worker 的 `shutdown()` (world-worker.js:108) 调用 `worker.stop()` 后立即 `process.exit(0)`，不等待 stop 完成 |
| **期待不变量** | `worker.stop()` 完成当前 tick 中的所有命令（通过 `CommandExecutionPipeline`），graceful shutdown 在 30s timeout 内完成；如超时则 force kill 但要记录 partial completion 到 outbox |
| **超时** | graceful shutdown timeout 30s；force kill 后 guardian 通过 60s lease timeout 回收 |
| **通过证据** | 重启后 `command_receipts` 无残留 `in_progress`（guardian 已回收）；如果有 `in_progress`，guardian 在 120s 内处理 |
| **清理方式** | Guardian 回收过期 receipt |
| **安全边界** | 当前 `world-worker.js:108-115` 不等待 worker.stop() 完成，且 PM2 有隐式的 kill_timeout 默认值。如果在 mid-tick 时杀进程，数据库一致性由 SQLite WAL 保护（非安全边界破坏），但 inflight 收据管理不完整 |

---

## 9. REQUIRED_SPEC_AND_RUNBOOK_REVISIONS

### 9.1 规范必须修正的缺陷 (SPEC 级别)

| ID | 位置 | 缺陷 | 推荐修正 | 优先级 |
|---|---|---|---|---|
| SPEC-REL-01 | §06 restore state machine | "Every step declares executor, idempotency guard, timeout, evidence digest, retry/rollback action and next-step CAS" 但未提供任何一步的具体声明 | 为 9 个 restore 步骤各提供至少幂等 guard SQL 模板和 next-step CAS WHERE 子句 | **BLOCKING** |
| SPEC-REL-02 | §03 restore_runs 表定义 | 无双例约束防止并发 restore coordinator | 增加 admission guard: `WHERE NOT EXISTS (SELECT 1 FROM restore_runs WHERE status NOT IN ('RESTORE_BLOCKED','TRAFFIC_REOPENED'))` | **BLOCKING** |
| SPEC-REL-03 | §06 restore 语义 | 未定义 restore guardian（崩溃后谁回收过期 execution_token） | 新增 restore guardian 角色定义、扫描间隔、token CAS 语义 | **BLOCKING** |
| SPEC-REL-04 | §06 secrets + identity | "按 endpoint 定义缓存旧凭据、只读降级或 fail closed" 但没有具体分类表 | 新增 §06 附录：secret 分类矩阵（类型 × endpoint 类 × outage 行为 × 缓存 TTL） | **BLOCKING** |
| SPEC-REL-05 | §04 / §06 release manifest | signer key rotation 协议未定义：信任根切换、撤销窗口、已部署 manifest 的有效性规则 | 新增 signer key lifecycle：activation date、rotation overlap、revocation effect on deployed manifests | **BLOCKING** |
| SPEC-REL-06 | §06 restore step `RECEIPTS_JOBS_SAGAS_RECONCILED` | 未定义 reconciliation 的具体 SQL 和处理规则 | 为每种状态（in_progress receipt、leased job、mid-flight Saga）提供 reconciliation SQL 模板 | **HIGH** |
| SPEC-REL-07 | §06 restore step `TRAFFIC_REOPENED` | "signed authorization" 未定义签名 payload、验证公钥来源、拒绝行为 | 定义 TRAFFIC_REOPENED token 格式：JWT with claims (restore_id, authorized_at, signer_id, evidence_chain_digest) | **HIGH** |
| SPEC-REL-08 | §06 durability profile | 声明了逐存储的耐久性保证但没有逐场景的具体确认点 | 按 crash/power loss/disk failure/replica failover 四种场景定义 "ACK 只在此点后返回" 的具体条件 | **MEDIUM** |
| SPEC-REL-09 | §06 migration recovery | "不可逆 migration 检测异常后的决策" 未定义 | 新增 "irreversible migration failure" 决策树：stop-at-current-phase vs forward-fix vs accept-loss | **MEDIUM** |

### 9.2 Runbook 必须补充的操作流程

| ID | Runbook 条目 | 覆盖场景 | 优先级 |
|---|---|---|---|
| RUN-REL-01 | Restore coordinator 崩溃恢复 | 操作员发现 restore 停滞时如何判断 coordinator 已崩溃、如何启动新 coordinator（含 CAS token 接管命令） | **BLOCKING** |
| RUN-REL-02 | Writer fencing 验证检查表 | 部署前、恢复前、failover 前如何逐个检查所有 writer 已被 fence：owner_leases 查询、scheduler 状态、relay 状态、旧 primary 状态 | **BLOCKING** |
| RUN-REL-03 | Secret rotation 逐 endpoint 操作手册 | 轮换 JWT/OPS/DB/ApiKey 时各 endpoint 的暂停顺序、验证步骤、回滚条件 | **BLOCKING** |
| RUN-REL-04 | 磁盘满 / WAL 不收敛应急 | 如何紧急启用只读模式、如何 checkpoint WAL、如何暂停 relay、如何在恢复后重新启用写入 | **HIGH** |
| RUN-REL-05 | Audit store full escalation | 审计存储满时的降级路径、合规报告模板、恢复操作 | **HIGH** |
| RUN-REL-06 | Release signer key compromise | 标识被泄露 manifest 列表、逐 manifest 重签命令、通知受影响的部署环境 | **HIGH** |
| RUN-REL-07 | 容量合同 evidence digest 链完整性自检 | 判定器运行后如何验证 evidence chain 未被篡改、如何重新哈希 artifact 确认 | **MEDIUM** |

---

## 10. IMPLEMENTATION_GAP_APPENDIX

严格与规范缺陷分开 — 以下均为规范要求已定义但当前代码未实现的项目：

| ID | 规范引用 | 差距描述 | 当前代码证据 | 迁移路线图映射 |
|---|---|---|---|---|
| IMPL-GAP-01 | §03 owner_leases, C6 gate | 无 placement epoch / owner lease 表 / 数据库 fencing | `GameStateRepository` 没有 `owner_leases` 表；`world-worker.js` 启动时不声明 holder_id | M2 |
| IMPL-GAP-02 | §03 restore_runs, R6 gate | 无 restore coordinator / restore_runs 表 / 10 步状态机 | `restore-runtime-state.sh` 只有 tar + cp + pm2 restart，无状态机 | M7 |
| IMPL-GAP-03 | §01 D1 gate | 命令 receipt 终态与领域写入不在同一事务 | 迁移路线图已确认：`CommandCommitter.js:50` 先持久化领域状态，`:110` 再单独写结果 | M1 |
| IMPL-GAP-04 | §06 writer fencing | 部署 / 恢复前不 fence writer | `deploy.sh` 没有 epoch CAS 操作；`restore-runtime-state.sh` 只用 `pm2 stop` | M2/M7 |
| IMPL-GAP-05 | §06 durable stream + outbox | 无 stream_events / outbox_events / consumer_cursors 表 | 数据库中没有对应的表定义 | M4 |
| IMPL-GAP-06 | §06 scheduled job lease | 无 scheduled_jobs 表 / scheduler lease | `WorldWorkerService` 直接推进游戏 tick，不经 scheduled_jobs 表 | M4 |
| IMPL-GAP-07 | §06 Saga | 无 saga_instances / saga_steps / saga_reservations 表 | 数据库中没有对应的表定义 | M6 |
| IMPL-GAP-08 | §06 immutable release manifest | 无 release_manifests 表 / 签名 / manifest digest | 当前用 `deploy.sh` + git commit hash 代替；没有 build-once 制品 | M0/M7 |
| IMPL-GAP-09 | §05 容量合同 | 无容量合同生成器 / 判定器 | 没有 `slg-capacity-v2.2` 证据生成脚本或 evaluator 实现 | M7 |
| IMPL-GAP-10 | §06 economy ledger | 无 economy_journals / economy_ledger_entries 表 | 数据库中没有对应的表定义 | M6 |
| IMPL-GAP-11 | O1 gate | 健康检查缺少 owner lease/epoch、scheduler lag、outbox/event lag、磁盘、证书、restore lag | `server.js:207-257` `/api/health` 仅返回 config/presence/observability 摘要 | M7 |
| IMPL-GAP-12 | §06 expand-migrate-contract | 无跨版本兼容矩阵 / migrate phase 政策 | `SchemaMigrationService` 有 migration id/checksum/lock 但没有 expand-migrate-contract 框架 | M3 |
| IMPL-GAP-13 | §03 release_manifests 表 | 无持久化的 release manifest 存储 | 部署信息存于 JSON 文件（`current-deploy.json`），不在数据库中 | M0/M7 |
| IMPL-GAP-14 | §04 session epoch / refresh rotation | 无 credential_version/session_epoch/authz_epoch 状态机 | `AuthService` 使用简单 JWT 验证，无不区分三类 epoch 的细粒度撤销 | M5 |
| IMPL-GAP-15 | §06 durability profile | 未按 crash/power loss/disk failure 分类声明耐久性 profile | 没有 durability profile 文档或测试 | M7 |
| IMPL-GAP-16 | W1/W2/W3/W7/W8 workload gate | 无容量压测框架实现 | 没有 workload generator，没有 per-stage 的 arrival/service/queue 测量 | M7 |

---

## 总结

```
RELIABILITY_V2_2_VERDICT          = NOT_PROVEN
SPEC_CONTRADICTIONS               = 1 (restore step declarations)
UNDER_SPECIFIED                   = 8 (coordinator singleton, restore guardian, endpoint classification,
                                     signer key rotation, reconciliation, traffic reopen auth, irreversible
                                     migration, stream replay)
IMPLEMENTATION_GAPS               = 16 (全部)
BLOCKING_SPEC_FIXES               = 5 (SPEC-REL-01..05)
BLOCKING_RUNBOOK_CREATIONS        = 3 (RUN-REL-01..03)
FAILURE_INJECTION_SCENARIOS       = 16 (F-01..F-16)
```

规范的可靠性语义框架（fencing CAS、epoch 递增、lease token、immutable manifest digest）方向正确，但在 restore coordinator 的执行语义、secret outage 分类和 signer key lifecycle 三个维度有结构缺陷。R6 gate 的要求 "release/restore 具有持久 run、唯一执行租约、逐步幂等 guard、超时、证据 digest、信任根和显式流量重开授权" 在 restore 部分仅完成了名词声明，尚未提供任何可执行 SQL 或协议细节。

当前实现在可靠性维度上完全空白 — 没有任何规范定义的 restore/protection/release 机制已实现。这不是规范被降低了，而是所有机制都在 M1..M7 路线图中按依赖序排列。16 个 IMPLEMENTATION_GAP 表明距离最基本的 reliability rehearsal 还有完整的 M0-M7 迁移路程。
