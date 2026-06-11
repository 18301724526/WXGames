const crypto = require('node:crypto');
const {
  CATEGORY_IDS,
  RESOURCE_KEYS,
  addResources,
  clone,
  normalizeCategory,
  nowIso,
  parseFormulaList,
  parseJsonMaybe,
  sanitizeText,
  toBoolean,
  toNumber,
} = require('./TaskDefinitionShared');
const ConfigRegistryContract = require('../config/ConfigRegistryContract');
const RewardResolver = require('./TaskDefinitionRewardResolver');

const HEADER_ALIASES = Object.freeze({
  id: ['id', 'taskId', 'task_id', '任务ID', '任务编号'],
  category: ['category', '分类', '任务分类'],
  title: ['title', 'name', '任务名称', '名称'],
  description: ['description', 'desc', '任务描述', '描述'],
  target: ['target', '目标', '跳转目标'],
  sortOrder: ['sortOrder', 'sort', '排序', '顺序'],
  enabled: ['enabled', '启用', '是否启用'],
  actionType: ['action.type', 'actionType', '动作类型'],
  actionTarget: ['action.target', 'actionTarget', '动作目标'],
  conditionJson: ['condition', 'conditionJson', '完成条件JSON', '条件JSON'],
  conditionType: ['condition.type', 'conditionType', '条件类型'],
  conditionTarget: ['condition.target', 'conditionTarget', 'condition.buildingId', '条件目标', '建筑ID'],
  requiredCount: ['condition.count', 'requiredCount', 'required', '要求数量', '数量'],
  rewardJson: ['reward', 'rewardJson', '奖励JSON'],
  rewardFormula: ['reward.formulas', 'rewardFormula', '奖励公式'],
  rewardFood: ['reward.food', 'food', '奖励粮食', '粮食'],
  rewardWood: ['reward.wood', 'wood', '奖励木材', '木材'],
  rewardKnowledge: ['reward.knowledge', 'knowledge', '奖励知识', '知识'],
  rewardIron: ['reward.iron', 'iron', '奖励铁矿', '铁矿'],
  rewardStone: ['reward.stone', 'stone', '奖励石料', '石料'],
  rewardMetal: ['reward.metal', 'metal', '奖励金属', '金属'],
  rewardSoldiers: ['reward.soldiers', 'soldiers', '奖励士兵', '士兵'],
});

function getHeaderValue(row, key) {
  const aliases = HEADER_ALIASES[key] || [key];
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) return row[alias];
  }
  return undefined;
}

function getRowResourceRewards(row) {
  const mapping = {
    food: 'rewardFood',
    wood: 'rewardWood',
    knowledge: 'rewardKnowledge',
    iron: 'rewardIron',
    stone: 'rewardStone',
    metal: 'rewardMetal',
    soldiers: 'rewardSoldiers',
  };
  const resources = {};
  for (const [resource, headerKey] of Object.entries(mapping)) {
    const value = getHeaderValue(row, headerKey);
    const amount = toNumber(value, 0);
    if (amount > 0) resources[resource] = amount;
  }
  return resources;
}

function normalizeCondition(rawTask, row) {
  const parsed = parseJsonMaybe(rawTask.condition || getHeaderValue(row, 'conditionJson'), null);
  if (parsed?.__parseError) return parsed;
  const condition = parsed || {};
  const type = sanitizeText(condition.type || getHeaderValue(row, 'conditionType'), 'always');
  if (['all', 'and', 'any', 'or'].includes(type)) {
    const conditions = Array.isArray(condition.conditions) ? condition.conditions : [];
    return { type, conditions: conditions.map((item) => normalizeCondition({ condition: item }, {})) };
  }
  const target = sanitizeText(
    condition.buildingId || condition.target || getHeaderValue(row, 'conditionTarget'),
    '',
  );
  const count = Math.max(1, Math.floor(toNumber(
    condition.count ?? condition.required ?? getHeaderValue(row, 'requiredCount'),
    1,
  )));
  if (type === 'buildingLevel') return { type, buildingId: target, count };
  if (type === 'eraAtLeast') return { type, era: Math.max(0, Math.floor(toNumber(target || condition.era, 0))) };
  if (type === 'tutorialStepAtLeast') return { type, step: Math.max(0, Math.floor(toNumber(target || condition.step, 0))) };
  if (type === 'eventClaimed') return { type, eventId: target };
  return { type: 'always' };
}

function normalizeReward(rawTask, row) {
  const parsed = parseJsonMaybe(rawTask.reward || getHeaderValue(row, 'rewardJson'), {});
  const reward = parsed?.__parseError ? parsed : (parsed || {});
  if (reward.__parseError) return reward;
  const resources = {};
  addResources(resources, reward.resources || {});
  addResources(resources, getRowResourceRewards(row));
  const formulas = [
    ...parseFormulaList(reward.formulas || reward.formula),
    ...parseFormulaList(getHeaderValue(row, 'rewardFormula')),
  ];
  const formulaResourcesResolved = Boolean(
    formulas.length > 0
      && Object.keys(resources).length > 0
      && (
        reward.formulaResourcesResolved
        || reward.formulasResolved
        || reward.resolved === true
        || toBoolean(row['reward.formulaResourcesResolved'] ?? row.formulaResourcesResolved, false)
        || sanitizeText(row.rewardText)
      ),
  );
  return { resources, formulas, formulaResourcesResolved };
}

