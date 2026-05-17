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
      const bonus = level * perLevel.foodOutputMultiplier;
      effects.foodOutputMultiplier += bonus;
      summary.foodOutputMultiplier = 1 + bonus;
      summary.foodOutputBonus = bonus;
    }
    if (perLevel.populationCap) {
      const bonus = level * perLevel.populationCap;
      effects.populationCap += bonus;
      summary.populationCapBonus = bonus;
    }
    if (perLevel.happiness) {
      const bonus = level * perLevel.happiness;
      effects.happinessBonus += bonus;
      summary.happinessBonus = bonus;
    }
    if (perLevel.knowledgeOutputMultiplier) {
      const bonus = level * perLevel.knowledgeOutputMultiplier;
      effects.knowledgeOutputMultiplier += bonus;
      summary.knowledgeOutputMultiplier = 1 + bonus;
      summary.knowledgeOutputBonus = bonus;
    }
    if (perLevel.craftsmanOutputMultiplier) {
      const bonus = level * perLevel.craftsmanOutputMultiplier;
      effects.craftsmanOutputMultiplier += bonus;
      summary.craftsmanOutputMultiplier = 1 + bonus;
      summary.craftsmanOutputBonus = bonus;
    }
    if (perLevel.woodOutputBase) {
      const bonus = level * perLevel.woodOutputBase;
      effects.woodOutputBase += bonus;
      summary.woodOutputBase = bonus;
    }
    if (perLevel.offlineEfficiency) {
      const bonus = level * perLevel.offlineEfficiency;
      effects.offlineEfficiencyBonus += bonus;
      summary.offlineEfficiencyBonus = bonus;
    }
    if (perLevel.defense) {
      const bonus = level * perLevel.defense;
      effects.defenseLevel += bonus;
      summary.defenseLevel = bonus;
    }
    if (perLevel.threatDefense) {
      const bonus = level * perLevel.threatDefense;
      effects.threatDefense += bonus;
      summary.threatDefenseBonus = bonus;
    }
    if (perLevel.globalOutputMultiplier) {
      const bonus = level * perLevel.globalOutputMultiplier;
      effects.globalOutputMultiplier += bonus;
      summary.globalOutputMultiplier = 1 + bonus;
      summary.globalOutputBonus = bonus;
    }

    effects.byBuilding[id] = summary;
  }

  return effects;
}

module.exports = { calculate };
