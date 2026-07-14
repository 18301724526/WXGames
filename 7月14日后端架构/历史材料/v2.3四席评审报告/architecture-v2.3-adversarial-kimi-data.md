# KIMI 数据/并发/工作流/经济账务席：v2.3 第四轮独立对抗审查报告

> 报告输出：`tmp/architecture-v2.3-adversarial-kimi-data.md`  
> 审查日期：2026-07-14  
> 只读输入：`7月14日后端架构/成熟SLG后端参考架构-v2.3.html`、`容量合同-v2.3.schema.json`、`容量合同判定器规范-v2.3.md`、`当前实现迁移路线图-v2.3.md` 及必要的当前代码片段。  
> 遵守《7月14日后端架构/架构v2.3四席对抗审核提示词.md》的“共同事实与裁决纪律”，未读取任何 `architecture-v2.*-adversarial-*` 报告或 `历史材料/` 下评审输出。

---

## 1. DATA_V2_3_VERDICT

`REFERENCE_V2_3_STATUS` 保持 `NOT_PROVEN`。

v2.3 在第三轮裁决后补强的“焊点”在核心单写者、handoff CAS、epoch admission 快照、Saga dedupe 作用域、fx_snapshots 与 ledger 结构等方向上是正确的，但若干焊点的**执行语义尚未闭合到可唯一实现、可机械验收**的程度。特别是 FL-13（授权 epoch admission/commit 点复核）存在一条可导致受管制命令在撤销后仍提交的 **P0 竞态反例**；其余 A/C/D 焊点存在 UNDER_SPECIFIED / SPEC_CONTRADICTION 缺口，需要在 v2.4 中补充 SQL 谓词、DDL 列或触发器、以及可观测的验收证据。

当前实现仍为 `CURRENT_IMPLEMENTATION = NON_CONFORMING`（SQLite `owner_locks` 而非 `owner_leases`、两步 `CommandCommitter`、无完整 Saga/ledger/stream），但本次报告不把实现差距冒充规范矛盾。

---

## 2. V2_3_PATCH_CLOSURE_REVIEW（逐焊点裁决）

### A. handoff 修订（原 FL-01）

| 子项 | 裁决 | 说明 |
|------|------|------|
| A-1 `draining` 最终 fencing 谓词使用 `statement_timestamp()` | `UNDER_SPECIFIED`（P1） | `statement_timestamp()` 在 PostgreSQL 中是**语句开始时间**。在 `SELECT ... FOR UPDATE` 因锁等待延迟后，谓词重评估仍使用该语句开始时间，而非实际获得锁的时刻，可能让“截止时间后仍获得旧 holder 锁”的窗口被锁等待长度放大。 |
| A-2 `transferring → active` 激活 CAS 的 timeout/recovery 触发 | `UNDER_SPECIFIED`（P1） | 激活 SQL 只检查 `state/owner_epoch/holder_id`，没有 `transfer_deadline` 列或谓词；超时回收主体、扫描周期、超时值均未在 SQL 中体现。 |
| A-3 `committed_watermarks` 与 handoff CAS 同事务原子性 | `CONFIRMED_SPEC_CLOSURE`（附条件） | 在旧 holder 遵守“先锁 `owner_leases` 再写 `stream_heads`”的全序、且 handoff CAS 不使用 `SKIP LOCKED`/`NOWAIT` 的前提下，`owner_leases` 行锁会把 handoff 子查询串行化到旧 holder 提交之后，水位是原子的。 |
| A-4 超时 transferring 回滚旧 holder 与“新 holder 已部分接管”双活 | `CONFIRMED_SPEC_CLOSURE` | 新 holder 在激活 CAS 成功前不得服务；recovery CAS 会等待旧 holder 行锁；只要实现遵守“激活前不读写”，不存在并发 active writer。 |

#### A-1 反例：statement_timestamp() 与锁等待的窗口

- **被攻击条款**：`成熟SLG后端参考架构-v2.3.html` 第 1166-1176 行最终 fencing 谓词 `state='active' OR (state='draining' AND handoff_id=:handoff_id AND statement_timestamp()<drain_deadline)`。
- **前置条件**：多 owner 命令；owner O 处于 `draining`，`drain_deadline = T0+5s`。
- **时间线**：
  1. `T0+4s`：旧 holder H1 启动最终 fencing `SELECT ... FOR UPDATE`（语句开始时间 `t = T0+4s < deadline`），随后因等待其它 owner 锁而阻塞。
  2. `T0+6s`：锁释放，H1 获得 `owner_leases` 行锁；`statement_timestamp()` 仍为 `T0+4s`，谓词通过。
  3. `T0+7s`：H1 提交。
