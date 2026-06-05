const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialService = require('../services/TutorialService');
const WorldExplorerService = require('../services/WorldExplorerService');
const WorldMapService = require('../services/WorldMapService');

function createTutorialExploreState() {
  const scoutPersonId = 'fp-tutorial-scout';
  return {
    playerId: 'world-explorer-tutorial-test',
    activeCityId: 'capital',
    currentEra: 3,
    tutorial: {
      ...TutorialService.manualAdvance(
        TutorialService.createInitialTutorialState(),
        TutorialService.TUTORIAL_STEPS.scoutFormationSaved,
      ),
      grants: {
        scoutFamousPerson: { personId: scoutPersonId },
      },
    },
    territories: [{
      id: 'capital',
      x: 0,
      y: 0,
      naturalName: 'Origin',
      cityName: 'Capital',
      type: 'capital',
      owner: 'player',
      status: 'occupied',
    }],
    worldMap: WorldMapService.createInitialWorldMap('tutorial-explorer-seed', new Date('2026-06-06T00:00:00.000Z')),
    military: {
      formations: {
        capital: [{ slot: 1, memberIds: [scoutPersonId] }],
      },
    },
    cities: {
      capital: {
        id: 'capital',
        territoryId: 'capital',
        military: {
          formations: {
            capital: [{ slot: 1, memberIds: [scoutPersonId] }],
          },
        },
      },
    },
    exploreMissions: [],
  };
}

test('guided world exploration returns server-planned tiles and the first empty city plan', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();

  const result = WorldExplorerService.startExplore(gameState, { mode: 'random', routeLength: 4, formationSlot: 1 }, now);

  assert.equal(result.success, true);
  assert.equal(gameState.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.scoutExploreStarted);
  assert.equal(result.mission.route.length, 4);
  assert.equal(result.mission.plannedTiles.length, 4);
  assert.equal(result.mission.plannedSites.length, 1);
  assert.equal(result.mission.formation.slot, 1);
  assert.deepEqual(result.mission.formation.memberIds, ['fp-tutorial-scout']);
  assert.equal(gameState.territories.length, 1);
  assert.equal(gameState.territories[0].id, 'capital');
});

test('guided world exploration materializes the first neutral empty city when the planned tile is revealed', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const started = WorldExplorerService.startExplore(gameState, { mode: 'random', routeLength: 4, formationSlot: 1 }, now);
  const missionId = started.mission.id;
  const mission = gameState.exploreMissions[0];
  const plannedSiteId = mission.plannedSites[0].siteId;
  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * mission.route.length + 1);

  WorldExplorerService.advanceExploreMissions(gameState, finishAt);

  const discovered = gameState.territories.find((territory) => territory.id === plannedSiteId);
  assert.ok(discovered);
  assert.equal(discovered.owner, 'neutral');
  assert.equal(discovered.status, 'discovered');
  assert.equal(discovered.garrison, null);
  assert.equal(gameState.tutorial.grants.firstExploreEmptyCity.siteId, plannedSiteId);
  assert.equal(gameState.exploreMissions[0].status, 'ready');
  assert.equal(gameState.worldMap.tiles.some((tile) => tile.siteId === plannedSiteId), true);

  const claimed = WorldExplorerService.claimExplore(gameState, missionId, finishAt);
  assert.equal(claimed.success, true);
  assert.equal(gameState.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.scoutExploreClaimed);
  assert.equal(gameState.exploreMissions.length, 0);
});

test('guided world exploration rejects a formation without the tutorial scout', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  gameState.military.formations.capital[0].memberIds = ['fp-other'];
  gameState.cities.capital.military.formations.capital[0].memberIds = ['fp-other'];

  const result = WorldExplorerService.startExplore(gameState, { mode: 'random', routeLength: 4, formationSlot: 1 }, now);

  assert.equal(result.success, false);
  assert.equal(result.error, 'EXPLORE_TUTORIAL_FORMATION_REQUIRED');
  assert.equal(gameState.exploreMissions.length, 0);
});
