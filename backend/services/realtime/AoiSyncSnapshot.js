const WorldMapService = require('../WorldMapService');
const ServerTimelineSnapshot = require('./ServerTimelineSnapshot');
const { toInteger } = require('../../../shared/numberUtils');

const SCHEMA = 'aoi-sync-snapshot-v1';

function normalizeRadius(value, fallback = 4) {
  return Math.max(0, Math.min(64, toInteger(value, fallback)));
}

function getDistance(a = {}, b = {}) {
  return WorldMapService.getWrappedDistance(
    { q: toInteger(a.q ?? a.x, 0), r: toInteger(a.r ?? a.y, 0) },
    { q: toInteger(b.q ?? b.x, 0), r: toInteger(b.r ?? b.y, 0) },
  );
}

function normalizeCenter(options = {}) {
  return ServerTimelineSnapshot.normalizeCoord(
    options.center || options.timeline?.confirmedPosition || options.timeline?.stopTile || options.mission?.position || options.mission?.origin || {},
  );
}

function getTileId(coord = {}) {
  return WorldMapService.getTileId(coord.q, coord.r);
}

function isInRadius(coord = {}, center = {}, radius = 0) {
  return getDistance(coord, center) <= radius;
}

function getMissionCoord(mission = {}, options = {}) {
  const timeline = ServerTimelineSnapshot.createMissionSnapshot(mission, options);
  return timeline.confirmedPosition || timeline.stopTile || ServerTimelineSnapshot.normalizeCoord(mission.position || mission.origin || {});
}

function getAoiMissions(gameState = {}, center = {}, radius = 0, options = {}) {
  const missions = Array.isArray(gameState.exploreMissions) ? gameState.exploreMissions : [];
  return missions
    .map((mission) => {
      if (!mission || typeof mission !== 'object') return null;
      const coord = getMissionCoord(mission, options);
      if (!isInRadius(coord, center, radius) && mission.id !== options.missionId) return null;
      return {
        id: mission.id || '',
        kind: mission.kind || 'worldExplore',
        mode: mission.mode || '',
        status: mission.status || '',
        position: coord,
        nextStepAt: mission.nextStepAt || null,
        completesAt: mission.completesAt || null,
      };
    })
    .filter(Boolean);
}

function getAoiTiles(gameState = {}, center = {}, radius = 0) {
  const worldMap = WorldMapService.ensureWorldMap(gameState);
  return (Array.isArray(worldMap.tiles) ? worldMap.tiles : [])
    .filter((tile) => tile && tile.visible !== false && tile.visibility !== 'hidden' && isInRadius(tile, center, radius))
    .map((tile) => ({
      id: WorldMapService.getTileId(tile.q, tile.r),
      q: toInteger(tile.q, 0),
      r: toInteger(tile.r, 0),
      terrain: tile.terrain || '',
      visibility: tile.visibility || '',
      siteId: tile.siteId || '',
    }));
}

function getAoiTerritories(gameState = {}, center = {}, radius = 0) {
  return (Array.isArray(gameState.territories) ? gameState.territories : [])
    .filter((territory) => territory && isInRadius({ q: territory.x ?? territory.q, r: territory.y ?? territory.r }, center, radius))
    .map((territory) => ({
      id: territory.id || '',
      q: toInteger(territory.x ?? territory.q, 0),
      r: toInteger(territory.y ?? territory.r, 0),
      owner: territory.owner || '',
      status: territory.status || '',
      type: territory.type || '',
    }));
}

function createSnapshot(gameState = {}, options = {}) {
  const now = options.now || new Date();
  const timeline = options.timeline || (options.mission
    ? ServerTimelineSnapshot.createMissionSnapshot(options.mission, { now })
    : null);
  const center = normalizeCenter({ ...options, timeline });
  const radius = normalizeRadius(options.radius, 4);
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const tiles = getAoiTiles(gameState, center, radius);
  const territories = getAoiTerritories(gameState, center, radius);
  const missions = getAoiMissions(gameState, center, radius, {
    now,
    missionId: options.missionId || options.mission?.id || '',
  });
  return {
    schema: SCHEMA,
    serverTime: now.toISOString(),
    scope: 'world-map-aoi',
    center: {
      ...center,
      tileId: getTileId(center),
    },
    radius,
    worldMapVersion: worldMap.version || 0,
    counts: {
      tiles: tiles.length,
      territories: territories.length,
      missions: missions.length,
    },
    tiles,
    territories,
    missions,
  };
}

module.exports = {
  SCHEMA,
  normalizeRadius,
  getDistance,
  normalizeCenter,
  isInRadius,
  getAoiMissions,
  getAoiTiles,
  getAoiTerritories,
  createSnapshot,
};
