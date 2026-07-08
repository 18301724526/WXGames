const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const XLSX = require('xlsx');

const TaskDefinitionService = require('../services/TaskDefinitionService');

function createWorkbookBase64(rows) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'tasks');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }).toString('base64');
}

test('TaskDefinitionService loads default main tasks with dynamic reward formulas', () => {
  const definitions = TaskDefinitionService.loadDefinitions({
    runtimePath: path.join(os.tmpdir(), `missing-task-defs-${Date.now()}.json`),
  });
  const task = definitions.tasks.find((item) => item.id === 'main_first_supplies');

  assert.equal(definitions.errors.length, 0);
  assert.equal(task.category, 'main');
  assert.deepEqual(task.reward.resources, { food: 120, knowledge: 5 });
  assert.match(task.rewardText, /food\+120/);
});

test('TaskDefinitionService loads the tutorial-chain tasks with step-name conditions and reward overrides', () => {
  const definitions = TaskDefinitionService.loadDefinitions({
    runtimePath: path.join(os.tmpdir(), `missing-task-defs-${Date.now()}-chain.json`),
  });

  assert.equal(definitions.errors.length, 0);
  // Pinned to backend/config/defaultTaskDefinitions.json's version; keep the two in sync when bumping again.
  assert.equal(definitions.version, '1.0.0');

  const homestead = definitions.tasks.find((item) => item.id === 'main_homestead_supplies');
  assert.equal(homestead, undefined);

  const barracks = definitions.tasks.find((item) => item.id === 'main_barracks_supplies');
  assert.deepEqual(barracks.condition, { type: 'tutorialStepAtLeast', step: 'era3Advanced' });
  assert.deepEqual(barracks.reward.resources, { food: 260, knowledge: 80 });

  const firstArmy = definitions.tasks.find((item) => item.id === 'main_first_army');
  assert.deepEqual(firstArmy.reward.resources, { soldiers: 1000 });
  assert.equal(firstArmy.rewardText, '士兵+1000');
  assert.deepEqual(firstArmy.condition.conditions[1], { type: 'tutorialStepAtLeast', step: 'barracksBuilt' });

  const officer = definitions.tasks.find((item) => item.id === 'main_scout_officer');
  assert.equal(officer.reward.famousPerson, 'scout');
  assert.equal(officer.rewardText, '开拓名人+1');
  assert.deepEqual(officer.condition, { type: 'tutorialStepAtLeast', step: 'firstArmyClaimed' });
});

test('TaskDefinitionService rejects unknown famousPerson reward archetypes', () => {
  const payload = {
    definitions: {
      version: 'unit-famous-reward',
      tasks: [
        { id: 'bad_famous', title: 'Bad famous reward', category: 'main', reward: { famousPerson: 'general' } },
      ],
    },
  };
  const result = TaskDefinitionService.previewImport(payload);

  assert.equal(result.success, false);
  assert.equal(result.errors.some((error) => error.includes('UNKNOWN_FAMOUS_PERSON_REWARD:general')), true);
});

test('TaskDefinitionService previews JSON definitions and rejects duplicate task ids', () => {
  const payload = {
    definitions: {
      version: 'unit-json',
      tasks: [
        { id: 'dup', title: 'A', category: 'main', reward: { resources: { food: 1 } } },
        { id: 'dup', title: 'B', category: 'main' },
      ],
    },
  };
  const result = TaskDefinitionService.previewImport(payload);

  assert.equal(result.success, false);
  assert.equal(result.errors.some((error) => error.includes('duplicate task id')), true);
});

test('TaskDefinitionService previews xlsx validation errors for missing fields and invalid reward JSON', () => {
  const contentBase64 = createWorkbookBase64([
    {
      id: '',
      category: 'main',
      title: '',
      reward: '{"resources":',
      sortOrder: 1,
      enabled: 1,
    },
  ]);
  const result = TaskDefinitionService.previewImport({ fileName: 'broken.xlsx', contentBase64 });

  assert.equal(result.success, false);
  assert.equal(result.errors.some((error) => error.includes('task id is required')), true);
  assert.equal(result.errors.some((error) => error.includes('title is required')), true);
  assert.equal(result.errors.some((error) => error.includes('invalid reward JSON')), true);
});

