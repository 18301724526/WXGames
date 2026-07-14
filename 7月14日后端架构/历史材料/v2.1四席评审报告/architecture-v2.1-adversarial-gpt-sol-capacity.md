# GPT-SOL 第二轮：SLG 后端 v2.1 容量合同对抗审查

- 主评审对象：`docs/slg-backend-reference-architecture.html`
- 允许的首轮基线：`tmp/architecture-v2-adversarial-gpt-sol-capacity.md`
- 源码证据范围：命令热路径、认证、owner 锁、SQLite 持久化、world worker、事件/同步现状与前端 apply
- 方法：只读静态审查、排队网络与恢复模型；未执行公网压测，也未读取任何其他席位报告
- 总结论：`CAPACITY_CONTRACT_STATUS = NOT_PROVEN`
- 对抗结论：`SCHEMA_GAMEABILITY = CONFIRMED`

公式证据标签：每个公式输入均使用以下标签。`[MEASURED]` 表示必须来自绑定 release、硬件、数据形状和原始 trace 的实测；`[PRODUCT_SLO]` 表示必须由产品时序、正确性或运营承诺给定；`[MODEL_ASSUMPTION]` 只允许用于压测前的敏感性分析，不能据此判 PASS。公式左侧的 `[DERIVED]` 只是由带标签输入计算出的结果，不是第四类输入证据。

## 1. CAPACITY_V2_1_VERDICT

v2.1 修正了首轮最明显的“没有变量、没有阶段、没有队列、没有停止条件”问题，但它目前仍是一套要求填写的 schema，而不是可执行的 capacity contract。`workload` 示例允许字符串 `TBD`，`arrivalRate`、`thresholds` 和 `utilizationTarget` 仍是自由文本；它没有规定联合分布、命令类型混合、共享资源需求矩阵、重试反馈矩阵、数据来源、置信区间或 schema 校验。实现方仍可选择低峰时间窗、均匀 owner、暖缓存、短保留和无故障样本来“填满字段”，再以各阶段独立 `rho < 1` 宣称通过。

本轮对 44 个显式 gate 的结论是：**0 个获得当前 PASS，44 个均为 `NOT_PROVEN`；44 个 gate 均缺少至少一个使 PASS 唯一化的 scope、阈值、负载联合形状或原始证据字段。** 部分 gate 的负面条件足以直接判定某个坏实现 FAIL，但“没有触发该负面条件”不等于唯一 PASS。

[SOL21-001][BLOCKER][SPEC_CONTRADICTION]
- Attacked v2.1 clause: 容量章节称结论必须绑定完整 workload、阶段容量和停止条件，未填保持 `NOT_PROVEN`（HTML 1523-1524）；但 manifest 把关键值、阈值和阶段字段定义为可填任意字符串（1582-1624），没有机器可校验类型、联合样本引用或证据完整性规则。
- Workload vector: 全部 `U/P/A/V/W/F/Z/C/E/K_hot/M/B/R`，以及所有 burst profile、阶段 `lambda/S/Q/rho/D`。
- Failure mechanism: 实现方可分别选择每一阶段最有利的样本窗口，把 top-K 热点摊入平均值，把失败重试记为新流量而非反馈，把 queue 只报 items 不报 bytes，并让每阶段各自满足局部阈值；这些字段无法证明它们来自同一次端到端运行。
- Coupled capacity expression: `rho_r[DERIVED] = sum(x,c, lambda_xc[MEASURED] * d_xcr[MEASURED]) < rho_r,target[PRODUCT_SLO]` 才能约束共享资源 `r`。当前仅有 `rho_x[DERIVED] = lambda_x[MEASURED] * E[S_x][MEASURED]`，不能排除多个阶段共同打满同一 DB、CPU、磁盘或 NIC。
- Correctness/SLO impact: 容量 gate 可被填表规避；过载后会升级为 unknown commit、任务迟到、stream gap、磁盘耗尽和付费终态不确定。
- Missing metric or stop condition: typed schema、单位、采样窗口、分桶规则、联合 trace/run id、硬件隔离、置信区间、warm/cold 状态、错误与 retry 归属、raw evidence digest；缺任一字段即应停止并判 `NOT_PROVEN`。
- Required revision: 收益：让同一原始运行产生唯一判定；代价：需要 schema validator、证据仓库和运行编排；迁移风险：历史手工报告无法直接比较；前置指标：统一 trace id、单调时钟、资源计量和 workload recorder；停止条件：出现自由文本数值、TBD、单位缺失、跨运行拼接或原始证据 digest 不匹配时立即判失败。
- Acceptance test and raw evidence: 对 manifest 注入字符串数值、均值代替 top-K、不同 run 拼接、缺 queue bytes、缺失败样本和伪造 evidence digest；validator 必须逐项拒绝。保存 schema validation log、原始 manifest、run metadata 和 digest 校验输出。

[SOL21-002][HIGH][COUNTEREXAMPLE]
- Attacked v2.1 clause: H1/H2/W1/W2/O2 被写成未来验收目标，但 capacity contract 没有强制绑定具体 route、writer 和客户端 apply inventory。
- Workload vector: `C` 连接、heartbeat 命令混合、`K_hot`、worker 活跃 owner、状态字节、客户端设备档。
- Failure mechanism: 当前源码仍可作为“字段齐全不代表路径达标”的反例：`createHeartbeatDefinition()` 在 `backend/application/commands/GameCommandDefinitionFactory.js:117-139` 先读取完整玩家状态；`OwnerLockRepository._acquireOne()` 在 `backend/repositories/OwnerLockRepository.js:111-133` 同步 sleep 轮询；`GameStateRepository.writeGameStateRow()` 在 `backend/repositories/GameStateRepository.js:472-585` 重写大量 JSON；`WorldWorkerService.tickOnce()` 在 `backend/services/realtime/WorldWorkerService.js:584-663` 串行推进活跃集；前端 `CanvasGameApp.syncFromServer()` 在 `frontend/js/platform/CanvasGameApp.js:986-1089` 整态同步并 render。它们都可被一个只报平均阶段耗时的表隐藏。
- Coupled capacity expression: `lambda_hb[DERIVED] = C[MEASURED] / T_hb[MEASURED]`；同步阻塞占用 `CPU_eventloop[DERIVED] = sum(c, lambda_c[MEASURED] * S_sync,c[MEASURED])`；worker 一轮成本至少包含 `A_tick[MEASURED] * S_player[MEASURED]` 和成对外交 `Theta(F_active[MEASURED]^2)`。
- Correctness/SLO impact: 主要是容量反例；同步阻塞导致 lease 过期、retry storm 或客户端游标滞后时升级为正确性风险。当前实现不是参考架构容量结论，只证明 gate 必须绑定真实路径。
- Missing metric or stop condition: route/writer/apply inventory coverage、full-state bytes、同步阻塞 stack、每轮候选/处理/遗漏 owner、前端 long task；漏掉任一已注册路径必须停止认证。
- Required revision: 收益：阻止只挑“已优化路径”填表；代价：维护 route、command、job、consumer、client writer 清单；迁移风险：旧实现会立即暴露大量未覆盖项；前置指标：静态 inventory 与运行时命中计数；停止条件：inventory 中任一路径在测试中零命中或 trace 缺阶段时不得给 PASS。
- Acceptance test and raw evidence: conformance suite 必须检测上述五个现存反例；保留 CodeGraph symbol inventory、route hit count、blocked stack、SQL row/byte counters、worker tick raw summary 和客户端 performance trace。

## 2. WHAT_V2_1_ACTUALLY_FIXED

| 首轮缺口 | v2.1 的真实修复 | 本轮判定 |
| --- | --- | --- |
| 只看在线数/平均 QPS | 明确 `U/P/A/V/W/F/Z/C/E/K_hot/M/B/R`，要求分布、top-K、bytes、retention | `FIXED_AS_SCHEMA`；未覆盖命令混合、外部系统和维护负载 |
| 没有阶段排队模型 | 点名 gateway/auth/owner/DB/scheduler/relay/stream/snapshot/socket/client 十阶段，并要求 `lambda/S/Q/rho/D` | `FIXED_AS_INDEPENDENT_STAGE_SCHEMA`；未建立反馈和共享资源耦合 |
| 热 owner 被横向扩容口号掩盖 | W2 明确同 key 串行、top-K、queue bytes、10k burst，禁止用加机器提升单 key 服务率 | `SUBSTANTIVE_FIX`；仍缺每 owner 类型实测服务曲线和 admission 状态机 |
| scheduler 只有泛化“公平” | stable claim、priority、aging、lease steal、DLQ、同秒洪峰均进入 W3 | `SUBSTANTIVE_FIX`；未定义公平函数、deadline 类别和 owner-aware claim |
| outbox/snapshot/慢客户端未成 gate | 新增 W5-W7，要求 fanout、buffer、snapshot、retention、drain 和 checksum | `SUBSTANTIVE_FIX`；磁盘、恢复和前台资源尚未联立 |
| 过载拒绝不闭合 | W8 要求各层 queue 上限、拒绝语义、paid/non-paid deadline 和最终对账 | `FIXED_AS_REQUIREMENT`；receipt 前后、付费公平和 event 完整性仍无状态机 |
| 多 owner 与长事务边界含糊 | 引入 `M_max`、固定锁序和超限 Saga | `DIRECTION_FIXED`；`M_max` 的实测选择和阈值不连续未定义 |
| snapshot cut/outbox 混淆 | 引入 `stream_heads.committed_seq`、durable stream、consumer cursor、committed watermark | `CORRECTNESS_DIRECTION_FIXED`；stream head 热点与多 stream 锁数未计入 |
| 支付与历史规则缺位 | 引入 immutable ledger、persistent Saga、历史 ruleset/config 保留 | `DATA_SEMANTICS_FIXED`；长期规模、外部支付和恢复成本未建模 |

因此，v2.1 的正确评价不是“没有修复”，而是“把首轮问题转成了验收表格，但尚未把表格转成不可博弈的判定器”。

## 3. WORKLOAD_VECTOR_REBUTTAL

### 3.1 对现有变量的保留、增加和拆分

| v2.1 变量 | 动作 | v2.2 必须表达的联合形状 |
| --- | --- | --- |
| `U` | 保留并拆分 | realm/zone/cell、设备档、付费档、活跃动作档、前台/后台；必须与命令类型和连接数联合 |
| `P` | 拆分 | `P_hot/P_cold/P_archive/P_banned`、每类状态/索引 bytes、最近活跃、历史任务与 ledger 数；不能只报玩家总数 |
| `A` | 拆分 | `A_cmd/A_due/A_saga/A_maintenance/A_snapshot`，按窗口、owner 类型、deadline 和冲突图 |
| `V` | 拆分 | `V_candidate/V_visible/V_changed/DeltaV`，权限过滤前后与 viewport churn 分开 |
| `W` | 拆分 | `W_simulated/W_changed/W_written/W_replayed`，避免候选实体、实际变更和持久写混为一数 |
| `F` | 拆分 | 联盟成员分布、外交边数/密度、热点联盟、跨联盟事件；主体数不能代表 `F^2` 边 |
| `Z` | 拆分 | realm-zone-cell 层级、热度 skew、cell 边界穿越率、split/merge/migration 状态 |
| `C` | 拆分 | connected/authenticated/reconnecting/slow/background/multi-device，按 RTT、send window 和协议 |
| `E` | 拆分 | 每命令按 event type、stream 数、destination 数、fanout、payload 与可合并性分布 |
| `K_hot` | 从标量改为向量 | `K_hot(command_type, owner_type, realm, window, top_k)` 及 top-K 联合到达；单个“最热占比”不足 |
| `M` | 拆分 | `M_owner/M_stream/M_domain_rows/M_unique_keys/M_external_steps` 与冲突图；owner 数不等于锁数 |
| `B` | 拆分 | logical/uncompressed/wire/compressed/heap/queue/on-disk/WAL/redo/object bytes，分别给 p50/p95/p99/max |
| `R` | 拆分 | receipt/stream/outbox/inbox/snapshot/ledger/audit/ruleset/WAL/backup 的时间、seq 与 bytes 窗口；由最慢 cursor 和法规共同约束 |

