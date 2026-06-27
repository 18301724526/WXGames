const { normalizeTutorialState } = require('./TutorialState');

const SCOUT_FAMOUS_GRANT_KEY = 'scoutFamousPerson';

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

function getTutorialScoutPersonId(gameState = {}) {
  const tutorial = normalizeTutorialState(gameState.tutorial);
  return tutorial.grants?.[SCOUT_FAMOUS_GRANT_KEY]?.personId
    ? String(tutorial.grants[SCOUT_FAMOUS_GRANT_KEY].personId)
    : '';
}

function getFormationSnapshot(gameState = {}, payload = {}) {
  const cityId = String(payload.cityId || gameState.activeCityId || 'capital').trim() || 'capital';
  const slot = Math.max(1, Math.min(3, Math.floor(Number(payload.formationSlot ?? payload.slot ?? 1) || 1)));
  const directFormations = gameState.military?.formations?.[cityId];
  const cityFormations = gameState.cities?.[cityId]?.military?.formations?.[cityId];
  const formations = Array.isArray(directFormations)
    ? directFormations
    : Array.isArray(cityFormations)
      ? cityFormations
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
  getBuildingLevel,
  hasBuiltHouse,
  hasBuiltFarm,
  canAffordLumbermill,
  getTutorialScoutPersonId,
  getFormationSnapshot,
  getFormationMembers,
  hasTutorialScoutFormation,
  getTutorialFirstEmptyCityId,
  getTerritoryById,
};
