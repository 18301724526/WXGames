# SLG 后端参考架构 v2.2 最终交叉质询与证据裁决报告

> 席位：最终交叉质询与证据裁决席（提示词五）
> 日期：2026-07-14
> 输入：`7月14日后端架构/成熟SLG后端参考架构-v2.2.html`、`容量合同-v2.2.schema.json`、`容量合同判定器规范-v2.2.md`、`当前实现迁移路线图-v2.2.md`；四份席位报告 `tmp/architecture-v2.2-adversarial-{kimi-data, glm-protocol-security, gpt-sol-capacity, deepseek-reliability}.md`；必要代码事实的只读复核（CommandCommitter.js、CommandIdempotencyStore.js、world-worker.js、server.js、容量 schema 的机械重验）。
> 本席不做多数投票，不按篇幅计分；每条 finding 按架构原文、数据库/协议语义与已裁决纪律独立复核。

---

## 1. FINAL_V2_2_VERDICT

```text
FINAL_VERDICT            = REVISE_TO_V2_3
REFERENCE_V2_2_STATUS    = NOT_PROVEN（维持）
CURRENT_IMPLEMENTATION   = NON_CONFORMING（维持，任何情况下不得改为 CONFORMING）
```

**裁决理由：**

1. **不构成 REJECT_FOUNDATION。** 核心模型内部自洽：单行 epoch CAS + 持锁至 COMMIT 的 fencing、原子 receipt 终态、outbox/stream 职责分离、job lease 零行回滚、per-currency 守恒 ledger、restore 状态机骨架——四席共 6 条以"旧 epoch / 旧 lease / 双 placement / job steal / 迟到 confirm"为形状的攻击时间线，在规范已写明的行锁、CAS 与同事务提交下均不成立（见第 3 节），证明骨架挡得住标准攻击。
2. **不构成 ACCEPT_FOR_IMPLEMENTATION。** 经交叉复核后仍确认 **5 条规范级 P0**（FL-01 handoff draining/激活谓词、FL-13 授权 epoch 提交点线性化边界、FL-24 容量合同最终守恒字段、FL-32 restore run 单例准入、FL-38 PITR cut × 外部已消费事件/seq 重用）与 **1 条已被机械证实的 SPEC_CONTRADICTION**（FL-26：schema 的 overall PASS 分支与判定器 §11 的"有效 NA 可整体 PASS"在合同如实申报前提下不可同时满足），另有约 20 条 P1 级 UNDER_SPECIFIED/UNTESTABLE。按裁决规则，存在规范级 P0/P1 缺口即 `REVISE_TO_V2_3`。
3. **容量合同维持 NOT_PROVEN 是规范自洽的结果。** 判定器规范 §12 明文规定：判定器未通过自身 mutation suite 前所有容量报告保持 NOT_PROVEN。当前无可执行 evaluator（IMPLEMENTATION_ONLY_GAP），且 schema 缺少 evaluator 唯一复算所需的 typed 输入（UNTESTABLE），两层各自成立、互不冒充。
4. **四席报告的总体质量分布：** GPT-Sol 的机械攻击全部经本席按 schema JSON 重验属实（含 8 个强制样例的 3 拒 5 收）；DeepSeek 的可靠性 SPEC 缺口大多成立但两处分类过度；GLM 的 A1 系为本轮最有价值的规范级发现，但 A6/A10 主体与已裁决纪律冲突；Kimi 的 10 条 P0 中 3 条整体或主体为 FACT_ERROR（时间线被规范已写明机制阻止）、4 条严重度夸大，2 条（P0-1、与 GLM 共享的水位/plan 问题）为真缺口。

---

## 2. CROSS_REPORT_FINDING_LEDGER

同根问题合并为一条 ledger，保留不同事故链引用。"原判"为席位自报分类/严重度，"终判"为本席复核结果。

### 2.1 所有权 / 事务 / 数据域（主源：KIMI）