### 3.2 必须新增的变量

| 新变量 | 定义 | 为什么现有向量无法推导 |
| --- | --- | --- |
| `X_cmd` | 命令类型混合及其 owner、row、event、deadline、付费属性联合分布 | 相同 QPS 下 heartbeat、战斗结算、支付和全服发奖成本相差数量级 |
| `J_due` | job 类型、due_at 每秒直方图、priority、deadline、reclaim、retry、DLQ | `A` 不表达同秒洪峰和毒任务反馈 |
| `G_fan` | 每 event 的候选/授权 watcher、个性化分支和目的地 fanout | `E` 只数事件，不数 delivery |
| `X_ext` | 支付渠道、对象存储、CDN、邮件供应商等外部调用的延迟、限额、callback、失败与幂等 | 外部系统不能进入本地数据库事务，尾延迟和重试独立 |
| `L_shared` | rank/chat/mail/alliance/activity 等子系统的 key 数、成员数、写读比、bulk 和 retention | `F/P/E` 不能区分排行榜热更新、聊天 append、全服邮件物化 |
| `REP` | WAL/redo、复制因子、apply rate、replica lag、backup/PITR、对象复制 | 主库 CPU 不代表复制与恢复能力 |
| `MAINT` | vacuum/GC/checkpoint/compaction/index build/schema migrate/archive/anti-cheat scan | steady-state 命令率不包含维护资源争用 |
| `HIST` | ledger/audit/Saga/battle/ruleset/event schema 的长期基数和合法最短保留 | `R` 的短期 snapshot/event 窗口不能覆盖不可删除历史 |
| `TOPO` | realm/cell 大小、热点 skew、跨 cell 比例、split/merge/copy/catch-up 流量 | `Z` 只数 zone，不表达迁移和鬼区合并 |
| `RETRY` | 按阶段/错误码/客户端版本的 retry probability、backoff、重复计算和 status query | retry 是负载反馈，不是独立外生 QPS |
| `OBS` | metrics/log/trace/profile 的采样率、标签基数、event bytes、export backlog | 观测开销在热点战斗和 1000+ 连接下可成为首瓶颈 |
| `DEPLOY` | 连接重置、旧客户端比例、CDN cold miss、配置/ruleset cache miss、session recheck | 发布会同时触发 auth、snapshot、CDN 和 reconnect 的相关洪峰 |

[SOL21-003][BLOCKER][FACT]
- Attacked v2.1 clause: workload 表 1532-1544 只列通用实体量，manifest 1588-1599 没有 `X_cmd/X_ext/L_shared/REP/MAINT/HIST/OBS/DEPLOY`。
- Workload vector: 修订后的全部向量，重点是命令类型混合、外部支付、排行榜、聊天/邮件、对象存储、复制和维护任务。
- Failure mechanism: 两次测试可有完全相同的 `U/P/A/V/W/F/Z/C/E/K_hot/M/B/R` 点值，却分别由窄 heartbeat 与多 stream 战斗结算构成；后者会额外锁 ledger、stream heads、outbox destination、WAL 和外部支付状态。实现方可用低成本命令混合填表，再把结论外推到高成本命令。
- Coupled capacity expression: `lambda_x[DERIVED] = sum(c, lambda_c[MEASURED] * visits_cx[MEASURED]) + lambda_retry,x[MEASURED]`；没有 `c` 的命令混合和 stage visit multiplicity 就无法计算任何阶段 arrival。
- Correctness/SLO impact: 容量合同根本性缺项；支付、奖励和邮件若在过载下重复或迟到，会升级为正确性和公平性失败。
- Missing metric or stop condition: command catalog coverage、每类型 arrival/rows/locks/events/destinations/external calls、维护任务资源量、外部限额与 callback；任一生产命令类型或后台 writer 未在 catalog 中即停止认证。
- Required revision: 收益：防止用廉价命令代表全系统；代价：持续维护 command/job/consumer catalog；迁移风险：命令重命名和版本分叉导致历史不可比；前置指标：稳定 command type、owner/stream/destination inventory；停止条件：catalog 覆盖率未达到完整 writer inventory 或出现 unknown command 时判 `NOT_PROVEN`。
- Acceptance test and raw evidence: 使用相同总 QPS、不同 `X_cmd` 的 heartbeat、单 owner 写、多 owner 战斗、支付回调、rank/chat/mail/bulk 套件；保存 per-command trace、SQL/lock/WAL、外部 stub 记录与最终对账。

[SOL21-004][HIGH][INFERENCE]
- Attacked v2.1 clause: 每个变量虽要求“分布/联合形状”，但 manifest 没有联合键、时间窗或数据引用，仍可分别填边际 p99。
- Workload vector: `K_hot x X_cmd x M_owner x M_stream x E x B x J_due x RETRY x DEPLOY` 的联合分布。
- Failure mechanism: 真正危险的是“高 M 的命令恰好命中最热 owner，并在同秒 job/reconnect、DB maintenance 和 relay catch-up 时发生”。独立 p99 拼接会把这种相关尾部消掉；分别满足阶段 p99 也不推出端到端 p99。
- Coupled capacity expression: 必须从同一 trace 求 `Pr(sum(x, Wq_x[MEASURED] + S_x[MEASURED]) > D_e2e[PRODUCT_SLO])[DERIVED] <= epsilon_e2e[PRODUCT_SLO]`，而不是相加独立阶段 p99。未实测前只能把相关系数 `corr_xy[MODEL_ASSUMPTION]` 做敏感性扫描，不能判 PASS。
- Correctness/SLO impact: 容量与 deadline；相关峰值导致 scheduler、公平性、snapshot cut 和 receipt 终态超时。
- Missing metric or stop condition: joint run id、trace timestamps、command/job/reconnect correlation、cold/warm/maintenance state；若只提供边际摘要或跨窗口拼接，应停止并判失败。
- Required revision: 收益：保留 SLG 同秒事件的真实相关性；代价：高基数 trace 和数据治理；迁移风险：采样可能漏掉极端联合事件；前置指标：tail-based sampling 与 clock synchronization；停止条件：关键 class 的联合样本不足、采样丢失失败请求或时间轴不可对齐时不得外推。
- Acceptance test and raw evidence: 回放相同边际分布但不同相关结构的两组 trace，要求判定器能区分；保存原始 arrival timeline、跨阶段 span、queue timeline 和 bootstrap confidence interval。

## 4. COUPLED_STAGE_QUEUE_MODEL

### 4.1 十阶段与耦合项

| 阶段 | 外生与反馈 arrival | 服务需求 | 必须记录的队列 | 关键耦合 |
| --- | --- | --- | --- | --- |
| gateway | 用户命令、status query、reconnect、客户端 retry | TLS、parse/decompress、schema、quota、routing | items/bytes/oldest age，按 endpoint/class | 与 auth 共 CPU；拒绝会改变 retry；大 body 与 trace 共内存 |
| auth | gateway accepted、WS reauth、revocation storm | JWT/签名、session/cache/DB lookup、device policy | auth wait、cache miss queue | session DB 与 command DB 共享；缓存 TTL 与撤销正确性冲突 |
| owner | 主动命令、job、Saga step/compensation、retry | owner resolution、mailbox、domain logic，并持有串行权直到 DB 返回 | per owner/type items/bytes/age | 单 key 服务率；DB wait 延长 owner service；多 owner 构成 fork-join |
| DB | owner txn、scheduler claim/lease、auth lookup、relay claim/update、cursor、snapshot、maintenance | locks、heap/index、WAL fsync、vacuum/checkpoint/replication | pool wait、lock wait、IO/WAL backlog | 所有上层共享；长事务、hot page 和 maintenance 改变服务分布 |
| scheduler | new due、reclaim、retry、Saga timeout、maintenance jobs | due scan/claim、lease write、dispatch | class/realm/owner bucket、DLQ、oldest due | claim 后仍受 owner/DB；timeout 产生反馈；SKIP LOCKED 改变公平性 |
| relay | 每 event x destination、新事件、retry、outage catch-up | claim/read、serialize、broker/object/network、publish update | rows/bytes/oldest、destination/DLQ | 与 DB/WAL、stream 和下游 consumer 共享；catch-up 抢前台资源 |
| stream | durable append、consumer replay、cursor/inbox update、retention cleanup | stream head lock、event IO、gap scan、cursor commit | per stream/consumer lag、bytes | stream head 可跨 owner 串行；最慢 cursor 决定 retention |
| snapshot | reconnect miss、slow-client fallback、periodic/build retry、schema rebuild | consistent read、assemble、encode/compress、object write/read | build/send queues、bytes/age | 读 DB/stream/object；占 CPU/GC/NIC；失败令更多客户端越窗 |
| socket | event fanout、snapshot、ACK/control、replay | permission filter、encode/compress、TLS/send | per connection/stream bytes/age/window | AOI fanout与慢连接；共享 gateway CPU/NIC/RSS |
| client | event/delta/snapshot receive | decode/decompress、ordered apply、projection、render | per stream apply items/bytes/age | 主线程帧预算；ACK 语义影响 server cursor/snapshot fallback |

### 4.2 必须采用的网络模型

对业务 class `c` 和阶段 `x`，先从同一次运行取得外生 arrival 向量 `a_c(t)[MEASURED]`、路由/放大矩阵 `R_c[MEASURED]` 与 retry/feedback 矩阵 `F_c(t)[MEASURED]`：

`lambda(t)[DERIVED] = a(t)[MEASURED] + lambda(t)[DERIVED] * R[MEASURED] + lambda(t)[DERIVED] * F(t)[MEASURED]`

线性近似只在 `spectral_radius(R[MEASURED] + F[MEASURED])[DERIVED] < 1` 时有有限解；真实 retry probability 随 queue timeout 上升时是非线性固定点，必须以阶梯负载与 fault trace 验证是否存在两个稳定区或突然崩塌。

阶段不拥有独立物理资源。对 DB CPU、event-loop CPU、disk IOPS、WAL、memory、NIC、broker/object-store quota 等资源 `r`：

`rho_r[DERIVED] = sum(x,c, lambda_xc[MEASURED] * d_xcr[MEASURED]) < rho_r,target[PRODUCT_SLO] < 1`

其中 `d_xcr[MEASURED]` 是 class `c` 在阶段 `x` 对共享资源 `r` 的服务需求。对重尾单服务中心，可用下式做诊断而非最终 PASS 证明：

`E[Wq_x][DERIVED] ~= (rho_x[DERIVED] / (1-rho_x[DERIVED])) * ((ca_x^2[MEASURED] + cs_x^2[MEASURED]) / 2) * E[S_x][MEASURED]`

