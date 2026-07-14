# wxgame 参考架构 v2.2 第三轮独立容量对抗审查（GPT-SOL）

审查对象仅限以下输入：

- `7月14日后端架构/成熟SLG后端参考架构-v2.2.html`
- `7月14日后端架构/容量合同-v2.2.schema.json`
- `7月14日后端架构/容量合同判定器规范-v2.2.md`
- `7月14日后端架构/当前实现迁移路线图-v2.2.md`
- 为核对范围完整性而只读检查的当前 route、command、job、consumer、client writer inventory 与写入热路径

未读取任何 `architecture-v2.2-adversarial-*` 报告或其他席位输出。

来源标签：

- `[MEASURED]`：本轮机械校验、仓库静态检查或可复现命令的直接结果。
- `[PRODUCT_SLO]`：v2.2 参考架构或判定器规范明确要求。
- `[MODEL_ASSUMPTION]`：尚待实测的负载、分布或成本假设，只能触发 `NOT_PROVEN`，不得产生 `PASS`。
- `[DERIVED]`：由已标注事实进行的确定性推导。

问题分类沿用共同纪律：`CONFIRMED_SPEC_CLOSURE`、`UNDER_SPECIFIED`、`SPEC_CONTRADICTION`、`UNTESTABLE`、`IMPLEMENTATION_ONLY_GAP`。

## 1. CAPACITY_V2_2_VERDICT

```text
CAPACITY_V2_2_VERDICT = NOT_PROVEN
REFERENCE_V2_2_STATUS = NOT_PROVEN
CURRENT_IMPLEMENTATION = NON_CONFORMING
```

- `[PRODUCT_SLO]` 参考架构和判定器规范明确规定：结构校验只是入口，跨字段关系、联合负载、证据绑定、守恒和最终结果必须由确定性 evaluator 重算。
- `[MEASURED]` 八个指定坏样例中，schema 拒绝 3 个，接受 5 个。被接受的是 mix 总和 1.5、`p99 < p95`、stage 字段使用错误但枚举内的单位、虚假 PASS condition、跨 run URI。
- `[MEASURED]` 当前仓库没有可执行的 `slg-capacity-evaluator-v2.2`、对应 mutation suite 或发布清单中的 evaluator 制品；因此文字规范尚未形成机器门禁。
- `[DERIVED]` 仅凭当前 schema，提交方可以自选一个 gateway stage、一个任意 gate、空 fault 列表和极小 workload，得到结构上合法的 `overallResult=PASS`。这是 `P1 UNTESTABLE`。
- `[DERIVED]` 即使未来照文字实现 evaluator，当前 schema 仍不能提供 `arrivalRate.mean`、`serviceTime.mean`、联合 trace 形状、共享资源中心和完整最终守恒计数。算法没有可计算的封闭输入，属于 `P1 SPEC_CONTRADICTION/UNTESTABLE`。
- `[DERIVED]` `overallResult=PASS` 在 schema 中要求所有 gate 都为 `PASS`，判定器却允许“适用 gate 全 PASS，加有效 `NOT_APPLICABLE`”得到整体 PASS。两条要求不能同时满足，属于 `P1 SPEC_CONTRADICTION`。
- `[DERIVED]` `finalState` 未承载 cursor gap、ledger imbalance、owner violation、权威事件丢弃、清理删除和 accepted-to-terminal 守恒。实现方可以在结构合同外丢数据或清理积压，再声明 checksum 和 backlog 成功，属于 `P0 UNTESTABLE`。
- `[MEASURED]` 当前实现仍缺目标 `scheduled_jobs`、`consumer_cursors`、`stream_events`、完整 Saga、`owner_leases` 和容量 evaluator。该事实只标为 `IMPLEMENTATION_ONLY_GAP`，不用于降低 v2.2 标准。

### 阻断项

| 严重度 | 分类 | 阻断项 | 裁决依据 |
|---|---|---|---|
| P0 | `UNTESTABLE` | 最终状态没有权威输入、提交、应用、丢弃、清理的守恒字段，aggressive drop 可在合同外发生 | `[PRODUCT_SLO]` drain 不得靠丢权威事件、缩短 retention、跳过 poison item 或清除未决项；`[DERIVED]` schema 无法表达复算所需事实 |
| P1 | `SPEC_CONTRADICTION` | evaluator 使用 `arrivalRate.mean * serviceTime.mean`，schema 的 percentile 对象没有 `mean` 且 `additionalProperties:false` | `[MEASURED]` schema 字段集合；`[PRODUCT_SLO]` 判定器第 9 节公式 |
| P1 | `SPEC_CONTRADICTION` | schema 禁止 overall PASS 含合法 NA，判定器允许 | `[MEASURED]` schema 的 overall PASS 条件；`[PRODUCT_SLO]` 判定器第 11 节 |
| P1 | `UNTESTABLE` | gate、stage 和 scenario 没有 mandatory inventory，ID 可自由选择且可重复 | `[MEASURED]` 最小单 gate、单 stage PASS 基线被接受 |
| P1 | `UNTESTABLE` | 边际 mix 和独立 stage 无法证明相关峰值来自同一联合 trace | `[MEASURED]` schema 无 phase/scenario/trace 关联字段；`[PRODUCT_SLO]` 同 trace 要求 |
| P1 | `UNDER_SPECIFIED` | 无共享 resource center、多对多 visit 和容量字段 | `[PRODUCT_SLO]` CPU、DB pool、WAL/disk、network、GC、socket buffer 均须独立证据；`[MEASURED]` schema 无对应结构 |
| P1 | `IMPLEMENTATION_ONLY_GAP` | 无可执行 evaluator、自身 mutation evidence 和复算入口 | `[MEASURED]` 当前仓库检查；`[PRODUCT_SLO]` 未通过 mutation suite 时全部保持 `NOT_PROVEN` |

## 2. SCHEMA_MECHANICAL_ATTACK_RESULTS

### 2.1 方法与工具边界

- `[MEASURED]` 被测 schema SHA-256 为 `2d2143e203ea385dd62b31c859c2cb38d954faec2824b2f8914097faed00002e`。
- `[MEASURED]` 本机工具链为 Node `v24.15.0`、Ajv `6.15.0`。Ajv 6 不是 draft 2020-12 完整实现，因此采用原 schema、不修改字节，并以 `validateSchema:false, meta:false, allErrors:true` 做兼容校验。
- `[MEASURED]` 本轮攻击涉及的 `type`、`enum`、`contains`、`if/then`、`const`、`pattern`、`$ref` 均实际执行。Ajv 6 不实现 `minContains/maxContains`，但 phase 数固定为 6，且六种枚举各有一个普通 `contains`，所以“缺 drain/重复 warmup”用例仍由缺失的 `contains` 确定拒绝。
- `[DERIVED]` 这些结果足以证明存在结构逃逸，但不能替代使用正式 draft 2020-12 validator 的发布验收。正式 validator 与 Ajv 6 的结果不一致时必须 `NOT_PROVEN`。

