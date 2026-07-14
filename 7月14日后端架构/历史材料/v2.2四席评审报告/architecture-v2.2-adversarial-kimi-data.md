# KIMI 数据、事务、所有权与经济一致性红队报告 —— wxgame 参考架构 v2.2 第三轮对抗审查

> 报告席：KIMI（数据架构 / 并发控制 / 工作流 / 经济账务）  
> 输入：`7月14日后端架构/成熟SLG后端参考架构-v2.2.html`、`容量合同-v2.2.schema.json`、`容量合同判定器规范-v2.2.md`、`当前实现迁移路线图-v2.2.md` 及必要的当前代码只读核对  
> 输出：`tmp/architecture-v2.2-adversarial-kimi-data.md`  
> 本报告严格遵循《架构v2.2四席对抗审核提示词.md》的“共同事实与裁决纪律”，未读取任何其他席报告。

---

## 1. DATA_V2_2_VERDICT

`REFERENCE_V2_2_STATUS = NOT_PROVEN`。

v2.2 在 ownership、原子 receipt、事务边界、Saga/ledger 等高层方向上已经形成了可被实现和验收的**意图**，但多个 P0 路径缺少可被执行、可被数据库语义唯一验证的具体事务约定。具体表现为：

1. **Placement/handoff 的线性化点、draining holder 的提交谓词、新 holder 的激活步骤未闭合**；提供的示例 SQL 不足以阻止旧 epoch 在并发 handoff 后提交。
2. **最终 fencing 所需的 `SELECT ... FOR UPDATE`、行数断言、锁序和租约/head 的完整集合未在规范 SQL 中显式给出**；示例 `UPDATE aggregate_heads ... FROM owner_leases` 在 PostgreSQL 语义下不会锁住 `owner_leases` 源行。
3. **命令恢复所有权（admission / execution lease / recovery guardian / terminal receipt）的精确事务边界和 guardian 自身租约未完全规定**。
4. **`command_execution_plans` 与 `command_receipts` 之间的版本约束、动态 owner 重规划的幂等路径未完全闭合**。
5. **`scheduled_jobs` 完成 CAS 与领域写的顺序、行数断言未明确**。
6. **Saga 的 `dedupe_key` 作用域、reserve/confirm/compensate 的精确状态谓词、资源守恒账户未完全规定**。
7. **premium ledger 的 FX 快照、部分退款、拒付坏账、手续费/税费、未知外部结果等缺少账户分类和状态机**。
8. **合服/拆服的 realm/zone/owner/stream/cursor/receipt/Saga/ledger 迁移 cut 完全未给出可执行方案**。

当前实现 (`CURRENT_IMPLEMENTATION = NON_CONFORMING`) 以 `owner_locks` 表、`command_idempotency` 表、两步提交 (`CommandCommitter.commit` 后再 `recordResult`) 运行，尚未到达 v2.2 目标语义；本次审查把这些记录为 `IMPLEMENTATION_ONLY_GAP`，不因此降低规范标准。

**结论**：v2.2 尚未达到 `ACCEPT_FOR_IMPLEMENTATION`。存在可修复的规范级 P0 缺口，建议先回答第 7 节阻塞问题并补充第 5 节 DDL/事务修订后，再进入下一轮交叉质询。

---

## 2. CONFIRMED_CLOSURES

以下机制在 v2.2 中已有足够的高层闭环，只要按本报告第 5 节补齐 SQL/事务语义即可验收。均标记为 `CONFIRMED_SPEC_CLOSURE`。

| 机制 | 来源 | 分类 | 说明 |
|---|---|---|---|
| 稳定 `commandId` + `(session_id, client_seq)` 唯一键作为网络幂等基础 | `成熟SLG后端参考架构-v2.2.html:1160-1181` | CONFIRMED_SPEC_CLOSURE | DDL 已给出 UNIQUE；同一 commandId 不同 payload 必须永久拒绝。 |
| 单 owner mailbox 串行化：每笔写事务验证 `owner_epoch` 与版本 | `成熟SLG后端参考架构-v2.2.html:759-766` | CONFIRMED_SPEC_CLOSURE | 只要持锁到 COMMIT 并校验 epoch，即可保证单写者。 |
| Placement 通过数据库单行 CAS 分配新 epoch | `成熟SLG后端参考架构-v2.2.html:1135-1142` | CONFIRMED_SPEC_CLOSURE | 同一行上的 `UPDATE ... WHERE owner_epoch = :observed_epoch` 在任意隔离级别下只会有一个成功者。 |
| `M_max` 只做 admission，不得改变业务原子语义 | `成熟SLG后端参考架构-v2.2.html:765, 1003, 1007` | CONFIRMED_SPEC_CLOSURE | 规则明确；实现时必须把超限原子命令计入 reject，不能自动转 Saga。 |
| 短期 outbox 与 durable stream retention 职责分离 | `成熟SLG后端参考架构-v2.2.html:1261-1264` | CONFIRMED_SPEC_CLOSURE | 职责已分清；需补充“durable accept”判定标准。 |
| 消费者 cursor 缺口检测、DLQ、有序重放 | `成熟SLG后端参考架构-v2.2.html:778` | CONFIRMED_SPEC_CLOSURE | 设计正确；需保证 cursor 与 inbox_receipt 同事务。 |
| 经济 ledger append-only、按 currency 守恒 | `成熟SLG后端参考架构-v2.2.html:779, 1269-1304` | CONFIRMED_SPEC_CLOSURE | 方向正确；但 DDL 缺少 FX/退款/拒付/手续费/税费字段。 |
| Release manifest 锁定后端/前端/配置/DB schema/协议/事件 schema 六类 digest | `成熟SLG后端参考架构-v2.2.html:791-796, 1725-1738` | CONFIRMED_SPEC_CLOSURE | 设计正确；需与容量合同、恢复证据形成 digest 链。 |
| expand-migrate-contract 三阶段政策 | `当前实现迁移路线图-v2.2.md:23-29, 111-123` | CONFIRMED_SPEC_CLOSURE | 政策明确；缺少跨版本兼容矩阵与证据要求。 |

