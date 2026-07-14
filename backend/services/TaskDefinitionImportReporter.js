const TRACKED_FIELDS = Object.freeze([
  'category',
  'title',
  'description',
  'condition',
  'reward',
  'sortOrder',
]);

function stableStringify(value) {
  if (value === undefined) return '';
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function toTaskMap(definitions = {}) {
  return new Map((definitions.tasks || []).map((task) => [task.id, task]));
}

function getFieldValue(task = {}, field) {
  if (field === 'reward') {
    return {
      resources: task.reward?.resources || {},
      formulas: task.reward?.formulas || [],
      rewardText: task.rewardText || '',
    };
  }
  return task[field];
}

function compareField(beforeTask, afterTask, field) {
  const beforeValue = getFieldValue(beforeTask, field);
  const afterValue = getFieldValue(afterTask, field);
  if (stableStringify(beforeValue) === stableStringify(afterValue)) return null;
  return { field, before: beforeValue, after: afterValue };
}

function summarizeTask(task = {}) {
  return {
    id: task.id,
    category: task.category,
    title: task.title,
    description: task.description,
    rewardText: task.rewardText || '',
    sortOrder: task.sortOrder,
  };
}

function compareTaskDefinitions(beforeDefinitions = {}, afterDefinitions = {}) {
  const beforeMap = toTaskMap(beforeDefinitions);
  const afterMap = toTaskMap(afterDefinitions);
  const added = [];
  const removed = [];
  const updated = [];
  let unchangedCount = 0;

  for (const [id, afterTask] of afterMap.entries()) {
    const beforeTask = beforeMap.get(id);
    if (!beforeTask) {
      added.push(summarizeTask(afterTask));
      continue;
    }
    const changes = TRACKED_FIELDS
      .map((field) => compareField(beforeTask, afterTask, field))
      .filter(Boolean);
    if (changes.length) {
      updated.push({
        id,
        title: afterTask.title,
        beforeTitle: beforeTask.title,
        changes,
      });
    } else {
      unchangedCount += 1;
    }
  }

  for (const [id, beforeTask] of beforeMap.entries()) {
    if (!afterMap.has(id)) removed.push(summarizeTask(beforeTask));
  }

  return {
    addedCount: added.length,
    updatedCount: updated.length,
    removedCount: removed.length,
    unchangedCount,
    added,
    updated,
    removed,
  };
}

function buildImportReport(options = {}) {
  const {
    beforeDefinitions = {},
    afterDefinitions = {},
    errors = [],
    importedAt = new Date().toISOString(),
    importedBy = 'system',
    source = 'upload',
    action = 'import',
  } = options;
  return {
    action,
    importedAt,
    importedBy,
    source,
    version: afterDefinitions.version,
    hash: afterDefinitions.hash,
    validation: {
      success: errors.length === 0,
      errors,
    },
    summary: afterDefinitions.summary || {},
    diff: compareTaskDefinitions(beforeDefinitions, afterDefinitions),
  };
}

module.exports = {
  compareTaskDefinitions,
  buildImportReport,
};
