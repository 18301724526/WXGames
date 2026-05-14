# 建筑系统代码解耦架构设计文档

## 一、现状分析

### 1.1 代码分布梳理

#### 前端 `app.js` 中的建筑代码（约 180 行）

| 行号范围 | 内容 | 职责 |
|---------|------|------|
| 120-156 | `BUILDING_DEFS` + `BUILDING_EFFECTS` | 建筑定义（成本、效果、解锁条件） |
| 156-182 | 建筑面板 DOM 渲染 | UI 渲染 |
| 182-192 | `buildBuilding()` | 建造逻辑（校验、扣费、更新计数） |
| 137-156 | `updateBuildingsUI()` | 更新按钮状态、可用性检查 |
| 126-137 | `showBuildingTooltip()` | 建筑详情提示 |
| 334-338 | 建筑效果应用（食物产出、人口上限、幸福度） | 效果计算 |
| 451-452 | `saveGameState()` 中的 buildings 持久化 | 状态保存 |

#### 后端 `server.js` 中的建筑代码（约 120 行）

| 行号范围 | 内容 | 职责 |
|---------|------|------|
| ~601-612 | `BUILDING_DEFS` | 建筑成本定义和解锁时代 |
| ~613-624 | `getBuildingCost()` | 成本计算（指数增长 1.5^n） |
| ~626-628 | `getBuildingUnlockEra()` | 解锁时代查询 |
| ~630-640 | `canAfford()` / `deductResources()` | 资源检查与扣费 |
| ~392-422 | `calculateResourceOutput()` | 建筑对产出的影响 |
| ~424-447 | `calculateOfflineIncome()` | 建筑对离线收益的影响（temple +5%效率） |
| ~667-701 | API 路由 `build` | 建筑建造接口 |
| ~350-390 | `getEraConditions()` | 时代进阶的建筑要求 |
| ~793-807 | 事件效果中的 `barracks` 判定 | 兵营对事件的影响 |
| ~368-380 | `getDefaultGameState()` | 默认建筑状态 |

### 1.2 核心问题

1. **数据重复定义**：前后端各有一份 `BUILDING_DEFS`，维护成本高，容易不一致
2. **职责边界模糊**：前端也做资源校验（`buildBuilding`），后端也做，逻辑重复
3. **效果计算分散**：建筑对产出、离线收益、事件的影响散落在不同函数中
4. **紧耦合**：建筑逻辑直接嵌入 `app.js` 和 `server.js`，无法独立测试
5. **扩展性差**：新增建筑需要同时改前后端多个地方
6. **无升级机制**：当前只有建造，没有升级系统

---

## 二、解耦架构设计

### 2.1 总体原则

- **单一数据源**：建筑定义只存一处，前后端共享
- **后端主责校验**：所有规则校验、效果计算放在后端，前端只做展示
- **前端主责交互**：渲染、动画、用户反馈
- **模块化**：每个模块有明确的接口和职责

### 2.2 前后端职责划分

| 职责 | 前端 | 后端 |
|------|------|------|
| 建筑定义存储 | ❌ 引用共享配置 | ✅ 共享配置 + 数据库 |
| 建造资源校验 | ❌ 仅做预估显示 | ✅ 权威校验 |
| 建造执行 | ❌ 调用 API | ✅ 执行并持久化 |
| 效果计算（产出/离线/事件） | ❌ | ✅ 统一计算 |
| 建筑面板渲染 | ✅ | ❌ |
| 按钮状态/UI反馈 | ✅ | ❌ |
| 建筑详情提示 | ✅ | ❌ |
| 升级/维护逻辑 | ❌ 调用 API | ✅ 执行并持久化 |

### 2.3 模块拆分方案

```
wxgame/
├── shared/
│   └── buildingConfig.json          # 建筑定义单一数据源
├── frontend/
│   ├── js/
│   │   └── modules/
│   │       ├── BuildingManager.js   # 建筑管理器（状态、交互）
│   │       ├── BuildingRenderer.js  # 建筑面板渲染器
│   │       └── BuildingAPI.js       # 建筑相关 API 调用封装
│   └── app.js                       # 主入口，引用模块
├── backend/
│   ├── modules/
│   │   ├── BuildingSystem.js        # 建筑系统核心
│   │   ├── BuildingValidator.js     # 建筑校验器
│   │   ├── BuildingEffects.js       # 建筑效果计算器
│   │   └── BuildingRepository.js    # 建筑数据持久化
│   ├── routes/
│   │   └── buildingRoutes.js        # 建筑 API 路由
│   └── server.js                    # 精简后的主入口
```

---

## 三、数据结构定义

### 3.1 共享建筑配置 `shared/buildingConfig.json`

