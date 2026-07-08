const test = require('node:test');
const assert = require('node:assert/strict');

require('../../config/LocaleTextRegistry');
const LocaleText = require('../../ecs/resource/LocaleText');
const MapCommandCanvasRenderer = require('./MapCommandCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    bottomSafeArea: 12,
    ctx: {
      _fillStyle: '',
      set fillStyle(value) { this._fillStyle = value; },
      get fillStyle() { return this._fillStyle; },
      fillRect(...args) { calls.push(['fillRect', this._fillStyle, ...args]); },
      globalAlpha: 1,
    },
    hitTargets,
    calls,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    createGradient() { return '#123'; },
    drawAsset(assetPath) { calls.push(['drawAsset', assetPath]); return false; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawLine(...args) { calls.push(['drawLine', args]); },
    drawPanel() { calls.push(['drawPanel']); },
    drawText(text) { calls.push(['drawText', text]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    getMapHomeFloatingButtonLayout(slot = 0) {
      const size = 48;
      return { x: 370 - size, y: 700 - slot * 58, size };
    },
    getTopBarBottom() { return 72; },
    renderMainPanel(...args) { calls.push(['renderMainPanel', args]); return true; },
    renderPopulation(...args) { calls.push(['renderPopulation', args]); return 360; },
    truncateText(text) { return String(text || ''); },
    ...overrides,
  };
  return host;
}

const MAP_COMMAND_DRAWING_METHODS = [
  'addHitTarget',
  'createGradient',
  'drawAsset',
  'drawLine',
  'drawPanel',
  'drawText',
  'getLayout',
  'getTopBarBottom',
  'renderMainPanel',
  'truncateText',
];

function createDrawingSurfaceSentinel(label, calls = []) {
  return {
    width: 390,
    height: 844,
    bottomSafeArea: 12,
    ctx: {
      fillRect() {},
      globalAlpha: 1,
      fillStyle: '',
    },
    addHitTarget(_rect, action) {
      calls.push([label, 'addHitTarget', action?.type]);
    },
    createGradient() {
      calls.push([label, 'createGradient']);
      return label;
    },
    drawAsset(assetPath) {
      calls.push([label, 'drawAsset', assetPath]);
      return false;
    },
    drawButton(_x, _y, _width, _height, buttonLabel) {
      calls.push([label, 'drawButton', buttonLabel]);
    },
    drawLine(...args) {
      calls.push([label, 'drawLine', args]);
    },
    drawPanel() {
      calls.push([label, 'drawPanel']);
    },
    drawText(text) {
      calls.push([label, 'drawText', text]);
    },
    getLayout() {
      calls.push([label, 'getLayout']);
      return { contentX: 10, contentWidth: 360, contentRight: 370 };
    },
    getMapHomeFloatingButtonLayout(slot = 0) {
      calls.push([label, 'getMapHomeFloatingButtonLayout', slot]);
      const size = 48;
      return { x: 370 - size, y: 700 - slot * 58, size };
    },
    getTopBarBottom() {
      calls.push([label, 'getTopBarBottom']);
      return 72;
    },
    renderMainPanel(...args) {
      calls.push([label, 'renderMainPanel', args]);
      return true;
    },
    truncateText(text) {
      calls.push([label, 'truncateText', text]);
      return String(text || '');
    },
  };
}

function getCalledDrawingSurfaceMethods(calls, label) {
  return Array.from(new Set(calls.filter((call) => call[0] === label).map((call) => call[1]))).sort();
}

function renderMapCommandSentinelPaths(renderer) {
  renderer.renderMapCommandDock({}, { activeCommandPanel: 'tech', showTaskCenter: true });
  renderer.renderFloatingSubcityButton({}, { showSubcityList: true });
  renderer.renderFloatingEventButton({}, { activeCommandPanel: 'events' });
  renderer.renderFloatingAccountButton({}, { showSettings: true });
  renderer.renderMapCommandPanel({ militaryView: 'world' }, { activeCommandPanel: 'military', activeBuildingCategory: 'housing' });
}

test('MapCommandCanvasRenderer prefers explicit drawing surface over proxy fallback host', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new MapCommandCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });

  renderMapCommandSentinelPaths(renderer);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), MAP_COMMAND_DRAWING_METHODS);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('MapCommandCanvasRenderer falls back to host drawing surface when none is injected', () => {
  const calls = [];
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new MapCommandCanvasRenderer({ host: fallbackHost });

  renderMapCommandSentinelPaths(renderer);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), MAP_COMMAND_DRAWING_METHODS);
});

