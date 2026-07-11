# 北极星 S2b 验证记录(2026-07-11)

## W1|根因定责

结论:故障属于产品侧既有 UI 运行时状态所有权冲突，不是 harness 缺少任务领取步骤，不是 B1' 奖励改键造成的编队前置不满足，也不是 B2 教程开关误伤。

### 任务领取时序

S2 受控运行 `official-run1d/2026-07-11T09-38-40-769Z/summary.json` 的动作证据为:

- 动作 31:领取 `main_first_army`。
- 动作 34:领取 `main_scout_officer`。
- 动作 43:点击 `openArmyFormation(cityId=capital, slot=1)`。

动作 43 的失败快照同时记录 `military.soldiers=1000`，并记录来源为 `tutorial` 的侦察名人 `fp_tutorial_scout_1n56oqg`。因此两个任务均已在编队打开前领取，harness 缺步假设被否定。

### 基线对比

```powershell
git diff --exit-code 92a81298..HEAD -- `
  frontend/js/platform/ArmyFormationEditorController.js `
  frontend/js/platform/CanvasActionController.js `
  frontend/js/platform/CanvasGameApp.js
```

结果:exit 0。`92a81298` 与 HEAD 的编队打开调用链逐字节一致。两版 `ArmyFormationEditorController.open()` 都不检查军队是否存在或名人是否在册，而是直接调用 `setEditor({ open: true, ... })`。因此 B1' 奖励改键没有引入编队打开前置回归。

`92a81298` 与 HEAD 也同时存在以下两套同名所有权定义:

- `CanvasGameApp.armyFormationEditor` 原型访问器读写 `ArmyFormationEditorController.editor`。
- `UiRuntimeStateStore.ensure()` 在实例上安装 `armyFormationEditor` 自有访问器，读写 `UiRuntimeStateStore` 的 `WeakMap` 状态。

实例自有访问器遮蔽原型访问器，形成两个互不联动的状态源。

### 最小复现

对真实 `CanvasGameApp` 实例调用 `openArmyFormation({ cityId: 'capital', slot: 1 })`，同时读取产品公开访问器、控制器和 `UiRuntimeStateStore`:

```text
opened=true
app.armyFormationEditor.open=false
app.getArmyFormationEditorController().editor.open=true
UiRuntimeStateStore.getFormationEditor(app).open=false
ownDescriptor=get,set,enumerable,configurable
```

`ownDescriptor` 证明实例上的 `UiRuntimeStateStore` 访问器已遮蔽 `CanvasGameApp` 原型访问器。产品渲染、教程匹配器和 harness 都读取公开访问器或 `UiRuntimeStateStore`，所以它们一致观察到 `false`；这不是 harness 读错产品真实状态，而是产品内部存在两个互相冲突的真实状态源。

### W1 自验

```powershell
git diff --check
git status --short
```

结果:`git diff --check` 通过；W1 仅新增本验证文档，用户文件 `.claude/launch.json` 保持未触碰、未暂存。

### W1 未做

- 未修复产品代码。
- 未修改 harness。
- 未重录转录基线。
- 未执行 S3 或后续路线图内容。

## W2|产品侧修复

修复侧与 W1 定责一致，仅修改产品 UI 运行时所有权和编队打开的真实分发路径，未修改 harness，未在教程模块增加游戏状态特判。

逐文件说明:

- `frontend/js/platform/ArmyFormationEditorController.js`:控制器行为统一读写 `UiRuntimeStateStore` 的 `armyFormationEditor`，删除控制器私有第二状态源。
- `frontend/js/platform/CanvasGameApp.js`:`openArmyFormation()` 在完成打开后向真实状态宿主的教程控制器发送 `onArmyFormationOpened()`；dispatcher-first 的 Shell 路径与 fallback 路径共用该生命周期入口。
- `frontend/js/platform/CanvasActionController.js`:删除已下沉到产品方法的重复教程通知。
- `frontend/js/platform/ArmyFormationEditorController.test.js`:把遗留直写断言收敛为 store 规范化语义。
- `frontend/js/platform/CanvasGameApp.test.js`:用真实 `CanvasGameShell -> CanvasActionDispatcher -> CanvasGameApp` 路径钉死公开访问器、控制器与 store 同源，并验证只触发一次编队打开通知。

定向测试:

```powershell
node --test `
  frontend/js/platform/ArmyFormationEditorController.test.js `
  frontend/js/platform/CanvasGameApp.test.js `
  frontend/js/platform/CanvasActionController.test.js `
  frontend/js/platform/CanvasActionDispatcher.test.js `
  frontend/js/state/UiRuntimeStateStore.test.js
node scripts/check-ui-runtime-field-ownership.js
```

结果:99/99 通过；所有权扫描 5 个 store、36 个字段，violations=0、warnings=0。

真实本地 harness 证据:

- 环境:隔离 SQLite、`active-release-bundle`、后端 `127.0.0.1:3211`、预览 `127.0.0.1:8181`。
- 运行目录:`%TEMP%\wxgames-s2b-w2-20260711182211\playtest-resume2\2026-07-11T10-29-20-870Z`。
- `openArmyFormation` 后从 `famousCardViewed` 推进到 `formationPanelOpened`。
- 随后完成 `toggleArmyFormationMember`、`autoReplenishArmyFormation`、`saveArmyFormation`，继续推进到 `scoutExploreStarted`。
- 15 个动作，verificationFailures=0、badResponses=0、requestFailures=0、pageErrors=0。

