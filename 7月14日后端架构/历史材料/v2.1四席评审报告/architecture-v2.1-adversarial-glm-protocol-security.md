# 对抗式协议与安全评审报告 v2.1 — GLM 协议/会话/授权/AOI 红队席（第二轮）

**评审对象**：`docs/slg-backend-reference-architecture.html`（参考架构 v2.1，2026-07-14）
**辅助核对**：`tmp/architecture-v2-adversarial-glm-protocol-security.md`（本席首轮）、当前 `frontend/backend` 通信、身份、命令 envelope、owner 解析与权限源码。
**模式**：只读红队评审。未修改任何产品代码、配置、数据库、进程、部署脚本或参考架构文件。唯一产出为本报告文件。
**日期**：2026-07-14
**未读取**：其他 `architecture-v2.1-adversarial-*` 报告以及其他席位的首轮报告。

**图例**：
- `FACT` = v2.1 规范或实现源码中可直接读出的陈述。
- `INFERENCE` = 由 v2.1 缺失语义推导出的设计漏洞（规范未定义该状态机/字段语义/缓存失效契约）。
- `COUNTEREXAMPLE` = 实现源码与 v2.1 语义不一致，且实现侧更弱，构成对 v2.1“可执行性”的反例。
- `SPEC_CONTRADICTION` = v2.1 内部两条陈述互相矛盾，或某条 P-gate 与 envelope 字段表合用后无法同时成立。

---

## 1. PROTOCOL_SECURITY_V2_1_VERDICT

**裁定：CONDITIONALLY_PROVEN — v2.1 在协议骨架上已修正首轮 8 个维度中的多数表面缺口（sessionEpoch/credentialVersion 入信封、ACK 去 patch 化、per-stream cursor、committed watermark cut、版本兼容矩阵、幂等与业务唯一约束分离、服务端权威 + 报告仅作风控信号），但被本席重点攻击的五个机制——session epoch 唯一状态机、网关/长连接节点的撤销传播、服务端推导 owner 后的逐实体授权与动态 owner 版本检查、ACK 去 patch 后的 pending-UI/状态查询收敛、per-stream 独立水位与“一条状态通道”之间的张力——仍处于“字段已命名、状态机未闭合”的阶段。**

v2.1 相对 v2.0 是实质进步：P3 已明确“网络幂等只处理重投；奖励/支付/占领/入盟仍须 domain business key”；P4 已明确“ACK 只解决命令生命周期，客户端 projection 只应用 ordered event/snapshot”；P6 已明确“snapshot cut 不依赖 published_at，使用 committed_seq”；P8 已明确“支持几个旧版本属产品策略，不是固定常数”；P10 已明确“缺失客户端报告不能改变权威结果”。本席接受这六条纠正，不再把首轮偏好升级为通用定律。

但“命名了字段”不等于“闭合了状态机”。本轮找到的关键问题不是“v2.1 没写 sessionEpoch”，而是：
1. `credentialVersion`（account 级）与 `sessionEpoch`（session 级）是两个独立计数器，v2.1 没有定义哪个事件递增哪个、二者如何组合校验、refresh 端点是否同时校验两者。没有这张事件→计数器映射表，登录/刷新/冻结/重置/盗用/多设备/离线恢复就没有唯一状态机（§3）。
2. P1“每个请求校验”只覆盖网关；长连接节点在 HELLO 之后对已建立流没有周期性 epoch 重校验，也没有撤销推送总线，因此撤销后 in-flight 事件继续投递（§3 PS-S5）。
3. P2“服务端推导 owner 并校验每个引用实体归属”是强声明，但实现侧 `CommandOwnerResolver` 只推导锁键不验权，`GameActionCommandHandler.validate` 仅对 3 类 territory 命令校验归属；encounter/batch/alliance-proxy/shared-army/spectator/admin-delegation 的逐实体授权在规范里只有“校验”二字、无规则表（§4 PS-C6/C7）。
4. 服务端动态追加的 owner（`territory-owner:X`、`encounter:E_B`）不在客户端 `expectedVersions` 中，C4“命令携带所有 touched owner 的 expectedVersions”与“服务端可追加 owner”合用后出现授权/版本检查空洞（§4 PS-C5）。
5. ACK 去 patch 后，ACK 丢失 + 命令被拒 + 客户端未订阅该命令事件所在 stream + statusUrl 查询结果与事件流 cursor 的关系全部未定义，pending-UI 可能永久悬挂或通过 statusUrl 的 `resultVersions` 偷开第二条状态通道，与 P4 直接冲突（§5 PS-A5/A8）。
6. P6 返回 per-stream 独立水位 map，跨流无一致 cut，与 P4“一条状态通道”存在张力——除非显式接受跨流滞后或引入全局 cut epoch（§6 PS-R7、§10 反例 2）。

实现侧（`backend/`）仍是 `CURRENT_IMPLEMENTATION = NON_CONFORMING`：无 sessions 表、无 sessionEpoch/credentialVersion、无 owner_epoch/fencing、无 stream_events/stream_heads、无 WS/SSE、无 statusUrl 查询、无 event seq/cursor、POST 不重试（`GameAPI.isRetryableMethod` 仅 GET/HEAD）、`OwnerLockRepository.sleepSync` 用 `Atomics.wait` 阻塞事件循环、login body 明文入 `api_logs`、`command_idempotency` 主键仍为 `(playerId, idempotencyKey)` 无 `(playerId, commandId)` 唯一约束、in_progress 幂等行无超时扫描。这些构成对 v2.1 多条 P-gate 的 COUNTEREXAMPLE，逐项标注于下。

**结论**：v2.1 已具备可验收的协议字段集，但若不补上 §3 的事件→计数器状态机、§4 的逐实体授权规则表与动态 owner 版本策略、§5 的 pending-UI/状态查询收敛契约、§6 的跨流 cut 语义与 statusUrl 字段的 advisory 标注，则 P1/P2/P4/P5/P6 仍为 NOT_PROVEN。

---

## 2. WHAT_V2_1_ACTUALLY_FIXED

首轮 findings 在 v2.1 中的处置（确认纠正后不再重复攻击）：

| 首轮 ID | v2.1 处置 | 本席态度 |
|---|---|---|
| PS-S1 盗用 30d token 无吊销 | v2.1 sessions 表含 `session_epoch/revoked_at/credential_version`，P1 明确递增事件 | 接受方向；但状态机未闭合（见 §3） |
| PS-C1 换 idempotencyKey 重放 | P3 + Constraint Rule 明确“网络幂等只处理重投；业务重复由 domain constraint 阻止” | 接受纠正 #1；不再要求 clientSeq 防业务重复 |
| PS-A3 EVENT.seq > ACK.eventSeq 强序 | P4 明确“ACK 只管命令生命周期；EVENT 可先于或后于 ACK” | 接受纠正 #2；撤销首轮该规则，§5 改攻 pending-UI 收敛 |
| PS-R1 delta 组装原子性 | P6 + stream_heads.committed_seq + player_read_snapshots.watermark | 接受方向；但跨流 cut 与 snapshot+watermark 原子 stamp 未定义（§6） |
| PS-E1 协议版本协商 | P8 + 兼容矩阵表 + release manifest | 接受方向；但未知字段/event type/patch 路径变化的客户端行为未定义（§8） |
| PS-T1 行军报告扣留→强制拉回 | P10 明确“缺失客户端报告不能改变权威结果” | 接受纠正 #6；撤销“强制拉回”建议，§7 改攻报告入权威 state + 风控信号可绕过 |
| 固定 body/viewport/限流数字 | O5/P12 “不使用万能固定数字” | 接受纠正 #5；§9 只攻成本模型缺失与 key 合并，不给定值 |
| ACK-of-ACK / N-1 / 固定宽限 | P8 “支持几个旧版本属产品策略” | 接受纠正 #4；§3/§8 把宽限与 N-1 标为产品策略选项 |

---

## 3. SESSION_EPOCH_AND_REVOCATION_ATTACKS

### [PS-S4][P0][SPEC_CONTRADICTION]
- **Attacked v2.1 clause**: P1“密码重置、账号冻结、显式登出和风险处置递增 credential/session epoch”；accounts 表 `credential_version`；sessions 表 `session_epoch, state, revoked_at`；Command envelope 同时携带 `sessionEpoch: 19` 与 `credentialVersion: 6`。
- **Preconditions**: 一个账号有多设备多会话；任意一条身份状态变更（重置/冻结/登出/风险处置）发生。
- **Packet/state timeline**:
  1. T0 账号 A 在设备 D1 有 session S1（sessionEpoch=5, credentialVersion=6），D2 有 S2（sessionEpoch=7, credentialVersion=6）。
  2. T1 密码重置。v2.1 未定义：重置递增 `accounts.credential_version`→7，是否同时把所有 sessions 的 `state` 置 `revoked` + `revoked_at=now`？是否递增每个 session 的 `session_epoch`？
  3. 若重置只递增 credentialVersion 不动 sessionEpoch：被盗的 access token（仍带 sessionEpoch=5）在只校验 sessionEpoch 的路径上仍通过，直到 TTL。
  4. 若重置递增每个 sessionEpoch：D2 的 S2 sessionEpoch 7→8，但 S2 的 token 里写的是 7，下一个请求 401——这是预期吗？还是重置只该 revoked_at 全量、sessionEpoch 不动（因为整行已 revoked）？
  5. T2 网关收到 D1 请求，同时校验 `credentialVersion(token)==accounts.credential_version` 与 `sessionEpoch(token)==sessions.session_epoch` 与 `sessions.state=='active'`。v2.1 未声明这三个校验的合取关系与任一失败的错误码区分。
- **Violated property**: 身份状态变更存在唯一状态机；两个计数器无歧义。
- **Why current wording does not prevent it**: P1 用“递增 credential/session epoch”把两个计数器并列但没给事件→计数器映射表；sessions 表注释“冻结/重置/撤销必须可立即使旧 epoch 失效”也未说清是改 epoch 还是改 state。
- **Required protocol/security revision**: v2.1 §04 增加一张显式状态机表（见 §10.7）：
  | 事件 | credential_version | account.status | 每个 session.session_epoch | 每个 session.state | revoked_at |
  |---|---|---|---|---|---|
  | 密码重置 / 管理员强制重置 | +1 | active | 不变 | revoked(全部) | now(全部) |
  | 冻结 | 不变 | frozen | 不变 | revoked(全部) | now(全部) |
  | 解冻 | 不变 | active | （需重新登录） | — | — |
  | 显式登出（本设备） | 不变 | 不变 | +1(本 session) | revoked(本) | now(本) |
  | 风险处置（本设备） | 不变 | 不变 | +1(本 session) | revoked(本) | now(本) |
  | 同设备重登录 | 不变 | 不变 | 新 session，epoch 由服务端签发 | active | — |
  网关与 refresh 端点对三字段做合取校验，错误码区分：`CREDENTIAL_VERSION_STALE` / `SESSION_EPOCH_STALE` / `SESSION_REVOKED` / `ACCOUNT_FROZEN`。
