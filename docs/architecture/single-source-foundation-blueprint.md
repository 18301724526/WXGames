# 客户端/服务端地基蓝图：单一真相源（证据版 v2）

> 状态：**待评审（证据版）**
> 北极星：**遇到 BUG 一步定位，绝不出现"不确定是不是这里有问题"的情况。**
> 达成手段：**每个事实有且仅有一个 owner；要用就直接读那个 owner；任何层都不得保留状态的第二份可写副本。**

---

## 0. 证据基线（4 路独立交叉验证，非推理）

普查覆盖全部源文件，对照 415 文件分解文档逐项 file:line 核验，结论四路一致：

- **实现量**：**~118,600 行生产代码**（前端 84k / 后端 30k / shared 2k），415 文件，**15 个主线功能全部真逻辑、0 vaporware**。→ "1%"是**内容/愿景的 1%，不是代码的 1%**。这是在重构一个成型 SLG，不是填空白。
- **状态域**：28 个。
- **健康 19/28（68%）**：直接改唯一 `gameState` 的 SINGLE_SERVER_AUTH（building/tech/era/events/famous/军事mutation/territory-mutation/taskCenter/talent/auth/spawn/config/worldClock/worldCombat-live…）+ 投影类。**这是正确的服务端权威，不是病，本次一行不动。**
- **真病 9/28（32%）**：4 MIRROR + 5 ECS_SHELL，**全部追溯到 6 个根因**（见 §3）。

> 双向纠偏：评审团"78% 病、全项目重写、重写 10 个后端服务"**夸大了**（68% 健康，健康核心证明"服务直改 gameState"完全 OK）；我上一版蓝图**欠覆盖（仅 21%）**、且漏判了 CityService legacy 镜像毒及核心经济。本版按证据收敛。

---

## 1. 一条铁律 + 两个区分

**铁律**：每个逻辑事实，单一 owner、单一真相源、零状态镜像。

**区分一：状态镜像（禁） vs 渲染缓存（允许且 SLG 必需）**

|                      | 状态镜像（**禁**）             | 渲染缓存（**允许**）     |
| -------------------- | ------------------------------ | ------------------------ |
| 能否脱离真相被单独写 | 能 → 会分叉 → "是这儿还是那儿" | **不能**，只能从真相重算 |
| 失效                 | 靠人手同步                     | 显式 invalidate          |
| bug 性质             | 不可定位歧义                   | 缓存陈旧 = 单点失效逻辑  |

判定：**"这东西能不能脱离真相被单独赋值?" 能=镜像砍；只能重算=缓存留。**

**区分二：模拟层 vs 应用层**

- 模拟/热点批量循环 → **数据导向结构（plain typed array / SoA）**。
- 单例/UI/会话/业务状态 → **plain store**。

---

## 2. ECS 决策：移除 bitecs 框架（理由=规模，非速度）

证据：ECS 只出现在 5 个套壳（modal/fog/battle-overlay/march-optimistic/mode）+ WorldClock，**全是单例或每帧重建**；**健康的后端核心压根没用 ECS**（纯 gameState 改）。→ ECS 在本项目**不是 load-bearing**。

- 本项目**没有**"成千上万个、组件组合动态变化、每帧跑系统调度"的负载，撑不起一个 ECS *框架*的复杂度。
- 迷雾 5000 同构瓦片 → 一个 `Uint8Array[tileIndex]`（SoA）比 bitecs 的 world/entity/query 仪式**更简单、更快**，且**增量更新**（不每帧全删全建）。
- **纠偏**：评审团"ECS 慢 191x/50x"测的是**一次性创建开销**（Clock 一辈子建一次，无关）+ **"每帧全删全建"反模式**（凶手是反模式，不是 ECS）。结论（去框架）对，但**理由要对**——否则将来真需要数据导向时会被"ECS 慢"的错信条误导。

**落点**：去掉 bitecs 框架；热点保留 plain SoA（迷雾）；其余 plain store。若未来出现真·大规模动态实体负载，再用**实测数据**重新评估，不预先上框架。

---

## 3. 范围：6 个根因 / 8 刀（32% 病的全部来源）

