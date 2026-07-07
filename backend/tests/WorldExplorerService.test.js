const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const TutorialService = require('../services/TutorialService');
const WorldExplorerService = require('../services/WorldExplorerService');
const WorldMapService = require('../services/WorldMapService');
const GameStateNormalizer = require('../services/GameStateNormalizer');
const WorldCombatEncounterService = require('../services/worldCombat/WorldCombatEncounterService');
const WorldCampSpawner = require('../services/worldCombat/WorldCampSpawner');
const TutorialGrantService = require('../services/tutorial/TutorialGrantService');
const { materializeDiscoveredNeutralCity } = require('../services/worldCity/WorldCityPlayerDiscovery');
const { WorldEncounterRepository } = require('../repositories/WorldEncounterRepository');
require('../../frontend/js/ecs/foundation/WorldTime');
require('../../frontend/js/ecs/system/WorldMarchProgressSnapshot');
const WorldActorProjection = require('../../frontend/js/ecs/projection/WorldActorProjection');

// Build the guided-explore state at scoutFormationSaved. The companion city already exists in the
// player's map; the tutorial grant only records its site id and coordinate for guide targeting.
function createTutorialExploreState() {
  const scoutPersonId = 'fp-tutorial-scout';
  const gameState = {
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
  materializeDiscoveredNeutralCity(gameState, {
    id: 'site_1_0',
    x: 1,
    y: 0,
    owner: 'neutral',
    type: 'town',
    status: 'discovered',
    scale: 2,
    naturalName: 'First Companion',
    mapTerrain: 'plains',
  }, new Date('2026-06-06T00:00:00.000Z'));
  TutorialGrantService.grantTutorialFirstCity(gameState);
  return gameState;
}

function createSharedCombatContext(gameState, now = new Date('2026-06-22T00:00:00.000Z'), overrides = {}) {
  const db = new Database(':memory:');
  const repo = new WorldEncounterRepository(db, { worldSeed: gameState.worldMap?.seed || 'tutorial-explorer-seed' });
  repo.init();
  const planned = WorldCampSpawner.planCamps(gameState.worldMap?.seed || 'tutorial-explorer-seed', { q: 0, r: 0 }, {
    densityRoll: 1,
    maxCamps: 1,
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  })[0];
  assert.ok(planned, 'expected a deterministic shared camp fixture');
  const spec = {
    ...planned,
    id: 'camp_2_-1',
    q: 2,
    r: -1,
    tileId: WorldMapService.getTileId(2, -1),
    ring: 2,
  };
  const base = WorldCampSpawner.campSpecToEncounter(spec, now);
  const encounter = WorldCombatEncounterService.normalizeEncounter({
    ...base,
    ...overrides,
    defender: {
      ...base.defender,
      ...(overrides.defender || {}),
    },
  }, gameState, now);
  const stored = repo.upsertEncounter(encounter, now);
  return {
    db,
    repo,
    encounter: stored,
    worldContext: { worldEncounterRepo: repo },
  };
}

test('guided world march plans the route toward the spawn companion city and starts exploring', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  // The grant references the existing companion city; it does not carry its own city payload.
  assert.equal(gameState.tutorial.grants.firstExploreEmptyCity.siteId, 'site_1_0');
  assert.equal(gameState.tutorial.grants.firstExploreEmptyCity.x, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(gameState.tutorial.grants.firstExploreEmptyCity, 'city'), false);

  const result = WorldExplorerService.startWorldMarch(gameState, { targetQ: 2, targetR: 0, formationSlot: 1 }, now);

  assert.equal(result.success, true);
  assert.equal(gameState.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.scoutExploreStarted);
  assert.equal(result.mission.route.length, 2);
  assert.equal(result.mission.plannedTiles.length, 12);
  // No invented plannedSites — discovery is vision-driven now.
  assert.equal((result.mission.plannedSites || []).length, 0);
  assert.equal(result.mission.formation.slot, 1);
  assert.equal(result.mission.formationSnapshot.soldiersCommitted, 120);
  assert.equal(result.mission.formationSnapshot.soldiersRemaining, 120);
  assert.equal(result.mission.nextStepAt, new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS).toISOString());
  assert.equal(result.mission.completesAt, new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * 2).toISOString());
  assert.deepEqual(result.mission.formation.memberIds, ['fp-tutorial-scout']);
  // The companion city is already present when the player state is created.
  assert.equal(gameState.territories.some((territory) => territory.id === 'site_1_0'), true);
  assert.equal(gameState.worldMap.tiles.some((tile) => tile.siteId === 'site_1_0'), true);
});

