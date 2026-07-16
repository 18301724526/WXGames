# M1a-T4b 硬化跟进单 — 影子写调用点护栏 + 漏写检测 + 惰性文档（2026-07-16）

Status: **ACTIVE，先于 T5。** T4b（`83bdca8c`）核心正确、DTO 逐字节安全门成立；但双席盲审（A 席）+ 监督者亲验发现一组需硬化的缺口。非重做，是小跟进。

## 背景（已亲验）

- 影子写调用点 `CommandExecutionPipeline.js:223 this._writeAcceptedReceipt(...)` **在主 `try`（L233 起）之外**。`_writeAcceptedReceipt` 内部对 `computePayloadHash` 和 `writeAccepted` 有 try/catch，但 **admission 前奏 `resolveReceiptAdmission`/`toEpochOrNull` 未被保护**。`sessionContext` 含 `Symbol` epoch（或抛异常 getter）→ `Number(Symbol())` 抛 TypeError → **逃出 execute()、主链 domain 未执行**。违反"影子写任何输入下都不阻断主链"。生产当前不可达（HTTP 无法传 Symbol），但契约要求结构保证。
- **影子写在生产目前是惰性的**：监督者亲验——**没有任何路由/服务传 `options.sessionContext`**（grep 零命中），三个 admission epoch（credential_version/session_epoch/authz_epoch）是 M5 概念、当前不存在，故每条命令 admission 都 `missingFields` → 只告警、从不写 receipt。这是设计使然（机制先就位、输入等 M5），但 **"unknown=0" 因此是空洞的**（写路径从未被 trace 触发），不能当作运行时安全证明，且需文档化。
- `INSERT OR IGNORE`（`CommandReceiptShadowStore.js:26`）冲突静默返回 `changes:0`，`CommandExecutionPipeline.js:149-153` 丢弃返回值——不同命令碰巧同 `(session_id, client_seq)` 时第二条 accepted 静默漏写；测试 `CommandExecutionPipeline.test.js:414-432` 把 count==1 固化。

## 任务（按序，每任务一 commit）

### T4b-H1（必修）— 影子写调用点结构护栏
- `CommandExecutionPipeline.js:223` 的 `_writeAcceptedReceipt(...)` 调用**整体包进 try/catch**，catch 内走 `_warnReceiptShadow('COMMAND_RECEIPT_ADMISSION_FAILED', ...)` 并返回/继续——**任何** admission 计算异常（含 resolveReceiptAdmission/toEpochOrNull 的 throw）都不得逃到主链。
- 判据：新增测试——`sessionContext.credentialVersion = Symbol()`（及一个 getter 抛异常的 sessionContext）时，`execute()` 仍返回正常 domain 响应（不抛）、receipt 未写、有告警。这条测试是"影子永不破坏主链"的结构证明。

### T4b-H2（应修）— 漏写检测，去掉测试对漏写的固化
- `CommandReceiptShadowStore.writeAccepted` 已返回 `{inserted, changes}`；`_writeAcceptedReceipt` 检查返回：`inserted===false && changes===0` 且**不是同 commandId 重放**（重放是 PK 冲突、正常 no-op，不告警）时，说明是 `(session_id, client_seq)` 撞了**不同** commandId → 打 `COMMAND_RECEIPT_SEQ_CONFLICT` 告警（不阻断主链）。
- 修正测试：`CommandExecutionPipeline.test.js` 中把"不同命令同 seq → count==1"这条断言从"固化漏写"改为"断言产生 SEQ_CONFLICT 告警"（同命令重放仍断言单行、无告警，保留）。
- 判据：不同命令同 (session,seq) → 告警产生；同命令重放 → 无告警、单行。

### T4b-H3（文档）— 惰性与孤儿的显式注释
- 在 `_writeAcceptedReceipt`（或 CommandReceiptShadowStore 头部）加注释写明本阶段契约：
  1. **惰性**：admission epoch（credential_version/session_epoch/authz_epoch）由 M5 会话状态机提供，当前无路由传 sessionContext，故影子写默认跳过；这是预期状态，不是 bug。`unknown=0` 不代表写路径已被运行时验证。
  2. **孤儿**：accepted receipt 可能领先于 domain 提交（admission 在 idempotency 检查前），主链 replay/冲突/回滚时会留 accepted 但无 terminal 的孤儿行；本阶段"只写不读"故无害，**下游（M5/contract 阶段）开始读 accepted 行做时序/对账前必须先处理孤儿收敛**。
- 判据：注释存在且准确；不改行为。

### T4b-H4（LOW，顺手）— 边缘收口
- `toEpochOrNull` 对 BigInt：`Number(BigInt)` 静默转换 + 大值精度丢失。决策：BigInt epoch 视为非法 → 返回 null（触发跳过），与 payload hash 的 BigInt 拒绝策略一致。
- `admission.sessionId = String(sessionContext?.sessionId || '')`：数值 0 sessionId 因 `||` 短路判缺失。用显式 `sessionContext?.sessionId == null ? '' : String(sessionContext.sessionId)` 之类修正（sessionId 约定字符串，影响小，但顺手改）。
- 判据：BigInt epoch → 跳过影子写 + 告警；数值 sessionId 不被 `||` 误吞。

## 纪律
- 一任务一 commit；判据在题内，完成即自验；测试数字禁转述。
- 先 codegraph explore；禁大面积通读。每任务过 npm test / npm run lint /
  node scripts/run-architecture-smoke.js / git diff --check。LF、UTF-8。
- 禁碰生产服务器；运行时验证只许本地/WSL 镜像。遇阻停手报最小复现，禁试修-撤回循环。
  禁 spawn 子 agent。做完 T4b-H4 即停等审查。
