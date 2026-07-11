const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildInventory,
  checkInventory,
  writeInventory,
} = require('./generate-tutorial-rule-inventory');

const MIGRATED_RULE_IDS = Object.freeze([
  'first-era-open-task-center',
  'first-era-claim-supplies',
  'era2-open-civilization',
  'era2-open-events',
  'lumbermill-open-task-center',
  'lumbermill-claim-task',
  'era3-open-civilization',
  'barracks-open-task-center',
  'barracks-claim-supplies',
  'first-army-open-task-center',
  'first-army-claim',
  'scout-officer-open-task-center',
  'scout-officer-claim',
  'final-tech-open',
]);

test('tutorial rule inventory matches registry factory products and source locations', () => {
  const inventory = buildInventory();
  assert.ok(inventory.counts.flowRules > 0);
  assert.ok(inventory.counts.eventHandlers > 0);
  assert.equal(inventory.counts.flowRules, 38);
  assert.equal(inventory.counts.eventHandlers, 18);
  assert.equal(inventory.flowRules.length, inventory.counts.flowRules);
  assert.equal(inventory.eventHandlers.length, inventory.counts.eventHandlers);
  assert.ok(inventory.flowRules.some((entry) => entry.source === 'factory:makeBuildRule'));
  const liveIds = new Set(inventory.flowRules.map((entry) => entry.id));
  MIGRATED_RULE_IDS.forEach((ruleId) => assert.equal(liveIds.has(ruleId), false, ruleId));

  for (const entry of [...inventory.flowRules, ...inventory.eventHandlers]) {
    assert.match(entry.location, /^frontend\/js\/tutorial\/TutorialGuide(?:Flow|Event)Registry\.js:\d+$/);
    const [file, lineText] = entry.location.split(':');
    const line = Number(lineText);
    const sourceLine = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8').split(/\r?\n/)[line - 1];
    assert.ok(sourceLine, `missing source line for ${entry.location}`);
  }
});

test('tutorial rule inventory generation is deterministic', () => {
  assert.deepEqual(buildInventory(), buildInventory());
});

test('tutorial rule inventory freshness check detects missing, fresh, and stale output', (t) => {
  const directory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'tutorial-rule-inventory-'));
  const output = path.join(directory, 'inventory.json');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  assert.equal(checkInventory(output).fresh, false);
  writeInventory(output);
  assert.equal(checkInventory(output).fresh, true);
  fs.appendFileSync(output, 'stale\n');
  assert.equal(checkInventory(output).fresh, false);
});
