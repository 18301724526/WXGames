function roundOffset(value) {
  return Math.round(value * 100) / 100;
}

function seededNoise(seed) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function createVisualOffset(x, y, seedHint = '') {
  if (x === 0 && y === 0) return { x: 0, y: 0 };
  const seed = Math.abs((x * 92821) + (y * 68917) + String(seedHint).length * 131);
  const distance = Math.max(1, Math.max(Math.abs(x), Math.abs(y)));
  const lateralX = (seededNoise(seed + 11) - 0.5) * 0.44;
  const lateralY = (seededNoise(seed + 23) - 0.5) * 0.44;
  const radial = (seededNoise(seed + 37) - 0.5) * 0.22;
  return {
    x: roundOffset(lateralX + (x / distance) * radial),
    y: roundOffset(lateralY + (y / distance) * radial),
  };
}

function normalizeVisualOffset(rawOffset, x, y, seedHint = '') {
  if (rawOffset && typeof rawOffset === 'object') {
    const offsetX = Number(rawOffset.x);
    const offsetY = Number(rawOffset.y);
    if (Number.isFinite(offsetX) && Number.isFinite(offsetY)) {
      return {
        x: roundOffset(Math.max(-0.55, Math.min(0.55, offsetX))),
        y: roundOffset(Math.max(-0.55, Math.min(0.55, offsetY))),
      };
    }
  }
  return createVisualOffset(x, y, seedHint);
}

module.exports = {
  createVisualOffset,
  normalizeVisualOffset,
  roundOffset,
  seededNoise,
};