最小基线是一个填满全部必填字段的单 stage、单 gate PASS 合同：inventory 每类仅一个 ID，三个 mix 各一个 `fraction:1`，六个 phase 各一次，`faults:[]`，一个 gateway stage，一个条件为 `1 <= 2` 的 PASS gate，一个同 run artifact，最终未决计数全零。所有 digest 使用格式合法的 `sha256:` 加 64 个十六进制字符。基线结构校验结果为 `ACCEPT`。`[MEASURED]`

每个攻击从该基线深拷贝，只修改表中片段；`ACCEPT` 仅表示通过 JSON Schema，不表示 evaluator 应判 PASS。

### 2.2 八个强制攻击

| # | 最小变异片段 | 预期坏语义 | validator | 直接输出/原因 | 裁决 |
|---:|---|---|---|---|---|
| 1 | `overallResult:"PASS"; gates[0].result:"FAIL"` | overall PASS 掩盖 gate FAIL | **REJECT** | `gates[0].result` 未满足 overall PASS 分支的 `const:PASS` | `[MEASURED] CONFIRMED_SPEC_CLOSURE`，schema 已挡住该形状 |
| 2 | `overallResult:"PASS"; finalState.unresolvedSagaCount:1` | 未决 Saga 非零仍 PASS | **REJECT** | `unresolvedSagaCount` 未满足 `const:0` | `[MEASURED] CONFIRMED_SPEC_CLOSURE`，同样覆盖 receipt/job、backlog 声明值 |
| 3 | `commandMix:[{fraction:.75},{fraction:.75}]` | mix 总和 1.5 | **ACCEPT** | 无错误 | `[MEASURED]` 聚合求和只能依赖 evaluator；当前无实现，故 `UNTESTABLE` |
| 4 | `phases[4].name:"warmup"` | 缺 drain 且重复 warmup | **REJECT** | drain 对应 `contains` 无匹配项 | `[MEASURED] CONFIRMED_SPEC_CLOSURE`；严格顺序仍未闭合 |
| 5 | `serviceTime:{p50:1,p95:10,p99:1,max:10,unit:"ms"}` | `p99 < p95` | **ACCEPT** | 无错误 | `[MEASURED]` 必须由 evaluator 重算；当前 `UNTESTABLE` |
| 6 | `serviceTime.unit:"bytes"` | stage 字段与单位不匹配 | **ACCEPT** | `bytes` 属通用 percentile enum | `[MEASURED]` 字段级单位未类型化；当前 `UNTESTABLE` |
| 7 | `operator:"lte", threshold:2, observed:3, result:"PASS"` | 条件实际为 false | **ACCEPT** | 无错误 | `[MEASURED]` schema 信任声明 result；当前无 evaluator 重算，故 `UNTESTABLE` |
| 8 | `artifact.uri:"runs/<otherRunId>/metrics.json"`，artifact 的声明 `runId` 仍为根 run | URI 实际指向另一 run | **ACCEPT** | 无错误 | `[MEASURED]` schema 不解引用 URI；typed artifact 复核尚不可执行 |

第 1 个用例的 Ajv 关键错误路径为 `#/allOf/0/then/properties/gates/items/allOf/1/properties/result/const`；第 2 个为 `#/allOf/0/then/properties/finalState/properties/unresolvedSagaCount/const`；第 4 个为 `#/properties/phases/allOf/4/contains`。`[MEASURED]`

### 2.3 扩展机械攻击

| 攻击 | validator | 结论 |
|---|---|---|
| 数值字段置 `null` | REJECT | `[MEASURED] CONFIRMED_SPEC_CLOSURE`，`type:number/integer` 能拒绝 null |
| stage unit 使用任意自由文本 `fortnight` | REJECT | `[MEASURED] CONFIRMED_SPEC_CLOSURE`，但枚举内错误单位仍可逃逸 |
| condition unit 使用任意非空自由文本 | ACCEPT | `[MEASURED] UNDER_SPECIFIED`，threshold/observed 的单位可以自定义 |
| digest 不符合 `sha256:[0-9a-f]{64}` | REJECT | `[MEASURED] CONFIRMED_SPEC_CLOSURE`，只保证格式，不保证内容真实 |
| 所有 digest 使用格式合法的伪值 | ACCEPT | `[MEASURED]` schema 无法重算 digest，必须由 evaluator 读取 bytes |
| phase 六种齐全但顺序打乱 | ACCEPT | `[MEASURED]` 严格顺序只存在于 evaluator 文字规范 |
| phase window `start >= end` | ACCEPT | `[MEASURED]` 时间窗倒置未被 schema 拦截 |
| 根 `startedAt > completedAt` | ACCEPT | `[MEASURED]` run 时间倒置未被 schema 拦截 |
| artifact `capturedAt` 位于 run 外 | ACCEPT | `[MEASURED]` 证据时间边界未被 schema 拦截 |
| artifact 声明 `runId` 与根 run 不同 | ACCEPT | `[MEASURED]` 跨 run 关系未被 schema 拦截 |
| stage/gate `evidenceRefs` 指向不存在的 evidenceId | ACCEPT | `[MEASURED]` 引用完整性未被 schema 拦截 |
| `expectedChecksum != observedChecksum` 但 `checksumMatched:true` | ACCEPT | `[MEASURED]` checksum 布尔值未由 digest 关系约束 |
| 重复 mix type、`stageId`、`gateId` 或 artifact `evidenceId` | ACCEPT | `[MEASURED]` 对象数组没有按键唯一性约束 |
| utilization percentile 大于 1 | ACCEPT | `[MEASURED]` 通用 percentile 只要求非负 |
| `totalPlayers < concurrentActiveUsers` | ACCEPT | `[MEASURED]` workload 形状关系未被 schema 拦截 |
| `connections < concurrentActiveUsers` 且没有无连接模型审批 | ACCEPT | `[MEASURED]` 形状与 NA 关系未被 schema 拦截 |
| `touchedOwnersP99 > touchedOwnersMax` | ACCEPT | `[MEASURED]` 分位与最大值关系未被 schema 拦截 |
| phase 或 fault `durationSeconds:0` | ACCEPT | `[MEASURED]` 可用零时长缩短观察/注入窗口 |
| condition threshold 声明 `source:"MEASURED"` | ACCEPT | `[MEASURED]` 单个 source 无法强制 threshold 来自 `PRODUCT_SLO` |
| 单 gateway stage、单任意 gate、`faults:[]` 的 overall PASS | ACCEPT | `[MEASURED]` mandatory scope 不存在 |
| overall PASS 包含审批完整的 `NOT_APPLICABLE` gate | REJECT | `[MEASURED] SPEC_CONTRADICTION`，与 evaluator 的整体规则冲突 |

