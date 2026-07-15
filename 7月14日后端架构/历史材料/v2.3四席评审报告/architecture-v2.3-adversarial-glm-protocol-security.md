# GLM 协议/会话/授权/AOI/应用安全红队席 · v2.3 第四轮独立对抗审查

席位：GLM（通信协议、身份会话、授权、AOI 情报、应用安全）
对象：`成熟SLG后端参考架构-v2.3.html`、`容量合同-v2.3.schema.json`、`容量合同判定器规范-v2.3.md`、`当前实现迁移路线图-v2.3.md`
裁决纪律：遵守《架构v2.3四席对抗审核提示词.md》共同事实与裁决纪律；全程只读；不读取其他席位输出与历史评审报告；不以实现缺口冒充规范矛盾；不得以概率/重试/扩展 timeout 降低门禁。

---

## 1. PROTOCOL_SECURITY_V2_3_VERDICT

`PROTOCOL_SECURITY_V2_3_STATUS = REVISE_TO_V2_3_1`

总体判读：v2.3 在协议骨架上已吸收第三轮裁决——"撤销语义=读法(a)+有界传播 SLO+受管制命令 commit 点复核""refresh family per-device""visible seq 持久化优于历史重算""一种状态应用机制+多条独立 stream""旧包由 generation/permission epoch 拒绝""只审已启用 transport""account 维度跨 session 聚合"——这些骨架语义可成立，应记为 `CONFIRMED_SPEC_CLOSURE`。

但 v2.3 为闭合第三轮而新焊的五处焊点中，**A（受管制命令清单与 commit 点读前置）、C（filtered stream 崩溃续传的原子性前提）**仍存在不可验收或不可实现的语义空缺；B（family revocation 与 session 状态机的唯一可实现性）、D（SUBSCRIPTION_INVALIDATED 在空闲流的投递与去重序化）、E（upcaster 无 gap 断言与 signer key 撤销的交叉面）存在轻到中等语义不足。本轮发现的最高级别为 **P0 × 2**（A1 受管制清单无门禁谓词导致权限授予漏登记；A2 commit 点 epoch 复读的权威读前置未钉死），均直接落在授权完整性上；P1 × 4；P2 × 4。

按纪律， Deprecated 错误（旧包应用=有界传播陈旧、account 维度跨 session 聚合、不强制两种 transport、placement CAS 不需额外选举 等）本轮不再立案。

实现对照（`backend/services/authService.js`、`backend/middleware/authMiddleware.js`、`backend/routes/clientEventsRoutes.js`）：当前实现为单 JWT + `players.token` 存储的 sha256 hash 比对模型（`isStoredTokenMatch`），无 `credential_version`/`session_epoch`/`authz_epoch`/`refresh_family_id`/订阅 generation/visible_seq/持久 stream/`statusUrl`。这些落入 `IMPLEMENTATION_ONLY_GAP`，不参与本次规范判定。

---

## 2. V2_3_PATCH_CLOSURE_REVIEW（逐焊点裁决）

### 焊点 A — 授权线性化边界修订（原 FL-13）

#### A1. 受管制命令类清单的完备性 / 判定谓词（P0 / UNDER_SPECIFIED + UNTESTABLE）

被攻击条款：参考架构 §04 "授权线性化边界（撤销语义=读法 a）" implementation-note："以下受管制命令类别必须在领域事务 commit 点复核 epoch：支付/经济类、管理员操作、权限授予类（联盟任命、转让等）；这些命令在领域事务内重读 sessions 行..."

时间线/反例：
1. 发布 N：实现新增命令类型 `alliance.appoint_officer`（权限授予），未在受管制清单登记（清单为开放枚举，"…等"）。
2. 发布 N 起作用：该命令按"普通命令"处理——admission 时点 epoch 快照即线性化点；其撤销窗口仅由声明 SLO 与覆盖证据约束。
3. 管理员在 t0 撤销 victim 的某职位权限（`authz_epoch++`）；攻击者对 victim 的 admission 快照在 t0-ε 已落地（旧 authz_epoch）。
4. 该命令是权限授予属类但未登记 → 不做 commit 点复读 → 在 SLO 窗口内以旧 authz_epoch 提交，**权限授予越权成立**。
5. 受害补偿：只有"stale-commit 落在 SLO 窗口内并有 receipt admission 快照对比证据"——对一条本应受管制的越权授予命令，证据存在但门禁未拦下。

为什么现有文字挡不住：
- P4 声称 "envelope JSON Schema + receipt 状态迁移表 + CI mutation test" 是机器可检查制品，但**未把"受管制命令类别清单"列为 mandatory typed manifest field**，也未规定一条 predicate，能把任何"其执行效果给予/转移/撤销另一账号权限或动用平台资金或账号资金"的命令类型强制归入受管制类。
- "支付/经济类、管理员操作、权限授予类（联盟任命、转让等）"是描述性开放枚举，不是闭合判定式。
- 缺一可执行断言：`every command_type ∈ inventory.commandTypes whose semantics ⊇ {grant/transfer/revoke permission OR move platform/account funds} ⇒ command_type ∈ regulated set`。
- 漏登记后果即不是 release-gate FAIL（无门禁），也没有 IC-1 的 stale-commit 计数维度把"受管制命令 stale-commit = 0"区分为独立子指标。

分类：`UNDER_SPECIFIED`（方向正确但缺执行语义与谓词）+ `UNTESTABLE`（无判定器/CI mutation 能机械化拒绝漏登记）。严重度 **P0**：直接破坏授权完整性——权限授予越权是数据/资金/授权类直接破坏的第二层。

最小修订（必填 typed 化）：
- release manifest 新增 `regulatedCommandClasses: [{commandType, class, commitRecheckEpoch}]`，其中 `class ∈ {payment_economy, admin_operation, permission_grant}` 且至少 `permission_grant` 要求 `commitRecheckEpoch ∈ {authz_epoch, (必要时 session_epoch)}`。
- release gate predicate（M0 写入清单门禁 + P4 CI mutation test）：存在满足上述语义条件但未登记的 commandType ⇒ release REJECTED（`REGULATED_COMMAND_NOT_LISTED`）。
- IC-1 子断言：受管制命令 stale-commit 计数 = 0 **作为独立 reasonCode** `REGULATED_STALE_COMMIT` 旁开 `STALE_COMMIT_WITHIN_SLO`，便于判 FAIL/PASS 分流。

可执行验收证据：mutation fixture——在清单缺一条 `alliance.appoint_officer` 的合同时 release gate FAIL；admission-旧-epoch × commit 复读注入下该命令 stale-commit 计数 > 0 ⇒ IC-1 整体 FAIL。

#### A2. commit 点复读的"普通读即可"正确性前提未钉死为权威读清单项（P0 / UNDER_SPECIFIED）

被攻击条款：§04 "授权线性化边界"："这些命令在领域事务内重读 sessions 行（普通读即可，撤销写方提交后的下一次重读必见）并断言与 admission 快照一致..."

时间线/反例（READ COMMITTED + 读副本口径）：
1. 撤销写方（authz_epoch++）在主库 `sessions` 行提交。
2. 实现 B：commit 点"普通读"来自一条**只读异步副本**（lag=N），其 epoch 滞后于主。
3. 受管制命令领域事务已持锁 receipt/owner_leases/aggregate_heads，再从副本读得 `session_epoch` 仍为旧值 → 与 admission 快照一致 → 通过复读校验 → **越权授予提交**。

为什么现有文字挡不住：
- "撤销写方提交后的下一次重读必见"只在复读读的是**权威 sessions 行**且复读发生在撤销提交**之后**才成立。规范未指定复读的数据源层级（主库 vs 缓存 vs 副本）。
- §M1 已把 `statusUrl` 列入"权威读清单（M1 证据字段）"——这是一个先例，但**commit 点 epoch 复读没有同等列入权威读清单**。复读被当作"普通读即可"一笔带过。

