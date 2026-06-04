const test = require('node:test');
const assert = require('node:assert/strict');

const registerGameRoutes = require('../routes/gameRoutes');
const TutorialService = require('../services/TutorialService');

function createAppHarness() {
  const routes = [];
  const app = {
    get(path, ...handlers) {
      routes.push({ method: 'GET', path, handlers });
    },
    post(path, ...handlers) {
      routes.push({ method: 'POST', path, handlers });
    },
  };
  return { app, routes };
}

function createResponse() {
  return {
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
}

test('game action route persists tutorial returned by action handlers', () => {
  const { app, routes } = createAppHarness();
  const initialTutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.eraAdvancedTo1,
  );
  const gameState = {
    playerId: 'route-tutorial-test',
    tutorial: initialTutorial,
    currentEra: 0,
  };
  const savedStates = [];
  const repository = {
    findByPlayerId(playerId) {
      assert.equal(playerId, 'route-tutorial-test');
      return gameState;
    },
    save(state) {
      savedStates.push(JSON.parse(JSON.stringify(state)));
    },
  };
  const gameStateService = {
    applyOnlineProgress(state) {
      return state;
    },
    getClientGameState(state) {
      return { playerId: state.playerId };
    },
    calculateEraProgress() {
      return { canAdvance: false, conditions: [] };
    },
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');
  const req = {
    playerId: 'route-tutorial-test',
    body: { action: 'tutorialAdvance', step: TutorialService.TUTORIAL_STEPS.buildingsTabOpened },
  };
  const res = createResponse();

  route.handlers[0](req, res, () => route.handlers[1](req, res));

  assert.equal(res.statusCode, 200);
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0].tutorial.currentStep, TutorialService.TUTORIAL_STEPS.buildingsTabOpened);
  assert.equal(res.payload.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.buildingsTabOpened);
});
