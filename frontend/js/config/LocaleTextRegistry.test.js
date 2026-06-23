const test = require('node:test');
const assert = require('node:assert/strict');

const LocaleTextRegistry = require('./LocaleTextRegistry');

test('LocaleTextRegistry resolves stable text keys by locale', () => {
  assert.equal(LocaleTextRegistry.defaultLocale, 'zh-CN');
  assert.equal(LocaleTextRegistry.getText('world.combat.attack'), '进攻');
  assert.equal(LocaleTextRegistry.getText('world.combat.attack', 'en-US'), 'Attack');
  assert.equal(LocaleTextRegistry.getText('world.map.tileCount', 'en'), '{count} tiles');
});

test('LocaleTextRegistry keeps supported catalogs complete against zh-CN', () => {
  const missing = LocaleTextRegistry.getMissingKeys('zh-CN');

  assert.deepEqual(missing['zh-CN'], []);
  assert.deepEqual(missing['en-US'], []);
});

test('LocaleTextRegistry creates extension registries without mutating base catalogs', () => {
  const extended = LocaleTextRegistry.createRegistry({
    ...LocaleTextRegistry.CATALOGS,
    'en-US': {
      ...LocaleTextRegistry.CATALOGS['en-US'],
      'world.combat.attack': 'Strike',
    },
  });

  assert.equal(extended.getText('world.combat.attack', 'en-US'), 'Strike');
  assert.equal(LocaleTextRegistry.getText('world.combat.attack', 'en-US'), 'Attack');
});