分类：`UNDER_SPECIFIED`（缺线性化读断言）+ `UNTESTABLE`（无门禁可验副本 lag 是否破坏复读）。严重度 **P0**：复读失真直接让整个 FL-13 受管制 commit 点机制形同虚设。

最小修订：
- §M1 authority-read inventory 显式新增 commit-point epoch re-read（与 `statusUrl` 同列），要求复读必为对权威 `sessions` 主行的线性化读（`SELECT ... FROM sessions FOR SHARE/UPDATE` 或等价主库只读线性读），且与撤销写方竞争同一行——撤销先提交则复读见新 epoch。
- 任何副本 lag/staleness 声明对 commit 点复读一律 fail-closed，容许"声明最大 staleness"只对 `statusUrl`，不对 commit 点复读。
- §04 改述："普通读即可"必须以"复读发生在撤销写方提交之后且复读源为权威主库"为前提；若复读源可缓存，必须声明复读的 linearizability 等同于权威读。

可执行验收证据：副本 lag 注入 + 撤销 × 受管制命令交叉（IC-1 子集），断言每条复读未从副本取值的日志；复读源非权威 ⇒ FAIL。

#### A3. SLO 超限 fail-closed 的执行主体与证据未定义（P1 / UNTESTABLE）

被攻击条款：§04 "网关的 session/epoch 缓存条目年龄超过撤销 SLO 时一律 fail-closed 拒绝，不得以陈旧缓存放行。"

为什么 UNTESTABLE：执行主体是 gateway，但 §M5 退出门禁只验"撤销在声明 SLO 内使旧请求失效"（撤销传播）与 IC-1 stale-commit 矩阵；**没有一条 gate 直接测"gateway 缓存条目 age>SLO 时被拒绝"**。撤销传播快不快和 gateway 是否拒绝陈旧缓存是两件事：若 gateway 把陈旧缓存放行，撤销快也没用。

最小修订：IC-1 子断言——注入 gateway cache 的 `enteredAt > now - SLO` 状态后发起请求，断言拒绝 reason = `STALE_CACHE_AUTH` 且计数 == 尝试计数；否则整体 FAIL。

分类：`UNTESTABLE`（缺独立可测 gate）。严重度 P1（缺可观测证据，授权活性缺口）。

#### A4. AUTH_EPOCH_STALE 终态化与领域回滚的事务原子性未显式（P2 / UNDER_SPECIFIED）

被攻击条款：§04 "不一致即整体回滚并以 AUTH_EPOCH_STALE 终态化 receipt"。

时间线：若实现把"领域整体回滚"与"AUTH_EPOCH_STALE terminal 写入"分作两笔事务，回滚（T1 提交 rollback）与 terminal 写入（T2 commit）之间存在崩溃窗口——收据停在 `in_progress`，需要 recovery guardian 按 lease 到期收敛，不违反"领域已提交但收据非终态"，但增加无谓的 in-flight 留存与 IC-1 抽样成本。

为什么现有文字挡不住：句法允许同一事务解读，但未显式声明"在领域事务内回滚领域写 + 同事务提交 terminal receipt"——与 D1 的原子要求同源。

最小修订：§04 明文 "AUTH_EPOCH_STALE 终态写入与领域事务回滚在同一领域事务提交；领域写不落地，收据一次 CAS 到 `failed_final(AUTH_EPOCH_STALE)`"，并对齐 `command_receipts.status` 的 `rejected_final`/`failed_final` 子原因码。

分类：`UNDER_SPECIFIED`。P2（语义在概率可走通；显式化降低实现歧义）。

#### 焊点 A 裁决

| 子项 | 裁决 | 严重度 |
|---|---|---|
| A1 受管制清单无 typed 化与 gate predicate | UNDER_SPECIFIED + UNTESTABLE | P0 |
| A2 commit 点复读权威读前置未钉死 | UNDER_SPECIFIED + UNTESTABLE | P0 |
| A3 SLO fail-closed 无可验收 gate | UNTESTABLE | P1 |
| A4 AUTH_EPOCH_STALE 同事务原子性未显式 | UNDER_SPECIFIED | P2 |

---

### 焊点 B — refresh family 修订（原 FL-14）

#### B1. family revocation × session 状态机的唯一可实现性（P1 / UNDER_SPECIFIED + borderline UNTESTABLE）

被攻击条款：§04 "Session / refresh 状态机"implementation-note："refresh family 语义钉死为 per-device：每个设备 session 一个 refresh_family_id，refresh token 采用 family + rotation CAS，旧 refresh 重放撤销该设备 family 并递增该 session 的 session_epoch（撤销半径=单设备，不触发全账号踢出）。sessions 表持有双 hash 列 access_token_hash 与 refresh_token_hash，各自 UNIQUE。… 多设备迁移矩阵：… 单设备登出、refresh 重放、设备策略拒绝 → 该 session_epoch++（单设备失效）…"

反例（两种同样满足文字的实现）：

- 实现 X（最小化实现）：refresh 重放探测后，对该 session 行做 `session_epoch = session_epoch + 1` 单条 CAS；`access_token_hash`/`refresh_token_hash` 沿用；`state` 保持 ACTIVE；不再有"family 撤销 flag"。每次请求/stream HELLO 都校验 `session_epoch`——旧 access token 失效、旧 refresh 因 hash 比对不再匹配 → 单设备半径达成。状态机 `ACTIVE→REVOKING→REVOKED` 基本闲置。
- 实现 Y（双机制实现）：refresh 重放既 `session_epoch++` 又 `state: ACTIVE→REVOKING→REVOKED`（两段式线性化点不清晰：是 bump 时进入 REVOKING 还是 CAS 完成 REVOKED 时？），并显式标记 `family_revoked=true`。

两种实现都满足"撤销该设备 family 并递增该 session 的 session_epoch"的字面，但 §§ 语义后果不同：
- 实现 Y 的两段式状态机为本应是 single-device 即时失效的 refresh 重放引入了一个中间态 REVOKING——"撤销写方提交后的下一次重读必见"是否在 REVOKING→REVOKED 完成前就生效？文字未约束。
- "family 撤销"也未落到任何列（无 `family_revoked_at`、`family_state` 字段），唯一的状态字段是 `state`，而 §§ 又规定"ACTIVE→REVOKING→REVOKED"——所以"family 撤销"是否 = `state→REVOKED` 未定。

授权是否有泄漏？无。`session_epoch` 在每请求/stream HELLO 中被校验，bump 后旧 access token 的下一个请求会被拒（携带旧 envelope epoch），不会拿到新明文。所以 B 焊点的**正确性闭合**——其半径由 epoch 校验提供——但**唯一可实现性**不闭合：实现 X/实现 Y 均合规，不能确定哪种是规范化路径，也无法机械化证否另一种。

为什么现有文字挡不住：
- 给了 epoch bump 路径（保证正确性）+ 状态机（保证语义层），但未给定**哪个操作触发哪条/多条变化**的决策矩阵（既 bump 又转 state？只 bump？转 state 决定 revoke？）。
- "撤销该设备 family"是一个独立语义却无承载列。

最小修订：
- 增加 receipt 级决策矩阵表格：每一类操作（`password_reset`、`single_logout`、`refresh_rotation`、`refresh_replay_detected`、`device_policy_reject`、`role_change`、`permission_revoke`）映射到 `(credential_version, session_epoch, authz_epoch, session.state, access_token_hash 是否 wheel)` 的确定变化集合。
- 显式声明 **family 的单写者与线性化点**：建议 `refresh_family_id` 绑定到 session 行，refresh rotation 是同 Family 内 `old_hash → new_hash` 的单行 CAS，replay 检测后线性化点 = "对 session 行做 `refresh_token_hash` 失效 + `session_epoch++` 的同一 UPDATE 影响行数=1"，无 REVOKING 中间态。
- 或显式说明：状态机 `ACTIVE→REVOKING→REVOKED` **只用于显式告退与设备策略拒绝**，refresh replay/rotation 路径不使用 REVOKING 中间态，避免二义。

