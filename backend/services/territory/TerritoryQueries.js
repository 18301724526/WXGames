const {
  MAX_SCOUT_DISTANCE,
  SCOUT_SITE_MIN_DISTANCE,
} = require('./TerritoryConstants');
const {
  getRelativeDistance,
  toInteger,
} = require('./TerritoryShared');

function createTerritoryQueries() {
  function getTerritory(gameState, territoryId) {
    return (gameState.territories || []).find((territory) => territory.id === territoryId) || null;
  }

  function getCapitalTerritory(gameState) {
    return getTerritory(gameState, 'capital') || {
      id: 'capital',
      x: 0,
      y: 0,
      cityName: '首都',
      naturalName: '首都',
      status: 'occupied',
    };
  }

  function getTerritoryForCity(gameState, cityId = gameState?.activeCityId || 'capital') {
    const normalizedCityId = cityId || 'capital';
    const city = gameState?.cities?.[normalizedCityId] || null;
    const territoryId = city?.territoryId || normalizedCityId;
    const territory = (gameState?.territories || []).find((item) => (
      item.id === territoryId || item.id === normalizedCityId
    ));
    if (territory && territory.status === 'occupied') return territory;
    return getCapitalTerritory(gameState);
  }

  function getScoutOrigin(gameState) {
    const activeCityId = gameState?.activeCityId || 'capital';
    const city = gameState?.cities?.[activeCityId] || null;
    const territory = getTerritoryForCity(gameState, activeCityId);
    return {
      cityId: city?.id || activeCityId,
      territoryId: territory.id || 'capital',
      name: city?.name || territory.cityName || territory.naturalName || '首都',
      x: toInteger(territory.x, 0),
      y: toInteger(territory.y, 0),
    };
  }

  function getTerritoryEffects(gameState) {
    const effects = {
      foodOutputMultiplier: 0,
      woodOutputMultiplier: 0,
      knowledgeOutputMultiplier: 0,
      threatDefense: 0,
    };
    for (const territory of gameState.territories || []) {
      if (territory.status !== 'occupied') continue;
      const territoryEffects = territory.effects || {};
      effects.foodOutputMultiplier += territoryEffects.foodOutputMultiplier || 0;
      effects.woodOutputMultiplier += territoryEffects.woodOutputMultiplier || 0;
      effects.knowledgeOutputMultiplier += territoryEffects.knowledgeOutputMultiplier || 0;
      effects.threatDefense += territoryEffects.threatDefense || 0;
    }
    return effects;
  }

  function getNearestSiteDistance(gameState, x, y) {
    const distances = (gameState.territories || [])
      .filter((territory) => Number.isFinite(Number(territory?.x)) && Number.isFinite(Number(territory?.y)))
      .map((territory) => getRelativeDistance(territory.x, territory.y, x, y));
    if (!distances.length) return MAX_SCOUT_DISTANCE;
    return Math.min(...distances);
  }

  function getSiteSpacingProfile(gameState, x, y) {
    const nearestDistance = getNearestSiteDistance(gameState, x, y);
    const valid = nearestDistance >= SCOUT_SITE_MIN_DISTANCE;
    return {
      valid,
      nearestDistance,
      score: valid
        ? Math.min(20, Math.max(0, nearestDistance - SCOUT_SITE_MIN_DISTANCE + 1) * 5)
        : -100,
    };
  }

  function hasSiteSpacing(gameState, x, y) {
    return getSiteSpacingProfile(gameState, x, y).valid;
  }

  return {
    getCapitalTerritory,
    getNearestSiteDistance,
    getScoutOrigin,
    getSiteSpacingProfile,
    getTerritory,
    getTerritoryEffects,
    getTerritoryForCity,
    hasSiteSpacing,
  };
}

module.exports = createTerritoryQueries;
