(function (global) {
  const TILE_MAP_ASSET_VERSION = 'tile-world-map-v2-lab-parity';
  const TILE_ROOT = 'assets/art/tile-map/';

  const TERRAIN_ASSETS = {
    capital: { label: 'Capital', path: `${TILE_ROOT}tile-terrain-plains.png` },
    plains: { label: 'Plains', path: `${TILE_ROOT}tile-terrain-plains.png` },
    forest: { label: 'Forest', path: `${TILE_ROOT}tile-terrain-plains.png`, feature: 'treeCluster', sourceTerrainPath: `${TILE_ROOT}tile-terrain-forest.png` },
    hills: { label: 'Hills', path: `${TILE_ROOT}tile-terrain-plains.png`, overlayKey: 'terrain:hills', sourceTerrainPath: `${TILE_ROOT}tile-terrain-hills.png` },
    mountain: { label: 'Mountain', path: `${TILE_ROOT}tile-terrain-plains.png`, feature: 'mountainRidge', sourceTerrainPath: `${TILE_ROOT}tile-terrain-mountain.png` },
    waste: { label: 'Waste', path: `${TILE_ROOT}tile-terrain-plains.png`, overlayKey: 'terrain:waste', sourceTerrainPath: `${TILE_ROOT}tile-terrain-waste.png` },
    desert: { label: 'Desert', path: `${TILE_ROOT}tile-terrain-desert.png` },
    river: { label: 'River', path: `${TILE_ROOT}tile-terrain-river.png`, water: 'river' },
    ocean: { label: 'Ocean', path: `${TILE_ROOT}ocean-template/tile-ocean-water-full.png`, water: 'ocean' },
  };

  const FEATURE_ASSETS = {
    treeCluster: { label: 'Tree Cluster', path: `${TILE_ROOT}tile-feature-tree-cluster.png`, overlayKey: 'feature:treeCluster', scale: 0.44 },
    mountainRidge: { label: 'Mountain Ridge', path: `${TILE_ROOT}tile-feature-mountain-ridge.png`, overlayKey: 'feature:mountainRidge', scale: 0.78 },
  };

  const SITE_ASSETS = {
    capital: { label: 'Capital', path: 'assets/art/world-site-city-cutout.png', overlayKey: 'site:city', scale: 0.46 },
    camp: { label: 'Camp', path: 'assets/art/world-site-camp-cutout.png', overlayKey: 'site:camp', scale: 0.46 },
    city: { label: 'City', path: 'assets/art/world-site-city-cutout.png', overlayKey: 'site:city', scale: 0.46 },
    outpost: { label: 'Outpost', path: 'assets/art/world-site-outpost-cutout.png', overlayKey: 'site:outpost', scale: 0.46 },
    ruins: { label: 'Ruins', path: 'assets/art/world-site-ruins-cutout.png', overlayKey: 'site:ruins', scale: 0.46 },
    town: { label: 'Town', path: 'assets/art/world-site-town-cutout.png', overlayKey: 'site:town', scale: 0.46 },
  };

  const WATER_ASSETS = {
    river: { label: 'River Water', path: `${TILE_ROOT}tile-water-river-loop.png`, uvScale: 0.72, speedX: -18, speedY: 7, alpha: 0.94 },
    ocean: { label: 'Ocean Water', path: `${TILE_ROOT}tile-water-ocean-loop.png`, uvScale: 0.84, speedX: -8, speedY: 4, alpha: 0.96 },
  };
  const RIVER_MOUTH_RIVER_TEMPLATE_KEY_BY_SHORE_SIDE = {
    nw: 'nw-se',
    ne: 'ne-sw',
    se: 'nw-se',
    sw: 'ne-sw',
  };

  const RIVER_TEMPLATE_ASSETS = {
    nw: { label: 'River Bank NW', path: `${TILE_ROOT}river-template/tile-river-bank-uv-nw.png` },
    ne: { label: 'River Bank NE', path: `${TILE_ROOT}river-template/tile-river-bank-uv-ne.png` },
    se: { label: 'River Bank SE', path: `${TILE_ROOT}river-template/tile-river-bank-uv-se.png` },
    sw: { label: 'River Bank SW', path: `${TILE_ROOT}river-template/tile-river-bank-uv-sw.png` },
    'nw-ne': { label: 'River Bank NW NE', path: `${TILE_ROOT}river-template/tile-river-bank-uv-nw-ne.png` },
    'nw-se': { label: 'River Bank NW SE', path: `${TILE_ROOT}river-template/tile-river-bank-uv-nw-se.png` },
    'nw-sw': { label: 'River Bank NW SW', path: `${TILE_ROOT}river-template/tile-river-bank-uv-nw-sw.png` },
    'ne-se': { label: 'River Bank NE SE', path: `${TILE_ROOT}river-template/tile-river-bank-uv-ne-se.png` },
    'ne-sw': { label: 'River Bank NE SW', path: `${TILE_ROOT}river-template/tile-river-bank-uv-ne-sw.png` },
    'se-sw': { label: 'River Bank SE SW', path: `${TILE_ROOT}river-template/tile-river-bank-uv-se-sw.png` },
    'nw-ne-se': { label: 'River Bank NW NE SE', path: `${TILE_ROOT}river-template/tile-river-bank-uv-nw-ne-se.png` },
    'nw-ne-sw': { label: 'River Bank NW NE SW', path: `${TILE_ROOT}river-template/tile-river-bank-uv-nw-ne-sw.png` },
    'nw-se-sw': { label: 'River Bank NW SE SW', path: `${TILE_ROOT}river-template/tile-river-bank-uv-nw-se-sw.png` },
    'ne-se-sw': { label: 'River Bank NE SE SW', path: `${TILE_ROOT}river-template/tile-river-bank-uv-ne-se-sw.png` },
    'nw-ne-se-sw': { label: 'River Bank NW NE SE SW', path: `${TILE_ROOT}river-template/tile-river-bank-uv-nw-ne-se-sw.png` },
  };

  const OCEAN_TEMPLATE_ASSETS = {
    full: { label: 'Ocean Water Full', path: `${TILE_ROOT}ocean-template/tile-ocean-water-full.png` },
    nw: { label: 'Ocean Shore Edge NW', path: `${TILE_ROOT}ocean-template/tile-ocean-shore-edge-nw.png` },
    ne: { label: 'Ocean Shore Edge NE', path: `${TILE_ROOT}ocean-template/tile-ocean-shore-edge-ne.png` },
    se: { label: 'Ocean Shore Edge SE', path: `${TILE_ROOT}ocean-template/tile-ocean-shore-edge-se.png` },
    sw: { label: 'Ocean Shore Edge SW', path: `${TILE_ROOT}ocean-template/tile-ocean-shore-edge-sw.png` },
    'nw-ne': { label: 'Ocean Shore Edges NW NE', path: `${TILE_ROOT}ocean-template/tile-ocean-shore-edges-nw-ne.png` },
    'ne-se': { label: 'Ocean Shore Edges NE SE', path: `${TILE_ROOT}ocean-template/tile-ocean-shore-edges-ne-se.png` },
    'se-sw': { label: 'Ocean Shore Edges SE SW', path: `${TILE_ROOT}ocean-template/tile-ocean-shore-edges-se-sw.png` },
    'nw-sw': { label: 'Ocean Shore Edges NW SW', path: `${TILE_ROOT}ocean-template/tile-ocean-shore-edges-nw-sw.png` },
    'corner-n': { label: 'Ocean Shore Corner N', path: `${TILE_ROOT}ocean-template/tile-ocean-shore-corner-n.png` },
    'corner-e': { label: 'Ocean Shore Corner E', path: `${TILE_ROOT}ocean-template/tile-ocean-shore-corner-e.png` },
    'corner-s': { label: 'Ocean Shore Corner S', path: `${TILE_ROOT}ocean-template/tile-ocean-shore-corner-s.png` },
    'corner-w': { label: 'Ocean Shore Corner W', path: `${TILE_ROOT}ocean-template/tile-ocean-shore-corner-w.png` },
    'river-mouth-nw': { label: 'Ocean River Mouth NW', path: `${TILE_ROOT}ocean-template/tile-ocean-river-mouth-nw.png` },
    'river-mouth-ne': { label: 'Ocean River Mouth NE', path: `${TILE_ROOT}ocean-template/tile-ocean-river-mouth-ne.png` },
    'river-mouth-se': { label: 'Ocean River Mouth SE', path: `${TILE_ROOT}ocean-template/tile-ocean-river-mouth-se.png` },
    'river-mouth-sw': { label: 'Ocean River Mouth SW', path: `${TILE_ROOT}ocean-template/tile-ocean-river-mouth-sw.png` },
  };

  const TERRAIN_TRANSITION_TEMPLATE_ASSETS = {
    nw: { label: 'Plains Desert Transition NW', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-nw.png` },
    ne: { label: 'Plains Desert Transition NE', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-ne.png` },
    se: { label: 'Plains Desert Transition SE', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-se.png` },
    sw: { label: 'Plains Desert Transition SW', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-sw.png` },
    'nw-ne': { label: 'Plains Desert Transition NW NE', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-nw-ne.png` },
    'nw-se': { label: 'Plains Desert Transition NW SE', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-nw-se.png` },
    'nw-sw': { label: 'Plains Desert Transition NW SW', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-nw-sw.png` },
    'ne-se': { label: 'Plains Desert Transition NE SE', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-ne-se.png` },
    'ne-sw': { label: 'Plains Desert Transition NE SW', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-ne-sw.png` },
    'se-sw': { label: 'Plains Desert Transition SE SW', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-se-sw.png` },
    'nw-ne-se': { label: 'Plains Desert Transition NW NE SE', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-nw-ne-se.png` },
    'nw-ne-sw': { label: 'Plains Desert Transition NW NE SW', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-nw-ne-sw.png` },
    'nw-se-sw': { label: 'Plains Desert Transition NW SE SW', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-nw-se-sw.png` },
    'ne-se-sw': { label: 'Plains Desert Transition NE SE SW', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-ne-se-sw.png` },
    'nw-ne-se-sw': { label: 'Plains Desert Transition NW NE SE SW', path: `${TILE_ROOT}transition-template/tile-transition-plains-desert-nw-ne-se-sw.png` },
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

  function getSiteAsset(siteType = '') {
    return SITE_ASSETS[siteType] || SITE_ASSETS.town;
  }

  function getRiverTemplateAsset(key = '') {
    return RIVER_TEMPLATE_ASSETS[key] || null;
  }

  function getOceanTemplateAsset(key = '') {
    return OCEAN_TEMPLATE_ASSETS[key] || null;
  }

  function getTerrainTransitionTemplateAsset(key = '') {
    return TERRAIN_TRANSITION_TEMPLATE_ASSETS[key] || null;
  }

  function getOceanRiverMouthSide(key = '') {
    const match = /^river-mouth-(nw|ne|se|sw)$/.exec(String(key));
    return match ? match[1] : '';
  }

  function getRiverMouthShoreEdgeAsset(key = '') {
    const side = getOceanRiverMouthSide(key);
    return side ? getOceanTemplateAsset(side) : null;
  }

  function getRiverMouthRiverTemplateAsset(key = '') {
    const side = getOceanRiverMouthSide(key);
    const riverKey = RIVER_MOUTH_RIVER_TEMPLATE_KEY_BY_SHORE_SIDE[side];
    return riverKey ? getRiverTemplateAsset(riverKey) : null;
  }

  function getSortedSideKey(sides = []) {
    const sideOrder = ['nw', 'ne', 'se', 'sw'];
    return sides
      .filter(Boolean)
      .sort((a, b) => sideOrder.indexOf(a) - sideOrder.indexOf(b))
      .join('-');
  }

  function getTileTemplateAssets(tile = {}) {
    if (tile.terrain === 'ocean') {
      const keys = Array.isArray(tile.oceanTemplates) && tile.oceanTemplates.length
        ? tile.oceanTemplates
        : ['full'];
      return keys
        .map((key) => {
          const asset = getOceanTemplateAsset(key);
          return asset ? { ...asset, key, templateType: 'ocean' } : null;
        })
        .filter(Boolean);
    }
    const riverKey = Array.isArray(tile.riverPorts) && tile.riverPorts.length
      ? getSortedSideKey(tile.riverPorts)
      : '';
    const riverAsset = riverKey ? getRiverTemplateAsset(riverKey) : null;
    if (riverAsset) return [{ ...riverAsset, key: riverKey, templateType: 'river' }];
    const transitionAsset = getTerrainTransitionTemplateAsset(tile.transitionKey || '');
    return transitionAsset ? [{ ...transitionAsset, key: tile.transitionKey || '', templateType: 'transition' }] : [];
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
      ...Object.values(TERRAIN_ASSETS).map((asset) => asset.sourceTerrainPath).filter(Boolean),
      ...Object.values(FEATURE_ASSETS).map((asset) => asset.path),
      ...Object.values(SITE_ASSETS).map((asset) => asset.path),
      ...Object.values(WATER_ASSETS).map((asset) => asset.path),
      ...Object.values(RIVER_TEMPLATE_ASSETS).map((asset) => asset.path),
      ...Object.values(OCEAN_TEMPLATE_ASSETS).map((asset) => asset.path),
      ...Object.values(TERRAIN_TRANSITION_TEMPLATE_ASSETS).map((asset) => asset.path),
    ]));
  }

  const TileMapAssetManifest = {
    version: TILE_MAP_ASSET_VERSION,
    terrain: TERRAIN_ASSETS,
    features: FEATURE_ASSETS,
    sites: SITE_ASSETS,
    water: WATER_ASSETS,
    riverTemplates: RIVER_TEMPLATE_ASSETS,
    oceanTemplates: OCEAN_TEMPLATE_ASSETS,
    terrainTransitionTemplates: TERRAIN_TRANSITION_TEMPLATE_ASSETS,
    overlayOffsets: OVERLAY_OFFSETS,
    getTerrainAsset,
    getFeatureAsset,
    getWaterAsset,
    getSiteAsset,
    getRiverTemplateAsset,
    getOceanTemplateAsset,
    getTerrainTransitionTemplateAsset,
    getRiverMouthShoreEdgeAsset,
    getRiverMouthRiverTemplateAsset,
    getTileTemplateAssets,
    getOverlayOffset,
    getSiteOverlayKey,
    getPreloadAssetPaths,
  };

  global.TileMapAssetManifest = TileMapAssetManifest;
  if (typeof module !== 'undefined' && module.exports) module.exports = TileMapAssetManifest;
})(typeof globalThis !== 'undefined' ? globalThis : window);