test('MapCommandCanvasRenderer reads dynamic host state through explicit getters', () => {
  const firstCtx = { fillRect() {}, globalAlpha: 1, fillStyle: '' };
  const secondCtx = { fillRect() {}, globalAlpha: 1, fillStyle: '' };
  const host = createHost({
    width: 390,
    height: 844,
    ctx: firstCtx,
  });
  const renderer = new MapCommandCanvasRenderer({ host });

  assert.equal(renderer.width, 390);
  assert.equal(renderer.height, 844);
  assert.equal(renderer.ctx, firstCtx);

  host.width = 512;
  host.height = 900;
  host.ctx = secondCtx;

  assert.equal(renderer.width, 512);
  assert.equal(renderer.height, 900);
  assert.equal(renderer.ctx, secondCtx);
});

test('MapCommandCanvasRenderer does not proxy unknown host properties', () => {
  const host = createHost({
    someRandomProp: 'host-only',
  });
  const renderer = new MapCommandCanvasRenderer({ host });

  assert.equal(host.someRandomProp, 'host-only');
  assert.equal(renderer.someRandomProp, undefined);
});

test('MapCommandCanvasRenderer preserves dock command hit targets', () => {
  const host = createHost();
  const renderer = new MapCommandCanvasRenderer({ host });

  renderer.renderMapCommandDock({
    cityState: { capitalCityId: 'capital_1' },
  }, { activeCommandPanel: 'tech', showTaskCenter: true });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'openWorldSite' && target.action.siteId === 'capital_1'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openCommandPanel' && target.action.panel === 'tech'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openCommandPanel' && target.action.panel === 'civilization'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openCommandPanel' && target.action.panel === 'military'), false);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openFamousPersons'), true);
  assert.equal(host.hitTargets.filter((target) => target.action.type === 'openTaskCenter' && target.action.source === 'taskIcon').length, 1);
  // UI-REDO: the 'more' guidebook dock item was removed with the redesign
  // (openGuidebook stays a valid action handler; it just has no dock entry).
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openGuidebook'), false);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openSettings'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawAsset' && call[1].includes('ui-hud/hud-dock-icon-tech')), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawAsset' && call[1].includes('icon-knowledge')), false);
});

