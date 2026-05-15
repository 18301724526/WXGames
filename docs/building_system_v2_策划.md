# 文明火种 - 建筑系统策划文档 v2.0

**文档状态**：策划唯一权威来源
**生效日期**：2026-05-15
**适用范围**：建筑系统解耦与完善（科技树/事件系统暂不涉及）

---

## 一、当前问题清单（已确认）

### P0 - 阻断级（影响游戏可玩性）

| # | 问题 | 影响 | 根因 |
|---|------|------|------|
| P0-1 | 前端 `farm` 图标 🚜 vs 配置 🌾 不一致 | 玩家认知混乱 | 前端 `app.js` 硬编码未清理 |
| P0-2 | 前端 HTML 硬编码成本数值错误（farm 显示 100，配置 50） | 首次渲染/离线状态显示错误 | `index.html` 中 `farmCostFood=100` |
| P0-3 | `house` 人口上限加成后端 `+3`，前端显示 `+2` | 玩家看到的效果与实际不符 | `index.html` 文案未同步 |
| P0-4 | 开局 `buildings.farm: 0`（应为 1） | 食物产出净增长少 4.4/秒 | 后端 `getDefaultGameState` 默认值错误 |
| P0-5 | 开局 `resources.wood/stone/metal: 100`（应为 0） | MVP 开局不应有高级资源 | 后端默认值错误 |
| P0-6 | 后端 `getEraConditions` 与 `shared/buildingConfig.json` 的 `eraConditions` 完全不一致 | 时代进阶条件双源维护 | 两个文件独立演进 |

### P1 - 架构级（影响维护性）

| # | 问题 | 影响 |
|---|------|------|
| P1-1 | 前端 `app.js` 仍保留完整 `buildingConfig` 硬编码（第2-70行） | 双轨维护风险，修改配置需改两个地方 |
| P1-2 | `BuildingManager` 初始化时传入的是前端硬编码 `buildingConfig`，不是 `shared/buildingConfig.json` | 模块使用错误数据源 |
| P1-3 | `BuildingAPI.getEffects()` 仍在前端硬编码计算倍率，未调用后端 `/api/buildings/effects` | 效果计算前后端不同源 |
| P1-4 | `buildingRoutes.js` 注册了 `/api/buildings/*` 路由，但前端实际调用 `/api/game/action` | 死代码/路由冗余 |
| P1-5 | 前端 `calculateMultipliers()` 仍在本地计算建筑加成（`farmMultiplier`, `scholarMultiplier`），然后叠加后端 `buildingEffects` | 倍率叠加逻辑混乱，可能重复计算 |

### P2 - 体验级（影响玩家感受）

| # | 问题 | 期望行为 |
|---|------|----------|
| P2-1 | 建筑效果文案（`building-effect` div）是静态 HTML，未随建筑数量动态更新 | "食物产出 +50%" 应随 farm 数量从 0% → 50% → 100%... |
| P2-2 | 建造按钮无动画反馈（无 press 态、无建造成功粒子） | 点击后应有缩放动画 + 资源飘字 |
| P2-3 | 锁定建筑的 UI 态不明确（只是 disabled，没有"何时解锁"提示） | 悬停/点击应提示"青铜器时代解锁" |
| P2-4 | 建筑卡片成本显示格式不一致（`🌾 100` vs `🌾100 📚40`） | 统一为资源图标+数值并排 |

---

## 二、建筑系统架构设计

### 2.1 核心原则

1. **配置驱动唯一来源**：`shared/buildingConfig.json` 是建筑定义的唯一权威，前后端均从此读取
2. **后端绝对权威**：建造校验、成本计算、效果计算全部由后端执行
3. **前端纯展示**：前端只负责渲染、接收用户输入、调用 API、展示结果
4. **无本地回退**：建造失败不本地扣费，建造成功由后端同步状态

