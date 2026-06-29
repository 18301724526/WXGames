const { BuildingConfig } = require('../services/config/GameplayConfigRuntime');
const BuildingState = require('./BuildingState');

function normalizeLevel(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') return value.level || 0;
  return 0;
}

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
    return BuildingConfig.getBuilding(buildingType);
  }

  /**
   * 计算建筑下一步成本
   * @param {string} buildingType
   * @param {number|object} currentCount
   * @returns {object|null} { food: xxx, knowledge: xxx }
   */
  static getBuildingCost(buildingType, currentCount) {
    const currentLevel = normalizeLevel(currentCount);
    if (currentLevel <= 0) return BuildingConfig.getBuildCost(buildingType);
    return BuildingConfig.getUpgradeCost(buildingType, currentLevel);
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
    if (!cost) return false;
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
    return Object.keys(BuildingConfig.getAllBuildings());
  }

  static canUpgrade(buildingType, currentCount) {
    return BuildingConfig.canUpgrade(buildingType, normalizeLevel(currentCount));
  }

  static getCurrentLevel(buildings, buildingType) {
    return BuildingState.getLevel(buildings, buildingType);
  }
}

module.exports = BuildingCalculator;
