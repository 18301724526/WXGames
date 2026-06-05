const TerritoryService = require('../TerritoryService');
const { TUTORIAL_STEPS, createPhaseCompleted } = require('../../config/TutorialFlowConfig');
const {
  TUTORIAL_FIRST_SITE_GRANT_KEY,
  toInteger,
} = require('./WorldExplorerShared');

function advanceTutorialStep(tutorial = {}, nextStep = 0) {
  const step = Math.floor(Number(nextStep) || 0);
  const currentStep = Math.floor(Number(tutorial.currentStep) || 0);
  if (tutorial.completed || tutorial.disabled || step <= currentStep) return tutorial;
  return {
    ...tutorial,
    currentStep: step,
    phaseCompleted: {
      ...(tutorial.phaseCompleted || {}),
      ...createPhaseCompleted(step),
    },
    completed: step >= TUTORIAL_STEPS.completed,
    updatedAt: new Date().toISOString(),
  };
}

function getTutorialScoutPersonId(gameState = {}) {
  const personId = gameState.tutorial?.grants?.scoutFamousPerson?.personId;
  return personId ? String(personId) : '';
}

function getFormationSnapshot(gameState = {}, options = {}) {
  const cityId = String(options.cityId || gameState.activeCityId || 'capital').trim() || 'capital';
  const slot = Math.max(1, Math.min(3, toInteger(options.formationSlot ?? options.slot, 1)));
  const directFormations = gameState.military?.formations?.[cityId];
  const cityFormations = gameState.cities?.[cityId]?.military?.formations?.[cityId];
  const formations = Array.isArray(directFormations)
    ? directFormations
    : Array.isArray(cityFormations)
      ? cityFormations
      : [];
  const formation = formations.find((item) => Number(item?.slot) === slot) || formations[slot - 1] || null;
  return {
    cityId,
    slot,
    memberIds: Array.isArray(formation?.memberIds) ? formation.memberIds.map(String) : [],
  };
}

function validateTutorialFormation(gameState = {}, options = {}) {
  const tutorial = gameState.tutorial || {};
  if (tutorial.completed || tutorial.disabled) return { success: true, formation: getFormationSnapshot(gameState, options) };
  const step = Math.floor(Number(tutorial.currentStep) || 0);
  if (step < TUTORIAL_STEPS.scoutFormationSaved) {
    return { success: false, error: 'EXPLORE_TUTORIAL_LOCKED', message: 'Please finish the scout formation guide before exploring.' };
  }
  if (step >= TUTORIAL_STEPS.scoutExploreClaimed) return { success: true, formation: getFormationSnapshot(gameState, options) };
  const scoutPersonId = getTutorialScoutPersonId(gameState);
  const formation = getFormationSnapshot(gameState, options);
  if (!scoutPersonId || !formation.memberIds.includes(scoutPersonId)) {
    return { success: false, error: 'EXPLORE_TUTORIAL_FORMATION_REQUIRED', message: 'Please keep the tutorial scout famous person in formation 1 before exploring.' };
  }
  return { success: true, formation };
}

function ensureTutorialFirstCityClaimSoldiers(gameState = {}) {
  const tutorial = gameState.tutorial || {};
  if (tutorial.completed || tutorial.disabled) return false;
  const step = Math.floor(Number(tutorial.currentStep) || 0);
  if (step < TUTORIAL_STEPS.scoutExploreClaimed || step >= TUTORIAL_STEPS.firstCityConquestStarted) return false;
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
  gameState.military = military;
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
  advanceTutorialStep,
  getTutorialScoutPersonId,
  getFormationSnapshot,
  validateTutorialFormation,
  ensureTutorialFirstCityClaimSoldiers,
};
