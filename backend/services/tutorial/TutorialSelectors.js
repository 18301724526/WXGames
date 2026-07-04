const { TUTORIAL_STEPS, stepBefore } = require('../../../shared/tutorialFlowConfig');
const { normalizeTutorialState } = require('./TutorialState');
const buildingConfig = require('../../../shared/buildingConfig.json');

const SCOUT_FAMOUS_GRANT_KEY = 'scoutFamousPerson';
const FIRST_ARMY_GRANT_KEY = 'firstArmy';
const LUMBERMILL_BUILD_COST = buildingConfig?.buildings?.lumbermill?.buildCost || {
  food: 50,
  wood: 15,
};

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

function getActiveCityResources(gameState) {
  const cityId = gameState?.activeCityId || 'capital';
  const city = gameState?.cities?.[cityId] || gameState?.cities?.capital || null;
  // The persisted truth is city-scoped (cities[cityId].resources); the top-level
  // gameState.resources sibling is a legacy in-memory rebuild that reads as zeros on
  // normalized saves — reading it made this gate permanently false.
  return city?.resources || gameState?.resources || {};
}

function canAffordLumbermill(gameState) {
  const resources = getActiveCityResources(gameState);
  return (
    (Number(resources.food) || 0) >= (Number(LUMBERMILL_BUILD_COST.food) || 0) &&
    (Number(resources.wood) || 0) >= (Number(LUMBERMILL_BUILD_COST.wood) || 0)
  );
}

function getTutorialScoutPersonId(gameState = {}) {
  const tutorial = normalizeTutorialState(gameState.tutorial);
  return tutorial.grants?.[SCOUT_FAMOUS_GRANT_KEY]?.personId
    ? String(tutorial.grants[SCOUT_FAMOUS_GRANT_KEY].personId)
    : '';
}

function getFormationSnapshot(gameState = {}, payload = {}) {
  const cityId = String(payload.cityId || gameState.activeCityId || 'capital').trim() || 'capital';
  const slot = Math.max(1, Math.min(3, Math.floor(Number(payload.formationSlot ?? payload.slot ?? 1) || 1)));
  // Formation writes land on cities[cityId].military (setCityMilitary) whenever the
  // city slot exists; the top-level gameState.military is a stale/empty sibling copy
  // in that case. Resolve city-scoped FIRST (matching getCityMilitary precedence) so
  // the tutorial world-march gate reads the same formation the save wrote -- reading
  // the top-level copy first saw an empty formation and 403'd despite a deployed scout.
  const cityFormations = gameState.cities?.[cityId]?.military?.formations?.[cityId];
  const directFormations = gameState.military?.formations?.[cityId];
  const formations = Array.isArray(cityFormations)
    ? cityFormations
    : Array.isArray(directFormations)
      ? directFormations
      : [];
  const formation = formations.find((item) => Number(item?.slot) === slot) || formations[slot - 1] || null;
  return {
    ...(formation && typeof formation === 'object' ? formation : {}),
    cityId,
    slot,
    memberIds: Array.isArray(formation?.memberIds) ? formation.memberIds.map(String) : [],
  };
}

function getFormationMembers(gameState = {}, payload = {}) {
  return getFormationSnapshot(gameState, payload).memberIds;
}

function hasTutorialScoutFormation(gameState = {}, payload = {}) {
  const scoutPersonId = getTutorialScoutPersonId(gameState);
  if (!scoutPersonId) return false;
  return getFormationMembers(gameState, payload).includes(scoutPersonId);
}

// Reserve floor for the claimed first-army grant: while the formation guide is
// still running (before scoutFormationSaved) the granted soldiers must survive
// every normalizeMilitaryState clamp (barracks L1 cap is far below the grant).
// Returns 0 when no floor applies.
function getFirstArmyReserveFloor(gameState = {}) {
  const tutorial = normalizeTutorialState(gameState.tutorial);
  if (tutorial.completed || tutorial.disabled) return 0;
  const soldiers = Math.max(0, Math.floor(Number(tutorial.grants?.[FIRST_ARMY_GRANT_KEY]?.soldiers) || 0));
  if (!soldiers) return 0;
  if (!stepBefore(tutorial.currentStep, TUTORIAL_STEPS.scoutFormationSaved)) return 0;
  return soldiers;
}

function getTutorialFirstEmptyCityId(tutorialState = {}) {
  const tutorial = normalizeTutorialState(tutorialState);
  const siteId = tutorial.grants?.firstExploreEmptyCity?.siteId;
  return siteId ? String(siteId) : '';
}

function getTerritoryById(gameState = {}, territoryId = '') {
  const normalizedId = String(territoryId || '').trim();
  if (!normalizedId) return null;
  return (Array.isArray(gameState.territories) ? gameState.territories : [])
    .find((territory) => String(territory?.id || '') === normalizedId) || null;
}

module.exports = {
  SCOUT_FAMOUS_GRANT_KEY,
  FIRST_ARMY_GRANT_KEY,
  getBuildingLevel,
  hasBuiltHouse,
  hasBuiltFarm,
  canAffordLumbermill,
  getTutorialScoutPersonId,
  getFirstArmyReserveFloor,
  getFormationSnapshot,
  getFormationMembers,
  hasTutorialScoutFormation,
  getTutorialFirstEmptyCityId,
  getTerritoryById,
};