---

## 3. P0/P1 FINDINGS

### P0-1 Placement/handoff 线性化点与 draining holder 提交谓词缺失

- **分类**：`UNDER_SPECIFIED`（示例 SQL 与文字规则若按字面理解会构成 `SPEC_CONTRADICTION`）
- **严重度**：P0
- **被攻击条款**：Owner Handoff Rule（`成熟SLG后端参考架构-v2.2.html:998-1000`）、C6（`成熟SLG后端参考架构-v2.2.html:764-765`）、示例 SQL（`成熟SLG后端参考架构-v2.2.html:1135-1154`）
- **前置条件**：
  - owner `O` 当前 epoch = 5，holder = `H_old`，state = `active`。
  - placement 发起 handoff，设置 `state='draining'`，`drain_deadline = T`。
  - `H_old` 上有一条或多条 in-flight 命令，已锁定 receipt/lease/head，尚未 COMMIT。
- **精确时间线/事务边界**：
  1. `t0`：`H_old` 的领域事务已 `SELECT ... FOR UPDATE` 锁定 `command_receipts` 与 `owner_leases`（若按规范）。
  2. `t1`：`T - epsilon`：placement recovery 或新 holder 在 deadline 前/后尝试 CAS，把 `owner_epoch` 升到 6 并写入 `transfer_to`。
  3. `t2`：`H_old` 执行最终 fencing 的 aggregate 更新。示例 SQL 要求 `l.state = 'active'`，但此时 `O.state` 已经是 `draining` 或 `transferring`。
- **数据库隔离与锁假设**：READ COMMITTED + 行锁。示例 SQL 中的 `UPDATE aggregate_heads ... FROM owner_leases` 不会锁住 `owner_leases` 源行（见 P0-2）。
- **违反的不变量**：
  - 若最终 fencing 严格要求 `state='active'`，则所有 in-flight 命令在 draining 期间都无法提交，与“draining 拒绝新 admission、旧 holder 仍可提交 in-flight”的规则冲突。
  - 若最终 fencing 不检查 `state`，则旧 epoch 可能在 handoff CAS 之后仍可提交，造成双写者。
- **为什么现有文字挡不住**：规则说“旧 holder 的每笔事务在 COMMIT 前持有 lease 行锁并最终校验”，但没有给出“最终校验”的谓词；示例 SQL 使用 `l.state='active'`，直接把 draining 中的 in-flight 事务判为非法。新 holder 如何从 `transferring` 进入 `active`、如何继承 `committed_watermarks` 也未规定。
- **最小修订**：
  1. 明确最终 fencing 谓词：`(l.state='active' OR (l.state='draining' AND l.handoff_id=:handoff_id AND statement_timestamp() < l.drain_deadline)) AND l.owner_epoch=:epoch AND l.holder_id=:holder AND l.lease_until > statement_timestamp()`。
  2. handoff CAS 应把 `state` 置为 `active` 或显式拆成“transferring -> active”激活步骤并带超时/恢复。
  3. `committed_watermarks` 必须在线性化点原子记录并由新 holder 读取。
- **可执行验收证据**：故障注入矩阵 #1/#2；双 placement 实例并发 handoff 只产生唯一递增 epoch；draining holder 在 deadline 前可提交、deadline 后提交影响 0 行并回滚。

---

### P0-2 最终 fencing 示例 SQL 未锁住 `owner_leases` 源行

- **分类**：`UNDER_SPECIFIED`
- **严重度**：P0
- **被攻击条款**：C1、C6、示例 SQL（`成熟SLG后端参考架构-v2.2.html:1146-1154`）
- **前置条件**：
  - 旧 holder `H_old` 持有 epoch 5 的 `owner_leases` 行锁（自以为）。
  - placement 并发发起 handoff，试图把 epoch 升到 6。
- **精确时间线/事务边界**：
  1. `H_old` 的领域事务执行 `UPDATE aggregate_heads h SET ... FROM owner_leases l WHERE ... l.owner_epoch=5 ...`。该语句使用事务开始时的快照读取 `owner_leases`。
  2. 在 `H_old` 的 UPDATE 语句执行后、`COMMIT` 前，placement handoff 的 `UPDATE owner_leases SET owner_epoch=6 ...` 执行并提交（因为 `owner_leases` 行未被 `H_old` 锁定）。
  3. `H_old` 的 `aggregate_heads` UPDATE 基于 epoch 5 的快照成功返回一行，随后 `COMMIT`。
- **数据库隔离与锁假设**：PostgreSQL READ COMMITTED。`UPDATE ... FROM` 的 `FROM` 表不会被加锁。
- **违反的不变量**：同一 owner 在 epoch 已递增后仍被旧 holder 写成功，破坏“每个可变 aggregate 只有当前 `owner_epoch` 的 holder 可写”。
- **为什么现有文字挡不住**：规范注释说“SELECT the lease FOR UPDATE first”，但紧接着给出的可验收示例 SQL 没有这个步骤，且未说明“若未 FOR UPDATE 则该反例成立”。
- **最小修订**：
  1. 在领域事务最前面、任何 domain 写之前，按全局规范键序对所有 `owner_leases`、`aggregate_heads`、`stream_heads` 执行 `SELECT ... FOR UPDATE`。
  2. 所有条件更新必须检查返回行数；影响 0 行时显式 `ROLLBACK`。
- **可执行验收证据**：故障注入矩阵 #2；旧 epoch 事务在 handoff CAS 后提交必须失败。

---

### P0-3 命令恢复所有权：receipt 锁、terminal receipt 与领域写的事务边界未完全闭合