| ID | 来源 | 议题 | 原判 | 终判 | 裁决要点 |
|---|---|---|---|---|---|
| FL-01 | Kimi P0-1 | handoff draining 期旧 holder 的最终 fencing 谓词、`transferring→active` 激活步骤、`committed_watermarks` 写入点 | UNDER_SPECIFIED P0 | **UNDER_SPECIFIED P0 确认** | Owner Handoff Rule 宣布 `active→draining→transferring→active` 循环并允许 draining 期拒绝新 admission（隐含 in-flight 可提交），但示例 SQL 要求 `l.state='active'`，二者按字面无法调和：严格按 SQL 则 drain 无意义且 handoff CAS 后 owner 停在 `transferring` 永久不可写（活性坍塌）；放宽谓词又无规范文字可依（双写风险）。激活步骤与 watermark 写入事务归属完全缺失。这是全部四份输入里唯一同时威胁单写者与活性的规范级空洞。 |
| FL-02 | Kimi P0-2 | 示例 fencing SQL 的 `UPDATE ... FROM owner_leases` 不锁源行 | UNDER_SPECIFIED P0 | **FACT_ERROR（作为 P0 反例）；残余编辑级 P2** | PostgreSQL 语义事实正确（FROM 表不加锁），但规范在同一代码块注释与 Owner Handoff Rule 两处都已明文要求"SELECT the lease FOR UPDATE first and hold it through COMMIT"/"每笔事务在 COMMIT 前持有 lease 行锁"。持锁前提下 placement CAS 阻塞至旧事务提交后才求值，反例时间线不可达。按纪律第 7 条，以"实现方跳过规范已要求的锁"构造的时间线判 FACT_ERROR。残余：示例 SQL 应自包含（内联 FOR UPDATE + 行数断言），属编辑修订。 |
| FL-03 | Kimi P0-3 | receipt 终态与领域写是否同事务 | UNDER_SPECIFIED P0（+当前实现 IMPLEMENTATION_ONLY_GAP） | **规范侧 CONFIRMED_SPEC_CLOSURE + FACT_ERROR（作为规范反例）；实现侧 IMPLEMENTATION_ONLY_GAP（M1）确认** | 规范三处闭环："terminal receipt 与领域事务原子提交"（表约束列）、"The domain transaction locks this row and atomically writes domain state + terminal status + result"（代码注释）、D1。"terminal receipt 写在另一个事务"即不合规实现，不是规范反例。当前代码事实经复核属实：`CommandCommitter.commit()`（backend/application/commands/CommandCommitter.js:50 起）经 repository 持久化领域状态，`recordResult()`（:110）另行写终态——正是路线图 M1 已登记的差距；且 `CommandIdempotencyStore.begin()` 先持久化 `in_progress`，符合已裁决事实边界（真实故障是残留 COMMAND_IN_FLIGHT，不是"无 receipt 重复执行"）。 |
| FL-04 | Kimi P0-4 + P1-2 | receipt↔execution plan 的 plan_attempt 绑定、重试选择规则、plan 不可变的 DDL 强制 | UNDER_SPECIFIED P0 / P1 | **UNDER_SPECIFIED P1（降级）** | 规范已给出骨架：`command_receipts.plan_attempt` 字段存在、plan"计划不可变"、`superseded_by`、"动态 owner 发现只能整体回滚并新增 attempt"。真缺口是执行者按哪个 attempt 读 plan、receipt.plan_attempt 何时以何谓词推进、`owner_set_hash` 规范化排序——收敛性/活性问题而非已证明的原子性破坏，降 P1。FK 与不可变触发器属 DDL 强化项。 |
| FL-05 | Kimi P0-5 | scheduled job 完成 CAS 必须是最后一条写语句 | UNDER_SPECIFIED P0 | **FACT_ERROR** | 两个方向的时间线都被规范已写明机制阻止：(a) 完成 UPDATE 先执行→该行被本事务行锁持至 COMMIT，steal 的 CAS 阻塞到提交后，见到 `status='completed'` 影响 0 行；(b) steal 先提交→执行者的完成 UPDATE `WHERE lease_token=:token` 影响 0 行，规范明文"影响零行则 raise 并回滚每一笔领域写"（scheduled_jobs 代码注释 + D6）。语句顺序建议无害但非正确性必需。 |
| FL-06 | Kimi P0-6 | saga_steps `UNIQUE(realm_id, dedupe_key)` 作用域过宽 + 迟到 confirm 的失败语义 | UNDER_SPECIFIED P0 | **UNDER_SPECIFIED P1（降级）** | 守恒不被破坏：迟到/重复 confirm 被规范已写明的 state+version CAS 与"changes zero rows and is ignored"挡住。真缺口：dedupe_key 构造规则未定义（不含 saga_id 时无关 saga 相互阻塞——活性缺陷）、重复消息应"幂等返回原结果"还是报错未钉死。属执行语义缺失而非守恒反例。 |
| FL-07 | Kimi P0-7 | ledger 的 FX/退款/拒付/手续费/税费/unknown 建模 | UNDER_SPECIFIED P0 | **UNDER_SPECIFIED P1 + 部分 FACT_ERROR** | 部分事实错误：`reversal_of`、`fx_snapshot_id` 已存在于逻辑表目录（economy_journals 关键字段行），Kimi 断言"当前 DDL 无"仅对示例 CREATE TABLE 成立——目录与示例 DDL 不同步是编辑缺陷。外部 unknown 结果按规范设计意图走 outbox + reserve/confirm/compensate（journal 只记已确定事实），不必进 journal 状态机。真缺口（P1）：FX 舍入方向与 rounding 账户、手续费/税费 account_class、部分退款上限谓词、fx_snapshots 表结构——per-currency 守恒 + 不可变 ledger 的原则已闭环（纪律亦禁以此制造矛盾）。 |
| FL-08 | Kimi P0-8 | snapshot builder 多 stream 水位的一致切面读取 | UNDER_SPECIFIED P0 | **UNDER_SPECIFIED P1（降级）** | 不变量已声明且可测（"snapshot + seq>watermark 必须精确重建"），违反即不合规；缺的只是机制一句话（单事务快照隔离读 heads+payload，或 cut marker）。P6/P5 明示 per-stream 语义，无跨流一致 cut 义务（与 GLM A8、已裁决"不要默认全局 cut"一致）。 |
| FL-09 | Kimi P0-9 | outbox "durable accept" 判定标准 | UNDER_SPECIFIED P0 | **UNDER_SPECIFIED P1 + 部分 FACT_ERROR** | 丢失时间线被规范已写明的双保险挡住一半：stream_events retention 受 required consumer 最小 cursor 保护（consumer_cursors 行），outbox 早清后内部消费者仍可从 stream 重放；纪律亦已裁决 outbox 清理与 stream retention 是两个机制。真缺口（P1）：对不读 stream 表的**外部 destination**，"durable accept"的证据（inbox_receipt+cursor 前移？目标 offset commit？多 destination 聚合？）未定义，`published_at≠accept` 只说了否定项。 |
| FL-10 | Kimi P0-10 | 合服/拆服的 ID/cursor/ledger 迁移 cut | UNDER_SPECIFIED P0 | **UNDER_SPECIFIED P2（降级）** | 规范 Partition Rule 已显式声明"需要显式 ID 与游标迁移方案，不能从复合键自动正确推导"——即有意识地把方案留作未来专项设计。无任何验收 gate（C/D/R/O/W/F）依赖合服；不阻断 v2.2→实现。列入 v2.3+ 设计债，Kimi 的 `realm_migration_cut` 表建议可作起点。 |
| FL-11 | Kimi P1-1 | recovery guardian 自身租约/选举 | UNDER_SPECIFIED P1 | **主体 FACT_ERROR；残余 P2** | 与已裁决纪律直接冲突："同一权威数据库上的单行 epoch CAS 不需要额外应用层 leader election 才能保证唯一成功。" 多 guardian 并发接管过期 token 是 receipt 行上的单行 CAS，恰一个成功；旧执行者复活后的终态 UPDATE 因 token 不符影响 0 行回滚（规范已明文"只能 CAS 接管已过期 token"）。残余（P2 运维）：扫描间隔、退避、接管后的重试预算属 runbook。 |
| FL-12 | Kimi P1-3 | `workload.mMax` 与 release 容量参数的绑定不可机械验证 | UNDER_SPECIFIED/UNTESTABLE P1 | **UNTESTABLE P1 确认** | 判定器 §5.3 要求"mMax 绑定同 release 的容量参数"，但 release manifest 无容量参数字段（仅 capacityContractId，构成循环引用），服务端运行时实际执行的 M_max 无处声明——evaluator 无输入可比对，实现方可自由填写。与 GPT-Sol FL-27 的 mandatory profile 修订合并解决。 |

### 2.2 协议 / 会话 / 授权 / AOI 域（主源：GLM）