### 2.2 数据流图

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   玩家点击建造   │────▶│  BuildingAPI   │────▶│  POST /game/    │
│                 │     │  (前端封装)     │     │  action build   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                              ┌─────────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │ BuildingSystem  │
                    │  .build()       │
                    │  ├─ Validator   │
                    │  ├─ Calculator  │
                    │  └─ Effects     │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │ 扣除 resources   │           │ buildings[type]│
    │ 返回 {success}   │           │ +1              │
    └─────────────────┘           └─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ saveGameState() │
                    │ DB 持久化        │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ 前端 heartbeat  │
                    │ syncFromServer  │
                    │ 拉取最新状态    │
                    └─────────────────┘
```

### 2.3 模块职责边界

| 模块 | 职责 | 禁止做的事 |
|------|------|-----------|
| `BuildingValidator` | 校验时代、资源、上限 | 不修改 gameState |
| `BuildingCalculator` | 成本计算、资源扣除 | 不做解锁判定 |
| `BuildingEffects` | 产出倍率、幸福度、防御、离线加成 | 不修改 gameState |
| `BuildingSystem` | 编排建造流程、对外暴露 API | 不直接计算 |
| `BuildingAPI` (前端) | 发请求、拿 token | 不计算成本 |
| `BuildingManager` | 状态管理、准备展示数据 | 不调用 DOM |
| `BuildingRenderer` | DOM 操作、事件绑定 | 不修改状态 |

---

## 三、建筑定义（配置唯一来源）

所有建筑定义写入 `shared/buildingConfig.json`，前后端通过 `require('../../shared/buildingConfig.json')` 读取。

### 3.1 建筑清单

| ID | 名称 | 图标 | 分类 | 解锁时代 | 建造成本 | 每座效果 |
|----|------|------|------|----------|----------|----------|
| **farm** | 农田 | 🌾 | production | 原始 (0) | 食物 50 | 食物产出倍率 +0.5 |
| **house** | 民居 | 🏠 | housing | 原始 (0) | 食物 150 | 人口上限 +3，幸福度 +5 |
| **workshop** | 工坊 | ⚒️ | production | 农耕 (1) | 食物 150 + 知识 40 | 工匠产出倍率 +0.5 |
| **academy** | 学院 | 📚 | research | 原始 (0) | 食物 200 + 知识 80 | 学者产出倍率 +0.5 |
| **barracks** | 兵营 | 🛡️ | military | 青铜 (2) | 食物 250 + 知识 60 | 全产出 +10%，防御等级 +1 |
| **temple** | 神庙 | ⛪ | special | 古典 (3) | 食物 300 + 知识 100 | 离线收益效率 +5%，幸福度 +15 |

### 3.2 成本公式

```
第 N 座建筑成本 = 基础成本 × (成本倍率)^(当前数量)
```

- **成本倍率**：`1.5`（已验证，放置类游戏标准曲线）
- **示例：农田**
  - 第1座：50 × 1.5^0 = 50
  - 第2座：50 × 1.5^1 = 75
  - 第3座：50 × 1.5^2 = 112
  - 第4座：50 × 1.5^3 = 168
  - 第5座：50 × 1.5^4 = 253

- **示例：民居**
  - 第1座：150 × 1 = 150（开局自带1座，不收费）
  - 第2座：150 × 1.5 = 225
  - 第3座：150 × 2.25 = 337

### 3.3 时代解锁规则

| 时代 | 解锁建筑 |
|------|----------|
| 原始 (0) | farm, house, academy |
| 农耕 (1) | workshop |
| 青铜 (2) | barracks |
| 古典 (3) | temple |

**解锁判定**：`当前时代 >= unlockEra`。未解锁建筑在 UI 中显示为锁定态，hover/点击提示"需 XX 时代"。

### 3.4 建筑效果计算方式

所有效果采用**乘法倍率**模型，便于叠加：

```
实际食物产出 = 基础农民产出 × farm倍率 × global倍率 × 幸福度倍率 × 科技倍率
实际知识产出 = 基础学者产出 × academy倍率 × global倍率 × 幸福度倍率 × 科技倍率
```

其中建筑提供的倍率：
- `farm 倍率` = 1 + farm数量 × 0.5
- `academy 倍率` = 1 + academy数量 × 0.5
- `workshop 倍率` = 1 + workshop数量 × 0.5
- `global 倍率` = 1 + barracks数量 × 0.10
- `幸福度倍率` = 当前幸福度 / 100
- `离线效率` = 0.8 + temple数量 × 0.05

---

## 四、建筑系统交互设计

### 4.1 建筑卡片 UI 规范

```
┌─────────────────────────────┐
│  🌾  农田              ×3   │  ← 图标+名称+数量
│  每座提升食物产出           │  ← 效果描述（动态更新）
│  ─────────────────────────  │
│  🌾 112  📚 —              │  ← 下一座成本（动态）
│  ┌───────────────────────┐  │
│  │        建造           │  │  ← 按钮
│  └───────────────────────┘  │
└─────────────────────────────┘
```

**锁定态**：
```
┌─────────────────────────────┐
│  🛡️  兵营             ×0   │
│  🔒 需青铜器时代            │  ← 灰色，hover 显示解锁条件
│  ─────────────────────────  │
│  🌾 ???  📚 ???            │  ← 成本可隐藏或显示"?"
│  ┌───────────────────────┐  │
│  │      🔒 锁定         │  │  ← disabled 态
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### 4.2 建造交互流程

