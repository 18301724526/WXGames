(function (global) {
  const sharedTileMapManifest = (() => {
    if (global.TileMapAssetManifest) return global.TileMapAssetManifest;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../config/TileMapAssetManifest');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedTileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/TileCoord');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/LocaleText');
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
    return Math.floor(toNumber(value, fallback));
  }

  function getTileMapManifest(options = {}) {
    return options.manifest || sharedTileMapManifest || {};
  }

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function getWorldTileId(q, r) {
    if (sharedTileCoord?.tileId) return sharedTileCoord.tileId(q, r);
    return `tile_${toInteger(q)}_${toInteger(r)}`;
  }

  function normalizeCoord(coord = {}, fallback = {}) {
    if (sharedTileCoord?.normalizeCoord) return sharedTileCoord.normalizeCoord(coord, fallback);
    const fallbackX = toInteger(fallback.x !== undefined ? fallback.x : fallback.q, 0);
    const fallbackY = toInteger(fallback.y !== undefined ? fallback.y : fallback.r, 0);
    const x = toInteger(coord.x !== undefined ? coord.x : coord.q, fallbackX);
    const y = toInteger(coord.y !== undefined ? coord.y : coord.r, fallbackY);
    return Object.freeze({
      x,
      y,
      q: x,
      r: y,
      tileId: getWorldTileId(x, y),
    });
  }

  function getMountainNeighborCount(tile = {}, siteById = new Map()) {
    if ((tile.terrain || 'plains') !== 'mountain') return 0;
    const coord = normalizeCoord(tile);
    const terrainById = tile.renderOnly
      ? siteById.__tileTerrainById
      : (siteById.__nonRenderOnlyTileTerrainById || siteById.__tileTerrainById);
    return [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
      .filter(([dq, dr]) => {
        const id = getWorldTileId(coord.x + dq, coord.y + dr);
        return terrainById?.get(id) === 'mountain';
      }).length;
  }

  function normalizeIntel(intel = null) {
    return intel && typeof intel === 'object' ? {
      level: toInteger(intel.level, 0),
      knownTerrain: Boolean(intel.knownTerrain),
      knownSite: Boolean(intel.knownSite),
      knownOwner: Boolean(intel.knownOwner),
      knownGarrison: Boolean(intel.knownGarrison),
      knownLeader: Boolean(intel.knownLeader),
      knownSkill: Boolean(intel.knownSkill),
    } : null;
  }

  function normalizeTemplateAssets(templateAssets = []) {
    return templateAssets.map((asset) => ({
      label: asset.labelKey ? t(asset.labelKey, asset.labelParams || {}, asset.label || '') : (asset.label || ''),
      key: asset.key || '',
      type: asset.templateType || '',
      asset: asset.path || '',
    })).filter((asset) => asset.asset);
  }

  function normalizeWaterAsset(manifest = {}, terrainAsset = {}) {
    if (!terrainAsset.water) return null;
    const waterAsset = manifest.getWaterAsset?.(terrainAsset.water) || {};
    return {
      kind: terrainAsset.water,
      asset: waterAsset.path || '',
      uvScale: waterAsset.uvScale || 1,
      speedX: waterAsset.speedX || 0,
      speedY: waterAsset.speedY || 0,
      alpha: waterAsset.alpha || 1,
    };
  }

  function normalizeFeature(manifest = {}, terrainAsset = {}) {
    const featureAsset = terrainAsset.feature ? manifest.getFeatureAsset?.(terrainAsset.feature) : null;
    return featureAsset ? {
      key: terrainAsset.feature,
      asset: featureAsset.path || '',
      overlayKey: featureAsset.overlayKey || '',
      scale: featureAsset.scale || 0.5,
      offset: manifest.getOverlayOffset?.(featureAsset.overlayKey) || { x: 0, y: 0 },
    } : null;
  }

  function normalizeSite(manifest = {}, site = null) {
    if (!site) return null;
    const siteAsset = manifest.getSiteAsset?.(site.type || 'town') || null;
    const overlayKey = siteAsset?.overlayKey
      || manifest.getSiteOverlayKey?.(site.type)
      || `site:${site.type || 'town'}`;
    return {
      id: site.id || '',
      type: site.type || '',
      status: site.status || '',
      owner: site.owner || '',
      name: site.cityName || site.naturalName || '',
      title: site.naturalName || site.cityName || '',
      art: site.art || siteAsset?.path || '',
      overlayKey,
      offset: manifest.getOverlayOffset?.(overlayKey) || { x: 0, y: 0 },
      scale: siteAsset?.scale || 0.46,
    };
  }

  function normalizeWorldTile(tile = {}, siteById = new Map(), options = {}) {
    const manifest = getTileMapManifest(options);
    const coord = normalizeCoord(tile);
    const terrain = tile.terrain || 'plains';
    const terrainAsset = manifest.getTerrainAsset?.(terrain)
      || manifest.terrain?.[terrain]
      || manifest.terrain?.plains
      || {};
    const templateAssets = manifest.getTileTemplateAssets?.(tile) || [];
    const site = tile.siteId ? siteById.get(tile.siteId) : null;
    return {
      id: coord.tileId,
      q: coord.q,
      r: coord.r,
      terrain,
      terrainLabel: terrainAsset.labelKey ? t(terrainAsset.labelKey, {}, terrainAsset.label || terrain) : (terrainAsset.label || terrain),
      terrainAsset: terrainAsset.path || '',
      waterAsset: terrainAsset.water ? manifest.getWaterAsset?.(terrainAsset.water)?.path || '' : '',
      templateAssets: normalizeTemplateAssets(templateAssets),
      water: normalizeWaterAsset(manifest, terrainAsset),
      riverPorts: Array.isArray(tile.riverPorts) ? tile.riverPorts.filter(Boolean) : [],
      oceanTemplates: Array.isArray(tile.oceanTemplates) ? tile.oceanTemplates.filter(Boolean) : [],
      transitionKey: typeof tile.transitionKey === 'string' ? tile.transitionKey : '',
      mountainNeighbors: getMountainNeighborCount(tile, siteById),
      feature: normalizeFeature(manifest, terrainAsset),
      discovered: tile.discovered !== false,
      visible: tile.visible !== false,
      visibility: tile.visibility || (tile.discovered === false ? 'unknown' : 'scouted'),
      discoveredAt: tile.discoveredAt || '',
      lastScoutedAt: tile.lastScoutedAt || '',
      intel: normalizeIntel(tile.intel),
      renderReady: Boolean(tile.renderReady),
      renderOnly: Boolean(tile.renderOnly),
      siteId: tile.siteId || null,
      site: normalizeSite(manifest, site),
    };
  }

  const WorldTileMapTileNormalizer = Object.freeze({
    toNumber,
    toInteger,
    t,
    getTileMapManifest,
    getWorldTileId,
    normalizeCoord,
    getMountainNeighborCount,
    normalizeIntel,
    normalizeTemplateAssets,
    normalizeWaterAsset,
    normalizeFeature,
    normalizeSite,
    normalizeWorldTile,
  });

  global.WorldTileMapTileNormalizer = WorldTileMapTileNormalizer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldTileMapTileNormalizer;
})(typeof window !== 'undefined' ? window : globalThis);
