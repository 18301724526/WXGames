# 北极星 S7-E5FIX 验证记录（2026-07-12）

## G1｜武装点精确定位

### 结论

intro `entering` 期间，教程状态已进入 `cityEntered`。Z4（`43d5ebcd`）与 E4（`3c8ee085`）的 `TutorialGuideFlowRegistry.refresh` 首个且唯一匹配规则均为 residual `house-build`；E4 删除的 14 条 StepScript 迁移规则没有覆盖 `cityEntered`，规则顺序变化没有把该时刻改投到别的规则。

真正武装点是 `house-build.render -> renderHouseGuide -> ensureHouseGuideVisible`：刷新投影函数在求高亮时同步打开 `showCityManagement`。`ModalStore.openModal` 随后同步发出 `modal.changed`，订阅者再次调用 `refreshCurrentHighlight`，形成刷新递归环。

因此 G2 第三刀应把 `house-build` 的“表面准备写操作”与“高亮投影”分治，禁止继续让 residual 规则的 render 阶段无条件写 modal；不能通过新增 intro、规则 ID 或 modal subtype 特判规避。

### 两版匹配落点对照

| 版本 | 教程步 | 首个匹配 | 全部匹配 | 落点 |
|---|---|---|---|---|
| Z4 `43d5ebcd` | `initial` | 无 | `[]` | intro 尚未完成入城，不启用民居引导 |
| Z4 `43d5ebcd` | `cityEntered` | `house-build` | `house-build` | `renderHouseGuide -> ensureHouseGuideVisible` |
| E4 `3c8ee085` | `initial` | 无 | `[]` | 与 Z4 相同 |
| E4 `3c8ee085` | `cityEntered` | `house-build` | `house-build` | 与 Z4 相同 |

### 原栈证据

证据目录：`%TEMP%\wxgames-s7-e5-intro-forensics\`。

- `f1-stack-summary.json`：`frameCount=9983`。
- 重复栈段：`refreshCurrentHighlight -> refreshLegacyHighlight -> refresh -> renderHouseGuide -> ensureHouseGuideVisible -> openBlockingPanelSnapshot -> openModalPayload -> openModal -> emit -> modal.changed subscriber -> refreshCurrentHighlight`。
- `intro-open-capital-1-after-step-0.json`：点击入城前为 `tutorial.currentStep=initial`、`tutorialIntro.step=enter`、`cityManagementOpen=false`。
- 卡死栈已进入 `renderHouseGuide`，而 `isHouseGuideActive` 只在 `[cityEntered, houseBuilt)` 为真，故同步递归发生时教程步已为 `cityEntered`。

### 可复跑命令

以下命令在两个 detached 临时 worktree 中加载各自版本的真实注册表，对相同宿主事实枚举匹配规则：

```powershell
$base = Join-Path $env:TEMP 'wxgames-s7-e5fix-g1'
git worktree add --detach (Join-Path $base 'z4') 43d5ebcd
git worktree add --detach (Join-Path $base 'e4') 3c8ee085

foreach ($name in 'z4', 'e4') {
  @'
const path = require('path');
const root = process.argv[2];
const Flow = require(path.join(root, 'frontend/js/tutorial/TutorialGuideFlowRegistry.js'));
const Shared = require(path.join(root, 'shared/tutorialFlowConfig.js'));
const steps = Shared.TUTORIAL_STEPS;
function hostFor(step) {
  return new Proxy({
    constructor: { TUTORIAL_STEPS: steps },
    getCurrentStep: () => step,
    isHouseGuideActive: () => step === steps.cityEntered,
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return () => false;
    },
  });
}
for (const step of [steps.initial, steps.cityEntered]) {
  const matches = Flow.createDefaultRules(steps)
    .filter((rule) => rule.matches(hostFor(step)))
    .map((rule) => rule.id);
  console.log(JSON.stringify({ commit: path.basename(root), step, firstMatch: matches[0] || null, allMatches: matches }));
}
  '@ | node - (Join-Path $base $name)
}
```

实跑输出：

```text
{"commit":"z4","step":"initial","firstMatch":null,"allMatches":[]}
{"commit":"z4","step":"cityEntered","firstMatch":"house-build","allMatches":["house-build"]}
{"commit":"e4","step":"initial","firstMatch":null,"allMatches":[]}
{"commit":"e4","step":"cityEntered","firstMatch":"house-build","allMatches":["house-build"]}
```

## G2｜系统性修复

### 三刀结果

1. `TutorialHostContext.refreshCurrentHighlight` 增加同步重入守卫。重入不会递归执行，而是写入 `tutorial-highlight-refresh-reentry-trace/v1` 全局账本，并通过 `TutorialHostContextTrace.log('tutorial-highlight-refresh-reentry', ...)` 对外记录；同一轮同步重入合并为至多一次尾随刷新。
2. 尾随刷新采用 microtask：当前同步通知链先完整退出，再在同一事件循环内重投影，不引入可见的定时器延迟。尾随刷新内部若再次重入，只记 trace，不再安排第二次尾随刷新，保证上界为一次。
3. `ModalStore.openModal` 与 `updateModalPayload` 改为 notify-on-change。相同 payload 且 callbacks 引用相同的二次 `openModal` 保留原 token、零状态写入、零 `modal.changed`；嵌套 payload 参与值比较。
4. 按 G1 结论完成分治：`house-build` residual 规则只投影高亮，不再调用 `ensureHouseGuideVisible`；`cityEntered` 事件效果在必要的 `advanceTo(cityEntered)` 完成后准备民居表面，再刷新纯投影。没有新增 intro、规则 ID 或 modal subtype 特判。

### 特征测试

- 原环复现：`modal.changed` 同步订阅刷新，遗留规则首次刷新时打开面板。断言 `refreshCount=2`、`maxDepth=1`、最终高亮为 `buildBuilding:house`，且 trace 为 `phase=primary`、`trailingScheduled=true`。
- notify-on-change：同一 subtype 以相同嵌套 payload 二次 `openModal`，断言 token 不变且总 emit 数仍为 `1`。
- 落点分治：断言 `cityEntered` 的顺序为 `advance -> ensureHouseGuideVisible -> refreshCurrentHighlight`；单独执行 `house-build.render` 时面板写入次数为 `0`。

专项测试：

```text
ℹ tests 17
ℹ suites 0
ℹ pass 17
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 77.4967
```

扩大影响面复跑：

```text
ℹ tests 45
ℹ suites 0
ℹ pass 45
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 484.5964
```

架构 smoke 最终复跑：

```text
ℹ tests 1719
ℹ suites 0
ℹ pass 1719
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4347.8262
[architecture-smoke] passed
```

### 生成清单核销

G2 改动只造成源码哈希、行号和 host surface 位置漂移，规则数量与契约内容不变。按各自生成器重录：

- S2 rule inventory：`flowRules=38`、`eventHandlers=18`。
- S3 host surface：`total=200`，分类计数不变。
- S4 event contracts：`events=18`。
- S5 hit-target types：`tutorialTypes=29`、`missingTypes=0`。
- command-owner `advanceTutorial` 坐标由 `TutorialHostContext.js:595` 更新为 `:639`，未处理范围外 S7b 账目。

G2 未改变教程投影内容，仅改变表面准备与投影的执行时序；不触发 §1-9 基线重录。
