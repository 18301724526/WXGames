# 教程拆除与重装任务进度交接

截至 2026-07-14 09:35（Asia/Shanghai）。本文件按 `northstar-demolition-order-2026-07-14.md` 的阶段 A/B/C 口径记录。

## 当前结论

- 阶段 0（测试快车）：完成。
- 阶段 A（拆除）：完成，已部署到测试服；游戏无教程时的本地与远端 Canvas 核心烟测通过。
- 阶段 B（独立教程引擎重装）：未开始。当前仓库没有新引擎、客户端游标、四张适配表、56 行配置、输入盾或一行 `mount`。
- 阶段 C：只完成了“引擎关闭时游戏核心烟测”的一部分证据。任务单要求的时代、行军、占城抽样，以及阶段 B 完成后的正式 C1/C2/C3，尚未执行。
- 当前已部署代码：`425df020229e39f4cdb723eab67d5c111f3f1f7e`。

## 已完成提交

| commit | 目的与结果 |
|---|---|
| `b7636272` | 建立阶段 0 测试快车：增加 SQLite 教程检查点保存/恢复、同标签同一步 8 次软空转熔断；实测从 `houseBuilt` 续跑到 `eraAdvancedTo1`。 |
| `0a8d7f19` | 完成阶段 A 主拆除：删除前端旧教程引擎、导演、渲染、输入感知和服务端教程状态机；六簇游戏规则改由真实游戏状态驱动；新增无教程游戏核心烟测和两项拆除门禁。共改动 278 个文件，净删除约 2.3 万行。 |
| `560df8cc` | 修复远端清洁检出部署：从正式架构门禁移除未交付的本地取证脚本引用。 |
| `44d82cf2` | 为已删除教程配置表增加显式退役声明，并把声明传入部署期配置发布流程，使 7 表到 6 表迁移可审计、可发布。 |
| `a1ca9743` | 补交被本地未跟踪文件遮蔽的通用 `WorldUnitSpriteRenderer`，恢复远端前端脚本清单完整性。 |
| `89bb3879` | 部署失败时记录目标 PM2 进程日志路径和最近错误，补足服务器启动失败证据。 |
| `45efcb24` | 将 PM2 日志读取改为直接读取日志文件尾部，避免 `pm2 logs --nostream` 长时间阻塞。 |
| `425df020` | 恢复已发布迁移 `001`/`005` 的不可变定义与校验值，解决 `SCHEMA_MIGRATION_PLAN_BLOCKED`；补回归测试和唯一合理的历史迁移扫描豁免，最终部署成功。 |

## 达到的效果

1. 游戏生产代码已不再读取或写入教程状态，服务端不再拥有教程推进权威。
2. 旧的 `TutorialGuideFlowRegistry`、`TutorialGuideController`、`TutorialHostContext`、教程渲染器、服务端 `TutorialActionValidator`、`TutorialProgression`、`gameState.tutorial` 路由/投影等已删除。
3. 旧教程对建造、时代、军事、探索、占领、任务奖励等游戏规则的影响已改用真实游戏状态或正规任务奖励路径表达。
4. 游戏在完全没有教程引擎的状态下可以启动、登录、读取资源、打开城池/建筑面板、执行建造、返回世界地图并选择世界格。
5. 测试服部署已恢复，`private/main` 与 `private/codex/refactor-tutorial-guide-architecture` 均已到 `425df020`，服务器报告部署成功。

## 耦合度余量

拆前基线来自任务提示；拆后计数由 `scripts/check-game-tutorial-awareness.js` 在当前 HEAD 扫描 1125 个生产文件得到。

| 指标 | 拆前 | 当前 | 目标 |
|---|---:|---:|---:|
| 后端含教程符号的生产文件 | 20 | 0 | 0 |
| 生产代码中的 `gameState.tutorial` 引用 | 31 | 0 | 0 |
| 前端非教程目录含教程感知的生产文件 | 30 | 0 | 0 |
| 拆除门禁总违规数 | 未建立 | 0 | 0 |

当前显式豁免如下。豁免是边界声明，不代表对应阶段 B 代码已经存在：

