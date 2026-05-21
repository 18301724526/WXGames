# 统一 Canvas 多平台核心推进计划 v0.1

## 1. 背景与目标

当前 H5 业务 UI 已基本完成去 DOM，界面主要由 Canvas 渲染承载。但代码中仍存在 H5 路径与小游戏路径的应用层分叉，例如 H5 使用 `H5CanvasAppShell`，小游戏使用 `MiniGameApp`。两者虽然共享 `CanvasGameRenderer`，但仍各自维护部分状态、点击 action 分发、同步与业务操作调用。

本计划的目标不是放弃微信/抖音小游戏，也不是只保留 H5，而是形成一套统一的 Canvas 游戏核心：

```text
统一 CanvasGameApp / ActionDispatcher / CanvasGameRenderer / UIStatePresenter / Controllers
       │
       ├── H5RuntimeAdapter
       ├── WechatRuntimeAdapter
       └── DouyinRuntimeAdapter
```

最终要求：

- H5、微信小游戏、抖音小游戏共用同一套游戏主循环、状态管理、Canvas 渲染和 action 分发。
- 平台差异只保留在薄 runtime adapter 中，例如 Canvas 创建、网络请求、存储、触摸、文本输入、登录。
- 登录当前仍属于测试阶段能力，可以临时保留平台差异，但不能导致业务 App 分裂。
- 每一步都必须拆小、可测试、可回滚，并在人工验收通过后继续下一步。

---

## 2. 总体原则

1. **小步推进**：每次只改一个清晰边界，不一次性重构全部。
2. **先测试后推送**：每完成一部分，先跑全量测试，测试通过再推送。
3. **双端推送**：推送私服部署远端，同时尽可能同步公开远端；如果某个远端失败，必须明确说明。
4. **人工验收门禁**：推送后通知测试方法，等待人工确认“通过”后再做下一阶段。
5. **不引入第二套业务逻辑**：新增平台能力必须走 runtime adapter，不允许在 H5/小游戏分别实现业务分支。
6. **文档随代码更新**：每阶段如改变架构、入口、测试口径，必须同步更新本文档或路线图。

---

## 3. 当前已知状态

### 3.1 已完成

- H5 `index.html` 已基本只保留 Canvas 宿主与脚本加载。
- 大部分业务 DOM UI 与 DOM adapter 已删除。
- `CanvasGameRenderer` 已承载主要业务 UI 渲染。
- 已存在 `H5CanvasAppShell` 与 `MiniGameApp` 两条应用路径。
- 已存在 `PlatformRuntime`，提供微信/抖音小游戏方向的 Canvas、请求、存储、触摸、键盘等抽象。

### 3.2 当前主要问题

| 问题 | 说明 | 目标 |
|------|------|------|
| 应用层分叉 | H5 用 `H5CanvasAppShell`，小游戏用 `MiniGameApp` | 合并为统一 `CanvasGameApp` |
| action 分发重复 | 两边都处理 `switchTab`、`openEvent`、`territoryAction` 等 | 抽统一 action dispatcher |
| 平台 runtime 不够统一 | H5 使用 `H5CanvasRuntime`，小游戏使用 `PlatformRuntime` | 明确统一 runtime 接口 |
| 登录仍有 H5 测试形态 | 当前账号密码登录是测试阶段能力 | 后续作为 auth adapter 保留 |
| 工作区状态需警惕 | 曾出现大量文件显示删除状态 | 每阶段开始前必须检查 `git status` |

---

## 4. 目标架构

### 4.1 核心层

```text
CanvasGameApp
  ├── 管理游戏状态 state
  ├── 管理 UI 状态 activeTab / modal / naming / logs / settings / advisor
  ├── 调用 GameAPI
  ├── 调用 Controllers
  ├── 调用 CanvasGameRenderer.render()
  └── 统一处理 renderer hit target action
```

### 4.2 Runtime 接口

统一 runtime 至少需要支持：

