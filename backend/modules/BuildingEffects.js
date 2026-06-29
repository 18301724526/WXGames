const { BuildingConfig } = require('../services/config/GameplayConfigRuntime');
const BuildingState = require('./BuildingState');

/**
 * 建筑效果计算器 - 从配置读取倍率，不再硬编码
 */
class BuildingEffects {
  constructor() {
    this.config = BuildingConfig.getAllBuildings();
  }

  /**
   * 计算建筑对食物产出的加成倍数
   * 从 buildingConfig.json 读取 farm 的 foodOutputMultiplier
   */
  getFoodOutputMultiplier(gameState) {
    const farmCount = BuildingState.getLevel(gameState.buildings, 'farm');
    return 1 + BuildingConfig.calculateEffectBonus('farm', 'foodOutputMultiplier', farmCount);
  }

  /**
   * 计算建筑对知识产出的加成倍数
   * 从 buildingConfig.json 读取 academy 的 scholarOutputMultiplier
   */
  getKnowledgeOutputMultiplier(gameState) {
    const academyCount = BuildingState.getLevel(gameState.buildings, 'academy');
    return 1 + BuildingConfig.calculateEffectBonus('academy', 'knowledgeOutputMultiplier', academyCount);
  }

  /**
   * 计算工匠产出加成倍数
   * 从 buildingConfig.json 读取 workshop 的 craftsmanOutputMultiplier
   */
  getCraftsmanOutputMultiplier(gameState) {
    const workshopCount = BuildingState.getLevel(gameState.buildings, 'workshop');
    return 1 + BuildingConfig.calculateEffectBonus('workshop', 'craftsmanOutputMultiplier', workshopCount);
  }

  /**
   * 计算全局产出加成（兵营）
   * 从 buildingConfig.json 读取 barracks 的 globalOutputMultiplier
   */
  getGlobalOutputMultiplier(gameState) {
    const barracksCount = BuildingState.getLevel(gameState.buildings, 'barracks');
    return 1 + BuildingConfig.calculateEffectBonus('barracks', 'globalOutputMultiplier', barracksCount);
  }

  /**
   * 计算离线收益效率加成
   * 从 buildingConfig.json 读取 temple 的 offlineEfficiency
   */
  getOfflineEfficiencyBonus(gameState) {
    const templeCount = BuildingState.getLevel(gameState.buildings, 'temple');
    return BuildingConfig.calculateEffectBonus('temple', 'offlineEfficiency', templeCount);
  }

  /**
   * 计算幸福度加成
   * 从 buildingConfig.json 读取 house 和 temple 的 happiness
   */
  getHappinessBonus(gameState) {
    const houseCount = BuildingState.getLevel(gameState.buildings, 'house');
    const templeCount = BuildingState.getLevel(gameState.buildings, 'temple');
    return BuildingConfig.calculateEffectBonus('house', 'happiness', houseCount)
      + BuildingConfig.calculateEffectBonus('temple', 'happiness', templeCount);
  }

  /**
   * 获取防御等级（用于事件判定）
   * 从 buildingConfig.json 读取 watchtower 的 threatDefense
   */
  getDefenseLevel(gameState) {
    const watchtowerCount = BuildingState.getLevel(gameState.buildings, 'watchtower');
    return BuildingConfig.calculateEffectBonus('watchtower', 'threatDefense', watchtowerCount);
  }

  /**
   * 获取所有建筑效果摘要
   */
  getAllEffects(gameState) {
    return {
      foodOutputMultiplier: this.getFoodOutputMultiplier(gameState),
      knowledgeOutputMultiplier: this.getKnowledgeOutputMultiplier(gameState),
      craftsmanOutputMultiplier: this.getCraftsmanOutputMultiplier(gameState),
      globalOutputMultiplier: this.getGlobalOutputMultiplier(gameState),
      offlineEfficiencyBonus: this.getOfflineEfficiencyBonus(gameState),
      happinessBonus: this.getHappinessBonus(gameState),
      defenseLevel: this.getDefenseLevel(gameState)
    };
  }
}

module.exports = BuildingEffects;
