# wxgame 参考架构 v2.3 容量合同第四轮独立对抗审查（GPT-SOL）

审查边界：仅使用 `成熟SLG后端参考架构-v2.3.html`、`容量合同-v2.3.schema.json`、`容量合同判定器规范-v2.3.md`、`当前实现迁移路线图-v2.3.md`，以及按 CodeGraph 只读核对的当前 writer/热路径事实。未读取任何 `architecture-v2.*-adversarial-*`、`历史材料/` 评审报告或其他席位输出。

证据标签：`MEASURED` 表示文档/Schema/机械执行的直接观测；`PRODUCT_SLO` 表示必须由产品权威目录给出的阈值；`MODEL_ASSUMPTION` 表示尚待实测验证的模型前提；`DERIVED` 表示由已列事实、逻辑或量纲推导出的结论。

## 1. CAPACITY_V2_3_VERDICT

**[DERIVED] 最终裁决：`REVISE_TO_V2_4`。** `REFERENCE_V2_3_STATUS = NOT_PROVEN` 必须保持；本轮没有发现应上调为 P0 的容量问题，但存在可直接影响发布准入的 P1 `UNTESTABLE` / `UNDER_SPECIFIED` 缺口。`CURRENT_IMPLEMENTATION = NON_CONFORMING` 不变。

| 项目 | 裁决 | 严重度 | 依据 |
|---|---|---:|---|
| manifest 字节防替换 | `CONFIRMED_SPEC_CLOSURE`（有条件） | - | **[MEASURED]** §1、§5.4 与 R1 要求外置信任根、签名和 digest；在签名密钥未泄露、验签实现正确、按 digest 取内容的前提下，普通提交者不能替换 manifest 后仍通过验签。 |
| manifest 内 capacity profile 的政策与格式 | `UNTESTABLE` | P1 | **[MEASURED]** release manifest 示例只登记 `profileId/profileDigest`，没有 profile/catalogue 的 typed schema、digest 前像或授权范围政策；不同判定器无法唯一读取六项 profile 内容。 |
| finalState 基本算术守恒 | `CONFIRMED_SPEC_CLOSURE`（局部） | - | **[MEASURED]** typed 字段与 §10.1 方程一致，缺字段被 Schema 拒绝；`dropped/cleanup/delete != 0` 在 overall PASS 分支被结构拒绝。 |
| finalState 真实性与拒绝分类 | `UNTESTABLE` | P1 | **[DERIVED]** digest 只证明提交字节未变；计数来源、distinct key、快照边界与生产者身份未定型，且 `terminal` 合并拒绝/失败，允许全拒绝仍算术自洽。 |
| `NA × PASS` | `UNTESTABLE` | P1 | **[MEASURED]** Schema 闭合“字段存在”，但 `approvedBy` 是自由字符串，审批 artifact 无专用类型、主体签名、作用域、过期时间和 typed 替代保证。 |
| `mean/sampleCount` 必填 | `CONFIRMED_SPEC_CLOSURE`（局部） | - | **[MEASURED]** 删除任一字段均被 AJV 拒绝。 |
| 最小样本与样本选择 | `UNTESTABLE` | P1 | **[MEASURED]** §6 引用“产品声明的最小样本阈值”，合同、manifest 和 SLO catalogue 均无 typed `minSampleCount` 绑定；`sampleCount=1` 结构合法。 |
| required resource center 集合差 | `CONFIRMED_SPEC_CLOSURE`（局部） | - | **[MEASURED]** 枚举、`uniqueItems` 与 §9.2 差集谓词足以唯一计算 `required - present`。 |
| scenario/trace 联合绑定 | `UNTESTABLE` | P1 | **[MEASURED]** stage 有 `scenarioId/traceDigest`，但 gate 没有 `stageRefs/scenarioId/traceDigest`，artifact envelope 也没有 scenario、phase 和 window 字段；`CROSS_SCENARIO_STITCHING` 的输入不完整。 |
| condition 原始证据绑定 | `UNTESTABLE` | P1 | **[MEASURED]** §7 要求每个 condition 保存 sample/evidenceRef，而 `$defs.condition.additionalProperties=false` 且没有任何 evidence 字段；加入 `evidenceRef` 会被 AJV 拒绝。 |
| stage/shared-resource 负载模型 | `UNDER_SPECIFIED` | P1 | **[MEASURED][DERIVED]** §9 的 `requests/s × ms` 未除以 1000，也未纳入 class visits、pool parallelism 与共享中心汇聚；无法唯一复算无量纲 `rho`。 |
| 当前代码尚无 v2.3 evaluator/完整 M7 准入 | `IMPLEMENTATION_ONLY_GAP` | P1（实施） | **[MEASURED]** 路线图明确把确定性 evaluator 与 mutation suite 放在 M7；该事实不作为规范矛盾。 |

**[DERIVED] 阻断 PASS 的最小集合：** 必须先闭合 profile/门禁政策签名、证据生产者证明、SLO catalogue、condition 证据引用、NA 结构化审批、联合 trace envelope、守恒来源 schema 与量纲正确的共享资源模型。否则一个“签名但缩小范围的 profile + 自造 trace + trivial condition + 伪 NA + 全拒绝守恒”合同仍存在被某个表面合规判定器判 PASS 的路径。

**[DERIVED] 严重度纪律：** 本报告没有 P0。上述问题阻断容量/发布证明或造成可用性错误，按共同纪律为 P1；没有用单机、低概率、重试或 timeout 降级正确性门禁。

## 2. V2_3_PATCH_CLOSURE_REVIEW

### A. deploymentProfile manifest 锚定

**[MEASURED] 裁决：局部 `CONFIRMED_SPEC_CLOSURE`，整体 `UNTESTABLE`（P1）。**

- 已闭合：`release.manifestDigest`、manifest 验签、外置 trust root、逐项比对和 fail-closed 文义，能挡住无签名密钥的字节伪造/替换。
- 未闭合：manifest 工件的权威解析入口、signed payload schema、profile catalogue schema/digest、profile digest 前像、签名主体所代表的政策权限，以及 profile 六项清单的强制内容。
- **[FACT_ERROR]** “攻击者可在 SHA-256 不变且签名密钥未泄露时替换 manifest 字节”不是有效攻击。
- **[FACT_ERROR]** `profileDigest` 必然形成数学环引用也未被证明；若 digest 前像明确排除 digest/signature 字段即可无环。现状问题是前像未定义，属于 `UNTESTABLE`，不是 `SPEC_CONTRADICTION`。

