const {
  MAX_NAME_LENGTH,
  SITE_ART,
} = require('./TerritoryConstants');

function createInitialPolity() {
  return {
    name: null,
    namePrompted: false,
    capitalCityName: '首都',
    color: '#d9a441',
  };
}

function createCapital(now = new Date().toISOString()) {
  return {
    id: 'capital',
    x: 0,
    y: 0,
    naturalName: '起源之地',
    cityName: '首都',
    type: 'capital',
    owner: 'player',
    status: 'occupied',
    scale: 3,
    threat: 0,
    defense: 0,
    recommendedSoldiers: 0,
    art: SITE_ART.capital,
    visualOffset: { x: 0, y: 0 },
    discoveredAt: now,
    occupiedAt: now,
    effects: {},
    summary: '你的文明从这里点燃第一簇火种。',
    lastBattle: null,
  };
}

function createInitialTerritories(now = new Date().toISOString()) {
  return [createCapital(now)];
}

function normalizePolity(rawPolity) {
  const raw = rawPolity && typeof rawPolity === 'object' ? rawPolity : {};
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, MAX_NAME_LENGTH) : null,
    namePrompted: Boolean(raw.namePrompted),
    capitalCityName: typeof raw.capitalCityName === 'string' && raw.capitalCityName.trim()
      ? raw.capitalCityName.trim().slice(0, MAX_NAME_LENGTH)
      : '首都',
    color: typeof raw.color === 'string' && raw.color.trim() ? raw.color.trim() : '#d9a441',
  };
}

module.exports = {
  createCapital,
  createInitialPolity,
  createInitialTerritories,
  normalizePolity,
};
