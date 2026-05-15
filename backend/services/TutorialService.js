function createInitialTutorialState() {
  return {
    completed: false,
    currentStep: 0,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeTutorialState(raw) {
  if (!raw || typeof raw !== 'object') return createInitialTutorialState();
  return {
    completed: Boolean(raw.completed),
    currentStep: Number.isFinite(raw.currentStep) ? raw.currentStep : 0,
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function canAccessTab(tutorialState, tabKey) {
  if (tutorialState.completed) return true;
  const step = tutorialState.currentStep;
  if (step <= 1) return ['resources', 'civilization'].includes(tabKey);
  if (step <= 3) return tabKey === 'civilization';
  if (step === 4) return ['civilization', 'buildings'].includes(tabKey);
  if (step <= 6) return tabKey === 'buildings';
  return true;
}

function validateAction(tutorialState, action, payload, gameState) {
  if (tutorialState.completed) return { allowed: true };
  const step = tutorialState.currentStep;

  if (action === 'advanceEra') {
    if (step < 2 || gameState.currentEra !== 0) {
      return { allowed: false, code: 'TUTORIAL_BLOCKED', message: '请先按照引导进入文明并执行时代进阶' };
    }
  }

  if (action === 'build') {
    if (payload?.target !== 'farm' || step < 5 || gameState.currentEra < 1) {
      return { allowed: false, code: 'TUTORIAL_BLOCKED', message: '当前只能按照引导建造第一座农田' };
    }
  }

  if (['assign', 'research', 'upgrade'].includes(action) && step < 7) {
    return { allowed: false, code: 'TUTORIAL_BLOCKED', message: '请先完成新手引导' };
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
    completed: step >= 7,
    updatedAt: new Date().toISOString(),
  };
}

function advanceTutorial(tutorialState, eventName) {
  const normalized = normalizeTutorialState(tutorialState);
  const map = {
    tutorialStarted: 1,
    civilizationTabOpened: 2,
    eraAdvanced: 4,
    buildingsTabOpened: 5,
    farmBuilt: 7,
  };
  const nextStep = map[eventName];
  if (!nextStep) return normalized;
  return manualAdvance(normalized, nextStep);
}

module.exports = {
  createInitialTutorialState,
  normalizeTutorialState,
  canAccessTab,
  validateAction,
  manualAdvance,
  advanceTutorial,
};