反例 A1（合法 signer 缩小范围）：

- 被攻击条款：判定器规范 §1.4、§5.4；Schema `$defs.release`、`$defs.deploymentProfile`；架构 R1。
- 前置条件：release controller 拥有被 R1 信任的 release signing key；没有独立 capacity-policy signer 或已签 gate catalogue。
- 精确时间线/事务边界：`t0` controller 生成只含 `capacityDeploymentProfile:{profileId,profileDigest}` 的 manifest；`t1` 将 profile 内容定义为一个自命名 gate、一个 stage、一个 resource center；`t2` 对 manifest 签名并发布；`t3` 合同逐项抄入同一缩小清单；`t4` evaluator 验签和逐项相等均成功。
- 数据库隔离与锁假设：不依赖数据库并发；攻击发生在签名发布事务与随后只读判定之间。即使 manifest 行不可变、SERIALIZABLE、行锁正确，签名内容本身仍可缩小范围。
- 违反的不变量：mandatory profile 必须由独立于被测实现方的容量政策决定，不能由同一 release 提交者自选。
- 现有文字挡不住的原因：真实性签名证明“谁签了这些字节”，不证明“这些清单满足哪个强制政策”；manifest 示例只给 profile ID/digest，判定器却要读取六项内容。
- 最小修订：定义 versioned `release-manifest`、`capacity-profile`、`capacity-gate-catalogue` Schema；manifest 必须绑定 catalogue/profile digest；profile 由独立 capacity authority 或双角色 quorum 签名；明确 profile digest 为 RFC 8785 规范化、排除 `profileDigest/signature` 后的对象 digest。
- 可执行验收证据：用受信 release key 签一个比 catalogue 少 gate/stage/fault/center 的 profile，期望 `NOT_PROVEN/POLICY_PROFILE_MISMATCH`；用未授权 signer、换字节、换 catalogue、digest 前像含自身字段等 fixture 均必须 fail-closed。

### B. finalState 守恒块

**[MEASURED] 裁决：typed 算术为 `CONFIRMED_SPEC_CLOSURE`；真实性、计数域和拒绝语义为 `UNTESTABLE`（P1）。**

反例 B1（自洽假数 + 自造 artifact）：

- 被攻击条款：判定器规范 §4、§10.1；Schema `$defs.evidenceArtifact` 与三个 conservation 对象。
- 前置条件：提交者可写 artifact URI 指向的内容；artifact 使用一个 evaluator“认识”的 schema 名称，但没有可信 producer attestation 或权威数据源游标。
- 精确时间线/事务边界：`t0` 压测真实产生 1000 个 accepted command、100 个 pending；`t1` 提交者另造 artifact，写 `accepted=900,terminal=900,pending=0,committed=900`；`t2` 计算该假 artifact digest 并同时填入合同；`t3` evaluator 重取相同字节，digest 与复算值完全一致；`t4` 守恒方程通过。
- 数据库隔离与锁假设：真实业务库可使用任意正确隔离/锁；判定器没有被要求从该权威库的同一 snapshot/cursor 读取，因此这些锁不会把 artifact 绑定到真实运行。
- 违反的不变量：每个 run 的完整命令集合必须由不可删改、可枚举的权威入口集合守恒到全部终态。
- 现有文字挡不住的原因：digest 是完整性校验，不是来源真实性；`artifactSchema` 只是非空字符串，合同没有 schema digest、producer identity/signature、query、snapshot LSN、首尾 cursor 或原始 ID 集合承诺。
- 最小修订：conservation artifact 使用固定 Schema，至少包含 source system、release/run/scenario/phase/window、snapshot LSN/stream cursor、distinct-key 算法、首尾水位、producer build digest、机器身份签名和 transparency/WORM receipt。
- 可执行验收证据：真实库有 100 pending、提交 artifact 声称 0；判定器必须通过独立权威查询或签名水位发现差异并输出 `NOT_PROVEN/EVIDENCE_PROVENANCE_INVALID`，不能仅靠同一提交者提供的 digest 通过。

反例 B2（拒绝洗入 terminal）：

- 被攻击条款：§10.1 的 `accepted=terminal+pending`、`committed<=terminal`，以及“拒绝与终态失败全部计入 terminal”。
- 前置条件：profile 没有绑定最低 accept/success ratio gate；required gate 可以只放 trivial condition。
- 精确时间线/事务边界：`t0` 100 个请求到达；`t1` admission 全部 `rejected_busy`，没有领域事务 commit；`t2` stage 如实写 `admissionOutcomes.accepted=0,rejected_busy=100`；`t3` finalState 写 `accepted=100,terminal=100,pending=0,committed=0`；`t4` 方程与 `committed<=terminal` 均成立；`t5` trivial gate 成立。
- 数据库隔离与锁假设：100 个请求均未进入领域事务；不存在可由行锁/CAS 阻止的竞争。
- 违反的不变量：容量 PASS 不得把 100% 拒绝的运行解释为成功处理并排空。
- 现有文字挡不住的原因：`accepted` 与 stage `admissionOutcomes.accepted` 没有跨字段等式；`terminal` 不区分 committed、rejected、failed、expired、cancelled；profile 也不绑定拒绝率 SLO。
- 最小修订：改为 `received=admitted+rejected_pre_admission`、`admitted=committed+failed_terminal+cancelled+pending`，各类按 distinct commandId 对账；`terminal` 不得包含 pre-admission reject；gate catalogue 强制绑定 accept/success/reject SLO。
- 可执行验收证据：100% busy、99% busy、付费命令 reject、deadline reject 四组 fixture，分别验证守恒仍平但 SLO 必须 FAIL，且 `received/admitted/rejected/committed` 可由同一 ID ledger 重算。

### C. `NA × PASS` 新分支

