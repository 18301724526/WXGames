function calculateReward(option) {
  if (option?.reward) return { ...(option.reward || {}) };
  return (option?.effects || [])
    .filter((effect) => effect.type === 'resource' && effect.value > 0)
    .reduce((reward, effect) => {
      reward[effect.key] = (reward[effect.key] || 0) + effect.value;
      return reward;
    }, {});
}

module.exports = {
  calculateReward,
};
