const express = require('express');
const cors = require('cors');
const sqlite3 = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const AuthService = require('./services/authService');
const LogService = require('./services/logService');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'civilization-fire-secret-key-2026';

// 数据库
const db = new sqlite3('/opt/wxgame-workspace/backend/civilization.db');

// 初始化表
function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      playerId TEXT PRIMARY KEY,
      deviceId TEXT UNIQUE,
      token TEXT,
      createdAt TEXT,
      lastActiveAt TEXT
    );
    CREATE TABLE IF NOT EXISTS game_states (
      playerId TEXT PRIMARY KEY,
      resources TEXT,
      buildings TEXT,
      population TEXT,
      techs TEXT,
      techEffects TEXT,
      currentEra INTEGER,
      eraHistory TEXT,
      happiness INTEGER,
      gameDay INTEGER,
      eventQueue TEXT,
      eventHistory TEXT,
      offlineSnapshot TEXT,
      offlineEventLog TEXT,
      negativeStreak INTEGER,
      lastEventAt TEXT,
      updatedAt TEXT
    );
  `);
}
initTables();

// 初始化服务
const authService = new AuthService(db, JWT_SECRET);
const logService = new LogService(db);
const authMiddleware = (req, res, next) => authService.authMiddleware(req, res, next);

// ==================== 科技定义（完整版） ====================

const TECHNOLOGIES = {
  '钻木取火': {
    id: '钻木取火',
    cost: { knowledge: 30 },
    prerequisites: [],
    eraRequired: 0,
    effect: { farmerOutput: 0.2 },
    description: '农民食物产出+20%'
  },
  '文字': {
    id: '文字',
    cost: { knowledge: 50 },
    prerequisites: ['钻木取火'],
    eraRequired: 0,
    effect: { scholarOutput: 0.2 },
    description: '学者产出+20%'
  },
  '农业': {
    id: '农业',
    cost: { knowledge: 80 },
    prerequisites: ['文字'],
    eraRequired: 0,
    effect: { farmMultiplier: 0.3 },
    description: '农田产出+30%'
  },
  '畜牧': {
    id: '畜牧',
    cost: { knowledge: 120 },
    prerequisites: ['农业'],
    eraRequired: 1,
    effect: { growthRate: 0.3 },
    description: '人口增长速度+30%'
  },
  '冶金': {
    id: '冶金',
    cost: { knowledge: 200 },
    prerequisites: ['畜牧'],
    eraRequired: 1,
    effect: { craftsmanOutput: 0.25 },
    description: '工匠产出+25%'
  },
  '书写法': {
    id: '书写法',
    cost: { knowledge: 250 },
    prerequisites: ['冶金'],
    eraRequired: 2,
    effect: { knowledgeOutput: 0.15 },
    description: '全局知识产出+15%'
  },
  '陶轮': {
    id: '陶轮',
    cost: { knowledge: 300 },
    prerequisites: ['书写法'],
    eraRequired: 2,
    effect: { workshopMultiplier: 0.2 },
    description: '工坊产出+20%'
  },
  '灌溉': {
    id: '灌溉',
    cost: { knowledge: 500 },
    prerequisites: ['陶轮'],
    eraRequired: 2,
    effect: { farmMultiplier: 0.2 },
    description: '农田产出额外+20%'
  },
  '青铜器': {
    id: '青铜器',
    cost: { knowledge: 800 },
    prerequisites: ['灌溉'],
    eraRequired: 2,
    effect: { metalOutput: 0.3 },
    description: '金属相关产出+30%'
  },
  '铁器': {
    id: '铁器',
    cost: { knowledge: 1200 },
    prerequisites: ['青铜器'],
    eraRequired: 3,
    effect: { militaryBonus: 0.3 },
    description: '军事力量+30%'
  },
  '几何': {
    id: '几何',
    cost: { knowledge: 1500 },
    prerequisites: ['铁器'],
    eraRequired: 3,
    effect: { academyMultiplier: 0.3 },
    description: '学院加成+30%'
  },
  '哲学': {
    id: '哲学',
    cost: { knowledge: 2000 },
    prerequisites: ['几何'],
    eraRequired: 3,
    effect: { knowledgeOutput: 0.25 },
    description: '全局知识产出+25%'
  }
};

function getTechInfo(techName) {
  return TECHNOLOGIES[techName] || null;
}

function canResearchTech(gameState, techName) {
  const tech = getTechInfo(techName);
  if (!tech) return { can: false, reason: 'Technology not found' };

  if (gameState.techs[techName]?.status === 'completed') {
    return { can: false, reason: 'Already researched' };
  }

  if (gameState.techs[techName]?.status === 'researching') {
    return { can: false, reason: 'Already researching' };
  }

  for (const prereq of tech.prerequisites) {
    if (gameState.techs[prereq]?.status !== 'completed') {
      return { can: false, reason: `Requires: ${prereq}` };
    }
  }

  if (gameState.currentEra < tech.eraRequired) {
    return { can: false, reason: `Requires era ${ERA_NAMES[tech.eraRequired]}` };
  }

  const researching = Object.values(gameState.techs).find(t => t.status === 'researching');
  if (researching) {
    return { can: false, reason: `Already researching: ${researching.id}` };
  }

  return { can: true };
}

function startResearch(gameState, techName) {
  const tech = getTechInfo(techName);
  if (!tech) return false;

  gameState.techs[techName] = {
    id: techName,
    status: 'researching',
    progress: 0,
    totalCost: tech.cost.knowledge,
    startedAt: new Date().toISOString()
  };

  return true;
}

function updateResearchProgress(gameState, deltaSeconds) {
  const researching = Object.values(gameState.techs).find(t => t.status === 'researching');
  if (!researching) return null;

  const tech = getTechInfo(researching.id);
  if (!tech) return null;

  // 研发速度 = 当前知识产出/秒（全部投入研发）
  const output = calculateResourceOutput(gameState);
  const knowledgeOutput = output.knowledge * deltaSeconds;

  researching.progress += knowledgeOutput;

  if (researching.progress >= researching.totalCost) {
    researching.status = 'completed';
    researching.completedAt = new Date().toISOString();
    applyTechEffect(gameState, researching.id);
    return { completed: true, techId: researching.id };
  }

  return { completed: false, progress: researching.progress, total: researching.totalCost };
}

function applyTechEffect(gameState, techName) {
  const tech = getTechInfo(techName);
  if (!tech || !tech.effect) return;

  const effect = tech.effect;
  gameState.techEffects = gameState.techEffects || {};

  if (effect.farmerOutput) {
    gameState.techEffects.farmerOutput = (gameState.techEffects.farmerOutput || 0) + effect.farmerOutput;
  }
  if (effect.farmMultiplier) {
    gameState.techEffects.farmMultiplier = (gameState.techEffects.farmMultiplier || 0) + effect.farmMultiplier;
  }
  if (effect.craftsmanOutput) {
    gameState.techEffects.craftsmanOutput = (gameState.techEffects.craftsmanOutput || 0) + effect.craftsmanOutput;
  }
  if (effect.academyMultiplier) {
    gameState.techEffects.academyMultiplier = (gameState.techEffects.academyMultiplier || 0) + effect.academyMultiplier;
  }
  if (effect.houseCapacity) {
    gameState.techEffects.houseCapacity = (gameState.techEffects.houseCapacity || 0) + effect.houseCapacity;
  }
  if (effect.recruitCooldown) {
    gameState.techEffects.recruitCooldown = (gameState.techEffects.recruitCooldown || 0) + effect.recruitCooldown;
  }
  // v2.0 新科技效果
  if (effect.scholarOutput) {
    gameState.techEffects.scholarOutput = (gameState.techEffects.scholarOutput || 0) + effect.scholarOutput;
  }
  if (effect.growthRate) {
    gameState.techEffects.growthRate = (gameState.techEffects.growthRate || 0) + effect.growthRate;
  }
  if (effect.knowledgeOutput) {
    gameState.techEffects.knowledgeOutput = (gameState.techEffects.knowledgeOutput || 0) + effect.knowledgeOutput;
  }
  if (effect.workshopMultiplier) {
    gameState.techEffects.workshopMultiplier = (gameState.techEffects.workshopMultiplier || 0) + effect.workshopMultiplier;
  }
  if (effect.metalOutput) {
    gameState.techEffects.metalOutput = (gameState.techEffects.metalOutput || 0) + effect.metalOutput;
  }
  if (effect.militaryBonus) {
    gameState.techEffects.militaryBonus = (gameState.techEffects.militaryBonus || 0) + effect.militaryBonus;
  }
}

// ==================== 时代定义（完整版） ====================

const ERA_NAMES = ['原始', '农耕', '青铜', '古典', '中世纪', '文艺复兴', '工业'];

function getEraConditions(targetEra) {
  const conditions = {
    1: {
      food: 0,
      knowledge: 100,
      buildingCount: 3,
      requiredBuildings: { farm: 3 },
      techCount: 0,
      requiredTechs: []
    },
    2: {
      food: 2000,
      knowledge: 500,
      buildingCount: 5,
      requiredBuildings: { workshop: 1, farm: 3 },
      techCount: 2,
      requiredTechs: ['钻木取火', '文字']
    },
    3: {
      food: 4000,
      knowledge: 1200,
      buildingCount: 7,
      requiredBuildings: { academy: 1, workshop: 1 },
      techCount: 4,
      requiredTechs: ['钻木取火', '文字', '农业', '冶金']
    }
  };
  return conditions[targetEra] || null;
}

function calculateEraProgress(gameState, targetEra) {
  const conditions = getEraConditions(targetEra);
  if (!conditions) return { percentage: 0, canAdvance: false, details: [] };

  const details = [];
  let totalWeight = 0;
  let completedWeight = 0;
  let dimensionCount = 0;
  if (conditions.food > 0) dimensionCount++;
  if (conditions.knowledge > 0) dimensionCount++;
  if (conditions.buildingCount > 0) dimensionCount++;
  if (conditions.techCount > 0) dimensionCount++;
  if (dimensionCount === 0) return { percentage: 100, canAdvance: true, details: [] };
  const weightPerDim = 100 / dimensionCount;

  // 食物
  if (conditions.food > 0) {
    const foodProgress = Math.min((gameState.resources.food || 0) / conditions.food, 1);
    totalWeight += weightPerDim;
    completedWeight += foodProgress * weightPerDim;
    details.push({ name: '食物', required: conditions.food, current: Math.floor(gameState.resources.food || 0), met: foodProgress >= 1, progress: Math.floor(foodProgress * 100) });
  }

  // 知识
  if (conditions.knowledge > 0) {
    const knowledgeProgress = Math.min((gameState.resources.knowledge || 0) / conditions.knowledge, 1);
    totalWeight += weightPerDim;
    completedWeight += knowledgeProgress * weightPerDim;
    details.push({ name: '知识', required: conditions.knowledge, current: Math.floor(gameState.resources.knowledge || 0), met: knowledgeProgress >= 1, progress: Math.floor(knowledgeProgress * 100) });
  }

  // 建筑
  if (conditions.buildingCount > 0) {
    const totalBuildings = Object.values(gameState.buildings).reduce((a, b) => a + b, 0);
    let buildingProgress = Math.min(totalBuildings / conditions.buildingCount, 1);
    let specificMet = true;
    for (const [bType, required] of Object.entries(conditions.requiredBuildings || {})) {
      if ((gameState.buildings[bType] || 0) < required) specificMet = false;
    }
    if (!specificMet) buildingProgress = Math.min(buildingProgress, 0.8);
    totalWeight += weightPerDim;
    completedWeight += buildingProgress * weightPerDim;
    details.push({ name: '建筑', required: conditions.buildingCount, current: totalBuildings, met: buildingProgress >= 1 && specificMet, progress: Math.floor(buildingProgress * 100), specificRequired: conditions.requiredBuildings });
  }

  // 科技
  if (conditions.techCount > 0) {
    const completedTechs = Object.values(gameState.techs).filter(t => t.status === 'completed').length;
    let techProgress = Math.min(completedTechs / conditions.techCount, 1);
    let techSpecificMet = true;
    for (const techName of conditions.requiredTechs || []) {
      if (gameState.techs[techName]?.status !== 'completed') techSpecificMet = false;
    }
    if (!techSpecificMet) techProgress = Math.min(techProgress, 0.8);
    totalWeight += weightPerDim;
    completedWeight += techProgress * weightPerDim;
    details.push({ name: '科技', required: conditions.techCount, current: completedTechs, met: techProgress >= 1 && techSpecificMet, progress: Math.floor(techProgress * 100), specificRequired: conditions.requiredTechs });
  }

  return { percentage: Math.floor(completedWeight), canAdvance: completedWeight >= 100, details };
}

// ==================== 默认游戏状态 ====================

function getDefaultGameState(playerId) {
  return {
    playerId,
    resources: { food: 100, wood: 100, stone: 100, metal: 100, knowledge: 0 },
    buildings: { farm: 0, house: 1, workshop: 0, academy: 0, barracks: 0, temple: 0 },
    population: { total: 3, max: 5, farmers: 2, craftsmen: 0, scholars: 0, unassigned: 1, growthProgress: 0 },
    techs: {},
    techEffects: {},
    currentEra: 0,
    eraHistory: [{ era: 0, advancedAt: new Date().toISOString() }],
    happiness: 80,
    gameDay: 1,
    eventQueue: [],
    eventHistory: [],
    nextEventAt: 0,
    offlineSnapshot: {},
    offlineEventLog: [],
    negativeStreak: 0,
    lastEventAt: null,
    updatedAt: new Date().toISOString()
  };
}

// ==================== 资源产出计算（含科技加成） ====================

function calculateResourceOutput(gameState) {
  const pop = gameState.population;
  const buildings = gameState.buildings;
  const techEffects = gameState.techEffects || {};
  const happiness = gameState.happiness || 80;

  const farmBonus = 1 + (buildings.farm * 0.5);
  const techFoodBonus = 1 + (techEffects.farmerOutput || 0) + (techEffects.farmMultiplier || 0);
  const happinessBonus = happiness / 100;
  // 农民产出 1.0 食物/秒（Step 1：0.5→1.0）
  const foodOutput = (pop.farmers || 0) * 1.0 * farmBonus * techFoodBonus * happinessBonus;

  const academyBonus = 1 + (buildings.academy * 0.5);
  const techKnowledgeBonus = 1 + (techEffects.craftsmanOutput || 0) + (techEffects.academyMultiplier || 0);
  // 学者产出 0.5 知识/秒（Step 2：0.2→0.5）
  const scholarKnowledgeOutput = (pop.scholars || 0) * 0.5 * academyBonus * techKnowledgeBonus;
  // 人口基础知识产出 = total × 0.05 知识/秒（Step 4：口耳相传）
  const popBaseKnowledgeOutput = (pop.total || 0) * 0.05;
  const knowledgeOutput = scholarKnowledgeOutput + popBaseKnowledgeOutput;

  // 工匠产出 0.8 木材/秒（Step 3：新增）
  const woodOutput = (pop.craftsmen || 0) * 0.8;

  return { food: foodOutput, knowledge: knowledgeOutput, wood: woodOutput };
}

// ==================== 离线收益计算 ====================

function calculateOfflineIncome(gameState, offlineSeconds) {
  const maxOfflineSeconds = 8 * 3600;
  const actualOffline = Math.min(offlineSeconds, maxOfflineSeconds);

  const output = calculateResourceOutput(gameState);
  let offlineEfficiency = 0.8;

  if (gameState.buildings.temple > 0) {
    offlineEfficiency += 0.05;
  }

  const foodIncome = output.food * actualOffline * offlineEfficiency;
  const knowledgeIncome = output.knowledge * actualOffline * offlineEfficiency;
  const woodIncome = output.wood * actualOffline * offlineEfficiency;

  return {
    food: Math.floor(foodIncome),
    knowledge: Math.floor(knowledgeIncome),
    wood: Math.floor(woodIncome),
    offlineHours: Math.floor(actualOffline / 3600 * 100) / 100
  };
}

// ==================== 数据库操作 ====================

function getGameState(playerId) {
  const row = db.prepare('SELECT * FROM game_states WHERE playerId = ?').get(playerId);
  if (!row) return null;
  return {
    playerId: row.playerId,
    resources: JSON.parse(row.resources),
    buildings: JSON.parse(row.buildings),
    population: JSON.parse(row.population),
    techs: JSON.parse(row.techs),
    techEffects: row.techEffects ? JSON.parse(row.techEffects) : {},
    currentEra: row.currentEra,
    eraHistory: JSON.parse(row.eraHistory),
    happiness: row.happiness,
    gameDay: row.gameDay,
    eventQueue: JSON.parse(row.eventQueue),
    eventHistory: JSON.parse(row.eventHistory),
    offlineSnapshot: row.offlineSnapshot ? JSON.parse(row.offlineSnapshot) : {},
    offlineEventLog: row.offlineEventLog ? JSON.parse(row.offlineEventLog) : [],
    negativeStreak: row.negativeStreak,
    lastEventAt: row.lastEventAt ? Number(row.lastEventAt) || 0 : 0,
    updatedAt: row.updatedAt
  };
}

function saveGameState(gameState) {
  db.prepare(`
    INSERT OR REPLACE INTO game_states 
    (playerId, resources, buildings, population, techs, techEffects, currentEra, eraHistory, happiness, gameDay, eventQueue, eventHistory, offlineSnapshot, offlineEventLog, negativeStreak, lastEventAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    gameState.playerId,
    JSON.stringify(gameState.resources),
    JSON.stringify(gameState.buildings),
    JSON.stringify(gameState.population),
    JSON.stringify(gameState.techs),
    JSON.stringify(gameState.techEffects),
    gameState.currentEra,
    JSON.stringify(gameState.eraHistory),
    gameState.happiness,
    gameState.gameDay,
    JSON.stringify(gameState.eventQueue),
    JSON.stringify(gameState.eventHistory),
    JSON.stringify(gameState.offlineSnapshot),
    JSON.stringify(gameState.offlineEventLog),
    gameState.negativeStreak,
    gameState.lastEventAt,
    new Date().toISOString()
  );
}