- **Acceptance trace/test**: 密码重置后，D1 用旧 access token 请求→401 `CREDENTIAL_VERSION_STALE`；D1 用旧 refresh token 刷新→401 `CREDENTIAL_VERSION_STALE`（refresh 也校验 credentialVersion）；冻结后所有 session 下一个请求→403 `ACCOUNT_FROZEN`。
- **Verification point(s)**: gateway（每请求三字段合取）、DB constraint（credential_version 单调、sessions.state CHECK）、runtime（mailbox dequeue 复校 session_epoch，见 PS-S6）、client（收到 401/403 后 flush pending + re-auth）。

### [PS-S5][P0][INFERENCE]
- **Attacked v2.1 clause**: P1“每个请求校验”；§04 step 5 `WS HELLO {sessionEpoch, cursorsByStream, subscriptions}`；序列图 step 2 认证在 gateway，长连接节点（Ordered Push Stream）独立。
- **Preconditions**: 玩家在 WS 长连接上订阅 stream；运营在玩家在线时冻结/重置账号。
- **Packet/state timeline**:
  1. T0 玩家 WS HELLO 携 sessionEpoch=5，gateway 校验通过，长连接节点建立 stream，开始推送 EVENT。
  2. T1 运营冻结账号→sessionEpoch 语义上失效（PS-S4 状态机：sessions.state=revoked, account.status=frozen）。
  3. T1..T2 session service 写 DB，但 v2.1 未定义 session service 到长连接节点的撤销推送总线，也未定义长连接节点对已建立流的周期性 epoch 重校验间隔。
  4. T2 长连接节点仍按 T0 的 epoch=5 推送 EVENT seq 991206..991215 给已被冻结的会话——撤销后 in-flight 事件继续投递，泄露被冻结账号仍在变化的 world 状态。
  5. 直到连接因心跳超时断开（P9 PING/PONG presence TTL），撤销才生效；该窗口 = presence TTL，可能远大于“即时”。
- **Violated property**: 撤销的即时性跨网关/长连接节点边界；已建立流上的 epoch 重校验。
- **Why current wording does not prevent it**: P1 的“每个请求校验”只覆盖请求/响应路径；对已建立的 WS/SSE 流，没有“每 N 秒重校验 epoch”或“撤销推送”语义。HELLO 是一次性校验。
- **Required protocol/security revision**: v2.1 §04 增加“长连接节点必须订阅 session 撤销总线（push）或以产品定义的间隔重校验 session_epoch/account.status；撤销后立即停止该 session 所有 stream 推送并下发 `SESSION_REVOKED` 控制帧”。按纠正 #4，重校验间隔与宽限是产品 SLO，不是固定常数，但必须显式声明且可测。
- **Acceptance trace/test**: 冻结账号后，长连接节点在产品声明的最大撤销传播时延内下发 `SESSION_REVOKED` 并停止推送；测量撤销→停止推送的 p99 时延 ≤ 声明 SLO。
- **Verification point(s)**: gateway（请求路径）、stream filter（长连接节点 epoch 重校验/撤销订阅）、client（收到 SESSION_REVOKED 后断开并 re-auth）。

### [PS-S6][P0][INFERENCE]
- **Attacked v2.1 clause**: §01 写入序列 step 2“authenticate · revocation/freeze/device policy”在 gateway；step 3 owner 推导；step 4 mailbox 序列化；Command envelope 携带 `sessionEpoch`。P1“每个请求校验”。
- **Preconditions**: 命令已通过 gateway 认证（epoch=5）进入 owner mailbox 排队；排队期间账号被冻结/重置（epoch 语义失效）。
- **Packet/state timeline**:
  1. T0 命令 C 经 gateway，epoch=5 校验通过，进入 owner mailbox（IN_PROGRESS）。
  2. T1 账号冻结。session service 更新 sessions/account。
  3. T2 runtime 从 mailbox 取出 C，按 §01 step 4-7 执行（owner lock → state load → validate → execute → commit）。v2.1 未在 mailbox dequeue 或事务内要求复校 session_epoch/account.status。
  4. C 在 epoch 已失效后仍提交，产生 outbox 事件与领域变更——被冻结账号的 in-flight 命令“漏过”撤销窗口完成。
- **Violated property**: 撤销与命令执行链路的一致性；in-flight 命令的 epoch guard。
- **Why current wording does not prevent it**: §01 把认证放在 step 2（gateway），其后无 epoch 复校阶段；P1“每个请求校验”不含“运行时 dequeue 复校”。
- **Required protocol/security revision**: §01 序列在 step 4（mailbox 序列化）之后、step 5（lock）之前增加 `4b epoch_guard`：若 `envelope.sessionEpoch != currentSessionEpoch(sessionId)` 或 `account.status != active` → 拒绝并写 `rejected_final` receipt，不进入锁等待、不产生 outbox。该复校读 sessions/account 表（或其授权缓存），与 gateway 校验相互独立。
- **Acceptance trace/test**: 命令进入 mailbox 后冻结账号，runtime dequeue 时在 epoch_guard 拒绝，receipt=rejected_final，无 outbox 事件，无领域变更。
- **Verification point(s)**: runtime（mailbox dequeue epoch_guard）、DB constraint（sessions.state/account.status）、stream filter（不产生事件）。

### [PS-S7][P1][SPEC_CONTRADICTION]
- **Attacked v2.1 clause**: P1“多设备是明确策略，不是偶然共享 token”；sessions 表 `device_id, state, session_epoch`；Session envelope step 2 返回 `devicePolicy`。
- **Preconditions**: 玩家手机+PC 同时在线；或多标签页共享同一 token；或离线设备恢复。
- **Packet/state timeline**:
  1. T0 设备 D1 登录得 session S1(epoch=5)；D2 登录得 S2(epoch=7)。devicePolicy 未在 v2.1 定义取值与语义（single/multi/isolated?）。
  2. 若 policy=single：D2 登录是否撤销 S1？v2.1 未定义“互踢”时 S1 的 stream 是否立即终止、是否下发 `SESSION_REPLACED`。
  3. 若 policy=multi：S1 与 S2 的 `clientSeq` 是否独立命名空间？同一 owner 命令从两设备交替到达 mailbox，expectedVersions 冲突如何向各自 ACK 反馈？v2.1 未定义 per-session clientSeq 命名空间。
  4. 多标签页共享同一 session token：标签页 A 显式登出→sessionEpoch+1 或 revoked；标签页 B 持同 token 立即失效——这是预期还是 bug？v2.1 未定义“同 token 多标签页”语义。
  5. 离线设备 D3（token 内 epoch=5, credentialVersion=6）3 天后上线，期间密码已重置（credentialVersion=7）。D3 的 refresh 请求若只校验 sessionEpoch 不校验 credentialVersion → 刷新成功（见 PS-S8）。
- **Violated property**: 多设备/多标签页策略与 epoch 的组合语义；clientSeq 命名空间。
- **Why current wording does not prevent it**: devicePolicy 字段存在但无取值表与状态机；sessions 表有 device_id 但未定义 per-device epoch vs account-epoch 的关系。
- **Required protocol/security revision**: devicePolicy 取值枚举 `single|multi|isolated` 与各自撤销/互踢/独立 seq 命名空间规则；多标签页共享 token 时登出仅撤销当前 UI 会话还是整 token，需显式声明。
- **Acceptance trace/test**: policy=single 时 D2 登录后 D1 在声明时延内收 `SESSION_REPLACED` 并停止；policy=multi 时两设备 clientSeq 独立、各自 ACK 独立反馈冲突。
- **Verification point(s)**: gateway（devicePolicy 校验）、runtime（per-session clientSeq 命名空间）、client（SESSION_REPLACED 处理）。

### [PS-S8][P0][INFERENCE]
- **Attacked v2.1 clause**: P1 递增事件含“风险处置”；Session envelope 返回 `credentialVersion` 与 `accessToken`；v2.1 未定义 refresh 端点的校验字段集。
- **Preconditions**: 攻击者盗取一台离线设备的 access+refresh token；受害者察觉后重置密码。
- **Packet/state timeline**:
  1. T0 受害者设备 D_off 持 access(TTL 短)+refresh(TTL 长)，token 内 credentialVersion=6。
  2. T1 攻击者物理/恶意软件取走 D_off 的 refresh token。
  3. T2 受害者重置密码→credential_version=7，所有 sessions revoked（PS-S4 状态机）。
  4. T3 攻击者用盗来的 refresh token 请求 refresh。v2.1 未定义 refresh 端点是否校验 credentialVersion。若 refresh 只校验 sessionEpoch/签名→刷新成功，攻击者获得新 access token（credentialVersion 仍是 6？还是服务端重签为 7？若重签为 7 则与 accounts.credential_version=7 一致但 session 已 revoked，应拒；若不重签则新 token 带旧 credentialVersion=6）。
  5. 无论哪种，若 refresh 端点不查 sessions.state=revoked，攻击者就绕过了密码重置的吊销。
- **Violated property**: refresh 端点的撤销完整性；credentialVersion 在 refresh 路径的校验。
- **Why current wording does not prevent it**: v2.1 只在 step 2 登录与 P1“每个请求”提到 epoch；refresh 是独立端点，未声明与登录同等的校验集。
- **Required protocol/security revision**: refresh 端点必须合取校验 `sessions.state=='active'` + `accounts.credential_version==token.credentialVersion` + `sessions.session_epoch==token.sessionEpoch`，任一不符即 401 并撤销该 session；refresh 成功后可选择递增 session_epoch（rotation）或保持，需显式声明。
- **Acceptance trace/test**: 盗 refresh token 后受害者重置密码，攻击者 refresh→401 `CREDENTIAL_VERSION_STALE` 或 `SESSION_REVOKED`，无新 access token 发放。
- **Verification point(s)**: gateway/refresh 端点（三字段合取）、DB constraint（sessions.state）、client（refresh 失败→重新登录）。

---

## 4. COMMAND_REFERENCE_AUTHORIZATION_ATTACKS

### [PS-C5][P0][SPEC_CONTRADICTION]
- **Attacked v2.1 clause**: C2“服务端推导完整 owner 集合”；C4“命令携带所有 touched owner 的 expectedVersions；任一冲突整体拒绝”；Owner Set Rule“执行阶段发现未声明 owner 必须回滚并重路由”；Command envelope `expectedVersions: {player:4815:401, city:92831:77}`。
- **Preconditions**: `startConquest`/`claimConquest`/`renameCity` 命令，其 owner 规则在实现中 `includePlayerTerritoryOwner: true`，服务端通过 `lookupTerritoryOwner(territoryId)` 动态追加 `territory-owner:X`（`CommandOwnerResolver.js:208-216`）。
- **Packet/state timeline**:
  1. T0 客户端发 startConquest，`expectedVersions` 只含 `player:4815:401` 与 `territory:T:55`（客户端知道的）。
  2. T1 服务端 owner 推导追加 `territory-owner:X`（X 是 territory 当前占领者，客户端不知道）。
  3. T2 按 C4，命令须携带所有 touched owner 的 expectedVersions。`territory-owner:X` 无客户端版本。两种实现选择都出问题：
     - (a) 服务端跳过 `territory-owner:X` 的版本检查 → 该 owner 的并发修改不被检测，丢失更新/抢占竞态。
     - (b) 服务端要求 `territory-owner:X` 的 expectedVersion → 命令因缺版本被拒，但客户端永远无法预先提供（X 是动态的）→ 命令永远无法提交。
  4. v2.1 未定义第三选项：服务端追加的 owner 用“服务端读版本”（server-side read version）而非客户端声明版本做 CAS。