| ID | 来源 | 议题 | 原判 | 终判 | 裁决要点 |
|---|---|---|---|---|---|
| FL-13 | GLM A1 + A1b + A4 | credential/session/authz epoch 只在网关 admission 与 stream HELLO 校验，规范未定义授权判定的线性化点；撤销 SLO 与 C2 的关系未钉死 | UNDER_SPECIFIED P0 | **UNDER_SPECIFIED P0 确认（修订方向修正）** | 复核属实：写序列步骤 2 之后再无 epoch 复核锚点，command_receipts 无 admission epoch 快照列，锁序不含 sessions 行——"admission 通过→撤销→领域 COMMIT"窗口内已撤销主体的命令对世界产生持久变更，且规范文字既没把该窗口宣布为可接受（读法 b），也没要求 commit 点复核（读法 a）。授权属严重度表 P0。**但对 GLM 的最小修订本席修正**：强制每笔领域事务 `SELECT sessions.* FOR UPDATE` 会把同一 session 的全部命令串行在 session 行上并把跨 owner 事务耦合进热行，代价不可接受。v2.3 应写为：(1) admission 小事务把三类 epoch 快照进 receipt；(2) 规范明示读法 (a)——撤销的正确性边界=admission 时点 + 有界传播 SLO，SLO 是延时上界不是授权语义；(3) 枚举必须 commit 点复核的命令类别（支付、管理员、权限授予类），仅这些在领域事务内重读 sessions（普通读即可，因撤销写方提交后的下一次重读必见）并断言与快照一致。A4 的"回滚-重授权-撤销并发"矩阵并入验收证据。 |
| FL-14 | GLM A2 + A2b | refresh family 与多设备状态机归属、token_hash 单列 | UNDER_SPECIFIED P0 | **UNDER_SPECIFIED P1（降级）** | 事实成立（sessions 表单 token_hash 列、无 family 状态列、"撤销整个 family"无落点），但两种解读的最坏后果都不是授权泄漏：跨设备 family=过度撤销（可用性 DoS），per-device family=撤销半径退化但仍正确遏制被盗设备。属可用性/最小影响半径的 P1。双 hash 列、撤销半径表、bump 哪个 epoch 的迁移矩阵列入 v2.3。 |
| FL-15 | GLM A3 | statusUrl 读取一致性（主库 vs 滞后副本） | UNDER_SPECIFIED P1 | **UNDER_SPECIFIED P1 确认** | M1 退出门禁"不存在领域已提交但 receipt 非终态"只对权威读成立；statusUrl 是"未知 COMMIT 的唯一客户端恢复路径"，却未被列入权威读清单。一句话修订（statusUrl 必须线性化读或声明最大 staleness）+ evaluator 证据字段。 |
| FL-16 | GLM A3b | 客户端 pending commandId 跨崩溃持久化 | UNDER_SPECIFIED P0 | **UNDER_SPECIFIED P2（降级）** | GLM 自证"状态是对的"（projection 由有序事件收敛），损失仅是 pending UI 的 outcome 归属——客户端体验韧性，不是服务端不变量。列 M5 交付清单补充项。 |
| FL-17 | GLM A5 | 协议 envelope 无机器可检查禁止字段/状态迁移 schema | UNDER_SPECIFIED P1 | **UNDER_SPECIFIED P2（降级）** | P4/CL1-CL3 语义闭环成立（GLM 自认），缺的是实现期防呆工具层（envelope JSON Schema、receipt 状态机表、mutation test）。QA 强化项而非语义缺口；`resultVersions` 禁入 projection 一句话可并入 P4 文字。 |
| FL-18 | GLM A6 | permissionEpoch 服务端→客户端通知路径缺失导致旧包被应用 | UNDER_SPECIFIED P0 | **主体 REJECTED（与已裁决纪律同构）；残余 UNDER_SPECIFIED P2** | 分解后：撤销**后**发出的帧携带撤销实体已被 Knowledge Rule/P7 明文禁止（推送取当前权威状态与当前可见权限的交集——服务端发射侧过滤）；撤销**前**发出、在途到达的帧属"服务端不能保证旧网络包零到达"的已裁决不可避免窗口，其内容在发出时刻是被授权的，应用它们=有界传播陈旧，与 FL-13 的 SLO 读法 (a) 同一语义，不是泄漏反例。客户端 epoch 丢弃是防御纵深：客户端主动重订阅时它自知新 generation，机制自洽。残余真缺口（P2 活性）：服务端主动收缩权限后，空闲流上客户端无从得知需重订阅/失效本地缓存——补一条 in-band `SUBSCRIPTION_INVALIDATED` 控制事件（走 ordered stream）即可，作为活性与缓存卫生要求而非泄漏门禁。 |
| FL-19 | GLM A7 | filtered stream 的 visible seq / `committedWatermark` / `visible_head_seq` 三者语义与续传重建 | UNDER_SPECIFIED P0 | **UNDER_SPECIFIED P1（降级）** | 真缺口成立：EVENT 例值 `streamSeq==committedWatermark` 是玩家自有流（visible==source 合法），但对 filtered AOI 流 envelope 究竟暴露哪个序号未钉死（侧信道预算无从谈起）；更实质的是 **P5 的续传承诺在 filtered 流上不可验收**——visible seq 依赖权限快照，服务端崩溃后如何重建（独立持久化 or 从 source+权限快照确定性重算）完全未定义。无授权破坏或持久态损坏，定 P1。 |
| FL-20 | GLM A8 | 跨 stream barrier（同命令双流 UI 原子性） | UNDER_SPECIFIED P1 | **UNDER_SPECIFIED P2（降级）** | 规范有意选择 per-stream 独立（P5/P6），跨流一致是产品级 UI 语义。以 commandId 为隐式 barrier + 声明"snapshot 不保证跨流一致 cut"是合理的 v2.3 澄清，非正确性缺口。 |
| FL-21 | GLM A9 + A9b | 未知 event type 客户端默认行为、upcaster 覆盖下界、retention × producer 回滚 | UNDER_SPECIFIED P1 | **UNDER_SPECIFIED P1 确认** | 兼容矩阵要求"逐类型定义"但无默认值与强制登记机制（漏登记的类型行为未定义=R3 不可唯一验收）；"从最早 retained schema_version 到 producer_version 的 upcaster 路径无 gap"这一下界确实缺失，retained v3 事件可永久不可解释。客户端 push read_range 与 durable consumer read_range 未分离。 |
| FL-22 | GLM A10 | 多维资源预算组合语义 + session/epoch 缓存投毒 | UNDER_SPECIFIED P1 | **第一半 REJECTED；残余 P2** | P12"按 endpoint、IP、account、session…分别限额"的平实读法即每维度各自独立计量与执行——account 维度按定义跨 session 聚合，"10 session 各 50 绕过 account=100"是把预算实现成 per-session 分桶的实现错误，不是规范许可。残余（P2 编辑）：加一句"任一维度超限即拒绝、聚合维度不可被切片规避"；session/epoch 缓存的 stale fail-closed 语义并入 FL-13 修订（明确 SLO 超限即拒）。 |
| FL-23 | GLM A11 | reconnect storm × authz cache miss × snapshot build 联合排队 | UNDER_SPECIFIED P1 | **UNDER_SPECIFIED P2（容量矩阵补充）** | 实为 W6 场景的联合注入要求，并入 GPT-Sol 的 joint trace/scenario 修订（FL-28），不单独构成规范缺口。 |

