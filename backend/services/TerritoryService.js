const MISSION_DURATION_MS = 2 * 60 * 1000;
const MAX_NAME_LENGTH = 12;

const TERRITORY_DEFINITIONS = [
  {
    id: 'capital',
    naturalName: '起源之地',
    defaultCityName: '首都',
    type: 'capital',
    status: 'occupied',
    defense: 0,
    recommendedSoldiers: 0,
    art: 'assets/art/territory-capital-cutout.png',
    effects: {},
  },
  {
    id: 'river_plain',
    naturalName: '河湾平原',
    type: 'plains',
    status: 'scoutable',
    defense: 4,
    recommendedSoldiers: 4,
    art: 'assets/art/territory-plains-cutout.png',
    effects: { foodOutputMultiplier: 0.05 },
  },
  {
    id: 'north_forest',
    naturalName: '北部林地',
    type: 'forest',
    status: 'locked',
    defense: 5,
    recommendedSoldiers: 5,
    art: 'assets/art/territory-forest-cutout.png',
    effects: { woodOutputMultiplier: 0.08 },
  },
  {
    id: 'hill_outpost',
    naturalName: '丘陵哨站',
    type: 'hills',
    status: 'locked',
    defense: 6,
    recommendedSoldiers: 6,
    art: 'assets/art/territory-hills-cutout.png',
    effects: { threatDefense: 2 },
  },
  {
    id: 'old_ruins',
    naturalName: '旧日遗迹',
    type: 'ruins',
    status: 'locked',
    defense: 7,
    recommendedSoldiers: 7,
    art: 'assets/art/territory-ruins-cutout.png',
    effects: { knowledgeOutputMultiplier: 0.06 },
  },
];

const DEFINITION_BY_ID = TERRITORY_DEFINITIONS.reduce((acc, definition) => {
  acc[definition.id] = definition;
  return acc;
}, {});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInitialPolity() {
  return {
    name: null,
    namePrompted: false,
    capitalCityName: '首都',
  };
}

function createTerritoryFromDefinition(definition, now = new Date().toISOString()) {
  return {
    id: definition.id,
    naturalName: definition.naturalName,
    cityName: definition.defaultCityName || null,
    type: definition.type,
    status: definition.status,
    defense: definition.defense,
    recommendedSoldiers: definition.recommendedSoldiers,
    art: definition.art,
    effects: clone(definition.effects || {}),
    scoutedAt: definition.status === 'occupied' ? now : null,
    occupiedAt: definition.status === 'occupied' ? now : null,
    lastBattle: null,
  };
}

function createInitialTerritories(now = new Date().toISOString()) {
  return TERRITORY_DEFINITIONS.map((definition) => createTerritoryFromDefinition(definition, now));
}

function normalizePolity(rawPolity) {
  const raw = rawPolity && typeof rawPolity === 'object' ? rawPolity : {};
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, MAX_NAME_LENGTH) : null,
    namePrompted: Boolean(raw.namePrompted),
    capitalCityName: typeof raw.capitalCityName === 'string' && raw.capitalCityName.trim()
      ? raw.capitalCityName.trim().slice(0, MAX_NAME_LENGTH)
      : '首都',
  };
}

function normalizeTerritory(rawTerritory, now = new Date().toISOString()) {
  const definition = DEFINITION_BY_ID[rawTerritory?.id];
  if (!definition) return null;
  const base = createTerritoryFromDefinition(definition, now);
  const status = ['locked', 'scoutable', 'scouted', 'contested', 'occupied'].includes(rawTerritory.status)
    ? rawTerritory.status
    : base.status;
  return {
    ...base,
    cityName: typeof rawTerritory.cityName === 'string' && rawTerritory.cityName.trim()
      ? rawTerritory.cityName.trim().slice(0, MAX_NAME_LENGTH)
      : base.cityName,
    status,
    scoutedAt: rawTerritory.scoutedAt || base.scoutedAt,
    occupiedAt: rawTerritory.occupiedAt || base.occupiedAt,
    lastBattle: rawTerritory.lastBattle || null,
  };
}

function normalizeWarMissions(rawMissions) {
  return (Array.isArray(rawMissions) ? rawMissions : [])
    .filter((mission) => mission && typeof mission === 'object')
    .filter((mission) => DEFINITION_BY_ID[mission.territoryId])
    .map((mission) => ({
      id: mission.id || `mission_${mission.territoryId}_${Date.now()}`,
      territoryId: mission.territoryId,
      soldiersCommitted: Math.max(0, Math.floor(Number(mission.soldiersCommitted) || 0)),
      startedAt: mission.startedAt || new Date().toISOString(),
      completesAt: mission.completesAt || new Date().toISOString(),
      status: mission.status === 'ready' ? 'ready' : 'active',
    }));
}

