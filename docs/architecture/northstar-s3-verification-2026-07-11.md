# 北极星 S3 验证记录(2026-07-11)

## V1|宿主调用面枚举

生成命令:

```powershell
node scripts/generate-tutorial-host-surface-inventory.js
```

产物:`docs/architecture/artifacts/northstar-s3-tutorial-host-surface.json`。

- 共 393 个逐调用点:`effects=124`、`waitFor=0`、`requestAction=0`、`resolveTarget=60`、`queries=193`、`next=16`。
- 扫描范围为 `frontend/js/tutorial/` 下非测试产品脚本；扫描器追踪 `host/game/canvasShell/shell/controller/renderer` 及其别名、可选链、动态属性和带宿主实参的状态适配器调用。
- 每条记录包含 `location`、`accessShape`、`category`、`note`；不合并重复方法的逐调用点。

S2b 已知洞口强制检查:

- `TutorialGuideEventRegistry.js:205` 的 `game.famousPersonsPage = 0` 被列为 `effects/write`。
- `TutorialGuideEventRegistry.js:206` 的 `game.selectedFamousPersonId = ''` 被列为 `effects/write`。
- 同文件 `famousPersonsClosed` 分支中的对应两处直写也被列出。

人工抽查 3 条:

- `TutorialGuideEventRegistry.js:205`:清单形态为 `game.famousPersonsPage`、`effects`、`write`；源码为 `game.famousPersonsPage = 0`，一致。
- `TutorialGuideFlowRegistry.js:739`:清单形态为 `host.game.state.worldExplorerState.activeMission`、`queries`、`read`；源码在 `scout-explore-active` 匹配器读取该字段，一致。
- `TutorialGuideController.js:543`:清单形态为 `host[*dynamic*]`、`effects`、`write`；源码为 `setIfChanged` 内的 `host[key] = value`，一致。

重生成零差异:

```powershell
git add -- docs/architecture/artifacts/northstar-s3-tutorial-host-surface.json
node scripts/generate-tutorial-host-surface-inventory.js
git diff --exit-code -- docs/architecture/artifacts/northstar-s3-tutorial-host-surface.json
```

结果:exit 0，重生成 diff 为空。

定向自验:

```powershell
node --check scripts/generate-tutorial-host-surface-inventory.js
node --test scripts/generate-tutorial-host-surface-inventory.test.js
git diff --check
```

结果:3/3 通过；动态键和 S2b 直写均有独立回归断言。

## V2|ctx 适配器

实现:

- 新增 `frontend/js/tutorial/TutorialHostContext.js`，承接原 `TutorialGuideController` 的宿主实现；对外保留 `effects/waitFor/requestAction/resolveTarget/queries/next` 六个接口。
- `TutorialGuideController.js` 收敛为继承 `TutorialHostContext` 的薄外观，原公开方法、静态步骤表和构造入口保持不变。
- FlowRegistry、EventRegistry、TargetResolver、IntroOverlay 不再解引用底层 `game/canvasShell/controller/renderer`；目标解析、intro 投影和 S2b `famousPersons` 收口写入均通过 context 方法。
- `frontend/index.html` 与 `frontend/minigame/game.js` 在 Controller 前加载 context；command-owner 直提交流水账仅把同一 `advanceTutorial` 调用点从 Controller 路径机械迁到 context 路径，inventory drift=0。

逐调用点回退顺序与分歧见证:

- Controller 调用点保持 `state > game.tutorial > game.state.tutorial`；合成三源步骤分别为 `cityEntered/houseBuilt/farmBuilt` 时，`getCurrentStep()` 返回 `cityEntered`。
- EventRegistry 无结果教程态时保持 `game.tutorial > state`；同一探针返回 `houseBuilt`，没有把 Controller 的优先序强行统一过来。
- 分歧见证器 fail-open，仅累加 `{count,traces}`，不改返回值；上述合成探针 `count=2`，两条 trace 分别标记 Controller 与 EventRegistry 调用点。
- 三源为不同对象但逐值相等时，合成探针 `count=0`。

合成探针命令:

```powershell
@'
const TutorialHostContext = require('./frontend/js/tutorial/TutorialHostContext');
const state = { currentStep: 'cityEntered' };
const gameTutorial = { currentStep: 'houseBuilt' };
const context = new TutorialHostContext({
  state,
  game: { tutorial: gameTutorial, state: { tutorial: { currentStep: 'farmBuilt' } } },
  targetResolver: {},
});
TutorialHostContext.resetDivergenceWitness();
const controllerOrder = context.getCurrentStep();
context.syncFromResultPayload({ tutorial: null, gameState: { tutorial: null } });
console.log({ controllerOrder, eventOrder: context.state.currentStep,
  witness: context.getDivergenceWitness() });
'@ | node -
```

结果:`controllerOrder=cityEntered`、`eventOrder=houseBuilt`、`witness.count=2`。

宿主直访清零命令:

```powershell
rg -n "\b(game|canvasShell|controller|renderer)\s*\.|host\?*\.game|host\.game|this\.game" `
  frontend/js/tutorial -g '*.js' -g '!*.test.js' -g '!TutorialHostContext.js'
