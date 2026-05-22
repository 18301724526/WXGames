const BuildingConfig = require('../config/BuildingConfig');
const { getAdvanceConfig } = require('../config/EraConfig');
const BuildingCostCalculator = require('../calculators/BuildingCostCalculator');
const BuildingState = require('../domain/BuildingState');
const EventDomain = require('../domain/Event');
const CityService = require('./CityService');
const MilitaryService = require('./MilitaryService');

const STATE_KEY = 'guideTasks';

function getTaskState(gameState) {
  gameState.softGuideState = gameState.softGuideState && typeof gameState.softGuideState === 'object'
    ? gameState.softGuideState
    : {};
  const state = gameState.softGuideState[STATE_KEY] && typeof gameState.softGuideState[STATE_KEY] === 'object'
    ? gameState.softGuideState[STATE_KEY]
    : {};
  state.claimed = state.claimed && typeof state.claimed === 'object' ? state.claimed : {};
  gameState.softGuideState[STATE_KEY] = state;
  return state;
}

function isClaimed(gameState, taskId) {
  return Boolean(getTaskState(gameState).claimed?.[taskId]);
}

function markClaimed(gameState, taskId) {
  const state = getTaskState(gameState);
  state.claimed = { ...(state.claimed || {}), [taskId]: new Date().toISOString() };
  return state;
}

function isTutorialDone(gameState) {
  return Boolean(gameState?.tutorial?.completed || gameState?.tutorial?.phaseCompleted?.era2);
}

function getLevel(gameState, buildingId) {
  return BuildingState.getLevel(CityService.getCapitalCity(gameState).buildings, buildingId);
}

function hasBuilt(gameState, buildingId) {
  return getLevel(gameState, buildingId) > 0;
}

function fixedPositiveResources(resources = {}) {
  return Object.entries(resources).reduce((result, [key, value]) => {
    const amount = Math.max(0, Math.ceil(Number(value) || 0));
    if (amount > 0) result[key] = amount;
    return result;
  }, {});
}

function getEraCost(currentEra) {
  return getAdvanceConfig(currentEra)?.cost || {};
}

function getEraConditionTargets(currentEra) {
  const config = getAdvanceConfig(currentEra);
  const targets = { resources: { ...(config?.cost || {}) }, soldiers: 0, buildings: {} };
  (config?.conditions || []).forEach((condition) => {
    if ((condition.source || 'resources') === 'military' && condition.key === 'soldiers') {
      targets.soldiers = Math.max(targets.soldiers, Number(condition.required) || 0);
    }
    if ((condition.source || 'resources') === 'building') {
      targets.buildings[condition.key] = Math.max(targets.buildings[condition.key] || 0, Number(condition.required) || 0);
    }
  });
  return targets;
}

function makeResourceReward(targetResources = {}) {
  return () => ({
    resources: fixedPositiveResources(targetResources),
  });
}

function makeEraReward(currentEra) {
  return () => {
    const targets = getEraConditionTargets(currentEra);
    return {
      resources: fixedPositiveResources(targets.resources),
      soldiers: Math.max(0, Math.ceil(Number(targets.soldiers) || 0)),
    };
  };
}

function hasAnyScoutProgress(gameState) {
  return (gameState.currentEra || 0) >= 5 && (
    (gameState.scoutReports || []).length > 0
    || (gameState.scoutedCoordinates || []).length > 0
    || (gameState.warMissions || []).some((mission) => mission.kind === 'scout')
  );
}

function hasPendingSettlementEvent(gameState) {
  return (gameState.eventQueue || []).some((event) => (
    event?.id === EventDomain.SETTLEMENT_EVENT_ID && event.status !== 'claimed'
  ));
}

