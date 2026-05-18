const SCOUT_DURATION_MS = 60 * 1000;
const CONQUEST_DURATION_MS = 2 * 60 * 1000;
const MAX_NAME_LENGTH = 12;
const MAX_REPORTS = 12;
const MAX_SCOUT_DISTANCE = 24;
const MAX_ACTIVE_SCOUTS = 2;
const SCOUT_EMPTY_CHANCE = 0.35;
const SCOUT_EMPTY_STREAK_GUARANTEE = 2;

const DIRECTIONS = {
  n: { label: '北方', dx: 0, dy: -1 },
  ne: { label: '东北', dx: 1, dy: -1 },
  e: { label: '东方', dx: 1, dy: 0 },
  se: { label: '东南', dx: 1, dy: 1 },
  s: { label: '南方', dx: 0, dy: 1 },
  sw: { label: '西南', dx: -1, dy: 1 },
  w: { label: '西方', dx: -1, dy: 0 },
  nw: { label: '西北', dx: -1, dy: -1 },
};

const SITE_ART = {
  capital: 'assets/art/world-site-city-cutout.png',
  outpost: 'assets/art/world-site-outpost-cutout.png',
  town: 'assets/art/world-site-town-cutout.png',
  camp: 'assets/art/world-site-camp-cutout.png',
  ruins: 'assets/art/world-site-ruins-cutout.png',
};

function roundOffset(value) {
  return Math.round(value * 100) / 100;
}

function seededNoise(seed) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function createVisualOffset(x, y, seedHint = '') {
  if (x === 0 && y === 0) return { x: 0, y: 0 };
  const seed = Math.abs((x * 92821) + (y * 68917) + String(seedHint).length * 131);
  const distance = Math.max(1, Math.max(Math.abs(x), Math.abs(y)));
  const lateralX = (seededNoise(seed + 11) - 0.5) * 0.44;
  const lateralY = (seededNoise(seed + 23) - 0.5) * 0.44;
  const radial = (seededNoise(seed + 37) - 0.5) * 0.22;
  return {
    x: roundOffset(lateralX + (x / distance) * radial),
    y: roundOffset(lateralY + (y / distance) * radial),
  };
}

function normalizeVisualOffset(rawOffset, x, y, seedHint = '') {
  if (rawOffset && typeof rawOffset === 'object') {
    const offsetX = Number(rawOffset.x);
    const offsetY = Number(rawOffset.y);
    if (Number.isFinite(offsetX) && Number.isFinite(offsetY)) {
      return {
        x: roundOffset(Math.max(-0.55, Math.min(0.55, offsetX))),
        y: roundOffset(Math.max(-0.55, Math.min(0.55, offsetY))),
      };
    }
  }
  return createVisualOffset(x, y, seedHint);
}

const SITE_TEMPLATES = [
  {
    type: 'outpost',
    owner: 'neutral',
    scale: 1,
    threat: 1,
    defense: 3,
    recommendedSoldiers: 3,
    naturalNames: ['河畔前哨', '浅丘据点', '旧猎道营地', '荒原木寨'],
    summaries: [
      '几户猎人与木栅围起了临时营地，尚未形成稳固势力。',
      '侦察队发现一处低矮据点，火塘仍在冒烟，守备并不严密。',
    ],
    reportTitles: ['边界外的第一缕炊烟', '木栅后的陌生脚印'],
    effects: { threatDefense: 1 },
  },
  {
    type: 'town',
    owner: 'neutral',
    scale: 2,
    threat: 2,
    defense: 4,
    recommendedSoldiers: 4,
    naturalNames: ['河湾村镇', '石阶小城', '谷口集落', '渡口镇'],
    summaries: [
      '这里有稳定的屋舍和集市痕迹，适合成为新的城市据点。',
      '侦察队看见石墙、井台和整齐的道路，这里已经接近一座小城。',
    ],
    reportTitles: ['远处石墙上的旗影', '道路尽头的村镇'],
    effects: { foodOutputMultiplier: 0.05 },
  },
  {
    type: 'camp',
    owner: 'tribe',
    scale: 2,
    threat: 4,
    defense: 5,
    recommendedSoldiers: 5,
    naturalNames: ['林地部落', '北风营帐', '山脚部族', '河曲部落'],
    summaries: [
      '多个帐篷围绕火塘而立，哨塔上有人持续观察外来者。',
      '这是一个组织严密的部落营地，木材和战士都不少。',
    ],
    reportTitles: ['营帐之间的警戒号角', '林地深处的部族火光'],
    effects: { woodOutputMultiplier: 0.08 },
  },
  {
    type: 'ruins',
    owner: 'neutral',
    scale: 1,
    threat: 5,
    defense: 6,
    recommendedSoldiers: 6,
    naturalNames: ['旧日遗迹', '断柱废墟', '沉默神殿', '古道残垣'],
    summaries: [
      '破碎石柱间刻着陌生纹路，那里可能藏着旧时代的知识。',
      '废墟周围很安静，但侦察队认为这里并不安全。',
    ],
    reportTitles: ['断柱下的古老刻痕', '沉默废墟中的回声'],
    effects: { knowledgeOutputMultiplier: 0.06 },
  },
];

