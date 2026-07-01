const test = require('node:test');
const assert = require('node:assert/strict');

const TerritoryUiStateStore = require('./TerritoryUiStateStore');

test('TerritoryUiStateStore aliases shell and controller to the mounted game owner', () => {
  const game = {
    territoryUiState: {
      selectedSiteId: 'capital',
      worldPanX: 12,
    },
    territoryController: {
      uiState: { selectedSiteId: 'stale-controller' },
    },
  };
  const shell = {
    lastGame: game,
    territoryUiState: { selectedSiteId: 'stale-shell' },
  };
  game.canvasShell = shell;

  const uiState = TerritoryUiStateStore.ensure(shell);

  assert.equal(uiState, game.territoryUiState);
  assert.equal(shell.territoryUiState, uiState);
  assert.equal(game.territoryController.uiState, uiState);
  assert.equal(uiState.selectedSiteId, 'capital');
  assert.equal(uiState.worldPanX, 12);
  assert.equal(uiState.worldMarchTarget, null);
});

test('TerritoryUiStateStore patch writes the single owner object in place', () => {
  const game = { territoryUiState: TerritoryUiStateStore.createInitialState() };
  const shell = { lastGame: game };
  game.canvasShell = shell;
  const before = TerritoryUiStateStore.ensure(shell);

  const after = TerritoryUiStateStore.patch(shell, {
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1' },
    selectedWorldActorId: '',
  });

  assert.equal(after, before);
  assert.equal(game.territoryUiState, before);
  assert.equal(shell.territoryUiState, before);
  assert.deepEqual(before.worldMarchTarget, { q: 2, r: -1, tileId: 'tile_2_-1' });
});

test('TerritoryUiStateStore clearWorldSelection keeps scope clearing explicit', () => {
  const host = {
    territoryUiState: {
      selectedSiteId: 'capital',
      worldMarchTarget: { q: 1, r: 0 },
      selectedWorldActorId: 'actor-1',
      selectedWorldMissionId: 'mission-1',
      expeditionConfigSiteId: 'capital',
      expeditionSoldiers: '200',
    },
  };

  TerritoryUiStateStore.clearWorldSelection(host, { clearWorldMarchTarget: false });

  assert.equal(host.territoryUiState.selectedSiteId, '');
  assert.deepEqual(host.territoryUiState.worldMarchTarget, { q: 1, r: 0 });
  assert.equal(host.territoryUiState.selectedWorldActorId, 'actor-1');
  assert.equal(host.territoryUiState.expeditionConfigSiteId, '');
});