function getTaskGoAction(task) {
  if (!task) return null;
  if (task.id === 'settlement_advance_supplies') return { type: 'advanceEra' };
  if (task.id === 'lumbermill_supplies') return { type: 'buildBuilding', buildingId: 'lumbermill' };
  if (task.id === 'city_advance_supplies') return { type: 'advanceEra' };
  if (task.id === 'barracks_supplies') return { type: 'buildBuilding', buildingId: 'barracks' };
  if (task.id === 'border_advance_supplies') return { type: 'advanceEra' };
  if (task.id === 'watchtower_supplies') return { type: 'buildBuilding', buildingId: 'watchtower' };
  if (task.id === 'barracks_upgrade_supplies') return { type: 'upgradeBuilding', buildingId: 'barracks' };
  if (task.id === 'classical_advance_supplies') return { type: 'advanceEra' };
  if (task.id === 'first_scout_reward') return { type: 'switchMilitaryView', view: 'scout' };
  return null;
}

const TASKS = [
  {
    id: 'settlement_advance_supplies',
    title: '备齐聚落物资',
    description: '民居让族人安定下来，领取储备物资后迈入聚落时代。',
    target: 'guide-task-claim',
    nextTarget: 'btn-advance-era',
    actionLabel: '领取',
    continueAfterClaim: true,
    available: (gameState) => (
      gameState.currentEra === 1
      && hasBuilt(gameState, 'house')
      && Number(gameState.tutorial?.currentStep || 0) >= 8
    ),
    complete: (gameState) => (
      gameState.currentEra === 1
      && hasBuilt(gameState, 'house')
      && Number(gameState.tutorial?.currentStep || 0) >= 8
    ),
    obsolete: (gameState) => gameState.currentEra > 1,
    reward: () => makeResourceReward(getEraCost(1)),
  },
  {
    id: 'lumbermill_supplies',
    title: '备齐伐木物资',
    description: '领取森林馈赠，建起第一座伐木场。',
    target: 'guide-task-claim',
    nextTarget: 'card-lumbermill',
    actionLabel: '领取',
    continueAfterClaim: true,
    available: (gameState) => (
      gameState.currentEra === 2
      && !hasBuilt(gameState, 'lumbermill')
      && Number(gameState.tutorial?.currentStep || 0) >= 12
      && !hasPendingSettlementEvent(gameState)
    ),
    complete: (gameState) => (
      gameState.currentEra === 2
      && !hasBuilt(gameState, 'lumbermill')
      && Number(gameState.tutorial?.currentStep || 0) >= 12
      && !hasPendingSettlementEvent(gameState)
    ),
    obsolete: (gameState) => gameState.currentEra > 2 || hasBuilt(gameState, 'lumbermill'),
    reward: () => makeResourceReward(BuildingConfig.getBuildCost('lumbermill')),
  },
  {
    id: 'city_advance_supplies',
    title: '聚落分工',
    description: '伐木场和工匠让聚落拥有迈向城邦的基础。',
    target: 'guide-task-claim',
    nextTarget: 'btn-advance-era',
    actionLabel: '领取',
    continueAfterClaim: true,
    available: (gameState) => gameState.currentEra === 2 && isTutorialDone(gameState),
    complete: (gameState) => gameState.currentEra === 2 && isTutorialDone(gameState),
    obsolete: (gameState) => gameState.currentEra > 2,
    reward: () => makeResourceReward(getEraCost(2)),
  },
  {
    id: 'barracks_supplies',
    title: '城邦守备',
    description: '城邦已经暴露在外部目光下，先建造兵营。',
    target: 'guide-task-claim',
    nextTarget: 'card-barracks',
    actionLabel: '领取',
    continueAfterClaim: true,
    available: (gameState) => gameState.currentEra === 3 && !hasBuilt(gameState, 'barracks'),
    complete: (gameState) => gameState.currentEra === 3 && !hasBuilt(gameState, 'barracks'),
    obsolete: (gameState) => gameState.currentEra > 3 || hasBuilt(gameState, 'barracks'),
    reward: () => makeResourceReward(BuildingConfig.getBuildCost('barracks')),
  },
  {
    id: 'border_advance_supplies',
    title: '守备成军',
    description: '兵营开始训练士兵，城邦可以建立第一圈边界。',
    target: 'guide-task-claim',
    nextTarget: 'btn-advance-era',
    actionLabel: '领取',
    continueAfterClaim: true,
    available: (gameState) => gameState.currentEra === 3 && hasBuilt(gameState, 'barracks'),
    complete: (gameState) => gameState.currentEra === 3 && hasBuilt(gameState, 'barracks'),
    obsolete: (gameState) => gameState.currentEra > 3,
    reward: () => makeEraReward(3),
  },
  {
    id: 'watchtower_supplies',
    title: '边境瞭望',
    description: '边境需要瞭望台，外部威胁才有明确防线。',
    target: 'guide-task-claim',
    nextTarget: 'card-watchtower',
    actionLabel: '领取',
    continueAfterClaim: true,
    available: (gameState) => gameState.currentEra === 4 && !hasBuilt(gameState, 'watchtower'),
    complete: (gameState) => gameState.currentEra === 4 && !hasBuilt(gameState, 'watchtower'),
    obsolete: (gameState) => gameState.currentEra > 4 || hasBuilt(gameState, 'watchtower'),
    reward: () => makeResourceReward(BuildingConfig.getBuildCost('watchtower')),
  },
  {
    id: 'barracks_upgrade_supplies',
    title: '扩编兵营',
    description: '古典时代需要更多士兵，先扩建兵营上限。',
    target: 'guide-task-claim',
    nextTarget: 'card-barracks-upgrade',
    actionLabel: '领取',
    continueAfterClaim: true,
    available: (gameState) => gameState.currentEra === 4 && hasBuilt(gameState, 'watchtower') && getLevel(gameState, 'barracks') < 2,
    complete: (gameState) => gameState.currentEra === 4 && hasBuilt(gameState, 'watchtower') && getLevel(gameState, 'barracks') < 2,
    obsolete: (gameState) => gameState.currentEra > 4 || getLevel(gameState, 'barracks') >= 2,
    reward: () => makeResourceReward(BuildingCostCalculator.getUpgradeCost('barracks', 1) || {}),
  },
  {
    id: 'classical_advance_supplies',
    title: '古典远行',
    description: '防线与军队已经成型，准备进入能侦察外部世界的时代。',
    target: 'guide-task-claim',
    nextTarget: 'btn-advance-era',
    actionLabel: '领取',
    continueAfterClaim: true,
    available: (gameState) => gameState.currentEra === 4 && hasBuilt(gameState, 'watchtower') && getLevel(gameState, 'barracks') >= 2,
    complete: (gameState) => gameState.currentEra === 4 && hasBuilt(gameState, 'watchtower') && getLevel(gameState, 'barracks') >= 2,
    obsolete: (gameState) => gameState.currentEra > 4,
    reward: () => makeEraReward(4),
  },
  {
    id: 'first_scout_reward',
    title: '第一次侦察',
    description: '派出侦察队，让地图外的世界开始显现。',
    target: 'guide-task-claim',
    nextTarget: 'scout-action-first',
    actionLabel: '领取',
    available: (gameState) => gameState.currentEra >= 5,
    complete: (gameState) => hasAnyScoutProgress(gameState),
    obsolete: () => false,
    reward: () => () => ({ resources: { knowledge: 20 } }),
  },
];

