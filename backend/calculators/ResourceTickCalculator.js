const { GameConfig } = require('../services/config/GameplayConfigRuntime');
const { clamp } = require('../../shared/numberUtils');

function calculateFoodConsumption(totalPopulation) {
  return (totalPopulation || 0) * GameConfig.resources.foodConsumptionPerPerson;
}

function calculateFoodOutputPerSecond(population, effects, happiness) {
  const farmers = population?.farmers || 0;
  const happinessFactor = Math.max(0.5, (happiness || 100) / 100);
  return farmers
    * GameConfig.resources.baseFoodPerFarmer
    * (effects?.foodOutputMultiplier || 1)
    * (1 + (effects?.territoryFoodOutputBonus || 0))
    * happinessFactor
    * (effects?.globalOutputMultiplier || 1);
}

function getBuffBonus(gameState, type, target = null) {
  return (gameState?.activeBuffs || []).reduce((sum, buff) => {
    if (buff.type !== type) return sum;
    if (target && buff.target !== target) return sum;
    return sum + (Number.isFinite(buff.value) ? buff.value : 0);
  }, 0);
}

function withBuffMultiplier(gameState, resourceKey) {
  return 1 + getBuffBonus(gameState, 'resourceMultiplier', resourceKey);
}

function calculateFoodBreakdown(gameState, effects) {
  const total = gameState?.population?.total || 0;
  const foodOutput = calculateFoodOutputPerSecond(gameState?.population, effects, gameState?.happiness)
    * withBuffMultiplier(gameState, 'food');
  const foodConsumption = calculateFoodConsumption(total);
  return {
    outputPerSecond: foodOutput,
    consumptionPerSecond: foodConsumption,
    netPerSecond: foodOutput - foodConsumption,
  };
}

function calculateFoodPerSecond(population, buildings, effects, happiness) {
  return calculateFoodBreakdown({ population, buildings, happiness }, effects).netPerSecond;
}

function calculateKnowledgePerSecond(population, effects, gameState = null) {
  const totalPopulation = population?.total || 0;
  const scholars = population?.scholars || 0;
  const globalMultiplier = effects?.globalOutputMultiplier || 1;
  const baseOutput = totalPopulation
    * GameConfig.resources.baseKnowledgePerPerson
    * globalMultiplier;
  const scholarBonus = scholars
    * GameConfig.resources.scholarKnowledgeBonus
    * (effects?.knowledgeOutputMultiplier || 1)
    * (1 + (effects?.territoryKnowledgeOutputBonus || 0))
    * globalMultiplier;
  return (baseOutput + scholarBonus) * withBuffMultiplier(gameState, 'knowledge');
}

function calculateWoodPerSecond(gameState, effects) {
  const craftsmen = gameState?.population?.craftsmen || 0;
  const baseWood = effects?.woodOutputBase || 0;
  if (!craftsmen || !baseWood) return 0;
  return craftsmen
    * GameConfig.resources.baseWoodPerCraftsman
    * baseWood
    * (effects?.craftsmanOutputMultiplier || 1)
    * (1 + (effects?.territoryWoodOutputBonus || 0))
    * (effects?.globalOutputMultiplier || 1)
    * withBuffMultiplier(gameState, 'wood');
}

function calculateStonePerSecond(gameState, effects) {
  const craftsmen = gameState?.population?.craftsmen || 0;
  const baseStone = effects?.stoneOutputBase || 0;
  if (!craftsmen || !baseStone) return 0;
  return craftsmen
    * GameConfig.resources.baseStonePerCraftsman
    * baseStone
    * (effects?.craftsmanOutputMultiplier || 1)
    * (effects?.globalOutputMultiplier || 1)
    * withBuffMultiplier(gameState, 'stone');
}

function calculateIronPerSecond(gameState, effects) {
  const craftsmen = gameState?.population?.craftsmen || 0;
  const baseIron = effects?.ironOutputBase || 0;
  if (!craftsmen || !baseIron) return 0;
  return craftsmen
    * GameConfig.resources.baseIronPerCraftsman
    * baseIron
    * (effects?.craftsmanOutputMultiplier || 1)
    * (effects?.globalOutputMultiplier || 1)
    * withBuffMultiplier(gameState, 'iron');
}

