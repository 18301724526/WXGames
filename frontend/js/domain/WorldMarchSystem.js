(function (global) {
  const TileMapGeometry = (() => {
    if (global.TileMapGeometry) return global.TileMapGeometry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./TileMapGeometry');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
  }

  function toTimestamp(value, fallback = 0) {
    const stamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(stamp) ? stamp : fallback;
  }

  function tileId(q, r) {
    return `tile_${toInteger(q)}_${toInteger(r)}`;
  }

  function normalizeCoord(coord = {}, fallback = {}) {
    const q = toInteger(coord.q ?? coord.x, fallback.q ?? 0);
    const r = toInteger(coord.r ?? coord.y, fallback.r ?? 0);
    return {
      q,
      r,
      tileId: coord.tileId || tileId(q, r),
    };
  }

  function normalizeRoute(route = []) {
    return (Array.isArray(route) ? route : [])
      .map((step, index) => {
        if (!step || typeof step !== 'object') return null;
        return {
          ...normalizeCoord(step),
          step: Math.max(1, toInteger(step.step, index + 1)),
          revealed: Boolean(step.revealed),
          revealedAt: step.revealedAt || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.step - b.step);
  }

  function getMissionPath(mission = {}) {
    const origin = normalizeCoord(mission.origin || {});
    return [origin, ...normalizeRoute(mission.route)];
  }

  function getMissionDurationMs(mission = {}) {
    const route = normalizeRoute(mission.route);
    const stepDurationMs = Math.max(1000, toInteger(
      mission.stepDurationMs,
      Math.max(1, toNumber(mission.stepDurationSeconds, 10)) * 1000,
    ));
    return Math.max(stepDurationMs, route.length * stepDurationMs);
  }

  function getMissionProgress(mission = {}, nowMs = Date.now()) {
    const route = normalizeRoute(mission.route);
    if (!route.length) return { progress: 0, segmentIndex: 0, segmentProgress: 0, elapsedMs: 0, durationMs: 0 };
    if (mission.status === 'ready') {
      return {
        progress: 1,
        segmentIndex: Math.max(0, route.length - 1),
        segmentProgress: 1,
        elapsedMs: getMissionDurationMs(mission),
        durationMs: getMissionDurationMs(mission),
      };
    }
    const startedAtMs = toTimestamp(mission.startedAt, Number(nowMs) || Date.now());
    const durationMs = getMissionDurationMs(mission);
    const elapsedMs = Math.max(0, toNumber(nowMs, Date.now()) - startedAtMs);
    const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
    const scaled = progress * route.length;
    const segmentIndex = Math.min(Math.max(0, route.length - 1), Math.floor(scaled));
    const segmentProgress = progress >= 1 ? 1 : Math.max(0, Math.min(1, scaled - segmentIndex));
    return { progress, segmentIndex, segmentProgress, elapsedMs, durationMs };
  }

  function lerp(a, b, t) {
    return toNumber(a) + (toNumber(b) - toNumber(a)) * Math.max(0, Math.min(1, toNumber(t)));
  }

  function getCurrentCoord(mission = {}, nowMs = Date.now()) {
    const path = getMissionPath(mission);
    if (path.length <= 1) return path[0] || normalizeCoord({});
    const progress = getMissionProgress(mission, nowMs);
    const from = path[progress.segmentIndex] || path[0];
    const to = path[progress.segmentIndex + 1] || path[path.length - 1];
    return {
      q: lerp(from.q, to.q, progress.segmentProgress),
      r: lerp(from.r, to.r, progress.segmentProgress),
      fromTileId: from.tileId,
      toTileId: to.tileId,
      segmentIndex: progress.segmentIndex,
      segmentProgress: progress.segmentProgress,
      progress: progress.progress,
    };
  }

  function chooseStopTile(mission = {}, nowMs = Date.now()) {
    const path = getMissionPath(mission);
    if (path.length <= 1) return path[0] || normalizeCoord({});
    const progress = getMissionProgress(mission, nowMs);
    const from = path[progress.segmentIndex] || path[0];
    const to = path[progress.segmentIndex + 1] || path[path.length - 1];
    return progress.segmentProgress >= 0.5 ? to : from;
  }

  function getRemainingSeconds(mission = {}, nowMs = Date.now()) {
    if (!mission || mission.status === 'ready') return 0;
    const completesAtMs = toTimestamp(mission.completesAt, 0);
    if (completesAtMs) return Math.max(0, Math.ceil((completesAtMs - toNumber(nowMs, Date.now())) / 1000));
    const progress = getMissionProgress(mission, nowMs);
    return Math.max(0, Math.ceil((progress.durationMs - progress.elapsedMs) / 1000));
  }

  function getFormationLabel(formation = {}, fallbackSlot = 1) {
    const slot = Math.max(1, toInteger(formation.slot, fallbackSlot));
    return formation.name || `部队${slot}`;
  }

  function buildActorFromMission(mission = {}, options = {}) {
    if (!mission || !['active', 'ready'].includes(mission.status)) return null;
    const nowMs = toNumber(options.nowMs, Date.now());
    const route = normalizeRoute(mission.route);
    if (!route.length) return null;
    const origin = normalizeCoord(mission.origin || {});
    const target = normalizeCoord(mission.target || route.at(-1), route.at(-1));
    const current = mission.status === 'ready' ? target : getCurrentCoord(mission, nowMs);
    const stopTile = chooseStopTile(mission, nowMs);
    const formation = mission.formation || {};
    return {
      id: mission.id || '',
      missionId: mission.id || '',
      type: 'scout',
      status: mission.status,
      unitKey: mission.unitKey || 'scout_squad_default',
      animationId: 'move',
      origin,
      target,
      current,
      stopTile,
      route,
      formation: {
        cityId: formation.cityId || origin.cityId || 'capital',
        slot: Math.max(1, toInteger(formation.slot, 1)),
        memberIds: Array.isArray(formation.memberIds) ? formation.memberIds.map(String) : [],
        label: getFormationLabel(formation, formation.slot || 1),
      },
      progress: getMissionProgress(mission, nowMs),
      remainingSeconds: getRemainingSeconds(mission, nowMs),
    };
  }

  function buildActors(worldExplorerState = {}, options = {}) {
    const missions = [];
    if (Array.isArray(worldExplorerState.missions)) missions.push(...worldExplorerState.missions);
    if (worldExplorerState.activeMission) missions.push(worldExplorerState.activeMission);
    if (Array.isArray(worldExplorerState.readyMissions)) missions.push(...worldExplorerState.readyMissions);
    const seen = new Set();
    return missions
      .filter((mission) => {
        const id = mission?.id || '';
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((mission) => buildActorFromMission(mission, options))
      .filter(Boolean);
  }

  function getTileScreenCenter(coord = {}, viewport = {}, geometry = {}) {
    const helper = TileMapGeometry?.getTileScreenCenter;
    if (typeof helper === 'function') return helper(coord, viewport, geometry);
    const stepX = toNumber(geometry.stepX, 96);
    const stepY = toNumber(geometry.stepY, 48);
    return {
      x: toNumber(viewport.originX) + toNumber(viewport.panX) + (toNumber(coord.q) - toNumber(coord.r)) * stepX * toNumber(viewport.scale, 1),
      y: toNumber(viewport.originY) + toNumber(viewport.panY) + (toNumber(coord.q) + toNumber(coord.r)) * stepY * toNumber(viewport.scale, 1),
    };
  }

  function screenPointToNearestTile(point = {}, tileMapView = {}, viewport = {}) {
    const geometry = tileMapView.geometry || viewport.geometry || {};
    let best = null;
    (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : []).forEach((tile) => {
      const center = getTileScreenCenter(tile, viewport, geometry);
      const dx = toNumber(point.x) - center.x;
      const dy = toNumber(point.y) - center.y;
      const distance = dx * dx + dy * dy;
      if (!best || distance < best.distance) {
        best = {
          id: tile.id || tileId(tile.q, tile.r),
          q: toInteger(tile.q),
          r: toInteger(tile.r),
          tileId: tile.id || tileId(tile.q, tile.r),
          center,
          distance,
          tile,
        };
      }
    });
    return best;
  }

  function screenPointToAxialTile(point = {}, viewport = {}, geometry = {}) {
    const scale = Math.max(0.0001, toNumber(viewport.scale, 1));
    const stepX = Math.max(1, toNumber(geometry.stepX, 96));
    const stepY = Math.max(1, toNumber(geometry.stepY, 48));
    const localX = (toNumber(point.x) - toNumber(viewport.originX) - toNumber(viewport.panX)) / scale;
    const localY = (toNumber(point.y) - toNumber(viewport.originY) - toNumber(viewport.panY)) / scale;
    const projectedQMinusR = localX / stepX;
    const projectedQPlusR = localY / stepY;
    const q = Math.round((projectedQMinusR + projectedQPlusR) / 2);
    const r = Math.round((projectedQPlusR - projectedQMinusR) / 2);
    return {
      id: tileId(q, r),
      q,
      r,
      tileId: tileId(q, r),
      center: getTileScreenCenter({ q, r }, viewport, geometry),
      tile: null,
      inferred: true,
    };
  }

  function getMarchTargetUiState(uiState = {}) {
    const target = uiState.worldMarchTarget || null;
    if (!target || typeof target !== 'object') return null;
    const q = toInteger(target.q, NaN);
    const r = toInteger(target.r, NaN);
    if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
    return {
      q,
      r,
      tileId: target.tileId || tileId(q, r),
      pickerOpen: Boolean(target.pickerOpen),
      known: target.known === undefined ? undefined : Boolean(target.known),
      terrain: target.terrain || '',
      terrainLabel: target.terrainLabel || '',
    };
  }

  const WorldMarchSystem = {
    toNumber,
    toInteger,
    tileId,
    normalizeCoord,
    normalizeRoute,
    getMissionPath,
    getMissionDurationMs,
    getMissionProgress,
    getCurrentCoord,
    chooseStopTile,
    getRemainingSeconds,
    buildActorFromMission,
    buildActors,
    getTileScreenCenter,
    screenPointToNearestTile,
    screenPointToAxialTile,
    getMarchTargetUiState,
  };

  global.WorldMarchSystem = WorldMarchSystem;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMarchSystem;
})(typeof window !== 'undefined' ? window : globalThis);