```json
{
  "version": "1.0",
  "buildings": {
    "farm": {
      "id": "farm",
      "name": "农田",
      "description": "每座提升食物产出",
      "category": "production",
      "cost": { "food": 50 },
      "costMultiplier": 1.5,
      "unlockEra": 0,
      "maxLevel": 1,
      "effects": {
        "perBuilding": {
          "foodOutputMultiplier": 0.5
        }
      },
      "ui": {
        "icon": "🌾",
        "color": "#27ae60"
      }
    },
    "house": {
      "id": "house",
      "name": "房屋",
      "description": "增加人口上限",
      "category": "housing",
      "cost": { "food": 100, "wood": 20 },
      "costMultiplier": 1.5,
      "unlockEra": 0,
      "maxLevel": 1,
      "effects": {
        "perBuilding": {
          "maxPopulation": 3
        }
      },
      "ui": {
        "icon": "🏠",
        "color": "#e67e22"
      }
    },
    "workshop": {
      "id": "workshop",
      "name": "工坊",
      "description": "每座提升工匠产出",
      "category": "production",
      "cost": { "food": 150, "knowledge": 40 },
      "costMultiplier": 1.5,
      "unlockEra": 1,
      "maxLevel": 1,
      "effects": {
        "perBuilding": {
          "craftsmanOutputMultiplier": 0.5
        }
      },
      "ui": {
        "icon": "⚒️",
        "color": "#7f8c8d"
      }
    },
    "academy": {
      "id": "academy",
      "name": "学院",
      "description": "每座提升学者产出",
      "category": "research",
      "cost": { "food": 200, "knowledge": 80 },
      "costMultiplier": 1.5,
      "unlockEra": 0,
      "maxLevel": 1,
      "effects": {
        "perBuilding": {
          "scholarOutputMultiplier": 0.5
        }
      },
      "ui": {
        "icon": "📚",
        "color": "#9b59b6"
      }
    },
    "barracks": {
      "id": "barracks",
      "name": "兵营",
      "description": "提供防御能力",
      "category": "military",
      "cost": { "food": 250, "knowledge": 60 },
      "costMultiplier": 1.5,
      "unlockEra": 2,
      "maxLevel": 1,
      "effects": {
        "perBuilding": {
          "defense": 1
        }
      },
      "ui": {
        "icon": "🛡️",
        "color": "#c0392b"
      }
    },
    "temple": {
      "id": "temple",
      "name": "神庙",
      "description": "提升幸福度和离线效率",
      "category": "special",
      "cost": { "food": 300, "knowledge": 100 },
      "costMultiplier": 1.5,
      "unlockEra": 3,
      "maxLevel": 1,
      "effects": {
        "perBuilding": {
          "happiness": 5,
          "offlineEfficiency": 0.05
        }
      },
      "ui": {
        "icon": "⛪",
        "color": "#f39c12"
      }
    }
  },
  "categories": {
    "production": { "label": "生产", "order": 1 },
    "housing": { "label": "居住", "order": 2 },
    "research": { "label": "科研", "order": 3 },
    "military": { "label": "军事", "order": 4 },
    "special": { "label": "特殊", "order": 5 }
  }
}
```

### 3.2 后端核心接口

#### `BuildingSystem.js`

```javascript
class BuildingSystem {
  constructor(buildingConfig, gameState) {
    this.config = buildingConfig;
    this.state = gameState;
  }

  /**
   * 获取建筑信息（含动态成本）
   * @param {string} buildingId 
   * @returns {BuildingInfo}
   */
  getBuildingInfo(buildingId) {
    const config = this.config.buildings[buildingId];
    const currentCount = this.state.buildings[buildingId] || 0;
    return {
      ...config,
      currentCount,
      nextCost: this.calculateCost(buildingId, currentCount),
      canBuild: this.canBuild(buildingId),
      isUnlocked: this.isUnlocked(buildingId)
    };
  }

  /**
   * 检查是否可以建造
   * @param {string} buildingId 
   * @returns {ValidationResult}
   */
  canBuild(buildingId) {
    // 检查解锁条件
    // 检查资源
    // 检查上限
  }

  /**
   * 执行建造
   * @param {string} buildingId 
   * @returns {BuildResult}
   */
  build(buildingId) {
    // 校验
    // 扣费
    // 更新计数
    // 应用即时效果
    // 返回结果
  }

  /**
   * 计算所有建筑效果
   * @returns {BuildingEffects}
   */
  calculateAllEffects() {
    // 汇总所有建筑的 perBuilding 效果
    // 返回总效果对象
  }

  /**
   * 获取时代进阶建筑条件
   * @returns {EraBuildingConditions}
   */
  getEraConditions() {
    // 返回当前建筑数量是否满足时代进阶
  }
}
```

#### `BuildingValidator.js`

