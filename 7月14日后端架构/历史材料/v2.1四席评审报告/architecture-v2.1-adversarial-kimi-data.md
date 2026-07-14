# wxgame v2.1 参考架构：数据机制第二轮对抗审查报告

**评审席：** KIMI（数据架构、事务一致性与经济账务红队）  
**主评审对象：** `docs/slg-backend-reference-architecture.html` v2.1  
**允许读取：** `tmp/architecture-v2-adversarial-kimi-data.md`、当前 `backend/` 数据访问 / 命令管线 / 迁移 / 测试源码  
**禁止读取：** 其他 `architecture-v2.1-adversarial-*` 报告以及其他席位首轮报告  
**工作模式：** 只读；仅创建本报告文件，不修改任何产品代码、配置、数据库或部署脚本。

---

## 1. DATA_V2_1_VERDICT

**默认裁决：NOT_PROVEN。**

v2.1 在 v2 的基础上把“意图”拆成了更多独立数据机制：`owner_leases` 与 `aggregate_heads` 分离、`command_receipts` 状态机、`scheduled_jobs` 的 `lease_token/lease_epoch`、`stream_events` 与 `outbox_events` 职责分离、`economy_journals/ledger_entries`、`saga_instances/steps/reservations` 等。这些拆分方向正确，但规范本身**没有给出把这些机制闭环为可执行数据约束的具体事务边界、状态机迁移、锁顺序、失败恢复协议和验收测试**。许多关键机制停留在“表字段 + 文字声明”层面，存在内部矛盾或不可实现性。

**FACT：** 当前 `backend/` 源码（截至本次评审可读取范围）仍未实现 v2.1 定义的 `owner_leases`、`aggregate_heads`、`stream_heads`、`command_receipts`、`scheduled_jobs`、`stream_events`、`outbox_events`、`consumer_cursors`、`economy_journals`、`economy_ledger_entries`、`saga_instances`、`saga_steps`、`saga_reservations` 等表；它仍使用 `owner_locks`、`command_idempotency` 和大型 JSON 的 `game_states`。`CommandCommitter.commit()` 与 `recordResult()` 仍是两步（`CommandExecutionPipeline.js:266` 调用 `committer.commit`，`:285` 调用 `_recordTerminal`）。

**INFERENCE：** v2.1 目前是一份“比 v2 更细化的目标状态设计草图”，但还**不是已证明的数据架构规范**。若按当前文字直接实现，会在 owner 租约 authority 自身、handoff、receipt 状态机、scheduler/Saga、ledger 与 domain constraint、迁移合服等多个层面引入新的系统性风险。

**本轮评审结论：在以下机制补充可执行约束并通过故障注入验收测试之前，v2.1 数据架构判定为 NOT_PROVEN，不允许进入实现阶段。**

---

### v2.1 新增数据机制标记

| 数据机制 | 标记 | 理由 |
|---|---|---|
| `owner_leases` 与 `aggregate_heads` 分离 | **UNDER_SPECIFIED** | placement authority 自身的 fencing、epoch 分配原子性、handoff 协议（mailbox 排空、租约撤销、新 holder 接管 watermark）均未定义。 |
| Owner Handoff Rule（active→draining→transferring→active） | **INTERNALLY_CONTRADICTORY** | 要求 draining 后排空 mailbox 并递增 epoch 才让新 holder 接管，但未定义旧 holder 僵死/长事务时如何强制收敛，也未定义“排空完成”的可观测条件。 |
| `aggregate_heads` 的 fenced CAS | **PROVEN_BY_SPEC** | DDL 示例（`html:1116-1125`）给出了 `UPDATE ... FROM owner_leases ... WHERE holder_id=:holder AND owner_epoch=:epoch` 的明确写法。 |
| `command_receipts` terminal 与领域事务原子 | **UNDER_SPECIFIED** | 文字要求原子，但未定义 `accepted/in_progress` 的持久化点、恢复协议与 COMMIT-unknown 时的收敛规则。 |
| Owner Set Rule / `owner_set_hash` / 动态发现重路由 | **UNDER_SPECIFIED** | 未定义重路由次数上界、owner_set_hash 变更与 commandId 复用的交互、动态发现触发的回滚是否保证幂等。 |
| `M_max` 定义与转 Saga | **UNDER_SPECIFIED** | 未给出 M 的测量口径、M_max 的推导方法，也未说明 Saga 化后如何保持需要原子可见的业务语义。 |
| `scheduled_jobs` lease_token/lease_epoch | **UNDER_SPECIFIED** | 未规定 scheduler job 的命令 handler 必须把 `scheduled_jobs` 的条件更新与领域写入放在同一事务并使其失败。 |
| `stream_events` / `outbox_events` 职责分离 | **UNDER_SPECIFIED** | 未定义多 stream 同事的 seq 分配锁顺序、outbox 按 destination 清理与 per-consumer cursor 的映射关系。 |
| `consumer_cursors` gap 检测 | **UNDER_SPECIFIED** | 只声明“发现 gap 停止并重放”，未给出 gap 识别、补传请求、慢消费者阻塞清理的协议。 |
| Saga 状态机（reserve/confirm/compensate/escalated） | **UNDER_SPECIFIED** | 跨 realm confirm/compensate 事件的幂等 dedupe、reservation 守恒检查、人工修复审计未定义。 |
| `economy_journals` / `economy_ledger_entries` | **UNDER_SPECIFIED** | deferred balance 维护方式、部分退款、拒付、跨币种、外部支付 unknown result、历史更正均未闭环。 |
| 部分 unique / deferred composite FK 等 domain constraint | **NOT_IMPLEMENTABLE_AS_WRITTEN** | MySQL 不支持 deferrable FK；部分 unique index 在部分目标库需要变通；规范未给出等价实现集合。 |
| Partition Rule / 合服拆服 / stream cursor 重映射 | **UNDER_SPECIFIED** | 只声明“需要显式方案”，未给出状态机、ID 重映射、owner_key/stream_key/cursor 迁移规则。 |
| Retention / 审计永久保留 / 数据主体删除 | **INTERNALLY_CONTRADICTORY** | ledger 不可变要求永久保留含 player_id 的记录，与数据主体删除权存在直接冲突；规范未给出匿名化或法定例外策略。 |

---

## 2. WHAT_V2_1_ACTUALLY_FIXED

v2.1 相对于 v2 确实纠正了若干上一轮被攻击的前提，应当被承认：

1. **把 owner lease 与 aggregate version 拆成两张表**（`owner_leases` / `aggregate_heads`），避免了用 `aggregate_heads.version` 兼任 fencing token 的误解，为 epoch/lease 提供了独立生命周期。
2. **明确了 terminal receipt 必须与领域写入原子提交**（D1、`html:773`、`html:911`），不再把 receipt 生成放在事务外作为可接受设计。
3. **增加了 `owner_epoch`、`holder_id`、`lease_until` 和 `state` 字段**，使 C1 的 fencing 语义从“版本号”升级为“epoch + holder + 未过期 lease”。
4. **增加了 `scheduled_jobs` 的 `lease_token/lease_epoch` 和 `saga_instances/steps/reservations`**，承认了定时任务和跨区工作流需要持久状态机。
5. **区分了 `stream_events`（持久事件日志）与 `outbox_events`（短期 relay spool）**，并把 snapshot cut 绑定到 `stream_heads.committed_seq` 而不是 `published_at`。
6. **增加了 `economy_journals/ledger_entries`**，把付费货币的不可变 ledger 从“余额表”中分离出来。

然而，这些修复大多停留在“机制存在”层面，**没有给出机制之间的交互协议和失败恢复闭环**。本轮评审的核心任务正是攻击这些新增机制本身的规格缺口，而不是重复“当前实现尚未完成”。

---

## 3. OWNER_LEASE_AND_HANDOFF_COUNTEREXAMPLES

### OF-01 [FATAL][COUNTEREXAMPLE] placement authority 设置 draining 后，旧 runtime 仍执行 mailbox 中已排队的命令

- **Attacked v2.1 clause：** Owner Handoff Rule（`html:988-989`）、C1（`html:759`）、`owner_leases` 表注（`html:1033`）。
- **Preconditions：**
  - Runtime R1 持有 `player:42` 的 lease，epoch=5，state=`active`。
  - placement authority P 决定把 `player:42` 迁移到新 runtime R2（例如热点均衡）。
  - R1 的 mailbox 中已排队命令 C1、C2。
  - 规范只说“draining 后拒绝新命令并排空 mailbox”，但未定义：
    - P 如何通知 R1 进入 draining（推送 / 轮询 / 租约状态变更）；
    - R1 如何向 P 报告“mailbox 已排空”；
    - 在 R1 排空期间，P 是否允许 R2 以新 epoch 接管。
- **Exact timeline：**
  1. `T1` P 执行 `UPDATE owner_leases SET state='draining' WHERE realm_id=1 AND owner_key='player:42'`。
  2. `T2` R1 未感知到 draining（无通知通道或轮询间隔未到），继续从 mailbox 取出 C1 执行。
  3. `T3` P 等待超时（规范未给超时定义），认为 R1 已僵死，直接递增 epoch 并把 lease 授予 R2（epoch=6，state=`active`）。
  4. `T4` R1 执行 C1 的域事务。由于事务内检查 `owner_leases` 时 state 已为 `draining`（或 epoch 已为 6，取决于读提交时间），C1 回滚。
  5. `T5` R1 继续执行 C2。此时如果 R1 的读视图仍看到 epoch=5 且 state=`active`（例如使用快照隔离且未重新读取），C2 可能以旧 epoch 提交。
  6. `T6` R2 同时执行 C3。`player:42` 上同时存在 R1（epoch=5）和 R2（epoch=6）的有效写入，出现双写者。
- **Violated invariant：** C1“任意时刻只有一个权威写入者”；Owner Handoff Rule“旧 epoch 的任何写入必须在数据库内失败”。
- **Why current wording does not prevent it：** 规范要求“每笔写事务匹配 holder、epoch 与未过期 lease”，但**没有规定 runtime 在单次命令执行期间必须重读 `owner_leases` 的哪个字段、在什么隔离级别下读、以及 draining 通知的时序保证**。在 READ COMMITTED 下，事务内的语句能看到已提交的 draining，但 R1 可能在 `T3` 之前就开始事务并持有锁；在 REPEATABLE READ/SERIALIZABLE 下，R1 可能看到旧的 active 快照。
- **Required spec revision：**
  1. 定义 handoff 状态机的完整迁移图：`active → draining[mailbox_drain_deadline] → transferring[old_epoch_revoked, new_epoch_assigned] → active`。
  2. 规定 runtime 必须在每个命令的域事务开头使用 `SELECT ... FROM owner_leases FOR UPDATE`（或等价原子读）重新获取当前 epoch/state，并把该读与 `aggregate_heads` CAS 绑定在同一事务。
  3. 定义 draining 通知机制与 mailbox 排空确认原语（如 `owner_leases.transfer_to` + 心跳 ACK）。
  4. 定义旧 holder 在 `drain_deadline` 内未完成时的强制撤销条件（如 lease_until 强制设为过去）。
