# 去壳重构进度 + 后续计划（2026-06-30 交接）

> 配套蓝图：[single-source-foundation-blueprint.md](single-source-foundation-blueprint.md)（证据版 v2，含原则/分层/范围/守卫）。本文件 = 当前进度 + 接着做什么。
> 北极星：**单一真相源 + 一个 owner + 零状态镜像 → 出 BUG 一步定位。** 形态目标 = Unity/UE 解耦：一个 store = 一个职责 = 一个文件。

---

## ✅ 已完成：loop 1 前端 ecs/ 去壳（审计出的 5 个套壳全清）

每刀都满足：实现必须全门禁绿才提交 → 独立对抗式验证（查套壳/行为漂移/被削弱测试）→ 主控再独立复跑全门禁。

| 刀    | 套壳 → 终局                                                                                                                                | 提交 SHA   | 新增/变动                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| 刀1   | `ecs/owner/FogOwner` → `ecs/projection/FogProjection`（纯函数，无 owner 对象/无 ensure-get wrapper）                                       | `e4133ca0` | + `projection/FogProjection.js`；消费者读 `.rendererContext` 直取                                                         |
| 刀4   | `ecs/system/WorldMarchOptimisticState`（POJO 冒充 ECS） → `state/optimistic/{MarchCommandBuilder,MarchPendingStore,MarchReconciler,index}` | `7c4bf1aa` | reconcile 改**纯函数返回 `{nextExplorer, storePatch}`**，调用方写 state；别名/authorityId 经 storePatch 一次性 applyPatch |
| 刀2   | `ecs/owner/BattleOwner` → `state/BattleStore`（单源：battleScene 标量 + report/session blob）                                              | `383149d2` | `deriveActiveOverlay` 纯函数；entityBattle 全程同一引用；BattleStore 已 load-wire（index.html + game.js）                 |
| 刀3+5 | `ecs/mode/ModalWorld` → `state/ModalStore`（按 subtype 单源，presence 计算不存 `open` 镜像）+ ModeState modal 真相反转                     | `597aa59f` | openModal/close 直写 `modalMask`，`collectModalKeys` 从 mask 读回；删 `__ecsModalOwner` 宿主第二源                        |

外加更早删除：死套壳 `WorldRevealStore`（`ba6934c9`）。

**结构收尾**：`ecs/owner/` 目录已彻底消失；`ecs/` 现仅剩 core/foundation(纯几何)/input/mode/projection/system(policy)/snapshot/resource。
**当前门禁**：`npm test 1720/0`、`architecture-smoke exit 0`、`eslint/prettier/diff` 全 clean。**分支已推送 = 测试服已部署此状态。**

**一处如实记录**：刀2 删除了 `check-frontend-ecs-battle-owner` 守卫（它防未来再引入 battleScene 宿主镜像）。当前树无镜像，但该未来防护暂缺 → 后续作为单源守卫重建（见下「刀9」）。

---

## ⏸ 未做（故意，需值守 + 实机验）

1. **刀6 host.state chassis / StateWriter**（最高优先 / 最高风险）
   - 现状：前端直接写 state ≈ **43 处 / 17 文件**；`canvasShell` 第三宿主已删，剩 host/lastGame 双写 + `a‖b‖c` 回退；`renderReadOnly` 函数名说"只读"实际改 `currentTab`/`militaryView`（12 处就地改）。
   - 做法（范围 A）：建 `state/StateWriter.js`（唯一写入口，含 `wholesaleReplace()` 双入口，封装宿主选择优先级）→ 收敛核心写入点 + 0.5d 清就地改；其余写入点登记后续逐步迁。
   - **为何留给值守**：引入新抽象 + 改写 43 个写入点，有测试覆盖不到的微妙路由 bug 风险，且需实机验。`CanvasGameAppTripleHostMirror.test.js` 钉死宿主优先级，迁移要保它绿。先盘清就地写再决定 `Object.freeze`。

2. **移除 bitecs 框架**（低优先，**非套壳**）：`WorldClock / ModeWorld / ModeComponents / WorldMapVisibilityModel(FogVisibility)` 是"给单例/SoA 数据套 bitecs"的小错配。迷雾可见性 → `Uint8Array` SoA 增量更新；其余单例 → plain。理由=规模撑不起框架，非"ECS 慢"。可选后续。

3. **闭环 2 后端治理**（render 无关，独立排期）
   - 刀7 **CityService legacy 双写根除**：真实爆破半径 **23 调用点 / 50+ 改动 / 9 后端+7 前端 / 43 列 INSERT 去 5 列 / ~40 处客户端 legacy 读**（远大于早期估的 ~10）。`cities[id].xxx` 设为唯一真相，删 top-level 镜像。一刀愈 resources/buildings/population/military 四域。
   - 写权封装：tutorial 被 9 个 service 写、EventService 越界改 city.resources 等 —— 多写者**单真相**（非镜像），属封装/写权治理，危害低于镜像，单独评估。
   - **保留不动**：`worldMap/territory` 的 shared_world 双存 = 合法 CQRS 发布（只派生写、无回读），**不是镜像**。

4. **刀9 红线单源守卫**：层依赖方向（跑源文件、非 bundle）/ ecs 准入 / 单写者（须抓 wholesale `X.state={...}`）/ 镜像签名 / owner 名禁用。诚实标注「零镜像不可机器全证」，配每 store 表征测试兜底。**注意**：守卫是地板不是目标——绿门禁 ≠ 健康架构。

---

## 接着做的顺序（到公司）

1. **实机验已完成的 5 刀**（测试服）：fog / modal / 各面板 / battle overlay / 行军。这是最终裁定。
2. 验过 → **值守做刀6 chassis**（建 StateWriter + 收敛写入点，保 TripleHostMirror 测试绿，实机验状态写入/页签/军事视图）。
3. 之后按需：刀9 守卫 → 闭环 2 后端（刀7 CityService）→ 可选移除 bitecs 框架。
4. 全做完再交评审团终审。

**关键纪律**：每刀独立 gate 绿 + 独立提交；tests 当 oracle；LF 行尾（Edit 写 CRLF，`sed -i 's/\r$//'` 后 `git diff --check`）；动 bundle 要 `npm run build:ecs-runtime` + LF 规范。
