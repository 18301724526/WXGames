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
});