- **分类**：`UNDER_SPECIFIED`（当前实现为 `IMPLEMENTATION_ONLY_GAP`）
- **严重度**：P0
- **被攻击条款**：D1（`成熟SLG后端参考架构-v2.2.html:775-776`）、实现注释（`成熟SLG后端参考架构-v2.2.html:917-918`）、`CommandCommitter.js:50-112`（当前代码两步提交）
- **前置条件**：
  - 命令已 admission 为 `accepted`；执行者以 CAS 写入 `in_progress(token, lease_until)`。
  - 执行者进入领域事务。
- **精确时间线/事务边界**：
  1. 执行者先写领域行（或 `command_idempotency` 状态），再写 terminal receipt。
  2. 如果 terminal receipt 写入失败或发生在另一个事务，领域已提交但 receipt 非终态。
- **数据库隔离与锁假设**：若 terminal receipt 与领域写不在同一事务，则无论何种隔离级别都无法禁止“领域已提交、receipt 仍 in_progress”。
- **违反的不变量**：v2.2 明确禁止“领域写入已提交但 receipt 非终态”。
- **为什么现有文字挡不住**：规范文字要求“terminal receipt 与领域事务原子提交”，但没有给出 SQL/事务顺序；当前实现 `CommandCommitter.commit()` 与 `recordResult()` 是两个独立语句/事务。
- **最小修订**：
  1. 领域事务开头 `SELECT * FROM command_receipts WHERE (realm_id, command_id)=... AND status='in_progress' AND execution_token=:token FOR UPDATE`。
  2. 所有领域写之后执行 `UPDATE command_receipts SET status='committed'... WHERE ... execution_token=:token AND status='in_progress'`；返回行数 ≠ 1 则回滚。
  3. recovery guardian 自身必须先 CAS 获得一个 guardian lease，再尝试接管过期 token。
- **可执行验收证据**：故障注入矩阵 #4；崩溃在 COMMIT 前/后/UNKNOWN 时，恢复后不存在“领域已提交但 receipt 非终态”。

---

### P0-4 `command_execution_plans` 与动态 owner 重规划的可审计性、幂等性、ABA 风险

- **分类**：`UNDER_SPECIFIED`
- **严重度**：P0
- **被攻击条款**：Owner Set Rule（`成熟SLG后端参考架构-v2.2.html:1002-1003`）、`command_execution_plans` 表（`成熟SLG后端参考架构-v2.2.html:1061`）
- **前置条件**：
  - 命令 `C` 在 admission 时 plan_attempt=1，owner_set={A,B}。
  - 执行时发现未声明的 owner C。
- **精确时间线/事务边界**：
  1. 执行事务回滚。
  2. 必须生成 plan_attempt=2，owner_set={A,B,C}，并更新 `command_receipts.plan_attempt`。
  3. 如果重试时 receipt 仍指向 plan_attempt=1，执行会再次失败并循环。
- **数据库隔离与锁假设**：无 FK/CHECK 强制 receipt 与 plan 一致。
- **违反的不变量**：命令无法收敛；或不同执行者基于不同 plan_attempt 并行执行，违反 owner 锁定原子性。
- **为什么现有文字挡不住**：规范说“重新授权并以同一 commandId 生成新 execution plan”，但未规定 receipt 如何选择 plan_attempt、如何标记旧 plan 为 superseded、如何防止 ABA（例如 plan_attempt 2 的 owner_set_hash 与 1 相同但 expectedVersion 来源已变）。
- **最小修订**：
  1. `command_receipts` 增加 `plan_attempt` 并对 `command_execution_plans (realm_id, command_id, plan_attempt)` 加 FK。
  2. 执行时必须按 receipt 的当前 `plan_attempt` 读取 plan；plan 不可变；旧 plan 由 `superseded_by` 指向新 plan_attempt。
  3. `owner_set_hash` 必须按规范键排序后哈希，保证相同集合产生唯一 hash。
- **可执行验收证据**：故障注入矩阵 #3；动态 owner 发现后重试恰好一次成功，plan_attempt 单调递增。

---

### P0-5 `scheduled_jobs` 完成 CAS 与领域写的顺序及行数断言缺失

- **分类**：`UNDER_SPECIFIED`
- **严重度**：P0
- **被攻击条款**：D6（`成熟SLG后端参考架构-v2.2.html:780-781`）、`scheduled_jobs` 示例 SQL（`成熟SLG后端参考架构-v2.2.html:1193-1224`）
- **前置条件**：
  - job `J` 被实例 `E` 以 token `T`、epoch `e` claim。
  - `E` 的领域事务已执行部分领域写。
- **精确时间线/事务边界**：
  1. `E` 先执行 `UPDATE scheduled_jobs SET status='completed' WHERE lease_token=T AND lease_epoch=e`（成功）。
  2. 在剩余领域写执行前，scheduler 因 `E` 的 lease 到期或 steal 把 `lease_token` 改为 `T2`。
  3. `E` 继续提交剩余领域写并 COMMIT —— 领域效果归属于已被偷走的 job。
- **数据库隔离与锁假设**：READ COMMITTED；若条件更新不放在最后且无行数断言，则被偷 lease 后仍可提交。
- **违反的不变量**：job 被重复推进或效果归属错误。
- **为什么现有文字挡不住**：规范只说“条件更新影响 0 行整体回滚”，但未强制“条件更新必须是事务中最后一条写语句”，也未给出明确的 `row_count() = 1` 断言。
- **最小修订**：
  1. 领域事务中所有领域写必须在 `UPDATE scheduled_jobs SET status='completed' ... WHERE lease_token=:token AND lease_epoch=:epoch` 之前。
  2. 该 UPDATE 必须作为事务的最后一条写语句；返回行数 ≠ 1 时抛出并回滚。
  3. claim 也必须使用 `SELECT ... FOR UPDATE SKIP LOCKED` + 同一事务内的 `UPDATE`。