### 2.4 机械攻击裁决

- `[PRODUCT_SLO]` evaluator 规范已经逐项声明要拒绝 mix 错误、分位逆序、单位错配、false condition、跨 run、悬空引用、丢失败样本、无效 fault 和 aggressive drain。这些跨字段检查归 evaluator 合理。
- `[DERIVED]` “规范文字写了检查”不等于“schema + evaluator 已阻止作弊”。当前没有可执行 evaluator、自身 digest 可验证制品和 mutation 运行结果，所以所有依赖 evaluator 的逃逸仍为 `NOT_PROVEN`。
- `[DERIVED]` 对 `mean`、联合 trace、共享资源和最终守恒字段，问题不只是缺实现，而是输入合同无法完整表达；即使实现 evaluator 也不能凭现有 JSON 唯一复算。

## 3. EVALUATOR_GAPS

### 3.1 职责边界审查

| 能力 | 规范状态 | 当前可执行状态 | 裁决 |
|---|---|---|---|
| schema 结构、类型、枚举、基础范围 | 已定义 | 可运行，但本机非正式 draft 2020-12 工具链 | `[MEASURED]` 部分闭合，发布链仍 `NOT_PROVEN` |
| evaluator `version` | schema 固定为 `slg-capacity-evaluator-v2.2` | 字符串可填，无制品 | `[MEASURED]` 版本字段存在，不应误报为缺失；真实性未证明 |
| `algorithmDigest` | schema 必填且校验 SHA-256 格式 | 无二进制/源码制品与其比对 | `[MEASURED] IMPLEMENTATION_ONLY_GAP` |
| 失败优先级 | FAIL > NOT_PROVEN > 有效 NA > PASS 已明确 | 无执行实现 | `[PRODUCT_SLO]` 规则存在；`[MEASURED]` 尚不可执行 |
| 输出 JSON 与退出码 | 已定义 | 无命令入口 | `[PRODUCT_SLO]` 输出契约存在；`[MEASURED]` 缺少复算命令、制品定位和调用示例 |
| reason code | 输出要求数组，示例含个别 code | 无冻结的 code catalog、参数格式和排序规则 | `[DERIVED] UNDER_SPECIFIED`，同一输入可能产生不同规范化输出 |
| artifact 读取与 digest 重算 | 文字要求明确 | artifact 类型只有宽泛 enum，无各类型机器格式 | `[DERIVED] UNTESTABLE`，无法确定从 bytes 提取 run、phase、sample 和 counters 的算法 |
| mix、phase、分位、单位、condition 重算 | 文字要求明确 | 无 evaluator/mutation suite | `[MEASURED] IMPLEMENTATION_ONLY_GAP` |
| mandatory gate/stage/inventory | 文字要求 scope 完整 | 无规范 gate profile 或部署到 gate 的确定映射 | `[DERIVED] UNTESTABLE` |
| 联合 trace、共享 resource center | 文字要求明确 | schema 无可表达结构 | `[MEASURED] UNTESTABLE` |
| 最终正确性守恒 | 文字要求 cursor/ledger/owner 等为零 | schema `finalState` 无对应字段 | `[MEASURED] SPEC_CONTRADICTION/UNTESTABLE` |

### 3.2 两处直接规范矛盾

1. `mean` 不可表达。

   - `[PRODUCT_SLO]` 判定器要求 `rho = arrivalRate.mean * serviceTime.mean`，且二者必须来自相同 class/window/unit。
   - `[MEASURED]` `$defs.percentiles` 仅允许 `p50/p95/p99/max/unit`，并设置 `additionalProperties:false`。
   - `[DERIVED]` 合法合同不能包含公式所需的 `mean`。除非修订 schema，或明确规定 evaluator 从哪一个 typed raw artifact 重算 mean，否则 rho 没有唯一输入，不能 PASS。

2. `NOT_APPLICABLE` 与整体 PASS 冲突。

   - `[PRODUCT_SLO]` 判定器允许“每个适用 gate PASS 且每个 NA 审批有效”得到整体 PASS。
   - `[MEASURED]` schema 的 overall PASS 分支强制 `gates[*].result == PASS`。
   - `[DERIVED]` 含合法 NA 的合同无法进入 evaluator，两个规范要求不可同时满足。必须修改其一，不能由实现方自行解释。

### 3.3 仍缺少的确定性语义

- `[MEASURED]` `gateId` 是任意非空字符串，schema 和规范均没有 C1-C7、D1-D7、R1-R6、O1-O6、W1-W8、F1 与部署 profile 的机器清单。重复 ID 也合法。
- `[DERIVED]` evaluator 无法区分“这个部署确实不适用某 gate”和“提交方根本没提交该 gate”，因此 scopeComplete 仍是自我声明。
- `[MEASURED]` condition 只有一个 `source`。一个 condition 同时需要 `thresholdSource=PRODUCT_SLO` 和 `observedSource=MEASURED`，当前对象只能选其一，也没有 condition 级 threshold/observed evidenceRef。
- `[MEASURED]` percentile 对象没有 `sampleCount`、失败/超时样本数、丢样本数、采样率、窗口 ID 或原始样本引用。
- `[DERIVED]` “只保留成功样本”“缩短窗口”“错误样本采集失败”无法仅靠当前合同复算，必须读取未定义格式的 artifact，结果不唯一。
- `[MEASURED]` `faults[].expectedInvariant` 是自由文本，fault timeline artifact 也没有 typed event schema。
- `[DERIVED]` evaluator 无法稳定判断 fault 是否命中目标、实际持续多久以及故障与样本窗口是否重叠。
- `[MEASURED]` `algorithmDigest` 和 evaluator `version` 已存在，失败优先级也已写明；真正缺口是可取的 evaluator 制品、schema digest、签名信任链、固定复算入口、稳定 reason-code 表和已发布 mutation evidence。
- `[MEASURED]` 当前没有上述 evaluator 或 mutation suite。依规范第 12 节，所有容量结果必须保持 `NOT_PROVEN`。

