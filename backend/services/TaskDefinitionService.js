const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const XLSX = require('xlsx');

const BuildingConfig = require('../config/BuildingConfig');
const EraConfig = require('../config/EraConfig');

const DEFAULT_DEFINITIONS_PATH = path.join(__dirname, '..', 'config', 'defaultTaskDefinitions.json');
const RUNTIME_DEFINITIONS_PATH = process.env.TASK_DEFINITIONS_PATH
  || path.join(__dirname, '..', '..', 'data', 'taskDefinitions.json');

const CATEGORY_IDS = Object.freeze(['daily', 'main', 'season', 'challenge']);
const RESOURCE_KEYS = Object.freeze(['food', 'wood', 'knowledge', 'iron', 'stone', 'metal', 'soldiers']);

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function sanitizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toBoolean(value, fallback = true) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', '启用', '是'].includes(text)) return true;
  if (['0', 'false', 'no', 'n', 'off', '停用', '否'].includes(text)) return false;
  return fallback;
}

function addResources(target, source = {}) {
  for (const [key, value] of Object.entries(source || {})) {
    const amount = toNumber(value, 0);
    if (amount > 0) target[key] = Math.round(((target[key] || 0) + amount) * 1000) / 1000;
  }
  return target;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getHeaderValue(row, key) {
  const aliases = HEADER_ALIASES[key] || [key];
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) return row[alias];
  }
  return undefined;
}

function parseJsonMaybe(value, fallback = null) {
  if (value && typeof value === 'object') return clone(value);
  const text = sanitizeText(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    return { __parseError: error.message, __raw: text };
  }
}

