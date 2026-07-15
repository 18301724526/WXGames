# 7月14日后端架构

本目录是 2026-07-14 后端架构工作的可带走交付包。目标是建立成熟 SLG 后端的正确性、数据、协议、恢复和容量验收标准，并将目标标准与 wxgame 当前实现差距严格分开。

## 当前版本

- 参考规范：`REFERENCE_V2_3_STATUS = NOT_PROVEN`
- 当前代码：`CURRENT_IMPLEMENTATION = NON_CONFORMING`
- 含义：v2.3 已吸收第三轮四席评审的最终交叉质询裁决（`REVISE_TO_V2_3`，5 个 P0 + 1 个 SPEC_CONTRADICTION + P1/P2 修订单全部落地），仍需第四轮独立对抗；当前代码需要按迁移路线图逐阶段实现，不能因为单机或用户少豁免正确性。

## 文件索引

| 文件 | 用途 |
|---|---|
| `当前服务器架构.html` | 当前线上/单机结构的事实图，不是目标架构 |
| `成熟SLG后端参考架构-v2.3.html` | 目标逻辑架构、表模型、协议、恢复和验收门禁 |
| `容量合同-v2.3.schema.json` | 容量/正确性证据的机器可校验结构 |
| `容量合同判定器规范-v2.3.md` | 跨字段、证据、数学关系和 PASS/FAIL/NOT_PROVEN 的确定性算法 |
| `当前实现迁移路线图-v2.3.md` | 从当前 wxgame 迁移到 v2.3 的阶段、依赖和退出门禁 |
| `架构v2.3四席对抗审核提示词.md` | KIMI、GLM、GPT-SOL、DeepSeek 及最终交叉质询提示词（第四轮） |
| `历史材料/` | v2.0-v2.2 提示词、v2.1/v2.2 参考架构、v2.1 与 v2.2 两轮四席报告及 v2.2 最终交叉质询裁决 |

两个 HTML 文件都可直接用浏览器打开。参考架构 HTML 内置复制、PNG 和 PDF 导出工具；导出功能需要能访问其固定版本 CDN，纯查看不依赖服务器。

## 继续顺序（第四轮）

1. 分别把四段独立提示词发给 KIMI、GLM、GPT-SOL、DeepSeek。
2. 四席各自完成前，不允许读取其他席位报告与任何历史评审报告。
3. 四份报告齐全后，运行提示词文档末尾的"最终交叉质询"提示词（该席允许读上一轮最终裁决作为 ledger 基线）。
4. 只有最终裁决为 `ACCEPT_FOR_IMPLEMENTATION` 才开始迁移路线图 M0；若为 `REVISE_TO_V2_4`，先修规范，不改产品代码。
5. 实现阶段按 M0→M7 顺序，每一阶段独立提交、独立评审、独立故障注入，不以测试总数代替语义证据。

## 第三轮已吸收的关键修订（v2.2 → v2.3）

第三轮最终裁决 `REVISE_TO_V2_3`（裁决全文：`历史材料/v2.2四席评审报告/architecture-v2.2-adversarial-final-synthesis.md`，40 条 ledger）。v2.3 落地的修订：

**P0（5 条 + 1 条矛盾）**
- FL-01：handoff draining 提交谓词明文化 + `transferring→active` 激活 CAS（执行主体/超时/失败回收）+ committed_watermarks 同事务原子记录 + 示例 fencing SQL 自包含化。
- FL-13：command_receipts 增加三类 epoch admission 快照列；撤销语义钉死为读法(a)（SLO=传播延时上界）；受管制命令类（支付/管理员/权限授予）commit 点复核；缓存超 SLO fail-closed。
- FL-24：容量合同 finalState 扩为守恒结构（command/event/cleanup conservation 各带 evidenceRefs），判定器按守恒方程复算，不信任布尔值。
- FL-32：restore_runs 单例准入 guard + 非终态部分唯一索引。
- FL-38：PITR 恢复后 seq 不重用规则 + 外部 consumer acked_seq 比对 + divergence 清单阻塞 reopen。
- FL-26（SPEC_CONTRADICTION）：schema overall PASS 分支放行带完整审批链的 NOT_APPLICABLE gate，与判定器 §11 对齐，配 mutation fixture。

**P1/P2（批量）**
- Evaluator typed 输入包：percentiles 必填 mean/sampleCount；deploymentProfile（manifest 锚定的 mandatory profile 四清单，含 requiredResourceCenterTypes）；release.capacityParameters 钉死 mMax 绑定（切断 capacityContractId 循环引用）；scenarioId/traceDigest 联合绑定；resourceCenters 结构；condition 双来源拆分。
- Restore 执行语义包：九步幂等 guard + next-step CAS 模板、接管授权、四类状态收敛 SQL、TRAFFIC_REOPENED 签名 token、signer key lifecycle。
- 协议语义钉死：statusUrl 一致性、filtered stream visible seq、未知 event type 默认行为 + upcaster 无 gap 断言、refresh family 语义与双 hash 列。
- 数据面收尾：plan_attempt 谓词、saga dedupe_key 作用域、fx_snapshots/fee/tax/rounding、snapshot 一致切面、外部 destination durable accept。
- 路线图 M1/M2/M5/M6/M7 交付与门禁对应增补；§14 新增两条"不做的捷径"（清积压伪 drain、自选 scope 容量合同）。

## 审核底线

报告必须区分：

- `SPEC_CONTRADICTION`：规范内部无法同时满足。
- `UNDER_SPECIFIED`：规范缺执行语义。
- `UNTESTABLE`：证据无法产生唯一判定。
- `IMPLEMENTATION_ONLY_GAP`：目标成立但当前代码未实现。
- `FACT_ERROR`：代码事实或事务时间线错误。

当前没有目标表、脚本或服务，不等于目标规范自相矛盾。反过来，规范画出表名或状态机，也不等于已经可以实现和验收。
