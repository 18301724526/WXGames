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
  assert.equal(result.tutorial.currentStep, 5);
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

test('dispatches territory actions through the territory action handler', () => {
  const { calls, registry } = createRegistryWithCalls();

  const result = registry.execute({
    action: 'startExplore',
    body: { mode: 'manual', targetQ: 2, targetR: -1, routeLength: 4 },
    gameState: {},
    tutorial: {},
  });

  assert.equal(result.success, true);
  assert.equal(calls[0].type, 'territory');
  assert.equal(calls[0].action, 'startExplore');
  assert.deepEqual(calls[0].payload, {
    territoryId: undefined,
    cityId: undefined,
    soldiers: undefined,
    name: undefined,
    direction: undefined,
    missionId: undefined,
    mode: 'manual',
    targetQ: 2,
    targetR: -1,
    routeLength: 4,
    stopQ: undefined,
    stopR: undefined,
    formationSlot: undefined,
    slot: undefined,
    q: undefined,
    r: undefined,
    x: undefined,
    y: undefined,
    expedition: undefined,
  });
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

test('returns a stable result for unknown actions', () => {
  const { registry } = createRegistryWithCalls();

  assert.deepEqual(registry.execute({ action: 'missingAction', body: {} }), {
    success: false,
    message: '鏈煡鎿嶄綔',
    error: 'UNKNOWN_ACTION',
  });
});
