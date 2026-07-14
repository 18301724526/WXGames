# v2.2 对抗审查报告 · GLM · 协议、会话、授权、AOI 与应用安全

席位：GLM（通信协议 / 身份会话 / 授权 / AOI 情报 / 应用安全）
基准：`7月14日后端架构/成熟SLG后端参考架构-v2.2.html`、`容量合同-v2.2.schema.json`、`容量合同判定器规范-v2.2.md`、`当前实现迁移路线图-v2.2.md`
日期：2026-07-14
分类法：`CONFIRMED_SPEC_CLOSURE / UNDER_SPECIFIED / SPEC_CONTRADICTION / UNTESTABLE / IMPLEMENTATION_ONLY_GAP / FACT_ERROR`
严重度：`P0` 授权/单写者/恢复完整性；`P1` 可用性/发布阻断；`P2` 运维可维护性

遵守《共同事实与裁决纪律》。本报告只攻击 v2.2 规范文本本身，不把当前实现差距冒充规范矛盾；当前确实不存在的目标表/字段一律归 `IMPLEMENTATION_ONLY_GAP`，不混入下文 findings。

---

## 1. PROTOCOL_SECURITY_V2_2_VERDICT

`REFERENCE_V2_2_STATUS = NOT_PROVEN`（沿用 v2.2 自标）。

第三轮对协议/会话/授权/AOI 面的独立反证结论：**v2.2 在委托给“产品 SLO”和“逐类型定义”的若干关键语义边界处，未给出线性化点、传播契约、机器可检查禁止字段或跨流 barrier 的执行语义**。具体地：

- **A1（P0，授权）**：会话/凭据/授权三类 epoch 只在网关 admission 与 stream HELLO 校验，规范未要求它们在权威领域事务的线性化点（COMMIT）被复核；撤销传播 SLO 与“授权是 P0 correctness 不变量”的关系未线性化，构成授权窗口绕过可能。
- **A2（P0，会话）**：refresh family 与多设备状态的归属未落实（family 跨设备 or per-device），“旧 refresh 重放撤销整个 family”与“多设备显式状态机”之间无唯一映射，可被选成过度撤销或泄漏。
- **A7（P0，AOI 侧信道）**：filtered AOI stream 的 `visible_head_seq` 来源（服务端订阅列 vs 客户端 cursor）未钉死；`committedWatermark`（envelope 例值）与 filtered visible seq 的边界模糊，存在可推断隐藏实体时序/序号侧信道。
- **A3/A5/A6/A8/A9/A10/A11**：statusUrl 读取一致性、机器可检查禁止字段、permissionEpoch 服务端→客户端通知路径、未知事件默认行为、upcaster 覆盖下界、跨流 barrier 机制、资源预算组合失效——均为 `UNDER_SPECIFIED`。

已闭环的真规则（第 2 节）确实存在，但闭环止于 prose；缺乏机器可检查层使其在实现期可被悄悄违反而不触发规范裁决。因此本席裁决为：**规范可继续作为基线，但 A1/A2/A7 必须在进入 M5/M7 实现前补齐执行语义（最小修订见第 7 节），否则 M5 退出门禁和授权 SLO 不可唯一验收。**

不主张 `SPEC_CONTRADICTION`：A1 的 SLO 与 correctness 张力可通过“在领域事务 COMMIT 点复核 epoch + SLO 仅为延时上界”消解；规范目前只是没说，不是不可能同时满足。

下文每条 finding 给出：被攻击条款 / 前置条件 / 精确时间线 / 违反不变量 / 现有文本为何挡不住 / 最小修订 / 可执行验收证据。

---

## 2. CONFIRMED_CLOSURES

以下规范条款给出了足以实现且可验收的闭环；列出以便区分真实规范缺口与已堵住的反例。

| ID | 条款 | 闭环依据 | 验收证据 |
|---|---|---|---|
| CL1 | “EVENT 可先于或后于 ACK；不得强制单一 `EVENT.seq > ACK.eventSeq` 规则” | M5 退出门禁：“EVENT 先于或后于 ACK 均收敛”，P4 gate 与 `cursorAdvanceAllowed:false` 例值 | 端到端 fixture：先发 EVENT 再到 ACK、先到 ACK 再到 EVENT，客户端 projection 最终态唯一，且 applied cursor 只由 ordered event 推进 |
| CL2 | “ACK/statusUrl 不写 projection、不推进 applied cursor” | P4 gate、M5 交付清单、ACK 例字段 `cursorAdvanceAllowed:false` | 故障注入：丢 ACK、statusUrl 永远 in_progress，客户端 projection 不变、applied cursor 不前移 |
| CL3 | “客户端只有一种 event/snapshot 状态应用机制，可有多条独立 stream” | P4 + P5 gate | 客户端状态应用路径单测：snapshot 与 EVENT patch 走同一 apply 函数；不同 stream 不互相覆盖 |
| CL4 | “snapshot cut = `stream_heads.committed_seq`，不依赖 `published_at`” | D2 gate、Snapshot 代码注释、stream_heads 列定义 | 用 relay outage 让 `published_at` 落后于 `committed_seq`，snapshot cut 仍取 `committed_seq` |
| CL5 | “服务端不承诺旧 in-flight 包零到达；用 subscriptionGeneration + permissionEpoch 丢弃” | stream_subscriptions 列定义 + 授权过滤 impl note | 注入乱序/重传旧包，客户端按 (gen, perm_epoch) 丢弃，projection 终态唯一 |
| CL6 | “客户端 ownerKey 不构成授权” | C2 gate、Owner Set Rule impl note | 客户端提交篡改 ownerKey，服务端仍用推导 owner 集授权 |
| CL7 | “服务端动态发现 owner/reference → 回滚 → 重新授权 → 新 plan_attempt；不得在持锁中临时补锁” | C3/C4 gate、Owner Set Rule impl note、command_execution_plans `superseded_by` | 执行期 dynamic owner 触发回滚，旧 plan 标 superseded，新 plan_attempt 不同，事务不留半锁 |
| CL8 | “只要求已启用 transport 语义等价” | P11 gate、裁决纪律第 8 条 | 单 transport 部署不做强制第二条 transport，但 commandId/seq/cursor/error/resume 跨 transport 等价校验 |

> 说明：CL1–CL8 均 prose 闭环；第 5 节 A5 指出“无机器可检查禁止字段”是它们的实现期安全网缺口，不否定 CL1–CL8 本身的语义正确性。

---

## 3. SESSION_AND_REFRESH_ATTACKS

### A1（P0，授权）— epoch 校验缺线性化点：撤销传播窗口内领域事务可提交

**被攻击条款**：P1 Session Epoch gate、Session/refresh impl note、C1/C2 correctness gate。

