const test = require('node:test');
const assert = require('node:assert/strict');

require('../../config/LocaleTextRegistry');
const LocaleText = require('./LocaleText');

test('LocaleText translates keys with parameter interpolation', () => {
  LocaleText.setLocale('zh-CN');

  assert.equal(
    LocaleText.t('world.combat.hostileForce.soldierCount', { soldiers: 40 }),
    '40 名士兵',
  );
  assert.equal(LocaleText.t('world.march.formation.defaultName', { index: 2 }), '队伍2');
});

test('LocaleText supports runtime locale switching', () => {
  LocaleText.setLocale('en-US');

  assert.equal(LocaleText.t('world.combat.attack'), 'Attack');
  assert.equal(LocaleText.t('world.map.tileCount', { count: 3 }), '3 tiles');

  LocaleText.setLocale('zh-CN');
});

test('LocaleText returns explicit fallback for missing keys', () => {
  LocaleText.setLocale('zh-CN');

  assert.equal(LocaleText.t('missing.key', {}, { fallback: '后备文案' }), '后备文案');
});

test('LocaleText stores locale through an injected storage adapter', () => {
  const values = {};
  LocaleText.setStorageAdapter({
    getItem(key) {
      return values[key] || '';
    },
    setItem(key, value) {
      values[key] = value;
    },
  });
  try {
    LocaleText.setLocale('en-US');
    assert.equal(values.wxgame_locale, 'en-US');
  } finally {
    LocaleText.setStorageAdapter(null);
    LocaleText.setLocale('zh-CN');
  }
});