- **隔离/锁假设**：PostgreSQL `READ COMMITTED`；`SELECT FOR UPDATE` 在锁释放后会重评 WHERE 条件，但 `statement_timestamp()` 值固定为语句开始（[PostgreSQL 文档 13.2.1](https://www.postgresql.org/docs/current/transaction-iso.html)）。
- **违反的不变量**：drain_deadline 应作为“截止时间后旧 holder 不得再获得权威写锁”的硬边界；实际却被锁等待延长。
- **为什么挡不住**：谓词没有使用在锁获取后才求值的时钟源（如 `clock_timestamp()`），也没有在获得锁后二次检查。
- **最小修订**：将 deadline/lease 检查改为 `clock_timestamp() < drain_deadline`，或在 `FOR UPDATE` 获得锁后单独 `IF clock_timestamp() >= drain_deadline THEN RAISE ...`。
- **验收证据**：注入一个多 owner 命令让最终 fencing 语句在锁等待中跨越 `drain_deadline`，观测该命令是否被允许提交；期望在修正后返回 `0 rows` 并回滚。

#### A-2 反例：激活超时未闭合

- **被攻击条款**：`transferring → active` 激活 CAS（第 1154-1160 行）与“超时后 placement recovery 回收”。
- **前置条件**：handoff CAS 成功，`state='transferring'`，`holder_id=H2`。
- **时间线**：
  1. H2 在 handoff 后崩溃或 GC 暂停，未执行激活 CAS。
  2. recovery 进程未定义扫描周期/触发条件，owner 长期停留在 `transferring`。
  3. 无其它实例敢执行激活（不是 `:new_holder`），也无谓词能因超时而让 recovery 回收。
- **隔离/锁假设**：无。
- **违反的不变量**：v2.3 要求“禁止 owner 永久停留在 `transferring`”。
- **为什么挡不住**：激活 SQL 与表结构都没有 `transfer_deadline`；recovery 触发主体与周期是 runbook 级空白。
- **最小修订**：
  - DDL 增加 `transfer_deadline TIMESTAMPTZ`；
  - 激活 CAS 增加 `AND clock_timestamp() < transfer_deadline`；
  - recovery CAS 增加 `AND (state='active' 旧 holder) OR (state='transferring' AND transfer_deadline < clock_timestamp())`；
  - 在 runbook/监控中定义 recovery 扫描 SLA 与可观测指标。
- **验收证据**：注入 H2 在 handoff 后 pause，观测 `owner_leases.state` 在 `transfer_deadline` 后是否被 recovery 自动回滚或推进新 epoch。

---

### B. receipt 的三类 epoch admission 快照列（原 FL-13 数据面）

| 子项 | 裁决 | 说明 |
|------|------|------|
| B-1 快照写入点 = admission INSERT | `CONFIRMED_SPEC_CLOSURE` | 三类 epoch 在 admission 小事务写入 `command_receipts` 时快照，与后续执行阶段分离，符合“授权线性化点=admission 时刻”。 |
| B-2 快照列与 `plan_attempt` 推进的交互 | `CONFIRMED_SPEC_CLOSURE`（附条件） | `plan_attempt` CAS 只改 `plan_attempt/status/token`；admission 快照列保持不变，重规划不会刷新授权锚点。 |
| B-3 admission 快照列的不可变性 | `UNDER_SPECIFIED`（P1） | DDL 与规范均未说明这三列在写入后不可变更；若后续 UPDATE 修改，授权证据链即被破坏。 |
| B-4 受管制命令 commit-point 复核“普通读即可” | `FACT_ERROR`（导致 P0 授权破坏） | 在 `READ COMMITTED` 下，单次普通读存在读写竞态，撤销可能在读取与提交之间提交，使受管制命令在撤销后仍成功。 |

#### B-4 反例：撤销在 commit-point 读与 COMMIT 之间提交

- **被攻击条款**：`成熟SLG后端参考架构-v2.3.html` 第 1622 行“受管制命令类别必须在领域事务 commit 点复核 epoch：... 在领域事务内重读 sessions 行（普通读即可，撤销写方提交后的下一次重读必见）并断言与 admission 快照一致”。
- **前置条件**：命令 C 已 admission，`command_receipts.admission_authz_epoch = 5`；C 是受管制命令（支付/管理员/权限授予）。
- **时间线**：
  1. `T1`：C 的领域事务开始，执行 `SELECT authz_epoch FROM sessions WHERE session_id=...`（普通读），读到 `5`，与快照一致。
  2. `T2`：权限撤销事务更新 `sessions.authz_epoch = 6` 并 COMMIT。
  3. `T3`：C 的领域事务执行最终 domain writes 并 COMMIT；由于只读了一次 sessions，未再检查，命令被错误提交。
- **隔离/锁假设**：PostgreSQL `READ COMMITTED`（默认）；sessions 行未被 `FOR UPDATE` 锁定。
- **违反的不变量**：受管制命令必须在撤销后 fail-closed 拒绝。
- **为什么挡不住**：普通读只保证读取瞬间看到已提交值，不保证读取到 COMMIT 之间没有新提交；规范中的“下一次重读必见”需要显式第二次读或锁。
- **最小修订**：
  - 方案 1：commit-point 复核使用 `SELECT authz_epoch FROM sessions WHERE session_id=... FOR UPDATE`；
  - 方案 2：将 terminal receipt 的 UPDATE 谓词扩展为包含 `AND EXISTS (SELECT 1 FROM sessions WHERE session_id=... AND authz_epoch=:admission_authz_epoch AND credential_version=:admission_credential_version AND session_epoch=:admission_session_epoch)`，用 CAS row-count 断言把 epoch 检查与终态写入原子化。
- **验收证据**：对受管制命令注入“admission 后、commit 前撤销”100 次交叉（M5 退出门禁要求），修正后 `AUTH_EPOCH_STALE` 计数 = 100，无 stale-commit。

---

### C. saga dedupe_key 新作用域与迟到消息语义；plan_attempt 推进谓词与 FK（原 FL-06 / FL-04）

| 子项 | 裁决 | 说明 |
|------|------|------|
| C-1 `dedupe_key` 作用域钉死为 `(realm_id, saga_id, dedupe_key)` | `CONFIRMED_SPEC_CLOSURE` | DDL 第 1416 行的 `UNIQUE (realm_id, saga_id, dedupe_key)` 与规范一致，无关 saga 不阻塞。 |
| C-2 迟到/重复 confirm 语义 | `SPEC_CONTRADICTION`（P1） | 架构文本第 1007 行、迁移路线图第 188 行要求“迟到 confirm 在 compensating/completed 后必须失败”，而 DDL 代码注释第 1424 行说“重复 dedupe_key 消息幂等返回首次记录的原结果（不报错）”。两者直接冲突。 |
| C-3 plan_attempt 推进谓词与 FK | `UNDER_SPECIFIED`（P1） | 推进 CAS 谓词不包含新 plan 行存在检查；若新 plan 行未在同一事务插入， immediate FK 会抛异常而非返回 0 行，违反“0 rows => abort re-plan”语义。 |
| C-4 “幂等返回原结果”的存储载体 | `UNDER_SPECIFIED`（P1） | `saga_steps` DDL 没有用于存储首次执行结果的列，规范要求“返回原结果”在表结构中无落脚点。 |

#### C-2 反例：重复 confirm 后 completed 状态该返回还是失败？

- **被攻击条款**：规范“迟到 confirm 在 compensating/completed 后必须失败” vs 代码注释“重复 dedupe_key 消息幂等返回首次记录的原结果”。
- **前置条件**：saga step S 的 confirm 消息已处理，S 状态为 `completed`；同一 confirm 消息因网络重投再次到达，dedupe_key 已存在。
- **时间线**：
  1. 实现方按“必须失败”实现：返回错误，调用方重试，造成无限错误循环或 DLQ 污染。
  2. 实现方按“返回原结果”实现：与“必须失败”文字冲突，验收时无法通过字面检查。
- **隔离/锁假设**：无。
- **违反的不变量**：Saga 状态机语义必须唯一；同一输入在相同状态下应有确定输出。
- **为什么挡不住**：两条规范在同一状态（completed + 重复 dedupe_key）给出了不同输出。
- **最小修订**：统一为“同一 dedupe_key 在 completed/compensating/escalated 后幂等返回首次结果；只有**新** confirm（未记录 dedupe_key）在状态已越过 confirming 时才失败/忽略”。更新架构文字与 DDL 注释一致。
- **验收证据**：构造重复 confirm 注入，检查 saga 状态与返回码；期望状态不变、返回原结果、无副作用。

#### C-3 反例：plan_attempt 推进时 plan 行缺失

- **被攻击条款**：`command_receipts` plan_attempt 推进 CAS（第 1225-1228 行）与 `FOREIGN KEY (realm_id, command_id, plan_attempt) REFERENCES command_execution_plans`。
- **前置条件**：旧 plan_attempt = 0；新 plan row (1) 尚未插入或插入在另一事务回滚。
- **时间线**：
  1. 事务 Tx1 执行 `UPDATE command_receipts SET plan_attempt=1 ... WHERE plan_attempt=0 AND status='in_progress' AND execution_token=:token`。
  2. FK 检查失败，抛出 `23503` 异常，事务回滚。
  3. 应用层若按“0 rows => abort re-plan”处理，会把异常误判为竞争，可能重试或报错。
- **隔离/锁假设**：immediate FK constraint（默认）。
- **违反的不变量**：规范要求推进失败返回 0 行以便优雅 re-plan。
- **为什么挡不住**：谓词与 FK 检查不在同一错误通道。
- **最小修订**：
  - 推进 receipt 与新 plan 插入必须在**同一事务**；或
  - 使用 deferred FK 并在同一事务内插入 plan；或
  - 应用层显式先 `SELECT 1 FROM command_execution_plans WHERE ...` 加锁，再 UPDATE，并把 FK 违反映射为 re-plan 事件。
- **验收证据**：注入“plan row 丢失”场景，验证不抛 FK 异常，而是返回 `plan_attempt unchanged` 并触发 re-plan。

---

### D. fx_snapshots / ledger / snapshot builder / 外部 durable accept 证据（原 FL-07 / FL-08 / FL-09）

| 子项 | 裁决 | 说明 |
|------|------|------|
| D-1 `fx_snapshots` 独立表、不可变、journal FK | `CONFIRMED_SPEC_CLOSURE` | DDL 第 1322-1331 行与第 1343 行的 FK 符合规范。 |
| D-2 fee/tax/rounding `account_class` | `CONFIRMED_SPEC_CLOSURE` | DDL 第 1361-1364 行显式枚举三类账户。 |
| D-3 部分退款上限谓词 | `UNDER_SPECIFIED`（P1，实现错误可升级为 P0 资金破坏） | 规范只给出自然语言谓词，未给出精确 SQL、原始金额计算口径、并发序列化机制。 |
| D-4 snapshot builder 一致切面 = REPEATABLE READ 只读事务 | `CONFIRMED_SPEC_CLOSURE` | 规范明确“不采用 cut marker”，在 PostgreSQL RR 下可得到 stream_heads 与 payload 的一致性快照。 |
| D-5 外部 destination durable accept 证据 | `UNDER_SPECIFIED`（P1） | `outbox_events` DDL 缺少记录外部 ack credential 的列；`cleanupConservation` 是否包含 outbox 清理未明确，与“短期 relay spool”语义存在模糊边界。 |

#### D-3 反例：并发部分退款超过原始金额

- **被攻击条款**：`成熟SLG后端参考架构-v2.3.html` 第 1374-1379 行部分退款上限谓词。
- **前置条件**：原始 journal J 金额为 1000；两笔退款 R1、R2 各申请 600。
- **时间线**：
  1. Tx1 读取 `SUM(refund deltas WHERE reversal_of=J) = 0`，判断 `0+600 <= 1000`，继续执行。
  2. Tx2 同时读取，也看到 `SUM=0`，判断通过。
  3. Tx1、Tx2 均提交；累计退款 1200 > 1000。
- **隔离/锁假设**：PostgreSQL `READ COMMITTED`；退款事务未对原始 journal 行加 `FOR UPDATE`。
- **违反的不变量**：部分退款累计 ≤ 原始 journal 金额。
- **为什么挡不住**：自然语言谓词没有指定“先锁原 journal 行，再求和”的序列化步骤，也未提供版本/CAS 机制。
- **最小修订**：
  - 退款事务以 `SELECT ... FROM economy_journals WHERE journal_id=:orig FOR UPDATE` 开始并持锁到 COMMIT；
  - 或增加 `economy_journals.refunded_amount_per_currency` 原子列，用 `UPDATE ... SET refunded_amount = refunded_amount + :this_refund WHERE refunded_amount + :this_refund <= :original_amount` 做 CAS；
  - 规范明确“原始金额”计算口径（例如仅 `account_class='player_available'` 的借记金额，还是包含 fee/tax 的毛额）。
- **验收证据**：并发注入两笔总申请超过原金额的退款，验证第二笔被拒绝；最终 ledger 按 currency 守恒且无超额退款。

#### D-5 反例：外部 destination accept 无法落证据

- **被攻击条款**：`成熟SLG后端参考架构-v2.3.html` 第 1068 行“外部 destination = 目标系统持久确认凭证（offset commit / ack id）记录于该 `(event_id, destination)` 行”。
- **前置条件**：`outbox_events` 表结构见第 1291-1302 行。
- **时间线**：
  1. 外部系统返回 ack id。
  2. 实现方需要把 ack id 写入 `outbox_events` 行，但 DDL 只有 `status/attempts/next_attempt_at/published_at`，无 ack credential 列。
  3. 实现方可能把 ack 塞进 `status` 文本或 `published_at` 注释，导致不可验收。
- **隔离/锁假设**：无。
- **违反的不变量**：规范要求外部 accept 证据可被审计和 evaluator 复算。
- **为什么挡不住**：表结构未提供 typed 字段。
- **最小修订**：DDL 增加 `external_accept_credential JSONB`、`accepted_at TIMESTAMPTZ`；规范定义凭证格式与最小字段（ack id、destination 业务键、accepted time）。
- **验收证据**：构造外部 ack 到达场景，验证 `outbox_events` 行写入可解析的 credential，且只有全部 destination accepted 后才允许事件级清理。

---

## 3. CONFIRMED_CLOSURES

以下条款已给出足以实现和验收的闭环：

1. **handoff 单写者核心**：`owner_leases` 单行 epoch CAS、handoff CAS 的 `owner_epoch` 递增与 `RETURNING owner_epoch` 的 row-count 断言，在旧 holder 遵守锁序且 handoff 不抢锁的前提下可保证线性化点唯一（`CONFIRMED_SPEC_CLOSURE`）。
2. **handoff 水位原子性**：`committed_watermarks` 在 handoff CAS 同一事务记录，且旧 holder 先锁 `owner_leases` 再写 `stream_heads`，子查询结果不会被并发的旧 holder 写覆盖（`CONFIRMED_SPEC_CLOSURE`，条件见 A-3）。
3. **超时 transferring 回收**：只要新 holder 在激活 CAS 成功前不读写，recovery CAS 等待行锁，不存在旧 holder 与新 holder 并发 active writer（`CONFIRMED_SPEC_CLOSURE`）。
4. **receipt admission 快照写入点**：三类 epoch 列在 admission INSERT 时写入，与执行阶段分离，构成授权线性化点（`CONFIRMED_SPEC_CLOSURE`，B-1）。
5. **admission 快照与 plan_attempt 推进**：`plan_attempt` CAS 不修改 admission epoch 列；重规划不会改写 admission 授权锚点（`CONFIRMED_SPEC_CLOSURE`，B-2）。
6. **Saga dedupe_key 作用域**：`UNIQUE (realm_id, saga_id, dedupe_key)` 正确约束 dedupe_key 仅在 saga 内生效（`CONFIRMED_SPEC_CLOSURE`，C-1）。
7. **fx_snapshots 与经济 ledger 结构**：独立不可变表、journal FK、fee/tax/rounding account_class 枚举符合 FL-07 要求（`CONFIRMED_SPEC_CLOSURE`，D-1、D-2）。
8. **snapshot builder 一致切面**：REPEATABLE READ 只读事务读取全部 `stream_heads` 与 payload，不依赖 cut marker，可保证每条 stream 的 watermark 与数据同切面（`CONFIRMED_SPEC_CLOSURE`，D-4）。
9. **placement CAS 唯一单调 epoch**：单行 UPDATE `owner_epoch = owner_epoch + 1` 在单权威 DB 下唯一成功（延续 v2.2 裁决，不再重审）。
10. **多 owner 全局锁序**：receipt → owner_leases → heads → domain rows 的规范顺序可消除循环等待（延续 v2.2 裁决）。
11. **M_max 只做 admission**：`atomicity_class` 禁止容量阈值擅自改业务原子性（延续 v2.2 裁决）。

---

## 4. P0 / P1 FINDINGS（按严重度）

### P0

#### P0-1 FL-13 受管制命令 commit-point 复核存在撤销后提交竞态

- **分类**：`FACT_ERROR`（规范声称“普通读即可”与数据库事实不符），后果为授权破坏。
- **位置**：`成熟SLG后端参考架构-v2.3.html` 第 1622 行。
- **场景**：见 B-4 反例。
- **风险**：支付/管理员/权限授予类命令在权限撤销后仍可提交，造成资金、权限或数据不一致。
- **最小修订**：使用 `SELECT ... FOR UPDATE` 或 terminal receipt UPDATE CAS 谓词包含当前 epoch 断言。
- **验收证据**：M5 退出门禁要求“撤销 × admission × commit × plan_attempt 重授权全时序交叉 ×100，受管制命令 stale-commit 计数 = 0”。

### P1

#### P1-1 handoff 最终 fencing 的 `statement_timestamp()` 在锁等待后不再反映实际锁获取时刻

- **分类**：`UNDER_SPECIFIED`。
- **位置**：`成熟SLG后端参考架构-v2.3.html` 第 1166-1176 行。
- **场景**：见 A-1 反例。
- **风险**：drain_deadline / lease_until 作为 fencing 边界的可验收性被削弱；极端慢命令可把旧 holder 写窗口延后到 recovery 预期之外。
- **最小修订**：改用 `clock_timestamp()` 或在获得锁后二次检查。

#### P1-2 `transferring → active` 激活超时未在 SQL/DDL 中闭合

- **分类**：`UNDER_SPECIFIED`。
- **位置**：`成熟SLG后端参考架构-v2.3.html` 第 1154-1162 行。
- **场景**：见 A-2 反例。
- **风险**：owner 可能长期停留在 `transferring`，影响可用性与调度。
- **最小修订**：增加 `transfer_deadline` 列、激活 CAS 谓词、recovery 触发 SLA。

#### P1-3 admission epoch 快照列缺少不可变性 enforcement

- **分类**：`UNDER_SPECIFIED`。
- **位置**：`command_receipts` DDL 第 1200-1202 行、第 1191-1218 行。
- **场景**：恶意或缺陷代码在命令终态后 UPDATE `admission_authz_epoch` 等列，破坏授权证据链。
- **风险**：审计与撤销证据不可信。
- **最小修订**：增加 BEFORE UPDATE 触发器，拒绝修改 admission epoch 列；或改为 generated/stored 列。

#### P1-4 Saga 迟到/重复 confirm 语义自相矛盾

- **分类**：`SPEC_CONTRADICTION`。
- **位置**：`成熟SLG后端参考架构-v2.3.html` 第 1007 行；`当前实现迁移路线图-v2.3.md` 第 188 行；DDL 注释第 1424 行。
- **场景**：见 C-2 反例。
- **风险**：实现方无法唯一确定行为，验收标准不唯一。
- **最小修订**：统一语义并同步文字与 DDL 注释。

#### P1-5 plan_attempt 推进谓词与 FK 错误通道不一致

- **分类**：`UNDER_SPECIFIED`。
- **位置**：`command_receipts` DDL 第 1216-1218 行；推进 CAS 第 1225-1228 行。
- **场景**：见 C-3 反例。
- **风险**：应用层把 FK 异常误判为竞争或数据损坏。
- **最小修订**：推进 receipt 与新 plan 插入同一事务；或显式预检查 plan 存在。

#### P1-6 Saga “幂等返回原结果”缺少存储载体

- **分类**：`UNDER_SPECIFIED`。
- **位置**：`saga_steps` DDL 第 1401-1417 行。
- **场景**：重复消息命中 dedupe_key 后，表中没有列保存首次结果。
- **风险**：规范要求不可唯一实现与测试。
- **最小修订**：增加 `result_payload JSONB`、`result_status TEXT` 等列。

#### P1-7 部分退款上限谓词缺少精确 SQL 与并发序列化

- **分类**：`UNDER_SPECIFIED`（实现错误可造成 P0 级资金损失）。
- **位置**：`成熟SLG后端参考架构-v2.3.html` 第 1374-1379 行。
- **场景**：见 D-3 反例。
- **风险**：超额退款破坏货币守恒。
- **最小修订**：定义原始金额口径、使用 `FOR UPDATE` 或版本 CAS。

#### P1-8 外部 destination durable accept 证据无 typed schema

- **分类**：`UNDER_SPECIFIED`。
- **位置**：`outbox_events` DDL 第 1291-1302 行；架构第 1068 行。
- **场景**：见 D-5 反例。
- **风险**：外部 accept 不可审计，容量合同 evaluator 无法复算。
- **最小修订**：增加 `external_accept_credential JSONB` 等列。

#### P1-9 `cleanupConservation` 与 outbox “短期 relay spool” 的边界模糊

- **分类**：`UNDER_SPECIFIED`。
- **位置**：`容量合同-v2.3.schema.json` 第 589-599 行；架构第 1068 行。
- **场景**：若 evaluator 把 outbox 清理计入 `cleanupConservation`，则“目标 durable accept 后清理 outbox” 与 PASS 合同的 `cleanupCount=0` 冲突。
- **风险**：容量 gate 语义不唯一。
- **最小修订**：明确 `cleanupConservation` 仅统计权威 receipt/job/event/cursor 的强制删除；outbox relay spool 清理不计入。

---

## 5. INVALID_ATTACKS_REJECTED

以下攻击因违反纪律或事实错误而被驳回：

1. **“当前 SQLite `owner_locks` 没有 `owner_epoch`，所以 v2.3 规范错误”** → 这是 `IMPLEMENTATION_ONLY_GAP`，规范本身不自相矛盾（纪律第 4、9 条）。
2. **“`CommandCommitter.commit()` 先写状态再 `recordResult()`，违反 D1”** → 当前实现两步提交是 M1 已登记的 `IMPLEMENTATION_ONLY_GAP`，不是规范反例（三轮新增裁决第 14 条）。
3. **“当前代码没有 `owner_leases`、`command_receipts`、Saga、ledger、restore_runs，因此 v2.3 不可行”** → 规范目标表缺失 = `IMPLEMENTATION_ONLY_GAP`；不得因此降低目标标准（纪律第 4 条）。
4. **“placement handoff 需要应用层 leader election”** → 单权威 DB 上单行 CAS 已足够（纪律第 10 条）。
5. **“admission 前没有 receipt，网络重投会重复执行”** → admission 已先写 `in_progress`；真实故障是残留 `COMMAND_IN_FLIGHT`（三轮新增裁决第 12 条）。
6. **“snapshot 必须提供跨 stream 原子 cut”** → 规范明确 snapshot 只保证每条 stream 自身与其 watermark 衔接，不承诺跨 stream 一致 cut（架构 P6）。
7. **“GDPR/删除权与 ledger 不可变矛盾”** → 应审查法定保留、去标识化与访问政策，不是天然逻辑矛盾（纪律第 5 条）。
8. **“一种客户端状态应用机制等于一条全局 stream”** → 规范明确“一种机制 ≠ 一条 stream”（纪律第 6 条）。
9. **“当前实现无 M_max 限制，故规范 M_max 无效”** → 实现差距不构成规范矛盾。
10. **“合服迁移完全未给方案，应立 P0”** → v2.3 已标注为专项设计债，按纪律不以“完全未给方案”立 P0。

---

## 6. REQUIRED_DDL_AND_TRANSACTION_REVISIONS

### A / handoff

1. 将最终 fencing 谓词中的时间检查改为基于锁获取时刻：
   ```sql
   -- 推荐方案 1：使用 clock_timestamp()
   SELECT owner_epoch
   FROM owner_leases
   WHERE realm_id = :realm AND owner_key = :owner
     AND holder_id = :holder AND owner_epoch = :epoch
     AND lease_until > clock_timestamp()
     AND (state = 'active'
          OR (state = 'draining' AND handoff_id = :handoff_id
              AND clock_timestamp() < drain_deadline))
   FOR UPDATE;
   -- assert rows = 1
   ```
2. 增加 `transfer_deadline` 列并纳入激活与 recovery CAS：
   ```sql
   ALTER TABLE owner_leases ADD COLUMN transfer_deadline TIMESTAMPTZ;
   -- activation CAS
   UPDATE owner_leases
   SET state = 'active', lease_until = :new_lease, updated_at = now()
   WHERE realm_id = :realm AND owner_key = :owner
     AND state = 'transferring' AND holder_id = :new_holder
     AND owner_epoch = :new_epoch
     AND transfer_deadline > clock_timestamp()
   RETURNING owner_epoch;
   -- recovery CAS（回滚旧 holder）
   UPDATE owner_leases
   SET state = 'active', holder_id = :old_holder, handoff_id = NULL,
       transfer_to = NULL, transfer_deadline = NULL, updated_at = now()
   WHERE realm_id = :realm AND owner_key = :owner
     AND state = 'transferring'
     AND transfer_deadline < clock_timestamp();
   ```
3. 在 runbook 中定义 recovery 扫描周期与告警阈值，并提供可观测指标（`owner_leases.state='transferring' age > threshold`）。

### B / receipt epoch 快照

1. 为 admission epoch 列增加不可变性触发器：
   ```sql
   CREATE OR REPLACE FUNCTION command_receipts_immutable_admission_epoch()
   RETURNS TRIGGER AS $$
   BEGIN
     IF NEW.admission_credential_version IS DISTINCT FROM OLD.admission_credential_version
        OR NEW.admission_session_epoch IS DISTINCT FROM OLD.admission_session_epoch
        OR NEW.admission_authz_epoch IS DISTINCT FROM OLD.admission_authz_epoch THEN
       RAISE EXCEPTION 'admission epoch columns are immutable after admission';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   CREATE TRIGGER trg_command_receipts_immutable_admission_epoch
     BEFORE UPDATE ON command_receipts
     FOR EACH ROW EXECUTE FUNCTION command_receipts_immutable_admission_epoch();
   ```
2. 受管制命令 commit-point 复核必须锁定 sessions 行：
   ```sql
   -- 在领域事务内
   SELECT credential_version, session_epoch, authz_epoch
   FROM sessions
   WHERE session_id = :session_id
   FOR UPDATE;
   -- 断言与 receipt 快照一致，不一致则 RAISE。
   ```
   或采用 CAS 方案：
   ```sql
   UPDATE command_receipts
   SET status = 'committed', result = :result, terminal_at = now()
   WHERE realm_id = :realm AND command_id = :command_id
     AND status = 'in_progress' AND execution_token = :token
     AND plan_attempt = :plan_attempt
     AND EXISTS (
       SELECT 1 FROM sessions
       WHERE session_id = :session_id
         AND credential_version = :admission_credential_version
         AND session_epoch = :admission_session_epoch
         AND authz_epoch = :admission_authz_epoch
     );
   -- assert rows = 1
   ```

### C / Saga dedupe 与 plan_attempt

1. 统一迟到 confirm 语义并在规范与 DDL 注释中同步。
2. 在 `saga_steps` 增加结果存储列：
   ```sql
   ALTER TABLE saga_steps ADD COLUMN result_status TEXT;
   ALTER TABLE saga_steps ADD COLUMN result_payload JSONB;
   ```
3. `plan_attempt` 推进必须与 `command_execution_plans` 插入在同一事务，或使用显式 plan 存在性检查：
   ```sql
   BEGIN;
   INSERT INTO command_execution_plans (...)
   VALUES (:realm, :command_id, :next_attempt, ...);
   UPDATE command_receipts
   SET plan_attempt = :next_attempt
   WHERE realm_id = :realm AND command_id = :command_id
     AND plan_attempt = :current AND status = 'in_progress'
     AND execution_token = :token;
   -- assert rows = 1, else ROLLBACK
   COMMIT;
   ```

### D / ledger / outbox

1. 部分退款上限精确化：
   ```sql
   -- 退款事务开头锁原 journal
   SELECT * FROM economy_journals
   WHERE realm_id = :realm AND journal_id = :original_journal_id
   FOR UPDATE;
   -- 计算已退金额（按 currency / account_class）
   SELECT currency, account_class, SUM(delta) AS refunded
   FROM economy_ledger_entries le
   JOIN economy_journals j ON le.realm_id = j.realm_id AND le.journal_id = j.journal_id
   WHERE j.realm_id = :realm AND j.reversal_of = :original_journal_id
   GROUP BY currency, account_class;
   -- 断言 refunded + :this_refund <= original_line_amount
   ```
2. 为 `economy_journals` 增加按 currency 的已退金额原子列，或使用版本 CAS 防止并发超退。
3. `outbox_events` 增加外部 accept 证据列：
   ```sql
   ALTER TABLE outbox_events
   ADD COLUMN external_accept_credential JSONB,
   ADD COLUMN accepted_at TIMESTAMPTZ;
   ```
4. 明确 `finalState.cleanupConservation` 不计入 outbox relay spool 的正常清理；仅统计权威数据（receipt/job/authoritative event/cursor）的强制删除。

### 跨切割 / restore_runs（本席关注点为数据一致性）

1. `restore_runs` 单例准入应使用 `INSERT ... ON CONFLICT DO NOTHING` 或显式 advisory lock，把 partial unique index 的 unique violation 规范化为“0 行 = 已存在非终态 run”：
   ```sql
   INSERT INTO restore_runs (restore_id, status, current_step, ...)
   SELECT :restore_id, 'RUNNING', 'REQUESTED', ...
   WHERE NOT EXISTS (
     SELECT 1 FROM restore_runs
     WHERE status NOT IN ('COMPLETED','ABORTED')
   )
   ON CONFLICT ON CONSTRAINT restore_runs_single_nonterminal DO NOTHING;
   -- rows = 0 => 已存在非终态 run
   ```

---

## 7. REQUIRED_FAILURE_INJECTION_MATRIX

| ID | 场景 | 目标条款 | 注入点 | 期望结果（修正后） | 当前规范是否可验收 |
|----|------|----------|--------|-------------------|-------------------|
| F-A1 | 多 owner 命令最终 fencing 语句在锁等待中跨越 `drain_deadline` | A-1 | 让其它 owner 锁持有到 deadline 之后 | 该命令因 `clock_timestamp() >= drain_deadline` 回滚 | 否 |
| F-A2 | 新 holder 在 handoff 后 pause 超过 `transfer_deadline` | A-2 | 在激活 CAS 前暂停/崩溃新 holder | recovery 将 owner 回滚旧 holder 或推进新 epoch | 否 |
| F-A3 | handoff CAS 与旧 holder in-flight 事务并发 | A-3 | 旧 holder 持有 owner_leases 锁并写 stream_events | `committed_watermarks` 包含旧 holder 已提交事件 | 附条件 |
| F-B1 | 受管制命令 admission 后、commit 前权限撤销 | B-4 | 撤销写方在领域事务读取 sessions 后、COMMIT 前提交 | 命令终态为 `AUTH_EPOCH_STALE`，无领域写入 | 否 |
| F-B2 | 尝试 UPDATE receipt 的 admission epoch 列 | B-3 | 在终态后修改 `admission_authz_epoch` | 触发器拒绝 | 否 |
| F-C1 | 重复 confirm 消息在 saga completed 后到达 | C-2 | 同一 dedupe_key 的 confirm 重投 | 行为唯一：返回原结果或明确失败 | 否（语义冲突） |
| F-C2 | plan_attempt 推进时新 plan 行缺失 | C-3 | 不插入新 plan 行直接 UPDATE receipt | 优雅 re-plan，不抛 FK 异常 | 否 |
| F-C3 | 重复 saga 消息命中 dedupe_key | C-4 | 同一 dedupe_key 消息重投 | 返回首次记录的 `result_payload` | 否（无列） |
| F-D1 | 两笔并发部分退款总申请超过原金额 | D-3 | 同时启动两笔退款事务 | 第二笔因上限谓词失败，ledger 守恒 | 否 |
| F-D2 | 外部 destination ack 到达后清理 outbox | D-5 | 外部系统返回 ack id | `external_accept_credential` 可查询；全 destinations accepted 后清理 | 否 |
| F-D3 | snapshot builder 期间并发写 stream_events | D-4 | 在 RR 快照事务读取 heads 后提交新事件 | snapshot watermarks 与 payload 一致；客户端后续从 watermark+1 续传无重复 | 是 |
| F-OLD1 | 命令 owner 数超过 `M_max` | M_max | admission 时 owner_set 大小 > M_max | 拒绝 admission 或 reshape，不自动转 Saga | 是 |
| F-OLD2 | 多 owner 命令锁序错误 | C3 | 以非规范顺序锁定 owner_leases | 死锁被检测/无数据破坏 | 是 |
| F-OLD3 | 旧 job lease token 在 lease 过期后尝试完成 | D6 | 暂停 worker 让 lease 过期，再用旧 token 完成 | `leased -> completed` CAS 影响 0 行，事务回滚 | 附条件 |
| F-OLD4 | 并发为同一 stream 分配 seq | D2/D3 | 两事务同时插入 `stream_events` | 无重复 `stream_seq`，PK/Unique 冲突触发重试 | 是 |

---

## 8. BLOCKING_QUESTIONS

以下问题在 v2.4 修订前必须回答，否则实现方无法唯一实现且 evaluator 无法给出唯一判定：

1. **A-1 handoff 时钟源**：placement recovery 的 handoff CAS 是否允许使用 `NOWAIT`/`SKIP LOCKED`？若允许，A-1 的 statement_timestamp 窗口会从 P1 升级为 P0 单写者破坏；若不允许，规范应明确 handoff CAS 必须等待旧 holder 行锁释放。
2. **A-2 激活超时**：`transfer_deadline` 的值由谁决定？placement handoff CAS 写入还是新 holder 本地计算？recovery 扫描周期和告警 SLA 是多少？
3. **B-4 commit-point 复核**：受管制命令的 commit-point 复核是否允许在只读副本上执行？若允许，如何提供线性化读证据？
4. **C-2 Saga 语义**：重复 confirm 在 completed/compensating 后是“幂等返回原结果”还是“失败”？请二选一并在架构、DDL 注释、测试 fixture 中保持一致。
5. **D-3 退款口径**：部分退款上限的“原始 journal 金额”是指该 currency 下所有 ledger lines 的绝对值之和，还是仅 `account_class='player_available'` 的借记净额？跨 currency 退款是否按 valuation currency 统一封顶？
6. **D-5 outbox 清理**：`finalState.cleanupConservation` 是否包含 `outbox_events` 在 durable accept 后的正常清理？若包含，如何与“短期 relay spool”语义共存？
7. **B-3 快照不可变性**：admission epoch 列是“逻辑不可变”（由应用层保证）还是“DB 触发器强制不可变”？后者才能通过 schema-level mutation test。

---

*报告完成。只读操作，未修改任何产品代码、文档、schema 或配置。*
