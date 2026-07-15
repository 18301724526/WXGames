# SLG 后端参考架构 v2.3 最终交叉质询与证据裁决报告（第四轮）

> 席位：最终交叉质询与证据裁决席（提示词五）
> 日期：2026-07-15
> 输入：`7月14日后端架构/成熟SLG后端参考架构-v2.3.html`、`容量合同-v2.3.schema.json`、`容量合同判定器规范-v2.3.md`、`当前实现迁移路线图-v2.3.md`；四份席位报告 `tmp/architecture-v2.3-adversarial-{kimi-data, glm-protocol-security, gpt-sol-capacity, deepseek-reliability}.md`；上一轮裁决基线 `历史材料/v2.2四席评审报告/architecture-v2.2-adversarial-final-synthesis.md`（40 条 ledger）。
> 复核手段：架构/schema/判定器原文逐条比对；PostgreSQL 锁与事务语义推演；容量 schema 机械攻击结果独立重验（本席以仓库内 ajv@6.15.0 对 17 个 draft-07 兼容行实际重跑，其余行按 schema 约束逐行读证）；被引代码事实只读复核（`backend/application/commands/CommandCommitter.js`、`CommandIdempotencyStore.js:138`、`backend/repositories/OwnerLockRepository.js:86`、`backend/config/SecurityConfig.js` resolveJwtSecret）。
> 本席不做多数投票，不按篇幅计分。

---

## 1. FINAL_V2_3_VERDICT

```text
FINAL_VERDICT            = REVISE_TO_V2_4
REFERENCE_V2_3_STATUS    = NOT_PROVEN（维持）
CURRENT_IMPLEMENTATION   = NON_CONFORMING（维持；任何情况下不得改为 CONFORMING）
CAPACITY_CONTRACT        = NOT_PROVEN（维持：判定器未过自身 mutation suite + typed 输入缺口）
```

**裁决理由：**

1. **不构成 REJECT_FOUNDATION。** v2.3 对上一轮 6 条裁决项（5 P0 + 1 SPEC_CONTRADICTION）交付了 4 条完整闭合、2 条部分闭合（见第 2 节）；本轮四席对核心模型（单行 epoch CAS、持锁至 COMMIT 的最终 fencing、原子 receipt、outbox/stream 分离、per-currency 守恒 ledger、restore 单例准入与九步状态机）发起的全部标准形状攻击均未击穿——本轮确认 **0 条 SPEC_CONTRADICTION**（Kimi 提出的唯一一条经复核为 FACT_ERROR，见 4.1）。骨架继续站立。
2. **不构成 ACCEPT_FOR_IMPLEMENTATION。** 经交叉复核仍确认 **1 条规范级 P0**（L4-01：受管制命令 commit 点复核的"普通读即可"括注与 M5 IC-1 门禁"受管制 stale-commit=0"在数据库语义下不可同时成立——该括注恰源自上一轮裁决席自身的修订方向，属四席与裁决席的共享盲点，本轮由 Kimi 独立击穿）与 **16 条 P1**（handoff 时钟源/激活超时载体 ×2、受管制清单 typed 化、saga 结果载体、INVALIDATED 空闲流语义、restore 执行残余 ×2、容量 schema/evaluator typed 输入包 ×9）。按裁决规则，存在规范级 P0/P1 缺口即 `REVISE_TO_V2_4`。
3. **修订半径小、可与实现并行。** 与上一轮"骨架衔接处 5 处 P0 空洞"不同，本轮 P0 是一处一行文字级机制修正；P1 集中在容量证据合同的 typed 化第二层（provenance/catalogue/join key）与 restore 细节。**M0-M4 可在现状下立即启动实现**；只有 M5/M6/M7 的退出门禁被对应补丁 gate（见第 6 节标注）。
4. **四席质量分布：** GPT-Sol 零 FACT_ERROR、零严重度夸大，38 行机械结果经本席独立重验全部属实（但其"AJV 8.20.0"工具版本声明在本仓库不可复核——仓库仅有 ajv@6.15.0，该引擎不支持 Draft 2020-12；容量席自身的证据也有 provenance 瑕疵，如实记录）；DeepSeek 边界纪律执行最好（规范/实现严格分列、0 夸大），但对 FL-13 给出了错误的"闭合"确认（漏掉 Kimi 发现的复核读竞态——跨席盲点）；Kimi 贡献了本轮唯一 P0，但 2 条攻击为 FACT_ERROR（其一把规范已明文的"lock the original journal row"当作缺失）、4 条严重度夸大；GLM 覆盖面最广，但 2 条 P0 全部降级（1 条时间线主体被"在领域事务内重读"的平实语义驳回）、1 条 FACT_ERROR（statusUrl staleness 载体规范已钉死在 release manifest）、约 10 条夸大。

---

## 2. PRIOR_LEDGER_CLOSURE_STATUS（上轮 5 P0 + 1 SPEC_CONTRADICTION 逐条）

| 上轮 ID | 议题 | v2.3 交付 | 状态 | 残余 |
|---|---|---|---|---|
| FL-01 | handoff draining 谓词 / 激活步骤 / watermark 写入点 | 最终 fencing 谓词明文（`active OR (draining AND handoff_id AND statement_timestamp()<drain_deadline)`）+ 激活 CAS（执行主体=新 holder、前置谓词、超时回收语义）+ `committed_watermarks` 与 handoff CAS 同事务原子记录（HTML L999、L1135-1186）。Kimi A-3/A-4 确认水位原子性与"激活前不服务→无双活"。 | **CLOSED** | 新立 L4-02（`statement_timestamp()` 在锁等待后失真，P1）、L4-03（`transfer_deadline` 无 DDL/扫描载体 + HTML `holder_id` vs 路线图 `transfer_to` 谓词不一致，P1）。均不复活单写者破坏。 |
| FL-13 | 授权判定线性化边界 | admission 小事务快照三类 epoch 进 `command_receipts`（三列 + M1 门禁抽样比对）+ 读法(a) 明文 + 受管制类 commit 点复核 + 缓存超 SLO fail-closed（HTML L917、L1220-1222、L1622）。admission 半已闭合（Kimi B-1/B-2、GLM C-A-read-law(a) 确认）。 | **STILL_OPEN** | commit 点复核机制不闭合：**L4-01（P0）**"普通读即可"留下复核读→COMMIT 竞态窗口，与 M5 IC-1"受管制 stale-commit=0"门禁矛盾——该括注逐字来自 v2.2 裁决报告 FL-13 修订方向，上轮裁决席自身引入的缺陷，如实登记。另 L4-04（受管制清单 typed 化，P1）。 |
| FL-24 | 容量合同最终守恒字段 | finalState 增 command/event/cleanup 三个 typed 守恒块 + cursorGap/ledgerImbalance/ownerViolation/dlqUnresolved 计数 + 各自 evidenceRefs + PASS 分支结构钉死（dropped/cleanup/delete=0 直接结构拒绝，本席机械重验 B04/B05 REJECT 属实）+ 判定器 §10.1 逐条复算。 | **CLOSED** | 上轮申诉的"表达能力缺失"已闭合。本轮 GPT-Sol 发现的是更深一层的新问题（证据 provenance、terminal 合并拒绝的洗白面）→ 新立 L4-07/L4-08，不改变 FL-24 本体闭合。 |
| FL-26 | schema PASS 分支 × §11 有效 NA 矛盾 | schema `allOf[0].then.gates` 放行 `result ∈ {PASS, NOT_APPLICABLE}` 且 NA 强制 reason+approvedBy+approvalEvidenceDigest（本席重验：C01 缺 approvedBy REJECT、C02 带三字段 ACCEPT）；判定器 §11 对齐并给出 NA 审批链机械验证四步；§12 增双向 fixture。如实申报 PASS+有效 NA 的合同结构可过。 | **CLOSED** | 矛盾消除。审批链的**真实性**（自由字符串双人名可伪造）是新问题 → L4-11。 |
| FL-32 | restore run 单例准入 | admission guard（`INSERT ... WHERE NOT EXISTS(非终态)`）+ 非终态部分唯一索引双保险，写入规范 DDL（HTML L1851-1860）。DeepSeek 焊点 A 按四档隔离级别逐一验证：任一级别下第二个并发 INSERT 必被两道防线之一拦下。 | **CLOSED** | P2 残余：两条失败通道（0 行 vs unique violation）应声明统一处理路径 + 返回既存 run_id 的幂等语义（并入 P2 包）。Kimi 的 `ON CONFLICT DO NOTHING` 建议与 DeepSeek 修订同根，合并。 |
| FL-38 | PITR cut × 外部消费 / seq 不重用 | STREAMS_REPLAYED 子步骤（divergence 清单阻塞 reopen）+ seq 分配起点 ≥ 崩溃前最大已发布 seq+1、"NEVER from the restored head" + 外部副作用 escalated/manual（HTML L1904-1924）+ M7 强制 IC-3 fixture。 | **STILL_OPEN** | 方向已立法、fixture 正确，但**交付的示例 SQL 对目标场景失效**：比对语句 `FROM consumer_cursors c JOIN stream_heads h ... WHERE c.acked_seq > h.committed_seq` 两侧都取自**被恢复到 T1 的同一库**——cursor≤head 恒成立，恰好检不出"外部 consumer 消费超过 cut"这一它要抓的事故（DeepSeek 焊点 C 指出 consumer_cursors 同库回退；本席补强：因此该 SQL 对目标场景恒空）。所幸 IC-3 fixture 要求"divergence 清单非空"，照抄示例 SQL 的实现必挂该 fixture——门禁救了规范，但规范文本必须改。加上"最大已发布 seq"发现算法与证据不可得降级路径缺失 → L4-16（P1）。 |

