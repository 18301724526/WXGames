const buildingConfig = require('../../shared/buildingConfig.json');

/**
 * 建筑效果计算器 - 统一计算建筑对游戏机制的影响
 */
class BuildingEffects {
  constructor() {
    this.config = buildingConfig;
  }

  /**
   * 计算建筑对食物产出的加成倍数
   * farm 每座 +0.5 倍
   * @param {object} gameState 
   * @returns {number}
   */
  getFoodOutputMultiplier(gameState) {
    const farmCount = gameState.buildings?.farm || 0;
    return 1 + (farmCount * 0.5);
  }

  /**
   * 计算建筑对知识产出的加成倍数
   * academy 每座 +0.5 倍
   * @param {object} gameState 
   * @returns {number}
   */
  getKnowledgeOutputMultiplier(gameState) {
    const academyCount = gameState.buildings?.academy || 0;
    return 1 + (academyCount * 0.5);
  }

  /**
   * 计算离线收益效率加成
   * temple 每座 +5%
   * @param {object} gameState 
   * @returns {number}
   */
  getOfflineEfficiencyBonus(gameState) {
    const templeCount = gameState.buildings?.temple || 0;
    return templeCount * 0.05;
  }

  /**
   * 获取防御等级（用于事件判定）
   * barracks 每座 +1
   * @param {object} gameState 
   * @returns {number}
   */
  getDefenseLevel(gameState) {
    return gameState.buildings?.barracks || 0;
  }

  /**
   * 获取所有建筑效果摘要
   * @param {object} gameState 
   * @returns {object}
   */
  getAllEffects(gameState) {
    return {
      foodOutputMultiplier: this.getFoodOutputMultiplier(gameState),
      knowledgeOutputMultiplier: this.getKnowledgeOutputMultiplier(gameState),
      offlineEfficiencyBonus: this.getOfflineEfficiencyBonus(gameState),
      defenseLevel: this.getDefenseLevel(gameState)
    };
  }
}

module.exports = BuildingEffects;
