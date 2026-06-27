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

  const WorldTopology = (() => {
    if (global.WorldTopology) return global.WorldTopology;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldTopology');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const WorldChunkAddress = (() => {
    if (global.WorldChunkAddress) return global.WorldChunkAddress;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldChunkAddress');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const DEFAULT_WINDOW = Object.freeze({
    radiusX: 12,
    radiusY: 8,
    preloadRadiusX: 20,
    preloadRadiusY: 14,
    aoiRadiusX: 28,
    aoiRadiusY: 20,
  });

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
  }

  function toPositiveInteger(value, fallback) {
    const number = toInteger(value, fallback);
    return number > 0 ? number : fallback;
  }

  function normalizeCoord(coord = {}, options = {}) {
    return WorldTopology.normalizeCoord(coord, options);
  }

  function normalizeWindowOptions(options = {}) {
    const radiusX = toPositiveInteger(options.radiusX ?? options.radius, DEFAULT_WINDOW.radiusX);
    const radiusY = toPositiveInteger(options.radiusY ?? options.radius, DEFAULT_WINDOW.radiusY);
    const preloadRadiusX = Math.max(radiusX, toPositiveInteger(
      options.preloadRadiusX ?? options.preloadRadius,
      DEFAULT_WINDOW.preloadRadiusX,
    ));
    const preloadRadiusY = Math.max(radiusY, toPositiveInteger(
      options.preloadRadiusY ?? options.preloadRadius,
      DEFAULT_WINDOW.preloadRadiusY,
    ));
    const aoiRadiusX = Math.max(preloadRadiusX, toPositiveInteger(
      options.aoiRadiusX ?? options.aoiRadius,
      DEFAULT_WINDOW.aoiRadiusX,
    ));
    const aoiRadiusY = Math.max(preloadRadiusY, toPositiveInteger(
      options.aoiRadiusY ?? options.aoiRadius,
      DEFAULT_WINDOW.aoiRadiusY,
    ));
    return Object.freeze({
      radiusX,
      radiusY,
      preloadRadiusX,
      preloadRadiusY,
      aoiRadiusX,
      aoiRadiusY,
    });
  }

  function createTileRect(center = {}, radiusX = DEFAULT_WINDOW.radiusX, radiusY = DEFAULT_WINDOW.radiusY) {
    const coord = TileCoord?.normalizeCoord
      ? TileCoord.normalizeCoord(center)
      : {
        x: toInteger(center.x ?? center.q, 0),
        y: toInteger(center.y ?? center.r, 0),
      };
    const rx = toPositiveInteger(radiusX, DEFAULT_WINDOW.radiusX);
    const ry = toPositiveInteger(radiusY, DEFAULT_WINDOW.radiusY);
    return Object.freeze({
      centerX: coord.x,
      centerY: coord.y,
      minX: coord.x - rx,
      minY: coord.y - ry,
      maxX: coord.x + rx,
      maxY: coord.y + ry,
      width: rx * 2 + 1,
      height: ry * 2 + 1,
    });
  }

  function createChunkList(rect = {}, options = {}) {
    return WorldChunkAddress?.getChunksForTileRect
      ? WorldChunkAddress.getChunksForTileRect(rect, options)
      : Object.freeze([]);
  }

  function createWindow(center = {}, options = {}) {
    const windowOptions = normalizeWindowOptions(options);
    const topology = WorldChunkAddress?.normalizeTopologyOptions
      ? WorldChunkAddress.normalizeTopologyOptions(options)
      : Object.freeze({ ...options });
    const normalizedCenter = normalizeCoord(center, options);
    const visibleRect = createTileRect(normalizedCenter, windowOptions.radiusX, windowOptions.radiusY);
    const preloadRect = createTileRect(normalizedCenter, windowOptions.preloadRadiusX, windowOptions.preloadRadiusY);
    const aoiRect = createTileRect(normalizedCenter, windowOptions.aoiRadiusX, windowOptions.aoiRadiusY);
    const visibleChunks = createChunkList(visibleRect, topology);
    const preloadChunks = createChunkList(preloadRect, topology);
    const aoiChunks = createChunkList(aoiRect, topology);
    return Object.freeze({
      schema: 'world-interest-window-v1',
      topology,
      center: normalizedCenter,
      visibleRect,
      preloadRect,
      aoiRect,
      visibleChunks,
      preloadChunks,
      aoiChunks,
      counts: Object.freeze({
        visibleChunks: visibleChunks.length,
        preloadChunks: preloadChunks.length,
        aoiChunks: aoiChunks.length,
      }),
      signature: [
        normalizedCenter.tileId,
        visibleRect.width,
        visibleRect.height,
        preloadChunks.map((chunk) => chunk.chunkId).join(','),
        aoiChunks.map((chunk) => chunk.chunkId).join(','),
      ].join('|'),
    });
  }

  function getChunkIds(interestWindow = {}, key = 'preloadChunks') {
    const chunks = Array.isArray(interestWindow[key]) ? interestWindow[key] : [];
    return Object.freeze(chunks.map((chunk) => chunk.chunkId).filter(Boolean));
  }

  function containsTile(interestWindow = {}, tile = {}, key = 'visibleRect') {
    const rect = interestWindow[key] || {};
    const hasTopology = Boolean(interestWindow.topology);
    const coord = WorldTopology?.normalizeCoord
      ? WorldTopology.normalizeCoord(tile, interestWindow.topology || {})
      : (TileCoord?.normalizeCoord
        ? TileCoord.normalizeCoord(tile)
        : {
          x: toInteger(tile.x ?? tile.q, 0),
          y: toInteger(tile.y ?? tile.r, 0),
        });
    const topology = interestWindow.topology || {};
    const wrapping = hasTopology && (topology.wrapping === undefined ? true : topology.wrapping !== false);
    const xRanges = WorldChunkAddress?.getWrappedRanges
      ? WorldChunkAddress.getWrappedRanges(rect.minX, rect.maxX, topology.worldWidth, wrapping)
      : Object.freeze([Object.freeze({ start: toInteger(rect.minX), end: toInteger(rect.maxX) })]);
    const yRanges = WorldChunkAddress?.getWrappedRanges
      ? WorldChunkAddress.getWrappedRanges(rect.minY, rect.maxY, topology.worldHeight, wrapping)
      : Object.freeze([Object.freeze({ start: toInteger(rect.minY), end: toInteger(rect.maxY) })]);
    return xRanges.some((range) => coord.x >= range.start && coord.x <= range.end)
      && yRanges.some((range) => coord.y >= range.start && coord.y <= range.end);
  }

  const WorldInterestWindow = Object.freeze({
    DEFAULT_WINDOW,
    containsTile,
    createTileRect,
    createWindow,
    getChunkIds,
    normalizeWindowOptions,
  });

  global.WorldInterestWindow = WorldInterestWindow;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldInterestWindow;
})(typeof globalThis !== 'undefined' ? globalThis : window);