- **Violated property**: 动态/服务端追加 owner 的版本检查闭环；C4 与 Owner Set Rule 的相容性。
- **Why current wording does not prevent it**: C4 笼统说“所有 touched owner”，未区分“客户端声明 owner”与“服务端追加 owner”；Owner Set Rule 只说“回滚并重路由”，未说重路由后追加 owner 的版本来源。
- **Required protocol/security revision**: v2.1 §01/§02 明确：`expectedVersions` 仅覆盖客户端可预知的 owner（player/city/territory 等稳定引用）；服务端追加的 owner（territory-owner、encounter、cell 等）使用事务内读取的当前 `aggregate_heads.version` 作为 read-version 做 CAS，不要求客户端声明。ACK/resultVersions 须返回这些追加 owner 的最终版本，供客户端下次作为已知 owner 纳入 expectedVersions。
- **Acceptance trace/test**: startConquest 触发 territory-owner:X 追加，命令提交且 territory-owner:X 的并发修改被服务端 read-version CAS 检测；ACK 返回 resultVersions 含 territory-owner:X 版本。
- **Verification point(s)**: runtime（owner 推导后对追加 owner 取 read-version + CAS）、DB constraint（aggregate_heads.version）、ACK（resultVersions 含追加 owner）。

### [PS-C6][P0][INFERENCE]
- **Attacked v2.1 clause**: P2“服务端推导 owner，并校验 payload 中 city/army/tile/alliance 等每个引用实体的归属与操作权限”；C2“校验所有引用实体权限”。
- **Preconditions**: 命令 payload 含间接引用、批量引用、联盟代理、共享军队、观战、管理员委托等非自有权引用。
- **Packet/state timeline**:
  1. T0 `startWorldCombat` payload `encounterId=E_B`（他人的遭遇）。owner 推导得 `[player:P_A, encounter:E_B]`（`CommandOwnerResolver.js:79-85`），仅锁不验权。
  2. T1 `GameActionCommandHandler.validate`（`GameActionCommandHandler.js:30-42`）只对 startConquest/claimConquest/renameCity 三类校验 territory 归属，对 encounter 无校验 → P_A 可对 P_B 的遭遇执行战斗操作。
  3. T2 `worldWorkerPersonUpdate` 携 `playerIds:[P_X, P_Y, ...]`、`personIds:[...]`（批量引用）。owner 推导锁全部（`CommandOwnerResolver.js:241-256`），但无逐实体归属校验——world worker 可 mutate 任意玩家的 person。
  4. T3 联盟代理：联盟领袖代联盟操作 `alliance:{id}`，v2.1 未定义谁可 act on alliance owner（leader? officer? 任意 member?），无 role→action 矩阵。
  5. T4 共享军队：联盟成员移动 `army:{id}`（联盟共享军队），v2.1 未定义 army.player_id 与 authenticated player 的关系校验（owner? 共享协议?）。
  6. T5 观战：玩家订阅 `battle:{id}` 的观战 stream，v2.1 未定义观战权限（参战方? 同盟? 公开?）与观战事件过滤。
  7. T6 管理员委托：admin 命令改 player:4815 状态，owner 路由为 `ops:global`（constant，`CommandOwnerResolver.js:95-97`），不进 player:4815 的 owner lease/aggregate_heads 版本检查 → 管理员写绕过 per-player fencing。
- **Violated property**: 逐实体授权规则；P2“每个引用实体”未细化为可执行规则表。
- **Why current wording does not prevent it**: P2 列了实体类型但无 role/permission 矩阵；实现侧 owner 推导与 validate 分离，validate 只覆盖 3 类。
- **Required protocol/security revision**: v2.1 §02 增加“引用实体授权矩阵”：行=实体类型（city/army/tile/encounter/alliance/battle/person），列=操作类（own/shared-alliance/spectator/admin-delegated），单元格=授权规则（如 `army.shared && alliance_member(army.alliance_id, player) && alliance_policy.allows_shared_command`）。实现侧 `CommandOwnerResolver` 的 `shared` 规则增加 `ownershipField` 声明，由统一 `ReferencedEntityOwnershipGuard` 在 validate 阶段执行。管理员委托命令必须同时锁并校验目标 player 的 owner lease/aggregate_heads（不绕过 fencing）。
- **Acceptance trace/test**: P_A 用 P_B 的 encounterId 调 startWorldCombat→403 `ENCOUNTER_NOT_OWNED`；worldWorkerPersonUpdate 含非授权 playerId→403；admin 改 player:4815 时持有 player:4815 owner lease 且 aggregate_heads.version CAS 通过。
- **Verification point(s)**: runtime（validate 阶段 ReferencedEntityOwnershipGuard）、DB constraint（alliance_members.role / army.player_id）、stream filter（观战事件按权限过滤）。

### [PS-C7][P1][COUNTEREXAMPLE]
- **Attacked v2.1 clause**: P2“校验 payload 中...每个引用实体的归属与操作权限”；C2。
- **Preconditions**: 任意 encounter 命令。
- **Packet/state timeline**:
  1. T0 实现 `CommandOwnerResolver` 对 `startWorldCombat/resolveWorldCombat` 规则为 `shared, prefix:'encounter', includePlayer:true`，只产出锁键 `[player:P_A, encounter:E_B]`，无 `ownershipField` 声明。
  2. T1 `GameActionCommandHandler.validate` 对 encounter 命令无任何归属校验（`GameActionCommandHandler.js:30-42` 仅 territory 三类）。
  3. T2 命令进入 `GameActionRegistry.execute`，领域层是否校验 encounter.initiator 取决于具体 action 实现，协议层不保证。
  4. v2.1 P2 要求协议层校验，实现协议层不校验 → COUNTEREXAMPLE。
- **Violated property**: 引用实体归属在协议层（validate）的可执行性。
- **Why current wording does not prevent it**: v2.1 把“校验”写在 P2 但未指定校验阶段（validate vs execute）与规则；实现把校验下放领域层，协议层空。
- **Required protocol/security revision**: 同 PS-C6；encounter 规则声明 `ownershipField:'initiatorPlayerId'`（或参与列表），在 validate 阶段由 guard 校验。
- **Acceptance trace/test**: P_A 用 P_B encounterId 调 startWorldCombat/resolveWorldCombat 均 403 `ENCOUNTER_NOT_OWNED`。
- **Verification point(s)**: runtime（validate guard）、DB constraint（encounter initiator 字段）。

---

## 5. ACK_EVENT_STATUS_QUERY_RACES

> 纠正 #2 已接受：EVENT 可先于或后于 ACK，不强制 EVENT.seq > ACK.eventSeq。本节攻击 ACK 去 patch 后的 pending-UI 与状态查询收敛。

### [PS-A5][P0][INFERENCE]
- **Attacked v2.1 clause**: P4“ACK 只解决命令生命周期；客户端 projection 只应用 ordered event/snapshot”；ACK envelope 含 `status, result, resultVersions, eventWatermarks, statusUrl`；Event envelope 含 `commandId`（可空）。
- **Preconditions**: 客户端发命令 C；C 产生的事件落在客户端未订阅的 stream（如共享 owner encounter:E_B 的 stream）。
- **Packet/state timeline**:
  1. T0 客户端发 C（startWorldCombat，事件产生在 `encounter:E_B` stream，客户端只订阅 `player:4815` 与 `zone:33:aoi:4815`，未订阅 `encounter:E_B`）。
  2. T1 服务端提交 C，产生 EVENT(streamKey=encounter:E_B, seq=...)；ACK 因网络丢失。
  3. T2 客户端未订阅 encounter:E_B stream → 永远收不到该 EVENT；ACK 丢失 → 不知道 C 终态。pending-UI 永久悬挂。
  4. T3 唯一恢复路径是 statusUrl 查询，但 v2.1 未定义客户端在“ACK 未到达 + 未收到同源 EVENT”时必须主动查 statusUrl 的触发条件与时延。
- **Violated property**: pending-UI 收敛；ACK 丢失 + 事件在未订阅 stream 时的恢复闭环。
- **Why current wording does not prevent it**: P4 说“projection 只应用 ordered event”，但未定义“命令终态的通知”在 ACK 丢失且 EVENT 不在已订阅 stream 时如何到达客户端。
- **Required protocol/security revision**: v2.1 §04 增加“客户端 pending-command 生命周期：发出 C 后启动 commandTimeout；若在超时内未收到 ACK 且未在已订阅 stream 收到 commandId=C 的 EVENT，则必须查 `statusUrl`；statusUrl 返回终态后 reconcile pending-UI（不应用 resultVersions 为 projection state，见 PS-A8）”。服务端可选在 player 自身 stream 推送一条轻量 `command.terminal` 事件（含 commandId/status）作为兜底通知。
- **Acceptance trace/test**: C 的事件在未订阅 stream + ACK 丢失，客户端 commandTimeout 后查 statusUrl 得 committed，pending-UI 收敛；projection 状态由后续 player stream 事件或 resync 更新。
- **Verification point(s)**: client（commandTimeout + statusUrl 查询）、gateway（statusUrl 端点）、stream filter（可选 command.terminal 兜底事件）。

### [PS-A6][P1][INFERENCE]
- **Attacked v2.1 clause**: P4 ACK 终态含 `status: committed|rejected_final|failed_final`；P3“可查询终态”。
- **Preconditions**: 命令被拒（expectedVersions 冲突或 validate 失败），不产生 commit/event；ACK 丢失。
- **Packet/state timeline**:
  1. T0 客户端发 C，expectedVersions 过期。服务端 validate/版本检查拒绝，status=rejected_final，无 outbox 事件。
  2. T1 ACK（rejected）丢失。客户端未收到任何 EVENT（无 commit），pending-UI 仍“in flight”。
  3. T2 v2.1 未定义“被拒命令的负通知”经 stream 投递（无 commit 即无 event）。客户端只能靠 statusUrl。
  4. T3 若客户端不主动查 statusUrl（PS-A5 未强制），pending-UI 永久悬挂；用户可能误以为“卡住”而重发新 commandId（非重试），产生重复意图。
- **Violated property**: 被拒命令的可靠通知；pending-UI 对负终态的收敛。
- **Why current wording does not prevent it**: P4 把状态通道限定为 event/snapshot，但被拒命令无 event；ACK 是唯一负通知，ACK 丢失即失联。
- **Required protocol/security revision**: 同 PS-A5 的 commandTimeout+statusUrl 机制覆盖 rejected_final/failed_final；或服务端在 player stream 推送 `command.terminal` 事件（含 rejected_final，不依赖 commit）。客户端收到后清除 pending-UI 并按 retryable 决定是否重试（同 commandId）。
- **Acceptance trace/test**: 被拒命令 + ACK 丢失，客户端 commandTimeout 后查 statusUrl 得 rejected_final，pending-UI 清除；不产生新 commandId 重复意图。
- **Verification point(s)**: client、gateway（statusUrl）、stream filter（command.terminal 兜底）。