### W2 未做

- 未修改 `scripts/playtest-online-tutorial.js`。
- 未修改任何 `frontend/js/tutorial/*` 文件。
- 未重录转录基线。
- 未执行 S3 或后续路线图内容。

## W3|全程基线重录

### 全程修复与投影收敛

- 受控环境补齐真实 `backend/world-worker.js`，API、预览与 worker 共用隔离 SQLite；账号重置在 worker 停止时串行执行，避免 SQLite 写锁竞态。
- harness 在 `famousSeekCompleted` 检测并关闭仍占据 modal 命中面的名人面板，防止直接点击被遮挡的最终科技入口。
- 产品教程事件在寻访完成后关闭 `famousPersons` 并立即重投影 modal 层，清除旧 hit target，再刷新最终科技高亮；未增加游戏状态特判或教程命令绕过。
- transcript 生成器基于真实 `tutorialCompleted + finalStepName` 追加唯一终态项，保证最后一项 `stepKey=completed`。
- 独立排除策略文件新增 `^march-arrived-` 报告规则；实现读取该规则，排除 worker/客户端刷新竞态产生的 timing-only 记账动作。
- command-owner 清单仅按扫描器实测机械同步 7 个既有直接提交调用点的行号，inventory drift 从 14 归零；未改变命令路径或所有权。

### 双跑证据

共同环境:

- 后端:`http://127.0.0.1:3211`，`active-release-bundle`，隔离数据库。
- 前端:`http://127.0.0.1:8181`。
- worker:`backend/world-worker.js`，`WORLD_WORKER_INTERVAL_MS=1000`。
- 参数:`PLAYTEST_STRICT_VISUAL=0`、`PLAYTEST_MAX_ACTIONS=120`、`--target=local`、显式 loopback URL。

Run 1:

- 原始运行:`%TEMP%\wxgames-s2b-w2-20260711182211\w3-official-run1e\2026-07-11T11-04-14-083Z`。
- `stopReason=tutorial-completed`，`finalStepName=completed`，`tutorialCompleted=true`，61 动作，0 验证失败、0 请求失败、0 页面错误。
- 最终投影:`%TEMP%\wxgames-s2b-w2-20260711182211\w3-official-transcript-run1-final.json`。

Run 2:

- 原始运行:`%TEMP%\wxgames-s2b-w2-20260711182211\w3-official-run2\2026-07-11T11-09-30-495Z`。
- `stopReason=tutorial-completed`，`finalStepName=completed`，`tutorialCompleted=true`，62 动作，0 验证失败、0 请求失败、0 页面错误。
- 最终投影:`%TEMP%\wxgames-s2b-w2-20260711182211\w3-official-transcript-run2-final.json`。

双跑最终投影均为 64 条，最后一项为:

```json
{
  "stepKey": "completed",
  "actionType": "",
  "targetType": "",
  "panelKey": ""
}
```

SHA-256 均为 `16862F819B0EE78ACBD8C358CB964FC1307646BD122BA4BA6EC9C270E79D605F`。

```powershell
git diff --no-index --exit-code -- `
  $env:TEMP\wxgames-s2b-w2-20260711182211\w3-official-transcript-run1-final.json `
  $env:TEMP\wxgames-s2b-w2-20260711182211\w3-official-transcript-run2-final.json
```

结果:exit 0，双跑 diff 为空。

### Declared 基线重录

- 旧基线:43 条，SHA-256 `B998FFD6853765A60B7E9A10AD8C0518BAE11B14162EA442CD29792EB818CDFC`，最后一项为 `famousCardViewed/openArmyFormation`，属于前缀。
- 新基线:64 条，SHA-256 `16862F819B0EE78ACBD8C358CB964FC1307646BD122BA4BA6EC9C270E79D605F`，最后一项 `stepKey=completed`，覆盖全教程。
- 差异性质:保留既有前缀语义，新增编队打开后的选人、补兵、保存、探索、发现、占领、命名、人才、寻访、最终科技与完成终点；同时由策略排除 timing-only `march-arrived` 记账，不删除产品教程动作。
- 入库文件:`docs/architecture/artifacts/northstar-s2-tutorial-transcript.json`。

### 全量门禁

```powershell
npm test
node scripts/run-architecture-smoke.js
```

结果:

- `npm test`:297 个测试文件，2392/2392 通过，0 fail。
- architecture smoke:exit 0，最终输出 `[architecture-smoke] passed`；command-owner inventory drift=0，`git diff --check` 通过。

### 金色像素阈值评估

本单不修，移交后续视觉专项:本地 `PLAYTEST_STRICT_VISUAL=0` 下名人详情、关闭与寻访目标仍出现 gold pixel warning，但目标可见性与语义全链均通过，不影响本次判决器基线。

### W3 未做

- 未执行 S3 的 ctx 适配。
- 未改 `FlowRegistry` 结构。
- 未执行路线图 S3 及后续步骤。
- 未修改监督者署名的裁决、清查、路线图或任务单。
- 未修改、暂存或提交 `.claude/launch.json`。