test('TaskDefinitionService imports xlsx task rows into a runtime definition file', () => {
  const runtimePath = path.join(os.tmpdir(), `task-definitions-${Date.now()}.json`);
  const contentBase64 = createWorkbookBase64([
    {
      id: 'xlsx_task',
      category: 'main',
      title: 'Excel Task',
      description: 'from sheet',
      target: 'buildings',
      'condition.type': 'buildingLevel',
      'condition.target': 'house',
      'condition.count': 1,
      'reward.formulas': 'buildCost:farm;advanceCost:1',
      sortOrder: 1,
      enabled: 1,
    },
  ]);
  const result = TaskDefinitionService.importDefinitions(
    { fileName: 'tasks.xlsx', contentBase64 },
    { runtimePath, importedBy: 'unit-test', now: new Date('2026-06-05T00:00:00Z') },
  );
  const saved = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));

  assert.equal(result.success, true);
  assert.equal(saved.importedBy, 'unit-test');
  assert.equal(saved.tasks[0].id, 'xlsx_task');
  assert.deepEqual(saved.tasks[0].reward.resources, { food: 120, knowledge: 5 });
  assert.equal(saved.tasks[0].reward.formulaResourcesResolved, true);
  assert.deepEqual(TaskDefinitionService.loadDefinitions({ runtimePath }).tasks[0].reward.resources, {
    food: 120,
    knowledge: 5,
  });
  assert.equal(result.report.diff.addedCount, 1);
  assert.equal(result.report.diff.removedCount >= 1, true);
  assert.equal(result.importRecord.importedBy, 'unit-test');
  assert.equal(result.importRecord.validation.success, true);
});

test('TaskDefinitionService reports changed task fields during preview', () => {
  const runtimePath = path.join(os.tmpdir(), `task-definitions-diff-${Date.now()}.json`);
  const historyPath = path.join(os.tmpdir(), `task-definition-history-diff-${Date.now()}.json`);
  const initial = TaskDefinitionService.importDefinitions(
    {
      definitions: {
        version: 'diff-a',
        tasks: [
          {
            id: 'task_diff',
            category: 'main',
            title: 'Old title',
            description: 'old desc',
            reward: { resources: { food: 1 } },
          },
        ],
      },
    },
    { runtimePath, historyPath, importedBy: 'unit-test', now: new Date('2026-06-05T00:00:00Z') },
  );
  const preview = TaskDefinitionService.previewImport(
    {
      definitions: {
        version: 'diff-b',
        tasks: [
          {
            id: 'task_diff',
            category: 'main',
            title: 'New title',
            description: 'new desc',
            reward: { resources: { food: 2, wood: 3 } },
          },
        ],
      },
    },
    { runtimePath, historyPath, importedBy: 'unit-test', now: new Date('2026-06-05T00:01:00Z') },
  );

  assert.equal(initial.success, true);
  assert.equal(preview.success, true);
  assert.equal(preview.report.diff.addedCount, 0);
  assert.equal(preview.report.diff.updatedCount, 1);
  assert.deepEqual(
    preview.report.diff.updated[0].changes.map((change) => change.field).sort(),
    ['description', 'reward', 'title'],
  );
});

