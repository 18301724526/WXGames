# 成熟 SLG 后端 v2.3 — 可靠性工程对抗审查报告（第四轮·DeepSeek 可靠性席）

**席位**: 可靠性工程、灾难恢复、发布系统、基础设施安全、runbook 红队
**审查日期**: 2026-07-15
**审查范围**: wxgame 参考架构 v2.3 + 当前实现代码
**输入**: `成熟SLG后端参考架构-v2.3.html`、`容量合同-v2.3.schema.json`、`容量合同判定器规范-v2.3.md`、`当前实现迁移路线图-v2.3.md`、以及 deploy/backup/restore/migration/PM2/health/secret/worker shutdown 代码

---

## 1. RELIABILITY_V2_3_VERDICT

```
REFERENCE_V2_3_RELIABILITY_VERDICT = NOT_PROVEN (UNDER_SPECIFIED × 7, SPEC_CONTRADICTION × 0, IMPLEMENTATION_ONLY_GAP × 14)

CURRENT_IMPLEMENTATION_RELIABILITY = NON_CONFORMING
```

**裁决理由**：

v2.3 规范在恢复、流续传、密钥生命周期和签名认证方面的设计语义正确且可审计。但以下 7 个执行细节属于 UNDER_SPECIFIED（规范声明了"应做什么"但未声明"如何验证/从哪取值/失败后路径"），导致独立的可靠性席无法判定其实现等价：

1. **seq 不重用规则的证据来源**（§4.1/FL-38）：规范称"恢复后分配起点 ≥ 崩溃前最大已发布 seq+1"且"取自 relay/consumer acked evidence"，但未指定该值的确定性发现算法——当消费者证据不可得时的降级路径不存在。
2. **restore step guard 与 CAS 的原子边界**（SPEC-REL-01）：逐步幂等守卫描述为"present → skip, absent → execute"，但守卫求值与 next-step CAS 之间的 TOCTOU 窗口未闭合。
3. **restore takeover 授权 token schema**：规范提及"successor must present signed restore authorization"但仅定义了 TRAFFIC_REOPENED token 结构，restore takeover 的授权载荷无 schema。
4. **TRAFFIC_REOPENED token 过期与单次使用**：token 仅有 issuedAt 无 expiresAt，无 nonce 或单次使用机制。
5. **密钥撤销后 rollback 目标重签名的制品一致性**：重新签名是否改变 manifest digest？若改变，旧 releaseId 与新 digest 之间如何建立等价性？
6. **只读兜底模式的行为契约**：server 端启动校验 TRAFFIC_REOPENED token 失败后进入 read-only mode，但哪些端点可用、返回什么错误码、对外部 consumer 的语义均未规定。
7. **PITR cut 时刻与 consumer acked_seq 的时钟对齐**：需要比对"崩溃前最大已发布 seq"但 restored DB 只有 T1 时刻的数据，T1→T2 之间的 seq 区间信息存在于 consumer/relay 外部证据中——但规范未定义"最大已发布 seq"的发现是取 max(relay.published_seq, consumer.acked_seq) 还是仅取 consumer.acked_seq。

当前实现存在 14 个 IMPLEMENTATION_ONLY_GAP（缺表/缺组件，不得反向降低规范标准），详见 §11。

未发现 SPEC_CONTRADICTION：v2.3 规范内部无不兼容的强制要求。

---

## 2. V2_3_PATCH_CLOSURE_REVIEW（逐焊点裁决）

### 焊点 A: restore_runs 单例准入（原 SPEC-REL-02）

**规范声明**:
```sql
INSERT INTO restore_runs (...) SELECT ... WHERE NOT EXISTS (
  SELECT 1 FROM restore_runs WHERE status NOT IN ('COMPLETED','ABORTED'));
CREATE UNIQUE INDEX restore_runs_single_nonterminal ON restore_runs ((true))
  WHERE status NOT IN ('COMPLETED','ABORTED');
```

**裁决: PASS（语义正确但需补 isolation 声明）**

双重防御（admission guard + 部分唯一索引）在典型部署中足够。详细攻击分析：

| 隔离级别 | 两个并发 INSERT 行为 | 裁决 |
|-----------|----------------------|------|
| READ COMMITTED | 两者都可能看到空集通过 WHERE NOT EXISTS；第二个在唯一索引上失败（UNIQUE constraint violation） | admission guard 返回 0 rows（干净拒绝）与 unique violation（约束错误）的失败语义不同。调用方需要处理两种错误码，但二者均阻止第二个 run 创建。**可接受**，但规范应声明调用方必须将两种失败都视为"已有进行中 restore"并返回既存 run_id。 |
| REPEATABLE READ / SERIALIZABLE | 第一个 INSERT 成功后第二个的 WHERE NOT EXISTS 子查询看到已插入行，返回 0 rows 干净拒绝。 | 语义一致。 |
| SQLite (当前实现) | SQLite 支持部分唯一索引（3.8.0+），但表达式索引 `((true))` 为常数索引键——所有非终态行共享同一键值，UNIQUE 确保只插入一行。SQLite 的默认隔离是 SERIALIZABLE（单写者），并发 INSERT 由 busy_timeout 或 SQLITE_BUSY 序列化。 | 单写者 SQLite 下不会并发，但规范面向 PostgreSQL 部署时必须声明隔离级别。 |

**未闭合项**:
1. 规范未声明 admission guard 失败时返回既存 run_id 的幂等路径。若调用方根据错误类型分支，unique violation 分支可能未正确提取 run_id。
2. 如果既存非终态 run 在调用方收到 run_id 后变为 COMPLETED/ABORTED（被动收敛），调用方持有的 run_id 引用了一个已终态的 run。规范未规定此场景。

> **建议修订**: 在 restore_runs 规范中增加：admission guard 返回 0 rows 时，coordinator 必须 `SELECT restore_id FROM restore_runs WHERE status NOT IN ('COMPLETED','ABORTED')` 获取当前非终态 run_id，并在后续操作中验证该 run 仍为非终态。UNIQUE constraint violation 错误应与 admission guard 失败走同一恢复路径。

---

### 焊点 B: 九步幂等 guard + next-step CAS WHERE 模板（原 SPEC-REL-01/03）

**规范声明**:
```sql
UPDATE restore_runs SET current_step = :next_step, evidence_digest = :chained_step_digest
WHERE restore_id = :restore_id AND current_step = :this_step
  AND execution_token = :token AND lease_until > statement_timestamp() AND status = 'RUNNING';
```

**裁决: PASS（模板正确）但有 TOCTOU 隐患**

逐步检查 9 个 step 的幂等守卫：

| Step | 守卫谓词 | 可执行性 | 裁决 |
|------|----------|----------|------|
| WRITERS_FENCED | 所有 owner_leases epoch 已达 fence 值（epoch CAS 幂等） | 可执行：重跑 epoch CAS 影响 0 行即通过 | PASS |
| SCHEDULERS_AND_RELAYS_STOPPED | 无活 scheduler/relay lease | 可执行：扫描 scheduled_jobs/outbox_events 的活跃 lease | PASS |
| DATA_RESTORED | 目标 restore label/checksum 已存在 | 可执行：比对文件/DB checksum | PASS |
| INTEGRITY_VERIFIED | recorded step evidence_digest 已存在 | 可执行 | PASS |
| STREAMS_REPLAYED | recorded step evidence_digest 已存在 | 可执行 | PASS |
| RECEIPTS_JOBS_SAGAS_RECONCILED | recorded step evidence_digest 已存在 | 可执行 | PASS |
| GAMEPLAY_SMOKE_PASSED | recorded step evidence_digest 已存在 | 可执行但 smoke 测试可能有外部副作用 | **注意** |
| NEW_OWNER_EPOCHS_ISSUED_BY_CAS | epoch CAS 已执行（影响 0 行即通过） | 可执行 | PASS |
| TRAFFIC_REOPENED | recorded step evidence_digest 已存在 + reopen token 验签 | 可执行（token 验签属一步内的子步骤） | PASS |