test('MapCommandCanvasRenderer dock renders two EMBEDDED badges and a recessed four-cell well', () => {
  const host = createHost();
  const renderer = new MapCommandCanvasRenderer({ host });
  const UiThemeTokens = require('../../config/UiThemeTokens');
  const metrics = UiThemeTokens.getDockMetrics(390, 844);

  renderer.renderMapCommandDock({}, {});

  assert.equal(host.hitTargets.length, 6);
  const capital = host.hitTargets.find((target) => target.action.type === 'openWorldSite');
  const tasks = host.hitTargets.find((target) => target.action.type === 'openTaskCenter');
  const cells = host.hitTargets.filter((target) => target !== capital && target !== tasks);
  const trayTop = 844 - metrics.height;
  // Knife-6 reference proportions (%W of 390): tray 23.7%W, badge 21.8%W,
  // well 57.8% of tray height; badge overshoot ZERO (PIL-verified embedded).
  assert.equal(metrics.badgeDiameter, 85);
  assert.equal(metrics.height, 92);
  assert.equal(metrics.wellHeight, 53);
  assert.equal(metrics.badgeOvershoot, 0);
  assert.equal(metrics.badgeInset, 12);
  // Edge badges: fully embedded, vertically centered in the tray band.
  [capital, tasks].forEach((badge) => {
    assert.equal(badge.rect.width, metrics.badgeDiameter);
    assert.equal(badge.rect.height, metrics.badgeDiameter);
    assert.equal(badge.rect.y, trayTop + Math.round((metrics.height - metrics.badgeDiameter) / 2));
    assert.equal(badge.rect.y >= trayTop, true, 'badge must not overshoot the tray top');
  });
  assert.equal(capital.rect.x, metrics.badgeInset);
  assert.equal(tasks.rect.x, 390 - metrics.badgeInset - metrics.badgeDiameter);
  // Well cells: equal split of the recessed band between the badges.
  assert.equal(cells.length, 4);
  cells.forEach((cell) => {
    assert.equal(cell.rect.height, metrics.wellHeight);
    assert.equal(cell.rect.y, trayTop + metrics.ledgeHeight);
  });
  const wellX = metrics.badgeInset + metrics.badgeDiameter + metrics.wellGap;
  const wellWidth = 390 - 2 * (metrics.badgeInset + metrics.badgeDiameter + metrics.wellGap);
  assert.equal(Math.min(...cells.map((cell) => cell.rect.x)), wellX + metrics.wellPadX);
  cells.forEach((cell) => {
    assert.equal(cell.rect.width, Math.round((wellWidth - 2 * metrics.wellPadX) / 4));
  });
  // Badge plate + per-item gold icons are requested through the dock asset set.
  assert.equal(host.calls.some((call) => call[0] === 'drawAsset' && call[1].includes('hud-dock-badge-round')), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawAsset' && call[1].includes('hud-dock-icon-capital')), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawAsset' && call[1].includes('hud-dock-icon-tasks')), true);
});

test('MapCommandCanvasRenderer dock paints the tray plate and recessed well from tokens (no 9-slice band)', () => {
  const clipped = [];
  const host = createHost({
    drawAssetClipped(assetPath, source, x, y, width, height) {
      clipped.push({ assetPath, source, x, y, width, height });
      return true;
    },
  });
  const renderer = new MapCommandCanvasRenderer({ host });
  const UiThemeTokens = require('../../config/UiThemeTokens');
  const palette = UiThemeTokens.palette;
  const metrics = UiThemeTokens.getDockMetrics(390, 844);
  const trayTop = 844 - metrics.height;

  renderer.renderMapCommandDock({}, {});

  // Knife 6 retired the hud-dock-button-cell 9-slice band — the well is token-painted.
  assert.equal(clipped.length, 0);
  const fills = host.calls.filter((call) => call[0] === 'fillRect');
  // Tray face: full-width gradient rect over the whole tray band.
  assert.equal(fills.some((call) => call[2] === 0 && call[3] === trayTop && call[4] === 390 && call[5] === metrics.height), true);
  // Unified top light: tray bevel light line at the tray top edge...
  assert.equal(fills.some((call) => call[1] === palette.dockBevelLight && call[3] === trayTop && call[5] === 1), true);
  // ...and the well ridge light right above the recessed lip.
  const wellY = trayTop + metrics.ledgeHeight;
  assert.equal(fills.some((call) => call[1] === palette.dockBevelLight && call[3] === wellY - 1), true);
  // Well bottom inner rim light + cell frame outline + tray bottom warm edge line.
  assert.equal(fills.some((call) => call[1] === palette.dockWellRim && call[3] === wellY + metrics.wellHeight - 2), true);
  assert.equal(fills.some((call) => call[1] === palette.dockCellFrame && call[3] === wellY), true);
  assert.equal(fills.some((call) => call[1] === palette.plateEdgeWarmLine && call[3] === trayTop + metrics.height - 2), true);
});