只填 `E[S]` 或 p99 不能替代 `ca^2/cs^2`、最大持锁时间和联合 trace。端到端 gate 应直接验证 `D_e2e,c[PRODUCT_SLO]` 与 `epsilon_c[PRODUCT_SLO]`，不能把十个独立 stage deadline 当成充分条件。

[SOL21-005][BLOCKER][MODEL_ASSUMPTION]
- Attacked v2.1 clause: 1550 的阶段模型对每个 stage 独立填写 `rho_x/Wq_x/S_x/Q_x/D_x`，未定义 stage visit、fork-join、多 stream fanout、retry feedback 或共享资源矩阵。
- Workload vector: `X_cmd/J_due/G_fan/RETRY/M_owner/M_stream/E/destination`。
- Failure mechanism: scheduler claim、owner 执行、DB commit、relay、snapshot 与 auth 都访问同一 DB；gateway、socket、snapshot 与 trace exporter共享同一 CPU/heap/NIC。每个逻辑 stage 都可报低于自己的目标，而物理 DB/WAL 或 event loop 已被总需求打满。
- Coupled capacity expression: 使用上面的 `rho_r[DERIVED]`，并要求 `lambda_db[DERIVED]` 包含 owner txn、auth miss、scheduler claim/complete、relay claim/update、cursor/inbox、snapshot read 和 maintenance 的全部 visits。
- Correctness/SLO impact: 容量阻断；DB 饱和会延长 owner lease、scheduler reclaim 和 unknown commit，升级为正确性风险。
- Missing metric or stop condition: per-class stage visits、shared resource demand、pool/lock/WAL wait、resource saturation attribution；任一 DB caller 或 CPU consumer未入 demand matrix 即停止。
- Required revision: 收益：找到真实首瓶颈并避免错误扩容；代价：需要 service-demand profiling；迁移风险：instrumentation 会改变短路径成本；前置指标：统一资源 counters 与 trace；停止条件：物理资源 `rho_r` 不收敛、queue bytes/age 越界或增加 stage worker 反而降低总吞吐时判失败。
- Acceptance test and raw evidence: 分别单独与同时驱动 auth、commands、scheduler、relay、snapshot、maintenance，验证总资源模型能预测联合退化；保存 per-resource demand、pool/lock/IO/WAL timeline 和 trace join。

[SOL21-006][BLOCKER][INFERENCE]
- Attacked v2.1 clause: W8 要求 retry amplification 指标，但 stage contract 没有 retry ownership、最大反馈增益或客户端/worker/Saga/relay 的统一 attempt budget。
- Workload vector: `RETRY` 按 error code、stage、client version、command class、attempt 和 backoff 联合分桶。
- Failure mechanism: queue timeout 提高 retry，retry 再提高 queue；status query、owner replay、scheduler reclaim、relay retry 和 snapshot fallback可能对同一业务事实重复施压。局部“每层最多 N 次”相乘后仍可能形成高放大。
- Coupled capacity expression: `lambda_attempt[DERIVED] = lambda_business[MEASURED] * A_total[MEASURED]`，其中 `A_total[MEASURED]` 必须按端到端业务事实计数；恢复要求 `mu_effective[MEASURED] > lambda_new[MEASURED] + lambda_retry[MEASURED]` 并在 `D_drain[PRODUCT_SLO]` 内排空。
- Correctness/SLO impact: 容量与幂等；若 commandId、jobId、external transaction id 或 eventId 在任一层改变，则成为重复扣款/发奖的正确性失败。
- Missing metric or stop condition: original business id、attempt lineage、retry-after compliance、unknown-outcome query rate、feedback gain；重试流量超过新业务流量或 attempt lineage 断裂即停。
- Required revision: 收益：阻断过载正反馈；代价：跨客户端/服务 attempt 关联与预算；迁移风险：过低预算会过早放弃可恢复工作；前置指标：错误分类、业务 deadline、幂等 key；停止条件：反馈增益不收敛、重试无界、ID 改变或最终终态不唯一时失败。
- Acceptance test and raw evidence: 在十阶段分别注入 timeout、connection reset、commit ACK loss、lease expiry、broker failure和慢客户端；保存完整 attempt DAG、业务终态、arrival/drain 曲线。

[SOL21-007][HIGH][COUNTEREXAMPLE]
- Attacked v2.1 clause: stage contract 只要求 service p50/p95/p99，未要求二阶矩、max、timeout censoring、GC/checkpoint/外部服务重尾或跨阶段相关尾部。
- Workload vector: `B/M/MAINT/X_ext/OBS` 与 service time 联合样本。
- Failure mechanism: 少量大 snapshot、长事务、checkpoint、GC pause 或支付渠道长尾可使 `E[S^2]` 主导等待；超时样本若被丢弃，p99 反而看起来更好。各阶段长尾又会在同一请求上相关出现。
- Coupled capacity expression: 前述 Kingman 诊断式中的 `cs_x^2[MEASURED]` 不能省略；最终必须直接测 `T_e2e[MEASURED]` 对 `D_e2e[PRODUCT_SLO]`，并把 timeout/cancel 作为有穷或右删失样本保留。
- Correctness/SLO impact: 主要是容量/尾延迟；持锁长尾触发 deadlock、lease reclaim 或客户端错误 retry 时升级为正确性。
- Missing metric or stop condition: max、二阶矩、timeout/cancel、GC/checkpoint/profile markers、joint tail traces；任何被丢弃的 timeout 样本或只报成功请求时停止。
- Required revision: 收益：防止成功样本偏差；代价：更大原始数据和稳健统计；迁移风险：短时测试难以观测罕见尾部；前置指标：足够样本量与 fault replay；停止条件：置信上界仍越过产品 SLO、尾部不稳定或右删失比例超声明预算时失败。
- Acceptance test and raw evidence: 构造相同均值但不同方差/重尾的服务分布，并叠加 GC/checkpoint；保存完整 histogram、raw samples、censor flags 和 trace。

[SOL21-008][HIGH][FACT]
- Attacked v2.1 clause: F2 要求跨阶段 trace，O1 要求广泛健康指标，但 workload 与 stage contract 未计 observability 成本和标签基数。
- Workload vector: `OBS`，按 command/event/delivery/connection/profile 类型记录采样率、bytes、cardinality 和 exporter quota。
- Failure mechanism: 把 commandId、ownerKey、streamKey、sessionId 或 tile 放进 metric label 会造成 time-series 爆炸；万人 AOI 若按 delivery 写日志/trace，观测 CPU、allocation、网络与 exporter backlog 可反向拖慢主线程。降低采样又可能漏掉热 key、失败和 rare correctness violation。
- Coupled capacity expression: `lambda_obs[DERIVED] = sum(c, lambda_c[MEASURED] * spans_c[MEASURED]) + lambda_delivery[MEASURED] * spans_delivery[MEASURED]`；`BW_obs[DERIVED] = lambda_obs[DERIVED] * B_obs[MEASURED]`，并计入共享 CPU/NIC/heap 的 `rho_r[DERIVED]`。
- Correctness/SLO impact: 至少是容量/优化；若观测丢失使 gate 无法检测错误，则证据本身失效。
- Missing metric or stop condition: series cardinality、log/trace bytes/s、export queue、drop rate、CPU/allocation、tail-sampling coverage；观测开销未测或丢失 correctness/failure spans 时停止认证。
- Required revision: 收益：F2 证据不会成为首瓶颈；代价：聚合指标、exemplar、tail sampling 与隐私治理；迁移风险：改变采样导致历史趋势断裂；前置指标：标签白名单和 exporter 预算；停止条件：观测导致任一产品 SLO 越界、export backlog 发散或关键失败无原始 trace 时回退并判失败。
- Acceptance test and raw evidence: 在 1/10/100/1000 连接和 AOI 万人回放下扫描采样/日志策略；保存应用与 exporter profile、series count、drop counters、tail coverage。

## 5. OWNER_STREAM_AND_DATABASE_WRITE_AMPLIFICATION

[SOL21-009][BLOCKER][INFERENCE]
- Attacked v2.1 clause: D1 和写入序列 898-905 要求 receipt、owner leases、aggregate/stream heads、domain rows、jobs、stream events、outbox、terminal receipt 同事务；W1 只要求 WAL 与 changed rows“近似线性”。
- Workload vector: `X_cmd/M_owner/M_stream/M_domain_rows/E/destinations/B/REP/MAINT`。
- Failure mechanism: 一个逻辑命令会触发多表 heap/index 写、唯一约束检查、hot page latch、WAL full-page image、replication、vacuum 和 outbox 状态二次更新。`changed rows` 与物理 writes/WAL 不同维；同事务延长 owner 持有时间，形成 convoy。
- Coupled capacity expression: `L_tx[DERIVED] = 1_receipt[MODEL_ASSUMPTION] + M_owner[MEASURED] * (L_lease[MEASURED] + L_aggregate_head[MEASURED]) + M_stream[MEASURED] * L_stream_head[MEASURED] + R_domain[MEASURED] + J_new[MEASURED] + E[MEASURED] * (L_event[MEASURED] + D_dest[MEASURED] * L_outbox[MEASURED])`；`WAL_tx[MEASURED]` 必须直接测，不能由逻辑 payload 推断。
- Correctness/SLO impact: 容量与恢复；事务超时、deadlock 或磁盘满会影响终态原子性，错误 retry 会升级为正确性。
- Missing metric or stop condition: locks/pages/index entries/WAL/redo/replica bytes per command type、fsync、dead tuples、vacuum age、transaction hold time；任何命令缺物理写放大证据或 WAL/replica lag不收敛即停。
- Required revision: 收益：D1 的正确性成本变得可预算；代价：DB page/WAL 级测量与长期 soak；迁移风险：索引/分区调整改变锁序和查询计划；前置指标：真实 schema、索引和 replication profile；停止条件：write amplification、lock hold、vacuum/replica lag或 disk headroom越过合同即失败。
- Acceptance test and raw evidence: 按 command type、`M_owner/M_stream/E/destination` 矩阵执行 no-op/changed/burst/maintenance；保存 DB lock graph、WAL LSN delta、table/index stats、vacuum/checkpoint 与 replica apply trace。

[SOL21-010][BLOCKER][COUNTEREXAMPLE]
- Attacked v2.1 clause: `stream_heads` 每 stream 单调分配 seq（1035、1191-1225），但 `M` 只定义 touched owner 数；多 owner 锁序把 aggregate_heads 与 stream_heads 合并描述，未定义多 stream 的唯一锁序和上限。
- Workload vector: `M_owner`、`M_stream`、每 stream producer owner 数、`E`、fanout 和 destination。
- Failure mechanism: zone/AOI/chat/global stream 的 head 是跨 owner 共享热行；不同 owner 的事务为了同一 stream seq 再次串行。一个命令写 player、city、alliance、AOI、audit 等多个 stream 时，锁数按 `M_stream` 增长；不同命令若 stream 集合交叉，ownerKey 排序不能自动保证 stream/domain/index 的完整锁序。
- Coupled capacity expression: `lambda_stream,k[DERIVED] = sum(c, lambda_c[MEASURED] * visits_ck[MEASURED])`，单 head 稳定要求 `lambda_stream,k[DERIVED] * S_head,k[MEASURED] < rho_head,target[PRODUCT_SLO]`；扩机器不提高该 head 的串行服务率。
- Correctness/SLO impact: 容量首先失败；死锁重试、seq hole、同事务多 stream cut 不一致则是正确性失败。
- Missing metric or stop condition: top-K stream arrival、producer owner count、head lock wait/hold、`M_stream` p99/max、seq gap/duplicate、完整 lock catalog；head queue 发散、gap/duplicate 或未声明 stream 动态发现即停。
- Required revision: 收益：暴露新引入的 stream 单 key 瓶颈；代价：按用途分流、range allocation或 sequencer 设计；迁移风险：改变 stream key/seq scope 会破坏 cursor、snapshot 和旧客户端；前置指标：真实 stream graph 与 resume 语义；停止条件：迁移期间出现双 head、cursor 不可映射或最终 checksum 不一致时回滚。
- Acceptance test and raw evidence: 以 1/10/100/1000 producer 写同一 stream，并扫描 `M_stream[MEASURED]` 从 1 到实测可达上限的交叉集合；保存 head lock trace、seq ledger、deadlock graph、snapshot+delta checksum。

