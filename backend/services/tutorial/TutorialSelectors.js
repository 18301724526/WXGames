const { TUTORIAL_STEPS, stepBefore } = require('../../../shared/tutorialFlowConfig');
const { normalizeTutorialState } = require('./TutorialState');
const TaskRewardGrantLedger = require('../taskCenter/TaskRewardGrantLedger');
const buildingConfig = require('../../../shared/buildingConfig.json');

const {
  SCOUT_FAMOUS_GRANT_KEY,
  FIRST_ARMY_GRANT_KEY,
} = TaskRewardGrantLedger;
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
  const grant = TaskRewardGrantLedger.getFamousPersonGrant(gameState, SCOUT_FAMOUS_GRANT_KEY);
  return grant?.personId ? String(grant.personId) : '';
}

function getFormationSnapshot(gameState = {}, payload = {}) {
  const cityId = String(payload.cityId || gameState.activeCityId || 'capital').trim() || 'capital';
  const slot = Math.max(1, Math.min(3, Math.floor(Number(payload.formationSlot ?? payload.slot ?? 1) || 1)));
  // The owned shape is a plain 3-slot array on the city's military (the top-level
  // gameState.military is an alias of the active city). The map arms only migrate
  // legacy double-keyed saves on read.
  const rawFormations =
    gameState.cities?.[cityId]?.military?.formations ?? gameState.military?.formations;
  const formations = Array.isArray(rawFormations)
    ? rawFormations
    : rawFormations && typeof rawFormations === 'object'
      ? rawFormations[cityId] || rawFormations.capital || []
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
  const grant = TaskRewardGrantLedger.getSoldierGrant(gameState, FIRST_ARMY_GRANT_KEY);
  const soldiers = Math.max(0, Math.floor(Number(grant?.soldiers) || 0));
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
