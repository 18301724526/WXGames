const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialService = require('../services/TutorialService');
const WorldExplorerService = require('../services/WorldExplorerService');
const WorldMapService = require('../services/WorldMapService');
const GameStateNormalizer = require('../services/GameStateNormalizer');
const WorldCombatEncounterService = require('../services/worldCombat/WorldCombatEncounterService');
require('../../frontend/js/ecs/foundation/WorldTime');
require('../../frontend/js/ecs/system/WorldMarchProgressSnapshot');
const WorldActorProjection = require('../../frontend/js/ecs/projection/WorldActorProjection');

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
    famousPeople: [{ id: scoutPersonId, name: 'Tutorial Scout' }],
    military: {
      soldiers: 300,
      soldierCap: 300,
      formations: [{ slot: 1, memberIds: [scoutPersonId], soldierAssignments: { [scoutPersonId]: 120 } }],
    },
    cities: {
      capital: {
        id: 'capital',
        territoryId: 'capital',
        buildings: { barracks: { level: 1 } },
        resources: { food: 500, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
        military: {
          soldiers: 300,
          soldierCap: 300,
          formations: [{ slot: 1, memberIds: [scoutPersonId], soldierAssignments: { [scoutPersonId]: 120 } }],
        },
      },
    },
    exploreMissions: [],
  };
}

test('guided world march returns server-planned tiles and the first empty city plan', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();

  const result = WorldExplorerService.startWorldMarch(gameState, { targetQ: 2, targetR: 0, formationSlot: 1 }, now);

  assert.equal(result.success, true);
  assert.equal(gameState.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.scoutExploreStarted);
  assert.equal(result.mission.route.length, 2);
  assert.equal(result.mission.plannedTiles.length, 12);
  assert.equal(result.mission.plannedSites.length, 1);
  assert.equal(result.mission.plannedSites[0].site.id, result.mission.plannedSites[0].siteId);
  assert.equal(result.mission.plannedSites[0].site.owner, 'neutral');
  assert.equal(result.mission.plannedSites[0].site.status, 'discovered');
  assert.equal(result.mission.formation.slot, 1);
  assert.equal(result.mission.formationSnapshot.soldiersCommitted, 120);
  assert.equal(result.mission.formationSnapshot.soldiersRemaining, 120);
  assert.equal(result.mission.nextStepAt, new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS).toISOString());
  assert.equal(result.mission.completesAt, new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * 2).toISOString());
  assert.deepEqual(result.mission.formation.memberIds, ['fp-tutorial-scout']);
  assert.equal(gameState.territories.length, 1);
  assert.equal(gameState.territories[0].id, 'capital');
});

test('guided world march avoids shared occupied cities when choosing the first empty city target', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();

  const result = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 2,
    targetR: 0,
    formationSlot: 1,
    planningContext: {
      sharedWorldTerritories: [{
        id: 'other-player-city',
        x: 2,
        y: 0,
        owner: 'player',
        ownerPlayerId: 'other-player',
        status: 'occupied',
      }],
    },
  }, now);

  assert.equal(result.success, true);
  assert.equal(result.mission.target.tileId, 'tile_1_0');
  assert.equal(result.mission.route.length, 1);
  assert.equal(result.mission.plannedSites.length, 1);
  assert.equal(result.mission.plannedSites[0].tileId, 'tile_1_0');
  assert.equal(result.mission.plannedSites[0].site.id, 'site_1_0');
});

test('guided world march materializes the first neutral empty city without claim report flow', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const started = WorldExplorerService.startWorldMarch(gameState, { targetQ: 2, targetR: 0, formationSlot: 1 }, now);
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
  assert.equal(gameState.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.firstCityDiscovered);
  assert.equal(gameState.exploreMissions[0].status, 'idle');
  assert.equal(gameState.worldMap.tiles.some((tile) => tile.siteId === plannedSiteId), true);
  assert.equal(gameState.exploreMissions.length, 1);
});

