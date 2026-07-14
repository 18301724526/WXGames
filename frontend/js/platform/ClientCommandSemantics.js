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

  const LOCAL_BLOCK_REASONS = Object.freeze([
    'IN_FLIGHT',
    'DUPLICATE_COMMAND_ID',
    'PAYLOAD_SHAPE',
    'UI_NOT_READY',
  ]);
  const LOCAL_BLOCK_REASON_SET = new Set(LOCAL_BLOCK_REASONS);

  function isCommandAction(action = {}) {
    return COMMAND_ACTION_TYPES.has(String(action?.type || ''));
  }

  function isVisualDisabled(action = {}) {
    return Boolean(action?.visualDisabled ?? (isCommandAction(action) ? action?.disabled : false));
  }

  function isVisuallyDisabled(action = {}) {
    return Boolean(action?.visualDisabled ?? action?.disabled);
  }

  function isCommandDisabled(action = {}) {
    return Boolean(getCommandBlockReason(action));
  }

  function getCommandBlockReason(action = {}) {
    if (!isCommandAction(action)) return '';
    const reason = String(action?.commandDisabled || '').trim().toUpperCase();
    return LOCAL_BLOCK_REASON_SET.has(reason) ? reason : '';
  }

  function getCommandKey(action = {}) {
    const explicitKey = action.commandKey || action.idempotencyKey || action.commandId;
    if (explicitKey) return String(explicitKey);
    const identityParts = [
      action.type,
      action.buildingId,
      action.techId,
      action.taskId,
      action.eventId,
      action.candidateId,
      action.personId,
      action.cityId,
      action.territoryId,
      action.siteId,
      action.missionId,
      action.actorId,
      action.gid,
      action.skillId,
      action.order,
      action.job,
      action.attribute,
      action.category,
      action.delta,
    ].filter((value) => value !== undefined && value !== null && value !== '');
    return identityParts.map((value) => String(value)).join(':');
  }

  function normalizeAction(action = null) {
    if (!action || !isCommandAction(action) || action.disabled === undefined) return action;
    const normalized = { ...action, visualDisabled: Boolean(action.visualDisabled ?? action.disabled) };
    delete normalized.disabled;
    return normalized;
  }

  const api = {
    COMMAND_ACTION_TYPES,
    LOCAL_BLOCK_REASONS,
    isCommandAction,
    isVisualDisabled,
    isVisuallyDisabled,
    isCommandDisabled,
    getCommandBlockReason,
    getCommandKey,
    normalizeAction,
  };

  global.ClientCommandSemantics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