[SOL21-011][BLOCKER][SPEC_CONTRADICTION]
- Attacked v2.1 clause: C1/Owner Handoff 要求旧 epoch 的任何写入在 DB 内失败（759、988-989），示例只在一次 `UPDATE aggregate_heads ... lease_until > statement_timestamp()` 中校验 lease（1093-1126），未规定 lease row 持锁到 commit、commit-time 再验证或长事务过期语义。
- Workload vector: transaction duration、lease TTL、GC/DB pause、handoff rate、`M_owner`、clock skew。
- Failure mechanism: 事务在 lease 有效时通过一次 statement 校验，随后长时间写 domain/event/outbox；若 lease 在 COMMIT 前到期并被新 epoch 接管，规范没有给出旧事务必须 abort 的数据库机制。即使 aggregate head 锁让新 writer 等待，也不能满足“新 epoch 已发出后旧写确定失败”的文字语义。
- Coupled capacity expression: 必须实测 `T_tx,max[MEASURED]`、`T_pause,max[MEASURED]` 与 `T_lease[PRODUCT_SLO]`，并定义 `T_commit_fence_check[MEASURED] < T_lease_remaining[MEASURED]` 或持有 lease-row fence 到 commit；仅用 `T_tx,p99` 不足。
- Correctness/SLO impact: **正确性先于性能失败 1**：可能出现新 epoch 已发布后旧 epoch 提交；扩容和调参不能修复 fencing 语义。
- Missing metric or stop condition: lease acquisition/renew/revoke/epoch timeline、DB transaction id、commit LSN、holder overlap、clock source；观察到任何 stale epoch commit 或无法线性化 handoff 时立即停。
- Required revision: 收益：真正闭合单写 fencing；代价：lease row lock、短事务/续租或 commit-time fence 增加争用；迁移风险：更严格 fence 会中止现有长事务并扩大 retry；前置指标：transaction/pause 分布和 handoff trace；停止条件：stale commit、双 holder、epoch 倒退或 retry 破坏业务幂等时禁止上线。
- Acceptance test and raw evidence: 在事务每个阶段注入 GC pause、DB stall、lease expiry、holder crash和新 holder 接管；保存 DB tx/LSN、lease/epoch rows、command receipt、domain/event checksum，要求旧 epoch commit 为零。

[SOL21-012][BLOCKER][MODEL_ASSUMPTION]
- Attacked v2.1 clause: Owner Set/Saga Rule 以版本化 `M_max` 切分单事务与 Saga（992-997），但 capacity contract 只留一个 `M_max=TBD`，没有选择函数、guard band 或执行计划持久化。
- Workload vector: `M_owner/M_stream/M_domain_rows`、冲突图、command type、hotness、transaction bytes、外部步骤、Saga compensation rate。
- Failure mechanism: lock/事务成本不只取决于 M；相同 M 在独立 owner 与共同热页下完全不同。接近阈值时，长事务、deadlock、timeout/retry可非线性上升；跨过阈值后 Saga 增加 receipt、reservation、step、event、outbox、scheduler 和人工仲裁，成本发生不连续。若重试时 capacity contract 版本改变，同一 commandId 甚至可能从事务路径切到 Saga 路径。
- Coupled capacity expression: 选择 `M_max` 必须满足对每个实测冲突 class：`Pr(T_tx[MEASURED](M_owner[MEASURED], g_conflict[MEASURED]) > D_tx[PRODUCT_SLO])[DERIVED] <= epsilon_tx[PRODUCT_SLO]`、`p_deadlock[MEASURED](M_owner[MEASURED], g_conflict[MEASURED]) <= epsilon_deadlock[PRODUCT_SLO]`、`WAL_tx[MEASURED](M_owner[MEASURED], g_conflict[MEASURED]) <= B_wal_tx[PRODUCT_SLO]`，并与 `Cost_saga[MEASURED](M_owner[MEASURED], g_conflict[MEASURED])` 的完整曲线比较。
- Correctness/SLO impact: **正确性先于性能失败 2**：同一业务事实路径漂移、补偿不守恒或 unknown commit；其次才是容量拐点。
- Missing metric or stop condition: per-command conflict graph、lock hold/deadlock/abort曲线、Saga steps/attempts/compensation/manual age、receipt 中的 capacityContractId/executionPlan；任何路径漂移或补偿对账失败立即停。
- Required revision: 收益：`M_max` 由证据而非拍数决定；代价：二维/多维 conflict 测试和持久 execution plan；迁移风险：阈值变化令在途命令/Saga 兼容复杂；前置指标：transaction 与 Saga 同负载基线；停止条件：曲线置信上界越过 SLO、成本出现未解释跳变或在途路径无法保持时冻结阈值。
- Acceptance test and raw evidence: 扫描 M 和冲突图密度，在阈值两侧注入 deadlock、timeout、ACK loss、版本发布；保存 transaction/Saga plan、locks、WAL、steps、补偿和最终守恒账。

## 6. SCHEDULER_SAGA_AND_LEDGER_BURSTS

[SOL21-013][BLOCKER][COUNTEREXAMPLE]
- Attacked v2.1 clause: scheduled_jobs 按 `next_attempt_at,due_at,priority_class,job_id` stable claim，W3 要求 fairness/aging/lease reclaim/DLQ（971、1157-1186、1565），但没有公平函数或 owner-aware dispatch。
- Workload vector: `J_due`、owner hotness、priority/deadline、job cost、lease/attempt、realm/cell、paid/non-paid class。
- Failure mechanism: 大批同秒任务先被 claim 后才在 owner mailbox 发现热点，claim slot 和 lease 被不可服务的热 owner 占住；`SKIP LOCKED` 只避免 DB 阻塞，不保证 realm/owner/class 公平。aging 提升低优先级可能在同 owner 内越过更早命令；reclaim 的重复 command 仍消耗 owner/DB；DLQ 若没有业务终态会把“迟到”伪装成“已隔离”。
- Coupled capacity expression: `mu_sched,eff[DERIVED] = min(mu_claim[MEASURED], mu_dispatch[MEASURED], mu_owner,k[MEASURED], mu_db_share[MEASURED])`；`T_drain[DERIVED] >= B_due[MEASURED] / (mu_sched,eff[MEASURED] - lambda_new[MEASURED] - lambda_retry[MEASURED])`，并受各 class `D_job,c[PRODUCT_SLO]` 约束。
- Correctness/SLO impact: **正确性先于性能失败 3**：建筑、行军、赛季结算和付费加速的 happens-before、公平和终态；随后才是吞吐。
- Missing metric or stop condition: due histogram、claim-to-start、owner/class/realm lag、service share、aging transition、lease steal、duplicate submit、DLQ business terminal；starvation、旧 lease 完成、owner 内重排或 missed-deadline 无终态即停。
- Required revision: 收益：stable ordering 真正扩展为公平调度；代价：owner-aware admission、分层 DRR/WFQ 或保留容量；迁移风险：priority/aging 改变既有可见时序；前置指标：每类产品 deadline 与冲突矩阵；停止条件：任一 class/realm/owner starvation、同 owner 次序变化或 drain 不收敛时回滚策略。
- Acceptance test and raw evidence: 整点混合建筑、行军、活动、赛季、支付、维护任务，分别均匀和同 owner；注入 pause/steal/poison。保存 claim order、lease timeline、owner order、DLQ、deadline 和最终状态。

[SOL21-014][BLOCKER][SPEC_CONTRADICTION]
- Attacked v2.1 clause: D1 要求本地权威数据同事务，Saga Rule 承认外部系统必须拆步，D5/ledger 要求支付唯一性（773、777、996-997、1229-1262）；但 workload/stage 模型没有支付网关 callback、channel rate limit、对账文件或退款窗口。
- Workload vector: `X_ext` 支付 authorize/capture/refund/callback/reconcile，`X_cmd` 付费命令，ledger lines、Saga steps、deadline/fairness。
- Failure mechanism: 外部支付无法与本地 receipt/ledger 同事务；callback 重复、乱序、延迟或先成功后本地过载需要持久 inbox/journal 状态。只提高“付费优先级”不能绕过同 owner 顺序，强行插队又可能使加速发生在原完成 job 之后/之前的错误版本。
- Coupled capacity expression: `lambda_payment_attempt[DERIVED] = lambda_business_payment[MEASURED] * A_channel[MEASURED]`；每笔业务物理行数至少随 `journal_lines[MEASURED] + saga_steps[MEASURED] + callbacks[MEASURED] + audit_rows[MEASURED]` 增长；外部 `S_ext[MEASURED]` 不得算进持 DB lock 时间。
- Correctness/SLO impact: **正确性先于性能失败 4**：双扣、漏账、余额不守恒、退款错配和付费不公平均为阻断项。
- Missing metric or stop condition: external txn/business key、callback inbox、state transition、channel attempt/rate limit、ledger balance/reversal、reconcile lag、manual age；任何重复 posted、失衡、无源 reversal 或已扣款无可查询终态立即停。
- Required revision: 收益：外部支付从容量旁路变成可恢复工作流；代价：payment journal/inbox、对账和人工仲裁；迁移风险：旧支付记录缺业务键或无法映射 Saga；前置指标：渠道语义、法规保留和公平政策；停止条件：迁移对账非零、channel retry 发散或同 owner 顺序不确定时禁止切换。
- Acceptance test and raw evidence: 模拟 callback duplicate/reorder/loss、capture success后 DB/relay/load-shed故障、refund/compensation；保存渠道 stub ledger、journal/Saga/receipt、owner order 与守恒对账。