**TOCTOU 窗口**：守卫求值与 next-step CAS 之间缺少原子性保证。若守卫求值通过后、CAS 执行前，另一个 coordinator 接管（CAS 了 execution_token），则可能双写。需要规范明确：**守卫求值与 next-step CAS 必须在同一数据库事务中执行**。

**接管主体闭环**：规范要求 "successor must present its own signed restore authorization"，但该授权没有定义 payload schema（仅定义了 TRAFFIC_REOPENED token）。若接管授权与 reopen 授权共用同一 token 格式，需要声明。

> **建议修订**: 增加 "每步的 idempotency guard 求值、step 执行和 next-step CAS 在同一数据库事务中原子完成"。定义 restore authorization token 的独立 schema（含 coordinator_id、restore_id、issued_at、expires_at、signer_key_id、signature）。

---

### 焊点 C: seq 不重用规则（原 §4.1/FL-38）

**规范声明**:
> 恢复后 stream seq 分配起点 ≥ 崩溃前最大已发布 seq+1，禁止 seq 重用。该值取自 relay/consumer acked evidence，NEVER from restored head。

**裁决: UNDER_SPECIFIED（关键证据来源未定义完整发现算法）**

核心问题：PITR 恢复到 T1 后，DB 中 stream_heads.committed_seq = T1 时刻的值。崩溃发生在 T2，T1→T2 之间的 seq (N+1..M) 在 restored DB 中不存在。"崩溃前最大已发布 seq" = M，但 M 在哪？

**证据来源分析**:

| 来源 | 可达性 | 可信度 | 问题 |
|------|--------|--------|------|
| restored DB stream_heads | 可直接读取 | **不可信**（仅到 T1） | 规范明确禁止。正确。 |
| consumer_cursors.acked_seq | 在被恢复的 DB 中 | **不可信**（仅到 T1） | 同 restored DB —— consumer_cursors 也被回退了。 |
| 外部 consumer 独立存储的 acked_seq | 需外部查询 | 可信 | 如果 consumer 的 acked_seq 持久化在独立存储中（非同一个被恢复 DB），则该值可用。但规范未区分"DB 内 consumer_cursors"与"外部 consumer 持久化"两种情形。 |
| relay/outbox 外部日志 | 需外部查询 | 部分可信 | relay 的 published_at 不是 durability 保证——消息可能发布后 crash 未 fsync。 |
| WAL / binlog 归档 | 若有独立归档 | 可信 | PITR 工具（如 WAL-G）可能保留了 T1→T2 的 WAL 段。但规范未提及此来源。 |
| 客户端已接收事件的最大 seq | 需客户端上报 | 弱可信（客户端可能丢包） | 只能作为交叉验证的上界。 |

**核心 UNDER_SPECIFIED 项**:

1. **发现算法未定义**: 规范说"取自 relay/consumer acked evidence"但未指定是取 max(所有来源)还是仅取 consumer_cursors。若 consumer_cursors 与 DB 同库且也被恢复到 T1，则其值也是 T1 时刻的值，不能用于发现 M。

2. **证据不可得时的降级路径缺失**: 当所有外部 consumer 都不可达或未保留 acked_seq 持久化时，M 本质上不可知。规范不回答此时是否可以 seq 重用、是否可以降级到"从 restored head + 安全间隙 N 开始"。

3. **"最大已发布 seq"的定义歧义**: 是 max(stream_events.stream_seq WHERE committed_at <= T2) 还是 max(outbox_events.stream_seq)？规范未区分"已发布"(published)和"已提交"(committed)。在 stream 语境中，seq 在 COMMIT 时分配，在 relay 发送时为"已发布"——两者之间可能存在 crash 窗口（已提交 seq N+1 但 relay 未发送）。

4. **divergence 清单的阻塞语义闭环**: 规范讲 "divergence 非空即 TRAFFIC_REOPENED 被阻塞，只能走 escalated/manual 升级路径"。但"手动升级"的具体操作（回退 consumer cursor？重建 projection？标记该 consumer 为 diverged 并允许 reopen？）均未定义。

> **建议修订**: 增加 §4.1 子节"最大已发布 seq 的确定性发现算法"：(a) 收集所有外部 consumer 独立存储的 acked_seq；(b) 收集所有 relay/outbox 外部持久化的 max(stream_seq)；(c) max_published = max((a), (b))；(d) 若 (a) 和 (b) 均不可得，RESTORE_BLOCKED 且 REASON=SEQ_ORIGIN_UNKNOWN。增加 divergence 手动收敛 runbook 模板（SOP-DIVERGENCE-01）。

---

### 焊点 D: TRAFFIC_REOPENED 签名 token（原 SPEC-REL-07）

**规范声明**:
```json
{
  "restoreId": "res-...",
  "evidenceChainDigest": "sha256:...",
  "issuedAt": "2026-07-14T...",
  "signerKeyId": "restore-root-2026-q3",
  "signature": "base64:..."
}
```

**裁决: PASS（结构足够）但有 3 个 UNDER_SPECIFIED 缺口**

**攻击面分析**:

| 攻击 | 当前防御 | 裁决 |
|------|----------|------|
| token 重放到另一个 restore | restoreId 绑定——但仅当 restore_runs 的 COMPLETED 状态不可逆时有效。若 restore_runs 行被物理删除（运维误操作），token 可被重放。 | 需增加 DB 层面的 token 消费记录。 |
| token 重放到同一 restore 第二次 | restore_runs 已是 COMPLETED，server startup 校验时发现不是最新 restore → 拒绝。 | PASS（前提：restore_runs 行不可删除） |
| token 篡改 evidenceChainDigest | 签名验签失败 → 拒绝。 | PASS |
| token 在另一台服务器上使用 | token 不含 server/environment identity。一个有效的 token 可跨环境使用。 | **UNDER_SPECIFIED**：需增加 `environmentId` 或 `serverIdentity` 绑定字段。 |
| token 无限期有效 | 仅有 issuedAt 无 expiresAt。 | **UNDER_SPECIFIED**：长期有效的 reopen token 增加泄露风险窗口。 |
| 启动时 trust root 不可达 | 规范声明"trust root 独立于运行目录"——若 secret manager 不可达，签名验签阻塞 server 启动。 | **UNDER_SPECIFIED**：只读兜底模式下对外暴露的错误码、可用端点和降级策略未定义。read-only mode 是否允许健康检查？是否允许 status query？是否回绝所有 POST？ |

**server 端启动校验的只读兜底路径**：