```text
kind: 'h5' | 'wechat' | 'douyin'
createCanvas()
getSystemInfo()
request(options)
getStorage(key)
setStorage(key, value)
removeStorage(key)
onTap(handler)
requestTextInput(options)
setInterval(callback, ms)
clearInterval(timer)
now()
log(message)
```

### 4.3 平台薄适配

| 能力 | H5 | 微信小游戏 | 抖音小游戏 |
|------|----|------------|------------|
| Canvas | DOM canvas | wx.createCanvas | tt.createCanvas |
| 请求 | fetch | wx.request | tt.request |
| 存储 | localStorage | wx storage | tt storage |
| 触摸 | pointer/touch/click | touch API | touch API |
| 文本输入 | prompt 或自绘输入 | wx.showKeyboard | tt.showKeyboard |
| 登录 | 测试账号密码 | 后续 wx.login | 后续 tt.login |

---

## 5. 分阶段推进计划

> 每个阶段完成后必须停止，等待人工验收通过后再继续下一阶段。

### 阶段 0：工作区与基线确认

**目标**：确认当前代码状态干净，建立后续改造基线。

**范围**：
- 检查 `git status`。
- 确认缺失/删除文件是否为预期。
- 跑现有全量测试。
- 不做业务代码改动。

**建议命令**：

```bash
git status --short
node --test frontend/tests/*.test.js
```

**通过标准**：
- 工作区无异常删除。
- 全量测试通过。
- 如果测试暂时无法全量跑完，必须记录失败原因并先修复基线。

**推送要求**：
- 如果没有代码变更，不推送。
- 如修复基线，测试通过后提交并推送。

**人工测试说明**：
- 打开 H5，确认首屏、登录、资源页、Tab、日志、设置、主要弹窗正常。

---

### 阶段 1：定义统一 Runtime 接口，不替换调用方

**目标**：把 H5 与小游戏所需 runtime 能力整理成统一接口，为合并 App 做准备。

**范围**：
- 新增或整理 `RuntimeAdapter` 接口说明/轻量实现。
- 不改变 `H5CanvasAppShell` 与 `MiniGameApp` 的业务行为。
- 补测试确认 H5 runtime 与小游戏 runtime 暴露相同能力名。

**不做**：
- 不合并 App。
- 不改 action 分发。
- 不改登录流程。

**通过标准**：
- H5 仍可正常运行。
- 小游戏 runtime 测试仍通过。
- 新增 runtime interface 测试通过。

**测试命令**：

```bash
node --test frontend/tests/*.test.js
```

**推送与验收**：
- 测试通过后提交、推送。
- 通知人工测试：H5 主流程不应有任何行为变化。
- 等人工确认通过，再进入阶段 2。

---

### 阶段 2：抽离共享 action 覆盖矩阵与 dispatcher 雏形

**目标**：先不大改行为，只把 H5 与小游戏 action 差异显性化。

**范围**：
- 建立 action 覆盖矩阵测试。
- 明确哪些 action 是共享、哪些是平台专属、哪些是遗漏。
- 可以新增 `CanvasActionDispatcher` 雏形，但先只接入一个低风险 action，如 `switchTab` 或纯 UI toggle。

**不做**：
- 不一次性迁移所有 action。
- 不删除 `H5CanvasAppShell.handleAction()` 或 `MiniGameApp.handleTap()`。

**通过标准**：
- action 矩阵测试可读、可维护。
- 已接入的小 action 在 H5 与小游戏测试中行为一致。
- 全量测试通过。

**人工测试说明**：
- 测 H5 Tab 切换、资源页/建筑页/事件页切换是否正常。
- 如果接入的是其他 action，则按实际 action 给出测试点。

---

### 阶段 3：逐步迁移纯 UI 状态 action

**目标**：把不涉及后端 API 的 UI action 迁入共享 dispatcher。