**规范原文**：
- `sessions` 表注释：“每次请求校验 credential/session/authz epoch”。
- impl note：“请求和 stream HELLO 必须同时校验三类 epoch，撤销传播有产品 SLO 和可观测证据，不能依赖 access token 自然过期。”
- 领域事务（Section 01 步骤 5–8）：“lock receipt → all leases → all heads → domain rows … COMMIT”。

**前置条件**：
- P 拥有效 access token，session 处于 ACTIVE，credential_version=6，session_epoch=19，authz_epoch=58。
- access token 已签发（嵌入三个 epoch 或携带可定位 session_id），网关缓存了 session 查询结果。
- 管理员撤权触发 authz_epoch 59（或冻结触发 credential_version 7）。

**精确时间线**（_SERIAL 影响('_',) linearizable 假设：网关为无状态层，session 查询缓存 SLO > 0；权威领域事务在单一 SQL _STORE，行锁持至 COMMIT）：

```
T0  网关 admission 通过：缓存 epoch 与 P 的 token 匹配（authz_epoch=58，命令被接受并写入 command_receipts ACCEPTED，plan_attempt=1）
T1  管理员撤销 P 的某权限：authz_epoch++ → 59（写权威 sessions 表）
T2  撤销传播中：网关缓存仍持有 authz_epoch=58（SLO 窗口内）
T3  Owner runtime 取 receipt 排队列；领域事务开 BEGIN
T4  事务锁 receipt → owner_leases → aggregate_heads → domain rows（规范步骤 5–7）
T5  规范从未要求此事务重读 sessions.authz_epoch / credential_version / session_epoch
T6  COMMIT：领域状态、terminal receipt committed、stream events 全部持久化
T7  事件推送给 P，P 看到本应被撤销的命令已对世界生效
```

**违反的不变量**：
- C2（服务端校验每个引用实体权限）——在 T1 已撤销后，命令对本应在 T5–T6 被识别为无权，却仍世界生效。
- 授权作为 P0 correctness 不变量。

**为何现有文本挡不住**：
- 规范把 epoch 校验限定在“每个请求”与“stream HELLO 建连”，而请求即网关 admission（receipt 还在 ACCEPTED）。它没有声明领域事务在写 terminal receipt 的同事务内必须取 session 行 `FOR UPDATE` 并比对当前 epoch。
- 命令 receipt 列里只有 `session_id`，没有 `authz_epoch_at_admission` 列；规范未要求 admission 时快照 epoch、也未要求提交时复核当前 epoch 与快照一致。
- 撤销 impl note 把校验明确定位在“请求”和“stream HELLO”两个面，领域事务面被默认“admission 已验证过”而未做权威 commit 点复核。
- 现有 `command_receipts` 行锁顺序（receipt → leases → heads → rows）也没有列入 session 行，因此即便开发者想复核也无规范锚点。

**这是规范缺口而非实现缺口**：没有要求 commit 点 epoch 复核；admission-与-commit 之间的撤销窗口在规范层就未尽义务。

**与裁决纪律第 7 条的关系**：本反例不依赖“正确 DB CAS 挡住旧 epoch”——恰恰相反，规范没有给 commit 点供 CAS 校验，所以旧 epoch 自始至终没被任何行级 CAS 拦截。不是 `FACT_ERROR`。

**最小修订**：
1. 在 `command_receipts` 增加 `admission_credential_version`、`admission_session_epoch`、`admission_authz_epoch` 三列（adm 小事务写入）。
2. 规范步骤 5（lock receipt → all leases → all heads → domain rows）之后，明示：“领域事务以 `SELECT sessions.* FOR UPDATE WHERE session_id = :sid` 持锁至 COMMIT；提交前断言 `credential_version = admission_credential_version AND session_epoch = admission_session_epoch AND authz_epoch = admission_authz_epoch`；不一致一律 `rejected_final` 并不影响世界状态。”
3. 撤销 SLO 仅约束“从权威 session 更新到网关缓存刷新”的延时上界；领域 commit 点复核是 correctness 契约（线性），SLO 不替代之。
4. 文档明示：access token 自然过期不算撤销；SLO 是传播时效，不是授权语义边界。

**可执行验收证据**：
- 故障注入：admission 后、COMMIT 前由管理员撤销 authz_epoch，断言世界状态不变、receipt 终态为 `rejected_final`，事件流不携带该命令的 patch。
- 压力序列：1ms 窗口内撤销 + admission + commit 100 次交叉，断言 0 次 stale-commit。
- SLO 可观测：从 sessions 更新到网关缓存刷新的 p99 延时 ∈ [0, SLO]，并区分 latency evidence 与 correctness evidence（不能以 latency 通过 correctness 门禁）。

---

### A1b（P0，授权）— SLO 与“授权 P0 correctness 不变量”的语义关系未线性化

承接 A1。impl note 写“撤销传播有产品 SLO 和可观测证据”，但规范未界定：SLO 是 (a) 线性协议的延时上界，还是 (b) 授权最终一致性的契约本身？

- 解读 (a)：授权在 commit 点线性化，SLO 只度量网关缓存刷新速度，撤销窗口仅在“已 admission 但未 commit”的命令上放宽，commit 点仍硬拒——与 A1 修订一致，自洽。
- 解读 (b)：授权允许 SLO 内 stale-pass，才必须以 commit 点复核为权威——但若规范默许 (b)，则授权不再是 P0 correctness 不变量，与 C2 冲突，构成潜在 `SPEC_CONTRADICTION`。

**分类**：`UNDER_SPECIFIED`（不判 `SPEC_CONTRADICTION`，因 (a) 可消解冲突）。**最小修订**：在 P1 gate 后追加一句“授权的正确性以 commit 点 epoch 复核为准；SLO 约束的是撤销的传播延时，不放宽 commit 点的授权判定。”这样 (b) 被明确排除。

---

### A2（P0，会话）— refresh_family 与多设备状态机的归属未唯一

**被攻击条款**：sessions 表 `refresh_family_id`、impl note“refresh token 采用 family + rotation CAS；旧 refresh 重放会撤销整个 family”、P1“多设备是明确状态机”。

**模糊点**：
- `refresh_family_id` 跨多设备还是 per-device?
  - 若 family 跨设备（一个 account 一个 family）：单设备 refresh 重放 → 全设备被撤销（DoS 一次手滑全账号下线）。
  - 若 family per-device：family 与 session_id 一一对应，"撤销整个 family" 退化为撤销单个 session，"family" 术语冗余，且跨设备联动防重放失效（一设备被盗用不影响其他设备）。
- “多设备是明确状态机”但规范未给出状态机：是否允许多 session 并存？refresh 是否绑定 device？admin 撤销一个 device 是否 bump credential_version（影响全设备 access token）还是 session_epoch（仅该 device）？
- sessions 表 `state ∈ ACTIVE→REVOKING→REVOKED` 是 per-session，没有 per-family 状态列；"撤销整个 family" 落地在哪行？