当前规范 "Missing or invalid token → server stays in read-only mode (fail-closed); no operator flag can bypass this check" 是正确的安全设计，但缺少操作契约：
- read-only mode 下 client 能否查询 command status？能否建立 WebSocket 接收 push（但不接受 command）？
- read-only mode 下外部 consumer 是否继续消费事件？若继续消费，consumer acked_seq 会前进，可能与未完成的 restore 产生新的 divergence。
- health check 在 read-only 模式下返回什么状态码？应为 503（Service Unavailable）而非 200。

> **建议修订**: (1) token 增加 `environmentId`、`expiresAt` 字段。(2) 定义 read-only mode 的操作契约：返回 503 的端点列表、允许的只读端点列表、consumer 是否暂停。(3) 增加 `restore_reopen_tokens` 表记录 token consumption，防重放。

---

### 焊点 E: signer key lifecycle（原 SPEC-REL-05）

**规范声明**:
> revocation: a revoked key immediately blocks NEW switch/rollback/reopen decisions; already-running instances keep running but their manifests must be re-signed within the declared grace window or the release becomes ineligible for re-selection. Rollback targets signed by the revoked key must be re-signed BEFORE the rollback path is considered available.

**裁决: PASS（安全语义正确），但有 1 个关键的运营死角**

**攻击面分析**:

| 场景 | 分析 | 裁决 |
|------|------|------|
| 密钥泄露 → 撤销 → 攻击者用该密钥签假 manifest 做 rollback | 撤销立即阻止新 rollback 决策。 | PASS |
| 运行中实例的 manifest 用已撤销密钥签名 → 实例 crash → 无法重启 | 若 crash 发生在 grace window 内且未重签名，实例无法重启。这是正确的安全行为（fail-closed），但 runbook 必须明确此路径。 | PASS（需 runbook 覆盖） |
| 密钥撤销后 rollback 目标 (vN-1) 需要重签名 | 重签名是否改变 manifest digest？ | **UNDER_SPECIFIED** |
| 新旧密钥 overlap 窗口耗尽（新密钥部署延迟） | 旧密钥到期、新密钥未部署到所有 trust store → 正当 manifest 验证失败。 | **操作风险** |

**核心 UNDER_SPECIFIED 项: 重签名与 manifest digest 的矛盾**：

规范声明 manifest 是 immutable 的（"manifest 不可变且验签"）。但密钥撤销后 rollback 目标必须重签名。重新签名意味着 `signature` 字段改变 → `release_manifests.signature` 改变 → manifest 行的 hash 改变 → 如果 manifest digest 包含 signature 字段，则重签名后的 digest 与原始记录不一致。

现有规范中 `release_manifests` 表有 `artifact_digests` 列（固定后端/前端/config/schema/protocol/event schema 的 hash）和独立的 `signature` 列。这意味着 **artifact digest 不包含 signature**。重签名只需更新 `signature` 和 `signer_key_id` 列，artifact_digests 不变。但这需要规范明确声明 `release_manifests` 表的 `artifact_digests` 与 `signature` 的独立性——目前只在 §03 表目录中描述了 schema，未在恢复规范中明确。

**当前实现的附加死角**：

当前代码没有 `release_manifests` 表，没有签名密钥管理。`deploy.sh` 通过 git commit hash 标识版本，没有不可变 manifest 或签名。Secret rotation（`rotate-production-secrets.sh`）直接修改 `.env` 文件，没有密钥版本控制或重叠窗口。

> **建议修订**: (1) 在恢复规范中明确 `release_manifests` 的 `artifact_digests` 与 `signature`/`signer_key_id` 独立：重签名不改变 `artifact_digests`。(2) 增加密钥轮换 SOP：新密钥的 trust root 部署必须在新密钥 `not_before` 之前完成，旧密钥 trust root 移除必须在旧密钥 `not_after` 之后。(3) 增加 rollback 路径可用性检查清单：rollback 前验证目标 manifest 的 signer key 当前有效。

---

## 3. CONFIRMED_CLOSURES

以下 v2.3 修订经独立分析确认有效闭合：

| 原问题 | v2.3 修订 | 闭合确认 |
|--------|----------|----------|
| handoff 缺少最终 fencing 谓词明文 | FL-01: 增加明文 `state='active' OR (state='draining' AND handoff_id=:hid AND statement_timestamp()<drain_deadline)` | **闭合**。谓词完整，覆盖 active/draining 两态，含 deadline 断言。 |
| handoff committed_watermarks 记录位置不明确 | FL-01: placement 在 handoff CAS 同一事务内从 stream_heads 原子记录 | **闭合**。新 holder 只能从该记录值接管的约束明确。 |
| restore 缺少执行语义 | §06: 增加 9 步状态机 + 每步幂等守卫 + next-step CAS | **闭合**。步骤定义完整，FAIL→RESTORE_BLOCKED 路径明确。 |
| PITR 恢复后可能 seq 重用 | FL-38: 增加 seq 不重用规则 + divergence 清单阻塞 TRAFFIC_REOPENED | **部分闭合**。规则正确但证据来源发现算法 UNDER_SPECIFIED（见焊点 C）。 |
| 缺少 restore 单例准入 | FL-32: 增加 admission guard + 部分唯一索引双保险 | **闭合**。详见焊点 A。 |
| 撤销语义不完整 | FL-13: 三类 epoch 快照进 receipt + 受管制命令 commit 点 epoch 复核 | **闭合**。授权线性化点明确，受管制命令二次校验。 |
| refresh family 未定义设备语义 | §04: per-device refresh_family_id + rotation CAS | **闭合**。撤销半径正确（单设备 vs 全账号）。 |
| dedupe_key 作用域不明确导致无关 saga 阻塞 | FL-06: UNIQUE(realm_id, saga_id, dedupe_key) | **闭合**。 |
| 账务结构不完整 | FL-07: 独立 fx_snapshots 表 + fee/tax/rounding account_class | **闭合**。 |
| 客户端 pending commandId 跨崩溃丢失 | FL-16: 要求客户端本地持久化 | **闭合**。但属客户端规范，不在本席审查范围。 |
| capacityProfile 可被自选绕过 | IC-5: manifest-anchored mandatory profile | **闭合**。evaluator 逐清单求差集，覆盖为零合同必然 NOT_PROVEN。 |
| SUBSCRIPTION_INVALIDATED 控制事件 | FL-18: in-band 控制事件 | **闭合**。活性与缓存卫生要求，不是泄漏门禁。 |

---

## 4. COORDINATOR_FENCING_AND_HANDOFF_ATTACKS

### 4.1 当前实现的 fencing 缺口

当前 `OwnerLockRepository`（`backend/repositories/OwnerLockRepository.js`）使用进程内同步锁 + SQLite `owner_locks` 表，TTL 30s。**这不是 epoch-based fencing**：

1. **无 epoch 单调性**: `owner_locks` 表没有 `owner_epoch` 列。锁的持有仅通过 `holderId`（`pid-randomUUID` 格式）标识，不以 epoch 版本化。
2. **无 handoff 状态机**: 无 `draining`、`transferring`、`active` 状态。锁只有 `lockedAt`/`expiresAt` 时间维度的二态。
3. **过期锁抢占 = 非原子**: `_tryAcquire()` 使用 `INSERT ... ON CONFLICT DO UPDATE WHERE expiresAt <= lockedAt`，但新 holder 可以静默抢占过期锁，旧 holder 不感知被 fence。
4. **数据库行锁未用于 fencing**: 领域写入不持有 `owner_locks` 行锁至 COMMIT。`CommandCommitter` 仅在 commit 前验证锁存在（`backend/application/commands/CommandCommitter.js:33-38`），而非在事务内 SELECT FOR UPDATE。