### [PS-A7][P0][INFERENCE]
- **Attacked v2.1 clause**: P5“每个 stream 独立 cursor、head、retainedFrom 和 gap 状态”；D3“cursor 只能连续前移；发现 gap 停止并重放”；Event envelope `streamSeq, eventId`。
- **Preconditions**: 客户端订阅 stream，收到 seq 991200、991201，缺口 991202，再收到 991203。
- **Packet/state timeline**:
  1. T0 客户端检测 gap（991201→991203，缺 991202），按 P5 发 sync.request(cursor=991201)。
  2. T1 服务端组装 delta 返回 991202..committed_watermark（含 991203..991205）。
  3. T2 与此同时 live stream 继续推送 991204、991205（在 delta 请求 in-flight 期间到达）。
  4. T3 客户端同时持有 delta 返回的 991202..991205 与 live 推送的 991204..991205 → 若客户端不按 (streamKey, streamSeq) 或 eventId 去重，则重复应用 patch。
  5. v2.1 未定义客户端对“delta 续传”与“live 推送”并发到达的去重契约。
- **Violated property**: gap-fill delta 与 live push 的 exactly-once 应用。
- **Why current wording does not prevent it**: P5 说 per-stream cursor，但未声明客户端必须按 streamSeq/eventId 对已应用事件去重，也未声明 delta 期间 live stream 是否暂停。
- **Required protocol/security revision**: v2.1 §04 明确“客户端对每个 stream 维护已应用 streamSeq 集合（或 maxAppliedSeq），任何来源（live push / delta / snapshot 后续）的事件若 streamSeq ≤ maxAppliedSeq 则丢弃；delta 与 live 不互斥，去重由客户端按 streamSeq 保证”。或定义 delta 期间 live stream 暂停（resume 协议冻结 live 投递至 RESUME_OK）——二选一需显式声明。
- **Acceptance trace/test**: gap-fill 期间 live 推送并发到达，客户端按 streamSeq 去重，最终状态与服务端一致，无 patch 重复应用。
- **Verification point(s)**: client（streamSeq 去重）、stream filter（delta/live 并发或冻结语义）。

### [PS-A8][P0][SPEC_CONTRADICTION]
- **Attacked v2.1 clause**: P4“客户端 projection 只应用 ordered event/snapshot，禁止 ACK patch 与 EVENT patch 竞争覆盖”；ACK/statusUrl 返回 `resultVersions` 与 `eventWatermarks`；P3“可查询终态”。
- **Preconditions**: 客户端 event stream cursor 落后于命令实际提交点；客户端查 statusUrl。
- **Packet/state timeline**:
  1. T0 客户端 player:4815 stream cursor=991200。命令 C 提交，事件 seq 991205。ACK 丢失。
  2. T1 客户端查 statusUrl 得 `{status:committed, resultVersions:{player:4815:402}, eventWatermarks:{player:4815:991205}}`。
  3. T2 客户端本地 projection 仍在 991200（未收 991201..991205）。若客户端把 `resultVersions.player:4815=402` 当作 owner version 直接写入本地 → 本地 owner 版本跳到 402，但中间事件 991201..991204 的 patch 未应用（其它字段仍是 991200 时的值）→ 本地状态是“版本 402 的版本号 + 991200 的字段值”的混合体，后续基于 991200 的 expectedVersions 与服务端 402 冲突，且字段不一致。
  4. T3 这构成 P4 禁止的“第二条状态通道”：statusUrl.resultVersions 若被应用为 state，即 ACK/resultVersions patch 与 EVENT patch 竞争。
  5. v2.1 未声明 `resultVersions`/`eventWatermarks` 是 advisory（仅用于 pending-UI 与 cursor 推进）还是 authoritative（可应用为 state）。
- **Violated property**: P4 一条状态通道；statusUrl 字段的 advisory/authoritative 标注缺失。
- **Why current wording does not prevent it**: P4 禁止 ACK patch，但 statusUrl 返回的 resultVersions 与 ACK 同构；P4 未覆盖“查询路径”返回的状态字段。
- **Required protocol/security revision**: v2.1 §04 明确标注 `ACK.resultVersions`、`ACK.eventWatermarks`、`statusUrl` 返回的同名字段为 **advisory**：仅用于 (a) 推进客户端 cursor 到 eventWatermarks（若 cursor 更旧则跳，但必须随后用 snapshot/events 补齐状态），(b) pending-UI 显示终态；**不得**直接写入 projection 的领域字段。projection 领域字段只能由 event.patch 或 snapshot.payload 更新。若客户端发现 `eventWatermarks > localCursor + retainedFrom` 不可补齐 → 触发 resync（snapshot）。
- **Acceptance trace/test**: statusUrl 返回 resultVersions=402 但本地 cursor=991200，客户端不把 402 写入领域字段，而是触发 resync/snapshot 或继续追平事件至 991205；最终领域字段与服务端一致。
- **Verification point(s)**: client（advisory 字段不得入 projection）、gateway（statusUrl 字段标注）。

---

## 6. PER_STREAM_CURSOR_AND_SNAPSHOT_RACES

### [PS-R5][P1][INFERENCE]
- **Attacked v2.1 clause**: P5 per-stream cursor；stream_heads `(realm_id, stream_key) → committed_seq, retained_from_seq`；v2.1 未定义 stream 生命周期（创建/删除/重命名）。
- **Preconditions**: 客户端订阅 `alliance:42` stream；联盟解散；同 id 联盟后重建。
- **Packet/state timeline**:
  1. T0 客户端订阅 alliance:42，cursor=5000。
  2. T1 联盟解散，alliance:42 stream 删除。v2.1 未定义 sync.request 对已删除 stream 的响应（SNAPSHOT_REQUIRED? STREAM_GONE? 忽略?）。
  3. T2 客户端保留 cursor=5000。同 id 联盟重建，新 stream 的 seq 基线未定义：从 1 还是继续？
  4. T3 若新 stream 从 seq=1 起，客户端 cursor=5000 > head=1 → 客户端认为“已超前”，忽略所有新事件，联盟情报永久缺失。若继续递增，旧 stream 的 retained_from 已清，cursor=5000 无法续传 → SNAPSHOT_REQUIRED 但 stream 内容语义已变。
- **Violated property**: stream 生命周期的 cursor 一致性；删除/重建的 seq 基线。
- **Why current wording does not prevent it**: stream_heads 表只描述存活 stream；无 stream 墓碑/重建语义。
- **Required protocol/security revision**: stream 删除时下发 `STREAM_GONE {streamKey}` 控制帧，客户端丢弃该 stream cursor；重建时 stream_key 必须带不可复用代（如 `alliance:42#2`）或服务端强制对该客户端 SNAPSHOT_REQUIRED 新基线。sync.request 对已删除 stream 返回 `STREAM_GONE` 而非 SNAPSHOT_REQUIRED。
- **Acceptance trace/test**: 联盟解散→客户端收 STREAM_GONE 并丢 cursor；同 id 重建→新 stream_key 或 SNAPSHOT_REQUIRED，客户端不漏事件。
- **Verification point(s)**: stream filter（STREAM_GONE 下发）、client（丢弃 cursor）、DB constraint（stream_key 代际唯一）。

### [PS-R6][P1][INFERENCE]
- **Attacked v2.1 clause**: P5 per-stream；P7“权限 epoch 变化立即失效订阅”；AOI stream 绑定 viewport；sync.request `aoi.viewport, permissionEpoch`。
- **Preconditions**: 客户端快速切换 viewport（zone:33 → zone:34）。
- **Packet/state timeline**:
  1. T0 客户端 SUBSCRIBE_AOI viewport=zone:33 区域，得 stream `zone:33:aoi:4815`，开始接收 WORLD_EVENT。
  2. T1 客户端立即 SUBSCRIBE_AOI viewport=zone:34 区域。v2.1 未定义旧 `zone:33:aoi:4815` stream 是否立即终止、其 in-flight WORLD_EVENT 是否继续投递。
  3. T2 若旧 stream 的 in-flight 事件继续投递（viewport 已不覆盖），客户端收到已离开区域的事件——对玩家而言是“离开后仍看到那里变化”的信息泄露（虽是短暂，但可被脚本快速切换采样多区域）。
  4. T3 viewport 切换不是 permissionEpoch 变化（P7 只覆盖权限 epoch），故 P7 的“立即失效”不触发。
  5. T4 快速反复切换可制造大量 in-flight 残留 stream，消耗服务端 AOI fanout 预算（与 §9 资源耗尽叠加）。
- **Violated property**: viewport 切换的旧 stream 终止与 in-flight 丢弃；AOI 信息泄露窗口。
- **Why current wording does not prevent it**: P5/P7 未把“viewport 变更”纳入订阅失效事件；UNSUBSCRIBE_AOI 语义未定义。
- **Required protocol/security revision**: v2.1 §04 增加 `UNSUBSCRIBE_AOI {streamKey}` 幂等消息，服务端立即停止该 stream 推送并丢弃 in-flight patch；SUBSCRIBE_AOI 新 viewport 自动 UNSUBSCRIBE 旧 viewport stream（若不共存）。viewport 切换纳入订阅失效事件（非权限原因也要即时停推）。
- **Acceptance trace/test**: 快速切换 viewport 后，旧 stream 在声明时延内停止推送，0 条旧区域 WORLD_EVENT 到达；新 stream 正常。
- **Verification point(s)**: stream filter（UNSUBSCRIBE 立即停推+丢弃 in-flight）、client（切换时主动 UNSUBSCRIBE）。

### [PS-R7][P0][SPEC_CONTRADICTION]
- **Attacked v2.1 clause**: P4“状态只从一条有序事件通道应用”；P6“snapshot 返回 per-stream committed watermarks”；player_read_snapshots `stream_watermarks`（map）；sync.request `cursorsByStream`（map）。
- **Preconditions**: 客户端订阅多个有因果关联的 stream（player:4815 与 zone:33:aoi:4815）。
- **Packet/state timeline**:
  1. T0 命令 C（升级 city:92831，该城在 zone:33）提交，产生 player:4815 事件 seq=991205 与 zone:33:aoi:4815 事件 seq=991201（同一事务，不同 stream）。
  2. T1 客户端断线重连，sync.request cursorsByStream={player:4815:991180, zone:33:aoi:4815:991180}。
  3. T2 服务端返回 snapshot/delta，per-stream watermarks={player:4815:991205, zone:33:aoi:4815:991200}（zone stream 的 committed_seq 此刻只到 991200，991201 尚未 relay 完成或 zone runtime 滞后）。
  4. T3 客户端应用 player stream 至 991205（含 city 升级效果），zone stream 只至 991200（不含该 tile 变更）→ 客户端地图视图与玩家状态视图不一致：玩家 sees 自己城市已升级，但地图上该 tile 仍是旧状态。
  5. T4 这是跨流不一致 cut。P4 声称“一条状态通道”，但 per-stream 独立水位 map 是 N 条独立 cut，对有因果关联的流无法保证一致。P6 只说“per-stream committed watermark”，未承诺跨流一致。
