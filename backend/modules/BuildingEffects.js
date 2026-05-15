const BuildingConfig = require('../config/BuildingConfig');
const BuildingState = require('../domain/BuildingState');

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
    const multiplier = this.config.farm?.effects?.perLevel?.foodOutputMultiplier || 0;
    return 1 + (farmCount * multiplier);
  }

  /**
   * 计算建筑对知识产出的加成倍数
   * 从 buildingConfig.json 读取 academy 的 scholarOutputMultiplier
   */
  getKnowledgeOutputMultiplier(gameState) {
    const academyCount = BuildingState.getLevel(gameState.buildings, 'academy');
    const multiplier = this.config.academy?.effects?.perLevel?.knowledgeOutputMultiplier || 0;
    return 1 + (academyCount * multiplier);
  }

  /**
   * 计算工匠产出加成倍数
   * 从 buildingConfig.json 读取 workshop 的 craftsmanOutputMultiplier
   */
  getCraftsmanOutputMultiplier(gameState) {
    const workshopCount = BuildingState.getLevel(gameState.buildings, 'workshop');
    const multiplier = this.config.workshop?.effects?.perLevel?.craftsmanOutputMultiplier || 0;
    return 1 + (workshopCount * multiplier);
  }

  /**
   * 计算全局产出加成（兵营）
   * 从 buildingConfig.json 读取 barracks 的 globalOutputMultiplier
   */
  getGlobalOutputMultiplier(gameState) {
    const barracksCount = BuildingState.getLevel(gameState.buildings, 'barracks');
    const multiplier = this.config.barracks?.effects?.perLevel?.globalOutputMultiplier || 0;
    return 1 + (barracksCount * multiplier);
  }

  /**
   * 计算离线收益效率加成
   * 从 buildingConfig.json 读取 temple 的 offlineEfficiency
   */
  getOfflineEfficiencyBonus(gameState) {
    const templeCount = BuildingState.getLevel(gameState.buildings, 'temple');
    const efficiency = this.config.temple?.effects?.perLevel?.offlineEfficiency || 0;
    return templeCount * efficiency;
  }

  /**
   * 计算幸福度加成
   * 从 buildingConfig.json 读取 house 和 temple 的 happiness
   */
  getHappinessBonus(gameState) {
    const houseCount = BuildingState.getLevel(gameState.buildings, 'house');
    const templeCount = BuildingState.getLevel(gameState.buildings, 'temple');
    const houseHappiness = this.config.house?.effects?.perLevel?.happiness || 0;
    const templeHappiness = this.config.temple?.effects?.perLevel?.happiness || 0;
    return (houseCount * houseHappiness) + (templeCount * templeHappiness);
  }

  /**
   * 获取防御等级（用于事件判定）
   * 从 buildingConfig.json 读取 barracks 的 defense
   */
  getDefenseLevel(gameState) {
    const barracksCount = BuildingState.getLevel(gameState.buildings, 'barracks');
    const defensePerLevel = this.config.barracks?.effects?.perLevel?.defense || 0;
    return barracksCount * defensePerLevel;
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
