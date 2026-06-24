# 6月24日 Codex 开发日志

本文档记录 2026-06-24 在测试分支 `codex/battle-core-test-server` 上由 Codex 接手后的开发与验证。Claude 开发日志仍保留历史过程；本日志用于维护 Codex 后续工作基线、验证结果、待办和上线注意事项。

## 晚间最新交接基线

- 本地工作分支：`codex/fix-world-hud-ocean-march`。
- 测试服部署分支：远端 `origin/codex/battle-core-test-server`。
- 已部署到测试服并被用户验证过的基线：`ee89efda`（`tune tutorial advisor spine layout`）。
- 用户最后复测结论：Spine “看不到/飞走”不是本次裁剪或缩放代码导致，实际是网络加载问题；资源加载完成后 Spine 正常出现。
- 本轮交接目标：维护详细开发日志，把当前工作区里的代码、文档、测试治理内容统一提交并推送到远端，方便回到电脑后继续接手。

## 今日已完成的主线工作

### 1. 新账号首次城市点击与海洋行军问题

- 已定位并修复新账号第一次引导点击城市时，入城 HUD 偏离城市 actor 所在 tile 的问题。
- 已定位海洋 tile 点击触发行军时报 `EXPLORE_ROUTE_BLOCKED` 的问题：客户端旧逻辑允许把不可通行海洋格作为手动行军目标发给后端，后端正确拒绝后形成 400。
- 修复方向：
  - 城市 HUD 锚点回到 world map tile / actor 的统一坐标模型。
  - 行军目标策略前移到客户端 domain 层，海洋/不可通行目标不再发起 `startWorldMarch`。
  - 补了 world march route policy、hit target、site overlay、HUD 渲染等单测。
- 对应提交：`d7840e20`（`fix world march target blocking and city HUD anchoring`）。

### 2. Spine 出现导致 tile 大地图消失

- 第一个真实根因：教程 Spine 以前作为未注册的 WebGL 画布插入物理 canvas 栈，可能覆盖 `worldMap` / `worldActor` 物理层，导致看起来 tile 地图消失，只露出背景底图。
- 第二个真实根因：Spine ready 时调用通用 `handleAssetsChanged()`，该通用资产变更路径会清 world map tile cache 并触发渲染；在 baked layer stale 或同帧节流窗口里，`renderReadOnly()` 可能把 `worldMap` 物理层置为不可见。
- 修复方向：
  - `tutorialSpine` 独立注册为透明 WebGL overlay layer。
  - `tutorialDialogue` 独立注册为透明 2D overlay layer。
  - Spine 层不参与 world map / HUD 的清屏策略，不再走旧的 detached/offscreen fallback，也不再把 Spine 当 HUD frame 画回主 HUD。
  - Spine ready 只请求 overlay render frame，不再触碰 world map cache。
  - world map baked layer 无效时强制 runtime redraw，避免同帧节流把地图层隐藏。
  - 物理裁剪从实际 skeleton bounds 自动计算，不使用硬编码生产裁剪矩形。
- 用户手调参数已接入 `TutorialAdvisorSpineLayoutConfig`：
  - `targetRect`: `{ x: 0, y: 433, width: 158, height: 330 }`
  - `viewScale`: `1.41`
  - `viewOffsetX`: `2`
  - `viewOffsetY`: `85`
  - `fitPadding`: `1`
  - `clipPadding`: `4`
  - `dialogueLeft`: `126`
- 重要口径：裁剪、缩放、位置是三件事。生产代码只用 skeleton bounds + padding 做物理裁剪；缩放/位置由 view transform 控制；调参工具的 `previewClipRect` 只作为诊断读数，不进入生产裁剪。
- 对应提交：
  - `c1c1e87b`（`fix: isolate tutorial spine canvas layer`）
  - `35fd1928`（`fix: decouple tutorial spine overlay rendering`）
  - `ee89efda`（`tune tutorial advisor spine layout`）
- 专项日志：`docs/development_logs/2026-06-24-spine-transparent-layer-fix.md`。

### 3. 引导系统架构迁移

- 现状判断：旧引导逻辑散在 controller / highlight / UI 事件分支里，继续直接加“军营升级、主线奖励、自动补兵、保存编队”会继续扩大技术债。
- 已完成的架构调整：
  - 新增 `TutorialGuideFlowRegistry`，集中管理 step 到 highlight / target 的映射。
  - 新增 `TutorialGuideEventRegistry`，集中管理业务事件到 tutorial step progression 的映射。
  - `TutorialGuidePhaseHighlights` 收缩为安装器，不再保留大段 if/else 分支链。
  - 旧 controller 入口保留兼容适配，但统一导向 `handleEvent(eventName, payload)`。
  - H5 与小游戏入口都加载新 registry。
  - 增加架构测试，防止旧分支链回流。
