const { TutorialFlowConfig } = require('./config/GameplayConfigRuntime');
const TaskDefinitionService = require('./TaskDefinitionService');
const TaskCenterAssembler = require('./taskCenter/TaskCenterAssembler');
const ProgressEvaluator = require('./taskCenter/TaskProgressEvaluator');
const RewardClaimer = require('./taskCenter/TaskRewardClaimer');
const { TAB_DEFINITIONS, normalizeCategory } = require('./taskCenter/TaskCenterTabs');

function getTaskCenter(gameState, options = {}) {
  return TaskCenterAssembler.getTaskCenter(gameState, TaskDefinitionService.loadDefinitions(), options);
}

function buildCategories(gameState, definitions = TaskDefinitionService.loadDefinitions()) {
  return TaskCenterAssembler.buildCategories(gameState, definitions);
}

function maybeAdvanceTutorialAfterClaim(gameState, taskId) {
  const tutorial = gameState.tutorial || {};
  const tutorialSteps = TutorialFlowConfig.TUTORIAL_STEPS;
  if (tutorial.completed || tutorial.disabled) return tutorial;
  let nextStep = null;
  if (taskId === 'main_first_supplies') nextStep = tutorialSteps.farmPrepReserved;
  if (taskId === 'main_lumbermill_supplies') nextStep = tutorialSteps.era3AdvanceReady;
  if (!Number.isFinite(nextStep) || (Number(tutorial.currentStep) || 0) >= nextStep) return tutorial;
  gameState.tutorial = {
    ...tutorial,
    currentStep: nextStep,
    phaseCompleted: {
      ...(tutorial.phaseCompleted || {}),
      newbie: true,
      era2: nextStep >= tutorialSteps.era3AdvanceReady || Boolean(tutorial.phaseCompleted?.era2),
    },
    updatedAt: new Date().toISOString(),
  };
  return gameState.tutorial;
}

function findTaskView(taskCenter, taskId, category) {
  const normalizedCategory = normalizeCategory(category);
  return taskCenter.categories[normalizedCategory]?.tasks?.find((item) => item.id === taskId)
    || Object.values(taskCenter.categories).flatMap((item) => item.tasks).find((item) => item.id === taskId);
}

function claimTask(gameState, taskId, category = 'main') {
  const definitions = TaskDefinitionService.loadDefinitions();
  const definitionTask = definitions.tasks.find((item) => item.id === taskId);
  const taskCenter = TaskCenterAssembler.getTaskCenter(gameState, definitions, { activeTab: category });
  const task = findTaskView(taskCenter, taskId, category);
  if (!task || !definitionTask) {
    return { success: false, error: 'TASK_NOT_FOUND', message: '任务不存在' };
  }
  if (task.claimed) {
    return { success: false, error: 'TASK_ALREADY_CLAIMED', message: '任务奖励已领取' };
  }
  if (task.status !== 'claimable') {
    return { success: false, error: 'TASK_NOT_COMPLETED', message: '任务尚未完成' };
  }

  const reward = RewardClaimer.applyTaskReward(gameState, definitionTask.reward || task.reward);
  if (!reward.success) {
    return {
      success: false,
      error: 'TASK_REWARD_INVALID',
      message: '任务奖励配置异常',
      rewardErrors: reward.errors,
    };
  }

  const progress = ProgressEvaluator.getTaskProgress(gameState);
  const claimedAt = new Date().toISOString();
  progress.claimed[task.id] = {
    claimedAt,
    category: task.category,
    reward: { resources: reward.resources },
  };
  const nextTutorial = maybeAdvanceTutorialAfterClaim(gameState, task.id);

  return {
    success: true,
    message: '任务奖励已领取',
    taskId: task.id,
    category: task.category,
    reward: { resources: reward.resources },
    rewardText: task.rewardText,
    rewardReveal: RewardClaimer.buildRewardReveal(task, reward.resources),
    claimedAt,
    tutorial: nextTutorial,
  };
}

module.exports = {
  TAB_DEFINITIONS,
  buildCategories,
  buildTaskView: TaskCenterAssembler.buildTaskView,
  getTaskCenter,
  getTaskProgress: ProgressEvaluator.getTaskProgress,
  isTaskConditionMet: ProgressEvaluator.isTaskConditionMet,
  claimTask,
  normalizeCategory,
};