1. **玩家点击"建造"**
   - 前端：`BuildingAPI.build(buildingId)` → POST `/api/game/action`
   - 按钮进入 loading 态（防止重复点击）

2. **后端处理**
   - `BuildingValidator` 检查：时代解锁？资源够？未达上限？
   - `BuildingCalculator` 计算实际成本
   - `deductResources` 扣除资源
   - `buildings[id]++`
   - `saveGameState` 持久化

3. **前端反馈**
   - API 返回成功 → 按钮恢复 + 播放建造成功粒子（`showParticles`）
   - 下一个 heartbeat（5秒内）拉取最新状态 → 数量更新、成本更新
   - 如果玩家等不及，立即 `apiGet('/game/state')` 手动同步

4. **错误处理**
   - 资源不足 → `shakeCard` + log "❌ 食物不足，需要 112"
   - 未解锁 → `shakeCard` + log "❌ 需青铜器时代"
   - 网络错误 → log "❌ 网络错误，请重试"

### 4.3 效果实时展示

建筑效果需要在以下位置实时反映：

| 效果 | 展示位置 | 更新时机 |
|------|----------|----------|
| farm 加成 | 资源面板食物产出/秒 | 每次 syncFromServer |
| academy 加成 | 资源面板知识产出/秒 | 每次 syncFromServer |
| house 人口上限 | 人口面板 "3/6" | 每次 syncFromServer |
| house 幸福度 | 人口面板幸福度 | 每次 syncFromServer |
| barracks 全产出 | 所有资源产出/秒 | 每次 syncFromServer |
| temple 离线效率 | 离线收益弹窗 | 离线后登录时 |

**产出/秒显示格式**：
```
🌾 食物: 128 (+4.4/s)     ← 实际净产出（已扣消耗）
📚 知识: 12  (+0.6/s)     ← 实际净产出
```

---

## 五、前后端接口规范

### 5.1 前端 → 后端：建造请求

```
POST /api/game/action
{
  "action": "build",
  "target": "farm"
}
```

### 5.2 后端 → 前端：建造响应

```json
{
  "success": true,
  "message": "建造了 farm",
  "cost": { "food": 75 },
  "buildingType": "farm",
  "newCount": 2
}
```

失败响应：
```json
{
  "success": false,
  "message": "资源不足",
  "errors": [
    { "code": "INSUFFICIENT_RESOURCES", "message": "资源不足" }
  ]
}
```