**精确时间线（family 跨设备假设的反例）**：
```
P 在设备 D1、D2 各登录，同 account，refresh_family_id=F1，session_epoch 分轨 D1=19 / D2=7
攻击者窃取 D1 的旧 refresh token 重放
服务端 CAS 校验失败 → 撤销 family F1 → D2 也被踢
合规用户 D2 在没有任何安全事件下被强制登出
```
这在合规上违反“最小影响半径”/`least privilege`，并把单设备妥协放大成全账号 DoS。

**违反的不变量**：O3“权限最小化并可审计”、Secrets 行“fail closed 与可用性操作的缓冲边界”、P1 的“多设备显式状态机”要求。

**为何现有文本挡不住**：sessions 表只有一个 refresh_family_id 列、无 family 状态/撤销列；impl note 仅说“撤销整个 family”，未给出 family↔device↔session 三者的唯一映射、撤销半径与恢复路径。

**最小修订**：
1. 明确 `refresh_family_id` 的语义：建议改为“一个家庭绑定同一 `(account_id, device_class)` 或同一受信任设备组”，并在 `sessions` 上增加 `family_state` 与 `family_revoked_at`；或在文档显式声明“family = single device-session，重放撤销单设备不波及其他设备”。
2. 给出多设备状态机表：枚举（单设备登录、多设备并发、device class 限制、admin 撤销一个 device、admin 撤销所有 device、refresh 重放、密码重置）各自 bump 哪个 epoch、影响哪些 session、是否失效 access token、对其他设备的影响。
3. 明确：refresh 重放撤销家族是否同时 bump `credential_version`（使全部已签发 access token 失效）还是只 bump 受影响 session 的 `session_epoch`。

**可执行验收证据**：
- 状态机 fixture：枚举上述全部状态迁移，断言每个迁移对 (其他设备 access token, 本设备, family 状态) 的影响唯一。
- 重放注入：两设备并发其中一设备重放旧 refresh，断言另一设备行为（受影响半径与规范声明一致，且半径最小可审计）。

---

### A2b（P2，会话）— token_hash UNIQUE 与 refresh rotation 的 CAS 粒度

**模糊点**：sessions 表声明 `token_hash UNIQUE` 且 refresh rotation 用 “CAS”。rotation 即在 session 行上 `token_hash = new AND session_epoch = old+1` 的 CAS。但如果 `token_hash` UNIQUE 是 access token hash 还是 refresh token hash？规范未区分 access token 与 refresh token 的 hash 字段；session 表只有一个 token_hash 列。若是 refresh token hash，access token 怎么验证？若是 access token hash，refresh CAS 校验对象是谁？规范用时把 “token” 作为单一概念，缺 access/refresh 双 hash 的列建模。

**最小修订**：明列 `access_token_hash`、`refresh_token_hash`（均 UNIQUE），rotation CAS 写 `refresh_token_hash` 并 bump `session_epoch`；access token 验证用 access_token_hash 且受 `session_epoch` 比对。

---

## 4. COMMAND_AUTHORIZATION_AND_PENDING_STATE_ATTACKS

### A3（P1，命令状态机）— statusUrl 读取一致性未约束：先 in_progress 后 committed 可能

**被攻击条款**：command_receipts 表注释（“status query never advances state and is the only client recovery path”）、M5“ACK/statusUrl 只查询状态”、P4。

**模糊点**：statusUrl“只查询状态”，但规范未规定本次查询从权威主库读 vs 从读副本/缓存读。

**精确时间线**：
```
T0 领域事务 BEGIN
T1 写 domain rows + heads + events + outbox + terminal receipt=committed
T2 COMMIT（此时 receipt committed 已在主库）
T3 ACK 派发但丢包
T4 客户端重试查 statusUrl，命中读副本，副本仍 replication_lag 落后 → 返回 in_progress
T5 副本追上，第二次查返回 committed
```
- 在 (T4, T5)：客户端收到 in_progress（旧），根据 P4 不应推进 projection——但 P4 只禁止其写 projection，没有约束“pending UI 终态收敛”。若客户端把 statusUrl 读结果直接驱动 pending UI，UI 卡在 in_progress 直到副本追上。
- 若副本始终落后（partition）则 UI 永远 in_progress。
- 规范 step 描述 receipt 与领域写入原子提交本身就排除“领域写已 committed 而 receipt 非 terminal”，但只在权威主读时成立；statusUrl 的读取一致性级别未指明。

**违反的不变量**：M1 退出门禁“不存在领域状态已提交但 receipt 非终态的可达状态”——该不变量对**权威主读**成立，对副本读假阴性。规范未排除副本读这条路径。

**为何现有文本挡不住**：`statusUrl` 路由未被纳入“权威读”清单；D4“缓存、读模型非权威”只覆盖 projection，未覆盖命令状态查询。evaluator/migration 没说 statusUrl 必须走主库或线性读。

**最小修订**：
1. 在 command_receipts 表注释中追加：“statusUrl 查询必须从权威主库或等价线性化读路径返回；不得读 replication-lagged 副本或 projection/cache。”
2. M5 退出门禁新增：“statusUrl 始终在最大 replication_lag 之内反映 terminal 状态；若部署无主库 linearizable 读，必须由唯一 guardian 写到 read model 且明确标 stale 不可作 terminal 依据。”
3. 容量 schema 在 stage `database` 增加 `command_status_read_consistency` evidence（主读 vs 副读）。

**可执行验收证据**：
- 故障注入 `relay_outage`/`database_failover` 期间持续轮询 statusUrl，断言 terminal 一旦在主库出现后，下游 statusUrl 的 staleness ≤ SLO 且最终单调收敛到 committed；不允许永久 in_progress。
- 副读场景不可产生 committed ↔ in_progress 抖动。

---

### A3b（P0，命令状态机）— pending command UI 的客户端持久化与唯一收敛未约束

**被攻击条款**：架构陈述“客户端仅查询同一 commandId”“ACK/statusUrl 只解决命令生命周期”，但未要求客户端持久化 pending commandId 以跨崩溃恢复。

**精确时间线**：客户端进程崩溃（非服务端崩溃）：
```
T0 客户端发 CMD（commandId=C1），写入 pending 列表（仅内存）
T1 crash → 内存 pending 丢失
T2 客户端重启，重新登录，BOOtSTRAP/sync.request 不知道 C1
T3 服务端已为 C1 committed 事件推到 stream，但客户端不知道这个事件来自 C1（commandId 字段在 EVENT 里，但如果客户端没有 C1 在 pending 中，它会把该 patch 应用——状态是对的）
T4 但 C1 的 pending UI 永远挂起（既不知道 committed，也不知道 failed）
```
状态正确（事件已经把 projection 更新），但 UI 不能给用户 C1 的 outcome。规范声明“ACK/statusUrl 只解决命令生命周期”——意味着 pending UI 的“知道是哪个命令的 outcome”属于命令生命周期范畴，应由 statusUrl 提供；但规范未要求客户端持久化 commandId 列表以便重启后查 statusUrl。