- **可执行验收证据**：故障注入矩阵 #5；lease steal 后原 executor 的完成 UPDATE 影响 0 行，事务回滚，无领域状态变化。

---

### P0-6 Saga `dedupe_key` 作用域错误与状态守卫不完整

- **分类**：`UNDER_SPECIFIED`（含 DDL 缺陷）
- **严重度**：P0
- **被攻击条款**：Saga Rule（`成熟SLG后端参考架构-v2.2.html:1006-1008`）、`saga_steps` DDL（`成熟SLG后端参考架构-v2.2.html:1325-1341`）
- **前置条件**：
  - 两个不同 saga `S1`、`S2` 都使用业务上常见的 dedupe_key，例如 `"confirm-payment-1001"`。
  - 或同一 saga 进入 `compensating` 后收到重复 confirm。
- **精确时间线/事务边界**：
  1. `S1` 插入 step `(saga_id=S1, dedupe_key="confirm-payment-1001")`。
  2. `S2` 尝试插入 step `(saga_id=S2, dedupe_key="confirm-payment-1001")` → 因 `UNIQUE(realm_id, dedupe_key)` 失败。
  3. 对于重复 confirm：`S1` 进入 `compensating` 后，confirm handler 若仍尝试插入 step，会触发 unique violation；若被当作错误处理，可能再次触发 compensate。
- **数据库隔离与锁假设**：DDL 唯一约束范围过宽。
- **违反的不变量**：无关 saga 互相阻塞；重复 confirm 可能破坏资源守恒或产生不一致状态。
- **为什么现有文字挡不住**：规范说“迟到 confirm 在 compensating/completed 后必须失败”，但没有说明失败语义（应幂等返回原结果还是报错）以及 `dedupe_key` 应以 saga 为作用域。
- **最小修订**：
  1. `saga_steps` 唯一键改为 `UNIQUE(realm_id, saga_id, dedupe_key)`；`command_id` 唯一键同样建议加上 `saga_id`。
  2. confirm/compensate handler 先 `SELECT ... FOR UPDATE saga_instances` 并检查 `state`/`version`；状态不符时直接返回已存储结果或明确拒绝。
  3. 对重复消息使用 `(saga_id, dedupe_key)` 查已有 step，返回存储结果，不做第二次业务动作。
- **可执行验收证据**：故障注入矩阵 #6；compensating 后重复 confirm 不改变资源总量，不新增 step。

---

### P0-7 Premium ledger 字段/状态/账户分类不足以覆盖拒付、部分退款、FX、手续费、税费

- **分类**：`UNDER_SPECIFIED`（含 DDL 与状态机缺陷）
- **严重度**：P0
- **被攻击条款**：D5（`成熟SLG后端参考架构-v2.2.html:779`）、`economy_journals` 与 `economy_ledger_entries` DDL（`成熟SLG后端参考架构-v2.2.html:1269-1304`）
- **前置条件**：
  - 玩家充值 USD 100，汇率 USD:GC = 1:10，到账 1000 GC。
  - 玩家消费 600 GC。
  - 玩家申请部分退款 USD 30；同时渠道对原 USD 100 交易发起拒付 USD 20（含 USD 2 渠道手续费）。
- **精确时间线/事务边界**：
  1. 充值：需要记录 FX 快照；当前 DDL 无 `fx_snapshot_id`。
  2. 消费：减少 `player_available` 600 GC，增加 `revenue` 600 GC。
  3. 部分退款 USD 30：需按原 FX 快照折算 GC 300，生成新 journal 并引用原 journal；当前 DDL 无 `reversal_of`。
  4. 拒付 USD 20：渠道只退净额 USD 18，扣 USD 2 手续费；玩家已消费 600 GC，剩余 400 GC，但拒付对应的 200 GC（按汇率）需要表达为 receivable/liability 坏账；当前 `account_class` 缺少 `fee_expense`、`tax_liability`，`state` 只有 `posted/reversed`，缺少 `pending/unknown`。
- **数据库隔离与锁假设**：缺少约束无法通过数据库阻止超退、FX 不平衡、手续费遗漏。
- **违反的不变量**：货币守恒、不可超退、FX 换算舍入一致、渠道费用可审计。
- **为什么现有文字挡不住**：规范说“append-only、per-currency 守恒、FX 使用不可变汇率快照”，但 DDL 没有 `fx_snapshot_id`、`reversal_of`、`pending` 状态，也没有手续费/税费账户。
- **最小修订**：
  1. `economy_journals` 增加 `reversal_of UUID FK`、`fx_snapshot_id UUID`、`state` 扩展为 `{pending, posted, reversed, chargeback, unknown}`。
  2. 新增 `fx_snapshots(realm_id, fx_snapshot_id, source_currency, target_currency, rate, source, recorded_at, valuation_currency)`。
  3. `economy_ledger_entries.account_class` 增加 `fee_expense`、`tax_liability`、`rounding`、`chargeback_provision`。
  4. 定义 FX 舍入方向、rounding 账户归属、部分退款上限（不得超过原 journal 未退金额）。
- **可执行验收证据**：故障注入矩阵 #7；并发 FX/退款/拒付后 per-currency ledger 余额为零，player_available 不为负（除非明确记为 receivable 坏账）。

---

### P0-8 Snapshot cut 与多 stream 水位一致性未闭合

- **分类**：`UNDER_SPECIFIED`
- **严重度**：P0
- **被攻击条款**：D2（`成熟SLG后端参考架构-v2.2.html:776-777`）、`stream_heads` 与 `player_read_snapshots`（`成熟SLG后端参考架构-v2.2.html:1045, 1071`）
- **前置条件**：
  - 一个事务同时向 `streamA` 和 `streamB` 写入事件，分别把 `committed_seq` 升到 100 和 200。
  - snapshot builder 在后台读取各 `stream_heads` 制作快照。