```javascript
class BuildingValidator {
  static validateBuildRequest(buildingId, gameState, config) {
    const errors = [];
    
    // 1. 建筑类型存在性
    if (!config.buildings[buildingId]) {
      errors.push({ code: 'INVALID_BUILDING', message: '建筑类型不存在' });
      return { valid: false, errors };
    }

    const building = config.buildings[buildingId];
    const currentCount = gameState.buildings[buildingId] || 0;

    // 2. 时代解锁检查
    if (gameState.currentEra < building.unlockEra) {
      errors.push({ 
        code: 'ERA_LOCKED', 
        message: `需要${ERA_NAMES[building.unlockEra]}时代`,
        required: building.unlockEra,
        current: gameState.currentEra
      });
    }

    // 3. 资源检查
    const cost = BuildingCalculator.calculateCost(building, currentCount);
    const resourceCheck = ResourceValidator.check(gameState.resources, cost);
    if (!resourceCheck.sufficient) {
      errors.push({
        code: 'INSUFFICIENT_RESOURCES',
        message: '资源不足',
        details: resourceCheck.deficits
      });
    }

    // 4. 建造上限检查
    if (building.maxCount && currentCount >= building.maxCount) {
      errors.push({
        code: 'MAX_COUNT_REACHED',
        message: '已达到建造上限'
      });
    }

    return { valid: errors.length === 0, errors, cost };
  }
}
```

#### `BuildingEffects.js`

```javascript
class BuildingEffects {
  constructor(buildingConfig) {
    this.config = buildingConfig;
  }

  /**
   * 计算建筑对资源产出的总效果
   * @param {GameState} gameState 
   * @returns {OutputEffects}
   */
  calculateOutputEffects(gameState) {
    const effects = {
      foodOutputMultiplier: 1,
      knowledgeOutputMultiplier: 1,
      woodOutputMultiplier: 1,
      maxPopulationBonus: 0,
      happinessBonus: 0,
      offlineEfficiencyBonus: 0,
      defenseBonus: 0
    };

    for (const [buildingId, count] of Object.entries(gameState.buildings)) {
      if (count <= 0) continue;
      const building = this.config.buildings[buildingId];
      if (!building || !building.effects) continue;

      const perBuilding = building.effects.perBuilding || {};
      for (const [effectKey, value] of Object.entries(perBuilding)) {
        if (effects[effectKey] !== undefined) {
          effects[effectKey] += value * count;
        }
      }
    }

    return effects;
  }

  /**
   * 计算离线收益加成
   * @param {GameState} gameState 
   * @returns {number} 额外效率加成
   */
  calculateOfflineBonus(gameState) {
    return this.calculateOutputEffects(gameState).offlineEfficiencyBonus;
  }

  /**
   * 获取防御等级（用于事件判定）
   * @param {GameState} gameState 
   * @returns {number}
   */
  getDefenseLevel(gameState) {
    return this.calculateOutputEffects(gameState).defenseBonus;
  }
}
```

### 3.3 前端核心接口

#### `BuildingManager.js`（前端）

```javascript
class BuildingManager {
  constructor(apiClient, buildingConfig) {
    this.api = apiClient;
    this.config = buildingConfig;
    this.state = null; // 当前游戏状态
  }

  /**
   * 初始化建筑管理器
   * @param {GameState} gameState 
   */
  init(gameState) {
    this.state = gameState;
  }

  /**
   * 获取所有建筑的展示信息
   * @returns {BuildingDisplayInfo[]}
   */
  getAllBuildingDisplays() {
    return Object.values(this.config.buildings).map(config => {
      const currentCount = this.state.buildings[config.id] || 0;
      const cost = this.calculateDisplayCost(config, currentCount);
      const canAfford = this.checkCanAfford(cost);
      const isUnlocked = this.state.currentEra >= config.unlockEra;
      
      return {
        id: config.id,
        name: config.name,
        description: config.description,
        icon: config.ui.icon,
        color: config.ui.color,
        category: config.category,
        currentCount,
        cost,
        canAfford,
        isUnlocked,
        nextUnlockEra: config.unlockEra,
        effects: config.effects.perBuilding
      };
    });
  }

  /**
   * 发起建造请求
   * @param {string} buildingId 
   */
  async build(buildingId) {
    // 调用后端 API，不自己做校验，只负责发起请求和更新 UI
    const result = await this.api.post('/api/game/action', {
      action: 'build',
      target: buildingId
    });
    
    if (result.success) {
      this.updateLocalState(result.gameState);
      this.onBuildSuccess(buildingId, result);
    } else {
      this.onBuildFailure(result);
    }
    
    return result;
  }

  /**
   * 获取建筑提示信息
   * @param {string} buildingId 
   * @returns {TooltipInfo}
   */
  getTooltipInfo(buildingId) {
    const config = this.config.buildings[buildingId];
    const currentCount = this.state.buildings[buildingId] || 0;
    
    return {
      title: config.name,
      description: config.description,
      currentCount,
      nextCost: this.calculateDisplayCost(config, currentCount),
      totalEffects: this.calculateTotalEffects(config, currentCount),
      unlockRequirement: config.unlockEra > 0 
        ? `需要时代: ${ERA_NAMES[config.unlockEra]}` 
        : null
    };
  }

  // 私有方法
  calculateDisplayCost(config, count) {
    const multiplier = Math.pow(config.costMultiplier, count);
    const cost = {};
    for (const [resource, amount] of Object.entries(config.cost)) {
      cost[resource] = Math.floor(amount * multiplier);
    }
    return cost;
  }

  checkCanAfford(cost) {
    for (const [resource, amount] of Object.entries(cost)) {
      if ((this.state.resources[resource] || 0) < amount) return false;
    }
    return true;
  }
}
```