**违反的不变量**：M1“相同 payload 返回同一终态”、R6“逐步幂等 guard”依赖于客户端能按 commandId 查询；规范未规定客户端必须维护可恢复的 commandId ledger。

**最小修订**：
1. M5 交付增加：客户端必须把 pending commandId 持久化（localStorage/IndexedDB/平台 KV），重启后批量查 statusUrl（带 session_epoch 与 authz_epoch），把结果应用到 pending UI；不存在的 commandId 从 pending 列表移除。
2. 待服务端：未在 pending 中且无服务端 receipt 的 commandId，视为客户端丢弃（admission 失败），不重新发同一 commandId（rules already in P3）。

**可执行验收证据**：
- 客户端崩溃注入：发命令后立即 kill client，重启后统计 pending UI 收敛时间；断言 convergence 内所有 commandId 落到 terminal。
- 网络断开 | ACK 永远不达：客户端在 SLO 内通过 statusUrl 把全部 pending 收敛到 terminal 或 unknown→remove。

---

### A4（P0，pending+授权 交叉）— admission-epoch 与 commit-epoch 复核缺失导致 commit 后 client conflict 提示错

承接 A1。**额外路径**：动态 owner 发现回滚 → 重新授权 → 新 `plan_attempt` → 客户端被发回 `GAME_STATE_REVISION_CONFLICT`（当前实现名）。规范要求“重新授权后生成新 plan_attempt”且“不得把服务端新发现版本伪装成客户端前置条件”，但回滚导致 client 看到的 result_versions 可能跳变。若 epoch 在回滚期间也被撤销，客户端会拿到一个看似冲突实为撤销的提示——误拒绝（合法用户被告知冲突而实际是 admin 撤权）。规范未要求回滚 result 携带 reason 区分 `OWNER_REDIRECT` vs `REVISION_CONFLICT` vs `AUTHZ_REVOKED`。这是 UX 问题但更隐晦的是：**回滚-重授权-撤销并发下，可能产生“撤销窗口内 commit 已发生、再回滚到新 plan_attempt”——但 commit 已发生的事务无法回滚**。这是 A1 的另一种表现：若 commit 在撤销到达前完成，紧接着 plan_attempt=2 的重路由将“拿另一个 owner 集继续做”，把撤销前的世界变更持久化——除非 plan_attempt=2 的执行以 commit 点 epoch 复核为前提（A1 修订）。归并到 A1 修订即可，单独标注以提示测试矩阵。

**可执行验收证据**：动态 owner 回滚 × admin 撤销 × receipt commit 时序矩阵全部跑过，断言无 stale world mutation。

---

## 5. STREAM_SNAPSHOT_AOI_ATTACKS

### A5（P1，协议）— 无机器可检查的禁止字段/状态转换约束

**被攻击条款**：P4、P5、ACK 例 `cursorAdvanceAllowed:false`、M5“不写 projection、不推进 applied cursor”。

**模糊点**：所有“ACK/EVENT 不得……”规则全靠 prose 和字段命名约定（`cursorAdvanceAllowed:false`），没有规范级的 envelope schema 列出**禁止字段集**或**禁止状态迁移**。BAR：
- ACK envelope 可否带 `appliedSeq` / `cursor` / `eventCursor` 字段？（字段名被默认禁止，但 schema 未禁）
- EVENT envelope 可否带 `advanceTo` 字段？
- 状态迁移：receipt `committed → in_progress` 是否在 schema 层被禁？规范只靠 CHECK 列在 DB 侧约束，协议层没有状态机 schema。

**违反的不变量**：P4“禁止 ACK patch 与 EVENT patch 竞争覆盖”。现有 ACK 例 payload 只有 `result/resultVersions/eventWatermarks`，但 result_versions 也是“某种状态”，客户端可能误用它更新 owner version projection 而不应用 EVENT 中的对应 patch——规范未禁止 `resultVersions` 被用于 projection。

**为何现有文本挡不住**：v2.2 给了 envelope 例子，但没有“规范 envelope JSON Schema + 禁止字段清单 + 状态迁移表”。evaluator 只验证容量合同，不验证协议 envelope。

**最小修订**：
1. 增加 `协议 envelope schema`（JSON Schema）：ACK 禁止字段集白名单（`commandId, status, result, eventWatermarks, statusUrl, cursorAdvanceAllowed:false, serverTime, retryable`）；EVENT 禁止字段集白名单；新增字段必须经 release manifest version matrix 登记。
2. 增加 `receipt 状态迁移表`（机器可检查）：`accepted→in_progress / in_progress→{committed,rejected_final,failed_final}`；其余迁移一律 `INVALID_TRANSITION` 且写入 evaluator 的 correctness 不变量。
3. evaluator/CI 校验：测试客户端实现不得把 ACK 的 `resultVersions` 写入 owner version projection（应用 marker 仅能对 owner version 用 EVENT patch 或 snapshot）。

**可执行验收证据**：
- 把 ACK 加上 `appliedSeq` 字段，client-state-store 实现断言“忽略未知字段”；并在 evaluator mutation test 中检查“模拟 buggy client 应用 appliedSeq 后 projection 与权威不一致即 FAIL”。

---

### A6（P0，AOI 授权）— 服务端→客户端的 permissionEpoch bump 通知路径未定义

**被攻击条款**：stream_subscriptions `permission_epoch`、impl note“权限撤销会使订阅和缓存立即失效”、P7 AOI Permission gate。

**模糊点**：客户端如何得知 `permission_epoch` 已变化以丢弃旧包并触发重新订阅？

- impl note 说“权限撤销会使订阅和缓存立即失效”——服务端侧失效。但客户端侧的 subscription 是客户端发起的；服务端如何通知客户端“你现在持有的 generation/epoch 已过期”？
- 选项：(a) 服务端推一帧 `RESUBSCRIBE_REQUIRED {streamKey, new permissionEpoch}`；(b) 服务端静默让对方下一帧带新 `permissionEpoch`，客户端检测到 mismatch 自行重新订阅；(c) 心跳/sync.request 返回新 epoch。
- 规范的 EVENT envelope 始终带 `permissionEpoch`，所以 (b) 隐含可行——但若在撤销后到客户端下次拉/推之间没有任何服务端 frame 到达，客户端无法感知（push stream 静默）。
- 若用 (b)，则旧包（旧 `permissionEpoch`）继续到达，客户端每帧比对本地 epoch；若本地仍持有旧 epoch（因为它还没收到新 frame），它会**应用旧包**直到第一帧新 epoch 到达。这违反“权限撤销后旧 permission_epoch 不得应用”。

