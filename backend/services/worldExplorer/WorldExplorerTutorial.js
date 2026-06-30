const TerritoryService = require('../TerritoryService');
const { TutorialFlowConfig } = require('../config/GameplayConfigRuntime');
const { getTutorialScoutPersonId, getFormationSnapshot } = require('../tutorial/TutorialSelectors');
const {
  TUTORIAL_FIRST_SITE_GRANT_KEY,
} = require('./WorldExplorerShared');

function getTutorialSteps() {
  return TutorialFlowConfig.TUTORIAL_STEPS;
}

function validateTutorialFormation(gameState = {}, options = {}) {
  const TUTORIAL_STEPS = getTutorialSteps();
  const tutorial = gameState.tutorial || {};
  if (tutorial.completed || tutorial.disabled) return { success: true, formation: getFormationSnapshot(gameState, options) };
  const step = Math.floor(Number(tutorial.currentStep) || 0);
  if (step < TUTORIAL_STEPS.scoutFormationSaved) {
    return { success: false, error: 'EXPLORE_TUTORIAL_LOCKED', message: 'Please finish the scout formation guide before exploring.' };
  }
  if (step >= TUTORIAL_STEPS.firstCityDiscovered) return { success: true, formation: getFormationSnapshot(gameState, options) };
  const scoutPersonId = getTutorialScoutPersonId(gameState);
  const formation = getFormationSnapshot(gameState, options);
  if (!scoutPersonId || !formation.memberIds.includes(scoutPersonId)) {
    return { success: false, error: 'EXPLORE_TUTORIAL_FORMATION_REQUIRED', message: 'Please keep the tutorial scout famous person in formation 1 before exploring.' };
  }
  return { success: true, formation };
}

function ensureTutorialFirstCityClaimSoldiers(gameState = {}) {
  const TUTORIAL_STEPS = getTutorialSteps();
  const tutorial = gameState.tutorial || {};
  if (tutorial.completed || tutorial.disabled) return false;
  const step = Math.floor(Number(tutorial.currentStep) || 0);
  if (step < TUTORIAL_STEPS.firstCityDiscovered || step >= TUTORIAL_STEPS.firstCityConquestStarted) return false;
  const siteId = tutorial.grants?.[TUTORIAL_FIRST_SITE_GRANT_KEY]?.siteId;
  if (!siteId) return false;
  const target = (gameState.territories || []).find((territory) => territory?.id === siteId);
  if (!target || target.status !== 'discovered' || target.owner !== 'neutral') return false;

  const required = TerritoryService.MIN_EXPEDITION_SOLDIERS;
  const activeCityId = gameState.activeCityId || 'capital';
  const city = gameState.cities?.[activeCityId] || gameState.cities?.capital || null;
  const military = city?.military || gameState.military || {};
  let changed = false;
  if ((Number(military.soldiers) || 0) < required) {
    military.soldiers = required;
    changed = true;
  }
  if ((Number(military.soldierCap) || 0) < required) {
    military.soldierCap = required;
    changed = true;
  }
  if (!changed) return false;
  if (city) city.military = military;
  else gameState.military = military;
  gameState.tutorial = {
    ...tutorial,
    grants: {
      ...(tutorial.grants || {}),
      [TUTORIAL_FIRST_SITE_GRANT_KEY]: {
        ...(tutorial.grants?.[TUTORIAL_FIRST_SITE_GRANT_KEY] || {}),
        settlementSoldiersGranted: required,
        settlementSoldiersGrantedAt: new Date().toISOString(),
      },
    },
    updatedAt: new Date().toISOString(),
  };
  return true;
}

module.exports = {
  validateTutorialFormation,
  ensureTutorialFirstCityClaimSoldiers,
};
