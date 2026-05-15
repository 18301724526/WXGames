const BuildingCalculator = require('./BuildingCalculator');
const BuildingState = require('../domain/BuildingState');

const ERA_NAMES = ['原始', '农耕', '青铜', '古典', '中世纪', '文艺复兴', '工业'];

/**
 * 建筑校验器 - 负责所有建造前置条件校验
 */
class BuildingValidator {
  /**
   * 校验建造请求
   * @param {string} buildingType 
   * @param {object} gameState 
   * @returns {object} { valid: boolean, errors: [], cost: object|null }
   */
  static validateBuildRequest(buildingType, gameState) {
    const errors = [];
    const def = BuildingCalculator.getBuildingDef(buildingType);

    // 1. 建筑类型存在性
    if (!def) {
      errors.push({ code: 'INVALID_BUILDING', message: '建筑类型不存在' });
      return { valid: false, errors, cost: null };
    }

    const currentCount = BuildingState.getLevel(gameState.buildings, buildingType);

    // 2. 时代解锁检查
    const requiredEra = BuildingCalculator.getBuildingUnlockEra(buildingType);
    if (gameState.currentEra < requiredEra) {
      errors.push({
        code: 'ERA_LOCKED',
        message: `需要${ERA_NAMES[requiredEra]}时代`,
        required: requiredEra,
        current: gameState.currentEra
      });
    }

    // 3. 资源检查
    const cost = BuildingCalculator.getBuildingCost(buildingType, currentCount);
    if (!BuildingCalculator.canAfford(gameState.resources, cost)) {
      errors.push({
        code: 'INSUFFICIENT_RESOURCES',
        message: '资源不足'
      });
    }

    // 4. 建造上限检查
    if (def.maxLevel && currentCount >= def.maxLevel) {
      errors.push({
        code: 'MAX_COUNT_REACHED',
        message: '已达到建造上限'
      });
    }

    return { valid: errors.length === 0, errors, cost };
  }
}

module.exports = BuildingValidator;
