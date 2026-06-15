(function (global) {
  const WorldMarchProgressSnapshot = (() => {
    if (global.WorldMarchProgressSnapshot) return global.WorldMarchProgressSnapshot;
    if (typeof module !== 'undefined' && module.exports) return require('./WorldMarchProgressSnapshot');
    return null;
  })();

  const WorldMarchGeometry = (() => {
    if (global.WorldMarchGeometry) return global.WorldMarchGeometry;
    if (typeof module !== 'undefined' && module.exports) return require('./WorldMarchGeometry');
    return null;
  })();

  const WorldActorProjection = (() => {
    if (global.WorldActorProjection) return global.WorldActorProjection;
    if (typeof module !== 'undefined' && module.exports) return require('./WorldActorProjection');
    return null;
  })();

  function delegate(moduleRef, methodName, fallbackValue) {
    return (...args) => {
      const method = moduleRef?.[methodName];
      if (typeof method === 'function') return method(...args);
      return typeof fallbackValue === 'function' ? fallbackValue(...args) : fallbackValue;
    };
  }

  const WorldMarchSystem = Object.freeze({
    toNumber: delegate(WorldMarchProgressSnapshot, 'toNumber', delegate(WorldMarchGeometry, 'toNumber', 0)),
    toInteger: delegate(WorldMarchProgressSnapshot, 'toInteger', delegate(WorldMarchGeometry, 'toInteger', 0)),
    tileId: delegate(WorldMarchProgressSnapshot, 'tileId', delegate(WorldMarchGeometry, 'tileId', 'tile_0_0')),
    normalizeCoord: delegate(WorldMarchProgressSnapshot, 'normalizeCoord', null),
    normalizeRoute: delegate(WorldMarchProgressSnapshot, 'normalizeRoute', []),
    getMissionPath: delegate(WorldMarchProgressSnapshot, 'getMissionPath', []),
    getMissionDurationMs: delegate(WorldMarchProgressSnapshot, 'getMissionDurationMs', 0),
    getMissionStepDurationMs: delegate(WorldMarchProgressSnapshot, 'getMissionStepDurationMs', 1000),
    getMissionProgress: delegate(WorldMarchProgressSnapshot, 'getMissionProgress', {
      progress: 0,
      segmentIndex: 0,
      segmentProgress: 0,
      elapsedMs: 0,
      durationMs: 0,
    }),
    isExpiredActiveMission: delegate(WorldMarchProgressSnapshot, 'isExpiredActiveMission', false),
    getEffectiveMissionStatus: delegate(WorldMarchProgressSnapshot, 'getEffectiveMissionStatus', ''),
    getRouteStepRevealTimeMs: delegate(WorldMarchProgressSnapshot, 'getRouteStepRevealTimeMs', Number.NaN),
    isRouteStepTimeRevealed: delegate(WorldMarchProgressSnapshot, 'isRouteStepTimeRevealed', false),
    isRouteStepRevealed: delegate(WorldMarchProgressSnapshot, 'isRouteStepRevealed', false),
    deriveMissionForTime: delegate(WorldMarchProgressSnapshot, 'deriveMissionForTime', null),
    getCurrentCoord: delegate(WorldMarchProgressSnapshot, 'getCurrentCoord', null),
    getRouteRenderAheadTileId: delegate(WorldMarchProgressSnapshot, 'getRouteRenderAheadTileId', null),
    getRouteRenderReadyTileIds: delegate(WorldMarchProgressSnapshot, 'getRouteRenderReadyTileIds', []),
    chooseStopTile: delegate(WorldMarchProgressSnapshot, 'chooseStopTile', null),
    getRemainingSeconds: delegate(WorldMarchProgressSnapshot, 'getRemainingSeconds', 0),
    buildActorFromMission: delegate(WorldMarchProgressSnapshot, 'buildActorFromMission', null),
    buildActors: delegate(WorldActorProjection, 'projectWorldActors', delegate(WorldMarchProgressSnapshot, 'buildActors', [])),
    hasActiveMission: delegate(WorldMarchProgressSnapshot, 'hasActiveMission', false),
    getTileScreenCenter: delegate(WorldMarchGeometry, 'getTileScreenCenter', { x: 0, y: 0 }),
    screenPointToNearestTile: delegate(WorldMarchGeometry, 'screenPointToNearestTile', null),
    screenPointToAxialTile: delegate(WorldMarchGeometry, 'screenPointToAxialTile', null),
    getMarchTargetUiState: delegate(WorldMarchGeometry, 'getMarchTargetUiState', null),
  });

  global.WorldMarchSystem = WorldMarchSystem;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMarchSystem;
})(typeof window !== 'undefined' ? window : globalThis);