test('stranded guided-explore tutorial step self-heals on the next mission pass', () => {
  // A revision race can persist the completed (idle) mission while losing the
  // tutorial-step write. The advance condition must converge on later passes,
  // not fire only on the one tick that flipped the mission to idle.
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  WorldExplorerService.startWorldMarch(gameState, { targetQ: 2, targetR: 0, formationSlot: 1 }, now);
  const mission = gameState.exploreMissions[0];
  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * mission.route.length + 1);
  WorldExplorerService.advanceExploreMissions(gameState, finishAt);
  assert.equal(gameState.exploreMissions[0].status, 'idle');

  // Simulate the lost tutorial write: mission stayed idle, step snapped back.
  gameState.tutorial.currentStep = TutorialService.TUTORIAL_STEPS.scoutExploreStarted;
  gameState.tutorial.completed = false;

  WorldExplorerService.advanceExploreMissions(gameState, new Date(finishAt.getTime() + 5000));

  assert.equal(gameState.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.firstCityDiscovered);
});

test('guided world march rejects a formation without the tutorial scout', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  gameState.military.formations[0].memberIds = ['fp-other'];
  gameState.cities.capital.military.formations[0].memberIds = ['fp-other'];

  const result = WorldExplorerService.startWorldMarch(gameState, { targetQ: 2, targetR: 0, formationSlot: 1 }, now);

  assert.equal(result.success, false);
  assert.equal(result.error, 'EXPLORE_TUTORIAL_FORMATION_REQUIRED');
  assert.equal(gameState.exploreMissions.length, 0);
});

test('world march starts a manual route and stops only at the server timeline tile', () => {
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
  assert.equal(started.authority.status, 'accepted');
  assert.equal(started.authority.command.type, 'startWorldMarch');
  assert.equal(started.authority.timeline.stopTile.tileId, 'tile_0_0');

  const stopped = WorldExplorerService.stopWorldMarch(gameState, started.mission.id, {
    targetQ: 999,
    targetR: 999,
  }, new Date('2026-06-06T00:00:01.000Z'));

  assert.equal(stopped.success, true);
  assert.equal(stopped.mission.target.q, 0);
  assert.equal(stopped.mission.target.r, 0);
  assert.equal(stopped.authority.status, 'accepted');
  assert.equal(stopped.authority.command.type, 'stopWorldMarch');
  assert.equal(stopped.authority.timeline.stopTile.tileId, 'tile_0_0');
});

test('world march does not treat world actor identity as reusable mission identity', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();

  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 2,
    targetR: 0,
    formationSlot: 1,
    actorId: 'hostile_force_capital_ridge',
  }, now);

  assert.equal(started.success, true);
  assert.equal(started.mission.target.q, 2);
  assert.equal(started.mission.target.r, 0);
});

test('world march treats client input intent as evidence, not coordinate authority', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();

  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 2,
    targetR: 0,
    formationSlot: 1,
    clientInputIntent: {
      schema: 'world-map-input-intent-v1',
      target: { kind: 'tile', tileId: 'tile_999_999', targetQ: 999, targetR: 999 },
      picking: { inputEpoch: 9, signature: 'client-sig' },
      view: { camera: { x: 12, y: -4 } },
    },
  }, now);

  assert.equal(started.success, true);
  assert.equal(started.mission.target.q, 2);
  assert.equal(started.mission.target.r, 0);
  assert.equal(started.authority.command.clientInput.target.targetQ, 999);
  assert.equal(started.authority.timeline.stopTile.tileId, 'tile_0_0');
});

test('return world march carries client input evidence into authority envelope', () => {
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
    { clientInputIntent: { schema: 'world-map-input-intent-v1', target: { kind: 'actor', actorId: started.mission.id } } },
    new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS + 1),
  );

  assert.equal(returned.success, true);
  assert.equal(returned.authority.command.type, 'returnWorldMarch');
  assert.equal(returned.authority.command.clientInput.target.actorId, started.mission.id);
});

test('stopped world march remains a client-visible idle mission after normalization', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 2,
    targetR: 0,
    formationSlot: 1,
  }, now);

  const stopped = WorldExplorerService.stopWorldMarch(
    gameState,
    started.mission.id,
    {},
    new Date(now.getTime() + 1000),
  );
  const clientState = WorldExplorerService.getClientState(gameState, new Date(now.getTime() + 1001));

  assert.equal(stopped.success, true);
  assert.equal(stopped.mission.status, 'idle');
  assert.equal(stopped.mission.route.length, 0);
  assert.equal(clientState.missions.length, 1);
  assert.equal(clientState.idleMissions[0].id, started.mission.id);
  assert.equal(clientState.idleMissions[0].position.tileId, stopped.mission.position.tileId);
});

