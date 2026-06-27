(function (global) {
  const SignatureHash = (() => {
    if (global.SignatureHash) return global.SignatureHash;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../shared/SignatureHash');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

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

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
  }

  function createIndex() {
    return Object.create(null);
  }

  function normalizeCoord(source = {}) {
    return TileCoord.normalizeCoord(source);
  }

  function normalizeTileRecord(tile = {}, options = {}) {
    const coord = normalizeCoord(tile);
    const chunk = WorldChunkAddress?.getChunkCoordForTile
      ? WorldChunkAddress.getChunkCoordForTile(coord, options)
      : { chunkId: '' };
    return Object.freeze({
      tileId: coord.tileId,
      x: coord.x,
      y: coord.y,
      q: coord.x,
      r: coord.y,
      chunkId: chunk.chunkId || '',
      terrain: tile.terrain || 'unknown',
      visibility: tile.visibility || (tile.visible ? 'visible' : 'explored'),
      intelLevel: Math.max(0, toInteger(tile.intelLevel ?? tile.intel?.level, tile.visible ? 2 : 1)),
      siteId: tile.siteId || null,
      revealedAt: tile.revealedAt || options.revealedAt || null,
      materialized: tile.materialized !== false,
    });
  }

  function hashStep(hash, value) {
    return SignatureHash.hashStep(hash, value);
  }

  function createStore(input = {}, options = {}) {
    const records = Array.isArray(input.records)
      ? input.records
      : (Array.isArray(input.tiles) ? input.tiles : []);
    const tiles = [];
    const indexById = createIndex();
    const chunkIndex = createIndex();
    const materializedChunkIds = new Set(Array.isArray(input.materializedChunkIds)
      ? input.materializedChunkIds.map(String)
      : []);
    for (const source of records) {
      const record = normalizeTileRecord(source, options);
      const existingIndex = indexById[record.tileId];
      if (existingIndex !== undefined) {
        tiles[existingIndex] = mergeTileRecord(tiles[existingIndex], record);
      } else {
        indexById[record.tileId] = tiles.length;
        tiles.push(record);
      }
      if (record.chunkId) {
        if (!chunkIndex[record.chunkId]) chunkIndex[record.chunkId] = [];
        if (!chunkIndex[record.chunkId].includes(record.tileId)) chunkIndex[record.chunkId].push(record.tileId);
        if (record.materialized) materializedChunkIds.add(record.chunkId);
      }
    }
    let hash = SignatureHash.FNV_OFFSET_BASIS;
    for (const record of tiles) {
      hash = hashStep(hash, record.tileId);
      hash = hashStep(hash, record.terrain);
      hash = hashStep(hash, record.visibility);
      hash = hashStep(hash, record.intelLevel);
      hash = hashStep(hash, record.siteId || '');
    }
    return Object.freeze({
      schema: 'world-reveal-store-v1',
      version: toInteger(input.version, 0),
      tiles: Object.freeze(tiles),
      indexById,
      chunkIndex,
      materializedChunkIds: Object.freeze([...materializedChunkIds].sort()),
      counts: Object.freeze({
        tiles: tiles.length,
        chunks: Object.keys(chunkIndex).length,
        materializedChunks: materializedChunkIds.size,
      }),
      signature: `${toInteger(input.version, 0)}:${tiles.length}:${materializedChunkIds.size}:${(hash >>> 0).toString(16)}`,
    });
  }

  function mergeTileRecord(previous = {}, next = {}) {
    return Object.freeze({
      ...previous,
      ...next,
      visibility: next.visibility === 'visible' || previous.visibility !== 'visible'
        ? next.visibility
        : previous.visibility,
      intelLevel: Math.max(toInteger(previous.intelLevel, 0), toInteger(next.intelLevel, 0)),
      siteId: next.siteId || previous.siteId || null,
      revealedAt: previous.revealedAt || next.revealedAt || null,
      materialized: previous.materialized !== false || next.materialized !== false,
    });
  }

  function getTile(store = {}, idOrCoord = '') {
    const id = typeof idOrCoord === 'string'
      ? idOrCoord
      : normalizeCoord(idOrCoord).tileId;
    const index = store.indexById?.[id];
    return Array.isArray(store.tiles) && index !== undefined ? store.tiles[index] : null;
  }

  function isRevealed(store = {}, idOrCoord = '') {
    return Boolean(getTile(store, idOrCoord));
  }

  function getTilesForChunk(store = {}, chunk = {}) {
    const chunkId = typeof chunk === 'string'
      ? chunk
      : (chunk.chunkId || WorldChunkAddress?.normalizeChunkCoord?.(chunk)?.chunkId || '');
    const ids = Array.isArray(store.chunkIndex?.[chunkId]) ? store.chunkIndex[chunkId] : [];
    return Object.freeze(ids.map((id) => getTile(store, id)).filter(Boolean));
  }

  function getTilesForWindow(store = {}, interestWindow = {}) {
    const chunkIds = [
      ...(Array.isArray(interestWindow.visibleChunks) ? interestWindow.visibleChunks : []),
      ...(Array.isArray(interestWindow.preloadChunks) ? interestWindow.preloadChunks : []),
    ].map((chunk) => chunk.chunkId).filter(Boolean);
    const seen = new Set();
    const result = [];
    for (const chunkId of chunkIds) {
      for (const tile of getTilesForChunk(store, chunkId)) {
        if (seen.has(tile.tileId)) continue;
        seen.add(tile.tileId);
        result.push(tile);
      }
    }
    return Object.freeze(result);
  }

  function toSerializable(store = {}) {
    return Object.freeze({
      schema: store.schema || 'world-reveal-store-v1',
      version: toInteger(store.version, 0),
      tiles: Array.isArray(store.tiles) ? store.tiles.map((tile) => ({ ...tile })) : [],
      materializedChunkIds: Array.isArray(store.materializedChunkIds) ? [...store.materializedChunkIds] : [],
      counts: { ...(store.counts || {}) },
      signature: store.signature || '',
    });
  }

  const WorldRevealStore = Object.freeze({
    createStore,
    getTile,
    getTilesForChunk,
    getTilesForWindow,
    isRevealed,
    mergeTileRecord,
    normalizeTileRecord,
    toSerializable,
  });

  global.WorldRevealStore = WorldRevealStore;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldRevealStore;
})(typeof globalThis !== 'undefined' ? globalThis : window);