可执行验收证据：mutation fixture——实现 X 任意实现按"语义表"对照均不通过二义矩阵判 FAIL；refresh replay × 不切到 REVOKING 中间态注入 ⇒ 网络 stale-commit = 0 且 family 内下一 refresh definitively fail。

分类：`UNDER_SPECIFIED`（缺决策矩阵与线性化点）+ 部分 `UNTESTABLE`（无 gate 判多实现唯一）。严重度 P1（授权半径正确，但唯一可实现性 gap）。

#### B2. refresh rotation 是否同发新 access token 未定（P2 / UNDER_SPECIFIED）

被攻击条款：§04 refresh family 段仅规定 refresh token 走 family + rotation CAS；不提 access token 是否跟随轮转。

时间线：若 refresh 仅换 refresh_token、access_token 不变，access token 长寿命（当前实现 `expiresIn: '30d'`），且 access_token_hash 只在登录时更新——`sessions.access_token_hash UNIQUE` 在不动 access token 的轮转下不会冲突，但在多 refresh 轮转之间，access token 的生命周期覆盖多次 refresh 不变。当前实现 `authService.generateToken` 的 `sessionId` 是每次 login 唯一 nonce，refresh 不在当前实现中存在，无法反推规范意图。

为什么挡不住：标准 OAuth refresh 通常同时发新 access token；规范未声明，两种实现（refresh-only rotation / refresh+access rotation）都合规。

最小修订：§04 显式声明 refresh rotation 的同事务原子输出集：`{refresh_token_hash: new, access_token_hash: new (or unchanged), session_epoch: unchanged}`，并要求 `access_token_hash` 至少在 `credential_version` bump 或 access-token-shortTTL 路径上重发，与每请求 epoch 校验无矛盾。

分类：`UNDER_SPECIFIED`。P2。

#### B3. 多设备迁移矩阵本身（P0 候选 →确认为 CONFIRMED_SPEC_CLOSURE）

`credential_version++`（全设备）/`session_epoch++`（单设备）/`authz_epoch++`（账号级不踢会话）三类 epoch 与操作的映射在矩阵中唯一清晰，且每请求/stream HELLO 都校验三类 epoch。授权半径由此机制兜底。**CONFIRMED_SPEC_CLOSURE**。

#### 焊点 B 裁决

| 子项 | 裁决 | 严重度 |
|---|---|---|
| B1 family revocation × 状态机唯一可实现性 | UNDER_SPECIFIED + 部分 UNTESTABLE | P1 |
| B2 refresh 是否同发 access token 未定 | UNDER_SPECIFIED | P2 |
| B3 多设备 epoch bump 矩阵 | CONFIRMED_SPEC_CLOSURE | — |

---

### 焊点 C — filtered stream 修订（原 FL-19）

#### C1. source 提交与 visible_seq 映射写之间的原子性未定 → 崩溃续传不可验收（P1 / UNTESTABLE，部分 borderline 不可实现）

被攻击条款：§04 "授权过滤与旧包"段落："visible seq 采用持久化路径（二选一已钉死）：filtered stream 的 visible_seq → source event_id 映射行与 visible_head_seq 在授权过滤投影事务中同事务持久化，服务端崩溃后从持久映射续传，不做基于权限历史的确定性重算——P5 的续传承诺由此在 filtered 流上可验收。"

反例（下游独立事务实现）：
1. t1：领域事务提交 source event E（`stream_events` 行确认）。
2. t2（同事务后的下游"授权过滤投影事务"）：要为每个受订阅客户端把 (visible_seq, source_event_id) 写入映射行。
3. t1 与 t2 之间发生服务端崩溃（power loss / 进程 kill -9）。
4. 重启后，E 的 source seq 已永久落地，但映射行不存在。
5. 续传只能两条路：
   - a) 从持久映射续传 → 这条 source event 对该客户端 stream **没有 visible_seq** → 客户端 stream 在 visible_seq 上留下永久 gap，违反 `stream_events` 表注释"授权过滤后的客户端 stream 必须具有自身连续 visible seq，不能让不可见源事件制造客户端 gap"；
   - b) 从权限历史对 E 重算映射 → 规范明文禁止"不做基于权限历史的确定性重算"。

为什么现有文字挡不住：
- "授权过滤投影事务"是一个独立事务的命名，未声明它是 source 领域事务的**同一**事务。在多订阅广角下，把 O(watchers) 个客户端映射写入每条领域事务中代价巨大——规范显然不意图如此。从上下文与单写者成本面看，这必然是**下游**事务，但规范不写明，反而使"服务端崩溃后从持久映射续传"承诺产生被禁止的不可重算 crash gap。
- 在 invisible event 的补充语义上，`stream_events` 表注释要求客户端 stream 不能因被过滤的 source event 产生 visible_seq gap。若 invisible event 应被跳过但 visible_seq 仍需保持 dense——下游事务延迟/丢失不影响 invisible（它们本不产生 visible_seq），影响的是 visible event 的可见性追溯。
- 因此该 gap 的真实后果不是 invisible gap，而是 visible event 的映射在生产后丢失、续传无法补回（因为权限历史不能再投）。

最小修订（择一）：
- (i) 显式声明 filter projection 写入与 source event 提交处于**同一领域事务**（同事务），并认下 O(watchers) 写放大成本；或
- (ii) 定义 fallback：映射缺失的 committed source event 由"投影 consumer"在恢复时以**该 source event committed_at 时刻权威的 permission snapshot**（已一同持久化）重写映射，并显式把这条路径从"基于权限历史的确定性重算"中剥离——这要求规范把 permission snapshot 与 source event 同事务持久化，等同于做线下 deterministic 重投，但与现有"不做权限历史重算"的禁令需重新措辞。
- 无论如何，必须给出崩溃后续传可验收路径：fixture——source 提交后立即崩溃、accessible consumer 重启，断言每个原本可见的 visible event 的映射都存在或被该 fallback 续上，visible_seq dense 成立。

分类：`UNTESTABLE`（崩溃续传承诺无可验收路径）+ borderline `UNDER_SPECIFIED`。严重度 **P1**（触及客户端可见连续性 + P5 续传承诺不可验收；**非** authoritative 数据丢失，故非 P0）。

#### C2. 侧信道预算不可测（P2 / UNTESTABLE）

被攻击条款：§04 "filtered/AOI 客户端流的 envelope streamSeq 一律是 visible seq；source stream 的序号不得出网，只作为服务端审计元数据。visible seq 采用持久化路径…"

为什么 UNTESTABLE：
- "source seq 不出网"是一个信息隐藏断言，但 v2.3 未提供任何可测的侧信道预算度量（timing gap、payload size 与被过滤事件的相关性、ACK 时延与 source event 密度的相关性）。
- visible_seq 虽对 dense 序列无内部 gap，但 `committed_at` 时间戳对客户端可见——客户端仍可能从 visible event 的 timestamp 间隔推断 source 端被过滤事件的密度。
- 没有 §容量合同 gate 衡量"最大可推断侧信道 metric"。

最小修订：在 §容量合同 §workload.shape 或 §W5 AOI 之外新增 `filtered_stream.side_channel_budget`，含可见事件 committed_at 抖动下界、payload 字段集合白名单、以及 mutation fixture：构造 high-density source 事件中按概率过滤，断言任何可见 envelope 字段与"过滤前 source density"在统计意义下相关度不超阈值。

分类：`UNTESTABLE`。P2（信息隐藏断言缺可测证据，无直接授权泄漏）。

#### 焊点 C 裁决

| 子项 | 裁决 | 严重度 |
|---|---|---|
| C1 source 提交与 visible_seq 映射原子性未定 → 崩溃续传不可验收 | UNTESTABLE + UNDER_SPECIFIED | P1 |
| C2 侧信道预算不可测 | UNTESTABLE | P2 |

