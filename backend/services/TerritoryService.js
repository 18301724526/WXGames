const BattleService = require('./BattleService');
const DefenderLeaderService = require('./DefenderLeaderService');
const WorldMapService = require('./WorldMapService');
const TerritoryClientAssembler = require('./TerritoryClientAssembler');
const {
  CONQUEST_DURATION_MS,
  DIRECTIONS,
  LEGACY_SITE_MIGRATIONS,
  MAX_ACTIVE_SCOUTS,
  MAX_MIGRATION_SITE_SEARCH_DISTANCE,
  MAX_NAME_LENGTH,
  MAX_REPORTS,
  MAX_SCOUT_AREA_RECORDS,
  MAX_SCOUT_DISTANCE,
  MIN_EXPEDITION_SOLDIERS,
  POST_WAR_FAMOUS_PERSON_ENABLED,
  SCOUT_ACTION_POINTS,
  SCOUT_DURATION_MS,
  SCOUT_SITE_BASE_CHANCE,
  SCOUT_SITE_CHANCE_STEP,
  SCOUT_SITE_GUARANTEE_AFTER,
  SCOUT_SITE_MIN_DISTANCE,
  SCOUT_STEP_DURATION_MS,
  SITE_ART,
  SITE_TEMPLATES,
  SOLDIER_SCALE,
} = require('./territory/TerritoryConstants');
const {
  createVisualOffset,
  normalizeVisualOffset,
  seededNoise,
} = require('./territory/TerritoryVisuals');
const {
  createCapital,
  createInitialPolity,
  createInitialTerritories,
  normalizePolity,
} = require('./territory/TerritoryInitialState');
const {
  clone,
  getCoordinateKey,
  getDistance,
  getPlanningTerrainForMapTerrain,
  getRelativeDistance,
  hasFiniteValue,
  normalizeMapTerrainId,
  normalizeSoldierScale,
  toInteger,
} = require('./territory/TerritoryShared');

function normalizeGarrison(rawGarrison, territory = {}, now = new Date().toISOString()) {
  const raw = rawGarrison && typeof rawGarrison === 'object' ? rawGarrison : {};
  const owner = territory.owner || raw.owner || 'neutral';
  if (owner === 'player' || owner === 'neutral' || territory.id === 'capital') return null;
  const leaderSource = raw.leader && typeof raw.leader === 'object'
    ? raw.leader
    : territory.defenderLeader;
  const leader = DefenderLeaderService.ensureDefenderLeader({
    ...territory,
    defenderLeader: leaderSource || territory.defenderLeader,
  }, { createdAt: raw.generatedAt || territory.discoveredAt || now });
  const soldiers = Math.max(
    MIN_EXPEDITION_SOLDIERS,
    normalizeSoldierScale(raw.soldiers ?? territory.defense ?? territory.recommendedSoldiers, MIN_EXPEDITION_SOLDIERS),
  );
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `garrison_${territory.id || 'site'}`,
    siteId: territory.id || raw.siteId || '',
    owner,
    soldiers,
    quality: raw.quality || leader?.quality || 'common',
    threat: Math.max(0, toInteger(raw.threat, territory.threat || 0)),
    scale: Math.max(1, toInteger(raw.scale, territory.scale || 1)),
    leader,
    generatedAt: raw.generatedAt || territory.discoveredAt || now,
  };
}

function normalizeBattleTarget(rawTarget, territory = {}, now = new Date().toISOString()) {
  const raw = rawTarget && typeof rawTarget === 'object' ? rawTarget : {};
  const x = toInteger(raw.tile?.q ?? raw.q ?? territory.x, 0);
  const y = toInteger(raw.tile?.r ?? raw.r ?? territory.y, 0);
  const tileId = raw.tile?.id || raw.tileId || WorldMapService.getTileId(x, y);
  const mapTerrain = normalizeMapTerrainId(raw.tile?.terrain || raw.mapTerrain || territory.mapTerrain || territory.tileTerrain || territory.worldTerrain)
    || normalizeMapTerrainId(territory.terrain);
  const terrain = getPlanningTerrainForMapTerrain(raw.terrain || territory.terrain || mapTerrain);
  const garrison = normalizeGarrison(raw.defender || raw.garrison || territory.garrison, {
    ...territory,
    x,
    y,
    mapTerrain: mapTerrain || territory.mapTerrain,
  }, now);
  return {
    source: raw.source || 'tile-map',
    tile: {
      id: tileId,
      q: x,
      r: y,
      terrain: mapTerrain || raw.tile?.terrain || territory.mapTerrain || 'plains',
    },
    site: {
      id: raw.site?.id || territory.id || raw.siteId || '',
      type: raw.site?.type || territory.type || '',
      owner: raw.site?.owner || territory.owner || 'neutral',
      status: raw.site?.status || territory.status || 'discovered',
      name: raw.site?.name || territory.naturalName || territory.cityName || '',
      scale: Math.max(1, toInteger(raw.site?.scale ?? territory.scale, 1)),
      threat: Math.max(0, toInteger(raw.site?.threat ?? territory.threat, 0)),
      mapTerrain: raw.site?.mapTerrain || mapTerrain || null,
      terrain: raw.site?.terrain || terrain,
    },
    defender: garrison,
    intelSnapshot: {
      knownTerrain: true,
      knownSite: true,
      knownOwner: true,
      knownGarrison: Boolean(garrison),
      knownLeader: Boolean(garrison?.leader),
      knownSkill: Boolean(garrison?.leader?.abilityKit),
      ...(raw.intelSnapshot && typeof raw.intelSnapshot === 'object' ? raw.intelSnapshot : {}),
    },
  };
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
    x: hasFiniteValue(rawTerritory.x) ? rawTerritory.x : migration.x,
    y: hasFiniteValue(rawTerritory.y) ? rawTerritory.y : migration.y,
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
  const mapTerrain = normalizeMapTerrainId(rawTerritory.mapTerrain || rawTerritory.tileTerrain || rawTerritory.worldTerrain)
    || normalizeMapTerrainId(rawTerritory.terrain);
  const planningTerrain = rawTerritory.terrain || mapTerrain
    ? getPlanningTerrainForMapTerrain(rawTerritory.terrain || mapTerrain)
    : null;
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
    defenderLeader: rawTerritory.defenderLeader || rawTerritory.garrison?.leader || null,
    garrison: rawTerritory.garrison || null,
    battleTarget: rawTerritory.battleTarget || null,
  };
  if (planningTerrain) normalized.terrain = planningTerrain;
  if (mapTerrain) normalized.mapTerrain = mapTerrain;
  normalized.garrison = normalizeGarrison(normalized.garrison, normalized, normalized.discoveredAt || now);
  normalized.defenderLeader = normalized.garrison?.leader || null;
  normalized.battleTarget = normalized.battleTarget
    ? normalizeBattleTarget(normalized.battleTarget, normalized, normalized.discoveredAt || now)
    : null;
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
        const hasStoredRoute = Array.isArray(mission.route) && mission.route.length > 0;
        const hasStoredRevealArea = Array.isArray(mission.revealArea) && mission.revealArea.length > 0;
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
        const revealArea = Array.isArray(mission.revealArea) && mission.revealArea.length
          ? mission.revealArea.map((coord, index) => {
            const q = toInteger(coord.q, targetX);
            const r = toInteger(coord.r, targetY);
            return {
              q,
              r,
              step: Math.max(1, toInteger(coord.step, index + 1)),
              kind: coord.kind === 'branch' ? 'branch' : 'main',
              tileId: coord.tileId || WorldMapService.getTileId(q, r),
              revealed: Boolean(coord.revealed),
            };
          })
          : [];
        const revealAreaSource = typeof mission.revealAreaSource === 'string' && mission.revealAreaSource
          ? mission.revealAreaSource
          : hasStoredRevealArea
            ? 'directional-route-v1'
            : hasStoredRoute
              ? 'legacy-route'
              : 'legacy-target';
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
          siteX: hasFiniteValue(mission.siteX) ? toInteger(mission.siteX, targetX) : null,
          siteY: hasFiniteValue(mission.siteY) ? toInteger(mission.siteY, targetY) : null,
          siteTerrain: normalizeMapTerrainId(mission.siteTerrain),
          scoutDistance: Math.max(1, toInteger(mission.scoutDistance, getRelativeDistance(originX, originY, targetX, targetY))),
          actionPoints,
          actionPointsRemaining: Math.max(0, toInteger(mission.actionPointsRemaining, mission.status === 'ready' ? 0 : actionPoints)),
          route,
          revealArea,
          revealAreaSource,
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
        battleTarget: mission.battleTarget ? normalizeBattleTarget(mission.battleTarget, { id: mission.territoryId }, mission.startedAt || new Date().toISOString()) : null,
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

