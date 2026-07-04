const { TutorialFlowConfig } = require('../config/GameplayConfigRuntime');
const {
  TUTORIAL_STEPS,
  payloadStepName,
  stepEquals,
  stepAtLeast,
  stepBefore,
} = require('../../../shared/tutorialFlowConfig');
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

function getPassThroughActions() {
  return TutorialFlowConfig.PASS_THROUGH_ACTIONS;
}

function validateHouseGuideAction(step, action, payload, gameState) {
  if (action === 'advanceEra') {
    return blocked('请先建造第一处民居，再按照引导查看文明进阶。');
  }
  if (action === 'build') {
    if (stepBefore(step, TUTORIAL_STEPS.cityEntered) && !hasBuiltHouse(gameState)) {
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
  if (action === 'advanceEra') {
    if (stepBefore(step, TUTORIAL_STEPS.civilizationTabOpened) || gameState.currentEra !== 0) {
      return blocked('请先按照引导进入文明并执行时代进阶。');
    }
    return { allowed: true };
  }
  if (action === 'build') {
    if (stepBefore(step, TUTORIAL_STEPS.buildingsTabOpened) || gameState.currentEra < 1) {
      return blocked('当前只能按照引导建造第一座农田。');
    }
    if (stepBefore(step, TUTORIAL_STEPS.farmBuilt) && payload?.target !== 'farm') {
      return blocked('当前只能按照引导建造第一座农田。');
    }
    return { allowed: true };
  }
  if (['upgrade', 'claimEvent'].includes(action) && stepBefore(step, TUTORIAL_STEPS.farmBuilt)) {
    return blocked('请先完成当前新手引导。');
  }
  return { allowed: true };
}

function validateEra2Action(step, action, payload, gameState) {
  if (stepEquals(step, TUTORIAL_STEPS.buildingsTabOpenedForLumbermill) && !canAffordLumbermill(gameState)) {
    if (action === 'advanceEra') return blocked('请先完成聚落时代引导。');
    return { allowed: true };
  }

  if (action === 'advanceEra') {
    if (!stepEquals(step, TUTORIAL_STEPS.era2AdvanceReady) || gameState.currentEra !== 1) {
      return blocked('请先按照引导进入聚落时代。');
    }
    return { allowed: true };
  }

  if (action === 'claimEvent') {
    if (stepBefore(step, TUTORIAL_STEPS.eraAdvancedTo2) || payload?.eventId !== 'evt_settlement_forest_001') {
      return blocked('请先查看森林事件并领取木材。');
    }
    return { allowed: true };
  }

  if (action === 'build') {
    if (payload?.target !== 'lumbermill' || stepBefore(step, TUTORIAL_STEPS.specialEventClaimed)) {
      return blocked('当前只能按照引导建造伐木场。');
    }
    return { allowed: true };
  }

  if (action === 'assign') {
    const amount = Number(payload?.count) || 0;
    if (payload?.target !== 'craftsman' || amount <= 0 || stepBefore(step, TUTORIAL_STEPS.lumbermillBuilt)) {
      return blocked('请先按照引导分配工匠。');
    }
    return { allowed: true };
  }

  if (action === 'upgrade') return blocked('请先完成聚落时代引导。');
  return { allowed: true };
}

function validateScoutFormationAction(step, action, payload, gameState) {
  if (action === 'advanceEra') {
    if (!stepEquals(step, TUTORIAL_STEPS.era3AdvanceReady) || gameState.currentEra !== 2) {
      return blocked('请先按照引导完成名人编队准备。');
    }
    return { allowed: true };
  }

  if (action === 'build') {
    // Barracks segment (era3Advanced..barracksBuilt): only the guided barracks
    // build passes; from barracksBuilt onward building is unrestricted again.
    if (stepAtLeast(step, TUTORIAL_STEPS.era3Advanced) && stepBefore(step, TUTORIAL_STEPS.barracksBuilt)) {
      if (payload?.target !== 'barracks') return blocked('当前只能按照引导建造兵营。');
      return { allowed: true };
    }
    return { allowed: true };
  }

  if (action === 'setArmyFormation') {
    if (stepBefore(step, TUTORIAL_STEPS.formationPanelOpened)) {
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
  if (action === 'returnWorldMarch' || action === 'stopWorldMarch') {
    if (stepBefore(step, TUTORIAL_STEPS.firstCityDiscovered)) {
      return blocked('请先完成引导侦察行军。');
    }
    return { allowed: true };
  }
  if (action === 'startWorldMarch') {
    if (stepAtLeast(step, TUTORIAL_STEPS.firstCityDiscovered)) return { allowed: true };
    if (stepBefore(step, TUTORIAL_STEPS.scoutFormationSaved)) {
      return blocked('请先完成侦察编队引导，再进行探索。');
    }
    if (!hasTutorialScoutFormation(gameState, payload)) {
      return blocked('请让教程赠送的侦察名人留在一号编队后再探索。');
    }
    return { allowed: true };
  }

  return { allowed: true };
}

function validateFirstCityGuideAction(step, action, payload, gameState) {
  const firstCityId = getTutorialFirstEmptyCityId(gameState.tutorial);
  const targetId = String(payload?.territoryId || payload?.cityId || '').trim();
  const target = getTerritoryById(gameState, targetId);
  const isFirstCity = firstCityId && targetId === firstCityId;

  if (action === 'startConquest') {
    if (!stepEquals(step, TUTORIAL_STEPS.firstCityDiscovered)) {
      return blocked('请先完成当前的占城引导步骤。');
    }
    if (!isFirstCity || !target || target.status !== 'discovered' || target.owner !== 'neutral') {
      return blocked('请先占领引导侦察发现的空城。');
    }
    return { allowed: true };
  }

  if (action === 'claimConquest') {
    if (!stepEquals(step, TUTORIAL_STEPS.firstCityConquestStarted)) {
      return blocked('请先按照引导发起空城占领。');
    }
    if (!isFirstCity) return blocked('请先完成引导空城的占领。');
    return { allowed: true };
  }

  if (action === 'renameCity') {
    if (!stepEquals(step, TUTORIAL_STEPS.firstCityOccupied)) {
      return blocked('请先完成空城占领，再进行命名。');
    }
    if (!isFirstCity || !target || target.status !== 'occupied') {
      return blocked('请为新占领的引导城市命名。');
    }
    return { allowed: true };
  }

  if (action === 'renamePolity') {
    if (!stepEquals(step, TUTORIAL_STEPS.firstCityNamed)) {
      return blocked('请先为新城命名，再为势力命名。');
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
    return blocked('请先完成新城的占领与命名。');
  }

  return { allowed: true };
}

function validatePostNamingSystemGuideAction(step, action, payload = {}) {
  if (action === 'tutorialAdvance') {
    // Mixed-version tolerance: clients send the step name or the legacy number.
    const requestedStep = payloadStepName(payload?.step);
    if (
      (stepEquals(step, TUTORIAL_STEPS.polityNamed) && requestedStep === TUTORIAL_STEPS.talentPolicyOpened)
      || (stepEquals(step, TUTORIAL_STEPS.talentPolicyOpened) && requestedStep === TUTORIAL_STEPS.talentPolicyApplied)
      || (stepEquals(step, TUTORIAL_STEPS.manualTalentAssigned) && requestedStep === TUTORIAL_STEPS.famousSeekOpened)
      || (stepEquals(step, TUTORIAL_STEPS.famousSeekCompleted) && requestedStep === TUTORIAL_STEPS.finalTechOpened)
      || (stepEquals(step, TUTORIAL_STEPS.finalTechOpened) && requestedStep === TUTORIAL_STEPS.completed)
    ) {
      return { allowed: true };
    }
    return blocked('请按照当前引导步骤操作。');
  }

  if (stepEquals(step, TUTORIAL_STEPS.talentPolicyOpened) && action === 'applyTalentPolicy') {
    return { allowed: true };
  }
  if (stepEquals(step, TUTORIAL_STEPS.talentPolicyApplied) && action === 'assign') {
    const amount = Number(payload?.count) || 0;
    if (!payload?.target || amount === 0) return blocked('请手动调整一次人才分配。');
    return { allowed: true };
  }
  if (stepEquals(step, TUTORIAL_STEPS.famousSeekOpened) && action === 'seekFamousPerson') {
    return { allowed: true };
  }

  return blocked('请先完成当前引导，再使用其他系统。');
}

function validateAction(tutorialState, action, payload = {}, gameState = {}) {
  const PASS_THROUGH_ACTIONS = getPassThroughActions();
  const tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.completed || tutorial.disabled) return { allowed: true };
  const step = tutorial.currentStep;

  if (
    stepAtLeast(step, TUTORIAL_STEPS.firstCityDiscovered)
    && stepBefore(step, TUTORIAL_STEPS.polityNamed)
  ) {
    return validateFirstCityGuideAction(step, action, payload, gameState);
  }

  if (stepAtLeast(step, TUTORIAL_STEPS.polityNamed) && stepBefore(step, TUTORIAL_STEPS.completed)) {
    return validatePostNamingSystemGuideAction(step, action, payload);
  }

  if (PASS_THROUGH_ACTIONS.includes(action)) return { allowed: true };

  if (['startWorldMarch', 'returnWorldMarch', 'stopWorldMarch'].includes(action)) {
    return validateScoutExploreAction(step, action, payload, gameState);
  }

  if (stepBefore(step, TUTORIAL_STEPS.houseBuilt)) {
    return validateHouseGuideAction(step, action, payload, gameState);
  }
  if (stepBefore(step, TUTORIAL_STEPS.eraAdvancedTo1)) {
    return validateFirstEraAction(step, action, payload, gameState);
  }
  if (stepBefore(step, TUTORIAL_STEPS.era2AdvanceReady)) {
    return validateFirstEraAction(step, action, payload, gameState);
  }
  if (!tutorial.phaseCompleted.era2 && stepAtLeast(step, TUTORIAL_STEPS.era2AdvanceReady)) {
    return validateEra2Action(step, action, payload, gameState);
  }
  if (stepAtLeast(step, TUTORIAL_STEPS.era3AdvanceReady) && stepBefore(step, TUTORIAL_STEPS.scoutFormationSaved)) {
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