function applyUnlockRules(territories, currentEra) {
  const byId = Object.fromEntries(territories.map((territory) => [territory.id, territory]));
  if ((currentEra || 0) < 5) return territories;
  if (byId.river_plain?.status === 'locked') byId.river_plain.status = 'scoutable';
  if (byId.river_plain?.status === 'occupied') {
    for (const id of ['north_forest', 'hill_outpost']) {
      if (byId[id]?.status === 'locked') byId[id].status = 'scoutable';
    }
  }
  if (byId.north_forest?.status === 'occupied' || byId.hill_outpost?.status === 'occupied') {
    if (byId.old_ruins?.status === 'locked') byId.old_ruins.status = 'scoutable';
  }
  return territories;
}

function normalizeTerritoryState(gameState, now = new Date()) {
  const isoNow = now.toISOString();
  const known = new Map();
  for (const item of Array.isArray(gameState.territories) ? gameState.territories : []) {
    const normalized = normalizeTerritory(item, isoNow);
    if (normalized) known.set(normalized.id, normalized);
  }
  const territories = TERRITORY_DEFINITIONS.map((definition) => known.get(definition.id) || createTerritoryFromDefinition(definition, isoNow));
  gameState.territories = applyUnlockRules(territories, gameState.currentEra);
  gameState.polity = normalizePolity(gameState.polity);
  gameState.warMissions = normalizeWarMissions(gameState.warMissions);
  updateMissionReadiness(gameState, now);
  return gameState;
}

function getTerritory(gameState, territoryId) {
  return (gameState.territories || []).find((territory) => territory.id === territoryId) || null;
}

function getActiveMissionForTerritory(gameState, territoryId) {
  return (gameState.warMissions || []).find((mission) => mission.territoryId === territoryId && ['active', 'ready'].includes(mission.status)) || null;
}

function countSoldiersOnMission(gameState) {
  return (gameState.warMissions || []).reduce((sum, mission) => {
    if (!['active', 'ready'].includes(mission.status)) return sum;
    return sum + (mission.soldiersCommitted || 0);
  }, 0);
}

function getAvailableSoldiers(gameState) {
  return Math.max(0, Math.floor(gameState.military?.soldiers || 0) - countSoldiersOnMission(gameState));
}