### 4.2 Handoff 线性化点攻击

规范要求的 handoff CAS 线性化点：
```
UPDATE owner_leases SET epoch=epoch+1, holder_id=:new, state='transferring', ...
WHERE epoch=:observed AND state='draining' AND handoff_id=:hid
RETURNING owner_epoch; -- assert affected_rows=1
```

**未实现**: 当前代码没有 `owner_leases` 表，没有 placement authority，没有 handoff_id 生成和 tracking。`OwnerLockRepository` 的交错模式（尝试获取 → 失败则轮询 + 抢占过期锁）不符合单行 CAS 语义——CAS 要求"一枪定胜负"而非重试。

### 4.3 攻击场景

**ATTACK-FENCE-01: 过期锁抢占窗口的 split-brain**
- 旧 holder 的锁 TTL 30s 到期，但旧 holder 仍在执行长事务
- 新 holder 通过 `ON CONFLICT DO UPDATE WHERE expiresAt <= lockedAt` 抢占锁
- 旧 holder 的事务在 commit 时检查 `owner_locks` 存在（`CommandCommitter:36`），但锁已被新 holder 替换
- 当前代码中 `_tryAcquire` 修改的是同一 `ownerKey` 的锁行——旧 holder 的锁被更新为新 holder 的 holderId 和 expiresAt
- 旧 holder 的 commit 验证会发现 `holderId` 不匹配 → 拒绝写入 ✓
- 但这个拒绝仅依赖于 commit 前的非原子检查，而非数据库行锁

**ATTACK-FENCE-02: 部署期间 PM2 restart 的 fencing 窗口**
- `deploy.sh` 使用 `pm2 restart`（`deploy.sh:955`）重启进程
- PM2 restart 的默认行为是 kill 旧进程然后启动新进程（无优雅 drain）
- 旧进程可能有 in-flight 命令在 `begin()` 后（idempotency store 写入了 `in_progress`）但未 commit
- 新进程启动后不检查旧进程的残留 `in_progress` 记录（没有 recovery guardian）
- 残留的 `in_progress` 命令永远停留在该状态，客户端重试收到 `COMMAND_IN_FLIGHT` 响应（`CommandIdempotencyStore.js:140`）
- 当前没有机制将过期 in_progress 收敛为终态

### 4.4 裁决

```
COORDINATOR_FENCING_VERDICT = IMPLEMENTATION_ONLY_GAP (no epoch-based fencing, no handoff state machine, no placement authority)
```

当前 `OwnerLockRepository` 提供的进程锁是必要的并发控制但不是规范的 epoch fencing。M2（placement CAS + owner fencing + handoff）是下一个迁移阶段，当前代码不具备被审查的基础。

---

## 5. DURABILITY_PITR_AND_STREAM_CUT_ATTACKS

### 5.1 当前备份/恢复的 durability 缺口

**备份机制**（`scripts/backup-runtime-state.sh`）:
- 使用 `better-sqlite3` 的 `backup()` API 做在线备份
- `backup()` 方法在 C 层使用 `sqlite3_backup_init/step/finish` API，在备份期间持有 shared lock
- **正确**: 这会产生事务一致的快照（数据库在备份开始时的已提交状态）
- **缺口**: 备份期间没有写入暂停，备份快照的时间点与 WAL/outbox 状态可能不一致

**恢复机制**（`scripts/restore-runtime-state.sh`）:
```bash
pm2 stop     # 停止 PM2 进程（= writer fencing 的唯一手段）
cp + mv      # 替换 DB 文件（原子 mv）
rm -f *-wal *-shm  # 删除 WAL 文件
pm2 restart  # 重启
```
- **缺口**: `pm2 stop` 依赖 PM2 守护进程的存在。若 PM2 自身 crash，`pm2 stop` 失败，但脚本没有备用 fencing 手段。
- **缺口**: 当前恢复不对恢复后的 DB 做完整性校验（没有 integrity check pragma，没有 checksum 比对）。
- **缺口**: 恢复后立即 `pm2 restart`，没有 idle 的 smoke/reconcile/replay 步骤。规范要求的 WRITERS_FENCED → INTEGRITY_VERIFIED → STREAMS_REPLAYED → RECONCILED → SMOKE → EPOCHS → REOPENED 九步状态机当前为零。

### 5.2 断电/崩溃 durability profile

当前实现只有一个 durability profile（所有故障类型混为一谈）：
- SQLite WAL mode + NORMAL synchronous（`DatabaseRuntime.js`）
- NORMAL synchronous 意味着 SQLite 在关键时刻 fsync 但不保证每次事务都 fsync
- 断电场景下可能丢失最后一个 checkpoint 之后的事务
- **缺失**: 没有按故障类型分别声明 durability（process crash vs. OS crash vs. power loss vs. disk corruption vs. replica lag）

### 5.3 攻击场景

**ATTACK-DUR-01: 备份与写入竞态**（已在 FI-15 中覆盖）

**ATTACK-DUR-02: pm2 stop 失效幻影 writer**（已在 FI-13 中覆盖）

**ATTACK-DUR-03: 恢复后 DB 版本与代码版本不匹配**（已在 FI-16 中覆盖）

**ATTACK-DUR-04: WAL 文件残留导致的旧事务重放**
- `restore-runtime-state.sh` 执行 `rm -f *-wal *-shm` 清理 WAL
- 若 DB 替换发生在 `mv` 后、WAL 删除前，且进程在中间崩溃
- 下次启动时 SQLite 发现 WAL 文件但关联的 DB 已替换 → WAL 属于旧 DB → 可能静默丢弃或报错
- 当前脚本无幂等恢复机制

### 5.4 裁决

```
DURABILITY_VERDICT = IMPLEMENTATION_ONLY_GAP (no PITR, no stream replay, no per-fault-type durability profile, no integrity verify after restore)
```

---

## 6. RELEASE_MIGRATION_ROLLBACK_ATTACKS

### 6.1 当前发布流程分析

`deploy.sh` 的发布流程：
```
checkout → deploy-gate → shared-sync → backend-sync (rsync --delete) →
npm install → config-release → PM2 restart → health-check → frontend-publish
```

**已实现的部分安全措施**:
- 部署前门禁（`pre-deploy-gate.sh`）：lint、测试、架构检查 ✓
- 健康检查自动回滚（`rollback_backend_and_restart`）：5 次重试，失败即回滚 ✓
- 回滚快照（`snapshot_backend_for_rollback`）：使用 hardlink (`cp -al`) ✓
- 部署状态持久化（`deploy-status.json`）✓

**安全缺口**:
1. **非原子切换**: `rsync --delete` 逐个文件替换 + `pm2 restart` 重启动，中间有时间窗口。前后端/config/schema 不在同一原子切换点。
2. **回滚快照的 integrity**: `cp -al` 创建硬链接。若部署过程中旧进程持有旧文件的 fd 并写入，修改会反映在 rollback snapshot 中（硬链接共享 inode）。部署前 PM2 未 stop，旧进程仍在运行。
3. **无 release manifest**: 当前没有不可变的 `release_manifests` 表或签名制品。`deploy.sh` 使用的版本标识是 git commit hash，但没有 digest 锁定和验签。
4. **回滚粒度**: 回滚仅覆盖 `backend/` 目录（排除 `.env`、`logs`、`*.db`），不覆盖 `shared/`（config）、不覆盖 `FRONTEND_PUBLIC_DIR`。回滚后可能出现 backend 旧版本 + config 新版本 + frontend 新版本的三方混装。