---

### 焊点 D — SUBSCRIPTION_INVALIDATED 控制事件（原 FL-18 残余）

#### D1. 控制事件自身需不需要序化（visible_seq / permissionEpoch 标签）、去重序化（P2 / UNDER_SPECIFIED）

被攻击条款：§04 "授权过滤与旧包"段："服务端主动收缩权限后，必须在受影响的 ordered stream 上发送 in-band SUBSCRIPTION_INVALIDATED 控制事件（活性与缓存卫生要求，不是泄漏门禁）：客户端收到后失效本地缓存并以新 generation 重订阅；空闲流也必须能在撤销 SLO 内收到该事件。"

反例：
1. 同一次权限收缩发出 SUBSCRIPTION_INVALIDATED 经 outbox/stream 至少一次投递。
2. relay 层重投（at-least-once）使客户端收到两次 SUBSCRIPTION_INVALIDATED。
3. 两次之间无其他事件——客户端做两次"失效本地缓存 + 以新 generation 重订阅"，generation 跳两段。
4. 在两次之间发生**第二次**权限收缩（新 epoch）但仅生成一条新 SUBSCRIPTION_INVALIDATED D2，D1 的第二次重投在 D2 之后到达——客户端有 (SUBSCRIPTION_INVALIDATED@e1 dup-1) (SUBSCRIPTION_INVALIDATED@e1 dup-2) (SUBSCRIPTION_INVALIDATED@e2) 三条。
5. 若控制事件不含 `permissionEpoch/new_generation` 标签，客户端无法判 dup 是 e1 还是 e2 的延续——可能把 e2 当 e1 dup 忽略，错过 e2 触发的缓存失效。

为什么现有文字挡不住：规范未要求 SUBSCRIPTION_INVALIDATED 携带 (streamKey, new permissionEpoch, new generation) 的去重标签；in-band 控制事件未说是否落 visible_seq；relay at-least-once 重投是 §domain bus 既有语义。

最小修订：
- SUBSCRIPTION_INVALIDATED 需携带 `permissionEpoch` 与 `newGeneration`；客户端按 `(streamKey)` 保持 `lastAppliedGeneration`，小于等于则幂等忽略，大于则更新并重订阅。
- 在 ordered stream 上该控制事件必须占用一个 visible_seq（或独立 control_seq 跟随同一 monotonic 链），便于复读级幂等。

分类：`UNDER_SPECIFIED`。P2（无授权泄漏，存在序化歧义）。

#### D2. 空闲流投递语义在"无连接"传输下未闭合（P1 / UNTESTABLE）

被攻击条款："空闲流也必须能在撤销 SLO 内收到该事件。"

为什么 UNTESTABLE：
- 若 stream 是长连接（WS / SSE）已断开且客户端空闲，没有"在线"投递通道；事件只能落在该 stream 的 retention 内等待下次 HELLO/resync 时补推。规范未规定该 buffering 通道（哪张表？多长 bound？谁 GC？）。
- HTTP fallback 每次 ping–poll，若 idle 客户端不发轮询，根本不存在 SLO 内的到达保证。
- 当前实现 `clientEventsRoutes.js` 仅做 `/api/client-events` 采集，无 stream HELLO 概念，无法反推。

为什么现有文字挡不住："in-band 控制事件 + ordered stream + retention"——但 ordered stream 是消费契约，不是 push 契约；当客户端未订阅（idle）时，事件落进 stream retention 内，相比"SLO 内到达"是延迟而非即时；规范的"到达"语义不清。

最小修订：
- 区分"投递到 stream retention（服务端已落库）"与"客户端接收"两层；SLO 应绑定**前者**（服务端侧控制事件已入 retention 并 ≥ 该 subscription 当前 visible_head_seq 范围）。
- 之后客户端重连 HELLO 时 MUST 接收到 backlog 中的 SUBSCRIPTION_INVALIDATED；补推机制持久化到 `stream_subscriptions` 行的 `invalidation_pending_from_seq` 或类似列。

分类：`UNTESTABLE`（"到达 = 落 retention 还是送达客户端"未定，无可验 gate）。P1（liveness/缓存卫生断言缺可验路径）。

### 删除"传递授权泄漏"项——按纪律
权限收缩**前**发出的在途帧属不可避免窗口，应用=有界传播陈旧（SLO 约束），不是授权泄漏（已在第三轮裁决中明确）。SUBSCRIPTION_INVALIDATED 把 generation 推进的边界划在该事件本身——old-gen 后续帧将被 drop——此边界**是闭合的**，本次不再以"撤销瞬间还有 in-flight 旧 gen 包"立案（FACT_ERROR 风险）。

#### 焊点 D 裁决

| 子项 | 裁决 | 严重度 |
|---|---|---|
| D1 控制事件去重标签 / 序化未定 | UNDER_SPECIFIED | P2 |
| D2 空闲流 in-band 投递语义未闭合 | UNTESTABLE | P1 |

---

### 焊点 E — statusUrl 一致性声明 + 未知 event type + upcaster 无 gap（原 FL-15 / FL-21）

#### E1. statusUrl "最大 staleness"声明位置未钉死（P2 / UNDER_SPECIFIED）

被攻击条款：§03 D1 implementation "状态查询是未知 COMMIT 的唯一客户端恢复路径，必须线性化读权威库或显式声明最大 staleness，并列入权威读清单（M1 证据字段）。"

为什么挡不住：声明 staleness 的承载载体未约束——若实现只写在运行时配置文件而不进 release manifest，则一份 release 在不同环境可以声明不同 staleness，与 §release identity 锁定的"统一兼容矩阵"不一致。

最小修订：release manifest 必填 typed 字段 `statusUrl.maxStalenessMs`（缺省 = linearizable-equivalent sentinel `{ Line: 0 }` 或 `null`），并与 §capacity reliability gate 关联：若声明非 null，则必须提供其对应证据（读副本 lag p99 ≤ 该值），否则该 release 的 `statusUrl` gate NOT_PROVEN。

分类：`UNDER_SPECIFIED`。P2（默认线性化是安全的）。

#### E2. 未知 event type 默认 SKIP_AND_RESYNC 行为，但 SKIP 与 cursor 推进的时序未明示，deprecation 路径未定（P1 / UNDER_SPECIFIED）

被攻击条款：§04 兼容矩阵 Client Protocol 行："未知字段和未知 event type 的行为逐类型定义，未登记类型的默认行为=SKIP_AND_RESYNC（跳过该事件并对该 stream 请求 resync/snapshot，不得盲目应用或静默丢弃后前移 cursor）；新 event type 上线必须先在兼容矩阵登记其 unknown-behavior，未登记即 release gate 拒绝。"

反例：
1. 客户端遇到未知 event type E@seq=K。按 SKIP_AND_RESYNC，"跳过该事件"但"不得前移 cursor"。
2. 此时 cursor 卡在 K-1，客户端发 resync 请求；服务端按当前 `committed_seq`（≥ K）给 snapshot。
3. snapshot 把 cursor 推到 ≥ K 之后，但当 snapshot 包含 E 的等效 authoritative 视图变化（E 是个仍有效的控制事件），客户端如何得知 E 已经"已发生且被服务端 dropped/skipped"？规范未规定 SKIP 的客户端 result code 与 resync 的 watermark 协议字段。

deprecation：若新 release 把一个旧 producer event type **移除**（不再生产），跑在新 producer 之上的旧 consumer 不会收到——"未知 event type" 行为只在收到未知帧时触发；deprecate 不在矩阵的可测面，缺乏 release gate predicate："新增 event type 必登记的 inverse：移除 event type 必给出 deprecation_at 与旧 client 行为"。

