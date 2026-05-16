const TUTORIAL_STEPS = Object.freeze({
  initial: 0,
  tutorialStarted: 1,
  civilizationTabOpened: 2,
  civilizationPrepReserved: 3,
  eraAdvancedTo1: 4,
  buildingsTabOpened: 5,
  farmPrepReserved: 6,
  farmBuilt: 7,
  era2AdvanceReady: 8,
  eraAdvancedTo2: 9,
  specialEventTabOpened: 10,
  specialEventClaimed: 11,
  buildingsTabOpenedForLumbermill: 12,
  lumbermillBuilt: 13,
  craftsmanAssigned: 14,
  completed: 14,
});

function canAffordLumbermill(gameState) {
  const resources = gameState?.resources || {};
  return (resources.food || 0) >= 50 && (resources.wood || 0) >= 15;
}

function createPhaseCompleted(currentStep) {
  const step = Number.isFinite(currentStep) ? currentStep : TUTORIAL_STEPS.initial;
  return {
    newbie: step >= TUTORIAL_STEPS.farmBuilt,
    era2: step >= TUTORIAL_STEPS.completed,
  };
}

function createInitialTutorialState() {
  return {
    completed: false,
    currentStep: TUTORIAL_STEPS.initial,
    phaseCompleted: createPhaseCompleted(TUTORIAL_STEPS.initial),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeTutorialState(raw) {
  if (!raw || typeof raw !== 'object') return createInitialTutorialState();
  const currentStep = Number.isFinite(raw.currentStep) ? raw.currentStep : TUTORIAL_STEPS.initial;
  return {
    completed: Boolean(raw.completed),
    currentStep,
    phaseCompleted: {
      newbie: Boolean(raw.phaseCompleted?.newbie || currentStep >= TUTORIAL_STEPS.farmBuilt),
      era2: Boolean(raw.phaseCompleted?.era2 || currentStep >= TUTORIAL_STEPS.completed),
    },
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function canAccessTab(tutorialState, tabKey) {
  const tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.completed) return true;
  const step = tutorial.currentStep;

  if (tutorial.phaseCompleted.newbie && !tutorial.phaseCompleted.era2 && step === TUTORIAL_STEPS.farmBuilt) {
    return true;
  }
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

function blocked(message) {
  return { allowed: false, code: 'TUTORIAL_BLOCKED', message };
}

function validateAction(tutorialState, action, payload, gameState) {
  const tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.completed) return { allowed: true };
  const step = tutorial.currentStep;

  if (!tutorial.phaseCompleted.newbie) {
    if (action === 'advanceEra') {
      if (step < TUTORIAL_STEPS.civilizationTabOpened || gameState.currentEra !== 0) {
        return blocked('请先按照引导进入文明并执行时代进阶');
      }
    }

    if (action === 'build') {
      if (payload?.target !== 'farm' || step < TUTORIAL_STEPS.buildingsTabOpened || gameState.currentEra < 1) {
        return blocked('当前只能按照引导建造第一座农田');
      }
    }

    if (['research', 'upgrade', 'claimEvent'].includes(action) && step < TUTORIAL_STEPS.farmBuilt) {
      return blocked('请先完成新手引导');
    }
    return { allowed: true };
  }

  if (!tutorial.phaseCompleted.era2 && step >= TUTORIAL_STEPS.era2AdvanceReady) {
    if (step === TUTORIAL_STEPS.buildingsTabOpenedForLumbermill && !canAffordLumbermill(gameState)) {
      if (action === 'advanceEra') {
        return blocked('请先完成聚落时代引导');
      }
      return { allowed: true };
    }

    if (action === 'advanceEra') {
      if (step !== TUTORIAL_STEPS.era2AdvanceReady || gameState.currentEra !== 1) {
        return blocked('请先按照引导迈入聚落时代');
      }
      return { allowed: true };
    }

    if (action === 'claimEvent') {
      if (step < TUTORIAL_STEPS.specialEventTabOpened || payload?.eventId !== 'evt_settlement_forest_001') {
        return blocked('请先查看森林事件并领取木材');
      }
      return { allowed: true };
    }

    if (action === 'build') {
      if (payload?.target !== 'lumbermill' || step < TUTORIAL_STEPS.buildingsTabOpenedForLumbermill) {
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

    if (['upgrade', 'research'].includes(action)) {
      return blocked('请先完成聚落时代引导');
    }
  }

  return { allowed: true };
}

function manualAdvance(tutorialState, nextStep) {
  const normalized = normalizeTutorialState(tutorialState);
  const step = Number(nextStep);
  if (!Number.isFinite(step)) return normalized;
  if (step <= normalized.currentStep) return normalized;
  return {
    ...normalized,
    currentStep: step,
    phaseCompleted: createPhaseCompleted(step),
    completed: step >= TUTORIAL_STEPS.completed,
    updatedAt: new Date().toISOString(),
  };
}

function maybeActivateEra2Tutorial(tutorialState, gameState, eraProgress) {
  const tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.phaseCompleted.era2 || !tutorial.phaseCompleted.newbie) return tutorial;
  if (gameState.currentEra === 1 && eraProgress?.canAdvance && tutorial.currentStep < TUTORIAL_STEPS.era2AdvanceReady) {
    return manualAdvance(tutorial, TUTORIAL_STEPS.era2AdvanceReady);
  }
  return tutorial;
}

function advanceTutorial(tutorialState, eventName) {
  const normalized = normalizeTutorialState(tutorialState);
  const map = {
    tutorialStarted: TUTORIAL_STEPS.tutorialStarted,
    civilizationTabOpened: TUTORIAL_STEPS.civilizationTabOpened,
    eraAdvanced: TUTORIAL_STEPS.eraAdvancedTo1,
    eraAdvancedTo2: TUTORIAL_STEPS.eraAdvancedTo2,
    buildingsTabOpened: TUTORIAL_STEPS.buildingsTabOpened,
    farmBuilt: TUTORIAL_STEPS.farmBuilt,
    era2AdvanceReady: TUTORIAL_STEPS.era2AdvanceReady,
    specialEventTabOpened: TUTORIAL_STEPS.specialEventTabOpened,
    specialEventClaimed: TUTORIAL_STEPS.specialEventClaimed,
    buildingsTabOpenedForLumbermill: TUTORIAL_STEPS.buildingsTabOpenedForLumbermill,
    lumbermillBuilt: TUTORIAL_STEPS.lumbermillBuilt,
    craftsmanAssigned: TUTORIAL_STEPS.craftsmanAssigned,
  };
  const nextStep = map[eventName];
  if (!nextStep) return normalized;
  return manualAdvance(normalized, nextStep);
}

module.exports = {
  TUTORIAL_STEPS,
  createInitialTutorialState,
  normalizeTutorialState,
  canAccessTab,
  validateAction,
  manualAdvance,
  maybeActivateEra2Tutorial,
  advanceTutorial,
};