### 6.2 Schema 迁移的发布安全

`SchemaMigrationService` 具有：
- Migration id + checksum + lock 机制 ✓
- 死锁抢占（stale lock detection + steal）✓
- 事务内应用迁移 ✓

**缺口**:
- 无 expand-migrate-contract 政策：所有迁移是线性的 ALTER TABLE，没有兼容中间态
- 没有跨版本 reader/writer 兼容矩阵
- checksum mismatch 后停止启动但不提供回滚/修复路径
- 没有 migration 回滚支持（v2.3 要求"可断点续跑并对账"且"任一阶段失败均停在仍兼容状态"）

### 6.3 攻击场景

**ATTACK-REL-01: rsync --delete 窗口期的三方混装**
- `rsync --delete` 逐步删除旧文件并写入新文件
- PM2 restart 触发时，`backend/` 中可能有部分文件是新版本、部分还未同步
- 同时 `shared/`（config）已在前面阶段更新
- 如果 PM2 restart 恰好在此窗口——启动的代码可能引用已更新的 config 中的新字段但代码还是旧版本 → 启动失败

**ATTACK-REL-02: hardlink 快照的并发修改**
- `snapshot_backend_for_rollback` 使用 `cp -al`（硬链接）
- 旧进程持有已被 rsync 替换（删除后新建）前的文件 fd——这些硬链接仍可访问且可能被旧进程写入
- 若旧进程在 PM2 restart 前对旧文件做了写入（如日志、临时文件），这些修改通过硬链接传播到 rollback snapshot
- 回滚时 restore 的 snapshot 可能包含被破坏的文件

**ATTACK-REL-03: 仅回滚 backend 的前后端/config 版本漂移**
- 健康检查失败触发 `rollback_backend_and_restart`
- `shared/` 不回滚 → config 是新版本
- `FRONTEND_PUBLIC_DIR` 不回滚 → 前端是新版本
- backend 回滚到旧版本 → 可能不兼容新 config 格式 → 启动失败
- 回滚后健康检查再次失败 → 人工介入

### 6.4 裁决

```
RELEASE_ROLLBACK_VERDICT = IMPLEMENTATION_ONLY_GAP (no atomic switch, no signed manifest, partial rollback scope, no expand-migrate-contract)
```

当前 deploy.sh 的原子切换控制在实际运维中是有效的（健康检查 + 自动回滚），但不满足 v2.3 的 R1/R2/R3 门禁。hardlink 快照的并发写入风险是实际可触发的（非理论），需要在 M7 阶段用文件系统快照或容器镜像加以解决。

---

## 7. RESTORE_STATE_MACHINE_ATTACKS

### 7.1 完整的 9 步状态机攻击面

将 v2.3 restore 九步状态机的每一步卷入故障注入：

| Step | 故障注入 | 预期行为 | 规范覆盖 |
|------|---------|----------|----------|
| WRITERS_FENCED | 部分 owner_leases 行被并发非 restore 操作写入 | epoch CAS 影响 0 行 → 回滚 → RESTORE_BLOCKED | PASS |
| | coordinator 在 fencing 中途 crash | 后继者重跑 epoch CAS（幂等，影响 0 行）→ 通过 | PASS |
| SCHEDULERS_AND_RELAYS_STOPPED | scheduler 在 stop 信号后仍有 in-flight job 完成 | job 完成 CAS 需有效 lease token → 被 fencing 拒绝 | PASS（前提：job lease token 验证到位） |
| DATA_RESTORED | PITR 恢复的目标文件与声明的 label/checksum 不一致 | checksum 比对失败 → RESTORE_BLOCKED | PASS |
| INTEGRITY_VERIFIED | DB integrity check 发现 corruption | RESTORE_BLOCKED | PASS |
| STREAMS_REPLAYED | replay 重放过程中 coordinator crash | 后继者通过 evidence_digest 检测到步骤未完成 → 重跑 → stream replay 使用 cursor 续传 | PASS（微妙的：replay 中间状态——增量 replay 是幂等的吗？） |
| | external consumer acked_seq > restored heads | divergence 清单非空 → TRAFFIC_REOPENED 阻塞 | PASS（但手动收敛路径 UNDER_SPECIFIED，见焊点 C） |
| RECEIPTS_JOBS_SAGAS_RECONCILED | reconcile UPDATE 中途 crash | 后继者重跑 → UPDATE WHERE status IN (...) 幂等（已更新的行不再匹配 WHERE） | PASS |
| | 某些 saga 无法自动 converge（外部支付已确认但内部状态丢失） | 标记 escalated → 阻塞 reopen | PASS |
| GAMEPLAY_SMOKE_PASSED | smoke test 中的命令在 restore coordinator 身份下执行 | 必须使用独立的测试 commandId 并验证 receipt 终态 | **注意**: smoke test 命令的授权身份未规定 |
| NEW_OWNER_EPOCHS_ISSUED_BY_CAS | epoch CAS 期间有 stale 进程尝试获取 lease | epoch 已更新 → 旧进程 lease 验证失败 | PASS |
| TRAFFIC_REOPENED | reopen token 验签失败 | 停在 RESTORE_BLOCKED，read-only mode | PASS |
| | reopen 后 consumer 出现新的 divergence | 已经 reopen，无法回退 → 需要 runbook 覆盖 | **缺失**: reopen 后的监测与回退 |

### 7.2 时间维度攻击

**ATTACK-RESTORE-01: 步骤超时的级联效应**
规范声明 "Every step has a timeout; timeout or failed guard → RESTORE_BLOCKED"。若 RESTORE_BLOCKED 后 operator 未及时介入，系统长期停留在只读/半可用状态。需要定义 RESTORE_BLOCKED 的最大允许持续时间和自动降级策略。

**ATTACK-RESTORE-02: 恢复期间运维操作窗口**
九步恢复可能需要数十分钟到数小时。在此期间：
- 是否有监控告警通知 operator 当前步骤和进度？
- operator 是否可以安全地 abort 恢复（状态机支持 ABORTED 终态）？
- ABORTED 后的数据状态是什么？（DB 仍处于 PITR 时刻的 T1 状态，但部分步骤可能已执行）

### 7.3 裁决

```
RESTORE_STATE_MACHINE_VERDICT = NOT_PROVEN (UNDER_SPECIFIED: takeover auth schema, step atomicity, divergence convergence SOP, post-reopen monitoring)
```

规范定义了正确的执行顺序和幂等守卫但缺少 3 个关键操作细节。当前实现完全不具备该状态机。

---

## 8. SECRET_IDENTITY_RESOURCE_EXHAUSTION_ATTACKS

### 8.1 密钥管理攻击面

**当前 secret 生命周期**（`scripts/rotate-production-secrets.sh`）:
- 直接修改 `.env` 文件（`upsert_env_value` 函数）
- 支持 JWT_SECRET、OPS_JWT_SECRET、OPS_ADMIN_PASSWORD_HASH 轮换
- 生成证据 JSON（`verify-production-security-config.js`）
- 可选的 PM2 restart

**攻击面**:

