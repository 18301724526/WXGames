const {
  SCOUT_ACTION_POINTS,
} = require('./TerritoryConstants');
const {
  getCoordinateKey,
  getRelativeDistance,
  hasFiniteValue,
  toInteger,
} = require('./TerritoryShared');

function createTerritoryScoutAreas(dependencies = {}) {
  const {
    WorldMapService,
  } = dependencies;

  function isDirectionalScoutAreaMission(mission) {
    return mission?.revealAreaSource === 'directional-route-v1';
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
    const revealedTileIds = pending.map((coord) => WorldMapService.getTileId(coord.q, coord.r));
    mission.route = (Array.isArray(mission.route) ? mission.route : []).map((step) => ({
      ...step,
      revealed: revealArea.some((coord) => coord.kind === 'main' && coord.q === step.q && coord.r === step.r && coord.revealed),
    }));
    mission.revealedTileIds = Array.from(new Set([
      ...mission.revealedTileIds,
      ...revealedTileIds,
    ]));
    WorldMapService.recordScoutTrail(gameState, mission, mission.revealedTileIds, mission.status === 'ready');
    return revealedTiles;
  }

  return {
    ensureMissionRevealArea,
    ensureScoutMissionAreaRevealed,
    getExistingScoutAreaSite,
    getScoutResolvedCoordinate,
    isDirectionalScoutAreaMission,
  };
}

module.exports = createTerritoryScoutAreas;
