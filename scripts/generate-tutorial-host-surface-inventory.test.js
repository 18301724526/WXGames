const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_OUTPUT,
  buildInventory,
  parseSource,
  scanFile,
} = require('./generate-tutorial-host-surface-inventory');

test('default artifact matches a fresh inventory build', () => {
  const artifact = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', DEFAULT_OUTPUT), 'utf8'));
  assert.deepStrictEqual(artifact, buildInventory());
});

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

test('tutorial host surface inventory reflects the post-adapter EventRegistry surface', () => {
  const artifact = JSON.parse(fs.readFileSync(path.resolve(
    __dirname,
    '../docs/architecture/artifacts/northstar-s3-tutorial-host-surface.json',
  ), 'utf8'));
  const entries = artifact.entries.filter((entry) => (
    entry.location.startsWith('frontend/js/tutorial/TutorialGuideEventRegistry.js:')
  ));

  assert.equal(entries.some((entry) => entry.note.startsWith('write;')), false);
  assert.ok(entries.some((entry) => entry.accessShape === 'host.syncFromResultPayload'));
  assert.ok(entries.some((entry) => entry.accessShape === 'host.refreshCurrentHighlight'));
});

test('tutorial host surface inventory catches dynamic host writes', () => {
  const entries = scanFile(parseSource(
    'frontend/js/tutorial/SyntheticTutorialHostProbe.js',
    [
      'function probe(host, key) {',
      '  const game = host.game || {};',
      '  game.famousPersonsPage = 0;',
      "  game.selectedFamousPersonId = '';",
      '  host[key] = true;',
      '}',
    ].join('\n'),
  ));
  assert.ok(
    entries.some((entry) => entry.accessShape.includes('[*dynamic*]') && entry.note.startsWith('write;')),
    'setIfChanged host[key] writes must be inventoried',
  );
  assert.ok(entries.some((entry) => entry.accessShape === 'game.famousPersonsPage'));
  assert.ok(entries.some((entry) => entry.accessShape === 'game.selectedFamousPersonId'));
});