1. **无轮换重叠窗口**: `upsert_env_value` 直接覆写 `.env` 中的值。若 PM2 restart 未立即执行（`RESTART_PM2=0` 默认），旧进程仍使用旧密钥，但 `.env` 已更新为新密钥——新进程可以启动但旧进程仍存活 → 两套密钥同时有效；若 PM2 restart 立即执行（`RESTART_PM2=1`），新旧进程的切换窗口没有重叠——旧 token 在 restart 后立即失效（进程内缓存被清空）。

2. **无密钥版本标识**: `.env` 中的 JWT_SECRET 没有版本号。若轮换失败（写入了无效值），无法自动回退到上一个有效密钥。

3. **JWT_SECRET 回退到 dev 默认值**: `SecurityConfig.js:15-18`——若 JWT_SECRET 为空且在非 production 环境，使用 `DEFAULT_DEV_JWT_SECRET`。若 NODE_ENV 被误设为 development，任何请求携带的 token 都可以用 dev secret 验证通过。

4. **OPS_ADMIN_PASSWORD_HASH 以明文传入**: `rotate-production-secrets.sh` 要求 `OPS_ADMIN_PASSWORD_HASH=<bcrypt hash>` 作为环境变量传入——这意味着 bcrypt hash 出现在 shell 历史中。

5. **无 secret manager 集成**: 密钥存储在 `.env` 文件中，与代码部署在同一台机器上。备份 (`backup-runtime-state.sh`) 排除了 `.env`，但 `deploy.sh` 的 `rsync --delete` 也排除了 `.env`——所以 `.env` 从不被部署流程覆盖，但也不被备份。若机器故障重建，需要手动重建 `.env`。

### 8.2 Signer Key 攻击（规范层面）

v2.3 的签名密钥生命周期（§06 TRAFFIC_REOPENED 规范）：
- 密钥有 `not_before`/`not_after` validity window
- 轮换有 overlap window
- 撤销后运行中实例的 manifest 需在 grace window 内重签名
- 密钥 trust root 独立于运行目录

**攻击面**（已在焊点 E 中详细分析）:
- 重签名是否改变 manifest digest 的歧义
- rollback 目标在密钥撤销后不可用
- 内部攻击者用有效密钥签一个恶意 manifest 再撤销密钥——恶意 manifest 在撤销前签发，理论上仍在 validity window 内有效

### 8.3 资源耗尽攻击

**当前 backpressure 实现缺口**:
- 规范 O5 要求按 endpoint/account/session/owner/AOI/成本设置可测量限制
- 当前实现：`maintenanceMiddleware.js` 只有维护模式的二元开关
- 没有 per-endpoint rate limit（`SecurityConfig.js` 仅有 CORS）
- 没有 per-session command budget
- 没有 AOI fanout 上限
- 没有 owner mailbox 队列深度限制
- PM2 `max_memory_restart: 500M` 是唯一资源限制但不是 v2.3 要求的可测量容量限制

### 8.4 裁决

```
SECRET_IDENTITY_VERDICT = IMPLEMENTATION_ONLY_GAP (no secret manager, no key versioning, no signed manifest, no overlap window, no resource budgets)
```

当前 .env 文件管理 + SecretConfig.js 的环境变量解析提供了基础的密钥隔离（不入 Git、不入备份），但不满足 v2.3 的 O3 门禁（secret manager、rotation window、最小权限）。NODE_ENV 回退到 dev 默认值是一个配置错误即可触发的安全降级缺陷。

---

## 9. FAILURE_INJECTION_MATRIX

### 9.1 第三轮覆盖清单（重验 + 深化）

| # | 场景 ID | 故障类型 | 注入点 | 预期 v2.3 防御 | 当前实现状态 | 裁决 |
|---|---------|---------|--------|---------------|-------------|------|
| FI-01 | IC-2-RETEST | handoff 注入（新 holder 崩溃/激活 CAS 前 pause/placement 崩溃） | `owner_leases` handoff CAS | owner 在 deadline 内到 active 或回滚旧 holder，禁止用清理 job/receipt 制造 drain | **未实现**: 无 owner_leases、无 handoff、无 placement recovery | IMPLEMENTATION_ONLY_GAP |
| FI-02 | IC-1-RETEST | 撤销竞态矩阵（撤销 × admission × commit × plan_attempt 全时序） | session epoch / authz epoch | admission 快照三类 epoch，受管制命令 commit 点复核 | **未实现**: 无三类 epoch 分离、无 admission 快照、无 commit 点复核 | IMPLEMENTATION_ONLY_GAP |
| FI-03 | IC-3-RETEST | PITR 后外部 consumer acked_seq 超前恢复 cut | consumer_cursors vs stream_heads comparison | divergence 清单阻塞 reopen，恢复后 seq 不重用 | **未实现**: 无 consumer_cursors、无 stream_heads、无 divergence 机制 | IMPLEMENTATION_ONLY_GAP |
| FI-04 | IC-4-RETEST | 并发 restore 注入 | restore_runs singleton admission | 双并发 INSERT → 仅一行进非终态，另一步被拒 | **未实现**: 无 restore_runs 表 | IMPLEMENTATION_ONLY_GAP |
| FI-05 | IC-5-RETEST | 自选 scope 容量合同 | evaluator 判定 | mandatory profile 缺失 → NOT_PROVEN | **未实现**: 无 evaluator | IMPLEMENTATION_ONLY_GAP |
| FI-06 | IC-6-RETEST | reconnect_storm × authz cache miss 联合注入 | 两 fault 同时注入 | stale-approve 计数 = 0，前台 SLO 不崩 | **未实现**: 无 reconnect 风暴机制、无 authz cache、无联合故障注入框架 | IMPLEMENTATION_ONLY_GAP |
| FI-07 | ADMISSION-CRASH | admission 后、执行前崩溃 | CommandIdempotencyStore.begin() 后 | recovery guardian 接管过期 execution_token → 收敛 | **部分实现**: begin() 写入 in_progress 但无 guardian 接管机制 | IMPLEMENTATION_ONLY_GAP |
| FI-08 | COMMIT-UNKNOWN | 领域 COMMIT 前、返回未知、COMMIT 后 ACK 前崩溃 | receipt status | 客户端通过 statusUrl 查询 commandId 恢复结果 | **部分实现**: statusUrl 存在但 receipt 与领域写入非原子 | IMPLEMENTATION_ONLY_GAP |
| FI-09 | DRAIN-DELETE | 通过清理积压 job/receipt 制造 drain 通过 | finalState.cleanupConservation | cleanup/delete 计数 > 0 → FAIL | **未实现**: 无容量合同、无 conservation counter | IMPLEMENTATION_ONLY_GAP |
| FI-10 | SPLIT-BRAIN | 旧 epoch 进程在 COMMIT 前恢复运行 | owner_leases epoch CAS | 旧 epoch 的最终 fencing 影响 0 行 → 整体回滚 | **未实现**: 无 epoch fencing | IMPLEMENTATION_ONLY_GAP |

### 9.2 新增 v2.3 焊点攻击

