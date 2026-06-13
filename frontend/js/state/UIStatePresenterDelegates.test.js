const test = require('node:test');
const assert = require('node:assert/strict');

const UIStatePresenterDelegates = require('./UIStatePresenterDelegates');

test('UIStatePresenterDelegates installs direct presenter static delegates', () => {
  class Facade {}
  const calls = [];
  UIStatePresenterDelegates.install(Facade, {
    ShellPresenter: {
      toNumber(value, fallback) {
        calls.push(['toNumber', value, fallback]);
        return 12;
      },
      formatCompactNumber(value) {
        calls.push(['formatCompactNumber', value]);
        return '12k';
      },
    },
    HomePresenter: {
      buildResourceViewState(state) {
        calls.push(['buildResourceViewState', state.id]);
        return { id: state.id };
      },
    },
  });

  assert.equal(Facade.toNumber('12', 0), 12);
  assert.equal(Facade.formatCompactNumber(12000), '12k');
  assert.deepEqual(Facade.buildResourceViewState({ id: 'state-1' }), { id: 'state-1' });
  assert.deepEqual(calls, [
    ['toNumber', '12', 0],
    ['formatCompactNumber', 12000],
    ['buildResourceViewState', 'state-1'],
  ]);
});

test('UIStatePresenterDelegates keeps custom guidebook and home facade callbacks', () => {
  class Facade {}
  UIStatePresenterDelegates.install(Facade, {
    TaskGuidePresenter: {
      buildGuidebookViewState(state, options) {
        return {
          stateId: state.id,
          planning: options.buildCityPlanningViewState({ id: 'plan-state' }),
        };
      },
    },
    HomePresenter: {
      buildCityPlanningViewState(state) {
        return { source: 'home', id: state.id };
      },
      buildHomeFeatureViewState(state, options) {
        return {
          stateId: state.id,
          tasks: options.buildTaskCenterViewState({ id: 'task-state' }),
        };
      },
    },
  });

  Facade.buildCityPlanningViewState = (state) => ({ source: 'facade', id: state.id });
  Facade.buildTaskCenterViewState = (state) => ({ source: 'facade-task', id: state.id });

  assert.deepEqual(Facade.buildGuidebookViewState({ id: 'guide' }), {
    stateId: 'guide',
    planning: { source: 'facade', id: 'plan-state' },
  });
  assert.deepEqual(Facade.buildHomeFeatureViewState({ id: 'home' }), {
    stateId: 'home',
    tasks: { source: 'facade-task', id: 'task-state' },
  });
});

test('UIStatePresenterDelegates preserves tech fallback contract', () => {
  class WithTech {}
  UIStatePresenterDelegates.install(WithTech, {
    TechPresenter: {
      buildTechViewState(state) {
        return { selectedTech: state.selectedTech };
      },
    },
  });
  assert.deepEqual(WithTech.buildTechViewState({ selectedTech: 'tech-1' }), { selectedTech: 'tech-1' });

  class WithoutTech {}
  UIStatePresenterDelegates.install(WithoutTech, {
    TechPresenter: {},
  });
  assert.deepEqual(WithoutTech.buildTechViewState(), {
    points: 0,
    researchedCount: 0,
    availableCount: 0,
    eras: [],
    nodes: [],
    links: [],
    treeEras: [],
    selectedTech: null,
  });
});
