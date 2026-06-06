const {
  MAX_NAME_LENGTH,
} = require('./TerritoryConstants');

function createTerritoryNaming(dependencies = {}) {
  const {
    getTerritory,
  } = dependencies;

  function getOccupiedCount(gameState) {
    return (gameState.territories || []).filter((territory) => territory.status === 'occupied').length;
  }

  function getPendingCityNamingTerritory(gameState) {
    return (gameState.territories || []).find((territory) => territory.status === 'occupied' && !territory.cityName) || null;
  }

  function getNamingPrompt(gameState) {
    const city = getPendingCityNamingTerritory(gameState);
    if (city) {
      return {
        type: 'city',
        territoryId: city.id,
        title: '\u4e3a\u65b0\u57ce\u5e02\u547d\u540d',
        message: `\u4f60\u5df2\u7ecf\u63a7\u5236${city.naturalName}\uff0c\u4e3a\u8fd9\u5ea7\u65b0\u57ce\u5e02\u53d6\u4e2a\u540d\u5b57\u5427\u3002`,
      };
    }
    if (getOccupiedCount(gameState) >= 2 && !gameState.polity?.name) {
      return {
        type: 'polity',
        title: '\u4e3a\u52bf\u529b\u547d\u540d',
        message: '\u4f60\u7684\u65d7\u5e1c\u5df2\u7ecf\u8d8a\u8fc7\u6700\u521d\u7684\u8fb9\u754c\u3002\u4e3a\u8fd9\u7247\u65b0\u5174\u52bf\u529b\u53d6\u4e00\u4e2a\u540d\u5b57\u5427\u3002',
      };
    }
    return null;
  }

  function sanitizeName(name) {
    const value = typeof name === 'string' ? name.trim() : '';
    if (!value) return null;
    return value.slice(0, MAX_NAME_LENGTH);
  }

  function renameCity(gameState, territoryId, cityName) {
    const name = sanitizeName(cityName);
    if (!name) return { success: false, error: 'INVALID_NAME', message: '\u8bf7\u8f93\u5165\u57ce\u5e02\u540d' };
    const territory = getTerritory(gameState, territoryId);
    if (!territory) return { success: false, error: 'TERRITORY_NOT_FOUND', message: '\u5730\u70b9\u4e0d\u5b58\u5728' };
    if (territory.status !== 'occupied') return { success: false, error: 'TERRITORY_NOT_OCCUPIED', message: '\u53ea\u80fd\u547d\u540d\u5df2\u63a7\u5236\u57ce\u5e02' };
    territory.cityName = name;
    if (territory.id === 'capital') gameState.polity.capitalCityName = name;
    return { success: true, message: `\u57ce\u5e02\u5df2\u547d\u540d\u4e3a${name}`, territory, namingPrompt: getNamingPrompt(gameState) };
  }

  function renamePolity(gameState, polityName) {
    const name = sanitizeName(polityName);
    if (!name) return { success: false, error: 'INVALID_NAME', message: '\u8bf7\u8f93\u5165\u52bf\u529b\u540d' };
    if (getOccupiedCount(gameState) < 2) return { success: false, error: 'POLITY_NOT_READY', message: '\u81f3\u5c11\u63a7\u5236\u7b2c\u4e8c\u5904\u5730\u70b9\u540e\u624d\u80fd\u547d\u540d\u52bf\u529b' };
    gameState.polity.name = name;
    gameState.polity.namePrompted = true;
    return { success: true, message: `\u52bf\u529b\u5df2\u547d\u540d\u4e3a${name}`, polity: gameState.polity, namingPrompt: getNamingPrompt(gameState) };
  }

  return {
    getNamingPrompt,
    getOccupiedCount,
    getPendingCityNamingTerritory,
    renameCity,
    renamePolity,
    sanitizeName,
  };
}

module.exports = createTerritoryNaming;
