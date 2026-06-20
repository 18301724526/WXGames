const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FamousCanvasRenderer = require('./FamousCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const hitTargets = [];
  const host = {
    width: 390,
    height: 844,
    ctx: {
      fillRect() {},
      drawImage() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      fill() {},
      stroke() {},
      save() {},
      restore() {},
      clip() {},
      globalAlpha: 1,
    },
    hoverPoint: null,
    famousSkillHitTargets: [],
    activeFamousSkillTooltip: null,
    pinnedFamousSkillTooltip: null,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    containsPoint(rect = {}, point = {}) {
      return point.x >= rect.x
        && point.x <= rect.x + rect.width
        && point.y >= rect.y
        && point.y <= rect.y + rect.height;
    },
    createGradient() { return '#111'; },
    drawPanel() {},
    drawButton() {},
    drawText() {},
    drawTextLines() {},
    drawLine() {},
    drawPrimaryActionButton() {},
    getAsset() { return null; },
    getLayout() { return { contentWidth: 380, contentX: 10, contentRight: 390 }; },
    measureTextWidth(text) { return String(text || '').length * 8; },
    truncateText(text) { return String(text || ''); },
    wrapTextLimit(text) { return [String(text || '')]; },
    hitTargets,
    ...overrides,
  };
  return host;
}

const FAMOUS_DRAWING_METHODS = [
  'addHitTarget',
  'containsPoint',
  'createGradient',
  'drawButton',
  'drawLine',
  'drawPanel',
  'drawText',
  'drawTextLines',
  'getAsset',
  'getLayout',
  'roundRectPath',
  'truncateText',
  'wrapTextLimit',
];

function createDrawingSurfaceSentinel(label, calls = []) {
  return {
    addHitTarget() {
      calls.push([label, 'addHitTarget']);
    },
    containsPoint() {
      calls.push([label, 'containsPoint']);
      return label === 'explicit';
    },
    createGradient() {
      calls.push([label, 'createGradient']);
      return label;
    },
    drawButton() {
      calls.push([label, 'drawButton']);
    },
    drawLine() {
      calls.push([label, 'drawLine']);
    },
    drawPanel() {
      calls.push([label, 'drawPanel']);
    },
    drawText() {
      calls.push([label, 'drawText']);
    },
    drawTextLines() {
      calls.push([label, 'drawTextLines']);
    },
    getAsset() {
      calls.push([label, 'getAsset']);
      return { width: 1, height: 1 };
    },
    getLayout() {
      calls.push([label, 'getLayout']);
      return { contentWidth: 380, contentX: 10, contentRight: 390 };
    },
    roundRectPath() {
      calls.push([label, 'roundRectPath']);
    },
    truncateText(text) {
      calls.push([label, 'truncateText']);
      return String(text || '');
    },
    wrapTextLimit(text) {
      calls.push([label, 'wrapTextLimit']);
      return [String(text || '')];
    },
  };
}

function getCalledDrawingSurfaceMethods(calls, label) {
  return Array.from(new Set(calls.filter((call) => call[0] === label).map((call) => call[1]))).sort();
}

