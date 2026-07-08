# 客户端 ECS 架构 / Client ECS Architecture

状态：设计 v1（2026-06-25）。这是客户端的目标架构；**设计先行，按 [refactor-plan.md](refactor-plan.md) 的里程碑渐进实现**。配套强制可观测性见 [module-pipeline-and-observability-standard.md](module-pipeline-and-observability-standard.md)。

---

## 0. 为什么 ECS / Why

客户端现状：状态、规则、渲染纠缠在 presenter / renderer / domain / 一个大 state 对象里。改一个行为要全局搜索、连带改多处。ECS 把三者拆开：

- **Entity 实体** = 一个 id，什么都不是，只是“某个东西”的句柄。
- **Component 组件** = 挂在实体上的**纯数据**，无方法、无逻辑。
- **System 系统** = **唯一**承载某类逻辑的单元，查询“拥有某些组件的实体”，读组件 → 算 → 写组件。

收益（对齐北极星“修 bug 不全局搜索”）：

- 改一个行为 = 改**一个系统**。
- 查一个实体为什么这样 = 看它**有哪些组件** + **哪些系统碰它**（可枚举、可观测）。
- 渲染只读组件，不含规则；输入只产意图，不含规则。

---

## 1. 与服务端 ABCD 的桥 / Bridge to server ABCD

**规则永远只有一份，放 `shared/`。** 服务端 ABCD 的 **C 层** 和客户端的 **System** 调用**同一个纯规则模块**：

```
shared/worldMarchPassability.js (纯规则 C)
        ├── 服务端 buildManualRoute (B) 注入 seed 地形 oracle (D) → 调 evaluateMarch
        └── 客户端 PassabilitySystem 注入“已知 tile 组件”oracle (D) → 调 evaluateMarch
```

- System 不写规则，只**注入客户端数据源（D，来自组件）**并调用 `shared/` C，把 verdict 写回组件。
- 这样前后端不可能漂移：新增“船能过海”只改 `shared/worldMarchPassability` 一处，服务端 C 层和客户端 System 同时生效。

---

## 2. ECS 模型（本游戏）/ The model for this game

### 2.1 实体 Entities

世界 tile、部队/编队、行军任务、城市/建筑、战斗 actor、UI 选择、相机。每个是一个 id。

### 2.2 组件 Components（纯数据，举例）

| 组件                      | 数据                                                 |
| ------------------------- | ---------------------------------------------------- |
| `Position`                | `{ q, r }`                                           |
| `Terrain`                 | `{ type }`（ocean/plains/…/unknown）                 |
| `Fog`                     | `{ visibility, discovered }`                         |
| `Marchable`               | `{ verdict }`（PassabilitySystem 写入的 C 判定缓存） |
| `MarchOrder`              | `{ targetEntity, route, status }`                    |
| `Selectable` / `Selected` | 选择状态                                             |
| `Renderable`              | `{ layer, sprite, anchor }`（只数据，渲染系统读它）  |
| `Optimistic`              | `{ pending, corr }`（乐观状态，待服务器对账）        |

### 2.3 系统 Systems（逻辑，单一职责，举例）

| 系统                  | 查询                                                  | 行为                                                                                                 |
| --------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `InputSystem`         | 指针/点击                                             | 产出**意图**（不含规则）：选中实体、请求行军                                                         |
| `PassabilitySystem`   | `Position`+`Terrain`(+`Fog`) 与一个 `MarchOrder` 候选 | 注入“地形 oracle(来自组件)”→ 调 `shared/worldMarchPassability` → 写 `Marchable.verdict`              |
| `MarchOrderSystem`    | `Marchable`+意图                                      | verdict.canMarch→建 `MarchOrder`(乐观)+发 API；否则不发，标记不可行                                  |
| `MarchProgressSystem` | `MarchOrder`                                          | 按时间推进位置（调 `shared/worldMarchCore`）                                                         |
| `ReconcileSystem`     | `Optimistic` + 服务器响应                             | 用权威结果对账组件                                                                                   |
| `FogSystem`           | `Fog`+`Position`                                      | 揭示/可见性（调 `shared/` vision 规则）                                                              |
| `RenderSystem`        | `Renderable`+`Position`                               | **只读组件画 canvas**，零规则                                                                        |
| `HudSystem`           | `Selected`+`Marchable`                                | 按 `verdict.canMarch` 决定出不出行军按钮、按 `verdict.blocked.reason` 出提示——**读 verdict，不重判** |

> 关键：今天“`marchDisabled` 标志五层逐层抄”的反模式，在 ECS 里消失——`HudSystem` 直接读 `Marchable.verdict` 组件，没有逐层传递。

---

## 3. 强制可观测性（系统级）/ Observability per system

每个系统每 tick 发射结构化事件（复用 `WorldMarchTrace`/`ClientOperationLog`）：

```
trace('ecs:<system>:tick', { corr, in: 查询到的实体/组件摘要, out: 写了哪些组件 })
```

- `PassabilitySystem` 发 `passability:verdict`（与服务端 C 同名事件，可对照）。
- 出 bug：看 trace → 哪个系统的 out 错 → 改**那一个系统**或它调用的 `shared/` C。**不全局搜索。**

异常：系统 tick 包 try/catch，发 `{ system, corr, errorCode, error }`，不裸吞。

---

## 4. 渐进迁移 / Incremental migration（绞杀者，不大爆炸）

- **M0｜基础设施**：`EntityStore`（id→组件）、`ComponentRegistry`、`SystemScheduler`（按序跑系统）、`query(componentTypes)`、系统 trace 封装。隔离在 `frontend/js/ecs/`，不动存量。
- **M1｜首个迁移：世界行军**。把 tile/部队/任务建成实体+组件；`PassabilitySystem`/`MarchOrderSystem`/`MarchProgressSystem`/`HudSystem` 取代散落逻辑；`RenderSystem` 读 `Renderable` 画图。与旧路径并存，验证后切换。
- **M2+**：fog vision、building、territory…按 [refactor-plan.md](refactor-plan.md) §3 顺序。
- presenter/renderer 逐步变成只读组件的 `RenderSystem`。

**过渡期允许新旧并存**，但每迁移一个子系统就**彻底切干净**该子系统（不留两套逻辑），并更新 refactor-plan 进度。

---

## 5. 验收（每个 ECS 子系统）

1. 规则在 `shared/` C 一处；System 只注入数据+调 C。
2. 组件是纯数据；System 单一职责、可单测（喂组件→断言写回的组件）。
3. 渲染/HUD 只读组件，零规则。
4. 每系统有 tick trace；bug 可仅凭 trace 定位到系统。
5. 改一个行为=改一个系统（或它调的一个 C）。
