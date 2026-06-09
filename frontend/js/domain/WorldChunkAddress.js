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

  const DEFAULT_CHUNK_SIZE = Object.freeze({
    width: 32,
    height: 32,
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

  function modulo(value, size) {
    const safeSize = toPositiveInteger(size, 1);
    return ((toInteger(value) % safeSize) + safeSize) % safeSize;
  }

  function normalizeChunkSize(options = {}) {
    return Object.freeze({
      width: toPositiveInteger(options.chunkWidth ?? options.width, DEFAULT_CHUNK_SIZE.width),
      height: toPositiveInteger(options.chunkHeight ?? options.height, DEFAULT_CHUNK_SIZE.height),
    });
  }

  function normalizeWorldSize(options = {}) {
    if (WorldTopology?.normalizeWorldSize) return WorldTopology.normalizeWorldSize(options);
    return Object.freeze({
      width: toPositiveInteger(options.worldWidth ?? options.width, 1024),
      height: toPositiveInteger(options.worldHeight ?? options.height, 1024),
      wrapping: options.wrapping === undefined ? true : options.wrapping !== false,
    });
  }

  function normalizeTopologyOptions(options = {}) {
    const world = normalizeWorldSize(options);
    const chunk = normalizeChunkSize(options);
    return Object.freeze({
      worldWidth: world.width,
      worldHeight: world.height,
      wrapping: world.wrapping,
      chunkWidth: chunk.width,
      chunkHeight: chunk.height,
      columns: Math.max(1, Math.ceil(world.width / chunk.width)),
      rows: Math.max(1, Math.ceil(world.height / chunk.height)),
    });
  }

  function chunkId(chunkX, chunkY) {
    return `chunk_${toInteger(chunkX)}_${toInteger(chunkY)}`;
  }

  function normalizeChunkCoord(input = {}, options = {}) {
    const topology = normalizeTopologyOptions(options);
    const rawX = toInteger(input.chunkX ?? input.col ?? input.x, 0);
    const rawY = toInteger(input.chunkY ?? input.row ?? input.y, 0);
    const chunkX = topology.wrapping ? modulo(rawX, topology.columns) : rawX;
    const chunkY = topology.wrapping ? modulo(rawY, topology.rows) : rawY;
    return Object.freeze({
      chunkX,
      chunkY,
      col: chunkX,
      row: chunkY,
      chunkId: chunkId(chunkX, chunkY),
      chunkWidth: topology.chunkWidth,
      chunkHeight: topology.chunkHeight,
      worldWidth: topology.worldWidth,
      worldHeight: topology.worldHeight,
      wrapped: topology.wrapping,
    });
  }

  function normalizeTileCoord(tile = {}, options = {}) {
    if (WorldTopology?.normalizeCoord) return WorldTopology.normalizeCoord(tile, options);
    const coord = TileCoord?.normalizeCoord
      ? TileCoord.normalizeCoord(tile)
      : {
        x: toInteger(tile.x ?? tile.q, 0),
        y: toInteger(tile.y ?? tile.r, 0),
      };
    const world = normalizeWorldSize(options);
    const x = world.wrapping ? modulo(coord.x, world.width) : coord.x;
    const y = world.wrapping ? modulo(coord.y, world.height) : coord.y;
    return Object.freeze({
      x,
      y,
      q: x,
      r: y,
      tileId: TileCoord?.tileId ? TileCoord.tileId(x, y) : `tile_${x}_${y}`,
    });
  }

  function getChunkCoordForTile(tile = {}, options = {}) {
    const topology = normalizeTopologyOptions(options);
    const coord = normalizeTileCoord(tile, {
      width: topology.worldWidth,
      height: topology.worldHeight,
      wrapping: topology.wrapping,
    });
    return normalizeChunkCoord({
      chunkX: Math.floor(coord.x / topology.chunkWidth),
      chunkY: Math.floor(coord.y / topology.chunkHeight),
    }, topology);
  }

  function getChunkBounds(chunk = {}, options = {}) {
    const topology = normalizeTopologyOptions(options);
    const coord = normalizeChunkCoord(chunk, topology);
    const minX = coord.chunkX * topology.chunkWidth;
    const minY = coord.chunkY * topology.chunkHeight;
    const maxX = Math.min(topology.worldWidth - 1, minX + topology.chunkWidth - 1);
    const maxY = Math.min(topology.worldHeight - 1, minY + topology.chunkHeight - 1);
    return Object.freeze({
      chunkId: coord.chunkId,
      chunkX: coord.chunkX,
      chunkY: coord.chunkY,
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(0, maxX - minX + 1),
      height: Math.max(0, maxY - minY + 1),
    });
  }

  function getWrappedRanges(minValue, maxValue, size, wrapping = true) {
    const safeSize = toPositiveInteger(size, 1);
    const min = toInteger(minValue, 0);
    const max = toInteger(maxValue, min);
    if (!wrapping) {
      const start = Math.max(0, min);
      const end = Math.min(safeSize - 1, max);
      return start <= end ? [Object.freeze({ start, end })] : [];
    }
    const span = max - min + 1;
    if (span >= safeSize) return [Object.freeze({ start: 0, end: safeSize - 1 })];
    const start = modulo(min, safeSize);
    const end = modulo(max, safeSize);
    if (start <= end) return [Object.freeze({ start, end })];
    return Object.freeze([
      Object.freeze({ start, end: safeSize - 1 }),
      Object.freeze({ start: 0, end }),
    ]);
  }

  function getChunksForTileRect(rect = {}, options = {}) {
    const topology = normalizeTopologyOptions(options);
    const minX = toInteger(rect.minX ?? rect.x, 0);
    const minY = toInteger(rect.minY ?? rect.y, 0);
    const maxX = rect.maxX !== undefined
      ? toInteger(rect.maxX, minX)
      : minX + Math.max(0, toInteger(rect.width, 1) - 1);
    const maxY = rect.maxY !== undefined
      ? toInteger(rect.maxY, minY)
      : minY + Math.max(0, toInteger(rect.height, 1) - 1);
    const xRanges = getWrappedRanges(minX, maxX, topology.worldWidth, topology.wrapping);
    const yRanges = getWrappedRanges(minY, maxY, topology.worldHeight, topology.wrapping);
    const chunksById = new Map();
    for (const xRange of xRanges) {
      const startChunkX = Math.floor(xRange.start / topology.chunkWidth);
      const endChunkX = Math.floor(xRange.end / topology.chunkWidth);
      for (const yRange of yRanges) {
        const startChunkY = Math.floor(yRange.start / topology.chunkHeight);
        const endChunkY = Math.floor(yRange.end / topology.chunkHeight);
        for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += 1) {
          for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += 1) {
            const chunk = normalizeChunkCoord({ chunkX, chunkY }, topology);
            if (!chunksById.has(chunk.chunkId)) chunksById.set(chunk.chunkId, chunk);
          }
        }
      }
    }
    return Object.freeze([...chunksById.values()].sort((a, b) => (
      a.chunkY - b.chunkY || a.chunkX - b.chunkX
    )));
  }

  function containsTile(chunk = {}, tile = {}, options = {}) {
    const expected = getChunkCoordForTile(tile, options);
    const actual = normalizeChunkCoord(chunk, options);
    return expected.chunkX === actual.chunkX && expected.chunkY === actual.chunkY;
  }

  const WorldChunkAddress = Object.freeze({
    DEFAULT_CHUNK_SIZE,
    chunkId,
    containsTile,
    getChunkBounds,
    getChunkCoordForTile,
    getChunksForTileRect,
    getWrappedRanges,
    normalizeChunkCoord,
    normalizeChunkSize,
    normalizeTopologyOptions,
  });

  global.WorldChunkAddress = WorldChunkAddress;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldChunkAddress;
})(typeof globalThis !== 'undefined' ? globalThis : window);