test('FamousCanvasRenderer reads host view state dynamically after proxy removal', () => {
  const firstCtx = { id: 'first-ctx' };
  const secondCtx = { id: 'second-ctx' };
  const firstPresenter = { id: 'first-presenter' };
  const secondPresenter = { id: 'second-presenter' };
  const host = createHost({
    ctx: firstCtx,
    presenter: firstPresenter,
    width: 390,
    height: 844,
    hoverPoint: { x: 1, y: 2 },
    famousSkillHitTargets: [{ id: 'first-target' }],
  });
  const renderer = new FamousCanvasRenderer({ host });

  assert.equal(renderer.ctx, firstCtx);
  assert.equal(renderer.presenter, firstPresenter);
  assert.equal(renderer.width, 390);
  assert.equal(renderer.height, 844);
  assert.deepEqual(renderer.hoverPoint, { x: 1, y: 2 });
  assert.equal(renderer.famousSkillHitTargets, host.famousSkillHitTargets);

  host.ctx = secondCtx;
  host.presenter = secondPresenter;
  host.width = 512;
  host.height = 900;
  host.hoverPoint = { x: 3, y: 4 };
  host.famousSkillHitTargets = [{ id: 'second-target' }];

  assert.equal(renderer.ctx, secondCtx);
  assert.equal(renderer.presenter, secondPresenter);
  assert.equal(renderer.width, 512);
  assert.equal(renderer.height, 900);
  assert.deepEqual(renderer.hoverPoint, { x: 3, y: 4 });
  assert.equal(renderer.famousSkillHitTargets, host.famousSkillHitTargets);
});

test('FamousCanvasRenderer forwards tooltip state writes to host after proxy removal', () => {
  const host = createHost();
  const renderer = new FamousCanvasRenderer({ host });
  const hoverPoint = { x: 11, y: 22 };
  const active = { type: 'showFamousSkillTooltip', cardId: 'active', skillIndex: 0 };
  const pinned = { type: 'showFamousSkillTooltip', cardId: 'pinned', skillIndex: 1 };

  renderer.hoverPoint = hoverPoint;
  renderer.activeFamousSkillTooltip = active;
  renderer.pinnedFamousSkillTooltip = pinned;

  assert.equal(host.hoverPoint, hoverPoint);
  assert.equal(host.activeFamousSkillTooltip, active);
  assert.equal(host.pinnedFamousSkillTooltip, pinned);

  host.hoverPoint = null;
  host.activeFamousSkillTooltip = null;
  host.pinnedFamousSkillTooltip = null;

  assert.equal(renderer.hoverPoint, null);
  assert.equal(renderer.activeFamousSkillTooltip, null);
  assert.equal(renderer.pinnedFamousSkillTooltip, null);
});

test('FamousCanvasRenderer no longer forwards unknown host properties through proxy', () => {
  const host = createHost({ someRandomProp: 'host-only' });
  const renderer = new FamousCanvasRenderer({ host });

  assert.equal(renderer.someRandomProp, undefined);
});

test('FamousCanvasRenderer drawing wrappers prefer explicit drawing surface over host fallback', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new FamousCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });

  renderer.addHitTarget({}, {});
  renderer.containsPoint({}, {});
  renderer.createGradient();
  renderer.drawButton();
  renderer.drawLine();
  renderer.drawPanel();
  renderer.drawText();
  renderer.drawTextLines();
  renderer.getAsset('asset');
  renderer.getLayout();
  renderer.roundRectPath();
  renderer.truncateText('text');
  renderer.wrapTextLimit('text');

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), FAMOUS_DRAWING_METHODS);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('FamousCanvasRenderer owns pagination and tooltip state helpers', () => {
  const host = createHost();
  const renderer = new FamousCanvasRenderer({ host });

  assert.deepEqual(renderer.normalizeFamousPersonsPage(12, 99, 5), { index: 2, pages: 3 });

  const action = { type: 'showFamousSkillTooltip', cardId: 'hero-1', skillIndex: 0 };
  host.famousSkillHitTargets.push({ x: 10, y: 20, width: 80, height: 30, action });
  assert.deepEqual(renderer.getFamousSkillTooltipAction({ x: 20, y: 30 }), action);

  assert.equal(renderer.setPinnedFamousSkillTooltip(action), true);
  assert.deepEqual(host.pinnedFamousSkillTooltip, action);
  assert.equal(renderer.setPinnedFamousSkillTooltip(action), true);
  assert.equal(host.pinnedFamousSkillTooltip, null);
});