## 4. COUPLED_STAGE_AND_SHARED_RESOURCE_MODEL

### 4.1 必须保存的联合事件

每个外部请求、command、job、consumer delivery、relay batch、snapshot、socket push 和 client apply 必须在同一 run 的联合 trace 中携带至少以下键：

```text
runId, scenarioId, phaseId, traceId, causalId, timestamp
routeId, commandType, jobType, consumerGroup, clientWriterId
ownerType, ownerKeys, ownerCount, zoneId, allianceId, AOI cohort
attempt, retryCause, accepted/rejected/dropped class
stageId, resourceCenterId, queueEnter/leave, serviceStart/end
rowsRead/written, lockWait, walBytes, ioBytes, networkBytes
gcPause, socketBufferBytes, snapshotBytes, clientApplyDuration
```

- `[PRODUCT_SLO]` 同一联合 trace 是防止拆开相关峰值、跨 phase 复用样本和独立 p99 错加的必要条件。
- `[DERIVED]` 仅有三个边际 mix 和各 stage 的独立 percentile，无法恢复上述联合分布；不同相关结构可以产生相同边际值，却有完全不同的尾延迟和容量。

### 4.2 到达、访问次数与共享资源

对 phase `p`、业务 class `c`、stage `x`、resource center `r`，至少按以下关系复算：

```text
lambda[x,p]
  = sum_c(lambdaExternalAccepted[c,p] * visits[c,x,p])
  + lambdaJob[x,p] + lambdaConsumer[x,p] + lambdaRecovery[x,p]
  + lambdaRetry[x,p]

demand[c,r,p] = sum_x(visits[c,x,p] * meanServiceAtResource[c,x,r,p])

rho[r,p] = sum_c(lambda[c,p] * demand[c,r,p]) / parallelCapacity[r,p]
```

- `[PRODUCT_SLO]` `requests_per_second * ms` 必须先除以 1000，并纳入 visit ratio、fanout、retry amplification 和实际并行度；否则 `rho` 量纲错误。
- `[DERIVED]` 对单一热点 owner，`parallelCapacity=1`。增加机器不能提高同一 owner 的串行 service capacity，只能降低无关 owner 的争用。
- `[MODEL_ASSUMPTION]` 到达分布不是默认 Poisson，service time 也不是默认指数分布；在没有拟合检验前，不得用 M/M/1 或 M/M/m 公式产生 PASS。
- `[PRODUCT_SLO]` p99 以同一 trace 的端到端时长直接计算。不能将 gateway、DB、socket 等独立 p99 相加，也不能假定各 stage 独立。
- `[DERIVED]` 独立 stage p99 相加既不是端到端 p99 的恒等式，也会遗漏共享资源造成的正相关排队。容量裁决必须使用端到端 empirical quantile 与 stage/resource 因果分解两套证据。

### 4.3 共享 resource center 最小模型

| resource center | 共享消费者 | 必须测量的共同量 | 逃逸方式 |
|---|---|---|---|
| 应用 CPU 核 | gateway、auth、owner mailbox、scheduler、relay、snapshot、序列化、压缩 | core-time、run queue、steal、per-class demand、GC 前后 CPU | `[DERIVED]` 分 stage 报低 CPU，忽略同机叠峰 |
| runtime/GC | 所有 Node 热路径、buffer、snapshot 和大 payload | heap、allocation rate、pause、event-loop lag、OOM/restart | `[DERIVED]` 只报平均 CPU，隐藏 burst pause |
| DB connection pool | auth、receipt、owner txn、scheduler claim、consumer cursor、relay | active/waiters、wait p99、txn duration、timeout、pool size | `[DERIVED]` 每类独测都不过载，联合时池耗尽 |
| DB CPU/locks | owner txn、热点 alliance/zone、job complete、Saga | lock graph、rows、deadlock/retry、CPU time | `[DERIVED]` 均匀 owner 掩盖同 key 串行与锁队列 |
| WAL/disk/IOPS | domain rows、receipt、jobs、stream、outbox、snapshot、DLQ | WAL bytes/s、fsync、write/read latency、queue、headroom | `[DERIVED]` 只放大在线用户，不放大 retention 和历史数据 |
| 网络 | ingress、DB、relay、event stream、snapshot、socket | bytes/s、packets、retransmit、compression CPU、egress cap | `[DERIVED]` AOI、snapshot、relay catch-up 分开测 |
| socket buffer | AOI、玩家流、聊天流、snapshot delta | per-connection/total bytes、oldest age、drop class | `[DERIVED]` 靠丢权威事件制造低内存与快速 drain |
| client apply | snapshot、ordered event、AOI visible stream | apply p50/p95/p99/max、frame stall、cursor lag、checksum | `[DERIVED]` 服务端 socket 成功被误当成客户端状态已收敛 |

`[PRODUCT_SLO]` 每个实际瓶颈中心缺证据即 `NOT_PROVEN`。`[MEASURED]` 当前 schema 只有 stage，没有 resource center、stage-to-resource visit、并行度或资源容量字段。

### 4.4 Fault、burst 与 drain 守恒

对每个有权威语义的队列必须按固定时间桶保存：

```text
Q(t+dt) = Q(t) + authoritativeAccepted(t,dt)
                  + legitimateRetryEnqueued(t,dt)
                  - terminallyCompleted(t,dt)
                  - explicitlyPermittedNonAuthoritativeDrop(t,dt)

authoritativeAccepted
  = committedSuccess + terminalBusinessFailure + unresolvedAtEnd

producedAuthoritativeEvents
  = appliedOrAcknowledgedByRequiredConsumers
  + retainedPending
  + unresolvedDLQ
```

- `[PRODUCT_SLO]` 权威 command/event 的 drop 项必须为 0；视觉类可丢事件必须由产品语义列出类型，且不能推进权威 cursor 或伪造 checksum。
- `[PRODUCT_SLO]` drain PASS 必须同时满足新流量继续、前台 SLO 通过、backlog 单调收敛，并在 deadline 内归零或回到 steady bound。
- `[DERIVED]` 只报 `backlogDrained:true` 和一个 `drainDurationMs`，无法区分真实消费、清空表、缩短 retention、跳过 poison item或停止前台流量。
- `[PRODUCT_SLO]` `T_drain >= B / (mu_effective - lambda_new)` 只有在分母为正、单位一致、B 和新流量来自同一队列/phase 时有意义。
- `[MODEL_ASSUMPTION]` `mu_effective` 在 fault 后保持 steady 值、catch-up 不影响前台、retry 不放大负载，均不能默认成立；必须由 fault/drain trace 实测。

