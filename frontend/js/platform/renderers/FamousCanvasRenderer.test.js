const test = require('node:test');
const assert = require('node:assert/strict');

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
