# 文明火种 - 新手闭环执行文档 v1.0

**范围**：原始时代→农耕时代（强制引导 + 建筑系统重构）
**日期**：2026-05-15
**架构原则**：单一职责 | 开闭原则 | 模块化 | 一文件一逻辑

---

## 一、现状诊断

### 当前问题
1. **建筑可重复建造** → 与"每座唯一"设计冲突
2. **server.js 神文件** → 2000+行，含路由+业务逻辑+数据库+定时器
3. **app.js 神文件** → 1500+行，含状态+渲染+API+事件+科技
4. **buildingConfig.json 与代码双轨** → 配置改了代码没改
5. **无升级概念** → 只有"建造次数"，没有"等级"
6. **无教程系统** → 新手进来直接自由操作

### 当前文件职责混乱
| 文件 | 当前职责 | 问题 |
|------|----------|------|
| `server.js` | 路由+DB+业务逻辑+定时器+初始化 | 5个职责 |
| `app.js` | 状态+渲染+API+事件+科技+建筑+人口 | 7个职责 |
| `BuildingSystem.js` | 校验+计算+建造+效果 | 4个职责 |

---

## 二、目标架构（模块化重构）

### 2.1 后端模块拆分

```
backend/
├── config/
│   └── BuildingConfig.js          # [职责1] 配置加载与暴露
│
├── domain/
│   ├── BuildingState.js           # [职责2] 建筑状态数据结构与操作
│   ├── GameResources.js           # [职责3] 资源数据结构
│   └── PopulationState.js         # [职责4] 人口数据结构
│
├── validators/
│   ├── BuildingActionValidator.js # [职责5] 建造/升级请求校验
│   └── EraValidator.js            # [职责6] 时代条件校验
│
├── calculators/
│   ├── BuildingCostCalculator.js  # [职责7] 成本计算（建造+升级）
│   ├── BuildingEffectCalculator.js # [职责8] 建筑效果计算
│   └── ResourceTickCalculator.js  # [职责9] 资源tick产出计算
│
├── services/
│   ├── BuildingActionService.js   # [职责10] 执行建造/升级动作
│   ├── BuildingUnlockService.js   # [职责11] 时代解锁判定
│   ├── TutorialService.js         # [职责12] 教程状态管理
│   └── GameStateService.js        # [职责13] 游戏状态存取
│
├── repositories/
│   └── GameStateRepository.js     # [职责14] 数据库读写
│
├── routes/
│   ├── playerRoutes.js            # [职责15] 玩家账号路由
│   ├── gameRoutes.js              # [职责16] 游戏状态与动作路由
│   └── buildingRoutes.js          # [删除] 死代码
│
├── middleware/
│   └── authMiddleware.js          # [职责17] JWT校验
│
└── server.js                      # [职责18] 仅：Express启动+模块挂载
```

**严格规则**：每个 `.js` 文件只输出**一个**类或一组**同职责**的纯函数。禁止一个文件既做HTTP又做业务逻辑。

### 2.2 前端模块拆分

```
frontend/
├── js/
│   ├── config/
│   │   └── GameConfig.js            # [职责1] 游戏常量配置
│   │
│   ├── domain/
│   │   ├── GameState.js             # [职责2] 状态对象定义
│   │   └── BuildingState.js         # [职责3] 建筑状态结构
│   │
│   ├── api/
│   │   ├── PlayerAPI.js             # [职责4] 玩家账号API
│   │   └── GameAPI.js               # [职责5] 游戏动作API
│   │
│   ├── services/
│   │   ├── GameStateSync.js         # [职责6] 状态同步服务
│   │   └── ResourceCalculator.js    # [职责7] 前端资源计算（只读）
│   │
│   ├── ui/
│   │   ├── BuildingUIRenderer.js    # [职责8] 建筑卡片渲染
│   │   ├── ResourceUIRenderer.js    # [职责9] 资源面板渲染
│   │   ├── PopulationUIRenderer.js  # [职责10] 人口面板渲染
│   │   └── TutorialUIRenderer.js   # [职责11] 教程引导渲染
│   │
│   ├── controllers/
│   │   ├── BuildingController.js   # [职责12] 建筑交互控制
│   │   ├── PopulationController.js # [职责13] 人口分配控制
│   │   └── TutorialController.js    # [职责14] 教程流程控制
│   │
│   └── utils/
│       ├── DOMHelper.js             # [职责15] DOM操作工具
│       └── AnimationHelper.js       # [职责16] 动画工具
│
├── app.js                          # [职责17] 仅：初始化+模块组装
└── index.html                      # [职责18] 仅：骨架HTML
```