test('MapCommandCanvasRenderer dock badges sit in socket shadows on the tray', () => {
  const arcs = [];
  const ctx = {
    _fillStyle: '',
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    fillRect() {},
    beginPath() {},
    arc(x, y, radius) { arcs.push({ x, y, radius, fillStyle: this._fillStyle }); },
    fill() { if (arcs.length) arcs[arcs.length - 1].filled = this._fillStyle; },
    stroke() {},
    save() {},
    restore() {},
  };
  const host = createHost({ ctx });
  const renderer = new MapCommandCanvasRenderer({ host });
  const UiThemeTokens = require('../../config/UiThemeTokens');
  const metrics = UiThemeTokens.getDockMetrics(390, 844);

  renderer.renderMapCommandDock({}, {});

  // Each badge draws a socket disc slightly larger than the badge circle.
  const socketRadius = metrics.badgeDiameter / 2 + UiThemeTokens.dock.badgeSocketPadPx;
  const sockets = arcs.filter((arc) => arc.radius === socketRadius && arc.filled === UiThemeTokens.hairline.badgeSocketShadow);
  assert.equal(sockets.length, 2);
});

test('MapCommandCanvasRenderer dock falls back to token panels while the badge asset is missing', () => {
  const panels = [];
  const host = createHost({
    drawAsset() { return false; },
    drawPanel(x, y, width, height, options = {}) { panels.push({ x, y, width, height, options }); },
  });
  const renderer = new MapCommandCanvasRenderer({ host });
  const UiThemeTokens = require('../../config/UiThemeTokens');
  const metrics = UiThemeTokens.getDockMetrics(390, 844);

  renderer.renderMapCommandDock({}, {});

  // Badge fallback: full-circle radius token panel.
  assert.equal(panels.some((panel) => panel.width === metrics.badgeDiameter && panel.options.radius === metrics.badgeDiameter / 2), true);
});

test('MapCommandCanvasRenderer dock lights active cells from pre-decided owner facts only', () => {
  const drawnText = [];
  const host = createHost({
    drawText(text, x, y, options = {}) { drawnText.push({ text, options }); },
  });
  const renderer = new MapCommandCanvasRenderer({ host });

  renderer.renderMapCommandDock({}, { activeDockItemIds: ['tasks', 'settings'] });

  const UiThemeTokens = require('../../config/UiThemeTokens');
  const activeColor = UiThemeTokens.palette.champagneGoldBright;
  const activeLabels = drawnText.filter((entry) => entry.options.color === activeColor).map((entry) => entry.text);
  assert.equal(activeLabels.includes(LocaleText.t('world.map.command.tasks')), true);
  assert.equal(activeLabels.includes(LocaleText.t('world.map.command.settings')), true);
  assert.equal(activeLabels.includes(LocaleText.t('world.map.command.tech')), false);
  assert.equal(activeLabels.includes(LocaleText.t('world.map.command.capital')), false);
});

test('MapCommandCanvasRenderer resolves command chrome through active locale', () => {
  LocaleText.setLocale('en-US');
  const host = createHost();
  const renderer = new MapCommandCanvasRenderer({ host });

  renderer.renderMapCommandDock({}, { activeCommandPanel: 'tech', showTaskCenter: true });
  renderer.renderFloatingSubcityButton({}, { showSubcityList: true });
  renderer.renderFloatingEventButton({}, { activeCommandPanel: 'events' });
  renderer.renderFloatingAccountButton({}, {});
  renderer.renderMapCommandPanel({ militaryView: 'world' }, { activeCommandPanel: 'tech' });

  ['Capital', 'Tech', 'Civilization', 'Famous', 'Tasks', 'Settings', 'Subcity', 'Events', 'Account'].forEach((label) => {
    assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === label), true);
  });
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'Tech'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openCommandPanel' && target.action.panel === 'tech'), true);
  LocaleText.setLocale('zh-CN');
});