- **精确时间线/事务边界**：
  1. snapshot builder 先读 `streamA.head=100`。
  2. 另一个事务向 `streamA` 写 101，向 `streamB` 写 201 并提交。
  3. snapshot builder 再读 `streamB.head=201`。
  4. 生成的 snapshot 水印 `{A:100, B:201}` 不是同一个因果切面的水位。
- **数据库隔离与锁假设**：READ COMMITTED 下顺序读取无法得到一致切面。
- **违反的不变量**：`snapshot + seq > watermark` 的事件必须能精确重建权威状态；不一致 watermark 会导致事件与快照不匹配。
- **为什么现有文字挡不住**：规范说 snapshot cut 使用 `stream_heads.committed_seq`，但未规定 builder 如何原子读取多个 stream head。
- **最小修订**：
  1. snapshot builder 在事务中按规范键序 `SELECT ... FOR UPDATE` 所有相关 `stream_heads`，或使用 SERIALIZABLE 隔离并处理序列化失败。
  2. 或引入全局 epoch/monotonic cut marker 表，事务提交时写入 `(cut_id, stream_watermarks)`，snapshot 按 cut_id 读取。
- **可执行验收证据**：故障注入矩阵 #8；并发写时 snapshot 水位始终来自同一 committed 切面。

---

### P0-9 Outbox “durable accept” 判定标准缺失，可能导致事件丢失

- **分类**：`UNDER_SPECIFIED`
- **严重度**：P0
- **被攻击条款**：`outbox_events`（`成熟SLG后端参考架构-v2.2.html:1047, 1244-1259`）、D2
- **前置条件**：
  - 领域事务把事件写入 `stream_events` 与 `outbox_events`。
  - relay 把事件推送给某个 destination 后标记 `published_at`。
- **精确时间线/事务边界**：
  1. relay 成功投递到 Kafka/SQS 并 `UPDATE outbox_events SET published_at=now()`。
  2. 消费方尚未写入 `inbox_receipt` 或 cursor 前崩溃。
  3. outbox 按保留策略清理（因为 published_at 已设置）。
  4. 消费方重启后从 cursor 重放，发现事件已丢失。
- **数据库隔离与锁假设**：published_at 与 durable accept 不在同一事务。
- **违反的不变量**：at-least-once delivery、cursor 缺口检测可恢复。
- **为什么现有文字挡不住**：规范说“outbox 在目标 durable accept 后可清理”，但未定义 durable accept 的证据。
- **最小修订**：
  1. durable accept = 目标 consumer group 已把事件写入 `inbox_receipts` 并在同一事务中推进 `consumer_cursors.acked_seq`。
  2. outbox cleanup 只能删除满足“所有 required destinations 都有 ack_seq >= stream_seq” 的事件。
  3. 保留 `inbox_receipts` 作为长期去重依据，独立于 outbox。
- **可执行验收证据**：故障注入矩阵 #9；consumer 在 cursor 提交前崩溃，仍可从 stream/outbox 重放。

---

### P0-10 合服/拆服的 realm/zone/owner/stream/cursor/receipt/Saga/ledger 迁移 cut 未定义

- **分类**：`UNDER_SPECIFIED`
- **严重度**：P0
- **被攻击条款**：Partition Rule（`成熟SLG后端参考架构-v2.2.html:1084-1086`）、恢复/发布章节（`成熟SLG后端参考架构-v2.2.html:1692-1766`）
- **前置条件**：
  - 两个 realm `R1`、`R2` 要合并为 `R3`。
  - `R1` 与 `R2` 存在相同 `owner_key`（例如 `player:1001` 在两个 realm 都有）。
- **精确时间线/事务边界**：
  1. 直接按复合键“自动”重映射会导致主键冲突。
  2. `stream_key`、cursor、`command_id`、`saga_id`、`journal_id` 都可能跨 realm 重复。
- **数据库隔离与锁假设**：无。
- **违反的不变量**：全局唯一性、cursor 连续性、Saga/ledger 可审计性。
- **为什么现有文字挡不住**：规范只说“需要显式 ID 与游标迁移方案”，但没有给出表结构、映射函数、cut 校验、回滚路径。
- **最小修订**：
  1. 新增 `realm_migration_cut(cut_id, source_realm_id, target_realm_id, owner_key_map, stream_key_map, cursor_offsets, applied_at, evidence_digest)`。
  2. 所有 realm-scoped 主键在迁移后必须带新 realm_id 或按映射表重写；`owner_key`、`stream_key`、`command_id`、`saga_id`、`journal_id` 需全局唯一重编号。
  3. 迁移后必须跑完整性校验：sum(ledger deltas) 守恒、未决 receipt/job/Saga 数量一致、stream gap 不存在。
- **可执行验收证据**：故障注入矩阵 #10；合并/拆分后 checksum、cursor、唯一约束全部通过。

---

### P1-1 Recovery guardian 自身租约与唯一收敛未规定

- **分类**：`UNDER_SPECIFIED`
- **严重度**：P1
- **被攻击条款**：实现注释（`成熟SLG后端参考架构-v2.2.html:917-918`）
- **说明**：规范要求“唯一 guardian 在 lease 到期后收敛”，但未说明 guardian 如何选举/持租、扫描间隔、如何处理“两个 guardian 同时尝试接管”以及如何避免旧执行者复活后继续提交。需要补充 guardian lease 表或利用 `command_receipts` 上的 token CAS。

### P1-2 `command_execution_plans` 不可变性与 `superseded_by` 未在 DDL 中强制

- **分类**：`UNDER_SPECIFIED`
- **严重度**：P1
- **被攻击条款**：`command_execution_plans`（`成熟SLG后端参考架构-v2.2.html:1061`）
- **说明**：规范说“计划不可变”，但 DDL 没有 `CHECK` 或触发器阻止 UPDATE；`superseded_by` 只是普通字段，无法防止实现方直接修改历史 plan。

### P1-3 容量合同 `mMax` 与 release 容量参数的绑定无法被判定器验证

