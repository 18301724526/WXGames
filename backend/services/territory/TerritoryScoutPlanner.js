const {
  DIRECTIONS,
  MAX_SCOUT_DISTANCE,
  SCOUT_ACTION_POINTS,
} = require('./TerritoryConstants');
const {
  getCoordinateKey,
  toInteger,
} = require('./TerritoryShared');

function createTerritoryScoutPlanner(dependencies = {}) {
  const {
    WorldMapService,
    getScoutOrigin,
    normalizeScoutState,
  } = dependencies;

  function getKnownWorldCoordinateKeys(gameState) {
    const worldMap = WorldMapService.ensureWorldMap(gameState);
    return new Set((worldMap.tiles || [])
      .filter((tile) => tile.discovered !== false && tile.visible !== false && tile.visibility !== 'hidden')
      .map((tile) => getCoordinateKey(tile.q, tile.r)));
  }

  function getScoutedAreaTileIdSet(gameState) {
    gameState.scoutState = normalizeScoutState(gameState.scoutState);
    return new Set((gameState.scoutState.areas || [])
      .flatMap((area) => Array.isArray(area.tileIds) ? area.tileIds : [])
      .filter(Boolean)
      .map(String));
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
        name: origin?.name || origin?.cityName || origin?.naturalName || '\u51fa\u53d1\u57ce\u5e02',
        x,
        y,
      });
    };

    const worldMap = WorldMapService.ensureWorldMap(gameState);
    for (const tile of worldMap.tiles || []) {
      if (tile.visible === false || tile.visibility === 'hidden') continue;
      if (tile.visibility !== 'controlled') continue;
      const x = toInteger(tile.q, 0);
      const y = toInteger(tile.r, 0);
      const territory = territoryByCoord.get(getCoordinateKey(x, y));
      const tileId = WorldMapService.getTileId(x, y);
      addOrigin({
        cityId: territory?.cityId || territory?.id || tile.siteId || tileId,
        territoryId: territory?.id || tile.siteId || tileId,
        name: territory?.cityName || territory?.naturalName || `\u63a7\u5236\u533a ${x},${y}`,
        x,
        y,
      });
    }

    for (const territory of gameState.territories || []) {
      if (territory.status !== 'occupied') continue;
      addOrigin({
        cityId: territory.cityId || territory.id || 'capital',
        territoryId: territory.id || 'capital',
        name: territory.cityName || territory.naturalName || '\u51fa\u53d1\u57ce\u5e02',
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

  return {
    findNextCoordinate,
    findNextCoordinateFromOrigin,
    getControlledScoutOrigins,
    getKnownWorldCoordinateKeys,
    getScoutedAreaTileIdSet,
    getScoutRouteForCandidate,
    scoreScoutCandidateArea,
  };
}

module.exports = createTerritoryScoutPlanner;