// ==================== 建筑成本 ====================

const BUILDING_DEFS = {
  farm: { cost: { food: 50 }, unlockEra: 0 },
  house: { cost: { food: 100, wood: 20 }, unlockEra: 0 },
  workshop: { cost: { food: 150, knowledge: 40 }, unlockEra: 1 },
  academy: { cost: { food: 200, knowledge: 80 }, unlockEra: 0 },
  barracks: { cost: { food: 250, knowledge: 60 }, unlockEra: 2 },
  temple: { cost: { food: 300, knowledge: 100 }, unlockEra: 3 }
};

function getBuildingCost(buildingType, currentCount) {
  const def = BUILDING_DEFS[buildingType];
  if (!def) return null;

  const multiplier = Math.pow(1.5, currentCount);
  const cost = {};
  for (const [resource, amount] of Object.entries(def.cost)) {
    cost[resource] = Math.floor(amount * multiplier);
  }
  return cost;
}

function getBuildingUnlockEra(buildingType) {
  return BUILDING_DEFS[buildingType]?.unlockEra ?? 0;
}

function canAfford(resources, cost) {
  for (const [resource, amount] of Object.entries(cost)) {
    if ((resources[resource] || 0) < amount) return false;
  }
  return true;
}

function deductResources(resources, cost) {
  for (const [resource, amount] of Object.entries(cost)) {
    resources[resource] -= amount;
  }
}