### 4.5 10x data age 模型

```text
retainedBytes(age)
  = receiptBytes + streamEventBytes + snapshotBytes + outboxBytes
  + DLQBytes + indexBytes + backupBytes + archiveWALBytes
```

- `[PRODUCT_SLO]` 10x data 测试必须保持目标 CAU 不变，单独将数据年龄、保留窗口、慢 cursor 距离和历史基数放大 10 倍。
- `[DERIVED]` 只把 `totalPlayers` 或在线用户放大 10 倍，不能证明 retention、receipt、stream、snapshot、DLQ、索引、备份和恢复成本的拐点。
- `[MEASURED]` 当前 schema 只有 `datasetShapeDigest`，没有各数据族 rows/bytes/age/retention/cursor/backup shape，无法由 JSON 唯一验证 10x data age。

## 5. HOT_OWNER_AOI_SCHEDULER_RECOVERY_ATTACKS

### 5.1 热点 owner 与 `M_max`

| 攻击 | 当前可利用点 | 必须出现的证据 | 当前裁决 |
|---|---|---|---|
| 均匀 owner 替代同一 owner | `hotOwnerFraction` 只有一个标量，无 top-K、owner type 和每 key trace | player/city/tile/alliance/cell 分别做同 key 1/10/100/1000 与 10k burst，测 arrival、service、depth、oldest age、reject | `[DERIVED] NOT_PROVEN` |
| 同 zone/alliance 峰值拆开 | schema 没有 zone/alliance skew、锁冲突图 | 同一 zone、同一 alliance 的联合 command/job/consumer trace，DB lock/WAL/CPU 同时采集 | `[DERIVED] NOT_PROVEN` |
| 用 `M_max` 改写原子业务 | schema 只有三个整数，无 command 级 admission 事实 | M-1/M/M+1 touched-owner 边界、原子拒绝 reason、零副作用、稳定 receipt、同一 commandId 恢复 | `[PRODUCT_SLO]` 自动转 Saga 为 FAIL；当前输入 `UNTESTABLE` |
| 只计 owner 数，不计 execution plan | 无 rows/locks/steps/bytes/版本检查成本 | unique authoritative owner count、plan_attempt、owner_set_hash、锁数、rows、WAL、txn time | `[DERIVED] NOT_PROVEN` |
| 用大量非法请求降低成本 | `rejected_invalid` 只计数，不绑定 mix/trace | 每类 offered、accepted、各 reject reason 与产品合法性比例；容量只按合法 offered load 评估 | `[DERIVED]` 可廉价化 workload，当前 `UNTESTABLE` |
| 把全部超限命令算作合法 Saga | 无 Saga eligibility/ratio/plan shape | 产品批准的 Saga command allowlist，eligible/attempted/started/completed/compensated 比例和每 step 成本 | `[PRODUCT_SLO]` MODEL_ASSUMPTION 不得 PASS；当前 `UNTESTABLE` |

`[DERIVED]` `M_max` 的唯一可复算单位应是“单次原子 execution plan 中去重后的权威 owner 数”，不是 payload 引用数、SQL 行数、锁数、服务数或 Saga step 数。其他成本维度必须另外测量，不能塞进同一个整数。

### 5.2 AOI 与 client apply

- `[PRODUCT_SLO]` AOI 容量至少由 changed actors、watchers per actor、viewport churn、visibility filter、serialize/compress CPU、socket bytes/buffer age 和 client apply 共同决定。
- `[DERIVED]` `zones` 和 `connections` 相同的两个 workload，可以分别是均匀小 AOI和万人同热点 AOI，fanout 相差数量级；当前 schema 无法区分。
- `[PRODUCT_SLO]` 万人 AOI 必须与热点 zone 写入、快速 viewport、慢网/后台客户端、buffer overflow 转 snapshot 同时注入，而不是拆成独立 run 后相加 p99。
- `[PRODUCT_SLO]` socket write 成功不等于 client apply 成功；必须用 ordered cursor、apply lag、frame stall 与最终 projection checksum 闭环。
- `[DERIVED]` 若 server 只保留成功 socket 样本，或客户端掉帧样本未入 trace，可获得虚假 PASS；当前合同没有 client sample completeness。

### 5.3 Scheduler 与 relay catch-up

- `[PRODUCT_SLO]` scheduler 测试必须包含整点、活动结束、行军到达的同秒洪峰，稳定 claim、priority、aging、lease steal、retry budget、DLQ 和同 owner 顺序。
- `[DERIVED]` `jobMix` 分数不包含 due-time 分布；相同 jobMix 可以是均匀到期，也可以是同秒百万级到期，边际 mix 无法证明 scheduler 容量。
- `[PRODUCT_SLO]` relay outage 恢复时必须同时保留新事件流量，证明 `mu_relay > lambda_new`、oldest age 收敛、DB/WAL/consumer 和前台 SLO 均通过。
- `[DERIVED]` 单独测前台 p99 和单独测 relay catch-up 会遗漏二者共享 DB pool、CPU、WAL、disk 和 network 的竞争，不能组合成 PASS。
- `[PRODUCT_SLO]` poison event、schema mismatch 或 consumer gap 不得靠跳过并推进 cursor 制造收敛；未解决 DLQ/gap 必须 FAIL。

### 5.4 Reconnect、snapshot 与恢复

- `[PRODUCT_SLO]` 同时重连规模必须覆盖 1/10/100/1000，且在 retention 内走 delta、窗口外走 snapshot，并在 snapshot build/cut/apply 各阶段注入 crash/fault。
- `[DERIVED]` 当前 workload 没有 reconnect cohort、cursor age、snapshot source size、build concurrency 或 client apply 字段；`reconnect_storm` 只是一个 fault enum，无法描述负载形状。
- `[PRODUCT_SLO]` snapshot cut 必须绑定 committed per-stream watermarks，应用后只接收更大 seq，最终 checksum 与无 gap/无重复事实一致。
- `[DERIVED]` snapshot 与 relay 分开测会隐藏 shared DB read、network、CPU、socket 和 client apply 峰值；独立 p99 不能相加或取最大值冒充联合结果。
- `[PRODUCT_SLO]` restore/recovery 还必须对账 receipt、job、Saga、cursor、ledger、owner epoch 和 release identity。当前 `finalState` 只覆盖前三项和一个总 invariant count，证据不封闭。

