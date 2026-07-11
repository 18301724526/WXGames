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