// ==================== API路由 ====================

// 注册
// 初始化日志表
logService.initLogTable();

// 注册日志中间件
app.use((req, res, next) => {
  const startTime = Date.now();
  const originalEnd = res.end;
  res.end = function(...args) {
    res.end = originalEnd;
    originalEnd.apply(res, args);
    logService.logApiRequest(req, res, startTime);
  };
  next();
});

// 启动定时日志清理
logService.startCleanupInterval();

// === 玩家账号路由 ===
app.post('/api/player/register', (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  const player = authService.registerPlayer(deviceId, getDefaultGameState, saveGameState);
  res.json({ playerId: player.playerId, token: player.token, gameState: sanitizeGameState(getDefaultGameState(player.playerId)) });
});

app.post('/api/player/login', (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  const result = authService.loginPlayer(deviceId, getGameState, calculateOfflineIncome, saveGameState);
  if (result.error) return res.status(404).json({ error: result.error });
  res.json({ playerId: result.playerId, token: result.token, gameState: sanitizeGameState(result.gameState), offlineIncome: result.offlineIncome });
});

app.post('/api/player/reset', authMiddleware, (req, res) => {
  res.json(authService.resetPlayer(req.playerId));
});

app.get('/api/player/logs', authMiddleware, (req, res) => {
  try {
    const rows = logService.getPlayerLogs(req.playerId, 20);
    res.json({ success: true, logs: rows });
  } catch (err) {
    res.status(500).json({ error: 'Query failed', message: err.message });
  }
});

