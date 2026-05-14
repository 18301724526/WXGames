const buildingConfig = require('../shared/buildingConfig.json');

/**
 * 建筑计算器 - 负责成本计算、资源操作
 */
class BuildingCalculator {
  /**
   * 获取建筑定义
   * @param {string} buildingType 
   * @returns {object|null}
   */
  static getBuildingDef(buildingType) {
    return buildingConfig.buildings[buildingType] || null;
  }

  /**
   * 计算建筑成本（含指数增长）
   * @param {string} buildingType 
   * @param {number} currentCount 
   * @returns {object|null} { food: xxx, knowledge: xxx }
   */
  static getBuildingCost(buildingType, currentCount) {
    const def = this.getBuildingDef(buildingType);
    if (!def) return null;

    const multiplier = Math.pow(def.costMultiplier, currentCount);
    const cost = {};
    for (const [resource, amount] of Object.entries(def.cost)) {
      cost[resource] = Math.floor(amount * multiplier);
    }
    return cost;
  }

  /**
   * 获取建筑解锁时代
   * @param {string} buildingType 
   * @returns {number}
   */
  static getBuildingUnlockEra(buildingType) {
    return this.getBuildingDef(buildingType)?.unlockEra ?? 0;
  }

  /**
   * 检查资源是否足够
   * @param {object} resources 
   * @param {object} cost 
   * @returns {boolean}
   */
  static canAfford(resources, cost) {
    for (const [resource, amount] of Object.entries(cost)) {
      if ((resources[resource] || 0) < amount) return false;
    }
    return true;
  }

  /**
   * 扣除资源
   * @param {object} resources 
   * @param {object} cost 
   */
  static deductResources(resources, cost) {
    for (const [resource, amount] of Object.entries(cost)) {
      resources[resource] -= amount;
    }
  }

  /**
   * 获取所有建筑类型列表
   * @returns {string[]}
   */
  static getAllBuildingTypes() {
    return Object.keys(buildingConfig.buildings);
  }
}

module.exports = BuildingCalculator;
