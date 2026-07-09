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

function createDrawingSurfaceSentinel(label, calls = []) {
  return {
    width: 390,
    height: 844,
    bottomSafeArea: 12,
    addHitTarget(rect, action) {
      calls.push([label, 'addHitTarget', action?.type]);
    },
    createGradient() {
      calls.push([label, 'createGradient']);
      return label;
    },
    drawButton(_x, _y, _width, _height, buttonLabel) {
      calls.push([label, 'drawButton', buttonLabel]);
    },
    drawPanel() {
      calls.push([label, 'drawPanel']);
    },
    drawText(text) {
      calls.push([label, 'drawText', text]);
    },
    drawTextLines(lines) {
      calls.push([label, 'drawTextLines', lines]);
    },
    getLayout() {
      calls.push([label, 'getLayout']);
      return { contentX: 10, contentWidth: 360, contentRight: 370 };
    },
    truncateText(text) {
      calls.push([label, 'truncateText', text]);
      return String(text || '');
    },
    wrapTextLimit(text) {
      calls.push([label, 'wrapTextLimit', text]);
      return [String(text || '')];
    },
  };
}

function getCalledDrawingSurfaceMethods(calls, label) {
  return Array.from(new Set(calls.filter((call) => call[0] === label).map((call) => call[1]))).sort();
}

test('GuideTaskCanvasRenderer prefers explicit drawing surface over proxy fallback host', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  fallbackHost.presenter = createHost().presenter;
  const renderer = new GuideTaskCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });
  fallbackHost.presenter = createHost().presenter;
  fallbackHost.width = 390;
  fallbackHost.height = 844;
  fallbackHost.bottomSafeArea = 12;

  renderer.renderTaskCenterPanel({}, { activeTaskCenterTab: 'main' });

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), [
    'addHitTarget',
    'createGradient',
    'drawPanel',
    'drawText',
    'drawTextLines',
    'getLayout',
    'truncateText',
    'wrapTextLimit',
  ]);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('GuideTaskCanvasRenderer falls back to host drawing surface when none is injected', () => {
  const calls = [];
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  fallbackHost.presenter = createHost().presenter;
  const renderer = new GuideTaskCanvasRenderer({ host: fallbackHost });
  fallbackHost.presenter = createHost().presenter;
  fallbackHost.width = 390;
  fallbackHost.height = 844;
  fallbackHost.bottomSafeArea = 12;

  renderer.renderTaskCenterPanel({}, { activeTaskCenterTab: 'main' });

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), [
    'addHitTarget',
    'createGradient',
    'drawPanel',
    'drawText',
    'drawTextLines',
    'getLayout',
    'truncateText',
    'wrapTextLimit',
  ]);
});

test('GuideTaskCanvasRenderer reads dynamic host state through explicit getters', () => {
  const firstCtx = { fillRect() {}, globalAlpha: 1 };
  const secondCtx = { fillRect() {}, globalAlpha: 1 };
  const firstPresenter = createHost().presenter;
  const secondPresenter = createHost().presenter;
  const host = createHost({
    width: 390,
    height: 844,
    ctx: firstCtx,
    presenter: firstPresenter,
  });
  const renderer = new GuideTaskCanvasRenderer({ host });

  assert.equal(renderer.width, 390);
  assert.equal(renderer.height, 844);
  assert.equal(renderer.ctx, firstCtx);
  assert.equal(renderer.presenter, firstPresenter);

  host.width = 512;
  host.height = 900;
  host.ctx = secondCtx;
  host.presenter = secondPresenter;

  assert.equal(renderer.width, 512);
  assert.equal(renderer.height, 900);
  assert.equal(renderer.ctx, secondCtx);
  assert.equal(renderer.presenter, secondPresenter);
});

test('GuideTaskCanvasRenderer does not proxy unknown host properties', () => {
  const host = createHost({
    someRandomProp: 'host-only',
  });
  const renderer = new GuideTaskCanvasRenderer({ host });

  assert.equal(host.someRandomProp, 'host-only');
  assert.equal(renderer.someRandomProp, undefined);
});

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

test('GuideTaskCanvasRenderer emits visualDisabled for disabled claim commands', () => {
  const host = createHost({
    presenter: {
      buildTaskCenterViewState() {
        const view = createTaskCenterView();
        view.activeCategory.tasks = [{
          id: 'task-complete',
          category: 'main',
          title: 'Complete',
          status: 'completed',
          claimed: false,
          action: { type: 'claimTaskReward', taskId: 'task-complete', category: 'main' },
        }];
        return view;
      },
    },
  });
  const renderer = new GuideTaskCanvasRenderer({ host });

  renderer.renderTaskCenterPanel({}, { activeTaskCenterTab: 'main' });

  const claim = host.hitTargets.find((target) => target.action.type === 'claimTaskReward');
  assert.equal(claim.action.visualDisabled, true);
  assert.equal(claim.action.disabled, undefined);
});

test('GuideTaskCanvasRenderer preserves disabled quick entry contracts', () => {
  const host = createHost();
  const renderer = new GuideTaskCanvasRenderer({ host });
  const state = {
    guideTasks: {
      visible: true,
      tasks: [{ id: 'task-1', title: 'Build House', status: 'claimable', target: 'buildings' }],
    },
  };

  assert.equal(renderer.renderGuideTasks(state, 188), 188);
  assert.equal(renderer.renderTaskCenterButton(state), undefined);
  assert.equal(renderer.renderGuidebookButton(state), undefined);
  assert.equal(host.hitTargets.length, 0);
  assert.equal(host.calls.length, 0);
});

test('GuideTaskCanvasRenderer localizes structured rewards instead of raw rewardText', () => {
  const host = createHost();
  const renderer = new GuideTaskCanvasRenderer({ host });

  assert.equal(
    renderer.formatTaskRewardText({ reward: { resources: { food: 120, knowledge: 5 } }, rewardText: 'food+120 / knowledge+5' }),
    '粮食+120 / 知识+5',
  );
  assert.equal(renderer.formatTaskRewardText({ reward: { resources: {} }, rewardText: 'none' }), '无奖励');
  assert.equal(renderer.formatTaskRewardText({}), '无奖励');
});

test('CanvasGameRenderer exposes guide task rendering through facade', () => {
  class StubGuideTaskRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderGuideTasks(...args) {
      return { method: 'renderGuideTasks', host: this.host, args };
    }

    renderTaskCenterButton(...args) {
      return { method: 'renderTaskCenterButton', host: this.host, args };
    }

    renderGuidebookButton(...args) {
      return { method: 'renderGuidebookButton', host: this.host, args };
    }

    renderTaskCenterPanel(...args) {
      return { method: 'renderTaskCenterPanel', host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    guideTaskRendererClass: StubGuideTaskRenderer,
  });
  const state = { taskCenter: {} };
  const options = { activeTaskCenterTab: 'main' };

  const guideTasksResult = renderer.renderGuideTasks(state, 222);
  const taskButtonResult = renderer.renderTaskCenterButton(state);
  const guideButtonResult = renderer.renderGuidebookButton(state);
  const panelResult = renderer.renderTaskCenterPanel(state, options);

  assert.equal(guideTasksResult.host, renderer);
  assert.equal(guideTasksResult.method, 'renderGuideTasks');
  assert.deepEqual(guideTasksResult.args, [state, 222]);
  assert.equal(taskButtonResult.method, 'renderTaskCenterButton');
  assert.equal(guideButtonResult.method, 'renderGuidebookButton');
  assert.equal(panelResult.host, renderer);
  assert.deepEqual(panelResult.args, [state, options]);
});