**精确时间线（反例）**：
```
T0 P 订阅 AOI stream，gen=12, permissionEpoch=58
T1 admin 撤权：sessions.authz_epoch++=59, 推送服务端 stream_subscriptions.permission_epoch=59
T2 旧 generation=12 的 in-flight packets 携带 permissionEpoch=58 仍在路上
T3 客户端本地还持有 permissionEpoch=58（没有任何服务端 frame 告知它已变 59）
T4 旧包到达，permissionEpoch=58 与本地 58 匹配 → 客户端应用
T5 之后客户端才在某个 sync response 或第一帧新 epoch 包里看到 59
```
T4 时刻客户端应用了 T1 后本不该可见的实体状态——若该 packet 携带现在已撤销权限下的实体可见信息，则泄露。

**违反的不变量**：P7“权限撤销后旧 permission_epoch 不得应用”、C2 授权校验、Knowledge Rule。

**为何现有文本挡不住**：frames 总是带 permissionEpoch，但“客户端本地的 authoritative permissionEpoch”没有规定更新触发器。订阅列 `permission_epoch` 是服务端权威，客户端没有镜像规则。规范仅说“客户端在应用前丢弃旧 generation/epoch”，但客户端的“旧”判定基准没有强一致同步源。

**最小修订**：
1. 引入服务端→客户端显式信号 `INVALIDATE_SUBSCRIPTION{streamKey, new permissionEpoch, new generation}`，服务端必须在撤销事务同事务 outbox 写一条 in-band 控制帧（事件流内部）以保证：撤销 commit 后客户端必然收到至少一帧新 epoch。
2. 客户端规则：任何包的 `permissionEpoch < local_permission_epoch[streamKey]` 一律丢弃；`local_permission_epoch` 由 `INVALIDATE_SUBSCRIPTION` 单调推进。out-of-band 帧也走 ordered stream（不绕过 seq）以保证单调。
3. 可能进一步：服务端在撤销事务内 `outbox_events` 写一个 system 事件 `subscription.invalidated{streamKey, newEpoch, newGeneration}`，走 ordered ETH stream，客户端按 visible seq 应用——把“控制平面”也纳入 ordered delivery。

**可执行验收证据**：
- 注入 admin 撤权，断言客户端在撤销 SLO 之内收到 `INVALIDATE_SUBSCRIPTION`，且之后无旧 epoch 包被应用（监控 dropped-by-epoch 计数 == 旧 in-flight 包数）。
- 反向：客户端启动即持有伪造高 epoch（启动 boot 不当），下一帧 GUI 出现前 MUST 由 INVALIDATE 校正——不能在窗口内泄露或误应用。

---

### A7（P0，AOI 侧信道）— visible_head_seq / committedWatermark / visible seq 三者边界模糊

**被攻击条款**：stream_events 表注释“授权过滤后的客户端 stream 必须具有自身连续 visible seq，不能让不可见源事件制造客户端 gap”、EVENT 例 `committedWatermark: 991205` 等于 `streamSeq: 991205`、stream_subscriptions `visible_head_seq`、D2 / P6。

**模糊点**：
1. `committedWatermark` 是源 stream 的 committed_seq 还是 filtered stream 的 visible head？
   - EVENT 例中 `streamSeq` 与 `committedWatermark` 数值相同（991205），暗示客户端看到的 streamSeq == 源 committed_seq。但 stream_events 表注释要求 filtered stream 有“自身连续 visible seq”，意味着 visible seq 是独立编号，应与源 seq 不一致。两者冲突。
2. `visible_head_seq`（stream_subscriptions 列）是服务端“已推给该订阅的最后 visible seq”还是客户端的 client cursor？
   - 若服务端权威：客户端 reconnect 时拿服务端的 `visible_head_seq` 做 cursor 起点。这要求服务端维护 per-订阅 visible seq——但 visible 序号依赖权限快照（某实体是否可见），而权限快照随时间变化，回放 visible seq 需要回放时拥有同权限快照，否则不可重建。
   - 若客户端权威：服务端的 `visible_head_seq` 列就只是 advisory；客户端 cursor 是 truth——但 stream_subscriptions 表把 `visible_head_seq` 列为持久列，假定服务端写入。双源真相。
3. 侧信道：
   - 若 `committedWatermark` 是源 stream watermark（源 committed seq），客户端可见——暴露了“源头有多少事件”。filtered stream 连续 visible seq 1,2,3 但 source committedWatermark 跳 100→103，客户端推断有 2 events 被过滤（隐藏实体）。这是序号侧信道。
   - 时序侧信道：visible seq 连续但 `committed_at/serverTime` 间隔不均，推断不可见事件的发生时间。

**违反的不变量**：注释“不能让不可见源事件制造客户端 gap”——现有写法用 visible seq 解决 gap，但 `committedWatermark` 仍可暴露源 gap。这两者必须二选一：要么 envelope 不暴露 source watermark，要么 visible seq 必须等于 source seq（但后者违反 filtered stream 连续性）。

**为何现有文本挡不住**：EVENT 例直接把 `committedWatermark` 与 `streamSeq` 写成同值，没说明 filtered AOI stream 是否复用 source seq。stream_subscriptions 同时有 `visible_head_seq`，与 filtered 概念重叠又不明确从属。

**最小修订**：
1. envelope 明确：对 filtered AOI stream，`streamSeq` 即 visible seq（per-subscription 独立单增），envelope 不暴露 source `committed_seq`；`committedWatermark` 字段对 filtered stream 也用 visible head（或直接删除该字段，由 snapshot 单独返回)。
2. `stream_subscriptions.visible_head_seq` 明确含义：服务端“该订阅下已成功推出的最大 visible seq”；客户端 cursor 由 sync.request 中的 `cursorsByStream[streamKey]` 表达，重连时服务端用订阅 `visible_head_seq` 与客户端 cursor 比较：若客户端 cursor ≥ 服务端 visible_head_seq，按需推 snapshot；否则推 delta from client cursor to visible_head_seq，再继续 live。
3. 侧信道收紧：filtered stream 的 `serverTime` 间距不可直接反映 source 节奏——规范要求事件 `serverTime` 使用 delivery 时刻而非 source commit 时刻；或在 filtered stream 上对 `serverTime` 抖动添加恒定/桶化（产品 SLO 定义侧信道预算）。
4. visible seq 必须在服务端持久化（per subscription？per (account, streamKey)？），以支持重连续传——但 visible seq 是 filtered 投影，不是 source 事实；规范未定义 visible seq 的持久化策略与重建路径。给出最小持久化：`stream_subscriptions.visible_head_seq` 已存在，需补“visible seq 编号如何从持久 source+权限快照重算”或“服务端为每订阅独立持久化 visible seq 行”。

