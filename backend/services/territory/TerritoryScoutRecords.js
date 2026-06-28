const {
  MAX_REPORTS,
  MAX_SCOUT_AREA_RECORDS,
} = require('./TerritoryConstants');
const {
  getCoordinateKey,
  getDistance,
  getPlanningTerrainForMapTerrain,
  getRelativeDistance,
  hasFiniteValue,
  normalizeMapTerrainId,
  toInteger,
} = require('./TerritoryShared');

function createTerritoryScoutRecords(dependencies = {}) {
  const {
    WorldMapService,
    ensureMissionRevealArea,
    getScoutResolvedCoordinate,
    normalizeDirection,
  } = dependencies;

  function getTileId(q, r) {
    // Single source: WorldMapService.getTileId (= WorldMapTopology.getTileId). WorldMapService is
    // always injected here (TerritoryService builds this factory with it), so the old inline raw
    // `tile_${q}_${r}` fallback was dead — removed (do not re-introduce a second format source).
    return WorldMapService.getTileId(q, r);
  }

  function resolveDirection(direction) {
    return typeof normalizeDirection === 'function'
      ? normalizeDirection(direction)
      : direction || null;
  }

  function normalizeScoutReportTileSnapshot(report) {
    const q = hasFiniteValue(report?.q) ? toInteger(report.q, 0) : null;
    const r = hasFiniteValue(report?.r) ? toInteger(report.r, 0) : null;
    const tileId = q !== null && r !== null
      ? getTileId(q, r)
      : typeof report?.tileId === 'string' && report.tileId
        ? report.tileId
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
          tileId: getTileId(q, r),
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
        direction: resolveDirection(report.direction),
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
          return [getCoordinateKey(q, r), { q, r, tileId: getTileId(q, r) }];
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
        direction: resolveDirection(area.direction),
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
      ...revealArea.map((coord) => getTileId(coord.q, coord.r)),
      ...revealedTileIds.filter(Boolean).map(String),
    ])).sort();
  }

  function upsertScoutAreaRecord(gameState, mission, result, options = {}) {
    gameState.scoutState = normalizeScoutState(gameState.scoutState);
    const scoutedAt = options.scoutedAt || new Date().toISOString();
    const revealArea = typeof ensureMissionRevealArea === 'function'
      ? ensureMissionRevealArea(gameState, mission, options.now || new Date())
      : [];
    const coords = revealArea.map((coord) => ({
      q: toInteger(coord.q, 0),
      r: toInteger(coord.r, 0),
      tileId: getTileId(coord.q, coord.r),
    }));
    const resolved = typeof getScoutResolvedCoordinate === 'function'
      ? getScoutResolvedCoordinate(mission)
      : { x: mission?.targetX, y: mission?.targetY };
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

  return {
    getScoutAreaTileIds,
    getScoutCoordinateRecord,
    normalizeScoutAreaRecords,
    normalizeScoutCoordinates,
    normalizeScoutReport,
    normalizeScoutReportRevealArea,
    normalizeScoutReportTileSnapshot,
    normalizeScoutReports,
    normalizeScoutState,
    upsertScoutAreaRecord,
    upsertScoutCoordinateRecord,
  };
}

module.exports = createTerritoryScoutRecords;