| # | 场景 ID | 故障类型 | 注入点 | 预期 v2.3 防御 | 裁决 |
|---|---------|---------|--------|---------------|------|
| FI-11 | RESTORE-CONCURRENT-ADMIT | 两个 restore coordinator 并发 INSERT restore_runs | restore_runs singleton admission | admission guard + partial unique index 双保险 → 仅一行进入非终态 | PASS（规范正确）但需补 isolation 声明（焊点 A） |
| FI-12 | RESTORE-STEP-TOCTOU | 两个 coordinator 竞速同一 restore step（先后接管） | restore step guard + next-step CAS | 守卫求值与 CAS 在同一事务内 → 不重复执行 | **UNDER_SPECIFIED**: 事务边界未强制（焊点 B） |
| FI-13 | RESTORE-MIDSTEP-CRASH | coordinator 在 step 执行中途 crash | execution_token lease 过期 + takeover | 后继者 CAS 接管过期 token → 重评估 guard → 续跑 | **UNDER_SPECIFIED**: takeover auth schema 缺失（焊点 B） |
| FI-14 | SEQ-ORIGIN-LOST | T1→T2 seq 区间无外部 consumer 证据 | max published seq 的计算 | 无可靠来源 → RESTORE_BLOCKED (SEQ_ORIGIN_UNKNOWN) | **UNDER_SPECIFIED**: 降级路径未定义（焊点 C） |
| FI-15 | REOPEN-TOKEN-REPLAY | 重新提交同一 TRAFFIC_REOPENED token | restore_reopen_tokens 消费记录 | restoreId 绑定 + token 消费标记 → 拒绝 | **UNDER_SPECIFIED**: 无 token 消费记录表（焊点 D） |
| FI-16 | REOPEN-TOKEN-NO-EXPIRY | 一年前签发的 reopen token 仍被接受 | token expiresAt | expiresAt 过期 → 拒绝 | **UNDER_SPECIFIED**: token 无 expiresAt（焊点 D） |
| FI-17 | KEY-REVOKE-ROLLBACK-BLOCKED | 撤销用于签名 rollback 目标 vN-1 的密钥 → 尝试回滚 | manifest signature verification | 拒绝回滚直到 vN-1 manifest 用有效密钥重签名 | PASS（规范正确）但重签名路径未定义（焊点 E） |
| FI-18 | KEY-GRACE-EXHAUSTION | 密钥撤销后 server crash → 重启时 manifest 用已撤销密钥签名且在 grace window 外 | manifest signature verification | server 不可重启 → 需人工重签名后恢复 | PASS（fail-closed 正确）但 runbook 缺失 |

### 9.3 实现层面的可触发攻击（当前代码直接测试）

| # | 场景 ID | 故障类型 | 注入方式 | 当前行为 | 裁决 |
|---|---------|---------|---------|---------|------|
| FI-19 | PM2-STOP-FAIL | PM2 守护进程 crash 或 `pm2 stop` 命令超时 | kill -9 PM2 守护进程 → 执行 restore-runtime-state.sh | `pm2 stop` 失败（"pm2 is missing"），脚本退出（exit 1）。DB 未被替换但 PM2 进程可能仍在运行（成为 phantom writer） | **缺陷**: restore 不应依赖 PM2 作为唯一 fencing 手段 |
| FI-20 | BACKUP-DURING-ACTIVE-TXN | 在线备份时正在进行领域写入 | backup-runtime-state.sh 执行中 + 并发 workload | better-sqlite3 `backup()` 使用 sqlite3_backup API → 快照一致（备份开始时刻的已提交状态）。**通过** | **无缺陷**: SQLite backup API 正确 |
| FI-21 | RESTORE-WAL-LEAK | restore 期间 crash 在 mv DB 后、rm WAL 前 | kill restore 脚本在 mv 后 | 下次启动时 SQLite 发现 WAL 与 DB 不匹配 → 可能 crash 或静默回滚 | **缺陷**: 恢复脚本无幂等清洁机制 |
| FI-22 | HARD-LINK-SNAPSHOT-CORRUPTION | 运行中旧进程通过硬链接写入 rollback snapshot | rsync 部署完成 → PM2 restart 前旧进程写旧文件 | 硬链接共享 inode → rollback snapshot 被破坏 → 回滚后文件损坏 | **缺陷**: deploy.sh 的 rollback snapshot 使用硬链接而非文件系统快照 |
| FI-23 | MIGRATION-CHECKSUM-MISMATCH | 恢复到旧 DB（schema v3）但代码期望 v4 | restore + PM2 restart | SchemaMigrationService 检测到 checksum mismatch → 拒绝启动（`assertPlanCanApply` 抛出 `SCHEMA_MIGRATION_PLAN_BLOCKED`）→ server 无法启动 | **无缺陷**: checksum mismatch 被正确检测。但 runbook 需覆盖"如何安全降级或手动迁移" |
| FI-24 | NODE-ENV-DEV-DEFAULT | NODE_ENV 被误设为 development | 配置错误 | JWT_SECRET 未设置 → SecurityConfig 使用 `civilization-fire-dev-secret` → 所有 token 可用 dev secret 伪造 | **安全缺陷**: dev 默认值应为显式 fail-closed，不得在 production 配置缺失时静默回退 |

---

## 10. REQUIRED_SPEC_AND_RUNBOOK_REVISIONS

### 10.1 规范级修订（v2.3 → v2.3.1 PATCH）

以下修订不改变架构语义，仅闭合 UNDER_SPECIFIED 缺口：

| 编号 | 位置 | 当前文本 | 修订 | 原因 |
|------|------|---------|------|------|
| SPEC-REL-02a | §06 restore_runs admission | 未声明 isolation level | 增加：admission guard 与 unique index 的双重防御适用于 READ COMMITTED 及以上隔离级别；在 READ UNCOMMITTED 下不提供保证。调用方必须以相同错误处理路径对待 admission guard 返回 0 rows 和 unique constraint violation。 | 焊点 A |
| SPEC-REL-01a | §06 restore step guard | 守卫求值与 CAS 未声明事务边界 | 增加：每步的 idempotency guard 求值、step 执行和 next-step CAS 必须在同一数据库事务中原子完成。 | 焊点 B |
| SPEC-REL-08 (NEW) | §06 | （新增） | 定义 restore takeover authorization token 的 schema：`{restoreId, coordinatorId, issuedAt, expiresAt, signerKeyId, signature}`。 | 焊点 B |
| SPEC-REL-07a | §06 TRAFFIC_REOPENED token | 无 expiresAt 和环境绑定 | 增加 `expiresAt`（最长 24h）、`environmentId` 字段。 | 焊点 D |
| SPEC-REL-07b | §06 | 无 token 消费记录 | 增加 `restore_reopen_tokens` 表：`(token_id, restore_id, consumed_at, signature_hash)` UNIQUE(token_id) + UNIQUE(restore_id)（每 restore 仅一次 reopen）。 | 焊点 D |
| SPEC-REL-09 (NEW) | §06 read-only mode | （新增） | 定义 read-only mode 的行为契约：返回 503 的写端点列表、允许的只读端点列表、consumer 是否暂停、health check 返回 503 而非 200。 | 焊点 D |
| SPEC-REL-05a | §06 signer key lifecycle | 重签名是否改变 manifest digest 未声明 | 明确：`release_manifests.artifact_digests` 与 `signature`/`signer_key_id` 独立——重签名仅更新后两者。 | 焊点 E |
| SPEC-REL-10 (NEW) | §4.1 seq 规则 | 最大已发布 seq 的发现算法未定义 | 增加确定性发现算法（见焊点 C 修订建议）。 | 焊点 C |
| SPEC-REL-11 (NEW) | §4.1 | divergence 手动收敛路径未定义 | 增加 runbook 模板 SOP-DIVERGENCE-01。 | 焊点 C |