test('TaskDefinitionService saves import history and can roll back to a previous task version', () => {
  const runtimePath = path.join(os.tmpdir(), `task-definitions-history-${Date.now()}.json`);
  const historyPath = path.join(os.tmpdir(), `task-definition-imports-${Date.now()}.json`);
  const first = TaskDefinitionService.importDefinitions(
    {
      definitions: {
        version: 'history-a',
        tasks: [
          {
            id: 'history_task',
            category: 'main',
            title: 'History A',
            description: 'first',
            reward: { resources: { food: 1 } },
          },
        ],
      },
      fileName: 'history-a.json',
    },
    { runtimePath, historyPath, importedBy: 'unit-test', now: new Date('2026-06-05T00:00:00Z') },
  );
  const second = TaskDefinitionService.importDefinitions(
    {
      definitions: {
        version: 'history-b',
        tasks: [
          {
            id: 'history_task',
            category: 'main',
            title: 'History B',
            description: 'second',
            reward: { resources: { wood: 2 } },
          },
        ],
      },
      fileName: 'history-b.json',
    },
    { runtimePath, historyPath, importedBy: 'unit-test', now: new Date('2026-06-05T00:02:00Z') },
  );

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(TaskDefinitionService.getImportHistory({ runtimePath, historyPath }).imports.length, 2);

  const rollback = TaskDefinitionService.rollbackImport(first.importRecord.id, {
    runtimePath,
    historyPath,
    importedBy: 'unit-test',
    now: new Date('2026-06-05T00:03:00Z'),
  });
  const loaded = TaskDefinitionService.loadDefinitions({ runtimePath });

  assert.equal(rollback.success, true);
  assert.equal(rollback.importRecord.action, 'rollback');
  assert.equal(loaded.version, 'history-a');
  assert.equal(loaded.tasks[0].title, 'History A');
  assert.equal(loaded.source.startsWith('rollback:'), true);
  assert.equal(TaskDefinitionService.getImportHistory({ runtimePath, historyPath }).imports.length, 3);
});

test('TaskDefinitionService does not double-count imported default reward formulas after reload', () => {
  const runtimePath = path.join(os.tmpdir(), `task-definitions-reload-${Date.now()}.json`);
  const raw = JSON.parse(fs.readFileSync(TaskDefinitionService.DEFAULT_DEFINITIONS_PATH, 'utf8'));
  const result = TaskDefinitionService.importDefinitions(
    { definitions: raw, fileName: 'defaultTaskDefinitions.json' },
    { runtimePath, importedBy: 'unit-test', now: new Date('2026-06-05T00:00:00Z') },
  );
  const loaded = TaskDefinitionService.loadDefinitions({ runtimePath });
  const task = loaded.tasks.find((item) => item.id === 'main_first_supplies');

  assert.equal(result.success, true);
  assert.deepEqual(task.reward.resources, { food: 120, knowledge: 5 });
  assert.match(task.rewardText, /food\+120/);
});

test('TaskDefinitionService keeps legacy normalized runtime rewards from being resolved twice', () => {
  const normalized = TaskDefinitionService.loadDefinitions({
    runtimePath: path.join(os.tmpdir(), `missing-task-defs-${Date.now()}-legacy.json`),
  });
  const runtimePath = path.join(os.tmpdir(), `task-definitions-legacy-${Date.now()}.json`);
  const legacySnapshot = {
    ...normalized,
    tasks: normalized.tasks.map((task) => ({
      ...task,
      reward: {
        resources: task.reward.resources,
        formulas: task.reward.formulas,
      },
    })),
  };
  fs.writeFileSync(runtimePath, `${JSON.stringify(legacySnapshot, null, 2)}\n`, 'utf8');
  const loaded = TaskDefinitionService.loadDefinitions({ runtimePath });
  const task = loaded.tasks.find((item) => item.id === 'main_first_supplies');

  assert.deepEqual(task.reward.resources, { food: 120, knowledge: 5 });
  assert.equal(task.reward.formulaResourcesResolved, true);
});

test('TaskDefinitionService can re-import its template without doubling formula rewards', () => {
  const runtimePath = path.join(os.tmpdir(), `task-definitions-template-${Date.now()}.json`);
  const contentBase64 = TaskDefinitionService.buildTemplateWorkbookBuffer().toString('base64');
  const result = TaskDefinitionService.importDefinitions(
    { fileName: 'task-definitions-template.xlsx', contentBase64 },
    { runtimePath, importedBy: 'unit-test', now: new Date('2026-06-05T00:00:00Z') },
  );
  const task = result.definitions.tasks.find((item) => item.id === 'main_first_supplies');
  const loadedTask = TaskDefinitionService.loadDefinitions({ runtimePath })
    .tasks.find((item) => item.id === 'main_first_supplies');

  assert.equal(result.success, true);
  assert.deepEqual(task.reward.resources, { food: 120, knowledge: 5 });
  assert.deepEqual(loadedTask.reward.resources, { food: 120, knowledge: 5 });
});