---

## 三、数据模型重构

### 3.1 建筑状态（新）

```javascript
// 旧：buildings: { farm: 3, house: 2 }  → 数量制
// 新：buildings: { farm: { level: 2, builtAt: '...' }, house: null } → 等级制

const buildingStateSchema = {
  [buildingId]: {
    level: number,        // 1+ = 已建造，null/undefined = 未建造
    builtAt: string,      // ISO timestamp
    upgradedAt: string    // 最后一次升级时间
  } | null
};
```

**开局状态**：
```json
{
  "buildings": {
    "farm": null,
    "house": null,
    "workshop": null,
    "academy": null,
    "barracks": null,
    "temple": null
  }
}
```

### 3.2 建筑配置（更新）

```json
{
  "version": "2.0",
  "buildings": {
    "farm": {
      "id": "farm",
      "name": "农田",
      "icon": "🌾",
      "category": "production",
      "unlockEra": 1,
      "maxLevel": 4,
      "buildCost": { "food": 0 },
      "upgradeCosts": [
        { "food": 50 },
        { "food": 120 },
        { "food": 300 }
      ],
      "effects": {
        "perLevel": {
          "foodOutputMultiplier": 0.5
        }
      }
    },
    "house": {
      "id": "house",
      "name": "民居",
      "icon": "🏠",
      "category": "housing",
      "unlockEra": 1,
      "maxLevel": 3,
      "buildCost": { "food": 30 },
      "upgradeCosts": [
        { "food": 80 },
        { "food": 200 }
      ],
      "effects": {
        "perLevel": {
          "populationCap": 3,
          "happiness": 5
        }
      }
    }
  }
}
```

**关键设计**：
- `buildCost`：首次建造消耗（农田为0，教学免费）
- `upgradeCosts[index]`：从 level N 升到 N+1 的消耗（index = 当前等级-1）
- `unlockEra`：进时代后自动解锁（锁定态解除）

### 3.3 时代解锁映射

```javascript
const ERA_BUILDING_UNLOCKS = {
  0: [],           // 原始时代：无建筑
  1: ['farm', 'house'],  // 农耕时代
  2: ['workshop', 'academy'], // 青铜时代
  3: ['barracks'], // 古典时代
  4: ['temple']    // 中世纪
};
```

---

## 四、API 规范

### 4.1 建造（首次）

```
POST /api/game/action
Body: { "action": "build", "target": "farm" }

Response:
{
  "success": true,
  "message": "建造了农田",
  "buildingId": "farm",
  "level": 1,
  "cost": { "food": 0 },
  "gameState": { /* 完整状态 */ }
}

Errors:
- "BUILDING_ALREADY_EXISTS" - 已建造过
- "ERA_NOT_UNLOCKED" - 时代未解锁
- "INSUFFICIENT_RESOURCES" - 资源不足
- "BUILDING_NOT_FOUND" - 建筑ID无效
```

### 4.2 升级

```
POST /api/game/action
Body: { "action": "upgrade", "target": "farm" }

Response:
{
  "success": true,
  "message": "农田升至 2 级",
  "buildingId": "farm",
  "oldLevel": 1,
  "newLevel": 2,
  "cost": { "food": 50 },
  "gameState": { /* 完整状态 */ }
}

Errors:
- "BUILDING_NOT_BUILT" - 未建造
- "MAX_LEVEL_REACHED" - 已达最高级
- "INSUFFICIENT_RESOURCES" - 资源不足
```