- **分类**：`UNDER_SPECIFIED` / `UNTESTABLE`
- **严重度**：P1
- **被攻击条款**：判定器规范 5.3（`容量合同判定器规范-v2.2.md:82-87`）、`workload.mMax`（`容量合同-v2.2.schema.json:231`）
- **说明**：判定器规范要求 `mMax` 绑定同 release 容量参数，但 release manifest 与 schema 均未定义容量参数字段；evaluator 无法机械判定绑定关系，导致实现方可随意填写 `mMax` 并声称通过 admission 门控。

---

## 4. INVALID_ATTACKS_REJECTED

以下反例在**正确实现 v2.2 事务语义**的前提下会被数据库机制挡住；若实现方绕过这些机制，则属于 `IMPLEMENTATION_ONLY_GAP` 或 `FACT_ERROR`，不构成规范本身可被攻破。

| 反例 | 被挡机制 | 说明 |
|---|---|---|
| 两个 placement 实例对同一 owner 并发 CAS 产生双 epoch | 单行 `UPDATE ... WHERE owner_epoch=:observed_epoch` + 行锁 | 只有一个 UPDATE 影响 1 行；另一个在提交后发现 epoch 已变，影响 0 行。 |
| 旧 epoch holder 用旧快照提交 | `SELECT ... FOR UPDATE` on `owner_leases` + `UPDATE aggregate_heads ... WHERE l.owner_epoch=:epoch` + 行数断言 | 若 handoff 已升级 epoch，旧事务的 aggregate UPDATE 影响 0 行，必须回滚。 |
| 同一 `commandId` 重复提交相同 payload | `command_receipts` 主键 / `(session_id, client_seq)` UNIQUE + response digest 回放 | 返回已存储的同一终态。 |
| 同一 `commandId` 提交不同 payload | payload hash 冲突检查 | 必须永久拒绝，返回 `IDEMPOTENCY_KEY_CONFLICT` 类错误。 |
| recovery guardian 在命令已 terminal 后仍提交结果 | `UPDATE command_receipts ... WHERE status='in_progress' AND execution_token=:expired_token` 影响 0 行 | terminal receipt 阻止二次写入。 |
| scheduled job 完成后旧 lease 再次标记完成 | `status='completed'` 与 `lease_token=:token` 条件更新影响 0 行 | 已完成状态阻止旧 token 提交。 |
| Saga 同一 saga 内重复 confirm | `UNIQUE(realm_id, saga_id, dedupe_key)` + 读取已有 step 返回原结果 | 幂等返回，不重复扣减/增加资源。 |
| 跨币种双写凭空制造货币 | per-currency ledger 借贷守恒 + `player_available` CHECK >= 0 | 任何 journal 的各行按 currency 求和必须为零。 |
| 直接修改原 economy journal 金额 | append-only 设计 + 无 UPDATE/DELETE 权限 | 退款/拒付只能新增 journal。 |

---

## 5. REQUIRED_DDL_AND_TRANSACTION_REVISIONS

以下修订必须在 v2.3 规范中成为**可验收的 DDL/事务约定**（不是建议）。

### 5.1 `owner_leases` 与 handoff

```sql
-- 最终 fencing 前必须先持锁
SELECT owner_epoch, holder_id, state, handoff_id, drain_deadline, lease_until
FROM owner_leases
WHERE (realm_id, owner_key) = (:realm, :owner)
FOR UPDATE;

-- handoff CAS：必须同时是线性化点，并显式激活或定义激活步骤
UPDATE owner_leases
SET owner_epoch = owner_epoch + 1,
    holder_id   = :new_holder,
    state       = 'active',          -- 或 'transferring' + 后续激活 CAS
    lease_until = :new_lease,
    handoff_id  = :handoff_id,
    drain_deadline = NULL,
    committed_watermarks = :watermarks,
    updated_at  = now()
WHERE (realm_id, owner_key) = (:realm, :owner)
  AND owner_epoch = :observed_epoch
  AND state = 'draining'
  AND handoff_id = :handoff_id
  AND statement_timestamp() < drain_deadline
RETURNING owner_epoch;

-- 领域事务中的最终 fencing 谓词（draining 期间仍允许旧 holder 提交 in-flight）
UPDATE aggregate_heads h
SET version = version + 1, updated_at = now()
FROM owner_leases l
WHERE h.realm_id = :realm AND h.owner_key = :owner
  AND l.realm_id = h.realm_id AND l.owner_key = h.owner_key
  AND l.holder_id = :holder
  AND l.owner_epoch = :epoch
  AND l.lease_until > statement_timestamp()
  AND (
    l.state = 'active'
    OR (l.state = 'draining'
        AND l.handoff_id = :handoff_id
        AND statement_timestamp() < l.drain_deadline)
  )
  AND h.version = :expected_version;
-- 代码层必须断言 affected_rows > 0，否则 ROLLBACK。
```

### 5.2 多 owner 锁序

在任意领域事务中，必须按以下全局规范键序一次性加锁并持有到 COMMIT：

1. `command_receipts`（`SELECT ... FOR UPDATE` 且 `status='in_progress' AND execution_token=:token`）。
2. 所有 touched `owner_leases`（按 `owner_key` 字典序排序）。
3. 所有 touched `aggregate_heads`（按 `(realm_id, owner_key)` 排序）。
4. 所有 touched `stream_heads`（按 `(realm_id, stream_key)` 排序）。
5. 领域行（按表名 + 主键排序）。

动态发现未声明 owner 时：立即 `ROLLBACK`，插入新的 `command_execution_plans` attempt，更新 `command_receipts.plan_attempt`，返回可重试状态。

### 5.3 `command_receipts` 原子终态

