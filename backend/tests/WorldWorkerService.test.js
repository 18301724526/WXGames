const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const WorldWorkerService = require('../services/realtime/WorldWorkerService');
const { CommandExecutionPipeline } = require('../application/commands/CommandExecutionPipeline');
const { CommandIdempotencyStore } = require('../application/commands/CommandIdempotencyStore');
const { getOwnerContext } = require('../application/commands/CommandOwnerContext');
const GameStateRepository = require('../repositories/GameStateRepository');
const GameStateService = require('../services/GameStateService');
const WorldCombatEncounterService = require('../services/worldCombat/WorldCombatEncounterService');
const WorldMapService = require('../services/WorldMapService');

function createService(options = {}) {
  const repository = options.repository || {};
  const db = new Database(':memory:');
  const schemaRepository = new GameStateRepository(db);
  schemaRepository.init();
  const idempotencyStore = new CommandIdempotencyStore(db);
  const pipelineRepository = {
    worldEncounterRepo: repository.worldEncounterRepo || null,
    withOwnerLocks(ownerKeys, scope, callback, lockOptions = {}) {
      if (typeof repository.withOwnerLocks === 'function') {
        return repository.withOwnerLocks(ownerKeys, scope, callback, lockOptions);
      }
      const playerKey = ownerKeys.find((ownerKey) => ownerKey.startsWith('player:'));
      if (playerKey && typeof repository.withPlayerStateLock === 'function') {
        const timeoutResult = Symbol('owner-lock-timeout');
        const result = repository.withPlayerStateLock(
          playerKey.slice('player:'.length),
          () => callback({ schema: 'owner-lock-context-v1', ownerKeys, scope }),
          { ...lockOptions, scope, timeoutResult },
        );
        if (result === timeoutResult) {
          const error = new Error(`Owner lock is already held for ${playerKey}`);
          error.code = 'OWNER_LOCK_TIMEOUT';
          error.ownerKey = playerKey;
          throw error;
        }
        return result;
      }
      return callback({ schema: 'owner-lock-context-v1', ownerKeys, scope });
    },
    findByPlayerId(...args) {
      return repository.findByPlayerId?.(...args) || null;
    },
    save(state, saveOptions = {}) {
      return repository.save?.(state, saveOptions) || state;
    },
    commitCommandState(state, mutations = {}, commitOptions = {}) {
      options.onCommitCommandState?.({ state, mutations, commitOptions });
      if (typeof repository.commitCommandState === 'function') {
        return repository.commitCommandState(state, mutations, commitOptions);
      }
      const savedState = commitOptions.persistState === false
        ? state
        : (repository.save?.(state, commitOptions) || state);
      for (const mutation of (mutations.playerStates || [])) {
        const playerState = mutation.state || mutation;
        repository.save?.(playerState, {
          ...commitOptions,
          expectedRevision: mutation.expectedRevision ?? playerState?.revision,
        });
      }
      for (const mutation of (mutations.encounters || [])) {
        repository.worldEncounterRepo?.upsertEncounter?.(
          mutation.encounter || mutation,
          mutation.now,
        );
      }
      for (const mutation of (mutations.people || [])) {
        options.worldPeopleRepo?.upsertPerson?.(mutation.person || mutation, mutation.now);
      }
      for (const mutation of (mutations.diplomacyEdges || [])) {
        repository.factionDiplomacyRepo?.upsertEdge?.(
          mutation.fromFactionId,
          mutation.toFactionId,
          mutation.edge,
          mutation.now,
        );
      }
      return { savedState, shared: {} };
    },
  };
  const commandExecutionPipeline = new CommandExecutionPipeline({
    repository: pipelineRepository,
    idempotencyStore,
  });
  return new WorldWorkerService({ ...options, repository, commandExecutionPipeline });
}

