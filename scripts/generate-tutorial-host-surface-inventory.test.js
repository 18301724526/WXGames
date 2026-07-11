const test = require('node:test');
const assert = require('node:assert/strict');

const { buildInventory } = require('./generate-tutorial-host-surface-inventory');

test('tutorial host surface inventory is deterministic and fully classified', () => {
  const first = buildInventory();
  const second = buildInventory();

  assert.deepEqual(first, second);
  assert.ok(first.counts.total > 0);
  assert.equal(first.entries.length, first.counts.total);
  for (const entry of first.entries) {
    assert.match(entry.location, /^frontend\/js\/tutorial\/[^:]+\.js:\d+$/);
    assert.ok(['effects', 'waitFor', 'requestAction', 'resolveTarget', 'queries', 'next'].includes(entry.category));
    assert.ok(entry.accessShape);
    assert.ok(entry.note);
  }
});

test('tutorial host surface inventory catches S2b EventRegistry direct writes', () => {
  const entries = buildInventory().entries.filter((entry) => (
    entry.location.startsWith('frontend/js/tutorial/TutorialGuideEventRegistry.js:')
  ));

  assert.ok(
    entries.some((entry) => entry.accessShape.endsWith('.famousPersonsPage') && entry.note.startsWith('write;')),
    'famousPersonsPage direct write must be inventoried',
  );
  assert.ok(
    entries.some((entry) => entry.accessShape.endsWith('.selectedFamousPersonId') && entry.note.startsWith('write;')),
    'selectedFamousPersonId direct write must be inventoried',
  );
});

test('tutorial host surface inventory catches dynamic host writes', () => {
  const entries = buildInventory().entries;
  assert.ok(
    entries.some((entry) => entry.accessShape.includes('[*dynamic*]') && entry.note.startsWith('write;')),
    'setIfChanged host[key] writes must be inventoried',
  );
});