## 6. GATES_STILL_GAMEABLE

| 可操纵点 | 当前合同如何被利用 | 文字规范是否已禁止 | schema + 当前实现裁决 |
|---|---|---|---|
| 自选 gate | 只提交 `gateId:"g"` 一个 PASS gate | scope 不完整应 NOT_PROVEN | `[MEASURED]` schema ACCEPT；无 mandatory gate profile，仍可玩 |
| 自选 stage | 只提交 gateway，省略 auth/mailbox/DB/scheduler/relay/socket/client | 缺实际瓶颈应 NOT_PROVEN | `[MEASURED]` schema ACCEPT；无 stage completeness 映射 |
| 自报 inventory | inventory 写一个廉价 route/type，unknown/uncovered 声明 0 | unknown/zero-hit 应 NOT_PROVEN | `[DERIVED]` 缺运行 trace 与静态 inventory 的双向集合差，仍可玩 |
| 重复 ID | 重复 gate/stage/mix type 改变聚合或覆盖实现 map | mix type 应唯一 | `[MEASURED]` schema ACCEPT；其他 ID 规范也未闭合 |
| 廉价 mix | 每项合法但总和不为 1，或高成本 type 零命中 | mix 要精确和为 1、零命中 NOT_PROVEN | `[MEASURED]` schema ACCEPT；无 evaluator |
| 拆相关峰值 | command/job/consumer、AOI、reconnect、snapshot 分别采样 | 必须同一联合 trace | `[MEASURED]` schema 无 trace/phase/scenario binding |
| 缩短窗口 | phase/fault duration 设 0，或 window 倒置/移出 run | phase 时间关系必须复算 | `[MEASURED]` schema ACCEPT；无最小样本量/稳定时长 |
| 丢失败样本 | percentile 不报 count、timeouts、missing/dropped | 只保留成功样本应 NOT_PROVEN/FAIL | `[MEASURED]` schema 无样本守恒，artifact 格式未定义 |
| 自定阈值 | `source` 设 MEASURED 或 PRODUCT_SLO，无法分别绑定两端 | threshold 必须 PRODUCT_SLO，observed 必须 MEASURED | `[MEASURED]` 单 source 结构不可表达双来源 |
| 错单位 | serviceTime 用 bytes 等枚举内错误单位 | 固定字段单位映射 | `[MEASURED]` schema ACCEPT；无 evaluator |
| 假 condition | `observed` 不满足 operator 仍声明 PASS | evaluator 必须重算 | `[MEASURED]` schema ACCEPT；无 evaluator |
| 跨 run 证据 | URI/声明 run/artifact 内容来自别的 run | 禁止跨 run | `[MEASURED]` schema 接受多种跨 run 形状；typed parser 不存在 |
| 合法格式假 digest | 填充任意 64 hex | evaluator 必须重读 bytes | `[MEASURED]` schema ACCEPT；无制品复核 |
| 忽略共享资源 | 每个 stage 单独 p99 低即可 | resource center 必须独立举证 | `[MEASURED]` schema 无 resource center |
| aggressive drop | 丢事件、清 receipt/Saga、缩 retention 后报 drained | 规范明确为 FAIL | `[DERIVED]` finalState 无丢弃/删除守恒，仍不可测 |
| 无效 fault | `faults:[]` 或 duration 0，仍提交 fault gate PASS | fault 必须实际命中 | `[MEASURED]` schema ACCEPT；无 mandatory fault matrix |
| 只放大在线数 | datasetShapeDigest 不变或不透明 | 必须覆盖 retention 与 10x data age | `[MEASURED]` 无 typed dataset shape，仍可玩 |
| `M_max` 降本 | 超限请求改非法、提前丢弃或自动 Saga | 原子 admission 与 Saga 语义已明确 | `[DERIVED]` command 级 execution plan 和守恒不在合同内 |
| NA 处理 | 有效 NA 无法和 overall PASS 共存 | evaluator 允许有效 NA | `[MEASURED] SPEC_CONTRADICTION`，不是实现方可自行规避的问题 |

### 当前 inventory 红队结论

- `[MEASURED]` 当前后端静态扫描识别 34 个 route；现有 writer guard 运行结果为 `server write entries:17`、`entry calls:13`、`violations:0`。
- `[DERIVED]` `violations:0` 只证明已枚举规则未发现越界调用，不证明 inventory 完整。未知路径在没有独立发现集合时可以被漏掉。
- `[MEASURED]` 现有清单主要覆盖 server/game action/frontend submission，没有形成 route、command、job、consumer、admin/migration/repair、client state writer 的统一容量 inventory，也没有目标 runtime hit 证据。
- `[PRODUCT_SLO]` runtime 出现 inventory 外 type、inventory type 零命中、未知 writer 或未覆盖 writer 时必须 `NOT_PROVEN`；若已破坏不变量则 `FAIL`。
- `[DERIVED]` 必须比较“静态发现全集”“发布 manifest 声明集”“运行时命中集”三者的双向差集。仅由提交方填写 `unknownRuntimePathCount:0` 不构成证据。

## 7. REQUIRED_SCHEMA_AND_EVALUATOR_REVISIONS

以下修订全部完成并有 mutation evidence 前，v2.2 容量结论不得从 `NOT_PROVEN` 升级。

### 7.1 Schema 必改项

