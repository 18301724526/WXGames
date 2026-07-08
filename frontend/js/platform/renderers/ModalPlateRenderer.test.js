const test = require('node:test');
const assert = require('node:assert/strict');

const ModalPlateRenderer = require('./ModalPlateRenderer');
const UiThemeTokens = require('../../config/UiThemeTokens');

function createRenderer(overrides = {}) {
  const calls = [];
  const renderer = {
    width: 390,
    height: 844,
    calls,
    ctx: {
      _fillStyle: '',
      set fillStyle(value) {
        this._fillStyle = value;
      },
      get fillStyle() {
        return this._fillStyle;
      },
      fillRect(...args) {
        calls.push(['fillRect', this._fillStyle, ...args]);
      },
    },
    createGradient(x0, y0, x1, y1, stops, fallback) {
      calls.push(['createGradient', x0, y0, x1, y1, stops.map((stop) => stop[1])]);
      return fallback;
    },
    drawLine(x1, y1, x2, y2, options = {}) {
      calls.push(['drawLine', x1, y1, x2, y2, options.color]);
    },
    drawPanel(x, y, width, height, options = {}) {
      calls.push(['drawPanel', x, y, width, height, options]);
    },
    drawText(text, x, y, options = {}) {
      calls.push(['drawText', String(text), x, y, options]);
    },
    truncateText(text) {
      return String(text || '');
    },
    ...overrides,
  };
  return renderer;
}

test('drawModalMask paints one full-canvas dim fill from the modal token', () => {
  const renderer = createRenderer();
  assert.equal(ModalPlateRenderer.drawModalMask(renderer), true);
  const mask = renderer.calls.find((call) => call[0] === 'fillRect');
  assert.deepEqual(mask, ['fillRect', UiThemeTokens.modal.maskFill, 0, 0, 390, 844]);
});

test('drawModalMask degrades to false without a ctx', () => {
  const renderer = createRenderer({ ctx: null });
  assert.equal(ModalPlateRenderer.drawModalMask(renderer), false);
});

test('drawModalPlate paints token gradient plate with bevel and warm bottom lines', () => {
  const renderer = createRenderer();
  ModalPlateRenderer.drawModalPlate(renderer, 20, 100, 350, 500);

  const plate = renderer.calls.find((call) => call[0] === 'drawPanel');
  assert.equal(plate[5].stroke, UiThemeTokens.modal.plateStroke);
  assert.equal(plate[5].radius, UiThemeTokens.radius.modal);
  const gradient = renderer.calls.find((call) => call[0] === 'createGradient');
  assert.deepEqual(
    gradient[5],
    UiThemeTokens.modal.plateGradientStops.map((stop) => stop[1]),
  );

  const lines = renderer.calls.filter((call) => call[0] === 'drawLine');
  assert.equal(lines.length, 2);
  assert.equal(lines[0][5], UiThemeTokens.modal.plateBevelLight);
  assert.equal(lines[1][5], UiThemeTokens.modal.plateBottomWarmLine);
});

test('drawModalPlate hairlines fall back to ctx when the renderer lacks drawLine', () => {
  const renderer = createRenderer({ drawLine: undefined });
  ModalPlateRenderer.drawModalPlate(renderer, 0, 0, 100, 100);
  const hairlines = renderer.calls.filter((call) => call[0] === 'fillRect');
  assert.equal(hairlines.length, 2);
});

test('drawModalTitleBar returns close rect sized by the token and keeps hit targets caller-owned', () => {
  const renderer = createRenderer();
  const addedTargets = [];
  renderer.addHitTarget = (...args) => addedTargets.push(args);

  const result = ModalPlateRenderer.drawModalTitleBar(renderer, 10, 50, 360, {
    title: '任务中心',
    subtitle: '可领取 2',
    withClose: true,
  });

  assert.equal(result.closeRect.width, UiThemeTokens.modal.closeButtonSizePx);
  assert.equal(
    result.closeRect.x,
    10 + 360 - UiThemeTokens.modal.closeButtonSizePx - UiThemeTokens.modal.closeInsetPx,
  );
  assert.equal(result.contentTop > 50, true);
  assert.equal(addedTargets.length, 0, 'painter must not register hit targets');

  const title = renderer.calls.find((call) => call[0] === 'drawText' && call[1] === '任务中心');
  assert.equal(title[4].fontFamily, UiThemeTokens.fontFamily.display);
  assert.equal(title[4].color, UiThemeTokens.palette.champagneGoldBright);
  const glyph = renderer.calls.find((call) => call[0] === 'drawText' && call[1] === '✕');
  assert.ok(glyph, 'close glyph drawn');
});

