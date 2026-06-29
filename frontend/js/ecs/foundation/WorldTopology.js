(function (global) {
  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./TileCoord');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const DEFAULT_WORLD_SIZE = Object.freeze({
    width: 1024,
    height: 1024,
    wrapping: true,
  });

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toPositiveInteger(value, fallback) {
    const number = Math.floor(toNumber(value, fallback));
    return number > 0 ? number : fallback;
  }

  function modulo(value, size) {
    const safeSize = toPositiveInteger(size, 1);
    return ((Math.floor(toNumber(value, 0)) % safeSize) + safeSize) % safeSize;
  }

  function normalizeWorldSize(options = {}) {
    return Object.freeze({
      width: toPositiveInteger(options.width ?? options.worldWidth, DEFAULT_WORLD_SIZE.width),
      height: toPositiveInteger(options.height ?? options.worldHeight, DEFAULT_WORLD_SIZE.height),
      wrapping: options.wrapping === undefined ? true : options.wrapping !== false,
    });
  }

  function normalizeCoord(coord = {}, options = {}) {
    const size = normalizeWorldSize(options);
    const normalized = TileCoord.normalizeCoord(coord);
    const x = size.wrapping ? modulo(normalized.x, size.width) : normalized.x;
    const y = size.wrapping ? modulo(normalized.y, size.height) : normalized.y;
    return Object.freeze({
      x,
      y,
      q: x,
      r: y,
      tileId: TileCoord.tileId(x, y),
      worldWidth: size.width,
      worldHeight: size.height,
      wrapped: size.wrapping,
    });
  }

  function wrapDelta(delta, size) {
    const safeSize = toPositiveInteger(size, 1);
    const raw = Math.floor(toNumber(delta, 0));
    if (Math.abs(raw) * 2 <= safeSize) return raw;
    const wrapped = raw > 0 ? raw - safeSize : raw + safeSize;
    if (Math.abs(wrapped) < Math.abs(raw)) return wrapped;
    return raw;
  }

  function getDelta(from = {}, to = {}, options = {}) {
    const size = normalizeWorldSize(options);
    const start = normalizeCoord(from, size);
    const end = normalizeCoord(to, size);
    const rawX = end.x - start.x;
    const rawY = end.y - start.y;
    const x = size.wrapping ? wrapDelta(rawX, size.width) : rawX;
    const y = size.wrapping ? wrapDelta(rawY, size.height) : rawY;
    return Object.freeze({
      x,
      y,
      q: x,
      r: y,
    });
  }

  function getWrappedDistance(from = {}, to = {}, options = {}) {
    const delta = getDelta(from, to, options);
    return Math.max(Math.abs(delta.x), Math.abs(delta.y));
  }

  function offset(coord = {}, delta = {}, options = {}) {
    const source = normalizeCoord(coord, { ...options, wrapping: false });
    const step = TileCoord?.normalizeDelta
      ? TileCoord.normalizeDelta(delta)
      : {
          x: Math.floor(toNumber(delta.x ?? delta.q, 0)),
          y: Math.floor(toNumber(delta.y ?? delta.r, 0)),
        };
    return normalizeCoord(
      {
        x: source.x + step.x,
        y: source.y + step.y,
      },
      options,
    );
  }

  const WorldTopology = Object.freeze({
    DEFAULT_WORLD_SIZE,
    getDelta,
    getWrappedDistance,
    modulo,
    normalizeCoord,
    normalizeWorldSize,
    offset,
    wrapDelta,
  });

  global.WorldTopology = WorldTopology;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldTopology;
})(typeof globalThis !== 'undefined' ? globalThis : window);