---

## 四、迁移步骤

### 步骤 1：创建共享配置（优先级：P0）

1. 新建 `shared/buildingConfig.json`
2. 将前后端的 `BUILDING_DEFS` 统一迁移至此
3. 后端 `server.js` 改为 `require('../shared/buildingConfig.json')`
4. 前端 `app.js` 改为加载 `shared/buildingConfig.json`（通过静态资源或 API 获取）

**风险点**：微信小程序需确保 JSON 文件可被访问。建议前端通过初始化 API 获取配置。

### 步骤 2：后端模块化（优先级：P0）

1. 新建 `backend/modules/BuildingCalculator.js`
   - 从 `server.js` 提取 `getBuildingCost()`、`canAfford()`、`deductResources()`
2. 新建 `backend/modules/BuildingValidator.js`
   - 从 `server.js` 提取建造校验逻辑
3. 新建 `backend/modules/BuildingEffects.js`
   - 从 `calculateResourceOutput()`、`calculateOfflineIncome()`、事件效果中提取建筑相关计算
4. 新建 `backend/modules/BuildingSystem.js`
   - 整合上述模块，提供统一接口
5. 新建 `backend/routes/buildingRoutes.js`
   - 从 `server.js` 提取 `build` action 路由
6. `server.js` 删除相关代码，改为 `const buildingSystem = require('./modules/BuildingSystem')`

### 步骤 3：前端模块化（优先级：P1）

1. 新建 `frontend/js/modules/BuildingAPI.js`
   - 封装建筑相关 API 调用
2. 新建 `frontend/js/modules/BuildingManager.js`
   - 从 `app.js` 提取 `buildBuilding()`、建筑状态管理
3. 新建 `frontend/js/modules/BuildingRenderer.js`
   - 从 `app.js` 提取建筑面板渲染、按钮生成、提示显示
4. `app.js` 删除相关代码，改为 `const buildingManager = new BuildingManager(...)`

### 步骤 4：统一效果计算（优先级：P1）

1. `calculateResourceOutput()` 改为使用 `BuildingEffects.calculateOutputEffects()`
2. `calculateOfflineIncome()` 改为使用 `BuildingEffects.calculateOfflineBonus()`
3. 事件效果中的 `barracks` 判定改为使用 `BuildingEffects.getDefenseLevel()`
4. 前端 `app.js` 中的建筑效果应用（行 334-338）删除，完全依赖后端计算

### 步骤 5：联调测试（优先级：P0）

1. 建造流程端到端测试
2. 建筑效果计算验证（产出、离线、事件）
3. 时代进阶建筑条件验证
4. 边界情况（资源不足、时代锁定、上限）

---

## 五、升级机制预留设计

当前建筑只有 `count`（数量），建议增加 `level`（等级）字段：

```javascript
// 建筑状态结构
gameState.buildings = {
  farm: { count: 2, level: 1 },
  house: { count: 1, level: 2 }
};

// 升级成本（基于等级）
getUpgradeCost(buildingId, currentLevel) {
  const base = config.upgradeCost || config.cost;
  const multiplier = Math.pow(2, currentLevel - 1);
  return base * multiplier;
}

// 升级效果（叠加）
// 等级 2 的 farm：食物产出加成 = perBuilding * (1 + (level-1) * 0.5)
```

---

## 六、预期收益

| 指标 | 现状 | 目标 |
|------|------|------|
| 新增建筑改动文件数 | 2-4 个 | 1 个（仅配置文件） |
| 建筑逻辑复用性 | 无 | 前后端共享配置 |
| 测试难度 | 需端到端测试 | 模块可独立单元测试 |
| 代码耦合度 | 高度耦合 | 低耦合，高内聚 |
| 后续扩展成本 | 高 | 低 |

---

*文档版本: v1.0*
*主程: K2*
*日期: 2026-01-11*
