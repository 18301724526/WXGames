const test = require('node:test');
const assert = require('node:assert/strict');

const TerritoryAction = require('../actions/TerritoryAction');
const TutorialService = require('../services/TutorialService');
const TerritoryService = require('../services/TerritoryService');
const WorldMapService = require('../services/WorldMapService');
const WorldExplorerService = require('../services/WorldExplorerService');

function createGuidedFirstCityState() {
  const siteId = 'site_3_1';
  const tutorial = {
    ...TutorialService.manualAdvance(
      TutorialService.createInitialTutorialState(),
      TutorialService.TUTORIAL_STEPS.firstCityDiscovered,
    ),
    grants: {
      [WorldExplorerService.TUTORIAL_FIRST_SITE_GRANT_KEY]: {
        siteId,
        discoveredAt: '2026-06-06T00:00:00.000Z',
      },
    },
  };
  const state = {
    playerId: 'territory-action-tutorial-test',
    activeCityId: 'capital',
    tutorial,
    polity: TerritoryService.createInitialPolity(),
    worldMap: WorldMapService.createInitialWorldMap('territory-action-tutorial-test'),
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
        population: { total: 3, max: 3, maxPop: 3, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0 },
        military: { soldiers: 0, soldierCap: 0 },
      },
    },
    military: { soldiers: 0, soldierCap: 0 },
    warMissions: [],
  };
  WorldMapService.bindSiteToTile(state, 3, 1, siteId, new Date('2026-06-06T00:00:00.000Z'), { visibility: 'scouted' });
  return { state, siteId };
}

test('guided first empty city occupation and naming advance tutorial by real territory actions', () => {
  const { state, siteId } = createGuidedFirstCityState();

  const started = TerritoryAction.execute('startConquest', state, { territoryId: siteId });
  assert.equal(started.success, true);
  assert.equal(started.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.firstCityConquestStarted);
  assert.equal(state.military.soldiers, TerritoryService.MIN_EXPEDITION_SOLDIERS);
  assert.equal(state.warMissions[0].status, 'ready');
  assert.equal(state.territories[1].status, 'contested');

  const claimed = TerritoryAction.execute('claimConquest', state, { territoryId: siteId });
  assert.equal(claimed.success, true);
  assert.equal(claimed.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.firstCityOccupied);
  assert.equal(state.territories[1].status, 'occupied');
  assert.equal(state.territories[1].owner, 'player');
  assert.equal(state.cities[siteId].territoryId, siteId);

  const renamedCity = TerritoryAction.execute('renameCity', state, { territoryId: siteId, name: '河湾城' });
  assert.equal(renamedCity.success, true);
  assert.equal(renamedCity.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.firstCityNamed);
  assert.equal(state.territories[1].cityName, '河湾城');
  assert.equal(state.cities[siteId].name, '河湾城');

  const renamedPolity = TerritoryAction.execute('renamePolity', state, { name: '赤火联盟' });
  assert.equal(renamedPolity.success, true);
  assert.equal(renamedPolity.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.polityNamed);
  assert.equal(state.polity.name, '赤火联盟');
});