[SOL21-015][HIGH][FACT]
- Attacked v2.1 clause: History Rule 和 schema 要求 ledger、Saga、battle、ruleset/config/event schema 长期可追溯（1086-1088、1510），但 `P/B/R` 没有这些对象的长期基数、索引、对象存储、复制和恢复模型。
- Workload vector: `HIST/L_shared/X_ext/REP/MAINT`，覆盖 premium ledger、审计、历史 ruleset、rank/chat/mail、战报与对象 payload。
- Failure mechanism: append-only ledger/audit 不可按普通 event retention 删除；历史 ruleset 和战报 payload 可能进入对象存储并跨区域复制。排行榜更新制造热有序索引，聊天按频道 append/fanout，邮件全服物化可达玩家数级，归档/index build/restore 与前台共享资源。
- Coupled capacity expression: `Bytes_hist[DERIVED] = sum(h, lambda_h[MEASURED] * B_h,disk[MEASURED] * R_h[PRODUCT_SLO] * replication_h[MEASURED])`；`T_restore,h[DERIVED] >= Bytes_h[MEASURED] / mu_restore,h[MEASURED]`，并加索引重建和对象校验需求。
- Correctness/SLO impact: 长期容量与恢复；删掉审计/ruleset 会使支付争议、战斗回放和补偿不可证明，升级为正确性/合规失败。
- Missing metric or stop condition: per history table/object/index bytes、retention authority、object GET/PUT/list quota、replication、restore/index build/checksum；无法恢复历史版本或 headroom 不覆盖恢复临时空间即停。
- Required revision: 收益：10x 数据与多年运营可计算；代价：冷热分层、对象 manifest、归档与恢复演练；迁移风险：归档切换造成引用断裂或旧 ruleset 不可执行；前置指标：法规/产品 retention 与访问热度；停止条件：引用校验失败、restore 超产品 RTO 或归档影响前台 SLO 时回滚。
- Acceptance test and raw evidence: 10x/多年形状下并发 rank/chat/mail、ledger、archive、ruleset replay 和 object restore；保存对象 manifest、DB/index stats、API quota、checksum 和 RTO timeline。

## 7. AOI_SLOW_CLIENT_AND_SNAPSHOT_STORMS

[SOL21-016][BLOCKER][MODEL_ASSUMPTION]
- Attacked v2.1 clause: P7/W5 要求 AOI permission、fanout、serialize/compress、socket buffer 和 client apply 有界（1490、1567），但没有端到端 class budget、个性化编码复用条件或热点隔离模型。
- Workload vector: `V_candidate/V_visible/V_changed/DeltaV/G_fan/C_slow/B_wire/device_class/permission_epoch`。
- Failure mechanism: changed-only 不限制 watcher 数；权限过滤可能按候选实体 x watcher，且不同玩家可见性/情报不同，公共 payload 不一定能编码一次复用。压缩降低 NIC 却消耗 server/client CPU；socket send 成功不代表客户端已 apply/render。
- Coupled capacity expression: `CPU_aoi[DERIVED] = lambda_change[MEASURED] * (N_candidate_watchers[MEASURED] * S_filter[MEASURED] + N_allowed_watchers[MEASURED] * (S_personalize[MEASURED] + S_encode[MEASURED] + S_compress[MEASURED] + S_enqueue[MEASURED]))`；`T_visible[DERIVED]` 必须从 commit 到 render 的同一 trace 对比 `D_visible[PRODUCT_SLO]`。
- Correctness/SLO impact: 权限泄漏、错误合并或跨 gap apply 是正确性失败；其余 encode/compress/batching 是容量优化。
- Missing metric or stop condition: candidates/authorized、permission cache hit/invalidation、encode reuse ratio、bytes、queue age、client decode/apply/render、最终 checksum；任何未授权 event、权威 event 丢弃或 client gap continuation 即停。
- Required revision: 收益：万人热点预算覆盖真实可见结果；代价：空间索引、权限 cache、分层事件和客户端埋点；迁移风险：coalesce/共享编码泄露个性化字段；前置指标：真实 AOI/fanout/permission/device 分布；停止条件：权限或 checksum 失败立即回滚，纯性能改动若端到端总成本不降则停止。
- Acceptance test and raw evidence: actors/watchers 1/10/100/1000 后扩到合成 10k，快速 viewport、权限撤销、个性化情报、压缩矩阵；保存 server/client CPU、fanout graph、wire capture、permission audit和 render checksum。

[SOL21-017][BLOCKER][COUNTEREXAMPLE]
- Attacked v2.1 clause: P5/W5/W6 规定 per-stream resume、慢流隔离、buffer overflow转 snapshot，但没有 ACK 是“收到”还是“已应用”、buffer 状态机或 snapshot fallback 的资源预留。
- Workload vector: `C_slow`、每连接/stream arrival bytes、socket window、client apply service、snapshot size/build cost、retention hit。
- Failure mechanism: 慢客户端 queue 溢出后转 snapshot，snapshot 比增量更大且仍走同一慢 socket；若 cursor 在 receive 时前移，客户端崩溃会丢未应用事件；若在 apply 后 ACK，主线程卡顿又延长 server retention。反复 overflow/snapshot 可形成振荡。
- Coupled capacity expression: `dQ_conn,bytes/dt[DERIVED] = lambda_wire,conn[MEASURED] - mu_socket,conn[MEASURED]`；客户端 `dQ_apply/dt[DERIVED] = lambda_apply[MEASURED] - mu_apply,device[MEASURED]`；fallback 只有在 `mu_snapshot_total[MEASURED] > lambda_fallback[MEASURED]` 且 `D_recover[PRODUCT_SLO]` 内才可收敛。
- Correctness/SLO impact: **正确性先于性能失败 5**：cursor 领先 apply、gap 后继续、snapshot 与 delta 重/漏；内存和帧率是容量/SLO。
- Missing metric or stop condition: receive/applied/acked 三水位、per-stream buffer bytes/age、fallback count/oscillation、device apply backlog；水位逆序、重复 fallback无收敛、权威 event drop 或 checksum 差异立即停。
- Required revision: 收益：慢客户端有确定恢复语义；代价：三水位协议、client durable cursor 或保守 ACK；迁移风险：旧客户端 cursor 语义不兼容；前置指标：设备档/RTT/apply 分布和协议版本矩阵；停止条件：旧新语义无法区分、fallback 振荡或 server RSS 越界时中止发布。
- Acceptance test and raw evidence: 1%/10%/50% 慢客户端、后台暂停、零窗口、apply long task、snapshot 中断；保存 server queue、client three-watermark、memory、frame trace 和最终 checksum。

[SOL21-018][BLOCKER][COUNTEREXAMPLE]
- Attacked v2.1 clause: W6 单独测试 1/10/100/1000 reconnect，release 章节单独测试 CDN/compat；没有要求 deploy、config/ruleset CDN cold、session revocation lookup、snapshot build 和 relay lag 同时发生。
- Workload vector: `DEPLOY/C_reconnect/auth_cache_miss/CDN_miss/snapshot_required/RETRY/old_client_ratio`。
- Failure mechanism: 发布会主动断连接、使新静态资源与 config/ruleset 冷缓存、触发 JWT/session epoch 重验，并可能因 schema/cursor 不兼容要求 snapshot。当前实现 `AuthService.authMiddleware()` 在 `backend/services/authService.js:125-147` 每请求查询 session token，说明 auth DB demand 必须明确；这些相关峰值会共同占 DB、CPU、origin、NIC 和 client main thread。
- Coupled capacity expression: `lambda_auth[DERIVED] = lambda_request[MEASURED] * p_session_lookup[MEASURED] + lambda_reconnect[MEASURED] * visits_auth[MEASURED]`；`lambda_snap[DERIVED] = lambda_reconnect[MEASURED] * p_snapshot_required[MEASURED] + lambda_slow_fallback[MEASURED]`；二者和 CDN origin demand 必须在同一 run 进入共享资源模型。
- Correctness/SLO impact: 容量/恢复；session revocation stale cache、snapshot cut和版本不兼容是正确性/安全失败。
- Missing metric or stop condition: connection reset timeline、auth/cache/DB hit、CDN regional hit/origin、snapshot reason/build/send、old-version compatibility、normal command SLO；出现 revocation bypass、版本不可解释、snapshot backlog或 origin/auth DB发散即停。
- Required revision: 收益：发布容量不再由平时稳态替代；代价：全链路 deploy rehearsal和区域 CDN 仿真；迁移风险：人为 jitter 延长恢复或强制升级；前置指标：真实 deploy/reconnect/CDN/auth 分布；停止条件：任一地区/版本无法收敛、正常命令被挤压或安全语义失败时自动回滚完整 release。
- Acceptance test and raw evidence: 在隔离环境原子发布并同时注入 relay lag、auth cache cold、CDN cold、1000 reconnect、snapshot window crossing；保存 release timeline、origin/auth/DB/stream/client trace与最终 checksum。

## 8. OUTBOX_RETENTION_AND_RECOVERY_DRAIN

[SOL21-019][BLOCKER][INFERENCE]
- Attacked v2.1 clause: W7 要求 relay rate、min cursor、disk headroom，D2/D3 定义 durable stream、cursor、snapshot；但未给 receipt/stream/outbox/inbox/snapshot/WAL/replica/backup 的联立磁盘方程。
- Workload vector: `B/R/E/destinations/consumer_count/REP/HIST/snapshot_rate/outage_duration`。
- Failure mechanism: durable stream 由最慢 required consumer cursor保护，outbox 由各 destination ack 保护，snapshot 与 receipt有独立窗口；relay outage 同时增加 outbox heap/index/WAL，stream 继续增长，cleanup 产生 dead tuples，复制和备份也扩大。只报 outbox rows 或单盘利用率会低估恢复临时空间。
- Coupled capacity expression: `Bytes_live[DERIVED] = lambda_cmd[MEASURED] * B_receipt,disk[MEASURED] * R_receipt[PRODUCT_SLO] + lambda_event[MEASURED] * B_stream,disk[MEASURED] * R_stream,effective[MEASURED] + L_outbox[MEASURED] * B_outbox,disk[MEASURED] + Bytes_inbox[MEASURED] + Bytes_snapshot[MEASURED] + Bytes_hist[MEASURED]`；再乘各存储的 `replication_factor[MEASURED]`、`backup_factor[MEASURED]` 并加 `B_recovery_scratch[PRODUCT_SLO]`。
- Correctness/SLO impact: 容量与恢复；清理越过 min cursor、对象丢失或 disk full 是事件完整性/可恢复性失败。
- Missing metric or stop condition: 每表/索引/object/WAL/replica/backup bytes、effective retained-from、所有 required cursor、cleanup/vacuum temp、restore scratch；headroom 不足或任何仍需事件被删即停。
- Required revision: 收益：磁盘与 retention 得到唯一 gate；代价：跨存储 inventory 与容量预测；迁移风险：调整 retention 可能破坏旧客户端/审计；前置指标：required consumer registry、法规/产品窗口、真实压缩率；停止条件：预测 headroom 低于恢复峰值、cursor 不明或删除验证失败时禁止接受新写。
- Acceptance test and raw evidence: 10x 历史数据、最慢 cursor、snapshot build、outbox outage、cleanup/vacuum/backup并发；保存 storage inventory、LSN、cursor、deletion manifest、restore checksum。