**[MEASURED] 裁决：字段存在性 `CONFIRMED_SPEC_CLOSURE`；审批真实性与 required-gate waiver 为 `UNTESTABLE`（P1）。**

反例 C1（伪双人审批 + 一个 trivial PASS）：

- 被攻击条款：Schema overall PASS 分支、`$defs.gate`；判定器 §11。
- 前置条件：manifest 中责任人姓名/ID 对提交者可见；审批证据没有专用签名格式；profile 允许 required gate 以 NA 出现。
- 精确时间线/事务边界：`t0` 保留一个 trivial applicable gate 为 PASS；`t1` 把全部实质 required gates 标为 `NOT_APPLICABLE`；`t2` 填 `approvedBy="release-owner,architecture-owner"`；`t3` 自造 log，写一句“有替代保证”，计算 digest；`t4` 将该 digest 放进 evidence chain；`t5` evaluator 做字符串主体匹配和 digest 重取，均可通过。
- 数据库隔离与锁假设：不依赖数据库；审批是离线制品，没有事务/CAS 能证明两位主体实际授权。
- 违反的不变量：required gate 的豁免必须由两个独立、可认证主体对特定 release/run/gate 和替代控制做不可抵赖授权。
- 现有文字挡不住的原因：`approvedBy` 是一个自由字符串；artifact type 枚举没有 `approval`；没有主体公钥签名、签名覆盖字段、expiry、nonce、职责分离或替代保证 schema。
- 最小修订：`approvals[]` 结构化为两个 distinct subject，分别携带 role/keyId/signature/signedAt；签名覆盖 manifestDigest、profileDigest、runId、gateId、reason、alternativeControl、expiry；required gate 默认不可 NA，只有 profile catalogue 明示 `waivable=true` 才可豁免。
- 可执行验收证据：字符串伪双人、同一 key 两个名字、过期审批、跨 run 重放、换 gateId、替代保证缺字段、required 非 waivable gate 等 fixture 均 `NA_APPROVAL_INVALID`；全部 gate 为 NA 仍为 `NOT_PROVEN`。

### D. percentiles 必填 `mean/sampleCount`

**[MEASURED] 裁决：必填闭合；最小样本、分位数定义和样本完整性仍 `UNTESTABLE`（P1）。**

- `mean` 或 `sampleCount` 缺失：AJV 拒绝，补丁闭合。
- `mean > p99`：**[DERIVED][FACT_ERROR]** 不能据此判合同矛盾。例：99 个 0 与 1 个 1000 的样本可有 `p99=0,mean=10,max=1000`（具体 p99 仍取决于 quantile convention）。正确的必然关系是 `0 <= mean <= max`。
- `mean > max`：**[MEASURED]** Schema 接受；§6 要求 evaluator 置 `NOT_PROVEN`。跨字段留给 evaluator 本身允许，但必须有 mutation fixture。

反例 D1（`sampleCount=1` 获得足样本）：

- 被攻击条款：判定器 §6、§9；Schema `$defs.percentiles`。
- 前置条件：没有被签名 SLO catalogue 绑定的 `minSampleCount/minDuration/minEvents`。
- 精确时间线/事务边界：`t0` 只采一个成功请求；`t1` 所有 percentiles 填该值且 `sampleCount=1`；`t2` 省略可选 `failedCount/droppedCount`；`t3` Schema 通过；`t4` evaluator 无 typed 产品阈值可比较。
- 数据库隔离与锁假设：不依赖数据库事务；这是统计样本域缺失。
- 违反的不变量：容量分位数必须达到产品预先声明的统计功效和持续时间，并覆盖失败/超时样本。
- 现有文字挡不住的原因：“产品声明的最小样本阈值”没有字段、ID、digest 或取值目录；quantile 算法、成功/失败纳入规则也未绑定。
- 最小修订：gate spec 引用 `sloRef`；SLO catalogue 固定 `minSampleCount/minWindowSeconds/maxDropFraction/quantileMethod/includeFailures`；percentiles 增加 `attemptedCount/observedCount/failedCount/droppedCount` 并有守恒式。
- 可执行验收证据：1、阈值减 1、阈值、仅成功采样、尾部定向丢样、不同 quantile 算法六组 fixture，结果唯一。

### E. resource-center 集合差与联合 trace

**[MEASURED] 裁决：resource type 差集为 `CONFIRMED_SPEC_CLOSURE`；联合 gate/trace 绑定为 `UNTESTABLE`（P1）。**

反例 E1（跨 scenario 拼接）：

- 被攻击条款：判定器 §9.1/§9.2；Schema `$defs.stage`、`$defs.gate`、`$defs.evidenceArtifact`。
- 前置条件：两个 scenario 各自有合法 trace；gate 只引用 artifact IDs，没有 `stageRefs`。
- 精确时间线/事务边界：`t0` scenario S1 测得高 arrival 但取不到资源利用率；`t1` scenario S2 的低负载窗口测得低 utilization；`t2` stage 分别登记不同 scenario/trace；`t3` gate 同时引用两份 artifact 并声明联合 PASS；`t4` evaluator 试图从 gate 推导其 scenario/window，但合同没有该映射。
- 数据库隔离与锁假设：两个 run phase 均可在正确 snapshot isolation 下采集；跨场景拼接发生在报告组装层，不受数据库锁影响。
- 违反的不变量：一个联合负载 gate 的每个 observed 值必须来自同一 `(runId,scenarioId,phase,traceDigest,window)`。
- 现有文字挡不住的原因：artifact envelope 只有 `capturedAt`，没有 scenario/phase/window/traceDigest；gate 没有 stage/scenario 绑定；resourceCenter 也没有 phase/scenario，无法防止拿 calm phase 资源指标证明 fault/burst。
- 最小修订：gate 必填 `stageRefs` 与 `scenarioId/phase/traceDigest/windowId`；artifact envelope typed 化同一组字段；resourceCenter observation 按 scenario/phase/window 分片；condition 直接引用 sample/series artifact 与 selector。
- 可执行验收证据：同 trace 正例；scenario 不同、trace 不同、窗口不重叠、resource center 来自 steady 而 gate 来自 fault、同 artifact 跨 center 复用五类反例，均输出确定的冲突三元组/五元组。

