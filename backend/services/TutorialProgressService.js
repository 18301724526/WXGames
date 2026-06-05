const BuildingConfig = require('../config/BuildingConfig');
const { getAdvanceConfig } = require('../config/EraConfig');
const FamousPersonService = require('./FamousPersonService');
const {
  TUTORIAL_STEPS,
  TUTORIAL_EVENT_STEPS,
  PASS_THROUGH_ACTIONS,
  CLIENT_TUTORIAL_STEP_GATES,
  createPhaseCompleted,
} = require('../config/TutorialFlowConfig');

const HOUSE_GUIDE_GRANT_KEY = 'houseGuideSupplies';
const SCOUT_FAMOUS_GRANT_KEY = 'scoutFamousPerson';

function nowIso() {
  return new Date().toISOString();
}

function createInitialTutorialState() {
  return {
    completed: false,
    currentStep: TUTORIAL_STEPS.initial,
    phaseCompleted: createPhaseCompleted(TUTORIAL_STEPS.initial),
    grants: {},
    updatedAt: nowIso(),
  };
}

function normalizeGrants(raw = {}) {
  return raw && typeof raw === 'object' ? { ...raw } : {};
}

function createCompletedTutorialState(raw = {}) {
  return {
    completed: true,
    currentStep: TUTORIAL_STEPS.completed,
    phaseCompleted: {
      newbie: true,
      era2: true,
      scoutFormation: true,
    },
    grants: normalizeGrants(raw.grants),
    disabled: Boolean(raw.disabled),
    updatedAt: raw.updatedAt || nowIso(),
  };
}

function normalizeTutorialState(raw) {
  if (!raw || typeof raw !== 'object') return createInitialTutorialState();
  if (raw.disabled) return createCompletedTutorialState(raw);
  const rawStep = Number(raw.currentStep);
  const currentStep = Number.isFinite(rawStep)
    ? Math.max(TUTORIAL_STEPS.initial, Math.min(TUTORIAL_STEPS.completed, Math.floor(rawStep)))
    : TUTORIAL_STEPS.initial;
  const completed = Boolean(raw.completed || currentStep >= TUTORIAL_STEPS.completed);
  if (completed) return createCompletedTutorialState({ ...raw, disabled: false, currentStep });
  return {
    completed: false,
    currentStep,
    phaseCompleted: {
      newbie: Boolean(raw.phaseCompleted?.newbie || currentStep >= TUTORIAL_STEPS.eraAdvancedTo1),
      era2: Boolean(raw.phaseCompleted?.era2 || currentStep >= TUTORIAL_STEPS.lumbermillBuilt),
      scoutFormation: Boolean(raw.phaseCompleted?.scoutFormation || currentStep >= TUTORIAL_STEPS.scoutFormationSaved),
    },
    grants: normalizeGrants(raw.grants),
    updatedAt: raw.updatedAt || nowIso(),
  };
}

function blocked(message, code = 'TUTORIAL_BLOCKED') {
  return { allowed: false, code, message };
}

function getBuildingLevel(gameState, buildingId) {
  const cityId = gameState?.activeCityId || 'capital';
  const city = gameState?.cities?.[cityId] || gameState?.cities?.capital || null;
  const entry = city?.buildings?.[buildingId] || gameState?.buildings?.[buildingId];
  if (!entry) return 0;
  return typeof entry === 'object' ? entry.level || 0 : Number(entry) || 0;
}

function hasBuiltHouse(gameState) {
  return getBuildingLevel(gameState, 'house') > 0;
}

function hasBuiltFarm(gameState) {
  return getBuildingLevel(gameState, 'farm') > 0;
}

function canAffordLumbermill(gameState) {
  const resources = gameState?.resources || {};
  return (resources.food || 0) >= 50 && (resources.wood || 0) >= 15;
}