- **Acceptance evidence：** `TEST_HANDOFF_01`：在 R1 的 mailbox 中注入 1000 条命令，P 触发 draining；断言 R1 在 drain_deadline 内处理的命令均使用 epoch=5，deadline 后所有命令必须由 R2 以 epoch=6 处理，零交错写入。

---

### OF-02 [FATAL][COUNTEREXAMPLE] 租约被强制撤销时，已产生的外部副作用无法回滚

- **Attacked v2.1 clause：** Owner Handoff Rule（`html:988-989`）、C1（`html:759`）。
- **Preconditions：**
  - Runtime R1 持有 `player:42` lease，正在执行命令 C，C 包含对外部系统的调用（例如充值到账通知、推送、第三方计费）。
  - placement authority P 因故障转移需要强制撤销 R1 的租约。
- **Exact timeline：**
  1. `T1` R1 的域事务已调用外部 API 并产生副作用（例如已向支付渠道确认发货）。
  2. `T2` P 设置 `owner_leases.state='transferring'` 并把 `lease_until` 改到过去，epoch 递增为 6。
  3. `T3` R1 的域事务在 COMMIT 时重新检查 `owner_leases`（按 v2.1 要求），发现 epoch/lease 不匹配，事务回滚。
  4. `T4` 外部副作用已经发生且无法回滚（支付渠道不会撤销已发货）。
  5. `T5` R2 以 epoch=6 接管后重新执行 C。如果 C 是幂等的，可能重复调用外部 API；如果不是，状态机永久不一致。
- **Violated invariant：** 租约撤销与外部副作用之间的因果关系；C5“调度器/后台任务不得绕过命令入口”的外延——外部调用也应受 fencing 约束。
- **Why current wording does not prevent it：** v2.1 只规定了数据库内的 fencing，没有规定命令执行过程中**外部副作用的补偿边界**。强制撤销租约可以保证数据库事务失败，但无法撤销已发出的外部调用。
- **Required spec revision：**
  1. 定义“外部副作用阶段”必须在数据库事务提交**之后**执行，且执行前再次检查 receipt 状态是否仍为 terminal。
  2. 或者，定义所有外部调用必须采用 two-phase 可补偿协议（如 Saga reservation），在租约撤销时进入 compensate。
  3. 明确 placement authority 在撤销租约前必须等待或强制中断哪些副作用阶段。
- **Acceptance evidence：** `TEST_HANDOFF_02`：命令 C 在域事务中插入一条虚拟外部调用记录；强制撤销租约；断言外部调用记录要么未产生（事务回滚），要么已产生并有对应的补偿记录；不允许“外部已调用但数据库未提交”的悬空状态。

---

### OF-03 [FATAL][COUNTEREXAMPLE] placement authority 自身多进程时 epoch 分配重复

- **Attacked v2.1 clause：** `owner_leases` 表注“epoch 单调递增；每笔写事务匹配 holder、epoch 与未过期 lease”（`html:1033`）。
- **Preconditions：**
  - 为保证可用性，placement authority 由两个进程 PA、PB 组成（主备或分区负载）。
  - `owner_leases` 表本身没有 self-fencing：任何能写该表的组件都可以递增 epoch。
- **Exact timeline（以 PostgreSQL READ COMMITTED 为例）：**
  1. `T1` PA 读取 `owner_leases('player:42')`，看到 epoch=5。
  2. `T2` PB 同时读取同一行，也看到 epoch=5。
  3. `T3` PA 执行 `UPDATE owner_leases SET owner_epoch=6, holder_id='R2', state='active' WHERE ...`。
  4. `T4` PB 未感知到 PA 的更新，也执行 `UPDATE owner_leases SET owner_epoch=6, holder_id='R3', state='active' WHERE ...`。
  5. `T5` R2 和 R3 都认为自己持有 epoch=6 的 `player:42`，双写者再次出现。
- **Violated invariant：** epoch 单调递增且唯一；C1 单写入者。
- **Why current wording does not prevent it：** v2.1 把 `owner_leases` 的写入 owner 标为“placement authority”，但**没有说明 placement authority 自身是单进程还是多进程、如何 fencing 自身**。如果 placement authority 是单进程，它是 SPOF；如果是多进程，必须引入分布式锁/leader election/条件更新。规范未给出。
- **Required spec revision：**
  1. 明确 placement authority 是单 leader 还是 multi-primary；若是后者，给出 epoch 分配的原子算法（例如 `UPDATE owner_leases SET owner_epoch=owner_epoch+1, holder_id=?, state='active' WHERE owner_epoch=:old_epoch AND state='draining' RETURNING owner_epoch`）。
  2. 或者，把 epoch 分配委托给数据库序列/触发器，并规定 placement authority 只能写入 `holder_id`/`lease_until`/`state`，不能手工设置 `owner_epoch`。
- **Acceptance evidence：** `TEST_PLACEMENT_01`：启动两个 placement authority 进程并发执行 1000 次 owner 转移；断言所有成功的转移产生严格递增且唯一的 epoch，无重复 epoch。

---

### OF-04 [FATAL][COUNTEREXAMPLE] 多 owner 命令只锁 aggregate_heads，未锁所有 owner_leases

- **Attacked v2.1 clause：** C3（`html:761`）、section 02 “锁序固定为 receipt → owner_leases → aggregate_heads/stream_heads → 按表序与主键排序的领域行”（`html:958`）。
- **Preconditions：**
  - 命令 C 同时涉及 `player:1` 和 `cell:33:7`。
  - 规范要求锁序包含 `owner_leases`，但实现者误解为“只需锁命令入口的 owner_leases（如 `player:1`）”，而未锁 `cell:33:7` 的 owner_leases。
  - `cell:33:7` 的 holder 正准备转移给新 runtime。
- **Exact timeline：**
  1. `T1` Runtime R 开始执行 C，锁 `command_receipts`、锁 `player:1` 的 `owner_leases`、锁 `aggregate_heads('player:1')` 与 `aggregate_heads('cell:33:7')`。
  2. `T2` placement authority P 决定转移 `cell:33:7`，设置其 `owner_leases.state='draining'` 并准备 epoch 递增。
  3. `T3` R 未锁 `cell:33:7` 的 `owner_leases`，直接读取到 epoch=3、state=`active`（旧读视图）。
  4. `T4` P 把 `cell:33:7` 的 epoch 递增为 4 并授予 R2。
  5. `T5` R 的域事务更新 `cell:33:7` 的 `aggregate_heads` 与 `world_tile_state`。由于事务内未重新校验 `cell:33:7` 的 `owner_leases`，它以 epoch=3 成功提交。
  6. `T6` R2 以 epoch=4 执行另一命令更新同一 tile。现在 tile 状态被两个 epoch 交错修改。
- **Violated invariant：** C1 单写入者；C3 多 owner 全局锁序。
- **Why current wording does not prevent it：** 规范说“锁序固定为 receipt → owner_leases → aggregate_heads/...”，但**没有明确“所有被触及 owner 的 owner_leases 都必须按全局顺序锁定”**。如果实现者只锁入口 owner 的 lease，其他 owner 的 lease 转移会在不知不觉中被忽略。
- **Required spec revision：**
  1. 明确多 owner 命令必须锁“命令涉及的所有 `owner_leases` 行”，锁顺序与 `aggregate_heads` 一致（按 `(realm_id, owner_key)` 全局排序）。
  2. 在 DDL 示例中展示多 owner 的 `SELECT ... FROM owner_leases WHERE (realm_id, owner_key) IN (...) ORDER BY owner_key FOR UPDATE`。
  3. 如果某个 owner 处于 `draining/transferring`，命令必须回滚并触发重路由，而不是跳过该 owner 的 lease 检查。
- **Acceptance evidence：** `TEST_MULTI_OWNER_LEASE_01`：构造涉及 4 个 owner 的命令，在命令执行期间触发其中 2 个 owner 的 lease 转移；断言命令要么在 lease 变更前完成、要么回滚重路由，不允许以旧 epoch 提交。

---
## 4. ATOMIC_RECEIPT_AND_UNKNOWN_COMMIT_COUNTEREXAMPLES

### RC-01 [FATAL][COUNTEREXAMPLE] `accepted/in_progress` receipt 持久化点未定义，崩溃后状态机无法收敛

- **Attacked v2.1 clause：** 命令状态机 `RECEIVED → ACCEPTED → IN_PROGRESS → COMMITTED | REJECTED_FINAL | FAILED_FINAL`（`html:911`）、`command_receipts` DDL（`html:1130-1153`）。
- **Preconditions：**
  - 规范列出 5 个状态，但**没有说明 `accepted` 与 `in_progress` 分别在哪个事务、哪个阶段写入**。
  - 实现者选择：先写一个独立事务把 receipt 从 `accepted` 改为 `in_progress`，再开启第二个事务执行领域写入并改为 terminal。
- **Exact timeline：**
  1. `T1` Gateway 把命令 C 路由到 Runtime R，R 在事务 A 中写入 `command_receipts(status='in_progress')` 并提交。
  2. `T2` R 开始域事务 B，准备更新 `aggregate_heads`、领域行、`stream_events`、outbox 与 terminal receipt。
  3. `T3` R 在事务 B 的 COMMIT 前崩溃。事务 B 回滚，但事务 A 留下的 `in_progress` receipt 仍在。
  4. `T4` 客户端超时，重试 C（复用 commandId）。
  5. `T5` 新 Runtime R2 查询 `command_receipts`，看到 `in_progress`。规范只说“服务端只返回已存终态，或继续恢复同一命令”，但**没有定义由谁、在何时、以什么证据继续恢复**。
  6. `T6` R2 无法判断：C 的域事务是“尚未开始”还是“已经提交但 R 在写 receipt 前崩溃”（后者按 v2.1 不应发生，但实现若把 in_progress 写在独立事务则可能发生）。
  7. `T7` 如果 R2 选择继续执行，而原事务 B 实际已部分持久化（例如某些存储已提交，或外部副作用已发生），则重复执行；如果 R2 选择标记为 `failed_final`，则丢失了一次可能已部分成功的业务事实。
- **Violated invariant：** D1“领域行、aggregate 版本、命令终态、定时任务、持久事件和 outbox 在同一事务提交”；命令状态机必须唯一收敛。
- **Why current wording does not prevent it：** v2.1 要求 terminal receipt 与领域写入原子，但**没有禁止实现者把 `accepted/in_progress` 写在独立事务**。只要这个持久化点未明确，就存在“in_progress 残留但领域未提交”的状态，使恢复无法判定。
- **Required spec revision：**
  1. 明确 `command_receipts` 的插入/更新必须发生在**同一个外层事务**内，该事务同时完成：
     - 若首次接收命令，则 `INSERT ... (status='in_progress')` 与后续 domain write/terminal update 在同一事务；
     - 若 receipt 已存在 terminal，则直接返回；
     - 不允许“先写一个独立 in_progress 事务，再开第二个事务执行领域逻辑”。
  2. 给出明确的 SQL 模板：`INSERT command_receipts ... ON CONFLICT DO NOTHING`，若返回 0 行则查询已有状态；在同一个 `BEGIN ... COMMIT` 中完成 domain write 与 `UPDATE command_receipts SET status='committed', ...`。
  3. 定义 `in_progress` 的 TTL / 恢复监护人（如 scheduler 扫描过期 in_progress 并重新执行或标记失败）。
