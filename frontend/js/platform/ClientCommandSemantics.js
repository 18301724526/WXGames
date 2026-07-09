(function (global) {
  const COMMAND_ACTION_TYPES = new Set([
    'acceptFamousPerson',
    'advanceEra',
    'assignFamousAttributePoint',
    'assignJob',
    'autoReplenishArmyFormation',
    'buildBuilding',
    'claimConquest',
    'claimEvent',
    'claimGuideTaskReward',
    'claimTaskReward',
    'conquer',
    'dismissFamousPersonCandidate',
    'entityBattleAuto',
    'entityBattleMaster',
    'entityBattleOrder',
    'entityBattleSkill',
    'launchExpedition',
    'research',
    'resolveCapture',
    'saveArmyFormation',
    'seekFamousPerson',
    'startWorldMarch',
    'stopWorldMarch',
    'submitNaming',
    'upgradeBuilding',
    'veteranCampUpgrade',
    'veteranCampWithdraw',
  ]);

  function isCommandAction(action = {}) {
    return COMMAND_ACTION_TYPES.has(String(action?.type || ''));
  }

  function isVisualDisabled(action = {}) {
    return Boolean(action?.visualDisabled ?? (isCommandAction(action) ? action?.disabled : false));
  }

  function isCommandDisabled(action = {}) {
    return isCommandAction(action) && Boolean(action?.commandDisabled);
  }

  function normalizeAction(action = null) {
    if (!action || !isCommandAction(action) || action.disabled === undefined) return action;
    const normalized = { ...action, visualDisabled: Boolean(action.visualDisabled ?? action.disabled) };
    delete normalized.disabled;
    return normalized;
  }

  const api = {
    COMMAND_ACTION_TYPES,
    isCommandAction,
    isVisualDisabled,
    isCommandDisabled,
    normalizeAction,
  };

  global.ClientCommandSemantics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
