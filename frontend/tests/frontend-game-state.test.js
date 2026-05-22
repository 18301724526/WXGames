const test = require('node:test');
const assert = require('node:assert/strict');

const FrontendGameState = require('../js/domain/GameState');

test('frontend game state preserves task center payload from API response', () => {
  const normalized = FrontendGameState.normalizeGameState({
    gameState: {
      currentEra: 3,
      resources: { food: 10 },
    },
    guideTasks: { visible: true, tasks: [{ id: 'barracks_supplies' }] },
    taskCenter: {
      visible: true,
      activeTab: 'main',
      summary: { claimableCount: 1 },
      categories: { main: { tasks: [{ id: 'barracks_supplies' }] } },
    },
  });

  assert.equal(normalized.taskCenter.visible, true);
  assert.equal(normalized.taskCenter.summary.claimableCount, 1);
  assert.equal(normalized.taskCenter.categories.main.tasks[0].id, 'barracks_supplies');
});
