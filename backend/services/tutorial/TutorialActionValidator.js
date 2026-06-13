const { TutorialFlowConfig } = require('../config/GameplayConfigRuntime');
const { normalizeTutorialState } = require('./TutorialState');
const {
  SCOUT_FAMOUS_GRANT_KEY,
  hasBuiltHouse,
  canAffordLumbermill,
  hasTutorialScoutFormation,
  getTutorialFirstEmptyCityId,
  getTerritoryById,
} = require('./TutorialSelectors');

function blocked(message, code = 'TUTORIAL_BLOCKED') {
  return { allowed: false, code, message };
}

function getTutorialSteps() {
  return TutorialFlowConfig.TUTORIAL_STEPS;
}

function getPassThroughActions() {
  return TutorialFlowConfig.PASS_THROUGH_ACTIONS;
}

function validateHouseGuideAction(step, action, payload, gameState) {
  const TUTORIAL_STEPS = getTutorialSteps();
  if (action === 'advanceEra') {
    return blocked('请先建造第一处民居，再按照引导查看文明进阶。');
  }
  if (action === 'build') {
    if (step < TUTORIAL_STEPS.cityEntered && !hasBuiltHouse(gameState)) {
      return blocked('请先按照引导进入主城，准备第一处民居。');
    }
    if (payload?.target !== 'house') return blocked('当前只能按照引导建造第一处民居。');
    return { allowed: true };
  }
  if (['upgrade', 'claimEvent', 'assign'].includes(action)) {
    return blocked('请先建造第一处民居。');
  }
  return { allowed: true };
}

function validateFirstEraAction(step, action, payload, gameState) {
  const TUTORIAL_STEPS = getTutorialSteps();
  if (action === 'advanceEra') {
    if (step < TUTORIAL_STEPS.civilizationTabOpened || gameState.currentEra !== 0) {
      return blocked('请先按照引导进入文明并执行时代进阶。');
    }
    return { allowed: true };
  }
  if (action === 'build') {
    if (step < TUTORIAL_STEPS.buildingsTabOpened || gameState.currentEra < 1) {
      return blocked('当前只能按照引导建造第一座农田。');
    }
    if (step < TUTORIAL_STEPS.farmBuilt && payload?.target !== 'farm') {
      return blocked('当前只能按照引导建造第一座农田。');
    }
    return { allowed: true };
  }
  if (['upgrade', 'claimEvent'].includes(action) && step < TUTORIAL_STEPS.farmBuilt) {
    return blocked('请先完成当前新手引导。');
  }
  return { allowed: true };
}

function validateEra2Action(step, action, payload, gameState) {
  const TUTORIAL_STEPS = getTutorialSteps();
  if (step === TUTORIAL_STEPS.buildingsTabOpenedForLumbermill && !canAffordLumbermill(gameState)) {
    if (action === 'advanceEra') return blocked('请先完成聚落时代引导。');
    return { allowed: true };
  }

  if (action === 'advanceEra') {
    if (step !== TUTORIAL_STEPS.era2AdvanceReady || gameState.currentEra !== 1) {
      return blocked('请先按照引导进入聚落时代。');
    }
    return { allowed: true };
  }

  if (action === 'claimEvent') {
    if (step < TUTORIAL_STEPS.eraAdvancedTo2 || payload?.eventId !== 'evt_settlement_forest_001') {
      return blocked('请先查看森林事件并领取木材。');
    }
    return { allowed: true };
  }

  if (action === 'build') {
    if (payload?.target !== 'lumbermill' || step < TUTORIAL_STEPS.specialEventClaimed) {
      return blocked('当前只能按照引导建造伐木场。');
    }
    return { allowed: true };
  }

  if (action === 'assign') {
    const amount = Number(payload?.count) || 0;
    if (payload?.target !== 'craftsman' || amount <= 0 || step < TUTORIAL_STEPS.lumbermillBuilt) {
      return blocked('请先按照引导分配工匠。');
    }
    return { allowed: true };
  }

  if (action === 'upgrade') return blocked('请先完成聚落时代引导。');
  return { allowed: true };
}