### 2.3 容量合同 / 判定器域（主源：GPT-Sol；机械结果经本席按 schema JSON 重验全部属实）

| ID | 来源 | 议题 | 原判 | 终判 | 裁决要点 |
|---|---|---|---|---|---|
| FL-24 | GPT-Sol 阻断项 1 | `finalState` 无 cursor gap、ledger imbalance、owner violation、权威事件丢弃/清理、accepted-to-terminal 守恒字段 | UNTESTABLE P0 | **UNTESTABLE P0 确认** | 本席重验：finalState.required 仅 checksum 三元组+invariantViolationCount+三个 unresolved 计数+backlogDrained+drainDurationMs。判定器 §10 把"丢权威事件/缩 retention/清 receipt 得到的 drain"定为 FAIL，却没有任何输入字段或 typed artifact 能让它检出——aggressive drop 可在合同表达能力之外发生。O2/F2 的证据完整性因此不可证明。 |
| FL-25 | GPT-Sol 阻断项 2 | 判定器 §9 `rho = arrivalRate.mean × serviceTime.mean`，schema percentiles 无 `mean` 且 `additionalProperties:false` | SPEC_CONTRADICTION P1 | **重分类 UNTESTABLE P1（分类修正，严重度维持）** | 字段事实经重验属实。但 §9 首句明示"每个 stage 必须从同一 trace **重算**"——mean 允许来自原始 artifact 而非合同字段，两条要求在"trace artifact 存在且格式确定"前提下可同时满足，不构成 SPEC_CONTRADICTION。真问题：artifact 无 typed 格式，重算不唯一 → UNTESTABLE。修订同 GPT-Sol 方案（percentiles 加 mean 或 typed raw samples）。 |
| FL-26 | GPT-Sol 阻断项 3 | schema overall PASS 分支强制全部 gate PASS；判定器 §11 允许"适用 gate 全 PASS + 有效 NA"整体 PASS | SPEC_CONTRADICTION P1 | **SPEC_CONTRADICTION P1 确认** | 本席重验 PASS 分支 `gates.items.allOf[1].result const:PASS` 属实。合同如实申报 overallResult=PASS 且含一个有效 NA gate → schema 拒绝 → 判定器 §1 前置条件不满足 → NOT_PROVEN；唯一逃逸是故意错报 overallResult 触发 DECLARED_OVERALL_RESULT_MISMATCH 通道拿到重算 PASS——以自我错报换判定通过，本身破坏 O6/证据一致性。两条要求在"合同如实申报"前提下不可同时满足，矛盾成立，必须二选一修订。 |
| FL-27 | GPT-Sol 阻断项 4 | 无 mandatory gate/stage/scenario inventory，ID 自由且可重复；单 gateway stage + 单任意 gate + 空 faults 的 overall PASS 结构合法 | UNTESTABLE P1 | **UNTESTABLE P1 确认** | scopeComplete 是自我声明布尔；判定器无法区分"确实不适用"与"没提交"。需 deploymentProfile + requiredGateIds/StageClasses/FaultScenarioIds 绑定 release manifest（与 FL-12 合并解决）。 |
| FL-28 | GPT-Sol 阻断项 5 | 边际 mix + 独立 stage percentile 无法证明相关峰值来自同一联合 trace | UNTESTABLE P1 | **UNTESTABLE P1 确认** | 不同相关结构可产生相同边际值；schema 无 scenario/phase/trace 绑定字段。判定器 §9 禁止独立 p99 相加的规则因此无输入可执行。 |
| FL-29 | GPT-Sol 阻断项 6 | 无共享 resource center（CPU/GC/DB pool/lock/WAL/network/socket/client）结构 | UNDER_SPECIFIED P1 | **UNDER_SPECIFIED P1 确认** | 判定器 §9 要求"共享资源中心都有独立 evidence；缺任一实际瓶颈中心为 NOT_PROVEN"，schema 只有 stage 无 resource center/visit/parallelism 字段。 |
| FL-30 | GPT-Sol 阻断项 7 | 无可执行 evaluator、mutation suite、可验签制品 | IMPLEMENTATION_ONLY_GAP P1 | **IMPLEMENTATION_ONLY_GAP P1 确认** | 规范 §12 已自洽处理：mutation suite 通过前一切容量报告保持 NOT_PROVEN。不构成规范缺陷，是 M7 交付物。条件双来源（threshold=PRODUCT_SLO / observed=MEASURED 拆分）、typed evidence、workload shape（top-K/AOI/due-time/reconnect cohort/10x data age）等修订项并入 FL-24/27/28/29 的 schema 修订单。 |

### 2.4 可靠性 / 恢复 / 发布域（主源：DeepSeek）