最小修订：
- §04 显式 SKIP_AND_RESYNC 三步协议（reason code：`UNKNOWN_EVENT_TYPE`、resync watermark ≥ K、客户端将 cursor 设为 watermark）。
- Release manifest 的 event schema block 增加 `deprecation_at`/`supersededBy` 字段；release gate predicate：每条 removed event type 必须有这些字段，否则 release REJECTED。

分类：`UNDER_SPECIFIED`。P1（旧客户端在新 release 后的连续性断裂面）。

#### E3. upcaster 无 gap 断言 × signer key 撤销的交叉面（P2 / UNDER_SPECIFIED）

被攻击条款：§04 兼容矩阵 Event Schema 行："upcaster 覆盖下界断言：从所有 stream 中最早 retained 的 schema_version 到当前 producer_version 的 upcaster 链无 gap，否则该 release 不可切换。" + §恢复 "signer key lifecycle"："撤销对已签名的 manifest 在已部署实例的效力边界；rollback 目标（vN-1）若由被撤销密钥签发，须在 rollback 路径可用前重签。"

时间线：
1. 历史 release R30 的 event schema produce_version=6，upcaster 集合 U6→7 signed by key K_q3。
2. 现 release R40 produce_version=7，最早 retained schema_version 因 retention 已推进到 5，需要的 upcaster 链为 U5→6→7。U5→6 来自 R20，签发于 K_q2；K_q2 已被撤销。
3. signer key lifecycle 文本仅承诺把"rollback 目标 manifest 重签"——upcaster 制品未被列入必须重签的清单。
4. R40 上线时进行 upcaster 无 gap 断言 → U5→6 不可验签 → 该 release 不可切换。但若已切换到 R40 后 retention 再前推至 schema_version 5，未来 release R50 切换前才发现 gap。

为什么现有文字挡不住：signer key lifecycle 是 release/restore 签名 key 维度的，**未扩展到 upcaster 制品**——upcaster 本身是 typed 制品（artifactSchema），但其签名/验签 trusts 的 lifecycle 与 manifest key lifecycle 是同一根还是独立未定。

最小修订：§signer key lifecycle 显式扩展："upcaster 集合制品与 release manifest 共用或分别声明其 signer key lifecycle；被撤销的 key 签发的 upcaster 制品在被可用前必须重签（与 rollback manifest 同等待遇）"。release gate predicate：在断言 upcaster 无 gap 时，必须逐条验签每个 upcaster 制品的签名 key 仍在 not_after 重叠窗口内。

分类：`UNDER_SPECIFIED`。P2（release 切换可 operability 影响面）。

#### 焊点 E 裁决

| 子项 | 裁决 | 严重度 |
|---|---|---|
| E1 statusUrl staleness 声明位置未钉死 | UNDER_SPECIFIED | P2 |
| E2 SKIP_AND_RESYNC 三步协议与 deprecation 路径未明示 | UNDER_SPECIFIED | P1 |
| E3 upcaster 无 gap × signer key 撤销 交叉面未闭合 | UNDER_SPECIFIED | P2 |

---

## 3. CONFIRMED_CLOSURES

以下 v2.3 协议/安全面条款已达到足以实现与验收的闭环，本轮确认：

- **C-A-read-law(a)** 读法(a) 授权判定线性化点 = admission 时点三类 epoch 快照写入 `command_receipts`——admission 事务内单一可定位的 linearization 点明确；后续领域事务回读的对照锚点列存在；M1 退出门禁要求"每条 accepted receipt 的三列 admission epoch 快照非空且等于 admission 时点 sessions 行的权威值（抽样比对可复核）"。**CONFIRMED**（前提按 A2 加入权威读清单项后成立）。
- **C-A-normal-class SLO window**：普通命令在 SLO 窗口内以旧 epoch 提交属声明内行为，须有 stale-commit 证据计数——IC-1 ×100 交叉矩阵 × 矩阵声明双判据路径已可验收。**CONFIRMED**。
- **C-A-matrix-bump**：三类 epoch 与操作的 bump 矩阵（`credential_version++` 等于全账号失效，`session_epoch++` 单设备失效，`authz_epoch++` 账号级权限不踢会话）+ 每请求/stream HELLO 校验三类 epoch——授权半径由此机制兜底，矩阵本身唯一可实现。**CONFIRMED**（B3）。
- **C-B-radius**：refresh family per-device 半径——"撤销 radius = 单设备"语义清晰，跨账号踢出不会由 refresh replay 误触发。**CONFIRMED**（正确性半径层面）。
- **C-D-invalidation-boundary**：SUBSCRIPTION_INVALIDATED 自身在 ordered stream 上划 generation 推进边界，旧 generation 续发帧由客户端 drop——撤销前 in-flight 的旧 gen 帧属不可避免窗口（纪律明确不算泄漏），撤销后续新帧由发射侧"当前权威状态 ∩ 当前可见权限"过滤。**CONFIRMED**（边界性正确，按 D1 强化去重标签后唯一可实现）。
- **C-P3-stable-retry**：`statusUrl` 是未知 COMMIT 唯一客户端恢复路径，复用原 `commandId`；网络幂等仅处理重投，奖励/支付/占领/入盟仍需 domain business key/constraint。**CONFIRMED**。
- **C-P4-one-mechanism**：一种状态应用机制 + 多条独立 stream；ACK 不写 projection、`resultVersions` 禁入 projection；允许多条独立 stream，禁止 ACK patch 与 EVENT patch 竞争覆盖。**CONFIRMED**。
- **C-P5-per-stream-resume**：per-stream cursor/head/retainedFrom/gap 独立；慢流不阻塞他流恢复；跨 stream UI 关联以 `commandId` 为隐式 barrier，无跨 stream 原子可见性。**CONFIRMED**。
- **C-P6-committed-watermark**：snapshot 用 per-stream `stream_heads.committed_seq` 切；`published_at` 不是 cut；snapshot 仅保证 per-stream 各自与 watermark 精确衔接，不承诺跨 stream 一致 cut。snapshot builder 单 `REPEATABLE READ` 只读事务一致切面读取。**CONFIRMED**。
- **C-P9-heartbeat**：PING/PONG 只维护连接、serverTime、presence TTL；不得 1Hz 加载完整玩家状态/地图/源码 hash。**CONFIRMED**（与 H1 gate 联动）。
- **C-P11-transport-equivalence**：只审产品实际启用 transport 的等价语义；不强制为验收实现第二种 transport。**CONFIRMED**（按纪律）。
- **C-P12-account-aggregation**：P12 按维度各自独立计量执行；account 维度按定义跨 session 聚合；"多 session 分桶绕过"是实现错误不是规范许可。**CONFIRMED**（按第三轮纪律）。
- **C-FL-21-default-SKIP**：未知 event type 默认 = SKIP_AND_RESYNC，不得盲目应用或静默丢弃后前移 cursor；新 event type 必须先在兼容矩阵登记 unknown-behavior，未登记 release gate 拒绝。**CONFIRMED**（默认行为层面；E2 仅补 SKIP_And_Resync 三步协议与 deprecation 路径）。
- **C-session-buffered-cache**：网关 session/epoch 缓存项年龄 > SLO 应 fail-closed 拒绝——规范意图**CONFIRMED**，但 A3 指出缺独立可测 gate，故仅"规范意图"闭合而"可验收"未闭合。
- **C-snapshot-builder-RR**：snapshot builder 在单 `REPEATABLE READ` 只读事务内读取全部相关 `stream_heads` 与 payload（不采用 cut marker），保证 per-stream watermark 与数据同切面——切面机制唯一可实现。**CONFIRMED**。

---

## 4. SESSION_AND_REFRESH_ATTACKS

### S1. credential_version bump × stream HELLO 手无证据 propagation gate（B3 / 确认 radius 后）
不必立案为新 P0：矩阵已闭合。下方仅列**已发现的剩余攻击点**。

### S2. session_epoch bump 单设备，但 stream_subscriptions 是否同步送新 epoch 未钉死（P1 / UNDER_SPECIFIED）