function normalizeScoutReportTileSnapshot(report) {
  const q = hasFiniteValue(report?.q) ? toInteger(report.q, 0) : null;
  const r = hasFiniteValue(report?.r) ? toInteger(report.r, 0) : null;
  const tileId = typeof report?.tileId === 'string' && report.tileId
    ? report.tileId
    : q !== null && r !== null
      ? WorldMapService.getTileId(q, r)
      : null;
  if (!tileId) return {};
  const mapTerrain = normalizeMapTerrainId(report.mapTerrain || report.tile?.terrain) || null;
  const terrain = report.terrain
    ? getPlanningTerrainForMapTerrain(report.terrain)
    : mapTerrain
      ? getPlanningTerrainForMapTerrain(mapTerrain)
      : null;
  return {
    tileId,
    q,
    r,
    mapTerrain,
    terrain,
    tile: {
      id: tileId,
      q,
      r,
      terrain: mapTerrain,
    },
  };
}

function normalizeScoutReportRevealArea(report) {
  const revealArea = (Array.isArray(report?.revealArea) ? report.revealArea : [])
    .filter((coord) => coord && typeof coord === 'object')
    .map((coord) => {
      const q = toInteger(coord.q, 0);
      const r = toInteger(coord.r, 0);
      return {
        q,
        r,
        step: Math.max(0, toInteger(coord.step, 0)),
        kind: coord.kind === 'branch' ? 'branch' : 'main',
        tileId: coord.tileId || WorldMapService.getTileId(q, r),
        revealed: coord.revealed !== false,
      };
    });
  return revealArea.length ? { revealArea } : {};
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
      ...normalizeScoutReportTileSnapshot(report),
      ...normalizeScoutReportRevealArea(report),
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

function normalizeScoutAreaRecords(rawAreas) {
  const known = new Map();
  for (const area of Array.isArray(rawAreas) ? rawAreas : []) {
    if (!area || typeof area !== 'object') continue;
    const targetX = toInteger(area.targetX, 0);
    const targetY = toInteger(area.targetY, 0);
    if (targetX === 0 && targetY === 0) continue;
    const result = area.result === 'site' ? 'site' : area.result === 'empty' ? 'empty' : null;
    if (!result) continue;
    const coords = Array.from(new Map((Array.isArray(area.coords) ? area.coords : [])
      .filter((coord) => coord && typeof coord === 'object')
      .map((coord) => {
        const q = toInteger(coord.q, 0);
        const r = toInteger(coord.r, 0);
        return [getCoordinateKey(q, r), { q, r, tileId: WorldMapService.getTileId(q, r) }];
      })).values())
      .sort((a, b) => (
        getRelativeDistance(targetX, targetY, a.q, a.r) - getRelativeDistance(targetX, targetY, b.q, b.r)
        || a.q - b.q
        || a.r - b.r
      ));
    const tileIds = Array.from(new Set([
      ...(Array.isArray(area.tileIds) ? area.tileIds : []).filter(Boolean).map(String),
      ...coords.map((coord) => coord.tileId),
    ])).sort();
    if (!tileIds.length) continue;
    const key = area.id || `${getCoordinateKey(targetX, targetY)}:${tileIds.join('|')}`;
    known.set(String(key), {
      id: String(key),
      missionId: typeof area.missionId === 'string' && area.missionId ? area.missionId : null,
      direction: normalizeDirection(area.direction) || null,
      originX: toInteger(area.originX, 0),
      originY: toInteger(area.originY, 0),
      targetX,
      targetY,
      result,
      siteId: typeof area.siteId === 'string' && area.siteId ? area.siteId : null,
      tileIds,
      coords,
      scoutedAt: area.scoutedAt || new Date().toISOString(),
    });
  }
  return [...known.values()]
    .sort((a, b) => String(a.scoutedAt).localeCompare(String(b.scoutedAt)) || getDistance(a.targetX, a.targetY) - getDistance(b.targetX, b.targetY))
    .slice(-MAX_SCOUT_AREA_RECORDS);
}

function normalizeScoutState(rawState) {
  const raw = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    emptyStreak: Math.max(0, toInteger(raw.emptyStreak, 0)),
    neutralSiteStreak: Math.max(0, toInteger(raw.neutralSiteStreak, 0)),
    areas: normalizeScoutAreaRecords(raw.areas),
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

function getScoutAreaTileIds(mission) {
  const revealArea = Array.isArray(mission?.revealArea) ? mission.revealArea : [];
  const revealedTileIds = Array.isArray(mission?.revealedTileIds) ? mission.revealedTileIds : [];
  return Array.from(new Set([
    ...revealArea.map((coord) => WorldMapService.getTileId(coord.q, coord.r)),
    ...revealedTileIds.filter(Boolean).map(String),
  ])).sort();
}

function upsertScoutAreaRecord(gameState, mission, result, options = {}) {
  gameState.scoutState = normalizeScoutState(gameState.scoutState);
  const scoutedAt = options.scoutedAt || new Date().toISOString();
  const revealArea = ensureMissionRevealArea(gameState, mission, options.now || new Date());
  const coords = revealArea.map((coord) => ({
    q: toInteger(coord.q, 0),
    r: toInteger(coord.r, 0),
    tileId: WorldMapService.getTileId(coord.q, coord.r),
  }));
  const resolved = getScoutResolvedCoordinate(mission);
  const targetX = toInteger(resolved.x, 0);
  const targetY = toInteger(resolved.y, 0);
  const record = {
    id: mission.id || `scout_area_${targetX}_${targetY}_${scoutedAt}`,
    missionId: mission.id || null,
    direction: mission.direction || null,
    originX: toInteger(mission.originX, 0),
    originY: toInteger(mission.originY, 0),
    targetX,
    targetY,
    result,
    siteId: options.siteId || null,
    tileIds: getScoutAreaTileIds(mission),
    coords,
    scoutedAt,
  };
  gameState.scoutState.areas = normalizeScoutAreaRecords([
    ...(gameState.scoutState.areas || []),
    record,
  ]);
  return gameState.scoutState.areas.find((area) => area.id === record.id) || record;
}

function syncScoutCoordinatesWithTerritories(gameState, now = new Date().toISOString()) {
  WorldMapService.ensureWorldMap(gameState, new Date(now));
  const territoryIds = new Set((gameState.territories || []).map((territory) => territory.id).filter(Boolean));
  gameState.worldMap.tiles = (gameState.worldMap.tiles || []).map((tile) => (
    tile.siteId && tile.siteId !== 'capital' && !territoryIds.has(tile.siteId)
      ? { ...tile, siteId: null }
      : tile
  ));
  for (const territory of gameState.territories || []) {
    const controlled = territory.status === 'occupied' && territory.owner === 'player';
    WorldMapService.bindSiteToTile(gameState, territory.x, territory.y, territory.id, now, {
      visibility: controlled ? 'controlled' : 'scouted',
    });
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

function revealSolidKnownWorldTiles(gameState, now = new Date().toISOString()) {
  WorldMapService.ensureWorldMap(gameState, new Date(now));
  const known = new Map();
  for (const tile of gameState.worldMap.tiles || []) {
    if (!tile || tile.discovered === false) continue;
    const x = toInteger(tile.q, 0);
    const y = toInteger(tile.r, 0);
    known.set(getCoordinateKey(x, y), { x, y });
  }
  for (const territory of gameState.territories || []) {
    if (!territory || !Number.isFinite(Number(territory.x)) || !Number.isFinite(Number(territory.y))) continue;
    const x = toInteger(territory.x, 0);
    const y = toInteger(territory.y, 0);
    known.set(getCoordinateKey(x, y), { x, y });
  }
  let added = 0;
  let changed = true;
  while (changed) {
    changed = false;
    const byX = new Map();
    const byY = new Map();
    for (const coord of known.values()) {
      if (!byX.has(coord.x)) byX.set(coord.x, []);
      if (!byY.has(coord.y)) byY.set(coord.y, []);
      byX.get(coord.x).push(coord.y);
      byY.get(coord.y).push(coord.x);
    }
    const bridgeKeys = new Set();
    for (const [x, ys] of byX.entries()) {
      const sorted = Array.from(new Set(ys)).sort((a, b) => a - b);
      for (let index = 1; index < sorted.length; index += 1) {
        for (let y = sorted[index - 1] + 1; y < sorted[index]; y += 1) {
          bridgeKeys.add(getCoordinateKey(x, y));
        }
      }
    }
    for (const [y, xs] of byY.entries()) {
      const sorted = Array.from(new Set(xs)).sort((a, b) => a - b);
      for (let index = 1; index < sorted.length; index += 1) {
        for (let x = sorted[index - 1] + 1; x < sorted[index]; x += 1) {
          bridgeKeys.add(getCoordinateKey(x, y));
        }
      }
    }
    for (const key of bridgeKeys) {
      if (known.has(key)) continue;
      const [x, y] = key.split(',').map((value) => toInteger(value, 0));
      WorldMapService.revealTile(gameState, x, y, now);
      known.set(key, { x, y });
      added += 1;
      changed = true;
    }
  }
  return added;
}

function clearWorldTileSiteBindings(gameState, preserveCapital = true) {
  WorldMapService.ensureWorldMap(gameState);
  gameState.worldMap.tiles = (gameState.worldMap.tiles || []).map((tile) => {
    if (preserveCapital && tile.siteId === 'capital') return tile;
    return tile.siteId ? { ...tile, siteId: null } : tile;
  });
}

function getDirectionFromDelta(dx, dy) {
  const sx = Math.sign(toInteger(dx, 0));
  const sy = Math.sign(toInteger(dy, 0));
  return Object.entries(DIRECTIONS)
    .find(([_direction, vector]) => vector.dx === sx && vector.dy === sy)?.[0] || 'e';
}

function getAreaRecordForSite(gameState, siteId) {
  if (!siteId) return null;
  return (gameState.scoutState?.areas || [])
    .filter((area) => area?.siteId === siteId)
    .sort((a, b) => String(b.scoutedAt || '').localeCompare(String(a.scoutedAt || '')))[0] || null;
}

function buildMigrationMissionForTerritory(gameState, territory, now = new Date()) {
  const area = getAreaRecordForSite(gameState, territory.id);
  const originX = toInteger(area?.originX, 0);
  const originY = toInteger(area?.originY, 0);
  const targetX = toInteger(area?.targetX, territory.x);
  const targetY = toInteger(area?.targetY, territory.y);
  const direction = normalizeDirection(area?.direction)
    || getDirectionFromDelta(targetX - originX, targetY - originY);
  const distance = Math.max(1, getRelativeDistance(originX, originY, targetX, targetY));
  const route = WorldMapService.buildScoutRoute(
    { q: originX, r: originY },
    direction,
    SCOUT_ACTION_POINTS,
    { startDistance: Math.max(1, distance - SCOUT_ACTION_POINTS + 1) },
  );
  const revealArea = WorldMapService.getScoutRevealArea(
    WorldMapService.ensureWorldMap(gameState, now).seed,
    route,
    direction,
  ).map((coord) => ({
    ...coord,
    tileId: WorldMapService.getTileId(coord.q, coord.r),
    revealed: true,
  }));
  return {
    id: `migration_${territory.id}`,
    kind: 'scout',
    direction,
    originX,
    originY,
    targetX,
    targetY,
    scoutDistance: distance,
    route: route.map((step) => ({
      ...step,
      tileId: WorldMapService.getTileId(step.q, step.r),
      revealed: revealArea.some((coord) => coord.kind === 'main' && coord.q === step.q && coord.r === step.r),
    })),
    revealArea,
    revealAreaSource: 'directional-route-v1',
    revealedTileIds: revealArea.map((coord) => coord.tileId),
  };
}

function getMigrationSearchCoordinates(mission, maxDistance = MAX_MIGRATION_SITE_SEARCH_DISTANCE) {
  const direction = DIRECTIONS[mission.direction] || DIRECTIONS.e;
  const originX = toInteger(mission.originX, 0);
  const originY = toInteger(mission.originY, 0);
  const targetX = toInteger(mission.targetX, originX + direction.dx);
  const targetY = toInteger(mission.targetY, originY + direction.dy);
  const targetDistance = Math.max(1, getRelativeDistance(originX, originY, targetX, targetY));
  const seen = new Set();
  const coords = [];
  const addCoord = (q, r, priority) => {
    const key = getCoordinateKey(q, r);
    if (seen.has(key)) return;
    seen.add(key);
    coords.push({ q, r, priority });
  };
  for (let distance = 1; distance <= maxDistance; distance += 1) {
    const centerX = originX + direction.dx * distance;
    const centerY = originY + direction.dy * distance;
    const radius = Math.max(1, Math.min(6, Math.abs(distance - targetDistance) + 2));
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) continue;
        const q = centerX + dx;
        const r = centerY + dy;
        if (q === 0 && r === 0) continue;
        const progress = (q - originX) * direction.dx + (r - originY) * direction.dy;
        if (progress < Math.max(1, distance - radius)) continue;
        addCoord(q, r, distance);
      }
    }
  }
  for (let distance = 1; distance <= maxDistance; distance += 1) {
    for (let dx = -distance; dx <= distance; dx += 1) {
      for (let dy = -distance; dy <= distance; dy += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== distance) continue;
        const q = originX + dx;
        const r = originY + dy;
        if (q === 0 && r === 0) continue;
        addCoord(q, r, maxDistance + distance);
      }
    }
  }
  return coords;
}

