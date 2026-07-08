(function (global) {
  const WorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../system/WorldMarchSystem');
      } catch (_) {
        return null;
      }
    }
    return null;
  })();
  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../foundation/TileCoord');
      } catch (_) {
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
      } catch (_) {
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
      } catch (_) {
        return null;
      }
    }
    return null;
  })();
  // Resolved at call time (not module load) to stay immune to script load order.
  function resolveLocaleText() {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  }
  const ActorPickingDiagnostics = (() => {
    if (global.ActorPickingDiagnostics) return global.ActorPickingDiagnostics;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../debug/ActorPickingDiagnostics');
      } catch (_error) {
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

  function t(key = '', params = {}) {
    const localeText = resolveLocaleText();
    return localeText ? localeText.t(key, params) : key;
  }

  function isActorPickingDiagEnabled() {
    return ActorPickingDiagnostics?.isEnabled?.() === true || global.__actorPickingDiag === true;
  }

  function getRecentActorPickingDiagEvents(limit = 20) {
    if (ActorPickingDiagnostics?.getRecentEvents) {
      return ActorPickingDiagnostics.getRecentEvents(limit);
    }
    const events = Array.isArray(global.__actorPickingDiagEvents)
      ? global.__actorPickingDiagEvents
      : [];
    return events.slice(Math.max(0, events.length - limit));
  }

  function logActorPickingDiag(stage = '', detail = {}, options = {}) {
    if (ActorPickingDiagnostics?.log) {
      return ActorPickingDiagnostics.log(stage, detail, options);
    }
    return null;
  }

  function normalizeCoord(source = {}, fallback = {}) {
    return TileCoord.normalizeCoord(source, fallback);
  }

  function containsPoint(target = {}, point = {}) {
    const x = Number(point.x);
    const y = Number(point.y);
    return Boolean(
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= toNumber(target.x) &&
      x <= toNumber(target.x) + toNumber(target.width) &&
      y >= toNumber(target.y) &&
      y <= toNumber(target.y) + toNumber(target.height),
    );
  }

  function summarizeAction(action = {}) {
    return action
      ? {
          type: action.type || '',
          actorId: action.actorId || '',
          missionId: action.missionId || '',
          tileId: action.tileId || '',
          siteId: action.siteId || '',
          targetQ: action.targetQ ?? action.q ?? null,
          targetR: action.targetR ?? action.r ?? null,
          inputSurface: action.inputSurface || '',
          background: Boolean(action.background),
          disabled: Boolean(action.disabled),
        }
      : null;
  }

  function summarizeHitTarget(target = {}, index = -1, point = {}) {
    return {
      index,
      x: toNumber(target.x),
      y: toNumber(target.y),
      width: toNumber(target.width),
      height: toNumber(target.height),
      containsPoint: containsPoint(target, point),
      action: summarizeAction(target.action || {}),
    };
  }

  function summarizeHitTargetsForTap(point = {}, targets = []) {
    const list = Array.isArray(targets) ? targets : [];
    const actorTargets = [];
    const containsMatches = [];
    list.forEach((target, index) => {
      const summary = summarizeHitTarget(target, index, point);
      if (target?.action?.type === 'selectWorldActor') actorTargets.push(summary);
      if (summary.containsPoint) containsMatches.push(summary);
    });
    return {
      targetCount: list.length,
      actorTargetCount: actorTargets.length,
      containsMatchCount: containsMatches.length,
      containsActorCount: containsMatches.filter(
        (target) => target.action?.type === 'selectWorldActor',
      ).length,
      containsSiteCount: containsMatches.filter((target) => isWorldSiteAction(target.action))
        .length,
      actorTargets: actorTargets.slice(0, 12),
      containsMatches: containsMatches.slice(0, 12),
    };
  }

  function isAllowedAction(action = {}, allowedActions = DEFAULT_ALLOWED_ACTIONS) {
    if (!action?.type) return false;
    if (!allowedActions) return true;
    const allowedSet = allowedActions instanceof Set ? allowedActions : new Set(allowedActions);
    return allowedSet.has(action.type);
  }

  function normalizeHitTarget(target = {}, options = {}) {
    const action = target?.action || null;
    if (!action || !isAllowedAction(action, options.allowedActions || DEFAULT_ALLOWED_ACTIONS))
      return null;
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
    return (
      action.type === 'worldMapDrag' ||
      action.type === 'openWorldSite' ||
      action.type === 'selectWorldActor' ||
      (action.type === 'selectWorldMarchTarget' && action.background)
    );
  }

  function isWorldMapSurfaceAction(action = {}) {
    return action?.inputSurface === 'worldMap';
  }

  function shouldRouteTapThroughWorldMapRuntime(action = null) {
    if (!action) return true;
    if (action.disabled || action.type === 'blockCanvasModal') return false;
    if (isWorldMapSurfaceAction(action)) return isRendererWorldSurfaceAction(action);
    return (
      action.type === 'worldMapDrag' ||
      (action.type === 'selectWorldMarchTarget' && action.background)
    );
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
    const candidates = getForegroundTargets(point, targets).filter((target) =>
      WorldMapSelectionResolver.isWorldEntityAction?.(target.action),
    );
    if (candidates.length <= 1) return null;
    const normalized = WorldMapSelectionResolver.normalizeCandidates?.(candidates, {
      point,
      tile: options.tile || {},
    });
    if (!Array.isArray(normalized) || normalized.length <= 1) return null;
    return WorldMapSelectionResolver.createPickerAction
      ? WorldMapSelectionResolver.createPickerAction(normalized, {
          point,
          tile: options.tile || {},
        })
      : WorldMapSelectionResolver.resolveCandidates(normalized, {
          point,
          tile: options.tile || {},
        });
  }

  function getPriorityForegroundAction(point = {}, targets = [], options = {}) {
    const priorities = Array.isArray(options.priorities)
      ? options.priorities
      : DEFAULT_PRIORITY_ACTIONS;
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
    const priorityAction = getPriorityForegroundAction(point, targets);
    if (priorityAction) return priorityAction;
    const resolvedCandidates = resolveForegroundCandidates(point, targets);
    if (resolvedCandidates) return resolvedCandidates;
    let backgroundAction = null;
    for (let index = (Array.isArray(targets) ? targets.length : 0) - 1; index >= 0; index -= 1) {
      const target = targets[index];
      if (!containsPoint(target, point)) continue;
      if (target.action?.background) {
        if (!backgroundAction) backgroundAction = target.action;
      } else {
        if (target.action?.type === 'selectWorldActor') {
          const siteAction = getTopmostForegroundAction(point, targets, isWorldSiteAction);
          if (siteAction) return siteAction;
        }
        return target.action;
      }
    }
    return backgroundAction;
  }

  function getContextFrame(context = {}) {
    return context?.frame || context?.renderSnapshot?.frame || context?.viewport?.frame || null;
  }

  function isPointInContextFrame(point = {}, context = {}) {
    const frame = getContextFrame(context);
    if (!frame) return false;
    return containsPoint(frame, point);
  }

  function findKnownTile(tileMapView = {}, inferred = {}) {
    const coord = normalizeCoord(inferred);
    if (!Number.isFinite(Number(coord.q)) || !Number.isFinite(Number(coord.r))) return null;
    return (
      (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : []).find(
        (tile) => normalizeCoord(tile).tileId === coord.tileId,
      ) || null
    );
  }

  function isKnownTile(tile = null) {
    return Boolean(tile && tile.visibility !== 'unknown' && tile.discovered !== false);
  }

  function inferTileFromPoint(point = {}, context = {}, options = {}) {
    const tileMapView = context?.tileMapView || context?.renderSnapshot?.tileMapView || null;
    const viewport = context?.viewport || context?.renderSnapshot?.viewport || null;
    const geometry = context?.geometry || tileMapView?.geometry || viewport?.geometry || null;
    const axialMapper = options.screenPointToAxialTile || WorldMarchSystem?.screenPointToAxialTile;
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
      terrain: known ? knownTile.terrain || '' : '',
      terrainLabel: known
        ? knownTile.terrainLabel || knownTile.terrain || ''
        : t('world.march.target.unknownTerrain'),
      tile: knownTile,
    };
  }

  function buildSelectWorldMarchTargetAction(tile = {}, options = {}) {
    const coord = normalizeCoord(tile);
    if (!tile || !Number.isFinite(Number(coord.q)) || !Number.isFinite(Number(coord.r)))
      return null;
    return {
      type: 'selectWorldMarchTarget',
      tileId: coord.tileId,
      targetQ: coord.q,
      targetR: coord.r,
      known: Boolean(tile.known),
      terrain: tile.terrain || '',
      terrainLabel:
        tile.terrainLabel ||
        (tile.known ? tile.terrain || '' : t('world.march.target.unknownTerrain')),
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
    const hitTargets = input.hitTargets || input.targets || [];
    const tapTraceId = options.tapTraceId || input.tapTraceId || '';
    const action = getHitTarget(point, hitTargets);
    const context = input.context || input.tileMapContext || {};
    const backgroundPoint = input.backgroundPoint || options.backgroundPoint || point;
    let pickingAction = null;
    let finalAction = null;
    let reason = '';
    if (action?.disabled) {
      reason = 'renderer-disabled';
    } else if (action && !isRendererWorldSurfaceAction(action)) {
      finalAction = action;
      reason = 'renderer-direct';
    } else {
      pickingAction = getPickingSnapshotAction(backgroundPoint, input, options);
      if (pickingAction) {
        finalAction = pickingAction.disabled ? null : pickingAction;
        reason = pickingAction.disabled ? 'picking-disabled' : 'picking';
      } else if (!action) {
        if (options.allowContextBackground === false) {
          reason = 'context-background-disabled';
        } else if (!isPointInContextFrame(backgroundPoint, context)) {
          reason = 'outside-context-frame';
        } else {
          finalAction = getBackgroundMarchTargetAction(backgroundPoint, context, options);
          reason = finalAction ? 'context-background' : 'context-background-miss';
        }
      } else if (isRendererWorldSurfaceAction(action)) {
        if (options.allowContextBackground === false) {
          reason = 'renderer-world-surface-background-disabled';
        } else {
          finalAction = getBackgroundMarchTargetAction(backgroundPoint, context, options);
          reason = finalAction
            ? 'renderer-world-surface-background'
            : 'renderer-world-surface-background-miss';
        }
      } else {
        finalAction = action;
        reason = 'fallback';
      }
    }
    logActorPickingDiag('inputActionMap:resolveTapAction', {
      tapTraceId,
      point: { x: toNumber(point.x), y: toNumber(point.y) },
      backgroundPoint: { x: toNumber(backgroundPoint.x), y: toNumber(backgroundPoint.y) },
      reason,
      rendererAction: summarizeAction(action),
      pickingAction: summarizeAction(pickingAction),
      finalAction: summarizeAction(finalAction),
      pickingSnapshot: input.pickingSnapshot
        ? {
            inputEpoch: input.pickingSnapshot.inputEpoch || 0,
            signature: input.pickingSnapshot.signature || '',
            counts: input.pickingSnapshot.counts || null,
          }
        : null,
      hitTargets: summarizeHitTargetsForTap(point, hitTargets),
    });
    return finalAction;
  }

  const api = {
    DEFAULT_ALLOWED_ACTIONS,
    DEFAULT_PRIORITY_ACTIONS,
    buildSelectWorldMarchTargetAction,
    containsPoint,
    findKnownTile,
    getForegroundTargets,
    getRecentActorPickingDiagEvents,
    getPriorityForegroundAction,
    getBackgroundMarchTargetAction,
    getContextFrame,
    getHitTarget,
    getTopmostForegroundAction,
    inferTileFromPoint,
    isAllowedAction,
    isActorPickingDiagEnabled,
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
    t,
  };

  global.WorldMapInputActionMap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
