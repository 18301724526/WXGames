const BuildingCalculator = require('./BuildingCalculator');
const BuildingValidator = require('./BuildingValidator');
const BuildingEffects = require('./BuildingEffects');
const BuildingState = require('../domain/BuildingState');

/**
 * 建筑系统核心 - 整合校验、建造、效果计算
 */
class BuildingSystem {
  constructor() {
    this.effects = new BuildingEffects();
  }

  /**
   * 执行建造
   * @param {string} buildingType 
   * @param {object} gameState 
   * @returns {object} { success: boolean, message: string, cost?, errors?, buildingType?, newCount? }
   */
  build(buildingType, gameState) {
    const validation = BuildingValidator.validateBuildRequest(buildingType, gameState);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.errors[0]?.message || '建造失败',
        errors: validation.errors
      };
    }

    const cost = validation.cost;
    BuildingCalculator.deductResources(gameState.resources, cost);
    gameState.buildings = BuildingState.normalizeLegacyBuildingState(gameState.buildings);
    gameState.buildings = BuildingState.build(gameState.buildings, buildingType);

    return {
      success: true,
      message: `建造了 ${buildingType}`,
      cost,
      buildingType,
      newCount: BuildingState.getLevel(gameState.buildings, buildingType)
    };
  }

  /**
   * 获取建筑详细信息（用于 API 返回给前端展示）
   * @param {string} buildingType 
   * @param {object} gameState 
   * @returns {object|null}
   */
  getBuildingInfo(buildingType, gameState) {
    const def = BuildingCalculator.getBuildingDef(buildingType);
    if (!def) return null;

    const currentCount = BuildingState.getLevel(gameState.buildings, buildingType);
    const cost = BuildingCalculator.getBuildingCost(buildingType, currentCount);
    const isUnlocked = gameState.currentEra >= BuildingCalculator.getBuildingUnlockEra(buildingType);
    const canAfford = BuildingCalculator.canAfford(gameState.resources, cost);

    return {
      id: buildingType,
      name: def.name,
      description: def.ui?.description || '',
      icon: def.ui?.icon || '',
      color: def.ui?.color || '',
      category: def.category,
      currentCount,
      nextCost: cost,
      isUnlocked,
      canAfford,
      unlockEra: def.unlockEra,
      maxLevel: def.maxLevel || 1,
      effects: def.effects?.perLevel || {}
    };
  }

  /**
   * 获取所有建筑信息
   * @param {object} gameState 
   * @returns {object[]}
   */
  getAllBuildingInfo(gameState) {
    const types = BuildingCalculator.getAllBuildingTypes();
    return types.map(type => this.getBuildingInfo(type, gameState));
  }

  /**
   * 计算所有建筑效果
   * @param {object} gameState 
   * @returns {object}
   */
  calculateEffects(gameState) {
    return this.effects.getAllEffects(gameState);
  }

  /**
   * 获取时代进阶建筑条件
   * @param {object} gameState 
   * @param {number} targetEra 
   * @returns {object} { totalBuildings, requiredBuildings, met }
   */
  getEraBuildingConditions(gameState, targetEra) {
    const eraConditions = this.getEraConditionsConfig(targetEra);
    if (!eraConditions) return null;

    const totalBuildings = Object.keys(gameState.buildings || {}).reduce(
      (sum, id) => sum + BuildingState.getLevel(gameState.buildings, id),
      0,
    );
    let specificMet = true;

    for (const [bType, required] of Object.entries(eraConditions.requiredBuildings || {})) {
      if (BuildingState.getLevel(gameState.buildings, bType) < required) {
        specificMet = false;
      }
    }

    return {
      totalBuildings,
      requiredTotal: eraConditions.buildingCount,
      requiredBuildings: eraConditions.requiredBuildings,
      specificMet,
      met: totalBuildings >= eraConditions.buildingCount && specificMet
    };
  }

  /**
   * 时代条件配置（内部辅助）
   * @param {number} targetEra 
   * @returns {object|null}
   */
  getEraConditionsConfig(targetEra) {
    const conditions = {
      1: {
        buildingCount: 3,
        requiredBuildings: { farm: 3 }
      },
      2: {
        buildingCount: 5,
        requiredBuildings: { workshop: 1, farm: 3 }
      },
      3: {
        buildingCount: 7,
        requiredBuildings: { academy: 1, workshop: 1 }
      },
      4: {
        buildingCount: 10,
        requiredBuildings: { barracks: 1, academy: 1, workshop: 1 }
      },
      5: {
        buildingCount: 15,
        requiredBuildings: { temple: 1, barracks: 1, academy: 1 }
      },
      6: {
        buildingCount: 20,
        requiredBuildings: { temple: 2, barracks: 2, academy: 2 }
      }
    };
    return conditions[targetEra] || null;
  }
}

module.exports = BuildingSystem;