| 优先级 | 修订 | 最小可执行要求 | 来源 |
|---|---|---|---|
| P0 | 补齐最终守恒 | `finalState` 增加 accepted/committed/terminal/pending command、produced/applied/pending/dropped authoritative event、cursorGap、ledgerImbalance、ownerViolation、cleanup/delete、DLQ unresolved 计数及 evidenceRefs | `[PRODUCT_SLO]` correctness/drain；`[DERIVED]` 防 aggressive drop |
| P1 | 修复 mean 矛盾 | percentile 增加有限数 `mean`，或改为带 typed raw samples 的 distribution 并规定 evaluator 重算 mean；公式显式做 ms/1000、visits 和并行度换算 | `[MEASURED] SPEC_CONTRADICTION` |
| P1 | 修复 NA 矛盾 | overall PASS 分支允许审批有效的 `NOT_APPLICABLE`，或判定器禁止整体 PASS 含 NA，二选一并配置 mutation | `[MEASURED] SPEC_CONTRADICTION` |
| P1 | mandatory profile | 增加 `deploymentProfile`、`requiredGateIds`、`requiredStageClasses`、`requiredFaultScenarioIds`，绑定 release manifest；ID 唯一 | `[DERIVED]` 防自选范围 |
| P1 | typed scenario matrix | 增加 `scenarioId`、axis values、repeat/seed、phase binding、dataset shape、expected mandatory gates；覆盖 1/10/100/1000、热点、AOI、10x age | `[PRODUCT_SLO]` 联合负载与拐点 |
| P1 | joint trace binding | stage、gate、mix、fault、resource、final counters 都引用同一 `scenarioId/phaseId/traceDigest`，禁止跨窗口复用 | `[PRODUCT_SLO]` 同 trace |
| P1 | resource center | 增加 CPU/GC/DB pool/DB lock/WAL/disk/network/socket/client resource center、capacity、parallelism、stage visits 和 evidenceRefs | `[PRODUCT_SLO]` 共享瓶颈 |
| P1 | typed metric | 为 arrival/service/queue/age/utilization 分开定义 unit；增加 count、failed、timeout、missing、dropped、sampling interval 和 raw sample refs | `[MEASURED]` 单位/样本逃逸 |
| P1 | condition 双来源 | 拆为 `thresholdSource:PRODUCT_SLO`、`observedSource:MEASURED`，分别绑定 immutable SLO artifact 和 raw measurement refs | `[MEASURED]` 当前单 source 不可表达 |
| P1 | typed evidence | 每类 artifact 固定 schema/version、embedded run/scenario/phase、content digest、capture clock、producer identity；evidenceId 唯一 | `[DERIVED]` 使跨 run 与 digest 可机器核对 |
| P1 | workload shape | 增加 top-K owner/zone/alliance skew、AOI actors/watchers/density、due-time histogram、reconnect cohort、cursor age、retention 和 10x data-age shape | `[PRODUCT_SLO]` 热点/恢复矩阵 |
| P1 | `M_max` 与 Saga | 定义单位为去重 authoritative owner count；加入 per-command offered/admitted/rejected/plan cost、Saga eligibility 和 step/compensation 分布 | `[PRODUCT_SLO]` atomic rejection 与合法 Saga |
| P1 | evaluator 身份 | 增加 `schemaDigest`、evaluator artifact URI/sourceDigest/binaryDigest/signature、invocation profile、mutationSuiteDigest | `[DERIVED]` 让 version/digest 可验证而非自报 |

对象数组按业务键唯一不能只依赖 `uniqueItems:true`。可以改为以 ID 为 key 的 object map，或由 evaluator 做唯一性和引用完整性检查，但必须配置重复 ID mutation。`[DERIVED]`

JSON Schema 不适合表达 decimal 数组求和、分位顺序、时间关系、URI 解引用和守恒方程。这些不要求硬塞入 schema，但 schema 必须提供 evaluator 唯一复算所需的 typed 输入。`[DERIVED]`

### 7.2 Evaluator 必改项

1. `[PRODUCT_SLO]` 发布一个可取、可验签的 `slg-capacity-evaluator-v2.2` 制品，并冻结复算入口，例如 `evaluate --schema --contract --artifact-root --release-manifest`；标准输出只能是规范化 evaluation JSON，退出码沿用规范。
2. `[DERIVED]` 固定 draft 2020-12 validator 实现与版本，先做 meta-schema 校验，再做合同校验；validator 不支持关键字或产生 warning 时返回 `NOT_PROVEN`。
3. `[PRODUCT_SLO]` 先验证 schema digest、evaluator source/binary digest、release manifest 签名和全部 artifact bytes，再进行任何业务计算。
4. `[DERIVED]` 冻结 reason-code catalog、优先级、排序和参数格式。已规定的 FAIL > NOT_PROVEN > NA > PASS 不应改写，只需机器化。
5. `[PRODUCT_SLO]` 从静态发现集、release manifest 集、运行时 trace 集计算 inventory 双向差；unknown、uncovered、zero-hit 为 `NOT_PROVEN`，已知不变量破坏为 `FAIL`。
6. `[PRODUCT_SLO]` 精确重算 mix 总和/type 唯一、phase 顺序/窗口、分位顺序、单位、shape 关系、condition operator、fault 命中、evidence 引用和跨 run 关系。
7. `[PRODUCT_SLO]` 从同一联合 trace 重算 stage visits、retry/fanout amplification、end-to-end quantile、resource rho、queue 和 deadline；禁止独立 p99 相加。
8. `[PRODUCT_SLO]` 用 accepted-to-terminal、event-to-consumer、cursor、ledger、owner、cleanup 守恒复算 drain 与 finalState；不信任任何 `...Matched` 或 `...Drained` 布尔值。
9. `[PRODUCT_SLO]` 对 fault/burst/drain 同时求前台 SLO、backlog 收敛和最终 correctness。停止新流量、清表、缩 retention、丢权威事件或跳 poison item直接 FAIL。
10. `[PRODUCT_SLO]` 发布前运行 mutation suite，至少覆盖本报告所有 ACCEPT 逃逸、两个规范矛盾、artifact 不可读、digest mismatch、unknown/zero-hit writer、失败样本丢失和 evaluator 自身 digest mismatch。
11. `[DERIVED]` mutation fixtures、期望 result/reasonCodes、schema/evaluator digest 和执行日志必须进入签名 release manifest；任何缺失或结果漂移均 `NOT_PROVEN`。
12. `[PRODUCT_SLO]` 任一 required condition 使用 `MODEL_ASSUMPTION`、样本不完整、范围不完整或输入不可复算时，只能 `NOT_PROVEN`，不得由“未观察到失败”升级 PASS。

## 8. REQUIRED_LOAD_FAULT_CORRECTNESS_MATRIX

### 8.1 矩阵执行规则

- `[PRODUCT_SLO]` 每个矩阵单元固定 release、hardware、配置和未被考察的 workload 轴，保存独立 `scenarioId`，但所有同时发生的 command/job/consumer/AOI/recovery 活动必须在该单元的一条联合 trace 中。
- `[PRODUCT_SLO]` threshold 只来自版本化 `PRODUCT_SLO`，observed 只来自 `MEASURED` 原始样本；`MODEL_ASSUMPTION` 只能说明为何选择测试点，不能产生 PASS。
- `[DERIVED]` 单一 seed 不能证明尾部稳定性。每个拐点附近需要多个预先声明 seed/repeat，并报告全样本、失败样本和丢失样本。
- `[DERIVED]` 1/10/100/1000 四个离散点最多给出“最大 PASS 与最小 FAIL 之间”的拐点区间，不能唯一给出精确拐点。必须在区间内继续阶梯或二分，并检查结果单调性；若重复结果不稳定，只能 `NOT_PROVEN`。
- `[PRODUCT_SLO]` 任一 correctness/守恒/fencing/receipt/cursor/ledger/owner/checksum 失败直接 FAIL；输入、范围、证据或样本不全为 `NOT_PROVEN`。