```

结果:exit 1，无命中。唯一豁免文件:`frontend/js/tutorial/TutorialHostContext.js`。

定向测试:

```powershell
node --test frontend/js/tutorial/*.test.js
node --test frontend/js/platform/GameCommandService.test.js `
  frontend/js/platform/CanvasGameApp.test.js `
  frontend/js/ui/H5GameHostSync.test.js
node --test scripts/generate-tutorial-host-surface-inventory.test.js
node scripts/report-command-owner-step1.js
```

结果:教程测试 41/41、跨模块测试 80/80、V1 扫描器测试 3/3 通过；command-owner inventory drift=0。

补充全量验证:`npm test` 297 个测试文件、2394/2394 通过。

### TutorialGuideArchitecture.test.js 改写说明

1. 原“Controller 直接拥有协调职责”断言改为“Controller 是 context 薄外观，宿主实现只在 context”，对应本任务允许收敛所有权的反特征更新。
2. 原“Controller 内旧事件方法为 handleEvent 适配”改为读取 context 文件验证，同一 20 个方法及事件名逐条保持。
3. 新增适配器外宿主直访为 0 的源码断言，豁免仅 `TutorialHostContext.js`。
4. 新增六接口存在性、Controller/EventRegistry 不同回退顺序、分歧计数与等值不计数的合成探针。
5. Registry 拥有步骤分支的原断言原样保留。

## V3|阻塞门禁

### 教程宿主边界门禁

新增 `scripts/check-tutorial-host-context-boundary.js`，语法树扫描 `frontend/js/tutorial/` 下非测试产品脚本，阻塞:

- `game.*` / `game?.*`
- `canvasShell.*` / `canvasShell?.*`
- `host.game.*` / `this.game.*`
- `host.canvasShell.*` / `this.canvasShell.*`

唯一豁免:`frontend/js/tutorial/TutorialHostContext.js`。

真实仓库:

```powershell
node scripts/check-tutorial-host-context-boundary.js
```

结果:扫描 6 个非豁免产品脚本，`violations=0`。

FIRE 探针:

```powershell
node --test --test-name-pattern="direct game and canvasShell access is blocked" `
  scripts/check-tutorial-host-context-boundary.test.js
```

探针同时放入 `game.renderCanvasSurface()`、`canvasShell.hideTutorialHighlight()`、`host.game.state.tutorial`、`host.canvasShell.tutorialHighlight`，扫描器命中 4/4；测试通过表示门禁确实 FIRE。

### UI 字段所有权动态写门禁

扩展 `scripts/check-ui-runtime-field-ownership.js`，除直接点访问和静态中括号访问外，新增以下间接写识别:

- `setIfChanged(hostExpr, 'field', value)`
- `writeIfChanged/setHostField/setRuntimeField` 同形调用
- `Reflect.set(hostExpr, 'field', value)`
- `Object.defineProperty(hostExpr, 'field', descriptor)`

历史形态 FIRE 探针:

```powershell
node --test --test-name-pattern="historical setIfChanged shape is blocked" `
  scripts/check-ui-runtime-field-ownership.test.js
```

探针复现原 `TutorialGuideController.js:541` 形态:

```js
const setIfChanged = (host, key, value) => {
  if (!host || host[key] === value) return;
  host[key] = value;
};
setIfChanged(game, 'activeTab', 'military');
setIfChanged(game.state, 'militaryView', 'world');
```

结果:`activeTab` 与 `militaryView` 两处均命中 `outside UiRuntimeStateStore`，门禁 FIRE。

真实仓库:

```powershell
node scripts/check-ui-runtime-field-ownership.js
```

结果:5 个 store、36 个字段，`violations=0`、`warnings=0`。

显式白名单与烧毁计划:

- 白名单仅新增 `frontend/js/tutorial/TutorialHostContext.js` 到 `UiRuntimeStateStore` 兼容文件；`TutorialRuntimeStore` 兼容白名单已在 V2 从三个旧教程文件收敛为同一 context 文件。
- 理由:V2 保留旧调用点的镜像写和回退语义，所有兼容访问已集中到唯一适配器。
- 烧毁计划:路线图 S9c 旧引擎退役时，随 context 内镜像字段写入一起删除该白名单；本任务不提前改变镜像语义。

烟测接入:

- 两个新脚本及测试已加入 `scripts/run-architecture-smoke.js` 的语法检查、合同测试和阻塞执行段。
- `node scripts/run-architecture-smoke.js`:exit 0，最终输出 `[architecture-smoke] passed`。

## V4|零行为验证

### 见证器强制读证

- `TutorialHostContext` 在 `TUTORIAL_WITNESS_ASSERT_ZERO=1` 时安装测试进程退出门；非 0 会打印 count 与前 10 条 trace 并令进程失败。
- `scripts/playtest-online-tutorial.js` 把页面内 `tutorialHostContextWitness` 写入 summary；`PLAYTEST_ASSERT_TUTORIAL_WITNESS_ZERO=1` 时非 0 直接判 playtest 失败。

前置探针曾发现一次非产品分歧，未掩盖:

- 首次强制执行 `npm test` 时，`TutorialGuideController.test.js` 报 `witness=164`。
- trace 全部指向同一测试夹具:夹具直接调用 `onManualTalentAssigned/onFamousPersonSought`，但没有像真实产品 `applyApiState` 路径一样同步 `game.state.tutorial`，因此后续重复读取持续观察到陈旧镜像。
- 修正仅让测试夹具在发事件前同步同一结果对象到 `game.state.tutorial`；未修改产品读取顺序、同步实现或返回值。
- 修正后该测试 18/18 通过且退出见证为 0；随后正式全测试与两次真实 playtest 均为 0。该前置失败定性为测试环境未复现产品同步前提，不构成产品行为差异。

### 受控环境

- 临时根目录:`%TEMP%\wxgames-s3-v4-20260711-ctx`。
- 后端:`http://127.0.0.1:3211`，隔离 SQLite。
- 前端:`http://127.0.0.1:8181`，API 代理到隔离后端。
- worker:`backend/world-worker.js`，`WORLD_WORKER_INTERVAL_MS=1000`。
- 配置发布:`20260711T120313328Z-212257e0a698-4ee915f0`；健康检查 `gameplay.source=active-release-bundle`、`bundleReady=true`、任务定义可用。
- 共同参数:`PLAYTEST_STRICT_VISUAL=0`、`PLAYTEST_MAX_ACTIONS=120`、`PLAYTEST_ASSERT_TUTORIAL_WITNESS_ZERO=1`、`--target=local`。

### 双跑结果

Run 1:

- runId:`2026-07-11T12-04-15-573Z`。
- `stopReason=tutorial-completed`、`finalStepName=completed`、62 动作、64 条投影。
- 0 verification failure、0 bad response、0 request failure、0 page error。
- `tutorialHostContextWitness.count=0`。

Run 2:

- runId:`2026-07-11T12-07-51-273Z`。
- `stopReason=tutorial-completed`、`finalStepName=completed`、62 动作、64 条投影。
- 0 verification failure、0 bad response、0 request failure、0 page error。
- `tutorialHostContextWitness.count=0`。

三份投影 SHA-256 完全一致:

```text
16862F819B0EE78ACBD8C358CB964FC1307646BD122BA4BA6EC9C270E79D605F
```

对应文件:

- 仓库基线:`docs/architecture/artifacts/northstar-s2-tutorial-transcript.json`
- Run 1:`%TEMP%\wxgames-s3-v4-20260711-ctx\transcript-run1.json`
- Run 2:`%TEMP%\wxgames-s3-v4-20260711-ctx\transcript-run2.json`

逐字节比较:

```powershell
git diff --no-index --exit-code -- `
  docs/architecture/artifacts/northstar-s2-tutorial-transcript.json `
  $env:TEMP\wxgames-s3-v4-20260711-ctx\transcript-run1.json
git diff --no-index --exit-code -- `
  docs/architecture/artifacts/northstar-s2-tutorial-transcript.json `
  $env:TEMP\wxgames-s3-v4-20260711-ctx\transcript-run2.json
git diff --no-index --exit-code -- `
  $env:TEMP\wxgames-s3-v4-20260711-ctx\transcript-run1.json `
  $env:TEMP\wxgames-s3-v4-20260711-ctx\transcript-run2.json
```

结果:三条命令均 exit 0，逐字节 diff 为空；仓库 64 条基线未重录、未修改。

本地仍复现 S2b 已申报的金色像素 warning；`PLAYTEST_STRICT_VISUAL=0` 下不影响目标可见性、语义链、投影或见证判决，本任务未调整视觉阈值。

### 全量门禁

```powershell
$env:TUTORIAL_WITNESS_ASSERT_ZERO='1'
npm test
node scripts/run-architecture-smoke.js
```

结果:

- `npm test`:297 个测试文件，2394/2394 通过，0 fail；见证退出门通过，即全测试最终 `witness=0`。
- architecture smoke:exit 0，最终输出 `[architecture-smoke] passed`；烟测子测试同样继承见证退出门。
- command-owner inventory drift=0；`git diff --check` 通过。
- 教程测试清单已重生成，仍为 143 条:`可复用=95`、`退役候选=47`、`反特征=1`。

### 行为判决

投影与 64 条基线逐字节 diff 为空，双跑和最终全测试 witness 均为 0。因此 V4 判决为**零行为变更**，不触发 §1-9 基线重录或 L2 行为变更流程。

### 未做

- 未重录或修改 S2/S2b 64 条转录基线。
- 未建立事件总线(S4)。
- 未修改 target/action/query 映射表(S5)。
- 未迁移任何教程规则(S7)。
- 未删除任何 hook。
- 未修改冻结三件套。
- 未修改监督者署名的裁决、清查、路线图或任务单。
- 未修改、暂存或提交 `.claude/launch.json` 与新出现的 `AGENTS.md`。
