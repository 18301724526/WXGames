const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialService = require('../services/TutorialService');
const TutorialGrantService = require('../services/tutorial/TutorialGrantService');
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

test('tutorial task claims advance the homestead and barracks-segment steps', () => {
  const cityEntered = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.cityEntered,
  );
  // Claim-driven advances via TASK_CLAIM_STEPS (kept step names, new triggers).
  const houseReady = TutorialService.manualAdvance(cityEntered, TutorialService.TUTORIAL_STEPS.houseGuideReady);
  assert.equal(houseReady.currentStep, TutorialService.TUTORIAL_STEPS.houseGuideReady);

  const era3 = TutorialService.manualAdvance(cityEntered, TutorialService.TUTORIAL_STEPS.era3Advanced);
  const suppliesClaimed = TutorialService.manualAdvance(era3, TutorialService.TUTORIAL_STEPS.barracksSuppliesClaimed);
  const barracksBuilt = TutorialService.advanceTutorial(suppliesClaimed, 'barracksBuilt');
  assert.equal(barracksBuilt.currentStep, TutorialService.TUTORIAL_STEPS.barracksBuilt);
  const armyClaimed = TutorialService.manualAdvance(barracksBuilt, TutorialService.TUTORIAL_STEPS.firstArmyClaimed);
  assert.equal(armyClaimed.currentStep, TutorialService.TUTORIAL_STEPS.firstArmyClaimed);
});

test('tab access opens the task center and buildings for the claim-driven segments', () => {
  const cityEntered = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.cityEntered,
  );
  // Homestead claim window: the task center must open before the first house.
  assert.equal(TutorialService.canAccessTab(cityEntered, 'tasks'), true);
  assert.equal(TutorialService.canAccessTab(cityEntered, 'buildings'), true);
  assert.equal(TutorialService.canAccessTab(cityEntered, 'events'), false);

  // Barracks segment: tasks + buildings open, formation/military waits for the
  // famous-person segment.
  const suppliesClaimed = TutorialService.manualAdvance(cityEntered, TutorialService.TUTORIAL_STEPS.barracksSuppliesClaimed);
  assert.equal(TutorialService.canAccessTab(suppliesClaimed, 'tasks'), true);
  assert.equal(TutorialService.canAccessTab(suppliesClaimed, 'buildings'), true);
  assert.equal(TutorialService.canAccessTab(suppliesClaimed, 'military'), false);
  const armyClaimed = TutorialService.manualAdvance(suppliesClaimed, TutorialService.TUTORIAL_STEPS.firstArmyClaimed);
  assert.equal(TutorialService.canAccessTab(armyClaimed, 'tasks'), true);

  // Famous/formation segment keys off scoutFamousGranted (kept behavior).
  const famousGranted = TutorialService.manualAdvance(armyClaimed, TutorialService.TUTORIAL_STEPS.scoutFamousGranted);
  assert.equal(TutorialService.canAccessTab(famousGranted, 'military'), true);
  assert.equal(TutorialService.canAccessTab(famousGranted, 'tasks'), false);
});