### 5.3 后端 → 前端：游戏状态同步

```json
{
  "gameState": {
    "resources": { "food": 150, "knowledge": 30, "wood": 0 },
    "buildings": { "farm": 2, "house": 1, "workshop": 0, "academy": 0, "barracks": 0, "temple": 0 },
    "buildingCosts": {
      "farm": { "food": 112 },
      "house": { "food": 225 },
      "workshop": { "food": 225, "knowledge": 60 }
    },
    "buildingEffects": {
      "foodOutputMultiplier": 2.0,
      "knowledgeOutputMultiplier": 1.0,
      "craftsmanOutputMultiplier": 1.0,
      "globalOutputMultiplier": 1.0,
      "offlineEfficiencyBonus": 0.0,
      "happinessBonus": 5,
      "defenseLevel": 0
    },
    "population": { "total": 3, "max": 5, "farmers": 3, "scholars": 0, "craftsmen": 0, "unassigned": 0 },
    "currentEra": 0,
    "happiness": 100
  }
}
```

**关键字段说明**：
- `buildingCosts`：下一座各建筑的成本，前端直接展示
- `buildingEffects`：当前所有建筑效果汇总，前端用于计算显示产出/秒
- `buildings`：当前各建筑数量

---

## 六、修复任务清单（按优先级）

### Phase 1：数据对齐（1-2天）

- [ ] **F1-1** 修正 `shared/buildingConfig.json` 中的 `eraConditions`，与后端 `getEraConditions` 完全一致
- [ ] **F1-2** 后端 `getDefaultGameState`：`buildings.farm` 改为 `1`
- [ ] **F1-3** 后端 `getDefaultGameState`：`resources.wood/stone/metal` 改为 `0`
- [ ] **F1-4** 后端 `getDefaultGameState`：`happiness` 改为 `100`
- [ ] **F1-5** 前端 `index.html`：farm 图标改为 🌾，barracks 图标改为 🛡️，academy 图标改为 📚
- [ ] **F1-6** 前端 `index.html`：house 效果文案改为"人口上限+3，幸福度+5%"
- [ ] **F1-7** 前端 `index.html`：移除所有硬编码成本数值（改为由 JS 动态注入）

### Phase 2：前端清理（2-3天）

- [ ] **F2-1** 删除 `app.js` 中硬编码的 `buildingConfig`（第2-70行），改为 `fetch('shared/buildingConfig.json')` 加载
- [ ] **F2-2** `BuildingManager` 初始化时传入 `shared/buildingConfig.json` 内容，不是前端硬编码
- [ ] **F2-3** `BuildingAPI.getEffects()` 改为调用后端 `/api/buildings/effects`，或直接从 `/game/state` 的 `buildingEffects` 读取
- [ ] **F2-4** 前端 `calculateMultipliers()` 删除建筑相关计算，只保留科技加成和幸福度
- [ ] **F2-5** 删除 `buildingRoutes.js`，或统一前端全部调用 `/api/game/action`

### Phase 3：体验优化（3-5天）

- [ ] **F3-1** 建筑卡片效果文案动态化：`farmBonus` 显示为 "+50%"、"+100%" 随数量变化
- [ ] **F3-2** 建造按钮 press 态 + 成功粒子动画
- [ ] **F3-3** 锁定建筑 hover tooltip 显示解锁条件
- [ ] **F3-4** 建筑成本统一显示格式（支持两种资源并排）
- [ ] **F3-5** 建造成功时飘字 "-75 🌾"

### Phase 4：数值验证（持续）

- [ ] **F4-1** 建立建筑成本速查表（Excel/Markdown），验证 1-10 座成本曲线合理
- [ ] **F4-2** 验证开局 1农田+1民居+3农民的食物产出净增长 ≈ 4.4/秒（可支撑人口增长）
- [ ] **F4-3** 验证第一次时代进阶（原始→农耕）目标时长 10-15 分钟

