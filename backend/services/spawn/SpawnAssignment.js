function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function getCoordinateKey(q, r) {
  return `${toInteger(q, 0)},${toInteger(r, 0)}`;
}

function normalizeSpawnAssignment(rawAssignment = {}) {
  const raw = rawAssignment && typeof rawAssignment === 'object' ? rawAssignment : {};
  const q = toInteger(raw.q ?? raw.x, 0);
  const r = toInteger(raw.r ?? raw.y, 0);
  return {
    ...raw,
    q,
    r,
    x: q,
    y: r,
    spawnKey: raw.spawnKey || getCoordinateKey(q, r),
  };
}

function getSpawnOrigin(rawAssignment = {}) {
  const spawn = normalizeSpawnAssignment(rawAssignment);
  return {
    q: spawn.q,
    r: spawn.r,
    x: spawn.q,
    y: spawn.r,
  };
}

module.exports = {
  getCoordinateKey,
  getSpawnOrigin,
  normalizeSpawnAssignment,
};