test('barracks-segment validator only allows the guided barracks build', () => {
  const suppliesClaimed = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.barracksSuppliesClaimed,
  );
  const gameState = {
    currentEra: 3,
    resources: { food: 400, knowledge: 120, wood: 50 },
    buildings: { house: { level: 1 }, farm: { level: 1 }, lumbermill: { level: 1 } },
  };

  assert.equal(TutorialService.validateAction(suppliesClaimed, 'build', { target: 'barracks' }, gameState).allowed, true);
  assert.equal(TutorialService.validateAction(suppliesClaimed, 'build', { target: 'house' }, gameState).allowed, false);
  assert.equal(TutorialService.validateAction(suppliesClaimed, 'advanceEra', {}, gameState).allowed, false);

  const barracksBuilt = TutorialService.advanceTutorial(suppliesClaimed, 'barracksBuilt');
  assert.equal(TutorialService.validateAction(barracksBuilt, 'build', { target: 'house' }, gameState).allowed, true);
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

test('post-naming tutorial guides policy, manual talent, famous seek, and final tech before completion', () => {
  const cityNamed = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.firstCityNamed,
  );
  const early = TutorialService.advanceClientStep(cityNamed, TutorialService.TUTORIAL_STEPS.completed);

  assert.equal(early.success, false);
  assert.equal(early.error, 'TUTORIAL_STEP_LOCKED');
  assert.equal(early.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.firstCityNamed);

  const polityNamed = TutorialService.manualAdvance(cityNamed, TutorialService.TUTORIAL_STEPS.polityNamed);
  assert.equal(TutorialService.canAccessTab(polityNamed, 'military'), true);
  assert.equal(TutorialService.canAccessTab(polityNamed, 'resources'), false);
  assert.equal(TutorialService.canAccessTab(polityNamed, 'tech'), false);
  assert.equal(TutorialService.validateAction(polityNamed, 'research', { techId: 'writing' }, {}).allowed, false);
  assert.equal(
    TutorialService.advanceClientStep(polityNamed, TutorialService.TUTORIAL_STEPS.completed).success,
    false,
  );

  const policyOpened = TutorialService.advanceClientStep(polityNamed, TutorialService.TUTORIAL_STEPS.talentPolicyOpened);
  assert.equal(policyOpened.success, true);
  assert.equal(TutorialService.validateAction(policyOpened.tutorial, 'applyTalentPolicy', { policyId: 'balanced' }, {}).allowed, true);
  assert.equal(TutorialService.validateAction(policyOpened.tutorial, 'assign', { target: 'farmer', count: 1 }, {}).allowed, false);

  const policyApplied = TutorialService.advanceTutorial(policyOpened.tutorial, 'talentPolicyApplied');
  assert.equal(policyApplied.currentStep, TutorialService.TUTORIAL_STEPS.talentPolicyApplied);
  assert.equal(TutorialService.validateAction(policyApplied, 'assign', { target: 'farmer', count: 1 }, {}).allowed, true);
  assert.equal(TutorialService.validateAction(policyApplied, 'seekFamousPerson', { source: 'seek' }, {}).allowed, false);

  const manualAssigned = TutorialService.advanceTutorial(policyApplied, 'manualTalentAssigned');
  assert.equal(TutorialService.canAccessTab(manualAssigned, 'famousPersons'), true);
  assert.equal(TutorialService.advanceClientStep(manualAssigned, TutorialService.TUTORIAL_STEPS.famousSeekOpened).success, true);

  const famousOpened = TutorialService.advanceClientStep(manualAssigned, TutorialService.TUTORIAL_STEPS.famousSeekOpened).tutorial;
  assert.equal(TutorialService.validateAction(famousOpened, 'seekFamousPerson', { source: 'seek' }, {}).allowed, true);
  assert.equal(TutorialService.validateAction(famousOpened, 'research', { techId: 'writing' }, {}).allowed, false);

  const famousSought = TutorialService.advanceTutorial(famousOpened, 'famousSeekCompleted');
  assert.equal(TutorialService.canAccessTab(famousSought, 'tech'), true);
  assert.equal(TutorialService.canAccessTab(famousSought, 'resources'), false);
  assert.equal(TutorialService.advanceClientStep(famousSought, TutorialService.TUTORIAL_STEPS.completed).success, false);

  const finalTechOpened = TutorialService.advanceClientStep(famousSought, TutorialService.TUTORIAL_STEPS.finalTechOpened);
  assert.equal(finalTechOpened.success, true);
  assert.equal(
    TutorialService.validateAction(
      finalTechOpened.tutorial,
      'tutorialAdvance',
      { step: TutorialService.TUTORIAL_STEPS.completed },
      {},
    ).allowed,
    true,
  );
  const completed = TutorialService.advanceClientStep(finalTechOpened.tutorial, TutorialService.TUTORIAL_STEPS.completed);
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
  assert.equal(gameState.cities.capital.resources.food, 50);
  assert.equal(gameState.cities.capital.resources.wood, 20);
  assert.equal(TutorialService.validateAction(eventClaimed, 'build', { target: 'lumbermill' }, gameState).allowed, true);
});

test('scout famous person grant core creates one purple scout with grant bookkeeping', () => {
  const tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.firstArmyClaimed,
  );
  const gameState = {
    playerId: 'tutorial-scout-famous-test',
    currentEra: 3,
    famousPeople: [],
    famousPersonState: FamousPersonService.createInitialFamousPersonState(),
    tutorial,
  };

  const grant = TutorialGrantService.grantScoutFamousPerson(gameState);
  assert.equal(Boolean(grant?.person), true);
  assert.equal(gameState.famousPeople.length, 1);
  assert.equal(gameState.famousPeople[0].quality, 'great');
  assert.equal(gameState.famousPeople[0].archetype, 'scout');
  assert.equal(gameState.famousPeople[0].abilityArchetype, 'scout');
  assert.equal(gameState.tutorial.grants.scoutFamousPerson.personId, gameState.famousPeople[0].id);
  // The step advance is claim-driven (TASK_CLAIM_STEPS), not part of the grant core.
  assert.equal(gameState.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.firstArmyClaimed);

  // Idempotent: a second grant returns the existing person without duplicating.
  const again = TutorialGrantService.grantScoutFamousPerson(gameState);
  assert.equal(again.person.id, grant.person.id);
  assert.equal(again.created, false);
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
      TutorialService.TUTORIAL_STEPS.formationPanelOpened,
    ),
  };
  TutorialGrantService.grantScoutFamousPerson(gameState);
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