**统计：CLOSED = 4（FL-01/24/26/32），STILL_OPEN = 2（FL-13/38），REGRESSED = 0。**

---

## 3. CROSS_REPORT_FINDING_LEDGER

同根合并；"原判"为席位自报，"终判"为本席复核。全部四席 P0/P1 均有落位（含降级与 FACT_ERROR 改判）。

### 3.1 P0（1 条）

| ID | 来源 | 议题 | 原判 | 终判 | 裁决要点 |
|---|---|---|---|---|---|
| **L4-01** | Kimi P0-1/B-4（主）；GLM A2/A4（关联）；DeepSeek 误判闭合 | 受管制命令 commit 点复核："普通读即可，撤销写方提交后的下一次重读必见"（HTML L1622；路线图 M5 L158 同文） | Kimi FACT_ERROR→P0；GLM A2 P0 | **UNDER_SPECIFIED P0 确认** | 括注的字面为真（READ COMMITTED 下重读必见已提交值），但**充分性声明为假**：单次普通读与 COMMIT 之间存在窗口——撤销事务在复核读之后、领域 COMMIT 之前提交，受管制命令仍以旧 epoch 落地。M5 退出门禁（IC-1）要求"撤销 × admission × commit 全时序交叉 ×100，受管制 stale-commit **= 0**"——按规范自己的机制无法推导出这个 0：机制与门禁不可同时满足（差一条锁语义，尚不足以判 SPEC_CONTRADICTION，因为二者不在同一语义层——机制条款可单方修订闭合）。修复恰好一行：复核改为对权威 sessions 主行的 `FOR SHARE/FOR UPDATE` 加锁读并持锁至 COMMIT（撤销写方与命令 COMMIT 被行锁强制全序化），或等价把三类 epoch 断言以持锁方式并入 terminal receipt 写入。**注意 Kimi 的备选方案 2（terminal UPDATE 谓词内嵌无锁 EXISTS 子查询）不闭合**——EXISTS 快照到 COMMIT 之间窗口依旧，本席予以修正（见 V24-01）。溯源：该括注逐字来自 v2.2 最终裁决报告 FL-13 修订方向——上轮裁决席引入、v2.3 忠实转写、本轮 GLM/GPT-Sol/DeepSeek 三席未察（DeepSeek 明确给了错误的 CLOSED 确认），Kimi 独立击穿。授权类直接破坏 → P0。 |

### 3.2 P1（16 条）