- **Violated property**: 跨流一致 cut；P4 一条状态通道与 P6 多独立水位的相容性。
- **Why current wording does not prevent it**: P6 返回 map 但未声明跨流 cut 一致性级别（强一致 / 最终一致 / 接受滞后）。
- **Required protocol/security revision**: v2.1 显式声明二者之一：
  - (a) 接受跨流滞后：P4 改为“每个 stream 是独立状态通道，客户端须容忍跨流暂时不一致，领域语义不得假设跨流同一时刻一致”；或
  - (b) 引入全局 cut epoch：snapshot/delta 以单一 `commitEpoch` 截断所有 stream（所有 stream 的 watermark ≤ 该 epoch），客户端应用后所有流 ≤ 同一 cut。
  当前 P4+P6 措辞隐含 (b) 但字段实现是 (a)，属 SPEC_CONTRADICTION。
- **Acceptance trace/test**: 升级 zone:33 内城市后重连，若选 (b) 则 player 与 zone stream watermark 相等或 zone ≤ player 且客户端最终一致；若选 (a) 则显式文档化滞后容忍且客户端 UI 不崩。
- **Verification point(s)**: runtime（snapshot cut 一致性策略）、client（跨流一致性假设）、DB constraint（stream_heads 与全局 epoch 关系）。

### [PS-R8][P1][INFERENCE]
- **Attacked v2.1 clause**: P11“WebSocket、SSE 和 HTTP fallback 必须保持相同 commandId、event seq、cursor、错误和恢复语义”。
- **Preconditions**: 客户端在 WS 上收到部分事件后迁移到 HTTP fallback。
- **Packet/state timeline**:
  1. T0 WS 推送 seq 991200..991205，991206 in-flight（已发未到客户端）。
  2. T1 WS 断开，客户端迁移 HTTP fallback，发 sync.request。v2.1 未定义 cursor 报“最后应用 seq”（991205）还是“最后收到 seq”（991206，若到）。
  3. T2 若客户端报 991206 但未应用 → 服务端不重发 991206 → 丢失。若报 991205 → 服务端重发 991206 → 可能与 WS in-flight 重复。
  4. T3 P11 声称“相同 cursor 语义”但未定义迁移时 in-flight 的 flush 与 cursor 语义（应用 vs 接收）。
- **Violated property**: 跨传输迁移的 cursor 语义与 in-flight 处理。
- **Why current wording does not prevent it**: P11 是等价性声明，无迁移协议细节。
- **Required protocol/security revision**: 定义 cursor = “最后已应用 seq”（非已接收）；迁移前客户端必须等待 in-flight 应用或丢弃后以 lastAppliedSeq 续传；所有传输的事件按 (streamKey, streamSeq) 幂等去重（与 PS-A7 一致）。
- **Acceptance trace/test**: WS→HTTP 迁移期间 in-flight 991206，客户端以 lastAppliedSeq=991205 续传，HTTP 重发 991206，客户端去重或补齐，最终一致。
- **Verification point(s)**: client（lastAppliedSeq + 去重）、stream filter（跨传输 cursor 一致）。

---

## 7. AOI_PERMISSION_AND_SIDE_CHANNEL_ATTACKS

### [PS-O4][P0][INFERENCE]
- **Attacked v2.1 clause**: P7“推送取权威世界状态与当前 visibility 的交集”；Knowledge Rule“player_tile_vision 表示玩家知道什么”；D3“缺口检测”。
- **Preconditions**: 玩家订阅 AOI；存在战争迷雾与 intel_version；服务端按 visibility 过滤 WORLD_EVENT。
- **Packet/state timeline**:
  1. T0 服务端对不可见 tile 的事件过滤。v2.1 未定义被过滤事件是否消耗 stream_seq。
  2. T1 若过滤事件消耗 seq：客户端可见 seq 991200→991202（991201 是不可见 tile 事件被过滤）→ 客户端检测 gap，sync.request 补齐，服务端再次过滤 991201 → 永久 gap，cursor 无法前移（与 D3 冲突）。
  3. T2 若过滤事件不消耗 seq：seq 空间是“可见-only”，客户端无法区分“真实丢失事件”与“无事件”，D3 缺口检测对真实丢包失效（与 P5 冲突）。
  4. T3 旁路泄露：即使内容过滤，(a) 事件 patch 大小随驻军规模变化——可见 tile 的大驻军 patch 大于空 tile，泄露驻军量级（超过 intel_version 应暴露的精度）；(b) SUBSCRIBE_AOI 对不可占 tile 与可占 tile 的错误码/snapshot 大小不同，泄露占领状态；(c) 热区事件到达更快，timing 泄露活动密度；(d) SNAPSHOT_REQUIRED 的 snapshot 字节数随敌方密度变化，泄露敌情。
- **Violated property**: AOI 过滤的 seq 语义 + 旁路信道（大小/错误码/timing/snapshot 体积）。
- **Why current wording does not prevent it**: P7 只规定内容取交集，未规定 seq 分配策略与旁路归一化。
- **Required protocol/security revision**: v2.1 明确被过滤事件 **不消耗客户端可见 seq**（seq 空间为 per-(stream,player) 可见-only），真实丢包由独立 heartbeat/ack gap 检测；或为每个 player 维护独立可见 seq 空间。事件 patch 体积归一化（按 intel_version 暴露精度截断/填充），错误码统一（不可见与不存在同错误），snapshot 体积与实体密度解耦（分页+固定页大小）。
- **Acceptance trace/test**: 不可见 tile 事件不产生客户端可见 gap；可见 tile patch 体积不随驻军量级变化（在 intel_version 允许范围内）；不可占/可占 tile 错误码一致；snapshot 体积与敌方密度无关。
- **Verification point(s)**: stream filter（可见-only seq 空间、patch 体积归一化）、edge（错误码统一）、client（gap 语义）。

### [PS-O5][P1][INFERENCE]
- **Attacked v2.1 clause**: P7“权限 epoch 变化立即失效订阅”；sync.request `aoi.permissionEpoch: 58`。
- **Preconditions**: 玩家退盟/外交变更致 visibility 收回；有 in-flight WORLD_EVENT。
- **Packet/state timeline**:
  1. T0 玩家在联盟 A，订阅 zone:33 AOI，permissionEpoch=58，visibility 含联盟共享 tile。
  2. T1 玩家退盟→permissionEpoch 递增到 59，visibility 收回。v2.1 未定义服务端是否下发 `PERMISSION_EPOCH_CHANGED` 推送。
  3. T2 in-flight WORLD_EVENT（epoch 58 下产生、未投递）是否继续投递？若继续，玩家退出后仍收原联盟共享 tile 变更——情报残留泄露。
  4. T3 客户端不知道 epoch 已变（无推送），下次 sync.request 仍带 permissionEpoch=58；服务端须检测 stale 并强制 resubscribe，但“下次 sync”之前窗口内的 in-flight 泄露未定义。
  5. T4 SUBSCRIBE_AOI 响应是否返回当前 permissionEpoch 未定义——客户端无法知道自己的 epoch 何时变 stale。
- **Violated property**: 权限 epoch 变更的即时通知 + in-flight 丢弃 + 订阅 ack 携带 epoch。
- **Why current wording does not prevent it**: P7 说“立即失效”但无推送消息与 in-flight 丢弃语义。
- **Required protocol/security revision**: 权限变更命令 commit 后向 projection 发 `vision_invalidated`，push stream 向受影响 session 下发 `PERMISSION_EPOCH_CHANGED {newEpoch}` 并丢弃该 session 所有 in-flight AOI 事件（旧 epoch）；客户端据此重新 SUBSCRIBE_AOI（服务端用新 visibility 重算）。SUBSCRIBE_AOI 响应携带当前 permissionEpoch。
- **Acceptance trace/test**: 退盟后 ≤ 声明推送周期内收 PERMISSION_EPOCH_CHANGED，旧 in-flight AOI 事件 0 条到达；重订阅后仅含自身 vision。
- **Verification point(s)**: stream filter（撤销推送 + in-flight 丢弃）、client（重订阅）、runtime（vision_invalidated 事件）。

### [PS-O6][P1][COUNTEREXAMPLE]
- **Attacked v2.1 clause**: P10“缺失客户端报告不能改变权威结果；报告只能作为风控信号”；实现 `WorldMarchVerification` + `HeartbeatCommandHandler`。
- **Preconditions**: 行军进行中，客户端可扣留/伪造 march report。
- **Packet/state timeline**:
  1. T0 实现 `HeartbeatCommandHandler` 将 `sanitizeReportBatch` 结果写入 `gameState.worldMarchClientReports`（权威 state，首轮 PS-T1 已述）。
  2. T1 `verifyMission`（`WorldMarchVerification.js:102`）`if (!report) return null`——客户端扣留报告即不触发验证，风控信号缺失。
  3. T2 按 P10，行军权威推进由 `WorldMarchCore.computeMarchState(mission, nowMs)`（服务端时间）驱动，扣留报告不改变权威结果——这点 v2.1 正确。
  4. T3 但 v2.1 P10 要求“报告作为风控信号”，而实现把风控信号（clientReport）写入权威 state（gameState），且信号触发条件依赖客户端提供报告——风控信号可被客户端静默关闭。这违反 P10“报告作为风控信号”的可用性（信号应服务端主动采集，非客户端可选提交）。
  5. T4 `pullback-required` 状态若被任何下游消费来改变权威行军结果，则违反纠正 #6；若仅作风控告警则合规——v2.1 未约束下游消费。
- **Violated property**: 风控信号的服务端主动性与权威 state 的纯净性；P10 下游消费约束。
- **Why current wording does not prevent it**: P10 声明原则但未禁止“clientReport 入 authoritative state”与“验证依赖客户端提交”。
- **Required protocol/security revision**: `worldMarchClientReports` 移出权威 gameState（入临时观测表/读模型）；`verifyMissions` 在每个 world worker tick 对所有 active mission 用 `computeMarchState` 强制执行（服务端主动），report 缺失记 `no-report` 风控计数（非权威结果输入）；`pullback-required` 仅作风控告警，不得自动改写权威行军状态。
- **Acceptance trace/test**: 客户端 10 次心跳不发 report，服务端每 tick 仍输出验证（no-report 计数递增），行军权威推进不变；`gameState` 内无 `worldMarchClientReports` 字段。
- **Verification point(s)**: runtime（tick 强制验证）、DB constraint（clientReport 不入权威表）、stream filter（pullback-only 告警）。

---

## 8. VERSION_MATRIX_AND_TRANSPORT_ATTACKS