function calculatePopulationCap(effects) {
  return effects?.populationCap || GameConfig.population.baseMax;
}

function calculateEraPopulationCap(currentEra = 0) {
  const caps = GameConfig.population.eraCaps || [];
  const era = Math.max(0, Math.floor(Number(currentEra) || 0));
  const configured = caps[era];
  if (Number.isFinite(configured)) return configured;
  return caps.length ? caps[caps.length - 1] : GameConfig.population.baseMax;
}

function calculatePopulationCapacity(gameState = {}, effects = gameState.buildingEffects || {}) {
  const housingCap = calculatePopulationCap(effects);
  const eraCap = calculateEraPopulationCap(gameState.currentEra);
  const active = Boolean(GameConfig.population.splitCapacityActive);
  const effectiveCap = active ? Math.min(eraCap, housingCap) : housingCap;
  const limitingSource = eraCap < housingCap ? 'era' : housingCap < eraCap ? 'housing' : 'balanced';
  return {
    active,
    eraCap,
    housingCap,
    effectiveCap,
    limitingSource: active ? limitingSource : 'splitCapacityInactive',
  };
}

function calculateHappiness(effects) {
  return 100 + (effects?.happinessBonus || 0);
}

function calculateBuffedHappiness(effects, gameState) {
  return calculateHappiness(effects) + getBuffBonus(gameState, 'happinessFlat');
}

function calculateOfflineEfficiencyBonus(gameState) {
  return getBuffBonus(gameState, 'offlineEfficiencyBonus');
}

function calculatePopulationGrowthMultiplier(gameState = {}) {
  const rawHabitability = Number(
    gameState.habitability
      ?? gameState.planning?.habitability
      ?? gameState.city?.habitability
      ?? 0,
  );
  const habitability = Number.isFinite(rawHabitability) ? rawHabitability : 0;
  return Math.round(clamp(1 + habitability / 100, 0.5, 1.5) * 100) / 100;
}

function calculateOutputs(gameState, effects) {
  const food = calculateFoodBreakdown(gameState, effects);
  return {
    foodPerSecond: food.netPerSecond,
    foodOutputPerSecond: food.outputPerSecond,
    foodConsumptionPerSecond: food.consumptionPerSecond,
    knowledgePerSecond: calculateKnowledgePerSecond(gameState.population, effects, gameState),
    woodPerSecond: calculateWoodPerSecond(gameState, effects),
    ironPerSecond: calculateIronPerSecond(gameState, effects),
    stonePerSecond: calculateStonePerSecond(gameState, effects),
    metalPerSecond: calculateIronPerSecond(gameState, effects),
  };
}

function applyPopulationGrowth(gameState, deltaSeconds = 1) {
  const state = gameState;
  const population = state.population || {};
  const maxPopulation = population.max || population.maxPop || calculatePopulationCap(state.buildingEffects);
  const interval = GameConfig.population.growthIntervalSeconds;
  const growthMultiplier = calculatePopulationGrowthMultiplier(state);

  population.max = maxPopulation;
  population.maxPop = maxPopulation;
  population.growthProgress = (population.growthProgress || 0) + Math.max(0, deltaSeconds) * growthMultiplier;

  let grown = 0;
  while (population.growthProgress >= interval) {
    population.growthProgress -= interval;
    if ((state.resources?.food || 0) <= 0) continue;
    if ((population.total || 0) >= maxPopulation) continue;
    population.total = (population.total || 0) + 1;
    population.unassigned = (population.unassigned || 0) + 1;
    grown += 1;
  }

  return {
    grown,
    maxPopulation,
    growthProgress: population.growthProgress,
    growthMultiplier,
  };
}

module.exports = {
  calculateFoodConsumption,
  calculateFoodOutputPerSecond,
  calculateFoodBreakdown,
  calculateFoodPerSecond,
  calculateKnowledgePerSecond,
  calculateWoodPerSecond,
  calculateIronPerSecond,
  calculateStonePerSecond,
  calculatePopulationCap,
  calculateEraPopulationCap,
  calculatePopulationCapacity,
  calculateHappiness,
  calculateBuffedHappiness,
  calculateOfflineEfficiencyBonus,
  calculatePopulationGrowthMultiplier,
  calculateOutputs,
  applyPopulationGrowth,
};