| ID | 来源 | 议题 | 原判 | 终判 | 裁决要点 |
|---|---|---|---|---|---|
| L4-02 | Kimi A-1/P1-1 | 最终 fencing 谓词的 `statement_timestamp()` 是语句开始时间；`SELECT ... FOR UPDATE` 锁等待后 EvalPlanQual 重评仍用旧值，drain_deadline 边界被锁等待时长弹性拉长 | UNDER_SPECIFIED P1 | **UNDER_SPECIFIED P1 确认（仅活性）** | PostgreSQL 语义事实正确。但**单写者不破**：handoff CAS 与 placement recovery CAS 同样必须等待旧 holder 持至 COMMIT 的 lease 行锁，晚提交仍严格序列化在 epoch 递增之前，watermark 含其事件。后果=drain SLA 弹性 + 验收窗口失真，非双写。Kimi 自评 P1 恰当。修复：`clock_timestamp()` 或获锁后同事务二次校验。其 BLOCKING_QUESTION 1（handoff CAS 若用 NOWAIT/SKIP LOCKED 会否升级 P0）答案是否：NOWAIT 报错、SKIP LOCKED 计 0 行=CAS 失败重试，两者皆 fail-safe，不产生绕锁提交。 |
| L4-03 | Kimi A-2/P1-2 + 本席交叉核对 | `transferring→active` 激活超时无 DDL 载体（无 `transfer_deadline` 列、激活/回收 CAS 无 deadline 谓词、recovery 扫描 SLA 空白）；且 HTML 激活谓词（`holder_id=:new_holder`）与路线图 M2（`transfer_to=:self AND handoff_id=:handoff_id`）不一致 | UNDER_SPECIFIED P1 | **UNDER_SPECIFIED P1 确认** | "禁止 owner 永久停留在 transferring"是规范明文要求但无机械载体。晚到的旧激活被 CAS 谓词（epoch/holder 不符→0 行）挡死，无正确性破坏——纯活性缺口，P1 恰当。两文档谓词差异本席新增：handoff CAS 已写 `holder_id=:new_holder`，两种谓词各自可用但验收文本必须唯一。 |
| L4-04 | GLM A1 | 受管制命令类清单为描述性开放枚举，无 typed manifest 字段、无 release gate 谓词、无独立 stale-commit reasonCode；漏登记的权限授予命令按普通命令走 SLO 窗口 | UNDER_SPECIFIED+UNTESTABLE **P0** | **UNDER_SPECIFIED+UNTESTABLE P1（降级）** | 与 P12 裁决同构：三类语义定义（支付/经济、管理员、权限授予）覆盖 `alliance.appoint_officer`——漏登记是**实现错误不是规范许可**，规范本身不批准该越权。真缺口是缺可机械验证的登记与检出机制（typed 清单 + gate + REGULATED_STALE_COMMIT 分流），属 UNTESTABLE 面 → P1。修订采纳 GLM 方案（V24-04）。 |
| L4-05 | Kimi C-4/P1-6 | "重复 dedupe_key 消息幂等返回首次记录的原结果"在 `saga_steps` DDL 无存储载体（无 result 列） | UNDER_SPECIFIED P1 | **UNDER_SPECIFIED P1 确认** | 已钉死的语义不可唯一实现（原结果无处读）。加 `result_status/result_payload` 两列即闭合（V24-05）。 |
| L4-06 | GLM D2 | SUBSCRIPTION_INVALIDATED "空闲流也必须能在撤销 SLO 内收到"——断线/idle 客户端不存在"送达"通道，"到达"语义（落 retention vs 客户端接收）未定义，无可验 gate | UNTESTABLE P1 | **UNTESTABLE P1 确认** | 字面要求对无连接客户端不可实现也不可测。修订采纳 GLM 双层定义：SLO 绑定"服务端已落 retention/该 subscription 可见范围"，客户端重连 HELLO 必补投 backlog（V24-06）。 |
| L4-07 | GPT-Sol B1 + SOL-23-01/05/08 | 证据 provenance：digest 只证完整性不证来源；提交者可同时自造 artifact bytes 与 digest，守恒复算对自洽假数恒通过；artifactSchema 仅为非空字符串（无 schema digest/producer 身份/source cursor/查询边界） | UNTESTABLE P1 | **UNTESTABLE P1 确认** | 本席认可这是 v2.3 守恒块闭合后暴露的下一层真缺口：§4 的"重取 bytes 复算 digest"对 B03 类攻击（假 artifact + 自填 digest）无鉴别力。conservation/trace artifact 需 typed schema + producer attestation + 权威 source cursor（V24-09a/d）。 |
| L4-08 | GPT-Sol B2/C1 部分 + SOL-23-02/06 + D1 | gate/SLO catalogue 无 typed 绑定：required gate 保 ID 即可、condition 可 trivial（`0 eq 0`）、threshold 由提交者自填、`minSampleCount` 无载体（sampleCount=1 结构合法）、`terminal` 合并 pre-admission 拒绝（100% 拒绝运行守恒自洽=拒绝洗白） | UNTESTABLE P1 | **UNTESTABLE P1 确认** | 注意"拒绝并入 terminal"本身是第三轮已裁决的定义（判定器 §10.1 明文），不得当矛盾立案——GPT-Sol 未犯此错，其攻击点是**守恒平≠有处理能力**，须由 catalogue 强制 accept/success/reject SLO 条件补上。catalogue 固定 metric/operator/threshold 来源/样本政策/是否 waivable（V24-09d）。 |
| L4-09 | GPT-Sol SOL-23-03/D06 | 判定器 §7 要求每 condition 保存原始 sample/evidenceRef，schema `$defs.condition.additionalProperties:false` 禁止任何证据字段（D06 机械重验 REJECT 属实）——"必须保存但不可表示" | UNTESTABLE P1 | **UNTESTABLE P1 确认** | 正确适用第三轮纪律（"判定器要求的量无 typed 字段 → UNTESTABLE 非 SPEC_CONTRADICTION"）。加 `observationRef/thresholdRef`（V24-09b）。 |
| L4-10 | GPT-Sol E1/E3 + SOL-23-07 | 联合 trace 绑定输入不完整：gate 无 stageRefs/scenarioId/traceDigest，artifact envelope 无 scenario/phase/window 字段（只有 capturedAt）——§9.1 CROSS_SCENARIO_STITCHING 检查无确定输入 | UNTESTABLE P1 | **UNTESTABLE P1 确认** | §9.1 声称"解析 gate 的 evidenceRefs、校验 artifact 均携带同一 (scenarioId, traceDigest)"——但 evidenceArtifact schema 无这两个字段，只能寄望于未发布的 artifact 内部格式 → 不唯一。补 join key（V24-09a）。 |
| L4-11 | GPT-Sol C1 | NA 审批真实性：approvedBy 自由字符串、artifact type 枚举无 approval、无主体签名/expiry/防重放；§11 要求"身份与 release manifest 登记的责任人一致"但 manifest 示例**没有责任人字段** | UNTESTABLE P1 | **UNTESTABLE P1 确认** | 本席核实 manifest 示例（HTML L1824-1841）确无 releaseOwner/architectureOwner 字段——§11 第 2 步无输入可比。结构化 approvals[] 双签 + manifest 责任人字段（V24-09c）。 |
| L4-12 | GPT-Sol §5.1 | `rho = arrivalRate.mean × serviceTime.mean` 量纲错误：req/s × ms 未除 1000（schema percentiles 描述、判定器 §9、HTML §05 阶段模型三处同病）；且无 visits/parallelism/class 汇聚模型 | UNDER_SPECIFIED P1 | **UNDER_SPECIFIED P1 确认** | 直接复算：1000 req/s × 5ms → 公式给 5000 而真 rho=5（>1 即恒 NOT_PROVEN，或实现方"自愈"除法导致各家判定不一）。三处文本同步修正 + 最小汇聚模型（V24-09e）。热点 owner `m=1` 串行极限不得用全机并行度稀释——采纳。 |
| L4-13 | GPT-Sol A1 + SOL-23-05 | capacity profile 内容无政策约束：合法 release signer 可注册"缩小范围"的 profile（单 gate/单 stage/单 center）并通过全部锚定检查；profile/catalogue 无 versioned schema、digest 前像未定义 | UNTESTABLE P1 | **UNTESTABLE P1 确认** | GPT-Sol 同时自我驳回了两条无效攻击（同 digest 换字节、profileDigest 必然环引用）——纪律执行正确。签名证明"谁签的"不证明"清单满足哪个强制政策"：profile 签名角色与 release signer 分离或双角色 quorum + catalogue schema（V24-09d）。 |
| L4-14 | GPT-Sol SOL-23-04 + R13 | evaluator 信任 bootstrap：仅要求运行制品 digest 等于合同**自填**的 algorithmDigest；调用方可提交恶意 evaluator + 匹配 digest | UNDER_SPECIFIED P1 | **UNDER_SPECIFIED P1 确认** | §12 已要求判定器 digest 进 release manifest——差"判定输入必须以 manifest 锚定的 evaluator digest 为准（合同字段仅 precheck）"一句话（V24-09g）。 |
| L4-15 | DeepSeek 焊点 B（SPEC-REL-01a/08） | restore step 守卫求值、步骤 DB 副作用与 next-step CAS 的事务边界未声明（TOCTOU）；takeover"signed restore authorization"无 payload schema（仅 TRAFFIC_REOPENED 有） | UNDER_SPECIFIED P1 | **UNDER_SPECIFIED P1 确认** | next-step CAS 的 token/lease/step 谓词已挡住"晚到 coordinator 推进状态"，但守卫通过与步骤副作用之间无原子声明——对纯 DB 步骤一句"同一事务"即闭合；对文件系统步骤（DATA_RESTORED）需声明"guard 重评+CAS 先行"次序。takeover token schema 缺失使高危接管授权不可验收（V24-07）。 |
| L4-16 | DeepSeek 焊点 C（SPEC-REL-10/11）+ 本席补强 | "崩溃前最大已发布 seq"发现算法未定义（restored 库内 consumer_cursors 同被回退，不能作证据源）；示例 divergence SQL 两侧均取恢复库值，对目标场景恒空；证据不可得时无 SEQ_ORIGIN_UNKNOWN 降级；divergence 人工收敛 SOP 缺失 | UNDER_SPECIFIED P1 | **UNDER_SPECIFIED P1 确认（FL-38 残余）** | 见第 2 节 FL-38 行。修订：外部收集对账证据为唯一合法比对源 + max(外部 consumer acked, relay 持久发布记录) 发现算法 + 皆不可得 → RESTORE_BLOCKED(SEQ_ORIGIN_UNKNOWN) + SOP-DIVERGENCE-01（V24-08）。 |
| L4-17 | GPT-Sol SOL-23-09 | stage 只有单 unit 的 queueDepth 分布，却同时必填 maxQueueItems 与 maxQueueBytes——两预算之一恒无同构分布可验 | UNTESTABLE P1 | **UNTESTABLE P1 确认** | §6 单位表自己写明"若两者都需要，必须拆为两个 metric"——schema 未跟上。拆 queueItems/queueBytes（V24-09f）。 |

### 3.3 P2（合并后 24 条；含从 P0/P1 降级项）