## 3. SCHEMA_MECHANICAL_ATTACK_RESULTS

### 3.1 方法与运行条件

**[MEASURED]** 使用 AJV `8.20.0`、Draft 2020-12，在内存中加载原始 Schema；未修改 Schema，未安装依赖，未写测试 fixture。先以严格模式编译，再只关闭 `strictTypes` 继续 38 个最小变异。`B0` 是结构有效的 overall PASS 基线；表中 `B0 ⊕ {JSON Pointer := value}` 或 `remove(pointer)` 就是最小 JSON 样例，未列字段保持 B0 不变。

**[MEASURED] 严格编译结果：失败。** 首个错误路径为 `#/allOf/0/then/properties/gates/items/allOf/1`：该 subschema 使用 `properties` 但没有显式 `type:"object"`。这是 AJV strict-mode 可移植性问题，不等于 Draft 2020-12 Schema 在标准语义上无效；裁决为 P2 `UNDER_SPECIFIED`。关闭 `strictTypes` 后成功编译，其余严格检查保留。

表中 `AJV` 为 **[MEASURED]**；“规范应判”是 **[DERIVED]**，用于严格区分“结构合法”与“可整体 PASS”。

| ID | B0 的最小变异样例 | AJV | 规范应判 / 攻击结果 |
|---|---|---|---|
| R01 | `/gates/0/result := "FAIL"`，`/overallResult` 仍 `PASS` | REJECT | `NOT_PROVEN`（结构失败）；上一轮强制样例闭合。 |
| R02 | `/finalState/unresolvedReceiptCount := 1` | REJECT | `NOT_PROVEN`（结构失败）；上一轮强制样例闭合。 |
| R03 | `/workload/commandMix := [{type:"cmd",fraction:0.9}]` | ACCEPT | evaluator 必须 `NOT_PROVEN`；Schema 不求和。 |
| R04 | `/phases/5/name := "drain"`（重复 drain、缺 cooldown） | REJECT | `NOT_PROVEN`；上一轮强制样例闭合。 |
| R05 | `/phases/0/evidenceWindowStart > evidenceWindowEnd` | ACCEPT | evaluator 必须 `NOT_PROVEN`。 |
| R06 | `/stages/0/serviceTime/p95 := 20`，`p99 := 10` | ACCEPT | evaluator 必须 `NOT_PROVEN`。 |
| R07 | `/stages/0/serviceTime/unit := "requests_per_second"` | ACCEPT | evaluator 必须 `NOT_PROVEN`；通用 unit enum 未按字段收窄。 |
| R08 | `/stages/0/utilization/{p50,p95,p99,max,mean} := 1.01` | ACCEPT | evaluator 必须 `NOT_PROVEN`；Schema 未限制 ratio 上界。 |
| R09 | PASS gate condition `{operator:"lte",threshold:100,observed:101}` | ACCEPT | evaluator 必须 `FAIL`。 |
| R10 | `/gates/0/evidenceRefs/0 := <不存在但格式合法的 UUID>` | ACCEPT | evaluator 必须 `NOT_PROVEN`。 |
| R11 | `/inventory/unknownRuntimePathCount := 1` | REJECT | `NOT_PROVEN`（结构失败）；PASS 分支闭合。 |
| R12 | `/workload/faults := []`，保留 fault stage/claim | ACCEPT | evaluator 必须 `NOT_PROVEN`。 |
| R13 | `/evaluator/algorithmDigest := "sha256:" + "f"×64` | ACCEPT | 只校验格式；可信 evaluator 选择未绑定时可游戏化。 |
| A01 | profile 三清单改为 `missing-gate/auth/missing-fault`，实际 gate/stage/fault 不变 | ACCEPT | evaluator 应 `MANDATORY_PROFILE_INCOMPLETE`；结构无法做集合差。 |
| A02 | `/release/manifestDigest` 与 `/deploymentProfile/releaseManifestDigest` 同时自填同一假 digest | ACCEPT | evaluator 应验签失败后 `NOT_PROVEN`；合同内自相等无证明力。 |
| A03 | 上述两个 manifest digest 填为不同合法 digest | ACCEPT | evaluator 应 `NOT_PROVEN`；Schema 无跨字段相等。 |
| A04 | `/deploymentProfile/profileDigest := 任意合法 digest` | ACCEPT | evaluator 应与权威 profile 比对；digest 前像/目录仍未定型。 |
| A05 | profile 只要求 `g0`，`g0` 仅含 `0 eq 0` condition | ACCEPT | 在无 gate catalogue 绑定时可被判 PASS；直接假 PASS 面。 |
| B01 | command `{accepted:10,terminal:9,pending:0,committed:9}` | ACCEPT | evaluator 必须 `FAIL/CONSERVATION_VIOLATION`。 |
| B02 | command `{accepted:10,terminal:10,pending:0,committed:11}` | ACCEPT | evaluator 必须 `FAIL/CONSERVATION_VIOLATION`。 |
| B03 | command `{accepted:100,terminal:100,pending:0,committed:0}` + 同值假 artifact | ACCEPT | 算术通过；证据无可信 provenance 时存在假 PASS。 |
| B04 | `/finalState/eventConservation/dropped := 1` | REJECT | overall PASS 合同结构失败；若声明 FAIL 才能进入 evaluator 得到 FAIL。 |
| B05 | `/finalState/cleanupConservation/cleanupCount := 1` | REJECT | 同上；PASS 分支闭合非零清理。 |
| B06 | event `{produced:10,applied:9,pending:0,dropped:0}` | ACCEPT | evaluator 必须 `FAIL/CONSERVATION_VIOLATION`。 |
| B07 | stage `accepted=0,rejected_busy=100`；command `accepted=terminal=100,committed=0` | ACCEPT | evaluator缺跨域等式时可“拒绝洗白”。 |
| C01 | NA gate 删除 `approvedBy` | REJECT | `NOT_PROVEN`；字段完整性闭合。 |
| C02 | NA gate 填自由字符串双人名 + 自造 approval digest | ACCEPT | evaluator若只比字符串/digest，可错误接受。 |
| C03 | 所有 gate 均为有三字段的 NA，overall PASS | ACCEPT | §11 必须重算 `NOT_PROVEN`；Schema 与 evaluator 分工。 |
| D01 | `remove(/stages/0/serviceTime/mean)` | REJECT | `NOT_PROVEN`；v2.3 新必填闭合。 |
| D02 | `remove(/stages/0/serviceTime/sampleCount)` | REJECT | `NOT_PROVEN`；v2.3 新必填闭合。 |
| D03 | service time `{p99:10,mean:11,max:100}` | ACCEPT | 合法可能，不应仅因 `mean>p99` 拒绝。 |
| D04 | service time `{mean:101,max:100}` | ACCEPT | evaluator 必须 `NOT_PROVEN`；Schema 不做该交叉关系。 |
| D05 | 所有 percentile `/sampleCount := 1` | ACCEPT | 最小产品样本阈值无 typed 来源，结果不唯一。 |
| D06 | `/gates/0/requiredConditions/0/evidenceRef := <UUID>` | REJECT | 与 §7 的 condition 级 evidenceRef 要求冲突，形成 `UNTESTABLE`。 |
| E01 | required centers `cpu,db_pool`，`resourceCenters` 仅 `cpu` | ACCEPT | evaluator 可唯一算差集并 `RESOURCE_CENTER_UNCOVERED`；补丁闭合在 evaluator 层。 |
| E02 | `/stages/0/traceDigest != 其 evidenceRef artifact.digest` | ACCEPT | evaluator 应 `JOINT_TRACE_BINDING_BROKEN`。 |
| E03 | 一个 gate 的 evidenceRefs 拼接两个 scenario/trace artifact | ACCEPT | evaluator目标为 `CROSS_SCENARIO_STITCHING`，但 gate/artifact envelope 输入不足。 |
| E04 | 两个 gate 使用同一 `gateId` | ACCEPT | evaluator可按 §5.4 唯一判 `DUPLICATE_GATE_ID`。 |

