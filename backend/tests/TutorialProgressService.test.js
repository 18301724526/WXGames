const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialService = require('../services/TutorialService');
const EventService = require('../services/EventService');
const FamousPersonService = require('../services/FamousPersonService');
const MilitaryService = require('../services/MilitaryService');

test('initial tutorial state starts active instead of completed', () => {
  const tutorial = TutorialService.createInitialTutorialState();

  assert.equal(tutorial.completed, false);
  assert.equal(tutorial.currentStep, TutorialService.TUTORIAL_STEPS.initial);
  assert.deepEqual(tutorial.phaseCompleted, { newbie: false, era2: false, scoutFormation: false });
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

test('client can complete tutorial only after polity naming', () => {
  const cityNamed = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.firstCityNamed,
  );
  const early = TutorialService.advanceClientStep(cityNamed, TutorialService.TUTORIAL_STEPS.completed);

  assert.equal(early.success, false);
  assert.equal(early.error, 'TUTORIAL_STEP_LOCKED');
  assert.equal(early.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.firstCityNamed);

  const polityNamed = TutorialService.manualAdvance(cityNamed, TutorialService.TUTORIAL_STEPS.polityNamed);
  const completed = TutorialService.advanceClientStep(polityNamed, TutorialService.TUTORIAL_STEPS.completed);

  assert.equal(TutorialService.canAccessTab(polityNamed, 'tech'), true);
  assert.equal(TutorialService.canAccessTab(polityNamed, 'military'), false);
  assert.equal(TutorialService.validateAction(polityNamed, 'research', { techId: 'writing' }, {}).allowed, false);
  assert.equal(
    TutorialService.validateAction(
      polityNamed,
      'tutorialAdvance',
      { step: TutorialService.TUTORIAL_STEPS.completed },
      {},
    ).allowed,
    true,
  );
  assert.equal(completed.success, true);
  assert.equal(completed.tutorial.completed, true);
  assert.equal(completed.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.completed);
  assert.equal(TutorialService.validateAction(completed.tutorial, 'research', { techId: 'writing' }, {}).allowed, true);
  assert.equal(TutorialService.validateAction(completed.tutorial, 'build', { target: 'farm' }, {}).allowed, true);
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

test('tutorial grants one purple scout famous person after entering city-state era', () => {
  const tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.era3Advanced,
  );
  const gameState = {
    playerId: 'tutorial-scout-famous-test',
    currentEra: 3,
    famousPeople: [],
    famousPersonState: FamousPersonService.createInitialFamousPersonState(),
    tutorial,
  };

  assert.equal(TutorialService.ensureScoutFamousPersonGrant(gameState), true);
  assert.equal(gameState.famousPeople.length, 1);
  assert.equal(gameState.famousPeople[0].quality, 'great');
  assert.equal(gameState.famousPeople[0].archetype, 'scout');
  assert.equal(gameState.famousPeople[0].abilityArchetype, 'scout');
  assert.equal(gameState.tutorial.grants.scoutFamousPerson.personId, gameState.famousPeople[0].id);
  assert.equal(gameState.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.scoutFamousGranted);

  assert.equal(TutorialService.ensureScoutFamousPersonGrant(gameState), false);
  assert.equal(gameState.famousPeople.length, 1);
});

test('tutorial advances after saving a formation with the granted scout', () => {
  const gameState = {
    playerId: 'tutorial-formation-test',
    currentEra: 3,
    activeCityId: 'capital',
    cities: {
      capital: { id: 'capital', buildings: {}, military: { soldiers: 0 } },
    },
    buildings: {},
    military: {},
    famousPeople: [],
    famousPersonState: FamousPersonService.createInitialFamousPersonState(),
    tutorial: TutorialService.manualAdvance(
      TutorialService.createInitialTutorialState(),
      TutorialService.TUTORIAL_STEPS.era3Advanced,
    ),
  };
  TutorialService.ensureScoutFamousPersonGrant(gameState);
  const personId = gameState.tutorial.grants.scoutFamousPerson.personId;

  const saved = MilitaryService.setArmyFormation(gameState, {
    cityId: 'capital',
    slot: 1,
    memberIds: [personId],
  });

  assert.equal(saved.success, true);
  assert.equal(saved.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.scoutFormationSaved);
  assert.deepEqual(saved.formation.memberIds, [personId]);
});

test('tutorial blocks scout formation save without the granted scout', () => {
  const tutorial = {
    ...TutorialService.manualAdvance(
      TutorialService.createInitialTutorialState(),
      TutorialService.TUTORIAL_STEPS.formationPanelOpened,
    ),
    grants: {
      scoutFamousPerson: { personId: 'fp-required-scout' },
    },
  };
  const gameState = {
    currentEra: 3,
    tutorial,
  };

  assert.equal(
    TutorialService.validateAction(tutorial, 'setArmyFormation', { memberIds: ['fp-other'] }, gameState).allowed,
    false,
  );
  assert.equal(
    TutorialService.validateAction(tutorial, 'setArmyFormation', { memberIds: ['fp-required-scout'] }, gameState).allowed,
    true,
  );
});

test('tutorial blocks guided exploration until the granted scout formation is saved', () => {
  const scoutPersonId = 'fp-required-scout';
  const tutorial = {
    ...TutorialService.manualAdvance(
      TutorialService.createInitialTutorialState(),
      TutorialService.TUTORIAL_STEPS.scoutFormationSaved,
    ),
    grants: {
      scoutFamousPerson: { personId: scoutPersonId },
    },
  };
  const gameState = {
    activeCityId: 'capital',
    tutorial,
    military: {
      formations: {
        capital: [{ slot: 1, memberIds: [] }],
      },
    },
  };

  assert.equal(TutorialService.validateAction(tutorial, 'startExplore', { formationSlot: 1 }, gameState).allowed, false);

  gameState.military.formations.capital[0].memberIds = [scoutPersonId];
  assert.equal(TutorialService.validateAction(tutorial, 'startExplore', { formationSlot: 1 }, gameState).allowed, true);

  const beforeStarted = TutorialService.validateAction(tutorial, 'claimExplore', { missionId: 'explore-1' }, gameState);
  assert.equal(beforeStarted.allowed, false);

  const started = TutorialService.manualAdvance(tutorial, TutorialService.TUTORIAL_STEPS.scoutExploreStarted);
  assert.equal(TutorialService.validateAction(started, 'claimExplore', { missionId: 'explore-1' }, gameState).allowed, true);
});

test('tutorial guides first discovered empty city claim and naming in order', () => {
  const siteId = 'site_first_empty';
  const tutorial = {
    ...TutorialService.manualAdvance(
      TutorialService.createInitialTutorialState(),
      TutorialService.TUTORIAL_STEPS.scoutExploreClaimed,
    ),
    grants: {
      firstExploreEmptyCity: { siteId },
    },
  };
  const gameState = {
    tutorial,
    territories: [
      { id: 'capital', status: 'occupied', owner: 'player', cityName: '首都' },
      { id: siteId, status: 'discovered', owner: 'neutral', cityName: null },
    ],
    polity: { name: null },
  };

  assert.equal(TutorialService.validateAction(tutorial, 'startConquest', { territoryId: 'other' }, gameState).allowed, false);
  assert.equal(TutorialService.validateAction(tutorial, 'startConquest', { territoryId: siteId }, gameState).allowed, true);
  assert.equal(TutorialService.validateAction(tutorial, 'renameCity', { territoryId: siteId, name: '河湾城' }, gameState).allowed, false);

  const claimed = TutorialService.manualAdvance(tutorial, TutorialService.TUTORIAL_STEPS.firstCityOccupied);
  gameState.tutorial = claimed;
  gameState.territories[1].status = 'occupied';
  assert.equal(TutorialService.validateAction(claimed, 'renameCity', { territoryId: 'capital', name: '旧都' }, gameState).allowed, false);
  assert.equal(TutorialService.validateAction(claimed, 'renameCity', { territoryId: siteId, name: '河湾城' }, gameState).allowed, true);
  assert.equal(TutorialService.validateAction(claimed, 'renamePolity', { name: '赤火联盟' }, gameState).allowed, false);

  const cityNamed = TutorialService.manualAdvance(claimed, TutorialService.TUTORIAL_STEPS.firstCityNamed);
  gameState.tutorial = cityNamed;
  gameState.territories[1].cityName = '河湾城';
  assert.equal(TutorialService.validateAction(cityNamed, 'renamePolity', { name: '赤火联盟' }, gameState).allowed, true);
});