| 根因（机制）                       | 波及域                                | 刀         | 终局                                                                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 前端 ecs/ 套壳                     | fog                                   | 刀1        | `ecs/owner/FogOwner` → `projection/FogProjection` 纯函数；可见性用 SoA                                                                                                                                                |
| 前端 ecs/ 套壳                     | modal                                 | 刀3        | 删 ModalWorld → `state/ModalStore`（唯一真相）；渲染快照现算                                                                                                                                                          |
| 前端 ecs/ 套壳                     | battle-overlay                        | 刀2        | 删 BattleOwner → `state/BattleStore`（scalars+blob）；`deriveActiveOverlay` 纯函数；不进 ModeState                                                                                                                    |
| 前端 ecs/ 套壳                     | march-optimistic                      | 刀4        | 删 `ecs/system/WorldMarchOptimisticState` → `state/optimistic/{CommandBuilder,PendingStore,Reconciler}`；reconcile 返回 `{nextExplorer,storePatch}`，调用方写                                                         |
| 前端 ecs/ 套壳 + 每帧镜像          | mode                                  | 刀5        | ModeState 退化为纯 selector（见 §6）；`baseMode` 唯一被拥有事实进 `state/UiModeStore`                                                                                                                                 |
| **后端 CityService legacy 双写**   | **资源+建筑+人口+军事（4 域一次愈）** | 刀7        | 杀 `syncActiveCityToLegacyFields`/`persistLegacyFieldsToActiveCity`；`cities[id].xxx` 唯一真相；改 ~10 调用点 + 客户端 DTO（读 cities[] 不读 legacy）；去掉 GameStateRepository 的 legacy 列                          |
| 前端 host.state 三宿主底盘         | 整个前端 live state                   | 刀6        | 单写入点；`canvasShell` 第三宿主已删，剩 host/lastGame 双写 + `a‖b‖c` 回退 → 收敛（范围见 §7 决策）                                                                                                                   |
| tutorial advance 多处重复          | 教程横切                              | 刀8        | advance 收敛到单 owner（消除 controller.state / game.tutorial / game.state.tutorial 三处）                                                                                                                            |
| **worldMap/territory shared 双存** | 地图/领土                             | **判定项** | 若 `shared_world_territories`/`global_world_tiles` 是**单向发布**给跨玩家可见的只读投影（CQRS publish，从不被 owner 当真相回读）= **不是病，保留**；若被回读为真相 = 镜像，纳入刀7 同法治理。**先判定再决定动不动。** |
| 红线                               | —                                     | 刀9        | 删 `ecs/owner/` + 死守卫；新建准入守卫（§8）                                                                                                                                                                          |

**明确不做**：68% 健康域（building/tech/era/events/famous/tasks/auth/spawn/config/worldCombat…）**一行不动**；后端能正常工作的服务**不为风格重写**——只清 CityService 那一个真镜像。

---

## 4. 分层与依赖方向（单向，守卫可强制）

```
backend (权威真相: 唯一 gameState)
   │  快照/增量 DTO
   ▼
state/         ← 客户端单一真相源（每域一个 store，和解后状态）
   │  ingest（读 state → 建/更新 SoA）
   ▼
sim/ (SoA)     ← 热点数据导向: tiles / fog 可见性（plain typed array, 增量更新, 无框架）
   │  纯投影
   ▼
render/        ← 纯函数算快照 + 渲染缓存（无 setter，可 invalidate）
   ▲
platform/      ← 适配器/输入；只调 store 命令、只读 render 产物
```

**守卫可查的方向铁律**：`sim/` 不引 `state|platform|render`；`render/` 不写 `state`；写 `state` 只能经该 store 的具名命令；禁跨 owner 的 `a.x||b.x||c.x` 回退取值。

---

## 5. store API 模板（"打开一个文件就看懂全部"）