function validateScoutFormationAction(step, action, payload, gameState) {
  const TUTORIAL_STEPS = getTutorialSteps();
  if (action === 'advanceEra') {
    if (step !== TUTORIAL_STEPS.era3AdvanceReady || gameState.currentEra !== 2) {
      return blocked('请先按照引导完成名人编队准备。');
    }
    return { allowed: true };
  }

  if (action === 'setArmyFormation') {
    if (step < TUTORIAL_STEPS.formationPanelOpened) {
      return blocked('请先按照引导打开编队并配置侦察名人。');
    }
    const tutorial = normalizeTutorialState(gameState.tutorial);
    const scoutPersonId = tutorial.grants?.[SCOUT_FAMOUS_GRANT_KEY]?.personId;
    const memberIds = Array.isArray(payload?.memberIds) ? payload.memberIds.map(String) : [];
    if (!scoutPersonId || !memberIds.includes(String(scoutPersonId))) {
      return blocked('请把教程赠送的侦察名人加入编队。');
    }
    return { allowed: true };
  }

  return { allowed: true };
}

function validateScoutExploreAction(step, action, payload, gameState) {
  const TUTORIAL_STEPS = getTutorialSteps();
  if (action === 'returnWorldMarch' || action === 'stopWorldMarch') {
    if (step < TUTORIAL_STEPS.firstCityDiscovered) {
      return blocked('Please finish the guided exploration first.');
    }
    return { allowed: true };
  }
  if (action === 'startWorldMarch') {
    if (step >= TUTORIAL_STEPS.firstCityDiscovered) return { allowed: true };
    if (step < TUTORIAL_STEPS.scoutFormationSaved) {
      return blocked('Please finish the scout formation guide before exploring.');
    }
    if (!hasTutorialScoutFormation(gameState, payload)) {
      return blocked('Please keep the tutorial scout famous person in formation 1 before exploring.');
    }
    return { allowed: true };
  }

  return { allowed: true };
}

function validateFirstCityGuideAction(step, action, payload, gameState) {
  const TUTORIAL_STEPS = getTutorialSteps();
  const firstCityId = getTutorialFirstEmptyCityId(gameState.tutorial);
  const targetId = String(payload?.territoryId || payload?.cityId || '').trim();
  const target = getTerritoryById(gameState, targetId);
  const isFirstCity = firstCityId && targetId === firstCityId;

  if (action === 'startConquest') {
    if (step !== TUTORIAL_STEPS.firstCityDiscovered) {
      return blocked('Please finish the current guided city step first.');
    }
    if (!isFirstCity || !target || target.status !== 'discovered' || target.owner !== 'neutral') {
      return blocked('Please claim the empty city discovered by the guided exploration first.');
    }
    return { allowed: true };
  }

  if (action === 'claimConquest') {
    if (step !== TUTORIAL_STEPS.firstCityConquestStarted) {
      return blocked('Please start the guided city claim first.');
    }
    if (!isFirstCity) return blocked('Please finish claiming the guided empty city.');
    return { allowed: true };
  }

  if (action === 'renameCity') {
    if (step !== TUTORIAL_STEPS.firstCityOccupied) {
      return blocked('Please finish claiming the guided empty city before naming it.');
    }
    if (!isFirstCity || !target || target.status !== 'occupied') {
      return blocked('Please name the newly claimed guided city.');
    }
    return { allowed: true };
  }

  if (action === 'renamePolity') {
    if (step !== TUTORIAL_STEPS.firstCityNamed) {
      return blocked('Please name the new city before naming the civilization.');
    }
    return { allowed: true };
  }

  if ([
    'advanceEra',
    'build',
    'claimEvent',
    'assign',
    'research',
    'seekFamousPerson',
    'acceptFamousPerson',
    'dismissFamousPersonCandidate',
    'assignFamousAttributePoint',
    'setArmyFormation',
    'startWorldMarch',
    'returnWorldMarch',
    'stopWorldMarch',
  ].includes(action)) {
    return blocked('Please finish claiming and naming the new city first.');
  }

  return { allowed: true };
}

