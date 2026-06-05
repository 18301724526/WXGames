const BuildingConfig = require('../../config/BuildingConfig');
const { getAdvanceConfig } = require('../../config/EraConfig');
const FamousPersonService = require('../FamousPersonService');
const { TUTORIAL_STEPS } = require('../../config/TutorialFlowConfig');
const { normalizeTutorialState, nowIso } = require('./TutorialState');
const { manualAdvance } = require('./TutorialProgression');
const {
  SCOUT_FAMOUS_GRANT_KEY,
  hasBuiltHouse,
} = require('./TutorialSelectors');

const HOUSE_GUIDE_GRANT_KEY = 'houseGuideSupplies';

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

module.exports = {
  HOUSE_GUIDE_GRANT_KEY,
  ensureHouseGuideResources,
  ensureLumbermillGuideResources,
  ensureScoutFamousPersonGrant,
  getHouseGuideMinimumResources,
};