### [PS-V1][P0][INFERENCE]
- **Attacked v2.1 clause**: 兼容矩阵“未知字段和未知 event type 的行为逐类型定义”；Event envelope `schemaVersion, type, patch`；R3 expand-migrate-contract。
- **Preconditions**: 灰度发布新 event schema（v6→v7），旧客户端在线。
- **Packet/state timeline**:
  1. T0 v7 服务端产生新 event type `alliance.diplomacy.broken`，patch 路径从 `/alliance/relations/X` 改为 `/diplomacy/X`，schemaVersion=7。
  2. T1 旧客户端（consumer_read_range=[6,7] 但实际只实现到 v6）收到 schemaVersion=7 事件。矩阵说“逐类型定义”但未给出该类型的客户端行为。
  3. T2 选项未定义：客户端应 (a) 忽略未知 type 并标记 resync，(b) 强制 resync，(c) 应用 patch 到旧路径（错误）。若 (c) 则状态写错位置；若 (a) 则该事件对应的状态缺失直到 resync；若 (b) 则灰度期间频繁 resync 风暴。
  4. T3 未知命令字段：v4 客户端发命令带新字段 `allianceId`，v3 服务端忽略——若该字段改变语义（如指定联盟代理目标），静默忽略导致命令语义偏移。
  5. T4 矩阵“不能消费的事件进入 DLQ, cursor 不越过 gap”只覆盖后端消费者，客户端无 DLQ。
- **Violated property**: 未知 event type / patch 路径变化 / 未知字段的客户端精确行为。
- **Why current wording does not prevent it**: “逐类型定义”把责任推给不存在的 per-type 规格。
- **Required protocol/security revision**: v2.1 §04 给出客户端默认规则：未知 event type 且 `schemaVersion > clientMaxConsume` → 不应用 patch + 触发一次 resync（非每条都 resync，按 schemaVersion 批次）；patch 路径含未知段 → 同上；未知命令字段 → 服务端按 `protocol.write` 严格校验（未知必填字段拒绝，未知可选字段忽略并记录），不得静默改变语义。事件 schema 升级必须先部署可读新 schema 的客户端（矩阵 Event Schema 行已写，但需强制客户端同序）。
- **Acceptance trace/test**: 旧客户端收 schemaVersion=7 未知 type 事件，不应用 patch、触发一次 resync、状态最终一致；未知命令字段被拒绝或忽略但不偏移语义。
- **Verification point(s)**: client（未知事件 resync 策略）、gateway（未知字段严格校验）、stream filter（schemaVersion 标注）。

### [PS-V2][P1][INFERENCE]
- **Attacked v2.1 clause**: 兼容矩阵 Client Protocol `min_read/max_read/write_version/deprecation_at`；Release Identity“原子切换整个兼容组合；回滚选择另一份完整 manifest”；P8“支持几个旧版本属产品策略”。
- **Preconditions**: v3→v4 灰度上线后回滚到 v3；v4 客户端在线且有 v4 形态本地状态。
- **Packet/state timeline**:
  1. T0 v4 服务端+v4 客户端在线，v4 事件已应用（新字段/新路径写入客户端 projection）。
  2. T1 回滚到 v3 服务端（manifest read=[2,3], write=3）。v4 客户端的 protocolVersion=4 不在 v3 read=[2,3] → 命令被拒。
  3. T2 v4 客户端本地状态含 v4 形态字段，v3 服务端 snapshot 不含这些字段。v2.1 未定义客户端检测到 downgrade 后是否强制全量 resync + 丢弃 v4 本地形态。
  4. T3 旧 v3 客户端长期在线跨过 v3→v4→v3 周期：v4 期间它可能被强制升级（deprecation_at），若未升级则 v4 服务端按宽限只读（产品策略）；回滚后 v3 服务端对其正常。但若 v4 期间该 v3 客户端应用了 v4 下发的“向前兼容”事件，回滚后这些事件在 v3 语义下无效——v2.1 未定义回滚后的客户端 state invalidation。
- **Violated property**: 回滚后客户端 downgrade 检测与 state invalidation；旧客户端长期在线跨版本周期。
- **Why current wording does not prevent it**: R3/矩阵只定义服务端 manifest 切换，未定义客户端 downgrade 响应。
- **Required protocol/security revision**: 服务端在 BOOTSTRAP/HELLO 返回 `releaseMatrix`（已含）+ `downgradeFromReleaseId`（若当前客户端 releaseId > 服务端 releaseId）；客户端检测到 downgrade 后强制全量 resync 并丢弃本地 v4 形态字段；旧客户端长期在线的宽限与强制升级是产品策略（纠正 #4），但 downgrade 必触发 resync 是协议硬规则。
- **Acceptance trace/test**: v4 客户端连回滚后的 v3 服务端，收到 downgrade 指示，触发全量 resync，本地 v4 字段被 v3 snapshot 覆盖，后续命令正常。
- **Verification point(s)**: gateway（releaseMatrix + downgrade 检测）、client（downgrade→resync）、runtime（snapshot 覆盖 v4 形态）。

### [PS-V3][P1][COUNTEREXAMPLE]
- **Attacked v2.1 clause**: P11“WebSocket、SSE 和 HTTP fallback 必须保持相同 commandId、event seq、cursor、错误和恢复语义”。
- **Preconditions**: 任意部署需提供传输等价。
- **Packet/state timeline**:
  1. T0 实现侧 `backend/` 无 WebSocket、无 SSE、无 EventSource（`rg` 全仓无命中，仅 HTTP 轮询）。P11 完全未落地。
  2. T1 即便实现，P11 是等价性声明，未定义映射表：HTTP fallback 无 push → 客户端须 poll sync.request，poll 返回批量事件与 WS 单条流的 ordering 不同；WS 有帧级背压，HTTP 无；WS close code vs HTTP 429 vs SSE retry 语义不同。
  3. T2 P11 与 P5（per-stream cursor）合用：HTTP fallback 的 cursor 续传与 WS 的 live push 须去重（PS-R8），但 P11 未要求客户端跨传输去重。
- **Violated property**: 传输等价的可验证映射。
- **Why current wording does not prevent it**: P11 仅断言等价，无 per-transport 映射表；实现连 WS/SSE 都不存在。
- **Required protocol/security revision**: v2.1 §04 增加 per-transport 映射表：cursor/seq/backpressure/各错误类在 WS/SSE/HTTP 间的对应；客户端跨传输按 (streamKey, streamSeq) 去重为硬规则。实现须至少有两种传输可互操作验证。
- **Acceptance trace/test**: 同一客户端 WS→SSE→HTTP 两次迁移，最终状态与服务端一致，cursor 连续，无重复/丢失；错误码跨传输语义等价。
- **Verification point(s)**: edge（三传输映射）、client（跨传输去重）、stream filter（cursor 一致）。

---

## 9. RATE_LIMIT_AND_RESOURCE_EXHAUSTION_ATTACKS

### [PS-L4][P0][INFERENCE]
- **Attacked v2.1 clause**: P12“按 endpoint、IP、account、session、player、owner、命令类型、body 深度/解压后大小和 AOI 成本分别限额”；O5“不使用万能固定数字”。
- **Preconditions**: 任意公网客户端（无认证或持有效/被盗 token）。
- **Packet/state timeline**:
  1. T0 多维限流的 key 合并未定义：per-IP AND per-account AND per-session 的合取/析取关系未规定。攻击者 behind NAT（多账号一 IP）触发 IP 限额→阻塞所有 NAT 内合法用户（误伤）；攻击者多 IP 一账号（botnet）→ 不触任何 IP 限。
  2. T1 代理 IP：v2.1 未定义 trusted proxy hop counting，攻击者伪造 `X-Forwarded-For` 轮换“client IP”绕过 IP 限。
  3. T2 攻击者切换 token：持 N 个被盗 token 获得 N× per-account 预算；v2.1 无 per-device 或 per-(IP×account) 组合限。
  4. T3 昂贵查询成本模型：P12 说“AOI 成本”但未定义成本单位（per-tile? per-viewport-area? per-changed-tile? per-snapshot-byte?）。无可测成本模型则限额不可执行。
  5. T4 实现 COUNTEREXAMPLE：`backend/` 仅 ops login 有 5/15min 限制（`OpsAuthService`），玩家 login、命令、heartbeat、AOI 全无限流；`OwnerLockRepository.sleepSync` 用 `Atomics.wait`（`OwnerLockRepository.js:19-28`）阻塞事件循环——少量并发同 owner 命令即可冻结全站连接达 `DEFAULT_WAIT_MS=10s`。`express.json({limit:'8mb'})` 无深度/数组限制；login body 明文入 `api_logs`（`server.js:123-142`，含 password）。
- **Violated property**: 多维限流 key 合并 + 代理 IP + token 切换 + 成本模型 + 事件循环阻塞。
- **Why current wording does not prevent it**: P12 列了维度但无 key 合并策略、成本模型、代理 IP 信任边界；实现侧全缺。
- **Required protocol/security revision**（按纠正 #5 不给定值，只给机制）：v2.1 §04 增加 (a) 限流 key 合并表：超任一维度即拒，维度间不互豁；NAT/代理场景以 trusted hop count 取真实 IP；(b) per-(IP×account) 或 per-device 组合维度防 token 切换；(c) AOI 成本模型声明（按 viewport 面积×changed 比例或 snapshot 字节，由 endpoint 实测定）；(d) 事件循环禁止同步阻塞，owner 等待必须异步（async lock 或排队拒绝），`Atomics.wait` 须移除；(e) login body 脱敏入日志。
- **Acceptance trace/test**: NAT 多账号不误伤单账号用户；XFF 伪造不能轮换 IP；N 个被盗 token 不获得 N× 预算（per-device 触发限）；AOI 成本可测且限额触发；同 owner 并发不阻塞事件循环；`api_logs` 无明文 password。
- **Verification point(s)**: edge（IP/限流/trusted proxy）、gateway（account/session/player 限流）、runtime（owner 异步等待、不阻塞事件循环）、DB constraint（login 日志脱敏）、client（429+retry-after 处理）。

### [PS-L5][P1][COUNTEREXAMPLE]
- **Attacked v2.1 clause**: D1“terminal receipt 与领域写入同事务提交”；F1“恢复后 receipt/job/Saga reconciliation”；实现 `CommandCommitter` + `CommandIdempotencyStore` + 部署 `pm2 restart`。
- **Preconditions**: 命令执行中进程被重启/崩溃。
- **Packet/state timeline**:
  1. T0 命令 C 进入 `CommandCommitter.commit`：先 `repository.save(state)`（`CommandCommitter.js:77`）持久化领域状态，后由 pipeline `_recordTerminal` → `idempotencyStore.recordResult`（`CommandIdempotencyStore.js:204-246`）单独事务写终态。两步非原子（v2.1 §01 implementation note 已承认 D1 未满足）。
  2. T1 进程在 save 后、recordResult 前崩溃。重启后 `command_idempotency` 残留 `status=in_progress` 行（无 result），无超时扫描（`abandon` 仅显式调用，`CommandIdempotencyStore` 无定时清理）。
  2a. v2.1 stream_heads/outbox 与 terminal receipt 的原子性也依赖 D1；D1 未满足意味着 committed_seq 可能与 receipt 不一致。
  3. T2 客户端重试同 key → `_inspectExisting` 见 in_progress → 409 `COMMAND_IN_FLIGHT` retryable（`CommandIdempotencyStore.js:130-145`）；客户端不敢换 key（怕重复执行）→ 命令永久卡死。
  4. T3 `PresenceService` 纯内存（首轮 PS-R4），重启后在线状态归零。