[SOL21-020][BLOCKER][COUNTEREXAMPLE]
- Attacked v2.1 clause: W7 用 `relay new rate > new event rate` 与简单 drain 公式作为 gate（1569），但 catch-up 服务率会随 DB/WAL/consumer contention 和前台保留份额变化，且 poison/schema mismatch 会分流 DLQ。
- Workload vector: outage duration、backlog bytes/age、new events、retry、destination/consumer rates、DB/NIC reserve、poison fraction。
- Failure mechanism: relay 恢复后批量读/更新 outbox、写 broker、推进 cursor/inbox、触发 push/snapshot，服务率不是常数；提高 batch 可抢占 DB/WAL/NIC并拉长前台事务，令新 event rate或 timeout retry上升。最慢 destination 决定清理，而 poison event 可阻塞 per-stream cursor。
- Coupled capacity expression: `dL_out/dt[DERIVED] = lambda_out,new[MEASURED] + lambda_out,retry[MEASURED] - mu_relay[MEASURED](L_out[MEASURED], resource_share[MEASURED])`；恢复 PASS 要求在全部 foreground classes满足 `D_c[PRODUCT_SLO]` 时，`L_out(t)[MEASURED]` 单调趋零且 `T_drain[MEASURED] <= D_drain[PRODUCT_SLO]`。
- Correctness/SLO impact: 容量/恢复；cursor 越过 poison/gap、事件重排/丢失或前台已提交但永久不可见是正确性失败。
- Missing metric or stop condition: backlog items/bytes/age、per destination/consumer rate、resource share、poison/DLQ、commit-to-apply、drain derivative；斜率非负、关键 consumer gap、前台 SLO 越界或 disk headroom 越界即停/限流新写。
- Required revision: 收益：relay outage catch-up 可运营；代价：动态 throttle、consumer隔离、DLQ和前台 reserve；迁移风险：改变 batch/order影响下游；前置指标：service curve随 backlog/batch/resource share的实测；停止条件：任一目标不收敛或顺序/checksum失败时降低 catch-up并保持 `NOT_PROVEN`。
- Acceptance test and raw evidence: relay分别停1/10/60分钟，恢复时保持新写并注入 poison/schema mismatch/慢 consumer；保存 backlog曲线、DB/WAL/NIC share、per-consumer cursor和最终 event ledger。

[SOL21-021][BLOCKER][INFERENCE]
- Attacked v2.1 clause: Partition Rule 承认合服/拆服需要显式方案（1070-1072），但 workload vector只数 `Z`，W4只要求复杂度曲线，没有 cell 粒度、split/merge/migration/cross-cell 事务容量曲线。
- Workload vector: `TOPO`、cell hotness、跨 cell率、copy/catch-up、ghost-realm merge、stream/cursor rewrite、Saga比例。
- Failure mechanism: cell 粗则形成单 key服务中心；cell细则增加跨 cell `M` 与 Saga。热点 split需迁移 owner/stream/snapshot，鬼区 merge需重写复合键、唯一约束、历史 cursor/object refs并并发copy/catch-up；迁移资源与前台共享。容量曲线在边界和迁移状态发生阶跃。
- Coupled capacity expression: `lambda_cell,k[DERIVED] = sum(c, lambda_c[MEASURED] * visits_ck[MEASURED])`；迁移期资源需求加入 `lambda_copy[MEASURED] + lambda_catchup[MEASURED] + lambda_rewrite[MEASURED]`；跨 cell工作流率 `lambda_cross[DERIVED] = lambda_cmd[MEASURED] * p_cross_cell[MEASURED]`。
- Correctness/SLO impact: **正确性先于性能失败 6**：双 owner、ID冲突、cursor错映、事件乱序；其后才是容量不均衡。
- Missing metric or stop condition: per cell top-K、conflict/crossing graph、copy/catch-up bytes/rate、fence timeline、ID/cursor/object mapping、checksum；双 holder、mapping冲突、catch-up非收敛或前台 SLO越界即停。
- Required revision: 收益：realm/cell分区可运营；代价：placement controller、迁移协议和合服工具；迁移风险：历史引用与在途 Saga最难迁移；前置指标：heatmap、cross-cell分布和完整引用清单；停止条件：源/目标对账非零、任何旧 epoch写入或 rollback不可完成时冻结迁移。
- Acceptance test and raw evidence: 90/9/1 skew、热点split/move、鬼区merge、跨cell战斗/Saga并发；保存placement/epoch、copy/catch-up、mapping manifest、stream cursors和全量checksum。

[SOL21-022][BLOCKER][SPEC_CONTRADICTION]
- Attacked v2.1 clause: W8 要求各层确定拒绝、paid/non-paid deadline和最终对账（1570）；命令状态机包含 RECEIVED/ACCEPTED/IN_PROGRESS/terminal（909），但没有逐阶段 admission 与下游磁盘/event capacity reservation语义。
- Workload vector: class/paid属性、各阶段 queue、receipt状态、DB/outbox/stream/disk headroom、scheduler deadline、retry。
- Failure mechanism: receipt前拒绝可安全重投；accepted后拒绝必须成为可查询终态；commit后不能因 relay/socket过载撤销领域事实。若 outbox/stream/disk已无 headroom却仍接受命令，D1事务会失败或填满磁盘。付费保留容量不能打破同 owner顺序，普通玩家也不能永久饥饿。
- Coupled capacity expression: admission必须保证所有必经下游 `Q_x,bytes[MEASURED] + B_reserved,c[MEASURED] <= Q_x,max[PRODUCT_SLO]`，并验证每 class `Pr(T_terminal,c[MEASURED] > D_terminal,c[PRODUCT_SLO])[DERIVED] <= epsilon_c[PRODUCT_SLO]`；未知结果计失败而非成功。
- Correctness/SLO impact: **正确性先于性能失败 7**：静默丢命令、重复扣款、无终态、event不完整或付费插队破坏时序。
- Missing metric or stop condition: admission stage/reason、receipt transition、reserved downstream bytes、paid/normal service share、scheduler missed deadline、event ledger；任何 accepted无终态、commit无event、重复业务结果或 starvation立即停。
- Required revision: 收益：load shedding时仍保持终态和公平；代价：端到端 admission token/reservation与状态查询；迁移风险：旧客户端不理解 accepted/unknown/final reject；前置指标：产品class政策、downstream容量和协议版本；停止条件：兼容客户端比例不足、reservation泄漏或公平/顺序不变量失败时不启用新策略。
- Acceptance test and raw evidence: 逐层打满gateway/auth/owner/DB/scheduler/relay/stream/snapshot/socket/client，重复同commandId并混合支付/普通/到期job；保存receipt/event/ledger、reject、queue reservation、service share和最终对账。

## 9. CAPACITY_MATRIX_1_10_100_1000_10X_DATA

下表只给增长关系，不给未经实测的硬编码阈值。`N[MODEL_ASSUMPTION]` 是测试并发档；所有服务率和服务时间必须在目标 release 上 `[MEASURED]`。

| 档位 | 均匀 owner | 同一 owner/stream | DB/恢复 | AOI/socket/client | 必须得出的结论 |
| ---: | --- | --- | --- | --- | --- |
| 1 | 建立每 command class 的 `S_x[MEASURED]`、locks/WAL基线 | 验证单 key次序、receipt、seq、snapshot cut | 单事务/单事件物理写与故障语义 | 单设备 encode/decode/apply/render | 只能证明语义和服务基线，不能证明容量 |
| 10 | 观察 pool/CPU近线性和第一处共享争用 | `rho_key[DERIVED] = lambda_key[MEASURED] * S_key[MEASURED]` 开始放大 wait | 验证锁序、retry、consumer cursors | 10 actors/watchers与慢连接混合 | 所有 queue items/bytes/age必须可见 |
| 100 | realm/cell skew和maintenance开始显著 | 单 key服务率仍不随机器数增加 | WAL/checkpoint/relay共享资源显现 | 条件性 delivery 接近 actors x watchers | 必须能定位首个物理资源而非只报QPS |
| 1000 | auth、socket、trace、GC与DB pool联动 | 热 key queue必须有确定 admission | snapshot/relay catch-up与前台争资源 | 1000 reconnect/slow clients/client apply | 必须验证拒绝、排空和最终checksum |
| `10x P/HIST` | 热路径访问行数不应随 P 全扫，但cache/index高度会变 | 热 key不因历史量消失 | table/index/WAL/vacuum/backup/restore/object显著放大 | snapshot和bootstrap bytes/构建可能放大 | 必须报告成本斜率、maintenance和实际RTO |

容量上限是共享资源、单 key和恢复约束的交集：

`N_capacity[DERIVED] = min(N_owner[DERIVED], N_stream_head[DERIVED], N_db[DERIVED], N_scheduler[DERIVED], N_relay[DERIVED], N_snapshot[DERIVED], N_socket[DERIVED], N_client[DERIVED], N_recovery[DERIVED])`

其中每个右侧量只能由 `S/demand/rate[MEASURED]` 与 `D/rho/Q/headroom[PRODUCT_SLO]` 推导；使用 `[MODEL_ASSUMPTION]` 时结论仍为 `NOT_PROVEN`。

### 9.1 二十个必须击穿错误容量结论的反例

| ID | 场景 | 首瓶颈/不连续点 | 不能接受的“通过”方式 |
| --- | --- | --- | --- |
| CE01 | 1并发单命令 | 只建立语义和服务基线 | 以单次成功宣称有容量 |
| CE02 | 10并发、不同owner | DB/event-loop共享开始显现 | 只报平均QPS，不报queue bytes/age |
| CE03 | 100并发、90/9/1 realm skew | 最热cell/DB pool而非平均realm | 用均匀hash测试替代skew |
| CE04 | 1000连接、每请求session校验 | auth DB/cache、JWT CPU、trace、socket RSS | 用已登录暖cache替代revocation/cold路径 |
| CE05 | 1000同一owner | 单 key mailbox服务中心 | 用扩机器或全局CPU余量证明同key容量 |
| CE06 | 10k同一tile/city/alliance目标 | owner+stream head+唯一索引热页 | 只统计accepted，不统计终态/reject/retry |
| CE07 | `M_owner`接近`M_max` | lock hold/deadlock/timeout非线性 | 只测独立owner，不测冲突图 |
| CE08 | `M_max+1`转Saga | steps/reservations/events/jobs和补偿成本阶跃 | 把Saga异步化当作零成本 |
| CE09 | 一个命令写player/city/alliance/AOI/audit多stream | stream_heads交叉锁与seq热点 | 只报告owner数M |
| CE10 | 建筑/行军/活动/赛季整点同秒 | claim、hot owner、DB、deadline最小服务率 | 用全天平均job rate |
| CE11 | scheduler pause后lease reclaim+poison | duplicate submit、priority inversion、DLQ | 只证明SKIP LOCKED无DB死锁 |
| CE12 | 1000重连+session revocation+CDN/config cold | auth/snapshot/origin/DB/NIC相关洪峰 | 分开测试各阶段rho |
| CE13 | AOI万人热点 | permission filter、个性化encode、fanout、NIC、client apply | 只测changed tiles或server send成功 |
| CE14 | 10%慢客户端和后台恢复 | per-conn buffer、snapshot振荡、client queue | 只报gateway RSS平均值 |
| CE15 | relay outage 60分钟后catch-up | DB/WAL/consumer/NIC与前台共享 | 用无新流量的理论`B/(mu-lambda)` |
| CE16 | 最慢consumer停顿到retention边界 | stream/inbox/disk、cleanup与snapshot fallback | 只报outbox已发布 |
| CE17 | `10x P`且U不变 | index/cache/vacuum/backup/restore/离线jobs | 用point lookup行数不变证明整体不变 |
| CE18 | 支付callback重复/乱序且系统load shed | journal/Saga/owner order/人工仲裁 | 只报payment endpoint p99 |
| CE19 | rank重算、全服邮件、chat热点、对象归档并发 | shared index、O(P) bulk、fanout、object quota | 把它们归入“异步consumer”后忽略资源 |
| CE20 | 热cell split与鬼区merge并发前台战斗 | copy/catch-up、fence、cursor/ID rewrite、跨cell Saga | 只测稳态分区，不测迁移曲线 |

