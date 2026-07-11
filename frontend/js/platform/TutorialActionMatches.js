(function (global) {
  const TARGET_ID_KEYS = Object.freeze(['siteId', 'territoryId', 'cityId', 'targetId']);

  function getTargetId(item = {}) {
    return item.siteId || item.territoryId || item.cityId || item.targetId || '';
  }

  function matchesWorldTargetPicker(action = {}, allowedAction = {}) {
    if (allowedAction.type !== 'openWorldSite' || action.type !== 'openWorldTargetPicker') return false;
    const wanted = String(allowedAction.siteId || allowedAction.cityId || allowedAction.territoryId || '');
    const candidates = Array.isArray(action.candidates) ? action.candidates : [];
    return candidates.some((candidate) => {
      const candidateAction = candidate?.action || candidate || {};
      const candidateSiteId = String(
        candidateAction.siteId || candidateAction.cityId || candidateAction.territoryId || '',
      );
      return (candidateAction.type === 'openWorldSite' || candidate?.kind === 'site')
        && (!wanted || candidateSiteId === wanted);
    });
  }

  function actionMatches(action = {}, allowedAction = null) {
    if (!action?.type || !allowedAction?.type) return false;
    if (matchesWorldTargetPicker(action, allowedAction)) return true;
    if (action.type !== allowedAction.type) return false;
    const allowedTargetId = getTargetId(allowedAction);
    const actionTargetId = getTargetId(action);
    return Object.entries(allowedAction).every(([key, value]) => (
      key === 'type'
      || value === undefined
      || action[key] === value
      || (TARGET_ID_KEYS.includes(key)
        && (!actionTargetId || !allowedTargetId || actionTargetId === allowedTargetId))
    ));
  }

  function isAdvisorCloseAllowed(action = {}, dialogue = null) {
    if (action?.type !== 'closeAdvisor' || !dialogue) return false;
    const actionSource = action.source || '';
    const dialogueSource = dialogue.source || '';
    return !actionSource
      || actionSource === 'tutorialAdvisorDialogue'
      || !dialogueSource
      || actionSource === dialogueSource;
  }

  function isRewardRevealCloseAllowed(action = {}, rewardRevealOpen = false) {
    return Boolean(rewardRevealOpen && action?.type === 'closeRewardReveal');
  }

  const TutorialActionMatches = Object.freeze({
    actionMatches,
    isAdvisorCloseAllowed,
    isRewardRevealCloseAllowed,
  });

  global.TutorialActionMatches = TutorialActionMatches;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialActionMatches;
})(typeof window !== 'undefined' ? window : globalThis);
