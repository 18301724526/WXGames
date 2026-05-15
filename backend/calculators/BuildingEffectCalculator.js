const BuildingConfig = require('../config/BuildingConfig');
const BuildingState = require('../domain/BuildingState');

function calculate(buildings) {
  const effects = {
    foodOutputMultiplier: 1,
    populationCap: 3,
    happinessBonus: 0,
    knowledgeOutputMultiplier: 1,
    craftsmanOutputMultiplier: 1,
    offlineEfficiencyBonus: 0,
    defenseLevel: 0,
    globalOutputMultiplier: 1,
  };

  for (const [id, config] of Object.entries(BuildingConfig.getAllBuildings())) {
    const level = BuildingState.getLevel(buildings, id);
    if (!level) continue;
    const perLevel = config.effects?.perLevel || {};

    if (perLevel.foodOutputMultiplier) effects.foodOutputMultiplier += level * perLevel.foodOutputMultiplier;
    if (perLevel.populationCap) effects.populationCap += level * perLevel.populationCap;
    if (perLevel.happiness) effects.happinessBonus += level * perLevel.happiness;
    if (perLevel.knowledgeOutputMultiplier) effects.knowledgeOutputMultiplier += level * perLevel.knowledgeOutputMultiplier;
    if (perLevel.craftsmanOutputMultiplier) effects.craftsmanOutputMultiplier += level * perLevel.craftsmanOutputMultiplier;
    if (perLevel.offlineEfficiency) effects.offlineEfficiencyBonus += level * perLevel.offlineEfficiency;
    if (perLevel.defense) effects.defenseLevel += level * perLevel.defense;
    if (perLevel.globalOutputMultiplier) effects.globalOutputMultiplier += level * perLevel.globalOutputMultiplier;
  }

  return effects;
}

module.exports = { calculate };