function parseFormulaList(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeText(item)).filter(Boolean);
  return sanitizeText(value)
    .split(/[,+;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

function normalizeCategory(category) {
  const value = sanitizeText(category, 'main');
  return CATEGORY_IDS.includes(value) ? value : 'main';
}

function normalizeCondition(rawTask, row) {
  const parsed = parseJsonMaybe(rawTask.condition || getHeaderValue(row, 'conditionJson'), null);
  if (parsed?.__parseError) return parsed;
  const condition = parsed || {};
  const type = sanitizeText(condition.type || getHeaderValue(row, 'conditionType'), 'always');
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
  return { resources, formulas };
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

function resolveRewardFormula(formula) {
  const [rawKind, ...parts] = sanitizeText(formula).split(':').map((item) => item.trim());
  const kind = rawKind.toLowerCase();
  if (['buildcost', 'buildingcost'].includes(kind)) {
    const buildingId = parts[0];
    if (!BuildingConfig.hasBuilding(buildingId)) return { error: `UNKNOWN_BUILDING:${buildingId}` };
    return { resources: BuildingConfig.getBuildCost(buildingId) };
  }
  if (['advancecost', 'eraadvancecost'].includes(kind)) {
    const era = Math.max(0, Math.floor(toNumber(parts[0], 0)));
    const config = EraConfig.getAdvanceConfig(era);
    if (!config) return { error: `UNKNOWN_ERA_ADVANCE:${era}` };
    return { resources: config.cost || {} };
  }
  if (['upgradecost', 'buildingupgradecost'].includes(kind)) {
    const buildingId = parts[0];
    const level = Math.max(1, Math.floor(toNumber(parts[1], 1)));
    const cost = BuildingConfig.getUpgradeCost(buildingId, level);
    if (!cost) return { error: `UNKNOWN_UPGRADE:${buildingId}:${level}` };
    return { resources: cost };
  }
  return { error: `UNKNOWN_REWARD_FORMULA:${formula}` };
}

function resolveRewardResources(reward = {}) {
  const resources = {};
  const errors = [];
  addResources(resources, reward.resources || {});
  for (const formula of reward.formulas || []) {
    const resolved = resolveRewardFormula(formula);
    if (resolved.error) {
      errors.push(resolved.error);
    } else {
      addResources(resources, resolved.resources);
    }
  }
  return { resources, errors };
}

function formatRewardText(resources = {}) {
  return RESOURCE_KEYS
    .filter((key) => Number(resources[key]) > 0)
    .map((key) => `${key}+${resources[key]}`)
    .join(' / ') || 'none';
}

function validateTasks(tasks = []) {
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
    const reward = resolveRewardResources(task.reward);
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
  const errors = validateTasks(tasks);
  const normalizedTasks = tasks.map((task) => {
    const resolvedReward = resolveRewardResources(task.reward);
    return {
      ...task,
      reward: {
        ...task.reward,
        resources: resolvedReward.resources,
      },
      rewardText: formatRewardText(resolvedReward.resources),
    };
  });
  const version = sanitizeText(raw.version, '0.1.0');
  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify({ version, tasks: normalizedTasks }))
    .digest('hex')
    .slice(0, 12);
  return {
    version,
    hash,
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

function parseJsonPayload(payload = {}) {
  if (payload.definitions && typeof payload.definitions === 'object') return payload.definitions;
  const text = payload.contentBase64
    ? Buffer.from(payload.contentBase64, 'base64').toString('utf8')
    : sanitizeText(payload.content);
  return JSON.parse(text);
}

function rowsFromWorkbookBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });
}

function parseImportPayload(payload = {}) {
  const fileName = sanitizeText(payload.fileName).toLowerCase();
  const format = sanitizeText(payload.format).toLowerCase();
  if (format === 'xlsx' || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const buffer = Buffer.from(sanitizeText(payload.contentBase64), 'base64');
    return { version: sanitizeText(payload.version, '0.1.0'), tasks: rowsFromWorkbookBuffer(buffer) };
  }
  return parseJsonPayload(payload);
}

function loadDefinitions(options = {}) {
  const runtimePath = options.runtimePath || RUNTIME_DEFINITIONS_PATH;
  const defaultPath = options.defaultPath || DEFAULT_DEFINITIONS_PATH;
  const sourcePath = fs.existsSync(runtimePath) ? runtimePath : defaultPath;
  return normalizeDefinitions(readJsonFile(sourcePath), { source: sourcePath });
}

function previewImport(payload = {}, options = {}) {
  try {
    const raw = parseImportPayload(payload);
    const definitions = normalizeDefinitions(raw, {
      ...options,
      source: sanitizeText(payload.fileName || options.source, 'upload'),
    });
    return { success: definitions.errors.length === 0, definitions, errors: definitions.errors };
  } catch (error) {
    return { success: false, errors: [error.message], definitions: null };
  }
}

function importDefinitions(payload = {}, options = {}) {
  const preview = previewImport(payload, options);
  if (!preview.success) return preview;
  const runtimePath = options.runtimePath || RUNTIME_DEFINITIONS_PATH;
  const definitions = {
    ...preview.definitions,
    importedAt: nowIso(options.now),
    importedBy: sanitizeText(options.importedBy, 'system'),
    source: sanitizeText(payload.fileName || options.source, 'upload'),
  };
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
  fs.writeFileSync(runtimePath, `${JSON.stringify(definitions, null, 2)}\n`, 'utf8');
  return { success: true, definitions, errors: [] };
}

function buildTemplateWorkbookBuffer() {
  const definitions = loadDefinitions();
  const rows = definitions.tasks.map((task) => ({
    id: task.id,
    category: task.category,
    title: task.title,
    description: task.description,
    target: task.target,
    'condition.type': task.condition?.type || 'always',
    'condition.target': task.condition?.buildingId || task.condition?.eventId || task.condition?.era || task.condition?.step || '',
    'condition.count': task.condition?.count || '',
    'reward.formulas': (task.reward?.formulas || []).join(';'),
    'reward.food': task.reward?.resources?.food || '',
    'reward.wood': task.reward?.resources?.wood || '',
    'reward.knowledge': task.reward?.resources?.knowledge || '',
    sortOrder: task.sortOrder,
    enabled: task.enabled ? 1 : 0,
  }));
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'tasks');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  CATEGORY_IDS,
  RESOURCE_KEYS,
  DEFAULT_DEFINITIONS_PATH,
  RUNTIME_DEFINITIONS_PATH,
  normalizeCategory,
  normalizeDefinitions,
  parseImportPayload,
  previewImport,
  importDefinitions,
  loadDefinitions,
  resolveRewardResources,
  buildTemplateWorkbookBuffer,
};
