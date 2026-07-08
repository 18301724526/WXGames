# 模块流水线与可观测性标准 / Module Pipeline & Observability Standard

状态：草案 v1（2026-06-25 起草）。本文件是**强制架构标准**，不是建议。新功能必须遵守；存量功能按审计优先级整改（见末尾《全项目审计》）。

> **两半架构（2026-06-25 定）**：项目彻底解耦重构分两半——**服务端 = 本文的 ABCD 模块流水线**；**客户端 = ECS**（见 [client-ecs-architecture.md](client-ecs-architecture.md)）。两半的**规则永远只有一份**，放 `shared/`：服务端的 **C 层** 和客户端的 **System** 调用同一个纯规则模块（UMD，Node/浏览器共用）。整体路线与进度见活文档 [refactor-plan.md](refactor-plan.md)。北极星：**修任何 bug 都不需要全局搜索**。

---

## 0. 为什么有这份文件 / The problem this fixes

当前很多功能的逻辑是**糊在管道壁上**的：同一条规则（例如“海洋不可通行”）被重写在 9 个文件、两种语言里；改一条规则要动一堆文件；出 bug 时没有“每一环的输出”可看，只能临时加日志再复现。这违反两条底线：

1. **改一条规则只应改一个文件。** 但凡要改多个文件，说明这块没有独立的规则模块，架构不合格，必须重做。
2. **出问题要能从已有日志找到证据，定位到是哪一环错了。** 不允许“先加个日志再复现”。

这份标准把每个功能强制拆成**解耦的模块流水线**，并给每一环加**强制可观测性**。

---

## 1. 流水线契约 / The pipeline contract

每个功能是一条**单向、解耦、单一职责**的模块链。最少四层（可以更多），用户约定的命名是 **A 调用 B，B 引用 C，C 接收 D 的数据**：

| 层    | 名称                     | 职责                                                                                         | 绝对禁止                       |
| ----- | ------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------ |
| **D** | 数据源 / Source          | 提供原始数据：地形 oracle、DB 行、config、已知 tile 集。**纯取数，不含规则。**               | 任何业务判断                   |
| **C** | 规则 / Rules（域逻辑）   | **纯函数**做决策：输入数据 → 输出判定（verdict）。**全部规则只在这里。一个关注点一个文件。** | I/O、渲染、读全局、调用 A/B    |
| **B** | 编排 / Orchestration     | 把 C 的判定变成具体效果：建路线/任务/UI 意图。**只调用 C，自己不含一条规则。**               | 重写规则、直接取数据（应经 D） |
| **A** | 表现/派发 / Presentation | UI、按钮、命令、API 调用、提示文案。调用 B/C，渲染结果。                                     | 任何规则判断                   |

### 1.1 硬性规则

- **C 是纯函数。** 不读 `Date.now`/全局/DB/DOM；数据通过参数（D 注入）传入。这样 C 可直接单测，且**同一个 C** 能被后端（数据全知）和前端（数据残缺/fog）复用——差别只在注入的 D。
- **规则只在 C，且只有一个 C 文件承载一个关注点。** “这格能不能走”=一个 C；“这栋楼造价多少”=另一个 C。验收测试：把规则关键词 grep 全仓，**只应出现在那一个 C 文件**。
- **B/A 不含规则，只有“调用 C + 按判定行动”。** A 里最多是 `if (verdict.canMarch) 出按钮 else 显示 verdict.reason`——这是消费判定，不是规则。
- **前后端共享 C（放 `shared/`，UMD 双端可加载，见 [[shared/worldMarchCore.js]] 的加载方式），不允许各写一份。** 数据源 D 各自注入。
- **不允许把判定结果用标志位逐层抄。** 现在 `marchDisabled` 在 命中→action→handler→HUD 5 层逐层 copy，这是反例：需要判定的地方**直接调用 C**，而不是等上游把标志传下来。

### 1.2 判定对象 / Verdict shape

C 的输出是一个**结构化判定对象**，包含“结果 + 原因 + 证据”，例如通行性：

```
{ canMarch, route, stopTile, blocked: { reason, atTile } | null, hasUnknownOnRoute }
```

B/A 只读这个对象。新增一种结果（例如“需要船”）= 在 C 里加一个 reason，B/A 自动透传。

---

## 2. 可观测性契约（强制）/ Observability contract (mandatory)

> 目标：**任何一次问题或异常，都能从已有日志里看到每一环的输入/输出，直接定位到出错的环。永远不需要“再去打日志”。**

### 2.1 每一环必须发射结构化事件

每个模块在自己的边界发射**结构化** trace 事件（带关联 id、摘要后的输入/输出）：

```
trace.stage('<feature>:<layer>:<module>', {
  corr,                 // 关联 id（贯穿一次操作）
  in:  summarize(输入), // 摘要，不打整坨对象
  out: summarize(输出), // 判定/路线/渲染结果
})
```

- **D**：发射它返回了什么数据（如 `terrain {q,r,terrain}`）。
- **C**：发射 **verdict**（最关键一行：`{canMarch, reason, stopTile}`）。
- **B**：发射它构建的效果（`route {len, stopTile, source}`）。
- **A**：发射派发/渲染（`dispatch {action, corr}`）。

定位方法：读 trace → verdict 错 → 是 C（一个文件）或 D 的数据；verdict 对、界面错 → A/B。**直接到环。**

### 2.2 复用已有原语，不重造轮子

可观测性原语**已经存在**，整改是“接上它们”，不是发明新系统：

