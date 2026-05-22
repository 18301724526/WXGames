const test = require('node:test');
const assert = require('node:assert/strict');

const registerGameRoutes = require('../routes/gameRoutes');
const TaskCenterService = require('../services/TaskCenterService');
const gameStateService = require('../services/GameStateService');

function completeTutorial(state) {
  state.tutorial.completed = true;
  state.tutorial.currentStep = 15;
  state.tutorial.phaseCompleted = { newbie: true, era2: true };
}

function createBarracksTaskState(playerId = 'task-center-player') {
  const state = gameStateService.createInitialGameState(playerId);
  completeTutorial(state);
  state.currentEra = 3;
  state.resources.food = 100;
  state.resources.knowledge = 20;
  return gameStateService.normalizeState(state);
}

function createRouteHarness(state) {
  const routes = {};
  const app = {
    get(path, ...handlers) {
      routes[`GET ${path}`] = handlers;
    },
    post(path, ...handlers) {
      routes[`POST ${path}`] = handlers;
    },
  };
  const repository = {
    savedState: null,
    findByPlayerId(playerId) {
      assert.equal(playerId, state.playerId);
      return state;
    },
    touchPlayerActiveAt(playerId) {
      assert.equal(playerId, state.playerId);
    },
    save(nextState) {
      this.savedState = nextState;
    },
  };
  registerGameRoutes(app, {
    authMiddleware(req, res, next) {
      req.playerId = state.playerId;
      next();
    },
    repository,
    gameStateService,
  });
  return { routes, repository };
}

async function callRoute(handlers, req = {}) {
  const response = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let index = 0;
  const next = () => {
    index += 1;
    const handler = handlers[index];
    if (handler) handler(req, response, next);
  };
  handlers[0](req, response, next);
  return response;
}

test('task center wraps current guide task into four task categories', () => {
  const state = createBarracksTaskState();
  const taskCenter = TaskCenterService.getTaskCenter(state);

  assert.equal(taskCenter.visible, true);
  assert.deepEqual(taskCenter.tabs.map((tab) => tab.id), ['daily', 'main', 'season', 'challenge']);
  assert.equal(taskCenter.tabs.find((tab) => tab.id === 'main').badge, 1);
  assert.equal(taskCenter.summary.claimableCount, 1);
  assert.equal(taskCenter.categories.daily.emptyText, '暂无每日任务');
  assert.equal(taskCenter.categories.main.tasks[0].id, 'barracks_supplies');
  assert.equal(taskCenter.categories.main.tasks[0].category, 'main');
  assert.equal(taskCenter.categories.main.tasks[0].action.type, 'claimTaskReward');
});

test('task center claim delegates main task reward and keeps reward reveal', () => {
  const state = createBarracksTaskState('task-center-claim');
  const result = TaskCenterService.claimTask(state, 'barracks_supplies', 'main');

  assert.equal(result.success, true);
  assert.equal(result.taskId, 'barracks_supplies');
  assert.deepEqual(result.reward.resources, { food: 260, knowledge: 80 });
  assert.equal(result.rewardReveal.rewardText, '食物 +260 / 知识 +80');
  assert.equal(state.resources.food, 360);
  assert.equal(state.resources.knowledge, 100);
});

test('main task center keeps completed tasks visible after they are done', () => {
  const state = createBarracksTaskState('task-center-history');
  const claim = TaskCenterService.claimTask(state, 'barracks_supplies', 'main');
  assert.equal(claim.success, true);

  state.buildings.barracks = { level: 1 };
  state.resources.food = 700;
  state.resources.wood = 120;
  state.resources.knowledge = 80;
  gameStateService.normalizeState(state);

  const taskCenter = TaskCenterService.getTaskCenter(state);
  const mainTasks = taskCenter.categories.main.tasks;
  const completed = mainTasks.find((task) => task.id === 'barracks_supplies');
  const current = mainTasks.find((task) => task.id === 'border_advance_supplies');

  assert.ok(completed);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.actionLabel, '已完成');
  assert.equal(completed.action, null);
  assert.ok(current);
  assert.equal(current.status, 'claimable');
  assert.equal(mainTasks.indexOf(current) < mainTasks.indexOf(completed), true);
  assert.equal(taskCenter.tabs.find((tab) => tab.id === 'main').count, mainTasks.length);
});

test('game task routes expose task center and claim endpoint snapshots', async () => {
  const state = createBarracksTaskState('task-center-route');
  const { routes, repository } = createRouteHarness(state);

  const getResponse = await callRoute(routes['GET /api/game/tasks'], {
    playerId: state.playerId,
    query: {},
  });
  assert.equal(getResponse.statusCode, 200);
  assert.equal(getResponse.payload.taskCenter.categories.main.tasks[0].id, 'barracks_supplies');

  const claimResponse = await callRoute(routes['POST /api/game/tasks/claim'], {
    playerId: state.playerId,
    body: { taskId: 'barracks_supplies', category: 'main' },
  });
  assert.equal(claimResponse.statusCode, 200);
  assert.equal(claimResponse.payload.success, true);
  assert.equal(claimResponse.payload.rewardReveal.title, '获得奖励');
  assert.equal(claimResponse.payload.taskCenter.categories.main.tasks[0].status, 'active');
  assert.ok(repository.savedState);
});
