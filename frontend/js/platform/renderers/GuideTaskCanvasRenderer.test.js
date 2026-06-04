const test = require('node:test');
const assert = require('node:assert/strict');

const GuideTaskCanvasRenderer = require('./GuideTaskCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    bottomSafeArea: 12,
    ctx: {
      fillRect() { calls.push(['fillRect']); },
      globalAlpha: 1,
    },
    presenter: {
      buildGuidebookViewState() {
        return createGuidebookView();
      },
      buildTaskCenterViewState() {
        return createTaskCenterView();
      },
    },
    hitTargets,
    calls,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    createGradient() { return '#123'; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawPanel() { calls.push(['drawPanel']); },
    drawText(text) { calls.push(['drawText', text]); },
    drawTextLines(lines) { calls.push(['drawTextLines', lines]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    truncateText(text) { return String(text || ''); },
    wrapTextLimit(text) { return [String(text || '')]; },
    ...overrides,
  };
  return host;
}

function createGuidebookView() {
  return {
    title: 'Guide',
    subtitle: 'Plan better',
    categories: [
      { id: 'planning', label: 'Plan', isActive: true },
      { id: 'military', label: 'War', isActive: false },
    ],
    activeCategory: {
      id: 'planning',
      title: 'City Planning',
      lines: ['Place farms near rivers.', 'Balance housing and food.'],
    },
    planning: {
      terrainLabel: 'Plains',
      text: {
        habitabilityStatus: 'Good',
        populationGrowthStatus: 'Growing',
        note: 'Keep enough homes.',
      },
    },
  };
}

function createTaskCenterView() {
  return {
    activeTab: 'main',
    summary: { claimableCount: 1 },
    tabs: [
      { id: 'main', label: 'Main', isActive: true, badge: 1 },
      { id: 'daily', label: 'Daily', isActive: false, badge: 0 },
    ],
    activeCategory: {
      tasks: [
        {
          id: 'task-claim',
          category: 'main',
          title: 'Build House',
          description: 'Build one house.',
          rewardText: '+10 wood',
          status: 'claimable',
          claimed: false,
        },
        {
          id: 'task-go',
          title: 'Scout North',
          description: 'Find a new tile.',
          rewardText: '+5 food',
          status: 'active',
          target: 'scout-north',
        },
      ],
    },
  };
}

test('GuideTaskCanvasRenderer preserves guidebook modal hit targets', () => {
  const host = createHost();
  const renderer = new GuideTaskCanvasRenderer({ host });

  renderer.renderGuidebookPanel({}, { activeGuidebookTab: 'planning' });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeGuidebook'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'switchGuidebookTab' && target.action.tab === 'military'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'Guide'), true);
});

test('GuideTaskCanvasRenderer preserves task center claim and navigation targets', () => {
  const host = createHost();
  const renderer = new GuideTaskCanvasRenderer({ host });

  renderer.renderTaskCenterPanel({}, { activeTaskCenterTab: 'main' });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeTaskCenter'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'switchTaskCenterTab' && target.action.tab === 'daily'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'claimTaskReward' && target.action.taskId === 'task-claim'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'goToGuideTaskTarget' && target.action.target === 'scout-north'), true);
});

test('CanvasGameRenderer exposes guide task panels through facade', () => {
  class StubGuideTaskRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderTaskCenterPanel(...args) {
      return { host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    guideTaskRendererClass: StubGuideTaskRenderer,
  });
  const state = { taskCenter: {} };
  const options = { activeTaskCenterTab: 'main' };

  const result = renderer.renderTaskCenterPanel(state, options);

  assert.equal(result.host, renderer);
  assert.deepEqual(result.args, [state, options]);
});