function updateMissionReadiness(gameState, now = new Date()) {
  const nowMs = now.getTime();
  for (const mission of gameState.warMissions || []) {
    if (mission.status === 'active' && new Date(mission.completesAt).getTime() <= nowMs) {
      mission.status = 'ready';
    }
  }
  return gameState.warMissions;
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

function getOccupiedCount(gameState) {
  return (gameState.territories || []).filter((territory) => territory.status === 'occupied').length;
}

function getPendingCityNamingTerritory(gameState) {
  return (gameState.territories || []).find((territory) => territory.status === 'occupied' && !territory.cityName) || null;
}

function getNamingPrompt(gameState) {
  const city = getPendingCityNamingTerritory(gameState);
  if (city) {
    return { type: 'city', territoryId: city.id, title: '为新城市命名', message: `你已经占领${city.naturalName}，为这座新城市取个名字吧。` };
  }
  if (getOccupiedCount(gameState) >= 2 && !gameState.polity?.name) {
    return {
      type: 'polity',
      title: '为势力命名',
      message: '你的旗帜已经越过最初的边界。为这片新兴势力取一个名字吧。',
    };
  }
  return null;
}

function sanitizeName(name) {
  const value = typeof name === 'string' ? name.trim() : '';
  if (!value) return null;
  return value.slice(0, MAX_NAME_LENGTH);
}

function scoutTerritory(gameState, territoryId, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  if ((gameState.currentEra || 0) < 5) return { success: false, error: 'ERA_NOT_UNLOCKED', message: '古典时代后才能侦察疆域' };
  const territory = getTerritory(gameState, territoryId);
  if (!territory) return { success: false, error: 'TERRITORY_NOT_FOUND', message: '领土不存在' };
  if (territory.status !== 'scoutable') return { success: false, error: 'TERRITORY_NOT_SCOUTABLE', message: '该领土暂时无法侦察' };
  territory.status = 'scouted';
  territory.scoutedAt = now.toISOString();
  return { success: true, message: `已侦察${territory.naturalName}`, territory };
}

function startConquest(gameState, territoryId, soldiers, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  if ((gameState.currentEra || 0) < 5) return { success: false, error: 'ERA_NOT_UNLOCKED', message: '古典时代后才能发起占领' };
  const territory = getTerritory(gameState, territoryId);
  if (!territory) return { success: false, error: 'TERRITORY_NOT_FOUND', message: '领土不存在' };
  if (territory.status !== 'scouted') return { success: false, error: 'TERRITORY_NOT_SCOUTED', message: '请先侦察该领土' };
  if (getActiveMissionForTerritory(gameState, territoryId)) return { success: false, error: 'MISSION_EXISTS', message: '该领土已有进行中的军事行动' };
  const committed = Math.max(1, Math.floor(Number(soldiers) || territory.recommendedSoldiers || 1));
  if (committed > getAvailableSoldiers(gameState)) return { success: false, error: 'INSUFFICIENT_SOLDIERS', message: '可用士兵不足' };
  const mission = {
    id: `mission_${territoryId}_${now.getTime()}`,
    territoryId,
    soldiersCommitted: committed,
    startedAt: now.toISOString(),
    completesAt: new Date(now.getTime() + MISSION_DURATION_MS).toISOString(),
    status: 'active',
  };
  gameState.warMissions = [...(gameState.warMissions || []), mission];
  territory.status = 'contested';
  return { success: true, message: `已派出 ${committed} 名士兵前往${territory.naturalName}`, mission };
}

function resolveMission(gameState, mission, territory, now = new Date()) {
  const success = mission.soldiersCommitted >= territory.defense;
  const casualties = success
    ? Math.min(Math.max(0, mission.soldiersCommitted - 1), Math.floor(territory.defense / 3))
    : Math.ceil(mission.soldiersCommitted / 2);
  gameState.military.soldiers = Math.max(0, Math.floor(gameState.military?.soldiers || 0) - casualties);
  territory.lastBattle = {
    resolvedAt: now.toISOString(),
    soldiersCommitted: mission.soldiersCommitted,
    casualties,
    success,
  };
  if (success) {
    territory.status = 'occupied';
    territory.occupiedAt = now.toISOString();
    territory.cityName = null;
  } else {
    territory.status = 'scouted';
  }
  return { success, casualties };
}

function claimConquest(gameState, territoryId, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  const territory = getTerritory(gameState, territoryId);
  if (!territory) return { success: false, error: 'TERRITORY_NOT_FOUND', message: '领土不存在' };
  const mission = getActiveMissionForTerritory(gameState, territoryId);
  if (!mission) return { success: false, error: 'MISSION_NOT_FOUND', message: '没有可完成的军事行动' };
  if (mission.status !== 'ready') return { success: false, error: 'MISSION_NOT_READY', message: '军事行动尚未完成' };
  const result = resolveMission(gameState, mission, territory, now);
  gameState.warMissions = (gameState.warMissions || []).filter((item) => item.id !== mission.id);
  applyUnlockRules(gameState.territories, gameState.currentEra);
  return {
    success: true,
    message: result.success ? `已占领${territory.naturalName}` : `${territory.naturalName}占领失败，士兵正在整队返回`,
    outcome: result.success ? 'success' : 'failure',
    casualties: result.casualties,
    territory,
    namingPrompt: getNamingPrompt(gameState),
  };
}

function renameCity(gameState, territoryId, cityName) {
  normalizeTerritoryState(gameState);
  const name = sanitizeName(cityName);
  if (!name) return { success: false, error: 'INVALID_NAME', message: '请输入城市名' };
  const territory = getTerritory(gameState, territoryId);
  if (!territory) return { success: false, error: 'TERRITORY_NOT_FOUND', message: '领土不存在' };
  if (territory.status !== 'occupied') return { success: false, error: 'TERRITORY_NOT_OCCUPIED', message: '只能命名已占领城市' };
  territory.cityName = name;
  if (territory.id === 'capital') gameState.polity.capitalCityName = name;
  return { success: true, message: `城市已命名为${name}`, territory, namingPrompt: getNamingPrompt(gameState) };
}

function renamePolity(gameState, polityName) {
  normalizeTerritoryState(gameState);
  const name = sanitizeName(polityName);
  if (!name) return { success: false, error: 'INVALID_NAME', message: '请输入势力名' };
  if (getOccupiedCount(gameState) < 2) return { success: false, error: 'POLITY_NOT_READY', message: '至少占领第二块领土后才能命名势力' };
  gameState.polity.name = name;
  gameState.polity.namePrompted = true;
  return { success: true, message: `势力已命名为${name}`, polity: gameState.polity, namingPrompt: getNamingPrompt(gameState) };
}

function getClientTerritoryState(gameState) {
  updateMissionReadiness(gameState);
  const missionsByTerritory = Object.fromEntries((gameState.warMissions || []).map((mission) => [mission.territoryId, mission]));
  return {
    polity: gameState.polity || createInitialPolity(),
    territories: (gameState.territories || []).map((territory) => ({
      ...territory,
      mission: missionsByTerritory[territory.id] || null,
    })),
    warMissions: gameState.warMissions || [],
    availableSoldiers: getAvailableSoldiers(gameState),
    soldiersOnMission: countSoldiersOnMission(gameState),
    occupiedCount: getOccupiedCount(gameState),
    territoryEffects: getTerritoryEffects(gameState),
    namingPrompt: getNamingPrompt(gameState),
    missionDurationSeconds: Math.floor(MISSION_DURATION_MS / 1000),
  };
}

module.exports = {
  TERRITORY_DEFINITIONS,
  MISSION_DURATION_MS,
  createInitialPolity,
  createInitialTerritories,
  normalizeTerritoryState,
  getTerritoryEffects,
  getAvailableSoldiers,
  countSoldiersOnMission,
  getClientTerritoryState,
  scoutTerritory,
  startConquest,
  claimConquest,
  renameCity,
  renamePolity,
  updateMissionReadiness,
};
