# M0 审计整改工单 — GLM/kimi 双席盲审仲裁后的可修项（2026-07-16）

Status: **QUEUED（排在 M1a-T4~T6 之后执行；一次只让执行者抓一条线）。**
Authority: owner 指令 2026-07-16。
来源: GLM(A 席) + kimi(B 席) 对 `51b98f3f..dbc04285` 的双席盲审，监督者逐条亲验/仲裁（`tmp/audit-m0-fi22-A.md` / `-B.md`）。
说明: 无 P0；两个 P1 + 若干 P2，全部机械可验。**CommandReceiptIdentity 硬化（审计 #5）不在本单——已并入 M1a-T4a**。

## 任务（按序，每任务一 commit；判据在题内）

### AR-T1（P1，PII）— 脱敏器补 IP/手机/人名模式 + 断言同步
- 现状（审计 #1 实证）：`scripts/m0-fixture/export-production-shape.js` 只按列名脱敏，**自由文本字段内嵌的 IP**（如 `sessions.notes='logged in from 10.0.0.1'`）既不脱敏、`assertSanitizedFixture` 也抓不到（`patternLeaks` 只查 email/jwt/bearer/querySecret，无 IP）。fixture 数据未入库故未发生泄漏，但工具一旦对真实 prod 数据生成+分享即泄漏。
- 修：`collectPatternValues` / `sanitizeFreeText` / `assertSanitizedFixture` 三处**同一份模式清单单一常量源**新增 IPv4（含私网/公网）、IPv6、中国大陆手机号（1[3-9]\d{9}）模式；人名视可行性（若有 real-name 列走列名脱敏即可，自由文本人名不做过度工程，注释说明边界）。
- 判据：单测——`notes` 内嵌 IPv4/IPv6/手机号经脱敏后不再出现原值；`assertSanitizedFixture` 对注入到自由文本的上述三类**必须抛**（先构造"漏检"负控证明修前 assert 放行、修后拦截）。

### AR-T2（P1，授权）— NODE_ENV 归一化 fail-closed（JWT + CORS 统一）
- 现状（审计 #2/#7）：`SecurityConfig.resolveJwtSecret` 对空串/未设 NODE_ENV 静默归到 `development` → 用 dev JWT secret；`resolveCorsOptions` 用**严格 `=== 'production'`**（未 `.toLowerCase()`），`NODE_ENV='Production'` 大写时绕过 `CORS_ORIGINS` 强制、放行 `origin:true`。
- 修：①CORS 与 JWT 共用同一个已归一化的 nodeEnv（`.trim().toLowerCase()`）；②**空串/未设 NODE_ENV 不再静默降级**——要么要求显式设 `NODE_ENV`，要么在未知/空值时 fail-closed（拒绝 dev fallback、拒绝宽松 CORS）。allowlist 仍限 `development`/`test`。
- 判据：单测——`Production`/`PRODUCTION` 大写 → CORS 要求 CORS_ORIGINS（不再 origin:true）；空串/未设 → 不给 dev secret、不给宽松 CORS（fail-closed）；`development`/`test` 行为不变。核对 `scripts/verify-production-security-config.js` 是否需同步。

### AR-T3（P2，文档准确性）— command-invariants 去重键更正
- 现状（审计 #3）：`docs/architecture/m0/command-invariants.md` 的 `claimTaskReward` 写 `businessUniqueKey = playerId + taskId + taskDefinitionVersion`，但 `TaskCenterService.claimTask` 实际只按 `progress.claimed[task.id]` 去重（`taskDefinitionVersion` 不参与）。
- 修：改为与代码一致的去重键；顺带抽查审计 #3 提到的 `claimConquest`/`startConquest`（`conquestId` 字段实际不存在，mission id 为 `conquest_${territoryId}_${ts}`）是否同样需要更正措辞。
- 判据：`check-invariants.js` 仍绿；更正后的字段可在代码里逐一指认。

### AR-T4（P2，扫描完整性）— scanner 命令类交叉核对 dispatch
- 现状（审计 #4）：`scanner.js` 的命令类"发现"= `listDeclaredCommandTypes()` 读 `COMMAND_OWNER_RULES` 键，不打开任何 handler/dispatch，无法检出"注册了规则但无 handler"或"有 handler 未注册规则"的漂移，与 T1"禁 declaration-echo"精神冲突。
- 修：命令类增加对**实际 dispatch/handler 装配处**（`GameCommandDefinitionFactory` 或等价注册点）的源码扫描，与 `COMMAND_OWNER_RULES` 双向对账：规则有而 handler 无 → finding；handler 有而规则无 → finding。
- 判据：注入测试双向各触发一次 finding（复用 M0 既有注入测试模式）；`--check` 在真实树上仍 drift=0。

### AR-T5（P2，证据新鲜度）— tri-diff 回归 + 可选入门禁
- 现状（审计 #6）：`node scripts/m0-writer-inventory/runtime-report.js --check` 报 `OUTPUT_STALE docs/architecture/m0/writer-tri-diff.md`（提交版与再生成不符；unknown=0 仍成立，仅文档文本陈旧）。
- 修：regenerate `writer-tri-diff.md` 使 `--check` 干净；评估把该 `--check` 接进 architecture-smoke（若成本低则接，接则须保证 CI 环境有 ndjson 输入或 gate 可跳过缺输入的情形——别把 gate 做成偶发红）。
- 判据：`runtime-report.js --check` 无 OUTPUT_STALE；若入门禁则 architecture-smoke 仍稳定绿。

## 纪律（与前单一致）
- 一任务一 commit；判据在题内，完成即自验；测试数字禁转述。
- 先 codegraph explore 定位，禁大面积通读。LF、UTF-8。
- 每任务过 `npm test` / `npm run lint` / `node scripts/run-architecture-smoke.js` / `git diff --check`；改 shell 的话加 shellcheck。
- **禁碰生产服务器（47.116.32.216 / kodagame.top）**；运行时验证只许本地/WSL 镜像；联网装工具允许。
- 遇阻停手报告最小复现；做完 AR-T5 即停等审查；禁 spawn 子 agent。