function canAccessTab(tutorialState, tabKey) {
  const tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.completed || tutorial.disabled) return true;
  const step = tutorial.currentStep;

  if (step < TUTORIAL_STEPS.houseBuilt) return ['resources', 'buildings', 'military'].includes(tabKey);
  if (step < TUTORIAL_STEPS.eraAdvancedTo1) return ['resources', 'civilization', 'buildings', 'military'].includes(tabKey);
  if (step <= TUTORIAL_STEPS.farmBuilt) return ['civilization', 'buildings'].includes(tabKey);
  if (step === TUTORIAL_STEPS.era2AdvanceReady) return tabKey === 'civilization';
  if (step === TUTORIAL_STEPS.eraAdvancedTo2) return ['civilization', 'events'].includes(tabKey);
  if (step === TUTORIAL_STEPS.specialEventTabOpened) return tabKey === 'events';
  if (step === TUTORIAL_STEPS.specialEventClaimed) return ['events', 'buildings'].includes(tabKey);
  if (step === TUTORIAL_STEPS.buildingsTabOpenedForLumbermill) return ['buildings', 'resources'].includes(tabKey);
  if (step === TUTORIAL_STEPS.lumbermillBuilt) return ['buildings', 'resources'].includes(tabKey);
  if (step === TUTORIAL_STEPS.era3AdvanceReady) return ['civilization', 'buildings', 'tasks'].includes(tabKey);
  if (step >= TUTORIAL_STEPS.era3Advanced && step < TUTORIAL_STEPS.scoutFormationSaved) {
    return ['resources', 'military', 'civilization'].includes(tabKey);
  }
  return true;
}

