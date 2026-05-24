const BuildingConfig = require('../config/BuildingConfig');
const BuildingState = require('../domain/BuildingState');

function calculate(buildings) {
  const effects = {
    foodOutputMultiplier: 1,
    populationCap: 3,
    happinessBonus: 0,
    knowledgeOutputMultiplier: 1,
    craftsmanOutputMultiplier: 1,
    woodOutputBase: 0,
    stoneOutputBase: 0,
    ironOutputBase: 0,
    offlineEfficiencyBonus: 0,
    defenseLevel: 0,
    threatDefense: 0,
    globalOutputMultiplier: 1,
    byBuilding: {},
  };

  for (const [id, config] of Object.entries(BuildingConfig.getAllBuildings())) {
    const level = BuildingState.getLevel(buildings, id);
    const perLevel = config.effects?.perLevel || {};
    const summary = { level };

    if (perLevel.foodOutputMultiplier) {
      const bonus = BuildingConfig.calculateEffectBonus(id, 'foodOutputMultiplier', level);
      effects.foodOutputMultiplier += bonus;
      summary.foodOutputMultiplier = 1 + bonus;
      summary.foodOutputBonus = bonus;
    }
    if (perLevel.populationCap) {
      const bonus = BuildingConfig.calculateEffectBonus(id, 'populationCap', level);
      effects.populationCap += bonus;
      summary.populationCapBonus = bonus;
    }
    if (perLevel.happiness) {
      const bonus = BuildingConfig.calculateEffectBonus(id, 'happiness', level);
      effects.happinessBonus += bonus;
      summary.happinessBonus = bonus;
    }
    if (perLevel.knowledgeOutputMultiplier) {
      const bonus = BuildingConfig.calculateEffectBonus(id, 'knowledgeOutputMultiplier', level);
      effects.knowledgeOutputMultiplier += bonus;
      summary.knowledgeOutputMultiplier = 1 + bonus;
      summary.knowledgeOutputBonus = bonus;
    }
    if (perLevel.craftsmanOutputMultiplier) {
      const bonus = BuildingConfig.calculateEffectBonus(id, 'craftsmanOutputMultiplier', level);
      effects.craftsmanOutputMultiplier += bonus;
      summary.craftsmanOutputMultiplier = 1 + bonus;
      summary.craftsmanOutputBonus = bonus;
    }
    if (perLevel.woodOutputBase) {
      const bonus = BuildingConfig.calculateEffectBonus(id, 'woodOutputBase', level);
      effects.woodOutputBase += bonus;
      summary.woodOutputBase = bonus;
    }
    if (perLevel.stoneOutputBase) {
      const bonus = BuildingConfig.calculateEffectBonus(id, 'stoneOutputBase', level);
      effects.stoneOutputBase += bonus;
      summary.stoneOutputBase = bonus;
    }
    if (perLevel.ironOutputBase) {
      const bonus = BuildingConfig.calculateEffectBonus(id, 'ironOutputBase', level);
      effects.ironOutputBase += bonus;
      summary.ironOutputBase = bonus;
    }
    if (perLevel.offlineEfficiency) {
      const bonus = BuildingConfig.calculateEffectBonus(id, 'offlineEfficiency', level);
      effects.offlineEfficiencyBonus += bonus;
      summary.offlineEfficiencyBonus = bonus;
    }
    if (perLevel.defense) {
      const bonus = BuildingConfig.calculateEffectBonus(id, 'defense', level);
      effects.defenseLevel += bonus;
      summary.defenseLevel = bonus;
    }
    if (perLevel.threatDefense) {
      const bonus = BuildingConfig.calculateEffectBonus(id, 'threatDefense', level);
      effects.threatDefense += bonus;
      summary.threatDefenseBonus = bonus;
    }
    if (perLevel.globalOutputMultiplier) {
      const bonus = BuildingConfig.calculateEffectBonus(id, 'globalOutputMultiplier', level);
      effects.globalOutputMultiplier += bonus;
      summary.globalOutputMultiplier = 1 + bonus;
      summary.globalOutputBonus = bonus;
    }

    effects.byBuilding[id] = summary;
  }

  return effects;
}

module.exports = { calculate };