test('WorldWorkerService reports an explicit split command batch before touching state', () => {
  const calls = [];
  const service = createService({
    repository: {
      findRecentlyActive() {
        calls.push('findRecentlyActive');
        return [];
      },
    },
    commandEntryReporter(report) {
      calls.push('commandEntryReporter');
      assert.equal(report.inventoryId, 'worker:world-worker-runtime-writes');
    },
    now: () => new Date('2026-07-10T00:00:00.000Z'),
  });

  const summary = service.tickOnce();

  assert.deepEqual(calls, ['findRecentlyActive']);
  assert.equal(summary.commandEntry.ownerResolution.status, 'split');
  assert.equal(summary.commandEntry.idempotencyClassification, 'internal-idempotent');
  assert.deepEqual(summary.commandEntry.commandTypes, [
    'worldWorkerPlayerTick',
    'worldWorkerPersonUpdate',
    'worldWorkerDiplomacyTick',
  ]);
});

test('WorldWorkerService owns runtime advancement outside the gateway API process', () => {
  const calls = [];
  const service = createService({
    repository: {
      findRecentlyActive(activeSinceIso, limit) {
        calls.push(['findRecentlyActive', activeSinceIso, limit]);
        return [{ playerId: 'bot00001' }, { playerId: 'bot00002' }];
      },
      save(state) {
        calls.push(['save', state.playerId, state.updatedAt]);
      },
    },
    gameStateService: {
      advanceRuntimeState(state, now, options) {
        calls.push(['advanceRuntimeState', state.playerId, now.toISOString(), options]);
        return { ...state, advanced: true };
      },
    },
    cityService: {
      advanceAllCities(state, seconds) {
        calls.push(['advanceAllCities', state.playerId, seconds]);
      },
    },
    territoryService: {
      updateMissionReadiness(state) {
        calls.push(['updateMissionReadiness', state.playerId]);
      },
    },
    eventService: {
      cleanupRuntimeState(state) {
        calls.push(['cleanupRuntimeState', state.playerId]);
      },
      maybeGenerateRegularEvent(state) {
        calls.push(['maybeGenerateRegularEvent', state.playerId]);
      },
      maybeGenerateThreatEvent(state) {
        calls.push(['maybeGenerateThreatEvent', state.playerId]);
      },
    },
    now: () => new Date('2026-06-12T00:00:05.000Z'),
    intervalMs: 5000,
    activeWindowMs: 120000,
    activeLimit: 25,
  });

  const summary = service.tickOnce();

  assert.equal(summary.processedCount, 2);
  assert.equal(summary.intervalMs, 5000);
  assert.equal(summary.activeLimit, 25);
  assert.deepEqual(calls.map((call) => call[0]), [
    'findRecentlyActive',
    'advanceRuntimeState',
    'advanceAllCities',
    'updateMissionReadiness',
    'cleanupRuntimeState',
    'maybeGenerateRegularEvent',
    'maybeGenerateThreatEvent',
    'save',
    'advanceRuntimeState',
    'advanceAllCities',
    'updateMissionReadiness',
    'cleanupRuntimeState',
    'maybeGenerateRegularEvent',
    'maybeGenerateThreatEvent',
    'save',
  ]);
});