test('drawModalTabStrip returns one rect per tab and lights only the active cell', () => {
  const renderer = createRenderer();
  const rects = ModalPlateRenderer.drawModalTabStrip(renderer, 0, 0, 300, [
    { label: '主线', isActive: true, badge: 2 },
    { label: '每日', isActive: false },
    { label: '赛季', isActive: false },
  ]);

  assert.equal(rects.length, 3);
  assert.equal(rects[0].width, 100);
  assert.equal(rects[2].x, 200);

  const activeLabel = renderer.calls.find((call) => call[0] === 'drawText' && call[1] === '主线');
  assert.equal(activeLabel[4].color, UiThemeTokens.palette.champagneGoldBright);
  const inactiveLabel = renderer.calls.find((call) => call[0] === 'drawText' && call[1] === '每日');
  assert.equal(inactiveLabel[4].color, UiThemeTokens.palette.dockLabelGold);

  const underline = renderer.calls.find(
    (call) => call[0] === 'fillRect' && call[1] === UiThemeTokens.palette.champagneGoldBright,
  );
  assert.ok(underline, 'active champagne underline painted');
  const badge = renderer.calls.find(
    (call) => call[0] === 'drawPanel' && call[5].fill === UiThemeTokens.palette.accentAlertRed,
  );
  assert.ok(badge, 'red count badge painted');
  assert.ok(renderer.calls.some((call) => call[0] === 'drawText' && call[1] === '2'));
});

test('drawModalCard tones map to token faces and allow quality stroke override', () => {
  const renderer = createRenderer();
  ModalPlateRenderer.drawModalCard(renderer, 0, 0, 100, 40, { tone: 'accent' });
  ModalPlateRenderer.drawModalCard(renderer, 0, 50, 100, 40, { tone: 'muted' });
  ModalPlateRenderer.drawModalCard(renderer, 0, 100, 100, 40, { stroke: '#ABCDEF' });

  const panels = renderer.calls.filter((call) => call[0] === 'drawPanel');
  assert.equal(panels[0][5].stroke, UiThemeTokens.modal.cardAccentStroke);
  assert.equal(panels[1][5].fill, UiThemeTokens.modal.cardMutedFill);
  assert.equal(panels[1][5].stroke, UiThemeTokens.modal.cardMutedStroke);
  assert.equal(panels[2][5].stroke, '#ABCDEF');
});

test('drawModalButton three states read the token button styles', () => {
  const renderer = createRenderer();
  ModalPlateRenderer.drawModalButton(renderer, 0, 0, 80, 34, '领取', { variant: 'primary' });
  ModalPlateRenderer.drawModalButton(renderer, 0, 40, 80, 34, '已完成', { variant: 'secondary' });
  ModalPlateRenderer.drawModalButton(renderer, 0, 80, 80, 34, '重置游戏', { variant: 'danger' });
  ModalPlateRenderer.drawModalButton(renderer, 0, 120, 80, 34, '行军', {
    variant: 'primary',
    disabled: true,
  });

  const button = UiThemeTokens.modal.button;
  const panels = renderer.calls.filter((call) => call[0] === 'drawPanel');
  assert.equal(panels[0][5].stroke, button.primaryStroke);
  assert.equal(panels[1][5].stroke, button.secondaryStroke);
  assert.equal(panels[2][5].stroke, button.dangerStroke);
  assert.equal(panels[3][5].fill, button.disabledFill);
  assert.equal(panels[3][5].stroke, button.disabledStroke);

  const texts = renderer.calls.filter((call) => call[0] === 'drawText');
  assert.equal(texts[0][4].color, button.primaryText);
  assert.equal(texts[1][4].color, button.secondaryText);
  assert.equal(texts[2][4].color, button.dangerText);
  assert.equal(texts[3][4].color, UiThemeTokens.palette.textDisabled);
  assert.equal(texts[3][4].bold, false, 'disabled label not bold');
});

test('drawModalProgressBar clamps percentage and fills with the champagne gradient', () => {
  const renderer = createRenderer();
  const result = ModalPlateRenderer.drawModalProgressBar(renderer, 0, 0, 200, 10, 50);
  assert.equal(result.fillWidth, 100);

  const panels = renderer.calls.filter((call) => call[0] === 'drawPanel');
  assert.equal(panels.length, 2);
  assert.equal(panels[0][5].fill, UiThemeTokens.modal.progressTrackFill);
  assert.equal(panels[1][3], 100, 'fill panel width = 50% of track');
  const gradient = renderer.calls.find((call) => call[0] === 'createGradient');
  assert.deepEqual(
    gradient[5],
    UiThemeTokens.modal.progressFillStops.map((stop) => stop[1]),
  );

  assert.equal(ModalPlateRenderer.drawModalProgressBar(renderer, 0, 0, 200, 10, -20).fillWidth, 0);
  assert.equal(
    ModalPlateRenderer.drawModalProgressBar(renderer, 0, 0, 200, 10, 400).fillWidth,
    200,
  );
});