- **Violated property**: 重启后 in-flight 恢复 + receipt/job 对账 + 幂等行超时清理。
- **Why current wording does not prevent it**: v2.1 D1/F1 定义了目标但实现未达；F1“receipt/job/Saga reconciliation”未定义 in_progress 幂等行的超时策略。
- **Required protocol/security revision**: D1 原子提交（v2.1 已要求，实现须补）；`command_idempotency` 增加 `created_at` 索引，启动时扫描 `status=in_progress AND created_at < now - inFlightTimeout`，按策略 `abandon`（允许同 key 重试）或标 `failed_final`（客户端换 commandId 重发）；F1 增加该扫描步骤。
- **Acceptance trace/test**: 命令执行中 kill 进程，重启后 in_progress 行在 inFlightTimeout 后可重试或明确 failed，不永久 COMMAND_IN_FLIGHT。
- **Verification point(s)**: runtime（启动扫描）、DB constraint（in_progress 超时索引）、client（IN_FLIGHT 后按策略重试或换 ID）。

---

## 10. REQUIRED_ENVELOPE_AND_STATE_MACHINE_REVISIONS

字段标注：**A**=authoritative（服务端权威，客户端须接受）；**a**=advisory（供决策/对齐，不得作为 projection state 应用）；**d**=derived（可由其他字段/状态导出）。新增/强化字段以 ▲ 标记。

### 10.1 Session Envelope（登录/重连协商）

| 字段 | 类型 | 标注 | 语义 | 必填 | 备注 |
|---|---|---|---|---|---|
| sessionId | uuid | A | 服务端签发会话标识 | 是 | 进入幂等主键 |
| accessToken | string | A | 短 TTL access | 是 | |
| refreshToken | string | A | 长 TTL 可吊销刷新 | 是 | refresh 端点合取校验 credentialVersion+sessionEpoch+state |
| realmId | uint64 | A | realm | 是 | |
| credentialVersion | uint32 | A | account 级凭据版本 | 是 | 密码重置/管理员强制重置递增；refresh 也校验 |
| sessionEpoch | uint32 | A | session 级纪元 | 是 | 显式登出/风险处置递增（本 session）；冻结/重置改为 revoked 不递增 epoch |
| devicePolicy | enum | A | single\|multi\|isolated | 是 | ▲ 取值枚举与互踢/独立 seq 规则 |
| deviceClass | string | A | 设备类别 | 是 | ▲ 多设备独立 clientSeq 命名空间 |
| tokenExpiresAt | serverTime | A | access 失效时间 | 是 | |
| acceptedProtocolVersion | uint32 | A | 服务端接受的协议版本 | 是 | |
| requiredConfigVersion | uint32 | A | 当前必需配置版本 | 是 | |
| ▲ downgradeFromReleaseId | string\|null | A | 客户端 releaseId 高于服务端时返回 | 否 | 触发客户端全量 resync |
| upgradeRequired | bool | a | 是否必须升级 | 否 | 宽限期只读属产品策略 |
| serverTime | serverTime | A | 服务端当前时间 | 是 | |

### 10.2 Command Envelope

| 字段 | 类型 | 标注 | 语义 | 必填 | 备注 |
|---|---|---|---|---|---|
| protocolVersion | uint32 | a | 客户端声明协议版本 | 是 | 服务端按矩阵校验 |
| eventSchemaVersion | uint32 | a | 客户端声明事件 schema 版本 | 是 | |
| releaseId | string | a | 客户端构建 release | 是 | downgrade 检测 |
| sessionId | uuid | A | 会话引用 | 是 | 须匹配服务端 session |
| sessionEpoch | uint32 | a | 客户端携带 epoch | 是 | 服务端复校权威 epoch |
| credentialVersion | uint32 | a | 客户端携带 | 是 | 服务端复校 |
| realmId | uint64 | A | realm | 是 | |
| commandId | uuid | a | 客户端生成稳定重试锚点 | 是 | 独立唯一约束；按纠正 #1 不替代业务唯一 |
| clientSeq | uint53 | a | per-session 单调投递序号 | 是 | 按纠正 #1 只管投递重试，不管业务唯一 |
| expectedVersions | map(ownerKey→uint64) | a | 客户端可预知 owner 的预期版本 | 是 | 服务端追加 owner 用 server read-version（PS-C5） |
| type | string | a | 命令类型 | 是 | |
| payload | object | a | 意图与参数 | 是 | 经 schema 校验；未知字段严格校验（PS-V1） |
| clientConfigVersion | uint32 | a | 客户端配置版本 | 是 | |
| clientRulesetVersion | uint32 | a | 战斗命令必填 | 否 | |
| ▲ lastAckSeqs | map(streamId→uint64) | a | piggyback 确认 | 否 | 推进服务端保留游标 |
| trace | object | a | 客户端动作 trace | 否 | |

### 10.3 Command ACK / statusUrl

| 字段 | 类型 | 标注 | 语义 | 必填 | 备注 |
|---|---|---|---|---|---|
| commandId | uuid | d | 对应命令 | 是 | |
| status | enum | A | committed\|rejected_final\|failed_final | 是 | 命令生命周期终态 |
| result | object | A | 命令结果 | 否 | ▲ 供 UI 显示，不得作为 projection 领域字段 |
| resultVersions | map(ownerKey→uint64) | **a** | 提交后各聚合版本 | 否 | ▲ advisory：仅 cursor 对齐/pending-UI，不得写入 projection（PS-A8） |
| eventWatermarks | map(streamKey→uint64) | **a** | 各 stream committed 水位 | 否 | ▲ advisory：仅 cursor 推进，不得作 state |
| statusUrl | string | A | 可查询终态端点 | 是 | |
| serverTime | serverTime | A | | 是 | |
| retryable | bool | a | 是否可安全重试同 commandId | 否 | |
| ▲ resyncRequired | bool | a | 是否需全量同步 | 否 | |

### 10.4 Event（有序推送）

| 字段 | 类型 | 标注 | 语义 | 必填 | 备注 |
|---|---|---|---|---|---|
| streamKey | string | A | 流标识 | 是 | |
| streamSeq | uint64 | A | per-stream 单调 | 是 | 可见-only seq 空间（PS-O4） |
| committedWatermark | uint64 | A | stream 已提交水位 | 是 | |
| ownerVersion | uint64 | A | 关联聚合版本 | 是 | |
| schemaVersion | uint32 | A | 事件 schema 版本 | 是 | 旧客户端 resync 判据 |
| type | string | A | 事件类型 | 是 | |
| eventId | uuid | A | 事件唯一标识 | 是 | 客户端去重 |
| commandId | uuid | a | 触发命令 | 否 | 因果链接；非命令事件为空 |
| serverTime | serverTime | A | | 是 | |
| patch | json-patch[] | A | 状态增量（唯一 state 通道） | 否 | |

### 10.5 Sync Request

| 字段 | 类型 | 标注 | 语义 | 必填 | 备注 |
|---|---|---|---|---|---|
| type | enum | a | sync.request\|bootstrap\|resume | 是 | |
| sessionEpoch | uint32 | a | 客户端携带 | 是 | 服务端校验 |
| releaseId | string | a | 客户端 release | 是 | downgrade 检测 |
| cursorsByStream | map(streamKey→uint64) | a | 各流最后 **已应用** seq | 是 | ▲ 应用 seq 非接收 seq（PS-R8） |
| knownOwnerVersions | map(ownerKey→uint64) | a | 客户端已知聚合版本 | 是 | |
| aoi.zoneId/viewport | object | a | AOI 订阅状态 | 否 | |
| aoi.permissionEpoch | uint32 | a | 客户端最后已知权限 epoch | 否 | 服务端检测 stale |
| protocolVersion | uint32 | a | | 是 | |
| configVersion | uint32 | a | | 是 | |

### 10.6 Sync Response

| 字段 | 类型 | 标注 | 语义 | 必填 | 备注 |
|---|---|---|---|---|---|
| type | enum | A | RESUME_OK\|SNAPSHOT_REQUIRED\|DELTA\|STREAM_GONE | 是 | ▲ STREAM_GONE（PS-R5） |
| resumeFromSeq | map(streamKey→uint64) | A | 续传起始 | 是 | |
| snapshotEventSeq | uint64 | A | 快照对应事件 seq | 否 | snapshot 时必填；须与 payload 原子 stamp（§10 反例 3） |
| events | event[] | A | 增量事件 | 否 | |
| snapshot | object | A | 全量快照 | 否 | |
| retainedFromSeq | map(streamKey→uint64) | A | 保留窗口下界 | 是 | |
| serverTime | serverTime | A | | 是 | |
| configVersion | uint32 | A | | 是 | |
| ▲ downgradeFromReleaseId | string\|null | A | downgrade 指示 | 否 | |
| ▲ newPermissionEpoch | uint32 | A | 权限 epoch 变更 | 否 | |

### 10.6b Snapshot Envelope（全量快照，独立 state 入口）

对应 `player_read_snapshots` 表。关键约束：`payload` 与 `streamWatermarks` 必须在同一事务原子 stamp（`as of watermark` 快照隔离下读取），否则 P4“snapshot + seq>watermark 精确重建”不成立（§10.9 反例 3）。

| 字段 | 类型 | 标注 | 语义 | 必填 | 备注 |
|---|---|---|---|---|---|
| snapshotId | uuid | A | 快照唯一标识 | 是 | |
| realmId | uint64 | A | realm | 是 | |
| playerId | uint64 | A | 快照所属玩家 | 是 | |
| streamWatermarks | map(streamKey→uint64) | A | 各 stream 已提交水位（cut 点） | 是 | 须与 payload 原子 stamp；跨流 cut 策略见 PS-R7 |
| ownerVersions | map(ownerKey→uint64) | A | 各聚合在 cut 点的版本 | 是 | 客户端据此构造后续 expectedVersions |
| payload | object | A | 全量 projection 状态（唯一 state 入口之一） | 是 | replaceProjection 语义，非 patch |
| configVersion | uint32 | A | 快照对应配置版本 | 是 | |
| eventSchemaVersion | uint32 | A | 快照对应事件 schema 版本 | 是 | |
| releaseId | string | A | 快照对应 release | 是 | downgrade 检测 |
| createdAt | serverTime | A | 快照生成时间 | 是 | |
| ▲ cutEpoch | uint64\|null | A | 全局 cut epoch（若选一致 cut 策略） | 否 | 若选跨流滞后策略则可空 |

### 10.7 Session Epoch 状态机（PS-S4 修订）

事件→计数器映射表见 §3 PS-S4。关键不变量：
- `credentialVersion` account 级单调，仅密码重置/管理员强制重置递增；冻结不递增（改 status）。
- `sessionEpoch` session 级单调，仅显式登出/风险处置（本 session）递增；冻结/重置改为 `state=revoked`，不递增 epoch（整行已失效）。
- 网关 + refresh + runtime mailbox dequeue 三处合取校验 `account.status=='active' && credentialVersion==token.credentialVersion && sessionEpoch==token.sessionEpoch && session.state=='active'`。
- 长连接节点订阅撤销总线或按产品 SLO 周期重校验（纠正 #4：周期是产品策略）。

### 10.8 “一条状态通道”P4 的可成立条件与客户端伪代码

P4 在三处反例下不成立（见下节）；若按下述三条件修订，P4 可成立，客户端伪代码如下：