test('WorldWorkerService advances player runtime without background AI world expansion', () => {
  const calls = [];
  const worldEncounterRepo = { getAllEncounters: () => [] };
  const service = createService({
    repository: {
      worldEncounterRepo,
      findRecentlyActive() {
        return [{
          playerId: 'test1',
          worldAi: {
            explorers: [{
              id: 'ai-frontier-1',
              nextStepAt: '2026-06-11T23:00:00.000Z',
            }],
          },
          worldMap: {
            tiles: Array.from({ length: 2100 }, (_, index) => ({
              id: `hidden_${index}`,
              q: index,
              r: 0,
              visibility: 'hidden',
              visible: false,
            })),
          },
        }];
      },
      getClientProjectionForPlayer(playerId) {
        calls.push(['getClientProjectionForPlayer', playerId]);
        return {
          sharedWorldTerritories: [{ id: 'worker-shared-site' }],
          sharedWorldEncounters: [{ id: 'worker-shared-camp' }],
        };
      },
      save(state) {
        calls.push(['save', state.playerId]);
      },
    },
    gameStateService: {
      advanceRuntimeState(state, _now, options) {
        calls.push(['advanceRuntimeState', state.playerId, options]);
        return state;
      },
    },
    worldAiService: {
      advanceAiExploration() {
        throw new Error('world worker must not expand AI exploration inside player ticks');
      },
    },
    now: () => new Date('2026-06-12T00:00:05.000Z'),
  });

  const summary = service.tickOnce();

  assert.equal(summary.processedCount, 1);
  assert.equal(typeof calls[1][2].stageEncounter, 'function');
  delete calls[1][2].stageEncounter;
  assert.deepEqual(calls, [
    ['getClientProjectionForPlayer', 'test1'],
    ['advanceRuntimeState', 'test1', {
      advanceWorldAi: false,
      marchVerification: { enabled: true },
      planningContext: {
        sharedWorldTerritories: [{ id: 'worker-shared-site' }],
        sharedWorldEncounters: [{ id: 'worker-shared-camp' }],
      },
      worldEncounterRepo,
      sharedWorldEncounters: [{ id: 'worker-shared-camp' }],
    }],
    ['save', 'test1'],
  ]);
});