- **Acceptance evidence：** `TEST_RECEIPT_PERSISTENCE_01`：在 receipt 写入后注入崩溃（事务未提交领域写入），重试命令；断言新 runtime 能正确识别为未提交并重新执行，且不会返回虚假 terminal 结果。

---

### RC-02 [FATAL][COUNTEREXAMPLE] COMMIT-unknown 时客户端查询 `in_progress` 但原 runtime 已死，命令永远悬空

- **Attacked v2.1 clause：** “连接在 COMMIT 附近断开时，客户端以 commandId 查询或重试；服务端只返回已存终态，或继续恢复同一命令”（`html:911`）。
- **Preconditions：**
  - 客户端发送命令 C，Runtime R 开始执行，receipt 为 `in_progress`。
  - R 的域事务已 COMMIT（receipt 应被改为 terminal），但 R 在返回 ACK 前崩溃。
  - 规范要求 terminal receipt 与领域写入原子，因此理论上 receipt 应为 terminal。但**如果实现把 in_progress 写在独立事务**（见 RC-01），receipt 仍可能是 `in_progress`。
  - 即使实现正确，receipt 是 terminal，但客户端在 ACK 丢失后查询，也可能因为网络分区一直查询不到。
- **Exact timeline（规范理想情况 + 现实偏差）：**
  1. `T1` R 的域事务 COMMIT，receipt 变为 `committed`。
  2. `T2` R 崩溃，ACK 未到达客户端。
  3. `T3` 客户端查询 `/commands/C`。由于 R 崩溃，请求被路由到 R2。
  4. `T4` R2 读取 `command_receipts`，看到 `committed`，返回结果。✅ 这是规范期望路径。
- **Exact timeline（现实偏差路径）：**
  1. `T1` R 把 receipt 写成 `in_progress`（独立事务提交），然后开始域事务。
  2. `T2` 域事务 COMMIT 成功，receipt 更新为 `committed` 的 SQL 因 R 崩溃未执行。
  3. `T3` 客户端查询 `/commands/C`，R2 看到 `in_progress`。
  4. `T4` R2 不知道 R 是“已崩溃”还是“仍在执行但慢”。规范没有定义恢复协议，R2 只能返回 `IN_PROGRESS`，客户端陷入无限等待。
  5. `T5` 如果没有任何监护人扫描并恢复该 in_progress，命令 C 的业务效果已提交但客户端永远收不到 ACK，违反 P2“超时后重试必须复用 commandId；服务端返回已存结果”。
- **Violated invariant：** P2 稳定重试；命令状态机唯一收敛；ACK 最终可达。
- **Why current wording does not prevent it：** 规范只说“继续恢复同一命令”，但**没有定义恢复触发条件、恢复所有权、超时升级与失败判定**。如果原 runtime 崩溃且没有监护人，in_progress 命令会永久悬空。
- **Required spec revision：**
  1. 定义一个“命令恢复监护人”（如 `command_receipts` 的 `in_progress` 扫描任务），周期扫描 `status='in_progress' AND updated_at < now() - recovery_timeout` 的命令。
  2. 监护人必须按“先尝试继续执行（若原 owner lease 仍有效）→ 若 lease 过期则夺取 lease 并重新执行 → 若重复失败则标记 `failed_final`”的顺序收敛。
  3. 定义 `in_progress` 命令的 lease 绑定：receipt 行必须携带 `holder_id`/`owner_epoch`，只有当前 lease holder 或恢复监护人才能更新它。
- **Acceptance evidence：** `TEST_RECOVERY_01`：让 100 条命令在 COMMIT 后、ACK 前崩溃；断言恢复监护人在 5 个扫描周期内把 receipt 更新为 terminal，客户端最终查询到 committed。

---

### RC-03 [HIGH][COUNTEREXAMPLE] deterministic reject 与 transient failure 边界未定义，同一 commandId 可能永久失败

- **Attacked v2.1 clause：** `command_receipts` 状态机（`html:1138-1141`）、“相同 ID 不同 payload hash 必须拒绝”（`html:911`）。
- **Preconditions：**
  - 命令 C 因 `aggregate_heads` 版本冲突被判定为冲突。
  - 规范区分 `rejected_final`（业务拒绝）与 `failed_final`（永久失败），但**没有说明 transient failure（如 DB 超时、lease 暂时过期）在多少次重试后变成 `failed_final`**。
- **Exact timeline：**
  1. `T1` 客户端发送 C，expectedVersion 过期，Runtime R 在域事务中检测到版本冲突。
  2. `T2` R 按业务规则应返回 `VERSION_CONFLICT`，客户端收到后可重新发送新命令 C'（新 commandId，更新 expectedVersion）。
  3. `T3` 但 R 在写入 `rejected_final` receipt 前遇到 DB 连接超时，receipt 仍停留在 `in_progress`。
  4. `T4` 客户端重试 C（复用 commandId），新 Runtime R2 看到 `in_progress`。由于 R2 无法区分这是“业务冲突待标记 rejected_final”还是“transient 超时待重试”，它选择重试。
  5. `T5` 重试再次因版本冲突失败。若重试次数达到某个未定义的阈值，R2 把 C 标记为 `failed_final`。
  6. `T6` 客户端原本期望收到明确的 `VERSION_CONFLICT` 以重发 C'，却收到 `failed_final`。同一 commandId 被永久钉死，无法再用新版本重试。
- **Violated invariant：** P2 稳定重试；错误分类必须可区分 transient / business / permanent。
- **Why current wording does not prevent it：** 规范列出状态，但**没有给出每个状态之间的迁移条件、重试预算与升级规则**。实现者容易把 transient 失败错误升级为 `failed_final`。
- **Required spec revision：**
  1. 定义状态迁移矩阵：`accepted → in_progress → committed | rejected_final | failed_final`。
  2. 明确 `rejected_final` 只能由业务规则产生（如版本冲突、权限不足、余额不足），且必须可重试为不同 commandId；`failed_final` 只能由达到最大重试次数或不可恢复错误产生。
  3. 对 transient 失败（DB 超时、lease 过期、死锁）必须保留 `in_progress` 并让恢复监护人重试，而不是直接升级。
- **Acceptance evidence：** `TEST_RECEIPT_STATE_MACHINE_01`：注入 DB 超时在 receipt 写入阶段；断言命令保持 `in_progress` 并在恢复后最终变为 `rejected_final` 或 `committed`，不会直接变为 `failed_final`。

---

## 5. LOCK_ORDER_AND_MULTI_OWNER_COUNTEREXAMPLES

### LO-01 [FATAL][COUNTEREXAMPLE] 多 owner 命令动态发现新 owner 后重路由，同 commandId 的 owner_set_hash 可能不同

- **Attacked v2.1 clause：** Owner Set Rule（`html:993-994`）、C3（`html:761`）、`command_receipts.owner_set_hash`（`html:1136`）。
- **Preconditions：**
  - 命令 C 初始 owner 集合为 `{player:1, city:1}`，owner_set_hash = H1。
  - 执行期间发现需要 `territory:5`，按规范回滚并重新授权、重路由。
  - 重路由后 owner 集合为 `{player:1, city:1, territory:5}`，owner_set_hash = H2。
- **Exact timeline：**
  1. `T1` Runtime R1 用 H1 执行 C，动态发现 `territory:5`，回滚。
  2. `T2` R1 将 C 重新路由（同一 commandId）给 R2，owner 集合包含 `territory:5`。
  3. `T3` 客户端因超时而重试 C，请求到达 R3。R3 查询 `command_receipts`，发现存在一行 `command_id=C, owner_set_hash=H1, status='in_progress'`。
  4. `T4` 规范说“相同 ID 不同 payload hash 必须拒绝”，但未明确“相同 ID 不同 owner_set_hash”如何处理。R3 可能：
     - 按 H1 执行并再次动态发现 `territory:5`，无限循环；
     - 拒绝为 `OWNER_SET_MISMATCH`，导致 C 永久失败；
     - 忽略 H1 用新集合执行，破坏 in_progress 行的参考价值。
  5. `T5` 若 R2 先以 H2 成功执行并写入 terminal receipt，R3 重试时查询到 terminal 并返回结果。但**如果 R2 也回滚（例如 territory:5 在 R2 执行期间又发生 lease 转移）**，则出现多个 in_progress 行或 owner_set_hash 混乱。
- **Violated invariant：** 同一 commandId 的 owner_set_hash 必须单调收敛；命令最终必须唯一 terminal。
- **Why current wording does not prevent it：** Owner Set Rule 只说“记录 owner_set_hash”和“动态发现回滚重路由”，但**没有规定重路由时如何更新 `command_receipts` 的 owner_set_hash、是否允许存在多个 in_progress 行、以及重试次数上界**。
- **Required spec revision：**
  1. 规定 `command_receipts` 的 `owner_set_hash` 可以被同一 commandId 的后续重路由更新，但状态必须为 `in_progress`；一旦 terminal，owner_set_hash 不可变。
  2. 限制动态发现重路由次数（如 ≤3 次），超过则标记 `failed_final` 并返回明确错误码。
  3. 要求重路由前必须撤销已获取的 lease，避免旧 lease 与新 lease 同时存在。
- **Acceptance evidence：** `TEST_DYNAMIC_OWNER_01`：构造动态发现新 owner 的命令；断言同一 commandId 的 owner_set_hash 最终收敛为一种，且业务效果只发生一次。

---

### LO-02 [FATAL][COUNTEREXAMPLE] `M_max` 未定义，超过阈值转 Saga 可能破坏必须原子的业务语义

- **Attacked v2.1 clause：** section 02 “owner 数不超过 capacity contract 的 M_max 时... 超过 M_max 转 Saga”（`html:957-958`、`html:970-971`、`html:1543`）。
- **Preconditions：**
  - 命令 C 是玩家 A 向玩家 B 的资源转移，必须原子可见（A 扣减与 B 增加同时成功或同时失败）。
  - 当前负载下 C 涉及 owner 数 M=2。容量合同把 M_max 设为 1（出于热点保护）。
- **Exact timeline：**
  1. `T1` Owner Router 判定 M=2 > M_max=1，把 C 拆成 Saga：
     - Step 1：在 `player:A` 上 reserve 100 gold；
     - Step 2：在 `player:B` 上 confirm +100 gold。
  2. `T2` Step 1 成功，A 的 100 gold 被 reserve，余额可见减少。
  3. `T3` 在 Step 2 执行前，B 发起另一个命令消耗了部分资源（与 Saga 无关）。
  4. `T4` Step 2 因某种 transient 失败进入 compensate，把 100 gold 退回 A。
  5. `T5` 从 A 的视角，资源先被扣、后被退，中间出现了一个“已转出但未到账”的窗口；从 B 的视角，从未收到转移。业务语义从“原子转账”退化为“两阶段可见 reservation”。