**[MEASURED] 汇总：** 38 个坏合同中 AJV 拒绝 10 个、接受 28 个。这个比例本身不是缺陷，因为 §1 明确把跨字段逻辑交给 evaluator；真正阻断项是被接受的结构中仍有若干没有足够 typed/可信输入，使 evaluator 不能唯一执行。

**[DERIVED] 上一轮 8 个强制样例复测：** R01-R08 全部已执行；R01/R02/R04 在 Schema 层闭合，R03/R05-R08 必须由 evaluator mutation suite 闭合，不能据“Schema ACCEPT”直接判假 PASS。

## 4. EVALUATOR_GAPS

| Finding | 裁决 | 严重度 | 缺失的唯一判定输入 | 可游戏化结果 |
|---|---|---:|---|---|
| SOL-23-01 Evidence provenance | `UNTESTABLE` | P1 | **[MEASURED]** producer identity/key、target process/release attestation、WORM receipt、query/LSN/cursor、artifact schema digest 均缺失。 | **[DERIVED]** 提交者可同时造 bytes 和 digest，复算得到自洽假值。 |
| SOL-23-02 Gate/SLO catalogue | `UNTESTABLE` | P1 | **[MEASURED]** `metric`/`unit` 是自由字符串，`PRODUCT_SLO` 只是 const 标签；profile 只钉 gate ID，不钉 condition 集、operator、threshold、sample policy。 | **[DERIVED]** required gate ID 保留但条件改成 `0 eq 0`。 |
| SOL-23-03 Condition evidence | `UNTESTABLE` | P1 | **[MEASURED]** §7 要 condition 级 sample/evidenceRef，Schema 明确拒绝该字段。 | **[DERIVED]** evaluator只能猜 gate-level artifact 中哪个 selector产生 observed。 |
| SOL-23-04 Evaluator bootstrap | `UNDER_SPECIFIED` | P1 | **[MEASURED]** 只要求运行制品 digest 等于合同自填 `algorithmDigest`，未绑定 release manifest/CI policy 允许的 evaluator digest。 | **[DERIVED]** 若调用方可选择 evaluator，可提交恶意 evaluator 与匹配 digest。 |
| SOL-23-05 Manifest/profile resolver | `UNTESTABLE` | P1 | **[MEASURED]** 无 manifest Schema、可信 CAS/registry 接口、profile catalogue Schema/digest 前像。 | **[DERIVED]** 两个实现对同一 signed manifest 可得不同 profile 列表。 |
| SOL-23-06 Sample policy | `UNTESTABLE` | P1 | **[MEASURED]** min sample/window、quantile method、失败样本纳入、max drop fraction 无 typed SLO 引用。 | **[DERIVED]** 单成功样本或删尾样本可伪造低 p99。 |
| SOL-23-07 Joint binding | `UNTESTABLE` | P1 | **[MEASURED]** gate→stage 与 artifact→scenario/phase/window 映射缺失；`capturedAt` 不是 evidence window。 | **[DERIVED]** burst arrival 可拼 steady utilization。 |
| SOL-23-08 Conservation domains | `UNTESTABLE` | P1 | **[MEASURED]** command 分类、event destination/consumer、distinct key 与 source cursor 无 schema。 | **[DERIVED]** 全拒绝、漏 consumer、重复计数仍可自洽。 |
| SOL-23-09 Queue dual budget | `UNTESTABLE` | P1 | **[MEASURED]** stage 只有一个带单一 unit 的 `queueDepth`，却同时必填 `maxQueueItems` 与 `maxQueueBytes`。 | **[DERIVED]** items/bytes 中至少一维没有同构分布可验。 |
| SOL-23-10 Strict AJV portability | `UNDER_SPECIFIED` | P2 | **[MEASURED]** overall PASS gate subschema 缺 `type:object`，AJV strictTypes 编译失败。 | 工具链可能在启动前失败，不应转业务 PASS/FAIL。 |

**[DERIVED] 判定器不能用“实现约定”补洞。** `artifactSchema` 的识别表、SLO catalogue、manifest resolver、授权 evaluator digest 若只存在某个二进制内部而未被版本化、签名和纳入判定输入，则另一实现无法复现同一结果，仍是 `UNTESTABLE`。