1. `backend/migrations`：只允许保留已发布、不可变的历史模式信息，不得包含游戏行为。当前 `gameState.tutorial` 精确引用仍为 0。
2. `frontend/js/lib/tutorial-engine`：预留给可移植的新教程引擎。当前目录不存在。
3. `frontend/js/integrations/tutorial`：预留给四张表和一行装配边界。当前目录不存在。
4. `frontend/js/config/tutorial`：预留给纯数据 56 行教程配置。当前目录不存在。

## 架构健康与测试证据

| 检查 | 结果 | 证据 |
|---|---|---|
| 游戏教程感知阻断门禁 | 通过，1125 个生产文件，违规 0 | `node scripts/check-game-tutorial-awareness.js`；本次交接前已复跑 |
| 旧教程契约退役门禁 | 通过，11 组退役契约，违规 0 | `node scripts/check-tutorial-demolition-retirements.js`；本次交接前已复跑 |
| 阶段 0 全量测试 | `2541/2541`，约 6.16 秒 | `tmp/stage0-npm-test.log` |
| 阶段 A 主拆除全量测试 | `2229/2229`，约 6.00 秒 | `tmp/phase-a-npm-test-final.log` |
| 阶段 A 架构门禁 | 通过 | `tmp/phase-a-hotfix-architecture.log` |
| 阶段 A 最终迁移修复 | 日志记录 lint、全量测试 `2230/2230`、架构门禁通过 | `tmp/standing-loop-log.md`，轮次“阶段 A-部署 10” |
| 本次交接快速复核 | lint 通过；全量测试 `2230/2230`，约 6.63 秒；架构门禁通过 | 2026-07-14 当前工作区直接复跑 |
| C1 引擎关闭 | 部分通过：本地/远端核心烟测通过；时代、行军、占城抽样未形成完整 C1 证据 | 见下一节 |
| C2 引擎开启 | 未执行；新引擎尚未重装 | 无 |

注意：拆除后测试数下降，主要原因是旧教程引擎及其耦合测试按退役清单删除，不是测试异常跳过。

## 实机与部署证据

### 阶段 0 检查点续跑

- 目录：`.local-logs/stage0-resume/2026-07-13T20-10-43-113Z/`
- 结果：从检查点恢复后执行 2 个动作，从 `houseBuilt` 到 `eraAdvancedTo1`；`verificationFailures=0`、`pageErrors=0`、`requestFailures=0`。
- 汇总：`.local-logs/stage0-resume/2026-07-13T20-10-43-113Z/summary.json`
- 人工截图索引：同目录 `verification-report.json` 和 `*-full.png`。

### 本地无教程游戏烟测

- 目录：`.local-logs/game-smoke/2026-07-13T23-43-16-216Z/`
- 汇总：`summary.json`，`pass=true`，7 个动作，失败 0。
- 覆盖：资源详情、首都入口、建筑面板、建造/升级状态变化、返回世界地图、世界格选择。
- 截图：同目录 `00-loaded.png`、`01-resource-details-open.png`、`02-buildings-panel-open.png`、`04-building-state-changed.png`、`06-world-tile-selected.png` 等。

### 远端无教程游戏烟测

- 页面：`http://47.116.32.216/wxgame-refactor/`
- API：`http://47.116.32.216/wxgame-refactor-api`
- 目录：`.local-logs/remote-smoke/2026-07-14T01-01-33-899Z/`
- 汇总：`summary.json`，`pass=true`，7 个动作，失败 0；浏览器错误和 5xx 为 0。
- 截图：同目录与本地烟测同名的 `*.png`。
- 2026-07-14 09:32 再查 `/health`：`deployStatus.status=succeeded`，`stage=complete`，`deployedCommit=425df020229e39f4cdb723eab67d5c111f3f1f7e`，配置运行时 `matchesCurrent=true`。
- 当前健康页唯一告警为 `PERFORMANCE_BUDGET_EXCEEDED`，不属于本次教程拆除功能失败。

## 新引擎可移植性现状

此部分尚未实现，不能按终态宣称完成：