---

## 七、建筑成本速查表

### 农田（farm）

| 座数 | 成本（食物） | 累计成本 | 食物倍率 | 备注 |
|------|------------|----------|----------|------|
| 1 | 50 | 50 | 1.5x | 开局自带，实际从第2座开始付费 |
| 2 | 75 | 125 | 2.0x | |
| 3 | 112 | 237 | 2.5x | |
| 4 | 168 | 405 | 3.0x | |
| 5 | 253 | 658 | 3.5x | |
| 6 | 379 | 1037 | 4.0x | |

### 民居（house）

| 座数 | 成本（食物） | 累计成本 | 人口上限 | 幸福度加成 |
|------|------------|----------|----------|------------|
| 1 | 0（开局送）| 0 | 4 | +5 |
| 2 | 225 | 225 | 7 | +10 |
| 3 | 337 | 562 | 10 | +15 |
| 4 | 506 | 1068 | 13 | +20 |

### 学院（academy）

| 座数 | 成本（食物+知识） | 知识倍率 |
|------|------------------|----------|
| 1 | 200 + 80 | 1.5x |
| 2 | 300 + 120 | 2.0x |
| 3 | 450 + 180 | 2.5x |

---

## 八、开局状态（v2.0 权威值）

```json
{
  "resources": {
    "food": 100,
    "knowledge": 0,
    "wood": 0,
    "stone": 0,
    "metal": 0
  },
  "buildings": {
    "farm": 1,
    "house": 1,
    "workshop": 0,
    "academy": 0,
    "barracks": 0,
    "temple": 0
  },
  "population": {
    "total": 3,
    "max": 4,
    "farmers": 3,
    "scholars": 0,
    "craftsmen": 0,
    "unassigned": 0
  },
  "happiness": 100,
  "currentEra": 0
}
```

**人口上限公式**：`maxPop = house数量 × 3 + 1`（1座民居=4人，与前端硬编码的 5 不一致，需统一）

**建议统一为**：`maxPop = house数量 × 4`（1座=4人，2座=8人，更直观）或 `maxPop = house数量 × 3 + 1`（与后端当前一致）。

---

## 九、附录

### 9.1 建筑效果汇总公式

```
食物产出/秒 = (
  farmers × foodPerFarmer × (1 + farmCount × 0.5) × globalMultiplier × happiness/100
) - (totalPop × 0.2)

知识产出/秒 = (
  scholars × knowledgePerScholar × (1 + academyCount × 0.5) × globalMultiplier × happiness/100
) + (
  craftsmen × knowledgePerCraftsman × (1 + workshopCount × 0.5) × globalMultiplier × happiness/100
)

工匠产出/秒 = craftsmen × 0.8 × (1 + workshopCount × 0.5) × globalMultiplier × happiness/100

幸福度 = 100 + houseCount × 5 + templeCount × 15 + techBonus

globalMultiplier = 1 + barracksCount × 0.10

离线效率 = 0.8 + templeCount × 0.05
防御等级 = barracksCount × 1
```

### 9.2 与人口系统的交互

- **house 增加** → `maxPop` 增加 → `unassigned` 可能增加（如果 `totalPop` 未变）
- **workshop 增加** → 解锁 craftsman 职业 → 前端显示 craftsmanCard
- **totalPop 增长** → 食物消耗增加（`totalPop × 0.2`）→ 可能影响 farm 建造优先级

### 9.3 与时代进阶的交互

- 时代进阶检查建筑数量条件时，使用 `buildings` 对象汇总
- 进入新时代后，新建筑解锁 → UI 中锁定态解除
- 建议时代进阶时播放建筑解锁动画（闪烁或粒子）

---

**文档结束**

---

> 主程实施时如有疑问，直接在此文档基础上批注讨论。不另起文档，不口头约定。
> —— 策划