**可执行验收证据**：
- 隐藏实体推理攻击 fixture：撤销一个实体可见性后，统计客户端可猜出的隐藏事件数量应为 0；侧信道区分度 ≤ 产品阈值（信息论 metric）。
- filtered stream 连续性测试：撤销 50% 实体可见性，客户端 visible seq 1..N 无 gap，projection 状态唯一。
- 持久化重建：服务端 crash 后重启，断言 `visible_head_seq` 可从 (source events, 权限快照) 重算，或显式声明 visible seq 独立持久化。

---

### A8（P1，AOI）— 多 stream snapshot 是否需要跨流 barrier / 何种业务需 barrier 未定义

**被攻击条款**：P5“多条 stream 各自维护 cursor”、P6“snapshot 返回 per-stream committed watermark”、攻击点 6“不要默认全局 cut”。

**模糊点**：
- 默认无全局 cut——P5/P6 明示 per-stream。但部分业务**确实需要**跨 stream 一致快照（如行军命令同时触发 `player:{id} resources -` 与 `zone:{id} tile ownership` 两条 stream，客户端 UI 要么都应用要么都不应用，否则出现“钱已扣但行军还没出发/已出发但没钱”）。
- 规范未给出：哪些业务需要 barrier、barrier 如何由 envelope 表达、客户端如何识别并等待 barrier。

**最小修订**：
1. 引入可选 envelope 字段 `commandId`（EVENT 已有）+ 客户端“同 commandId 跨 stream 应 barrier”：客户端检测到两个 stream 的同 commandId 事件后，才分别更新 UI 状态。规范声明：barrier 仅由 `commandId` 隐式定义，**不**由 seq/cut 定义。
2. 对**无 commandId** 的事件（scheduled job / 后台 SAGA），引入可选 `barrierId` 概念或声明该类事件无客户端 barrier（最终一致），并枚举哪些 event type 必须带 barrierId（产品列表）。
3. snapshot 侧：bootstrap 提供 per-stream watermark，但**不提供** cross-stream 一致 watermark；规范明确“snapshot 不保证 cross-stream 一致快照”；并对需要一致快照的 UI 流程（如启动后初次显示战斗地图）走单一 `world-snapshot` stream（合流）或额外 `JOIN_SNAPSHOT` 协议。

**可执行验收证据**：
- 行军命令提交后客户端 UI 断言：resources/X 的扣减与 march/X 的出现在 SLO 之内同 stall/unstall（同一 OP ID 触发），不存在只看到其一的可见窗口超过产品阈值。
- `reconnect_storm` × 多 stream: 断言单 stream lag 不阻塞其他 stream 恢复 (P5)，但同 commandId 的 stream pair 在客户端侧按 barrier 顺序提交。

---

## 6. VERSION_TRANSPORT_AND_RESOURCE_ATTACKS

### A9（P1，版本矩阵）— 未知 event 类型默认行为与 upcaster 下界未规定

**被攻击条款**：兼容表 Client Protocol“未知字段和未知 event type 的行为逐类型定义”、Event Schema“producer_version、consumer_read_range、upcaster set”、强制场景 #5“旧客户端不能理解新 event，但 receipt 已 committed”。

**模糊点**：
1. “逐类型定义”非全量强制——若某 producer 发了未登记 unknown-behavior 策略的事件类型，旧客户端怎么处理？skip / error / force-upgrade 三态未定义默认值。skip → projection 静默 drift；error → 该 session 不可用；force-upgrade → 旧客户端被阻塞（影响可用性 SLA）。
2. upcaster 覆盖下界：schema retention 声明保留周期 ≥ 审计/回放周期；但 upcaster set 仅给 `producer_version / consumer_read_range / upcaster set`，未要求“从最早仍 retained 的 schema 至当前 producer_version 路径上无 gap”。v3 事件被 retained，upcaster 只覆盖 v5→v7，v3 无法 upcast → 客户端/重放消费者读 v8 read_range 解释不了 v3，进入 DLQ 永久。
3. push stream（客户端 consumer）read_range 与 durable consumer read_range 区分：兼容表的 consumer 似乎指 durable projection/consumer（DLQ 概念），客户端 push 没有独立 DLQ；当 producer 切到超出客户端 read_range 的 schema 时，客户端包怎么办？规范未说。

**最小修订**：
1. 默认 unknown event type 行为：`SKIP_AND_RESYNC`——客户端跳过该事件并触发一次 sync.request 直到 watermark；禁止 silent-skip；release manifest 每个新 event type 必须显式声明 unknown-behavior 项，否则 release 不通过。
2. upcaster 路径完整性：兼容表的 event schema 行加“upcaster 路径无 gap 断言”——从最早仍保留事件的 schema_version 到 producer_version，每相邻步必须存在 upcaster 或直接兼容。
3. 引入客户端 push stream `read_range` 列，与 durable consumer `read_range` 分离；超出客户端 read_range 的 event 由服务端决定是否投递（产品策略：drop & force-upgrade vs upcast 到客户端 read max 后投递）。

**可执行验收证据**：
- 反向兼容 fixture：保留 v3 事件，部署 upcaster v5→v7，断言 evaluator 在 PASS 不通过；补齐 v3→v5 后通过。
- 旧客户端 + 新事件：断言客户端 `SKIP_AND_RESYNC` 后最终 projection 与权威一致（不 drift），且不泄露未声明字段。

---

### A9b（P2，版本矩阵）— 回滚兼容矩阵未约束强制升级与回滚共存

**被攻击条款**：Release Identity“原子切换整个兼容组合；回滚选择另一份完整 manifest”。

**模糊点**：若一个 release 引入了**新 event type 强制升级**（min_read 抬高），之后因故障回滚到上一 manifest——上一 manifest 的 min_read 更低，本应 continue 服务旧客户端。但新 producer 已发出的 high-schema 事件在 stream_events 中 retained；回滚后旧 producer 不再 emit 它，但已有的 retained 行在重放时如何被旧客户端解释？跨 release 的事件 retention × producer schema 回滚 的交互规则缺失。归并到 A9 修订（retention × producer schema 回滚 应在 version matrix 显式声明）。

---

### A10（P1，资源预算）— 预算维度组合失效与 authz 缓存投毒未约束

**被攻击条款**：P12、Secrets+Identity 行（缓存旧凭据/closed）。

**模糊点**：
1. P12 罗列 budgets（endpoint/IP/account/session/player/owner/命令类型/body/AOI 成本），但未声明维度间是 AND（取最小）还是 OR（独立拒绝）。**反例**：per-account=100 req/s，per-session=50 req/s，一账号 10 session 并发 → 实测 500 req/s 全过（每 session 各 50 但 account 未触发因为按 session 分桶计数）。A10。规范只说“不使用万能固定数字”，未规定组合语义。
2. authz/epoch 查询缓存投毒：网关缓存 session_epoch/credential_version 查询结果（A1 必需的缓存）。该缓存若被污染（stale 误 positive）可授予已撤销 session。Secrets+Identity 行的“缓存旧凭据、只读降级、fail closed”是针对 SECRET 缓存，明确未覆盖 SESSION/EPOCH 缓存。投毒与 stale 区分不清——规范应把 session 缓存也纳入“fail closed on stale beyond SLO”语义。

