(function (global) {
  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    const number = toNumber(value, fallback);
    return Number.isFinite(number) ? Math.floor(number) : fallback;
  }

  function tileId(x, y) {
    return `tile_${toInteger(x)}_${toInteger(y)}`;
  }

  function readCoordAxis(source = {}, primaryKey = 'x', aliasKey = 'q', fallback = 0) {
    return toInteger(
      source[primaryKey] !== undefined ? source[primaryKey] : source[aliasKey],
      fallback,
    );
  }

  function normalizeCoord(source = {}, fallback = {}, options = {}) {
    const fallbackX = readCoordAxis(fallback, 'x', 'q', 0);
    const fallbackY = readCoordAxis(fallback, 'y', 'r', 0);
    const x = readCoordAxis(source, 'x', 'q', fallbackX);
    const y = readCoordAxis(source, 'y', 'r', fallbackY);
    const id = options.preserveTileId
      ? String(source.tileId || source.id || tileId(x, y))
      : tileId(x, y);
    return Object.freeze({
      x,
      y,
      q: x,
      r: y,
      tileId: id,
    });
  }

  function normalizeDelta(delta = {}) {
    return Object.freeze({
      x: readCoordAxis(delta, 'x', 'q', 0),
      y: readCoordAxis(delta, 'y', 'r', 0),
    });
  }

  function offset(coord = {}, delta = {}, options = {}) {
    const source = normalizeCoord(coord);
    const step = normalizeDelta(delta);
    return normalizeCoord(
      {
        x: source.x + step.x,
        y: source.y + step.y,
      },
      {},
      options,
    );
  }

  function equals(left = {}, right = {}) {
    const a = normalizeCoord(left);
    const b = normalizeCoord(right);
    return a.x === b.x && a.y === b.y;
  }

  function toAxial(coord = {}) {
    const normalized = normalizeCoord(coord);
    return Object.freeze({
      q: normalized.x,
      r: normalized.y,
      tileId: normalized.tileId,
    });
  }

  const TileCoord = Object.freeze({
    equals,
    normalizeCoord,
    normalizeDelta,
    offset,
    readCoordAxis,
    tileId,
    toAxial,
    toInteger,
    toNumber,
  });

  global.TileCoord = TileCoord;
  if (typeof module !== 'undefined' && module.exports) module.exports = TileCoord;
})(typeof globalThis !== 'undefined' ? globalThis : window);
