const test = require('node:test');
const assert = require('node:assert/strict');

const TerritoryAction = require('../actions/TerritoryAction');
const TerritoryService = require('../services/TerritoryService');
const WorldMapService = require('../services/WorldMapService');

function createFirstSettlementState() {
  const siteId = 'site_3_1';
  const state = {
    playerId: 'territory-action-settlement-test',
    activeCityId: 'capital',
    polity: TerritoryService.createInitialPolity(),
    worldMap: WorldMapService.createInitialWorldMap('territory-action-settlement-test'),
    territories: [
      {
        id: 'capital',
        x: 0,
        y: 0,
        naturalName: 'Origin',
        cityName: 'Capital',
        type: 'capital',
        owner: 'player',
        status: 'occupied',
      },
      {
        id: siteId,
        x: 3,
        y: 1,
        naturalName: 'River Bend',
        cityName: null,
        type: 'town',
        owner: 'neutral',
        status: 'discovered',
        scale: 2,
        defense: TerritoryService.MIN_EXPEDITION_SOLDIERS,
        recommendedSoldiers: TerritoryService.MIN_EXPEDITION_SOLDIERS,
      },
    ],
    cities: {
      capital: {
        id: 'capital',
        territoryId: 'capital',
        isCapital: true,
        name: 'Capital',
        resources: { food: 0, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
        buildings: {},
        population: {
          total: 3,
          max: 3,
          maxPop: 3,
          farmers: 3,
          scholars: 0,
          craftsmen: 0,
          unassigned: 0,
        },
        military: { soldiers: 0, soldierCap: 0 },
      },
    },
    military: { soldiers: 0, soldierCap: 0 },
    warMissions: [],
  };
  WorldMapService.bindSiteToTile(
    state,
    3,
    1,
    siteId,
    new Date('2026-06-06T00:00:00.000Z'),
    { visibility: 'scouted' },
  );
  return { state, siteId };
}

test('first non-capital settlement can be occupied with zero reserve soldiers', () => {
  const { state, siteId } = createFirstSettlementState();

  const started = TerritoryAction.execute('startConquest', state, { territoryId: siteId });
  assert.equal(started.success, true);
  assert.equal(state.cities.capital.military.soldiers, 0);
  assert.equal(state.warMissions[0].soldiersCommitted, 0);
  assert.equal(state.warMissions[0].status, 'ready');
  assert.equal(state.territories[1].status, 'contested');

  const claimed = TerritoryAction.execute('claimConquest', state, { territoryId: siteId });
  assert.equal(claimed.success, true);
  assert.equal(state.territories[1].status, 'occupied');
  assert.equal(state.territories[1].owner, 'player');
  assert.equal(state.cities[siteId].territoryId, siteId);

  const renamedCity = TerritoryAction.execute('renameCity', state, {
    territoryId: siteId,
    name: 'River City',
  });
  assert.equal(renamedCity.success, true);
  assert.equal(state.territories[1].cityName, 'River City');
  assert.equal(state.cities[siteId].name, 'River City');

  const renamedPolity = TerritoryAction.execute('renamePolity', state, { name: 'Red Alliance' });
  assert.equal(renamedPolity.success, true);
  assert.equal(state.polity.name, 'Red Alliance');
});

test('later settlements do not bypass their conquest timeline', () => {
  const { state, siteId } = createFirstSettlementState();
  state.territories.push({
    id: 'site_2_0',
    x: 2,
    y: 0,
    type: 'town',
    owner: 'player',
    status: 'occupied',
  });

  const started = TerritoryAction.execute('startConquest', state, { territoryId: siteId });

  assert.equal(started.success, true);
  assert.equal(state.warMissions[0].status, 'active');
});
