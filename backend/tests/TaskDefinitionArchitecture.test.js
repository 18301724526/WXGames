const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');

const TaskDefinitionNormalizer = require('../services/taskDefinitions/TaskDefinitionNormalizer');
const TaskDefinitionRewardResolver = require('../services/taskDefinitions/TaskDefinitionRewardResolver');
const TaskDefinitionImportParser = require('../services/taskDefinitions/TaskDefinitionImportParser');

function createWorkbookBase64(rows) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'tasks');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }).toString('base64');
}

test('task definition normalizer accepts planner-friendly Chinese headers', () => {
  const definitions = TaskDefinitionNormalizer.normalizeDefinitions({
    version: 'architecture-cn',
    tasks: [
      {
        任务ID: 'cn_task',
        任务名称: '中文任务',
        任务描述: '策划表头可以直接使用中文',
        任务分类: 'main',
        条件类型: 'buildingLevel',
        建筑ID: 'house',
        数量: 1,
        奖励粮食: 5,
        奖励木材: 2,
        启用: '是',
      },
    ],
  });

  assert.equal(definitions.errors.length, 0);
  assert.equal(definitions.tasks[0].id, 'cn_task');
  assert.equal(definitions.tasks[0].title, '中文任务');
  assert.deepEqual(definitions.tasks[0].reward.resources, { food: 5, wood: 2 });
});

test('task definition reward resolver owns dynamic reward formulas', () => {
  const resolved = TaskDefinitionRewardResolver.resolveRewardResources({
    formulas: ['buildCost:farm', 'advanceCost:1'],
  });

  assert.deepEqual(resolved.errors, []);
  assert.deepEqual(resolved.resources, { food: 120, knowledge: 5 });
});

test('task definition import parser owns xlsx row extraction', () => {
  const contentBase64 = createWorkbookBase64([
    { id: 'xlsx_arch_task', title: 'XLSX Arch Task', category: 'main', enabled: 1 },
  ]);
  const parsed = TaskDefinitionImportParser.parseImportPayload({ fileName: 'tasks.xlsx', contentBase64 });

  assert.equal(parsed.version, '0.1.0');
  assert.equal(parsed.tasks[0].id, 'xlsx_arch_task');
  assert.equal(parsed.tasks[0].title, 'XLSX Arch Task');
});

test('task definition import parser rejects unsafe xlsx formulas', () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['id', 'title', 'category', 'enabled'],
    ['formula_task', 'bad', 'main', 1],
  ]);
  sheet.B2.f = 'HYPERLINK("https://example.test","bad")';
  XLSX.utils.book_append_sheet(workbook, sheet, 'tasks');
  const contentBase64 = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }).toString('base64');

  assert.throws(
    () => TaskDefinitionImportParser.parseImportPayload({ fileName: 'tasks.xlsx', contentBase64 }),
    /xlsx formulas are not allowed/,
  );
});

test('task definition import parser rejects dangerous xlsx header keys', () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['id', '__proto__'],
    ['bad_task', 'polluted'],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'tasks');
  const contentBase64 = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }).toString('base64');

  assert.throws(
    () => TaskDefinitionImportParser.parseImportPayload({ fileName: 'tasks.xlsx', contentBase64 }),
    /xlsx column is not allowed/,
  );
});

test('task definition import parser rejects oversized xlsx payloads', () => {
  const contentBase64 = Buffer.alloc(TaskDefinitionImportParser.MAX_XLSX_BYTES + 1, 1).toString('base64');

  assert.throws(
    () => TaskDefinitionImportParser.parseImportPayload({ fileName: 'tasks.xlsx', contentBase64 }),
    /xlsx file too large/,
  );
});