**成立条件**：
1. `ACK/statusUrl.resultVersions` 与 `eventWatermarks` 标注 advisory，不得写入 projection 领域字段（PS-A8）。
2. 跨流 cut 语义显式声明：要么全局 cut epoch（一致），要么显式接受跨流滞后（P4 改为多独立通道+容忍）（PS-R7）。
3. snapshot `payload` 与 `stream_watermarks` 在同一事务原子 stamp（反例 3）。

**客户端 apply 伪代码**（修订后）：
```
onEvent(e):                       # 唯一 state 通道入口
  if e.streamSeq <= maxAppliedSeq[e.streamKey]: return  # 去重（PS-A7）
  applyPatch(projection, e.patch)            # 领域字段只能由 patch 更新
  maxAppliedSeq[e.streamKey] = e.streamSeq
onAck(ack):                       # 生命周期通道，非 state 通道
  pendingUI[ack.commandId] = ack.status      # UI only
  if ack.eventWatermarks[s] > maxAppliedSeq[s]:
     cursorHint[s] = ack.eventWatermarks[s]  # advisory，不写 projection
  if ack.resyncRequired: triggerResync()
onCommandTimeout(cmdId):
  status = query(statusUrl[cmdId])
  pendingUI[cmdId] = status.status           # UI only，不应用 resultVersions
  if status.eventWatermarks[s] > maxAppliedSeq[s] + retainedFrom[s]:
     triggerResync()                          # 不可补齐→全量
  else:
     continueEvent追赶()                       # 可补齐→继续追平事件
onSnapshot(snap):
  replaceProjection(snap.payload)            # 全量替换（另一唯一 state 入口）
  for s: maxAppliedSeq[s] = snap.streamWatermarks[s]  # 原子 stamp
```

### 10.9 “一条状态通道”的三反例（P4 不成立情形）

- **反例 1（statusUrl 第二通道，PS-A8）**：ACK/statusUrl 返回 `resultVersions`，若客户端应用为 projection owner 版本，则与 event patch 竞争——P4 禁止 ACK patch，但 statusUrl 同构字段未被 P4 覆盖。除非显式标 advisory，否则 P4 不成立。
- **反例 2（per-stream 独立水位 = N 通道，PS-R7）**：P6 返回 per-stream 独立 watermark map，跨有因果流无一致 cut，客户端可持 player@991205 + zone@991200 的不一致状态。P4“一条通道”在多独立水位下不成立，除非引入全局 cut 或显式接受跨流滞后。
- **反例 3（snapshot+watermark 非原子，§6 PS-R1/R7）**：`player_read_snapshots` 的 `payload` 与 `stream_watermarks` 若不在同一事务 stamp（snapshot builder 先读 stream_heads 再读状态，两次读非快照隔离），则 snapshot 状态与 watermark 不对应，客户端应用 snapshot 后再应用 seq>watermark 事件会重或漏。P4 要求“snapshot + seq>watermark 精确重建”，但未强制 stamp 原子性——除非声明 snapshot builder 在 `as of watermark` 快照隔离下读取，否则 P4 不成立。

---

## 11. REQUIRED_SECURITY_AND_PROTOCOL_TESTS

每条标注关闭 finding 与验证点位。

1. **T-SE-01 密码重置即时吊销全部 session**（PS-S4/S8，gateway+DB）：重置后所有 session 下个请求 401 `CREDENTIAL_VERSION_STALE`；盗 refresh token 刷新被拒。
2. **T-SE-02 冻结即时下线**（PS-S5/S6，stream filter+runtime）：冻结后长连接节点在声明 SLO 内下发 `SESSION_REVOKED` 停推；mailbox 内 in-flight 命令在 epoch_guard 拒绝、无 outbox。
3. **T-SE-03 多设备 policy**（PS-S7，gateway+runtime）：policy=single 互踢在声明时延内；policy=multi 两设备 clientSeq 独立、ACK 独立。
4. **T-SE-04 离线设备盗用恢复**（PS-S8，gateway）：离线设备盗 token + 受害者重置后，上线 refresh→401。
5. **T-AZ-01 动态 owner 版本检查**（PS-C5，runtime+DB）：startConquest 追加 territory-owner:X，read-version CAS 检测并发修改；ACK 返回其版本。
6. **T-AZ-02 encounter 跨玩家引用**（PS-C7，runtime）：P_A 用 P_B encounterId 调 startWorldCombat/resolveWorldCombat→403。
7. **T-AZ-03 批量/联盟代理/共享军队/观战/管理员逐实体授权**（PS-C6，runtime+DB）：各场景按授权矩阵校验；admin 委托不绕过 player owner lease。
8. **T-ACK-01 ACK 丢失+事件在未订阅 stream**（PS-A5，client+gateway）：commandTimeout 后查 statusUrl 收敛 pending-UI，不应用 resultVersions。
9. **T-ACK-02 被拒命令+ACK 丢失**（PS-A6，client+stream）：statusUrl 得 rejected_final，pending-UI 清除，不产生新 commandId。
10. **T-ACK-03 gap-fill 与 live 去重**（PS-A7，client）：并发到达按 streamSeq 去重，无重复 patch。
11. **T-ACK-04 statusUrl advisory**（PS-A8，client）：statusUrl resultVersions 不写入 projection；cursor 落后时触发 resync。
12. **T-SYNC-01 stream 删除/重建**（PS-R5，stream filter+client）：STREAM_GONE 下发，cursor 丢弃；重建不漏。
13. **T-SYNC-02 viewport 切换旧 stream 终止**（PS-R6，stream filter）：切换后旧 stream 0 条残留事件。
14. **T-SYNC-03 跨流 cut 一致性**（PS-R7，runtime+client）：按声明的 cut 策略验证跨流一致性或滞后容忍。
15. **T-SYNC-04 跨传输迁移**（PS-R8，client+edge）：WS→HTTP 迁移 cursor 连续、去重、最终一致。
16. **T-AOI-01 过滤 seq 语义+旁路**（PS-O4，stream filter+edge）：不可见事件不产生可见 gap；patch 体积/错误码/snapshot 体积归一化。
17. **T-AOI-02 权限 epoch 变更通知**（PS-O5，stream filter+client）：退盟后 PERMISSION_EPOCH_CHANGED 在声明周期内到达，旧 in-flight 0 条。
18. **T-AOI-03 行军报告风控信号**（PS-O6，runtime+DB）：扣留报告服务端仍每 tick 验证；clientReport 不入权威 state。
19. **T-VER-01 未知 event type/字段/patch 路径**（PS-V1，client+gateway）：旧客户端 resync 不崩；未知字段不偏移语义。
20. **T-VER-02 回滚 downgrade**（PS-V2，gateway+client）：v4 客户端连 v3 服务端触发全量 resync。
21. **T-VER-03 传输等价**（PS-V3，edge+client）：三传输互迁移一致。
22. **T-RL-01 多维限流 key 合并/代理 IP/token 切换/成本模型**（PS-L4，edge+gateway）：各维度不互豁；XFF 伪造无效；token 切换不获额外预算；AOI 成本可测；事件循环不阻塞；login 日志无明文密码。
23. **T-RL-02 重启 in-flight 清理**（PS-L5，runtime+DB）：kill 后 in_progress 行超时后可重试或 failed，不永久 IN_FLIGHT。

---

## 12. BLOCKING_QUESTIONS

**会话与撤销**
1. `credentialVersion`（account 级）与 `sessionEpoch`（session 级）的递增事件映射表是否采用 §10.7？若否，请给出唯一状态机。
2. refresh 端点是否与 login 同等合取校验 `credentialVersion + sessionEpoch + session.state`？
3. 长连接节点对已建立 stream 的 epoch 重校验机制是撤销推送总线还是周期重校验？最大撤销传播时延的产品 SLO 是多少？
4. mailbox dequeue 是否有 epoch_guard（§01 step 4b）？若无，in-flight 命令如何防漏过撤销窗口？
5. `devicePolicy` 取值枚举与互踢/独立 seq 命名空间规则是什么？多标签页共享 token 的登出语义是什么？

**授权与版本**
6. 服务端追加的 owner（territory-owner/encounter/cell）是否用 server read-version 做 CAS，而不要求客户端 expectedVersions？ACK resultVersions 是否返回这些 owner 版本？
7. encounter/army/alliance/battle/person 的逐实体授权矩阵在哪？validate 阶段的 `ReferencedEntityOwnershipGuard` 规则由谁声明（`ownershipField`）？
8. 管理员委托命令是否持有目标 player 的 owner lease 并做 aggregate_heads CAS（不绕过 fencing）？

**ACK/EVENT/状态查询**
9. ACK 丢失 + 命令事件在客户端未订阅 stream 时，客户端是否必须 commandTimeout 后查 statusUrl？是否在 player stream 推送 `command.terminal` 兜底事件？
10. `ACK.resultVersions`/`eventWatermarks`/`statusUrl` 同名字段是否标注 advisory（不得写入 projection）？
11. gap-fill delta 与 live push 并发时，客户端是否按 (streamKey, streamSeq) 强制去重？delta 期间 live 是否冻结？

**stream 与 snapshot**
12. 被 AOI 过滤的事件是否消耗客户端可见 streamSeq？可见 seq 空间是否 per-(stream,player)？
13. stream 删除是否下发 STREAM_GONE？重建 stream_key 是否带代际后缀或强制 SNAPSHOT_REQUIRED？
14. snapshot 的 `payload` 与 `stream_watermarks` 是否在同一事务原子 stamp（`as of watermark` 快照隔离）？
15. 跨流 cut 是全局 cut epoch 还是显式接受跨流滞后？P4“一条通道”在哪种语义下成立？

**AOI 旁路与权限**
16. 事件 patch 体积/错误码/snapshot 体积是否归一化以堵旁路？
17. 权限 epoch 变更是否有推送通知（PERMISSION_EPOCH_CHANGED）+ in-flight 丢弃？SUBSCRIBE_AOI 响应是否携带当前 permissionEpoch？

**版本与传输**
18. 未知 event type / patch 路径变化 / 未知命令字段的客户端默认行为是否显式（resync vs 忽略 vs 拒绝）？
19. 回滚 downgrade 是否触发客户端全量 resync + 丢弃高版本本地形态？
20. WS/SSE/HTTP 的 per-transport 映射表（cursor/seq/背压/错误类）在哪？实现是否至少有两种传输可互操作验证？

**限流与资源**
21. 多维限流 key 合并策略（合取/析取/不互豁）与 trusted proxy hop count 规则是什么？
22. AOI/snapshot 的成本模型单位是什么（可测）？per-device 或 per-(IP×account) 组合维度是否存在？
23. owner 等待是否异步（禁止 `Atomics.wait` 阻塞事件循环）？`command_idempotency` in_progress 是否有超时扫描？

---

*报告结束。本报告仅基于 v2.1 参考架构 HTML、本席首轮报告与 `backend/frontend` 通信、身份、命令 envelope、owner 解析与权限源码，未读取其他 `architecture-v2.1-adversarial-*` 报告及其他席位首轮报告，未修改任何代码/配置/数据库/进程/部署脚本/参考架构文件。唯一产出为 `tmp/architecture-v2.1-adversarial-glm-protocol-security.md`。*