**最小修订**：
1. P12 增加：“多维预算在 request 上以 min(remaining_budget_per_dimension) 决定 admit/reject；任一维度超限即 reject。预算计算以 (account, session, owner) 聚合，不可被 session 切片规避。”
2. specs/secrets 行扩展：“session/epoch 查询缓存命中超过 SLO 即视为 stale，stale 一律 reject (fail-closed)；缓存写入必须可审计，cache poisoning 检测纳入 evaluator correctness 不变量。”
3. evaluator 增加 health metric：`authz_cache_stale_reject_count` 与 `authz_cache_poisoned_count==0`。

**可执行验收证据**：
- 维度组合 fixture：单账号 10 session 各发 50 req/s，断言 account 维度触发 reject。
- 缓存投毒注入：把网关缓存写入伪造 stale epoch，断言下游 commit 点 epoch 复核（A1 修订）拒收、receipt 终态为 rejected_final。

---

### A11（P1，传输限额）— 重连风暴 × session_epoch 查询 × 资源预算的耦合未约束

W6 已覆盖“重连风暴击穿前台 SLO”，但未约束重连时 session lookup × authz check × bootstrap snapshot 构建三者的耦合耦合成本。1k 客户端同时重连：
- 每个连接发 sync.request → 网关必需 session_epoch 查询（A1 缓存） + bootstrap snapshot 构建（D2/D4）+ per-stream watermark 读取。
- 若这三者共享 DB pool / WAL / CPU（判定器 §9“共享资源”），任一瓶颈导致 authz check 延时 → SLO 违反 →旧 epoch 被用的概率上升（与 A1 联动放大授权风险）。

**最小修订**：判定器 §9 需对“reconnect 窗口 × authz cache miss × snapshot build × shared DB pool”耦合做联合 stage 排队分析；容量 schema `reconnect_storm` fault 必须同时注入 authz lookup miss。

**可执行验收证据**：reconnect_storm + `secret_manager_outage` 或 DB pool saturation 联合注入；断言 SLO 内 authz stale-approve 计数为 0。

---

## 7. REQUIRED_ENVELOPE_AND_STATE_MACHINE_REVISIONS

按优先级汇总最小修订项（每条给了所在 finding）：

1. **epoch commit 复核**（A1/A1b/A4）：`command_receipts` 增加 `admission_credential_version/session_epoch/authz_epoch`；领域事务 `SELECT sessions.* FOR UPDATE` 持锁至 COMMIT，比对当前 epoch，不一致一律 `rejected_final`。SLO 仅约束撤销传播延时，不放宽 commit 授权。
2. **refresh family 与多设备状态机钉死**（A2/A2b）：明列 `refresh_family_id` 语义、撤销半径、双 hash 列、状态机表（用 screen fixture）。
3. **statusUrl 读取一致性**（A3）：必须线性读权威主库或等价路径；M5 退出门禁加 terminal 收敛延时；evaluator 增加 stage 一致性字段。
4. **pending command 客户端持久化**（A3b）：M5 交付加客户端 commandId ledger 跨重启持久化。
5. **协议 envelope JSON Schema + 禁止字段 + 状态机表**（A5）：ACK/EVENT 字段白名单；receipt 状态机 machine-check；evaluator mutation test 覆盖。
6. **permissionEpoch 服务端推 INVALIDATE_SUBSCRIPTION 帧**（A6）：撤销事务同事务写 outbox 控制帧，走 ordered stream；客户端 local permissionEpoch 由该帧单调推进。
7. **visible seq / watermark 语义收紧与侧信道预算**（A7）：filtered stream envelope 不暴露 source committed_seq；`visible_head_seq` 单源；visible seq 服务端持久化或可重算；serverTime 桶化以降低时序侧信道。
8. **跨 stream barrier 用 commandId 表达**（A8）：声明 barrier 由 commandId 隐式定义；列举需 barrier 的业务 event type；snapshot 不保证 cross-stream 一致 cut。
9. **unknown event 默认 SKIP_AND_RESYNC + upcaster 路径完整性**（A9/A9b）：默认行为钉死；retention × upcaster 路径无 gap 断言；客户端 push read_range 独立列。
10. **多维预算 AND 语义 + session 缓存 fail-closed**（A10/P12 补强）。
11. **reconnect storm × authz cache miss 联合排队**（A11）。

---

## 8. REQUIRED_SECURITY_TESTS

最小可执行测试集合，每条给出：注入点 / 期待不变量 / 通过证据。所有测试归入 M5/M7 退出门禁及 evaluator mutation suite。

| ID | 注入点 / 故障模型 | 期待不变量 | 通过证据 |
|---|---|---|---|
| T1 | admission 后 admin 撤 authz_epoch，领域事务随后 BEGIN→COMMIT | commit 点 epoch 复核把命令判 `rejected_final`；世界状态不变；事件流无该命令 patch | receipt final status / world diff = 0 / stream diff = 0 |
| T2 | 1ms 窗口 × 100 并发撤销+admission+commit | 0 stale-commit | matrix 全绿；rate metric = 0 |
| T3 | 双设备并发，其中一设备 refresh 重放 | family 撤销半径与规范声明一致；另一设备行为（受影响半径最小可审计） | state machine fixture + radius assertion |
| T4 | 丢 ACK + 副本 replication_lag 中查 statusUrl | statusUrl 不久于 SLO 内反映 terminal；无永久 in_progress | status staleness ≤ SLO; monotonic convergence |
| T5 | 客户端进程崩溃后重启 | pending commandId 全部收敛到 terminal/unknown-remove | convergence count = pending count |
| T6 | 在 ACK envelope 注入 `appliedSeq` 字段 | client-state-store 忽略；evaluator mutation FAIL 当 buggy client 应用之 | mutation test fail / projection == authoritative |
| T7 | admin 撤权后，把旧 in-flight 包延迟投递到客户端 | 客户端在 SLO 内收到 INVALIDATE_SUBSCRIPTION；旧 epoch 包 dropped | dropped-by-epoch count == in-flight count; leakage = 0 |
| T8 | 撤销 50% 实体可见性后推送 filtered stream | visible seq 无 gap；source committed_seq 不在 envelope 暴露；侧信道 metric ≤ 阈值 | gap=0; info-leak ≤ threshold |
| T9 | 行军命令同时改 player/zone 两 stream | 客户端 UI 在 SLO 内同 stall/unstall；无“只看到钱扣/只看到行军”窗口 > 阈值 | pairing uniform latency ≤ SLO |
| T10 | 保留 v3 事件，upcaster 仅覆盖 v5→v7 | evaluator NOT_PROVEN/FAIL；补齐 v3→v5 后通过 | evaluator gate result |
| T11 | 单账号 10 session 各 50 req/s | account 维度触发 reject；速率 ≤ account limit | reject count / no overflow |
| T12 | 网关 session 缓存被投毒（stale 高 epoch）| commit 点 epoch 复核拒收；`authz_cache_poisoned_count` metric 检测 | receipt rejected_final; metric>0 if poisoned, ==0 if none |
| T13 | reconnect_storm + DB pool saturation 联合 | SLO 内 authz stale-approve count = 0；前台 SLO 不崩 | invariant counter + SLO pass |
| T14 | receipt 状态机迁移 `committed→in_progress` 注入尝试 | DB CHECK 拦截 + evaluator `INVALID_TRANSITION` | row count = 0; evaluator FAIL |
| T15 | 重连风暴 × 慢 AOI stream 错层 | 慢 stream lag 不阻塞其他 stream 恢复；同 commandId 的 stream pair 按客户端 barrier 提交 | per-stream gap + barrier ordering assertion |