function getDefinition(taskId) {
  return TASKS.find((task) => task.id === taskId) || null;
}

function isObsolete(gameState, task) {
  return typeof task.obsolete === 'function' && task.obsolete(gameState);
}

function getCurrentTaskDefinition(gameState) {
  CityService.normalizeCities(gameState);
  if ((gameState.activeCityId || CityService.CAPITAL_CITY_ID) !== CityService.CAPITAL_CITY_ID) return null;
  for (const task of TASKS) {
    const claimed = isClaimed(gameState, task.id);
    if ((claimed && !task.continueAfterClaim) || isObsolete(gameState, task)) continue;
    if (typeof task.available === 'function' && !task.available(gameState)) continue;
    return task;
  }
  return null;
}

function formatRewardText(reward = {}) {
  const names = {
    food: '食物',
    wood: '木材',
    iron: '铁矿',
    knowledge: '知识',
    stone: '石料',
    metal: '铁矿',
  };
  const parts = Object.entries(reward.resources || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${names[key] || key} +${Math.ceil(value)}`);
  if (reward.soldiers > 0) parts.push(`士兵 +${Math.ceil(reward.soldiers)}`);
  return parts.length ? parts.join(' / ') : '无奖励';
}

function getTaskReward(gameState, task) {
  const rewardFactory = typeof task.reward === 'function' ? task.reward() : task.reward;
  const reward = typeof rewardFactory === 'function' ? rewardFactory(gameState) : rewardFactory;
  return reward && typeof reward === 'object' ? reward : {};
}

function buildTaskView(gameState, task) {
  const reward = getTaskReward(gameState, task);
  const complete = Boolean(task.complete?.(gameState));
  const claimed = isClaimed(gameState, task.id);
  const status = !claimed && complete ? 'claimable' : 'active';
  const target = status === 'claimable' ? 'task-center-main-claim' : (task.nextTarget || task.target || null);
  const action = status === 'claimable'
    ? { type: 'openTaskCenter', tab: 'main', target }
    : { type: 'goToGuideTaskTarget', taskId: task.id, target, nextAction: getTaskGoAction(task) };
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status,
    claimed,
    target,
    action,
    actionLabel: status === 'claimable' ? '任务' : '前往',
    reward,
    rewardText: formatRewardText(reward),
  };
}

function getGuideTasks(gameState) {
  const task = getCurrentTaskDefinition(gameState);
  if (!task) return { visible: false, tasks: [] };
  return {
    visible: true,
    tasks: [buildTaskView(gameState, task)],
  };
}

function getGuide(gameState) {
  const task = getCurrentTaskDefinition(gameState);
  if (!task) return null;
  const view = buildTaskView(gameState, task);
  if (view.status === 'claimable') {
    return {
      id: `task_${task.id}`,
      mode: 'strong',
      message: `${task.title}完成，领取奖励后继续。`,
      target: view.target,
    };
  }
  if (task.id === 'barracks_supplies') {
    return {
      id: 'task_barracks_force',
      mode: 'strong',
      message: '领取城邦守备奖励后，点击前往建造兵营。',
      target: task.nextTarget || task.target,
    };
  }
  if (view.claimed && task.continueAfterClaim && view.target) {
    return {
      id: `task_${task.id}_next`,
      mode: 'strong',
      message: task.description,
      target: view.target,
    };
  }
  if (task.id === 'first_scout_reward') {
    return {
      id: 'first_scout_strong',
      mode: 'strong',
      message: '进入军事页的侦察视图，派出第一支侦察队。',
      target: task.nextTarget || task.target,
    };
  }
  return {
    id: `task_${task.id}_next`,
    mode: 'soft',
    message: task.description,
    target: task.nextTarget || task.target || null,
  };
}

function applyReward(gameState, reward = {}) {
  CityService.normalizeCities(gameState);
  const capital = CityService.getCapitalCity(gameState);
  capital.resources = capital.resources || {};
  Object.entries(reward.resources || {}).forEach(([key, value]) => {
    const amount = Math.max(0, Math.ceil(Number(value) || 0));
    if (amount > 0) capital.resources[key] = (capital.resources[key] || 0) + amount;
  });
  if (reward.soldiers > 0) {
    capital.military = MilitaryService.normalizeMilitaryState(capital.military, {
      ...gameState,
      activeCityId: CityService.CAPITAL_CITY_ID,
      buildings: capital.buildings,
      military: capital.military,
    });
    const cap = Math.max(capital.military.soldierCap || 0, capital.military.soldiers || 0);
    const nextSoldiers = Math.min(cap, (capital.military.soldiers || 0) + Math.ceil(reward.soldiers));
    capital.military = MilitaryService.normalizeMilitaryState({
      ...capital.military,
      soldiers: nextSoldiers,
    }, {
      ...gameState,
      activeCityId: CityService.CAPITAL_CITY_ID,
      buildings: capital.buildings,
      military: capital.military,
    });
  }
  CityService.applyDerivedStatsToCity(capital, gameState);
  CityService.syncActiveCityToLegacyFields(gameState);
}

function claimReward(gameState, taskId) {
  const task = getDefinition(taskId);
  if (!task) return { success: false, error: 'GUIDE_TASK_NOT_FOUND', message: '任务不存在' };
  const current = getCurrentTaskDefinition(gameState);
  if (!current || current.id !== task.id) {
    return { success: false, error: 'GUIDE_TASK_NOT_ACTIVE', message: '当前任务尚未激活' };
  }
  if (isClaimed(gameState, task.id)) {
    return { success: false, error: 'GUIDE_TASK_CLAIMED', message: '奖励已经领取' };
  }
  if (!task.complete(gameState)) {
    return { success: false, error: 'GUIDE_TASK_INCOMPLETE', message: '任务尚未完成' };
  }
  const reward = getTaskReward(gameState, task);
  applyReward(gameState, reward);
  markClaimed(gameState, task.id);
  const rewardReveal = {
    title: '获得奖励',
    subtitle: task.title,
    reward,
    rewardText: formatRewardText(reward),
  };
  return {
    success: true,
    message: `${task.title}奖励已领取`,
    taskId: task.id,
    reward,
    rewardReveal,
  };
}

function getExpectedActionForTask(task) {
  if (!task) return null;
  if (task.id === 'settlement_advance_supplies') return { action: 'advanceEra' };
  if (task.id === 'lumbermill_supplies') return { action: 'build', target: 'lumbermill' };
  if (task.id === 'city_advance_supplies') return { action: 'advanceEra' };
  if (task.id === 'barracks_supplies') return { action: 'build', target: 'barracks' };
  if (task.id === 'border_advance_supplies') return { action: 'advanceEra' };
  if (task.id === 'watchtower_supplies') return { action: 'build', target: 'watchtower' };
  if (task.id === 'barracks_upgrade_supplies') return { action: 'upgrade', target: 'barracks' };
  if (task.id === 'classical_advance_supplies') return { action: 'advanceEra' };
  return null;
}

function validateAction(gameState, action, payload = {}) {
  if (action === 'claimEvent' || action === 'goToGuideTaskTarget') return { allowed: true };
  const task = getCurrentTaskDefinition(gameState);
  if (!task) return { allowed: true };
  const view = buildTaskView(gameState, task);
  if (view.status === 'claimable') {
    return action === 'claimGuideTaskReward'
      ? { allowed: true }
      : { allowed: false, code: 'GUIDE_TASK_REWARD_REQUIRED', message: '请先领取主线任务奖励' };
  }
  if (task.id === 'first_scout_reward') {
    if (['scoutTerritory', 'claimScout', 'switchCity'].includes(action)) return { allowed: true };
    return { allowed: true };
  }
  const expected = getExpectedActionForTask(task);
  if (!expected) return { allowed: true };
  if (action !== expected.action) {
    return { allowed: false, code: 'GUIDE_TASK_BLOCKED', message: '请先按照主线引导继续' };
  }
  if (expected.target && payload.target !== expected.target) {
    return { allowed: false, code: 'GUIDE_TASK_BLOCKED', message: '请先按照主线引导继续' };
  }
  return { allowed: true };
}

module.exports = {
  TASKS,
  getTaskState,
  getCurrentTaskDefinition,
  getGuideTasks,
  getGuide,
  claimReward,
  validateAction,
  formatRewardText,
  getTaskGoAction,
};