| ID | 来源（原判） | 议题与终判要点 |
|---|---|---|
| P2-K1 | Kimi P1-3（P1→P2） | admission 三 epoch 列不可变性无触发器强制。与 plan 行不可变触发器同等待遇补齐即可；触达它需非规范写路径，防御纵深项。 |
| P2-K2 | Kimi C-2 残余 | "迟到 confirm 必须失败"（架构/路线图）与"changes zero rows and is ignored"（DDL 注释）的**线上返回码**措辞统一（语义已一致：均为零副作用；见 4.1 FE-1）。 |
| P2-K3 | Kimi C-3/P1-5（P1→P2） | plan_attempt 推进与新 plan 行插入应声明同一事务（或 deferred FK），把 FK 23503 与"0 行"归入同一 re-plan 通道。异常通道差异不产生数据破坏。 |
| P2-K4 | Kimi D-5/P1-8（P1→P2） | 外部 destination accept credential：目录已定义语义（"记录于该 (event_id,destination) 行"），示例 DDL 缺 typed 列——目录↔DDL 同步类编辑缺陷（v2.2 FE-7 同类）。加 `external_accept_credential JSONB, accepted_at`。 |
| P2-K5 | Kimi P1-9（P1→P2） | cleanupConservation 与 outbox spool 清理边界：判定器 §10.1 已限定"receipt/job/Saga/**authoritative event**"，schema 描述的"events"一词应显式排除已 accepted 的 outbox 行。措辞澄清。 |
| P2-K6 | Kimi D-3 残余 | 部分退款"原始金额"口径（per-currency 各 account_class 计入范围、跨币种是否按 valuation 封顶）未定义。锁序机制本身已闭合（见 4.1 FE-2）。 |
| P2-G1 | GLM A3（P1→P2） | gateway 缓存 age>SLO fail-closed 缺独立测试 gate——语义已明文（v2.3 采纳 FL-22 残余），补 STALE_CACHE_AUTH 注入 fixture 属验收矩阵增项。 |
| P2-G2 | GLM A4 | AUTH_EPOCH_STALE 终态化与领域回滚同事务显式化（与 D1 同源，一句话）。 |
| P2-G3 | GLM B1（P1→P2） | refresh 撤销的操作→(三 epoch/state/hash) 变化决策矩阵与线性化点二义。GLM 自证两种读法**均无授权泄漏**（半径正确）→ 唯一可实现性文档项。 |
| P2-G4 | GLM B2 | refresh rotation 是否同发新 access token 未声明。 |
| P2-G5 | GLM C1 残余 | 授权过滤投影事务应显式声明为带 durable cursor 的 at-least-once 下游 consumer（主时间线已驳回，见 4.1 FE-4）。 |
| P2-G6 | GLM C2 | filtered stream 侧信道预算（timing/密度相关性）无度量定义。信息隐藏断言的可测性增强项。 |
| P2-G7 | GLM D1 | SUBSCRIPTION_INVALIDATED 需携带 permissionEpoch/newGeneration 去重标签并占 visible_seq（并入 V24-06）。 |
| P2-G8 | GLM E1 残余 | statusUrl maxStaleness 已钉死在 release manifest（主张驳回，见 4.1 FE-3）；补 typed 字段名 `statusUrl.maxStalenessMs`。 |
| P2-G9 | GLM E2（P1→P2） | SKIP_AND_RESYNC 三步协议细节（reason code/resync watermark 字段）+ 移除 event type 的 deprecation_at 登记。默认行为语义已闭合（GLM 自认 C-FL-21）；removal 对旧 consumer 不产生未知帧，威胁面弱。 |
| P2-G10 | GLM E3 | upcaster 制品的 signer key lifecycle 是否随 manifest key 同根/重签待遇——release 可运营性交叉面。 |
| P2-G11 | GLM S2（P1→P2） | session/authz epoch bump 对既有 stream 投递的传播**机制**（STALE 级联 vs INVALIDATED vs 断连）未点名——但"撤销传播有产品 SLO 和可观测证据"已通用覆盖 stream 面，机制属实现选择，补一句绑定即可。 |
| P2-G12 | GLM S3（P1→P2） | credential_version bump 后客户端 fresh bootstrap 与旧 cursor 效力：HELLO 三 epoch 校验已拒旧凭据，重登录后 cursor 复用无安全后果——协议 UX 澄清项。 |
| P2-G13 | GLM S4 / PS2 / VR1（合并） | 双 hash 同行不等 CHECK；statusUrl 返回 leaseUntil 与 retry 策略；拒绝原因优先级顺序。协议防呆包。 |
| P2-G14 | GLM PS1（P1→P2） | 同一 commandId 多次 plan_attempt 的 stale-commit 计数按 commandId 去重聚合——证据统计口径项。 |
| P2-G15 | GLM VR2（P1→P2） | 解压后 body 大小/深度预算的度量与 gate——P12 语义已定，属容量矩阵覆盖增项。 |
| P2-G16 | GLM VR3（P1→P2） | release manifest 必填 `enabledTransports` 使 P11"已启用"边界可机器判定。合理防规避项，manifest 一字段。 |
| P2-S1 | GPT-Sol SOL-23-10 | PASS 分支 gate subschema 缺 `type:"object"`，AJV strict 编译失败（可移植性）；全部含 properties 的 object subschema 补 type。 |
| P2-D1 | DeepSeek 焊点 A 残余 | restore admission 双失败通道（0 行/unique violation）统一处理 + 返回既存 run_id 幂等路径 + isolation 声明（READ COMMITTED 及以上）。 |
| P2-D2 | DeepSeek 焊点 D 残余 | reopen token 增 expiresAt/environmentId + `restore_reopen_tokens` 消费记录防重放；read-only 兜底模式行为契约（503 端点清单/只读端点/consumer 是否暂停）。 |
| P2-D3 | DeepSeek 焊点 E 残余 + ATTACK-RESTORE-01/02 | `release_manifests.artifact_digests` 与 signature/signer_key_id 独立性明文（重签名不变 digest）；RESTORE_BLOCKED 最长滞留/abort 语义；smoke 命令执行身份；reopen 后监测。runbook 五模板采纳（SOP-RESTORE-BLOCKED-01 等）。 |

**Ledger 合计：41 条（P0×1，P1×16，P2×24）。四席全部 P0/P1 均已落位：Kimi 10/10、GLM 12/12、GPT-Sol 10/10、DeepSeek 7/7（重复项按 3.4/4.3 合并）。**

### 3.4 CONFIRMED_SPEC_CLOSURE（交叉确认，摘要）

- handoff 单写者核心 + watermark 同事务原子（Kimi A-3/A-4 + DeepSeek）；超时 transferring 无双活（激活前不服务 + recovery CAS 等行锁）。
- admission 三 epoch 快照写入点=授权线性化点、plan_attempt 推进不刷新快照（Kimi B-1/B-2 + GLM C-A-read-law）。
- saga dedupe_key 作用域 `(realm_id, saga_id, dedupe_key)`（Kimi C-1 + DeepSeek）。
- fx_snapshots 不可变表 + journal FK + fee/tax/rounding account_class（Kimi D-1/D-2 + DeepSeek）。
- snapshot builder 单 REPEATABLE READ 只读事务一致切面（Kimi D-4 + GLM C-P6）。
- restore 单例准入（DeepSeek 焊点 A，四档隔离逐验）；九步幂等守卫逐步可执行（焊点 B 表）。
- 三 epoch × 操作 bump 矩阵、per-device refresh 半径、P3/P4/P5/P6/P9/P11/P12、未知 event type 默认 SKIP_AND_RESYNC（GLM CONFIRMED 清单）。
- 容量 schema：mean/sampleCount 必填、finalState typed 守恒块 PASS 分支结构拒绝、requiredResourceCenterTypes 集合差唯一可算、NA×PASS 分支与 §11 对齐（GPT-Sol 局部 CONFIRMED + 本席机械重验）。

---

## 4. FACT_ERRORS_AND_REJECTED_ATTACKS

### 4.1 FACT_ERROR（整判/主体）

