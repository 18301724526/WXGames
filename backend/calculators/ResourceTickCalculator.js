const GameConfig = require('../config/GameConfig');

function calculateFoodConsumption(totalPopulation) {
  return (totalPopulation || 0) * GameConfig.resources.foodConsumptionPerPerson;
}

function calculateFoodOutputPerSecond(population, effects, happiness) {
  const farmers = population?.farmers || 0;
  const happinessFactor = Math.max(0.5, (happiness || 100) / 100);
  return farmers
    * GameConfig.resources.baseFoodPerFarmer
    * (effects?.foodOutputMultiplier || 1)
    * happinessFactor
    * (effects?.globalOutputMultiplier || 1);
}

function calculateFoodBreakdown(gameState, effects) {
  const total = gameState?.population?.total || 0;
  const foodOutput = calculateFoodOutputPerSecond(gameState?.population, effects, gameState?.happiness);
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

function calculateKnowledgePerSecond(population, effects) {
  const total = population?.total || 0;
  return total
    * GameConfig.resources.baseKnowledgePerPerson
    * (effects?.knowledgeOutputMultiplier || 1)
    * (effects?.globalOutputMultiplier || 1);
}

function calculatePopulationCap(effects) {
  return effects?.populationCap || GameConfig.population.baseMax;
}

function calculateHappiness(effects) {
  return 100 + (effects?.happinessBonus || 0);
}

function calculateOutputs(gameState, effects) {
  const food = calculateFoodBreakdown(gameState, effects);
  return {
    foodPerSecond: food.netPerSecond,
    foodOutputPerSecond: food.outputPerSecond,
    foodConsumptionPerSecond: food.consumptionPerSecond,
    knowledgePerSecond: calculateKnowledgePerSecond(gameState.population, effects),
  };
}

function applyPopulationGrowth(gameState, deltaSeconds = 1) {
  const state = gameState;
  const population = state.population || {};
  const maxPopulation = population.max || population.maxPop || calculatePopulationCap(state.buildingEffects);
  const interval = GameConfig.population.growthIntervalSeconds;

  population.max = maxPopulation;
  population.maxPop = maxPopulation;
  population.growthProgress = (population.growthProgress || 0) + Math.max(0, deltaSeconds);

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
  };
}

module.exports = {
  calculateFoodConsumption,
  calculateFoodOutputPerSecond,
  calculateFoodBreakdown,
  calculateFoodPerSecond,
  calculateKnowledgePerSecond,
  calculatePopulationCap,
  calculateHappiness,
  calculateOutputs,
  applyPopulationGrowth,
};
