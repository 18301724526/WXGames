const BattleService = require('./BattleService');
const DefenderLeaderService = require('./DefenderLeaderService');
const WorldMapService = require('./WorldMapService');

const SCOUT_DURATION_MS = 60 * 1000;
const SCOUT_STEP_DURATION_MS = 12 * 1000;
const SCOUT_ACTION_POINTS = 5;
const CONQUEST_DURATION_MS = 2 * 60 * 1000;
const MAX_NAME_LENGTH = 12;
const MAX_REPORTS = 12;
const MAX_SCOUT_DISTANCE = 24;
const MAX_ACTIVE_SCOUTS = 2;
const SCOUT_SITE_MIN_DISTANCE = 3;
const SCOUT_SITE_BASE_CHANCE = 0.32;
const SCOUT_SITE_CHANCE_STEP = 0.14;
const SCOUT_SITE_GUARANTEE_AFTER = 4;
const POST_WAR_FAMOUS_PERSON_ENABLED = false;
const MIN_EXPEDITION_SOLDIERS = 100;
const SOLDIER_SCALE = 100;

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
  city: 'assets/art/world-site-city-cutout.png',
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
    defense: 100,
    recommendedSoldiers: 100,
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
    defense: 100,
    recommendedSoldiers: 100,
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
    defense: 500,
    recommendedSoldiers: 500,
    naturalNames: ['林地部落', '北风营帐', '山脚部族', '河曲部落'],
    summaries: [
      '多个帐篷围绕火塘而立，哨塔上有人持续观察外来者。',
      '这是一个组织严密的部落营地，木材和战士都不少。',
    ],
    reportTitles: ['营帐之间的警戒号角', '林地深处的部族火光'],
    effects: { woodOutputMultiplier: 0.08 },
  },
  {
    type: 'city',
    owner: 'city_state',
    scale: 3,
    threat: 5,
    defense: 600,
    recommendedSoldiers: 600,
    naturalNames: ['河湾城邦', '高墙城邑', '石桥城邦', '山口自治城'],
    summaries: [
      '整齐城墙与旗帜表明这里已经形成稳定政权，哨兵正在城门上来回巡查。',
      '这里不是松散村镇，而是一座有组织的城邦，贸然靠近会被立刻警惕。',
    ],
    reportTitles: ['城墙上的陌生旗帜', '石门后响起的号令'],
    effects: { foodOutputMultiplier: 0.06, knowledgeOutputMultiplier: 0.03 },
  },
  {
    type: 'ruins',
    owner: 'ruin_guardians',
    scale: 2,
    threat: 5,
    defense: 700,
    recommendedSoldiers: 700,
    naturalNames: ['旧日遗迹', '断柱废墟', '沉默神殿', '古道残垣'],
    summaries: [
      '破碎石柱之间仍有守卫巡逻，显然这里的遗迹并非无主空壳。',
      '废墟回廊里传来兵器碰撞声，侦察队判断此地存在遗迹守军。',
    ],
    reportTitles: ['断柱间的守望者', '沉默废墟中的兵影'],
    effects: { knowledgeOutputMultiplier: 0.08 },
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

function normalizeSoldierScale(value, fallback = MIN_EXPEDITION_SOLDIERS) {
  const soldiers = toInteger(value, fallback);
  if (soldiers <= 0) return 0;
  return soldiers < MIN_EXPEDITION_SOLDIERS ? soldiers * SOLDIER_SCALE : soldiers;
}

function getDistance(x, y) {
  return Math.max(Math.abs(x), Math.abs(y));
}

function getRelativeDistance(fromX, fromY, toX, toY) {
  return Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
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
  const rawDefense = toInteger(rawTerritory.defense, Math.max(SOLDIER_SCALE, (getDistance(x, y) + 2) * SOLDIER_SCALE));
  const defense = rawDefense > 0 && rawDefense < MIN_EXPEDITION_SOLDIERS
    ? rawDefense * SOLDIER_SCALE
    : Math.max(MIN_EXPEDITION_SOLDIERS, rawDefense);
  const rawRecommended = toInteger(rawTerritory.recommendedSoldiers, defense);
  const recommendedSoldiers = rawRecommended > 0 && rawRecommended < MIN_EXPEDITION_SOLDIERS
    ? rawRecommended * SOLDIER_SCALE
    : Math.max(MIN_EXPEDITION_SOLDIERS, rawRecommended);
  const normalized = {
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
    recommendedSoldiers: Math.max(MIN_EXPEDITION_SOLDIERS, recommendedSoldiers),
    art: rawTerritory.art || SITE_ART[type],
    visualOffset: normalizeVisualOffset(rawTerritory.visualOffset, x, y, rawTerritory.id || rawTerritory.naturalName || type),
    discoveredAt: rawTerritory.discoveredAt || rawTerritory.scoutedAt || now,
    occupiedAt: status === 'occupied' ? rawTerritory.occupiedAt || now : rawTerritory.occupiedAt || null,
    effects: clone(rawTerritory.effects || {}),
    summary: rawTerritory.summary || '',
    lastBattle: rawTerritory.lastBattle || null,
    defenderLeader: rawTerritory.defenderLeader || null,
  };
  normalized.defenderLeader = DefenderLeaderService.ensureDefenderLeader(normalized, {
    createdAt: normalized.discoveredAt || now,
  });
  return normalized;
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
        const targetX = toInteger(mission.targetX, 0);
        const targetY = toInteger(mission.targetY, 0);
        const originX = toInteger(mission.originX, 0);
        const originY = toInteger(mission.originY, 0);
        const actionPoints = Math.max(1, toInteger(mission.actionPoints, SCOUT_ACTION_POINTS));
        const route = Array.isArray(mission.route)
          ? mission.route.map((step, index) => {
            const q = toInteger(step.q, originX);
            const r = toInteger(step.r, originY);
            return {
              q,
              r,
              step: Math.max(1, toInteger(step.step, index + 1)),
              tileId: step.tileId || WorldMapService.getTileId(q, r),
              revealed: Boolean(step.revealed),
            };
          })
          : WorldMapService.buildScoutRoute(
            { q: originX, r: originY },
            direction,
            actionPoints,
            { startDistance: Math.max(1, getRelativeDistance(originX, originY, targetX, targetY) - actionPoints + 1) },
          ).map((step) => ({
            ...step,
            tileId: WorldMapService.getTileId(step.q, step.r),
            revealed: false,
          }));
        return {
          id: mission.id || `scout_${direction}_${Date.now()}`,
          kind: 'scout',
          direction,
          sourceCityId: typeof mission.sourceCityId === 'string' && mission.sourceCityId ? mission.sourceCityId : 'capital',
          originTerritoryId: typeof mission.originTerritoryId === 'string' && mission.originTerritoryId ? mission.originTerritoryId : 'capital',
          originName: typeof mission.originName === 'string' && mission.originName ? mission.originName : '',
          originX,
          originY,
          targetX,
          targetY,
          siteX: Number.isFinite(Number(mission.siteX)) ? toInteger(mission.siteX, targetX) : null,
          siteY: Number.isFinite(Number(mission.siteY)) ? toInteger(mission.siteY, targetY) : null,
          scoutDistance: Math.max(1, toInteger(mission.scoutDistance, getRelativeDistance(originX, originY, targetX, targetY))),
          actionPoints,
          actionPointsRemaining: Math.max(0, toInteger(mission.actionPointsRemaining, mission.status === 'ready' ? 0 : actionPoints)),
          route,
          revealedTileIds: Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds.filter(Boolean).map(String) : [],
          resolvedTarget: Boolean(mission.resolvedTarget),
          result: mission.result === 'site' ? 'site' : mission.result === 'empty' ? 'empty' : null,
          siteId: typeof mission.siteId === 'string' && mission.siteId ? mission.siteId : null,
          report: normalizeScoutReport(mission.report),
          nextStepAt: mission.nextStepAt || mission.startedAt || new Date().toISOString(),
          returnedAt: mission.returnedAt || null,
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
        mode: mission.mode === 'settlement' ? 'settlement' : 'conquest',
        sourceCityId: mission.sourceCityId || 'capital',
        soldierAllocations: getMissionSoldierAllocations(mission),
        soldiersCommitted: normalizeSoldierScale(mission.soldiersCommitted, 0),
        expedition: {
          troopType: typeof mission.expedition?.troopType === 'string' && mission.expedition.troopType.trim()
            ? mission.expedition.troopType.trim()
            : 'unavailable',
          leader: typeof mission.expedition?.leader === 'string' && mission.expedition.leader.trim()
            ? mission.expedition.leader.trim()
            : 'unavailable',
          soldiers: Math.max(MIN_EXPEDITION_SOLDIERS, normalizeSoldierScale(mission.expedition?.soldiers || mission.soldiersCommitted, MIN_EXPEDITION_SOLDIERS)),
        },
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

function normalizeScoutReport(rawReport) {
  return normalizeScoutReports(rawReport ? [rawReport] : [])[0] || null;
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
    neutralSiteStreak: Math.max(0, toInteger(raw.neutralSiteStreak, 0)),
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
  WorldMapService.ensureWorldMap(gameState, new Date(now));
  for (const territory of gameState.territories || []) {
    WorldMapService.bindSiteToTile(gameState, territory.x, territory.y, territory.id, now);
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

function getKnownWorldCoordinateKeys(gameState) {
  const worldMap = WorldMapService.ensureWorldMap(gameState);
  return new Set((worldMap.tiles || [])
    .filter((tile) => tile.discovered !== false)
    .map((tile) => getCoordinateKey(tile.q, tile.r)));
}

function hasSiteSpacing(gameState, x, y) {
  return !(gameState.territories || []).some((territory) => (
    getRelativeDistance(territory.x, territory.y, x, y) < SCOUT_SITE_MIN_DISTANCE
  ));
}

function getScoutResolvedCoordinate(mission) {
  return {
    x: toInteger(mission.siteX, toInteger(mission.targetX, 0)),
    y: toInteger(mission.siteY, toInteger(mission.targetY, 0)),
  };
}

function getScoutCandidateCoordinates(gameState, mission, now = new Date()) {
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const targetX = toInteger(mission.targetX, 0);
  const targetY = toInteger(mission.targetY, 0);
  const revealedIds = new Set(Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds.filter(Boolean) : []);
  const coords = [];
  const known = new Set();
  const addCoord = (q, r) => {
    const key = getCoordinateKey(q, r);
    if (known.has(key)) return;
    known.add(key);
    coords.push({ q, r });
  };

  for (const tile of worldMap.tiles || []) {
    if (!revealedIds.has(tile.id)) continue;
    addCoord(toInteger(tile.q, 0), toInteger(tile.r, 0));
  }
  for (const coord of WorldMapService.getRevealArea(targetX, targetY)) {
    addCoord(coord.q, coord.r);
  }
  return coords;
}

function getDirectionProgressScore(mission, q, r) {
  const dir = DIRECTIONS[mission.direction];
  if (!dir) return 0;
  const originX = toInteger(mission.originX, 0);
  const originY = toInteger(mission.originY, 0);
  const targetX = toInteger(mission.targetX, 0);
  const targetY = toInteger(mission.targetY, 0);
  const targetProjection = (targetX - originX) * dir.dx + (targetY - originY) * dir.dy;
  const projection = (q - originX) * dir.dx + (r - originY) * dir.dy;
  if (targetProjection <= 0) return 0;
  return Math.max(0, Math.min(1, projection / targetProjection));
}

function getTerrainSiteScore(terrain) {
  if (terrain === 'plains') return 7;
  if (terrain === 'forest') return 6;
  if (terrain === 'hills') return 6;
  if (terrain === 'desert') return 4;
  if (terrain === 'waste') return 3;
  if (terrain === 'mountain') return 1;
  return 0;
}

function scoreScoutSiteCandidate(gameState, mission, coord, seed) {
  const q = toInteger(coord.q, 0);
  const r = toInteger(coord.r, 0);
  if (!WorldMapService.canPlaceSiteOnTerrain(seed, q, r)) return null;
  if (!hasSiteSpacing(gameState, q, r)) return null;
  const terrain = WorldMapService.chooseTerrain(seed, q, r);
  const originX = toInteger(mission.originX, 0);
  const originY = toInteger(mission.originY, 0);
  const targetX = toInteger(mission.targetX, 0);
  const targetY = toInteger(mission.targetY, 0);
  const distance = Math.max(1, getRelativeDistance(originX, originY, q, r));
  const targetDistance = Math.max(1, getRelativeDistance(originX, originY, targetX, targetY));
  const targetCloseness = Math.max(0, 3 - getRelativeDistance(targetX, targetY, q, r));
  const directionProgress = getDirectionProgressScore(mission, q, r);
  const terrainScore = getTerrainSiteScore(terrain);
  const stableNoise = seededNoise(Math.abs(q * 92821 + r * 68917 + String(seed).length * 131));
  return {
    q,
    r,
    terrain,
    distance,
    score:
      terrainScore * 10
      + Math.min(distance, targetDistance + 2) * 2
      + targetCloseness * 5
      + directionProgress * 8
      + stableNoise,
  };
}

function pickScoutSiteCoordinate(gameState, mission, now = new Date()) {
  const seed = WorldMapService.ensureWorldMap(gameState, now).seed;
  return getScoutCandidateCoordinates(gameState, mission, now)
    .map((coord) => scoreScoutSiteCandidate(gameState, mission, coord, seed))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.distance - a.distance || a.q - b.q || a.r - b.r)[0] || null;
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
  WorldMapService.ensureWorldMap(gameState, now);
  syncScoutCoordinatesWithTerritories(gameState, isoNow);
  enforceScoutMissionLimit(gameState);
  updateMissionReadiness(gameState, now);
  return gameState;
}

function normalizeDirection(direction) {
  const key = String(direction || '').toLowerCase();
  return DIRECTIONS[key] ? key : null;
}

function getTerritory(gameState, territoryId) {
  return (gameState.territories || []).find((territory) => territory.id === territoryId) || null;
}

function getCapitalTerritory(gameState) {
  return getTerritory(gameState, 'capital') || { id: 'capital', x: 0, y: 0, cityName: '棣栭兘', naturalName: '棣栭兘', status: 'occupied' };
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
    name: city?.name || territory.cityName || territory.naturalName || '棣栭兘',
    x: toInteger(territory.x, 0),
    y: toInteger(territory.y, 0),
  };
}

function getMissionKind(mission) {
  return mission.kind === 'scout' ? 'scout' : 'conquest';
}

function isUnownedTerritory(territory) {
  return territory?.owner === 'neutral';
}

function getOccupationMode(territory) {
  return isUnownedTerritory(territory) ? 'settlement' : 'conquest';
}

function normalizeExpeditionConfig(rawConfig, territory) {
  const fallbackSoldiers = getOccupationMode(territory) === 'settlement'
    ? MIN_EXPEDITION_SOLDIERS
    : Math.max(MIN_EXPEDITION_SOLDIERS, territory?.recommendedSoldiers || territory?.defense || MIN_EXPEDITION_SOLDIERS);
  const raw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  return {
    troopType: typeof raw.troopType === 'string' && raw.troopType.trim() ? raw.troopType.trim() : 'unavailable',
    leader: typeof raw.leader === 'string' && raw.leader.trim() ? raw.leader.trim() : 'unavailable',
    soldiers: Math.max(MIN_EXPEDITION_SOLDIERS, Math.floor(Number(raw.soldiers) || fallbackSoldiers)),
  };
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

function getMissionSoldierAllocations(mission) {
  if (Array.isArray(mission?.soldierAllocations) && mission.soldierAllocations.length) {
    return mission.soldierAllocations
      .map((allocation) => ({
        cityId: allocation?.cityId || mission.sourceCityId || 'capital',
        soldiers: normalizeSoldierScale(allocation?.soldiers, 0),
      }))
      .filter((allocation) => allocation.soldiers > 0);
  }
  return [{
    cityId: mission?.sourceCityId || 'capital',
    soldiers: normalizeSoldierScale(mission?.soldiersCommitted, 0),
  }];
}

function countSoldiersOnMission(gameState, cityId = gameState?.activeCityId || 'capital') {
  const sourceCityId = cityId || 'capital';
  return (gameState.warMissions || []).reduce((sum, mission) => {
    if (getMissionKind(mission) !== 'conquest' || !['active', 'ready'].includes(mission.status)) return sum;
    const allocation = getMissionSoldierAllocations(mission).find((item) => item.cityId === sourceCityId);
    return sum + (allocation?.soldiers || 0);
  }, 0);
}

function countTotalSoldiersOnMission(gameState) {
  return (gameState.warMissions || []).reduce((sum, mission) => {
    if (getMissionKind(mission) !== 'conquest' || !['active', 'ready'].includes(mission.status)) return sum;
    return sum + (mission.soldiersCommitted || 0);
  }, 0);
}

function getCitySoldierEntries(gameState) {
  const activeCityId = gameState?.activeCityId || 'capital';
  const cities = gameState?.cities && typeof gameState.cities === 'object'
    ? Object.values(gameState.cities).filter((city) => city && typeof city === 'object')
    : [];
  if (!cities.length) {
    return [{
      id: activeCityId,
      soldiers: Math.max(0, Math.floor(Number(gameState?.military?.soldiers) || 0)),
    }];
  }
  return cities.map((city) => {
    const id = city.id || city.territoryId || 'capital';
    const military = id === activeCityId && gameState?.military ? gameState.military : city.military;
    return {
      id,
      soldiers: Math.max(0, Math.floor(Number(military?.soldiers) || 0)),
    };
  });
}

function getTotalSoldiers(gameState) {
  return getCitySoldierEntries(gameState).reduce((sum, entry) => sum + entry.soldiers, 0);
}

function getAvailableSoldiers(gameState) {
  return Math.max(0, getTotalSoldiers(gameState) - countTotalSoldiersOnMission(gameState));
}

function getAvailableSoldiersForCity(gameState, cityId) {
  const entry = getCitySoldierEntries(gameState).find((item) => item.id === (cityId || 'capital'));
  return Math.max(0, (entry?.soldiers || 0) - countSoldiersOnMission(gameState, cityId || 'capital'));
}

function allocateSoldiersForMission(gameState, requiredSoldiers) {
  const required = Math.max(MIN_EXPEDITION_SOLDIERS, Math.floor(Number(requiredSoldiers) || MIN_EXPEDITION_SOLDIERS));
  if (getAvailableSoldiers(gameState) < required) return null;
  const activeCityId = gameState?.activeCityId || 'capital';
  const entries = getCitySoldierEntries(gameState)
    .map((entry, index) => ({
      ...entry,
      available: getAvailableSoldiersForCity(gameState, entry.id),
      priority: entry.id === activeCityId ? 0 : entry.id === 'capital' ? 1 : index + 2,
    }))
    .filter((entry) => entry.available > 0)
    .sort((a, b) => a.priority - b.priority || String(a.id).localeCompare(String(b.id)));
  const allocations = [];
  let remaining = required;
  for (const entry of entries) {
    if (remaining <= 0) break;
    const soldiers = Math.min(entry.available, remaining);
    allocations.push({ cityId: entry.id, soldiers });
    remaining -= soldiers;
  }
  if (remaining > 0) return null;
  return allocations;
}

function updateMissionReadiness(gameState, now = new Date(), randomSource = Math.random) {
  const nowMs = now.getTime();
  for (const mission of gameState.warMissions || []) {
    if (getMissionKind(mission) === 'scout' && mission.status === 'active') {
      advanceScoutMission(gameState, mission, now, randomSource);
    }
    if (mission.status === 'active' && new Date(mission.completesAt).getTime() <= nowMs) {
      mission.status = 'ready';
    }
  }
  return gameState.warMissions;
}

function advanceScoutMission(gameState, mission, now = new Date(), randomSource = Math.random) {
  const nowMs = now.getTime();
  const route = Array.isArray(mission.route) ? mission.route : [];
  let nextStepAt = new Date(mission.nextStepAt || mission.startedAt || now).getTime();
  if (!Number.isFinite(nextStepAt)) nextStepAt = nowMs;
  mission.revealedTileIds = Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [];
  mission.actionPointsRemaining = Math.max(0, toInteger(mission.actionPointsRemaining, mission.actionPoints || SCOUT_ACTION_POINTS));

  for (const step of route) {
    if (step.revealed) continue;
    if (mission.actionPointsRemaining <= 0 || nextStepAt > nowMs) break;
    const revealedTiles = WorldMapService.revealTileArea(gameState, step.q, step.r, now);
    const tile = revealedTiles.find((item) => item.q === step.q && item.r === step.r) || revealedTiles[0];
    step.tileId = tile.id;
    step.revealed = true;
    mission.revealedTileIds = Array.from(new Set([
      ...mission.revealedTileIds,
      ...revealedTiles.map((item) => item.id),
    ]));
    mission.actionPointsRemaining = Math.max(0, mission.actionPointsRemaining - 1);
    if (step.q === toInteger(mission.targetX, 0) && step.r === toInteger(mission.targetY, 0)) {
      resolveScoutMissionTarget(gameState, mission, now, randomSource);
    }
    nextStepAt += SCOUT_STEP_DURATION_MS;
  }

  mission.nextStepAt = new Date(nextStepAt).toISOString();
  const routeDone = route.every((step) => step.revealed);
  if (mission.actionPointsRemaining <= 0 || routeDone || new Date(mission.completesAt).getTime() <= nowMs) {
    if (!mission.resolvedTarget) resolveScoutMissionTarget(gameState, mission, now, randomSource);
    mission.status = 'ready';
    mission.actionPointsRemaining = 0;
    mission.returnedAt = mission.returnedAt || now.toISOString();
    WorldMapService.recordScoutTrail(gameState, mission, mission.revealedTileIds, true);
  } else {
    WorldMapService.recordScoutTrail(gameState, mission, mission.revealedTileIds, false);
  }
  return mission;
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

function findNextCoordinate(gameState, direction, origin = getScoutOrigin(gameState)) {
  const dir = DIRECTIONS[direction];
  if (!dir) return null;
  const originX = toInteger(origin?.x, 0);
  const originY = toInteger(origin?.y, 0);
  const occupied = new Set((gameState.territories || []).map((territory) => getCoordinateKey(territory.x, territory.y)));
  const scouted = new Set((gameState.scoutedCoordinates || []).map((coordinate) => getCoordinateKey(coordinate.x, coordinate.y)));
  const discovered = getKnownWorldCoordinateKeys(gameState);
  for (let distance = 1; distance <= MAX_SCOUT_DISTANCE; distance += 1) {
    const x = originX + dir.dx * distance;
    const y = originY + dir.dy * distance;
    const key = getCoordinateKey(x, y);
    if (occupied.has(key) || scouted.has(key) || discovered.has(key)) continue;
    return { x, y, distance };
  }
  return null;
}

function rollScoutOutcome(gameState, randomSource = Math.random) {
  gameState.scoutState = normalizeScoutState(gameState.scoutState);
  const emptyStreak = Math.max(0, Number(gameState.scoutState.emptyStreak) || 0);
  if (emptyStreak >= SCOUT_SITE_GUARANTEE_AFTER) {
    return 'site';
  }
  const roll = Math.max(0, Math.min(1, Number(typeof randomSource === 'function' ? randomSource() : Math.random()) || 0));
  const siteChance = Math.min(1, SCOUT_SITE_BASE_CHANCE + emptyStreak * SCOUT_SITE_CHANCE_STEP);
  return roll < siteChance ? 'site' : 'empty';
}

function recordScoutOutcome(gameState, outcome) {
  gameState.scoutState = normalizeScoutState(gameState.scoutState);
  gameState.scoutState.emptyStreak = outcome === 'empty'
    ? (gameState.scoutState.emptyStreak || 0) + 1
    : 0;
  return gameState.scoutState.emptyStreak;
}

function recordDiscoveredSiteOwnership(gameState, owner) {
  gameState.scoutState = normalizeScoutState(gameState.scoutState);
  gameState.scoutState.neutralSiteStreak = owner === 'neutral'
    ? (gameState.scoutState.neutralSiteStreak || 0) + 1
    : 0;
  return gameState.scoutState.neutralSiteStreak;
}

function pickText(items, seed) {
  return items[Math.abs(seed) % items.length];
}

function rollUnit(randomSource = Math.random) {
  return Math.max(0, Math.min(0.999999, Number(typeof randomSource === 'function' ? randomSource() : Math.random()) || 0));
}

function getOwnedSiteChance(distance, neutralSiteStreak = 0) {
  const streak = Math.max(0, Number(neutralSiteStreak) || 0);
  const base = distance <= 1
    ? 0.24
    : distance === 2
      ? 0.58
      : Math.min(0.88, 0.72 + Math.max(0, distance - 3) * 0.06);
  if (streak >= 3) return 1;
  return Math.min(1, base + streak * 0.12);
}

function pickTemplateByDistance(distance, neutralSiteStreak = 0, randomSource = Math.random) {
  const neutralPool = distance <= 1
    ? [SITE_TEMPLATES[0], SITE_TEMPLATES[1], SITE_TEMPLATES[1]]
    : distance === 2
      ? [SITE_TEMPLATES[1], SITE_TEMPLATES[1], SITE_TEMPLATES[0]]
      : [SITE_TEMPLATES[1], SITE_TEMPLATES[0]];
  const ownedPool = distance <= 1
    ? [SITE_TEMPLATES[2]]
    : distance === 2
      ? [SITE_TEMPLATES[2], SITE_TEMPLATES[3], SITE_TEMPLATES[4]]
      : [SITE_TEMPLATES[2], SITE_TEMPLATES[3], SITE_TEMPLATES[3], SITE_TEMPLATES[4], SITE_TEMPLATES[4]];
  const isOwned = rollUnit(randomSource) < getOwnedSiteChance(distance, neutralSiteStreak);
  const pool = isOwned ? ownedPool : neutralPool;
  const index = Math.min(pool.length - 1, Math.floor(rollUnit(randomSource) * pool.length));
  return pool[index];
}

function getSiteEffects(template, distance) {
  const effects = clone(template.effects || {});
  if (effects.foodOutputMultiplier) effects.foodOutputMultiplier = Math.round((effects.foodOutputMultiplier + Math.max(0, distance - 1) * 0.01) * 100) / 100;
  if (effects.woodOutputMultiplier) effects.woodOutputMultiplier = Math.round((effects.woodOutputMultiplier + Math.max(0, distance - 1) * 0.01) * 100) / 100;
  if (effects.knowledgeOutputMultiplier) effects.knowledgeOutputMultiplier = Math.round((effects.knowledgeOutputMultiplier + Math.max(0, distance - 1) * 0.01) * 100) / 100;
  if (effects.threatDefense) effects.threatDefense += Math.max(0, Math.floor((distance - 1) / 2));
  return effects;
}

function createSiteFromScout(gameState, mission, now = new Date(), randomSource = Math.random) {
  const direction = mission.direction;
  const resolvedCoord = getScoutResolvedCoordinate(mission);
  const x = resolvedCoord.x;
  const y = resolvedCoord.y;
  const originX = toInteger(mission.originX, 0);
  const originY = toInteger(mission.originY, 0);
  const distance = Math.max(1, toInteger(mission.scoutDistance, getRelativeDistance(originX, originY, x, y)));
  const originName = mission.originName || '出发城市';
  const discoveredCount = (gameState.territories || []).length;
  const template = pickTemplateByDistance(distance, gameState.scoutState?.neutralSiteStreak || 0, randomSource);
  const seed = Math.abs(x * 31 + y * 17 + discoveredCount * 13 + Object.keys(DIRECTIONS).indexOf(direction));
  const naturalName = pickText(template.naturalNames, seed);
  const title = pickText(template.reportTitles, seed + 1);
  const summary = pickText(template.summaries, seed + 2);
  const defense = template.defense + Math.max(0, distance - 1) * SOLDIER_SCALE;
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
    recommendedSoldiers: Math.max(defense, template.recommendedSoldiers + Math.max(0, distance - 1) * SOLDIER_SCALE),
    art: SITE_ART[template.type],
    visualOffset: createVisualOffset(x, y, `${template.type}_${naturalName}_${discoveredCount}`),
    discoveredAt: now.toISOString(),
    occupiedAt: null,
    effects: getSiteEffects(template, distance),
    summary,
    lastBattle: null,
  };
  site.defenderLeader = DefenderLeaderService.ensureDefenderLeader(site, {
    createdAt: now.toISOString(),
  });
  const report = {
    id: `report_${site.id}_${now.getTime()}`,
    siteId: site.id,
    title,
    text: `侦察队向${DIRECTIONS[direction].label}推进，在距离首都 ${distance} 格的位置发现了${naturalName}。${summary}`,
    direction,
    createdAt: now.toISOString(),
  };
  report.text = `侦察队从${originName}向${DIRECTIONS[direction].label}推进，在距离出发城市 ${distance} 格的位置发现了${naturalName}。${summary}`;
  return { site, report };
}

function createEmptyScoutReport(mission, now = new Date(), repeated = false) {
  const direction = mission.direction;
  const resolvedCoord = getScoutResolvedCoordinate(mission);
  const x = resolvedCoord.x;
  const y = resolvedCoord.y;
  const originX = toInteger(mission.originX, 0);
  const originY = toInteger(mission.originY, 0);
  const distance = Math.max(1, toInteger(mission.scoutDistance, getRelativeDistance(originX, originY, x, y)));
  const originName = mission.originName || '出发城市';
  const label = DIRECTIONS[direction]?.label || '远方';
  const report = {
    id: `report_empty_${x}_${y}_${now.getTime()}`,
    siteId: null,
    title: repeated ? '重复侦察确认空地' : '空地侦察报告',
    text: repeated
      ? `侦察队再次确认${label}距离首都 ${distance} 格的位置暂无可占领地点。`
      : `侦察队向${label}推进，在距离首都 ${distance} 格的位置未发现可建立据点或占领的目标。`,
    direction,
    createdAt: now.toISOString(),
  };
  report.text = repeated
    ? `侦察队再次确认${originName}${label}方向、距离出发城市 ${distance} 格的位置暂无可占领地点。`
    : `侦察队从${originName}向${label}推进，在距离出发城市 ${distance} 格的位置未发现可建立据点或占领的目标。`;
  return report;
}

function resolveScoutMissionTarget(gameState, mission, now = new Date(), randomSource = Math.random) {
  if (mission.resolvedTarget) return { site: mission.siteId ? getTerritory(gameState, mission.siteId) : null, report: mission.report || null };
  const targetX = toInteger(mission.targetX, 0);
  const targetY = toInteger(mission.targetY, 0);
  const existing = (gameState.territories || []).find((territory) => territory.x === targetX && territory.y === targetY) || null;
  const coordinateRecord = getScoutCoordinateRecord(gameState, targetX, targetY);

  if (existing) {
    mission.resolvedTarget = true;
    mission.result = 'site';
    mission.siteId = existing.id;
    mission.report = {
      id: `report_${existing.id}_${now.getTime()}`,
      siteId: existing.id,
      title: 'Scout confirmed site',
      text: `Scout confirmed ${existing.naturalName || existing.id}.`,
      direction: mission.direction,
      createdAt: now.toISOString(),
    };
    WorldMapService.bindSiteToTile(gameState, existing.x, existing.y, existing.id, now);
    return { site: existing, report: mission.report };
  }

  if (coordinateRecord?.result === 'empty') {
    mission.resolvedTarget = true;
    mission.result = 'empty';
    mission.siteId = null;
    mission.report = createEmptyScoutReport(mission, now, true);
    return { site: null, report: mission.report };
  }

  if (coordinateRecord?.result === 'site' && coordinateRecord.siteId) {
    const recordedSite = getTerritory(gameState, coordinateRecord.siteId);
    mission.resolvedTarget = true;
    mission.result = 'site';
    mission.siteId = coordinateRecord.siteId;
    mission.report = recordedSite ? {
      id: `report_${recordedSite.id}_${now.getTime()}`,
      siteId: recordedSite.id,
      title: 'Scout confirmed site',
      text: `Scout confirmed ${recordedSite.naturalName || recordedSite.id}.`,
      direction: mission.direction,
      createdAt: now.toISOString(),
    } : createEmptyScoutReport(mission, now, true);
    if (recordedSite) WorldMapService.bindSiteToTile(gameState, recordedSite.x, recordedSite.y, recordedSite.id, now);
    return { site: recordedSite || null, report: mission.report };
  }

  const outcome = rollScoutOutcome(gameState, randomSource);
  mission.resolvedTarget = true;
  mission.result = outcome;
  if (outcome === 'empty') {
    recordScoutOutcome(gameState, 'empty');
    upsertScoutCoordinateRecord(gameState, {
      x: targetX,
      y: targetY,
      result: 'empty',
      siteId: null,
      scoutedAt: now.toISOString(),
    });
    mission.siteId = null;
    mission.report = createEmptyScoutReport(mission, now);
    return { site: null, report: mission.report };
  }

  const siteCoord = pickScoutSiteCoordinate(gameState, mission, now);
  if (!siteCoord) {
    recordScoutOutcome(gameState, 'empty');
    upsertScoutCoordinateRecord(gameState, {
      x: targetX,
      y: targetY,
      result: 'empty',
      siteId: null,
      scoutedAt: now.toISOString(),
    });
    mission.result = 'empty';
    mission.siteId = null;
    mission.report = createEmptyScoutReport(mission, now);
    return { site: null, report: mission.report };
  }

  mission.siteX = siteCoord.q;
  mission.siteY = siteCoord.r;
  mission.scoutDistance = Math.max(
    1,
    getRelativeDistance(toInteger(mission.originX, 0), toInteger(mission.originY, 0), siteCoord.q, siteCoord.r),
  );
  recordScoutOutcome(gameState, 'site');
  const created = createSiteFromScout(gameState, mission, now, randomSource);
  const site = created.site;
  gameState.territories.push(site);
  WorldMapService.bindSiteToTile(gameState, site.x, site.y, site.id, now);
  recordDiscoveredSiteOwnership(gameState, site.owner);
  upsertScoutCoordinateRecord(gameState, {
    x: site.x,
    y: site.y,
    result: 'site',
    siteId: site.id,
    scoutedAt: site.discoveredAt || now.toISOString(),
  });
  mission.siteId = site.id;
  mission.report = created.report;
  return { site, report: mission.report };
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
  const origin = getScoutOrigin(gameState);
  const target = findNextCoordinate(gameState, normalizedDirection, origin);
  if (!target) return { success: false, error: 'NO_SCOUT_TARGET', message: '该方向暂时没有可侦察区域' };
  const routeStartDistance = Math.max(1, target.distance - SCOUT_ACTION_POINTS + 1);
  const route = WorldMapService.buildScoutRoute(
    { q: origin.x, r: origin.y },
    normalizedDirection,
    SCOUT_ACTION_POINTS,
    { startDistance: routeStartDistance },
  )
    .map((step) => ({
      ...step,
      tileId: WorldMapService.getTileId(step.q, step.r),
      revealed: false,
    }));
  const mission = {
    id: `scout_${normalizedDirection}_${now.getTime()}`,
    kind: 'scout',
    direction: normalizedDirection,
    sourceCityId: origin.cityId,
    originTerritoryId: origin.territoryId,
    originName: origin.name,
    originX: origin.x,
    originY: origin.y,
    targetX: target.x,
    targetY: target.y,
    scoutDistance: target.distance,
    actionPoints: SCOUT_ACTION_POINTS,
    actionPointsRemaining: SCOUT_ACTION_POINTS,
    route,
    revealedTileIds: [],
    nextStepAt: now.toISOString(),
    returnedAt: null,
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
  const resolved = resolveScoutMissionTarget(gameState, mission, now, randomSource);
  const site = mission.siteId ? getTerritory(gameState, mission.siteId) : resolved.site;
  const report = mission.report || resolved.report || createEmptyScoutReport(mission, now, true);
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

function startConquest(gameState, territoryId, expeditionInput, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  if ((gameState.currentEra || 0) < 5) return { success: false, error: 'ERA_NOT_UNLOCKED', message: '古典时代后才能发起占领' };
  const territory = getTerritory(gameState, territoryId);
  if (!territory) return { success: false, error: 'TERRITORY_NOT_FOUND', message: '地点不存在' };
  if (territory.status !== 'discovered') return { success: false, error: 'TERRITORY_NOT_DISCOVERED', message: '只能占领已发现且未控制的地点' };
  if (getActiveMissionForTerritory(gameState, territoryId)) return { success: false, error: 'MISSION_EXISTS', message: '该地点已有进行中的军事行动' };
  const occupationMode = getOccupationMode(territory);
  const expedition = normalizeExpeditionConfig(
    expeditionInput && typeof expeditionInput === 'object'
      ? expeditionInput
      : { soldiers: expeditionInput },
    territory,
  );
  const committed = occupationMode === 'settlement' ? MIN_EXPEDITION_SOLDIERS : expedition.soldiers;
  if (committed > getAvailableSoldiers(gameState)) return { success: false, error: 'INSUFFICIENT_SOLDIERS', message: '可用士兵不足' };
  const soldierAllocations = allocateSoldiersForMission(gameState, committed);
  if (!soldierAllocations) return { success: false, error: 'INSUFFICIENT_SOLDIERS', message: '可用士兵不足' };
  const leaderSnapshot = BattleService.getLeaderSnapshot(gameState, expedition.leader);
  const mission = {
    id: `conquest_${territoryId}_${now.getTime()}`,
    kind: 'conquest',
    territoryId,
    mode: occupationMode,
    sourceCityId: soldierAllocations[0]?.cityId || gameState.activeCityId || 'capital',
    soldierAllocations,
    soldiersCommitted: committed,
    expedition: {
      ...expedition,
      soldiers: committed,
      ...(leaderSnapshot ? { leaderSnapshot } : {}),
    },
    startedAt: now.toISOString(),
    completesAt: new Date(now.getTime() + CONQUEST_DURATION_MS).toISOString(),
    status: 'active',
  };
  gameState.warMissions = [...(gameState.warMissions || []), mission];
  territory.status = 'contested';
  return {
    success: true,
    message: occupationMode === 'settlement'
      ? `已派出 ${MIN_EXPEDITION_SOLDIERS} 士兵前往${territory.naturalName}建立据点`
      : `已派出 ${committed} 士兵前往${territory.naturalName}`,
    mission,
  };
}

function resolveMission(gameState, mission, territory, now = new Date()) {
  if (mission.mode === 'settlement') {
    territory.lastBattle = {
      resolvedAt: now.toISOString(),
      soldiersCommitted: mission.soldiersCommitted,
      casualties: 0,
      success: true,
      mode: 'settlement',
    };
    territory.status = 'occupied';
    territory.owner = 'player';
    territory.occupiedAt = now.toISOString();
    territory.cityName = null;
    return { success: true, casualties: 0 };
  }
  const battle = BattleService.simulateConquestBattle(gameState, mission, territory, now);
  const success = battle ? battle.success : mission.soldiersCommitted >= territory.defense;
  const casualties = battle
    ? battle.casualties
    : success
      ? Math.min(Math.max(0, mission.soldiersCommitted - 1), Math.floor(territory.defense / 3))
      : Math.ceil(mission.soldiersCommitted / 2);
  let remainingCasualties = casualties;
  for (const allocation of getMissionSoldierAllocations(mission)) {
    if (remainingCasualties <= 0) break;
    const proportionalCasualties = Math.min(
      allocation.soldiers,
      Math.ceil((casualties * allocation.soldiers) / Math.max(1, mission.soldiersCommitted)),
      remainingCasualties,
    );
    const sourceCity = gameState.cities?.[allocation.cityId] || null;
    const military = sourceCity?.military || gameState.military || {};
    military.soldiers = Math.max(0, Math.floor(military.soldiers || 0) - proportionalCasualties);
    if (sourceCity) sourceCity.military = military;
    else gameState.military = military;
    remainingCasualties -= proportionalCasualties;
  }
  territory.lastBattle = {
    resolvedAt: now.toISOString(),
    soldiersCommitted: mission.soldiersCommitted,
    casualties,
    success,
    mode: 'conquest',
    leaderId: mission.expedition?.leader || 'unavailable',
    leaderName: battle?.report?.attacker?.leaderName || mission.expedition?.leaderSnapshot?.name || '',
    report: battle?.report || BattleService.createLegacyBattleReport(mission, territory, { success, casualties }, now),
  };
  const FamousPersonService = require('./FamousPersonService');
  const leaderGrowth = FamousPersonService.grantBattleExperience(
    gameState,
    mission.expedition?.leader,
    territory.lastBattle.report?.experience,
    now,
  );
  territory.lastBattle.leaderGrowth = leaderGrowth;
  if (territory.lastBattle.report) territory.lastBattle.report.leaderGrowth = leaderGrowth;
  if (success) {
    territory.status = 'occupied';
    territory.owner = 'player';
    territory.defenderLeader = null;
    territory.occupiedAt = now.toISOString();
    territory.cityName = null;
  } else {
    territory.status = 'discovered';
  }
  return { success, casualties };
}

function createPostWarCandidate(gameState, mission, territory, result, now = new Date()) {
  if (!POST_WAR_FAMOUS_PERSON_ENABLED) return null;
  if (!result?.success || mission.mode === 'settlement') return null;
  const FamousPersonService = require('./FamousPersonService');
  const famousPersonState = FamousPersonService.ensureFamousPersonState(gameState);
  if (famousPersonState.candidates.length >= FamousPersonService.MAX_CANDIDATES) return null;
  const candidate = FamousPersonService.createFamousPersonCandidate(gameState, { source: 'postWar' }, now);
  candidate.source = {
    ...candidate.source,
    territoryId: territory.id,
    territoryName: territory.naturalName || territory.cityName || '',
    battleReportId: territory.lastBattle?.report?.id || null,
    leaderId: territory.lastBattle?.leaderId || mission.expedition?.leader || 'unavailable',
  };
  famousPersonState.candidates = [candidate, ...famousPersonState.candidates].slice(0, FamousPersonService.MAX_CANDIDATES);
  return clone(candidate);
}

function claimConquest(gameState, territoryId, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  const territory = getTerritory(gameState, territoryId);
  if (!territory) return { success: false, error: 'TERRITORY_NOT_FOUND', message: '地点不存在' };
  const mission = getActiveMissionForTerritory(gameState, territoryId);
  if (!mission) return { success: false, error: 'MISSION_NOT_FOUND', message: '没有可完成的军事行动' };
  if (mission.status !== 'ready') return { success: false, error: 'MISSION_NOT_READY', message: '军事行动尚未完成' };
  const result = resolveMission(gameState, mission, territory, now);
  const postWarCandidate = createPostWarCandidate(gameState, mission, territory, result, now);
  gameState.warMissions = (gameState.warMissions || []).filter((item) => item.id !== mission.id);
  return {
    success: true,
    message: result.success
      ? `已控制${territory.naturalName}${postWarCandidate ? '，战后有人愿意投奔' : ''}`
      : `${territory.naturalName}占领失败，士兵正在整队返回`,
    outcome: result.success ? 'success' : 'failure',
    casualties: result.casualties,
    battleReport: territory.lastBattle?.report || null,
    postWarCandidate,
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
  const nowMs = now.getTime();
  const scoutOrigin = getScoutOrigin(gameState);
  const missionsByTerritory = Object.fromEntries((gameState.warMissions || [])
    .filter((mission) => getMissionKind(mission) === 'conquest')
    .map((mission) => [mission.territoryId, {
      ...mission,
      remainingSeconds: Math.max(0, Math.ceil((new Date(mission.completesAt).getTime() - nowMs) / 1000)),
      durationSeconds: Math.floor(CONQUEST_DURATION_MS / 1000),
    }]));
  const territories = (gameState.territories || []).map((territory) => ({
    ...territory,
    distance: getDistance(territory.x, territory.y),
    originDistance: getRelativeDistance(scoutOrigin.x, scoutOrigin.y, territory.x, territory.y),
    relativeX: territory.x - scoutOrigin.x,
    relativeY: territory.y - scoutOrigin.y,
    occupationMode: getOccupationMode(territory),
    mission: missionsByTerritory[territory.id] || null,
  }));
  const scoutMissions = (gameState.warMissions || []).filter((mission) => getMissionKind(mission) === 'scout');
  return {
    polity: gameState.polity || createInitialPolity(),
    territories,
    worldMap: WorldMapService.getClientWorldMap(gameState, now),
    warMissions: gameState.warMissions || [],
    scoutMissions: scoutMissions.map((mission) => ({
      ...mission,
      remainingSeconds: Math.max(0, Math.ceil((new Date(mission.completesAt).getTime() - nowMs) / 1000)),
    })),
    activeScoutMission: getActiveScoutMission(gameState),
    scoutReports: gameState.scoutReports || [],
    scoutOrigin,
    directions: Object.entries(DIRECTIONS).map(([id, direction]) => ({ id, ...direction })),
    maxActiveScouts: MAX_ACTIVE_SCOUTS,
    availableSoldiers: getAvailableSoldiers(gameState),
    soldiersOnMission: countTotalSoldiersOnMission(gameState),
    occupiedCount: getOccupiedCount(gameState),
    discoveredCount: territories.length,
    mapBounds: getMapBounds(territories),
    territoryEffects: getTerritoryEffects(gameState),
    namingPrompt: getNamingPrompt(gameState),
    scoutDurationSeconds: Math.floor(SCOUT_DURATION_MS / 1000),
    missionDurationSeconds: Math.floor(CONQUEST_DURATION_MS / 1000),
    famousPersons: {
      people: clone(gameState.famousPeople || []),
    },
  };
}

module.exports = {
  DIRECTIONS,
  SITE_ART,
  SITE_TEMPLATES,
  MIN_EXPEDITION_SOLDIERS,
  SCOUT_DURATION_MS,
  SCOUT_STEP_DURATION_MS,
  SCOUT_ACTION_POINTS,
  SCOUT_SITE_MIN_DISTANCE,
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
