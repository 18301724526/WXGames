'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { inspectCatalog } = require('./check-step4-debt-catalog');
const { getDebtItems } = require('./step4-debt-catalog');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('Step4 debt catalog validates the current production tree', () => {
  const report = inspectCatalog();
  assert.equal(report.summary.total, 20);
  assert.equal(report.summary.totalViolations, 0);
});

test('Step4 debt catalog reports stale source line references', () => {
  const items = clone(getDebtItems());
  items[0].sourceRefs[0].startLine = 1;
  items[0].sourceRefs[0].endLine = 1;

  const report = inspectCatalog({ items });
  assert.equal(report.summary.totalViolations > 0, true);
  assert.match(report.violations.join('\n'), /pattern\/inventoryId cannot be relocated|invalid line range/);
});

test('Step4 debt catalog reports missing source files', () => {
  const items = clone(getDebtItems());
  items[0].sourceRefs[0].file = 'missing/step4/source.js';

  const report = inspectCatalog({ items });
  assert.equal(report.summary.totalViolations > 0, true);
  assert.match(report.violations.join('\n'), /file missing/);
});

test('Step4 debt catalog reports removed inventory ids', () => {
  const items = clone(getDebtItems()).filter((item) => item.inventoryId !== 'frontend:world-march-passability');

  const report = inspectCatalog({ items });
  assert.equal(report.summary.totalViolations > 0, true);
  assert.match(report.violations.join('\n'), /frontend:world-march-passability/);
});

test('Step4 debt catalog reports duplicate inventory ids', () => {
  const items = clone(getDebtItems());
  items[1].inventoryId = items[0].inventoryId;
  items[1].sourceRefs.forEach((ref) => {
    ref.inventoryId = items[0].inventoryId;
  });

  const report = inspectCatalog({ items });
  assert.equal(report.summary.totalViolations > 0, true);
  assert.match(report.violations.join('\n'), /appears in both/);
});
