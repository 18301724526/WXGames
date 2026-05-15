function calculateFoodPerSecond(population, buildings, effects, happiness) {
  const baseFoodPerFarmer = 1.0;
  const farmers = population?.farmers || 0;
  const total = population?.total || 0;
  const happinessFactor = Math.max(0.5, (happiness || 100) / 100);
  const foodOutput = farmers * baseFoodPerFarmer * (effects?.foodOutputMultiplier || 1) * happinessFactor * (effects?.globalOutputMultiplier || 1);
  const foodConsumption = total * 0.2;
  return foodOutput - foodConsumption;
}

function calculateKnowledgePerSecond(population, effects) {
  const total = population?.total || 0;
  return total * 0.05 * (effects?.knowledgeOutputMultiplier || 1) * (effects?.globalOutputMultiplier || 1);
}

function calculatePopulationCap(effects) {
  return effects?.populationCap || 3;
}

function calculateHappiness(effects) {
  return 100 + (effects?.happinessBonus || 0);
}

function calculateOutputs(gameState, effects) {
  return {
    foodPerSecond: calculateFoodPerSecond(gameState.population, gameState.buildings, effects, gameState.happiness),
    knowledgePerSecond: calculateKnowledgePerSecond(gameState.population, effects),
  };
}

module.exports = {
  calculateFoodPerSecond,
  calculateKnowledgePerSecond,
  calculatePopulationCap,
  calculateHappiness,
  calculateOutputs,
};