- **Violated invariant：** 需要原子一致性的业务操作（如玩家间直接交易、联盟仓库转移）不能被无条件 Saga 化。
- **Why current wording does not prevent it：** 规范只声明“超过 M_max 转 Saga”，但**没有定义哪些命令允许 Saga 化、哪些必须保持多 owner 原子事务**，也没有给出 M 的测量口径（owner key 数量？锁行数？事务持续时间？锁等待时间？）。
- **Required spec revision：**
  1. 定义 M 的精确测量方式：是命令入口解析出的 `ownerKeys` 数量，还是事务实际锁住的 `aggregate_heads` 行数，还是两者都测。
  2. 定义 M_max 的推导方法：基于锁等待 p99、死锁率、事务回滚率等实测指标，而不是产品拍脑袋。
  3. 建立“不可 Saga 化命令”白名单：例如玩家间即时交易、战斗结算、tile 占领等必须保持多 owner 原子；只有跨 realm/跨分区/长事务/外部系统才可强制 Saga 化。
- **Acceptance evidence：** `TEST_M_MAX_01`：对必须原子的命令把 M_max 压到 1；断言系统拒绝 Sagatization 或保持原子性，而不是 silently 把原子语义降级为 reservation。

---

### LO-03 [HIGH][COUNTEREXAMPLE] 多 owner 锁顺序只定义到 `aggregate_heads`，未覆盖 `owner_leases` 与 `stream_heads` 的混合顺序

- **Attacked v2.1 clause：** section 02 锁序声明（`html:958`）、`stream_heads` 表注（`html:1035`）。
- **Preconditions：**
  - 命令 C1 涉及 `player:1` 与 `zone:33`，需要更新 `player:1` 的 `aggregate_heads` 和 `zone:33` 的 `stream_heads`（AOI 事件流）。
  - 命令 C2 涉及 `zone:33` 与 `player:1`，需要更新 `zone:33` 的 `aggregate_heads` 和 `player:1` 的 `stream_heads`。
- **Exact timeline：**
  1. `T1` C1 按“先锁 receipt，再锁 `player:1` 的 owner_leases + aggregate_heads，再锁 `zone:33` 的 owner_leases + aggregate_heads，然后锁 stream_heads”的顺序执行。但规范未规定当命令需要锁 `player:1` 的 `stream_heads` 和 `zone:33` 的 `stream_heads` 时，锁顺序是什么。
  2. `T2` C1 选择先锁 `player:1` 的 `stream_heads`，再锁 `zone:33` 的 `stream_heads`。
  3. `T3` C2 选择先锁 `zone:33` 的 `stream_heads`，再锁 `player:1` 的 `stream_heads`。
  4. `T4` C1 持有 `player:1` 的 aggregate_heads 锁并等待 `zone:33` 的 stream_heads；C2 持有 `zone:33` 的 aggregate_heads 锁并等待 `player:1` 的 stream_heads。形成死锁。
- **Violated invariant：** C3 多 owner 预声明并按唯一顺序加锁；无死锁。
- **Why current wording does not prevent it：** 规范说“按全局锁顺序锁定多个 aggregate_heads”，但**没有给出 `owner_leases`、`aggregate_heads`、`stream_heads`、各 domain 表之间的统一全序**。当命令同时更新多个 stream 的 head 时，实现者可能按不同顺序加锁。
- **Required spec revision：**
  1. 定义一个全局锁排序键：`(<table-kind>, realm_id, owner_key/stream_key)`，其中 table-kind 顺序固定为 `receipt < owner_leases < aggregate_heads < stream_heads < domain_rows`。
  2. 在 DDL/事务规范中要求：`SELECT ... FOR UPDATE ORDER BY table_kind, owner_key`。
  3. 对任何动态发现的额外 owner/stream，必须先整体回滚并按新集合重新排序加锁。
- **Acceptance evidence：** `TEST_LOCK_ORDER_02`：构造 100 组涉及重叠 owner + stream 的命令对，故意以相反 stream 顺序传入；断言零死锁、零写偏斜。

---
## 6. STREAM_OUTBOX_SNAPSHOT_COUNTEREXAMPLES

### ST-01 [FATAL][COUNTEREXAMPLE] 多 stream seq 分配未定义锁顺序，命令并发产生死锁与乱序

- **Attacked v2.1 clause：** `stream_heads` 表注“每条 stream 单调分配 seq”（`html:1035`）、`stream_events` DDL（`html:1192-1226`）、D2/D3（`html:774-776`）。
- **Preconditions：**
  - 命令 C1 生成 `player:1` 与 `zone:33` 两个 stream 的事件。
  - 命令 C2 生成 `player:1` 与 `city:2` 两个 stream 的事件。
  - `stream_heads` 的 seq 通过 `UPDATE stream_heads SET committed_seq=committed_seq+1 WHERE ... RETURNING committed_seq` 原子分配。
- **Exact timeline：**
  1. `T1` C1 决定锁 `stream_heads` 的顺序为：先 `player:1`，再 `zone:33`。
  2. `T2` C2 决定锁 `stream_heads` 的顺序为：先 `city:2`，再 `player:1`。
  3. `T3` C1 获取 `player:1` 的 stream_head 锁，等待 `zone:33`（假设 zone 被其他命令占用）。
  4. `T4` C2 获取 `city:2` 的 stream_head 锁，然后尝试获取 `player:1`；被 C1 阻塞。
  5. `T5` C1 释放 `player:1` 后去锁 `zone:33`，但 `zone:33` 仍被占用； meanwhile C2 持有 `player:1` 等待 C1 释放... 若再结合 aggregate_heads 锁，可形成循环等待。
- **Violated invariant：** D3 消费者具有有序事件流；命令管线无死锁；stream seq 单调无缺口。
- **Why current wording does not prevent it：** 规范只说“每条 stream 单调分配 seq”，但**没有给出同一事务涉及多个 stream 时的加锁全序**。实现者若按 stream_key 字符串排序则安全，但规范未强制。
- **Required spec revision：**
  1. 规定任何命令在分配 seq 前必须按 `stream_key` 全局字典序（或预定义命名空间 + ID 数值序）锁定所有相关 `stream_heads`。
  2. 把 seq 分配与 `stream_events` 插入放在同一事务，且 seq 只能从 `stream_heads` 的 `committed_seq+1` 原子获取。
  3. 禁止先分配 seq 再锁 head 的反向操作。
- **Acceptance evidence：** `TEST_STREAM_LOCK_ORDER_01`：并发提交 1000 条涉及多 stream 的命令，故意打乱 stream 加锁顺序；断言零死锁、最终每个 stream 的 seq 严格递增且无缺口。

---

### ST-02 [HIGH][COUNTEREXAMPLE] `outbox_events` 按 destination 清理与 `consumer_cursors` 按 consumer 跟踪不匹配，慢消费者丢失事件

- **Attacked v2.1 clause：** `outbox_events` 表注“仅在所有目标确认后按保留策略清理”（`html:1056`）、`consumer_cursors` 表注“cursor 只能连续前移；发现 gap 停止并重放”（`html:1057`）。
- **Preconditions：**
  - 事件 E 写入 `stream_events('player:1', seq=100)`。
  - E 需要投递到两个 destination：`push-gateway` 和 `audit-log`。
  - `push-gateway` 的消费者 C1 已 ack seq=100；`audit-log` 的消费者 C2 因离线尚未 ack。
  - 清理任务按 destination 检查：看到 `push-gateway` 已确认，删除 `outbox_events(E, push-gateway)`。
- **Exact timeline：**
  1. `T1` Relay 把 E 投递给 `push-gateway` 和 `audit-log`。
  2. `T2` `push-gateway` 确认，`audit-log` 未确认。
  3. `T3` 清理任务按 destination 删除 `(E, push-gateway)`，但保留 `(E, audit-log)`。
  4. `T4` `audit-log` 恢复，但它的 `consumer_cursors` 记录显示 `last_event_seq=99`，需要 seq=100。
  5. `T5` Relay 尝试从 `outbox_events` 取 seq=100 给 `audit-log`。由于 `(E, audit-log)` 仍在，可以投递。✅
- **Failure timeline（更隐蔽）：**
  1. `T1` 清理策略误判：实现者认为“只要 `consumer_cursors` 最小 seq 超过 100 即可删除 outbox”。
  2. `T2` `push-gateway` 的 cursor=100，`audit-log` 的 cursor=99；最小 cursor=99，不应删除。
  3. `T3` 但实现者把 `consumer_cursors` 按 stream_key 聚合时，只记录了一个“最快 consumer”的 cursor（或把不同 destination 的 consumer 混用）。
  4. `T4` 清理任务看到 cursor=100，认为所有消费者都已 ack，删除全部 `(E, *)`。
  5. `T5` `audit-log` 恢复后请求 seq=100，outbox 已空，只能请求 snapshot；但 snapshot cut 可能不包含 E 之后的 gap 恢复所需上下文，导致 audit-log 永久缺失 E。
- **Violated invariant：** D3 消费者 gap 检测与重放；outbox 清理水位不超过所有所需消费者最小 cursor。
- **Why current wording does not prevent it：** 规范虽然声明了清理原则，但**没有定义 `outbox_events` 的 destination 与 `consumer_cursors` 的 consumer 之间的映射关系**。如果实现者把“所有消费者”简化为“该 stream 的某条 cursor”，就会误删。
- **Required spec revision：**
  1. 定义每个 destination 对应一个明确的 consumer_group；`consumer_cursors` 的主键应包含 `(consumer_group, realm_id, stream_key)`。
  2. `outbox_events` 的清理水位 = `MIN(consumer_cursors.acked_seq) OVER (all consumer_groups subscribed to this stream)`，而不是 per-destination 的最小值或任意 cursor。
  3. 给出 outbox 保留策略的 SQL：只有当一个 stream_seq 被所有必需 consumer_group 确认后才可删除。
- **Acceptance evidence：** `TEST_OUTBOX_RETENTION_01`：构造 3 个 consumer_group，其中一个落后 1000 seq；断言 outbox 中该 1000 seq 范围内的事件未被删除，且落后 consumer 恢复后能无 gap 消费。

---

## 7. SCHEDULER_AND_SAGA_COUNTEREXAMPLES

### SS-01 [FATAL][COUNTEREXAMPLE] scheduler job 的命令 handler 未把 `scheduled_jobs` 条件更新与领域写入绑定，旧 lease 导致重复执行

- **Attacked v2.1 clause：** `scheduled_jobs` DDL 注释“Complete uses WHERE lease_token=:token AND lease_epoch=:epoch. Expired holders may submit the stable command but cannot mark success.”（`html:1186-1187`）、section 02 定时推进行（`html:969-973`）。
- **Preconditions：**
  - Worker W1 以 lease_token=T1、lease_epoch=1 领取 job J。
  - W1 执行 `job:J` 命令，域事务更新了 `city_buildings`（建筑升级完成），但**没有把 `UPDATE scheduled_jobs SET status='completed' WHERE lease_token=T1 AND lease_epoch=1` 作为事务成功的前提条件**（只当作普通 UPDATE）。
  - 在 W1 执行期间，lease 超时；W2 以 T2/epoch=2 重新领取 J。
