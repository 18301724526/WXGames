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

  function isAllowedUnderTutorialShield(action = {}) {
    if (action.type === 'closeRewardReveal') return true;
    if (action.type === 'closeAdvisor' && action.source) return true;
    if (action.type === 'goToGuideTaskTarget') return true;
    if (action.type === 'openTaskCenter') return !action.disabled;
    if (action.type === 'claimTaskReward' || action.type === 'claimGuideTaskReward') {
      return (action.category || 'main') === 'main';
    }
    return false;
  }

  function matchesTutorialShieldAllowedAction(action = {}, allowed = null) {
    if (action.disabled) return false;
    if (!action?.type || !allowed?.type || action.type !== allowed.type) return false;
    const getId = (item = {}) => item.cityId || item.territoryId || item.siteId || item.targetId || '';
    const allowedId = getId(allowed);
    const actionId = getId(action);
    return !allowedId || !actionId || allowedId === actionId;
  }

  function matchesCurrentTutorialIntroAction(action = {}, intro = null) {
    if (!intro?.active || !action?.type) return false;
    const capitalCityId = intro.capitalCityId || 'capital';
    const actionId = action.cityId || action.territoryId || action.siteId || '';
    if (intro.step === 'city') return action.type === 'openWorldSite' && (!actionId || actionId === capitalCityId);
    if (intro.step === 'enter') return action.type === 'enterCity' && (!actionId || actionId === capitalCityId);
    return false;
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

  function hasTutorialShieldAtPoint(hitTargets = [], point = {}) {
    return (Array.isArray(hitTargets) ? hitTargets : []).some((target) => (
      target?.action?.type === 'blockCanvasModal' && containsPoint(target, point)
    ));
  }

  function isAllowedByTutorialShield(action = {}, allowedActions = [], intro = null) {
    return isAllowedUnderTutorialShield(action)
      || allowedActions.some((allowed) => matchesTutorialShieldAllowedAction(action, allowed))
      || matchesCurrentTutorialIntroAction(action, intro);
  }

  function resolveTutorialShieldedHitTarget(hitTargets = [], point = {}, intro = null) {
    let backgroundAction = null;
    for (let index = hitTargets.length - 1; index >= 0; index -= 1) {
      const target = hitTargets[index];
      if (!containsPoint(target, point)) continue;
      if (target.action?.type === 'blockCanvasModal') {
        const shieldAction = target.action;
        const tutorialAllowedActions = [];
        if (shieldAction.allowedAction) tutorialAllowedActions.push(shieldAction.allowedAction);
        for (let shieldedIndex = index - 1; shieldedIndex >= 0; shieldedIndex -= 1) {
          const shieldedTarget = hitTargets[shieldedIndex];
          const shieldedAction = shieldedTarget?.action || {};
          if (!containsPoint(shieldedTarget, point)) continue;
          if (shieldedAction.type === 'blockCanvasModal') {
            if (shieldedAction.allowedAction) tutorialAllowedActions.push(shieldedAction.allowedAction);
            continue;
          }
          if (shieldedAction.background) {
            if (!backgroundAction) backgroundAction = shieldedAction;
            continue;
          }
          if (isAllowedByTutorialShield(shieldedAction, tutorialAllowedActions, intro)) return shieldedAction;
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

  function resolveHitTarget(hitTargets = [], point = {}, intro = null) {
    if (hasTutorialShieldAtPoint(hitTargets, point)) {
      return resolveTutorialShieldedHitTarget(hitTargets, point, intro);
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

  function resolveHitTargetPools(hitTargetPools = {}, point = {}, intro = null) {
    const pools = hitTargetPools && typeof hitTargetPools === 'object' ? hitTargetPools : {};
    for (const pool of ['guide', 'modal', 'base']) {
      const action = resolveHitTarget(Array.isArray(pools[pool]) ? pools[pool] : [], point, intro);
      if (action) return action;
    }
    return null;
  }

  const api = {
    containsPoint,
    DEFAULT_PRIORITY_ACTIONS,
    getTopmostForegroundAction,
    getPriorityHitTarget,
    hasTutorialShieldAtPoint,
    isAllowedUnderTutorialShield,
    isAllowedByTutorialShield,
    isWorldSiteAction,
    matchesCurrentTutorialIntroAction,
    matchesTutorialShieldAllowedAction,
    normalizeHitTarget,
    resolveTutorialShieldedHitTarget,
    resolveWorldEntityCandidates,
    resolveHitTarget,
    resolveHitTargetPools,
  };

  global.CanvasSurfaceHitTargets = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
