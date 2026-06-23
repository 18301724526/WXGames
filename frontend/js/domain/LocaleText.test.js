const test = require('node:test');
const assert = require('node:assert/strict');

require('../config/LocaleTextRegistry');
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