app.get('/api/game/state', authMiddleware, (req, res) => {
  const gameState = getGameState(req.playerId);
  if (!gameState) return res.status(404).json({ error: 'Game state not found' });

  // 更新活跃时间
  db.prepare('UPDATE players SET lastActiveAt = ? WHERE playerId = ?')
    .run(new Date().toISOString(), req.playerId);

  // 计算时代进阶进度
  const targetEra = gameState.currentEra + 1;
  const eraProgress = calculateEraProgress(gameState, targetEra);

  res.json({
    gameState: sanitizeGameState(gameState),
    eraProgress,
    syncTime: new Date().toISOString()
  });
});

// 玩家操作
app.post('/api/game/action', authMiddleware, (req, res) => {
  const { action, target, count } = req.body;
  const gameState = getGameState(req.playerId);
  if (!gameState) return res.status(404).json({ error: 'Game state not found' });

  let result = { success: false, message: 'Unknown action' };

  switch (action) {
    case 'build': {
      const buildingType = target;
      const currentCount = gameState.buildings[buildingType] || 0;
      const cost = getBuildingCost(buildingType, currentCount);

      if (!cost) {
        result = { success: false, message: 'Invalid building type' };
        break;
      }

      const requiredEra = getBuildingUnlockEra(buildingType);
      if (gameState.currentEra < requiredEra) {
        result = { success: false, message: `Requires ${ERA_NAMES[requiredEra]} era` };
        break;
      }

      if (!canAfford(gameState.resources, cost)) {
        result = { success: false, message: 'Insufficient resources' };
        break;
      }

      deductResources(gameState.resources, cost);
      gameState.buildings[buildingType] = currentCount + 1;

      result = { success: true, message: `Built ${buildingType}`, cost };
      break;
    }

    case 'assign': {
      const profession = target;
      const amount = parseInt(count) || 0;
      const pop = gameState.population;

      // 白名单校验
      const validProfessions = ['farmer', 'scholar', 'craftsman', 'warrior', 'merchant'];
      if (!validProfessions.includes(profession)) {
        result = { success: false, message: 'Invalid profession type' };
        break;
      }

      // 数量校验
      if (!Number.isFinite(amount) || amount === 0) {
        result = { success: false, message: 'Invalid amount' };
        break;
      }

      if (amount > 0) {
        // 分配人口
        if ((pop.unassigned || 0) < amount) {
          result = { success: false, message: 'Not enough unassigned population' };
          break;
        }
        pop.unassigned -= amount;
        pop[profession] = (pop[profession] || 0) + amount;
        result = { success: true, message: `Assigned ${amount} to ${profession}` };
      } else {
        // 取消分配人口
        const absAmount = Math.abs(amount);
        if ((pop[profession] || 0) < absAmount) {
          result = { success: false, message: `Not enough ${profession}s` };
          break;
        }
        pop[profession] -= absAmount;
        pop.unassigned = (pop.unassigned || 0) + absAmount;
        result = { success: true, message: `Unassigned ${absAmount} from ${profession}` };
      }
      break;
    }

    case 'research': {
      const techName = target;
      const check = canResearchTech(gameState, techName);

      if (!check.can) {
        result = { success: false, message: check.reason };
        break;
      }

      startResearch(gameState, techName);

      result = { success: true, message: `Started researching ${techName}`, techId: techName };
      break;
    }

    case 'advanceEra': {
      const targetEra = gameState.currentEra + 1;
      const check = calculateEraProgress(gameState, targetEra);

      if (!check.canAdvance) {
        result = { success: false, message: 'Era advancement conditions not met', details: check.details };
        break;
      }

      // 扣除资源
      const conditions = getEraConditions(targetEra);
      if (conditions) {
        gameState.resources.food -= conditions.food;
        gameState.resources.knowledge -= conditions.knowledge;
      }

      gameState.currentEra = targetEra;
      gameState.eraHistory.push({
        era: targetEra,
        advancedAt: new Date().toISOString()
      });
      gameState.happiness = Math.min(100, gameState.happiness + 10);

      result = { success: true, message: `Advanced to ${ERA_NAMES[targetEra]} era` };
      break;
    }

    case 'recruit': {
      const recruitCost = { food: 50 };
      if (!canAfford(gameState.resources, recruitCost)) {
        result = { success: false, message: 'Insufficient food' };
        break;
      }

      deductResources(gameState.resources, recruitCost);
      gameState.population.total += 1;
      gameState.population.unassigned = (gameState.population.unassigned || 0) + 1;

      result = { success: true, message: 'Recruited 1 population' };
      break;
    }

    default:
      result = { success: false, message: 'Unknown action type' };
  }

  if (result.success) {
    saveGameState(gameState);
  }

  res.json(result);
});

// 离线上报


// ==================== 事件自动过期处理 ====================
function expireEvents(gameState) {
  const now = Date.now();
  const es = gameState;
  if (!es.eventQueue || es.eventQueue.length === 0) return;

  const expired = [];
  const remaining = [];

  for (const evt of es.eventQueue) {
    if (evt.expiresAt && now >= evt.expiresAt) {
      expired.push(evt);
    } else {
      remaining.push(evt);
    }
  }

  if (expired.length === 0) return;

  es.eventQueue = remaining;

  for (const evt of expired) {
    const template = EVENTS[evt.id];
    if (!template) continue;

    // 记录过期事件
    const record = {
      id: evt.id,
      option: 'expired',
      timestamp: new Date().toISOString(),
      message: '\u4E8B\u4EF6\u5DF2\u8FC7\u671F\u81EA\u52A8\u5904\u7406'
    };
    if (!es.eventHistory) es.eventHistory = [];
    es.eventHistory.push(record);
    if (es.eventHistory.length > 50) es.eventHistory = es.eventHistory.slice(-50);

    if (template.type === 'negative') {
      // 负面事件过期执行"最差选项"（选项B）
      const worstOption = template.options.B || template.options.A;
      if (worstOption) {
        applyEventEffects(gameState, evt.id, 'B');
      }
    }
    // 正面/中性事件过期直接作废，无效果
  }
}