test('world march treats wrapped edge targets as adjacent movement', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();

  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 1023,
    targetR: 0,
    formationSlot: 1,
  }, now);

  assert.equal(WorldMapService.getWrappedDistance({ q: 0, r: 0 }, { q: 1023, r: 0 }), 1);
  assert.equal(started.success, true);
  assert.equal(started.mission.route.length, 1);
  assert.equal(started.mission.route[0].q, -1);
  assert.equal(WorldMapService.getCanonicalTileId(started.mission.route[0].q, started.mission.route[0].r), 'tile_1023_0');
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

test('world march with mission id reuses the selected idle mission even when formation options differ', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  gameState.tutorial = TutorialService.manualAdvance(gameState.tutorial, TutorialService.TUTORIAL_STEPS.completed);
  gameState.exploreMissions = [WorldExplorerService.normalizeMission({
    id: 'manual-frontier',
    mode: 'manual',
    status: 'idle',
    origin: { q: 4, r: -1 },
    homeOrigin: { q: 0, r: 0 },
    target: { q: 4, r: -1 },
    position: { q: 4, r: -1 },
    route: [],
    formation: { cityId: 'frontier-city', slot: 2, memberIds: ['fp-tutorial-scout'] },
    stepDurationMs: WorldExplorerService.EXPLORE_STEP_DURATION_MS,
  })];

  const result = WorldExplorerService.startWorldMarch(gameState, {
    missionId: 'manual-frontier',
    cityId: 'capital',
    formationSlot: 1,
    targetQ: 6,
    targetR: -1,
  }, new Date(now.getTime() + 1));

  assert.equal(result.success, true);
  assert.equal(gameState.exploreMissions.length, 1);
  assert.equal(result.mission.id, 'manual-frontier');
  assert.equal(result.mission.origin.tileId, 'tile_4_-1');
  assert.equal(result.mission.route.at(-1).tileId, 'tile_6_-1');
  assert.deepEqual(gameState.exploreMissions[0].formation, { cityId: 'frontier-city', slot: 2, memberIds: ['fp-tutorial-scout'] });
});

test('world march with missing mission id fails without creating a new mission', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  gameState.tutorial = TutorialService.manualAdvance(gameState.tutorial, TutorialService.TUTORIAL_STEPS.completed);

  const result = WorldExplorerService.startWorldMarch(gameState, {
    missionId: 'missing-mission',
    targetQ: 2,
    targetR: 0,
    formationSlot: 1,
  }, now);

  assert.equal(result.success, false);
  assert.equal(result.error, 'EXPLORE_MISSION_NOT_FOUND');
  assert.equal(gameState.exploreMissions.length, 0);
});

test('world march without mission id still creates a new manual mission by formation', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();

  const result = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 2,
    targetR: 0,
    formationSlot: 1,
  }, now);

  assert.equal(result.success, true);
  assert.match(result.mission.id, /^explore_manual_/);
  assert.equal(gameState.exploreMissions.length, 1);
  assert.equal(result.mission.formation.cityId, 'capital');
  assert.equal(result.mission.formation.slot, 1);
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
  assert.equal(returned.mission.origin.q, 1);
  assert.equal(returned.authority.command.type, 'returnWorldMarch');
});

test('returned world march carries server-planned route footprint', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 3,
    targetR: 0,
    formationSlot: 1,
  }, now);
  const returnAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * 2 + 1);

  const returned = WorldExplorerService.returnWorldMarch(
    gameState,
    started.mission.id,
    returnAt,
  );

  assert.equal(returned.success, true);
  assert.equal(returned.mission.origin.tileId, 'tile_2_0');
  assert.equal(returned.mission.target.tileId, 'tile_0_0');
  assert.equal(returned.mission.route.length, 2);
  assert.ok(returned.mission.plannedTiles.length > returned.mission.route.length);
  assert.equal(returned.mission.plannedTiles.some((tile) => tile.id === 'tile_1_0'), true);
  assert.equal(returned.mission.plannedTiles.some((tile) => tile.id === 'tile_0_0'), true);
  assert.equal(gameState.exploreMissions[0].plannedTiles.length, returned.mission.plannedTiles.length);
});