test('guided world march keeps the same companion city identity and advances the tutorial', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  const firstCityId = gameState.tutorial.grants.firstExploreEmptyCity.siteId;
  WorldExplorerService.startWorldMarch(gameState, { targetQ: 2, targetR: 0, formationSlot: 1 }, now);
  const mission = gameState.exploreMissions[0];
  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * mission.route.length + 1);

  WorldExplorerService.advanceExploreMissions(gameState, finishAt);

  const discovered = gameState.territories.find((territory) => territory.id === firstCityId);
  assert.ok(discovered, 'the companion city remains the same neutral city after the guided march');
  assert.equal(discovered.owner, 'neutral');
  assert.equal(discovered.status, 'discovered');
  // §4-4: garrison/capitalDistance/battleTarget are DERIVED downstream, never authored here.
  assert.equal(Object.prototype.hasOwnProperty.call(discovered, 'garrison'), false);
  // The grant identity is unchanged (set at grant time) — the single source (§4-6).
  assert.equal(gameState.tutorial.grants.firstExploreEmptyCity.siteId, firstCityId);
  assert.equal(gameState.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.firstCityDiscovered);
  assert.equal(gameState.exploreMissions[0].status, 'idle');
  assert.equal(gameState.worldMap.tiles.some((tile) => tile.siteId === firstCityId), true);
  assert.equal(gameState.exploreMissions.length, 1);
});