test('tutorial blocks guided world march until the granted scout formation is saved', () => {
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

  assert.equal(TutorialService.validateAction(tutorial, 'startWorldMarch', { formationSlot: 1 }, gameState).allowed, false);

  gameState.military.formations.capital[0].memberIds = [scoutPersonId];
  assert.equal(TutorialService.validateAction(tutorial, 'startWorldMarch', { formationSlot: 1 }, gameState).allowed, true);

  const started = TutorialService.manualAdvance(tutorial, TutorialService.TUTORIAL_STEPS.scoutExploreStarted);
  assert.equal(TutorialService.validateAction(started, 'returnWorldMarch', { missionId: 'explore-1' }, gameState).allowed, false);
  assert.equal(TutorialService.validateAction(started, 'stopWorldMarch', { missionId: 'explore-1' }, gameState).allowed, false);
});

test('tutorial guides first discovered empty city claim and naming in order', () => {
  const siteId = 'site_first_empty';
  const tutorial = {
    ...TutorialService.manualAdvance(
      TutorialService.createInitialTutorialState(),
      TutorialService.TUTORIAL_STEPS.firstCityDiscovered,
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

test('normalize migrates legacy numeric saves onto step names', () => {
  const numericSave = TutorialService.normalizeTutorialState({
    completed: false,
    currentStep: 26,
    grants: { scoutFamousPerson: { personId: 'fp_1' } },
  });

  assert.equal(numericSave.currentStep, 'scoutFormationSaved');
  assert.equal(numericSave.completed, false);
  assert.deepEqual(numericSave.phaseCompleted, { newbie: true, era2: true, scoutFormation: true });
  assert.equal(numericSave.grants.scoutFamousPerson.personId, 'fp_1');

  const clampedSave = TutorialService.normalizeTutorialState({ currentStep: 99 });
  assert.equal(clampedSave.currentStep, 'completed');
  assert.equal(clampedSave.completed, true);

  const nameSave = TutorialService.normalizeTutorialState({ currentStep: 'farmBuilt' });
  assert.equal(nameSave.currentStep, 'farmBuilt');
  assert.equal(nameSave.phaseCompleted.newbie, true);
  assert.equal(nameSave.phaseCompleted.era2, false);

  const garbageSave = TutorialService.normalizeTutorialState({ currentStep: 'not-a-step' });
  assert.equal(garbageSave.currentStep, 'initial');
});

test('tutorialAdvance client gate accepts step names and legacy numeric payloads', () => {
  const atHouseBuilt = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.houseBuilt,
  );

  const byName = TutorialService.advanceClientStep(atHouseBuilt, 'civilizationTabOpened');
  assert.equal(byName.success, true);
  assert.equal(byName.tutorial.currentStep, 'civilizationTabOpened');

  const byLegacyNumber = TutorialService.advanceClientStep(atHouseBuilt, 5);
  assert.equal(byLegacyNumber.success, true);
  assert.equal(byLegacyNumber.tutorial.currentStep, 'civilizationTabOpened');

  const byLegacyNumericString = TutorialService.advanceClientStep(atHouseBuilt, '5');
  assert.equal(byLegacyNumericString.success, true);
  assert.equal(byLegacyNumericString.tutorial.currentStep, 'civilizationTabOpened');

  const lockedBusinessStep = TutorialService.advanceClientStep(atHouseBuilt, 'houseBuilt');
  assert.equal(lockedBusinessStep.success, false);
  assert.equal(lockedBusinessStep.error, 'TUTORIAL_STEP_LOCKED');

  const lockedPrerequisite = TutorialService.advanceClientStep(atHouseBuilt, 'buildingsTabOpened');
  assert.equal(lockedPrerequisite.success, false);
  assert.equal(lockedPrerequisite.error, 'TUTORIAL_STEP_LOCKED');

  const outOfRangeNumber = TutorialService.advanceClientStep(atHouseBuilt, 99);
  assert.equal(outOfRangeNumber.success, false);
  assert.equal(outOfRangeNumber.error, 'TUTORIAL_STEP_LOCKED');

  const invalidPayload = TutorialService.advanceClientStep(atHouseBuilt, 'nonsense');
  assert.equal(invalidPayload.success, false);
  assert.equal(invalidPayload.error, 'TUTORIAL_STEP_INVALID');
});