被攻击条款：§03 `stream_subscriptions` 表 `(session_id, subscription_id)` 持有 `generation, permission_epoch`；§refresh family "每次请求和 stream HELLO 必须同时校验三类 epoch"。

反例：单设备 `session_epoch++` 由 session service 写 `sessions.session_epoch`；但已存在的 `stream_subscriptions` 行 `permission_epoch` 不与之联动递增。客户端 HELLO 携带旧 session_epoch 与旧 subscription generation——若实现只在 `sessions` 行校验，`stream_subscriptions` 行的 `permission_epoch` 仍为旧，订阅层重用旧 permission epoch 继续投递（如订阅层独立缓存于 gateway），单设备撤销未及时穿透到 stream layer。规范未规定 `session_epoch++` 时受影响 `stream_subscriptions` 行是否被刷成 STALE 状态或驱使下一次 HELLO 必重订阅。

最小修订：`session_epoch++` / `authz_epoch++` 必须级联把所有同 account 的 `stream_subscriptions.state` 转 STALE 或触发受影响的 ordered stream 上发 SUBSCRIPTION_INVALIDATED；release gate 断言：撤销注入后受影响 subscription 在 SLO 内要么收到 SUBSCRIPTION_INVALIDATED 要么 `state=STALE` 阻止继续投递。

分类：`UNDER_SPECIFIED`。P1（撤销穿透 stream layer 不可验）。

### S3. credential_version 全设备失效 × 持久化 stream cursor 恢复（P1 / UNDER_SPECIFIED）

被攻击条款：§04 矩阵"密码重置/凭据泄露 → credential_version++（全设备失效）"+ §P5 per-stream resume。

反例：客户端崩溃重启后，按 §M5 "持久化的 pending commandId 全部收敛到唯一终态归属"且按 P5 以 per-stream cursor resync 自动恢复其上次 cursor。但若该账号在客户端崩溃期间发生 `credential_version++`（全设备失效），客户端仍持有旧 credential_version 的持久化 cursor 与 stream_subscriptions 状态——按 P5 自动 resync 时，stream service 校验 session 的 credential_version（session.service 已置新），客户端的 subscription 仍欲以旧 credential_version+旧 cursor 接续当前 stream。规范未规定"credential_version bump ⇒ 客户端必须重 bootstrap 并丢弃旧 per-stream cursor"，或反之"cursor 可保留但 subscription 必使新 credential_version 进行再校验"。

最小修订：§M5 显式"credential_version bump ⇒ 客户端必须重新走 session/bootstrap 流程；旧 per-stream cursor 与 subscription 行在新 session 上不再有效；stream service HELLO 校验携带的 credential_version 与当前 sessions 行不匹配 ⇒ 拒绝 resync 并要求 fresh bootstrap"。

分类：`UNDER_SPECIFIED`。P1（全设备失效与 per-stream resume 的交叉面）。

### S4. 双 token hash 列 UNIQUE × rotation 冲突断面（P2 / UNDER_SPECIFIED）

被攻击条款：§03 sessions 行 "access_token_hash 与 refresh_token_hash 各自 UNIQUE"。

反例：若同一 server 复用同一 PRNG 输出空间，**新 access_token_hash** 与 **既有 refresh_token_hash** 字节串冲突极低概率但 UNIQUE 约束把"access / refresh 同 row 上互相冲突"也禁止——表设计未声明这两个 UNIQUE 是否同 row 独立。
另外若某次 session 中 access_token = refresh_token（实现 bug），两个 hash 列值相同但都 UNIQUE 在同一行内通常允许（PG UNIQUE 不跨列拒）。规范未声明同一 session 行内 `access_token_hash` 与 `refresh_token_hash` 必须不相等。

最小修订：§03 sessions 行明示 `CHECK(access_token_hash <> refresh_token_hash)` 与两 UNIQUE 各自独立索引的语义；rotation CAS 模板示例。

分类：`UNDER_SPECIFIED`。P2。

---

## 5. COMMAND_AUTHORIZATION_AND_PENDING_STATE_ATTACKS

### A1（重复立案点，见焊点 A）——受管制命令漏登记即 P0。

### A2（重复立案点）——commit 点复读权威读前置 P0。

### PS1. plan_attempt 重规划 × admission 三类 epoch 快照是否需复 snapshot（P1 / UNDER_SPECIFIED）

被攻击条款：§Implementation-note §03 命令状态机 + 命令状态机说明："执行者以 CAS 写入 `IN_PROGRESS(execution_token, execution_lease_until)`… plan_attempt 只能经 receipt 行上带 status/execution_token 前置谓词的 CAS 单调递增。执行阶段发现未声明 owner 时不得临时补锁；事务回滚，旧 plan 标记 superseded，重新授权并以同一 commandId 生成新 execution plan。"

反例：execution 阶段发现动态 owner，整体回滚——并把 plan_attempt 推进生成新 plan。此时三类 admission epoch 快照是否需要在新 plan 中**重新 snapshot**？规范未明确。若复用旧 admission snapshot（旧 epoch），新 plan 的 owner 授权可能在 SLO 窗口内已发生权限收缩，新 plan 仍按旧 snapshot 提交——对**受管制**命令，commit 点复读会拦下；对**普通**命令，新 plan 仍以旧 snapshot 提交并在 SLO 内 stale。

虽然"普通命令 stale commit 在 SLO 内属声明内行为"是确认的，但**重规划的 stale-commit 是否记入同一 commandId 的 stale-commit 证据计数**未明确——若命令 N 次 plan_attempt，每次都 stale commit，每条都计入 stale-commit 计数，证据计数会被多次失败的同一 commandId 推爆，可能掩盖"撤销窗口过宽"实际问题。

最小修订：§IC-1 子断言——同一 commandId 多次 plan_attempt 的 stale-commit 计数按"去重 commandId"聚合（max-over-attempts），并外加独立指标"per-command plan_attempt 重规划次数"上限。

分类：`UNDER_SPECIFIED`。P1（撤销证据计数的去重）。

### PS2. statusUrl 读到的"未终态但在 progress"是否要等到 terminal 才返回（P2 / UNDER_SPECIFIED）

被攻击条款：§P3 + §03 receipt 状态机注释："A status query never advances state and is the only client recovery path for unknown COMMIT"。

反例：客户端查询 statusUrl 看到 `in_progress`（lease 未过期）→ 不知是否要继续等。规范未规定 statusUrl 对 `in_progress` 的最大返回时延与"何时该放弃转新 commandId"——这是客户端 UX 层面规范缺。

最小修订：§P3 子段——statusUrl 返回包含 `leaseUntil`、客户端 retry 间隔策略、超过 `2 × lease_until` 仍未终态时建议改为新 commandId（与 `restore_reconciled` 后的 `failed_final` 兼容）。

分类：`UNDER_SPECIFIED`。P2。

### PS3. 客户端持久化 pending commandId 与命令唯一性跨崩溃（P0 候选 → 确认 CONFIRMED）

按 §M5 "客户端崩溃重启后，持久化的 pending commandId 全部收敛到唯一终态归属，不产生重复提交"——规范已闭合；不立案。

---

## 6. STREAM_SNAPSHOT_AOI_ATTACKS

### ST1. 同 §C1（重复点）——filtered stream 崩溃续传原子性 P1。

### ST2. AOI permission_epoch bump × stream_subscriptions 行的级联（同 S2）

### ST3. snapshot build 触发与 stream retention 边界的并发 race（P2 / UNDER_SPECIFIED）

被攻击条款：§03 `player_read_snapshots`："snapshot + seq>watermark 的事件必须精确重建。"

反例：snapshot builder 跑在 `REPEATABLE READ` 只读事务读 heads 和 payload，但在 builder 读 watermark 与该 snapshot 实际生效期间有新事件提交并进入 retention——客户端拿到 snapshot 后 watermark=W，事件 seq>W 应被推送给客户端。但若客户端在被推送 seq>W 期间出现 retention 推进（cursor 后被旧客户端未确认的事件被裁），seq > W 的某些可能已不在 retention——P5 per-stream resume 必须能从 retention 之外（snapshot 重建）补全。规范未明示"snapshot + seq>W" 若 seq 出 retention 的 fallback（再 snapshot）路径被无限循环风险。