| ID | 来源 | 议题 | 原判 | 终判 | 裁决要点 |
|---|---|---|---|---|---|
| FL-31 | DeepSeek SPEC-REL-01 (§6.1) | restore 状态机声明"Every step declares executor, idempotency guard, timeout, evidence digest, retry/rollback, next-step CAS"但未给任何一步的内容 | SPEC_CONTRADICTION | **重分类 UNDER_SPECIFIED P1（分类修正）** | "Every step declares…"是对实现/runbook 的规范性要求（要求每步必须声明这些要素），不是规范对自身的承诺——不存在两条不可同时满足的要求，SPEC_CONTRADICTION 是范畴错误。但缺口本身成立：没有每步模板（至少幂等 guard 谓词 + next-step CAS WHERE），R6 无法唯一验收。 |
| FL-32 | DeepSeek SPEC-REL-02 (§3.1 / F-01) | restore_runs 无单例准入约束，双 coordinator 可并发各推进一条 restore run | UNDER_SPECIFIED（BLOCKING） | **UNDER_SPECIFIED P0 确认** | "唯一执行租约"是 per-restore_id 的，挡不住两行并存；两个 coordinator 交叉执行 fence/epoch CAS/DATA_RESTORED 直接威胁恢复完整性（严重度表 P0）。修订即 DeepSeek 给出的 admission guard（`WHERE NOT EXISTS(... status NOT IN 终态)`）+ 部分唯一索引。 |
| FL-33 | DeepSeek SPEC-REL-03 (§3.2 / F-02) | restore coordinator 崩溃后的回收主体 | UNDER_SPECIFIED（BLOCKING） | **UNDER_SPECIFIED P1 确认** | 与 FL-11 不同，不判 FACT_ERROR：token 接管的 CAS 唯一性确实不需要选举，但 restore 各步是否幂等、从哪一步续跑、接管者授权（restore 是高危操作，接管是否需签名）均未定义——是步骤语义缺口而非选举缺口。卡死态是安全的（不腐化数据），定 P1 而非 P0。 |
| FL-34 | DeepSeek SPEC-REL-04 (§7.1) | secret outage 的 endpoint 分类矩阵缺失 | UNDER_SPECIFIED（BLOCKING） | **UNDER_SPECIFIED P2（降级）** | 规范已含核心正确性内容："按 endpoint 定义缓存旧凭据、只读降级或 fail closed"+ 支付/管理员/安全审计默认 fail closed。具体分类表是产品交付物（DeepSeek 自己给的表可直接采纳为 M7 runbook 模板），不是规范级阻断。 |
| FL-35 | DeepSeek SPEC-REL-05 (§5.1 / F-06) | signer key rotation：生效窗口、重叠期、撤销对已部署 manifest 的效力、信任根存储 | UNDER_SPECIFIED（BLOCKING） | **UNDER_SPECIFIED P1 确认** | release identity 验签是 R1/R6 的信任根，撤销语义二义（已运行实例是否失效）会在密钥事件时同时瘫痪回滚路径（vN-1 同 key 签名）。需 key lifecycle 条款。 |
| FL-36 | DeepSeek SPEC-REL-06 (§4.4) | `RECEIPTS_JOBS_SAGAS_RECONCILED` 无 reconciliation 语义 | UNDER_SPECIFIED（HIGH） | **UNDER_SPECIFIED P1 确认** | in_progress receipt / leased job / mid-flight saga / 过期 reservation 四类状态的收敛规则缺失；DeepSeek 的状态矩阵可直接进 v2.3。与 FL-31 同一修订单。 |
| FL-37 | DeepSeek SPEC-REL-07 (§6.2 / F-11) | TRAFFIC_REOPENED"signed authorization"的签名 payload、验证公钥来源、拒绝行为未定义 | UNDER_SPECIFIED（HIGH） | **UNDER_SPECIFIED P1 确认** | 若只是 flag 列则授权门禁形同虚设；需定义 token 格式（restore_id + evidence_chain_digest + signer）与 server 端启动时校验/只读兜底。 |
| FL-38 | DeepSeek §4.1 / F-04 | PITR cut T1 × outbox 已在 T1..T2 发布到外部消费者：seq 空间重用 + 外部 cursor 超前 | SPEC_GAP | **UNDER_SPECIFIED P0 确认** | 本席补强事故推演：恢复到 T1 后，seq N+1..M 会被**新的不同事件**重新占用——外部消费者 cursor 停在 M+1，将整体跳过这些新事件（静默丢失），且同 seq 不同 event_id 破坏审计连续性；若 N+1..M 含支付/发货类外部副作用，则外部世界持有权威库不知道的事实。规范的 STREAMS_REPLAYED/RECONCILED 未覆盖"外部已消费超过恢复 cut"的检测（比对各 consumer_group acked_seq 与 restored head）、seq 不重用规则（恢复后从原 head 之后、而非 restored head 之后分配）与升级路径。恢复完整性 + 资金副作用 → P0。 |
| FL-39 | DeepSeek §3.5 | restore 后 scheduler 恢复协议（leased 过期 job 从哪恢复） | UNDER_SPECIFIED | **UNDER_SPECIFIED P2** | lease 过期回收 + due_at 驱动扫描天然覆盖大部分；剩余是 runbook 细节，并入 FL-36。 |
| FL-40 | DeepSeek §3.3 | fence 后旧节点缓存只读陈旧 | UNDER_SPECIFIED | **UNDER_SPECIFIED P2** | 读一致性等级本就允许 bounded staleness（D4 读模型非权威）；补一句"fenced holder 必须停止服务其缓存的权威读或标记 stale"即可。 |

**Ledger 统计：40 条。终判分布：P0=5（FL-01/13/24/32/38），P1=17（FL-04/06/07/08/09/12/14/15/19/21/25/26/27/28/29/31/33 + FL-35/36/37 → 计 20），P2=9（FL-10/16/17/20/22残/23/34/39/40 + FL-02残/11残/18残），FACT_ERROR 整判=4（FL-02/03规范侧/05/11）+ 主体驳回 2（FL-18/22 第一半）+ 部分 2（FL-07/09），分类修正=2（FL-25/31），IMPLEMENTATION_ONLY_GAP 归位=2（FL-03 实现侧/FL-30）。**

---

## 3. FACT_ERRORS_AND_REJECTED_ATTACKS

### 3.1 整体 FACT_ERROR（时间线被规范已写明机制阻止）

| 编号 | 席位/条目 | 被驳时间线 | 阻止机制（规范原文位置） |
|---|---|---|---|
| FE-1 | Kimi P0-2 | placement CAS 在旧 holder 的 aggregate UPDATE 与 COMMIT 之间提交 | "SELECT the lease FOR UPDATE first and hold it through COMMIT"（fencing 代码块注释）+ "每笔事务在 COMMIT 前持有 lease 行锁并最终校验"（Owner Handoff Rule）。持锁下 CAS 阻塞至提交后。纪律第 7 条适用。 |
| FE-2 | Kimi P0-3（作为规范反例的部分） | terminal receipt 写在另一事务导致"领域已提交、receipt 非终态" | "terminal receipt 与领域事务原子提交"（command_receipts 约束列）+ "The domain transaction locks this row and atomically writes domain state + terminal status + result"（代码注释）。该时间线只能由不合规实现产生。当前实现两步提交是 M1 已登记的 IMPLEMENTATION_ONLY_GAP（经代码复核确认），不得回灌为规范矛盾。 |
| FE-3 | Kimi P0-5 | 完成 CAS 先执行、lease 中途被 steal、剩余领域写仍提交 | 完成 UPDATE 自身取行锁持至 COMMIT，steal 阻塞；反向顺序时完成 UPDATE 影响 0 行 → "raise and roll back every domain write"（scheduled_jobs 代码注释 + D6）。两个方向都被挡死。 |
| FE-4 | Kimi P1-1 | 多 guardian 竞争需要 guardian 自身租约/选举 | 已裁决纪律："同一权威数据库上的单行 epoch CAS 不需要额外应用层 leader election。" receipt 行 token CAS 恰一成功；旧执行者复活提交被 token 条件挡住。残余扫描节奏问题属 runbook（P2）。 |
| FE-5 | GLM A6（主体） | 撤销后在途旧 epoch 包被客户端应用=授权泄漏 | 分解：撤销后新帧被 Knowledge Rule/P7 的发射侧交集过滤禁止；撤销前发出的在途帧属已裁决"服务端不能保证旧网络包零到达"的不可避免窗口，内容在发出时刻被授权，应用它们是有界传播陈旧（与撤销 SLO 模型一致），非泄漏反例。残余订阅失效活性信号 P2。 |
| FE-6 | GLM A10（第一半） | 单账号 10 session 各 50 req/s 绕过 account=100 限额 | P12"按 endpoint、IP、account、session…分别限额"的平实语义即每维度独立计量执行；account 维度按定义跨 session 聚合。把 account 预算实现成 per-session 分桶是实现错误，不是规范许可的行为。 |