test('WorldWorkerService advances shared social and diplomacy ticks once per batch', () => {
  const calls = [];
  const reports = [];
  const commitCalls = [];
  const saved = new Map();
  const statesByPlayer = {
    p1: { playerId: 'p1', famousPeople: [{ id: 'p1-ruler', name: 'P1', relationships: [] }] },
    p2: { playerId: 'p2', famousPeople: [{ id: 'p2-ruler', name: 'P2', relationships: [] }] },
  };
  const makePerson = (person) => ({
    ...person,
    personality: { axes: { boldness: 0, sociability: 0, integrity: 0 }, nature: 'calm' },
    relationships: person.relationships || [],
  });
  const sharedPeopleById = new Map([
    ['ai-ruler', makePerson({ id: 'ai-ruler', name: 'AI', factionId: 'ai_wei' })],
  ]);
  const service = createService({
    repository: {
      factionDiplomacyRepo: {
        upsertEdge(fromFactionId, toFactionId) {
          calls.push(['upsertEdge', fromFactionId, toFactionId]);
        },
      },
      findRecentlyActive() {
        return [statesByPlayer.p1, statesByPlayer.p2];
      },
      findByPlayerId(playerId) {
        return { ...statesByPlayer[playerId], famousPeople: statesByPlayer[playerId].famousPeople.map((p) => ({ ...p })) };
      },
      save(state) {
        statesByPlayer[state.playerId] = {
          ...state,
          famousPeople: state.famousPeople.map((person) => ({ ...person })),
        };
        saved.set(state.playerId, state);
        return state;
      },
    },
    gameStateService: { advanceRuntimeState: (state) => state },
    worldPeopleRepo: {
      getAllPeople() {
        return [...sharedPeopleById.values()].map((person) => ({ ...person }));
      },
      getPerson(personId) {
        const person = sharedPeopleById.get(personId);
        return person ? { ...person } : null;
      },
      upsertPerson(person) {
        sharedPeopleById.set(person.id, { ...person });
        calls.push(['upsertPerson', person.id, person.relationships.length]);
      },
    },
    worldPeopleRegistryService: {
      materializePlayerRoster(state) {
        return state.famousPeople.map(makePerson);
      },
    },
    worldSocialTickService: {
      advanceRelationships(people, opts) {
        const ownerContext = getOwnerContext();
        assert.equal(ownerContext.ownerKey, 'world-social:global');
        assert.deepEqual(ownerContext.ownerKeys, [
          'person:ai-ruler',
          'player:p1',
          'player:p2',
          'world-social:global',
        ]);
        calls.push(['advanceRelationships', people.map((p) => p.id).sort().join(','), opts.meetPairs]);
        return {
          people: people.map((person) => ({
            ...person,
            relationships: person.id === 'p1-ruler'
              ? [{ toPersonId: 'ai-ruler', affinity: 10 }]
              : person.id === 'ai-ruler'
                ? [{ toPersonId: 'p1-ruler', affinity: 10 }]
                : person.relationships,
          })),
          meets: [{ from: 'p1-ruler', to: 'ai-ruler' }],
          crossings: [],
        };
      },
    },
    factionRegistryService: {
      getAliveFactions(state) {
        return [
          { id: `player_${state.playerId}`, rulerPersonId: `${state.playerId}-ruler` },
          { id: 'ai_wei', rulerPersonId: 'ai-ruler' },
        ];
      },
      getFaction(factionId, state) {
        return this.getAliveFactions(state).find((faction) => faction.id === factionId) || null;
      },
    },
    worldDiplomacyTickService: {
      driftContext(fromFactionId, toFactionId, opts) {
        calls.push([
          'driftContext',
          [fromFactionId, toFactionId].sort().join(','),
          Boolean(opts.rulerOf('ai_wei')),
        ]);
        return { sharedEnemies: 0, bordering: false, rulerCompat: 0 };
      },
    },
    factionDiplomacyService: {
      planAdvanceEdge(fromFactionId, toFactionId, _forward, _reverse, now) {
        calls.push(['planAdvanceEdge', fromFactionId, toFactionId]);
        return {
          forward: { fromFactionId, toFactionId, edge: {}, now },
          reverse: {
            fromFactionId: toFactionId,
            toFactionId: fromFactionId,
            edge: {},
            now,
          },
        };
      },
    },
    getSocialTickOptions: () => ({ meetPairs: 7 }),
    commandEntryReporter: (report) => reports.push(report),
    onCommitCommandState: (commit) => commitCalls.push(commit),
    now: () => new Date('2026-07-07T00:00:00.000Z'),
  });

  const summary = service.tickOnce();

  assert.equal(summary.processedCount, 2);
  assert.deepEqual(summary.shared, {
    socialPeople: 3,
    socialMeets: 1,
    socialCrossings: 0,
    diplomacyPairs: 3,
  });
  assert.deepEqual(calls.slice(0, 2), [
    ['advanceRelationships', 'ai-ruler,p1-ruler,p2-ruler', 7],
    ['upsertPerson', 'ai-ruler', 1],
  ]);
  assert.equal(calls.filter((call) => call[0] === 'driftContext').length, 3);
  assert.equal(calls.filter((call) => call[0] === 'planAdvanceEdge').length, 3);
  assert.equal(calls.filter((call) => call[0] === 'upsertEdge').length, 6);
  const socialReport = reports.find(
    (report) => report.envelope?.type === 'worldWorkerPersonUpdate',
  );
  assert.equal(socialReport.ownerResolution.ownerKey, 'world-social:global');
  assert.deepEqual(socialReport.ownerResolution.ownerKeys, [
    'person:ai-ruler',
    'player:p1',
    'player:p2',
    'world-social:global',
  ]);
  assert.deepEqual(socialReport.envelope.payload, {
    playerIds: ['p1', 'p2'],
    personIds: ['ai-ruler'],
    now: '2026-07-07T00:00:00.000Z',
  });
  assert.equal(Object.hasOwn(socialReport.envelope.payload, 'person'), false);
  assert.equal(Object.hasOwn(socialReport.envelope.payload, 'personId'), false);
  const socialCommits = commitCalls.filter(
    (commit) => Array.isArray(commit.mutations.playerStates),
  );
  assert.equal(socialCommits.length, 1);
  assert.equal(socialCommits[0].commitOptions.persistState, false);
  assert.deepEqual(
    socialCommits[0].mutations.playerStates.map((mutation) => mutation.state.playerId).sort(),
    ['p1', 'p2'],
  );
  assert.deepEqual(
    socialCommits[0].mutations.people.map((mutation) => mutation.person.id),
    ['ai-ruler'],
  );
  assert.equal(
    socialCommits[0].mutations.playerStates
      .find((mutation) => mutation.state.playerId === 'p1')
      .state.famousPeople[0].relationships.length,
    1,
  );
  assert.equal(socialCommits[0].mutations.people[0].person.relationships.length, 1);
  assert.equal(saved.get('p1').famousPeople[0].relationships.length, 1);
  assert.equal(saved.get('p2').famousPeople[0].relationships.length, 0);
});