上述反例覆盖用户要求的 1/10/100/1000、10倍P、10k同目标、整点任务、重连风暴、AOI万人热点和relay outage catch-up；任一格缺失时，capacity result不能外推到该格。

## 10. GATES_THAT_CAN_STILL_BE_GAMED

判定规则：`唯一 PASS/FAIL? = NO` 表示当前条款可以抓住某些明确反例，但缺少 scope、数值、联合负载或原始证据，因而不能从“未观察到失败”唯一推出 PASS。当前结果一律为 `NOT_PROVEN`。

### 10.1 Correctness / Data / Release / Operational gates

| Gate | 唯一 PASS/FAIL? | 必须新增字段 | 直接停止条件 |
| --- | --- | --- | --- |
| C1 | NO | writer inventory、每事务 fence predicate、lease/commit时序、epoch覆盖率 | 任一stale epoch commit、双holder或未fence writer |
| C2 | NO | command payload reference schema、owner derivation版本、authz矩阵、negative corpus | 未授权引用成功或动态owner漏报 |
| C3 | NO | owner/stream/domain/index完整锁目录、canonical order、dynamic discovery计数 | 未声明锁后仍commit、死锁结果不唯一 |
| C4 | NO | command到touched-owner映射、expectedVersion cut、conflict outcome | 缺version仍写入、部分提交或旧值重试 |
| C5 | NO | API/worker/admin/migration/repair writer inventory与运行时命中 | 任一旁路权威写 |
| D1 | NO | 每command transaction membership、event/destination multiplicity、commit LSN关联 | domain/receipt/event/outbox任一孤儿 |
| D2 | NO | outbox/stream职责schema、committed cut证明、retention/cursor关系 | 以published_at切snapshot或重/漏event |
| D3 | NO | per-consumer retry/backoff/max/DLQ/deadline、cursor事务 | cursor越gap、无限retry或poison阻塞关键consumer |
| D4 | NO | projection inventory、rebuild seed/input/checksum/RTO | projection成为权威或重建checksum不同 |
| D5 | NO | external txn/business key、ledger守恒/reversal、callback/reconcile状态 | 双posted、失衡、无源退款或无终态 |
| R1 | NO | 六类digest之外绑定capacity result状态、ruleset/object manifest、signature验证 | 未登记组合、digest不符或capacity仍TBD却放行 |
| R2 | NO | atomic switch窗口、旧进程/连接清零、rollback trace | mixed release写入或手工逐文件修补 |
| R3 | NO | reader/writer/upcaster范围、旧版本活跃量、migration service curve、rollback cut | 不兼容读写或不可回滚contract |
| R4 | NO | 全存储inventory、复制/对象/密钥恢复、RPO/RTO、依赖图 | 缺任何权威对象、RPO/RTO或checksum失败 |
| R5 | NO | writer/lease inventory、epoch/primary fence、receipt/job/Saga/event reconciliation | 任一旧writer存活或unresolved非零 |
| O1 | NO | 每signal阈值、hysteresis、action、dependency和告警时限 | 实际错误时仍healthy、disk/lag无动作 |
| O2 | NO | typed workload、joint evidence、resource matrix、confidence、raw digest | TBD/自由文本/边际拼接/缺首瓶颈 |
| O3 | NO | reachability矩阵、IAM、secret/PII label scan、rotation/revoke时限 | 公网可达、秘密泄漏或超权写权限 |
| O4 | NO | CPU/memory/IO/NIC/DB quota、noisy-neighbor fault、failure domain | 非生产影响生产或资源越界无隔离 |
| O5 | NO | endpoint/account/session/owner/AOI/cost具体预算与reject状态 | 任一维无界、万能固定数或静默drop |

### 10.2 Protocol gates

| Gate | 唯一 PASS/FAIL? | 必须新增字段 | 直接停止条件 |
| --- | --- | --- | --- |
| P1 | NO | revocation lookup/cache TTL/invalidation、multi-device状态机、验证时点 | revoked/frozen旧epoch请求成功 |
| P2 | NO | 与C2相同并加permission epoch/cache invalidation | 未授权实体或过期权限收到/修改状态 |
| P3 | NO | receipt全状态、attempt lineage、domain unique keys、unknown commit deadline | 重试生成新业务事实或终态不唯一 |
| P4 | NO | client state-writer inventory、ACK/event write audit、optimistic reconciliation规则 | ACK patch与EVENT竞争或多权威写通道 |
| P5 | NO | per-stream queue/ACK/cursor/head/retention、调度权重和隔离资源 | 慢流阻塞关键流、跨gap apply |
| P6 | NO | consistent snapshot source、per-stream watermark、owner revisions、checksum | snapshot+delta重/漏或cut来自relay |
| P7 | NO | filter输入/输出、permission epoch失效时限、fanout/CPU/bytes预算 | 权限泄漏、权威event被错误丢弃 |
| P8 | NO | 协议/config/ruleset/event历史范围、upcaster和storage/RTO | 在途battle/event无法按原版本解释 |
| P9 | NO | cadence、DB rows/bytes、CPU、presence TTL、state-load计数 | heartbeat读取完整状态/AOI或做源码hash |
| P10 | NO | authority command/result inventory、client-report omission fault | 缺客户端报告改变权威结果 |
| P11 | NO | WS/SSE/HTTP逐错误码/顺序/cursor/recovery conformance矩阵 | 任一transport终态或resume语义不同 |
| P12 | NO | 按命令类型的数值预算、解压后大小/深度/cost、版本化reject reason | 解析前无界、成本维缺限额或错误不可解释 |

### 10.3 Capacity / recovery gates

| Gate | 唯一 PASS/FAIL? | 必须新增字段 | 直接停止条件 |
| --- | --- | --- | --- |
| H1 | NO | cadence与class mix、CPU/rows/bytes/p99/max、cache miss、`dCost/dP,dV` | 完整状态读取或任一产品预算越界 |
| H2 | NO | event-loop delay/block max、sync IO stack、parse/decompress上限、GC | 单请求同步冻结、无界parse或blocked stack缺失 |
| W1 | NO | logical changed bytes、heap/index/WAL/redo/replica bytes及比例合同 | no-op仍全写、写放大置信上界越线 |
| W2 | NO | per owner type+command top-K、service/queue bytes/age/deadline/reject、cross-key隔离 | 单key不收敛、无界queue或污染无关key |
| W3 | NO | class/realm/owner fairness函数、weights/aging/deadline、lease/DLQ终态 | starvation、旧lease完成、owner内重排或无限毒任务 |
| W4 | NO | 每command复杂度、`M_owner/M_stream/rows/locks/WAL`曲线、M/Saga crossover | 未声明全扫、超曲线、路径随contract漂移 |
| W5 | NO | candidate/allowed fanout、filter/codec/socket/client端到端预算、drop分类 | 权限泄漏、权威event drop、client checksum错 |
| W6 | NO | reconnect联合profile、auth/CDN/snapshot原因、admission、three-watermark | snapshot storm不收敛、cut错或挤压前台 |
| W7 | NO | durable storage方程、per destination/consumer rate、min cursor、restore scratch | drain斜率非负、误删event、disk/RTO越界 |
| W8 | NO | 逐层admission状态机、downstream reservation、paid fairness、attempt lineage | accepted无终态、双扣/丢event/starvation |
| F1 | NO | storage依赖图、writer fence、WAL/stream/outbox/snapshot联立RTO、实际RPO | writer未fence、checksum/RPO/RTO失败、backlog不收敛 |
| F2 | NO | schema-validated raw evidence、run/digest、inventory coverage、OBS开销/采样coverage | 跨run拼接、缺失败样本、证据不可复现或观测过载 |

[SOL21-023][BLOCKER][FACT]
- Attacked v2.1 clause: 以上44个gate的文字目标与HTML末尾 `REFERENCE_V2_STATUS=NOT_PROVEN` 一致，但没有统一 gate result schema来阻止“direct failure未触发即PASS”。
- Workload vector: 全量修订向量和十阶段模型。
- Failure mechanism: gate有的偏结构、有的偏数值、有的偏恢复；实现方可为每个gate自行定义scope和证据，导致审查者无法复算相同结论。
- Coupled capacity expression: gate结果必须是所有必需条件的交集：`PASS_g[DERIVED] = scope_complete_g[MEASURED] AND evidence_valid_g[MEASURED] AND all_invariants_g[MEASURED] AND all_SLO_g[PRODUCT_SLO] AND drain_g[MEASURED]`；任一输入缺失不得默认为true。
- Correctness/SLO impact: 验收正确性阻断；没有唯一判定器就没有可审计容量声明。
- Missing metric or stop condition: 上表逐gate字段、状态枚举 `PASS/FAIL/NOT_PROVEN/NOT_APPLICABLE`、NA理由/审批、evidence digest、失败优先规则；缺字段必须 `NOT_PROVEN`。
- Required revision: 收益：独立审查者得到同一结果；代价：44个gate schema与自动化；迁移风险：既有“绿灯”会回落为NOT_PROVEN；前置指标：scope inventory、typed manifest、raw evidence store；停止条件：任何gate允许null/NA无审批、失败被平均值掩盖或结果不可复算时拒绝release。
- Acceptance test and raw evidence: 两支独立团队只使用同一 evidence package运行gate evaluator，输出必须逐gate完全一致；保存validator版本、输入digest、判定trace和差异报告。

## 11. REQUIRED_LOAD_FAULT_AND_CORRECTNESS_MATRIX

所有测试仅允许在隔离环境、脱敏生产形状副本或合成数据运行。数值阈值来自 `[PRODUCT_SLO]`，服务曲线来自 `[MEASURED]`；未填时测试结果只能是 `NOT_PROVEN`。每项必须包含 warm-up、steady、burst/fault、drain、cooldown 和最终状态校验。

### 11.1 正确性先于性能失败与纯容量优化边界

| 类别 | 至少四项 | 判定原则 |
| --- | --- | --- |
| `CORRECTNESS_FIRST` | stale epoch/owner handoff；receipt unknown commit/load shed；M阈值路径与Saga补偿；scheduler owner顺序/lease reclaim；snapshot+delta cut；支付ledger；cell迁移；retention cursor | 任一不变量失败立即停止，不能继续调参找更高QPS |
| `CAPACITY_OPTIMIZATION_ONLY` | JSON/二进制codec；压缩阈值；relay batch/prefetch；index/fillfactor/vacuum参数；snapshot cache；trace采样/编码 | 仅在正确性矩阵全过后比较；必须报告收益、代价、迁移风险、前置指标和停止条件 |

### 11.2 强制测试矩阵

