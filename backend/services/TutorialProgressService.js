const {
  TUTORIAL_STEPS,
  TUTORIAL_EVENT_STEPS,
  PASS_THROUGH_ACTIONS,
  CLIENT_TUTORIAL_STEP_GATES,
  createPhaseCompleted,
} = require('../config/TutorialFlowConfig');

function nowIso() {
  return new Date().toISOString();
}

function createInitialTutorialState() {
  return {
    completed: false,
    currentStep: TUTORIAL_STEPS.initial,
    phaseCompleted: createPhaseCompleted(TUTORIAL_STEPS.initial),
    updatedAt: nowIso(),
  };
}

function createCompletedTutorialState(raw = {}) {
  return {
    completed: true,
    currentStep: TUTORIAL_STEPS.completed,
    phaseCompleted: {
      newbie: true,
      era2: true,
    },
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
      newbie: Boolean(raw.phaseCompleted?.newbie || currentStep >= TUTORIAL_STEPS.houseBuilt),
      era2: Boolean(raw.phaseCompleted?.era2 || currentStep >= TUTORIAL_STEPS.completed),
    },
    updatedAt: raw.updatedAt || nowIso(),
  };
}

function blocked(message, code = 'TUTORIAL_BLOCKED') {
  return { allowed: false, code, message };
}

function getBuildingLevel(gameState, buildingId) {
  const entry = gameState?.buildings?.[buildingId];
  if (!entry) return 0;
  return typeof entry === 'object' ? entry.level || 0 : Number(entry) || 0;
}

function hasBuiltHouse(gameState) {
  return getBuildingLevel(gameState, 'house') > 0;
}

function canAffordLumbermill(gameState) {
  const resources = gameState?.resources || {};
  return (resources.food || 0) >= 50 && (resources.wood || 0) >= 15;
}

function canAccessTab(tutorialState, tabKey) {
  const tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.completed || tutorial.disabled) return true;
  const step = tutorial.currentStep;

  if (step === TUTORIAL_STEPS.houseBuilt) return true;
  if (step <= TUTORIAL_STEPS.tutorialStarted) return ['resources', 'civilization'].includes(tabKey);
  if (step <= TUTORIAL_STEPS.civilizationPrepReserved) return tabKey === 'civilization';
  if (step === TUTORIAL_STEPS.eraAdvancedTo1) return ['civilization', 'buildings'].includes(tabKey);
  if (step <= TUTORIAL_STEPS.farmBuilt) return tabKey === 'buildings';
  if (step === TUTORIAL_STEPS.era2AdvanceReady) return tabKey === 'civilization';
  if (step === TUTORIAL_STEPS.eraAdvancedTo2) return ['civilization', 'events'].includes(tabKey);
  if (step === TUTORIAL_STEPS.specialEventTabOpened) return tabKey === 'events';
  if (step === TUTORIAL_STEPS.specialEventClaimed) return ['events', 'buildings'].includes(tabKey);
  if (step === TUTORIAL_STEPS.buildingsTabOpenedForLumbermill) return ['buildings', 'resources'].includes(tabKey);
  if (step === TUTORIAL_STEPS.lumbermillBuilt) return ['buildings', 'resources'].includes(tabKey);
  return true;
}

function validateAction(tutorialState, action, payload = {}, gameState = {}) {
  const tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.completed || tutorial.disabled) return { allowed: true };
  if (PASS_THROUGH_ACTIONS.includes(action)) return { allowed: true };
  const step = tutorial.currentStep;

  if (!tutorial.phaseCompleted.newbie) {
    if (action === 'advanceEra') {
      if (gameState.currentEra === 1 && step >= TUTORIAL_STEPS.farmBuilt) {
        return blocked('人口在增长，先建造民居为新居民腾出空间');
      }
      if (step < TUTORIAL_STEPS.civilizationTabOpened || gameState.currentEra !== 0) {
        return blocked('请先按照引导进入文明并执行时代进阶');
      }
    }

    if (action === 'build') {
      if (step < TUTORIAL_STEPS.buildingsTabOpened || gameState.currentEra < 1) {
        return blocked('当前只能按照引导建造第一座农田');
      }
      if (step < TUTORIAL_STEPS.farmBuilt && payload?.target !== 'farm') {
        return blocked('当前只能按照引导建造第一座农田');
      }
      if (step === TUTORIAL_STEPS.farmBuilt && !['farm', 'house'].includes(payload?.target)) {
        return blocked('人口在增长，先建造民居为新居民腾出空间');
      }
    }

    if (['upgrade', 'claimEvent'].includes(action) && step < TUTORIAL_STEPS.houseBuilt) {
      return blocked('请先完成新手引导');
    }
    return { allowed: true };
  }

  if (!tutorial.phaseCompleted.era2 && step === TUTORIAL_STEPS.houseBuilt) {
    if (action === 'advanceEra') return blocked('请先等待人口增长并完成民居引导');
    return { allowed: true };
  }

  if (!tutorial.phaseCompleted.era2 && step >= TUTORIAL_STEPS.era2AdvanceReady) {
    if (step === TUTORIAL_STEPS.buildingsTabOpenedForLumbermill && !canAffordLumbermill(gameState)) {
      if (action === 'advanceEra') return blocked('请先完成聚落时代引导');
      return { allowed: true };
    }

    if (action === 'advanceEra') {
      if (step !== TUTORIAL_STEPS.era2AdvanceReady || gameState.currentEra !== 1) {
        return blocked('请先按照引导迈入聚落时代');
      }
      return { allowed: true };
    }

    if (action === 'claimEvent') {
      if (step < TUTORIAL_STEPS.eraAdvancedTo2 || payload?.eventId !== 'evt_settlement_forest_001') {
        return blocked('请先查看森林事件并领取木材');
      }
      return { allowed: true };
    }

    if (action === 'build') {
      if (payload?.target !== 'lumbermill' || step < TUTORIAL_STEPS.specialEventClaimed) {
        return blocked('当前只能按照引导建造伐木场');
      }
      return { allowed: true };
    }

    if (action === 'assign') {
      const amount = Number(payload?.count) || 0;
      if (payload?.target !== 'craftsman' || amount <= 0 || step < TUTORIAL_STEPS.lumbermillBuilt) {
        return blocked('请先按照引导分配工匠');
      }
      return { allowed: true };
    }

    if (action === 'upgrade') return blocked('请先完成聚落时代引导');
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
  if (!tutorial.phaseCompleted.newbie) return tutorial;
  const readyForEra2 = gameState.currentEra === 1
    && eraProgress?.canAdvance
    && hasBuiltHouse(gameState);
  if (readyForEra2 && tutorial.currentStep < TUTORIAL_STEPS.era2AdvanceReady) {
    return manualAdvance(tutorial, TUTORIAL_STEPS.era2AdvanceReady);
  }
  return tutorial;
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
  ensureLumbermillGuideResources,
  advanceTutorial,
  advanceClientStep,
};