const LEGACY_SITE_MIGRATIONS = {
  river_plain: { x: 1, y: 0, type: 'town', owner: 'neutral' },
  north_forest: { x: 0, y: -1, type: 'camp', owner: 'tribe' },
  hill_outpost: { x: -1, y: 0, type: 'outpost', owner: 'neutral' },
  old_ruins: { x: 1, y: -1, type: 'ruins', owner: 'neutral' },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function getDistance(x, y) {
  return Math.max(Math.abs(x), Math.abs(y));
}

function getCoordinateKey(x, y) {
  return `${x},${y}`;
}

function isLegacyPresetTerritory(rawTerritory) {
  return Boolean(LEGACY_SITE_MIGRATIONS[rawTerritory?.id]);
}

function migrateLegacyPresetTerritory(rawTerritory) {
  if (!isLegacyPresetTerritory(rawTerritory)) return rawTerritory;
  if (!['scouted', 'contested', 'occupied'].includes(rawTerritory.status)) return null;
  const migration = LEGACY_SITE_MIGRATIONS[rawTerritory.id];
  return {
    ...rawTerritory,
    x: migration.x,
    y: migration.y,
    type: migration.type,
    owner: rawTerritory.status === 'occupied' ? 'player' : migration.owner,
    status: rawTerritory.status === 'scouted' ? 'discovered' : rawTerritory.status,
    art: SITE_ART[migration.type],
  };
}

function normalizeTerritory(rawTerritory, now = new Date().toISOString()) {
  if (!rawTerritory || typeof rawTerritory !== 'object') return null;
  const migratedTerritory = migrateLegacyPresetTerritory(rawTerritory);
  if (!migratedTerritory) return null;
  rawTerritory = migratedTerritory;
  if (rawTerritory.id === 'capital') {
    return {
      ...createCapital(now),
      cityName: typeof rawTerritory.cityName === 'string' && rawTerritory.cityName.trim()
        ? rawTerritory.cityName.trim().slice(0, MAX_NAME_LENGTH)
        : '首都',
      discoveredAt: rawTerritory.discoveredAt || rawTerritory.scoutedAt || now,
      occupiedAt: rawTerritory.occupiedAt || now,
      lastBattle: rawTerritory.lastBattle || null,
    };
  }

  const x = toInteger(rawTerritory.x, 0);
  const y = toInteger(rawTerritory.y, 0);
  if (x === 0 && y === 0) return null;
  const type = SITE_ART[rawTerritory.type] ? rawTerritory.type : 'outpost';
  const status = ['discovered', 'contested', 'occupied'].includes(rawTerritory.status)
    ? rawTerritory.status
    : rawTerritory.status === 'scouted'
      ? 'discovered'
      : 'discovered';
  const defense = Math.max(1, toInteger(rawTerritory.defense, Math.max(3, getDistance(x, y) + 2)));
  return {
    id: typeof rawTerritory.id === 'string' && rawTerritory.id ? rawTerritory.id : `site_${x}_${y}`,
    x,
    y,
    naturalName: typeof rawTerritory.naturalName === 'string' && rawTerritory.naturalName.trim()
      ? rawTerritory.naturalName.trim()
      : '未知地点',
    cityName: typeof rawTerritory.cityName === 'string' && rawTerritory.cityName.trim()
      ? rawTerritory.cityName.trim().slice(0, MAX_NAME_LENGTH)
      : null,
    type,
    owner: rawTerritory.owner || (status === 'occupied' ? 'player' : 'neutral'),
    status,
    scale: Math.max(1, toInteger(rawTerritory.scale, 1)),
    threat: Math.max(0, toInteger(rawTerritory.threat, defense - 2)),
    defense,
    recommendedSoldiers: Math.max(1, toInteger(rawTerritory.recommendedSoldiers, defense)),
    art: rawTerritory.art || SITE_ART[type],
    visualOffset: normalizeVisualOffset(rawTerritory.visualOffset, x, y, rawTerritory.id || rawTerritory.naturalName || type),
    discoveredAt: rawTerritory.discoveredAt || rawTerritory.scoutedAt || now,
    occupiedAt: status === 'occupied' ? rawTerritory.occupiedAt || now : rawTerritory.occupiedAt || null,
    effects: clone(rawTerritory.effects || {}),
    summary: rawTerritory.summary || '',
    lastBattle: rawTerritory.lastBattle || null,
  };
}

function normalizeWarMissions(rawMissions) {
  return (Array.isArray(rawMissions) ? rawMissions : [])
    .filter((mission) => mission && typeof mission === 'object')
    .map((mission) => {
      const kind = mission.kind === 'scout' || mission.action === 'scout' ? 'scout' : 'conquest';
      const status = mission.status === 'ready' ? 'ready' : 'active';
      if (kind === 'scout') {
        const direction = normalizeDirection(mission.direction);
        if (!direction) return null;
        return {
          id: mission.id || `scout_${direction}_${Date.now()}`,
          kind: 'scout',
          direction,
          targetX: toInteger(mission.targetX, 0),
          targetY: toInteger(mission.targetY, 0),
          startedAt: mission.startedAt || new Date().toISOString(),
          completesAt: mission.completesAt || new Date().toISOString(),
          status,
        };
      }
      if (!mission.territoryId) return null;
      return {
        id: mission.id || `conquest_${mission.territoryId}_${Date.now()}`,
        kind: 'conquest',
        territoryId: mission.territoryId,
        soldiersCommitted: Math.max(0, Math.floor(Number(mission.soldiersCommitted) || 0)),
        startedAt: mission.startedAt || new Date().toISOString(),
        completesAt: mission.completesAt || new Date().toISOString(),
        status,
      };
    })
    .filter(Boolean);
}

function normalizeScoutReports(rawReports) {
  return (Array.isArray(rawReports) ? rawReports : [])
    .filter((report) => report && typeof report === 'object')
    .slice(-MAX_REPORTS)
    .map((report) => ({
      id: report.id || `report_${Date.now()}`,
      siteId: report.siteId || null,
      title: report.title || '侦察报告',
      text: report.text || '',
      direction: normalizeDirection(report.direction) || null,
      createdAt: report.createdAt || new Date().toISOString(),
    }));
}

function normalizeScoutCoordinates(rawCoordinates) {
  const known = new Map();
  for (const coordinate of Array.isArray(rawCoordinates) ? rawCoordinates : []) {
    if (!coordinate || typeof coordinate !== 'object') continue;
    const x = toInteger(coordinate.x, 0);
    const y = toInteger(coordinate.y, 0);
    if (x === 0 && y === 0) continue;
    const result = coordinate.result === 'site' ? 'site' : coordinate.result === 'empty' ? 'empty' : null;
    if (!result) continue;
    const key = getCoordinateKey(x, y);
    known.set(key, {
      x,
      y,
      result,
      siteId: typeof coordinate.siteId === 'string' && coordinate.siteId ? coordinate.siteId : null,
      scoutedAt: coordinate.scoutedAt || new Date().toISOString(),
    });
  }
  return [...known.values()].sort((a, b) => getDistance(a.x, a.y) - getDistance(b.x, b.y));
}

function normalizeScoutState(rawState) {
  const raw = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    emptyStreak: Math.max(0, toInteger(raw.emptyStreak, 0)),
  };
}

