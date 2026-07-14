const test = require('node:test');
const assert = require('node:assert/strict');

const UIStatePresenterDelegates = require('./UIStatePresenterDelegates');

test('UIStatePresenterDelegates creates direct presenter static delegates', () => {
  class Facade {}
  const calls = [];
  Object.assign(Facade, UIStatePresenterDelegates.createStaticMethods({
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
  }));

  assert.equal(Facade.toNumber('12', 0), 12);
  assert.equal(Facade.formatCompactNumber(12000), '12k');
  assert.deepEqual(Facade.buildResourceViewState({ id: 'state-1' }), { id: 'state-1' });
  assert.deepEqual(calls, [
    ['toNumber', '12', 0],
    ['formatCompactNumber', 12000],
    ['buildResourceViewState', 'state-1'],
  ]);
});

test('UIStatePresenterDelegates preserves tech fallback contract', () => {
  class WithTech {}
  Object.assign(WithTech, UIStatePresenterDelegates.createStaticMethods({
    TechPresenter: {
      buildTechViewState(state) {
        return { selectedTech: state.selectedTech };
      },
    },
  }));
  assert.deepEqual(WithTech.buildTechViewState({ selectedTech: 'tech-1' }), { selectedTech: 'tech-1' });

  class WithoutTech {}
  Object.assign(WithoutTech, UIStatePresenterDelegates.createStaticMethods({
    TechPresenter: {},
  }));
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