function validateHouseGuideAction(step, action, payload, gameState) {
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
  if (step === TUTORIAL_STEPS.buildingsTabOpenedForLumbermill && !canAffordLumbermill(gameState)) {
    if (action === 'advanceEra') return blocked('请先完成聚落时代引导。');
    return { allowed: true };
  }

  if (action === 'advanceEra') {
    if (step !== TUTORIAL_STEPS.era2AdvanceReady || gameState.currentEra !== 1) {
      return blocked('请先按照引导迈入聚落时代。');
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

function validateAction(tutorialState, action, payload = {}, gameState = {}) {
  const tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.completed || tutorial.disabled) return { allowed: true };
  if (PASS_THROUGH_ACTIONS.includes(action)) return { allowed: true };
  const step = tutorial.currentStep;

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

function manualAdvance(tutorialState, nextStep) {
  const normalized = normalizeTutorialState(tutorialState);
  if (normalized.completed || normalized.disabled) return normalized;
  const step = Number(nextStep);
  if (!Number.isFinite(step) || step <= normalized.currentStep) return normalized;
  const currentStep = Math.min(TUTORIAL_STEPS.completed, Math.floor(step));
  return {
    ...normalized,
    currentStep,
    phaseCompleted: createPhaseCompleted(currentStep),
    completed: currentStep >= TUTORIAL_STEPS.completed,
    updatedAt: nowIso(),
  };
}

function advanceClientStep(tutorialState, requestedStep) {
  const tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.completed || tutorial.disabled) return { success: true, tutorial };
  const nextStep = Number(requestedStep);
  if (!Number.isFinite(nextStep)) {
    return {
      success: false,
      error: 'TUTORIAL_STEP_INVALID',
      message: 'Tutorial step is invalid.',
      tutorial,
    };
  }
  const step = Math.floor(nextStep);
  const requiredCurrentStep = CLIENT_TUTORIAL_STEP_GATES[step];
  if (!Number.isFinite(requiredCurrentStep)) {
    return {
      success: false,
      error: 'TUTORIAL_STEP_LOCKED',
      message: 'Tutorial step must be advanced by a real game action.',
      tutorial,
    };
  }
  if (tutorial.currentStep < requiredCurrentStep) {
    return {
      success: false,
      error: 'TUTORIAL_STEP_LOCKED',
      message: 'Tutorial step prerequisite is not complete.',
      tutorial,
    };
  }
  return {
    success: true,
    tutorial: manualAdvance(tutorial, step),
  };
}

function maybeActivateEra2Tutorial(tutorialState, gameState, eraProgress) {
  let tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.completed || tutorial.disabled || tutorial.phaseCompleted.era2) return tutorial;
  if (gameState.currentEra >= 2 && tutorial.currentStep < TUTORIAL_STEPS.eraAdvancedTo2) {
    return manualAdvance(tutorial, TUTORIAL_STEPS.eraAdvancedTo2);
  }
  if (hasBuiltHouse(gameState) && tutorial.currentStep < TUTORIAL_STEPS.houseBuilt) {
    tutorial = manualAdvance(tutorial, TUTORIAL_STEPS.houseBuilt);
  }
  const readyForEra2 = gameState.currentEra === 1
    && eraProgress?.canAdvance
    && hasBuiltHouse(gameState)
    && hasBuiltFarm(gameState)
    && tutorial.currentStep >= TUTORIAL_STEPS.farmBuilt;
  if (readyForEra2 && tutorial.currentStep < TUTORIAL_STEPS.era2AdvanceReady) {
    return manualAdvance(tutorial, TUTORIAL_STEPS.era2AdvanceReady);
  }
  return tutorial;
}

function ensureScoutFamousPersonGrant(gameState) {
  if (!gameState || typeof gameState !== 'object') return false;
  let tutorial = normalizeTutorialState(gameState.tutorial);
  if (tutorial.completed || tutorial.disabled || tutorial.grants?.[SCOUT_FAMOUS_GRANT_KEY]) return false;
  if ((Number(gameState.currentEra) || 0) < 3 || tutorial.currentStep < TUTORIAL_STEPS.era3Advanced) return false;

  const grant = FamousPersonService.grantTutorialScoutFamousPerson(gameState);
  if (!grant?.person) return false;
  tutorial = manualAdvance({
    ...tutorial,
    grants: {
      ...(tutorial.grants || {}),
      [SCOUT_FAMOUS_GRANT_KEY]: {
        personId: grant.person.id,
        grantedAt: grant.grantedAt,
      },
    },
  }, TUTORIAL_STEPS.scoutFamousGranted);
  gameState.tutorial = tutorial;
  return true;
}

function getHouseGuideMinimumResources() {
  const resources = {};
  const houseCost = BuildingConfig.getBuildCost('house');
  const firstAdvanceCost = getAdvanceConfig(0)?.cost || {};
  for (const cost of [houseCost, firstAdvanceCost]) {
    Object.entries(cost || {}).forEach(([key, value]) => {
      resources[key] = (resources[key] || 0) + (Number(value) || 0);
    });
  }
  return resources;
}

function ensureHouseGuideResources(gameState) {
  if (!gameState || typeof gameState !== 'object') return false;
  const tutorial = normalizeTutorialState(gameState.tutorial);
  if (tutorial.completed || tutorial.disabled || tutorial.grants?.[HOUSE_GUIDE_GRANT_KEY]) return false;
  if (hasBuiltHouse(gameState)) return false;

  const minimum = getHouseGuideMinimumResources();
  const cityId = gameState.activeCityId || 'capital';
  const city = gameState.cities?.[cityId] || gameState.cities?.capital || null;
  const resources = city?.resources || gameState.resources || {};
  let changed = false;
  Object.entries(minimum).forEach(([key, value]) => {
    const required = Number(value) || 0;
    if ((Number(resources[key]) || 0) < required) {
      resources[key] = required;
      changed = true;
    }
  });
  if (city) city.resources = resources;
  gameState.resources = resources;
  gameState.tutorial = {
    ...tutorial,
    grants: {
      ...(tutorial.grants || {}),
      [HOUSE_GUIDE_GRANT_KEY]: true,
    },
    updatedAt: changed ? nowIso() : tutorial.updatedAt,
  };
  return changed;
}

function ensureLumbermillGuideResources() {
  return false;
}

function advanceTutorial(tutorialState, eventName) {
  const nextStep = TUTORIAL_EVENT_STEPS[eventName];
  if (!nextStep) return normalizeTutorialState(tutorialState);
  return manualAdvance(tutorialState, nextStep);
}

module.exports = {
  createInitialTutorialState,
  normalizeTutorialState,
  canAccessTab,
  validateAction,
  manualAdvance,
  maybeActivateEra2Tutorial,
  ensureHouseGuideResources,
  ensureLumbermillGuideResources,
  ensureScoutFamousPersonGrant,
  advanceTutorial,
  advanceClientStep,
  getHouseGuideMinimumResources,
};
