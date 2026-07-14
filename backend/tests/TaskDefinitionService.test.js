const fs = require('node:fs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');

const TaskDefinitionService = require('../services/TaskDefinitionService');
const GameplayConfigRuntime = require('../services/config/GameplayConfigRuntime');
const {
  createTempReleasePaths,
  publishCurrentConfigRuntime,
  resetConfigRuntime,
} = require('./helpers/configRuntimeTestHarness');

function createWorkbookBase64(rows) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'tasks');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }).toString('base64');
}

before(() => {
  publishCurrentConfigRuntime();
});

after(() => {
  resetConfigRuntime();
});

test('TaskDefinitionService loads live definitions only from the active release bundle', () => {
  const definitions = TaskDefinitionService.loadDefinitions();
  const task = definitions.tasks.find((item) => item.id === 'main_first_supplies');

  assert.equal(definitions.errors.length, 0);
  assert.equal(definitions.source.startsWith('active-release-bundle:'), true);
  assert.equal(definitions.version, '1.1.0');
  assert.equal(task.category, 'main');
  assert.deepEqual(task.reward.resources, { food: 120, knowledge: 5 });
  assert.match(task.rewardText, /food\+120/);
});

test('TaskDefinitionService loads the barracks-chain tasks with real-state conditions and reward overrides', () => {
  const definitions = TaskDefinitionService.loadDefinitions();

  assert.equal(definitions.errors.length, 0);

  const homestead = definitions.tasks.find((item) => item.id === 'main_homestead_supplies');
  assert.equal(homestead, undefined);

  const barracks = definitions.tasks.find((item) => item.id === 'main_barracks_supplies');
  assert.deepEqual(barracks.condition, { type: 'eraAtLeast', era: 3 });
  assert.deepEqual(barracks.reward.resources, { food: 260, knowledge: 80 });

  const firstArmy = definitions.tasks.find((item) => item.id === 'main_first_army');
  assert.deepEqual(firstArmy.reward.resources, { soldiers: 1000 });
  assert.equal(firstArmy.rewardText, '士兵+1000');
  assert.deepEqual(firstArmy.condition, { type: 'buildingLevel', buildingId: 'barracks', count: 1 });

  const officer = definitions.tasks.find((item) => item.id === 'main_scout_officer');
  assert.equal(officer.reward.famousPerson, 'scout');
  assert.equal(officer.rewardText, '开拓名人+1');
  assert.deepEqual(officer.condition, { type: 'taskRewardGranted', grantType: 'soldiers', grantKey: 'firstArmy' });
});

test('TaskDefinitionService rejects explicit source overrides', () => {
  assert.throws(
    () => TaskDefinitionService.loadDefinitions({ runtimePath: 'tmp/taskDefinitions.json' }),
    /active config release bundle/,
  );
  assert.throws(
    () => TaskDefinitionService.loadDefinitions({ sourcePath: TaskDefinitionService.DEFAULT_DEFINITIONS_PATH }),
    /active config release bundle/,
  );
});

test('TaskDefinitionService exposes no live import history or rollback API', () => {
  assert.equal(TaskDefinitionService.importDefinitions, undefined);
  assert.equal(TaskDefinitionService.getImportHistory, undefined);
  assert.equal(TaskDefinitionService.rollbackImport, undefined);
});

test('TaskDefinitionService fails loudly when the active release bundle is unavailable', () => {
  const paths = createTempReleasePaths('wxgame-task-definitions-unavailable-');
  resetConfigRuntime();
  GameplayConfigRuntime.configureRuntimeConfig({
    ...paths,
    env: { NODE_ENV: 'production' },
  });
  try {
    assert.throws(
      () => TaskDefinitionService.loadDefinitions(),
      (error) => error.code === 'TASK_DEFINITIONS_RUNTIME_NOT_READY',
    );

    const preview = TaskDefinitionService.previewImport({
      definitions: {
        version: 'no-runtime',
        tasks: [{ id: 'no_runtime_task', title: 'No runtime', category: 'main' }],
      },
    });
    assert.equal(preview.success, false);
    assert.equal(preview.error, 'TASK_DEFINITIONS_RUNTIME_NOT_READY');
  } finally {
    try {
      publishCurrentConfigRuntime();
    } finally {
      fs.rmSync(paths.dir, { recursive: true, force: true });
    }
  }
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

test('TaskDefinitionService previews xlsx task rows without writing a runtime definition file', () => {
  const contentBase64 = createWorkbookBase64([
    {
      id: 'xlsx_task',
      category: 'main',
      title: 'Excel Task',
      description: 'from sheet',
      'condition.type': 'buildingLevel',
      'condition.target': 'house',
      'condition.count': 1,
      'reward.formulas': 'buildCost:farm;advanceCost:1',
      sortOrder: 1,
      enabled: 1,
    },
  ]);
  const result = TaskDefinitionService.previewImport({ fileName: 'tasks.xlsx', contentBase64 });

  assert.equal(result.success, true);
  assert.equal(result.definitions.tasks[0].id, 'xlsx_task');
  assert.deepEqual(result.definitions.tasks[0].reward.resources, { food: 120, knowledge: 5 });
  assert.equal(result.definitions.tasks[0].reward.formulaResourcesResolved, true);
  assert.equal(result.report.diff.addedCount, 1);
  assert.equal(result.report.diff.removedCount >= 1, true);
});

test('TaskDefinitionService reports changed task fields during preview against active release definitions', () => {
  const original = TaskDefinitionService.loadDefinitions()
    .tasks.find((item) => item.id === 'main_first_supplies');
  const preview = TaskDefinitionService.previewImport({
    definitions: {
      version: 'diff-b',
      tasks: [
        {
          id: 'main_first_supplies',
          category: 'main',
          title: 'New title',
          description: 'new desc',
          condition: original.condition,
          reward: { resources: { food: 2, wood: 3 } },
          sortOrder: original.sortOrder,
        },
      ],
    },
  });

  assert.equal(preview.success, true);
  assert.equal(preview.report.diff.addedCount, 0);
  assert.equal(preview.report.diff.updatedCount, 1);
  assert.deepEqual(
    preview.report.diff.updated[0].changes.map((change) => change.field).sort(),
    ['description', 'reward', 'title'],
  );
});

test('TaskDefinitionService does not double-count active-release reward formulas after reload', () => {
  const definitions = TaskDefinitionService.loadDefinitions();
  const task = definitions.tasks.find((item) => item.id === 'main_first_supplies');

  assert.deepEqual(task.reward.resources, { food: 120, knowledge: 5 });
  assert.match(task.rewardText, /food\+120/);
});

test('TaskDefinitionService can preview its template without doubling formula rewards', () => {
  const contentBase64 = TaskDefinitionService.buildTemplateWorkbookBuffer().toString('base64');
  const result = TaskDefinitionService.previewImport({ fileName: 'task-definitions-template.xlsx', contentBase64 });
  const task = result.definitions.tasks.find((item) => item.id === 'main_first_supplies');

  assert.equal(result.success, true);
  assert.deepEqual(task.reward.resources, { food: 120, knowledge: 5 });
});