| 编号 | 席位/条目 | 被驳主张 | 驳回依据 |
|---|---|---|---|
| FE-1 | Kimi C-2/P1-4（自报 SPEC_CONTRADICTION P1） | "迟到 confirm 必须失败"与"重复 dedupe_key 幂等返回原结果"直接冲突 | **两条款作用于不相交的输入集**：前者针对**未记录 dedupe_key 的新迟到 confirm**（不得越过 compensating/completed，零行忽略/失败），后者针对**已记录 dedupe_key 的重复消息**（返回首次结果）。DDL 注释（L1419-1426）与表目录行（L1065）都以两句分列两案，可同时满足。Kimi 时间线把"completed + 重复 dedupe_key"套进"必须失败"条款属对象错配。本轮唯一 SPEC_CONTRADICTION 立案就此撤销——**v2.3 本轮确认 0 条 SPEC_CONTRADICTION**（DeepSeek 同结论）。残余：返回码措辞统一 → P2-K2。 |
| FE-2 | Kimi D-3/P1-7（并发部分退款超额） | "自然语言谓词没有指定先锁原 journal 行再求和的序列化步骤" | **规范明文指定了**：HTML L1374-1376 "inside the refund transaction, **lock the original journal row**, then assert per currency SUM(...) + :this_refund <= original amount; violation raises and rolls back"。两笔并发退款各自持原 journal 行锁 → 第二笔在第一笔提交后重读 SUM=600 → 600+600>1000 → 回滚。时间线要求实现方跳过规范已要求的锁，纪律第 7 条 → FACT_ERROR。残余口径问题 → P2-K6。 |
| FE-3 | GLM E1（statusUrl staleness 载体未约束） | "若实现只写在运行时配置文件而不进 release manifest，则……" | **载体已钉死**：HTML L1233-1235 "or declare a bounded max staleness **in the release manifest**……and is on the authoritative-read inventory"。前提不成立。残余：typed 字段名 → P2-G8。 |
| FE-4 | GLM C1 主时间线（filtered stream 崩溃续传不可验收 P1） | source 提交后、映射写前崩溃 → 只有"永久 gap"或"被禁止的权限历史重算"两条路 | **存在第三条规范内路径**：授权过滤投影是持 durable cursor 的 at-least-once 下游消费（规范已有 consumer_cursors + "消费 receipt、projection 和 cursor 在同一事务" 的 inbox 机制）；崩溃时映射未写=cursor 未过 E → 重启后按当前权限正常投影 E。visible_seq 只在映射写入时分配，dense 性不破；以**当前**权限过滤正是 Knowledge Rule/P7 的发射侧交集规则，非被禁止的**历史**权限重算。禁令针对的是"已发出的 visible_seq 不得靠权限历史重导"，与补投影不冲突。残余：投影 consumer 的 cursor 语义应明示 → P2-G5。 |
| FE-5 | GLM A2 副本读时间线（作为 P0） | commit 点复读可来自异步只读副本 → 复核形同虚设 | 规范原文"**在领域事务内**重读 sessions 行"——领域事务运行在权威主库连接上（它正在写领域行），"在事务内读"的平实语义即同连接同库读；跨连接读副本不是"在领域事务内"。以违背条款字面的实现构造反例 → 主体驳回。残余合理项：commit 点复读与 statusUrl 同列 authority-read inventory、禁止对其声明 staleness → 并入 V24-01 文字。 |

### 4.2 方法/确认类错误

| 编号 | 席位 | 记录 |
|---|---|---|
| ME-1 | DeepSeek | 对 FL-13 给出"**闭合**。授权线性化点明确，受管制命令二次校验"的确认（CONFIRMED_CLOSURES 表）——漏掉复核读→COMMIT 竞态，与 Kimi P0-1 直接冲突，本席裁 Kimi 方成立。错误的闭合确认与错误的立案同样计入质询记录。 |
| ME-2 | GPT-Sol | 方法声明"AJV 8.20.0……未安装依赖"在本仓库不可复核：仓库 node_modules 仅有 **ajv@6.15.0**（不支持 Draft 2020-12）。其 38 行结果本席以 ajv6 实跑 17 行 + 逐行读证 21 行**全部属实**（10 REJECT/28 ACCEPT 分布确认），结论不受影响，但容量席自身证据链存在工具版本 provenance 瑕疵——恰是其报告主打的问题类型，如实记录。 |

### 4.3 严重度夸大与重复

- **Kimi（4 条降级 + 2 FACT_ERROR）**：P1-3→P2、P1-5→P2、P1-8→P2、P1-9→P2；P1-4/P1-7 整判 FACT_ERROR。P0-1 成立且为本轮唯一 P0。
- **GLM（2 条 P0 降级/驳回 + 8 条 P1→P2）**：A1 P0→P1、A2 P0→主体驳回+P2 残余；A3/B1/S2/S3/PS1/E2/VR2/VR3 P1→P2。C1 P1→主体驳回+P2。其对纪律的自我约束良好（主动撤销 ST4/删除"传递授权泄漏"立案），但对"可验收性缺口"系统性偏高一档。
- **GPT-Sol：0 夸大、0 FACT_ERROR**（两条无效攻击自我驳回），连续两轮事实密度最高。
- **DeepSeek：0 夸大**（自报 0 SPEC_CONTRADICTION 正确），代价是 ME-1 的漏检。
- **重复合并**：GLM ST1=C1、§5 A1/A2 复述 → 各计一条；Kimi restore `ON CONFLICT DO NOTHING` 建议与 DeepSeek 焊点 A 修订同根 → P2-D1；GLM D1 与 D2 并入 V24-06；四席复述的"当前无 owner_leases/stream/saga/ledger/evaluator" → 第 7 节 backlog，不计规范缺口。

---

## 5. CROSS_DOMAIN_INCIDENT_CHAINS（6 条）

**IC4-1 受管制授权双缺口 → 越权授予固化 → M5 验收僵局（L4-04 → L4-01 → P6）**
联盟转让命令未登记受管制清单（无 typed 清单与 gate，L4-04）→ 按普通命令仅靠 SLO 窗口；即便登记，复核用普通读仍留复核后-COMMIT 前窗口（L4-01）→ 撤销后的授予提交、事件入 stream 被 snapshot 以 committed watermark 固化为不可回退事实 → IC-1 门禁要求受管制 stale-commit=0 而机制给不出 0 → M5 既不能诚实通过也不能诚实失败。**验收判据**：V24-01 锁语义 + V24-04 typed 清单；IC-1 矩阵增"复核读后-COMMIT 前撤销"用例，REGULATED_STALE_COMMIT=0 由锁序推导成立。

**IC4-2 锁等待跨 deadline → drain 时间线失真 → 联合证据无法对齐（L4-02 → L4-03 → L4-10）**
多 owner 命令最终 fencing 在锁等待中跨越 drain_deadline，`statement_timestamp()` 放行晚提交（L4-02）→ placement recovery 被同一行锁阻塞，handoff 完成时间与 drain SLA 记录系统性偏移；若此时新 holder 崩溃，transferring 无 deadline 载体，靠人工发现（L4-03）→ 事后容量合同的 fault 阶段 stage trace 与 handoff 时间线跨 scenario 拼接（artifact envelope 无 scenario/window 字段，L4-10）→ evaluator 无 join key 检出，一次 handoff 停摆事故被平滑的分段证据洗白。**验收判据**：clock_timestamp 修正 + transfer_deadline 列 + typed envelope join key；IC-2 fixture 重跑。

**IC4-3 seq 起点不可知 → 恢复"自愈"式违规 → 对账恒空放行（L4-16 → L4-15 → FL-38 复发）**
PITR 后外部 relay/consumer 证据缺失，规范禁取 restored head 又无 SEQ_ORIGIN_UNKNOWN 出口 → 实现被迫发明"restored head+安全间隙"起点（L4-16）→ divergence 比对照抄示例 SQL（两侧同取恢复库）恒空 → reopen 放行、seq 重用、外部消费者静默跳过新事件——v2.2 IC-3 原事故在"已修复"规范下原样复发；中途接管的 coordinator 以无 schema 的"签名授权"接管（L4-15），事后无法审计谁批准了这次恢复。**验收判据**：V24-08 外部证据源 + 发现算法 + SEQ_ORIGIN_UNKNOWN 阻塞 + takeover token schema；IC-3 fixture 断言比对值来自外部收集而非库内 cursor。

**IC4-4 合法签名缩小范围 → trivial PASS → 伪造 NA → 自洽假数（L4-13 → L4-08 → L4-11 → L4-07 → 路线图 §13）**
release signer 注册单 gate/单 stage/单 center 的缩小 profile（L4-13）→ 保留的 required gate 只带 `0 eq 0` condition（无 catalogue 绑定，L4-08）→ 实质门禁以自由字符串双人名 NA 豁免（L4-11）→ trace/conservation artifact 自造自digest（L4-07）→ 100% 拒绝洗入 terminal 守恒自洽 → 结构校验与 evaluator 双通过，§13"允许小范围外测"被形式满足。GPT-Sol G1+G2+G3+G4 完整假 PASS 链成立。**验收判据**：V24-09 全包 + M17/M18/M19 fixtures；两个独立 evaluator 对 canonical bundle 逐字节同 verdict（M24）。