```sql
-- 领域事务开头
SELECT * FROM command_receipts
WHERE (realm_id, command_id) = (:realm, :command_id)
  AND status = 'in_progress'
  AND execution_token = :token
FOR UPDATE;

-- 所有领域写之后
UPDATE command_receipts
SET status = 'committed',
    result = :result,
    result_versions = :result_versions,
    event_watermarks = :event_watermarks,
    terminal_at = now()
WHERE (realm_id, command_id) = (:realm, :command_id)
  AND status = 'in_progress'
  AND execution_token = :token;
-- 断言 affected_rows = 1，否则 ROLLBACK。
```

### 5.4 `command_execution_plans`

- 增加外键：`command_receipts (realm_id, command_id, plan_attempt) -> command_execution_plans`。
- `owner_set_hash` 必须按规范键排序后计算。
- `atomicity_class` 必须显式为 `atomic` 或 `saga`；`saga` 仅在产品允许中间状态时出现。
- 历史 plan 不可 UPDATE；新增 plan 通过 `superseded_by` 指向新 attempt。

### 5.5 `scheduled_jobs`

```sql
-- claim
WITH next_job AS (
  SELECT realm_id, job_id
  FROM scheduled_jobs
  WHERE status = 'pending'
    AND next_attempt_at <= now()
  ORDER BY due_at, priority_class, job_id
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE scheduled_jobs s
SET status = 'leased',
    lease_token = :token,
    lease_epoch = lease_epoch + 1,
    lease_until = :lease_until,
    attempts = attempts + 1
FROM next_job n
WHERE s.realm_id = n.realm_id AND s.job_id = n.job_id
RETURNING s.job_id, s.lease_token, s.lease_epoch;

-- 完成：必须是事务最后一条写语句
UPDATE scheduled_jobs
SET status = 'completed'
WHERE (realm_id, job_id) = (:realm, :job_id)
  AND lease_token = :token
  AND lease_epoch = :epoch;
-- 断言 affected_rows = 1，否则 ROLLBACK。
```

### 5.6 Saga

```sql
-- saga_steps 唯一键改为按 saga 作用域
ALTER TABLE saga_steps
DROP CONSTRAINT IF EXISTS saga_steps_dedupe_key_unique,
ADD CONSTRAINT saga_steps_dedupe_key_unique
  UNIQUE (realm_id, saga_id, dedupe_key);

-- 状态守卫示例（confirm）
UPDATE saga_instances
SET state = 'confirming', version = version + 1
WHERE (realm_id, saga_id) = (:realm, :saga_id)
  AND state = 'reserving'
  AND version = :expected_version;
-- affected_rows = 1 才继续；否则读取已有 step 返回原结果或明确拒绝。
```

### 5.7 Premium ledger

```sql
ALTER TABLE economy_journals
  ADD COLUMN reversal_of UUID,
  ADD COLUMN fx_snapshot_id UUID,
  ALTER COLUMN state TYPE TEXT
    USING state::TEXT,
  ADD CONSTRAINT economy_journals_state_check
    CHECK (state IN ('pending','posted','reversed','chargeback','unknown'));

CREATE TABLE fx_snapshots (
  realm_id BIGINT NOT NULL,
  fx_snapshot_id UUID NOT NULL,
  source_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,        -- target/source，例如 10.0000
  rate_inverted BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL,         -- 渠道/内部定价标识
  recorded_at TIMESTAMPTZ NOT NULL,
  valuation_currency TEXT,
  PRIMARY KEY (realm_id, fx_snapshot_id)
);

-- account_class 扩展
ALTER TABLE economy_ledger_entries
  ALTER COLUMN account_class TYPE TEXT,
  ADD CONSTRAINT economy_ledger_entries_account_class_check
    CHECK (account_class IN (
      'player_available','platform_liability','receivable','revenue','cash',
      'fee_expense','tax_liability','rounding','chargeback_provision'
    ));

-- 退款/拒付必须引用原 journal
ALTER TABLE economy_journals
  ADD CONSTRAINT economy_journals_reversal_fk
    FOREIGN KEY (realm_id, reversal_of)
    REFERENCES economy_journals(realm_id, journal_id);
```

### 5.8 Stream/outbox/snapshot

- `outbox_events` 清理条件：所有 required destination 的 `consumer_cursors.acked_seq >= stream_seq` 且 `inbox_receipts` 已写入。
- snapshot builder：在事务中按 `stream_key` 排序 `SELECT ... FOR UPDATE` 所有相关 `stream_heads`，或使用一个全局 `stream_cut` 表记录原子切面。

### 5.9 合服/拆服迁移

新增 `realm_migration_cut` 表，至少包含：

```sql
CREATE TABLE realm_migration_cut (
  cut_id UUID PRIMARY KEY,
  source_realm_id BIGINT NOT NULL,
  target_realm_id BIGINT NOT NULL,
  owner_key_map JSONB NOT NULL,       -- {old_owner_key: new_owner_key}
  stream_key_map JSONB NOT NULL,
  cursor_offsets JSONB NOT NULL,      -- {stream_key: offset_delta}
  applied_at TIMESTAMPTZ NOT NULL,
  evidence_digest TEXT NOT NULL
);
```

所有 realm-scoped 表在迁移后必须重写主键/外键以反映 `target_realm_id` 和新的全局唯一 ID；迁移后必须执行 integrity + checksum + reconciliation。

---

## 6. REQUIRED_FAILURE_INJECTION_MATRIX