### 4.3 游戏状态同步

```
GET /api/game/state

Response:
{
  "gameState": {
    "resources": { "food": 120, "knowledge": 5 },
    "buildings": {
      "farm": { "level": 1, "builtAt": "..." },
      "house": null
    },
    "buildingEffects": {
      "foodOutputMultiplier": 1.5,
      "populationCap": 0,
      "happinessBonus": 0
    },
    "unlockedBuildings": ["farm", "house"],
    "currentEra": 1,
    "population": { "total": 3, "max": 3, "farmers": 3, "unassigned": 0 }
  },
  "tutorial": {
    "completed": false,
    "currentStep": 5
  }
}
```

### 4.4 教程进度上报

```
POST /api/game/action
Body: { "action": "tutorialAdvance", "step": 5 }

Response: { "success": true, "tutorialStep": 5 }
```

---

## 五、教程流程设计（不可跳过）

```
Step 0 [INIT]
  状态：0建筑，3人，100食物，原始时代
  渲染：资源面板高亮
  底部导航：只有"🔥 文明"可用，其余灰色+锁图标

Step 1 [引导文明标签]
  触发：自动（2秒后）
  UI：手指动画指向"🔥 文明"
  遮罩：除目标外全黑，误触不响应
  提示气泡："点击这里，查看文明进展"

Step 2 [引导时代进阶]
  触发：玩家点击"🔥 文明"
  UI：时代面板展开，"时代进阶"按钮高亮
  提示气泡："食物足够了！进阶到农耕时代"
  按钮文本："进阶（消耗 80 🌾）"

Step 3 [执行进阶]
  触发：玩家点击"时代进阶"
  后端：扣除80食物，currentEra=1
  前端：全屏粒子动画，时代名切换
  底部导航：解锁"🏗️ 建造"

Step 4 [引导建造标签]
  触发：进阶动画结束（2秒后）
  UI：手指动画指向"🏗️ 建造"
  提示气泡："新时代解锁了建筑！"

Step 5 [引导建造农田]
  触发：玩家点击"🏗️ 建造"
  UI：建筑面板展开
  只显示 farm/house 两张卡
  farm 高亮，按钮显示"免费建造"
  house 灰色遮罩（不可点）
  提示气泡："建造第一座农田"

Step 6 [建造完成]
  触发：玩家点击"免费建造"
  后端：farm level=1，builtAt=now
  前端：建造粒子动画，飘字"农田建成！"
  资源面板食物/秒实时刷新（+50%）

Step 7 [引导完成]
  触发：自动（1秒后）
  UI：解除所有遮罩和限制
  提示气泡："引导完成！自由发展吧"
  localStorage: tutorialCompleted = true
```

**异常处理**：
- 弱网/超时：按钮 loading，5秒超时重试，3次后提示"网络不稳定"
- 强关浏览器：`localStorage` 保存 `tutorialStep`，重进恢复
- 狂点误触：遮罩层 `pointer-events: none` 屏蔽非目标区域
- 绕过前端调API：后端校验 `tutorialStep` 和 `era` 状态，非法返回403

---

## 六、产出公式（前后端统一）

```javascript
// 食物产出/秒（净）
function calculateFoodPerSecond(pop, buildings, effects, happiness) {
  const baseFoodPerFarmer = 1.0;
  const farmLevel = buildings.farm?.level || 0;
  const farmMultiplier = 1 + (farmLevel * 0.5);
  
  const foodOutput = pop.farmers * baseFoodPerFarmer * farmMultiplier;
  const foodConsumption = pop.total * 0.2;
  
  return foodOutput - foodConsumption;
}

// 知识产出/秒
function calculateKnowledgePerSecond(pop, buildings) {
  const baseKnowledgePerPerson = 0.05;
  return pop.total * baseKnowledgePerPerson; // 口耳相传，农耕时代无学院时极低
}

// 人口上限
function calculatePopulationCap(buildings) {
  const baseCap = 3;
  const houseLevel = buildings.house?.level || 0;
  return baseCap + (houseLevel * 3);
}

// 幸福度
function calculateHappiness(buildings) {
  const base = 100;
  const houseLevel = buildings.house?.level || 0;
  return base + (houseLevel * 5);
}
```