| 用途                                  | 原语                                                                                              | 位置                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 前端流水线 trace                      | `WorldMarchTrace.log/warn/error(stage, payload)`                                                  | [frontend/js/debug/WorldMarchTrace.js](../../frontend/js/debug/WorldMarchTrace.js)                                 |
| 前端操作留痕（持久、可上传）          | `ClientOperationLog.record(type, detail)`                                                         | [frontend/js/debug/ClientOperationLog.js](../../frontend/js/debug/ClientOperationLog.js)                           |
| 前端加载/性能                         | `H5LoadTrace`                                                                                     | [frontend/js/debug/H5LoadTrace.js](../../frontend/js/debug/H5LoadTrace.js)                                         |
| 后端 API 落库日志                     | `LogService.logApiRequest`                                                                        | [backend/services/logService.js](../../backend/services/logService.js)                                             |
| 后端指标/告警                         | `ObservabilityService`                                                                            | [backend/services/ObservabilityService.js](../../backend/services/ObservabilityService.js)                         |
| 后端请求内 trace（AsyncLocalStorage） | `WorldExplorerTrace.run/log`                                                                      | [backend/services/worldExplorer/WorldExplorerTrace.js](../../backend/services/worldExplorer/WorldExplorerTrace.js) |
| 关联 id / 重放对账                    | `CommandAuthorityContract` + `CommandReplayCorrelation`（requestId / clientSequence / commandId） | backend/services/realtime/                                                                                         |

> 现状：这些原语覆盖率仅约 **15–20%**（绝大多数业务逻辑零结构化日志）。这正是要补的“可观测性缺口”。新模块**必须**接入；存量按审计整改。

### 2.3 关联 id 贯穿

一次用户操作从点击 → API → 后端 → 响应必须带**同一个关联 id**（已有 `requestId` / `clientSequence` / `commandId` 机制，[CommandReplayCorrelation](../../backend/services/realtime/) 已能对账）。每一环的 trace 都要带上它，才能把一次操作的所有环串起来。

### 2.4 异常必须带上下文

`catch` 不允许裸吞或裸 `console.error(string)`。必须发射 `{ stage, corr, errorCode, error }` 到上面的 trace/observability，再决定处理或重抛。

---

## 3. 验收测试 / Acceptance tests（每个功能必须过）

1. **一处规则**：grep 规则关键词，只命中那一个 C 文件。
2. **C 纯函数**：C 有独立单测，不 mock I/O 就能跑。
3. **改规则=一个文件**：改一条规则的 diff 只动 C（除非改了判定对象的字段，那是接口变更，合理地波及调用方）。
4. **可定位**：制造一个错误，能仅凭已有 trace 指出是哪一环。
5. **双端一致**：前后端用同一个 C（`shared/`），不存在第二份规则。

---

## 4. 标杆样例：世界行军通行性 / Worked example: world-march passability

这是触发本标准的反例，也是第一个整改目标。

**现状（不合格）**：同一条“海洋挡路”规则散在约 9 处——后端 `canTraverseRouteTile`（规则+取数焊死）、后端 `buildManualRoute`（截断/空路线拒绝）、前端 `WorldMarchRoutePolicy.isRouteTerrainBlocked`（规则+取数焊死）、命中/HUD/handler 的 `marchDisabled` 五层逐层抄、以及 `GameAPI`/命令层两块补丁。没有一个可看的 verdict trace，所以只能看到最后 400，定位不到决策错在哪。

**目标（合格）**：

- **D — 地形 oracle**：`getTileTerrain(q,r) → 'ocean'|'plains'|…|'unknown'`。后端注入 seed 版（全知）；前端注入已知 tile 版（fog 返回 `'unknown'`）。
- **C — `shared/worldMarchPassability.js`（唯一规则文件）**：`evaluate({origin,target,getTileTerrain,unit}) → verdict`。海洋挡路 / 有船能过 / 撞岸截断 / fog 算未知——全在这里。纯函数、可单测。
- **B — 编排**：后端 `buildManualRoute`、前端命中目标/乐观渲染**改为只调用 C**，拿 verdict 建路线/任务/按钮意图。删掉 `GameAPI`/命令层那两块补丁。
- **A — 表现**：HUD `if(verdict.canMarch) 出按钮 else 显示 verdict.blocked.reason`。
- **可观测**：C 发 `passability:verdict {canMarch,reason,stopTile,corr}`；D 发 terrain；B 发 route；A 发 dispatch。

注意边界（如实）：**fog 里没揭示的格子，前端 D 没有数据**，C 返回 `hasUnknownOnRoute=true`、前端无法提前隐藏按钮；后端 D（seed）全知，是权威。这是数据限制不是架构缺陷——同一个 C，两个 D。

---

## 5. 全项目审计 / Project-wide audit（进行中）

整个项目按本标准**彻底审计一遍**。审计 rubric = 第 3 节验收测试 + 每个子系统标注 **CLEAN / MIXED / SMEARED** 与具体违规点（规则在几处、数据是否与规则焊死、是否有 verdict、异常是否带上下文、前后端是否各写一份）。

已知子系统清单与初判（详见审计报告 `docs/architecture/audit/`，由多代理审计产出）：

- **已较干净（shared core 模式）**：世界行军核心 `shared/worldMarchCore.js`、战斗 `shared/battleSimCore.js`、存档归一化 `GameStateNormalizer`、事件/奖励、科技树（config 驱动）。
- **重点整改（规则重复/焊死/无 verdict）**：世界行军**通行性**（本文样例）、地图 fog vision（`WorldFogVisionModel` 与后端各一份）、`BuildingState`（前后端各一份）、领土时长规则、教程解锁条件。
- **可观测性普遍缺失**：约 95% 业务逻辑零结构化日志——战斗模拟、城建动作、存档读写、渲染管线、输入路由、任务/事件系统等。

审计结论与每个子系统的整改清单见同目录 `audit/` 下的报告。
