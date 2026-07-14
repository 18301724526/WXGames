const test = require('node:test');
const assert = require('node:assert/strict');

const TaskCanvasRenderer = require('./TaskCanvasRenderer');
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
      buildTaskCenterViewState() {
        return createTaskCenterView();
      },
    },
    hitTargets,
    calls,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    createGradient() { return '#123'; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawPanel(...args) { calls.push(['drawPanel', ...args]); },
    drawText(...args) { calls.push(['drawText', ...args]); },
    drawTextLines(lines) { calls.push(['drawTextLines', lines]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    truncateText(text) { return String(text || ''); },
    wrapTextLimit(text) { return [String(text || '')]; },
    ...overrides,
  };
  return host;
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
          action: { type: 'claimTaskReward', taskId: 'task-claim', category: 'main' },
        },
        {
          id: 'task-active',
          title: 'Scout North',
          description: 'Find a new tile.',
          progressText: 'In progress',
          rewardText: '+5 food',
          status: 'active',
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

test('TaskCanvasRenderer prefers explicit drawing surface over proxy fallback host', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  fallbackHost.presenter = createHost().presenter;
  const renderer = new TaskCanvasRenderer({
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

test('TaskCanvasRenderer falls back to host drawing surface when none is injected', () => {
  const calls = [];
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  fallbackHost.presenter = createHost().presenter;
  const renderer = new TaskCanvasRenderer({ host: fallbackHost });
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

test('TaskCanvasRenderer reads dynamic host state through explicit getters', () => {
  const firstPresenter = createHost().presenter;
  const secondPresenter = createHost().presenter;
  const host = createHost({
    width: 390,
    height: 844,
    presenter: firstPresenter,
  });
  const renderer = new TaskCanvasRenderer({ host });

  assert.equal(renderer.width, 390);
  assert.equal(renderer.height, 844);
  assert.equal(renderer.presenter, firstPresenter);

  host.width = 512;
  host.height = 900;
  host.presenter = secondPresenter;

  assert.equal(renderer.width, 512);
  assert.equal(renderer.height, 900);
  assert.equal(renderer.presenter, secondPresenter);
});

test('TaskCanvasRenderer does not proxy unknown host properties', () => {
  const host = createHost({
    someRandomProp: 'host-only',
  });
  const renderer = new TaskCanvasRenderer({ host });

  assert.equal(host.someRandomProp, 'host-only');
  assert.equal(renderer.someRandomProp, undefined);
});

test('TaskCanvasRenderer preserves task center claim targets without active-task navigation', () => {
  const host = createHost();
  const renderer = new TaskCanvasRenderer({ host });

  renderer.renderTaskCenterPanel({}, { activeTaskCenterTab: 'main' });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeTaskCenter'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'switchTaskCenterTab' && target.action.tab === 'daily'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'claimTaskReward' && target.action.taskId === 'task-claim'), true);
  assert.equal(host.hitTargets.some((target) => target.action.taskId === 'task-active'), false);
  assert.equal(host.calls.some((call) => (
    call[0] === 'drawTextLines'
    && Array.isArray(call[1])
    && call[1].some((line) => line.includes('In progress'))
  )), true);
});

test('TaskCanvasRenderer renders completed tasks without a claim command', () => {
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
  const renderer = new TaskCanvasRenderer({ host });

  renderer.renderTaskCenterPanel({}, { activeTaskCenterTab: 'main' });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'claimTaskReward'), false);
  const completedLabel = host.calls.find((call) => call[0] === 'drawText' && call[1] === '已完成');
  assert.ok(completedLabel);
  assert.equal(completedLabel[4].bold, false);
});

test('TaskCanvasRenderer localizes structured rewards instead of raw rewardText', () => {
  const host = createHost();
  const renderer = new TaskCanvasRenderer({ host });

  assert.equal(
    renderer.formatTaskRewardText({ reward: { resources: { food: 120, knowledge: 5 } }, rewardText: 'food+120 / knowledge+5' }),
    '粮食+120 / 知识+5',
  );
  assert.equal(
    renderer.formatTaskRewardText({ reward: { famousPerson: 'scout' }, rewardText: '开拓名人+1' }),
    '开拓名人+1',
  );
  assert.equal(
    renderer.formatTaskRewardText({ reward: { resources: { soldiers: 1000 } }, rewardText: '士兵+1000' }),
    '士兵+1000',
  );
  assert.equal(
    renderer.formatTaskRewardText({ reward: { resources: { influence: 3 } } }),
    'influence+3',
  );
  assert.equal(renderer.formatTaskRewardText({ reward: { resources: {} }, rewardText: 'none' }), '无奖励');
  assert.equal(renderer.formatTaskRewardText({}), '无奖励');
});

test('CanvasGameRenderer exposes task center rendering through facade', () => {
  class StubTaskRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderTaskCenterPanel(...args) {
      return { method: 'renderTaskCenterPanel', host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    taskRendererClass: StubTaskRenderer,
  });
  const state = { taskCenter: {} };
  const options = { activeTaskCenterTab: 'main' };

  const panelResult = renderer.renderTaskCenterPanel(state, options);

  assert.equal(panelResult.host, renderer);
  assert.deepEqual(panelResult.args, [state, options]);
});