// 辅助函数：应用事件效果（支持百分比+保底双轨制）
function applyEventEffects(gameState, eventId, optionKey) {
  const evt = EVENTS[eventId];
  if (!evt) return null;

  const opt = evt.options[optionKey];
  if (!opt) return null;

  const gs = gameState;
  const effects = { food: 0, knowledge: 0, happiness: 0, population: 0, message: opt.msg || '' };

  // 食物效果（百分比+保底）
  if (opt.foodPercent !== undefined) {
    const base = gs.resources.food;
    const pctAmount = Math.floor(base * opt.foodPercent);
    const absAmount = opt.foodMin || 0;
    if (opt.foodPercent > 0) {
      effects.food = Math.max(pctAmount, absAmount);
    } else {
      effects.food = Math.min(pctAmount, absAmount);
    }
  }

  // 知识效果（百分比+保底）
  if (opt.knowledgePercent !== undefined) {
    const base = gs.resources.knowledge;
    const pctAmount = Math.floor(base * opt.knowledgePercent);
    const absAmount = opt.knowledgeMin || 0;
    if (opt.knowledgePercent > 0) {
      effects.knowledge = Math.max(pctAmount, absAmount);
    } else {
      effects.knowledge = Math.min(pctAmount, absAmount);
    }
  }

  // 幸福度
  if (opt.happiness) {
    effects.happiness = opt.happiness;
  }

  // 人口变化
  if (opt.population) {
    effects.population = opt.population;
  }

  // 兵营判定（野兽袭击选项A）
  if (eventId === 'beastAttack' && optionKey === 'A') {
    const barracksCount = gs.buildings.barracks || 0;
    if (barracksCount >= 1) {
      effects.message = '\u5175\u8425\u6210\u529F\u9632\u5FA1\uFF01\u65CF\u7FA4\u65E0\u635F';
      effects.food = 0;
      effects.population = 0;
    } else {
      effects.food = -20;
      effects.population = -1;
      effects.message = '\u65E0\u5175\u8425\u9632\u5FA1\uff0C\u98DF\u7269-20\uff0C\u4EBA\u53E3-1';
    }
  }

  // 蛮族劫掠选项A的赌局
  if (eventId === 'barbarianRaid' && optionKey === 'A' && opt.gamble) {
    if (Math.random() < 0.7) {
      const loot = Math.max(100, Math.floor(gs.resources.food * 0.15));
      const cost = Math.floor(gs.resources.food * 0.20);
      effects.food = loot - cost;
      effects.message = '\u51FB\u9000\u86EE\u65CF\uFF01\u7F34\u83B7\u98DF\u7269+' + loot;
    } else {
      effects.food = -Math.floor(gs.resources.food * 0.20);
      effects.message = '\u51FA\u51FB\u5931\u8D25\uff0C\u635F\u5931\u98DF\u7269' + Math.abs(effects.food);
    }
  }

  // 瘟疫选项B：知识补偿
  if (eventId === 'plague' && optionKey === 'B') {
    effects.knowledge = 30;
    effects.message = '\u653E\u4EFB\u81EA\u6D41\uff0C\u4EBA\u53E3-2\uff0C\u4F46\u77E5\u8BC6+30\uFF08\u533B\u751F\u603B\u7ED3\u7ECF\u9A8C\uFF09';
  }

  // 应用效果
  if (effects.food) gs.resources.food = Math.max(0, gs.resources.food + effects.food);
  if (effects.knowledge) gs.resources.knowledge = Math.max(0, gs.resources.knowledge + effects.knowledge);
  if (effects.happiness) gs.happiness = Math.max(0, Math.min(100, gs.happiness + effects.happiness));
  if (effects.population) {
    const newPop = gs.population.total + effects.population;
    if (newPop >= 1) {
      gs.population.total = newPop;
      if (effects.population < 0) {
        gs.population.unassigned = Math.max(0, gs.population.unassigned + effects.population);
      } else {
        gs.population.unassigned += effects.population;
      }
    }
  }

  return effects;
}

