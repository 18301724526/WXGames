const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function listProductionJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listProductionJsFiles(fullPath);
    if (!entry.name.endsWith('.js') || entry.name.endsWith('.test.js')) return [];
    return [fullPath];
  });
}

test('retired famous panel compatibility paths stay removed from production code', () => {
  const platformRoot = __dirname;
  const files = listProductionJsFiles(platformRoot);
  const forbidden = [
    /refreshPanelSurface\s*\(/,
    /syncOpenPanelSurfacesAfterBaseRender/,
    /flushPanelModalLayerAfterBaseRender/,
    /baseHitTargetsByPanel/,
    /handle_openFamousPersons\s*\(/,
    /handle_closeFamousPersons\s*\(/,
    /handle_openFamousPersonDetail\s*\(/,
    /handle_closeFamousPersonDetail\s*\(/,
    /handle_changeFamousPersonsPage\s*\(/,
    /(^|\n)\s*openFamousPersons\s*\(/,
    /(^|\n)\s*closeFamousPersons\s*\(/,
    /(^|\n)\s*openFamousPersonDetail\s*\(/,
    /(^|\n)\s*closeFamousPersonDetail\s*\(/,
    /(^|\n)\s*changeFamousPersonsPage\s*\(/,
  ];
  const violations = [];

  files.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    forbidden.forEach((pattern) => {
      if (pattern.test(source)) violations.push(`${path.relative(platformRoot, file)} :: ${pattern}`);
    });
  });

  assert.deepEqual(violations, []);
});
