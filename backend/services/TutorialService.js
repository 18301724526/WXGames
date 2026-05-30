const TUTORIAL_STEPS = Object.freeze({
  initial: 0,
  tutorialStarted: 1,
  civilizationTabOpened: 2,
  civilizationPrepReserved: 3,
  eraAdvancedTo1: 4,
  buildingsTabOpened: 5,
  farmPrepReserved: 6,
  farmBuilt: 7,
  houseBuilt: 8,
  era2AdvanceReady: 9,
  eraAdvancedTo2: 10,
  specialEventTabOpened: 11,
  specialEventClaimed: 12,
  buildingsTabOpenedForLumbermill: 13,
  lumbermillBuilt: 14,
  craftsmanAssigned: 15,
  completed: 15,
});

function canAffordLumbermill(gameState) {
  const resources = gameState?.resources || {};
  return (resources.food || 0) >= 50 && (resources.wood || 0) >= 15;
}

function getLumbermillBuildCost(gameState) {
  return gameState?.buildingCosts?.lumbermill || { food: 50, wood: 15 };
}

function getBuildingLevel(gameState, buildingId) {
  const entry = gameState?.buildings?.[buildingId];
  if (!entry) return 0;
  return typeof entry === 'object' ? entry.level || 0 : Number(entry) || 0;
}

function hasBuiltHouse(gameState) {
  return getBuildingLevel(gameState, 'house') > 0;
}

function hasBuiltLumbermill(gameState) {
  return getBuildingLevel(gameState, 'lumbermill') > 0;
}

function createPhaseCompleted(currentStep) {
  const step = Number.isFinite(currentStep) ? currentStep : TUTORIAL_STEPS.initial;
  return {
    newbie: step >= TUTORIAL_STEPS.houseBuilt,
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
      newbie: Boolean(raw.phaseCompleted?.newbie || currentStep >= TUTORIAL_STEPS.houseBuilt),
      era2: Boolean(raw.phaseCompleted?.era2 || currentStep >= TUTORIAL_STEPS.completed),
    },
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function canAccessTab(tutorialState, tabKey) {
  const tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.completed) return true;
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

function blocked(message) {
  return { allowed: false, code: 'TUTORIAL_BLOCKED', message };
}

function validateAction(tutorialState, action, payload, gameState) {
  const tutorial = normalizeTutorialState(tutorialState);
  if ([
    'applyTalentPolicy',
    'saveTalentPolicy',
    'deleteTalentPolicy',
    'research',
    'seekFamousPerson',
    'acceptFamousPerson',
    'dismissFamousPersonCandidate',
    'assignFamousAttributePoint',
  ].includes(action)) return { allowed: true };
  if (tutorial.completed) return { allowed: true };
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

    if (['research', 'upgrade', 'claimEvent'].includes(action) && step < TUTORIAL_STEPS.houseBuilt) {
      return blocked('请先完成新手引导');
    }
    return { allowed: true };
  }

  if (!tutorial.phaseCompleted.era2 && step === TUTORIAL_STEPS.houseBuilt) {
    if (action === 'advanceEra') {
      return blocked('请先等待人口增长并完成民居引导');
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
  let tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.phaseCompleted.era2) return tutorial;
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

function ensureLumbermillGuideResources(tutorialState, gameState) {
  normalizeTutorialState(tutorialState);
  return false;
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
    houseBuilt: TUTORIAL_STEPS.houseBuilt,
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
  ensureLumbermillGuideResources,
  advanceTutorial,
};
