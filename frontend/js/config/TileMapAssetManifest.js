(function (global) {
  const TILE_MAP_ASSET_VERSION = 'tile-world-map-v1';
  const TILE_ROOT = 'assets/art/tile-map/';

  const TERRAIN_ASSETS = {
    capital: { label: 'Capital', path: `${TILE_ROOT}tile-terrain-plains.png` },
    plains: { label: 'Plains', path: `${TILE_ROOT}tile-terrain-plains.png` },
    forest: { label: 'Forest', path: `${TILE_ROOT}tile-terrain-forest.png`, feature: 'treeCluster' },
    hills: { label: 'Hills', path: `${TILE_ROOT}tile-terrain-hills.png`, overlayKey: 'terrain:hills' },
    mountain: { label: 'Mountain', path: `${TILE_ROOT}tile-terrain-mountain.png`, feature: 'mountainRidge' },
    waste: { label: 'Waste', path: `${TILE_ROOT}tile-terrain-waste.png`, overlayKey: 'terrain:waste' },
    desert: { label: 'Desert', path: `${TILE_ROOT}tile-terrain-desert.png` },
    river: { label: 'River', path: `${TILE_ROOT}tile-terrain-river.png`, water: 'river' },
    ocean: { label: 'Ocean', path: `${TILE_ROOT}ocean-template/tile-ocean-water-full.png`, water: 'ocean' },
  };

  const FEATURE_ASSETS = {
    treeCluster: { label: 'Tree Cluster', path: `${TILE_ROOT}tile-feature-tree-cluster.png`, overlayKey: 'feature:treeCluster', scale: 0.44 },
    mountainRidge: { label: 'Mountain Ridge', path: `${TILE_ROOT}tile-feature-mountain-ridge.png`, overlayKey: 'feature:mountainRidge', scale: 0.78 },
  };

  const WATER_ASSETS = {
    river: { label: 'River Water', path: `${TILE_ROOT}tile-water-river-loop.png` },
    ocean: { label: 'Ocean Water', path: `${TILE_ROOT}tile-water-ocean-loop.png` },
  };

  const OVERLAY_OFFSETS = {
    'site:camp': { x: -1, y: 28 },
    'site:city': { x: -2, y: 27 },
    'site:outpost': { x: 0, y: 29 },
    'site:ruins': { x: 0, y: 27 },
    'site:town': { x: 0, y: 26 },
    'feature:treeCluster': { x: 0, y: 4 },
    'feature:mountainRidge': { x: 0, y: 0 },
    'terrain:hills': { x: 0, y: 13 },
    'terrain:waste': { x: 0, y: 9 },
  };

  function getTerrainAsset(terrain = 'plains') {
    return TERRAIN_ASSETS[terrain] || TERRAIN_ASSETS.plains;
  }

  function getFeatureAsset(featureKey = '') {
    return FEATURE_ASSETS[featureKey] || null;
  }

  function getWaterAsset(waterKey = '') {
    return WATER_ASSETS[waterKey] || null;
  }

  function getOverlayOffset(key = '') {
    const offset = OVERLAY_OFFSETS[key] || { x: 0, y: 0 };
    return { x: Number(offset.x) || 0, y: Number(offset.y) || 0 };
  }

  function getSiteOverlayKey(siteType = '') {
    return `site:${siteType || 'town'}`;
  }

  function getPreloadAssetPaths() {
    return Array.from(new Set([
      ...Object.values(TERRAIN_ASSETS).map((asset) => asset.path),
      ...Object.values(FEATURE_ASSETS).map((asset) => asset.path),
      ...Object.values(WATER_ASSETS).map((asset) => asset.path),
    ]));
  }

  const TileMapAssetManifest = {
    version: TILE_MAP_ASSET_VERSION,
    terrain: TERRAIN_ASSETS,
    features: FEATURE_ASSETS,
    water: WATER_ASSETS,
    overlayOffsets: OVERLAY_OFFSETS,
    getTerrainAsset,
    getFeatureAsset,
    getWaterAsset,
    getOverlayOffset,
    getSiteOverlayKey,
    getPreloadAssetPaths,
  };

  global.TileMapAssetManifest = TileMapAssetManifest;
  if (typeof module !== 'undefined' && module.exports) module.exports = TileMapAssetManifest;
})(typeof globalThis !== 'undefined' ? globalThis : window);
