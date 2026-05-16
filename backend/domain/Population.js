const MAPPING = {
  farmer: 'farmers',
  scholar: 'scholars',
  craftsman: 'craftsmen',
};

function reassign(population, target, count) {
  const amount = Number.parseInt(count, 10) || 0;
  const key = MAPPING[target];
  if (!key || !amount) {
    return { error: 'INVALID_ASSIGNMENT', message: '人口分配参数错误' };
  }

  if (amount > 0) {
    if ((population.unassigned || 0) < amount) {
      return { error: 'INSUFFICIENT_POPULATION', message: '可分配人口不足' };
    }
    return {
      population: {
        ...population,
        unassigned: (population.unassigned || 0) - amount,
        [key]: (population[key] || 0) + amount,
      },
      message: `已分配 ${amount} 名${target}`,
    };
  }

  const absAmount = Math.abs(amount);
  if ((population[key] || 0) < absAmount) {
    return { error: 'INSUFFICIENT_POPULATION', message: '职业人口不足' };
  }
  return {
    population: {
      ...population,
      unassigned: (population.unassigned || 0) + absAmount,
      [key]: (population[key] || 0) - absAmount,
    },
    message: `已撤回 ${absAmount} 名${target}`,
  };
}

module.exports = {
  MAPPING,
  reassign,
};