**IC4-5 权限收缩 → 空闲流不可达 → 重订阅风暴证据不可验（L4-06 → P2-G7 → L4-10 → IC-6 判据失效）**
服务端收缩权限发 SUBSCRIPTION_INVALIDATED，idle 断线客户端"SLO 内收到"不可实现也不可测（L4-06）→ 重连潮到达时无去重标签的重复 INVALIDATED 使 generation 跳变（P2-G7）→ 触发重订阅风暴 × authz cache miss 联合场景——M7 要求联合注入同一 traceDigest 证据，而 artifact envelope 无 scenario 字段（L4-10）→ IC-6 判据（stale-approve=0）无法机械验收。**验收判据**：V24-06 双层"到达"+去重标签；联合 trace envelope 落地后 IC-6 重跑。

**IC4-6 退款口径二义 → ledger 复算不唯一 → 守恒证据失效（P2-K6 → L4-07/L4-08）**
两实现对"原始金额"各取毛额/净额口径（P2-K6），均自认满足"lock the original journal row + 累计封顶"→ 跨币种部分退款在两口径下产生不同 rounding 账户余额 → 容量合同 `ledgerImbalance.count=0` 的复算依赖未 typed 的 conservation artifact（L4-07），两个 evaluator 复算结果不一致却都"通过"→ 资金守恒证据失去唯一性。**验收判据**：口径定义入 §03 + conservation artifact typed schema；并发退款 fixture（F-D1）按钉死口径重写期望。

---

## 6. REQUIRED_V2_4_PATCHES（最小修订单）

**门禁标注约定**：`GATE:Mx` = 该补丁闭合前 Mx 的退出门禁不可唯一验收（实现可先行开发，不得宣布通过）。**没有任何补丁阻塞 M0-M1 的启动与退出**——修订期与 M0/M1 实现完全并行。

### P0（1 条，GATE:M5）

**V24-01（L4-01）受管制命令 commit 点复核锁语义**
- 目标文件与落点：`成熟SLG后端参考架构-v2.3.html` §04 "授权线性化边界（撤销语义=读法 a）" implementation-note（现 L1622）；`当前实现迁移路线图-v2.3.md` §10 M5 交付第 3 条（现 L158）。两处删除括注"（普通读即可，撤销写方提交后的下一次重读必见）"。
- 替换文字（钉死唯一机制）：受管制命令的 commit 点复核 = 同领域事务内对**权威 sessions 主行**执行 `SELECT credential_version, session_epoch, authz_epoch FROM sessions WHERE session_id=:sid FOR SHARE`（锁持至 COMMIT；写路径可用 FOR UPDATE），断言三值与 receipt 的 admission 快照一致，不一致即 raise 回滚并同事务把 receipt 终态化为 `failed_final(AUTH_EPOCH_STALE)`。sessions 行锁纳入规范锁序（receipt 之后、owner_leases 之前）。commit 点复读与 statusUrl 同列 authority-read inventory，且**不允许**对其声明 max staleness（吸收 GLM A2 残余）。明示：仅受管制类付此锁成本，普通命令不复核（维持 v2.2 裁决的成本边界）。
- 显式排除：无锁 `EXISTS` 子查询内嵌进 terminal UPDATE **不**视为等价实现（快照到 COMMIT 窗口依旧——修正 Kimi 备选方案 2）。
- 验收谓词：IC-1 矩阵新增"复核读之后、COMMIT 之前提交撤销"注入用例；受管制 stale-commit=0 必须由锁序推导成立（撤销写方要么先提交→复核必见→回滚，要么被 FOR SHARE 阻塞→序后于命令 COMMIT）；×100 全时序交叉零计数。

### P1（GATE 按条标注）

**V24-02（L4-02）drain/lease 时钟源 — GATE:M2**
- `成熟SLG后端参考架构-v2.3.html` fencing 代码块（L1164-1176）与 owner_leases 表行（L1043）：`lease_until > statement_timestamp()`、`statement_timestamp() < drain_deadline` 改为 `clock_timestamp()`（或保留原句 + 增"获得行锁后同事务内以 clock_timestamp() 二次校验 deadline，超限 raise"）。
- 验收谓词：注入锁等待使 fencing 语句跨越 drain_deadline，命令必须 0 行回滚（Kimi F-A1）。

**V24-03（L4-03）transferring 激活超时载体 + 谓词统一 — GATE:M2**
- HTML owner_leases DDL（L1109-1124）增 `transfer_deadline TIMESTAMPTZ`；激活 CAS（L1152-1159）增 `AND clock_timestamp() < transfer_deadline`；placement recovery CAS 明文（回滚旧 holder 或强制新 epoch 的两条 UPDATE，谓词含 `state='transferring' AND transfer_deadline < clock_timestamp()`）；表目录行同步。
- 统一激活谓词：HTML（holder_id）与路线图 M2 L93（transfer_to/handoff_id）合并为 `state='transferring' AND holder_id=:new_holder AND handoff_id=:handoff_id AND owner_epoch=:new_epoch`，两文档同文。
- recovery 扫描 SLA 一句话（扫描周期上界 + `transferring age > threshold` 告警指标）。
- 验收谓词：新 holder 激活前 pause 超时注入，owner 在 deadline+扫描周期内回到 active（旧 holder）或新 epoch（Kimi F-A2 / IC-2 判据）。

**V24-04（L4-04）受管制命令类 typed 清单 — GATE:M5**
- HTML §06 release manifest 代码块（L1824-1841）增 `regulatedCommandClasses: [{commandType, class ∈ {payment_economy, admin_operation, permission_grant}, commitRecheckEpochs}]`；§04 P4 增 release gate 谓词："inventory.commandTypes 中语义满足'授予/转移/撤销他账号权限或动用平台/账号资金'而未登记者 → release REJECTED（REGULATED_COMMAND_NOT_LISTED）"。
- 路线图 M5 IC-1 判据拆分独立 reasonCode：`REGULATED_STALE_COMMIT`（必须=0）与 `STALE_COMMIT_WITHIN_SLO`（普通命令，落 SLO 窗口内）。
- 验收谓词：mutation fixture——清单缺一条 permission_grant 类型 → release gate FAIL。

**V24-05（L4-05）saga 幂等结果载体 — GATE:M6**
- HTML saga_steps DDL（L1401-1417）增 `result_status TEXT, result_payload JSONB`；表目录行同步；同步修订 P2-K2 措辞（重复 dedupe→返回原结果；新迟到 confirm→零行忽略并返回明确非成功码，二者分句）。
- 验收谓词：重复 confirm 重投返回首次 result_payload、无新副作用；新迟到 confirm 零行且状态不变（Kimi F-C1/F-C3 重写版）。

**V24-06（L4-06 + P2-G7）SUBSCRIPTION_INVALIDATED 语义 — GATE:M5**
- HTML §04 授权过滤 note（L1626）："撤销 SLO 内到达"改双层定义：(i) SLO 绑定服务端侧——控制事件已落该 stream retention 且 ≥ subscription 当前 visible_head_seq；(ii) 断线客户端在下次 HELLO/resync 必收到 backlog 中的该事件。envelope 增 `permissionEpoch`、`newGeneration` 去重标签并占用 visible_seq；客户端按 (streamKey, generation) 幂等。
- 验收谓词：GLM Sec-T5 三 case（dup 幂等/跨 epoch 不合并/idle 重连补投）。

