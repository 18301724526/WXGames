const test = require('node:test');
const assert = require('node:assert/strict');

const UiThemeTokens = require('./UiThemeTokens');

const HEX_COLOR = /^#[0-9A-F]{6}$/;
const RGBA_COLOR = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (0|1|0?\.\d+)\)$/;

test('UiThemeTokens exposes the frozen single-source theme contract', () => {
  assert.equal(UiThemeTokens.version, 'ui-theme-tokens-v1');
  assert.equal(Object.isFrozen(UiThemeTokens), true);
  assert.equal(Object.isFrozen(UiThemeTokens.palette), true);
  assert.equal(Object.isFrozen(UiThemeTokens.hairline), true);
  assert.equal(Object.isFrozen(UiThemeTokens.typeScale), true);
  assert.equal(Object.isFrozen(UiThemeTokens.spacing), true);
  assert.equal(Object.isFrozen(UiThemeTokens.radius), true);
  assert.equal(Object.isFrozen(UiThemeTokens.topBar), true);
  assert.equal(Object.isFrozen(UiThemeTokens.topBar.plateSlice), true);
});

test('UiThemeTokens palette entries are normalized uppercase hex colors', () => {
  const requiredKeys = [
    'plateIronTop',
    'plateIronBottom',
    'plateBevelHighlight',
    'plateFrameLine',
    'dockCopperTop',
    'badgeBronzeFace',
    'champagneGold',
    'champagneGoldBright',
    'textPrimary',
    'textLabel',
    'textSecondary',
    'debugFpsGreen',
    'debugSignalGreen',
    'accentJade',
    'accentCityLevelBlue',
    'squadChipBlue',
  ];
  requiredKeys.forEach((key) => {
    assert.match(String(UiThemeTokens.palette[key] || ''), HEX_COLOR, `palette.${key}`);
  });
  Object.entries(UiThemeTokens.palette).forEach(([key, value]) => {
    assert.match(String(value), HEX_COLOR, `palette.${key}`);
  });
});

test('UiThemeTokens hairlines are rgba strings with 1px width', () => {
  assert.equal(UiThemeTokens.hairline.widthPx, 1);
  ['dividerOnIron', 'insetHighlight', 'frameShadow'].forEach((key) => {
    assert.match(String(UiThemeTokens.hairline[key] || ''), RGBA_COLOR, `hairline.${key}`);
  });
});

test('UiThemeTokens type/spacing/radius scales are ascending positive numbers', () => {
  const assertAscending = (scale, keys) => {
    let previous = 0;
    keys.forEach((key) => {
      const value = scale[key];
      assert.equal(typeof value, 'number', key);
      assert.equal(value > previous, true, `${key} ascending`);
      previous = value;
    });
  };
  assertAscending(UiThemeTokens.typeScale, ['micro', 'caption', 'label', 'body', 'value', 'title', 'headline']);
  assertAscending(UiThemeTokens.spacing, ['xxs', 'xs', 'sm', 'md', 'lg', 'xl']);
  assertAscending(UiThemeTokens.radius, ['chip', 'panel', 'plate', 'button']);
});

test('UiThemeTokens top bar block matches the map-home top bar contract', () => {
  const topBar = UiThemeTokens.topBar;
  assert.equal(topBar.height, 64);
  assert.equal(topBar.plateAssetPath, 'assets/art/ui-hud/hud-plate-top.png');
  assert.equal(topBar.plateSlice.sourceWidth, 256);
  assert.equal(topBar.plateSlice.sourceHeight, 101);
  assert.equal(topBar.plateSlice.sourceInset > 0, true);
  assert.equal(topBar.plateSlice.destInset > 0, true);
  assert.equal(topBar.plateMarginTop + topBar.plateHeight <= topBar.height, true);
});