### 8.2 必测矩阵

| 场景轴 | 负载点 | 同时注入/保持 | 必测证据 | FAIL / NOT_PROVEN 条件 |
|---|---|---|---|---|
| 均匀前台基线 | CAU 1/10/100/1000，再细化拐点 | 产品合法 commandMix、后台 job/consumer 常态流量 | 端到端 trace、各 resource center、admission、最终守恒 | `[PRODUCT_SLO]` SLO/正确性失败为 FAIL；缺联合后台流量为 NP |
| 同一 owner | 1/10/100/1000 同时命令，另加 10k burst | 相同 player/city/tile/cell 分系列 | owner arrival/service/Q/oldest、mailbox、DB lock、reject reason | `[PRODUCT_SLO]` 无界队列、deadline miss、静默 drop 为 FAIL；用均匀结果替代为 NP |
| 同一 alliance | 1/10/100/1000 + 活动峰值 | alliance command、成员 job、projection consumer 同峰 | owner plan、锁图、rows、WAL、fanout、client apply | `[DERIVED]` 拆 run 或只报平均 owner 为 NP |
| 同一 zone | 1/10/100/1000 热点 actor cohort | zone tick、AOI、march/battle、socket 同峰 | zone CPU、changed actors、watchers、bytes、DB/WAL、event-loop lag | `[PRODUCT_SLO]` 热点污染全 realm 或丢权威事件为 FAIL |
| 万人 AOI | 10k 同 zone watcher，分 changed ratio/viewport churn | 慢网、后台客户端、权限 epoch 变化 | actors*watchers、filter/serialize/compress、buffer、apply lag/checksum | `[PRODUCT_SLO]` buffer 无界、旧权限包应用、cursor/checksum 错为 FAIL |
| reconnect | 1/10/100/1000 同时重连 | retention 内 delta 与窗口外 snapshot 两支 | reconnect rate、snapshot CPU/bytes、stream gap、socket、client apply | `[PRODUCT_SLO]` 击穿前台 SLO、cut 丢/重事件为 FAIL |
| snapshot crash | build 前/中/commit cut 后/client apply 中 | 新事件和前台命令不停 | committed watermarks、resume seq、重复/gap、最终 checksum | `[PRODUCT_SLO]` checksum/gap 失败为 FAIL；未覆盖阶段为 NP |
| scheduler 同秒洪峰 | due jobs 1/10/100/1000 倍与活动结束峰值 | process pause、lease steal、同 owner 前台命令 | lag、priority/aging、claim token、attempt、DLQ、owner 顺序 | `[PRODUCT_SLO]` starvation、旧 lease complete、无限 poison retry 为 FAIL |
| `M_max` 边界 | M-1、M、M+1、远超 M | 原子 command 与产品批准 Saga 分开 | unique owner count、plan、admission receipt、零副作用、Saga steps/cost | `[PRODUCT_SLO]` 超限原子命令部分提交或自动 Saga 为 FAIL |
| relay outage/catch-up | outage 前 steady、outage burst、恢复追赶 | 新前台流量与 consumer 持续 | new/relay rate、Q items/bytes、oldest、DB pool/WAL/network、cursor | `[PRODUCT_SLO]` 不收敛、压垮前台、跳事件为 FAIL |
| poison/schema mismatch | 每个 required consumer 至少一例 | relay catch-up 与 retention 边界 | gap、retry、DLQ、min cursor、删除保护、replay checksum | `[PRODUCT_SLO]` cursor 越 gap 或清仍需事件为 FAIL |
| DB/资源故障 | failover、disk pressure、GC pause、network partition | burst、scheduler、relay、snapshot 同时活动 | pool、WAL/fsync、disk queue、GC/event loop、retry amplification | `[PRODUCT_SLO]` 不变量失败为 FAIL；缺任一实际瓶颈中心为 NP |
| 10x data age | 1x 与 10x receipt/event/snapshot/DLQ/backup age | CAU 与实时到达保持相同 | 各数据族 rows/bytes、index、query plan、restore time、disk headroom | `[DERIVED]` 只放大用户数或仅给 opaque digest 为 NP |
| 慢 client apply | 正常、慢网、后台、CPU 限速 cohort | AOI burst、snapshot、权限撤销 | socket buffer、visible seq、apply p99/max、frame stall、checksum | `[PRODUCT_SLO]` server send 成功但 client 未收敛不得 PASS |
| restore/reopen | PITR/stream restore 完整演练 | orphan writer、scheduler/relay 停启、replay | epoch fence、receipt/job/Saga/cursor/ledger 对账、RPO/RTO、release identity | `[PRODUCT_SLO]` 任一未决或旧 writer 可提交为 FAIL；无原始报告为 NP |

### 8.3 唯一拐点判定

对每个轴保存有序测试点 `x1 < x2 < ...`，evaluator 只允许输出：

```text
PROVEN_THROUGH = 最大的、所有 required gate 均 PASS 的实测点
FIRST_FAILED   = 最小的、任一 required gate FAIL 的实测点
KNEE_INTERVAL  = (PROVEN_THROUGH, FIRST_FAILED]
```

- `[DERIVED]` 如果中间存在 `NOT_PROVEN`、测试结果非单调、release/hardware/dataset 改变、样本跨 run 拼接或只测了一个点，就不能声称唯一拐点。
- `[DERIVED]` 精确容量只能在同一配置下继续缩小 `KNEE_INTERVAL`，并由产品预先定义误差宽度和重复稳定性阈值；不能由实现方在看到结果后自定阈值。
- `[PRODUCT_SLO]` 热点 owner、同 zone、同 alliance、万人 AOI、reconnect、scheduler、relay、snapshot、client apply 和 10x data age 必须分别有自己的拐点区间，不能用平均 CAU 的一个数字代替。

最终裁决不变：`CAPACITY_V2_2_VERDICT = NOT_PROVEN`。在 schema 修订、两处规范矛盾消除、可执行 evaluator 发布并通过上述 mutation 与负载/故障/正确性矩阵之前，不得签发 PASS。`[DERIVED]`