最小修订：snapshot 行增加 `retained_from_seq` 快照字段，明确客户端出现 retention 已丢的 seq → 必须重新走 snapshot 而非 cursor resume，且 server 返回 `SNAPSHOT_REQUIRED` 理由 code = `RETENTION_LOST`，避免客户端盲重试。

分类：`UNDER_SPECIFIED`。P2（边界 race）。

### ST4. AOI 取消时旧包不被应用 vs. "撤销 emit"二者并发（确认 C-D-invalidation-boundary 后不立案）

按纪律，AOI 取消时旧包到达属不可避免窗口——以 generation/permission_epoch 拒绝应用即可，撤销后的新帧才需发射侧过滤。**FACT_ERROR 误判风险**，确认为 CONFIRMED。

---

## 7. VERSION_TRANSPORT_AND_RESOURCE_ATTACKS

### VR1. 版本矩阵中的 send_version 与 HELLO 携带 sessionEpoch 同时校验，缺两者优先级（P2 / UNDER_SPECIFIED）

被攻击条款：§04 版本矩阵 + §04 Session/refresh："每个请求及 stream 建连校验。"

反例：客户端发的 envelope `protocolVersion=4` 但 `sessionEpoch=19` 与 server 现 sessionEpoch=20 不匹配——server 拒绝时回 reason 应是 `STALE_SESSION_EPOCH` 还是 `UNSUPPORTED_PROTOCOL_VERSION`？规范未规定这两类 reject 的优先级，影响观测/客户端 UX 与 release gate 的 reason 分类。

最小修订：§04 显式拒绝原因顺序：epoch 校验 → permission 校验 → protocol 兼容 → ... ；不同 reject reason 进入不同渠道，便于 metrics 分桶。

分类：`UNDER_SPECIFIED`。P2。

### VR2. P12 字段深/decompression 大小预算可行度量（P1 / UNTESTABLE）

被攻击条款：§P12 "body 深度/解压后大小限额"。

为什么 UNTESTABLE：解压后大小限额（zip bomb 防御）需要一个可执行度量——压测中实际膨胀比与解压 CPU 占比。规范未规定该度量的 gate 与 threshold 来源。当前实现 `clientEventsRoutes.js` 直接 `JSON.parse` 无解压面，但日志 ∈ IMPLEMENTATION_ONLY_GAP：路径存在但未配预算度量。

最小修订：§W8 / W5 增加 `body.decompressedBytes` 与 `body.depth` 独立 resource center 类型（schema 已有 socket/client resource center 类型，可补），并 gate：解压比 / 解压后 bytes p99 ≤ 阈值。

分类：`UNTESTABLE`。P1（缺爆 budget 度量）。

### VR3. P11 enabled-transport equivalence 在 release manifest 未声明 active set（P1 / UNDER_SPECIFIED）

被攻击条款：§P11 + §release manifest。

反例：release manifest 列出 protocol write_version/read_version 但未列出产品"实际启用 transport" 集合（WS / SSE / HTTP fallback）。验收时不知"产品实际启用"如何定义——若 manifest 不声明，则任何只测 WS 的实现都可声明"SSE 是 fallback 但没启用"，规避 P11 等价验证。

最小修订：release manifest 必填 `enabledTransports: [...]`；P11 等价验证仅覆盖该集合；外部审计可凭 manifest 列表判 FAIL（实现随机启用一种未声明 transport）。

分类：`UNDER_SPECIFIED`。P1（验收边界）。

---

## 8. REQUIRED_ENVELOPE_AND_STATE_MACHINE_REVISIONS

按本轮 P0/P1 修订要求列出：

1. **release manifest 新增 typed `regulatedCommandClasses`** + release gate predicate（A1）：列出受管制命令类清单与必经补检的 epoch 列；不登记即 release REJECTED（`REGULATED_COMMAND_NOT_LISTED`）。
2. **§M1 authority-read inventory 加入 commit-point epoch re-read** + 显式声明复读源必须为权威 sessions 主行线性化读（A2）：不允许"声明最大 staleness"对 commit 点复读适用。
3. **§M5 IC-1 增设独立 stale-cache gate**（A3）：注入 gateway 缓存 age>SLO 后发起请求，断言拒绝 reason = `STALE_CACHE_AUTH`。
4. **§04 AUTH_EPOCH_STALE 同事务原子写** 显式声明（A4）：领域回滚与 terminal 收据写入同期事务。
5. **§04 refresh × session 状态机决策矩阵 + family 撤销线性化点**（B1）：显式每个操作对 (credential_version, session_epoch, authz_epoch, state, access_token_hash wheel) 的变化集合；family 撤销单 UPDATE 影响行数=1 为线性化点，不引入 REVOKING 中间态。
6. **§04 refresh 同发新 access token 与否显式声明**（B2）：同事务刷新集合锚定。
7. **§04 / §M5 filtered stream projection 与 source commit 原子性声明**（C1）：择一同事务或显式开权限历史重投单一路径（与"不做权限历史重算"措辞调和）。
8. **§容量合同 filtered_stream side_channel_budget**（C2）。
9. **§04 SUBSCRIPTION_INVALIDATED 控制 envelope 增 `permissionEpoch / newGeneration` 标签**（D1）。
10. **§04 空闲流 SUBSCRIPTION_INVALIDATED 投递双层定义**（D2）：落 retention 视为到达，SLO 绑定服务端落库而非客户端收到。
11. **§release manifest 必填 `statusUrl.maxStalenessMs` typed 字段**（E1）。
12. **§04 SKIP_AND_RESYNC 三步协议 + event type deprecation 列**（E2）：reason code、resync watermark 字段、`deprecation_at / supersededBy`。
13. **§signer key lifecycle 扩展 upcaster 制品**（E3）。
14. **§M5 stream_subscriptions 与 session_epoch/authz_epoch 级联**（S2）：epoch++ 时同步 invalidate 受影响 subscription。
15. **§M5 credential_version bump 后客户端必须 fresh bootstrap**（S3）。
16. **§04 statusUrl 返回 `leaseUntil` 与 retry 策略字段**（PS2）。
17. **§snapshot `retained_from_seq` 快照字段与 `RETENTION_LOST` reason**（ST3）。
18. **§04 reject reason 优先级顺序**（VR1）。
19. **§release manifest 必填 `enabledTransports`**（VR3）。

envelope JSON Schema（P4 机器可检查制品）必须同步加入：
- `SUBSCRIPTION_INVALIDATED` envelope 含 `permissionEpoch`、`newGeneration`、`reasonCode`。
- `SKIP_AND_RESYNC` envelope 含 `resyncWatermark`、`reasonCode`。
- `statusUrl` 响应含 `leaseUntil`、`reasonCode`。
- 受管制命令 envelope 含 `commitRecheckEpochs`（per-class 标）。

envelope 状态机表（P4 receipt 状态迁移）需新增：
- `in_progress --AUTH_EPOCH_STALE--> failed_final(AUTH_EPOCH_STALE)` 同事务声明。
- `accepted --STALE_CACHE_AUTH--> rejected_final(STALE_CACHE_AUTH)` 在 admission 路径。
- subscription 状态 `STALE` 由 session_epoch/authz_epoch bump 级联置位。

CI mutation test 新增集合：
- 一条 permission_grant 命令类型未登记 → release REJECTED。
- commit 点复读源 = 副本，撤销已生效 → 受管制命令 stale-commit > 0 ⇒ FAIL。
- gateway 缓存 age>SLO → admission rejected reason = `STALE_CACHE_AUTH`。
- filtered stream: source 提交与映射写之间崩溃 → 续传后 visible_seq dense。
- SUBSCRIPTION_INVALIDATED 重投 dup @同 permissionEpoch 幂等；跨 epoch 不被合并。