test('CanvasGameRenderer exposes famous helpers through the famous renderer facade', () => {
  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    famousRendererClass: FamousCanvasRenderer,
  });

  assert.deepEqual(renderer.normalizeFamousPersonsPage(9, 1, 4), { index: 1, pages: 3 });
  assert.equal(renderer.setPinnedFamousSkillTooltip({ type: 'showFamousSkillTooltip', cardId: 'hero-2', skillIndex: 1 }), true);
  assert.deepEqual(renderer.pinnedFamousSkillTooltip, { type: 'showFamousSkillTooltip', cardId: 'hero-2', skillIndex: 1 });
  assert.equal(renderer.clearFamousSkillTooltip(), true);
  assert.equal(renderer.pinnedFamousSkillTooltip, null);
});

test('FamousCanvasRenderer panel rendering keeps modal and pager hit target contracts', () => {
  const host = createHost({
    presenter: {
      buildFamousPersonViewState() {
        return {
          title: 'Famous',
          subtitle: 'Roster',
          peopleCount: 7,
          candidateCount: 0,
          maxCandidates: 3,
          people: Array.from({ length: 7 }, (_, index) => ({
            id: `hero-${index}`,
            name: `Hero ${index}`,
            level: 1,
            attributes: [
              { label: 'A', shortLabel: 'A', value: 50 },
              { label: 'B', shortLabel: 'B', value: 50 },
              { label: 'C', shortLabel: 'C', value: 50 },
            ],
            skillBadges: [],
            skillDetails: [],
          })),
          candidates: [],
          seek: {
            text: 'Seek',
            message: 'Ready',
            available: true,
            action: { type: 'seekFamousPerson' },
          },
          emptyText: '',
        };
      },
    },
  });
  const renderer = new FamousCanvasRenderer({ host });

  renderer.renderFamousPersonsPanel({}, { famousPersonsPage: 0 });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeFamousPersons'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'seekFamousPerson'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'changeFamousPersonsPage'), true);
});

test('FamousCanvasRenderer delegates skill badges and tooltips to the skill renderer', () => {
  const panels = [];
  const lines = [];
  const host = createHost({
    hoverPoint: { x: 18, y: 24 },
    drawPanel(x, y, width, height) { panels.push({ x, y, width, height }); },
    drawTextLines(wrapped) { lines.push(wrapped); },
  });
  const renderer = new FamousCanvasRenderer({ host });
  const card = {
    id: 'hero-1',
    skillDetails: [
      { name: 'Pathfinder', kindText: 'Scout', description: 'Reveal nearby land.', meta: 'Passive' },
    ],
    skillBadges: [
      { text: 'Scout: Pathfinder' },
    ],
  };

  renderer.renderSkillBadges(card, 10, 20, 150, { cardId: card.id });

  assert.equal(host.famousSkillHitTargets.length, 1);
  assert.equal(host.famousSkillHitTargets[0].action.type, 'showFamousSkillTooltip');
  assert.deepEqual(host.activeFamousSkillTooltip, host.famousSkillHitTargets[0].action);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'showFamousSkillTooltip'), true);

  renderer.renderFamousSkillTooltip(host.activeFamousSkillTooltip);

  assert.equal(panels.length >= 2, true);
  assert.equal(lines.length, 1);
});

test('index.html loads famous renderer helpers before the compatibility facade', () => {
  const htmlPath = path.resolve(__dirname, '../../../index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const expectedOrder = [
    'FamousCanvasModel.js',
    'FamousPortraitCanvasRenderer.js',
    'FamousSkillCanvasRenderer.js',
    'FamousPanelCanvasRenderer.js',
    'FamousCanvasRenderer.js',
  ];
  const positions = expectedOrder.map((name) => html.indexOf(name));

  positions.forEach((position, index) => {
    assert.notEqual(position, -1, `${expectedOrder[index]} should be loaded`);
    if (index > 0) assert.equal(positions[index - 1] < position, true, `${expectedOrder[index - 1]} should load before ${expectedOrder[index]}`);
  });
});