- **Exact timeline：**
  1. `T1` W1 开始执行 `job:J`，域事务读取 `scheduled_jobs` 看到 epoch=1。
  2. `T2` W1 的 lease 超时。W2 执行 `UPDATE scheduled_jobs SET lease_token=T2, lease_epoch=2, status='leased' WHERE status='pending' ...`（规范 claim 条件），成功领取 J。
  3. `T3` W2 开始执行 `job:J`，域事务也准备升级同一建筑。
  4. `T4` W1 的域事务 COMMIT。由于事务内对 `scheduled_jobs` 的 UPDATE 只是“最好成功”，没有 `RETURNING` 也没有断言影响行数=1，即使 epoch 已变为 2，W1 的建筑升级仍然提交。
  5. `T5` W2 的域事务 COMMIT，建筑再次升级。
  6. `T6` 建筑被升级两次，或第二次因等级上限失败但领域效果已错乱。
- **Violated invariant：** W3“旧 lease 成功完成”；C5 调度器不得绕过命令入口直接改权威状态；命令恰好一次有效执行。
- **Why current wording does not prevent it：** 规范只说“Complete uses WHERE lease_token=:token AND lease_epoch=:epoch”，但**没有说明该 UPDATE 必须位于命令 handler 的域事务内，并且事务必须因影响行数=0 而回滚**。如果完成动作与领域写入分离，旧 lease 仍可产生重复领域效果。
- **Required spec revision：**
  1. 强制 `scheduled_jobs` 的条件更新必须是命令域事务的最后一个写操作，并使用 `RETURNING job_id`。
  2. 命令框架必须在事务提交前检查 `RETURNING` 结果非空；若为空，回滚整个事务。
  3. 规范示例 SQL 应改为：
     ```sql
     UPDATE scheduled_jobs
     SET status='completed', completed_at=now()
     WHERE realm_id=:realm AND job_id=:job
       AND lease_token=:token AND lease_epoch=:epoch AND status='leased'
     RETURNING job_id;
     -- 若 RETURNING 为空，立即 ROLLBACK;
     ```
- **Acceptance evidence：** `TEST_SCHEDULER_IDEMPOTENCY_01`：在 job 执行中途窃取 lease 给新 worker；断言旧 worker 的域事务因 lease 条件不满足而回滚，新 worker 只执行一次。

---

### SS-02 [FATAL][COUNTEREXAMPLE] Saga confirm 事件延迟越过 deadline，补偿后重复 confirm 破坏守恒

- **Attacked v2.1 clause：** Saga Rule（`html:996-997`）、`saga_instances` / `saga_steps` DDL（`html:1265-1297`）。
- **Preconditions：**
  - 跨 realm 转账：R1 的 P 转出 1000 gold 给 R2 的 Q。
  - Saga 状态：`reserving` → `confirming`，deadline_at = T。
  - R2 已给 Q 加 1000 gold 并发出 `TransferConfirmed` 事件，但事件网络延迟。
- **Exact timeline：**
  1. `T1` R1 reserve 1000 gold（`saga_reservations` 状态 `held`）。
  2. `T2` R1 发出 `TransferRequested` 事件到 R2。
  3. `T3` R2 消费事件，给 Q +1000 gold，发出 `TransferConfirmed` 事件回 R1。
  4. `T4` `TransferConfirmed` 在 deadline T 之后才到达 R1。
  5. `T5` R1 在 T 触发 compensate：把 1000 gold 退回 P，`saga_reservations` 状态 `released`，`saga_instances` 状态 `compensated`。
  6. `T6` 延迟的 `TransferConfirmed` 到达 R1。R1 的 confirm handler 按事件内容尝试把 `saga_instances` 状态改为 `completed` 并释放 reservation。但 reservation 已释放，P 已收回 1000 gold。
  7. `T7` 如果 confirm handler 未严格检查 `saga_instances.state='confirming'`，它可能：
     - 再次从 P 扣 1000 gold（P 现在只有 1000，扣后 0），然后释放 reservation（无资源可释放）；
     - 或把状态改为 `completed`，导致 Saga 记录显示已完成，但实际 P 并未转出、Q 已收到，系统 gold 总量多 1000。
- **Violated invariant：** Saga 终态唯一；资源守恒；confirm/compensate 幂等。
- **Why current wording does not prevent it：** 规范说“confirm/compensate 必须幂等”，但**没有给出跨 realm 事件的幂等键生成规则和状态机守卫**。跨 realm 事件没有天然的 command_id 可映射到 `saga_steps.command_id UNIQUE`。
- **Required spec revision：**
  1. 每个跨 realm confirm/compensate 事件必须携带 `saga_id` + `step_no` + `dedupe_key`（如 `saga_id:step_no:direction`）。
  2. 接收端必须将事件映射到 `saga_steps` 行，并严格检查当前状态：
     - confirm 只能在 `state='reserving' OR state='confirming'` 时生效；
     - compensate 只能在 `state='reserving' OR state='confirming'` 时生效；
     - 对已 `compensated` 或 `completed` 的 Saga，重复事件必须返回原结果。
  3. 增加 `saga_events` 或 `inbox_receipts` 记录每个跨 realm 事件的处理结果，作为幂等证据。
- **Acceptance evidence：** `TEST_SAGA_IDEMPOTENCY_01`：在 compensate 后投递 10 次原始 confirm 事件；断言 Saga 保持 `compensated`，P 与 Q 的 gold 总量守恒，无重复扣增。

---

## 8. LEDGER_AND_DOMAIN_CONSTRAINT_COUNTEREXAMPLES

### LE-01 [FATAL][COUNTEREXAMPLE] 拒付（chargeback）时 premium 已被消费，`balance_after >= 0` 约束导致无法全额扣回

- **Attacked v2.1 clause：** `economy_ledger_entries` DDL（`html:1247-1257`）、D5“付费货币、充值、退款和补偿进入不可变 ledger”（`html:777`）。
- **Preconditions：**
  - 玩家 P 充值 $10，获得 100 premium。Journal J1 posted：`premium +100`，cash +$10。
  - P 消费 60 premium 购买道具。Journal J2 posted：`premium -60`。
  - 支付渠道发起 chargeback，要求撤销 J1（退款 $10，回收 100 premium）。
- **Exact timeline：**
  1. `T1` 系统尝试创建 reversal journal J3 引用 J1，`premium -100`。
  2. `T2` 当前 premium 余额 = 40。`economy_ledger_entries` 的 `CHECK (balance_after >= 0)` 会拒绝 `balance_after = -60`。
  3. `T3` 系统被迫选择：
     - 只 reversal 40 premium（部分拒付），但支付渠道要求全额退款 $10，账实不符；
     - 把 P 的 premium 设为负数，违反 DDL CHECK；
     - 创建单独的“坏账/欠款”账户，但规范未定义；
     - 封禁 P 账号，但规范未定义 chargeback 政策。
- **Violated invariant：** 真实世界支付退款与经济 ledger 的闭环；premium 余额非负。
- **Why current wording does not prevent it：** 规范只声明“退款/补偿添加 reversals”，但**没有定义 chargeback 策略、部分拒付、坏账账户与玩家欠款处理**。把 `balance_after >= 0` 作为绝对约束会与现实支付冲突。
- **Required spec revision：**
  1. 区分“退款”（玩家主动/运营补偿）与“拒付”（支付渠道强制撤销）。
  2. 对拒付，允许 premium 余额临时为负或引入 `accounts_receivable`（玩家欠款）ledger 行，并定义催收/冻结/封号策略。
  3. 明确 reversal journal 的金额可以小于原 journal，但必须在审计中标注“partial chargeback”。
- **Acceptance evidence：** `TEST_CHARGEBACK_01`：模拟充值后消费再拒付；断言系统进入预定义的 chargeback 状态（negative balance 或 receivable），不违反审计规则，也不 silently 吞掉差额。

---

### LE-02 [HIGH][COUNTEREXAMPLE] 部分退款导致同 journal 借贷不守恒，触发 deferred constraint 失败或绕过

- **Attacked v2.1 clause：** `economy_ledger_entries` DDL 注释“同 journal 借贷守恒由 deferred constraint/transaction check 保证”（`html:1259-1260`）。
- **Preconditions：**
  - 玩家购买礼包，Journal J1 包含两行：`premium +100`（玩家账户）、`premium -100`（系统收入账户，或外部支付）。
  - 运营决定部分退款 30 premium。
- **Exact timeline：**
  1. `T1` 规范要求“退款添加 reversals”。实现者创建 reversal journal J2，包含：
     - `premium -30` 玩家账户；
     - `premium +30` 系统收入账户。
  2. `T2` 若 deferred constraint 要求“同一 journal 内各 currency 借贷之和为 0”，J2 满足（-30 + 30 = 0）。✅
  3. `T3` 但实现者可能错误地把 reversal 当作原 journal 的修改，直接给 J1 增加一行 `premium -30`（玩家账户），导致 J1 内借贷和 = 100 - 100 - 30 = -30 ≠ 0。
  4. `T4` 若 deferred constraint 不严格检查，余额与 ledger 偏离；若严格检查，事务无法提交。
- **Violated invariant：** 同 journal 借贷守恒；ledger append-only。
- **Why current wording does not prevent it：** 规范虽然提到“同 journal 借贷守恒”，但**没有给出 journal 行在退款/补偿场景下的精确记账规则**。实现者容易把 reversal 混入原 journal。
- **Required spec revision：**
  1. 强制任何经济调整都创建新 journal，不得修改已有 journal 或已有 ledger_entries。
  2. reversal journal 必须包含 `reversal_of` 引用原 journal，且自身借贷守恒。
  3. 给出 SQL deferred constraint 示例：
     ```sql
     CREATE CONSTRAINT TRIGGER economy_ledger_balance_check
     AFTER INSERT ON economy_ledger_entries
     DEFERRABLE INITIALLY DEFERRED
     FOR EACH ROW EXECUTE FUNCTION check_journal_balance_zero();
     ```
- **Acceptance evidence：** `TEST_LEDGER_BALANCE_01`：对任意历史 journal 执行全额/部分退款；断言所有 journal（包括 reversal）的 `SUM(delta)` per currency 为 0，且原 journal 行未被 UPDATE/DELETE。

---

### LE-03 [HIGH][SPEC_CONTRADICTION] 跨币种兑换无法同时满足“per currency 借贷守恒”与“汇率快照”

- **Attacked v2.1 clause：** `economy_ledger_entries` DDL（`html:1247-1257`）、“同 journal 借贷守恒由 deferred constraint/transaction check 保证”（`html:1259-1260`）。
- **Preconditions：**
  - 游戏允许用 100 gold 兑换 10 premium，汇率 10:1。
  - 玩家 P 执行兑换。
- **Exact timeline：**
  1. `T1` 若按 per currency 守恒，journal J 包含：
     - gold -100（P 的 gold 账户）
     - gold +100（系统 gold 池）
     - premium -10（系统 premium 池）
     - premium +10（P 的 premium 账户）
  2. `T2` 每一对 currency 内部借贷守恒，但**journal 作为一个整体没有跨币种守恒规则**。系统 gold 池多了 100 gold，premium 池少了 10 premium，资产负债表出现跨币种不平衡。
  3. `T3` 若运营需要审计“系统 premium 总供给是否等于玩家 premium 余额 + 池余额”，跨币种兑换会引入未记录的汇率损益。