// 事件选择
// 事件选择
app.post('/api/game/event/choose', authMiddleware, (req, res) => {
  const { eventId, option } = req.body;
  const gameState = getGameState(req.playerId);
  if (!gameState) return res.status(404).json({ error: 'Game state not found' });

  // 从事件队列中移除
  const idx = gameState.eventQueue.findIndex(e => e.id === eventId);
  if (idx >= 0) {
    gameState.eventQueue.splice(idx, 1);
  }

  // 记录事件历史
  const eventRecord = {
    id: eventId,
    option,
    timestamp: new Date().toISOString()
  };
  if (!gameState.eventHistory) gameState.eventHistory = [];
  gameState.eventHistory.push(eventRecord);
  if (gameState.eventHistory.length > 50) {
    gameState.eventHistory = gameState.eventHistory.slice(-50);
  }

  // 应用选项效果
  const effects = applyEventEffects(gameState, eventId, option);

  if (effects) {
    eventRecord.effects = effects;
  }

  saveGameState(gameState);
  const resultText = effects?.message || '已处理';
  res.json({ success: true, effects, resultText, gameState: sanitizeGameState(gameState) });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 辅助函数：清理游戏状态（移除敏感字段）
function sanitizeGameState(gameState) {
  const output = calculateResourceOutput(gameState);
  const baseMax = (gameState.buildings.house || 0) * 4;
  const techBonus = (gameState.techEffects?.houseCapacity || 0);
  const maxPop = baseMax + techBonus;

  return {
    playerId: gameState.playerId,
    resources: {
      ...gameState.resources,
      foodPerSecond: Math.round(output.food * 10) / 10,
      knowledgePerSecond: Math.round(output.knowledge * 10) / 10,
      woodPerSecond: Math.round(output.wood * 10) / 10,
    },
    buildings: gameState.buildings,
    population: {
      ...gameState.population,
      maxPop: maxPop,
    },
    techs: gameState.techs,
    techEffects: gameState.techEffects,
    currentEra: gameState.currentEra,
    eraHistory: gameState.eraHistory,
    happiness: gameState.happiness,
    gameDay: gameState.gameDay,
    eventQueue: gameState.eventQueue || [],
    eventHistory: gameState.eventHistory || [],
    offlineSnapshot: gameState.offlineSnapshot || {},
    updatedAt: gameState.updatedAt,
  };
}

// ==================== 服务端Tick系统 ====================

// ==================== 事件系统 ====================
const EVENTS = {
  // === 通用事件（所有时代均可触发） ===
  harvest: {
    id: 'harvest', type: 'positive', emoji: '\uD83C\uDF3E', title: '\u5927\u5730\u56DE\u9988', weight: 4,
    desc: '\u4ECA\u5E74\u98CE\u8C03\u96E8\u987A\uff0c\u519C\u7530\u83B7\u5F97\u4E86\u8D85\u51FA\u9884\u671F\u7684\u5927\u4E30\u6536\uff01\u6751\u6C11\u4EEC\u5174\u9AD8\u91C7\u70C8\u5730\u8BA8\u8BBA\u7740\u5982\u4F55\u5206\u914D\u8FD9\u4E9B\u610F\u5916\u4E4B\u8D22\u3002',
    era: null,
    condition: (g) => g.resources.food >= 50,
    options: {
      A: { label: '\u4E3E\u884C\u5E86\u5178', foodPercent: 0.20, foodMin: 30, happiness: 10, msg: '\u5168\u65CF\u6B22\u5E86\uff0c\u98DF\u7269+max(20%,30)\uff0C\u5E78\u798F\u5EA6+10' },
      B: { label: '\u50A8\u5B58\u7CAE\u98DF', foodPercent: 0.35, foodMin: 50, msg: '\u7CBE\u6253\u7EC6\u7B97\uff0c\u98DF\u7269+max(35%,50)' }
    }
  },
  famine: {
    id: 'famine', type: 'negative', emoji: '\uD83C\uDF42', title: '\u7CAE\u98DF\u5371\u673A', weight: 3,
    desc: '\u5E72\u65F1\u8BA9\u571F\u5730\u9F9F\u88C2\uff0c\u5B58\u7CAE\u6025\u5267\u51CF\u5C11\u3002\u6751\u6C11\u4EEC\u9762\u9732\u5FE7\u8272\uff0c\u957F\u8001\u53EC\u96C6\u7D27\u6025\u8BAE\u4E8B\u3002',
    era: null,
    condition: (g) => g.resources.food >= 30,
    options: {
      A: { label: '\u5F00\u4ED3\u8D5D\u6D4E', foodPercent: -0.15, foodMin: -20, msg: '\u5F00\u4ED3\u8D5D\u6D4E\uff0c\u98DF\u7269-max(15%,20)' },
      B: { label: '\u7D27\u7F29\u914D\u7ED9', foodPercent: -0.08, foodMin: -10, happiness: -15, msg: '\u7D27\u7F29\u914D\u7ED9\uff0c\u98DF\u7269-max(8%,10)\uff0C\u5E78\u798F\u5EA6-15' }
    }
  },
  beastAttack: {
    id: 'beastAttack', type: 'negative', emoji: '\uD83D\uDC3A', title: '\u91CE\u517D\u6765\u88AD\uFF01', weight: 3,
    desc: '\u591C\u5E55\u964D\u4E34\u65F6\uff0C\u72FC\u7FA4\u6084\u7136\u903C\u8FD1\u6751\u5E84\u8FB9\u7F18\u3002\u5C16\u53EB\u58F0\u548C\u562F\u53EB\u58F0\u4EA4\u7EC7\u5728\u4E00\u8D77\u3002',
    era: null,
    condition: (g) => g.population.total >= 2,
    options: {
      A: { label: '\u7EC4\u7EC7\u9632\u5FA1', msg: '\u6709\u5175\u8425\u65E0\u635F\uff1B\u65E0\u5175\u8425\u98DF\u7269-20\u4EBA\u53E3-1' },
      B: { label: '\u4F9B\u5949\u5B89\u629A', foodPercent: -0.12, foodMin: -25, msg: '\u4F9B\u5949\u5B89\u629A\uff0c\u98DF\u7269-max(12%,25)' }
    }
  },
  ruins: {
    id: 'ruins', type: 'positive', emoji: '\uD83C\uDFDB\uFE0F', title: '\u9057\u8FF9\u53D1\u73B0', weight: 3,
    desc: '\u730E\u4EBA\u5728\u5C71\u811A\u53D1\u73B0\u4E86\u4E00\u5EA7\u88AB\u85E4\u8513\u8986\u76D6\u7684\u9057\u8FF9\uff0C\u4F3C\u4E4E\u6765\u81EA\u67D0\u4E2A\u65E9\u5DF2\u6D88\u5931\u7684\u6587\u660E...',
    era: null,
    condition: (g) => true,
    options: {
      A: { label: '\u8003\u53E4\u7814\u7A76', knowledgePercent: 0.30, knowledgeMin: 50, msg: '\u6DF1\u5165\u7814\u7A76\uff0C\u77E5\u8BC6+max(30%,50)' },
      B: { label: '\u5C31\u5730\u4FDD\u62A4', knowledgePercent: 0.10, knowledgeMin: 15, happiness: 8, msg: '\u4FDD\u62A4\u9057\u8FF9\uff0C\u77E5\u8BC6+max(10%,15)\uff0C\u5E78\u798F\u5EA6+8' }
    }
  },
  visitors: {
    id: 'visitors', type: 'positive', emoji: '\uD83D\uDC65', title: '\u8FDC\u65B9\u65C5\u4EBA', weight: 3,
    desc: '\u4E00\u652F\u6765\u81EA\u8FDC\u65B9\u7684\u5546\u65C5\u8DEF\u8FC7\u4F60\u7684\u9886\u5730\uff0C\u4ED6\u4EEC\u770B\u8D77\u6765\u7CBE\u529B\u4E0D\u652F\uff0C\u4F46\u80CC\u56CA\u91CC\u4F3C\u4E4E\u88C5\u6EE1\u4E86\u8D27\u7269\u3002',
    era: null,
    condition: (g) => g.population.total < g.population.max,
    options: {
      A: { label: '\u70ED\u60C5\u63A5\u5F85', population: 1, foodPercent: -0.10, foodMin: -30, msg: '\u65C5\u4EBA\u7559\u4E0B\uff0C\u4EBA\u53E3+1\uff0C\u98DF\u7269-max(10%,30)' },
      B: { label: '\u4EA4\u6362\u7269\u8D44', foodPercent: 0.40, foodMin: 50, msg: '\u4EA4\u6613\u6210\u529F\uff0C\u98DF\u7269+max(40%,50)' }
    }
  },
  celestial: {
    id: 'celestial', type: 'neutral', emoji: '\u2B50', title: '\u5929\u8C61\u5F02\u53D8', weight: 3,
    desc: '\u591C\u7A7A\u51FA\u73B0\u4E86\u5947\u5F02\u7684\u661F\u8C61\uff0C\u6D41\u661F\u5212\u8FC7\u5929\u9645\u3002\u65CF\u4EBA\u4EEC\u805A\u96C6\u5728\u71C3\u706B\u65C1\uff0C\u4EF0\u671B\u5929\u7A7A\u7EB7\u7EB7\u8BAE\u8BBA\u3002',
    era: null,
    condition: (g) => true,
    options: {
      A: { label: '\u5360\u535C\u7948\u798F', happiness: 12, knowledgePercent: 0.10, knowledgeMin: 10, msg: '\u7948\u798F\u4EEA\u5F0F\uff0C\u5E78\u798F\u5EA6+12\uff0C\u77E5\u8BC6+max(10%,10)' },
      B: { label: '\u89C2\u5BDF\u8BB0\u5F55', knowledgePercent: 0.25, knowledgeMin: 30, msg: '\u8BE6\u7EC6\u8BB0\u5F55\uff0C\u77E5\u8BC6+max(25%,30)' }
    }
  },

  // === \u65F6\u4EE3\u4E13\u5C5E\u4E8B\u4EF6 ===
  fireUnstable: {
    id: 'fireUnstable', type: 'positive', emoji: '\uD83D\uDD25', title: '\u706B\u79CD\u4E0D\u7A33', weight: 2,
    desc: '\u71C3\u706B\u6447\u6643\uff0C\u4F3C\u4E4E\u5373\u5C06\u7184\u706D...\u65CF\u4EBA\u4EEC\u56F4\u5728\u4E00\u8D77\uff0C\u8138\u4E0A\u6620\u7740\u706B\u5149\u3002',
    era: 0,
    condition: (g) => g.currentEra === 0,
    options: {
      A: { label: '\u6DFB\u52A0\u71C3\u6599', foodPercent: -0.08, foodMin: -20, msg: '\u6DFB\u67F4\u7EED\u706B\uff0C\u98DF\u7269-20\uff0C\u5168\u4EA7\u51FA+15%\u6301\u7EED90\u79D2' },
      B: { label: '\u91CD\u65B0\u94BB\u6728', knowledgePercent: 0.10, knowledgeMin: 20, msg: '\u94BB\u6728\u53D6\u706B\uff0C\u77E5\u8BC6+20' }
    }
  },
  harvestFestival: {
    id: 'harvestFestival', type: 'positive', emoji: '\uD83C\uDFA8', title: '\u4E30\u6536\u796D', weight: 2,
    desc: '\u4ECA\u5E74\u7684\u6536\u6210\u8FDC\u8D85\u9884\u671F\uff0C\u65CF\u4EBA\u4EEC\u63D0\u8BAE\u4E3E\u884C\u796D\u7940\uFF0C\u5411\u5929\u5730\u611F\u6069\u3002',
    era: 1,
    condition: (g) => g.currentEra === 1 && g.resources.food >= 200,
    options: {
      A: { label: '\u796D\u7940\u5929\u5730', foodPercent: -0.10, foodMin: -30, happiness: 20, msg: '\u796D\u7940\u5929\u5730\uff0C\u98DF\u7269-10%\uff0C\u5E78\u798F\u5EA6+20' },
      B: { label: '\u6269\u5EFA\u7CAE\u4ED3', foodPercent: 0.25, foodMin: 50, msg: '\u6269\u5EFA\u7CAE\u4ED3\uff0C\u98DF\u7269+25%' }
    }
  },
  ratPlague: {
    id: 'ratPlague', type: 'negative', emoji: '\uD83D\uDC00', title: '\u9F20\u60A3\u6210\u707E', weight: 2,
    desc: '\u7CAE\u4ED3\u9644\u8FD1\u53D1\u73B0\u4E86\u9F20\u6D1E\uFF0C\u635F\u5931\u6B63\u5728\u6269\u5927...',
    era: 1,
    condition: (g) => g.currentEra === 1 && (g.buildings.farm || g.buildings.farmland || 0) >= 3,
    options: {
      A: { label: '\u517B\u732B\u62A4\u7CAE', foodPercent: -0.10, foodMin: -15, msg: '\u517B\u732B\u62A4\u7CAE\uff0C\u98DF\u7269-15\uff0C\u540E\u7EED10\u5206\u949F\u519C\u7530\u4EA7\u51FA+10%' },
      B: { label: '\u52A0\u56FA\u4ED3\u623F', foodPercent: -0.15, foodMin: -30, msg: '\u52A0\u56FA\u4ED3\u623F\uff0C\u98DF\u7269-30\uff0C\u7ACB\u5373\u6B62\u635F' }
    }
  },
  bronzeAccident: {
    id: 'bronzeAccident', type: 'negative', emoji: '\u2699\uFE0F', title: '\u51B6\u70BC\u4E8B\u6545', weight: 2,
    desc: '\u5DE5\u574A\u7684\u9752\u94DC\u7194\u7089\u53D1\u751F\u6CC4\u6F0F\uff0C\u70ED\u6C14\u903C\u4EBA\uff0C\u5DE5\u5320\u4EEC\u56DB\u6563\u5954\u9003\u3002',
    era: 2,
    condition: (g) => g.currentEra === 2 && (g.buildings.workshop || 0) >= 2,
    options: {
      A: { label: '\u7D27\u6025\u62A2\u4FEE', population: -1, msg: '\u7D27\u6025\u62A2\u4FEE\uff0C\u4EBA\u53E3-1\uff0C\u5DE5\u574A\u7ACB\u523B\u6062\u590D' },
      B: { label: '\u6682\u505C\u751F\u4EA7', msg: '\u6682\u505C\u751F\u4EA760\u79D2\uff0C\u4EBA\u53E3\u65E0\u635F' }
    }
  },
  barbarianRaid: {
    id: 'barbarianRaid', type: 'negative', emoji: '\uD83D\uDDE1\uFE0F', title: '\u86EE\u65CF\u52AB\u63A0', weight: 2,
    desc: '\u5DE1\u903B\u961F\u62A5\u544A\u6709\u86EE\u65CF\u9760\u8FD1\u8FB9\u5883\uFF0C\u4ED6\u4EEC\u624B\u6301\u7B80\u964B\u7684\u6B66\u5668\uFF0C\u773C\u4E2D\u95EA\u70C1\u7740\u8D2A\u5A6A\u3002',
    era: 2,
    condition: (g) => g.currentEra === 2 && (g.buildings.barracks || 0) >= 1,
    options: {
      A: { label: '\u4E3B\u52A8\u51FA\u51FB', foodPercent: -0.20, foodMin: -50, gamble: true, msg: '\u4E3B\u52A8\u51FA\u51FB\uff0C\u98DF\u7269-20%\uff0C70%\u6982\u7387\u51FB\u9000\u5E76\u7F34\u83B7\u98DF\u7269+100' },
      B: { label: '\u56FA\u5B88\u57CE\u6C60', foodPercent: -0.08, foodMin: -20, msg: '\u56FA\u5B88\u57CE\u6C60\uff0C\u98DF\u7269-20\uff0C\u4EBA\u53E3\u65E0\u635F' }
    }
  },
  foreignEnvoy: {
    id: 'foreignEnvoy', type: 'positive', emoji: '\uD83D\uDCDC', title: '\u5916\u65CF\u4F7F\u8282', weight: 2,
    desc: '\u8FDC\u65B9\u57CE\u90A6\u6D3E\u6765\u4E86\u4F7F\u8282\uFF0C\u643A\u5E26\u793C\u7269\u548C\u6587\u4E66\uFF0C\u8981\u6C42\u89C1\u89C1\u3002',
    era: 3,
    condition: (g) => g.currentEra === 3 && g.resources.knowledge >= 500,
    options: {
      A: { label: '\u7ED3\u76DF\u8D38\u6613', foodPercent: 0.20, foodMin: 50, knowledgePercent: 0.15, knowledgeMin: 30, msg: '\u7ED3\u76DF\u8D38\u6613\uff0C\u98DF\u7269+20%\u77E5\u8BC6+15%\uFF0C\u4F46\u4E0B\u6B21\u8D1F\u9762\u6982\u7387+10%' },
      B: { label: '\u4FDD\u6301\u8B66\u60D5', knowledgePercent: 0.25, knowledgeMin: 40, happiness: 10, msg: '\u4FDD\u6301\u8B66\u60D5\uff0C\u77E5\u8BC6+25%\uFF0C\u5E78\u798F\u5EA6+10' }
    }
  },
  plague: {
    id: 'plague', type: 'negative', emoji: '\uD83E\uDDA0', title: '\u761F\u75AB\u8513\u5EF6', weight: 2,
    desc: '\u57CE\u4E2D\u51FA\u73B0\u4E86\u53D1\u70ED\u75C5\u4EBA\uFF0C\u75BE\u75C5\u6B63\u5728\u8513\u5EF6...\u7A7A\u6C14\u4E2D\u5F25\u6F2B\u7740\u8349\u836F\u548C\u6050\u60E7\u7684\u5473\u9053\u3002',
    era: 3,
    condition: (g) => g.currentEra === 3 && g.population.total >= 10,
    options: {
      A: { label: '\u9694\u79BB\u6CBB\u7597', foodPercent: -0.20, foodMin: -50, happiness: -10, msg: '\u9694\u79BB\u6CBB\u7597\uff0C\u98DF\u7269-20%\u5E78\u798F\u5EA6-10\uff0C\u4FDD\u4F4F\u5168\u90E8\u4EBA\u53E3' },
      B: { label: '\u653E\u4EFB\u81EA\u6D41', population: -2, msg: '\u653E\u4EFB\u81EA\u6D41\uff0C\u4EBA\u53E3-2\uff0C\u98DF\u7269\u65E0\u635F\u4F46\u77E5\u8BC6+30\uFF08\u533B\u751F\u603B\u7ED3\u7ECF\u9A8C\uFF09' }
    }
  }
};
function tryTriggerEvent(gameState) {
  const now = Date.now();
  const es = gameState;
  if (!es.eventQueue) es.eventQueue = [];
  if (!es.lastEventAt) es.lastEventAt = 0;
  if (!es.eventCooldowns) es.eventCooldowns = {};
  if (!es.negativeStreak) es.negativeStreak = 0;

  // 事件队列上限3个，全局冷却45秒
  if (es.eventQueue.length >= 5) return;
  if (now - es.lastEventAt < 45000) return;

  // 首事件保护：新玩家或刚登录的玩家15秒内100%触发正面事件
  const timeSinceStart = now - (gameState.startTime || now);
  if (timeSinceStart < 15000 && es.eventQueue.length === 0) {
    // 强制触发一个正面事件
    const positiveEvents = ['harvest', 'ruins', 'visitors'];
    for (const key of positiveEvents) {
      const evt = EVENTS[key];
      if (evt && evt.condition(gameState)) {
        es.eventQueue.push({
          id: key,
          emoji: evt.emoji,
          title: evt.title,
          desc: evt.desc,
          type: evt.type,
          era: evt.era,
          createdAt: now,
          expiresAt: now + 30 * 60000  // 30分钟后过期
        });
        es.lastEventAt = now;
        es.eventCooldowns[key] = now;
        return;
      }
    }
  }

  // 基础触发概率50%（冷却结束后）
  if (Math.random() > 0.5) return;

  // 收集满足条件的事件
  const candidates = [];
  for (const key of Object.keys(EVENTS)) {
    const evt = EVENTS[key];
    const lastCd = es.eventCooldowns[key] || 0;
    // 单个事件冷却2分钟
    if (now - lastCd < 120000) continue;
    if (evt.condition(gameState)) {
      // 负面连 streak 降低负面事件概率
      let w = evt.weight;
      if (evt.type === 'negative' && es.negativeStreak >= 2) w = Math.max(1, w * 0.3);
      candidates.push({ key, weight: w });
    }
  }
  if (candidates.length === 0) return;

  // 加权随机
  const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * totalWeight;
  let selected = candidates[0].key;
  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) { selected = c.key; break; }
  }

  const evtTemplate = EVENTS[selected];
es.eventQueue.push({
  id: selected,
  emoji: evtTemplate.emoji,
  title: evtTemplate.title,
  desc: evtTemplate.desc,
  type: evtTemplate.type,
  era: evtTemplate.era,
  createdAt: now,
  expiresAt: now + 30 * 60000  // 30分钟后过期
});
  es.lastEventAt = now;
  es.eventCooldowns[selected] = now;
  if (EVENTS[selected].type === 'negative') es.negativeStreak++;
  else es.negativeStreak = Math.max(0, es.negativeStreak - 1);
}