function validatePostNamingSystemGuideAction(step, action, payload = {}) {
  const TUTORIAL_STEPS = getTutorialSteps();
  if (action === 'tutorialAdvance') {
    const requestedStep = Number(payload?.step);
    if (
      (step === TUTORIAL_STEPS.polityNamed && requestedStep === TUTORIAL_STEPS.cityPeopleOpened)
      || (step === TUTORIAL_STEPS.cityPeopleOpened && requestedStep === TUTORIAL_STEPS.manualTalentReady)
      || (step === TUTORIAL_STEPS.manualTalentAssigned && requestedStep === TUTORIAL_STEPS.famousSeekOpened)
      || (step === TUTORIAL_STEPS.famousSeekCompleted && requestedStep === TUTORIAL_STEPS.finalTechOpened)
      || (step === TUTORIAL_STEPS.finalTechOpened && requestedStep === TUTORIAL_STEPS.completed)
    ) {
      return { allowed: true };
    }
    return blocked('Please follow the current guided system step.');
  }

  if (step === TUTORIAL_STEPS.manualTalentReady && action === 'assign') {
    const amount = Number(payload?.count) || 0;
    if (!payload?.target || amount === 0) return blocked('Please manually adjust one talent assignment.');
    return { allowed: true };
  }
  if (step === TUTORIAL_STEPS.famousSeekOpened && action === 'seekFamousPerson') {
    return { allowed: true };
  }

  return blocked('Please finish the current post-naming guide before using other systems.');
}

function validateAction(tutorialState, action, payload = {}, gameState = {}) {
  const TUTORIAL_STEPS = getTutorialSteps();
  const PASS_THROUGH_ACTIONS = getPassThroughActions();
  const tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.completed || tutorial.disabled) return { allowed: true };
  const step = tutorial.currentStep;

  if (
    step >= TUTORIAL_STEPS.firstCityDiscovered
    && step < TUTORIAL_STEPS.polityNamed
  ) {
    return validateFirstCityGuideAction(step, action, payload, gameState);
  }

  if (step >= TUTORIAL_STEPS.polityNamed && step < TUTORIAL_STEPS.completed) {
    return validatePostNamingSystemGuideAction(step, action, payload);
  }

  if (PASS_THROUGH_ACTIONS.includes(action)) return { allowed: true };

  if (['startWorldMarch', 'returnWorldMarch', 'stopWorldMarch'].includes(action)) {
    return validateScoutExploreAction(step, action, payload, gameState);
  }

  if (step < TUTORIAL_STEPS.houseBuilt) {
    return validateHouseGuideAction(step, action, payload, gameState);
  }
  if (step < TUTORIAL_STEPS.eraAdvancedTo1) {
    return validateFirstEraAction(step, action, payload, gameState);
  }
  if (step < TUTORIAL_STEPS.era2AdvanceReady) {
    return validateFirstEraAction(step, action, payload, gameState);
  }
  if (!tutorial.phaseCompleted.era2 && step >= TUTORIAL_STEPS.era2AdvanceReady) {
    return validateEra2Action(step, action, payload, gameState);
  }
  if (step >= TUTORIAL_STEPS.era3AdvanceReady && step < TUTORIAL_STEPS.scoutFormationSaved) {
    return validateScoutFormationAction(step, action, payload, gameState);
  }
  return { allowed: true };
}

module.exports = {
  validateAction,
  validateHouseGuideAction,
  validateFirstEraAction,
  validateEra2Action,
  validateScoutFormationAction,
  validateScoutExploreAction,
  validateFirstCityGuideAction,
  validatePostNamingSystemGuideAction,
};