**V24-07（L4-15）restore step 原子边界 + takeover token — GATE:M7**
- HTML §06 restore 代码块（L1873-1900）增一句："每步的 idempotency guard 求值、该步对 restore_runs 及权威库的 DB 写、next-step CAS 必须在同一数据库事务提交；非 DB 副作用（文件恢复）步骤必须先重评 guard 再执行、以 next-step CAS 的 0 行结果为放弃信号"。
- 定义 takeover authorization token schema：`{restoreId, coordinatorId, issuedAt, expiresAt, signerKeyId, signature}`（与 TRAFFIC_REOPENED token 同信任根）。
- 验收谓词：FI-12/FI-13 注入——step 交叉被 CAS 拒绝；无有效 takeover token 的接管被拒。

**V24-08（L4-16）seq 起点发现算法 + divergence 证据源 — GATE:M7**
- HTML §06 STREAMS_REPLAYED 代码块（L1904-1924）：(a) 明文声明比对用 acked_seq **必须来自恢复窗口内向各外部 consumer/relay 实时收集的对账证据**，禁止取恢复库 consumer_cursors 表值（示例 SQL 加注或改写为对账临时表）；(b) "崩溃前最大已发布 seq" := max(全部外部 consumer 独立存储的 acked_seq, relay/outbox 外部持久发布记录的 max seq)；(c) 两来源皆不可得 → RESTORE_BLOCKED（reason=SEQ_ORIGIN_UNKNOWN），不得以任何库内值代替；(d) 附 SOP-DIVERGENCE-01 runbook 模板（per-consumer cursor 回退/projection 重建/外部副作用对账/escalated 审批）。
- 验收谓词：IC-3 fixture 增强——恢复库内 cursor 值与外部真值不同的注入，断言 divergence 判定采用外部值；证据缺失注入 → 状态机停 RESTORE_BLOCKED(SEQ_ORIGIN_UNKNOWN)。

**V24-09（L4-07/08/09/10/11/12/13/14/17）容量合同 typed 化第二层 — GATE:M7（整包）**
对 `容量合同-v2.3.schema.json` 与 `容量合同判定器规范-v2.3.md`（及 HTML §05 两处公式）：
- a) **join key + provenance**：evidenceArtifact 增 `scenarioId, phase, windowStart, windowEnd, traceDigest, artifactSchemaDigest, producerIdentity, producerBuildDigest, signature, sourceCursor`；gate 增 `stageRefs`；resourceCenter observation 按 scenario/phase/window 分片。conservation/trace artifact 发布固定 schema（source system、snapshot LSN/cursor、distinct-key 算法、首尾水位）。
- b) **condition 证据可表示**：`$defs.condition` 增 `observationRef`（指向同 gate/stage/scenario/window 的 typed artifact）与 `thresholdRef`（指向 SLO catalogue 条目），解除 §7"必须保存但 schema 禁止"的不可表示态。
- c) **NA 审批结构化**：artifact type 枚举增 `approval`；`approvals[]` 两个 distinct 主体各携 role/keyId/signature/signedAt，签名覆盖 manifestDigest+profileDigest+runId+gateId+reason+替代保证+expiry；release manifest 增 `releaseOwner`/`architectureOwner` 责任人字段（§11 第 2 步当前无输入）；required gate 默认不可 NA，catalogue 明示 `waivable:true` 才可豁免。
- d) **profile/catalogue/SLO 政策链**：发布 `capacity-profile`、`capacity-gate-catalogue`、`slo-catalogue` 的 versioned schema；digest 前像定义为排除自身 digest/signature 字段后的 RFC 8785 规范化对象；profile 签名角色与 release signer 分离或双角色 quorum；catalogue 固定每 required gate 的 metric/operator/threshold 来源、`minSampleCount/minWindowSeconds/quantileMethod/includeFailures/maxDropFraction`、accept/success/reject SLO（封死"拒绝洗白"与 trivial condition）。
- e) **量纲与汇聚模型**：三处公式（schema percentiles 描述、判定器 §9、HTML §05 阶段模型）统一为 `rho = arrivalRate.mean × serviceTime.mean / 1000`；增 class visits/parallelism 汇聚式 `rho_r = Σ_c(λ_c·visits_c_r·S_c_r/1000)/m_r`；service demand 与含排队 response time 分离；热点 owner per-key `m=1`。
- f) **queue 双预算**：queueDepth 拆 `queueItems`/`queueBytes` 两个 percentile block，各对应 maxQueueItems/maxQueueBytes。
- g) **evaluator bootstrap**：判定输入的 evaluator digest 以 release manifest/独立 qualification policy 锚定，合同自填 algorithmDigest 仅 precheck；判定输出携带 schema/profile/catalogue/SLO/artifact-schema/evaluator 全部 policy digest。
- h) **可移植性 + mutation suite**：全部含 properties 的 object subschema 补 `type:"object"`；GPT-Sol R01-E04 全 38 行 + M17/M18/M19/M20/M24 固化为不可删 fixture，断言规范化 result+reasonCode+冲突证据+退出码。
- 验收谓词：GPT-Sol §8 M01-M24 矩阵；M24 正样例由两个独立 evaluator 实现对同一 canonical bundle 输出逐字节相同 verdict。

### P2（编辑/防呆包，随 v2.4 一并落，不单独 gate）

admission epoch 列不可变触发器（P2-K1）；plan_attempt 与 plan 插入同事务声明（P2-K3）；outbox `external_accept_credential/accepted_at` 列 + 目录↔DDL 同步（P2-K4）；cleanupConservation 排除已 accepted outbox spool 的措辞（P2-K5）；退款口径定义（P2-K6）；STALE_CACHE_AUTH 注入 gate（P2-G1）；AUTH_EPOCH_STALE 同事务一句话（P2-G2）；refresh 决策矩阵与线性化点表（P2-G3/G4）；投影 consumer cursor 语义（P2-G5）；侧信道预算度量（P2-G6）；`statusUrl.maxStalenessMs` typed 字段（P2-G8）；SKIP_AND_RESYNC 协议字段 + deprecation_at（P2-G9）；upcaster signer lifecycle（P2-G10）；epoch bump × stream 传播机制绑定（P2-G11）；credential bump 后 bootstrap（P2-G12）；协议防呆包（P2-G13）；stale-commit 按 commandId 去重（P2-G14）；解压预算度量（P2-G15）；`enabledTransports` manifest 字段（P2-G16）；restore admission 失败通道统一 + isolation 声明（P2-D1）；reopen token expiresAt/environmentId/消费记录 + read-only 契约（P2-D2）；artifact_digests 与 signature 独立性 + RESTORE_BLOCKED 时限 + smoke 身份 + DeepSeek 五份 runbook 模板（P2-D3）。

---

## 7. IMPLEMENTATION_ONLY_BACKLOG

以下全部为规范成立、当前代码未实现/未达标的差距。**不降低 v2.3 标准，不改变 CURRENT_IMPLEMENTATION = NON_CONFORMING。** DeepSeek GAP-01..14 与 PART-01..05 经本席抽样复核采纳，按路线图阶段归位：

| 阶段 | 差距（四席一致 + 本席复核） |
|---|---|
| M0 | writer inventory 三集合双向差；基线 release manifest 与签名（当前仅 git commit hash，无 release_manifests 表/签名/信任根 = GAP-11 前半）。 |
| M1 | 原子 receipt：`CommandCommitter.commit()` 持久化领域状态与 `recordResult()` 分离两步（本席复核属实，:50 起 commit / recordResult 委托 idempotencyStore）；`CommandIdempotencyStore` 残留 `COMMAND_IN_FLIGHT`（L138，复核属实）无 recovery guardian（GAP-06/07/08）；三 epoch 快照列缺失。 |
| M2 | `owner_locks` 无 `owner_epoch` 列（本席 grep 复核：OwnerLockRepository 无 epoch，仅 holderId+TTL+`ON CONFLICT` 抢占 L86）；无 placement authority/handoff 状态机（GAP-01/02）；`deploy.sh` PM2 restart 无 drain（DeepSeek ATTACK-FENCE-02）。 |
| M3 | `game_states` 大 JSON 行 → 窄行 aggregate + DB 约束终阻（duplicate reward/negative spend/double occupation）；expand-migrate-contract 政策（GAP-14，SchemaMigrationService 已有 id/checksum/lock，不得误报为无迁移版本控制）。 |
| M4 | scheduled_jobs/stream_events/stream_heads/consumer_cursors/inbox_receipts/outbox_events 全缺（GAP-04/09/10）；外部副作用仍在领域事务内直调。 |
| M5 | 单 JWT + `players.token` hash 模型（GLM 复核）；无三 epoch/refresh family/订阅 generation/visible seq/statusUrl 语义（GAP-05）；客户端重连走全量 bootstrap。 |
| M6 | saga 三表、economy journal/ledger、fx_snapshots 全缺。 |
| M7 | restore coordinator/restore_runs/九步状态机（现 `restore-runtime-state.sh` = pm2 stop+cp+rm WAL+restart，PM2 为唯一 fencing 手段——FI-19；WAL 残留窗口 FI-21）；恢复后无完整性校验；容量 evaluator + mutation suite（GAP-12）；signer key lifecycle（GAP-13，`rotate-production-secrets.sh` 直改 .env 无版本/重叠窗口）；资源预算全缺（仅 PM2 max_memory_restart）。 |

