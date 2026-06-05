const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialService = require('../services/TutorialService');
const EventService = require('../services/EventService');

test('initial tutorial state starts active instead of completed', () => {
  const tutorial = TutorialService.createInitialTutorialState();

  assert.equal(tutorial.completed, false);
  assert.equal(tutorial.currentStep, TutorialService.TUTORIAL_STEPS.initial);
  assert.deepEqual(tutorial.phaseCompleted, { newbie: false, era2: false });
});

test('disabled legacy tutorial states stay completed and pass validation', () => {
  const tutorial = TutorialService.normalizeTutorialState({ disabled: true, currentStep: 0 });
  const validation = TutorialService.validateAction(tutorial, 'advanceEra', {}, { currentEra: 99 });

  assert.equal(tutorial.completed, true);
  assert.equal(tutorial.disabled, true);
  assert.equal(validation.allowed, true);
});

test('tutorial validation blocks early era advancement until civilization is opened', () => {
  const tutorial = TutorialService.createInitialTutorialState();
  const validation = TutorialService.validateAction(tutorial, 'advanceEra', {}, { currentEra: 0 });

  assert.equal(validation.allowed, false);
  assert.equal(validation.code, 'TUTORIAL_BLOCKED');
});

test('tutorial house guide only allows the first house build before era advancement', () => {
  const tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.houseGuideReady,
  );
  const gameState = { currentEra: 0, buildings: {}, resources: { food: 130 } };

  assert.equal(TutorialService.validateAction(tutorial, 'build', { target: 'house' }, gameState).allowed, true);
  assert.equal(TutorialService.validateAction(tutorial, 'build', { target: 'farm' }, gameState).allowed, false);
  assert.equal(TutorialService.validateAction(tutorial, 'advanceEra', {}, gameState).allowed, false);
});

test('tutorial grants first house supplies once without overwriting richer players', () => {
  const gameState = {
    currentEra: 0,
    resources: { food: 1, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: {},
    tutorial: TutorialService.createInitialTutorialState(),
  };

  assert.equal(TutorialService.ensureHouseGuideResources(gameState), true);
  assert.equal(gameState.resources.food, TutorialService.getHouseGuideMinimumResources().food);
  assert.equal(gameState.tutorial.grants.houseGuideSupplies, true);
  gameState.resources.food = 999;
  assert.equal(TutorialService.ensureHouseGuideResources(gameState), false);
  assert.equal(gameState.resources.food, 999);
});

test('tutorial advances monotonically by named events', () => {
  const initial = TutorialService.createInitialTutorialState();
  const opened = TutorialService.advanceTutorial(initial, 'civilizationTabOpened');
  const stale = TutorialService.advanceTutorial(opened, 'tutorialStarted');

  assert.equal(opened.currentStep, TutorialService.TUTORIAL_STEPS.civilizationTabOpened);
  assert.equal(stale.currentStep, opened.currentStep);
});

test('completed tutorial states continue to allow every action', () => {
  const tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.completed,
  );

  assert.equal(tutorial.completed, true);
  assert.equal(TutorialService.validateAction(tutorial, 'upgrade', {}, {}).allowed, true);
});

test('tutorial guides farm, second era event, and lumbermill actions in order', () => {
  const farmPrep = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.farmPrepReserved,
  );
  const farmState = {
    currentEra: 1,
    resources: { food: 120, knowledge: 5, wood: 0 },
    buildings: { house: { level: 1 } },
  };

  assert.equal(TutorialService.canAccessTab(farmPrep, 'buildings'), true);
  assert.equal(TutorialService.validateAction(farmPrep, 'build', { target: 'farm' }, farmState).allowed, true);
  assert.equal(TutorialService.validateAction(farmPrep, 'build', { target: 'lumbermill' }, farmState).allowed, false);
  assert.equal(TutorialService.validateAction(farmPrep, 'advanceEra', {}, farmState).allowed, false);

  const eraReady = TutorialService.manualAdvance(farmPrep, TutorialService.TUTORIAL_STEPS.era2AdvanceReady);
  assert.equal(TutorialService.canAccessTab(eraReady, 'civilization'), true);
  assert.equal(TutorialService.canAccessTab(eraReady, 'events'), false);
  assert.equal(TutorialService.validateAction(eraReady, 'advanceEra', {}, farmState).allowed, true);

  const era2 = TutorialService.manualAdvance(eraReady, TutorialService.TUTORIAL_STEPS.eraAdvancedTo2);
  const eventPayload = { eventId: 'evt_settlement_forest_001', optionId: 'opt_collect_wood' };
  assert.equal(TutorialService.canAccessTab(era2, 'events'), true);
  assert.equal(TutorialService.validateAction(era2, 'claimEvent', eventPayload, { ...farmState, currentEra: 2 }).allowed, true);
  assert.equal(TutorialService.validateAction(era2, 'build', { target: 'lumbermill' }, { ...farmState, currentEra: 2 }).allowed, false);

  const eventClaimed = TutorialService.manualAdvance(era2, TutorialService.TUTORIAL_STEPS.specialEventClaimed);
  const lumbermillState = {
    currentEra: 2,
    resources: { food: 50, knowledge: 0, wood: 20 },
    buildings: { house: { level: 1 }, farm: { level: 1 } },
  };
  assert.equal(TutorialService.canAccessTab(eventClaimed, 'buildings'), true);
  assert.equal(TutorialService.validateAction(eventClaimed, 'build', { target: 'lumbermill' }, lumbermillState).allowed, true);
});

