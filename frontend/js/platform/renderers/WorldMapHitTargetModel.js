(function (global) {
  const sharedWorldMapLayoutModel = (() => {
    if (global.WorldMapLayoutModel) return global.WorldMapLayoutModel;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapLayoutModel');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  function getLayoutModel(options = {}) {
    return options.layoutModel || sharedWorldMapLayoutModel || null;
  }

  function normalizeTileCoord(tile = {}, options = {}) {
    const helper = options.tileMapGeometry || null;
    if (helper?.normalizeCoord) return helper.normalizeCoord(tile);
    const toInteger = (value, fallback = 0) => {
      const number = Number(value);
      return Number.isFinite(number) ? Math.floor(number) : fallback;
    };
    const q = toInteger(tile.x !== undefined ? tile.x : tile.q, 0);
    const r = toInteger(tile.y !== undefined ? tile.y : tile.r, 0);
    return {
      x: q,
      y: r,
      q,
      r,
      tileId: `tile_${q}_${r}`,
    };
  }

  function toTarget(rect = {}, action = {}) {
    return { rect, action };
  }

  function getWorldMapDragHitTarget(frame = {}) {
    return toTarget({
      x: Number(frame.x) || 0,
      y: Number(frame.y) || 0,
      width: Number(frame.width) || 0,
      height: Number(frame.height) || 0,
    }, {
      type: 'worldMapDrag',
      background: true,
      inputSurface: 'worldMap',
    });
  }

  function createWorldTileSiteHitTargets(tileMapView = {}, viewport = {}, entries = [], options = {}) {
    const layoutModel = getLayoutModel(options);
    if (!layoutModel?.getWorldTileSiteLayout) return [];
    const geometry = tileMapView.geometry || {};
    const scale = Number(viewport.scale) || 1;
    const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
    const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
    const hitTargets = [];
    for (let index = 0; index < entries.length; index += 1) {
      const { tile, center } = entries[index] || {};
      if (!tile?.site) continue;
      const layout = layoutModel.getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center, options);
      if (!layout) continue;
      const coord = normalizeTileCoord(tile, options);
      hitTargets.push(toTarget(layout.hitRect, {
        type: 'openWorldSite',
        siteId: layout.site.id,
        tileId: coord.tileId,
        inputSurface: 'worldMap',
      }));
    }
    return hitTargets;
  }

  function createWorldMarchTileHitTargets(tileMapView = {}, viewport = {}, frame = {}, options = {}) {
    const layoutModel = getLayoutModel(options);
    if (!layoutModel?.getWorldTileScreenCenter) return [];
    const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
    if (!tiles.length) return [];
    const geometry = tileMapView.geometry || {};
    const frameX = Number(frame.x) || 0;
    const frameY = Number(frame.y) || 0;
    const frameWidth = Number(frame.width) || 0;
    const frameHeight = Number(frame.height) || 0;
    const scale = Number(viewport.scale) || 1;
    const tileWidth = (Number(geometry.tileWidth) || 192) * scale * 0.86;
    const tileHeight = (Number(geometry.tileHeight) || 96) * scale * 0.86;
    const marginX = Number(options.marginX) || 48;
    const marginY = Number(options.marginY) || 32;
    const hitTargets = [];
    for (let index = 0; index < tiles.length; index += 1) {
      const tile = tiles[index];
      const coord = normalizeTileCoord(tile, options);
      const center = layoutModel.getWorldTileScreenCenter(tile, viewport, geometry, options);
      if (
        center.x < frameX - marginX
        || center.x > frameX + frameWidth + marginX
        || center.y < frameY - marginY
        || center.y > frameY + frameHeight + marginY
      ) continue;
      hitTargets.push(toTarget({
        x: center.x - tileWidth / 2,
        y: center.y - tileHeight / 2,
        width: tileWidth,
        height: tileHeight,
      }, {
        type: 'selectWorldMarchTarget',
        tileId: coord.tileId,
        targetQ: coord.q,
        targetR: coord.r,
        known: tile.visibility !== 'unknown' && tile.discovered !== false,
        terrain: tile.terrain || '',
        terrainLabel: tile.terrainLabel || tile.terrain || '',
        background: true,
        inputSurface: 'worldMap',
      }));
    }
    return hitTargets;
  }

  const api = {
    getWorldMapDragHitTarget,
    normalizeTileCoord,
    createWorldTileSiteHitTargets,
    createWorldMarchTileHitTargets,
  };

  global.WorldMapHitTargetModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