### 3.2 部分 FACT_ERROR / 事实修正

| 编号 | 席位/条目 | 修正 |
|---|---|---|
| FE-7 | Kimi P0-7 | "DDL 无 `reversal_of`/`fx_snapshot_id`"仅对示例 CREATE TABLE 成立；两字段**已在**逻辑表目录 economy_journals 关键字段列中。目录↔示例 DDL 不同步是编辑缺陷，不是字段缺失。 |
| FE-8 | Kimi P0-9 | "consumer 崩溃后事件已丢失"不成立：stream_events retention 受 required consumer 最小 cursor 保护，内部消费者恒可重放；丢失需同时突破 cursor 保护，规范已禁。真缺口仅在外部 destination 的 accept 证据定义。 |

### 3.3 分类错误修正（事实成立、分类失当）

| 编号 | 席位/条目 | 修正 |
|---|---|---|
| CE-1 | GPT-Sol "mean 矛盾" | SPEC_CONTRADICTION → **UNTESTABLE**。判定器 §9 明示从同一 trace 重算，mean 可来自 raw artifact；矛盾前提不成立，真问题是 artifact 无 typed 格式导致重算不唯一。严重度 P1 维持，修订项不变。 |
| CE-2 | DeepSeek §6.1 | SPEC_CONTRADICTION → **UNDER_SPECIFIED**。"Every step declares…"是对实现的要求而非规范自我承诺，不存在两条互斥要求。缺口（无每步模板）成立，P1。DeepSeek 总结行"SPEC_CONTRADICTIONS = 1"应清零。 |

### 3.4 严重度夸大清单

- Kimi：P0-4→P1、P0-6→P1、P0-7→P1、P0-8→P1、P0-9→P1、P0-10→P2（6 条降级）。
- GLM：A2 P0→P1、A3b P0→P2、A6 P0→驳回+P2、A7 P0→P1、A5 P1→P2、A8 P1→P2、A10 P1→驳回+P2、A11 P1→P2（8 条降级/驳回）。
- DeepSeek：SPEC-REL-04 BLOCKING→P2（1 条降级）。
- GPT-Sol：无严重度夸大；两处分类之一修正（CE-1）。机械攻击结果 3 拒 5 收、扩展攻击表、schema 字段事实经本席按 JSON 独立重验**全部属实**，为四席中事实密度最高、零 FACT_ERROR 的一份。

### 3.5 跨报告重复（已合并）

- Kimi P0-4 与 GLM CL7/A4 的 plan_attempt 重授权路径 → FL-04/FL-13。
- Kimi P1-3 与 GPT-Sol mandatory profile → FL-12/FL-27 同一修订单。
- GLM A11 与 GPT-Sol joint trace/W6 → FL-23 并入 FL-28。
- DeepSeek §4.4 与 SPEC-REL-06 同根 → FL-36。
- 四席各自复述的"当前实现缺 owner_leases/stream/saga/ledger/evaluator" → 统一归第 6 节 backlog，未计入任何规范缺口。

---

## 4. CROSS_DOMAIN_INCIDENT_CHAINS

六条跨域事故链，每条给出触发缺口序列与一票验收判据。

**IC-1 撤销窗口 → 世界持久变更 → 快照固化（FL-13 → FL-19 → P6）**
管理员冻结账号（authz_epoch++）→ 该 session 已 admission 的命令在传播窗口内进入领域事务并 COMMIT（FL-13：无 commit 点复核锚）→ 事件进入持久 stream 并被 snapshot builder 以 committed watermark 固化 → 撤销后的世界变更成为不可回退的权威事实；若命令是权限授予类（联盟任命、转让），撤销失效被二次放大。**验收判据**：admission 后-COMMIT 前撤销注入 ×100 交叉，`受管制命令类` stale-commit 计数 = 0；普通命令的 stale-commit 全部落在声明 SLO 窗口内并有证据。

**IC-2 handoff 停摆 → job 积压 → drain 伪证（FL-01 → W3/W7 → FL-24）**
placement 发起 handoff，CAS 后 owner 停在 `transferring`（FL-01：无激活步骤）→ 该 owner 的 mailbox 拒绝提交，scheduled_jobs 到期堆积（W3 lag 上限被击穿）→ 运维为"排空"清理积压 job/receipt → 容量合同 finalState 无 cleanup/删除守恒字段（FL-24），`backlogDrained:true` + 全零 unresolved 计数结构合法 → 一次单写者活性事故被记录为 PASS 的 drain 演练。**验收判据**：v2.3 finalState 含 cleanup/drop 守恒计数且 evaluator 复算 accepted-to-terminal 守恒；handoff 注入后 owner 在 deadline 内必达 `active` 或回滚到旧 holder。

**IC-3 PITR 恢复 → seq 重用 → 外部对账缺失 → 无授权 reopen（FL-38 → FL-36 → FL-37）**
PITR 恢复到 T1，丢失 seq N+1..M（其中含支付发放事件，外部渠道已入账）→ 恢复后新命令重用 seq N+1..M（FL-38：无 seq 不重用规则），外部消费者 cursor=M+1 静默跳过全部新事件 → RECEIPTS_JOBS_SAGAS_RECONCILED 无外部 acked_seq 比对模板（FL-36），差异未被发现 → TRAFFIC_REOPENED 授权只是 flag（FL-37），运维直接放量 → 玩家侧余额与渠道账目永久分叉。**验收判据**：restore 演练必含"外部 cursor 超前"fixture；恢复后 stream 分配起点 ≥ 崩溃前最大已发布 seq + 1；reopen 需验签 token 绑定 evidence_chain_digest。

**IC-4 双 restore coordinator → fence 交叉 → 证据链混串（FL-32 → FL-31 → F1 UNTESTABLE）**
两个运维并发触发 restore，两行 restore_runs 并存（FL-32）→ A 执行 WRITERS_FENCED（epoch CAS 一轮）后 B 执行 DATA_RESTORED 覆盖 A 已恢复的数据（各步无幂等 guard 模板可拒绝交叉，FL-31）→ 两条 run 各自留 evidence digest，F1 gate 的"完整 PITR 演练与原始报告"无法归属单一 run → 恢复完整性证据不可判定。**验收判据**：并发 restore 请求恰一行进入非终态（DeepSeek F-01 判据）；每步 next-step CAS 带 restore_id+step 前置谓词。