test('era two tutorial sync waits for the farm to be built', () => {
  const tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.farmBuilt,
  );
  const gameState = {
    currentEra: 1,
    resources: { food: 120, knowledge: 5, wood: 0 },
    buildings: { house: { level: 1 } },
  };
  const synced = TutorialService.maybeActivateEra2Tutorial(tutorial, gameState, { canAdvance: true });

  assert.equal(synced.currentStep, TutorialService.TUTORIAL_STEPS.farmBuilt);
});

test('era two tutorial sync requires farmBuilt tutorial progress before advance prompt', () => {
  const tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.farmPrepReserved,
  );
  const gameState = {
    currentEra: 1,
    resources: { food: 120, knowledge: 5, wood: 0 },
    buildings: { house: { level: 1 }, farm: { level: 1 } },
  };
  const synced = TutorialService.maybeActivateEra2Tutorial(tutorial, gameState, { canAdvance: true });

  assert.equal(synced.currentStep, TutorialService.TUTORIAL_STEPS.farmPrepReserved);
});

test('era two tutorial sync promotes after farm is built and resources are ready', () => {
  const tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.farmBuilt,
  );
  const gameState = {
    currentEra: 1,
    resources: { food: 120, knowledge: 5, wood: 0 },
    buildings: { house: { level: 1 }, farm: { level: 1 } },
  };
  const synced = TutorialService.maybeActivateEra2Tutorial(tutorial, gameState, { canAdvance: true });

  assert.equal(synced.currentStep, TutorialService.TUTORIAL_STEPS.era2AdvanceReady);
});

test('settlement forest event grants enough starter resources for lumbermill guide', () => {
  const gameState = {
    currentEra: 2,
    resources: { food: 0, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: { house: { level: 1 }, farm: { level: 1 } },
    population: { total: 4, max: 4, maxPop: 4, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 1 },
    eventQueue: [],
    eventHistory: [],
    activeCityId: 'capital',
    cities: {
      capital: {
        id: 'capital',
        territoryId: 'capital',
        isCapital: true,
        resources: { food: 0, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
        buildings: { house: { level: 1 }, farm: { level: 1 } },
        population: { total: 4, max: 4, maxPop: 4, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 1 },
        military: { soldiers: 0 },
      },
    },
    tutorial: TutorialService.manualAdvance(
      TutorialService.createInitialTutorialState(),
      TutorialService.TUTORIAL_STEPS.eraAdvancedTo2,
    ),
  };

  EventService.generateSpecialEvent(gameState, 2);
  const result = EventService.claimEvent(gameState, EventService.SETTLEMENT_EVENT_ID, EventService.SETTLEMENT_OPTION_ID);
  const eventClaimed = TutorialService.manualAdvance(gameState.tutorial, TutorialService.TUTORIAL_STEPS.specialEventClaimed);

  assert.equal(result.success, true);
  assert.deepEqual(result.reward, { food: 50, wood: 20 });
  assert.equal(gameState.resources.food, 50);
  assert.equal(gameState.resources.wood, 20);
  assert.equal(TutorialService.validateAction(eventClaimed, 'build', { target: 'lumbermill' }, gameState).allowed, true);
});