function getNearestSiteDistanceFromTerritories(territories, x, y, ignoredId = '') {
  const distances = (Array.isArray(territories) ? territories : [])
    .filter((territory) => territory?.id !== ignoredId && Number.isFinite(Number(territory?.x)) && Number.isFinite(Number(territory?.y)))
    .map((territory) => getRelativeDistance(territory.x, territory.y, x, y));
  if (!distances.length) return MAX_SCOUT_DISTANCE;
  return Math.min(...distances);
}

function scoreMigratedSiteCandidate(gameState, mission, territory, coord, placedTerritories, seed) {
  const q = toInteger(coord.q, 0);
  const r = toInteger(coord.r, 0);
  if (!WorldMapService.canPlaceSiteOnTerrain(seed, q, r)) return null;
  const nearestDistance = getNearestSiteDistanceFromTerritories(placedTerritories, q, r, territory.id);
  const valid = nearestDistance >= SCOUT_SITE_MIN_DISTANCE;
  if (!valid) return null;
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
  const searchPriority = Math.max(1, toInteger(coord.priority, distance));
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
      + Math.min(20, Math.max(0, nearestDistance - SCOUT_SITE_MIN_DISTANCE + 1) * 5)
      + stableNoise,
    searchPriority,
  };
}

function getCurrentRuleSiteCoordinate(gameState, territory, placedTerritories, now = new Date()) {
  const seed = WorldMapService.ensureWorldMap(gameState, now).seed;
  const mission = buildMigrationMissionForTerritory(gameState, territory, now);
  return getMigrationSearchCoordinates(mission)
    .map((coord) => scoreMigratedSiteCandidate(gameState, mission, territory, coord, placedTerritories, seed))
    .filter(Boolean)
    .sort((a, b) => a.searchPriority - b.searchPriority || b.score - a.score || b.distance - a.distance || a.q - b.q || a.r - b.r)[0] || null;
}