test('stranded guided-explore tutorial step self-heals on the next mission pass', () => {
  // A revision race can persist the completed (idle) mission while losing the
  // tutorial-step write. The convergent advance must re-fire on later passes off the
  // ACTUAL discovery (the city's tile stays bound), not only on the one tick that discovered it.
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  WorldExplorerService.startWorldMarch(gameState, { targetQ: 2, targetR: 0, formationSlot: 1 }, now);
  const mission = gameState.exploreMissions[0];
  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * mission.route.length + 1);
  WorldExplorerService.advanceExploreMissions(gameState, finishAt);
  assert.equal(gameState.exploreMissions[0].status, 'idle');
  assert.equal(gameState.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.firstCityDiscovered);

  // Simulate the lost tutorial write: mission stayed idle + city stays discovered, step snapped back.
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

test('returned-home idle world march with mission id redeploys saved formation troops', () => {
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

  assert.equal(gameState.exploreMissions[0].formationSnapshot.settledAt, returnedAt.toISOString());
  assert.deepEqual(gameState.cities.capital.military.formations[0].soldierAssignments, {
    'fp-tutorial-scout': 120,
  });

  const next = WorldExplorerService.startWorldMarch(gameState, {
    missionId: started.mission.id,
    targetQ: 1,
    targetR: 1,
    formationSlot: 1,
  }, new Date(returnedAt.getTime() + 1));

  assert.equal(next.success, true);
  assert.equal(next.mission.formationSnapshot.soldiersCommitted, 120);
  assert.equal(next.mission.formationSnapshot.soldiersRemaining, 120);
  assert.equal(next.mission.formationSnapshot.members[0].soldiersRemaining, 120);
  assert.equal(next.mission.formationSnapshot.settledAt, null);
  assert.equal(Object.prototype.hasOwnProperty.call(gameState.exploreMissions[0].formation, 'soldierAssignments'), false);
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

test('world combat encounter is seeded near capital, engages on arrival, and force-settles on timeout', () => {
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
  const {
    db,
    repo,
    encounter,
    worldContext,
  } = createSharedCombatContext(gameState, now, {
    defender: { soldiers: 1, baseSoldiers: 1 },
  });

  try {
    assert.ok(encounter);
    assert.equal(WorldMapService.getWrappedDistance({ q: 0, r: 0 }, encounter), 2);

    const started = WorldExplorerService.startWorldMarch(gameState, {
      combatEncounterId: encounter.id,
      targetQ: 999,
      targetR: 999,
      formationSlot: 1,
      ...worldContext,
    }, now);

    assert.equal(started.success, true);
    assert.equal(started.mission.target.tileId, encounter.tileId);
    assert.equal(started.mission.combat.encounterId, encounter.id);
    assert.equal(gameState.exploreMissions[0].combat.status, 'marching');
    assert.equal(Object.prototype.hasOwnProperty.call(gameState.worldCombat, 'encounters'), false);

    // Arrival now ENGAGES (opens the interactive "retreat window") instead of auto-settling.
    const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);
    WorldExplorerService.advanceExploreMissions(gameState, finishAt, worldContext);
    const engagedMission = gameState.exploreMissions[0];
    assert.equal(engagedMission.status, 'idle');
    assert.equal(engagedMission.combat.status, 'engaged');
    assert.equal(engagedMission.combat.encounterId, encounter.id);
    assert.equal(typeof engagedMission.combat.engagedAt, 'string');
    assert.equal(engagedMission.combat.battleReportId, null);
    // Not settled yet: no report written, shared encounter still active.
    assert.equal(gameState.worldCombat.recentReports.length, 0);
    assert.equal(repo.getEncounter(encounter.id, { refreshRespawns: false }).status, 'active');

    // Offline fallback: nobody opened the battle. Advancing past AUTO_ENGAGE_FALLBACK_MS
    // force-settles the engagement with an allOut resolveEncounterBattle.
    const timeoutAt = new Date(finishAt.getTime() + WorldCombatEncounterService.AUTO_ENGAGE_FALLBACK_MS + 1);
    WorldExplorerService.advanceExploreMissions(gameState, timeoutAt, worldContext);
    const resolvedMission = gameState.exploreMissions[0];
    const resolvedEncounter = repo.getEncounter(encounter.id, { refreshRespawns: false });
    const clientState = WorldExplorerService.getClientState(gameState, timeoutAt, worldContext);

    assert.equal(resolvedMission.status, 'idle');
    assert.equal(resolvedMission.combat.status, 'resolved');
    assert.equal(Boolean(resolvedMission.combat.battleReportId), true);
    assert.equal(gameState.worldCombat.recentReports.length, 1);
    assert.equal(gameState.worldCombat.recentReports[0].report.mode, 'entity-battle');
    assert.equal(gameState.worldCombat.encounterIntel.byEncounterId[encounter.id].battleReportId, resolvedMission.combat.battleReportId);
    assert.equal(clientState.combat.recentReports.length, 1);
    assert.equal(resolvedEncounter.status, 'resolved');
    assert.equal(resolvedEncounter.battleReport, undefined);
    assert.equal(clientState.combat.activeEncounters.some((item) => item.id === encounter.id), false);
    assert.ok(resolvedMission.formationSnapshot.soldiersRemaining <= 180);
    WorldCombatEncounterService.normalizeCombatState(gameState, timeoutAt);
    assert.equal(Object.prototype.hasOwnProperty.call(gameState.worldCombat, 'encounters'), false);
    assert.equal(repo.getEncounter(encounter.id, { refreshRespawns: false }).status, 'resolved');
  } finally {
    db.close();
  }
});

test('world combat encounter rejects deployment when primary general has zero soldiers', () => {
  const now = new Date('2026-06-22T00:00:00.000Z');
  const gameState = createTutorialExploreState();
  gameState.tutorial = TutorialService.manualAdvance(gameState.tutorial, TutorialService.TUTORIAL_STEPS.completed);
  gameState.military.formations[0].soldierAssignments = { 'fp-tutorial-scout': 0 };
  gameState.cities.capital.military.formations = gameState.military.formations;
  const { db, encounter, worldContext } = createSharedCombatContext(gameState, now);

  try {
    const started = WorldExplorerService.startWorldMarch(gameState, {
      combatEncounterId: encounter.id,
      targetQ: encounter.q,
      targetR: encounter.r,
      formationSlot: 1,
      ...worldContext,
    }, now);

    assert.equal(started.success, false);
    assert.equal(started.error, 'WORLD_COMBAT_PRIMARY_NO_SOLDIERS');
    assert.equal(gameState.exploreMissions.length, 0);
  } finally {
    db.close();
  }
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
  const { db, encounter, worldContext } = createSharedCombatContext(gameState, now);

  try {
    const started = WorldExplorerService.startWorldMarch(gameState, {
      combatEncounterId: encounter.id,
      targetQ: encounter.q,
      targetR: encounter.r,
      formationSlot: 1,
      ...worldContext,
    }, now);

    assert.equal(started.success, true);
    assert.equal(started.mission.formationSnapshot.members.length, 2);
    assert.equal(started.mission.formationSnapshot.members[0].soldiersRemaining, 120);
    assert.equal(started.mission.formationSnapshot.members[1].soldiersRemaining, 0);
  } finally {
    db.close();
  }
});

// ---------------------------------------------------------------------------
// S4 — march-vision → pre-placed neutral city DISCOVERY (docs/design/10 §3.4).
// A NON-tutorial march whose vision covers a pre-placed neutral city (fed via
// planningContext.sharedWorldTerritories, S3's shared store) flips that city to
// discovered + on-map + persistently fog-revealed, without touching the tutorial path.
// ---------------------------------------------------------------------------

function createDiscoveryExploreState(seed = 'discovery-seed') {
  const rangerId = 'fp-ranger';
  const now = new Date('2026-06-06T00:00:00.000Z');
  return {
    playerId: 'world-explorer-discovery-test',
    activeCityId: 'capital',
    currentEra: 3,
    // Tutorial COMPLETED — this is the generic (non-tutorial) discovery path; the tutorial
    // plannedSites/grant branch must be inert so we exercise only §3.4.
    tutorial: {
      ...TutorialService.manualAdvance(
        TutorialService.createInitialTutorialState(),
        TutorialService.TUTORIAL_STEPS.completed,
      ),
    },
    territories: [{
      id: 'capital', x: 0, y: 0, naturalName: 'Origin', cityName: 'Capital',
      type: 'capital', owner: 'player', status: 'occupied',
    }],
    worldMap: WorldMapService.createInitialWorldMap(seed, now),
    famousPeople: [{ id: rangerId, name: 'Ranger' }],
    military: {
      soldiers: 300, soldierCap: 300,
      formations: [{ slot: 1, memberIds: [rangerId], soldierAssignments: { [rangerId]: 120 } }],
    },
    cities: {
      capital: {
        id: 'capital', territoryId: 'capital', buildings: { barracks: { level: 1 } },
        resources: { food: 500, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
        military: {
          soldiers: 300, soldierCap: 300,
          formations: [{ slot: 1, memberIds: [rangerId], soldierAssignments: { [rangerId]: 120 } }],
        },
      },
    },
    exploreMissions: [],
  };
}

function cityVisionSourceCount(gameState, q, r) {
  return (gameState.worldMap.visionHistory?.sources || [])
    .filter((source) => source.kind === 'city' && source.q === q && source.r === r).length;
}

test('S4 march vision reveals a pre-placed neutral city, flips it discovered + on-map + fog-permanent', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createDiscoveryExploreState();
  // A pre-placed neutral city at (2,1) — off the route line but inside the 3x3 reveal radius when the
  // army stands on the (2,0) step. Fed ONLY through the shared projection (S3), never in territories.
  const planningContext = {
    sharedWorldTerritories: [{
      id: 'site_2_1', x: 2, y: 1, owner: 'neutral', type: 'town', status: 'discovered',
      scale: 1, naturalName: '河湾村镇',
    }],
  };

  const started = WorldExplorerService.startWorldMarch(gameState, { targetQ: 3, targetR: 0, formationSlot: 1 }, now);
  assert.equal(started.success, true);
  // This shared city is still invisible to the player before its tile enters vision (§6-R2).
  assert.equal(gameState.territories.some((territory) => territory.id === 'site_2_1'), false);
  assert.equal(gameState.worldMap.tiles.some((tile) => tile.siteId === 'site_2_1'), false);

  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);
  WorldExplorerService.advanceExploreMissions(gameState, finishAt, { planningContext });

  const discovered = gameState.territories.find((territory) => territory.id === 'site_2_1');
  assert.ok(discovered, 'the pre-placed city is discovered once its tile enters vision');
  assert.equal(discovered.owner, 'neutral');
  assert.equal(discovered.status, 'discovered');
  // Position + names authored; garrison/capitalDistance/battleTarget are NOT hand-authored (§4-4).
  assert.equal(Object.prototype.hasOwnProperty.call(discovered, 'garrison'), false);
  // Tile carries the siteId (so the S3 client DTO gate reveals it, and garrison/conquest resolve).
  assert.equal(gameState.worldMap.tiles.some((tile) => tile.siteId === 'site_2_1'), true);
  // Discovery reveals the city tile but does not turn a neutral city into a vision source.
  assert.equal(cityVisionSourceCount(gameState, 2, 1), 0);
});

test('S4 discovered pre-placed city stays discovered without gaining city vision after re-normalize', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createDiscoveryExploreState();
  const planningContext = {
    sharedWorldTerritories: [{
      id: 'site_2_1', x: 2, y: 1, owner: 'neutral', type: 'town', status: 'discovered', scale: 1, naturalName: '河湾村镇',
    }],
  };
  const started = WorldExplorerService.startWorldMarch(gameState, { targetQ: 3, targetR: 0, formationSlot: 1 }, now);
  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);
  WorldExplorerService.advanceExploreMissions(gameState, finishAt, { planningContext });
  assert.equal(cityVisionSourceCount(gameState, 2, 1), 0);

  // The army has reached (3,0) and the mission is idle. Re-normalization must preserve the
  // discovered tile/site binding without inventing a city vision source for the neutral city.
  WorldMapService.ensureWorldMap(gameState, new Date(finishAt.getTime() + 60000));
  assert.equal(cityVisionSourceCount(gameState, 2, 1), 0);
  assert.equal(gameState.worldMap.tiles.some((tile) => tile.siteId === 'site_2_1'), true);
});