function normalizeAction(rawTask, row, taskId, target) {
  const rawAction = rawTask.action && typeof rawTask.action === 'object' ? clone(rawTask.action) : {};
  const type = sanitizeText(rawAction.type || getHeaderValue(row, 'actionType'), '');
  const actionTarget = sanitizeText(rawAction.target || getHeaderValue(row, 'actionTarget'), target);
  if (type) return { ...rawAction, type, target: actionTarget };
  if (target === 'tasks') return { type: 'claimTaskReward', taskId, category: normalizeCategory(rawTask.category) };
  return { type: 'goToGuideTaskTarget', taskId, target: actionTarget || target };
}

function normalizeTask(rawTask, index = 0) {
  const row = rawTask && typeof rawTask === 'object' ? rawTask : {};
  const id = sanitizeText(row.id || getHeaderValue(row, 'id'));
  const category = normalizeCategory(row.category || getHeaderValue(row, 'category'));
  const title = sanitizeText(row.title || getHeaderValue(row, 'title'));
  const target = sanitizeText(row.target || getHeaderValue(row, 'target'), 'tasks');
  const reward = normalizeReward(row, row);
  const condition = normalizeCondition(row, row);
  return {
    id,
    category,
    title,
    description: sanitizeText(row.description || getHeaderValue(row, 'description')),
    target,
    condition,
    reward,
    action: normalizeAction({ ...row, category }, row, id, target),
    sortOrder: Math.floor(toNumber(row.sortOrder ?? getHeaderValue(row, 'sortOrder'), index + 1)),
    enabled: toBoolean(row.enabled ?? getHeaderValue(row, 'enabled'), true),
  };
}

function validateTasks(tasks = [], options = {}) {
  const errors = [];
  const seen = new Set();
  tasks.forEach((task, index) => {
    const label = task.id || `row-${index + 1}`;
    if (!task.id) errors.push(`${label}: task id is required`);
    if (!task.title) errors.push(`${label}: title is required`);
    if (seen.has(task.id)) errors.push(`${label}: duplicate task id`);
    seen.add(task.id);
    if (task.condition?.__parseError) errors.push(`${label}: invalid condition JSON`);
    if (task.reward?.__parseError) errors.push(`${label}: invalid reward JSON`);
    if (task.condition?.type === 'buildingLevel' && !task.condition.buildingId) {
      errors.push(`${label}: buildingLevel condition needs buildingId`);
    }
    const reward = RewardResolver.resolveRewardResources(task.reward, options);
    reward.errors.forEach((error) => errors.push(`${label}: ${error}`));
  });
  return errors;
}

function normalizeDefinitions(raw = {}, options = {}) {
  const rawTasks = Array.isArray(raw) ? raw : (Array.isArray(raw.tasks) ? raw.tasks : []);
  const tasks = rawTasks
    .map((task, index) => normalizeTask(task, index))
    .filter((task) => task.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const errors = validateTasks(tasks, options);
  const normalizedTasks = tasks.map((task) => {
    const resolvedReward = RewardResolver.resolveRewardResources(task.reward, options);
    const reward = { ...task.reward, resources: resolvedReward.resources };
    if ((task.reward.formulas || []).length > 0) reward.formulaResourcesResolved = true;
    return { ...task, reward, rewardText: RewardResolver.formatRewardText(resolvedReward.resources) };
  });
  const version = sanitizeText(raw.version, '0.1.0');
  const registryValidation = ConfigRegistryContract.validateRegistry({
    id: 'task-definitions',
    schema: 'task-definition-registry',
    schemaVersion: 1,
    version,
    source: sanitizeText(raw.source || options.source, 'default'),
    entries: normalizedTasks,
  }, {
    requireEntries: true,
    requireVersion: true,
  });
  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify({ version, tasks: normalizedTasks }))
    .digest('hex')
    .slice(0, 12);
  return {
    schema: 'task-definition-registry',
    schemaVersion: 1,
    version,
    hash,
    registry: registryValidation.metadata,
    registryValidation,
    registryErrors: registryValidation.errors,
    registryWarnings: registryValidation.warnings,
    importedAt: sanitizeText(raw.importedAt, nowIso(options.now)),
    importedBy: sanitizeText(raw.importedBy || options.importedBy, 'system'),
    source: sanitizeText(raw.source || options.source, 'default'),
    tasks: normalizedTasks,
    errors,
    summary: {
      totalCount: normalizedTasks.length,
      enabledCount: normalizedTasks.length,
      byCategory: CATEGORY_IDS.reduce((result, category) => {
        result[category] = normalizedTasks.filter((task) => task.category === category).length;
        return result;
      }, {}),
    },
  };
}

module.exports = {
  HEADER_ALIASES,
  CATEGORY_IDS,
  RESOURCE_KEYS,
  getHeaderValue,
  normalizeCategory,
  normalizeDefinitions,
  normalizeTask,
  validateTasks,
};