function retargetTerritoryToCurrentRules(gameState, territory, coord, now = new Date()) {
  const oldX = toInteger(territory.x, 0);
  const oldY = toInteger(territory.y, 0);
  const x = toInteger(coord.q, oldX);
  const y = toInteger(coord.r, oldY);
  territory.x = x;
  territory.y = y;
  const terrain = coord.terrain || WorldMapService.chooseTerrain(WorldMapService.ensureWorldMap(gameState, now).seed, x, y);
  territory.mapTerrain = normalizeMapTerrainId(terrain) || terrain;
  territory.terrain = getPlanningTerrainForMapTerrain(terrain);
  territory.visualOffset = createVisualOffset(x, y, territory.id || territory.naturalName || territory.type);
  if (territory.garrison) {
    territory.garrison.siteId = territory.id;
    territory.garrison.generatedAt = territory.garrison.generatedAt || territory.discoveredAt || now.toISOString();
  }
  territory.defenderLeader = territory.garrison?.leader || territory.defenderLeader || null;
  territory.battleTarget = territory.battleTarget
    ? normalizeBattleTarget({
      ...territory.battleTarget,
      q: x,
      r: y,
      tileId: WorldMapService.getTileId(x, y),
      mapTerrain: territory.mapTerrain,
      terrain: territory.terrain,
      tile: { id: WorldMapService.getTileId(x, y), q: x, r: y, terrain: territory.mapTerrain },
      site: { ...(territory.battleTarget.site || {}), id: territory.id, mapTerrain: territory.mapTerrain, terrain: territory.terrain },
      defender: territory.garrison,
    }, territory, territory.discoveredAt || now.toISOString())
    : null;
  return territory;
}

function migrateTerritorySitesToCurrentWorldRules(gameState, previousWorldMapVersion, now = new Date()) {
  if (previousWorldMapVersion >= WorldMapService.WORLD_MAP_VERSION) return false;
  const placed = [];
  let changed = false;
  let normalizedAny = false;
  for (const territory of gameState.territories || []) {
    if (territory.id === 'capital' || territory.x === 0 && territory.y === 0) {
      placed.push(territory);
      continue;
    }
    const coord = getCurrentRuleSiteCoordinate(gameState, territory, placed, now);
    if (!coord) {
      throw new Error(`Unable to generate legal world site coordinate for ${territory.id}`);
    }
    const oldX = territory.x;
    const oldY = territory.y;
    retargetTerritoryToCurrentRules(gameState, territory, coord, now);
    changed = changed || oldX !== territory.x || oldY !== territory.y;
    normalizedAny = true;
    placed.push(territory);
  }
  if (normalizedAny) {
    gameState.scoutedCoordinates = [];
    clearWorldTileSiteBindings(gameState);
  }
  return changed;
}

function getKnownWorldCoordinateKeys(gameState) {
  const worldMap = WorldMapService.ensureWorldMap(gameState);
  return new Set((worldMap.tiles || [])
    .filter((tile) => tile.discovered !== false)
    .map((tile) => getCoordinateKey(tile.q, tile.r)));
}

function getScoutedAreaTileIdSet(gameState) {
  gameState.scoutState = normalizeScoutState(gameState.scoutState);
  return new Set((gameState.scoutState.areas || [])
    .flatMap((area) => Array.isArray(area.tileIds) ? area.tileIds : [])
    .filter(Boolean)
    .map(String));
}

