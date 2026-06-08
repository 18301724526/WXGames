const test = require('node:test');
const assert = require('node:assert/strict');

const WorldTileMapTileNormalizer = require('./WorldTileMapTileNormalizer');

function createManifest() {
  return {
    terrain: {
      plains: { label: 'Plains', path: 'plains.png' },
      mountain: { label: 'Mountain', path: 'plains.png', feature: 'ridge' },
      ocean: { label: 'Ocean', path: 'ocean.png', water: 'ocean' },
    },
    getTerrainAsset(terrain) {
      return this.terrain[terrain] || this.terrain.plains;
    },
    getFeatureAsset(feature) {
      return feature === 'ridge'
        ? { path: 'ridge.png', overlayKey: 'feature:ridge', scale: 0.7 }
        : null;
    },
    getWaterAsset(water) {
      return water === 'ocean'
        ? { path: 'water.png', uvScale: 0.8, speedX: -4, speedY: 2, alpha: 0.9 }
        : null;
    },
    getTileTemplateAssets(tile) {
      return tile.oceanTemplates?.filter(Boolean).map((key) => ({
        label: `Ocean ${key}`,
        key,
        templateType: 'ocean',
        path: `${key}.png`,
      })) || [];
    },
    getSiteAsset(type) {
      return { path: `${type}.png`, overlayKey: `site:${type}`, scale: 0.5 };
    },
    getSiteOverlayKey(type) {
      return `site:${type || 'town'}`;
    },
    getOverlayOffset(key) {
      return key === 'feature:ridge' ? { x: 1, y: 2 } : { x: 3, y: 4 };
    },
  };
}

test('WorldTileMapTileNormalizer normalizes terrain, water, feature, templates, and intel', () => {
  const tile = {
    q: '2.9',
    r: '-1.1',
    terrain: 'ocean',
    oceanTemplates: ['full', '', 'nw'],
    riverPorts: ['ne', ''],
    transitionKey: 'nw',
    visible: false,
    intel: {
      level: '2.8',
      knownTerrain: 1,
      knownSite: '',
      knownOwner: true,
    },
  };

  const normalized = WorldTileMapTileNormalizer.normalizeWorldTile(tile, new Map(), {
    manifest: createManifest(),
  });

  assert.equal(normalized.id, 'tile_2_-2');
  assert.equal(normalized.q, 2);
  assert.equal(normalized.r, -2);
  assert.equal(normalized.water.asset, 'water.png');
  assert.deepEqual(normalized.oceanTemplates, ['full', 'nw']);
  assert.deepEqual(normalized.riverPorts, ['ne']);
  assert.deepEqual(normalized.templateAssets.map((asset) => asset.key), ['full', 'nw']);
  assert.equal(normalized.visible, false);
  assert.deepEqual(normalized.intel, {
    level: 2,
    knownTerrain: true,
    knownSite: false,
    knownOwner: true,
    knownGarrison: false,
    knownLeader: false,
    knownSkill: false,
  });
});

test('WorldTileMapTileNormalizer normalizes site overlays and mountain neighbors', () => {
  const siteById = new Map([[
    'site-1',
    {
      id: 'site-1',
      type: 'town',
      status: 'discovered',
      owner: 'neutral',
      naturalName: 'Old Ford',
    },
  ]]);
  siteById.__tileTerrainById = new Map([
    ['tile_1_0', 'mountain'],
    ['tile_1_-1', 'mountain'],
    ['tile_0_-1', 'plains'],
  ]);

  const normalized = WorldTileMapTileNormalizer.normalizeWorldTile({
    id: 'tile_0_0',
    q: 0,
    r: 0,
    terrain: 'mountain',
    siteId: 'site-1',
    discovered: false,
  }, siteById, {
    manifest: createManifest(),
  });

  assert.equal(normalized.feature.asset, 'ridge.png');
  assert.equal(normalized.feature.offset.y, 2);
  assert.equal(normalized.mountainNeighbors, 2);
  assert.equal(normalized.visibility, 'unknown');
  assert.equal(normalized.site.name, 'Old Ford');
  assert.equal(normalized.site.overlayKey, 'site:town');
  assert.deepEqual(normalized.site.offset, { x: 3, y: 4 });
});