test('WorldWorkerService prevents overlapping ticks and records slow batches', () => {
  const nowMs = Date.parse('2026-06-12T00:00:00.000Z');
  let monotonicNow = 1000;
  const service = createService({
    repository: {
      findRecentlyActive() {
        return [];
      },
    },
    gameStateService: {},
    cityService: {},
    territoryService: {},
    eventService: {},
    now: () => new Date(nowMs),
    monotonicNow: () => {
      const current = monotonicNow;
      monotonicNow += 250;
      return current;
    },
    slowTickMs: 100,
  });

  service.running = true;
  const skipped = service.tickOnce();
  assert.equal(skipped.skipped, true);

  service.running = false;
  const summary = service.tickOnce();
  assert.equal(summary.slow, true);
});

test('WorldWorkerService keeps its interval referenced for standalone PM2 workers', () => {
  let unrefCalled = false;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  global.setInterval = (handler, intervalMs) => {
    assert.equal(typeof handler, 'function');
    assert.equal(intervalMs, 5000);
    return {
      unref() {
        unrefCalled = true;
      },
    };
  };
  global.clearInterval = () => {};
  try {
    const service = createService({
      repository: { findRecentlyActive: () => [] },
      intervalMs: 5000,
    });
    service.start();
    assert.equal(unrefCalled, false);
  } finally {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }
});

test('WorldWorkerService re-reads the latest revision and retries on conflict', () => {
  // Active players write through the API while the worker ticks; the worker must not
  // starve them: on GAME_STATE_REVISION_CONFLICT it re-reads the fresh state and retries.
  let saves = 0;
  let reads = 0;
  const service = createService({
    repository: {
      findRecentlyActive() {
        return [{ playerId: 'hot-player', revision: 1 }];
      },
      findByPlayerId(playerId) {
        reads += 1;
        return { playerId, revision: 1 + reads };
      },
      save() {
        saves += 1;
        if (saves === 1) {
          const error = new Error('Game state revision conflict');
          error.code = 'GAME_STATE_REVISION_CONFLICT';
          throw error;
        }
      },
    },
    gameStateService: { advanceRuntimeState: (state) => state },
    now: () => new Date('2026-07-04T00:00:05.000Z'),
  });

  const summary = service.tickOnce();

  assert.equal(summary.processedCount, 1, 'conflicted player is retried and advanced');
  assert.equal(summary.errorCount, 0);
  assert.equal(saves, 2);
  assert.equal(reads >= 2, true, 'fresh state re-read after the conflict');
});