- 当前刻意未做：还没有把新的“点击入城 -> 点击建筑 -> 升级军营 -> 主线任务奖励 500 士兵 -> 领取奖励 -> 编队自动补兵 -> 保存 -> 派出侦查队”插入正式流程。原因是先推旧流程架构迁移给用户测试，确认旧流程不回归后再插新流程。
- 已确认的设计问题：补兵后点“保存”应当立即生效，不应再要求额外点“确认”。后续插入补兵引导时要按“自动补兵 -> 保存即生效 -> 下一步”实现。
- 对应提交：
  - `35fd1928` 附近的 Spine 渲染修复不再牵连引导渲染。
  - `ee7f9adc`（`chore: satisfy tutorial guide deploy gates`）与前置 refactor 提交完成引导 registry 化。
- 专项日志：`docs/development_logs/2026-06-24-tutorial-guide-architecture.md`。

### 4. 大厂评审向的治理补强（当前待提交内容）

本轮工作区还包含一组未提交的治理改动，目标是把“能跑”推进到“可审计、可回滚、可解释”：

- SQLite schema migration：
  - 新增 `SchemaMigrationService`。
  - 增加 `schema_migrations` ledger，记录 migration id、checksum、status、appliedAt、durationMs。
  - 增加 `schema_migration_locks`，避免 API/worker 并发启动时重复迁移。
  - `GameStateRepository.init()` 不再散落二十多个 `ALTER TABLE` if 分支，改为 `001-game-states-compat-columns` 迁移。
  - checksum drift、非法状态、并发锁都会 fail loud。
- 登录会话安全：
  - 登录 token 不再明文落库，新登录写入 `sha256:` hash。
  - JWT 内增加 server-generated `sessionId`。
  - 同账号第二次登录会替换前一次会话，旧 token 请求返回 `401 SESSION_REPLACED`。
  - 兼容旧明文 token，下一次登录会自然升级为 hash token。
- 安全审计脚本：
  - `check-backend-security-audit.js` 支持 `NPM_AUDIT_PROXY`、`HTTPS_PROXY`、`HTTP_PROXY`。
  - Windows 下在没有显式代理时可读取当前用户系统代理，减少本机 `npm audit` 因网络不可达失败。
  - 漏洞策略仍保持收紧，不放宽 `xlsx` 以外的 residual。
- ESLint baseline：
  - 清掉 `WorldMapInputIntent.js` 的 `no-undef` suppression。
  - `Buffer.byteLength` 改成 `global.Buffer?.byteLength`，兼容 H5/小游戏 runtime，又不需要 lint 豁免。
- 架构烟测：
  - `scripts/run-architecture-smoke.js` 纳入 `SchemaMigrationService` 和对应测试，避免 schema 治理绕过架构门禁。
- RFC 文档：`docs/development_logs/2026-06-24-large-company-review-rfc.md`。

## 当前提交前需要保留的注意事项

- 远端 `github` 只是代码托管；测试服部署应推 `origin` 上的 `codex/battle-core-test-server`。之前已确认不能把 GitHub 当公网测试空间。
- 本地曾出现若干文件 “`git status` 显示 modified 但 `git diff --name-status` 无内容” 的情况，主要来自行尾状态刷新。提交时应以实际 staged diff 为准，不把纯状态噪音写进变更说明。
- 不要恢复旧 Spine 逻辑：
  - 不要重新加入 detached/offscreen Spine canvas。
  - 不要让 Spine ready 再调用通用 `handleAssetsChanged()`。
  - 不要把 tuner 的 `previewClipRect` 固化为生产裁剪矩形。
- 下一轮新增引导时，必须走 `TutorialGuideFlowRegistry` / `TutorialGuideEventRegistry`，不要在 controller 或 renderer 里继续堆 step if 分支。

## 下一步建议

1. 回来后先核对本日志对应的最新提交是否已经部署到 `origin/codex/battle-core-test-server`。
2. 在旧引导流程测试通过后，插入新的军营升级链路：
   - 点击入城。
   - 点击建筑。
   - 升级军营。
   - 生成/推进主线任务。
   - 奖励 500 士兵。
   - 引导领取奖励。
   - 打开编队。
   - 点击自动补兵。
   - 点击保存，保存后立即生效。
   - 进入派出侦查队流程。
3. 补后端任务奖励 soldier payload 与前端领取表现测试。
4. 对新增引导跑 H5 与小游戏两端的 tutorial smoke，重点看 overlay 不遮挡地图、Spine ready 不触发 world map cache invalidation。