## 5. COUPLED_STAGE_AND_SHARED_RESOURCE_MODEL

### 5.1 当前公式的量纲问题

**[MEASURED]** §9.1 写 `rho = arrivalRate.mean * serviceTime.mean`；单位表固定 arrival 为 `requests_per_second/events_per_second`、service 为 `ms`、utilization 为 `ratio`。

**[DERIVED]** 直接乘积单位是 `request·ms/s`，数值比无量纲 offered load 大 1000 倍。单 class、单 server、每请求访问一次的最小正确式为：

```text
rho = lambda_requests_per_second * E[S_ms] / 1000
```

**[DERIVED]** 对 class `c`、resource center `r`、并行服务数 `m_r`，至少需要：

```text
A_r   = sum_c(lambda_c * visits_c_r * service_ms_c_r / 1000)
rho_r = A_r / m_r
```

- `lambda_c`：**[MEASURED]** 同一 scenario/window 的 class arrival rate。
- `visits_c_r`：**[MEASURED]** 每 command 对 center 的平均访问次数，包含 retry/fanout。
- `service_ms_c_r`：**[MEASURED]** 每 visit 的占用时间，不是包含排队的端到端 latency。
- `m_r`：**[MEASURED]** 真正可并行 server 数；owner key/单 DB 锁热点通常 `m=1`，不能拿全机 worker 数稀释。
- Poisson、独立 service time、stationary window：**[MODEL_ASSUMPTION]** 只有经 arrival/service SCV 与自相关检验后才能用于近似排队公式，不能作为 required PASS condition 的来源。

### 5.2 必须显式建模的耦合

| Center / stage | 必要观测 | 不能使用的替代量 | 判定 |
|---|---|---|---|
| owner mailbox/lock | **[MEASURED]** per-owner `lambda_k`、hold/service、queue items/bytes、oldest age、reject | 全 realm 平均 lambda 或增加机器后的总并行度 | **[DERIVED]** `max_k rho_k` 决定热点串行极限。 |
| DB pool | **[MEASURED]** class visits、connection hold time、pool size、wait p99、transaction retry | SQL latency 或 CPU 单一平均 | **[DERIVED]** pool occupancy 汇聚全部 class。 |
| WAL/disk | **[MEASURED]** bytes/commit、fsync service、bandwidth/IOPS、checkpoint interference | request service ms | **[DERIVED]** 应按 bytes/s 与 fsync queue 建模。 |
| event stream/outbox | **[MEASURED]** produced rate、destination fanout、retry amplification、consumer service、cursor lag | 只看 producer QPS | **[DERIVED]** event conservation 必须按 `(eventId,destination/consumerGroup)`。 |
| socket/client apply | **[MEASURED]** bytes/event、watcher fanout、slow-client ratio、buffer bytes/age | server event count | **[DERIVED]** 网络与客户端是独立 center，不能由 server CPU PASS 代替。 |
| snapshot/reconnect | **[MEASURED]** reconnect cohort、snapshot CPU/bytes、DB reads、后续 replay rate | 把各 stage p99 相加 | **[DERIVED]** 端到端 deadline 只能由同一 trace 的 request/span 计算。 |

**[DERIVED]** burst drain 必须同时满足 `mu_effective > lambda_new`，且在固定边界下 `T_drain >= B0/(mu_effective-lambda_new)`；`mu_effective` 必须是在共享中心和前台 SLO 同时受约束时的净服务率，不能取停止前台流量后的峰值。

### 5.3 Schema 最小增量

**[DERIVED]** 建议新增 `trafficClasses[]`、`stageVisits[]`、`resourceObservations[]`：每条绑定 `classId/stageId/resourceCenterId/scenarioId/phase/windowId/traceDigest`，携带 `arrivalRate`、`visitsPerCommand`、`serviceDemandMs`、`parallelServers`、`queueItems`、`queueBytes`、`retryAmplification`。`queueItems` 与 `queueBytes` 必须是两个独立 percentile block，各自对应上限。

**[PRODUCT_SLO]** `rho_target`、queue item/byte 上限、oldest age、deadline、reject ratio、drain deadline 必须来自已签 SLO/gate catalogue，而不是合同提交者自由填 threshold。

## 6. GATES_STILL_GAMEABLE

以下均复用第 2 节已经给出的前置条件、时间线、事务/锁假设和不变量，不另造实现错误。

| 攻击链 | 结构状态 | 现有 evaluator 风险 | 最小阻断点 |
|---|---|---|---|
| G1 签名 trivial profile → required gate 仅 `0 eq 0` | **[MEASURED]** AJV ACCEPT | **[DERIVED]** 签名证明 release controller 选择了小范围，不证明独立政策要求 | 独立签名 capacity profile + gate catalogue digest |
| G2 自造 trace/metrics/conservation bytes → 自填 digest | **[MEASURED]** AJV ACCEPT | **[DERIVED]** §4 重取同一假字节仍一致 | producer attestation + authoritative cursor/query + WORM receipt |
| G3 一个 trivial PASS + 实质 required gates 全 NA | **[MEASURED]** AJV ACCEPT | **[DERIVED]** 自由字符串双人名与 log digest 可伪 | typed 双签 waiver，required gate 默认不可豁免 |
| G4 100% busy reject → terminal=received → committed=0 | **[MEASURED]** AJV ACCEPT | **[DERIVED]** 算术平衡但没有业务处理能力 | typed received/admitted/rejected/committed 守恒 + 强制 reject SLO |
| G5 burst arrival + steady/calm resource utilization 拼接 | **[MEASURED]** AJV ACCEPT | **[DERIVED]** gate/artifact 缺 scenario/window join key | gate `stageRefs` + typed artifact envelope |
| G6 单个成功样本，失败/超时不报 | **[MEASURED]** AJV ACCEPT | **[DERIVED]** 没有最小样本与 attempted-observed 守恒 | signed sample policy + attempted/failed/dropped counters |
| G7 只报 queue items，bytes 上限沿用无证据数字 | **[MEASURED]** AJV ACCEPT | **[DERIVED]** 单 `queueDepth.unit` 无法同时证明双预算 | 拆分 `queueItems/queueBytes` typed metrics |
| G8 恶意 evaluator binary + 合同填同一 algorithmDigest | **[MEASURED]** 格式合法 | **[DERIVED]** 若调用方可选择二进制，self-match 不构成 trust anchor | manifest/CI policy 固定 evaluator digest 和 signer |

