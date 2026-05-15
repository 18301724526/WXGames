const buildingConfig = require('../../shared/buildingConfig.json');

/**
 * 建筑效果计算器 - 从配置读取倍率，不再硬编码
 */
class BuildingEffects {
  constructor() {
    this.config = buildingConfig;
  }

  /**
   * 计算建筑对食物产出的加成倍数
   * 从 buildingConfig.json 读取 farm 的 foodOutputMultiplier
   */
  getFoodOutputMultiplier(gameState) {
    const farmCount = gameState.buildings?.farm || 0;
    const multiplier = this.config.buildings.farm?.effects?.perBuilding?.foodOutputMultiplier || 0;
    return 1 + (farmCount * multiplier);
  }

  /**
   * 计算建筑对知识产出的加成倍数
   * 从 buildingConfig.json 读取 academy 的 scholarOutputMultiplier
   */
  getKnowledgeOutputMultiplier(gameState) {
    const academyCount = gameState.buildings?.academy || 0;
    const multiplier = this.config.buildings.academy?.effects?.perBuilding?.scholarOutputMultiplier || 0;
    return 1 + (academyCount * multiplier);
  }

  /**
   * 计算工匠产出加成倍数
   * 从 buildingConfig.json 读取 workshop 的 craftsmanOutputMultiplier
   */
  getCraftsmanOutputMultiplier(gameState) {
    const workshopCount = gameState.buildings?.workshop || 0;
    const multiplier = this.config.buildings.workshop?.effects?.perBuilding?.craftsmanOutputMultiplier || 0;
    return 1 + (workshopCount * multiplier);
  }

  /**
   * 计算全局产出加成（兵营）
   * 从 buildingConfig.json 读取 barracks 的 globalOutputMultiplier
   */
  getGlobalOutputMultiplier(gameState) {
    const barracksCount = gameState.buildings?.barracks || 0;
    const multiplier = this.config.buildings.barracks?.effects?.perBuilding?.globalOutputMultiplier || 0;
    return 1 + (barracksCount * multiplier);
  }

  /**
   * 计算离线收益效率加成
   * 从 buildingConfig.json 读取 temple 的 offlineEfficiency
   */
  getOfflineEfficiencyBonus(gameState) {
    const templeCount = gameState.buildings?.temple || 0;
    const efficiency = this.config.buildings.temple?.effects?.perBuilding?.offlineEfficiency || 0;
    return templeCount * efficiency;
  }

  /**
   * 计算幸福度加成
   * 从 buildingConfig.json 读取 house 和 temple 的 happiness
   */
  getHappinessBonus(gameState) {
    const houseCount = gameState.buildings?.house || 0;
    const templeCount = gameState.buildings?.temple || 0;
    const houseHappiness = this.config.buildings.house?.effects?.perBuilding?.happiness || 0;
    const templeHappiness = this.config.buildings.temple?.effects?.perBuilding?.happiness || 0;
    return (houseCount * houseHappiness) + (templeCount * templeHappiness);
  }

  /**
   * 获取防御等级（用于事件判定）
   * 从 buildingConfig.json 读取 barracks 的 defense
   */
  getDefenseLevel(gameState) {
    const barracksCount = gameState.buildings?.barracks || 0;
    const defensePerLevel = this.config.buildings.barracks?.effects?.perBuilding?.defense || 0;
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