function hasSiteSpacing(gameState, x, y) {
  return getSiteSpacingProfile(gameState, x, y).valid;
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

function getScoutResolvedCoordinate(mission) {
  const hasSiteX = hasFiniteValue(mission?.siteX);
  const hasSiteY = hasFiniteValue(mission?.siteY);
  if (!hasSiteX && !hasSiteY && isDirectionalScoutAreaMission(mission) && Array.isArray(mission.revealArea) && mission.revealArea.length) {
    const mainArea = mission.revealArea
      .filter((coord) => coord?.kind === 'main')
      .sort((a, b) => toInteger(a.step, 0) - toInteger(b.step, 0));
    const revealedMainArea = mainArea.filter((coord) => coord.revealed);
    const resolved = (revealedMainArea.length ? revealedMainArea : mainArea).at(-1)
      || mission.revealArea
        .slice()
        .sort((a, b) => toInteger(a.step, 0) - toInteger(b.step, 0))
        .at(-1);
    if (resolved && hasFiniteValue(resolved.q) && hasFiniteValue(resolved.r)) {
      return {
        x: toInteger(resolved.q, 0),
        y: toInteger(resolved.r, 0),
      };
    }
  }
  return {
    x: hasSiteX ? toInteger(mission.siteX, 0) : toInteger(mission.targetX, 0),
    y: hasSiteY ? toInteger(mission.siteY, 0) : toInteger(mission.targetY, 0),
  };
}

function isDirectionalScoutAreaMission(mission) {
  return mission?.revealAreaSource === 'directional-route-v1';
}

function getExistingScoutAreaSite(gameState, mission, now = new Date()) {
  const areaKeys = new Set(ensureMissionRevealArea(gameState, mission, now)
    .map((coord) => getCoordinateKey(coord.q, coord.r)));
  if (!areaKeys.size) return null;
  const originX = toInteger(mission.originX, 0);
  const originY = toInteger(mission.originY, 0);
  const targetX = toInteger(mission.targetX, 0);
  const targetY = toInteger(mission.targetY, 0);
  return (gameState.territories || [])
    .filter((territory) => territory.id !== 'capital' && areaKeys.has(getCoordinateKey(territory.x, territory.y)))
    .sort((a, b) => (
      getRelativeDistance(targetX, targetY, a.x, a.y) - getRelativeDistance(targetX, targetY, b.x, b.y)
      || getRelativeDistance(originX, originY, a.x, a.y) - getRelativeDistance(originX, originY, b.x, b.y)
      || String(a.id).localeCompare(String(b.id))
    ))[0] || null;
}

function getTerritoryBattleTileSnapshot(gameState, territory, now = new Date()) {
  const x = toInteger(territory?.x, 0);
  const y = toInteger(territory?.y, 0);
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const tileId = WorldMapService.getTileId(x, y);
  const tile = (worldMap.tiles || []).find((item) => item.id === tileId || (item.q === x && item.r === y)) || null;
  const mapTerrain = normalizeMapTerrainId(territory?.mapTerrain || territory?.tileTerrain || territory?.worldTerrain)
    || normalizeMapTerrainId(tile?.terrain)
    || normalizeMapTerrainId(territory?.terrain)
    || WorldMapService.chooseTerrain(worldMap.seed, x, y);
  const planningTerrain = getPlanningTerrainForMapTerrain(territory?.terrain || mapTerrain);
  return {
    tileId,
    q: x,
    r: y,
    mapTerrain,
    terrain: planningTerrain,
    tile: {
      id: tileId,
      q: x,
      r: y,
      terrain: mapTerrain,
    },
  };
}

function attachBattleTileSnapshot(report, snapshot, battleTarget = null) {
  if (!report || typeof report !== 'object') return report;
  return {
    ...report,
    tileId: snapshot.tileId,
    q: snapshot.q,
    r: snapshot.r,
    mapTerrain: snapshot.mapTerrain,
    terrain: snapshot.terrain,
    tile: { ...snapshot.tile },
    ...(battleTarget ? { battleTarget } : {}),
  };
}

function getTerritoryBattleTargetSnapshot(gameState, territory, now = new Date()) {
  const tileSnapshot = getTerritoryBattleTileSnapshot(gameState, territory, now);
  return normalizeBattleTarget({
    source: 'tile-map',
    tileId: tileSnapshot.tileId,
    q: tileSnapshot.q,
    r: tileSnapshot.r,
    mapTerrain: tileSnapshot.mapTerrain,
    terrain: tileSnapshot.terrain,
    tile: tileSnapshot.tile,
    defender: territory?.garrison || null,
    intelSnapshot: {
      knownTerrain: true,
      knownSite: true,
      knownOwner: true,
      knownGarrison: Boolean(territory?.garrison),
      knownLeader: Boolean(territory?.garrison?.leader || territory?.defenderLeader),
      knownSkill: Boolean((territory?.garrison?.leader || territory?.defenderLeader)?.abilityKit),
    },
  }, territory, now.toISOString());
}

function getScoutReportRevealAreaSnapshot(gameState, mission, now = new Date()) {
  return ensureMissionRevealArea(gameState, mission, now)
    .map((coord) => {
      const q = toInteger(coord.q, 0);
      const r = toInteger(coord.r, 0);
      return {
        q,
        r,
        step: Math.max(0, toInteger(coord.step, 0)),
        kind: coord.kind === 'branch' ? 'branch' : 'main',
        tileId: coord.tileId || WorldMapService.getTileId(q, r),
        revealed: coord.revealed !== false,
      };
    });
}

function getScoutReportTileSnapshot(gameState, mission, now = new Date(), options = {}) {
  const resolved = getScoutResolvedCoordinate(mission);
  const x = toInteger(options.x, resolved.x);
  const y = toInteger(options.y, resolved.y);
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const tileId = WorldMapService.getTileId(x, y);
  const tile = (worldMap.tiles || []).find((item) => item.id === tileId || (item.q === x && item.r === y)) || null;
  const mapTerrain = normalizeMapTerrainId(options.mapTerrain)
    || normalizeMapTerrainId(tile?.terrain)
    || WorldMapService.chooseTerrain(worldMap.seed, x, y);
  const terrain = getPlanningTerrainForMapTerrain(options.terrain || mapTerrain);
  return {
    tileId,
    q: x,
    r: y,
    mapTerrain,
    terrain,
    tile: {
      id: tileId,
      q: x,
      r: y,
      terrain: mapTerrain,
    },
  };
}

function attachScoutReportMapSnapshot(gameState, mission, report, now = new Date(), options = {}) {
  if (!report || typeof report !== 'object') return report;
  const tileSnapshot = getScoutReportTileSnapshot(gameState, mission, now, options);
  return normalizeScoutReport({
    ...report,
    ...tileSnapshot,
    revealArea: getScoutReportRevealAreaSnapshot(gameState, mission, now),
  });
}

function ensureMissionRevealArea(gameState, mission, now = new Date()) {
  mission.route = Array.isArray(mission.route) ? mission.route : [];
  if (!mission.route.length) {
    const originX = toInteger(mission.originX, 0);
    const originY = toInteger(mission.originY, 0);
    const targetX = toInteger(mission.targetX, originX);
    const targetY = toInteger(mission.targetY, originY);
    const actionPoints = Math.max(1, toInteger(mission.actionPoints, SCOUT_ACTION_POINTS));
    const scoutDistance = Math.max(1, toInteger(mission.scoutDistance, getRelativeDistance(originX, originY, targetX, targetY)));
    mission.route = WorldMapService.buildScoutRoute(
      { q: originX, r: originY },
      mission.direction,
      actionPoints,
      { startDistance: Math.max(1, scoutDistance - actionPoints + 1) },
    ).map((step) => ({
      ...step,
      tileId: WorldMapService.getTileId(step.q, step.r),
      revealed: false,
    }));
    if (!mission.route.some((step) => step.q === targetX && step.r === targetY)) {
      mission.route.push({
        q: targetX,
        r: targetY,
        step: mission.route.length + 1,
        tileId: WorldMapService.getTileId(targetX, targetY),
        revealed: false,
      });
    }
  }
  if (!Array.isArray(mission.revealArea) || !mission.revealArea.length) {
    mission.revealAreaSource = mission.revealAreaSource || (mission.route.length > 1 ? 'legacy-route' : 'legacy-target');
    const seed = WorldMapService.ensureWorldMap(gameState, now).seed;
    mission.revealArea = WorldMapService.getScoutRevealArea(seed, mission.route, mission.direction)
      .map((coord) => ({
        ...coord,
        tileId: WorldMapService.getTileId(coord.q, coord.r),
        revealed: mission.route.some((step) => step.q === coord.q && step.r === coord.r && step.revealed),
      }));
  }
  return mission.revealArea;
}

function getScoutCandidateCoordinates(gameState, mission, now = new Date()) {
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const targetX = toInteger(mission.targetX, 0);
  const targetY = toInteger(mission.targetY, 0);
  const revealedIds = new Set(Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds.filter(Boolean) : []);
  const strictRevealArea = mission.revealAreaSource === 'directional-route-v1';
  const revealArea = ensureMissionRevealArea(gameState, mission, now);
  const coords = [];
  const known = new Set();
  const addCoord = (q, r) => {
    const key = getCoordinateKey(q, r);
    if (known.has(key)) return;
    known.add(key);
    coords.push({ q, r });
  };

  for (const tile of worldMap.tiles || []) {
    if (revealedIds.has(tile.id)) {
      addCoord(toInteger(tile.q, 0), toInteger(tile.r, 0));
      continue;
    }
    if (strictRevealArea) continue;
    const q = toInteger(tile.q, 0);
    const r = toInteger(tile.r, 0);
    if (getRelativeDistance(targetX, targetY, q, r) > 1) continue;
    addCoord(toInteger(tile.q, 0), toInteger(tile.r, 0));
  }
  for (const coord of revealArea) {
    if (coord.revealed || revealedIds.has(WorldMapService.getTileId(coord.q, coord.r))) {
      addCoord(coord.q, coord.r);
    }
  }
  if (!coords.length) addCoord(targetX, targetY);
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
  if (getScoutCoordinateRecord(gameState, q, r)) return null;
  if (!WorldMapService.canPlaceSiteOnTerrain(seed, q, r)) return null;
  const spacing = getSiteSpacingProfile(gameState, q, r);
  if (!spacing.valid) return null;
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
    nearestSiteDistance: spacing.nearestDistance,
    spacingScore: spacing.score,
    score:
      terrainScore * 10
      + Math.min(distance, targetDistance + 2) * 2
      + targetCloseness * 5
      + directionProgress * 8
      + spacing.score
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

function ensureScoutMissionAreaRevealed(gameState, mission, now = new Date()) {
  const revealArea = ensureMissionRevealArea(gameState, mission, now);
  mission.revealedTileIds = Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [];
  const alreadyRevealedIds = new Set(mission.revealedTileIds.filter(Boolean));
  const pending = revealArea.filter((coord) => !coord.revealed && !alreadyRevealedIds.has(WorldMapService.getTileId(coord.q, coord.r)));
  if (!pending.length) return [];
  const revealedTiles = WorldMapService.revealScoutArea(gameState, pending, now);
  for (const coord of pending) {
    coord.revealed = true;
    coord.tileId = WorldMapService.getTileId(coord.q, coord.r);
  }
  mission.route = (Array.isArray(mission.route) ? mission.route : []).map((step) => ({
    ...step,
    revealed: revealArea.some((coord) => coord.kind === 'main' && coord.q === step.q && coord.r === step.r && coord.revealed),
  }));
  mission.revealedTileIds = Array.from(new Set([
    ...mission.revealedTileIds,
    ...revealedTiles.map((tile) => tile.id),
  ]));
  WorldMapService.recordScoutTrail(gameState, mission, mission.revealedTileIds, mission.status === 'ready');
  return revealedTiles;
}

function normalizeTerritoryState(gameState, now = new Date(), options = {}) {
  const isoNow = now.toISOString();
  const previousWorldMapVersion = options.previousWorldMapVersion ?? WorldMapService.getWorldMapVersion(gameState.worldMap);
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
  migrateTerritorySitesToCurrentWorldRules(gameState, previousWorldMapVersion, now);
  revealSolidKnownWorldTiles(gameState, isoNow);
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
  const revealArea = ensureMissionRevealArea(gameState, mission, now);
  const strictRevealArea = isDirectionalScoutAreaMission(mission);
  let nextStepAt = new Date(mission.nextStepAt || mission.startedAt || now).getTime();
  if (!Number.isFinite(nextStepAt)) nextStepAt = nowMs;
  mission.revealedTileIds = Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [];
  mission.actionPointsRemaining = Math.max(0, toInteger(mission.actionPointsRemaining, mission.actionPoints || SCOUT_ACTION_POINTS));

  for (const step of route) {
    if (step.revealed) continue;
    if (mission.actionPointsRemaining <= 0 || nextStepAt > nowMs) break;
    const stepArea = revealArea.filter((coord) => coord.step === step.step && !coord.revealed);
    const revealTargets = stepArea.length || !strictRevealArea ? (stepArea.length ? stepArea : [step]) : [];
    const revealedTiles = WorldMapService.revealScoutArea(gameState, revealTargets, now);
    const tile = revealedTiles.find((item) => item.q === step.q && item.r === step.r) || revealedTiles[0] || null;
    step.tileId = tile?.id || step.tileId || WorldMapService.getTileId(step.q, step.r);
    step.revealed = true;
    for (const coord of stepArea) {
      coord.revealed = true;
      coord.tileId = WorldMapService.getTileId(coord.q, coord.r);
    }
    mission.revealedTileIds = Array.from(new Set([
      ...mission.revealedTileIds,
      ...revealedTiles.map((item) => item.id),
    ]));
    mission.actionPointsRemaining = Math.max(0, mission.actionPointsRemaining - 1);
    nextStepAt += SCOUT_STEP_DURATION_MS;
  }

  mission.nextStepAt = new Date(nextStepAt).toISOString();
  const routeDone = route.every((step) => step.revealed);
  if (mission.actionPointsRemaining <= 0 || routeDone || new Date(mission.completesAt).getTime() <= nowMs) {
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

function getControlledScoutOrigins(gameState, fallbackOrigin = getScoutOrigin(gameState)) {
  const origins = [];
  const seen = new Set();
  const territoryByCoord = new Map((gameState.territories || []).map((territory) => [
    getCoordinateKey(territory.x, territory.y),
    territory,
  ]));
  const addOrigin = (origin) => {
    const x = toInteger(origin?.x, 0);
    const y = toInteger(origin?.y, 0);
    const key = getCoordinateKey(x, y);
    if (seen.has(key)) return;
    seen.add(key);
    origins.push({
      cityId: origin?.cityId || origin?.id || origin?.territoryId || 'capital',
      territoryId: origin?.territoryId || origin?.id || origin?.cityId || 'capital',
      name: origin?.name || origin?.cityName || origin?.naturalName || '出发城市',
      x,
      y,
    });
  };

  const worldMap = WorldMapService.ensureWorldMap(gameState);
  for (const tile of worldMap.tiles || []) {
    if (tile.visibility !== 'controlled') continue;
    const x = toInteger(tile.q, 0);
    const y = toInteger(tile.r, 0);
    const territory = territoryByCoord.get(getCoordinateKey(x, y));
    const tileId = tile.id || WorldMapService.getTileId(x, y);
    addOrigin({
      cityId: territory?.cityId || territory?.id || tile.siteId || tileId,
      territoryId: territory?.id || tile.siteId || tileId,
      name: territory?.cityName || territory?.naturalName || `控制区 ${x},${y}`,
      x,
      y,
    });
  }

  for (const territory of gameState.territories || []) {
    if (territory.status !== 'occupied') continue;
    addOrigin({
      cityId: territory.cityId || territory.id || 'capital',
      territoryId: territory.id || 'capital',
      name: territory.cityName || territory.naturalName || '出发城市',
      x: territory.x,
      y: territory.y,
    });
  }
  addOrigin(fallbackOrigin);
  return origins;
}

function getScoutRouteForCandidate(origin, direction, distance) {
  return WorldMapService.buildScoutRoute(
    { q: toInteger(origin?.x, 0), r: toInteger(origin?.y, 0) },
    direction,
    SCOUT_ACTION_POINTS,
    { startDistance: Math.max(1, distance - SCOUT_ACTION_POINTS + 1) },
  );
}

function scoreScoutCandidateArea(gameState, direction, origin, distance, knownTileIds) {
  const route = getScoutRouteForCandidate(origin, direction, distance);
  const seed = WorldMapService.ensureWorldMap(gameState).seed;
  const revealArea = WorldMapService.getScoutRevealArea(seed, route, direction);
  let newTileCount = 0;
  let newMainTileCount = 0;
  for (const coord of revealArea) {
    const tileId = WorldMapService.getTileId(coord.q, coord.r);
    if (knownTileIds.has(tileId)) continue;
    newTileCount += 1;
    if (coord.kind === 'main') newMainTileCount += 1;
  }
  if (newTileCount <= 0) return null;
  return {
    distance,
    newTileCount,
    newMainTileCount,
    completeMainPath: newMainTileCount >= Math.min(route.length, WorldMapService.SCOUT_REVEAL_MAIN_LIMIT),
    routeStartDistance: Math.max(1, distance - SCOUT_ACTION_POINTS + 1),
  };
}

function coordinateKeyToTileId(key) {
  const [x, y] = String(key).split(',').map((value) => toInteger(value, 0));
  return WorldMapService.getTileId(x, y);
}

function findNextCoordinateFromOrigin(gameState, direction, origin, occupied, scouted, discovered, scoutedAreaTileIds) {
  const dir = DIRECTIONS[direction];
  if (!dir) return null;
  const originX = toInteger(origin?.x, 0);
  const originY = toInteger(origin?.y, 0);
  const useAreaFrontier = scoutedAreaTileIds.size > 0;
  const knownTileIds = new Set([
    ...Array.from(discovered).map(coordinateKeyToTileId),
    ...Array.from(scouted).map(coordinateKeyToTileId),
    ...scoutedAreaTileIds,
  ]);
  const areaCandidates = [];
  for (let distance = 1; distance <= MAX_SCOUT_DISTANCE; distance += 1) {
    const x = originX + dir.dx * distance;
    const y = originY + dir.dy * distance;
    const key = getCoordinateKey(x, y);
    if (occupied.has(key)) continue;
    if (useAreaFrontier) {
      const score = scoreScoutCandidateArea(gameState, direction, origin, distance, knownTileIds);
      if (!score) continue;
      areaCandidates.push({ x, y, ...score });
      continue;
    }
    if (scouted.has(key) || discovered.has(key)) continue;
    return { x, y, distance };
  }
  if (areaCandidates.length) {
    return areaCandidates.sort((a, b) => (
      Number(b.completeMainPath) - Number(a.completeMainPath)
      || (a.completeMainPath && b.completeMainPath ? a.distance - b.distance : 0)
      || b.newMainTileCount - a.newMainTileCount
      || b.newTileCount - a.newTileCount
      || a.distance - b.distance
    ))[0];
  }
  return null;
}

function getDirectionProjection(origin, dir) {
  return toInteger(origin?.x, 0) * dir.dx + toInteger(origin?.y, 0) * dir.dy;
}

function findNextCoordinate(gameState, direction, origin = getScoutOrigin(gameState)) {
  const dir = DIRECTIONS[direction];
  if (!dir) return null;
  const occupied = new Set((gameState.territories || []).map((territory) => getCoordinateKey(territory.x, territory.y)));
  const scouted = new Set((gameState.scoutedCoordinates || []).map((coordinate) => getCoordinateKey(coordinate.x, coordinate.y)));
  const discovered = getKnownWorldCoordinateKeys(gameState);
  const scoutedAreaTileIds = getScoutedAreaTileIdSet(gameState);
  const candidates = getControlledScoutOrigins(gameState, origin)
    .map((candidateOrigin) => ({
      origin: candidateOrigin,
      target: findNextCoordinateFromOrigin(gameState, direction, candidateOrigin, occupied, scouted, discovered, scoutedAreaTileIds),
      projection: getDirectionProjection(candidateOrigin, dir),
    }))
    .filter((item) => item.target)
    .sort((a, b) => (
      b.projection - a.projection
      || a.target.distance - b.target.distance
      || String(a.origin.territoryId).localeCompare(String(b.origin.territoryId))
    ));
  if (!candidates.length) return null;
  const chosen = candidates[0];
  return { ...chosen.target, origin: chosen.origin };
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

function getTemplateDistanceWeight(template, distance) {
  if (template.type === 'outpost') return distance <= 2 ? 3 : 1.5;
  if (template.type === 'town') return distance <= 1 ? 1.5 : distance <= 4 ? 3 : 2;
  if (template.type === 'camp') return distance <= 1 ? 2.5 : distance <= 4 ? 3 : 2;
  if (template.type === 'city') return distance <= 1 ? 0.5 : distance <= 3 ? 2.5 : 3.5;
  if (template.type === 'ruins') return distance <= 1 ? 0.25 : distance <= 3 ? 2.5 : 4;
  return 1;
}

function getTemplateTerrainWeight(template, terrain) {
  const weights = template.terrainWeights || {};
  return Math.max(0.1, Number(weights[terrain]) || 0.1);
}

function pickWeightedTemplate(pool, terrain, distance, randomSource = Math.random) {
  const weighted = pool.map((template) => ({
    template,
    weight: getTemplateTerrainWeight(template, terrain) * getTemplateDistanceWeight(template, distance),
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = rollUnit(randomSource) * totalWeight;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.template;
  }
  return weighted.at(-1)?.template || pool[0];
}

function pickTemplateForScoutSite(options = {}) {
  const distance = Math.max(1, toInteger(options.distance, 1));
  const terrain = typeof options.terrain === 'string' && options.terrain ? options.terrain : 'plains';
  const neutralSiteStreak = Math.max(0, toInteger(options.neutralSiteStreak, 0));
  const randomSource = options.randomSource || Math.random;
  const neutralPool = [SITE_TEMPLATES[0], SITE_TEMPLATES[1]];
  const ownedPool = distance <= 1
    ? [SITE_TEMPLATES[2]]
    : [SITE_TEMPLATES[2], SITE_TEMPLATES[3], SITE_TEMPLATES[4]];
  const isOwned = rollUnit(randomSource) < getOwnedSiteChance(distance, neutralSiteStreak);
  const pool = isOwned ? ownedPool : neutralPool;
  return pickWeightedTemplate(pool, terrain, distance, randomSource);
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
  const terrain = mission.siteTerrain
    || WorldMapService.chooseTerrain(WorldMapService.ensureWorldMap(gameState, now).seed, x, y);
  const template = pickTemplateForScoutSite({
    terrain,
    distance,
    neutralSiteStreak: gameState.scoutState?.neutralSiteStreak || 0,
    randomSource,
  });
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
    terrain: getPlanningTerrainForMapTerrain(terrain),
    mapTerrain: normalizeMapTerrainId(terrain) || terrain,
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
    garrison: null,
  };
  site.garrison = normalizeGarrison(null, site, now.toISOString());
  site.defenderLeader = site.garrison?.leader || null;
  const report = {
    id: `report_${site.id}_${now.getTime()}`,
    siteId: site.id,
    title,
    text: `侦察队向${DIRECTIONS[direction].label}推进，在距离首都 ${distance} 格的位置发现了${naturalName}。${summary}`,
    direction,
    createdAt: now.toISOString(),
  };
  report.text = `侦察队从${originName}向${DIRECTIONS[direction].label}推进，在距离出发城市 ${distance} 格的位置发现了${naturalName}。${summary}`;
  return {
    site,
    report: attachScoutReportMapSnapshot(gameState, mission, report, now, {
      x,
      y,
      mapTerrain: site.mapTerrain,
      terrain: site.terrain,
    }),
  };
}

function createEmptyScoutReport(gameState, mission, now = new Date(), repeated = false) {
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
  return attachScoutReportMapSnapshot(gameState, mission, report, now, { x, y });
}

function resolveScoutMissionTarget(gameState, mission, now = new Date(), randomSource = Math.random) {
  if (mission.resolvedTarget) return { site: mission.siteId ? getTerritory(gameState, mission.siteId) : null, report: mission.report || null };
  const targetX = toInteger(mission.targetX, 0);
  const targetY = toInteger(mission.targetY, 0);
  const scoutedAt = now.toISOString();
  const existing = (gameState.territories || []).find((territory) => territory.x === targetX && territory.y === targetY) || null;
  const shouldUseLegacyCoordinateRecord = !isDirectionalScoutAreaMission(mission);
  const existingSite = shouldUseLegacyCoordinateRecord
    ? existing
    : getExistingScoutAreaSite(gameState, mission, now);
  const coordinateRecord = shouldUseLegacyCoordinateRecord
    ? getScoutCoordinateRecord(gameState, targetX, targetY)
    : null;

  if (existingSite) {
    mission.resolvedTarget = true;
    mission.result = 'site';
    mission.siteId = existingSite.id;
    mission.report = attachScoutReportMapSnapshot(gameState, mission, {
      id: `report_${existingSite.id}_${now.getTime()}`,
      siteId: existingSite.id,
      title: 'Scout confirmed site',
      text: `Scout confirmed ${existingSite.naturalName || existingSite.id}.`,
      direction: mission.direction,
      createdAt: now.toISOString(),
    }, now, {
      x: existingSite.x,
      y: existingSite.y,
      mapTerrain: existingSite.mapTerrain,
      terrain: existingSite.terrain,
    });
    WorldMapService.bindSiteToTile(gameState, existingSite.x, existingSite.y, existingSite.id, now);
    upsertScoutAreaRecord(gameState, mission, 'site', { siteId: existingSite.id, scoutedAt, now });
    return { site: existingSite, report: mission.report };
  }

  if (coordinateRecord?.result === 'empty') {
    mission.resolvedTarget = true;
    mission.result = 'empty';
    mission.siteId = null;
    mission.report = createEmptyScoutReport(gameState, mission, now, true);
    upsertScoutAreaRecord(gameState, mission, 'empty', { scoutedAt, now });
    return { site: null, report: mission.report };
  }

  if (coordinateRecord?.result === 'site' && coordinateRecord.siteId) {
    const recordedSite = getTerritory(gameState, coordinateRecord.siteId);
    mission.resolvedTarget = true;
    mission.result = 'site';
    mission.siteId = coordinateRecord.siteId;
    mission.report = recordedSite
      ? attachScoutReportMapSnapshot(gameState, mission, {
        id: `report_${recordedSite.id}_${now.getTime()}`,
        siteId: recordedSite.id,
        title: 'Scout confirmed site',
        text: `Scout confirmed ${recordedSite.naturalName || recordedSite.id}.`,
        direction: mission.direction,
        createdAt: now.toISOString(),
      }, now, {
        x: recordedSite.x,
        y: recordedSite.y,
        mapTerrain: recordedSite.mapTerrain,
        terrain: recordedSite.terrain,
      })
      : createEmptyScoutReport(gameState, mission, now, true);
    if (recordedSite) WorldMapService.bindSiteToTile(gameState, recordedSite.x, recordedSite.y, recordedSite.id, now);
    upsertScoutAreaRecord(gameState, mission, recordedSite ? 'site' : 'empty', {
      siteId: recordedSite?.id || null,
      scoutedAt,
      now,
    });
    return { site: recordedSite || null, report: mission.report };
  }

  const outcome = rollScoutOutcome(gameState, randomSource);
  mission.resolvedTarget = true;
  mission.result = outcome;
  if (outcome === 'empty') {
    recordScoutOutcome(gameState, 'empty');
    mission.siteId = null;
    mission.report = createEmptyScoutReport(gameState, mission, now);
    upsertScoutAreaRecord(gameState, mission, 'empty', { scoutedAt, now });
    return { site: null, report: mission.report };
  }

  const siteCoord = pickScoutSiteCoordinate(gameState, mission, now);
  if (!siteCoord) {
    recordScoutOutcome(gameState, 'empty');
    mission.result = 'empty';
    mission.siteId = null;
    mission.report = createEmptyScoutReport(gameState, mission, now);
    upsertScoutAreaRecord(gameState, mission, 'empty', { scoutedAt, now });
    return { site: null, report: mission.report };
  }

  mission.siteX = siteCoord.q;
  mission.siteY = siteCoord.r;
  mission.siteTerrain = siteCoord.terrain;
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
  upsertScoutAreaRecord(gameState, mission, 'site', { siteId: site.id, scoutedAt: site.discoveredAt || scoutedAt, now });
  mission.siteId = site.id;
  mission.report = created.report;
  return { site, report: mission.report };
}

function startScout(gameState, direction, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  const normalizedDirection = normalizeDirection(direction);
  if (!normalizedDirection) return { success: false, error: 'INVALID_DIRECTION', message: '请选择有效侦察方向' };
  if (countActiveScoutMissions(gameState) >= MAX_ACTIVE_SCOUTS) {
    return { success: false, error: 'SCOUT_LIMIT_REACHED', message: `最多同时派出 ${MAX_ACTIVE_SCOUTS} 支侦察队` };
  }
  const existing = getScoutMissions(gameState).find((mission) => mission.direction === normalizedDirection && ['active', 'ready'].includes(mission.status));
  if (existing) return { success: false, error: 'SCOUT_EXISTS', message: `${DIRECTIONS[normalizedDirection].label}已有侦察任务` };
  const requestedOrigin = getScoutOrigin(gameState);
  const target = findNextCoordinate(gameState, normalizedDirection, requestedOrigin);
  if (!target) return { success: false, error: 'NO_SCOUT_TARGET', message: '该方向暂时没有可侦察区域' };
  const origin = target.origin || requestedOrigin;
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
  const revealArea = WorldMapService.getScoutRevealArea(
    WorldMapService.ensureWorldMap(gameState, now).seed,
    route,
    normalizedDirection,
  ).map((coord) => ({
    ...coord,
    tileId: WorldMapService.getTileId(coord.q, coord.r),
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
    revealArea,
    revealAreaSource: 'directional-route-v1',
    revealedTileIds: [],
    resolvedTarget: false,
    result: null,
    siteId: null,
    report: null,
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
  ensureScoutMissionAreaRevealed(gameState, mission, now);
  const resolved = resolveScoutMissionTarget(gameState, mission, now, randomSource);
  const site = mission.siteId ? getTerritory(gameState, mission.siteId) : resolved.site;
  const report = mission.report || resolved.report || createEmptyScoutReport(gameState, mission, now, true);
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
  const battleTarget = getTerritoryBattleTargetSnapshot(gameState, territory, now);
  const mission = {
    id: `conquest_${territoryId}_${now.getTime()}`,
    kind: 'conquest',
    territoryId,
    mode: occupationMode,
    sourceCityId: soldierAllocations[0]?.cityId || gameState.activeCityId || 'capital',
    soldierAllocations,
    soldiersCommitted: committed,
    battleTarget,
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
  const tileSnapshot = getTerritoryBattleTileSnapshot(gameState, territory, now);
  const battleTarget = normalizeBattleTarget(mission.battleTarget || territory.battleTarget || getTerritoryBattleTargetSnapshot(gameState, territory, now), territory, now.toISOString());
  if (mission.mode === 'settlement') {
    territory.lastBattle = {
      resolvedAt: now.toISOString(),
      soldiersCommitted: mission.soldiersCommitted,
      casualties: 0,
      success: true,
      mode: 'settlement',
      tileId: tileSnapshot.tileId,
      q: tileSnapshot.q,
      r: tileSnapshot.r,
      mapTerrain: tileSnapshot.mapTerrain,
      terrain: tileSnapshot.terrain,
      tile: { ...tileSnapshot.tile },
      battleTarget,
    };
    territory.status = 'occupied';
    territory.owner = 'player';
    territory.occupiedAt = now.toISOString();
    territory.cityName = null;
    WorldMapService.bindSiteToTile(gameState, territory.x, territory.y, territory.id, now, { visibility: 'controlled' });
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
    tileId: tileSnapshot.tileId,
    q: tileSnapshot.q,
    r: tileSnapshot.r,
    mapTerrain: tileSnapshot.mapTerrain,
    terrain: tileSnapshot.terrain,
    tile: { ...tileSnapshot.tile },
    battleTarget,
    leaderId: mission.expedition?.leader || 'unavailable',
    leaderName: battle?.report?.attacker?.leaderName || mission.expedition?.leaderSnapshot?.name || '',
    report: attachBattleTileSnapshot(
      battle?.report || BattleService.createLegacyBattleReport(mission, territory, { success, casualties }, now),
      tileSnapshot,
      battleTarget,
    ),
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
    territory.garrison = null;
    territory.occupiedAt = now.toISOString();
    territory.cityName = null;
    WorldMapService.bindSiteToTile(gameState, territory.x, territory.y, territory.id, now, { visibility: 'controlled' });
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

function getClientTerritoryState(gameState, now = new Date()) {
  return TerritoryClientAssembler.getClientTerritoryState(gameState, now, {
    CONQUEST_DURATION_MS,
    DIRECTIONS,
    MAX_ACTIVE_SCOUTS,
    SCOUT_DURATION_MS,
    countTotalSoldiersOnMission,
    createInitialPolity,
    getActiveScoutMission,
    getAvailableSoldiers,
    getDistance,
    getMissionKind,
    getNamingPrompt,
    getOccupationMode,
    getOccupiedCount,
    getRelativeDistance,
    getScoutOrigin,
    getTerritoryEffects,
    normalizeScoutState,
    toInteger,
    updateMissionReadiness,
  });
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