test('stopped world march carries server-planned route footprint when stop tile is ahead', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 3,
    targetR: 0,
    formationSlot: 1,
  }, now);
  const stopAt = new Date(now.getTime() + Math.floor(WorldExplorerService.EXPLORE_STEP_DURATION_MS * 0.75));

  const stopped = WorldExplorerService.stopWorldMarch(
    gameState,
    started.mission.id,
    {},
    stopAt,
  );

  assert.equal(stopped.success, true);
  assert.equal(stopped.mission.origin.tileId, 'tile_0_0');
  assert.equal(stopped.mission.target.tileId, 'tile_1_0');
  assert.equal(stopped.mission.route.length, 1);
  assert.ok(stopped.mission.plannedTiles.length > stopped.mission.route.length);
  assert.equal(stopped.mission.plannedTiles.some((tile) => tile.id === 'tile_1_0'), true);
  assert.equal(gameState.exploreMissions[0].plannedTiles.length, stopped.mission.plannedTiles.length);
});

test('idle world march can return home from its parked tile', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 2,
    targetR: 0,
    formationSlot: 1,
  }, now);
  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);

  WorldExplorerService.advanceExploreMissions(gameState, finishAt);
  assert.equal(gameState.exploreMissions[0].status, 'idle');
  assert.equal(gameState.exploreMissions[0].position.q, 2);

  const returned = WorldExplorerService.returnWorldMarch(
    gameState,
    started.mission.id,
    new Date(finishAt.getTime() + 1),
  );

  assert.equal(returned.success, true);
  assert.equal(returned.mission.origin.q, 2);
  assert.equal(returned.mission.origin.r, 0);
  assert.equal(returned.mission.target.q, 0);
  assert.equal(returned.mission.target.r, 0);
  assert.equal(returned.authority.command.type, 'returnWorldMarch');
});

test('returned-home idle world march stays in explorer state but leaves the world actor projection', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 2,
    targetR: 0,
    formationSlot: 1,
  }, now);
  const reachedTargetAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);
  WorldExplorerService.advanceExploreMissions(gameState, reachedTargetAt);
  const returned = WorldExplorerService.returnWorldMarch(
    gameState,
    started.mission.id,
    new Date(reachedTargetAt.getTime() + 1),
  );
  const returnedAt = new Date(new Date(returned.mission.completesAt).getTime() + 1);
  WorldExplorerService.advanceExploreMissions(gameState, returnedAt);

  const clientState = WorldExplorerService.getClientState(gameState, returnedAt);
  const actors = WorldActorProjection.projectWorldActors(clientState, { nowMs: returnedAt.getTime() });

  assert.equal(clientState.idleMissions.length, 1);
  assert.equal(clientState.idleMissions[0].position.tileId, 'tile_0_0');
  assert.equal(actors.some((actor) => actor.missionId === started.mission.id), false);
});

test('returned-home world march settles surviving snapshot troops back to the saved formation', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 2,
    targetR: 0,
    formationSlot: 1,
  }, now);
  const reachedTargetAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);
  WorldExplorerService.advanceExploreMissions(gameState, reachedTargetAt);
  gameState.exploreMissions[0].formationSnapshot.members[0].soldiersRemaining = 77;
  gameState.exploreMissions[0].formationSnapshot.soldiersRemaining = 77;
  const returned = WorldExplorerService.returnWorldMarch(
    gameState,
    started.mission.id,
    new Date(reachedTargetAt.getTime() + 1),
  );
  const returnedAt = new Date(new Date(returned.mission.completesAt).getTime() + 1);

  WorldExplorerService.advanceExploreMissions(gameState, returnedAt);

  const formation = gameState.cities.capital.military.formations[0];
  assert.deepEqual(formation.soldierAssignments, { 'fp-tutorial-scout': 77 });
  assert.equal(gameState.exploreMissions[0].formationSnapshot.settledAt, returnedAt.toISOString());
});

test('returned-home idle world march can start a new march from home', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 2,
    targetR: 0,
    formationSlot: 1,
  }, now);
  const reachedTargetAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);
  WorldExplorerService.advanceExploreMissions(gameState, reachedTargetAt);
  const returned = WorldExplorerService.returnWorldMarch(
    gameState,
    started.mission.id,
    new Date(reachedTargetAt.getTime() + 1),
  );
  const returnedAt = new Date(new Date(returned.mission.completesAt).getTime() + 1);
  WorldExplorerService.advanceExploreMissions(gameState, returnedAt);

  const next = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: 1,
    targetR: 1,
    formationSlot: 1,
  }, new Date(returnedAt.getTime() + 1));

  assert.equal(next.success, true);
  assert.equal(gameState.exploreMissions.length, 1);
  assert.equal(next.mission.origin.tileId, 'tile_0_0');
  assert.equal(next.mission.route.at(-1).tileId, 'tile_1_1');
});

