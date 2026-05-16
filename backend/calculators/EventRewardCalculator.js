function calculateReward(option) {
  return { ...(option?.reward || {}) };
}

module.exports = {
  calculateReward,
};