### 10.2 Runbook 模板（必须随 v2.3.1 交付）

| Runbook ID | 场景 | 最小内容 |
|------------|------|---------|
| SOP-RESTORE-BLOCKED-01 | RESTORE_BLOCKED 后的恢复 | 当前步骤识别、错误日志收集、后续步骤从当前步骤重跑 vs. abort 的决策树、ABORTED 后的清理步骤 |
| SOP-DIVERGENCE-01 | external consumer divergence 的非自动收敛 | per-consumer 的 cursor rollback 步骤、projection 重建命令、外部支付/邮件的对账查询、escalated 后的人工审批模板 |
| SOP-KEY-REVOKE-01 | signer key 撤销后的紧急操作 | 受影响 release/rollback 目标列表、重签名步骤、trust root 更新步骤、验证重签名后服务的启动测试 |
| SOP-READONLY-MODE-01 | server 启动后停留在 read-only mode | 验证 restore_runs 状态、TRAFFIC_REOPENED token 验签、手动 reopen 的审批流程、只读状态下可使用的诊断命令 |
| SOP-ROLLBACK-BLOCKED-01 | 回滚目标 manifest 无有效签名 | 当前有效密钥列表、重签名请求模板、回滚时间窗口评估、若不回滚的替代方案 |

---

## 11. IMPLEMENTATION_GAP_APPENDIX

以下缺口全部属于 `IMPLEMENTATION_ONLY_GAP`（当前代码未实现，不构成规范缺陷）。

| # | 缺口 | 规范引用 | 当前代码状态 | M 阶段 |
|---|------|---------|-------------|--------|
| GAP-01 | `owner_leases` 表 + epoch-based fencing | C1, C6, §03 | 无表。`OwnerLockRepository` 提供进程锁但不具备 epoch CAS 语义。 | M2 |
| GAP-02 | placement authority + handoff 状态机 | C6, §03 | 无 placement 逻辑。无 `draining/transferring/active` 状态机。 | M2 |
| GAP-03 | `restore_runs` 表 + restore coordinator | R5, R6, §06 | 无表。`restore-runtime-state.sh` 是 shell 脚本全量替换，无状态机。 | M7 |
| GAP-04 | `stream_events` + `stream_heads` + `consumer_cursors` 表 | D1-D3, §03 | 无表。事件通过 WebSocket push 即时发送，无持久化流。 | M4 |
| GAP-05 | 持久 client stream 续传（per-stream cursor + gap recovery） | P5, P6, §04 | 客户端重连走全量 bootstrap（GET /bootstrap），无非增量续传。 | M5 |
| GAP-06 | 原子 receipt（admission + 领域写入 + terminal receipt 同事务） | D1, §01 | `CommandIdempotencyStore.begin()` 与 `recordResult()` 是两次独立 DB 操作。 | M1 |
| GAP-07 | command receipt 三类 epoch 快照 | FL-13, §01 | `command_idempotency` 表无 `admission_credential_version/session_epoch/authz_epoch` 列。 | M1 |
| GAP-08 | recovery guardian（过期 execution_token 接管） | §01, M1 | 无 guardian。残留 `in_progress` 永远不收敛。 | M1 |
| GAP-09 | `scheduled_jobs` 表 + lease token/epoch + 稳定 claim | D6, §02, §03 | 无持久化 scheduled jobs 表。任务由 `WorldWorkerService` 内存 tick 驱动。 | M4 |
| GAP-10 | transactional outbox | D2, §02, §03 | 无 outbox_events 表。外部副作用在领域事务内直接调用。 | M4 |
| GAP-11 | `release_manifests` 表 + 签名 + 信任根 | R1, R2, §06 | 无表。版本由 git commit hash 追踪，无不可变制品锁定。 | M7 |
| GAP-12 | 容量合同判定器 | O2, §05 | 无 evaluator 实现。 | M7 |
| GAP-13 | signer key lifecycle（密钥有效性窗口、撤销、trust root） | SPEC-REL-05, §06 | 无签名密钥管理。`rotate-production-secrets.sh` 管理 JWT secret 轮换但不涉及签名密钥。 | M7 |
| GAP-14 | expand-migrate-contract 政策 | R3, §06 | `SchemaMigrationService` 有 migration id/checksum/lock 但无线性的 expand-migrate-contract 流程和兼容矩阵。 | M3 |

**已部分实现（不属于 gap 但未完整）**:

| # | 项目 | 当前状态 | 与规范的差距 |
|---|------|---------|-------------|
| PART-01 | command idempotency | `CommandIdempotencyStore` 有 begin/recordResult/get/abandon | 非原子 receipt（GAP-06），无三类 epoch 快照（GAP-07），无 recovery guardian（GAP-08） |
| PART-02 | schema migration | `SchemaMigrationService` 有 migration id/checksum/lock | 无 expand-migrate-contract（GAP-14），无回滚支持 |
| PART-03 | owner locking | `OwnerLockRepository` 有进程内 TTL 锁 + 按序获取 | 无 epoch-based fencing（GAP-01），无 handoff 状态机（GAP-02） |
| PART-04 | deploy/rollback | `deploy.sh` 有 health-check + auto-rollback + hardlink snapshot | 非原子切换，无 signed manifest（GAP-11），三方混装风险 |
| PART-05 | backup/restore | `backup-runtime-state.sh` / `restore-runtime-state.sh` 有在线备份 + checksum | 无 writer fencing 等效（依赖 PM2 stop），无恢复后完整性验证，无 state machine |

---

## 裁定摘要

```
RELIABILITY_V2_3_VERDICT: NOT_PROVEN
  - SPEC_QUALITY: 7 × UNDER_SPECIFIED, 0 × SPEC_CONTRADICTION
  - IMPLEMENTATION: 14 × IMPLEMENTATION_ONLY_GAP, 0 × SPEC_CONTRADICTION
  - V2.3_PATCH_CLOSURES: 5 NEW WELD POINTS REVIEWED (3 PASS, 2 PASS with UNDER_SPECIFIED sub-items)
  - CONFIRMED_CLOSURES: 11 / 12 fully closed (seq origin discovery UNDER_SPECIFIED)
  - FAILURE_INJECTION: 24 scenarios defined (10 third-round re-verified, 8 new weld-point attacks, 6 implementation-level triggerable)
  - REQUIRED_REVISIONS: 9 spec patches + 5 runbook templates
```

**整体评估**: v2.3 规范在恢复语义、签名认证和部署安全性方面的设计方向正确。7 个 UNDER_SPECIFIED 项集中在 (a) seq 不重用的证据发现算法、(b) restore step 的原子性边界、(c) token 的完整性与过期控制。这些是实现等价性判定所需的执行细节——在规范不闭合的情况下，两个独立的实现可能都是"正确"的但互不兼容。当前实现的 14 个 gap 是表级/组件级缺失（非概念错误），应随着 M1→M7 迁移逐步闭合。

v2.3 规范**没有 SPEC_CONTRADICTION**——所有陈述的强制要求可以同时满足。这是第四轮对抗审查中本席的核心裁定。

---

*DeepSeek 可靠性工程席 · 第四轮独立对抗审查 · 2026-07-15*
