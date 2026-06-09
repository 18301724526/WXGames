(function (global) {
  const TileMapGeometry = (() => {
    if (global.TileMapGeometry) return global.TileMapGeometry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./TileMapGeometry');
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
    const number = toNumber(value, fallback);
    return Number.isFinite(number) ? Math.floor(number) : fallback;
  }

  function tileId(q, r) {
    return `tile_${toInteger(q)}_${toInteger(r)}`;
  }

  function getContinuousTileScreenCenter(coord = {}, viewport = {}, geometry = {}) {
    const stepX = toNumber(geometry.stepX, 96);
    const stepY = toNumber(geometry.stepY, 48);
    const q = toNumber(coord.q ?? coord.x, 0);
    const r = toNumber(coord.r ?? coord.y, 0);
    return {
      x: toNumber(viewport.originX) + toNumber(viewport.panX) + (q - r) * stepX * toNumber(viewport.scale, 1),
      y: toNumber(viewport.originY) + toNumber(viewport.panY) + (q + r) * stepY * toNumber(viewport.scale, 1),
    };
  }

  function getTileScreenCenter(coord = {}, viewport = {}, geometry = {}) {
    if (Number.isFinite(Number(coord?.q)) && !Number.isInteger(Number(coord.q))) {
      return getContinuousTileScreenCenter(coord, viewport, geometry);
    }
    if (Number.isFinite(Number(coord?.r)) && !Number.isInteger(Number(coord.r))) {
      return getContinuousTileScreenCenter(coord, viewport, geometry);
    }
    const helper = TileMapGeometry?.getTileScreenCenter;
    if (typeof helper === 'function') return helper(coord, viewport, geometry);
    return getContinuousTileScreenCenter(coord, viewport, geometry);
  }

  function screenPointToNearestTile(point = {}, tileMapView = {}, viewport = {}) {
    const geometry = tileMapView.geometry || viewport.geometry || {};
    let best = null;
    (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : []).forEach((tile) => {
      const center = getTileScreenCenter(tile, viewport, geometry);
      const dx = toNumber(point.x) - center.x;
      const dy = toNumber(point.y) - center.y;
      const distance = dx * dx + dy * dy;
      if (!best || distance < best.distance) {
        best = {
          id: tile.id || tileId(tile.q, tile.r),
          q: toInteger(tile.q),
          r: toInteger(tile.r),
          tileId: tile.id || tileId(tile.q, tile.r),
          center,
          distance,
          tile,
        };
      }
    });
    return best;
  }

  function screenPointToAxialTile(point = {}, viewport = {}, geometry = {}) {
    const scale = Math.max(0.0001, toNumber(viewport.scale, 1));
    const stepX = Math.max(1, toNumber(geometry.stepX, 96));
    const stepY = Math.max(1, toNumber(geometry.stepY, 48));
    const localX = (toNumber(point.x) - toNumber(viewport.originX) - toNumber(viewport.panX)) / scale;
    const localY = (toNumber(point.y) - toNumber(viewport.originY) - toNumber(viewport.panY)) / scale;
    const projectedQMinusR = localX / stepX;
    const projectedQPlusR = localY / stepY;
    const q = Math.round((projectedQMinusR + projectedQPlusR) / 2);
    const r = Math.round((projectedQPlusR - projectedQMinusR) / 2);
    return {
      id: tileId(q, r),
      q,
      r,
      tileId: tileId(q, r),
      center: getTileScreenCenter({ q, r }, viewport, geometry),
      tile: null,
      inferred: true,
    };
  }

  function getMarchTargetUiState(uiState = {}) {
    const target = uiState.worldMarchTarget || null;
    if (!target || typeof target !== 'object') return null;
    const q = toInteger(target.q, NaN);
    const r = toInteger(target.r, NaN);
    if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
    return {
      q,
      r,
      tileId: target.tileId || tileId(q, r),
      pickerOpen: Boolean(target.pickerOpen),
      known: target.known === undefined ? undefined : Boolean(target.known),
      terrain: target.terrain || '',
      terrainLabel: target.terrainLabel || '',
    };
  }

  const WorldMarchGeometry = Object.freeze({
    toNumber,
    toInteger,
    tileId,
    getContinuousTileScreenCenter,
    getTileScreenCenter,
    screenPointToNearestTile,
    screenPointToAxialTile,
    getMarchTargetUiState,
  });

  global.WorldMarchGeometry = WorldMarchGeometry;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMarchGeometry;
})(typeof window !== 'undefined' ? window : globalThis);