function tickPlayer(gameState, deltaSeconds = 1) {
  const output = calculateResourceOutput(gameState);

  // 资源产出
  gameState.resources.food += output.food * deltaSeconds;
  gameState.resources.knowledge += output.knowledge * deltaSeconds;
  gameState.resources.wood = (gameState.resources.wood || 0) + output.wood * deltaSeconds;

  // 食物消耗 = total * 0.2 食物/秒（Step 5）
  const foodConsumption = (gameState.population.total || 0) * 0.2 * deltaSeconds;
  gameState.resources.food -= foodConsumption;

  // 科技研发进度更新
  updateResearchProgress(gameState, deltaSeconds);

  // 人口自然增长：每120秒+1人（速率0.00833/秒），需要食物>0
  const growthRate = 0.00833;
  const growth = growthRate * deltaSeconds;
  gameState.population.growthProgress = (gameState.population.growthProgress || 0) + growth;

  if (gameState.population.growthProgress >= 1) {
    const newPeople = Math.floor(gameState.population.growthProgress);
    gameState.population.growthProgress -= newPeople;

    // 人口上限 = 3 + 民居数量×2 + 科技加成
    const baseMax = (gameState.buildings.house || 0) * 4;
    const techBonus = (gameState.techEffects?.houseCapacity || 0);
    const maxPop = baseMax + techBonus;

    // 检查食物是否>0才能增长
    const food = gameState.resources.food || 0;
    const canGrow = food > 0;

    const actualNew = canGrow ? Math.min(newPeople, maxPop - gameState.population.total) : 0;

    if (actualNew > 0) {
      gameState.population.total += actualNew;
      gameState.population.unassigned = (gameState.population.unassigned || 0) + actualNew;
    }
  }

  // 检查事件过期
  expireEvents(gameState);

  // 事件触发由全局tick计数器控制，不在此处检查
  // tryTriggerEvent 在 setInterval 中每5秒调用一次

  return gameState;
}

// 活跃玩家判断
function getActivePlayers(minutes = 5) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const rows = db.prepare('SELECT playerId, deviceId FROM players WHERE lastActiveAt > ?').all(cutoff);
  return rows;
}

// 全局tick计数器
let globalTickCounter = 0;

// 全局tick
setInterval(() => {
  try {
    globalTickCounter++;
    const players = getActivePlayers(5);
    if (players.length === 0) return;

    for (const player of players) {
      const gameState = getGameState(player.playerId);
      if (!gameState) continue;

      tickPlayer(gameState, 1);

      // 事件触发检查（60-120秒随机间隔）
      const now = Date.now();
      if (!gameState.nextEventAt) gameState.nextEventAt = now + 60000 + Math.floor(Math.random() * 60000);
      if (now >= gameState.nextEventAt) {
        tryTriggerEvent(gameState);
        gameState.nextEventAt = now + 60000 + Math.floor(Math.random() * 60000);
      }

      // 保存完整游戏状态（包含事件队列等所有字段）
      saveGameState(gameState);
    }

  } catch (err) {
    console.error('Tick error:', err.message);
  }
}, 1000);

console.log('Tick system started: 1s interval, all active players');

// ==================== 启动 ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Civilization Fire backend running on port ${PORT}`);
});