- **Violated invariant：** 经济系统资产负债表平衡；跨币种兑换可追溯。
- **Why current wording does not prevent it：** 规范只要求“同 journal 借贷守恒 per currency”，但**没有给出跨币种兑换的汇率行、损益科目和快照规则**。该约束在单币种内成立，在多币种场景下不足以保证经济守恒。
- **Required spec revision：**
  1. 跨币种兑换必须记录汇率快照（`exchange_rate`, `rate_source`, `rate_version`）作为 journal 元数据。
  2. 引入系统“兑换损益”科目，确保系统总资产负债表在兑换前后可审计。
  3. 明确 `economy_journals` 的 `business_type='exchange'` 与 `business_key` 唯一性。
- **Acceptance evidence：** `TEST_EXCHANGE_01`：执行 100 gold → 10 premium；断言系统 gold 总量减少 100、premium 总量增加 10，且 ledger 中包含汇率快照与损益科目。

---
## 9. MIGRATION_RETENTION_AND_RESTORE_GAPS

### MG-01 [FATAL][COUNTEREXAMPLE] 合服时 realm ID 重映射未覆盖 owner_key / stream_key / cursor，导致事件路由错乱

- **Attacked v2.1 clause：** Partition Rule（`html:1070-1071`）、`realm_players` 表注（`html:1032`）。
- **Preconditions：**
  - Realm R1 与 R2 合并为 R3。
  - R1 有 player_id=1001（账户 A），R2 也有 player_id=1001（账户 B）。
  - 合服后，其中一个 player_id 必须重映射（如 R2 的 1001 → 1001001）。
- **Exact timeline：**
  1. `T1` 数据迁移脚本重映射 `realm_players` 与所有含 `player_id` FK 的表。
  2. `T2` 但 `command_receipts` 的 `result_versions` / `event_watermarks` 使用 `owner_key` 字符串（如 `player:1001`），这些字符串未随 player_id 重映射而更新。
  3. `T3` `stream_events` 的 `owner_key` 仍为旧值，`stream_heads` 的 `stream_key` 仍为旧值。
  4. `T4` `consumer_cursors` 的 `(consumer_name, realm_id, stream_key)` 仍为旧 realm_id 与旧 stream_key。
  5. `T5` 合服后，客户端以新 realm R3 和新 player_id 请求重连，携带旧 cursor。系统无法把旧 `player:1001` 映射到新 `player:1001001` 或新 `player:1001`，导致 gap 或 snapshot 错误。
- **Violated invariant：** Partition Rule“分区键从主键、唯一约束、路由、事件 stream、迁移到恢复保持一致”；合服后数据可解释。
- **Why current wording does not prevent it：** 规范只说“合服/拆服需要显式 ID 与游标迁移方案”，但**没有给出该方案的具体步骤、状态机和验收检查**。实现者容易只重映射主表而忽略字符串 key 和 cursor。
- **Required spec revision：**
  1. 定义 `migration_jobs` 状态机：`preparing → mapping_ids → rewriting_owner_keys → validating_cursors → cutting_streams → completed`。
  2. 要求所有 `owner_key`、`stream_key`、`cursor`、`watermark` 在合服/拆服时统一重映射，并保留新旧 ID 对照表（immutable mapping table）。
  3. 合服后必须对所有 `command_receipts`、`stream_events`、`consumer_cursors` 进行完整性校验，确保无悬空旧 key。
- **Acceptance evidence：** `TEST_MERGE_01`：模拟两个有重叠 player_id 的 realm 合并；断言合并后所有 owner_key/stream_key/cursor 一致，随机抽取 1000 条命令 receipt 可正确解析到新玩家。

---

### MG-02 [FATAL][SPEC_CONTRADICTION] ledger 不可变永久保留与数据主体删除权冲突

- **Attacked v2.1 clause：** `economy_journals` 表注“终态不可改写”（`html:1037`）、`economy_ledger_entries` DDL“Posted lines are append-only”（`html:1259-1260`）。
- **Preconditions：**
  - 玩家 P 请求删除账号（GDPR/CCPA 数据主体删除权）。
  - P 的充值、消费、退款记录存在于不可变的 `economy_journals` / `economy_ledger_entries` 中，且当地法律/税务要求保留 7 年。
- **Exact timeline：**
  1. `T1` 运营执行“账号删除”，尝试删除 `economy_ledger_entries` 中所有含 P 的 `player_id` 的行。
  2. `T2` 系统拒绝删除，因为 ledger append-only 且 `player_id` 是 ledger 行的关键维度。
  3. `T3` 若强制删除，审计链断裂，无法应对税务/退款纠纷；若不删除，则违反数据主体删除权。
  4. `T4` 若改为把 `player_id` 匿名化（如替换为 hash），则 ledger 行被修改，违反“不可变”语义；同时原 journal 的 `business_key` 可能仍包含可识别信息。
- **Violated invariant：** 法律合规（数据删除/匿名化）与经济审计（不可变 ledger）的平衡。
- **Why current wording does not prevent it：** 规范要求 ledger “终态不可改写”和“永久保留”，但**完全没有提及数据主体删除、匿名化策略或法定保留例外**。这是设计层面的内部矛盾。
- **Required spec revision：**
  1. 明确 ledger 的保留策略：税务/审计保留期 vs 数据主体删除请求的处理流程。
  2. 允许对过期且无法律纠纷的 ledger 行进行**不可逆匿名化**（如用单向 hash 替换 player_id），并记录匿名化审计日志。
  3. 对仍处保留期的记录，定义“受限处理”状态（数据不可用于营销/推荐，但保留于审计系统）。
- **Acceptance evidence：** `TEST_RETENTION_01`：模拟 GDPR 删除请求与税务保留期并存；断言系统在保留期内不物理删除 ledger，但可对超期 ledger 匿名化；审计日志能重建匿名化前后的关联。

---

### MG-03 [HIGH][INFERENCE] 备份恢复流程缺少 writer epoch 与 stream cursor 的对账证据

- **Attacked v2.1 clause：** Data Restore 表格（`html:1645`）、restore state machine（`html:1673-1686`）、R4/R5（`html:790-791`）。
- **Preconditions：**
  - 备份在命令 C 的域事务已提交、但 `stream_events` / `outbox_events` 尚未完全持久化时进行（例如 backup API 读到中间状态）。
- **Exact timeline：**
  1. `T1` 备份开始。此时数据库包含 C 的领域写入和 terminal receipt，但不包含 C 生成的 stream_events/outbox（因事务未提交或部分写入）。
  2. `T2` 用备份恢复新实例。
  3. `T3` 恢复流程按 v2.1 应执行 `INTEGRITY_VERIFIED → STREAMS_REPLAYED → RECEIPTS_JOBS_SAGAS_RECONCILED`。
  4. `T4` 但由于备份中缺少 stream_events，而 receipt 显示 committed，replay 无法找到对应事件，流程停在 `STREAMS_REPLAYED` 失败或 silently 跳过。
  5. `T5` 规范虽然列出恢复状态机，但**没有定义每个步骤的输入、输出和失败判定**。实现者可能直接重启服务，导致事件缺失。
- **Violated invariant：** R4/R5 恢复一致性；backup 是 crash-consistent 且可验证的。
- **Why current wording does not prevent it：** 恢复状态机是文字列表，没有具体的 SQL/检查点/校验和。它未说明如何检测“receipt 存在但事件缺失”或“旧 writer epoch 仍在”。
- **Required spec revision：**
  1. 为每个恢复步骤定义可执行检查：
     - `INTEGRITY_VERIFIED`：所有表约束通过，`command_receipts` 与 `stream_events` 按 `(command_id, event_id)` 外联无孤立；
     - `STREAMS_REPLAYED`：从 `stream_heads.committed_seq` 重建 outbox，核对 receipt 数量 = stream event 中对应 command_id 数量；
     - `RECEIPTS_JOBS_SAGAS_RECONCILED`：列出所有 `in_progress` receipt / `leased` job / `reserving/confirming/compensating` saga，由人工或监护人处理。
  2. 恢复后必须递增所有 `owner_epoch` 和 `lease_epoch`，并发布新的 writer epoch 到所有 runtime。
- **Acceptance evidence：** `TEST_RESTORE_01`：在持续写负载中执行备份并恢复；断言恢复流程检测到 receipt-event 不一致并进入 `RESTORE_BLOCKED`，直到对账完成。

---

## 10. DDL_AND_TRANSACTION_REVISIONS

以下修订针对 v2.1 规范本身，必须写入配套规范或 DDL 注释，并附带目标数据库与隔离级别。

### REV-01 owner_leases：placement authority 自 fencing + handoff 协议

**目标数据库：** PostgreSQL 15+ / SQLite 3.39+（支持 `RETURNING`）。  
**隔离级别：** READ COMMITTED 即可，依赖条件更新与 `RETURNING`。

```sql
-- placement authority 自 fencing：只有 leader token 与当前 epoch 匹配才能更新
ALTER TABLE owner_leases
  ADD COLUMN placement_leader_token TEXT NOT NULL DEFAULT 'init',
  ADD COLUMN drain_deadline_at TIMESTAMPTZ,
  ADD COLUMN drain_ack_holder TEXT;

-- epoch 只能由条件更新原子递增，禁止直接 SET owner_epoch = 6
CREATE OR REPLACE FUNCTION acquire_owner_lease(
  p_realm_id BIGINT, p_owner_key TEXT,
  p_holder_id TEXT, p_lease_until TIMESTAMPTZ,
  p_leader_token TEXT
) RETURNS TABLE(owner_epoch BIGINT, version BIGINT) AS $$
  UPDATE owner_leases
  SET owner_epoch = owner_epoch + 1,
      holder_id = p_holder_id,
      state = 'active',
      lease_until = p_lease_until,
      placement_leader_token = p_leader_token,
      drain_deadline_at = NULL,
      drain_ack_holder = NULL,
      updated_at = now()
  WHERE realm_id = p_realm_id AND owner_key = p_owner_key
    AND placement_leader_token = p_leader_token
    AND (state = 'draining' OR lease_until <= statement_timestamp())
  RETURNING owner_epoch, 0; -- version 从 aggregate_heads 取
$$ LANGUAGE SQL;

-- runtime 每次写事务必须重新读 owner_leases
UPDATE aggregate_heads h
SET version = version + 1, updated_at = now()
FROM owner_leases l
WHERE h.realm_id = :realm AND h.owner_key = :owner
  AND l.realm_id = h.realm_id AND l.owner_key = h.owner_key
  AND l.holder_id = :holder AND l.owner_epoch = :epoch
  AND l.state = 'active'
  AND l.lease_until > statement_timestamp()
  AND h.version = :expected_version
RETURNING h.version;
```

**说明：** 该修订把 placement authority 的 leader token 也纳入 fencing，防止 OF-03 的多 placement authority 重复 epoch；同时要求 runtime 在每次事务内用 `statement_timestamp()` 检查 lease，防止 OF-01 的 stale epoch 写入。

---

### REV-02 command_receipts：单事务状态机 + 恢复监护人

**目标数据库：** PostgreSQL 15+ / SQLite 3.39+。  
**隔离级别：** READ COMMITTED，利用 `ON CONFLICT` / `RETURNING`。