**候选 action**：
- `switchTab`
- `openResourceDetails` / `closeResourceDetails`
- `openCitySwitcher` / `closeCitySwitcher`
- `openSettings` / `closeSettings`
- `openLogs` / `closeLogs`
- `openAdvisor` / `closeAdvisor`
- `blockCanvasModal`
- `scrollBuildings`

**拆分规则**：
- 每次最多迁移 2-3 个相关 action。
- 每次迁移后跑全量测试、提交、推送、人工验收。

**通过标准**：
- H5 点击行为不变。
- 小游戏对应 action 如果存在，也走同一 dispatcher。
- 无重复触发、无点击穿透。

**人工测试说明示例**：
- 点击资源条打开/关闭详情。
- 点击日志打开/关闭/清空。
- 点击设置打开/关闭。
- 切换 Tab，高亮和页面内容正确。

---

### 阶段 4：迁移后端 API action

**目标**：把涉及后端请求的 action 也统一到共享业务核心。

**候选 action**：
- `buildBuilding`
- `upgradeBuilding`
- `assignJob`
- `advanceEra`
- `claimEvent`
- `scoutTerritory`
- `claimScout`
- `selectCity`
- `territoryAction`

**拆分规则**：
- 按功能域分批：人口 → 建筑 → 事件 → 军事/领土 → 城市。
- 每批只迁一个功能域。

**通过标准**：
- API 调用仍走 `GameAPI`。
- 请求 transport 由 runtime 注入。
- H5 与小游戏不分别写业务请求逻辑。
- 全量测试通过。

**人工测试说明示例**：
- 建造/升级建筑。
- 分配人口。
- 领取事件。
- 侦察/领取侦察。
- 占领/切换城市。

---

### 阶段 5：合并 `H5CanvasAppShell` 与 `MiniGameApp` 为 `CanvasGameApp`

**目标**：消除两套应用层，只保留统一核心 App。

**范围**：
- 新增 `CanvasGameApp`。
- H5 入口改为创建 H5 runtime + `CanvasGameApp`。
- 小游戏入口改为创建小游戏 runtime + `CanvasGameApp`。
- 旧 `H5CanvasAppShell` / `MiniGameApp` 可先保留薄 wrapper，确认稳定后再删。

**不做**：
- 不同时重写 renderer。
- 不同时改登录策略。

**通过标准**：
- H5 和小游戏测试都证明使用同一个 App core。
- 旧应用层不再包含业务 action 分发。
- 全量测试通过。

**人工测试说明**：
- H5 完整主流程测试。
- 小游戏开发者工具启动测试（如当时环境可用）。

---

### 阶段 6：删除旧分叉层与文档收口

**目标**：确认统一核心稳定后，删除旧重复层。

**范围**：
- 删除不再使用的 `MiniGameApp` 或 `H5CanvasAppShell` 业务实现。
- 删除过时测试。
- 更新路线图、架构文档。
- 保留必要平台 runtime adapter。

**通过标准**：
- 仓库中不存在两套业务 App。
- 文档明确：多平台共用一个 Canvas App Core。
- 全量测试通过。

**人工测试说明**：
- H5 回归测试。
- 小游戏入口静态/运行验证。

---

### 阶段 7：平台登录正式化（后置）

**目标**：在统一核心稳定后，再处理微信/抖音正式登录。

**范围**：
- H5 继续保留测试账号密码。
- 微信接 `wx.login`。
- 抖音接 `tt.login`。
- 登录差异只放在 auth adapter/runtime，不进入业务 App 分叉。

**通过标准**：
- 登录 token 获取、保存、刷新逻辑统一。
- H5/微信/抖音只在 adapter 层不同。

---

## 6. 每阶段固定交付流程

每个阶段都必须按以下流程执行：

1. 开始前确认工作区：

```bash
git status --short
```

2. 执行本阶段最小改动。
3. 跑全量测试：

```bash
node --test frontend/tests/*.test.js
```

4. 如涉及后端或版本接口，补跑后端测试。
5. 测试通过后提交。
6. 推送远端与部署。
7. 给出人工测试说明。
8. 停止，等待用户确认“通过”。
9. 用户确认后才进入下一阶段。