| # | 场景 | 注入点 | 故障模型 | 期待不变量 | 超时/等待 | 通过证据 | 清理方式 | 安全边界 |
|---|---|---|---|---|---|---|---|---|
| 1 | 双 placement 并发 handoff | `owner_leases` 行 | 两个 placement 进程同时执行 handoff CAS | 只有一个成功；epoch 严格 +1；另一个影响 0 行 | handoff 超时 < drain_deadline | `owner_leases` 返回的 `owner_epoch` 与 `handoff_id`；并发审计日志 | 失败 placement 重试前读取当前 epoch | 禁止两个实例同时认为自己是 holder |
| 2 | draining holder deadline 前后 COMMIT | 旧 holder 最终 fencing 前 pause | 在 deadline 前/后分别 pause 旧 holder | deadline 前允许提交；deadline 后必须回滚；新 holder 不会看到旧 epoch 写 | drain_deadline + 2×lease TTL | receipt 状态、owner_leases epoch/state、aggregate version | 回滚旧事务；新 holder 从 committed_watermarks 接管 | 任何时刻只有一个可提交 writer |
| 3 | 多 owner 命令与其中一个 owner handoff 并发 | owner B 的 lease / handoff 状态 | 命令已锁 A，同时 placement 对 B 发起 handoff | 命令要么在 handoff 前完成，要么整体回滚并生成新 plan_attempt；不会提交到混合 epoch | 锁等待 timeout | command_execution_plans.attempt、receipt.status、owner_leases.epoch | 回滚后按新 owner_set 重试 | 多 owner 命令必须属于同一 epoch 切面 |
| 4 | receipt lease 到期时旧执行者 COMMIT、新 guardian 接管 | `command_receipts` 行 | 延迟执行者到 lease 过期；启动 guardian CAS | 若执行者已锁 receipt 则可提交；否则 guardian 接管并唯一收敛 | 2×lease TTL | execution_token、lease_until、receipt.status、guardian lease | 执行者失败后由 guardian 重试 | 同一 commandId 只有一个活跃执行者 |
| 5 | job 完成条件更新影响 0 行但领域写已执行 | `scheduled_jobs` 完成 UPDATE | scheduler 在领域写中途 steal lease | 事务必须回滚；领域状态不变；新 lease 持有者重新执行 | job lease TTL | scheduled_jobs.lease_token/epoch、status、领域 checksum | 原 executor 放弃；新 executor claim | job 效果只归属于当前有效 lease |
| 6 | Saga 进入 compensating 后收到重复 confirm | saga confirm handler | 在 compensate 完成后重发 confirm 消息 | 重复 confirm 影响 0 行；资源守恒；不新增 step | saga deadline + retry backoff | saga_instances.state/version、saga_steps 行数、reservation 余额 | 幂等返回已有结果 | 迟到/重复消息不能越过终态 |
| 7 | FX、手续费、部分退款、拒付同时发生 | economy journal/ledger 写入 | 并发 deposit/spend/refund/chargeback callback | per-currency 余额守恒；player_available 不为负（不足记 receivable）；无超退 | 外部回调 timeout | economy_journals、economy_ledger_entries、fx_snapshots、余额试算 | 对账后人工 adjudication | 资金不能凭空产生或消失 |
| 8 | snapshot cut 与多 stream 并发提交 | `stream_heads` 读取 | 写入 streamA/streamB 同时 snapshot builder 读 heads | snapshot 水位来自同一 committed 切面 | snapshot build deadline | snapshot watermarks、stream_heads、最终 checksum | builder 重试或回滚 | snapshot 与增量事件可精确衔接 |
| 9 | outbox 在 durable accept 前被清理 | outbox relay + consumer | relay 标记 published 后 consumer 崩溃 | consumer 重启后仍能从 stream/outbox 重放 | consumer recovery timeout | consumer_cursors、inbox_receipts、outbox_events.status | 按 retention/cursor 重新清理 | at-least-once 不被破坏 |
| 10 | 合服/拆服 realm 重映射 | migration cut | 两个 realm 合并，存在冲突 owner_key/stream_key | 迁移后所有主键/唯一约束通过；ledger 守恒；cursor 连续 | migration window | realm_migration_cut、post-merge checksum、unresolved counts | 失败则 rollback 到 pre-cut manifest | 不允许自动复合键合并 |

---

## 7. BLOCKING_QUESTIONS

在 v2.2 进入 `ACCEPT_FOR_IMPLEMENTATION` 之前，必须先回答以下问题，并把它们转化为可验收的 DDL/SQL/测试：

1. **draining holder 的最终 fencing 精确谓词是什么？** 是否允许 `state='draining'` 且 `statement_timestamp() < drain_deadline` 的旧 holder 提交？请给出完整 SQL 并证明无双重 writer。
2. **handoff 的 `transferring -> active` 激活步骤由谁、在何时、以何种 lease 条件执行？** 若新 holder 激活失败，recovery 如何安全接管？
3. **`committed_watermarks` 由谁在哪个事务中写入？** 旧 holder 在 handoff 前最后一刻的 committed 事件如何被新 holder 正确继承？
4. **领域事务是否必须在任何 domain 写之前 `SELECT ... FOR UPDATE` 锁定 `command_receipts` 行？** terminal receipt UPDATE 是否必须是事务最后一条写语句并配合 `affected_rows = 1` 断言？
5. **recovery guardian 自身如何持租、如何扫描、如何处理多个 guardian 同时竞争？** 请给出 guardian lease 表或等价的 CAS 语义。
6. **outbox “durable accept” 的判定标准是什么？** 是 `inbox_receipts` + cursor 前移，还是 destination 的 offset commit？多个 destination 时如何聚合？
7. **FX 转换的舍入规则、rounding 账户、手续费/税费账户是什么？** 部分退款上限如何按原 journal 与已消费金额计算？
8. **外部支付渠道返回 `unknown` 结果时，journal 状态机如何收敛？** 是否存在超时后自动取消/确认的规则？
9. **合服/拆服时 owner_key、stream_key、cursor、receipt、Saga、ledger 的确定性映射函数是什么？** 如何保证迁移 cut 前后全局唯一约束和守恒约束？
10. **`mMax` 如何与 release manifest 的容量参数绑定，并被判定器机械验证？** 是否需要新增 `release.capacityParameters` 与 digest 链？

---

*报告结束。所有结论仅基于规范文本、容量合同、判定器规范、迁移路线图及当前代码的只读核对；未参考任何其他席输出。*