**数值验证**：
- 原始时代：3农民 × 1.0 - 0.6 = **2.4/秒** 净食物
- 进阶后剩20食物，造农田Lv1免费
- 造完后：3农民 × 1.0 × 1.5 - 0.6 = **3.9/秒**
- 造民居Lv1（30食物）：约8秒攒够
- 民居造完：人口上限 3→6，幸福度 100→105

---

## 七、文件实现清单

### 7.1 后端（新建/重写）

| 优先级 | 文件 | 动作 | 说明 |
|--------|------|------|------|
| P0 | `config/BuildingConfig.js` | 新建 | 加载 shared/buildingConfig.json，提供查询接口 |
| P0 | `domain/BuildingState.js` | 新建 | BuildingState 类：getLevel, isBuilt, build, upgrade |
| P0 | `validators/BuildingActionValidator.js` | 重写 | 校验 build/upgrade 的合法性 |
| P0 | `calculators/BuildingCostCalculator.js` | 重写 | 计算 buildCost / upgradeCost |
| P0 | `calculators/BuildingEffectCalculator.js` | 重写 | 基于等级计算效果 |
| P0 | `services/BuildingActionService.js` | 新建 | 执行建造/升级，修改 gameState |
| P0 | `services/BuildingUnlockService.js` | 新建 | 判定某建筑在当前时代是否解锁 |
| P0 | `services/TutorialService.js` | 新建 | 教程状态追踪与校验 |
| P1 | `repositories/GameStateRepository.js` | 新建 | 数据库 CRUD 封装 |
| P1 | `routes/gameRoutes.js` | 新建 | /api/game/* 路由 |
| P1 | `server.js` | 重写 | 仅 Express 初始化 + 模块挂载 |

### 7.2 前端（新建/重写）

| 优先级 | 文件 | 动作 | 说明 |
|--------|------|------|------|
| P0 | `js/config/GameConfig.js` | 新建 | 游戏常量（tick间隔、API地址等） |
| P0 | `js/domain/BuildingState.js` | 新建 | 建筑状态数据结构 |
| P0 | `js/api/GameAPI.js` | 新建 | 封装所有后端API调用 |
| P0 | `js/services/GameStateSync.js` | 新建 | 心跳同步 + 手动同步 |
| P0 | `js/ui/BuildingUIRenderer.js` | 重写 | 动态渲染建筑卡片（build/upgrade态） |
| P0 | `js/controllers/BuildingController.js` | 新建 | 绑定建造/升级按钮事件 |
| P0 | `js/controllers/TutorialController.js` | 新建 | 教程状态机 + 遮罩控制 |
| P0 | `js/utils/DOMHelper.js` | 新建 | 安全的DOM操作封装 |
| P1 | `app.js` | 重写 | 仅初始化 + 模块组装 |
| P1 | `index.html` | 修改 | 移除硬编码建筑卡片，改为JS动态生成 |

### 7.3 测试（新建）

| 文件 | 覆盖 |
|------|------|
| `tests/backend/building-action.test.js` | 建造/升级全流程 |
| `tests/backend/building-validation.test.js` | 校验规则 |
| `tests/backend/building-cost.test.js` | 成本计算 |
| `tests/backend/building-effect.test.js` | 效果计算 |
| `tests/backend/tutorial.test.js` | 教程状态机 |
| `tests/frontend/building-renderer.test.js` | UI渲染逻辑 |
| `tests/frontend/tutorial-flow.test.js` | 教程流程 |

---

## 八、开闭原则（OCP）实践

**目标**：新增时代/建筑时，不改现有代码，只新增配置。

### 示例：新增"青铜时代"

```javascript
// 只需要改配置文件，不改代码：
// shared/buildingConfig.json
{
  "workshop": {
    "unlockEra": 2,
    "buildCost": { "food": 100 },
    "upgradeCosts": [{"food": 200}, {"food": 400}]
  }
}

// 只需要改时代解锁映射（纯数据）：
// config/EraConfig.js
const ERA_BUILDING_UNLOCKS = {
  ...existing,
  2: ['workshop', 'academy'] // 新增，不改旧数据
};
```

**代码层不需要改**：
- `BuildingUnlockService` 遍历 `ERA_BUILDING_UNLOCKS`，自动识别新建筑
- `BuildingActionValidator` 读取 `buildingConfig.json`，自动识别新建筑的 costs
- `BuildingEffectCalculator` 读取 `effects.perLevel`，自动计算新效果

---

## 九、实施步骤

### Step 1：配置层（0.5天）
1. 重写 `shared/buildingConfig.json` → v2.0（等级制 + 升级成本）
2. 新建 `backend/config/BuildingConfig.js`
3. 新建 `frontend/js/config/GameConfig.js`

### Step 2：后端核心（1天）
1. 新建 `domain/BuildingState.js`
2. 重写 `calculators/BuildingCostCalculator.js`
3. 重写 `calculators/BuildingEffectCalculator.js`
4. 重写 `validators/BuildingActionValidator.js`
5. 新建 `services/BuildingActionService.js`
6. 新建 `services/BuildingUnlockService.js`

### Step 3：后端路由简化（0.5天）
1. 新建 `repositories/GameStateRepository.js`
2. 新建 `routes/gameRoutes.js`
3. 重写 `server.js` → 仅挂载模块
4. 删除死代码 `routes/buildingRoutes.js`

### Step 4：前端核心（1天）
1. 新建 `js/domain/BuildingState.js`
2. 新建 `js/api/GameAPI.js`
3. 新建 `js/services/GameStateSync.js`
4. 重写 `js/ui/BuildingUIRenderer.js` → 动态生成卡片
5. 新建 `js/controllers/BuildingController.js`

### Step 5：教程系统（1天）
1. 新建 `services/TutorialService.js`（后端）
2. 新建 `js/controllers/TutorialController.js`（前端）
3. 新建 `js/ui/TutorialUIRenderer.js`（前端）
4. 修改 `index.html` → 添加遮罩层和引导元素

### Step 6：测试（1天）
1. 后端：建筑动作、校验、成本、效果、教程
2. 前端：渲染逻辑、状态流转

### Step 7：联调部署（0.5天）
1. 本地测试完整新手闭环
2. 推送到服务器
3. 部署验证

**总计约 5.5 个工作日**

---

## 十、Git 命令（给用户）

```bash
# 拉取最新代码（含本次全部重构）
cd /你的本地项目目录
git pull origin main

# 如果需要强制覆盖本地修改
git fetch origin
git reset --hard origin/main
```

---

## 十一、检查清单（验收标准）

### 功能验收
- [ ] 0建筑开局，食物100，原始时代
- [ ] 点击"文明"→"时代进阶"→消耗80食物→进入农耕时代
- [ ] 点击"建造"→农田卡片"免费建造"→建造成功
- [ ] 建造后食物/秒显示正确（+50%）
- [ ] 民居显示"30🌾"，点击后扣除30食物
- [ ] 升级农田Lv2消耗50食物，效果+100%
- [ ] 弱网时按钮loading，超时提示友好
- [ ] 强关浏览器后重进，教程断点恢复

### 架构验收
- [ ] `server.js` < 100行（仅初始化）
- [ ] `app.js` < 100行（仅初始化）
- [ ] 每个业务模块文件 < 200行
- [ ] 无文件同时包含HTTP路由+业务逻辑
- [ ] 新增建筑只需改 `buildingConfig.json`，不改JS代码

---

**文档结束**

> 策划
