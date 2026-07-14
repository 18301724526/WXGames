# 7月14日后端架构

本目录是 2026-07-14 后端架构工作的可带走交付包。目标是建立成熟 SLG 后端的正确性、数据、协议、恢复和容量验收标准，并将目标标准与 wxgame 当前实现差距严格分开。

## 当前版本

- 参考规范：`REFERENCE_V2_2_STATUS = NOT_PROVEN`
- 当前代码：`CURRENT_IMPLEMENTATION = NON_CONFORMING`
- 含义：v2.2 已吸收第二轮四席评审，但仍需第三轮独立对抗；当前代码需要按迁移路线图逐阶段实现，不能因为单机或用户少豁免正确性。

## 文件索引

| 文件 | 用途 |
|---|---|
| `当前服务器架构.html` | 当前线上/单机结构的事实图，不是目标架构 |
| `成熟SLG后端参考架构-v2.2.html` | 目标逻辑架构、表模型、协议、恢复和验收门禁 |
| `容量合同-v2.2.schema.json` | 容量/正确性证据的机器可校验结构 |
| `容量合同判定器规范-v2.2.md` | 跨字段、证据、数学关系和 PASS/FAIL/NOT_PROVEN 的确定性算法 |
| `当前实现迁移路线图-v2.2.md` | 从当前 wxgame 迁移到 v2.2 的阶段、依赖和退出门禁 |
| `架构v2.2四席对抗审核提示词.md` | KIMI、GLM、GPT-SOL、DeepSeek 及最终交叉质询提示词 |
| `历史材料/` | v2.0/v2.1 提示词、v2.1 参考架构和四份二审报告 |

两个 HTML 文件都可直接用浏览器打开。参考架构 HTML 内置复制、PNG 和 PDF 导出工具；导出功能需要能访问其固定版本 CDN，纯查看不依赖服务器。

## 回家后继续顺序

1. 分别把四段独立提示词发给 KIMI、GLM、GPT-SOL、DeepSeek。
2. 四席各自完成前，不允许读取其他席位报告。
3. 四份报告齐全后，运行文档末尾的“最终交叉质询”提示词。
4. 只有最终裁决为 `ACCEPT_FOR_IMPLEMENTATION` 才开始迁移路线图 M0；若为 `REVISE_TO_V2_3`，先修规范，不改产品代码。
5. 实现阶段按 M0→M7 顺序，每一阶段独立提交、独立评审、独立故障注入，不以测试总数代替语义证据。

## 第二轮已吸收的关键修订

- Placement epoch 使用数据库单行 CAS；handoff 定义线性化点、deadline 和恢复主体。
- 每笔写事务提交前最终 fencing，并持有全部 owner lease/head 行锁至 COMMIT。
- receipt admission、execution lease、guardian 接管和 terminal 领域事务边界明确。
- `M_max` 只控制 admission，不得自动改变原子业务语义。
- scheduler completion CAS 与领域写同事务；Saga confirm/compensate 有版本和 dedupe 守卫。
- session/refresh/authz、动态 owner expectedVersion、pending command 和 stream 生命周期补齐。
- ACK/statusUrl 不推进客户端 cursor；旧包由 subscription generation/permission epoch 丢弃。
- transactional outbox 与 durable stream retention 分离。
- chargeback、receivable、FX snapshot、保留/去标识化边界补齐。
- restore/release 具有持久 run、执行租约、幂等步骤、证据链和信任根。
- 容量合同从自由文本拆为 typed JSON Schema，并规定确定性 evaluator 的 PASS/FAIL/NOT_PROVEN 规则。

## 审核底线

报告必须区分：

- `SPEC_CONTRADICTION`：规范内部无法同时满足。
- `UNDER_SPECIFIED`：规范缺执行语义。
- `UNTESTABLE`：证据无法产生唯一判定。
- `IMPLEMENTATION_ONLY_GAP`：目标成立但当前代码未实现。
- `FACT_ERROR`：代码事实或事务时间线错误。

当前没有目标表、脚本或服务，不等于目标规范自相矛盾。反过来，规范画出表名或状态机，也不等于已经可以实现和验收。