---

## 7. 人工测试通知模板

每次阶段完成后，通知格式固定为：

```text
已完成阶段 X：<阶段名>

提交号：<commit>
测试结果：<测试命令与通过数量>
推送状态：<私服/公开远端/部署>

本阶段改动：
1. ...
2. ...

请你人工测试：
1. ...
2. ...
3. ...

如果通过，请回复“通过”，我再继续阶段 X+1。
```

---

## 8. 回滚策略

每阶段必须保持小提交。若人工测试失败：

1. 不进入下一阶段。
2. 优先定位并小修。
3. 如修复成本过高，回滚该阶段提交。
4. 文档记录失败原因与处理方式。

---

## 9. 当前进度

### 已完成

- 阶段 0：工作区与基线确认（v0.1.27）
- 阶段 1：定义统一 Runtime 接口，不替换调用方（v0.1.28）
- 阶段 1 验收修复：领取侦查报告 action payload 修正（v0.1.29）
- 阶段 2：抽离共享 action 覆盖矩阵与 dispatcher 雏形（v0.1.30）
- 阶段 2 验收修复：军事世界沙盘放大、拖动恢复、侦查报告移入侦查页（v0.1.31）
- 阶段 2 验收修复：Canvas 接管触摸拖动、顶部资源栏压缩（v0.1.32）
- 阶段 2 验收修复：世界沙盘拖动兼容 Canvas x/y 指针坐标（v0.1.33）
- 阶段 2 验收修复：世界沙盘渲染应用 pan 偏移（v0.1.34）
- 阶段 2 验收修复：雷达圆形裁剪与 iPhone 视口比例修复（v0.1.35）
- 阶段 3 第一批：资源详情打开/关闭迁入共享 dispatcher（v0.1.36）
- 阶段 3 第二批：城市切换打开/关闭迁入共享 dispatcher（v0.1.37）
- 阶段 3 验收修复：Canvas 建筑按钮按资源是否足够禁用，避免资源不足请求触发 400（v0.1.38）

### 阶段 1 结果

- 已新增 `runtime-interface.test.js`，锁定 H5 与小游戏 runtime 的统一接口形态。
- `H5CanvasRuntime` 已补齐兼容方法：`kind`、`createCanvas()`、`getSystemInfo()`、`request()`、`getStorage()`、`setStorage()`、`removeStorage()`、`now()`、`log()`。
- `PlatformRuntime` 已补齐兼容方法：`now()`、`log()`。
- 本阶段不替换任何调用方，不改变现有 H5 或小游戏业务行为。

### 阶段 2 结果

- 已新增 `CanvasActionDispatcher.js` 作为共享 Canvas action 分发雏形。
- 已新增 `canvas-action-dispatcher.test.js`，记录 H5/小游戏 action 覆盖矩阵，并锁定阶段 2 只接管 `switchTab`。
- H5 与小游戏的 `switchTab` 已优先走共享 dispatcher；旧逻辑保留 fallback，避免一次性大改。
- 其他 action 暂不迁移，等待人工验收后再进入下一小步。

### 阶段 3 第一批结果

- `CanvasActionDispatcher` 已接管 `openResourceDetails` / `closeResourceDetails`。
- `CanvasActionDispatcher` 已接管 `openCitySwitcher` / `closeCitySwitcher`。
- H5 与小游戏均通过注入上下文处理资源详情与城市切换 UI 状态，避免各自重复实现开关逻辑。
- 已更新 action 覆盖矩阵与 dispatcher 测试，锁定前两批纯 UI action 迁移范围。
- 本批不涉及后端 API，不改变资源详情面板或城市切换面板表现。

### 下一步

等待人工验收阶段 3 第二批。通过后继续阶段 3 下一批纯 UI action：

```text
阶段 3：继续迁移纯 UI 状态 action（建议 openSettings / closeSettings）
```
