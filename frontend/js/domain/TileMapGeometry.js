(function (global) {
  const DEFAULT_GEOMETRY = {
    tileWidth: 192,
    tileHeight: 96,
    stepX: 96,
    stepY: 48,
    anchorY: 0.5,
  };

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
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
    const q = toNumber(tile.q ?? tile.x, 0);
    const r = toNumber(tile.r ?? tile.y, 0);
    return {
      x: (q - r) * geometry.stepX,
      y: (q + r) * geometry.stepY,
    };
  }

  function getTileDrawRect(center = {}, scale = 1, options = {}) {
    const geometry = normalizeGeometry(options);
    const safeScale = Math.max(0.05, toNumber(scale, 1));
    const width = geometry.tileWidth * safeScale;
    const height = geometry.tileHeight * safeScale;
    return {
      x: toNumber(center.x) - width * 0.5,
      y: toNumber(center.y) - height * geometry.anchorY,
      width,
      height,
    };
  }

  function getIsoSortValue(tile = {}) {
    return toNumber(tile.q ?? tile.x, 0) + toNumber(tile.r ?? tile.y, 0);
  }

  function sortTilesForIsoDraw(tiles = []) {
    return [...tiles].sort((a, b) => (
      getIsoSortValue(a) - getIsoSortValue(b)
      || toNumber(a.r ?? a.y, 0) - toNumber(b.r ?? b.y, 0)
      || toNumber(a.q ?? a.x, 0) - toNumber(b.q ?? b.x, 0)
      || String(a.id || '').localeCompare(String(b.id || ''))
    ));
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
    const projected = projectTile(tile, geometry);
    return {
      x: toNumber(viewport.originX) + toNumber(viewport.panX) + projected.x * toNumber(viewport.scale, 1),
      y: toNumber(viewport.originY) + toNumber(viewport.panY) + projected.y * toNumber(viewport.scale, 1),
    };
  }

  const TileMapGeometry = {
    DEFAULT_GEOMETRY,
    normalizeGeometry,
    projectTile,
    getTileDrawRect,
    getIsoSortValue,
    sortTilesForIsoDraw,
    getBounds,
    getTileScreenCenter,
  };

  global.TileMapGeometry = TileMapGeometry;
  if (typeof module !== 'undefined' && module.exports) module.exports = TileMapGeometry;
})(typeof globalThis !== 'undefined' ? globalThis : window);
