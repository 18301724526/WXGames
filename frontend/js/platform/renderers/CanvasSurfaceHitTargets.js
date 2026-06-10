(function (global) {
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
      action,
    };
  }

  function isAllowedUnderTutorialShield(action = {}) {
    if (action.type === 'closeRewardReveal') return true;
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
    'returnWorldMarch',
    'stopWorldMarch',
    'openWorldMarchFormationPicker',
    'startWorldMarch',
    'closeWorldMarchHud',
    'selectWorldActor',
  ]);

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

  function resolveHitTarget(hitTargets = [], point = {}, intro = null) {
    let backgroundAction = null;
    let tutorialShieldAction = null;
    const tutorialAllowedActions = [];
    const priorityAction = getPriorityHitTarget(hitTargets, point);
    if (priorityAction) return priorityAction;
    for (let index = hitTargets.length - 1; index >= 0; index -= 1) {
      const target = hitTargets[index];
      if (!containsPoint(target, point)) continue;
      if (target.action?.type === 'blockCanvasModal') {
        tutorialShieldAction = target.action;
        if (target.action.allowedAction) tutorialAllowedActions.push(target.action.allowedAction);
      } else if (tutorialShieldAction && !isAllowedUnderTutorialShield(target.action)) {
        return (
          tutorialAllowedActions.some((allowed) => matchesTutorialShieldAllowedAction(target.action, allowed))
          || matchesCurrentTutorialIntroAction(target.action, intro)
        )
          ? target.action
          : tutorialShieldAction;
      } else if (target.action?.background) {
        backgroundAction = target.action;
      } else {
        return target.action;
      }
    }
    return tutorialShieldAction || backgroundAction;
  }

  const api = {
    containsPoint,
    DEFAULT_PRIORITY_ACTIONS,
    getPriorityHitTarget,
    isAllowedUnderTutorialShield,
    matchesCurrentTutorialIntroAction,
    matchesTutorialShieldAllowedAction,
    normalizeHitTarget,
    resolveHitTarget,
  };

  global.CanvasSurfaceHitTargets = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