function getScoutCoordinateRecord(gameState, x, y) {
  return (gameState.scoutedCoordinates || []).find((coordinate) => coordinate.x === x && coordinate.y === y) || null;
}

function upsertScoutCoordinateRecord(gameState, record) {
  const next = normalizeScoutCoordinates([...(gameState.scoutedCoordinates || []), record]);
  gameState.scoutedCoordinates = next;
  return getScoutCoordinateRecord(gameState, record.x, record.y);
}

function syncScoutCoordinatesWithTerritories(gameState, now = new Date().toISOString()) {
  for (const territory of gameState.territories || []) {
    if (territory.x === 0 && territory.y === 0) continue;
    upsertScoutCoordinateRecord(gameState, {
      x: territory.x,
      y: territory.y,
      result: 'site',
      siteId: territory.id,
      scoutedAt: territory.discoveredAt || now,
    });
  }
  return gameState.scoutedCoordinates;
}

function normalizeTerritoryState(gameState, now = new Date()) {
  const isoNow = now.toISOString();
  const known = new Map();
  for (const item of Array.isArray(gameState.territories) ? gameState.territories : []) {
    const normalized = normalizeTerritory(item, isoNow);
    if (normalized) known.set(normalized.id, normalized);
  }
  if (!known.has('capital')) known.set('capital', createCapital(isoNow));
  gameState.territories = [...known.values()]
    .sort((a, b) => (a.id === 'capital' ? -1 : b.id === 'capital' ? 1 : getDistance(a.x, a.y) - getDistance(b.x, b.y)));
  gameState.polity = normalizePolity(gameState.polity);
  gameState.warMissions = normalizeWarMissions(gameState.warMissions);
  gameState.scoutReports = normalizeScoutReports(gameState.scoutReports);
  gameState.scoutedCoordinates = normalizeScoutCoordinates(gameState.scoutedCoordinates);
  gameState.scoutState = normalizeScoutState(gameState.scoutState);
  syncScoutCoordinatesWithTerritories(gameState, isoNow);
  updateMissionReadiness(gameState, now);
  enforceScoutMissionLimit(gameState);
  return gameState;
}