---

## 9. REQUIRED_SECURITY_TESTS

### Sec-T1（A1/A2 P0）受管制命令漏登记 × commit 点复读源矩阵
矩阵：`permission_grant_command ∈ regulated set ×∉` × `revoke before commit × after admission` × `commit read source ∈ {primary linearizable, replica with lag}`。
断言：
- `∉ regulated` ∩ `revoke before commit` ⇒ commit 进入 `committed` 而非 `failed_final(AUTH_EPOCH_STALE)` ⇒ **FAIL**（release gate 层面的 finding ledger）。
- `∈ regulated` ∩ `replica with lag` ⇒ commit 也错进 ⇒ **FAIL**。
- `∈ regulated` ∩ `primary linearizable` ∩ `revoke before commit` ⇒ commit ⇒ `failed_final(AUTH_EPOCH_STALE)` 且 receipt admission snapshot 对比证据写入 ⇒ PASS。

### Sec-T2（A3 P1）gateway 缓存 stale fail-closed
注入：sessionEpoch bump 后 gateway cache `enteredAt = now − (SLO + ε)`；客户端请求。
断言：reason = `STALE_CACHE_AUTH`、admission 拒计数 = 尝试计数。

### Sec-T3（B1 P1）refresh family revocation 唯一可实现性
三 fixture：
- F1：refresh replay 检测 → `session_epoch++` 单行 CAS 影响行数=1；处于 ACTIVE→不动 REVOKING；下一 refresh 必 definitively fail；旧 access token 下一请求 fail。
- F2：refresh replay 既 bump session_epoch 又 ACTIVE→REVOKING→REVOKED → 验证 REVOKING 在 bump 之后是否仍可被新 session 校验通过（应拒）。
- F3：同一 family 内多次 rotation 中途中断（崩溃在 new refresh hash 写入后 / 老 refresh hash 失效后断点）→ 续传路径单一确定。
任一 fixture 多合规 ⇒ UNTESTABLE。

### Sec-T4（C1 P1）filtered stream source 提交 × 映射写崩溃续传
fixture：source E 提交（T1）→ 在 T2 投影事务写 mapping 之前 kill -9 / 模拟 power loss → 恢复续传。断言：所有 client streams 的 visible_seq dense；不可见的 source event 不制造 visible_seq gap；可执行的（同事务 / 权限快照重投）单一 fallback 可证。

### Sec-T5（D1/D2 P2/P1）SUBSCRIPTION_INVALIDATED 去重与空闲流投递
- dup case：同名同 permissionEpoch 重投 → 客户端只 triggered 一次 re-subscribe。
- 跨 epoch case：e1 dup 在 e2 之后到达 → 客户端按 (streamKey, permissionEpoch) 拒 dup-e1。
- 空闲流：客户端断连 + SLO 内收到 SUBSCRIPTION_INVALIDATED → 断言落 retention 的判定；客户端重连 HELLO 必须收到 backlog。

### Sec-T6（E2 P1）未知 event type SKIP_AND_RESYNC 与 deprecation
- 未知 event type @seq=K，cursor 卡 K-1 → resync → status = `SNAPSHOT_REQUIRED(reason=UNKNOWN_EVENT_TYPE)`；resync 后 cursor > K；应用 snapshot。
- release 移除一个 producer event type 但未配 `deprecation_at / supersededBy` ⇒ release gate REJECTED。

### Sec-T7（E3 P2）upcaster 无 gap × signer key 撤销切换
fixture：K_q3 撤销，K_q3 签发的 upcaster 制品 U5→6 已 earliest retained → R切换 gate FAIL；若 U5→6 已重签于新 key → gate PASS。

### Sec-T8（S2/S3 P1）epoch bump 级联穿透 stream layer
- session_epoch++ ⇒ 该 session 所有 stream_subscriptions 状态 STALE 或 SUBSCRIPTION_INVALIDATED 已落 retention。
- credential_version++ ⇒ 客户端用旧 credential_version + 旧 per-stream cursor 走 HELLO/resync ⇒ 拒绝 reason = `CREDENTIAL_VERSION_STALE` + `BOOTSTRAP_REQUIRED`。

### Sec-T9（VR2 P1）解压后 body 大小 / 深度上限
压测：发送压缩 payload（gzip）膨胀比 ≥1000；断言 release manifest 配 `body.decompressedBytes / body.depth` 阈值并超过即 reject reason = `BODY_TOO_LARGE`；resource center `socket/client` 度量分解独立 resource center type。

### Sec-T10（VR3 P1）manifest 未声明 active transport 集合的旁路
fixture：实现只启用 WS 且 manifest `enabledTransports = ['ws']`；旁路尝试 SSE 端点必拒绝。manifest 缺 `enabledTransports` ⇒ release REJECTED。

---

## 10. BLOCKING_QUESTIONS

1. **A1**：v2.3 是否同意把"受管制命令类清单"做成 manifest typed 字段并配 release gate predicate "其效果授予/转移/撤销另一账号权限或调动平台资金的命令类型必须在 onboard 时登记，未登记 release REJECTED"？若否则一条漏登记的 permission_grant 命令可在 SLO 内做越权授予——为何该路径非 P0？
2. **A2**：v2.3 是否同意把"受管制命令 commit 点 epoch 复读"列入 M0/M1 authority-read inventory 并标配"复读源必须为权威 sessions 主行线性化读、不允许声明最大 staleness"？若否则一条异步副本 lag 即令整个 FL-13 复读机制失效——为何该前置非 P0？
3. **B1**：v2.3 refresh family 撤销的线性化点是 (i) `session_epoch++` 单条 CAS（不落中间态）还是 (ii) `state: ACTIVE→REVOKING→REVOKED` 的两段式？请给出**确定的实现路径**并把矩阵与状态机的等价 / 不等价关系定成表，否则两种实现均"合规"且不可机械化证否，违反唯一可实现性。
4. **C1**：filtered stream 的 visible_seq → source event_id 映射写是 (i) 与 source event 提交在同一领域事务（O(watchers) inline 写放大），还是 (ii) 作为下游投影 consumer 的独立事务？若是 (ii)，请给出 source 已提交但映射未提交时的崩溃续传路径——在"禁止基于权限历史重算"禁令下是否唯一可重建？否则 §P5 在 filtered 流上的"续传承诺可验收"断言失效。
5. **D2**：SUBSCRIPTION_INVALIDATED 在 idle 流上的"SLO 内到达"约束服务端是否定义为"已落入 retention 且 ≥ subscription visible_head_seq"，而非"送达客户端"（无连接通道则后者不可能）？请给该双层语义与"客户端重连 HELLO 必收 backlog"的契约一同钉死。
6. **E3**：upcaster 制品的签名 key lifecycle 是否与 release/restore 签名 key lifecycle 同一/独立？K_q3 撤销后 earliest retained schema_version 仍需 K_q3 签发的 upcaster 时，规范是否要求重签 upcaster 才允许切换？若否则 upcaster 无 gap 断言不可在 key 事件后成立。
7. **S2/S3**：`session_epoch++` 是否级联使所有受影响 `stream_subscriptions` 行 STALE 或发 INVALIDATION；`credential_version++` 是否强制客户端 fresh bootstrap 并丢弃旧 per-stream cursor？请显式；否则单设备/全设备撤销未穿透到 stream layer。
8. **VR3**：release manifest 是否必填 `enabledTransports` 集合使 P11 等价验证边界可机器判定？若否则"SSE 是 fallback 但未启用"声明可随意规避 P11。

---

报告到此结束。本轮独立审查未读取其他席位输出与历史评审材料；除本报告唯一落盘文件 `tmp/architecture-v2.3-adversarial-glm-protocol-security.md` 外未修改任何其他文件。