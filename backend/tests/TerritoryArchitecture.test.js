const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TerritoryService = require('../services/TerritoryService');
const TerritoryConstants = require('../services/territory/TerritoryConstants');
const TerritoryVisuals = require('../services/territory/TerritoryVisuals');
const TerritoryInitialState = require('../services/territory/TerritoryInitialState');
const TerritoryShared = require('../services/territory/TerritoryShared');

const serviceRoot = path.join(__dirname, '..', 'services');
const territoryRoot = path.join(serviceRoot, 'territory');

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

test('TerritoryService starts delegating foundation responsibilities to territory modules', () => {
  const moduleFiles = fs.readdirSync(territoryRoot)
    .filter((name) => name.endsWith('.js'))
    .sort();

  assert.deepEqual(moduleFiles, [
    'TerritoryConstants.js',
    'TerritoryInitialState.js',
    'TerritoryShared.js',
    'TerritoryVisuals.js',
  ]);
  for (const fileName of moduleFiles) {
    assert.ok(lineCount(path.join(territoryRoot, fileName)) < 500, `${fileName} should stay below 500 lines`);
  }
});

test('territory foundation modules preserve initial-state and visual contracts', () => {
  const now = '2026-06-06T00:00:00.000Z';

  assert.deepEqual(TerritoryInitialState.createInitialPolity(), {
    name: null,
    namePrompted: false,
    capitalCityName: '首都',
    color: '#d9a441',
  });
  assert.deepEqual(TerritoryInitialState.createInitialTerritories(now), TerritoryService.createInitialTerritories(now));
  assert.equal(TerritoryInitialState.createInitialTerritories(now)[0].art, TerritoryConstants.SITE_ART.capital);
  assert.equal(TerritoryConstants.SITE_TEMPLATES[0].naturalNames[0], '河畔前哨');

  assert.deepEqual(TerritoryVisuals.createVisualOffset(0, 0), { x: 0, y: 0 });
  assert.deepEqual(TerritoryVisuals.createVisualOffset(3, -2, 'seed'), TerritoryVisuals.createVisualOffset(3, -2, 'seed'));
  assert.deepEqual(TerritoryVisuals.normalizeVisualOffset({ x: 9, y: -9 }, 1, 1), { x: 0.55, y: -0.55 });
});

test('territory shared helpers preserve terrain and soldier normalization contracts', () => {
  assert.equal(TerritoryShared.toInteger('4.8'), 4);
  assert.equal(TerritoryShared.toInteger('bad', 7), 7);
  assert.equal(TerritoryShared.normalizeSoldierScale(3), 300);
  assert.equal(TerritoryShared.normalizeSoldierScale(120), 120);
  assert.equal(TerritoryShared.getDistance(-3, 2), 3);
  assert.equal(TerritoryShared.getRelativeDistance(1, 1, -2, 4), 3);
  assert.equal(TerritoryShared.getCoordinateKey(-2, 4), '-2,4');
  assert.equal(TerritoryShared.normalizeMapTerrainId('forest'), 'forest');
  assert.equal(TerritoryShared.normalizeMapTerrainId('unknown'), null);
  assert.equal(TerritoryShared.getPlanningTerrainForMapTerrain('mountain'), 'hills');
  assert.equal(TerritoryShared.getPlanningTerrainForMapTerrain('coast'), 'coast');
});

test('TerritoryService facade preserves the legacy territory API', () => {
  const expectedApi = [
    'CONQUEST_DURATION_MS',
    'DIRECTIONS',
    'MIN_EXPEDITION_SOLDIERS',
    'MISSION_DURATION_MS',
    'SCOUT_ACTION_POINTS',
    'SCOUT_DURATION_MS',
    'SCOUT_SITE_MIN_DISTANCE',
    'SCOUT_STEP_DURATION_MS',
    'SITE_ART',
    'SITE_TEMPLATES',
    'claimConquest',
    'claimScout',
    'countSoldiersOnMission',
    'createInitialPolity',
    'createInitialTerritories',
    'getActiveScoutMission',
    'getAvailableSoldiers',
    'getClientTerritoryState',
    'getScoutMissions',
    'getTerritoryEffects',
    'normalizeTerritoryState',
    'renameCity',
    'renamePolity',
    'scoutTerritory',
    'startConquest',
    'startScout',
    'updateMissionReadiness',
  ];

  assert.deepEqual(Object.keys(TerritoryService).sort(), expectedApi.sort());
});