**IC-5 容量合同自选范围 → 伪 PASS → 发布决策污染（FL-27 + FL-12 + FL-24 → 路线图 §13）**
实现方提交单 gateway stage + 单自命名 gate + `faults:[]` + 自填 `mMax=1` 的合同（FL-27：无 mandatory profile；FL-12：mMax 无绑定可验）→ 结构校验 ACCEPT（GPT-Sol 已实测）→ 无可执行 evaluator，文字规范的拒绝规则无人执行（FL-30）→ 合同挂到 release manifest 的 capacityContractId，路线图 §13"允许小范围外测"的门禁被形式满足 → 首个真实热点 owner 洪峰在生产发现 W2 从未被测过。**验收判据**：v2.3 schema 含 deploymentProfile/requiredGateIds；evaluator §12 mutation suite 含"单 stage 单 gate 空 faults"fixture 期望 NOT_PROVEN。

**IC-6 refresh 重放 → 全家撤销 → 重连风暴 → 撤销窗口放大（FL-14 → FL-23 → FL-13）**
若实现选择"family 跨设备"读法：单设备旧 refresh 重放触发全账号撤销（FL-14）→ 大量合法设备同时被踢并重连，session lookup × bootstrap snapshot × authz 校验共享 DB pool（FL-23 未被联合建模）→ authz 查询排队恶化，网关缓存 staleness 超 SLO → FL-13 的撤销传播窗口被容量事故实质拉长，撤销语义在最需要它的安全事件时刻最弱。**验收判据**：reconnect_storm fault 必须联合注入 authz cache miss；SLO 内 stale-approve 计数 = 0（GLM T13 采纳）。

---

## 5. REQUIRED_V2_3_PATCHES

按优先级排列的最小修订单。每条闭合后对应 ledger 条目转 CONFIRMED_SPEC_CLOSURE。

### P0（进入 M2/M5/M7 实现前必须闭合）

1. **Handoff 提交谓词与激活步骤（FL-01）**：
   - 最终 fencing 谓词明文化：`state='active' OR (state='draining' AND handoff_id=:handoff_id AND statement_timestamp() < drain_deadline)`，配合 holder/epoch/lease_until 与行数断言；
   - 定义 `transferring→active` 激活 CAS 的执行主体（新 holder）、前置谓词、超时与失败回收（placement recovery 将 transferring 超时回滚为旧 holder active 或强制新 epoch）；
   - `committed_watermarks` 在 handoff CAS 同一事务内由 placement 从 stream_heads 原子记录，新 holder 只能从该值接管；
   - 示例 SQL 自包含化（内联 SELECT ... FOR UPDATE + affected_rows 断言）（吸收 FE-1 残余）。
2. **授权线性化边界（FL-13，修订方向见 ledger）**：admission epoch 快照三列入 command_receipts；明示撤销语义=读法(a)（SLO 是传播延时上界，不是授权契约）；枚举 commit 点必须复核 epoch 的命令类别（支付/管理员/权限授予），其余命令的撤销窗口由 SLO 证据覆盖；session/epoch 缓存超 SLO 一律 fail-closed（吸收 FL-22 残余）。
3. **容量合同最终守恒（FL-24）**：finalState 增加 accepted/committed/terminal/pending command 计数、produced/applied/pending/dropped authoritative event 计数、cursorGap、ledgerImbalance、ownerViolation、cleanup/delete 计数、DLQ unresolved 及各自 evidenceRefs；evaluator 以守恒方程复算，不信任布尔值。
4. **Restore 单例准入（FL-32）**：restore_runs admission guard（非终态行存在即拒绝）+ 非终态部分唯一索引；写入规范 DDL。
5. **PITR × 外部消费 reconciliation（FL-38）**：STREAMS_REPLAYED 增加子步骤——比对各 consumer_group acked_seq 与 restored heads，超前部分进入显式 divergence 清单并阻塞 reopen；规范恢复后 seq 分配起点 ≥ 崩溃前最大已发布 seq+1（禁止 seq 重用）；外部副作用差异升级 escalated/manual。

### P1

6. **NA×PASS 矛盾（FL-26）**：二选一——schema overall PASS 分支放行带完整审批链的 NOT_APPLICABLE gate（推荐），或判定器 §11 禁止含 NA 的整体 PASS；配 mutation fixture。
7. **Evaluator typed 输入包（FL-25/27/28/29 + FL-12，采纳 GPT-Sol §7.1 清单）**：percentiles 加 mean/sampleCount/failed/dropped；deploymentProfile + requiredGateIds/StageClasses/FaultScenarioIds 绑定 release manifest（release 增加容量参数字段以钉死 mMax 绑定）；scenario/phase/traceDigest 联合绑定；resource center 结构；condition 拆 thresholdSource/observedSource；typed evidence artifact 格式；workload shape（top-K skew、AOI actors/watchers、due-time 直方图、reconnect cohort、10x data age）。
8. **Restore 执行语义包（FL-31/33/36/37/35，采纳 DeepSeek §9.1）**：九步各给幂等 guard 谓词 + next-step CAS WHERE 模板；restore 接管主体与授权；RECEIPTS_JOBS_SAGAS_RECONCILED 的四类状态收敛 SQL 模板；TRAFFIC_REOPENED 签名 token 格式与 server 端只读兜底；signer key lifecycle（生效窗口、重叠、撤销对已部署 manifest 的效力、信任根存储）。
9. **协议语义钉死（FL-15/19/21/14）**：statusUrl 线性化读或声明最大 staleness；filtered stream 的 envelope 序号=visible seq、source seq 不出网、visible seq 持久化/重算路径二选一并写明；未知 event type 默认 SKIP_AND_RESYNC + 新类型强制登记 unknown-behavior + upcaster"最早 retained→producer 无 gap"断言 + retention×回滚交互；refresh family 语义、双 token hash 列、多设备状态机迁移表。
10. **数据面收尾（FL-04/06/07/08/09）**：receipt.plan_attempt 推进谓词与 FK、owner_set_hash 规范化排序；saga dedupe_key 作用域（改 `(realm_id, saga_id, dedupe_key)` 或钉死 key 构造规则）+ 迟到消息幂等返回语义；fx_snapshots 表 + fee/tax/rounding account_class + 部分退款上限谓词 + 目录↔示例 DDL 同步；snapshot builder 一致切面读取一句话（单事务快照隔离或 cut marker）；外部 destination 的 durable accept 证据定义与多 destination 聚合规则。

### P2（编辑/防呆/设计债）

envelope JSON Schema 与 receipt 状态机机器检查（FL-17）；跨流 barrier=commandId 声明 + "snapshot 不保证跨流一致 cut"（FL-20）；`SUBSCRIPTION_INVALIDATED` in-band 控制事件（FL-18 残余）；客户端 pending commandId 持久化入 M5 交付（FL-16）；P12 补"任一维度超限即拒、聚合维度不可切片规避"（FL-22 残余）；reconnect×authz 联合注入入容量矩阵（FL-23）；secret 分类矩阵模板（FL-34，采纳 DeepSeek 表）；合服/拆服 migration cut 专项设计（FL-10，采纳 Kimi 表结构起点）；restore 后 scheduler 恢复与 fenced 节点只读语义各一句话（FL-39/40）；plan 不可变触发器（FL-04 附属）。

