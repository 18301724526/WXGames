'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildReport,
  compareDeclarations,
} = require('../../scripts/m0-writer-inventory');
const {
  CATEGORIES,
  EMPTY_CATEGORY_REASONS,
} = require('../../scripts/m0-writer-inventory/declarations');

test('M0 writer inventory scans all eight categories without declaration drift', () => {
  const report = buildReport();

  assert.equal(report.summary.categoryCount, 8);
  assert.deepEqual(report.categories.map((item) => item.category), CATEGORIES);
  assert.deepEqual(report.findings, []);
  report.categories.forEach((category) => {
    assert.equal(
      category.entries.length > 0 || Boolean(EMPTY_CATEGORY_REASONS[category.category]),
      true,
      `${category.category} must contain source evidence or an explicit empty reason`,
    );
    category.entries.forEach((entry) => {
      assert.match(entry.evidence[0], /:\d+$/);
    });
  });
});

test('M0 writer inventory reports both undeclared source and missing declared source', () => {
  const declarations = Object.fromEntries(CATEGORIES.map((category) => [category, []]));
  declarations.route = [{ id: 'route:POST /declared-only' }];
  const discovered = [{
    category: 'route',
    id: 'route:POST /source-only',
    evidence: ['backend/routes/example.js:10'],
  }];
  const emptyReasons = Object.fromEntries(
    CATEGORIES.filter((category) => category !== 'route').map((category) => [category, '测试空类']),
  );

  const findings = compareDeclarations(declarations, discovered, emptyReasons);

  assert.deepEqual(
    findings.map((item) => item.code).sort(),
    ['DECLARATION_MISSING_SOURCE', 'SOURCE_UNDECLARED'],
  );
});