test('MapCommandCanvasRenderer preserves floating map button contracts', () => {
  const host = createHost();
  const renderer = new MapCommandCanvasRenderer({ host });

  renderer.renderFloatingSubcityButton({}, { showSubcityList: true });
  renderer.renderFloatingEventButton({}, { activeCommandPanel: 'events' });
  renderer.renderFloatingAccountButton({}, {});

  assert.equal(host.hitTargets.some((target) => target.action.type === 'openSubcityList'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openCommandPanel' && target.action.panel === 'events'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'requestResetGame' && target.action.source === 'debugResetAccount'), true);
  // Knife 3: the float buttons request the gold-line icon set.
  ['hud-float-icon-subcity', 'hud-float-icon-event', 'hud-float-icon-account'].forEach((assetName) => {
    assert.equal(host.calls.some((call) => call[0] === 'drawAsset' && call[1].includes(assetName)), true);
  });
});

test('MapCommandCanvasRenderer lights active states only from the pre-decided dock id list', () => {
  const labelColors = [];
  const host = createHost({
    drawText(text, x, y, options = {}) { labelColors.push(options.color); },
  });
  const renderer = new MapCommandCanvasRenderer({ host });

  assert.equal(renderer.isDockItemActive({ id: 'tasks' }, { activeDockItemIds: ['tasks', 'settings'] }), true);
  assert.equal(renderer.isDockItemActive({ id: 'tech' }, { activeDockItemIds: ['tasks'] }), false);
  // Regression: the snapshot boundary once collapsed the id list to Boolean `true`;
  // that shape must stay inert instead of lighting every dock item.
  assert.equal(renderer.isDockItemActive({ id: 'tasks' }, { activeDockItemIds: true }), false);
  assert.equal(renderer.isDockItemActive({ id: 'tech' }, { activeCommandPanel: 'tech' }), true);

  // Float button active state now shows through the label color (the disc
  // fill is a constant aged-iron gradient in both states).
  renderer.renderFloatingAccountButton({}, { activeDockItemIds: Object.freeze(['account']) });
  const activeLabelColor = labelColors.at(-1);
  labelColors.length = 0;
  renderer.renderFloatingAccountButton({}, { activeDockItemIds: true });
  const collapsedLabelColor = labelColors.at(-1);
  labelColors.length = 0;
  renderer.renderFloatingAccountButton({}, {});
  const inactiveLabelColor = labelColors.at(-1);
  assert.notEqual(activeLabelColor, inactiveLabelColor);
  assert.equal(collapsedLabelColor, inactiveLabelColor);
});

test('MapCommandCanvasRenderer ignores legacy capital command panel state', () => {
  const host = createHost();
  const renderer = new MapCommandCanvasRenderer({ host });

  renderer.renderMapCommandPanel({ cityState: {} }, { activeCommandPanel: 'capital' });

  assert.equal(host.hitTargets.length, 0);
  assert.equal(host.calls.some((call) => call[0] === 'renderPopulation'), false);
  assert.equal(host.calls.some((call) => call[0] === 'renderHomeFeatureGrid'), false);
  assert.equal(host.calls.some((call) => call[0] === 'renderMainPanel'), false);
});

test('MapCommandCanvasRenderer preserves command panel main-panel delegation', () => {
  const host = createHost();
  const renderer = new MapCommandCanvasRenderer({ host });

  renderer.renderMapCommandPanel({ militaryView: 'world' }, { activeCommandPanel: 'military', activeBuildingCategory: 'housing' });

  const call = host.calls.find((item) => item[0] === 'renderMainPanel');
  assert.ok(call);
  assert.equal(call[1][1], 'military');
  assert.equal(call[1][0].militaryView, 'army');
});

test('CanvasGameRenderer exposes map command rendering through facade', () => {
  class StubMapCommandRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderMapCommandDock(...args) {
      return { method: 'renderMapCommandDock', host: this.host, args };
    }

    renderMapCommandPanel(...args) {
      return { method: 'renderMapCommandPanel', host: this.host, args };
    }

    renderFloatingAccountButton(...args) {
      return { method: 'renderFloatingAccountButton', host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    mapCommandRendererClass: StubMapCommandRenderer,
  });
  const state = { activeCityId: 'capital' };
  const options = { activeCommandPanel: 'tech' };

  const dockResult = renderer.renderMapCommandDock(state, options);
  const panelResult = renderer.renderMapCommandPanel(state, options);
  const accountResult = renderer.renderFloatingAccountButton(state, options);

  assert.equal(dockResult.host, renderer);
  assert.equal(dockResult.method, 'renderMapCommandDock');
  assert.deepEqual(dockResult.args, [state, options]);
  assert.equal(panelResult.method, 'renderMapCommandPanel');
  assert.equal(accountResult.method, 'renderFloatingAccountButton');
});
