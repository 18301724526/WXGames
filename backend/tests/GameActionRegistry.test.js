const test = require('node:test');
const assert = require('node:assert/strict');

const { createGameActionRegistry } = require('../actions/GameActionRegistry');

function createRegistryWithCalls() {
  const calls = [];
  const registry = createGameActionRegistry({
    BuildBuildingAction: {
      execute(action, gameState, tutorial, target) {
        calls.push({ type: 'building', action, gameState, tutorial, target });
        return { success: true, action, target };
      },
    },
    TechTreeService: {
      research(gameState, techId) {
        calls.push({ type: 'research', gameState, techId });
        return { success: true, techId };
      },
    },
    MilitaryService: {
      setArmyFormation(gameState, payload) {
        calls.push({ type: 'formation', gameState, payload });
        return { success: true, payload };
      },
    },
    TerritoryAction: {
      execute(action, gameState, payload) {
        calls.push({ type: 'territory', action, gameState, payload });
        return { success: true, action, payload };
      },
    },
  });
  return { calls, registry };
}

test('dispatches build actions through the building action handler', () => {
  const { calls, registry } = createRegistryWithCalls();
  const gameState = { id: 'state' };
  const tutorial = { step: 'build' };

  const result = registry.execute({
    action: 'build',
    body: { action: 'build', target: 'farm' },
    gameState,
    tutorial,
  });

  assert.deepEqual(result, { success: true, action: 'build', target: 'farm' });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    type: 'building',
    action: 'build',
    gameState,
    tutorial,
    target: 'farm',
  });
});

test('dispatches research actions with techId fallback order', () => {
  const { calls, registry } = createRegistryWithCalls();
  const gameState = { id: 'state' };

  const result = registry.execute({
    body: { action: 'research', target: 'fire-making' },
    gameState,
    tutorial: {},
  });

  assert.deepEqual(result, { success: true, techId: 'fire-making' });
  assert.deepEqual(calls[0], { type: 'research', gameState, techId: 'fire-making' });
});

test('dispatches setArmyFormation actions without losing slot and member ids', () => {
  const { calls, registry } = createRegistryWithCalls();
  const gameState = { id: 'state' };

  const result = registry.execute({
    action: 'setArmyFormation',
    body: {
      cityId: 'capital',
      slot: 2,
      memberIds: ['person-a', 'person-b'],
      soldierAssignments: { 'person-a': 300, 'person-b': 200 },
    },
    gameState,
    tutorial: {},
  });

  assert.equal(result.success, true);
  assert.deepEqual(calls[0], {
    type: 'formation',
    gameState,
    payload: {
      cityId: 'capital',
      slot: 2,
      memberIds: ['person-a', 'person-b'],
      soldierAssignments: { 'person-a': 300, 'person-b': 200 },
    },
  });
});

test('dispatches tutorialAdvance through the tutorial client-step gate', () => {
  const { registry } = createRegistryWithCalls();
  const result = registry.execute({
    action: 'tutorialAdvance',
    body: { step: 5 },
    gameState: {},
    tutorial: { completed: false, currentStep: 4, phaseCompleted: { newbie: false, era2: false } },
  });

  assert.equal(result.success, true);
  // Persisted step is the insertion-proof NAME (legacy numeric payloads map onto it).
  assert.equal(result.tutorial.currentStep, 'civilizationTabOpened');
});

test('blocks tutorialAdvance for business-only tutorial steps', () => {
  const { registry } = createRegistryWithCalls();
  const result = registry.execute({
    action: 'tutorialAdvance',
    body: { step: 7 },
    gameState: {},
    tutorial: { completed: false, currentStep: 5, phaseCompleted: { newbie: false, era2: false } },
  });

  assert.equal(result.success, false);
  assert.equal(result.error, 'TUTORIAL_STEP_LOCKED');
});

test('retired world explorer report actions are not registered', () => {
  const { calls, registry } = createRegistryWithCalls();

  const start = registry.execute({ action: 'startExplore', body: { action: 'startExplore' }, gameState: {}, tutorial: {} });
  const claim = registry.execute({ action: 'claimExplore', body: { action: 'claimExplore' }, gameState: {}, tutorial: {} });

  assert.equal(start.success, false);
  assert.equal(start.error, 'UNKNOWN_ACTION');
  assert.equal(claim.success, false);
  assert.equal(claim.error, 'UNKNOWN_ACTION');
  assert.equal(calls.length, 0);
});

test('dispatches world march actions through the territory action handler', () => {
  const { calls, registry } = createRegistryWithCalls();

  const started = registry.execute({
    action: 'startWorldMarch',
    body: { mode: 'manual', targetQ: 2, targetR: -1, formationSlot: 1, cityId: 'capital' },
    gameState: {},
    tutorial: {},
  });

  assert.equal(started.success, true);
  assert.equal(calls[0].type, 'territory');
  assert.equal(calls[0].action, 'startWorldMarch');
  assert.equal(calls[0].payload.mode, 'manual');
  assert.equal(calls[0].payload.targetQ, 2);
  assert.equal(calls[0].payload.targetR, -1);
  assert.equal(calls[0].payload.formationSlot, 1);
  assert.equal(calls[0].payload.cityId, 'capital');

  const result = registry.execute({
    action: 'stopWorldMarch',
    body: { missionId: 'explore-1', targetQ: 1, targetR: 0 },
    gameState: {},
    tutorial: {},
  });

  assert.equal(result.success, true);
  assert.equal(calls[1].type, 'territory');
  assert.equal(calls[1].action, 'stopWorldMarch');
  assert.equal(calls[1].payload.missionId, 'explore-1');
  assert.equal(calls[1].payload.targetQ, undefined);
  assert.equal(calls[1].payload.targetR, undefined);
  assert.equal(calls[1].payload.q, undefined);
  assert.equal(calls[1].payload.r, undefined);
});

test('dispatches compact client input evidence with world march payloads', () => {
  const { calls, registry } = createRegistryWithCalls();
  const clientInputIntent = {
    schema: 'world-map-input-intent-v1',
    target: { kind: 'tile', tileId: 'tile_2_-1', targetQ: 2, targetR: -1 },
    picking: { inputEpoch: 4, signature: 'sig-4' },
    tileMapView: { tiles: [{ id: 'must-not-authorize' }] },
  };

  registry.execute({
    action: 'startWorldMarch',
    body: {
      action: 'startWorldMarch',
      mode: 'manual',
      targetQ: 2,
      targetR: -1,
      formationSlot: 1,
      clientInputIntent,
    },
    gameState: {},
    tutorial: {},
  });

  assert.equal(calls[0].payload.clientInputIntent, clientInputIntent);
});

test('dispatches combat encounter identity with world march payloads', () => {
  const { calls, registry } = createRegistryWithCalls();

  registry.execute({
    action: 'startWorldMarch',
    body: {
      action: 'startWorldMarch',
      mode: 'manual',
      targetQ: 2,
      targetR: -1,
      formationSlot: 1,
      combatEncounterId: 'hostile_force_capital_ridge',
      encounterId: 'hostile_force_capital_ridge',
    },
    gameState: {},
    tutorial: {},
  });

  assert.equal(calls[0].payload.combatEncounterId, 'hostile_force_capital_ridge');
  assert.equal(calls[0].payload.encounterId, 'hostile_force_capital_ridge');
});

test('returns a stable result for unknown actions', () => {
  const { registry } = createRegistryWithCalls();

  assert.deepEqual(registry.execute({ action: 'missingAction', body: {} }), {
    success: false,
    message: '未知操作',
    error: 'UNKNOWN_ACTION',
  });
});