| 项目 | 当前状态 |
|---|---|
| 一行 `mount` | 无；仓库内没有教程引擎挂载调用。 |
| 引擎库 | `frontend/js/lib/tutorial-engine` 不存在。 |
| 游戏适配器文件 | `frontend/js/integrations/tutorial` 不存在，文件清单为空。 |
| 56 行配置 | `frontend/js/config/tutorial` 不存在。 |
| 进度存储 | 客户端唯一游标、本地持久化与导出接口均未实现。 |
| 四张表 | target/event/action/query 均未按新边界落地。 |
| 输入盾 | 策略层与宿主执行层均未实现。 |
| 换游戏证明 | 尚无；目前不能证明“只改四张表/适配器即可换游戏”。 |

阶段 B 应以四张表加 `effects`/输入盾为唯一游戏接触面；游戏装配层只保留一行挂载，删除该行后游戏必须照常运行。实际挂载文件与适配器文件名应在实现时确定并回填本报告，不应提前虚构。

## 尚未完成

1. B1：实现客户端唯一游标、本地持久化、导入/导出和重入安全；完成态由游标定义。
2. B2：按 S8 草稿核销 R01-R56，落齐 56 行纯数据配置；按裁决处理 X1-X7，脚本类型不超过 6 种。
3. B3：补齐 target/event/action/query 四张表、18 个既有事件与新增通用成功事件；query 维持 2 条预算。
4. B4：拆分输入盾策略层和宿主管线执行层，并建立唯一一行 `mount`。
5. C1：在 B 完成后重新做引擎关闭验收，补齐时代、行军、占城抽样和最终全量测试。
6. C2：引擎开启后，用全新账号从零跑到客户端游标 `completed=true`，不得使用检查点替代终局验收。
7. C3：六门、所有权/纯度门禁全绿，并生成 56 行逐行“已迁/已删/豁免”核销表。
8. 当前远端 `observability.status=degraded`，原因是性能预算告警；不阻塞教程任务，但后续可单独排查。

## 未跟踪取证文件的交接说明

本次交接会一并提交以下已有文件，避免换机器丢失：

- `docs/architecture/northstar-s8-adjudication-2026-07-13.md`：S8 owner 裁决原文。
- `scripts/dev-env-smoke.sh`：本地后端/代理/API 四点环境烟测。
- `scripts/playtest-forensics-A.js`、`scripts/playtest-forensics-B.js`：拆除前的双席位动态取证脚手架。
- `scripts/playtest-online-tutorial-hangprobe.js`、`scripts/playtest-online-tutorial-tracer.js`、`scripts/playtest-step-script-trace.js`：拆除前教程卡死/轨迹取证工具。

这些 JavaScript 文件当前均通过 `node --check`，`dev-env-smoke.sh` 通过 `bash -n`；但后三个教程取证工具仍引用已删除的 `shared/tutorialFlowConfig`、`TutorialHostContext` 或 `TaskPanelStepScripts`，在阶段 A 当前 HEAD 上不能直接运行。它们只能作为历史取证来源，阶段 B 开始时应决定重写到新引擎接口或显式退役，不能重新引入旧宿主耦合。`package.json` 的 lint 命令显式忽略两个超大历史脚本 `hangprobe`/`tracer`，与昨晚阶段 A 最终 lint 的执行口径一致；其余交接文件仍纳入默认 lint。

空的根目录文件 `nul` 长度为 0，且是 Windows 保留名，不是工作产物，本次不提交。

## 到公司后的建议起点

1. 拉取 `private/main`，先读本报告和 `tmp/standing-loop-log.md`。
2. 从 B1 开始，只先落客户端游标与纯引擎接口；不要恢复任何已删除的旧教程宿主代码。
3. B1 每个小提交只跑对应单测、两项拆除门禁和必要 lint；到 B 阶段完整装配后再跑全量 C1/C2，避免重复长跑。
4. 每次部署仍按 `private/main` 后推 `private/main:codex/refactor-tutorial-guide-architecture`，并以 `/health` 中的 `appVersion.deployedCommit` 精确匹配 HEAD 为准。
