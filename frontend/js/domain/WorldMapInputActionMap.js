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

  const DEFAULT_ALLOWED_ACTIONS = Object.freeze([
    'openWorldSite',
    'resetWorldPan',
    'worldMapDrag',
    'selectWorldMarchTarget',
    'openWorldMarchFormationPicker',
    'startWorldMarch',
    'closeWorldMarchHud',
    'selectWorldActor',
    'returnWorldMarch',
    'stopWorldMarch',
    'enterCity',
    'renameCity',
    'territoryAction',
  ]);

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
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

  function getHitTarget(point = {}, targets = []) {
    let backgroundAction = null;
    for (let index = (Array.isArray(targets) ? targets.length : 0) - 1; index >= 0; index -= 1) {
      const target = targets[index];
      if (!containsPoint(target, point)) continue;
      if (target.action?.background) {
        if (!backgroundAction) backgroundAction = target.action;
      } else {
        return target.action;
      }
    }
    return backgroundAction;
  }

  function findKnownTile(tileMapView = {}, inferred = {}) {
    if (!Number.isFinite(Number(inferred?.q)) || !Number.isFinite(Number(inferred?.r))) return null;
    return (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : []).find((tile) => (
      (tile.id && tile.id === inferred.tileId)
      || (toInteger(tile.q) === inferred.q && toInteger(tile.r) === inferred.r)
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
    if (!Number.isFinite(Number(inferred?.q)) || !Number.isFinite(Number(inferred?.r))) return null;
    const q = toInteger(inferred.q);
    const r = toInteger(inferred.r);
    const fallbackTileId = inferred.tileId || `tile_${q}_${r}`;
    const knownTile = findKnownTile(tileMapView, { ...inferred, q, r, tileId: fallbackTileId });
    const known = isKnownTile(knownTile);
    return {
      q,
      r,
      tileId: knownTile?.id || fallbackTileId,
      known,
      terrain: known ? (knownTile.terrain || '') : '',
      terrainLabel: known ? (knownTile.terrainLabel || knownTile.terrain || '') : '未知',
      tile: knownTile,
    };
  }

  function buildSelectWorldMarchTargetAction(tile = {}, options = {}) {
    if (!tile || !Number.isFinite(Number(tile.q)) || !Number.isFinite(Number(tile.r))) return null;
    return {
      type: 'selectWorldMarchTarget',
      tileId: tile.tileId || `tile_${toInteger(tile.q)}_${toInteger(tile.r)}`,
      targetQ: toInteger(tile.q),
      targetR: toInteger(tile.r),
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

  function resolveTapAction(point = {}, input = {}, options = {}) {
    const action = getHitTarget(point, input.hitTargets || input.targets || []);
    if (!action || action.disabled) return null;
    if (action.type === 'worldMapDrag') {
      return getBackgroundMarchTargetAction(point, input.context || input.tileMapContext || {}, options);
    }
    return action;
  }

  const api = {
    DEFAULT_ALLOWED_ACTIONS,
    buildSelectWorldMarchTargetAction,
    containsPoint,
    findKnownTile,
    getBackgroundMarchTargetAction,
    getHitTarget,
    inferTileFromPoint,
    isAllowedAction,
    isKnownTile,
    normalizeHitTarget,
    normalizeHitTargets,
    resolveTapAction,
  };

  global.WorldMapInputActionMap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
