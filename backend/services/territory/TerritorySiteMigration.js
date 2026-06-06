const {
  DIRECTIONS,
  MAX_MIGRATION_SITE_SEARCH_DISTANCE,
  MAX_SCOUT_DISTANCE,
  SCOUT_ACTION_POINTS,
  SCOUT_SITE_MIN_DISTANCE,
} = require('./TerritoryConstants');
const {
  createVisualOffset,
  seededNoise,
} = require('./TerritoryVisuals');
const {
  getCoordinateKey,
  getPlanningTerrainForMapTerrain,
  getRelativeDistance,
  normalizeMapTerrainId,
  toInteger,
} = require('./TerritoryShared');

function createTerritorySiteMigration(dependencies = {}) {
  const {
    WorldMapService,
    getDirectionProgressScore,
    getTerrainSiteScore,
    normalizeBattleTarget,
    normalizeDirection,
  } = dependencies;

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

  return {
    buildMigrationMissionForTerritory,
    clearWorldTileSiteBindings,
    getAreaRecordForSite,
    getCurrentRuleSiteCoordinate,
    getDirectionFromDelta,
    getMigrationSearchCoordinates,
    getNearestSiteDistanceFromTerritories,
    migrateTerritorySitesToCurrentWorldRules,
    retargetTerritoryToCurrentRules,
    scoreMigratedSiteCandidate,
  };
}

module.exports = createTerritorySiteMigration;
