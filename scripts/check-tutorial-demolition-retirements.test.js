'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  RETIRED_CONTRACTS,
  inspectRetirements,
  renderText,
} = require('./check-tutorial-demolition-retirements');

test('tutorial demolition retirements are declared individually', () => {
  const ids = RETIRED_CONTRACTS.map((contract) => contract.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.includes('A4-old-step-config-counts'), true);
  assert.equal(ids.includes('A4-old-hit-target-inventory'), true);
  assert.equal(RETIRED_CONTRACTS.every((contract) => contract.paths.length > 0), true);
});

test('tutorial demolition retirement gate blocks a retired path reappearing', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-retirement-'));
  try {
    const retiredPath = RETIRED_CONTRACTS[0].paths[0];
    const absolute = path.join(repoRoot, retiredPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, 'module.exports = {};\n');
    const report = inspectRetirements(repoRoot);
    assert.deepEqual(report.violations, [
      `${RETIRED_CONTRACTS[0].id} reintroduced retired path: ${retiredPath}`,
    ]);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('tutorial demolition retirement gate prints every declaration', () => {
  const text = renderText({ contracts: RETIRED_CONTRACTS, violations: [] });
  RETIRED_CONTRACTS.forEach((contract) => {
    assert.match(text, new RegExp(`declared retired: ${contract.id}`));
  });
  assert.match(text, /passed/);
});