```sql
-- 增加恢复标记，防止 in_progress 永远悬空
ALTER TABLE command_receipts
  ADD COLUMN holder_id TEXT,
  ADD COLUMN owner_epoch BIGINT,
  ADD COLUMN recovery_deadline_at TIMESTAMPTZ,
  ADD COLUMN recovery_attempts INTEGER NOT NULL DEFAULT 0;

-- 同一个外层事务模板（伪代码）：
BEGIN;
  -- 1. 幂等插入/查询
  INSERT INTO command_receipts (realm_id, command_id, status, holder_id, owner_epoch,
                                recovery_deadline_at, owner_set_hash, payload_hash)
  VALUES (:realm, :cmd, 'in_progress', :holder, :epoch,
          now() + interval '30s', :osh, :ph)
  ON CONFLICT (realm_id, command_id) DO NOTHING
  RETURNING status;
  -- 若 RETURNING 为空则 SELECT 现有 terminal 状态并直接返回。

  -- 2. 获取 owner lease 与 aggregate_heads 锁（按全局顺序）
  --    ... 见 REV-01 的 aggregate_heads CAS ...

  -- 3. 插入 stream_events / outbox / scheduled_jobs / saga_steps / economy ledger

  -- 4. 在同一事务内更新 terminal receipt
  UPDATE command_receipts
  SET status='committed', result=:result, result_versions=:rv,
      event_watermarks=:ew, terminal_at=now(), recovery_deadline_at=NULL
  WHERE realm_id=:realm AND command_id=:cmd
    AND status='in_progress'
    AND holder_id=:holder AND owner_epoch=:epoch;

  -- 5. 断言上一步影响行数 = 1，否则 ROLLBACK。
COMMIT;

-- 恢复监护人：扫描过期 in_progress 并重新执行或失败
CREATE INDEX idx_command_receipts_recovery
  ON command_receipts (realm_id, status, recovery_deadline_at)
  WHERE status = 'in_progress';
```

**说明：** 该修订把 `accepted/in_progress/terminal` 全部纳入同一事务边界，并引入 `recovery_deadline_at` 和恢复监护人索引，解决 RC-01 / RC-02 的悬空问题。

---

### REV-03 scheduled_jobs：命令 handler 内嵌条件完成

**目标数据库：** PostgreSQL 15+ / SQLite 3.39+。  
**隔离级别：** READ COMMITTED。

```sql
-- 命令 handler 必须在同一事务内完成 scheduled_jobs 的条件更新
-- 该 UPDATE 必须放在所有领域写入之后，且事务必须因 RETURNING 为空而失败
UPDATE scheduled_jobs
SET status = 'completed', completed_at = now(),
    lease_token = NULL, lease_until = NULL
WHERE realm_id = :realm AND job_id = :job
  AND lease_token = :token
  AND lease_epoch = :epoch
  AND status = 'leased'
RETURNING job_id;
-- 若 RETURNING 为空：ROLLBACK;
```

**说明：** 这直接防止 SS-01：旧 lease 的域事务即使已更新领域行，也会因 `scheduled_jobs` 条件不满足而整体回滚。

---

### REV-04 stream_heads：多 stream seq 分配的全局锁顺序

**目标数据库：** PostgreSQL 15+ / SQLite 3.39+。  
**隔离级别：** READ COMMITTED。

```sql
-- 在命令事务内，按全局顺序锁定所有相关 stream_heads，再原子分配 seq
WITH locked AS (
  SELECT realm_id, stream_key, committed_seq
  FROM stream_heads
  WHERE realm_id = :realm AND stream_key = ANY(:stream_keys)
  ORDER BY stream_key
  FOR UPDATE
),
allocated AS (
  UPDATE stream_heads
  SET committed_seq = committed_seq + 1,
      updated_at = now()
  WHERE (realm_id, stream_key) IN (
    SELECT realm_id, stream_key FROM locked
  )
  RETURNING stream_key, committed_seq AS new_seq
)
INSERT INTO stream_events (realm_id, stream_key, stream_seq, event_id, owner_key,
                           owner_version, schema_version, event_type, payload, committed_at)
SELECT :realm, stream_key, new_seq, gen_random_uuid(), :owner_key,
       :owner_version, :schema_version, :event_type, :payload, now()
FROM allocated;
```

**说明：** `ORDER BY stream_key FOR UPDATE` 保证所有涉及多 stream 的命令以相同顺序加锁，避免 ST-01 死锁；`UPDATE ... RETURNING` 保证 seq 原子分配。

---

### REV-05 economy_ledger_entries：跨币种兑换与拒付的完整约束

**目标数据库：** PostgreSQL 15+。  
**隔离级别：** READ COMMITTED，deferred constraint 在事务提交时检查。

```sql
-- 1. 增加汇率与损益科目
ALTER TABLE economy_journals
  ADD COLUMN exchange_rate NUMERIC,
  ADD COLUMN rate_source TEXT,
  ADD COLUMN chargeback_state TEXT CHECK (chargeback_state IN (NULL,'partial','full','receivable'));

-- 2. 强制 journal 内 per currency 借贷守恒（deferred constraint）
CREATE OR REPLACE FUNCTION check_economy_journal_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT currency
    FROM economy_ledger_entries
    WHERE realm_id = NEW.realm_id AND journal_id = NEW.journal_id
    GROUP BY currency
    HAVING SUM(delta) <> 0
  ) THEN
    RAISE EXCEPTION 'journal % does not balance per currency', NEW.journal_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_economy_journal_balance
AFTER INSERT ON economy_ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_economy_journal_balance();

-- 3. 允许拒付导致的负余额或 receivable 账户
--    通过把拒付金额写入 player 的 receivable 账户而非直接扣减 premium 余额
CREATE TABLE player_receivables (
  realm_id BIGINT NOT NULL,
  player_id BIGINT NOT NULL,
  currency TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount >= 0),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (realm_id, player_id, currency, created_at)
);
```

**说明：** 该修订把跨币种兑换的汇率/损益和 chargeback 的 receivable 账户纳入 ledger 体系，解决 LE-01 / LE-03。

---

### REV-06 saga_instances：跨 realm confirm/compensate 幂等守卫

**目标数据库：** PostgreSQL 15+ / SQLite 3.39+。  
**隔离级别：** READ COMMITTED。

```sql
-- 增加跨 realm 事件 inbox 幂等表
CREATE TABLE saga_inbox_receipts (
  realm_id BIGINT NOT NULL,
  saga_id UUID NOT NULL,
  step_no INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('confirm','compensate')),
  dedupe_key TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL,
  result_state TEXT NOT NULL,
  PRIMARY KEY (realm_id, saga_id, step_no, direction),
  UNIQUE (realm_id, dedupe_key)
);

-- confirm handler 必须检查当前状态与幂等 receipt
CREATE OR REPLACE FUNCTION saga_apply_confirm(
  p_realm_id BIGINT, p_saga_id UUID, p_step_no INTEGER, p_dedupe_key TEXT
) RETURNS TEXT AS $$
DECLARE
  v_state TEXT;
BEGIN
  -- 幂等：已处理过则返回原结果
  SELECT result_state INTO v_state
  FROM saga_inbox_receipts
  WHERE realm_id = p_realm_id AND saga_id = p_saga_id AND step_no = p_step_no
    AND direction = 'confirm';
  IF FOUND THEN RETURN v_state; END IF;

  SELECT state INTO v_state FROM saga_instances
  WHERE realm_id = p_realm_id AND saga_id = p_saga_id FOR UPDATE;

  IF v_state NOT IN ('reserving','confirming') THEN
    -- 已 compensated/completed/escalated，拒绝重复 confirm
    INSERT INTO saga_inbox_receipts (...)
    VALUES (..., 'ignored_state_' || v_state)
    ON CONFLICT DO NOTHING;
    RETURN 'ignored';
  END IF;

  -- 执行 confirm 业务...
  UPDATE saga_instances SET state='completed' WHERE ...;
  INSERT INTO saga_inbox_receipts (...) VALUES (...,'completed')
  ON CONFLICT DO NOTHING;
  RETURN 'completed';
END;
$$ LANGUAGE plpgsql;
```

**说明：** 通过 `saga_inbox_receipts` 把跨 realm 事件映射到 `(saga_id, step_no, direction)`，并严格检查 `saga_instances.state`，解决 SS-02 的延迟 confirm 重复问题。

---
## 附录：并发与崩溃恢复时间线图解

以下时间线对应正文中的关键反例，用于在评审席上快速复现与验证。

### 并发时间线 X1：Owner Handoff 双写者（对应 OF-01）

```text
时间轴  placement authority P          Runtime R1 (旧 holder)        Runtime R2 (新 holder)
T1      UPDATE owner_leases
        SET state='draining'
        WHERE owner_key='player:42'
T2                                   未感知 draining，从 mailbox
                                     取出 C1 开始执行
T3      等待 drain_deadline 超时
T4      UPDATE owner_leases
        SET owner_epoch=6,
            holder_id='R2',
            state='active'
        WHERE owner_key='player:42'
T5                                   C1 事务内读 owner_leases：
                                     若读到 epoch=5 & active → 提交（BUG）
T6                                                               以 epoch=6 执行 C2
结果：player:42 同时被 epoch=5 与 epoch=6 写入，违反 C1。
```

---

### 并发时间线 X2：多 owner 命令与 lease 转移并发（对应 OF-04）

```text
时间轴  命令 C1（player:1 + cell:33:7）      placement authority P
T1      lock receipt
        lock owner_leases('player:1')   -- 未锁 cell:33:7 的 lease
        lock aggregate_heads('player:1')
        lock aggregate_heads('cell:33:7')
T2                                       UPDATE owner_leases('cell:33:7')
                                          SET state='draining'
T3                                       UPDATE owner_leases('cell:33:7')
                                          SET owner_epoch=4,
                                              holder_id='R2'
T4      读 cell:33:7 lease 得 epoch=3（旧读）
        UPDATE world_tile_state ...    -- 以旧 epoch 提交（BUG）
T5                                       R2 以 epoch=4 更新同一 tile
结果：tile 被 epoch=3 与 epoch=4 交错修改。
```

---

### 并发时间线 X3：Stream seq 分配死锁（对应 ST-01）

```text
时间轴  命令 C1（player:1 + zone:33）   命令 C2（player:1 + city:2）
T1      lock stream_heads('player:1')
T2                                   lock stream_heads('city:2')
T3      等待 zone:33 的锁（被其他命令占）
T4                                   lock stream_heads('player:1') -> 阻塞 C1
T5      （若 C1 同时持有 player:1 aggregate lock，且 C2 等待）
        形成循环等待 -> 死锁
```

---

### 并发时间线 X4：Scheduler 旧 lease 重复执行（对应 SS-01）

```text
时间轴  Worker W1 (lease T1/epoch=1)      Worker W2 (lease T2/epoch=2)
T1      开始执行 job:J 的域事务
        UPDATE city_buildings SET level=level+1 ...
T2                                       claim job J (epoch=2)
T3                                       开始执行 job:J 的域事务
        UPDATE city_buildings SET level=level+1 ...
T4      对 scheduled_jobs 的 UPDATE
        WHERE lease_token=T1 影响 0 行
        但领域事务已提交（BUG）
T5                                       域事务提交
结果：建筑等级 +2。
```

