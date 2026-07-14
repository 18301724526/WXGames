(function (global) {
  const WorldMapSelectionResolver = (() => {
    if (global.WorldMapSelectionResolver) return global.WorldMapSelectionResolver;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/input/WorldMapSelectionResolver');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const ClientCommandSemantics = (() => {
    if (global.ClientCommandSemantics) return global.ClientCommandSemantics;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ClientCommandSemantics');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function containsPoint(rect = {}, point = {}) {
    const x = Number(point.x);
    const y = Number(point.y);
    return Number.isFinite(x)
      && Number.isFinite(y)
      && x >= Number(rect.x)
      && x <= Number(rect.x) + Number(rect.width)
      && y >= Number(rect.y)
      && y <= Number(rect.y) + Number(rect.height);
  }

  function normalizeHitTarget(rect, action) {
    if (!action || !rect) return null;
    return {
      x: Number(rect.x) || 0,
      y: Number(rect.y) || 0,
      width: Number(rect.width) || 0,
      height: Number(rect.height) || 0,
      action: ClientCommandSemantics?.normalizeAction?.(action) || action,
    };
  }

  function matchesAllowedAction(action = {}, allowed = null) {
    if (ClientCommandSemantics?.isVisuallyDisabled?.(action)
      ?? Boolean(action?.visualDisabled ?? action?.disabled)) return false;
    if (!action?.type || !allowed?.type || action.type !== allowed.type) return false;
    const getId = (item = {}) => item.cityId || item.territoryId || item.siteId || item.targetId || '';
    const allowedId = getId(allowed);
    const actionId = getId(action);
    return !allowedId || !actionId || allowedId === actionId;
  }

  const DEFAULT_PRIORITY_ACTIONS = Object.freeze([
    'closeWorldTargetPicker',
    'chooseWorldTarget',
    'returnWorldMarch',
    'stopWorldMarch',
    'openWorldMarchFormationPicker',
    'startWorldMarch',
    'closeWorldMarchHud',
  ]);

  function isWorldSiteAction(action = {}) {
    return action?.type === 'openWorldSite' || action?.type === 'enterCity';
  }

  function getTopmostForegroundAction(targets = [], point = {}, predicate = null) {
    for (let index = targets.length - 1; index >= 0; index -= 1) {
      const target = targets[index];
      const action = target?.action;
      if (!action || action.background || !containsPoint(target, point)) continue;
      if (!predicate || predicate(action, target)) return action;
    }
    return null;
  }

  function getPriorityHitTarget(targets = [], point = {}, options = {}) {
    const priorities = Array.isArray(options.priorities) ? options.priorities : DEFAULT_PRIORITY_ACTIONS;
    for (const type of priorities) {
      for (let index = targets.length - 1; index >= 0; index -= 1) {
        const target = targets[index];
        if (target.action?.type !== type || target.action?.background) continue;
        if (containsPoint(target, point)) return target.action;
      }
    }
    return null;
  }

  function resolveWorldEntityCandidates(hitTargets = [], point = {}) {
    if (!WorldMapSelectionResolver?.resolveCandidates) return null;
    const matches = [];
    for (let index = hitTargets.length - 1; index >= 0; index -= 1) {
      const target = hitTargets[index];
      if (!target?.action || target.action.background || !containsPoint(target, point)) continue;
      if (!WorldMapSelectionResolver.isWorldEntityAction?.(target.action)) continue;
      matches.push({ ...target, index });
    }
    if (matches.length <= 1) return null;
    const normalized = WorldMapSelectionResolver.normalizeCandidates?.(matches, { point });
    if (!Array.isArray(normalized) || normalized.length <= 1) return null;
    return WorldMapSelectionResolver.createPickerAction
      ? WorldMapSelectionResolver.createPickerAction(normalized, { point })
      : WorldMapSelectionResolver.resolveCandidates(normalized, { point });
  }

  function hasCanvasModalShieldAtPoint(hitTargets = [], point = {}) {
    return (Array.isArray(hitTargets) ? hitTargets : []).some((target) => (
      target?.action?.type === 'blockCanvasModal' && containsPoint(target, point)
    ));
  }

  function isAllowedByCanvasModalShield(action = {}, allowedActions = []) {
    return allowedActions.some((allowed) => matchesAllowedAction(action, allowed));
  }

  function resolveCanvasModalShieldedHitTarget(hitTargets = [], point = {}) {
    let backgroundAction = null;
    for (let index = hitTargets.length - 1; index >= 0; index -= 1) {
      const target = hitTargets[index];
      if (!containsPoint(target, point)) continue;
      if (target.action?.type === 'blockCanvasModal') {
        const shieldAction = target.action;
        const allowedActions = [];
        if (shieldAction.allowedAction) allowedActions.push(shieldAction.allowedAction);
        if (Array.isArray(shieldAction.allowedActions)) allowedActions.push(...shieldAction.allowedActions);
        for (let shieldedIndex = index - 1; shieldedIndex >= 0; shieldedIndex -= 1) {
          const shieldedTarget = hitTargets[shieldedIndex];
          const shieldedAction = shieldedTarget?.action || {};
          if (!containsPoint(shieldedTarget, point)) continue;
          if (shieldedAction.type === 'blockCanvasModal') {
            if (shieldedAction.allowedAction) allowedActions.push(shieldedAction.allowedAction);
            if (Array.isArray(shieldedAction.allowedActions)) allowedActions.push(...shieldedAction.allowedActions);
            continue;
          }
          if (shieldedAction.background) {
            if (!backgroundAction) backgroundAction = shieldedAction;
            continue;
          }
          if (isAllowedByCanvasModalShield(shieldedAction, allowedActions)) return shieldedAction;
        }
        return shieldAction;
      } else if (target.action?.background) {
        backgroundAction = target.action;
      } else {
        return target.action;
      }
    }
    return backgroundAction;
  }

  function resolveHitTarget(hitTargets = [], point = {}) {
    if (hasCanvasModalShieldAtPoint(hitTargets, point)) {
      return resolveCanvasModalShieldedHitTarget(hitTargets, point);
    }
    const priorityAction = getPriorityHitTarget(hitTargets, point);
    if (priorityAction) return priorityAction;
    const worldEntityAction = resolveWorldEntityCandidates(hitTargets, point);
    if (worldEntityAction) return worldEntityAction;
    let backgroundAction = null;
    for (let index = hitTargets.length - 1; index >= 0; index -= 1) {
      const target = hitTargets[index];
      if (!containsPoint(target, point)) continue;
      if (target.action?.background) {
        backgroundAction = target.action;
      } else {
        return target.action;
      }
    }
    return backgroundAction;
  }

  function resolveHitTargetPools(hitTargetPools = {}, point = {}) {
    const pools = hitTargetPools && typeof hitTargetPools === 'object' ? hitTargetPools : {};
    for (const pool of ['modal', 'base']) {
      const action = resolveHitTarget(Array.isArray(pools[pool]) ? pools[pool] : [], point);
      if (action) return action;
    }
    return null;
  }

  const api = {
    containsPoint,
    DEFAULT_PRIORITY_ACTIONS,
    getTopmostForegroundAction,
    getPriorityHitTarget,
    hasCanvasModalShieldAtPoint,
    isAllowedByCanvasModalShield,
    isWorldSiteAction,
    matchesAllowedAction,
    normalizeHitTarget,
    resolveCanvasModalShieldedHitTarget,
    resolveWorldEntityCandidates,
    resolveHitTarget,
    resolveHitTargetPools,
  };

  global.CanvasSurfaceHitTargets = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
