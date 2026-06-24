# 彻底重构计划（活文档）/ Total Refactor Plan (living doc)

状态：进行中。**这是活文档——每完成一步就在这里更新状态**，这是“同步维护重构文档”的落点。

---

## 0. 决定 / The decision（2026-06-25，用户指令）

项目彻底解耦重构，分两半，共享同一批纯规则：

- **服务端 = ABCD 模块流水线**（见 [module-pipeline-and-observability-standard.md](module-pipeline-and-observability-standard.md)）。D=数据源、C=规则(纯函数、一处)、B=编排、A=表现。
- **客户端 = ECS**（实体-组件-系统，见 [client-ecs-architecture.md](client-ecs-architecture.md)）。实体=id、组件=纯数据、系统=逻辑。
- **两半的桥**：服务端的 **C 层规则** 和客户端的 **System** 调用**同一份** `shared/` 纯规则模块（如 [worldMarchPassability.js](../../shared/worldMarchPassability.js)）。规则**永远只有一份**，前后端、Node/浏览器共用（UMD）。
- **强制可观测**：每个 C / System / 阶段发射结构化 `in/out` trace + 关联 id。出 bug 从已有日志定位到环，**不再全局搜索、不再临时打日志**。

**北极星指标**：修任何一个 bug，**不需要全局搜索**——逻辑在一个文件，数据在组件，行为在 trace 里。

---

## 1. 为什么是这两个 / Why these two

- 现状（审计实锤）：同一条规则散在 ~9 个文件、两种语言；改一处要动一堆；出 bug 看不到中间环的输出。详见审计报告与本目录标准文档。
- ABCD 解决“规则散落 + 数据与规则焊死”（服务端）。
- ECS 解决“逻辑、数据、渲染纠缠”（客户端）：组件是纯数据，系统是单一职责逻辑，渲染只读组件。改一个行为=改一个系统；查一个实体为何这样=看它的组件 + 碰它的系统。
- 二者用 `shared/` 纯规则打通，避免前后端各写一份（漂移）。

---

## 2. 迁移策略 / Strategy：绞杀者模式（Strangler Fig），不大爆炸

逐个子系统迁移，新旧并存、验证后切换。每个子系统迁移=一条完整流水线（服务端 ABCD + 客户端 ECS 系统 + 共享 C），配测试 + trace。**绝不半成品。**

里程碑：

- **M0｜ECS 基础设施**：实体仓库、组件注册表、系统调度器、查询 API、系统 trace。隔离、不动存量。
- **M1｜首条流水线：世界行军/通行性**。服务端 ABCD（✅ 进行中），客户端先以瘦调用消费 C，待 M0 后改为 `PassabilitySystem`/`MarchSystem`。
- **M2…Mn**：按审计优先级逐子系统迁移（见 §4）。

---

## 3. 迁移顺序（来自全项目审计）/ Order from the audit

审计结论：`SMEARED`(最烂)→`MIXED`→`CLEAN`(已达标，仅补可观测)。优先整改 SMEARED + 跨端重复 + 零可观测。

| 优先   | 子系统                         | 现状                                                        | 目标                                                                                  |
| ------ | ------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **P0** | world-march **passability**    | SMEARED：规则 9 处、数据焊死、flag 五层抄、无 verdict trace | C=`shared/worldMarchPassability` 单一规则；服务端 ABCD；客户端系统消费；verdict trace |
| P1     | world-map **fog vision**       | 前后端各一份 vision 规则                                    | C=`shared/` vision 规则，双端共用                                                     |
| P1     | **BuildingState** 前后端各一份 | 重复 getLevel 等                                            | C=`shared/` 单一 building 规则                                                        |
| P1     | territory 时长/产出规则        | 后端独有、前端 UI 假设                                      | C 化 + 前端读 verdict                                                                 |
| P2     | tutorial 解锁条件              | 后端判、前端镜像                                            | C=`shared/` 解锁规则                                                                  |
| P2     | 输入路由 input→action→handler  | 链路是否散                                                  | A 层清晰管道 + 可观测                                                                 |
| P2     | 渲染管线                       | 部分可观测                                                  | ECS RenderSystem 读组件 + 计时 trace                                                  |
| 全局   | **可观测性覆盖 ~15-20%**       | ~95% 业务逻辑零结构化日志                                   | 每环/每系统强制 trace                                                                 |

（CLEAN 的：worldMarchCore、battleSimCore、GameStateNormalizer、events、tech tree——只需补可观测性，不必重构。）

---

## 4. 进度 / Status（每步更新这里）

| 项                                          | 状态                    | 证据                                                                                           |
| ------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| 架构标准文档                                | ✅ 完成                 | [module-pipeline-and-observability-standard.md](module-pipeline-and-observability-standard.md) |
| 客户端 ECS 设计文档                         | ✅ 完成（设计，未实现） | [client-ecs-architecture.md](client-ecs-architecture.md)                                       |
| 全项目审计                                  | ✅ 完成                 | 22 子系统，对抗式复核                                                                          |
| **M1 服务端：passability C 模块**           | ✅ 完成                 | [shared/worldMarchPassability.js](../../shared/worldMarchPassability.js) + 8 单测              |
| **M1 服务端：buildManualRoute→调 C**        | ✅ 完成                 | WorldExplorerRoutePlanner 改为 D 注入 + C 判定                                                 |
| **M1 前端：route policy/按钮→消费 verdict** | ✅ 完成                 | WorldMarchRoutePolicy 瘦调用 C；已知海洋→canMarch=false→隐藏按钮                                |
| **M1 部署 + 验证**                          | ✅ 完成                 | 部署 69e28734；拉取线上字节在 browser-mode VM 跑通：可见海洋→canMarch=false（按钮隐藏）         |
| M0 ECS 基础设施                             | ⬜ 待办                 | —                                                                                              |
| M1 客户端 ECS 化 passability                | ⬜ 待办（M0 后）        | —                                                                                              |
| M2+ 其余子系统                              | ⬜ 待办                 | 见 §3                                                                                          |

---

## 5. 每次重构必须满足（验收）

1. 规则只在一个 `shared/` C 文件（grep 只命中一处）。
2. C/System 纯、可单测。
3. 改一条规则=改一个文件。
4. 任一 bug 可仅凭已有 trace 定位到环/系统。
5. 前后端共用同一 C，无第二份。
6. **本文档同步更新进度。**
