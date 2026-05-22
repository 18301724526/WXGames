const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const TerritoryController = require('../js/controllers/TerritoryController');

test('world site action from adapter opens the matching detail dialog', () => {
  let boundHandlers = null;
  let renderCount = 0;
  const controller = new TerritoryController({
    actionAdapter: {
      bind(handlers) {
        boundHandlers = handlers;
      },
    },
    onRenderRequested: () => { renderCount += 1; },
  });

  controller.bind();
  boundHandlers.onOpenSite('site-east');

  assert.equal(controller.getUiState().selectedSiteId, 'site-east');
  assert.equal(renderCount, 1);
});

test('world reset recenters the radar pan through adapter', () => {
  const panWrites = [];
  const controller = new TerritoryController({
    uiState: { worldPanX: 80, worldPanY: -30 },
    actionAdapter: {
      setWorldPan(x, y) {
        panWrites.push([x, y]);
      },
    },
  });

  controller.resetWorldPan();

  assert.equal(controller.getUiState().worldPanX, 0);
  assert.equal(controller.getUiState().worldPanY, 0);
  assert.deepEqual(panWrites, [[0, 0]]);
});

test('world site dialog close clears the persisted selected site', () => {
  let renderCount = 0;
  const controller = new TerritoryController({
    uiState: { selectedSiteId: 'site-east', expeditionConfigSiteId: 'site-east', expeditionSoldiers: '4' },
    onRenderRequested: () => { renderCount += 1; },
  });

  controller.closeSiteDialog();

  assert.equal(controller.getUiState().selectedSiteId, '');
  assert.equal(controller.getUiState().expeditionConfigSiteId, '');
  assert.equal(renderCount, 1);
});

test('territory controller delegates loading state and submits scout actions', async () => {
  const loadingStates = [];
  let scouted = null;
  let applied = null;
  const controller = new TerritoryController({
    actionAdapter: {
      setLoading(button, isLoading) {
        loadingStates.push([button.id, isLoading]);
      },
    },
    api: {
      async scoutTerritory(direction) {
        scouted = direction;
        return { message: '侦察队已出发' };
      },
    },
    onStateApplied(result) {
      applied = result;
    },
  });

  await controller.handleScoutAction({ direction: 'n', button: { id: 'btnNorth' } });

  assert.equal(scouted, 'n');
  assert.equal(applied.message, '侦察队已出发');
  assert.deepEqual(loadingStates, [['btnNorth', true], ['btnNorth', false]]);
});

test('territory controller receives expedition draft changes as plain data', () => {
  const controller = new TerritoryController({
    uiState: { selectedSiteId: 'site-east', expeditionConfigSiteId: 'site-east' },
    getState: () => ({
      territoryState: {
        territories: [{ id: 'site-east', recommendedSoldiers: 3 }],
      },
    }),
  });

  controller.handleDraftInput({ field: 'soldiers', value: '5' });

  assert.equal(controller.getUiState().expeditionSoldiers, '5');
});

test('shared canvas action controller maps scout actions to distinct controller payloads', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');
  const controllerJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasActionController.js'), 'utf8');

  assert.match(controllerJs, /handle_scoutTerritory\(action\) \{[\s\S]*direction: action\.direction \|\| action\.value[\s\S]*handle_claimScout\(action\) \{[\s\S]*missionId: action\.missionId \|\| action\.value/);
  assert.doesNotMatch(appJs, /scoutTerritory|claimScout/);
  assert.doesNotMatch(appJs, /if \(action\?\.type === 'scoutTerritory' \|\| action\?\.type === 'claimScout'\) \{[\s\S]*direction: action\.direction \|\| action\.value,[\s\S]*missionId: action\.missionId \|\| action\.value,/);
});

test('world radar drag accepts canvas x/y pointers and updates pan', () => {
  const TerritoryController = require('../js/controllers/TerritoryController');
  const renders = [];
  const pans = [];
  const controller = new TerritoryController({
    api: {},
    onRenderRequested: () => renders.push('render'),
    actionAdapter: {
      setWorldPan: (x, y) => pans.push({ x, y }),
    },
  });

  controller.startWorldDrag({ pointerId: 5, x: 100, y: 120 });
  controller.moveWorldDrag({ pointerId: 5, x: 132, y: 86 });
  controller.endWorldDrag({ pointerId: 5, x: 132, y: 86 });

  assert.deepEqual(controller.getWorldPan(), { x: 32, y: -34 });
  assert.deepEqual(pans.at(-1), { x: 32, y: -34 });
  assert.equal(renders.length, 0);
});

test('rename city action delegates to injected naming handler', async () => {
  const requests = [];
  const apiCalls = [];
  const controller = new TerritoryController({
    api: {
      async renameCity(territoryId, name) {
        apiCalls.push({ territoryId, name });
      },
    },
    getState: () => ({
      territoryState: {
        territories: [{ id: 'site-east', cityName: '河湾城', naturalName: '东岸' }],
      },
    }),
    onCityRenameRequested(prompt) {
      requests.push(prompt);
      return null;
    },
  });

  await controller.handleAction({ action: 'rename-city', territoryId: 'site-east' });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].type, 'city');
  assert.equal(requests[0].territoryId, 'site-east');
  assert.equal(requests[0].currentName, '河湾城');
  assert.deepEqual(apiCalls, []);
});

test('territory controller does not depend on browser prompt', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'controllers', 'TerritoryController.js'), 'utf8');

  assert.doesNotMatch(source, /global\.prompt|\.prompt\(|\bprompt\(/);
});