**实现层缺陷（非规范问题，应开单修复）**：
- FI-24：`SecurityConfig.resolveJwtSecret` 在非 production 环境静默回退 `civilization-fire-dev-secret`（本席复核属实：production 缺 secret 会 throw——fail-closed 正确；风险仅在生产机 NODE_ENV 被误设为 development）。修复：以显式 allowlist 环境名启用 dev 回退，未知环境 fail-closed。
- FI-22：`deploy.sh` hardlink（`cp -al`）回滚快照与运行中旧进程共享 inode，快照可被污染——M7 前可先以只读位/文件系统快照缓解。
- FI-21：restore 脚本 mv DB 后、rm WAL 前崩溃无幂等清洁。
- ATTACK-REL-03：健康检查回滚仅覆盖 backend/，config/frontend 不回滚的三方混装风险。
- backup（better-sqlite3 backup API）经 DeepSeek FI-20 验证快照一致——**无缺陷**，不开单。

---

## 8. ACCEPTANCE_TEST_AND_EVIDENCE_DELTA

**采纳（原样或按本裁决修正后）**
- Kimi 故障注入矩阵：F-A1/F-A2/F-A3/F-B2/F-C2/F-D2/F-D3/F-OLD1..4 原样；F-B1 按 V24-01 重写（注入点扩展到"复核读后-COMMIT 前"）；F-C1/F-C3 按 FE-1 重写为双 case 回归项（重复 dedupe 幂等返回 + 新迟到 confirm 零行）；F-D1 按 FE-2 重写为"验证规范已定的原 journal 行锁生效"回归项 + P2-K6 口径断言。
- GLM Sec-T1..T10：T1 保留（A1 部分按 P1 定位为 release gate fixture；A2 副本分支改为"复读必须发生在领域事务连接上"的实现审计项）；T2/T5/T6/T8/T9/T10 原样；T3 降级为决策矩阵文档验收；T4 按 FE-4 重写为"投影 consumer 崩溃续传 + visible_seq dense"正向验证；T7 原样。
- GPT-Sol：38 行 mutation 全部 + M01-M24 负载/故障/正确性矩阵整体采纳为 M7 容量验收基准（M24 双独立 evaluator 逐字节一致为最终放行条件）；R04 类 2020-12 特性行必须在支持 Draft 2020-12 的引擎上跑（本席 ajv6 重验仅覆盖 draft-07 兼容行——mutation suite 的 CI 必须双跑 strict compile + 2020-12 conformance，工具版本记录进证据链，堵 ME-2 类 provenance 瑕疵）。
- DeepSeek：FI-01..FI-18 全部（FI-11 补 isolation 声明断言；FI-12/13 按 V24-07；FI-14/15/16 按 V24-08/P2-D2）；FI-19..24 转实现修复单验证项；五份 runbook 模板（SOP-RESTORE-BLOCKED-01/SOP-DIVERGENCE-01/SOP-KEY-REVOKE-01/SOP-READONLY-MODE-01/SOP-ROLLBACK-BLOCKED-01）随 v2.4 交付。

**本席净增（来自事故链与交叉复核）**
1. IC4-1 fixture：受管制命令撤销注入含"复核读之后、COMMIT 之前"时点，REGULATED_STALE_COMMIT=0 且由锁序可推导（不允许以采样运气通过）。
2. IC4-2 fixture：锁等待跨 drain_deadline + 新 holder 激活超时的**串联**注入；随后的容量合同 fault 阶段证据必须与 handoff 时间线同 scenario/window join key。
3. IC4-3 fixture：divergence 比对源注入——恢复库 consumer_cursors 与外部真值不同，断言判定采用外部值；外部证据缺失 → RESTORE_BLOCKED(SEQ_ORIGIN_UNKNOWN)。
4. IC4-4 fixture：G1+G2+G3+G4 全链假 PASS 合同（合法签名缩小 profile + trivial condition + 字符串 NA + 自造守恒 artifact + 100% 拒绝）→ 期望 NOT_PROVEN 且 reasonCodes 至少含 POLICY_PROFILE_MISMATCH/NA_APPROVAL_INVALID/EVIDENCE_PROVENANCE_INVALID 之一，不得部分 PASS。
5. IC4-5 fixture：idle 断线 × 权限收缩 × 重复 INVALIDATED 重投 → 重连 HELLO 补投唯一、generation 单调。
6. IC4-6 fixture：跨币种并发部分退款按钉死口径的守恒断言 + 两独立实现 ledgerImbalance 复算一致。
7. 谓词一致性回归：HTML 与路线图的激活 CAS 谓词、IC-1 文本、"普通读"括注三处在 v2.4 中必须逐字一致（本轮 STILL_OPEN 的两条都有"两文档不同步"成分）。

**证据规则重申（不变）**：任一守恒/fencing/receipt/cursor/ledger/owner/checksum 失败=FAIL；范围/证据/样本不全=NOT_PROVEN；FAIL 不被平均值覆盖，NOT_PROVEN 不被"未观察到失败"升级；判定器未过自身 mutation suite 前，一切容量结论保持 NOT_PROVEN。

---

## 结语

```text
FINAL_VERDICT                = REVISE_TO_V2_4
PRIOR_LEDGER (6)             = CLOSED 4（FL-01/24/26/32） / STILL_OPEN 2（FL-13/38） / REGRESSED 0
LEDGER_ENTRIES               = 41（P0=1：L4-01；P1=16：L4-02..L4-17；P2=24）
CONFIRMED_SPEC_CONTRADICTION = 0（Kimi 唯一立案经复核为 FACT_ERROR）
FACT_ERRORS                  = 4 整判/主体（Kimi×2, GLM×2）+ 1 部分（GLM A2）+ 2 方法/确认类（DeepSeek FL-13 误闭合、GPT-Sol 工具版本不可复核）
SEVERITY_INFLATIONS          = 14（Kimi 4 / GLM 10 / GPT-Sol 0 / DeepSeek 0）
INCIDENT_CHAINS              = 6（IC4-1..IC4-6）
CAPACITY_CONTRACT            = NOT_PROVEN（维持）
IMPLEMENTATION_START         = M0-M4 可立即启动；V24-02/03 闭合前 M2 退出门禁不判；M5/M6/M7 退出门禁分别被 V24-01+04+06 / V24-05 / V24-07+08+09 阻塞
```

v2.3 把上一轮击穿的五处骨架衔接焊了四处；本轮击穿的是**焊点自身的最后一毫米**：一句"普通读即可"的括注（且恰是上轮裁决席自己开出的药方）、一条取错数据源的示例 SQL、以及容量合同在"字段存在"之后的下一层——证据从哪来、由谁签、和哪次运行绑定。全部修订均不动核心模型；V24-01 一行锁语义 + V24-02/03 两条 DDL 级补丁落地后，M2/M5 的验收即可唯一化，容量包（V24-09）则决定 M7 能否产生第一份不可做假的 PASS。

*报告完成。除本文件外未修改任何文件；全程只读、未 push/deploy/联网。*
