const DefenderLeaderService = require('./DefenderLeaderService');
const WorldMapService = require('./WorldMapService');
const TerritoryClientAssembler = require('./TerritoryClientAssembler');
const {
  CONQUEST_DURATION_MS,
  DIRECTIONS,
  LEGACY_SITE_MIGRATIONS,
  MAX_ACTIVE_SCOUTS,
  MAX_NAME_LENGTH,
  MAX_REPORTS,
  MAX_SCOUT_DISTANCE,
  MIN_EXPEDITION_SOLDIERS,
  SCOUT_ACTION_POINTS,
  SCOUT_DURATION_MS,
  SCOUT_SITE_MIN_DISTANCE,
  SCOUT_STEP_DURATION_MS,
  SITE_ART,
  SITE_TEMPLATES,
  SOLDIER_SCALE,
} = require('./territory/TerritoryConstants');
const {
  normalizeVisualOffset,
} = require('./territory/TerritoryVisuals');
const createTerritoryCombatTargets = require('./territory/TerritoryCombatTargets');
const createTerritoryConquestMissions = require('./territory/TerritoryConquestMissions');
const createTerritoryMilitaryMissions = require('./territory/TerritoryMilitaryMissions');
const createTerritoryScoutPlanner = require('./territory/TerritoryScoutPlanner');
const createTerritoryScoutRecords = require('./territory/TerritoryScoutRecords');
const createTerritoryScoutResults = require('./territory/TerritoryScoutResults');
const createTerritorySiteMigration = require('./territory/TerritorySiteMigration');
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
const {
  normalizeBattleTarget,
  normalizeGarrison,
} = createTerritoryCombatTargets({
  DefenderLeaderService,
  WorldMapService,
});
const {
  getScoutAreaTileIds,
  getScoutCoordinateRecord,
  normalizeScoutAreaRecords,
  normalizeScoutCoordinates,
  normalizeScoutReport,
  normalizeScoutReports,
  normalizeScoutState,
  upsertScoutAreaRecord,
  upsertScoutCoordinateRecord,
} = createTerritoryScoutRecords({
  WorldMapService,
  ensureMissionRevealArea,
  getScoutResolvedCoordinate,
  normalizeDirection,
});
const {
  attachScoutReportMapSnapshot,
  createEmptyScoutReport,
  createSiteFromScout,
  getDirectionProgressScore,
  getTerrainSiteScore,
  pickScoutSiteCoordinate,
  recordDiscoveredSiteOwnership,
  recordScoutOutcome,
  rollScoutOutcome,
} = createTerritoryScoutResults({
  WorldMapService,
  ensureMissionRevealArea,
  getScoutCoordinateRecord,
  getScoutResolvedCoordinate,
  getSiteSpacingProfile,
  normalizeGarrison,
  normalizeScoutReport,
  normalizeScoutState,
});
const {
  migrateTerritorySitesToCurrentWorldRules,
} = createTerritorySiteMigration({
  WorldMapService,
  getDirectionProgressScore,
  getTerrainSiteScore,
  normalizeBattleTarget,
  normalizeDirection,
});
const {
  allocateSoldiersForMission,
  countActiveScoutMissions,
  countSoldiersOnMission,
  countTotalSoldiersOnMission,
  enforceScoutMissionLimit,
  getActiveMissionForTerritory,
  getActiveScoutMission,
  getAvailableSoldiers,
  getMissionKind,
  getMissionSoldierAllocations,
  getScoutMissions,
  updateMissionReadiness,
} = createTerritoryMilitaryMissions({
  WorldMapService,
  ensureMissionRevealArea,
  isDirectionalScoutAreaMission,
});
const BattleService = require('./BattleService');
const ConquestMissions = createTerritoryConquestMissions({
  BattleService,
  getFamousPersonService: () => require('./FamousPersonService'),
  WorldMapService,
  allocateSoldiersForMission,
  attachBattleTileSnapshot,
  getActiveMissionForTerritory,
  getAvailableSoldiers,
  getMissionSoldierAllocations,
  getNamingPrompt,
  getTerritory,
  getTerritoryBattleTargetSnapshot,
  getTerritoryBattleTileSnapshot,
  normalizeBattleTarget,
});
const {
  claimConquest: resolveConquestClaim,
  getOccupationMode,
  startConquest: createConquestMission,
} = ConquestMissions;
const ScoutPlanner = createTerritoryScoutPlanner({
  WorldMapService,
  getScoutOrigin,
  normalizeScoutState,
});

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
  const target = ScoutPlanner.findNextCoordinate(gameState, normalizedDirection, requestedOrigin);
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
  return createConquestMission(gameState, territoryId, expeditionInput, now);
}

function claimConquest(gameState, territoryId, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  return resolveConquestClaim(gameState, territoryId, now);
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