---

## 9. BLOCKING_QUESTIONS

下列问题在规范补齐执行语义前阻塞 M5/M7 退出门禁；每条对应上文的 finding。

1. **(A1)** 规范是否要求领域事务在 COMMIT 前以 `SELECT sessions.* FOR UPDATE` 复核当前 credential/session/authz epoch？若否，撤销传播窗口内领域事务提交对已撤销资源的写是否被授权 correctness 不变量所允许？（必须给出 commit 点线性化结论，不可仅以网关 admission epoch 为准。）
2. **(A1b)** 撤销 SLO 是 (a) 线性协议的延时上界，还是 (b) 授权最终一致性的契约本身？若是 (b)，授权不再是 P0 correctness 不变量，与 C2 的关系如何？
3. **(A2)** `refresh_family_id` 是跨悠多设备还是 per-device？refresh 重放撤销 family 时是否 bump `credential_version`（影响所有设备已签发的 access token），还是只 bump 受影响 session 的 `session_epoch`？多设备状态机的完整迁移表在哪里？
4. **(A2b)** sessions 表的 `token_hash` UNIQUE 是 access token hash 还是 refresh token hash？是否需要 `access_token_hash` + `refresh_token_hash` 双列？
5. **(A3)** statusUrl 查询是否必须从权威主库/linearizable 读返回？若部署存在只读副本，副本 replication_lag 期间返回 in_progress 是否被允许？最大 staleness 是否被 evaluator 校验？
6. **(A3b)** 客户端是否被要求持久化 pending commandId 列表以跨进程崩溃恢复？若否，重启后用户如何得知之前已发但 ACK 未到的命令的 outcome？
7. **(A5)** 规范是否提供协议 envelope JSON Schema 与 receipt 状态机 schema 作为机器可检查的“禁止字段/禁止状态转换”？evaluator/CI 是否对 buggy client 应用 ACK 的 `resultVersions` 写入 projection 进行 mutation fail？
8. **(A6)** 服务端如何通知客户端 `permission_epoch` 已 bump？若仅靠下一帧包自带新 epoch，撤销与第一帧新包之间是否有可见旧 epoch 包被应用的窗口？规范是否要求撤销事务同事务写一帧 `INVALIDATE_SUBSCRIPTION` 控制帧？
9. **(A7)** filtered AOI stream 的 `committedWatermark` 是源 stream 的 committed_seq 还是 filtered visible head？envelope 是否向客户端暴露 source committed_seq（造成序号侧信道）？`visible_head_seq` 是服务端权威还是客户端权威，重连续传如何重建？
10. **(A8)** 规范是否声明跨 stream barrier 由 `commandId` 隐式定义？哪些 event type 必须带 barrierId（无 client commandId 的 scheduled/SAGA 事件）？bootstrap snapshot 是否声明不保证 cross-stream 一致 cut？
11. **(A9/A9b)** 未知 event type 的默认行为是 SKIP_AND_RESYNC / error / force-upgrade？新 event type 是否被强制声明 unknown-behavior 策略才可发布？upcaster 路径是否要求“从最早 retained schema_version 至 producer_version 无 gap”？retention × producer schema 回滚 的交互规则是否列出？
12. **(A10)** 多维资源预算在请求上是否取 min(remaining)（AND 语义）？account-level rate 是否可被 session 切片规避？session/epoch 查询缓存 stale 是否一律 fail-closed？authz cache poisoning 检测是否进入 evaluator correctness 不变量？
13. **(A11)** 重连风暴 × authz cache miss × snapshot build × shared DB pool 的耦合在 evaluator §9 中是否被联合 queueing 分析？`reconnect_storm` fault 是否同时注入 authz cache miss？

---

## 附录：本席主动排除的诱人反例（防误伤）

以下反例被规范中已有条款挡住或被裁决纪律已禁，不计入 findings：

- **“服务端必须保证旧 in-flight 包零到达”** — 裁决纪律已明令：正确要求是 gen/permission epoch 丢弃，而非零到达。本席以 A6 处理“通知路径缺失”，不主张“包零到达”为不变量。
- **“一种客户端状态应用机制等于一条全局 stream”** — 裁决纪律已禁；P4/P5 已明示多 stream。
- **“必须实现两种 transport”** — 裁决纪律已禁；P11 只要求已启用 transport 等价。本席不基于 transport 数量判失败。
- **“ACK 必须带 EVENT.seq > ACK.eventSeq 单调规则”** — 裁决纪律已禁；CL1 闭环。
- **“snapshot must provide global cross-stream consistent cut”** — 攻击点 6 已说不要默认全局 cut；本席 A8 主张以 commandId 为 barrier，不要求全局 cut。
- **当前 wxgame 实现缺 sessions 表/stream_subscriptions/stream_events/AOI 推送/refresh token/client applied cursor** — 全部归 `IMPLEMENTATION_ONLY_GAP`，本报告不计为 `SPEC_CONTRADICTION`（已在探索结果中确认）。
- **正确 DB CAS + 持锁至 COMMIT 下旧 epoch 凭旧快照提交** — 裁决纪律已禁；A1 指出真实缺口是“规范未提供 commit 点 CAS 锚”，即 CAS 不存在，而非 CAS 被绕过。
- **“user 少 / 概率低 / 重试即可 / 加大 timeout”作为正确性豁免理由** — 裁决纪律第 8 条已禁；A1/A2/A7 等未使用此降级。

---

报告结束。本席不修改规范、代码、schema、配置或任何其它文件；唯一落盘文件为 `tmp/architecture-v2.2-adversarial-glm-protocol-security.md`。