---

### 崩溃恢复时间线 R1：Receipt 与领域写入分离导致 in_progress 悬空（对应 RC-01）

```text
T1  客户端发送 commandId=C
T2  Runtime R 写入 command_receipts(status='in_progress')  -- 独立事务提交
T3  R 开始域事务：UPDATE aggregate_heads, domain rows, stream_events...
T4  R 崩溃
T5  事务回滚，领域未写入，但 receipt 仍为 in_progress
T6  客户端重试 C -> Runtime R2 看到 in_progress
T7  无恢复监护人 -> C 永久悬空，业务效果未知
```

---

### 崩溃恢复时间线 R2：COMMIT unknown 但 receipt 已 terminal（规范理想路径 + 风险点）

```text
T1  客户端发送 commandId=C
T2  Runtime R 在同一事务中：
      - 写 domain rows
      - 写 terminal receipt (committed)
      - COMMIT
T3  R 在发送 ACK 前崩溃
T4  客户端查询 /commands/C -> Runtime R2
T5  R2 读取 command_receipts -> committed
T6  返回结果给客户端 ✅
风险点：若实现未把 terminal receipt 与 domain 放在同一事务（RC-01），
       T2' 会变成 domain 已提交但 receipt 仍 in_progress，导致 R2 无法收敛。
```

---

### 崩溃恢复时间线 R3：Saga 在 reserve 与 confirm 之间崩溃（对应 SS-02）

```text
R1 源端                            R2 目标端
T1  BEGIN
    INSERT saga_instances(reserving)
    INSERT saga_reservations(held, 1000 gold)
    UPDATE player_resources SET gold=gold-1000
    INSERT stream_events(TransferRequested)
    COMMIT
T2                                 消费 TransferRequested
                                   BEGIN
                                   UPDATE player_resources SET gold=gold+1000
                                   INSERT stream_events(TransferConfirmed)
                                   COMMIT
T3  R1 崩溃，在消费 TransferConfirmed 前
T4  R1 重启，saga_instances 状态=reserving，deadline_at=T
T5  TransferConfirmed 延迟，在 T 之后才到达
T6  R1 触发 compensate：
    UPDATE saga_instances SET state='compensating'
    UPDATE player_resources SET gold=gold+1000   -- 退回 P
    UPDATE saga_reservations SET state='released'
    INSERT stream_events(TransferCompensated)
    COMMIT
T7  延迟的 TransferConfirmed 到达 R1
T8  若 confirm handler 未检查 state='confirming'：
    可能再次扣 P 1000 gold 并标记 completed -> 资源不守恒（BUG）
```

---

## 11. REQUIRED_ACCEPTANCE_TESTS

每条测试必须可自动化、可复现、不依赖“用户少”或“提高超时”。

### Owner / Fencing
- `TEST_HANDOFF_01`：draining 后旧 holder 不交错写入（见 OF-01）。
- `TEST_HANDOFF_02`：强制撤销 lease 时外部副作用可补偿（见 OF-02）。
- `TEST_PLACEMENT_01`：双 placement authority 并发转移产生唯一递增 epoch（见 OF-03）。
- `TEST_MULTI_OWNER_LEASE_01`：多 owner 命令锁所有 owner_leases（见 OF-04）。

### Receipt / Unknown Commit
- `TEST_RECEIPT_PERSISTENCE_01`：in_progress 与 domain 在同一事务，崩溃后无悬空（见 RC-01）。
- `TEST_RECOVERY_01`：COMMIT-unknown 后恢复监护人最终返回 terminal（见 RC-02）。
- `TEST_RECEIPT_STATE_MACHINE_01`：transient 失败不直接升级为 failed_final（见 RC-03）。

### Lock Order / Multi Owner
- `TEST_DYNAMIC_OWNER_01`：动态发现 owner 后同 commandId 收敛（见 LO-01）。
- `TEST_M_MAX_01`：不可 Saga 化的命令保持原子性（见 LO-02）。
- `TEST_LOCK_ORDER_02`：多 owner + 多 stream 命令零死锁（见 LO-03）。

### Stream / Outbox / Snapshot
- `TEST_STREAM_LOCK_ORDER_01`：多 stream seq 分配无死锁无缺口（见 ST-01）。
- `TEST_OUTBOX_RETENTION_01`：慢消费者不导致事件被误删（见 ST-02）。

### Scheduler / Saga
- `TEST_SCHEDULER_IDEMPOTENCY_01`：旧 lease 无法完成 job（见 SS-01）。
- `TEST_SAGA_IDEMPOTENCY_01`：compensate 后重复 confirm 不破坏守恒（见 SS-02）。

### Ledger / Economy
- `TEST_CHARGEBACK_01`：拒付后系统进入预定义状态（见 LE-01）。
- `TEST_LEDGER_BALANCE_01`：退款 journal 自身借贷守恒且原 journal 不可变（见 LE-02）。
- `TEST_EXCHANGE_01`：跨币种兑换可审计（见 LE-03）。

### Migration / Retention / Restore
- `TEST_MERGE_01`：合服后 owner_key/stream_key/cursor 一致（见 MG-01）。
- `TEST_RETENTION_01`：GDPR 删除与 ledger 保留可调和（见 MG-02）。
- `TEST_RESTORE_01`：恢复流程检测 receipt-event 不一致（见 MG-03）。

---

## 12. BLOCKING_QUESTIONS

在继续实现前，设计方必须回答以下问题，且答案必须以可执行 SQL/状态机/测试用例形式落地。

1. **Owner Handoff**
   - placement authority 是单进程还是多进程？若是多进程，epoch 分配使用什么原子原语（数据库条件更新 / 分布式锁 / 序列）？
   - draining 阶段如何通知 runtime？mailbox 排空完成的可观测条件是什么？旧 holder 僵死时的强制撤销超时是多少？
   - runtime 的每个命令事务是否强制 `SELECT ... FROM owner_leases FOR UPDATE` 重新读取当前 epoch/state？

2. **Multi Owner / Lock Order**
   - 全局锁顺序是否覆盖 `owner_leases`、`aggregate_heads`、`stream_heads`、所有 domain 表？请给出完整的 `(<table-kind>, owner_key/stream_key)` 排序算法。
   - 动态发现新 owner 后的重路由次数上限是多少？`command_receipts` 的 `owner_set_hash` 是否允许在 `in_progress` 期间更新？
   - `M_max` 的测量口径是什么（owner key 数 / 锁行数 / 事务持续时间）？哪些命令类型不可 Saga 化？

3. **Receipt State Machine**
   - `accepted` 与 `in_progress` 是否必须在同一个外层事务中写入？恢复监护人的扫描周期、重试预算与升级为 `failed_final` 的条件是什么？
   - COMMIT-unknown 时，若 receipt 为 `in_progress` 但原 runtime 已死，谁负责继续执行？执行前如何确认原 lease 已过期？

4. **Stream / Outbox / Snapshot**
   - 多 stream seq 分配的锁顺序是什么？是否 `ORDER BY stream_key FOR UPDATE`？
   - `outbox_events` 的清理水位如何根据 `consumer_cursors` 计算？destination 与 consumer_group 的映射关系是什么？
   - `stream_events` 的保留期是多少？超过保留期后 snapshot 如何重建？

5. **Scheduler**
   - scheduler job 的命令 handler 是否把 `UPDATE scheduled_jobs SET status='completed' WHERE lease_token=? AND lease_epoch=?` 与领域写入放在同一事务，并断言影响行数=1？
   - job 的 `dedupe_key` 与 commandId `job:{jobId}` 的关系是什么？旧 lease 提交同一 commandId 时，command_receipts 如何返回 terminal？

6. **Saga**
   - 跨 realm confirm/compensate 事件的幂等 `dedupe_key` 格式是什么？接收端如何根据 `saga_instances.state` 拒绝非法事件？
   - `saga_reservations` 的守恒如何检查？compensate 失败多少次后进入 `escalated`？人工修复审计记录在哪里？

7. **Ledger / Economy**
   - `player_resources.premium` 是由 ledger 触发器维护的物化视图，还是允许命令直接 UPDATE？
   - chargeback 导致余额不足时，系统采用 negative balance、receivable 账户还是封号？请给出状态机与 ledger 记账规则。
   - 跨币种兑换的汇率快照、系统损益科目与守恒校验如何实现？

8. **Domain Constraints**
   - `alliances.leader_player_id` 的 deferred composite FK 在 MySQL/SQLite 中的等价实现是什么？
   - `alliance_members` 的 `WHERE state='active'` partial unique 在目标数据库中如何表达？
   - `world_tile_state` 的单归属约束用 `EXCLUDE`、partial unique 还是应用层 CAS？请给出具体 DDL。

9. **Migration / Merge / Split / Restore**
   - 合服时 player_id / army_id / battle_id / city_id 的重映射方案是什么？`owner_key` / `stream_key` / `consumer_cursors` 如何统一重写？
   - 恢复状态机 `REQUESTED → ... → TRAFFIC_REOPENED` 的每一步输入/输出/失败判定是什么？如何检测并修复 receipt-event 不一致？
   - 备份是否冻结 writer / 使用 online backup API / WAL 归档？RPO/RTO 如何测量？

10. **Retention / Data Subject Rights**
    - `economy_journals/ledger_entries` 的法定保留期是多少？超期后如何匿名化？
    - 数据主体删除请求触发时，哪些表必须物理删除、哪些必须匿名化、哪些永久保留？请给出明确矩阵。

---

## 结论摘要

- **默认裁决：NOT_PROVEN。** v2.1 新增的数据机制方向正确，但规范本身在 owner lease authority 自 fencing、handoff 协议、receipt 状态机持久化点、多 owner + 多 stream 锁顺序、scheduler job 的条件完成、Saga 跨 realm 幂等、ledger 拒付/跨币种、domain constraint 可移植性、合服 cursor 迁移、ledger 保留与删除权等方面均存在缺口或内部矛盾。
- **FACT：** 当前 `backend/` 源码尚未实现 v2.1 定义的多数核心表，仍使用 `owner_locks`/`command_idempotency` 与大型 JSON `game_states`。
- **INFERENCE：** 若按当前 v2.1 文字直接实现，会引入 placement authority 双 epoch、handoff 双写、receipt 悬空、stream 死锁、scheduler 重复执行、Saga 资源不守恒、chargeback 无法闭环、合服 cursor 错乱等系统性风险。
- **COUNTEREXAMPLE：** 本报告给出 14 个具体失败场景（4 owner/fencing、3 receipt/unknown-commit、3 lock/M/stream、2 scheduler/Saga、3 ledger、1 migration、1 retention，满足并超出最低要求）。
- **TIMELINES：** 4 条并发时间线 + 3 条崩溃恢复时间线。
- **DDL REVISIONS：** 6 组具体 SQL/DDL/CAS 修订，说明目标数据库与隔离级别。
- **下一步：** 必须先回答 12 节中的阻塞问题、补充规范、DDL、状态机与验收测试，并全部通过自动化故障注入测试，才能判定 v2.1 数据架构合格。
