(function (global) {
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

  const DEFAULT_GEOMETRY = {
    tileWidth: 192,
    tileHeight: 96,
    stepX: 96,
    stepY: 48,
    anchorY: 0.5,
    edgeOverdraw: 1.5,
  };

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeCoord(tile = {}, fallback = {}) {
    return TileCoord.normalizeCoord(tile, fallback);
  }

  function getViewportWorldOrigin(viewport = {}) {
    const source = viewport.worldOrigin || viewport.originCoord || viewport.renderOrigin || {};
    return normalizeCoord(source, { x: 0, y: 0 });
  }

  function getRelativeCoord(tile = {}, viewport = {}) {
    const coord = normalizeCoord(tile);
    const origin = getViewportWorldOrigin(viewport);
    return {
      x: coord.x - origin.x,
      y: coord.y - origin.y,
      q: coord.q - origin.q,
      r: coord.r - origin.r,
      tileId: coord.tileId,
    };
  }

  function normalizeGeometry(options = {}) {
    const tileWidth = Math.max(16, toNumber(options.tileWidth, DEFAULT_GEOMETRY.tileWidth));
    const tileHeight = Math.max(8, toNumber(options.tileHeight, DEFAULT_GEOMETRY.tileHeight));
    return {
      tileWidth,
      tileHeight,
      stepX: Math.max(1, toNumber(options.stepX, tileWidth * 0.5)),
      stepY: Math.max(1, toNumber(options.stepY, tileHeight * 0.5)),
      anchorY: Math.max(0, Math.min(1, toNumber(options.anchorY, DEFAULT_GEOMETRY.anchorY))),
    };
  }

  function projectTile(tile = {}, options = {}) {
    const geometry = normalizeGeometry(options);
    const coord = normalizeCoord(tile);
    return {
      x: (coord.x - coord.y) * geometry.stepX,
      y: (coord.x + coord.y) * geometry.stepY,
    };
  }

  function getTileDrawRect(center = {}, scale = 1, options = {}) {
    const geometry = normalizeGeometry(options);
    const safeScale = Math.max(0.05, toNumber(scale, 1));
    const edgeOverdraw = Math.max(0, toNumber(options.edgeOverdraw, DEFAULT_GEOMETRY.edgeOverdraw));
    const width = (geometry.tileWidth + edgeOverdraw * 2) * safeScale;
    const height = (geometry.tileHeight + edgeOverdraw) * safeScale;
    return {
      x: toNumber(center.x) - width * 0.5,
      y: toNumber(center.y) - height * geometry.anchorY,
      width,
      height,
    };
  }

  function getIsoSortValue(tile = {}) {
    const coord = normalizeCoord(tile);
    return coord.x + coord.y;
  }

  function sortTilesForIsoDraw(tiles = []) {
    return [...tiles].sort(
      (a, b) =>
        getIsoSortValue(a) - getIsoSortValue(b) ||
        normalizeCoord(a).y - normalizeCoord(b).y ||
        normalizeCoord(a).x - normalizeCoord(b).x ||
        String(a.id || '').localeCompare(String(b.id || '')),
    );
  }

  function getBounds(tiles = [], options = {}) {
    if (!Array.isArray(tiles) || !tiles.length) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    }
    const geometry = normalizeGeometry(options);
    const points = tiles.map((tile) => projectTile(tile, geometry));
    const halfW = geometry.tileWidth * 0.5;
    const halfH = geometry.tileHeight * 0.5;
    const minX = Math.min(...points.map((point) => point.x - halfW));
    const maxX = Math.max(...points.map((point) => point.x + halfW));
    const minY = Math.min(...points.map((point) => point.y - halfH));
    const maxY = Math.max(...points.map((point) => point.y + halfH));
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  function getTileScreenCenter(tile = {}, viewport = {}, options = {}) {
    const geometry = normalizeGeometry(options);
    const projected = projectTile(getRelativeCoord(tile, viewport), geometry);
    return {
      x:
        toNumber(viewport.originX) +
        toNumber(viewport.panX) +
        projected.x * toNumber(viewport.scale, 1),
      y:
        toNumber(viewport.originY) +
        toNumber(viewport.panY) +
        projected.y * toNumber(viewport.scale, 1),
    };
  }

  function screenPointToCoord(point = {}, viewport = {}, options = {}) {
    const geometry = normalizeGeometry(options);
    const scale = Math.max(0.0001, toNumber(viewport.scale, 1));
    const localX =
      (toNumber(point.x) - toNumber(viewport.originX) - toNumber(viewport.panX)) / scale;
    const localY =
      (toNumber(point.y) - toNumber(viewport.originY) - toNumber(viewport.panY)) / scale;
    const projectedXMinusY = localX / geometry.stepX;
    const projectedXPlusY = localY / geometry.stepY;
    const origin = getViewportWorldOrigin(viewport);
    const x = Math.round((projectedXMinusY + projectedXPlusY) / 2) + origin.x;
    const y = Math.round((projectedXPlusY - projectedXMinusY) / 2) + origin.y;
    return normalizeCoord({ x, y });
  }

  function tileId(x, y) {
    return TileCoord.tileId(x, y);
  }

  const TileMapGeometry = {
    DEFAULT_GEOMETRY,
    getRelativeCoord,
    getViewportWorldOrigin,
    normalizeCoord,
    normalizeGeometry,
    projectTile,
    getTileDrawRect,
    getIsoSortValue,
    sortTilesForIsoDraw,
    getBounds,
    getTileScreenCenter,
    screenPointToCoord,
    tileId,
  };

  global.TileMapGeometry = TileMapGeometry;
  if (typeof module !== 'undefined' && module.exports) module.exports = TileMapGeometry;
})(typeof globalThis !== 'undefined' ? globalThis : window);