**[DERIVED]** G1+G2+G3+G4 可以串成完整假 PASS：签一个缩小 profile，保留一个 trivial PASS，把真实门禁改 NA，自造全部证据，再用 `terminal` 吞掉拒绝。现有每个局部相等关系都能成立，但系统没有证明目标负载下处理过任何有效业务。

## 7. REQUIRED_SCHEMA_AND_EVALUATOR_REVISIONS

以下 P1 修订全部完成前不得把 v2.3 改为 PROVEN。

1. **Manifest/profile 信任链。** **[DERIVED]** 发布 `release-manifest-vN.schema.json`、`capacity-profile-vN.schema.json`、`capacity-gate-catalogue-vN.schema.json`；固定 JCS digest 前像；manifest 内绑定 schema digest、profile digest、gate catalogue digest；profile 签名角色与 release signer 分离或采用双角色 quorum；按 digest 从受信 CAS 解析，禁止从 run 目录覆盖。
2. **Gate 语义不可降级。** **[PRODUCT_SLO][DERIVED]** 每个 required gate catalogue entry 固定 metric IDs、condition 集、operator、unit、SLO refs、min samples/window、required stage/scenario/fault/center、是否允许 NA。合同只能提供 observed 和证据引用，不能重定义 threshold 或删 condition。
3. **Condition 证据可表示。** **[DERIVED]** 在 `$defs.condition` 增加 `thresholdRef`、`observationRef`、`sampleSelector`；`observationRef` 必须落到同一 gate/stage/scenario/window 的 typed artifact。删除“必须保存但 Schema 禁止”的不可表示状态。
4. **Evidence provenance。** **[MEASURED][DERIVED]** artifact envelope 增加 `artifactSchemaDigest/producerIdentity/producerBuildDigest/signature/releaseDigest/environmentDigest/scenarioId/phase/windowStart/windowEnd/traceDigest/sourceCursor/queryDigest/WormReceipt`；evaluator 只接受 policy 中允许的 producer/schema。
5. **Final-state 守恒域。** **[DERIVED]** 命令改为 `received/admitted/rejectedPreAdmission/committed/failedTerminal/cancelled/pending` 并按 distinct commandId 重算；事件按 required `(eventId,destination|consumerGroup)` 分组；cleanup 记录对象类型、原因、首尾 cursor，合法 retention 与“为 PASS 删除未决项”分开。
6. **NA 双签。** **[DERIVED]** 新增专用 `approval` artifact type 与 Schema；两个不同 role/key 的签名覆盖 release/profile/run/gate/reason/替代保证/expiry；禁止用自由字符串解析身份；跨 run/gate 重放必须失败。
7. **统计合同。** **[PRODUCT_SLO][DERIVED]** SLO catalogue 固定 `minSampleCount/minWindowSeconds/quantileMethod/includeFailures/maxDropFraction`；percentiles 增 `attemptedCount/observedCount`，强制 `attempted=observed+failed+dropped`、`0<=mean<=max`、分位数有序、所有 count 一致。
8. **联合 trace 与 resource center。** **[DERIVED]** gate 必填 `stageRefs`；stage/gate/condition/artifact/resource observation 使用同一 scenario/phase/window/trace 外键；resource center 不得从 calm phase替代 burst/fault；多个 center 不得共享聚合摘要。
9. **量纲与共享中心公式。** **[DERIVED]** 明文规定 `/1000`、visits、parallelism 和 class aggregation；区分 service demand 与 response time；owner hot key 使用 per-key 串行模型；queue items/bytes 分成两个分布。
10. **Evaluator trust bootstrap。** **[DERIVED]** 允许的 evaluator digest/签名必须由 manifest 或独立 qualification policy 锚定，判定输出携带 schema/profile/gate/SLO/artifact-schema/evaluator 的全部 digest；合同自填 equality 只作 precheck。
11. **Schema 可移植性。** **[MEASURED]** 为所有含 `properties/required` 的 object subschema 显式加 `type:"object"`；官方 CI 同时跑 AJV strict compile 与 Draft 2020-12 conformance。
12. **Mutation suite 作为发布制品。** **[DERIVED]** 固定本报告 R01-E04、A1/B1/B2/C1/D1/E1 事故链为不可删 fixture；每个 fixture 断言规范化 result、reasonCode、conflict evidence 和退出码，不能只断言“非 PASS”。

验收输出至少新增：

```json
{
  "policyDigests": {
    "releaseManifest": "sha256:...",
    "capacityProfile": "sha256:...",
    "gateCatalogue": "sha256:...",
    "sloCatalogue": "sha256:...",
    "artifactSchemaSet": "sha256:...",
    "evaluator": "sha256:..."
  },
  "provenanceVerdict": "VALID|INVALID|NOT_PROVEN",
  "setDifferences": {},
  "bindingConflicts": [],
  "conservationEquations": []
}
```

**[DERIVED]** 任一 policy digest 缺失、producer 未授权、source cursor 不连续、join key 不一致或 required condition 无 observationRef，必须 `NOT_PROVEN`；已证实不变量/守恒失败必须 `FAIL`，不得被证据不完整降级覆盖。

## 8. REQUIRED_LOAD_FAULT_CORRECTNESS_MATRIX

标签约定：矩阵中的数值边界均为 **[PRODUCT_SLO]**；负载、trace、计数与水位均为 **[MEASURED]**；守恒与期望结果为 **[DERIVED]**；Poisson/独立性等近似若使用必须另标 **[MODEL_ASSUMPTION]**，不得直接产生 required PASS。

