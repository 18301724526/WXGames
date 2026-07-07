const WorldMapService = require('../WorldMapService');
const { toInteger } = require('../../../shared/numberUtils');

function toDiscoveredNeutralTerritory(city = {}) {
  if (!city || typeof city !== 'object' || !city.id) return null;
  const q = toInteger(city.x ?? city.q, 0);
  const r = toInteger(city.y ?? city.r, 0);
  return {
    id: city.id,
    x: q,
    y: r,
    owner: 'neutral',
    type: city.type,
    status: 'discovered',
    scale: city.scale,
    naturalName: city.naturalName,
    mapTerrain: city.mapTerrain,
  };
}

function materializeDiscoveredNeutralCity(gameState = {}, city = {}, now = new Date()) {
  const territory = toDiscoveredNeutralTerritory(city);
  if (!territory) return null;

  const territories = Array.isArray(gameState.territories) ? gameState.territories : [];
  const existingIndex = territories.findIndex((item) => item && item.id === territory.id);
  if (existingIndex >= 0) {
    gameState.territories = territories.map((item, index) => (
      index === existingIndex ? { ...item, status: 'discovered' } : item
    ));
  } else {
    gameState.territories = [...territories, territory];
  }

  const tile = WorldMapService.bindSiteToTile(gameState, territory.x, territory.y, territory.id, now, {
    visibility: 'scouted',
  });
  WorldMapService.recordVisionSource(gameState, { kind: 'city', q: territory.x, r: territory.y }, now);
  return { city: territory, tile };
}

module.exports = {
  materializeDiscoveredNeutralCity,
  toDiscoveredNeutralTerritory,
};