test('S4 discovery is idempotent — advancing twice discovers the city exactly once', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createDiscoveryExploreState();
  const planningContext = {
    sharedWorldTerritories: [{
      id: 'site_2_1', x: 2, y: 1, owner: 'neutral', type: 'town', status: 'discovered', scale: 1, naturalName: '河湾村镇',
    }],
  };
  const started = WorldExplorerService.startWorldMarch(gameState, { targetQ: 3, targetR: 0, formationSlot: 1 }, now);
  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);
  WorldExplorerService.advanceExploreMissions(gameState, finishAt, { planningContext });
  // advanceExploreMissions runs on every tick AND action write — a second pass must not re-discover.
  WorldExplorerService.advanceExploreMissions(gameState, new Date(finishAt.getTime() + 5000), { planningContext });

  assert.equal(gameState.territories.filter((territory) => territory.id === 'site_2_1').length, 1);
  assert.equal(gameState.worldMap.tiles.filter((tile) => tile.siteId === 'site_2_1').length, 1);
  assert.equal(cityVisionSourceCount(gameState, 2, 1), 0);
});

test('S4 discovery is consistent for a pre-placed city on the wrapped world seam (canonical ids)', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createDiscoveryExploreState();
  // The city is stored at canonical (1023,0); the army marches through display (-1,0) — the SAME
  // physical tile across the 1024-wide seam. Square reveal + wrapped distance must agree (§6-R-radius).
  const planningContext = {
    sharedWorldTerritories: [{
      id: 'site_1023_0', x: 1023, y: 0, owner: 'neutral', type: 'town', status: 'discovered', scale: 1, naturalName: '边缘哨所',
    }],
  };
  const started = WorldExplorerService.startWorldMarch(gameState, { targetQ: 1022, targetR: 0, formationSlot: 1 }, now);
  assert.equal(started.success, true);
  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);
  WorldExplorerService.advanceExploreMissions(gameState, finishAt, { planningContext });

  const discovered = gameState.territories.find((territory) => territory.id === 'site_1023_0');
  assert.ok(discovered, 'a seam-adjacent city is discovered via canonical id matching');
  assert.equal(discovered.status, 'discovered');
  assert.equal(
    gameState.worldMap.tiles.some((tile) => (
      WorldMapService.getCanonicalTileId(tile.q, tile.r) === 'tile_1023_0' && tile.siteId === 'site_1023_0'
    )),
    true,
  );
});

test('S4 discovery does NOT re-bind or re-discover a player-occupied territory on a revealed coord (R-guard)', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = createDiscoveryExploreState();
  // A player-owned/occupied territory already sits at (2,1). The march reveals its coord, but discovery
  // must leave ownership untouched — discovery is separate from ownership (§6-R-guard).
  gameState.territories.push({ id: 'owned_2_1', x: 2, y: 1, owner: 'player', status: 'occupied' });

  const started = WorldExplorerService.startWorldMarch(gameState, { targetQ: 3, targetR: 0, formationSlot: 1 }, now);
  const finishAt = new Date(now.getTime() + WorldExplorerService.EXPLORE_STEP_DURATION_MS * started.mission.route.length + 1);
  WorldExplorerService.advanceExploreMissions(gameState, finishAt, { planningContext: { sharedWorldTerritories: [] } });

  const owned = gameState.territories.find((territory) => territory.id === 'owned_2_1');
  assert.equal(owned.owner, 'player');
  assert.equal(owned.status, 'occupied');
  // No spurious neutral discovery was created at that coord.
  assert.equal(gameState.territories.some((territory) => territory.id.startsWith('site_')), false);
});