---

## 6. IMPLEMENTATION_ONLY_BACKLOG

以下均为规范成立、当前代码未实现的差距。**不降低 v2.2 标准，不改变 CURRENT_IMPLEMENTATION = NON_CONFORMING。** 映射到路线图阶段：

| 阶段 | 差距（经代码复核或四席一致确认） |
|---|---|
| M0 | writer inventory 三集合双向差（静态发现/manifest 声明/运行时命中）——当前 writer guard `violations:0` 只证明已枚举规则（GPT-Sol §6）；基线 release manifest 与签名。 |
| M1 | receipt 终态与领域写同事务：`CommandCommitter.commit()`(:50 起) 与 `recordResult()`(:110) 两步——已复核属实；`CommandIdempotencyStore.begin()` 已持久化 in_progress，收敛目标是消除永久 COMMAND_IN_FLIGHT 窗口 + guardian 接管。 |
| M2 | owner_leases/placement epoch CAS/数据库 fencing 全缺；`deploy.sh` 与 `world-worker.js` shutdown 不参与任何 epoch 机制；`world-worker.js:108-115` shutdown 不 await `worker.stop()` 即 `db.close()+process.exit(0)`（已复核属实，DeepSeek F-16）。 |
| M3 | `game_states` 大 JSON 行 → 窄行 aggregate + 约束（duplicate reward/negative spend/double occupation 的 DB 终阻）。 |
| M4 | scheduled_jobs/stream_events/stream_heads/consumer_cursors/inbox_receipts/outbox_events 全缺。 |
| M5 | credential/session/authz 三 epoch 状态机、refresh rotation、订阅 generation/permissionEpoch、客户端 applied cursor 全缺（当前 AuthService 为简单 JWT）。 |
| M6 | saga 三表、economy journal/ledger 全缺。 |
| M7 | restore coordinator/restore_runs/10 步状态机（当前 `restore-runtime-state.sh` 为 tar+cp+pm2）；备份前 fencing（`backup-runtime-state.sh` 在线备份无 fence）；可执行 capacity evaluator + mutation suite + 可验签制品（FL-30）；健康检查覆盖（`/api/health` 仅 config/presence/observability，无磁盘/WAL/证书/lease/lag——已复核属实）；审计 fail-closed（`server.js` logApi try/catch 吞错继续——已复核属实，违反支付/审计 fail-closed 要求）；durability profile 按故障类型声明（SQLite WAL synchronous=NORMAL 的 power-loss 语义须如实声明，不适用 WAL-G 类方案——纪律项）。 |

---

## 7. ACCEPTANCE_TEST_AND_EVIDENCE_DELTA

在四席已有矩阵基础上的净增/修订验收证据（去重后）：

**采纳（原样或微调）**
- Kimi 故障注入矩阵 #1/#2/#3/#6/#7/#8/#9/#10（#2 按 FL-01 修订后的谓词重写期望；#4/#5 按 FE-3/FE-4 重写为"验证规范机制生效"而非"验证缺口"）。
- GLM T1/T2（按 FL-13 修订：仅受管制命令类要求 0 stale-commit，普通命令验证 SLO 窗口证据）、T3、T4、T8（改为验证 envelope 不暴露 source seq）、T10、T11（改为验证 account 维度聚合正确实现）、T12、T13、T14、T15。
- GPT-Sol：全部 mutation fixtures（8 强制 + 扩展表）进入 evaluator §12 suite；KNEE_INTERVAL 唯一拐点判定法与 §8.2 必测矩阵整体采纳为 M7 容量验收基准。
- DeepSeek：F-01、F-02、F-04、F-05、F-06、F-07、F-08、F-09、F-10、F-11、F-14、F-15、F-16（F-03/F-12 保留为"规范机制生效"回归项）。

**本席净增（来自事故链）**
1. IC-1 fixture：权限授予类命令的撤销竞态矩阵（撤销 × admission × commit × plan_attempt 重授权 全时序），受管制类 stale-commit=0。
2. IC-2 fixture：handoff 注入后 owner 必须在 deadline 内到达 active 或回滚；期间 scheduled_jobs lag 有界；随后的容量合同必须携带 cleanup 守恒计数为 0。
3. IC-3 fixture：restore 演练强制包含"外部 consumer acked_seq 超前于恢复 cut"场景，断言 divergence 清单非空即 reopen 被阻塞、seq 不重用。
4. IC-4 fixture：并发 restore 触发，恰一行非终态；step 交叉注入被 next-step CAS 拒绝。
5. IC-5 mutation：单 stage/单 gate/空 faults/自填 mMax 合同 → evaluator 期望 NOT_PROVEN（reasonCode 含 mandatory profile 缺失）。
6. IC-6 fixture：reconnect_storm + authz cache miss 联合注入，SLO 内 stale-approve=0，前台 SLO 不崩。

**证据规则重申（不变）**：任一守恒/fencing/receipt/cursor/ledger/owner/checksum 失败=FAIL；范围/证据/样本不全=NOT_PROVEN；`FAIL 不被平均值覆盖，NOT_PROVEN 不被"未观察到失败"升级`；判定器未过自身 mutation suite 前，一切容量结论保持 NOT_PROVEN。

---

## 结语

```text
FINAL_VERDICT              = REVISE_TO_V2_3
LEDGER_ENTRIES             = 40（同根合并后）
CONFIRMED_P0               = 5（FL-01, FL-13, FL-24, FL-32, FL-38）
CONFIRMED_SPEC_CONTRADICTION = 1（FL-26）
FACT_ERRORS                = 4 整判 + 2 主体驳回 + 2 部分 + 2 分类修正
SEVERITY_INFLATIONS        = 15（Kimi 6 / GLM 8 / DeepSeek 1）
INCIDENT_CHAINS            = 6
CAPACITY_CONTRACT          = NOT_PROVEN（维持，规范自洽结果）
CURRENT_IMPLEMENTATION     = NON_CONFORMING（维持）
```

v2.2 的骨架（CAS epoch、持锁 fencing、原子 receipt、outbox/stream 分离、守恒 ledger、restore 状态机）经三轮对抗仍然站立；被击穿的是骨架之间的**衔接处**：handoff 的两个未定义状态迁移、授权判定的线性化位置、恢复 cut 与外部世界的对账、以及容量证据合同的表达能力。五个 P0 补丁加一个 schema 矛盾修复即可进入 v2.3 定稿；任何一条未闭合前，M2/M5/M7 的退出门禁不可唯一验收。
