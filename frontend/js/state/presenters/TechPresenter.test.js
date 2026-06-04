const test = require('node:test');
const assert = require('node:assert/strict');

const TechPresenter = require('./TechPresenter');
const UIStatePresenter = require('../UIStatePresenter');

function createTechState() {
  return {
    resources: { knowledgePerSecond: 1.5 },
    techUiState: { selectedTechId: 'bronze' },
    techs: {
      points: 2,
      researchedCount: 1,
      researched: { fire: true },
      eras: [
        {
          era: 1,
          name: 'Era 1',
          choicesUsed: 1,
          choiceLimit: 2,
          techs: [
            {
              id: 'fire',
              name: 'Fire',
              available: false,
              researched: true,
              status: 'researched',
              route: 'knowledge',
              routeLabel: 'Knowledge',
              unlockedBuildings: ['farm'],
              parents: [],
              tree: { column: 1, lane: 0, parents: [] },
            },
            {
              id: 'bronze',
              name: 'Bronze',
              available: true,
              researched: false,
              status: 'available',
              route: 'industry',
              routeLabel: 'Industry',
              resourceEntrances: ['iron'],
              parents: ['fire'],
              parentNames: ['Fire'],
              tree: { column: 2, lane: 1, parents: ['fire'] },
            },
          ],
        },
      ],
    },
  };
}

test('TechPresenter builds tech tree nodes, links, and selected detail', () => {
  const view = TechPresenter.buildTechViewState(createTechState());

  assert.equal(view.points, 2);
  assert.equal(view.researchedCount, 1);
  assert.equal(view.availableCount, 1);
  assert.equal(view.tree.nodes.length, 2);
  assert.deepEqual(view.tree.links, [
    { from: 'fire', to: 'bronze', researched: false, active: true, locked: false },
  ]);
  assert.equal(view.detail.id, 'bronze');
  assert.equal(view.detail.canResearch, true);
  assert.equal(view.detail.prerequisiteText, 'Fire');
  assert.equal(view.text.knowledgeRate, '1.5/s');
});

test('UIStatePresenter delegates tech view state to TechPresenter', () => {
  const state = createTechState();

  assert.deepEqual(
    UIStatePresenter.buildTechViewState(state),
    TechPresenter.buildTechViewState(state),
  );
});
