(function (global) {
  const WorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMarchSystem');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();
  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./TileCoord');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapPickingModel = (() => {
    if (global.WorldMapPickingModel) return global.WorldMapPickingModel;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapPickingModel');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapSelectionResolver = (() => {
    if (global.WorldMapSelectionResolver) return global.WorldMapSelectionResolver;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapSelectionResolver');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const DEFAULT_ALLOWED_ACTIONS = Object.freeze([
    'openWorldSite',
    'resetWorldPan',
    'worldMapDrag',
    'selectWorldMarchTarget',
    'openWorldMarchFormationPicker',
    'startWorldMarch',
    'closeWorldMarchHud',
    'selectWorldActor',
    'openWorldTargetPicker',
    'chooseWorldTarget',
    'closeWorldTargetPicker',
    'returnWorldMarch',
    'stopWorldMarch',
    'enterCity',
    'renameCity',
    'territoryAction',
  ]);
  const DEFAULT_PRIORITY_ACTIONS = Object.freeze([
    'closeWorldTargetPicker',
    'chooseWorldTarget',
    'returnWorldMarch',
    'stopWorldMarch',
    'openWorldMarchFormationPicker',
    'startWorldMarch',
    'closeWorldMarchHud',
  ]);

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
  }

  function isActorPickingDiagEnabled() {
    if (global.__actorPickingDiag === true) return true;
    try {
      const params = new URL(global.location?.href || '').searchParams;
      const value = params.get('actorPickingDiag') || params.get('worldActorPickingDiag');
      if (value !== null) return value !== '0' && value !== 'false' && value !== 'off';
    } catch (_) {}
    try {
      const value = global.localStorage?.getItem?.('actorPickingDiag');
      return value === '1' || value === 'true' || value === 'on';
    } catch (_) {}
    return false;
  }

  function summarizeHitTarget(target = {}, index = -1, point = null) {
    const action = target.action || {};
    return {
      index,
      kind: target.kind || '',
      actionType: action.type || '',
      actorId: action.actorId || '',
      missionId: action.missionId || '',
      siteId: action.siteId || '',
      tileId: action.tileId || '',
      background: Boolean(action.background),
      x: toNumber(target.x),
      y: toNumber(target.y),
      width: toNumber(target.width),
      height: toNumber(target.height),
      containsPoint: point ? containsPoint(target, point) : undefined,
    };
  }

  function logActorPickingDiag(stage = '', detail = {}) {
    if (!isActorPickingDiagEnabled()) return null;
    const payload = {
      at: new Date().toISOString(),
      stage,
      ...detail,
    };
    try {
      global.console?.log?.('[ActorPickingDiag]', stage, payload);
    } catch (_) {}
    return payload;
  }

  function normalizeCoord(source = {}, fallback = {}) {
    if (TileCoord?.normalizeCoord) return TileCoord.normalizeCoord(source, fallback);
    const x = toInteger(source.x ?? source.q, fallback.x ?? fallback.q ?? 0);
    const y = toInteger(source.y ?? source.r, fallback.y ?? fallback.r ?? 0);
    return {
      x,
      y,
      q: x,
      r: y,
      tileId: `tile_${x}_${y}`,
    };
  }

  function containsPoint(target = {}, point = {}) {
    const x = Number(point.x);
    const y = Number(point.y);
    return Boolean(Number.isFinite(x)
      && Number.isFinite(y)
      && x >= toNumber(target.x)
      && x <= toNumber(target.x) + toNumber(target.width)
      && y >= toNumber(target.y)
      && y <= toNumber(target.y) + toNumber(target.height));
  }

  function isAllowedAction(action = {}, allowedActions = DEFAULT_ALLOWED_ACTIONS) {
    if (!action?.type) return false;
    if (!allowedActions) return true;
    const allowedSet = allowedActions instanceof Set ? allowedActions : new Set(allowedActions);
    return allowedSet.has(action.type);
  }

  function normalizeHitTarget(target = {}, options = {}) {
    const action = target?.action || null;
    if (!action || !isAllowedAction(action, options.allowedActions || DEFAULT_ALLOWED_ACTIONS)) return null;
    const offsetX = toNumber(options.offsetX, 0);
    const offsetY = toNumber(options.offsetY, 0);
    return {
      x: toNumber(target.x) + offsetX,
      y: toNumber(target.y) + offsetY,
      width: Math.max(0, toNumber(target.width)),
      height: Math.max(0, toNumber(target.height)),
      action,
    };
  }

  function normalizeHitTargets(targets = [], options = {}) {
    return (Array.isArray(targets) ? targets : [])
      .map((target) => normalizeHitTarget(target, options))
      .filter(Boolean);
  }

  function isWorldSiteAction(action = {}) {
    return action?.type === 'openWorldSite' || action?.type === 'enterCity';
  }

  function isRendererWorldSurfaceAction(action = {}) {
    if (!action?.type) return false;
    return action.type === 'worldMapDrag'
      || action.type === 'openWorldSite'
      || action.type === 'selectWorldActor'
      || (action.type === 'selectWorldMarchTarget' && action.background);
  }

  function isWorldMapSurfaceAction(action = {}) {
    return action?.inputSurface === 'worldMap';
  }

  function shouldRouteTapThroughWorldMapRuntime(action = null) {
    if (!action) return true;
    if (action.disabled || action.type === 'blockCanvasModal') return false;
    if (isWorldMapSurfaceAction(action)) return isRendererWorldSurfaceAction(action);
    return action.type === 'worldMapDrag'
      || (action.type === 'selectWorldMarchTarget' && action.background);
  }

  function getTopmostForegroundAction(point = {}, targets = [], predicate = null) {
    for (let index = (Array.isArray(targets) ? targets.length : 0) - 1; index >= 0; index -= 1) {
      const target = targets[index];
      const action = target?.action;
      if (!action || action.background || !containsPoint(target, point)) continue;
      if (!predicate || predicate(action, target)) return action;
    }
    return null;
  }

  function getForegroundTargets(point = {}, targets = []) {
    const matches = [];
    for (let index = (Array.isArray(targets) ? targets.length : 0) - 1; index >= 0; index -= 1) {
      const target = targets[index];
      if (!target?.action || target.action.background || !containsPoint(target, point)) continue;
      matches.push({ ...target, index });
    }
    return matches;
  }

  function resolveForegroundCandidates(point = {}, targets = [], options = {}) {
    if (!WorldMapSelectionResolver?.resolveCandidates) return null;
    const candidates = getForegroundTargets(point, targets)
      .filter((target) => WorldMapSelectionResolver.isWorldEntityAction?.(target.action));
    if (candidates.length <= 1) return null;
    const normalized = WorldMapSelectionResolver.normalizeCandidates?.(candidates, {
      point,
      tile: options.tile || {},
    });
    if (!Array.isArray(normalized) || normalized.length <= 1) return null;
    return WorldMapSelectionResolver.createPickerAction
      ? WorldMapSelectionResolver.createPickerAction(normalized, { point, tile: options.tile || {} })
      : WorldMapSelectionResolver.resolveCandidates(normalized, { point, tile: options.tile || {} });
  }

  function getPriorityForegroundAction(point = {}, targets = [], options = {}) {
    const priorities = Array.isArray(options.priorities) ? options.priorities : DEFAULT_PRIORITY_ACTIONS;
    for (const type of priorities) {
      for (let index = (Array.isArray(targets) ? targets.length : 0) - 1; index >= 0; index -= 1) {
        const target = targets[index];
        if (target?.action?.type !== type || target.action.background) continue;
        if (containsPoint(target, point)) return target.action;
      }
    }
    return null;
  }

  function getHitTarget(point = {}, targets = []) {
    const targetList = Array.isArray(targets) ? targets : [];
    const diagEnabled = isActorPickingDiagEnabled();
    if (diagEnabled) {
      logActorPickingDiag('inputActionMap:getHitTarget:start', {
        point: { x: toNumber(point.x), y: toNumber(point.y) },
        targetCount: targetList.length,
        targets: targetList.map((target, index) => summarizeHitTarget(target, index, point)),
        containsMatches: targetList
          .map((target, index) => summarizeHitTarget(target, index, point))
          .filter((target) => target.containsPoint),
      });
    }
    const priorityAction = getPriorityForegroundAction(point, targets);
    if (priorityAction) {
      logActorPickingDiag('inputActionMap:getHitTarget:return', {
        reason: 'priorityAction',
        actionType: priorityAction.type || '',
        action: priorityAction,
      });
      return priorityAction;
    }
    const resolvedCandidates = resolveForegroundCandidates(point, targets);
    if (resolvedCandidates) {
      logActorPickingDiag('inputActionMap:getHitTarget:return', {
        reason: 'resolvedCandidates',
        actionType: resolvedCandidates.type || '',
        action: resolvedCandidates,
      });
      return resolvedCandidates;
    }
    let backgroundAction = null;
    for (let index = (Array.isArray(targets) ? targets.length : 0) - 1; index >= 0; index -= 1) {
      const target = targets[index];
      if (!containsPoint(target, point)) continue;
      if (target.action?.background) {
        if (!backgroundAction) backgroundAction = target.action;
      } else {
        if (target.action?.type === 'selectWorldActor') {
          const siteAction = getTopmostForegroundAction(point, targets, isWorldSiteAction);
          if (siteAction) {
            logActorPickingDiag('inputActionMap:getHitTarget:return', {
              reason: 'siteOverridesActor',
              actorTarget: summarizeHitTarget(target, index, point),
              siteActionType: siteAction.type || '',
              siteAction,
            });
            return siteAction;
          }
        }
        logActorPickingDiag('inputActionMap:getHitTarget:return', {
          reason: 'foregroundTarget',
          target: summarizeHitTarget(target, index, point),
          actionType: target.action?.type || '',
          action: target.action,
        });
        return target.action;
      }
    }
    logActorPickingDiag('inputActionMap:getHitTarget:return', {
      reason: backgroundAction ? 'backgroundAction' : 'none',
      actionType: backgroundAction?.type || '',
      action: backgroundAction,
    });
    return backgroundAction;
  }

  function getContextFrame(context = {}) {
    return context?.frame
      || context?.renderSnapshot?.frame
      || context?.viewport?.frame
      || null;
  }

  function isPointInContextFrame(point = {}, context = {}) {
    const frame = getContextFrame(context);
    if (!frame) return false;
    return containsPoint(frame, point);
  }

  function findKnownTile(tileMapView = {}, inferred = {}) {
    const coord = normalizeCoord(inferred);
    if (!Number.isFinite(Number(coord.q)) || !Number.isFinite(Number(coord.r))) return null;
    return (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : []).find((tile) => (
      normalizeCoord(tile).tileId === coord.tileId
    )) || null;
  }

  function isKnownTile(tile = null) {
    return Boolean(tile && tile.visibility !== 'unknown' && tile.discovered !== false);
  }

  function inferTileFromPoint(point = {}, context = {}, options = {}) {
    const tileMapView = context?.tileMapView || context?.renderSnapshot?.tileMapView || null;
    const viewport = context?.viewport || context?.renderSnapshot?.viewport || null;
    const geometry = context?.geometry || tileMapView?.geometry || viewport?.geometry || null;
    const axialMapper = options.screenPointToAxialTile
      || WorldMarchSystem?.screenPointToAxialTile;
    if (!tileMapView || !viewport || !geometry || typeof axialMapper !== 'function') return null;
    const inferred = axialMapper(point, viewport, geometry);
    const coord = normalizeCoord(inferred);
    if (!Number.isFinite(Number(coord.q)) || !Number.isFinite(Number(coord.r))) return null;
    const knownTile = findKnownTile(tileMapView, coord);
    const known = isKnownTile(knownTile);
    const displayCoord = knownTile ? normalizeCoord(knownTile, coord) : coord;
    return {
      q: displayCoord.q,
      r: displayCoord.r,
      tileId: displayCoord.tileId,
      known,
      terrain: known ? (knownTile.terrain || '') : '',
      terrainLabel: known ? (knownTile.terrainLabel || knownTile.terrain || '') : '未知',
      tile: knownTile,
    };
  }

  function buildSelectWorldMarchTargetAction(tile = {}, options = {}) {
    const coord = normalizeCoord(tile);
    if (!tile || !Number.isFinite(Number(coord.q)) || !Number.isFinite(Number(coord.r))) return null;
    return {
      type: 'selectWorldMarchTarget',
      tileId: coord.tileId,
      targetQ: coord.q,
      targetR: coord.r,
      known: Boolean(tile.known),
      terrain: tile.terrain || '',
      terrainLabel: tile.terrainLabel || (tile.known ? tile.terrain || '' : '未知'),
      background: options.background !== false,
    };
  }

  function getBackgroundMarchTargetAction(point = {}, context = {}, options = {}) {
    const tile = inferTileFromPoint(point, context, options);
    return tile ? buildSelectWorldMarchTargetAction(tile, { background: true }) : null;
  }

  function getPickingSnapshotAction(point = {}, input = {}, options = {}) {
    const pickingSnapshot = input.pickingSnapshot || options.pickingSnapshot || null;
    if (!pickingSnapshot || !WorldMapPickingModel?.resolveAction) return null;
    return WorldMapPickingModel.resolveAction(point, pickingSnapshot);
  }

  function resolveTapAction(point = {}, input = {}, options = {}) {
    const action = getHitTarget(point, input.hitTargets || input.targets || []);
    const context = input.context || input.tileMapContext || {};
    const backgroundPoint = input.backgroundPoint || options.backgroundPoint || point;
    if (action?.disabled) return null;
    if (action && !isRendererWorldSurfaceAction(action)) return action;
    const pickingAction = getPickingSnapshotAction(backgroundPoint, input, options);
    if (pickingAction) return pickingAction.disabled ? null : pickingAction;
    if (!action) {
      if (options.allowContextBackground === false) return null;
      if (!isPointInContextFrame(backgroundPoint, context)) return null;
      return getBackgroundMarchTargetAction(backgroundPoint, context, options);
    }
    if (isRendererWorldSurfaceAction(action)) {
      if (options.allowContextBackground === false) return null;
      return getBackgroundMarchTargetAction(backgroundPoint, context, options);
    }
    return action;
  }

  const api = {
    DEFAULT_ALLOWED_ACTIONS,
    DEFAULT_PRIORITY_ACTIONS,
    buildSelectWorldMarchTargetAction,
    containsPoint,
    findKnownTile,
    getForegroundTargets,
    getPriorityForegroundAction,
    getBackgroundMarchTargetAction,
    getContextFrame,
    getHitTarget,
    getTopmostForegroundAction,
    inferTileFromPoint,
    isAllowedAction,
    isPointInContextFrame,
    isKnownTile,
    isRendererWorldSurfaceAction,
    isWorldMapSurfaceAction,
    isWorldSiteAction,
    normalizeHitTarget,
    normalizeHitTargets,
    resolveForegroundCandidates,
    resolveTapAction,
    shouldRouteTapThroughWorldMapRuntime,
  };

  global.WorldMapInputActionMap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