test('WorldWorkerService yields to foreground player-state writers', () => {
  const calls = [];
  const service = createService({
    repository: {
      findRecentlyActive() {
        calls.push(['findRecentlyActive']);
        return [{ playerId: 'foreground-player' }];
      },
      withPlayerStateLock(playerId, callback, options) {
        calls.push(['withPlayerStateLock', playerId, options.scope, options.waitMs]);
        assert.equal(typeof callback, 'function');
        return options.timeoutResult;
      },
      findByPlayerId() {
        throw new Error('worker must not read while foreground action owns the player lock');
      },
      save() {
        throw new Error('worker must not save while foreground action owns the player lock');
      },
    },
    gameStateService: { advanceRuntimeState: (state) => state },
    now: () => new Date('2026-07-07T00:00:05.000Z'),
  });

  const summary = service.tickOnce();

  assert.equal(summary.processedCount, 0);
  assert.equal(summary.errorCount, 0);
  assert.deepEqual(calls, [
    ['findRecentlyActive'],
    ['withPlayerStateLock', 'foreground-player', 'world-worker:worldWorkerPlayerTick', 0],
  ]);
});

test('WorldWorkerService gives up after bounded conflict retries without erroring', () => {
  const service = createService({
    repository: {
      findRecentlyActive() {
        return [{ playerId: 'hottest-player' }];
      },
      findByPlayerId(playerId) {
        return { playerId };
      },
      save() {
        const error = new Error('Game state revision conflict');
        error.code = 'GAME_STATE_REVISION_CONFLICT';
        throw error;
      },
    },
    gameStateService: { advanceRuntimeState: (state) => state },
    now: () => new Date('2026-07-04T00:00:05.000Z'),
  });

  const summary = service.tickOnce();

  // The player just waits for the next tick — a delayed march, never a starved one,
  // and never a crash-loop error entry.
  assert.equal(summary.processedCount, 0);
  assert.equal(summary.errorCount, 1);
});

test('WorldWorkerService locks player and encounter while force-settling combat', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();
  const startedAt = new Date('2026-07-10T00:00:00.000Z');
  const timeoutAt = new Date(
    startedAt.getTime() + WorldCombatEncounterService.AUTO_ENGAGE_FALLBACK_MS + 1,
  );
  const playerId = 'worker-encounter-owner';
  const state = GameStateService.createInitialGameState(playerId, { now: startedAt });
  const encounter = WorldCombatEncounterService.createEncounter(state, startedAt);
  encounter.id = 'worker-shared-encounter';
  encounter.tileId = WorldMapService.getTileId(encounter.q, encounter.r);
  encounter.defender.soldiers = 1;
  repository.worldEncounterRepo.upsertEncounter(encounter, startedAt);
  state.famousPeople = [{ id: 'worker-hero', name: 'Worker Hero', attributes: { force: 100 } }];
  state.exploreMissions = [{
    id: 'worker-engaged-mission',
    status: 'idle',
    position: { q: encounter.q, r: encounter.r, tileId: encounter.tileId },
    target: { q: encounter.q, r: encounter.r, tileId: encounter.tileId },
    formationSnapshot: {
      slot: 1,
      soldiersCommitted: 500,
      soldiersRemaining: 500,
      members: [{
        personId: 'worker-hero',
        soldiersCommitted: 500,
        soldiersRemaining: 500,
      }],
    },
    combat: {
      encounterId: encounter.id,
      status: 'engaged',
      engagedAt: startedAt.toISOString(),
    },
  }];
  repository.save(state);
  const reports = [];
  const service = createService({
    repository,
    gameStateService: GameStateService,
    commandEntryReporter: (report) => reports.push(report),
    now: () => timeoutAt,
  });

  const result = service.advancePlayerWithRetry(
    playerId,
    timeoutAt,
    3,
    repository.findByPlayerId(playerId),
  );

  assert.equal(result.advanced, true);
  const playerTickReport = reports.find(
    (report) => report.envelope?.type === 'worldWorkerPlayerTick',
  );
  assert.deepEqual(playerTickReport.ownerResolution.ownerKeys, [
    `encounter:${encounter.id}`,
    `player:${playerId}`,
  ]);
  assert.equal(
    repository.worldEncounterRepo.getEncounter(encounter.id, { refreshRespawns: false }).status,
    'resolved',
  );
  assert.equal(repository.findByPlayerId(playerId).worldCombat.recentReports.length, 1);
  db.close();
});