test('returned world march respects materialized home terrain when natural terrain is blocked', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  // (-214,-14) is an open-ocean core tile ('full' template); the march walks the
  // marchable shore tile (-214,-15) and ends on land at (-214,-16), where the
  // tutorial empty-city guarantee can still plan its site.
  gameState.territories[0] = {
    ...gameState.territories[0],
    x: -214,
    y: -14,
  };
  gameState.worldMap = WorldMapService.createInitialWorldMap(
    WorldMapService.DEFAULT_WORLD_SEED,
    now,
    { origin: { q: -214, r: -14 } },
  );

  assert.equal(WorldMapService.chooseTerrain(WorldMapService.DEFAULT_WORLD_SEED, -214, -14), 'ocean');
  assert.equal(WorldMapService.chooseTerrain(WorldMapService.DEFAULT_WORLD_SEED, -214, -15), 'shore');
  assert.equal(gameState.worldMap.tiles.find((tile) => tile.q === -214 && tile.r === -14)?.terrain, 'capital');

  const started = WorldExplorerService.startWorldMarch(gameState, {
    targetQ: -214,
    targetR: -16,
    formationSlot: 1,
  }, now);
  const reachedTargetAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);
  WorldExplorerService.advanceExploreMissions(gameState, reachedTargetAt);

  const returned = WorldExplorerService.returnWorldMarch(
    gameState,
    started.mission.id,
    new Date(reachedTargetAt.getTime() + 1),
  );
  const returnedAt = new Date(new Date(returned.mission.completesAt).getTime() + 1);
  WorldExplorerService.advanceExploreMissions(gameState, returnedAt);
  const clientState = WorldExplorerService.getClientState(gameState, returnedAt);

  assert.equal(started.success, true);
  assert.equal(returned.success, true);
  assert.equal(returned.mission.target.tileId, 'tile_-214_-14');
  assert.equal(gameState.exploreMissions[0].position.tileId, 'tile_-214_-14');
  assert.equal(clientState.idleMissions[0].position.tileId, 'tile_-214_-14');
});

test('world march client state does not expose retired ready reports', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const started = WorldExplorerService.startWorldMarch(gameState, { targetQ: 2, targetR: 0, formationSlot: 1 }, now);
  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);

  WorldExplorerService.advanceExploreMissions(gameState, finishAt);
  const clientState = WorldExplorerService.getClientState(gameState, finishAt);

  assert.equal(gameState.exploreMissions[0].status, 'idle');
  assert.equal(Object.prototype.hasOwnProperty.call(clientState, 'readyMissions'), false);
});

