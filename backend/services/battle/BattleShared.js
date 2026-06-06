function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAttributes(raw = {}) {
  const strategy = raw.intelligence ?? raw.strategy;
  const politics = raw.politics ?? raw.governance;
  return {
    command: toInteger(raw.command, 50),
    force: toInteger(raw.force, 50),
    intelligence: toInteger(strategy, 50),
    strategy: toInteger(strategy, 50),
    charisma: toInteger(raw.charisma, 50),
    politics: toInteger(politics, 50),
    speed: toInteger(raw.speed, Math.round(
      toInteger(raw.force, 50) * 0.28
      + toInteger(raw.command, 50) * 0.24
      + toInteger(strategy, 50) * 0.18
      + toInteger(raw.charisma, 50) * 0.14
      + toInteger(politics, 50) * 0.06,
    )),
  };
}

function getBattleVisualGroups(soldiers, groupSize) {
  const total = Math.max(0, toInteger(soldiers, 0));
  if (total <= 0) return [];
  const count = Math.ceil(total / groupSize);
  return Array.from({ length: count }, (_, index) => {
    const remaining = total - index * groupSize;
    return {
      index: index + 1,
      soldiers: Math.max(0, Math.min(groupSize, remaining)),
      capacity: groupSize,
    };
  });
}

module.exports = {
  clamp,
  clone,
  getBattleVisualGroups,
  normalizeAttributes,
  toInteger,
};
