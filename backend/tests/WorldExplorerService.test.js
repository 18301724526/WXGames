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
  assert.equal(result.mission.plannedSites[0].site.id, result.mission.plannedSites[0].siteId);
  assert.equal(result.mission.plannedSites[0].site.owner, 'neutral');
  assert.equal(result.mission.plannedSites[0].site.status, 'discovered');
  assert.equal(result.mission.formation.slot, 1);
  assert.equal(result.mission.nextStepAt, new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS).toISOString());
  assert.equal(result.mission.completesAt, new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * 4).toISOString());
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

test('world march starts a manual route and can be stopped at a requested tile', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();

  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 2,
    targetR: 0,
    formationSlot: 1,
  }, now);

  assert.equal(started.success, true);
  assert.equal(started.mission.mode, 'manual');
  assert.equal(started.mission.route.at(-1).q, 2);

  const stopped = WorldExplorerService.stopWorldMarch(gameState, started.mission.id, {
    targetQ: 1,
    targetR: 0,
  }, new Date('2026-06-06T00:00:01.000Z'));

  assert.equal(stopped.success, true);
  assert.equal(stopped.mission.target.q, 1);
});

test('world march becomes idle at destination and can continue from its current tile', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 2,
    targetR: 0,
    formationSlot: 1,
  }, now);

  assert.equal(started.success, true);

  const activeRepeat = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 1,
    targetR: 1,
    formationSlot: 1,
  }, new Date('2026-06-06T00:00:01.000Z'));

  assert.equal(activeRepeat.success, false);
  assert.equal(activeRepeat.error, 'EXPLORE_FORMATION_BUSY');

  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);
  WorldExplorerService.advanceExploreMissions(gameState, finishAt);
  assert.equal(gameState.exploreMissions[0].status, 'idle');
  assert.deepEqual(WorldExplorerService.getClientState(gameState, finishAt).busyFormations, []);
  assert.equal(WorldExplorerService.getClientState(gameState, finishAt).idleMissions[0].position.q, 2);

  const continued = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 2,
    targetR: 1,
    formationSlot: 1,
  }, new Date(finishAt.getTime() + 1));

  assert.equal(continued.success, true);
  assert.equal(gameState.exploreMissions.length, 1);
  assert.equal(gameState.exploreMissions[0].id, started.mission.id);
  assert.equal(continued.mission.origin.q, 2);
  assert.equal(continued.mission.origin.r, 0);
  assert.equal(continued.mission.route.at(-1).q, 2);
  assert.equal(continued.mission.route.at(-1).r, 1);
});

test('world march can be redirected home', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 2,
    targetR: 0,
    formationSlot: 1,
  }, now);

  const returned = WorldExplorerService.returnWorldMarch(
    gameState,
    started.mission.id,
    new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS + 1),
  );

  assert.equal(returned.success, true);
  assert.equal(returned.mission.target.q, 0);
  assert.equal(returned.mission.target.r, 0);
});

test('random exploration still finishes as claimable ready report', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const started = WorldExplorerService.startExplore(gameState, { mode: 'random', routeLength: 2, formationSlot: 1 }, now);
  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);

  WorldExplorerService.advanceExploreMissions(gameState, finishAt);

  assert.equal(gameState.exploreMissions[0].status, 'ready');
  assert.equal(WorldExplorerService.getClientState(gameState, finishAt).readyMissions.length, 1);
});