test('world combat encounter is seeded near capital and resolves when a formation arrives', () => {
  const now = new Date('2026-06-22T00:00:00.000Z');
  const gameState = GameStateNormalizer.createInitialGameState('world-combat-chain-test', { now });
  gameState.tutorial = TutorialService.manualAdvance(gameState.tutorial, TutorialService.TUTORIAL_STEPS.completed);
  gameState.famousPeople = [{
    id: 'fp-commander',
    name: 'Commander',
    attributes: { force: 95, command: 90, speed: 80, intelligence: 60, politics: 40, charisma: 50 },
  }];
  gameState.military = {
    ...(gameState.military || {}),
    soldiers: 300,
    soldierCap: 300,
    formations: [{
      slot: 1,
      memberIds: ['fp-commander'],
      soldierAssignments: { 'fp-commander': 180 },
    }],
  };
  gameState.cities.capital = gameState.cities.capital || { id: 'capital', territoryId: 'capital' };
  gameState.cities.capital.military = {
    ...(gameState.cities.capital.military || {}),
    soldiers: 300,
    soldierCap: 300,
    formations: gameState.military.formations,
  };
  const combatState = WorldCombatEncounterService.normalizeCombatState(gameState, now);
  const encounter = combatState.encounters.find((item) => item.id === WorldCombatEncounterService.ENCOUNTER_ID);

  assert.ok(encounter);
  assert.equal(WorldMapService.getWrappedDistance({ q: 0, r: 0 }, encounter), 2);

  const started = WorldExplorerService.startWorldMarch(gameState, {
    combatEncounterId: encounter.id,
    targetQ: 999,
    targetR: 999,
    formationSlot: 1,
  }, now);

  assert.equal(started.success, true);
  assert.equal(started.mission.target.tileId, encounter.tileId);
  assert.equal(started.mission.combat.encounterId, encounter.id);
  assert.equal(gameState.exploreMissions[0].combat.status, 'marching');

  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);
  WorldExplorerService.advanceExploreMissions(gameState, finishAt);
  const resolvedMission = gameState.exploreMissions[0];
  const resolvedEncounter = gameState.worldCombat.encounters.find((item) => item.id === encounter.id);
  const clientState = WorldExplorerService.getClientState(gameState, finishAt);

  assert.equal(resolvedMission.status, 'idle');
  assert.equal(resolvedMission.combat.status, 'resolved');
  assert.equal(Boolean(resolvedMission.combat.battleReportId), true);
  assert.equal(gameState.worldCombat.recentReports.length, 1);
  assert.equal(gameState.worldCombat.recentReports[0].report.mode, 'entity-battle');
  assert.equal(clientState.combat.recentReports.length, 1);
  assert.equal(resolvedEncounter.status, 'resolved');
  assert.equal(clientState.combat.activeEncounters.some((item) => item.id === encounter.id), true);
  assert.equal(clientState.combat.activeEncounters.find((item) => item.id === encounter.id).resolvedAt, null);
  assert.ok(resolvedMission.formationSnapshot.soldiersRemaining <= 180);
  WorldCombatEncounterService.normalizeCombatState(gameState, finishAt);
  const renormalizedEncounter = gameState.worldCombat.encounters.find((item) => item.id === encounter.id);
  assert.equal(renormalizedEncounter.status, 'active');
});

test('world combat encounter rejects deployment when primary general has zero soldiers', () => {
  const now = new Date('2026-06-22T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  gameState.tutorial = TutorialService.manualAdvance(gameState.tutorial, TutorialService.TUTORIAL_STEPS.completed);
  gameState.military.formations[0].soldierAssignments = { 'fp-tutorial-scout': 0 };
  gameState.cities.capital.military.formations = gameState.military.formations;
  const combatState = WorldCombatEncounterService.normalizeCombatState(gameState, now);
  const encounter = combatState.encounters.find((item) => item.id === WorldCombatEncounterService.ENCOUNTER_ID);

  const started = WorldExplorerService.startWorldMarch(gameState, {
    combatEncounterId: encounter.id,
    targetQ: encounter.q,
    targetR: encounter.r,
    formationSlot: 1,
  }, now);

  assert.equal(started.success, false);
  assert.equal(started.error, 'WORLD_COMBAT_PRIMARY_NO_SOLDIERS');
  assert.equal(gameState.exploreMissions.length, 0);
});

test('world combat encounter allows deployment when only a deputy has zero soldiers', () => {
  const now = new Date('2026-06-22T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  gameState.tutorial = TutorialService.manualAdvance(gameState.tutorial, TutorialService.TUTORIAL_STEPS.completed);
  gameState.famousPeople.push({ id: 'fp-deputy', name: 'Deputy' });
  gameState.military.formations[0] = {
    slot: 1,
    memberIds: ['fp-tutorial-scout', 'fp-deputy'],
    soldierAssignments: { 'fp-tutorial-scout': 120, 'fp-deputy': 0 },
  };
  gameState.cities.capital.military.formations = gameState.military.formations;
  const combatState = WorldCombatEncounterService.normalizeCombatState(gameState, now);
  const encounter = combatState.encounters.find((item) => item.id === WorldCombatEncounterService.ENCOUNTER_ID);

  const started = WorldExplorerService.startWorldMarch(gameState, {
    combatEncounterId: encounter.id,
    targetQ: encounter.q,
    targetR: encounter.r,
    formationSlot: 1,
  }, now);

  assert.equal(started.success, true);
  assert.equal(started.mission.formationSnapshot.members.length, 2);
  assert.equal(started.mission.formationSnapshot.members[0].soldiersRemaining, 120);
  assert.equal(started.mission.formationSnapshot.members[1].soldiersRemaining, 0);
});