```js
// state/ModalStore.js —— 模态的唯一真相源
(function (global) {
  'use strict';
  const state = {
    open: {
      /* subtype -> {token, payload, callbacks} */
    },
    tokenSeq: 0,
  }; // 真相，私有
  function openModal(subtype, payload, callbacks) {
    /* 改 state，返回 token */
  } // 命令（唯一写入口）
  function closeModal(subtype) {
    /* ... */
  }
  function isOpen(subtype) {
    return Boolean(state.open[subtype]);
  } // 查询（只读，不复制）
  function getPayload(subtype) {
    return state.open[subtype]?.payload || null;
  }
  function debugView() {
    return JSON.parse(JSON.stringify(state));
  } // 调试只读现算，不落地
  const api = Object.freeze({ openModal, closeModal, isOpen, getPayload, debugView });
  global.ModalStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

内聚检查：真相在文件顶部一眼可见；写只有具名命令；读不产生第二份副本；无跨层依赖；**无 `open` 等真相字段的缓存镜像**（要"一眼看全"用只读 `debugView`，不落存）。一个 modal bug → 只看这一个文件。

---

## 6. ModeState 退化（可行性：高）

`ModeResolver.createModeSnapshot()` **本身已是纯 selector**；浪费在于每帧把它输出抄进 11 列 bitecs 组件（`deriveModeFacts→updateModeWorld`）——一份镜像。

- `baseMode`（当前顶层屏）是**唯一被真正拥有**的 mode 事实 → `state/UiModeStore`。
- 其余（modalMask/blocking/topCapture…）无独立真相 → `createModeSnapshot` 改名 `selectMode(stores)` **按需调用**。
- 删 `ecs/mode/ModeComponents`+`ModeWorld`+`deriveModeFacts→updateModeWorld` 镜像链；路由/渲染快照改调 `selectMode()`。
- **严格更省**（少写 11 列），消除"谁覆盖了这列"的歧义。

---

## 7. host.state 刀6 单写入点（范围决策）

证据：前端直接写 state ≈ **47 处 / ~17 文件**（CanvasGameAppRenderingRuntime ×9、StateSync ×4、ShellCommands ×3、CanvasGameApp ×3、CanvasCityActionHandlers ×3、GameStateManager ×2…）。`canvasShell` 第三宿主已证零读者删除；剩 host/lastGame 双写 + `a‖b‖c` 回退。

`StateWriter` 草图里 `Object.freeze(next)` **有坑**：已发现就地改 state（`WorldTileMapRenderDiagnostics.js:174-176`），冻结会抛异常——**先盘清就地写再决定冻不冻**。

**两个范围选项（评审团定）**：

- **(A) 刀6 收敛核心写入点**：建 `StateWriter`，接入 march/sync 等已建关键写入点 + host/lastGame 单源；其余写入点登记为后续逐步迁移。**不谎称"全局单一入口已达成"**。
- **(B) 全量单一入口**：把 ~17 文件全迁 StateWriter。工作量大、独立闭环。

推荐 (A)：底盘单源先立住，全量迁移作为显式后续，不阻塞其余刀。

---

## 8. 红线守卫（可执行子集 + 诚实边界）

**做成 blocking 守卫**：

1. **层依赖方向**：扫 `require()`，`sim/` 不得引 `state|platform|render`；`render/` 不得引写 store 的命令。
2. **应用状态归位**：`ecs/`（若保留）下每文件必须命中真数据导向用法，否则红；UI/应用状态必须在 `state/`。
3. **单写者**：`state/` 之外不得出现 `<StoreName>.<field> =` 直接赋值（只能调命令）。
4. **镜像签名**：禁 `\w+\.\w+\s*\|\|\s*\w+\.\w+\s*\|\|`（三宿主回退）；禁 `__\w+Snapshot\s*=` 存状态型字段；**禁 legacy 双写签名**（如 `syncActiveCityToLegacyFields` 类同字段双写）。
5. **owner 名禁用**：禁 `*Owner*` 文件名、`globalThis.Ecs\w+Owner`、`createX→ensureX→getSnapshot` 冻结 POJO 链。

**诚实边界**：通用"零镜像"不可机器全证；守卫抓**已知复发签名**（4、5），辅以**每 store 一个表征测试**钉死"真相只在我这" + ModeState 退化后断言"无模块写 mode 派生字段"。

---

## 9. SLG / 服务端权威 / 性能

- **后端权威**：服务器拥有最终真相（唯一 gameState）；客户端 = "最近服务器快照 + 本地乐观增量"的和解态。客户端"单一真相源"= 该和解态。
- **UI/单例快照**（modal/battle/mode）：每帧纯算、不缓存（个位字段，纳秒级）。
- **大地图瓦片**：SoA + 分块缓存 + 视口剔除 + 脏标记（渲染缓存，无 setter、可 invalidate，不违背零镜像）。数千瓦片不可能每帧纯重算。
- 性能热点全落在 SoA 能批量发力处；UI 层零框架开销也零性能问题。

---

## 10. 落地顺序（钉死后再写代码）

1. 评审通过本证据版 →
2. 建 `state/` + store 模板 + 红线守卫（先让守卫红，照出现状）→
3. 刀1 Fog → 刀3 Modal → 刀2 Battle → 刀5 mode 退化 → 刀4 WMO → 刀6 host.state 单源(范围 A) → 刀7 CityService legacy 根除 → 刀8 tutorial 收敛 → worldMap/territory 判定 → 刀9 守卫转绿 →
4. 全程 tests 当 oracle，每刀独立 gate 绿提交；最后一次性实机验。**68% 健康域不动。**
