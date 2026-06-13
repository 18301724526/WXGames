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
    CityResourcePresenter: {
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

test('UIStatePresenterDelegates does not install deleted guidebook facade callbacks', () => {
  class Facade {}
  UIStatePresenterDelegates.install(Facade, {
    TaskGuidePresenter: {
      buildGuidebookViewState() {
        throw new Error('deleted guidebook callback must not be installed');
      },
    },
    CityResourcePresenter: {
      buildCityPlanningViewState(state) {
        return { source: 'city-resource', id: state.id };
      },
    },
  });

  Facade.buildCityPlanningViewState = (state) => ({ source: 'facade', id: state.id });

  assert.equal('buildGuidebookViewState' in Facade, false);
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