| ID | 联合负载/形状 | 故障/操纵 | 必测共享中心与正确性 | 必须留存的证据 | 期望判定 |
|---|---|---|---|---|---|
| M01 | steady：profile 的 U/P/A/C 与完整 mix | 无 | gateway→owner→DB→stream→client 全链 p50/p95/p99/max、items+bytes queue | 同一 trace、各 center 独立 attestation、首尾 cursor | 满足全部 SLO/守恒才 PASS |
| M02 | hot owner：top-1/top-K 1/10/100/1000 并发 + 10k burst | 单 key 饱和 | per-key rho、oldest age、fairness、reject、无界队列 | owner key trace、mailbox/lock/DB pool series | 无跨 owner 污染；否则 FAIL/NOT_PROVEN |
| M03 | touched owners `M=Mmax-1/Mmax/Mmax+1` | overload | admission reject 与 Saga 路由、原子语义不变 | manifest mMax、runtime profile、command plan/receipt | 超限静默改 Saga 或部分提交为 FAIL |
| M04 | scheduler due-time histogram 同秒峰 | worker pause/lease steal/poison job | lag、claim/complete CAS、retry、DLQ、DB/WAL | job IDs、lease token、cursor、DLQ | 重复效果/丢 job 为 FAIL |
| M05 | outbox/event 新流量持续 | relay outage 30/120/600s 后恢复 | produced/applied/pending/dropped 按 destination；drain 与前台 SLO | event/destination ledger、consumer cursor、disk bytes | dropped/清理未决项为 FAIL；不收敛为 FAIL/NOT_PROVEN |
| M06 | reconnect cohort 1/10/100/1000 + snapshot | snapshot build 各阶段 crash | DB pool、snapshot CPU/bytes、stream cut、client checksum | 同 scenario trace、snapshot watermark、visible seq | gap/duplicate apply/checksum 错为 FAIL |
| M07 | reconnect storm × authz cache miss × snapshot | auth/cache cold | 三者联合而非边际 p99；gateway/DB/socket/client | 单 traceDigest 与重叠 window | 任一跨 scenario 拼接为 NOT_PROVEN |
| M08 | DB-heavy command mix | pool size阶梯下降、慢查询 | pool visits/hold/wait、transaction deadline、reject amplification | connection spans、query digest、transaction IDs | 共享 pool rho/SLO 不满足为 FAIL |
| M09 | write-heavy economy/territory | WAL bandwidth/IOPS throttle、checkpoint | WAL bytes/commit、fsync queue、commit p99、ledger checksum | WAL/device metrics与事务 trace同窗 | 只报 CPU 或读延迟为 NOT_PROVEN |
| M10 | steady+burst | GC pause/event-loop stall | event-loop delay、socket buffer、lease deadline、receipt terminal | runtime profile、pause spans、receipt IDs | timeout 后重复 commit/未决为 FAIL |
| M11 | AOI 万人热点 + 快速 viewport | 慢网/后台 client | fanout bytes、serialize CPU、socket/client queues、permission epoch | server→client trace与apply receipt | 权威事件丢弃或错误应用为 FAIL |
| M12 | 正常业务负载 | process crash/kill at admission、commit、publish 边界 | receipt/commit/event 三域守恒 | DB LSN、receipt/event IDs、restart trace | 领域已提交但无可收敛终态为 FAIL |
| M13 | fault phase持续新流量 | DB/network/relay/client 单点与组合故障 | 前台 SLO、backlog单调性、net service rate | fault timeline attestation + 同窗 trace | 停前台流量伪 drain 为 FAIL |
| M14 | 任意合格 run | 删除 receipt/job/event 或缩 retention | cleanup/delete、event dropped、cursor gap | before/after ID set、retention config digest | 任一为非零且用于排空时 FAIL |
| M15 | 100/99/50% busy reject | 无 | received/admitted/rejected/committed 分类与 reject SLO | ingress ID ledger + receipt join | 算术平但超过 reject SLO 仍 FAIL |
| M16 | 仅 1 个成功样本或阈值减 1 | 定向丢弃 timeout/error 样本 | attempted/observed/failed/dropped 守恒、quantile method | sampler config、raw IDs、drop reason | 样本不足/选择偏差为 NOT_PROVEN 或已知欺骗则 FAIL |
| M17 | 同一 profile 合格 run | gate ID 保留但删 condition/放宽 threshold | gate catalogue 完整差集 | signed profile/gate/SLO digests | 任一 spec mismatch 为 NOT_PROVEN |
| M18 | 一个 trivial PASS + required gates NA | 伪主体、同 key 双名、过期/重放审批 | waiver policy、双签、替代保证 | 两份签名 approval artifact | 任一审批无效为 NOT_PROVEN；全部 NA 为 NOT_PROVEN |
| M19 | 同一合同 | manifest/profile/catalogue 字节替换、错误 signer、digest 前像变体 | trust chain与policy role | CAS receipt、signature chain、canonical bytes | 未授权/不唯一解析均 NOT_PROVEN |
| M20 | 两 scenario 各自单项好看 | 拼接 arrival/service/utilization 或错窗 center | gate-stage-artifact 五元组一致 | conflict triples/tuples进入判定输出 | `CROSS_SCENARIO_STITCHING`，NOT_PROVEN |
| M21 | 资源 profile 要求 1..8 类 center | 每次删一类或复用聚合摘要 | `required-present` 差集、独立 observation | 每 center 独立 signed artifact | 缺类 `RESOURCE_CENTER_UNCOVERED` |
| M22 | baseline 与 10× data age/retention | index/cache cold、磁盘逼近上限 | P/R 对 DB/WAL/snapshot/drain 的曲线 | dataset digest、age multiplier、disk series | 只用 launch-day fixture 为 NOT_PROVEN |
| M23 | class mix 与 retry amplification 阶梯 | downstream 429/timeout | visits、rho、queue、retry budget | class→center visit matrix、attempt IDs | 忽略 retry visits 的 rho 为 NOT_PROVEN |
| M24 | 完整正样例 | 无 | 所有 policy/provenance/binding/conservation/SLO | 可离线重放的 canonical bundle | 两个独立 evaluator 输出逐字节同 verdict |

**[DERIVED] 最终放行条件：** M01-M24 的坏样例必须产生表中唯一结果，正样例必须由两个独立实现对同一 canonical bundle 得到相同 result、reasonCodes、集合差、冲突绑定和守恒两侧值；在此之前只能维持 `NOT_PROVEN`。
