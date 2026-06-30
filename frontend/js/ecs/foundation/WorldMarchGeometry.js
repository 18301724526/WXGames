(function (global) {
  const TileMapGeometry = (() => {
    if (global.TileMapGeometry) return global.TileMapGeometry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./TileMapGeometry');
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
      } catch (_error) {
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
    return TileCoord.tileId(q, r);
  }

  function normalizeCoord(source = {}, fallback = {}) {
    return TileCoord.normalizeCoord(source, fallback);
  }

  function getViewportWorldOrigin(viewport = {}) {
    return normalizeCoord(
      viewport.worldOrigin || viewport.originCoord || viewport.renderOrigin || {},
    );
  }

  function hasFractionalAxis(coord = {}) {
    const x = coord?.x !== undefined ? Number(coord.x) : Number(coord?.q);
    const y = coord?.y !== undefined ? Number(coord.y) : Number(coord?.r);
    return (
      (Number.isFinite(x) && !Number.isInteger(x)) || (Number.isFinite(y) && !Number.isInteger(y))
    );
  }

  function getContinuousTileScreenCenter(coord = {}, viewport = {}, geometry = {}) {
    const stepX = toNumber(geometry.stepX, 96);
    const stepY = toNumber(geometry.stepY, 48);
    const origin = getViewportWorldOrigin(viewport);
    const q = toNumber(coord.q ?? coord.x, 0);
    const r = toNumber(coord.r ?? coord.y, 0);
    return {
      x:
        toNumber(viewport.originX) +
        toNumber(viewport.panX) +
        (q - origin.q - (r - origin.r)) * stepX * toNumber(viewport.scale, 1),
      y:
        toNumber(viewport.originY) +
        toNumber(viewport.panY) +
        (q - origin.q + (r - origin.r)) * stepY * toNumber(viewport.scale, 1),
    };
  }

  function getTileScreenCenter(coord = {}, viewport = {}, geometry = {}) {
    if (hasFractionalAxis(coord)) {
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
        const coord = normalizeCoord(tile);
        best = {
          id: coord.tileId,
          q: coord.q,
          r: coord.r,
          tileId: coord.tileId,
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
    const localX =
      (toNumber(point.x) - toNumber(viewport.originX) - toNumber(viewport.panX)) / scale;
    const localY =
      (toNumber(point.y) - toNumber(viewport.originY) - toNumber(viewport.panY)) / scale;
    const projectedQMinusR = localX / stepX;
    const projectedQPlusR = localY / stepY;
    const origin = getViewportWorldOrigin(viewport);
    const q = Math.round((projectedQMinusR + projectedQPlusR) / 2) + origin.q;
    const r = Math.round((projectedQPlusR - projectedQMinusR) / 2) + origin.r;
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
    if (
      !Number.isFinite(Number(target.x ?? target.q)) ||
      !Number.isFinite(Number(target.y ?? target.r))
    )
      return null;
    const coord = normalizeCoord(target);
    const result = {
      q: coord.q,
      r: coord.r,
      tileId: coord.tileId,
      known: target.known === undefined ? undefined : Boolean(target.known),
      terrain: target.terrain || '',
      terrainLabel: target.terrainLabel || '',
    };
    if (target.marchDisabled !== undefined) result.marchDisabled = Boolean(target.marchDisabled);
    if (target.marchDisabledReason) result.marchDisabledReason = target.marchDisabledReason;
    if (target.missionId || target.actorId) {
      result.missionId = target.missionId || target.actorId;
      result.actorId = target.actorId || target.missionId;
    }
    if (target.combatEncounterId || target.encounterId || target.combatTarget?.encounterId) {
      result.combatEncounterId =
        target.combatEncounterId || target.encounterId || target.combatTarget?.encounterId;
    }
    if (target.combatTarget && typeof target.combatTarget === 'object') {
      result.combatTarget = JSON.parse(JSON.stringify(target.combatTarget));
    }
    return result;
  }

  const WorldMarchGeometry = Object.freeze({
    toNumber,
    toInteger,
    tileId,
    getContinuousTileScreenCenter,
    getViewportWorldOrigin,
    getTileScreenCenter,
    screenPointToNearestTile,
    screenPointToAxialTile,
    getMarchTargetUiState,
  });

  global.WorldMarchGeometry = WorldMarchGeometry;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMarchGeometry;
})(typeof window !== 'undefined' ? window : globalThis);