## 早间接手基线（历史记录）

- 当前分支：`codex/battle-core-test-server`
- 当前 HEAD / origin：`29924af4`（`docs: log the encounter nameKey DTO fix in the 6月24日 dev log`）
- 服务器测试服版本接口已核对：
  - `deployedCommit=29924af44776b80131d034e5a827ee838a7c2813`
  - 前端资源版本：`?v=deploy-29924af44776`
- 本地 WSL 测试服：`http://localhost/wxgame-test-api/version` 当前无法连接，未作为本轮验证依据。
- 工作区状态：干净。

## Claude 日志现状核对

- 代码事实仍对得上：
  - `WorldCombatEncounterService.getClientEncounter()` 已透传 `nameKey`，客户端可本地化 `Frontier Patrol`。
  - 新增 `backend/tests/WorldCombatEncounterService.test.js` 覆盖全新与存量遭遇 `nameKey`。
  - 奖励文本已走 `RewardText` / 结构化 `reward.resources`。
  - `tasks/claim` 路由已有 revision conflict 重试与 409 兜底。
  - 编队默认英文名经 normalize 归一为空，前端显示本地化默认名。
  - 实体战斗（军令系统）仍未接入教程引导。
- 历史记录不应当作当前状态：
  - Claude 日志中的“最终 commit：`4ea366ab`，双端已部署”是当时收口，不是当前服务器状态；当前服务器已部署到 `29924af4`。
  - Claude 日志中的 `npm test` 通过数 `1587` 是当时数字；当前 HEAD 跑出 `1589` 通过。

## 当前验证

- `npm test`：通过，`1589` pass。
- `npm run test:architecture`：通过。
- `npm run lint`：首次尝试失败，原因是本地根目录 dev 依赖未安装，`eslint` 不存在。
- `npm ci --include=dev --ignore-scripts --no-audit --no-fund` 与 `npm ci --prefix backend --include=dev --no-audit --no-fund` 并行执行时触发 npm 自身错误：`Exit handler never called`。后续改为顺序安装。

## 本地 dev 依赖安装

- 环境：Node `v24.13.1`，npm `11.8.0`。
- 直接 `npm ci` 多次失败，debug log 显示 npm 抓 registry tarball 时连续 `getaddrinfo ENOTFOUND`，随后 npm 11 报 `Exit handler never called`。
- 处理方式：
  - 从 `package-lock.json` 提取根目录 99 个 tarball URL，用 PowerShell `Invoke-WebRequest` 下载到 `tmp/npm-tarballs/root`。
  - `npm cache add` 预热根目录 tarball 后执行 `npm ci --include=dev --ignore-scripts --no-audit --no-fund --offline`，成功。
  - 从 `backend/package-lock.json` 提取后端 156 个 tarball URL，下载到 `tmp/npm-tarballs/backend`。
  - `npm cache add` 预热后执行 `npm ci --prefix backend --include=dev --no-audit --no-fund --offline`，成功。
- 安装后可执行文件确认：
  - `node_modules/.bin/eslint.cmd` 存在。
  - `node_modules/.bin/prettier.cmd` 存在。
  - `backend/node_modules/.bin/nodemon.cmd` 存在。
- 安装后门禁：
  - `npm run lint`：通过。
  - `npm run check --prefix backend`：通过。
  - `npm run format:check`：失败，发现 7 个既有文件未格式化：
    - `backend/calculators/BuildingCostCalculator.js`
    - `backend/calculators/BuildingEffectCalculator.js`
    - `backend/domain/BuildingState.js`
    - `backend/services/TutorialService.js`
    - `frontend/js/platform/CanvasGameAppRenderScheduler.test.js`
    - `frontend/js/platform/MiniGameCanvasRenderer.js`
    - `frontend/js/ui/H5AuthStorageAdapter.js`
  - 进一步核对：这些文件不是代码排版差异，而是行尾混杂。`.gitattributes` 为 `* -text`，Git 不做换行转换；`git ls-files --eol` 显示这 7 个文件均为 `i/lf w/mixed`。Prettier API 对比结果为 `sameIgnoringEol=true`，格式化后只会把工作区混合 LF/CRLF 统一为 CRLF。
  - 未自动归一这些既有文件行尾，避免把无关 churn 混进今天开发。

## 今日待办

- 后续开发如需过完整 prod gate，需先归一上述 7 个文件的混合行尾，或确认部署环境会重新检出为一致行尾。
- 后续开发开始前，保持本日志同步记录“做了什么 / 影响什么 / 如何测试”。
