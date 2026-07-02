const {
  MAX_NAME_LENGTH,
  MIN_EXPEDITION_SOLDIERS,
  SCOUT_ACTION_POINTS,
  SITE_ART,
  SOLDIER_SCALE,
} = require('./TerritoryConstants');
const {
  createCapital,
  normalizePolity,
} = require('./TerritoryInitialState');
const {
  normalizeVisualOffset,
} = require('./TerritoryVisuals');
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
} = require('./TerritoryShared');

function createTerritoryStateNormalizer(dependencies = {}) {
  const {
    WorldMapService,
    enforceScoutMissionLimit,
    getMissionSoldierAllocations,
    migrateTerritorySitesToCurrentWorldRules,
    normalizeBattleTarget,
    normalizeDirection,
    normalizeGarrison,
    normalizeScoutCoordinates,
    normalizeScoutReport,
    normalizeScoutReports,
    normalizeScoutState,
    updateMissionReadiness,
    upsertScoutCoordinateRecord,
  } = dependencies;

  function getCapitalOrigin(rawTerritory = {}, options = {}) {
    const configuredOrigin = options.capitalOrigin || options.origin || {};
    const configuredQ = configuredOrigin.q ?? configuredOrigin.x;
    const configuredR = configuredOrigin.r ?? configuredOrigin.y;
    if (hasFiniteValue(configuredQ) && hasFiniteValue(configuredR)) {
      return {
        q: toInteger(configuredQ, 0),
        r: toInteger(configuredR, 0),
      };
    }
    const rawQ = rawTerritory.x ?? rawTerritory.q;
    const rawR = rawTerritory.y ?? rawTerritory.r;
    if (hasFiniteValue(rawQ) && hasFiniteValue(rawR)) {
      return {
        q: toInteger(rawQ, 0),
        r: toInteger(rawR, 0),
      };
    }
    return { q: 0, r: 0 };
  }

  function getWorldMapOrigin(worldMap = {}) {
    const origin = worldMap?.origin && typeof worldMap.origin === 'object'
      ? worldMap.origin
      : {};
    const q = origin.q ?? origin.x;
    const r = origin.r ?? origin.y;
    if (!hasFiniteValue(q) || !hasFiniteValue(r)) return null;
    return {
      q: toInteger(q, 0),
      r: toInteger(r, 0),
    };
  }

  function normalizeTerritory(rawTerritory, now = new Date().toISOString(), options = {}) {
    if (!rawTerritory || typeof rawTerritory !== 'object') return null;
    if (rawTerritory.id === 'capital') {
      const origin = getCapitalOrigin(rawTerritory, options);
      return {
        ...createCapital(now, { origin }),
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
                tileId: WorldMapService.getTileId(q, r),
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
                tileId: WorldMapService.getTileId(q, r),
                revealed: Boolean(coord.revealed),
              };
            })
            : [];
          const revealAreaSource = typeof mission.revealAreaSource === 'string' && mission.revealAreaSource
            ? mission.revealAreaSource
            : hasStoredRevealArea
              ? 'directional-route-v1'
              : hasStoredRoute
                ? 'stored-route-v1'
                : 'target-coordinate-v1';
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
            soldiers: normalizeSoldierScale(mission.expedition?.soldiers || mission.soldiersCommitted, 0),
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
      if (!tile || tile.discovered === false || tile.visible === false || tile.visibility === 'hidden') continue;
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
      const revealCoords = [];
      for (const key of bridgeKeys) {
        if (known.has(key)) continue;
        const [x, y] = key.split(',').map((value) => toInteger(value, 0));
        revealCoords.push({ q: x, r: y });
        known.set(key, { x, y });
        added += 1;
        changed = true;
      }
      if (revealCoords.length) WorldMapService.revealTiles(gameState, revealCoords, now);
    }
    return added;
  }

  function normalizeTerritoryState(gameState, now = new Date(), options = {}) {
    const isoNow = now.toISOString();
    const previousWorldMapVersion = options.previousWorldMapVersion ?? WorldMapService.getWorldMapVersion(gameState.worldMap);
    const capitalOrigin = getWorldMapOrigin(gameState.worldMap);
    const known = new Map();
    for (const item of Array.isArray(gameState.territories) ? gameState.territories : []) {
      const normalized = normalizeTerritory(item, isoNow, { capitalOrigin });
      if (normalized) known.set(normalized.id, normalized);
    }
    if (!known.has('capital')) known.set('capital', createCapital(isoNow, { origin: capitalOrigin || {} }));
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

  return {
    normalizeTerritory,
    normalizeTerritoryState,
    normalizeWarMissions,
    revealSolidKnownWorldTiles,
    syncScoutCoordinatesWithTerritories,
  };
}

module.exports = createTerritoryStateNormalizer;
