const test = require('node:test');
const assert = require('node:assert/strict');

const TaskCenterAssembler = require('../services/taskCenter/TaskCenterAssembler');

// Claimable rows must render at the top of the task panel so the user can reach
// the next actionable reward without scrolling past unfinished tasks.

test('claimable tasks surface first, completed sink, definition order holds within bands', () => {
  const definitions = {
    tasks: [
      {
        id: 't-completed',
        category: 'main',
        title: 'done',
        condition: { type: 'always' },
        sortOrder: 1,
      },
      {
        id: 't-active',
        category: 'main',
        title: 'later',
        condition: { type: 'eraAtLeast', era: 9 },
        sortOrder: 2,
      },
      {
        id: 't-claim-a',
        category: 'main',
        title: 'claim me',
        condition: { type: 'always' },
        sortOrder: 3,
      },
      {
        id: 't-claim-b',
        category: 'main',
        title: 'claim me too',
        condition: { type: 'always' },
        sortOrder: 4,
      },
    ],
  };
  const gameState = {
    currentEra: 0,
    taskProgress: { claimed: { 't-completed': { claimedAt: 1 } } },
  };

  const categories = TaskCenterAssembler.buildCategories(gameState, definitions);
  const main = categories.main.tasks;
  assert.deepEqual(
    main.map((task) => `${task.id}:${task.status}`),
    ['t-claim-a:claimable', 't-claim-b:claimable', 't-active:active', 't-completed:completed'],
  );
});