| ID | 类别 | 场景/故障 | PASS与停止条件 | 必留原始证据 |
| --- | --- | --- | --- | --- |
| T01 | CORRECTNESS_FIRST | lease有效/过期/撤销各阶段暂停并handoff | `stale_commit_count[MEASURED] = 0`、单holder；否则立即停 | tx/LSN、epoch/lease、receipt/domain/event checksum |
| T02 | CORRECTNESS_FIRST | commit前后断连、ACK丢失、相同ID重试/不同payload | 唯一终态和业务结果；unknown超deadline即停 | attempt DAG、receipt、DB commit、响应序列 |
| T03 | CORRECTNESS_FIRST | `M_owner/M_stream`与冲突图扫描，阈值两侧发布 | 路径固定、补偿守恒、无seq gap；否则停 | executionPlan、locks、WAL、Saga/stream ledger |
| T04 | CORRECTNESS_FIRST | 整点job混合、pause/steal/poison/DLQ | owner内顺序、公平、deadline、终态；任一失败停 | claim/lease/order/lag/attempt/DLQ记录 |
| T05 | CORRECTNESS_FIRST | snapshot build各阶段并发commit/crash/schema切换 | snapshot+delta逐字段checksum一致 | watermarks、owner versions、event ledger、client state |
| T06 | CORRECTNESS_FIRST | 支付callback重复/乱序/丢失、refund、load shed | ledger守恒、唯一posted/reversal、终态可查 | channel stub、journal/Saga/ledger/receipt |
| T07 | CORRECTNESS_FIRST | AOI权限撤销、cache stale、viewport churn | `unauthorized_delivery_count[MEASURED] = 0`、gap后不apply | permission epoch、filter audit、wire/event/client checksum |
| T08 | CORRECTNESS_FIRST | hot cell split/move、ghost realm merge、rollback | 单owner、ID/cursor映射和全量checksum一致 | placement/epoch、mapping、copy/catchup、Saga |
| T09 | MIXED | owner不同/同key `N[MODEL_ASSUMPTION] = 1/10/100/1000` + 10k目标 | queue有界、确定reject、cross-key隔离；发散即停 | top-K arrival/service/bytes/age、reject、DB trace |
| T10 | MIXED | 1/10/100/1000 reconnect，窗口内/边界/外 | auth/snapshot/drain收敛且正常命令SLO保持 | auth/cache/CDN/snapshot/DB/socket/client timeline |
| T11 | MIXED | AOI actors/watchers 1/10/100/1000后合成10k | 权限/最终状态正确，资源/queue在合同内 | fanout graph、codec CPU、wire、buffer、client perf |
| T12 | MIXED | 1%/10%/50%慢客户端、后台/零窗口/apply暂停 | 三水位单调、内存有界、fallback不振荡 | per-stream queues、RSS、three-watermark、frames |
| T13 | MIXED | relay/consumer停1/10/60分钟，保持新流量并poison | backlog单调排空、前台SLO、无gap/误删 | rows/bytes/age、resource share、cursor/DLQ/event ledger |
| T14 | MIXED | `10x P/HIST` + vacuum/checkpoint/replica throttle/backup | 复杂度斜率、disk/RPO/RTO、前台SLO均过 | plans/cache/WAL/vacuum/replica/restore/checksum |
| T15 | CAPACITY_OPTIMIZATION_ONLY | JSON/二进制与encode-once/personalized encode | 端到端CPU+BW+client成本有实测净收益；语义不变 | server/client profile、wire bytes、compat checksum |
| T16 | CAPACITY_OPTIMIZATION_ONLY | 压缩算法/阈值/字典和低端设备 | 总CPU、GC、BW、apply改善；任一端恶化超SLO即停 | encode/decode/compress samples、GC、wire、frames |
| T17 | CAPACITY_OPTIMIZATION_ONLY | relay batch/prefetch与DB前台reserve扫描 | drain改善且前台不退化；锁/WAL长尾上升即停 | batch、DB locks/WAL、foreground/catchup curves |
| T18 | CAPACITY_OPTIMIZATION_ONLY | index/fillfactor/vacuum/partition策略 | 写读/maintenance总成本下降；计划或lock回归即停 | plans、page/index stats、WAL、vacuum、latency |
| T19 | CAPACITY_OPTIMIZATION_ONLY | snapshot cache/prebuild/object tier | hit时净收益且cut/invalidations正确；stale即停 | cache key/version/watermark、object IO、checksum |
| T20 | CAPACITY_OPTIMIZATION_ONLY | metrics/log/trace/profile采样矩阵 | 观测成本在预算且failure/top-K覆盖；证据缺失即停 | series/cardinality、export queue、drop、tail coverage |

[SOL21-024][BLOCKER][FACT]
- Attacked v2.1 clause: W2-W8/F1-F2 已点名多数单项场景，但没有要求上述场景交叉叠加、正确性优先短路和统一原始证据包。
- Workload vector: 修订后完整向量，至少覆盖 CE01-CE20 与 T01-T20。
- Failure mechanism: 单项压测可在暖缓存、无maintenance、无retry和均匀owner下过关；真实事故通常是deploy/reconnect/relay lag、hot owner和DB maintenance叠加。继续在正确性已失败的run上调吞吐会把错误结果当性能样本。
- Coupled capacity expression: 每个run必须计算带标记输入的共享 `rho_r[DERIVED]`、端到端deadline、queue bytes/age和drain derivative；`PASS_run[DERIVED]` 是 correctness invariants与所有 `[PRODUCT_SLO]` 的交集。
- Correctness/SLO impact: 测试方法阻断；缺矩阵时任何容量数字都不可外推。
- Missing metric or stop condition: scenario composition、seed、release/hardware/config、fault timeline、raw samples、final checksums、correctness-first abort；任一缺失即NOT_PROVEN。
- Required revision: 收益：容量结论覆盖真实相关故障；代价：隔离环境、数据生成、fault injection和证据存储；迁移风险：不真实数据形状造成错误拐点；前置指标：脱敏production shape与fixed seed；停止条件：误触公网/生产、correctness失败、资源安全水位或backlog发散立即终止。
- Acceptance test and raw evidence: gate runner按小档CI、完整认证档执行矩阵，同release/seed可复现；保留runner manifest、fault log、raw metrics/traces、DB/event/ledger/client checksums和判定输出。

## 12. REQUIRED_SPEC_REVISIONS

以下修订不是实现建议清单，而是让 v2.1 capacity contract 不能被“填表过关”的最小规范增量。任何具体优化只能在对应前置指标已测后选择。

| Revision | 必须新增的规范 | 收益 | 代价 | 迁移风险 | 前置指标 | 停止条件 |
| --- | --- | --- | --- | --- | --- | --- |
| REV21-01 | typed workload/evidence schema、单位、joint run id、digest、PASS/FAIL/NOT_PROVEN evaluator | 唯一可复算gate | validator与证据仓库 | 历史报告回落NOT_PROVEN | inventory、trace、raw store | TBD/自由文本/跨run拼接 |
| REV21-02 | 修订向量 `X_cmd/J_due/G_fan/X_ext/L_shared/REP/MAINT/HIST/TOPO/RETRY/OBS/DEPLOY` | 覆盖旁路与相关峰值 | catalog维护 | 命令版本口径变化 | 稳定type与writer inventory | unknown type/writer |
| REV21-03 | 十阶段routing/feedback矩阵与共享resource demand matrix | 找到真实首瓶颈 | service-demand profiling | instrumentation扰动 | per-class visits与resource counters | 任一caller未建模或rho不收敛 |
| REV21-04 | 联合tail/timeout/censoring、端到端trace与置信规则 | 防成功样本偏差 | 原始数据量 | 稀有尾部样本不足 | 时钟、tail sampling | 丢timeout/失败或样本不足 |
| REV21-05 | owner lease commit-time fencing、handoff linearization与长事务语义 | 闭合单写正确性 | 更强锁/续租/abort | retry放大 | tx/pause/handoff分布 | stale commit或双holder |
| REV21-06 | `M_owner/M_stream/rows/locks/WAL`与conflict graph；persisted executionPlan和M阈值曲线 | M_max可实测且重试不漂移 | 大矩阵与Saga双路径 | 在途流程兼容 | txn/Saga曲线 | 路径漂移、补偿失败、曲线越SLO |
| REV21-07 | per-stream head拓扑、producer graph、lock order、seq/cursor迁移 | 控制stream新热点 | sequencer/分流复杂 | cursor与旧客户端不兼容 | top-K stream/lock trace | seq gap/双head/无法映射cursor |
| REV21-08 | 物理write amplification：heap/index/WAL/redo/replica/vacuum/checkpoint | D1成本可预算 | DB深度观测 | schema/index变更锁风险 | 真实schema与maintenance profile | lag/headroom/lock越合同 |
| REV21-09 | owner-aware scheduler公平函数、deadline、aging、reclaim、DLQ业务终态 | 抵抗整点与饥饿 | 分层调度复杂 | 可见时序变化 | due/cost/deadline/conflict分布 | starvation、旧lease完成、owner重排 |
| REV21-10 | external payment inbox/journal/Saga/reconcile及paid公平政策 | 支付终态正确 | 渠道集成与人工仲裁 | 旧账迁移 | channel语义、business keys、法规 | 双扣/失衡/无终态 |
| REV21-11 | rank/chat/mail/object/history独立workload、retention、quota与restore | 长期共享系统可算 | 冷热分层/对象运维 | 引用断裂 | history bytes/访问/法规 | restore/checksum/RTO失败 |
| REV21-12 | AOI candidate-to-render预算、permission audit、encode复用条件、drop分类 | 万人热点端到端可判 | server/client埋点 | 合并泄漏或顺序错误 | fanout/permission/device traces | 权限泄漏、权威drop、checksum错 |
| REV21-13 | slow-client receive/applied/acked水位、per-stream buffer与snapshot fallback状态机 | 内存与resume闭合 | 协议状态增加 | 旧cursor语义不兼容 | RTT/socket/apply档位 | 水位逆序、振荡、RSS发散 |
| REV21-14 | deploy/reconnect/auth/CDN/snapshot联合profile与自动rollback gate | 发布洪峰可恢复 | 全链路演练 | jitter/升级策略影响用户 | deploy与区域CDN/auth分布 | 任一版本/区域不收敛或安全失败 |
| REV21-15 | stream/outbox/inbox/snapshot/WAL/replica/backup联立磁盘与动态catch-up throttle | outage可排空且不挤前台 | 跨存储容量控制 | batch/order改变下游 | service curves、cursor registry | drain非收敛、误删、disk/RTO越界 |
| REV21-16 | realm/cell split/move/merge、ID/cursor/object迁移与cross-cell曲线 | 分区可运营 | placement与迁移工具 | 双owner/历史引用 | heatmap、cross-cell与mapping inventory | fence/checksum/catch-up失败 |
| REV21-17 | 分层admission、downstream reservation、receipt终态、paid/normal fairness | load shed仍正确 | token/reservation与查询API | 旧客户端兼容 | class SLO、queue/headroom | accepted无终态、双扣、event缺失、饥饿 |
| REV21-18 | OBS budget、label whitelist、tail sampling、export backlog与证据coverage | 监控不自毁且可审计 | 观测管线治理 | 历史series断裂 | cardinality/CPU/BW/drop | 观测超预算或关键失败无证据 |
| REV21-19 | CE01-CE20、T01-T20的隔离runner、correctness-first短路和raw evidence contract | 防单项/平均测试过关 | 环境与存储成本 | 数据生成偏差 | 脱敏shape、fixed seed、fault tooling | 公网/生产影响、correctness失败或不可复现 |

最终判定：v2.1 对首轮问题做了实质性规范补强，但 capacity contract 仍可被实现方通过选择命令混合、拆开相关峰值、忽略共享资源、缩短retention、只报成功样本和自定阈值来填表过关。上述 REV21-01 至 REV21-19 与相应原始证据完成前，唯一允许的结论仍是 `NOT_PROVEN`；单写、加机器、平均QPS、平均延迟或总CPU均不能改变该结论。