function normalizeDirection(direction) {
  const key = String(direction || '').toLowerCase();
  return DIRECTIONS[key] ? key : null;
}

function getTerritory(gameState, territoryId) {
  return (gameState.territories || []).find((territory) => territory.id === territoryId) || null;
}

function getMissionKind(mission) {
  return mission.kind === 'scout' ? 'scout' : 'conquest';
}

function getScoutMissions(gameState) {
  return (gameState.warMissions || []).filter((mission) => getMissionKind(mission) === 'scout');
}

function getActiveScoutMission(gameState) {
  return getScoutMissions(gameState).find((mission) => mission.status === 'active') || null;
}

function countActiveScoutMissions(gameState) {
  return getScoutMissions(gameState).filter((mission) => mission.status === 'active').length;
}

function getActiveMissionForTerritory(gameState, territoryId) {
  return (gameState.warMissions || []).find((mission) => getMissionKind(mission) === 'conquest' && mission.territoryId === territoryId && ['active', 'ready'].includes(mission.status)) || null;
}

function countSoldiersOnMission(gameState) {
  return (gameState.warMissions || []).reduce((sum, mission) => {
    if (getMissionKind(mission) !== 'conquest' || !['active', 'ready'].includes(mission.status)) return sum;
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

function enforceScoutMissionLimit(gameState) {
  const missions = gameState.warMissions || [];
  const activeScouts = missions
    .filter((mission) => getMissionKind(mission) === 'scout' && mission.status === 'active')
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  if (activeScouts.length <= MAX_ACTIVE_SCOUTS) return missions;
  const keepIds = new Set(activeScouts.slice(0, MAX_ACTIVE_SCOUTS).map((mission) => mission.id));
  gameState.warMissions = missions.filter((mission) => getMissionKind(mission) !== 'scout' || mission.status !== 'active' || keepIds.has(mission.id));
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
    return { type: 'city', territoryId: city.id, title: '为新城市命名', message: `你已经控制${city.naturalName}，为这座新城市取个名字吧。` };
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

function findNextCoordinate(gameState, direction) {
  const dir = DIRECTIONS[direction];
  if (!dir) return null;
  const occupied = new Set((gameState.territories || []).map((territory) => getCoordinateKey(territory.x, territory.y)));
  const scouted = new Set((gameState.scoutedCoordinates || []).map((coordinate) => getCoordinateKey(coordinate.x, coordinate.y)));
  for (let distance = 1; distance <= MAX_SCOUT_DISTANCE; distance += 1) {
    const x = dir.dx * distance;
    const y = dir.dy * distance;
    const key = getCoordinateKey(x, y);
    if (!occupied.has(key) && !scouted.has(key)) return { x, y, distance };
  }
  return null;
}

function rollScoutOutcome(gameState, randomSource = Math.random) {
  gameState.scoutState = normalizeScoutState(gameState.scoutState);
  if ((gameState.scoutState.emptyStreak || 0) >= SCOUT_EMPTY_STREAK_GUARANTEE) {
    return 'site';
  }
  const roll = Math.max(0, Math.min(1, Number(typeof randomSource === 'function' ? randomSource() : Math.random()) || 0));
  return roll < SCOUT_EMPTY_CHANCE ? 'empty' : 'site';
}

function recordScoutOutcome(gameState, outcome) {
  gameState.scoutState = normalizeScoutState(gameState.scoutState);
  gameState.scoutState.emptyStreak = outcome === 'empty'
    ? (gameState.scoutState.emptyStreak || 0) + 1
    : 0;
  return gameState.scoutState.emptyStreak;
}

function pickTemplate(direction, distance, discoveredCount) {
  const index = (Object.keys(DIRECTIONS).indexOf(direction) + distance + discoveredCount) % SITE_TEMPLATES.length;
  if (distance <= 1) return SITE_TEMPLATES[index % 2];
  if (distance === 2) return SITE_TEMPLATES[(index % 3) + 1];
  return SITE_TEMPLATES[(index % 3) + 1];
}

function pickText(items, seed) {
  return items[Math.abs(seed) % items.length];
}

function getSiteEffects(template, distance) {
  const effects = clone(template.effects || {});
  if (effects.foodOutputMultiplier) effects.foodOutputMultiplier = Math.round((effects.foodOutputMultiplier + Math.max(0, distance - 1) * 0.01) * 100) / 100;
  if (effects.woodOutputMultiplier) effects.woodOutputMultiplier = Math.round((effects.woodOutputMultiplier + Math.max(0, distance - 1) * 0.01) * 100) / 100;
  if (effects.knowledgeOutputMultiplier) effects.knowledgeOutputMultiplier = Math.round((effects.knowledgeOutputMultiplier + Math.max(0, distance - 1) * 0.01) * 100) / 100;
  if (effects.threatDefense) effects.threatDefense += Math.max(0, Math.floor((distance - 1) / 2));
  return effects;
}

function createSiteFromScout(gameState, mission, now = new Date()) {
  const direction = mission.direction;
  const x = toInteger(mission.targetX, 0);
  const y = toInteger(mission.targetY, 0);
  const distance = getDistance(x, y);
  const discoveredCount = (gameState.territories || []).length;
  const template = pickTemplate(direction, distance, discoveredCount);
  const seed = Math.abs(x * 31 + y * 17 + discoveredCount * 13 + Object.keys(DIRECTIONS).indexOf(direction));
  const naturalName = pickText(template.naturalNames, seed);
  const title = pickText(template.reportTitles, seed + 1);
  const summary = pickText(template.summaries, seed + 2);
  const defense = template.defense + Math.max(0, distance - 1);
  const site = {
    id: `site_${x}_${y}`,
    x,
    y,
    naturalName,
    cityName: null,
    type: template.type,
    owner: template.owner,
    status: 'discovered',
    scale: Math.min(3, template.scale + Math.floor(Math.max(0, distance - 2) / 2)),
    threat: template.threat + Math.max(0, distance - 1),
    defense,
    recommendedSoldiers: Math.max(defense, template.recommendedSoldiers + Math.max(0, distance - 1)),
    art: SITE_ART[template.type],
    visualOffset: createVisualOffset(x, y, `${template.type}_${naturalName}_${discoveredCount}`),
    discoveredAt: now.toISOString(),
    occupiedAt: null,
    effects: getSiteEffects(template, distance),
    summary,
    lastBattle: null,
  };
  const report = {
    id: `report_${site.id}_${now.getTime()}`,
    siteId: site.id,
    title,
    text: `侦察队向${DIRECTIONS[direction].label}推进，在距离首都 ${distance} 格的位置发现了${naturalName}。${summary}`,
    direction,
    createdAt: now.toISOString(),
  };
  return { site, report };
}

function createEmptyScoutReport(mission, now = new Date(), repeated = false) {
  const direction = mission.direction;
  const x = toInteger(mission.targetX, 0);
  const y = toInteger(mission.targetY, 0);
  const distance = getDistance(x, y);
  const label = DIRECTIONS[direction]?.label || '远方';
  return {
    id: `report_empty_${x}_${y}_${now.getTime()}`,
    siteId: null,
    title: repeated ? '重复侦察确认空地' : '空地侦察报告',
    text: repeated
      ? `侦察队再次确认${label}距离首都 ${distance} 格的位置暂无可占领地点。`
      : `侦察队向${label}推进，在距离首都 ${distance} 格的位置未发现可建立据点或占领的目标。`,
    direction,
    createdAt: now.toISOString(),
  };
}

function startScout(gameState, direction, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  if ((gameState.currentEra || 0) < 5) return { success: false, error: 'ERA_NOT_UNLOCKED', message: '古典时代后才能侦察外部世界' };
  const normalizedDirection = normalizeDirection(direction);
  if (!normalizedDirection) return { success: false, error: 'INVALID_DIRECTION', message: '请选择有效侦察方向' };
  if (countActiveScoutMissions(gameState) >= MAX_ACTIVE_SCOUTS) {
    return { success: false, error: 'SCOUT_LIMIT_REACHED', message: `最多同时派出 ${MAX_ACTIVE_SCOUTS} 支侦察队` };
  }
  const existing = getScoutMissions(gameState).find((mission) => mission.direction === normalizedDirection && ['active', 'ready'].includes(mission.status));
  if (existing) return { success: false, error: 'SCOUT_EXISTS', message: `${DIRECTIONS[normalizedDirection].label}已有侦察任务` };
  const target = findNextCoordinate(gameState, normalizedDirection);
  if (!target) return { success: false, error: 'NO_SCOUT_TARGET', message: '该方向暂时没有可侦察区域' };
  const mission = {
    id: `scout_${normalizedDirection}_${now.getTime()}`,
    kind: 'scout',
    direction: normalizedDirection,
    targetX: target.x,
    targetY: target.y,
    startedAt: now.toISOString(),
    completesAt: new Date(now.getTime() + SCOUT_DURATION_MS).toISOString(),
    status: 'active',
  };
  gameState.warMissions = [...(gameState.warMissions || []), mission];
  return { success: true, message: `侦察队已向${DIRECTIONS[normalizedDirection].label}出发`, mission };
}

function claimScout(gameState, missionId, now = new Date(), randomSource = Math.random) {
  normalizeTerritoryState(gameState, now);
  const mission = (gameState.warMissions || []).find((item) => item.id === missionId && getMissionKind(item) === 'scout');
  if (!mission) return { success: false, error: 'MISSION_NOT_FOUND', message: '没有找到侦察任务' };
  if (mission.status !== 'ready') return { success: false, error: 'MISSION_NOT_READY', message: '侦察队尚未返回' };
  const exists = (gameState.territories || []).find((territory) => territory.x === mission.targetX && territory.y === mission.targetY);
  const coordinateRecord = getScoutCoordinateRecord(gameState, mission.targetX, mission.targetY);
  let site = exists;
  let report;

  if (exists) {
    report = {
      id: `report_${exists.id}_${now.getTime()}`,
      siteId: exists.id,
      title: '重复侦察',
      text: `侦察队重新确认了${exists.naturalName}周边的道路。`,
      direction: mission.direction,
      createdAt: now.toISOString(),
    };
  } else if (coordinateRecord?.result === 'empty') {
    report = createEmptyScoutReport(mission, now, true);
  } else {
    const outcome = coordinateRecord?.result || rollScoutOutcome(gameState, randomSource);
    if (outcome === 'empty') {
      recordScoutOutcome(gameState, 'empty');
      upsertScoutCoordinateRecord(gameState, {
        x: mission.targetX,
        y: mission.targetY,
        result: 'empty',
        siteId: null,
        scoutedAt: now.toISOString(),
      });
      report = createEmptyScoutReport(mission, now);
    } else {
      recordScoutOutcome(gameState, 'site');
      const created = createSiteFromScout(gameState, mission, now);
      site = created.site;
      report = created.report;
      gameState.territories.push(site);
      upsertScoutCoordinateRecord(gameState, {
        x: site.x,
        y: site.y,
        result: 'site',
        siteId: site.id,
        scoutedAt: site.discoveredAt || now.toISOString(),
      });
    }
  }
  gameState.scoutReports = [...(gameState.scoutReports || []), report].slice(-MAX_REPORTS);
  gameState.warMissions = (gameState.warMissions || []).filter((item) => item.id !== mission.id);
  return {
    success: true,
    message: site ? `侦察发现：${site.naturalName}` : '侦察结束：该处暂未发现可占领地点',
    site: site || null,
    report,
  };
}

function scoutTerritory(gameState, direction, now = new Date()) {
  return startScout(gameState, direction, now);
}

function startConquest(gameState, territoryId, soldiers, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  if ((gameState.currentEra || 0) < 5) return { success: false, error: 'ERA_NOT_UNLOCKED', message: '古典时代后才能发起占领' };
  const territory = getTerritory(gameState, territoryId);
  if (!territory) return { success: false, error: 'TERRITORY_NOT_FOUND', message: '地点不存在' };
  if (territory.status !== 'discovered') return { success: false, error: 'TERRITORY_NOT_DISCOVERED', message: '只能占领已发现且未控制的地点' };
  if (getActiveMissionForTerritory(gameState, territoryId)) return { success: false, error: 'MISSION_EXISTS', message: '该地点已有进行中的军事行动' };
  const committed = Math.max(1, Math.floor(Number(soldiers) || territory.recommendedSoldiers || 1));
  if (committed > getAvailableSoldiers(gameState)) return { success: false, error: 'INSUFFICIENT_SOLDIERS', message: '可用士兵不足' };
  const mission = {
    id: `conquest_${territoryId}_${now.getTime()}`,
    kind: 'conquest',
    territoryId,
    soldiersCommitted: committed,
    startedAt: now.toISOString(),
    completesAt: new Date(now.getTime() + CONQUEST_DURATION_MS).toISOString(),
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
    territory.owner = 'player';
    territory.occupiedAt = now.toISOString();
    territory.cityName = null;
  } else {
    territory.status = 'discovered';
  }
  return { success, casualties };
}

function claimConquest(gameState, territoryId, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  const territory = getTerritory(gameState, territoryId);
  if (!territory) return { success: false, error: 'TERRITORY_NOT_FOUND', message: '地点不存在' };
  const mission = getActiveMissionForTerritory(gameState, territoryId);
  if (!mission) return { success: false, error: 'MISSION_NOT_FOUND', message: '没有可完成的军事行动' };
  if (mission.status !== 'ready') return { success: false, error: 'MISSION_NOT_READY', message: '军事行动尚未完成' };
  const result = resolveMission(gameState, mission, territory, now);
  gameState.warMissions = (gameState.warMissions || []).filter((item) => item.id !== mission.id);
  return {
    success: true,
    message: result.success ? `已控制${territory.naturalName}` : `${territory.naturalName}占领失败，士兵正在整队返回`,
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
  if (!territory) return { success: false, error: 'TERRITORY_NOT_FOUND', message: '地点不存在' };
  if (territory.status !== 'occupied') return { success: false, error: 'TERRITORY_NOT_OCCUPIED', message: '只能命名已控制城市' };
  territory.cityName = name;
  if (territory.id === 'capital') gameState.polity.capitalCityName = name;
  return { success: true, message: `城市已命名为${name}`, territory, namingPrompt: getNamingPrompt(gameState) };
}

function renamePolity(gameState, polityName) {
  normalizeTerritoryState(gameState);
  const name = sanitizeName(polityName);
  if (!name) return { success: false, error: 'INVALID_NAME', message: '请输入势力名' };
  if (getOccupiedCount(gameState) < 2) return { success: false, error: 'POLITY_NOT_READY', message: '至少控制第二处地点后才能命名势力' };
  gameState.polity.name = name;
  gameState.polity.namePrompted = true;
  return { success: true, message: `势力已命名为${name}`, polity: gameState.polity, namingPrompt: getNamingPrompt(gameState) };
}

function getMapBounds(territories) {
  const xs = territories.map((territory) => territory.x);
  const ys = territories.map((territory) => territory.y);
  return {
    minX: Math.min(...xs, 0),
    maxX: Math.max(...xs, 0),
    minY: Math.min(...ys, 0),
    maxY: Math.max(...ys, 0),
  };
}

function getClientTerritoryState(gameState, now = new Date()) {
  updateMissionReadiness(gameState, now);
  const missionsByTerritory = Object.fromEntries((gameState.warMissions || [])
    .filter((mission) => getMissionKind(mission) === 'conquest')
    .map((mission) => [mission.territoryId, mission]));
  const territories = (gameState.territories || []).map((territory) => ({
    ...territory,
    distance: getDistance(territory.x, territory.y),
    mission: missionsByTerritory[territory.id] || null,
  }));
  const scoutMissions = (gameState.warMissions || []).filter((mission) => getMissionKind(mission) === 'scout');
  const nowMs = now.getTime();
  return {
    polity: gameState.polity || createInitialPolity(),
    territories,
    warMissions: gameState.warMissions || [],
    scoutMissions: scoutMissions.map((mission) => ({
      ...mission,
      remainingSeconds: Math.max(0, Math.ceil((new Date(mission.completesAt).getTime() - nowMs) / 1000)),
    })),
    activeScoutMission: getActiveScoutMission(gameState),
    scoutReports: gameState.scoutReports || [],
    directions: Object.entries(DIRECTIONS).map(([id, direction]) => ({ id, ...direction })),
    maxActiveScouts: MAX_ACTIVE_SCOUTS,
    availableSoldiers: getAvailableSoldiers(gameState),
    soldiersOnMission: countSoldiersOnMission(gameState),
    occupiedCount: getOccupiedCount(gameState),
    discoveredCount: territories.length,
    mapBounds: getMapBounds(territories),
    territoryEffects: getTerritoryEffects(gameState),
    namingPrompt: getNamingPrompt(gameState),
    scoutDurationSeconds: Math.floor(SCOUT_DURATION_MS / 1000),
    missionDurationSeconds: Math.floor(CONQUEST_DURATION_MS / 1000),
  };
}

module.exports = {
  DIRECTIONS,
  SITE_ART,
  SITE_TEMPLATES,
  SCOUT_DURATION_MS,
  CONQUEST_DURATION_MS,
  MISSION_DURATION_MS: CONQUEST_DURATION_MS,
  createInitialPolity,
  createInitialTerritories,
  normalizeTerritoryState,
  getTerritoryEffects,
  getAvailableSoldiers,
  countSoldiersOnMission,
  getClientTerritoryState,
  getActiveScoutMission,
  getScoutMissions,
  startScout,
  claimScout,
  scoutTerritory,
  startConquest,
  claimConquest,
  renameCity,
  renamePolity,
  updateMissionReadiness,
};
