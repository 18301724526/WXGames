const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const UIStatePresenter = require('./UIStatePresenter');
const BuildingPresenter = require('./presenters/BuildingPresenter');
const CivilizationPresenter = require('./presenters/CivilizationPresenter');
const EventPresenter = require('./presenters/EventPresenter');
const FamousPersonPresenter = require('./presenters/FamousPersonPresenter');
const HomePresenter = require('./presenters/HomePresenter');
const MilitaryPresenter = require('./presenters/MilitaryPresenter');
const TalentPolicyPresenter = require('./presenters/TalentPolicyPresenter');
const TaskGuidePresenter = require('./presenters/TaskGuidePresenter');
const WorldSitePresenter = require('./presenters/WorldSitePresenter');
require('../config/LocaleTextRegistry');
const LocaleText = require('../ecs/resource/LocaleText');
const BattleScenePresenter = require('./presenters/BattleScenePresenter');
const WorldTileMapPresenter = require('./presenters/WorldTileMapPresenter');
const ShellPresenter = require('./presenters/ShellPresenter');

test('UIStatePresenter delegates shell view state while preserving facade contracts', () => {
  assert.equal(UIStatePresenter.toNumber('12.5'), ShellPresenter.toNumber('12.5'));
  assert.equal(UIStatePresenter.toInteger('12.9'), ShellPresenter.toInteger('12.9'));
  assert.equal(UIStatePresenter.trimDecimal('4.0'), ShellPresenter.trimDecimal('4.0'));
  assert.equal(UIStatePresenter.formatCompactNumber(15320), ShellPresenter.formatCompactNumber(15320));
  assert.equal(UIStatePresenter.formatResourceAmount(999.8), ShellPresenter.formatResourceAmount(999.8));
  assert.equal(UIStatePresenter.formatRate(0.335), ShellPresenter.formatRate(0.335));
  assert.equal(UIStatePresenter.formatNegativeRate(0.335), ShellPresenter.formatNegativeRate(0.335));
  assert.equal(UIStatePresenter.toDisplayPopulation(7), ShellPresenter.toDisplayPopulation(7));

  const credentials = {
    username: 'fallback-user',
    rememberEnabled: true,
    rememberedUsername: 'saved-user',
    rememberedPassword: 'saved-password',
  };
  assert.deepEqual(UIStatePresenter.buildAuthCredentialViewState(credentials), ShellPresenter.buildAuthCredentialViewState(credentials));
  assert.equal(UIStatePresenter.buildAuthCredentialViewState(credentials).passwordValue, '');
  assert.deepEqual(UIStatePresenter.buildAuthShellViewState({ authenticated: false, message: 'login required' }), ShellPresenter.buildAuthShellViewState({ authenticated: false, message: 'login required' }));

  const shellState = {
    currentTab: 'territory',
    militaryView: 'world',
    territoryState: {
      worldMap: { tiles: [{ id: 'tile_0_0', q: 0, r: 0 }] },
      polity: { name: 'Test Polity' },
      occupiedCount: 2,
      discoveredCount: 5,
    },
  };
  assert.deepEqual(UIStatePresenter.buildTabNavigationViewState(shellState, { requestedTab: 'territory' }), ShellPresenter.buildTabNavigationViewState(shellState, { requestedTab: 'territory' }));
  assert.equal(UIStatePresenter.hasWorldTileMap(shellState), true);
  assert.equal(UIStatePresenter.canUseMapHome(shellState), ShellPresenter.canUseMapHome(shellState));
  assert.deepEqual(UIStatePresenter.resolveMapHomeViewState(shellState, { requestedTab: 'military', militaryView: 'world' }), ShellPresenter.resolveMapHomeViewState(shellState, { requestedTab: 'military', militaryView: 'world' }));
  assert.deepEqual(
    UIStatePresenter.buildTabLockViewState([{ id: 'resources' }, { tabId: 'events' }], (id) => id !== 'events'),
    ShellPresenter.buildTabLockViewState([{ id: 'resources' }, { tabId: 'events' }], (id) => id !== 'events'),
  );

  const guide = { message: 'Go scout', target: 'scout-action-first' };
  assert.deepEqual(UIStatePresenter.buildAdvisorViewState(guide), ShellPresenter.buildAdvisorViewState(guide));
  assert.equal(UIStatePresenter.getAdvisorTargetTab('tab-events'), ShellPresenter.getAdvisorTargetTab('tab-events'));
  const namingPrompt = { type: 'city', territoryId: 'city-1', title: 'Name City', message: 'Choose a city name' };
  assert.deepEqual(UIStatePresenter.buildNamingPromptViewState(namingPrompt), ShellPresenter.buildNamingPromptViewState(namingPrompt));
  assert.deepEqual(UIStatePresenter.buildRecentLogViewState(['started', { text: 'finished' }]), ShellPresenter.buildRecentLogViewState(['started', { text: 'finished' }]));
  const requestLogs = [{ timestamp: '10:00', method: 'POST', path: '/api/test', statusCode: 500, duration: 12.8 }];
  assert.deepEqual(UIStatePresenter.buildRequestLogViewState(requestLogs), ShellPresenter.buildRequestLogViewState(requestLogs));
  assert.deepEqual(UIStatePresenter.buildTerritorySummaryViewState(shellState.territoryState), ShellPresenter.buildTerritorySummaryViewState(shellState.territoryState));
});

test('UIStatePresenter delegates world tile map view state while preserving facade contracts', () => {
  const territoryState = {
    worldMap: {
      version: 1,
      seed: 'presenter-explorer-seed',
      tiles: [
        {
          id: 'tile_0_0',
          q: 0,
          r: 0,
          terrain: 'capital',
          visibility: 'controlled',
          siteId: 'capital',
        },
        {
          id: 'tile_-1_0',
          q: -1,
          r: 0,
          terrain: 'mountain',
          visibility: 'scouted',
          intel: { level: 1, knownTerrain: true, knownSite: false },
        },
        {
          id: 'tile_-2_0',
          q: -2,
          r: 0,
          terrain: 'mountain',
          visibility: 'scouted',
        },
        {
          id: 'tile_0_1',
          q: 0,
          r: 1,
          terrain: 'ocean',
          oceanTemplates: ['nw', 'river-mouth-ne'],
          visibility: 'scouted',
        },
      ],
    },
    territories: [{
      id: 'capital',
      x: 0,
      y: 0,
      type: 'city',
      owner: 'player',
      status: 'occupied',
      cityName: 'Capital',
    }],
  };
  const options = {
    panX: 12.5,
    panY: -4,
    epochNowMs: new Date('2026-06-06T00:00:15.000Z').getTime(),
    worldExplorerState: {
      missions: [{
        id: 'explore-1',
        status: 'ready',
        route: [
          { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: true },
        ],
        plannedTiles: [
          { id: 'tile_1_0', q: 1, r: 0, terrain: 'plains', visibility: 'scouted' },
        ],
        plannedSites: [{
          tileId: 'tile_1_0',
          q: 1,
          r: 0,
          siteId: 'site_1_0',
          materialized: true,
          site: {
            id: 'site_1_0',
            x: 1,
            y: 0,
            naturalName: 'Empty City',
            type: 'town',
            owner: 'neutral',
            status: 'discovered',
            art: 'assets/art/world-site-town-cutout.png',
          },
        }],
        revealedTileIds: ['tile_1_0'],
      }],
      activeMission: {
        id: 'explore-1',
        status: 'active',
        mode: 'manual',
        startedAt: '2026-06-06T00:00:00.000Z',
        completesAt: '2026-06-06T00:00:20.000Z',
        stepDurationSeconds: 10,
        route: [
          { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false },
          { q: 2, r: 0, step: 2, tileId: 'tile_2_0', revealed: false },
        ],
        plannedTiles: [
          { id: 'tile_1_0', q: 1, r: 0, terrain: 'plains', visibility: 'scouted' },
          { id: 'tile_2_0', q: 2, r: 0, terrain: 'forest', visibility: 'scouted' },
        ],
        revealedTileIds: [],
      },
    },
  };

  const view = UIStatePresenter.buildWorldTileMapViewState(territoryState, options);
  const direct = WorldTileMapPresenter.buildWorldTileMapViewState(territoryState, options);

  assert.deepEqual(view, direct);
  assert.equal(view.tiles.some((tile) => tile.id === 'tile_1_0' && tile.terrain === 'plains'), true);
  assert.equal(view.tiles.some((tile) => tile.id === 'tile_2_0' && tile.terrain === 'forest' && tile.renderOnly), true);
  assert.equal(view.pan.x, 12.5);
  assert.equal(view.pan.y, -4);
  assert.equal(view.sites[0].id, 'capital');
  assert.equal(view.sites.some((site) => site.id === 'site_1_0' && site.owner === 'neutral'), true);
  assert.equal(view.tiles.some((tile) => tile.id === 'tile_1_0' && tile.site?.id === 'site_1_0'), true);
  assert.equal(view.tiles.find((tile) => tile.id === 'tile_0_1').templateAssets.length, 2);
  assert.equal(view.tiles.find((tile) => tile.id === 'tile_-1_0').mountainNeighbors, 1);
  assert.equal(view.activeScouts.length, 1);
  assert.equal(view.activeScouts.some((mission) => mission.kind === 'worldExplore'), true);
  assert.equal(view.activeScouts.find((mission) => mission.kind === 'worldExplore').route.length, 2);
  assert.equal(typeof UIStatePresenter.getTileMapManifest().getTerrainAsset, 'function');
  assert.equal(typeof UIStatePresenter.getTileMapGeometry().sortTilesForIsoDraw, 'function');
  assert.deepEqual(UIStatePresenter.normalizeWorldTile({ q: 3, r: -1, terrain: 'forest' }).feature.key, 'treeCluster');
  assert.deepEqual(UIStatePresenter.getWorldExplorerMissions(options.worldExplorerState).map((mission) => mission.id), ['explore-1']);
  assert.equal(UIStatePresenter.getWorldExplorerPlannedTiles(options.worldExplorerState, options).length, 2);
  assert.equal(UIStatePresenter.getWorldExplorerPlannedSites(options.worldExplorerState, options).length, 1);
  assert.equal(UIStatePresenter.getWorldTileMapSignature(territoryState, options.worldExplorerState, options), WorldTileMapPresenter.getWorldTileMapSignature(territoryState, options.worldExplorerState, options));
});

test('UIStatePresenter world tile map signature changes when world origin changes', () => {
  const createTerritoryState = (origin) => ({
    worldMap: {
      version: 1,
      seed: 'seed',
      origin,
      tiles: [{ id: `tile_${origin.q}_${origin.r}`, q: origin.q, r: origin.r, terrain: 'capital', siteId: 'capital' }],
    },
    territories: [{ id: 'capital', x: origin.q, y: origin.r, type: 'capital', owner: 'player' }],
  });

  const first = UIStatePresenter.getWorldTileMapSignature(createTerritoryState({ q: 0, r: 0 }), {}, {});
  const second = UIStatePresenter.getWorldTileMapSignature(createTerritoryState({ q: 18, r: -4 }), {}, {});

  assert.notEqual(first, second);
  assert.ok(second.includes('"origin":{"q":18,"r":-4,"tileId":"tile_18_-4"}'));
});

test('UIStatePresenter renders the current march target tile ahead of confirmed reveal', () => {
  const territoryState = {
    worldMap: {
      version: 1,
      seed: 'seed',
      tiles: [{ id: 'tile_0_0', q: 0, r: 0, terrain: 'plains', visibility: 'controlled' }],
    },
    territories: [],
  };
  const worldExplorerState = {
    activeMission: {
      id: 'manual-render-ahead',
      status: 'active',
      mode: 'manual',
      origin: { q: 0, r: 0, tileId: 'tile_0_0' },
      position: { q: 0, r: 0, tileId: 'tile_0_0' },
      target: { q: 2, r: 0, tileId: 'tile_2_0' },
      startedAt: '2026-06-06T00:00:00.000Z',
      nextStepAt: '2026-06-06T00:00:10.000Z',
      completesAt: '2026-06-06T00:00:20.000Z',
      stepDurationSeconds: 10,
      route: [
        { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false },
        { q: 2, r: 0, step: 2, tileId: 'tile_2_0', revealed: false },
      ],
      plannedTiles: [
        { id: 'tile_1_0', q: 1, r: 0, terrain: 'forest', visibility: 'scouted' },
        { id: 'tile_2_0', q: 2, r: 0, terrain: 'hills', visibility: 'scouted' },
      ],
      plannedSites: [{
        tileId: 'tile_1_0',
        q: 1,
        r: 0,
        siteId: 'site_1_0',
        materialized: false,
        site: { id: 'site_1_0', x: 1, y: 0, type: 'town', owner: 'neutral', status: 'discovered' },
      }],
      revealedTileIds: [],
    },
  };

  const view = UIStatePresenter.buildWorldTileMapViewState(territoryState, {
    worldExplorerState,
    epochNowMs: new Date('2026-06-06T00:00:05.000Z').getTime(),
  });
  const renderAheadTile = view.tiles.find((tile) => tile.id === 'tile_1_0');

  assert.equal(renderAheadTile?.terrain, 'forest');
  assert.equal(renderAheadTile.renderOnly, true);
  assert.equal(view.tiles.some((tile) => tile.id === 'tile_2_0' && tile.renderOnly), true);
  assert.equal(view.sites.some((site) => site.id === 'site_1_0'), false);
  assert.deepEqual(view.activeScouts[0].revealedTileIds, []);
  assert.deepEqual(view.activeScouts[0].route.map((step) => step.revealed), [false, false]);
});

test('UIStatePresenter renders route footprint ahead without overwriting known tiles', () => {
  const territoryState = {
    worldMap: {
      version: 1,
      seed: 'seed',
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, terrain: 'capital', visibility: 'controlled' },
        { id: 'tile_0_-1', q: 0, r: -1, terrain: 'river', visibility: 'scouted', transitionKey: 'known-river-edge' },
      ],
    },
    territories: [],
  };
  const worldExplorerState = {
    activeMission: {
      id: 'manual-footprint-view',
      status: 'active',
      mode: 'manual',
      origin: { q: 0, r: 0, tileId: 'tile_0_0' },
      target: { q: 1, r: 0, tileId: 'tile_1_0' },
      startedAt: '2026-06-06T00:00:00.000Z',
      nextStepAt: '2026-06-06T00:00:10.000Z',
      completesAt: '2026-06-06T00:00:10.000Z',
      stepDurationSeconds: 10,
      route: [
        { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false },
      ],
      plannedTiles: [
        { id: 'tile_1_0', q: 1, r: 0, terrain: 'forest', visibility: 'scouted' },
        { id: 'tile_0_-1', q: 0, r: -1, terrain: 'plains', transitionKey: 'planned-edge' },
        { id: 'tile_0_1', q: 0, r: 1, terrain: 'plains' },
        { id: 'tile_1_-1', q: 1, r: -1, terrain: 'hills' },
        { id: 'tile_1_1', q: 1, r: 1, terrain: 'plains' },
        { id: 'tile_2_-1', q: 2, r: -1, terrain: 'plains' },
        { id: 'tile_2_0', q: 2, r: 0, terrain: 'waste' },
        { id: 'tile_2_1', q: 2, r: 1, terrain: 'plains' },
      ],
      plannedSites: [],
      revealedTileIds: [],
    },
  };

  const view = UIStatePresenter.buildWorldTileMapViewState(territoryState, {
    worldExplorerState,
    epochNowMs: new Date('2026-06-06T00:00:05.000Z').getTime(),
  });
  const tileById = new Map(view.tiles.map((tile) => [tile.id, tile]));

  assert.equal(tileById.get('tile_1_0')?.renderOnly, true);
  assert.equal(tileById.get('tile_0_1')?.renderOnly, true);
  assert.equal(tileById.get('tile_2_1')?.renderOnly, true);
  assert.equal(tileById.get('tile_0_-1')?.terrain, 'river');
  assert.equal(tileById.get('tile_0_-1')?.transitionKey, 'known-river-edge');
  assert.equal(tileById.get('tile_0_-1')?.renderReady, true);
  assert.equal(tileById.get('tile_0_-1')?.renderOnly, false);
});

test('UIStatePresenter keeps known world tile authority when planned tiles overlap', () => {
  const territoryState = {
    worldMap: {
      version: 1,
      seed: 'seed',
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, terrain: 'capital', visibility: 'controlled' },
        {
          id: 'tile_1_0',
          q: 1,
          r: 0,
          terrain: 'ocean',
          visibility: 'visible',
          discoveredAt: '2026-06-01T00:00:00.000Z',
          lastScoutedAt: '2026-06-02T00:00:00.000Z',
          oceanTemplates: ['nw', 'river-mouth-ne'],
          riverPorts: ['ne'],
          transitionKey: 'known-transition',
          siteId: 'known_site_1_0',
          intel: {
            level: 3,
            knownTerrain: true,
            knownSite: true,
            knownOwner: true,
            knownGarrison: true,
          },
        },
      ],
    },
    territories: [{
      id: 'known_site_1_0',
      x: 1,
      y: 0,
      type: 'town',
      owner: 'player',
      status: 'occupied',
      cityName: 'Known Harbor',
    }],
  };
  const worldExplorerState = {
    activeMission: {
      id: 'planned-over-known',
      status: 'active',
      mode: 'manual',
      origin: { q: 0, r: 0, tileId: 'tile_0_0' },
      position: { q: 0, r: 0, tileId: 'tile_0_0' },
      target: { q: 1, r: 0, tileId: 'tile_1_0' },
      startedAt: '2026-06-06T00:00:00.000Z',
      nextStepAt: '2026-06-06T00:00:10.000Z',
      completesAt: '2026-06-06T00:00:10.000Z',
      stepDurationSeconds: 10,
      route: [
        { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false },
      ],
      plannedTiles: [
        {
          id: 'tile_1_0',
          q: 1,
          r: 0,
          terrain: 'forest',
          visibility: 'controlled',
          oceanTemplates: ['full'],
          riverPorts: ['sw'],
          transitionKey: 'planned-transition',
          siteId: 'planned_site_1_0',
          intel: { level: 0, knownTerrain: false, knownSite: false, knownOwner: false },
          renderOnly: true,
        },
      ],
      plannedSites: [{
        tileId: 'tile_1_0',
        q: 1,
        r: 0,
        siteId: 'planned_site_1_0',
        materialized: true,
        site: { id: 'planned_site_1_0', q: 1, r: 0, type: 'ruins', owner: 'neutral', status: 'discovered' },
      }],
      revealedTileIds: [],
    },
  };

  const view = UIStatePresenter.buildWorldTileMapViewState(territoryState, {
    worldExplorerState,
    epochNowMs: new Date('2026-06-06T00:00:05.000Z').getTime(),
  });
  const knownTile = view.tiles.find((tile) => tile.id === 'tile_1_0');

  assert.equal(knownTile?.terrain, 'ocean');
  assert.equal(knownTile.visibility, 'visible');
  assert.deepEqual(knownTile.oceanTemplates, ['nw', 'river-mouth-ne']);
  assert.deepEqual(knownTile.riverPorts, ['ne']);
  assert.equal(knownTile.transitionKey, 'known-transition');
  assert.equal(knownTile.siteId, 'known_site_1_0');
  assert.equal(knownTile.site.owner, 'player');
  assert.deepEqual(knownTile.intel, {
    level: 3,
    knownTerrain: true,
    knownSite: true,
    knownOwner: true,
    knownGarrison: true,
    knownLeader: false,
    knownSkill: false,
  });
  assert.equal(knownTile.renderReady, true);
  assert.equal(knownTile.renderOnly, false);
  assert.equal(view.sites.some((site) => site.id === 'planned_site_1_0'), false);
});

test('UIStatePresenter does not let render-only planned neighbors change known tile render metadata', () => {
  const territoryState = {
    worldMap: {
      version: 1,
      seed: 'known-neighbor-seed',
      tiles: [
        { id: 'tile_5_5', q: 5, r: 5, terrain: 'mountain', visibility: 'scouted' },
        { id: 'tile_4_5', q: 4, r: 5, terrain: 'mountain', visibility: 'scouted' },
      ],
    },
    territories: [],
  };
  const worldExplorerState = {
    activeMission: {
      id: 'planned-neighbor-over-known',
      status: 'active',
      mode: 'manual',
      origin: { q: 5, r: 5, tileId: 'tile_5_5' },
      position: { q: 5, r: 5, tileId: 'tile_5_5' },
      target: { q: 6, r: 5, tileId: 'tile_6_5' },
      startedAt: '2026-06-06T00:00:00.000Z',
      nextStepAt: '2026-06-06T00:00:10.000Z',
      completesAt: '2026-06-06T00:00:10.000Z',
      stepDurationSeconds: 10,
      route: [
        { q: 6, r: 5, step: 1, tileId: 'tile_6_5', revealed: false },
      ],
      plannedTiles: [
        { id: 'tile_6_5', q: 6, r: 5, terrain: 'mountain', visibility: 'scouted' },
      ],
      plannedSites: [],
      revealedTileIds: [],
    },
  };

  const view = UIStatePresenter.buildWorldTileMapViewState(territoryState, {
    worldExplorerState,
    epochNowMs: new Date('2026-06-06T00:00:05.000Z').getTime(),
  });
  const knownTile = view.tiles.find((tile) => tile.id === 'tile_5_5');
  const plannedTile = view.tiles.find((tile) => tile.id === 'tile_6_5');

  assert.equal(plannedTile?.renderOnly, true);
  assert.equal(knownTile?.mountainNeighbors, 1);
});

test('UIStatePresenter logs compact tile render diffs when a tile signature changes', () => {
  const previousLogger = globalThis.ClientOperationLog;
  const entries = [];
  globalThis.ClientOperationLog = {
    enabled: true,
    record(type, detail) {
      entries.push({ type, detail });
      return entries.at(-1);
    },
    recordSampled(type, key, detail) {
      entries.push({ type, key, detail });
      return entries.at(-1);
    },
  };
  WorldTileMapPresenter.resetTileRenderLogStateForTest();

  try {
    UIStatePresenter.buildWorldTileMapViewState({
      worldMap: {
        version: 1,
        seed: 'seed',
        tiles: [
          { id: 'tile_0_0', q: 0, r: 0, terrain: 'capital', visibility: 'controlled' },
          { id: 'tile_1_0', q: 1, r: 0, terrain: 'plains', visibility: 'scouted' },
        ],
      },
      territories: [],
    });
    UIStatePresenter.buildWorldTileMapViewState({
      worldMap: {
        version: 2,
        seed: 'seed',
        tiles: [
          { id: 'tile_0_0', q: 0, r: 0, terrain: 'capital', visibility: 'controlled' },
          { id: 'tile_1_0', q: 1, r: 0, terrain: 'forest', visibility: 'scouted' },
        ],
      },
      territories: [],
    });
  } finally {
    WorldTileMapPresenter.resetTileRenderLogStateForTest();
    globalThis.ClientOperationLog = previousLogger;
  }

  const diff = entries.find((entry) => entry.type === 'worldMap:tileRenderDiff');
  assert.equal(Boolean(diff), true);
  assert.equal(diff.detail.changedCount, 1);
  assert.equal(diff.detail.addedCount, 0);
  assert.equal(diff.detail.removedCount, 0);
  assert.equal(diff.detail.changed[0].tileId, 'tile_1_0');
  assert.equal(diff.detail.changed[0].before.includes('terrain=plains'), true);
  assert.equal(diff.detail.changed[0].after.includes('terrain=forest'), true);
  assert.equal(diff.detail.changed.length <= 16, true);
});

test('UIStatePresenter reveals manual world march planned tiles by server-confirmed state', () => {
  const territoryState = {
    worldMap: {
      version: 1,
      seed: 'seed',
      tiles: [{ id: 'tile_0_0', q: 0, r: 0, terrain: 'plains', visibility: 'scouted' }],
    },
    territories: [],
  };
  const worldExplorerState = {
    activeMission: {
      id: 'manual-1',
      status: 'active',
      mode: 'manual',
      origin: { q: 0, r: 0, tileId: 'tile_0_0' },
      target: { q: 2, r: 0, tileId: 'tile_2_0' },
      startedAt: '2026-06-06T00:00:00.000Z',
      completesAt: '2026-06-06T00:00:20.000Z',
      stepDurationSeconds: 10,
      route: [
        { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: true },
        { q: 2, r: 0, step: 2, tileId: 'tile_2_0', revealed: true },
      ],
      plannedTiles: [
        { id: 'tile_1_0', q: 1, r: 0, terrain: 'forest', visibility: 'scouted' },
        { id: 'tile_2_0', q: 2, r: 0, terrain: 'hills', visibility: 'scouted' },
      ],
      plannedSites: [{
        tileId: 'tile_2_0',
        q: 2,
        r: 0,
        siteId: 'site_2_0',
        materialized: false,
        site: { id: 'site_2_0', x: 2, y: 0, type: 'town', owner: 'neutral', status: 'discovered' },
      }],
      revealedTileIds: ['tile_1_0', 'tile_2_0'],
    },
  };
  const before = new Date('2026-06-06T00:00:05.000Z').getTime();
  const afterDone = new Date('2026-06-06T00:00:25.000Z').getTime();

  assert.deepEqual(UIStatePresenter.getWorldExplorerPlannedTiles(worldExplorerState, { epochNowMs: before }).map((tile) => tile.id), ['tile_1_0', 'tile_2_0']);
  assert.deepEqual(UIStatePresenter.getWorldExplorerPlannedTiles(worldExplorerState, { epochNowMs: afterDone }).map((tile) => tile.id), ['tile_1_0', 'tile_2_0']);

  const doneView = UIStatePresenter.buildWorldTileMapViewState(territoryState, {
    worldExplorerState,
    epochNowMs: afterDone,
  });
  assert.equal(doneView.tiles.some((tile) => tile.id === 'tile_2_0' && tile.terrain === 'hills'), true);
  assert.equal(doneView.sites.some((site) => site.id === 'site_2_0'), true);
  assert.equal(doneView.activeScouts.find((mission) => mission.id === 'manual-1').status, 'idle');
});

test('UIStatePresenter binds discovered territory sites back onto world tiles', () => {
  const territoryState = {
    worldMap: {
      version: 1,
      seed: 'site-bind-seed',
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, terrain: 'capital', siteId: 'capital', visibility: 'controlled' },
        { id: 'tile_2_2', q: 2, r: 2, terrain: 'plains', siteId: null, visibility: 'scouted' },
      ],
    },
    territories: [
      { id: 'capital', x: 0, y: 0, type: 'capital', owner: 'player', status: 'occupied', cityName: 'Capital' },
      {
        id: 'site_2_2',
        x: 2,
        y: 2,
        type: 'town',
        owner: 'neutral',
        status: 'discovered',
        naturalName: 'Clear Spring',
        art: 'assets/art/world-site-town-cutout.png',
      },
    ],
  };

  const view = UIStatePresenter.buildWorldTileMapViewState(territoryState, {
    worldExplorerState: {
      idleMissions: [{
        id: 'manual-1',
        status: 'idle',
        route: [
          { q: 1, r: 1, step: 1, tileId: 'tile_1_1', revealed: true },
          { q: 2, r: 2, step: 2, tileId: 'tile_2_2', revealed: true },
        ],
        plannedTiles: [
          { id: 'tile_1_1', q: 1, r: 1, terrain: 'plains' },
          { id: 'tile_2_2', q: 2, r: 2, terrain: 'plains', siteId: null },
        ],
        revealedTileIds: ['tile_1_1', 'tile_2_2'],
      }],
    },
  });
  const discoveredTile = view.tiles.find((tile) => tile.id === 'tile_2_2');

  assert.equal(discoveredTile.siteId, 'site_2_2');
  assert.equal(discoveredTile.site.id, 'site_2_2');
  assert.equal(view.sites.some((site) => site.id === 'site_2_2' && site.tileId === 'tile_2_2'), true);
});

test('UIStatePresenter canonicalizes stable x/y world tile ids before map view merge', () => {
  const territoryState = {
    worldMap: {
      version: 1,
      seed: 'stable-coordinate-seed',
      tiles: [
        { id: 'legacy-renderer-id', x: 2, y: -1, q: 99, r: 99, terrain: 'mountain', visibility: 'scouted' },
        { x: 3, y: -1, terrain: 'mountain', visibility: 'scouted' },
      ],
    },
    territories: [{
      id: 'site_2_-1',
      x: 2,
      y: -1,
      type: 'town',
      owner: 'neutral',
      status: 'discovered',
      naturalName: 'Stable Ford',
    }],
  };

  const view = UIStatePresenter.buildWorldTileMapViewState(territoryState);
  const tile = view.tiles.find((item) => item.id === 'tile_2_-1');

  assert.equal(tile?.q, 2);
  assert.equal(tile?.r, -1);
  assert.equal(tile?.siteId, 'site_2_-1');
  assert.equal(view.sites.some((site) => site.id === 'site_2_-1' && site.tileId === 'tile_2_-1'), true);
  assert.equal(view.tiles.some((item) => item.id === 'legacy-renderer-id'), false);
});

test('UIStatePresenter derives world-site view tile ids from normalized tile coordinates', () => {
  const territoryState = {
    worldMap: {
      version: 1,
      seed: 'site-coordinate-seed',
      tiles: [{
        id: 'legacy-site-tile-id',
        x: 5,
        y: -2,
        q: 77,
        r: 77,
        terrain: 'plains',
        visibility: 'scouted',
        siteId: 'site_5_-2',
      }],
    },
    territories: [{
      id: 'site_5_-2',
      x: 5,
      y: -2,
      tileId: 'legacy-site-id',
      type: 'town',
      owner: 'neutral',
      status: 'discovered',
      naturalName: 'Coordinate Gate',
    }],
  };

  const view = UIStatePresenter.buildWorldTileMapViewState(territoryState);

  assert.equal(view.tiles.some((tile) => tile.id === 'legacy-site-tile-id'), false);
  assert.equal(view.tiles.some((tile) => tile.id === 'tile_5_-2' && tile.siteId === 'site_5_-2'), true);
  assert.equal(view.sites.some((site) => site.id === 'site_5_-2' && site.tileId === 'tile_5_-2'), true);
  assert.equal(view.sites.some((site) => site.tileId === 'legacy-site-tile-id' || site.tileId === 'legacy-site-id'), false);
});

test('UIStatePresenter canonicalizes world tile-map signatures for stable x/y and legacy q/r shapes', () => {
  const stableShape = {
    worldMap: {
      version: 1,
      seed: 'signature-stable-seed',
      tiles: [
        { id: 'legacy-renderer-id', x: 2, y: -1, q: 99, r: 99, terrain: 'forest', siteId: 'site_2_-1' },
      ],
    },
    territories: [
      { id: 'site_2_-1', x: 2, y: -1, type: 'town', owner: 'neutral', status: 'discovered', cityName: 'Stable City' },
    ],
    scoutMissions: [{
      id: 'legacy-scout-stable',
      status: 'active',
      position: { x: 2, y: -1, tileId: 'legacy-position' },
      route: [{ x: 2, y: -1, step: 1, tileId: 'legacy-route', revealed: true }],
      revealArea: [{ x: 3, y: -1, step: 2, tileId: 'legacy-reveal', revealed: false }],
      revealedTileIds: ['tile_2_-1'],
      actionPointsRemaining: 1,
    }],
  };
  const legacyShape = {
    worldMap: {
      version: 1,
      seed: 'signature-stable-seed',
      tiles: [
        { q: 2, r: -1, terrain: 'forest', siteId: 'site_2_-1' },
      ],
    },
    territories: [
      { id: 'site_2_-1', q: 2, r: -1, type: 'town', owner: 'neutral', status: 'discovered', cityName: 'Stable City' },
    ],
    scoutMissions: [{
      id: 'legacy-scout-stable',
      status: 'active',
      position: { q: 2, r: -1 },
      route: [{ q: 2, r: -1, step: 1, revealed: true }],
      revealArea: [{ q: 3, r: -1, step: 2, revealed: false }],
      revealedTileIds: ['tile_2_-1'],
      actionPointsRemaining: 1,
    }],
  };
  const stableExplorer = {
    activeMission: {
      id: 'manual-signature',
      status: 'active',
      route: [{ x: 4, y: -2, step: 1, tileId: 'legacy-route', revealed: true }],
      plannedTiles: [{ id: 'legacy-planned-id', x: 4, y: -2, terrain: 'hills' }],
      plannedSites: [{
        tileId: 'legacy-planned-site',
        siteId: 'site_4_-2',
        materialized: true,
        site: { id: 'site_4_-2', x: 4, y: -2, type: 'town', owner: 'neutral', status: 'discovered' },
      }],
      revealedTileIds: ['tile_4_-2'],
    },
  };
  const legacyExplorer = {
    activeMission: {
      id: 'manual-signature',
      status: 'active',
      route: [{ q: 4, r: -2, step: 1, revealed: true }],
      plannedTiles: [{ q: 4, r: -2, terrain: 'hills' }],
      plannedSites: [{
        siteId: 'site_4_-2',
        materialized: true,
        site: { id: 'site_4_-2', q: 4, r: -2, type: 'town', owner: 'neutral', status: 'discovered' },
      }],
      revealedTileIds: ['tile_4_-2'],
    },
  };

  assert.equal(
    UIStatePresenter.getWorldTileMapSignature(stableShape, stableExplorer),
    UIStatePresenter.getWorldTileMapSignature(legacyShape, legacyExplorer),
  );
});

test('UIStatePresenter delegates famous person view state while preserving facade contracts', () => {
  const state = {
    famousPersons: {
      count: 2,
      maxCandidates: 3,
      seek: { available: true, count: 1, message: 'Ready' },
      people: [
        {
          id: 'hero-common',
          name: 'Common Hero',
          quality: 'common',
          level: 1,
          attributes: { command: 10, force: 10, intelligence: 10, politics: 10, charisma: 10, speed: 10 },
        },
        {
          id: 'hero-great',
          name: 'Great Hero',
          quality: 'great',
          level: 12,
          freeAttributePoints: 1,
          attributes: { command: 40, force: 33, intelligence: 54, politics: 24, charisma: 41, speed: 29 },
          abilityKit: {
            abilities: [{
              id: 'skill-1',
              name: 'Trail Sense',
              slot: 'scoutTrait',
              kind: 'civil',
              effects: [{ key: 'scoutReportBonusPct', value: 0.2 }],
            }],
          },
        },
      ],
      candidates: [{ id: 'candidate-1', name: 'Candidate', quality: 'good', attributes: {} }],
    },
  };

  const view = UIStatePresenter.buildFamousPersonViewState(state, { selectedPersonId: 'hero-great' });
  const direct = FamousPersonPresenter.buildFamousPersonViewState(state, { selectedPersonId: 'hero-great' });

  assert.deepEqual(view, direct);
  assert.equal(view.people[0].id, 'hero-great');
  assert.equal(view.selectedPerson.id, 'hero-great');
  assert.equal(view.selectedPerson.skillDetails[0].kindText, '探路特质');
  assert.equal(view.seek.action.visualDisabled, false);
  assert.equal(view.selectedPerson.attributeActions[0].visualDisabled, false);
  assert.deepEqual(view.candidates[0].acceptAction, { type: 'acceptFamousPerson', candidateId: 'candidate-1' });
  assert.equal(UIStatePresenter.formatFamousPersonSkill({ name: 'Aptitude', effects: [{ key: 'knowledgeOutputPct', value: 0.15 }] }).includes('知识产出提高 15%'), true);
});

test('UIStatePresenter delegates building view state while preserving facade contracts', () => {
  const buildingConfig = {
    categories: {
      agriculture: { label: '农业', order: 1 },
      livelihood: { label: '民生', order: 2 },
      military: { label: '军事', order: 3 },
    },
    house: {
      id: 'house',
      name: '民居',
      category: 'livelihood',
      maxLevel: 3,
      effects: { perLevel: { populationCap: 2 } },
      ui: {
        description: '容纳更多人口。',
        effectText: [{ field: 'populationCapBonus', label: '人口上限' }],
      },
      maintenance: { habitabilityPressure: 0.5, perLevelPerMinute: { food: 0.3 } },
    },
    farm: {
      id: 'farm',
      name: '农田',
      category: 'agriculture',
      maxLevel: 5,
      effects: { perLevel: { foodOutputMultiplier: 0.2 } },
      ui: {
        description: '提供稳定粮食。',
        effectText: [{ field: 'foodOutputBonus', label: '粮食', format: 'percent' }],
      },
      maintenance: { habitabilityPressure: 0, perLevelPerMinute: {} },
    },
    barracks: {
      id: 'barracks',
      name: '兵营',
      category: 'military',
      maxLevel: 2,
      military: {
        soldierCapByLevel: [0, 20, 40],
        trainingIntervalSecondsByLevel: [0, 30, 20],
        trainingBatchSizeByLevel: [0, 1, 2],
      },
      effects: { perLevel: { defense: 1 } },
      ui: { effectText: [] },
      maintenance: { habitabilityPressure: 1.2, perLevelPerMinute: { food: 0.6 } },
    },
  };
  const state = {
    unlockedBuildings: ['house', 'farm', 'barracks'],
    buildings: { house: { level: 1 }, farm: 0, barracks: 1 },
    buildingCosts: {
      house: { wood: 15 },
      farm: { food: 5, wood: 10 },
      barracks: { wood: 50 },
    },
    resources: { food: 20, wood: 12 },
    softGuide: { mode: 'strong', target: 'card-farm' },
    military: { soldiers: 3, soldierCap: 20, trainingProgress: 4, trainingIntervalSeconds: 30, trainingBatchSize: 1, defense: 2 },
    buildingEffects: {
      byBuilding: { house: { level: 1, populationCapBonus: 2 } },
      threatDefense: 1,
    },
  };
  const view = UIStatePresenter.buildBuildingViewState(state, buildingConfig, { activeCategory: 'all' });
  const direct = BuildingPresenter.buildBuildingViewState(state, buildingConfig, { activeCategory: 'all' });

  assert.deepEqual(view, direct);
  assert.equal(typeof UIStatePresenter.buildBuildingViewState, 'function');
  assert.equal(view.cards.length, 3);
  assert.equal(view.cards.find((card) => card.id === 'farm').button.disabled, false);
  assert.equal(view.cards.find((card) => card.id === 'house').button.disabled, true);
  assert.equal(view.cards.find((card) => card.id === 'barracks').militaryLines[0], '士兵 3/20 · 防御 3');
  assert.deepEqual(UIStatePresenter.buildCostViewState({ wood: 1234 }).parts[0], { resource: 'wood', value: 1234, text: '1.2k' });
});

test('UIStatePresenter delegates event view state while preserving facade contracts', () => {
  const nowMs = Date.UTC(2026, 5, 6, 8, 0, 0);
  const state = {
    eventQueue: [
      {
        id: 'forest-whisper',
        title: 'Forest Whisper',
        description: 'A scout hears movement beyond the trees.',
        type: 'regular',
        expiresAt: new Date(nowMs + 90_000).toISOString(),
        options: [{
          id: 'listen',
          label: 'Listen',
          requirements: { soldiers: 3, defense: 1 },
          successEffects: [
            { type: 'resource', key: 'wood', value: 80 },
            { type: 'buff', buffType: 'resourceMultiplier', target: 'wood', value: 0.15, durationSeconds: 120 },
          ],
          failureEffects: [{ type: 'soldiers', value: -1 }],
        }],
      },
      {
        id: 'iron-cache',
        title: 'Iron Cache',
        type: 'special',
        reward: { iron: 12 },
        options: [{ id: 'claim', label: 'Claim', reward: { iron: 12 } }],
      },
    ],
    eventHistory: [{
      id: 'old-event',
      title: 'Old Event',
      type: 'threat',
      selectedOptionId: 'fight',
      options: [{ id: 'fight', reward: { food: 10 } }],
    }],
  };

  const view = UIStatePresenter.buildEventViewState(state, { nowMs });
  const direct = EventPresenter.buildEventViewState(state, { nowMs });
  const modal = UIStatePresenter.buildEventModalViewState(state.eventQueue[0], { nowMs });

  assert.deepEqual(view, direct);
  assert.deepEqual(modal, EventPresenter.buildEventModalViewState(state.eventQueue[0], { nowMs }));
  assert.equal(typeof UIStatePresenter.buildEventViewState, 'function');
  assert.equal(view.badge.text, '2');
  assert.equal(view.pending.cards[0].id, 'forest-whisper');
  assert.equal(view.pending.cards[0].iconAsset, 'assets/art/icon-event-cutout.webp');
  assert.equal(modal.options[0].rows.length, 4);
  assert.equal(modal.claimButton.optionId, 'listen');
  assert.deepEqual(UIStatePresenter.buildEventResourcePart('metal', 12), { type: 'resource', resource: 'iron', text: '+12' });
});

test('UIStatePresenter delegates task center and guidebook view state while preserving facade contracts', () => {
  const state = {
    guideTasks: {
      visible: true,
      tasks: [
        { id: 'legacy-task', title: 'Legacy Task', status: 'active', target: 'buildings' },
      ],
    },
    taskCenter: {
      visible: true,
      tabs: [
        { id: 'main', label: 'Main', badge: 1 },
        { id: 'daily', label: 'Daily' },
      ],
      categories: {
        main: {
          label: 'Main',
          emptyText: 'No main tasks',
          tasks: [
            { id: 'claimable-main', title: 'Claim Supplies', status: 'claimable', claimed: false },
            { id: 'completed-main', title: 'Done', status: 'completed', claimed: true },
          ],
        },
        daily: {
          label: 'Daily',
          tasks: [{ id: 'daily-go', title: 'Scout', status: 'active', target: 'scout-north' }],
        },
      },
    },
    guidebook: {
      activeTab: 'policy',
      categories: [
        { id: 'planning', label: 'Plan', title: 'Planning', lines: ['Build around terrain.'] },
        { id: 'policy', label: 'Policy', title: 'Talent Policy', lines: ['Assign talent deliberately.'] },
      ],
    },
    cityState: {
      activeCityId: 'capital',
      cities: [{
        id: 'capital',
        planning: {
          terrainLabel: 'River Plain',
          habitabilityLabel: 'Stable',
          habitability: 12,
          populationGrowthMultiplier: 1.12,
        },
      }],
    },
  };

  const taskView = UIStatePresenter.buildTaskCenterViewState(state, { activeTab: 'daily' });
  const directTaskView = TaskGuidePresenter.buildTaskCenterViewState(state, { activeTab: 'daily' });
  const guidebookView = UIStatePresenter.buildGuidebookViewState(state, { activeTab: 'planning' });
  const directGuidebookView = TaskGuidePresenter.buildGuidebookViewState(state, {
    activeTab: 'planning',
    buildCityPlanningViewState: (sourceState) => HomePresenter.buildCityPlanningViewState(sourceState),
  });

  assert.deepEqual(taskView, directTaskView);
  assert.deepEqual(guidebookView, directGuidebookView);
  assert.equal(taskView.activeTab, 'daily');
  assert.equal(taskView.tabs.find((tab) => tab.id === 'main').badge, 1);
  assert.deepEqual(taskView.categories.main.tasks[0].action, { type: 'claimTaskReward', taskId: 'claimable-main', category: 'main' });
  assert.equal(taskView.categories.daily.tasks[0].action.type, 'goToGuideTaskTarget');
  assert.equal(guidebookView.activeCategory.id, 'planning');
  assert.equal(guidebookView.subtitle.includes('River Plain'), true);
});

test('UIStatePresenter delegates civilization view state while preserving facade contracts', () => {
  const state = {
    currentEra: 1,
    currentEraName: 'Agriculture',
    currentEraDescription: 'Food surplus changes the camp.',
    gameDay: 9,
    happiness: 91,
    totalBuildings: 4,
    population: { total: 7 },
    techs: { pottery: true, irrigation: true },
    eraProgress: {
      percentage: 125,
      canAdvance: true,
      targetEraName: 'Bronze',
      conditions: [
        { name: 'Population', current: 7, required: 6, met: true },
        { name: 'Food', current: 18, required: 20, met: false },
      ],
    },
  };

  const lockedView = UIStatePresenter.buildCivilizationViewState(state, { canOpenCivilizationTab: false });
  const directLockedView = CivilizationPresenter.buildCivilizationViewState(state, { canOpenCivilizationTab: false });
  const unlockedView = UIStatePresenter.buildCivilizationViewState(state, { canOpenCivilizationTab: true });
  const subCityView = UIStatePresenter.buildCivilizationViewState({ ...state, isCapitalCity: false }, { canOpenCivilizationTab: true });

  assert.deepEqual(lockedView, directLockedView);
  assert.equal(lockedView.progress.percentage, 100);
  assert.equal(lockedView.advanceButton.disabled, true);
  assert.equal(lockedView.advanceButton.canOpenCivilizationTab, false);
  assert.equal(unlockedView.advanceButton.disabled, false);
  assert.equal(subCityView.advanceButton.disabled, true);
  assert.deepEqual(UIStatePresenter.buildEraConditionViewState(state.eraProgress.conditions[0]), {
    name: 'Population',
    met: true,
    className: 'met',
    progressText: '7/6',
  });
});

test('UIStatePresenter delegates home resource and planning view state while preserving facade contracts', () => {
  const state = {
    currentEra: 2,
    gameDay: 12,
    happiness: 88,
    resources: {
      food: 1200,
      wood: 345,
      stone: 78,
      iron: 9,
      knowledge: 42,
      foodOutputPerSecond: 3.25,
      foodConsumptionPerSecond: 1.5,
      foodNetPerSecond: 1.75,
      woodPerSecond: 0.4,
      stonePerSecond: 0.2,
      ironPerSecond: 0.1,
      knowledgePerSecond: 0.6,
    },
    population: {
      total: 5,
      unassigned: 1,
      farmers: 2,
      scholars: 1,
      craftsmen: 1,
      maxPop: 8,
      capacity: {
        active: true,
        limitingSource: 'era',
        eraCap: 5,
        housingCap: 8,
      },
    },
    cityState: {
      activeCityId: 'city-2',
      capitalCityId: 'capital',
      cities: [
        {
          id: 'capital',
          name: '首都',
          isCapital: true,
          population: { total: 3 },
          totalBuildings: 2,
          planning: { terrainLabel: '平原', habitabilityLabel: '平稳' },
        },
        {
          id: 'city-2',
          name: '河湾',
          population: { total: 5 },
          totalBuildings: 4,
          planning: {
            terrainId: 'river',
            terrainLabel: '河湾',
            terrainSummary: '水网密集。',
            terrainHint: '适合农业与贸易。',
            habitability: 16,
            habitabilityLabel: '良好',
            habitabilityTone: 'positive',
            populationGrowthMultiplier: 1.18,
            habitabilityNotes: ['水源充足，人口成长良好。'],
          },
        },
      ],
    },
    taskCenter: {
      visible: true,
      summary: { claimableCount: 2, activeCount: 3, totalCount: 4 },
      tabs: [{ id: 'main', label: '主线任务', badge: 2 }],
      categories: { main: { tasks: [] } },
    },
  };

  assert.deepEqual(UIStatePresenter.buildResourceViewState(state), HomePresenter.buildResourceViewState(state));
  assert.deepEqual(UIStatePresenter.buildCitySwitcherViewState(state), HomePresenter.buildCitySwitcherViewState(state));
  assert.deepEqual(UIStatePresenter.buildPopulationViewState(state), HomePresenter.buildPopulationViewState(state));
  assert.equal(UIStatePresenter.buildResourceViewState(state).text.populationStatus, '人口已无法增长，请推进时代');
  assert.equal(HomePresenter.formatCompactNumber(1200), '1.2k');
  assert.equal(HomePresenter.formatRate(0.33), '+0.33/s');
  assert.equal(HomePresenter.formatNegativeRate(0.5), '-0.5/s');
  assert.equal(UIStatePresenter.buildCityPlanningViewState(state).text.populationGrowthStatus, '人口成长良好');
  assert.equal(UIStatePresenter.buildPopulationViewState(state).jobs.find((job) => job.id === 'craftsman').visible, true);
  assert.equal(typeof UIStatePresenter.buildHomeFeatureViewState, 'undefined');
  assert.equal(UIStatePresenter.calculatePopulationGrowthMultiplier(16), 1.16);
});

test('UIStatePresenter delegates talent policy view state while preserving facade contracts', () => {
  const state = {
    currentEra: 2,
    population: { total: 9 },
    talentPolicies: {
      activePolicyId: 'balanced',
      defaultTiers: { agriculture: 2, knowledge: 2, industry: 2 },
      systemPolicies: [
        { id: 'balanced', label: '均衡发展', weights: { farmer: 1, scholar: 1, craftsman: 1 }, priority: ['farmer', 'scholar', 'craftsman'] },
        { id: 'knowledge', label: '知识优先', weights: { farmer: 1, scholar: 3, craftsman: 1 }, priority: ['scholar', 'farmer', 'craftsman'] },
      ],
      tendencies: [
        { id: 'agriculture', label: '农业', role: 'farmer' },
        { id: 'knowledge', label: '知识', role: 'scholar' },
        { id: 'industry', label: '工业', role: 'craftsman' },
      ],
    },
  };
  const uiState = { selectedBasePolicyId: 'knowledge', tiers: { agriculture: 1, knowledge: 3, industry: 2 } };

  const view = UIStatePresenter.buildTalentPolicyViewState(state, uiState);
  const direct = TalentPolicyPresenter.buildTalentPolicyViewState(state, uiState);

  assert.deepEqual(view, direct);
  assert.equal(view.draft.displayName, '知识优先·偏知识');
  assert.equal(view.preview.allocation.scholar > view.preview.allocation.farmer, true);
  assert.deepEqual(UIStatePresenter.getTalentPolicyAvailableRoles(state), ['farmer', 'scholar', 'craftsman']);
});

test('UIStatePresenter delegates military view state while preserving facade contracts', () => {
  const state = {
    activeCityId: 'capital',
    buildingEffects: { threatDefense: 2 },
    military: {
      soldiers: 12,
      soldierCap: 20,
      defense: 3,
      trainingIntervalSeconds: 40,
      trainingProgress: 10,
      trainingBatchSize: 2,
      formations: {
        capital: [
          { slot: 1, name: '先锋队', memberIds: ['hero-scout'] },
          { slot: 2, memberIds: [] },
        ],
      },
    },
    famousPersons: {
      people: [
        {
          id: 'hero-scout',
          name: 'Scout Hero',
          quality: 'epic',
          level: 8,
          attributes: { command: 28, force: 18, intelligence: 44, politics: 20, charisma: 30, speed: 45 },
        },
        {
          id: 'hero-builder',
          name: 'Builder Hero',
          quality: 'good',
          level: 3,
          attributes: { command: 12, force: 8, intelligence: 18, politics: 25, charisma: 16, speed: 10 },
        },
      ],
    },
    territoryState: {
      availableSoldiers: 9,
      soldiersOnMission: 3,
    },
  };

  const militaryView = UIStatePresenter.buildMilitaryViewState(state);
  const directMilitaryView = MilitaryPresenter.buildMilitaryViewState(state);

  assert.deepEqual(UIStatePresenter.buildMilitaryNavigationViewState(state), MilitaryPresenter.buildMilitaryNavigationViewState(state));
  assert.deepEqual(militaryView, directMilitaryView);
  // The 老兵营 sub-tab view must be reachable through the facade (a missing delegate crashed the
  // whole military panel when the tab was tapped), and the map-home resolver must not coerce the
  // veteranCamp view back to 'army' (which made the tab silently revert).
  assert.equal(typeof UIStatePresenter.buildVeteranCampViewState, 'function');
  assert.deepEqual(UIStatePresenter.buildVeteranCampViewState(state), MilitaryPresenter.buildVeteranCampViewState(state));
  assert.ok(UIStatePresenter.buildMilitaryNavigationViewState(state).views.some((view) => view.id === 'veteranCamp'));
  assert.equal(
    UIStatePresenter.resolveMapHomeViewState({ militaryView: 'veteranCamp', currentTab: 'military' }, { requestedTab: 'military', militaryView: 'veteranCamp' }).militaryView,
    'veteranCamp',
  );
  assert.equal(militaryView.text.soldierCount, '12/20');
  assert.equal(militaryView.text.militaryDefense, 5);
  assert.equal(militaryView.formations[0].name, '先锋队');
  assert.equal(militaryView.formations[0].leader.id, 'hero-scout');
  assert.equal(militaryView.formationMeta.summary, '3 支部队 · 每队最多 5 名名人');
});

test('UIStatePresenter projects the squad quick panel from formations and march state', () => {
  const nowMs = new Date('2026-06-06T00:00:05.000Z').getTime();
  const state = {
    activeCityId: 'capital',
    military: {
      formations: [
        { slot: 1, name: '第一队', memberIds: ['hero-scout'] },
        { slot: 2, memberIds: [] },
        { slot: 3, name: '侦察队', memberIds: ['hero-builder'] },
      ],
    },
    famousPersons: {
      people: [
        { id: 'hero-scout', name: 'Scout Hero', attributes: {} },
        { id: 'hero-builder', name: 'Builder Hero', attributes: {} },
      ],
    },
    worldExplorerState: {
      busyFormations: [
        { cityId: 'capital', slot: 3, missionId: 'mission-1', status: 'active' },
      ],
      activeMission: {
        id: 'mission-1',
        status: 'active',
        mode: 'manual',
        startedAt: '2026-06-06T00:00:00.000Z',
        completesAt: '2026-06-06T00:00:20.000Z',
        stepDurationSeconds: 10,
        route: [{ q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false }],
      },
    },
  };

  assert.equal(typeof UIStatePresenter.buildSquadQuickPanelViewState, 'function');
  const view = UIStatePresenter.buildSquadQuickPanelViewState(state, { nowMs });
  assert.deepEqual(view, MilitaryPresenter.buildSquadQuickPanelViewState(state, { nowMs }));

  // Empty slot 2 is projected away; slot 3 marches, slot 1 does not.
  assert.equal(view.hidden, false);
  assert.deepEqual(view.rows.map((row) => row.slot), [1, 3]);
  assert.deepEqual(view.rows.map((row) => row.marching), [false, true]);
  assert.equal(view.rows[0].name, '第一队');
  assert.deepEqual(view.rows[0].action, { type: 'openArmyFormation', cityId: 'capital', slot: 1, source: 'squadQuickPanel' });

  // A mission whose effective status decayed to idle no longer pins the slot.
  const settledView = UIStatePresenter.buildSquadQuickPanelViewState(
    state,
    { nowMs: new Date('2026-06-06T00:01:00.000Z').getTime() },
  );
  assert.deepEqual(settledView.rows.map((row) => row.marching), [false, false]);

  // Zero non-empty formations hides the panel entirely.
  const emptyView = UIStatePresenter.buildSquadQuickPanelViewState({
    military: { formations: [{ slot: 1, memberIds: [] }] },
  }, { nowMs });
  assert.equal(emptyView.hidden, true);
  assert.deepEqual(emptyView.rows, []);
});

test('UIStatePresenter squad quick panel names rows by leader on the REAL server formation shape', () => {
  // Verbatim /game/state DTO shape (captured from a live server): the server
  // persists NO formation name (name: '') for untouched slots. UI-REDO ⑦b row
  // label priority: player rename > leader "{name}队" (slot-1 member resolved
  // through famousPersons) > localized 部队N default.
  const state = {
    activeCityId: 'capital',
    famousPersons: {
      people: [
        { id: 'fp_scout_180t6mi', name: '斥候', attributes: {} },
        { id: 'fp_hero_zhangfei_9k2m1x', name: '张飞', attributes: {} },
      ],
    },
    military: {
      formations: [
        { slot: 1, name: '', memberIds: ['fp_scout_180t6mi'], maxMembers: 5, maxSoldiersPerMember: 1000, soldierAssignments: { fp_scout_180t6mi: 1000 }, soldiersAssigned: 1000 },
        { slot: 2, name: '虎豹骑', memberIds: ['fp_hero_zhangfei_9k2m1x'], maxMembers: 5, maxSoldiersPerMember: 1000, soldierAssignments: { fp_hero_zhangfei_9k2m1x: 500 }, soldiersAssigned: 500 },
        { slot: 3, name: '', memberIds: [], maxMembers: 5, maxSoldiersPerMember: 1000, soldierAssignments: {}, soldiersAssigned: 0 },
      ],
    },
  };

  const view = UIStatePresenter.buildSquadQuickPanelViewState(state, { nowMs: Date.now() });
  assert.equal(view.hidden, false);
  assert.equal(view.rows.length, 2);
  assert.equal(view.rows[0].slot, 1);
  // No player rename -> leader chain: "斥候" + 队 through the paired i18n key.
  assert.equal(view.rows[0].name, LocaleText.t('military.formation.leaderSquad', { name: '斥候' }));
  // Player rename wins over the leader name.
  assert.equal(view.rows[1].slot, 2);
  assert.equal(view.rows[1].name, '虎豹骑');
  // Never a blank label and never a raw i18n key leak.
  view.rows.forEach((row) => {
    assert.equal(row.name.length > 0, true);
    assert.equal(row.name.includes('military.formation'), false);
    assert.equal(row.name.includes('{name}'), false);
  });
});

test('UIStatePresenter delegates world site dialog view state while preserving facade contracts', () => {
  const territories = [
    {
      id: 'empty-city',
      status: 'discovered',
      owner: 'neutral',
      occupationMode: 'settlement',
      type: 'city',
      naturalName: '无主空城',
      effects: { foodOutputMultiplier: 0.2, threatDefense: 3 },
      originDistance: 2,
      scale: 2,
      threat: 1,
      defense: 0,
      recommendedSoldiers: 100,
    },
    {
      id: 'tribe-camp',
      status: 'discovered',
      owner: 'tribe',
      occupationMode: 'conquest',
      type: 'camp',
      naturalName: '山谷部落',
      effects: { woodOutputMultiplier: 0.15 },
      defense: 180,
      recommendedSoldiers: 200,
      garrison: {
        leader: {
          name: '守将甲',
          title: '寨主',
          qualityLabel: '精良',
          abilityKit: { abilities: [{ slot: 'activeSkill', name: '山地伏击' }] },
        },
      },
      lastBattle: {
        success: false,
        casualties: 12,
        leaderName: '先锋',
        report: {
          system: 'speed-basic-attack-v1',
          summary: '战斗已经结束。',
          attacker: { speed: 12, soldiersEnd: 88 },
          defender: { speed: 8, soldiersEnd: 30 },
        },
      },
    },
    {
      id: 'claimed-city',
      status: 'occupied',
      owner: 'player',
      cityName: '河湾城',
      naturalName: '河湾',
      effects: {},
    },
    {
      id: 'ready-site',
      status: 'contested',
      owner: 'neutral',
      naturalName: '前哨',
      mission: { status: 'ready', mode: 'settlement', durationSeconds: 90 },
    },
  ];
  const territoryState = {
    availableSoldiers: 250,
    missionDurationSeconds: 120,
    famousPersons: {
      people: [
        { id: 'hero-mil', name: '霍去病', title: '骠骑', roles: ['military'] },
      ],
    },
  };
  const uiState = { selectedSiteId: 'tribe-camp', expeditionConfigSiteId: 'tribe-camp', expeditionSoldiers: 200 };

  const view = UIStatePresenter.buildWorldSiteDialogViewState(territories, territoryState, uiState);
  const direct = WorldSitePresenter.buildWorldSiteDialogViewState(territories, territoryState, uiState);
  const tribeDetail = view.details.find((detail) => detail.id === 'tribe-camp');
  const emptyAction = UIStatePresenter.buildWorldSiteActionViewState(territories[0], territoryState, {});
  const occupiedAction = UIStatePresenter.buildWorldSiteActionViewState(territories[2], territoryState, {});
  const readyAction = UIStatePresenter.buildWorldSiteActionViewState(territories[3], territoryState, {});

  assert.deepEqual(view, direct);
  assert.deepEqual(UIStatePresenter.buildWorldSiteDetailViewState(territories[1], territoryState, uiState), WorldSitePresenter.buildWorldSiteDetailViewState(territories[1], territoryState, uiState));
  assert.equal(view.showModal, true);
  assert.equal(tribeDetail.text.owner, '有主 · 部落');
  assert.equal(tribeDetail.text.defenderLeader, '守将 守将甲 · 寨主 · 精良');
  assert.equal(tribeDetail.text.defenderSkill, '敌方战法 山地伏击');
  assert.equal(tribeDetail.text.battleReport[1], '速度：己方 12 / 敌方 8');
  assert.equal(tribeDetail.action.expeditionConfig.disabled, false);
  assert.equal(tribeDetail.action.expeditionConfig.fields.leader.value, 'hero-mil');
  // Combat expedition amounts floor at 1 soldier (no 100-soldier minimum).
  assert.equal(tribeDetail.action.expeditionConfig.fields.soldiers.min, 1);
  assert.equal(emptyAction.buttons[2].action, 'conquer');
  assert.equal(emptyAction.hint, '该地区无主，无需派兵即可建立据点。');
  assert.equal(occupiedAction.kind, 'city-command');
  assert.equal(occupiedAction.buttons.find((button) => button.action === 'rename-city').label, '改名');
  assert.equal(readyAction.buttons[0].action, 'claim');
  assert.equal(UIStatePresenter.formatWorldDuration(65), '1:05');
  assert.equal(UIStatePresenter.getWorldSiteMarchInfo(territories[3], territoryState), '行军耗时 1:30，已抵达待接管');
  assert.equal(UIStatePresenter.getWorldSiteDialogContentSignature(territories, territoryState, uiState), direct.signature);
});

test('UIStatePresenter resolves world site chrome through active locale', () => {
  LocaleText.setLocale('en-US');
  const site = {
    id: 'tribe-camp',
    status: 'discovered',
    owner: 'tribe',
    occupationMode: 'conquest',
    naturalName: 'Camp',
    scale: 1,
    defense: 80,
    recommendedSoldiers: 120,
    threat: 0,
    effects: { foodOutputMultiplier: 0.15 },
    lastBattle: {
      success: false,
      leaderName: 'Ash',
      casualties: 9,
      report: { system: 'speed-basic-attack-v1', attacker: { speed: 12 }, defender: { speed: 8 } },
    },
    garrison: {
      leader: {
        name: '',
        abilityKit: { abilities: [{ slot: 'activeSkill' }] },
      },
    },
  };
  const territoryState = { availableSoldiers: 200, famousPersons: { people: [] } };
  const uiState = { selectedSiteId: 'tribe-camp', expeditionConfigSiteId: 'tribe-camp' };

  const detail = UIStatePresenter.buildWorldSiteDetailViewState(site, territoryState, uiState);

  assert.equal(detail.text.owner, 'Owned · Tribe');
  assert.equal(detail.text.distance, 'Distance 0');
  assert.equal(detail.text.scale, 'Scale 1');
  assert.equal(detail.text.threat, 'Threat 0');
  assert.equal(detail.text.defense, 'Defense 80');
  assert.equal(detail.text.soldiers, 'Recommended 120 soldiers');
  assert.equal(detail.text.summary, 'Food +15%');
  assert.equal(detail.text.note, 'Previous conquest failed · led by Ash · lost 9 soldiers');
  assert.equal(detail.text.battleReport[1], 'Speed: allies 12 / enemies 8');
  assert.equal(detail.text.defenderLeader, 'Defender Unknown');
  assert.equal(detail.text.defenderSkill, 'Enemy tactic Unknown tactic');
  assert.equal(detail.action.buttons.find((button) => button.action === 'open-expedition').label, 'Conquer');
  assert.equal(detail.action.hint, 'This area already has a force. Configure an expedition first.');
  assert.equal(detail.action.expeditionConfig.fields.leader.label, 'Leader');
  assert.equal(detail.action.expeditionConfig.buttons.launch.label, 'Depart');
  LocaleText.setLocale('zh-CN');
});

test('UIStatePresenter shows 未知/兵力不明 when defender strength fields are withheld (打了才知道)', () => {
  // The backend withholds defense/recommendedSoldiers/threat for an unfought defended site. The
  // detail view must show "未知/兵力不明", NOT a misleading 0 — and the expedition must still be usable.
  const site = {
    id: 'site-unfought',
    status: 'discovered',
    owner: 'neutral',
    occupationMode: 'conquest',
    type: 'city',
    naturalName: '远疆城邦',
    effects: {},
    // No defense / recommendedSoldiers / threat keys at all (stripped by the backend gate).
  };
  const territoryState = { availableSoldiers: 500, famousPersons: { people: [{ id: 'hero-mil', name: '霍去病', title: '骠骑', roles: ['military'] }] } };
  const uiState = { selectedSiteId: 'site-unfought', expeditionConfigSiteId: 'site-unfought' };

  const detail = UIStatePresenter.buildWorldSiteDetailViewState(site, territoryState, uiState);

  assert.equal(detail.text.defense, '防御 未知');
  assert.equal(detail.text.threat, '威胁 未知');
  assert.equal(detail.text.soldiers, '兵力不明（交战后可知）');
  // `scale` (garrison band tier) is withheld too — show 规模 未知, not the tier number that leaks the band.
  assert.equal(detail.text.scale, '规模 未知');
  // The expedition still works: a neutral default of 1 (not 0), so the player can march out.
  assert.equal(detail.action.expeditionConfig.draft.soldiers, 1);
  assert.equal(detail.action.expeditionConfig.fields.soldiers.min, 1);
  // A present value still renders the number (regression guard for the fought/own-site path).
  const foughtDetail = UIStatePresenter.buildWorldSiteDetailViewState(
    { ...site, scale: 3, defense: 320, recommendedSoldiers: 300, threat: 12 },
    territoryState,
    uiState,
  );
  assert.equal(foughtDetail.text.defense, '防御 320');
  assert.equal(foughtDetail.text.soldiers, '建议 300 士兵');
  assert.equal(foughtDetail.text.threat, '威胁 12');
  assert.equal(foughtDetail.text.scale, '规模 3');
});

test('UIStatePresenter enables direct occupation of an empty site with zero soldiers', () => {
  const emptySite = {
    id: 'site_2_2',
    status: 'discovered',
    owner: 'neutral',
    occupationMode: 'settlement',
    type: 'town',
    naturalName: 'Clear Spring',
    defense: 100,
    recommendedSoldiers: 100,
  };
  // No special grant and no reserve soldiers: settlement needs neither.
  const territoryState = { availableSoldiers: 0 };
  const action = UIStatePresenter.buildWorldSiteActionViewState(emptySite, territoryState, {});
  const conquer = action.buttons.find((button) => button.action === 'conquer');

  assert.equal(conquer.disabled, false);
});

test('UIStatePresenter delegates battle scene view state while preserving facade contracts', () => {
  const battle = {
    report: {
      id: 'battle-1',
      result: 'victory',
      groupSize: 50,
      attacker: {
        leaderName: '霍去病',
        leaderTitle: '骠骑将军',
        speed: 12,
        soldiersStart: 160,
        soldiersEnd: 110,
        skill: { name: '长驱直入', cooldown: 2 },
      },
      defender: {
        leaderName: '守将甲',
        leaderTitle: '寨主',
        speed: 8,
        soldiersStart: 140,
        soldiersEnd: 0,
        skill: { name: '山地伏击', cooldown: 3 },
      },
      turns: [
        {
          actor: 'attacker',
          action: 'skill',
          lines: ['霍去病列阵。', '霍去病发动战法 长驱直入。', '敌军动摇。'],
          cooldownBefore: 0,
          cooldownAfter: 2,
          soldiersBefore: { attacker: 160, defender: 140 },
          soldiersAfter: { attacker: 160, defender: 90 },
          statusesBefore: { attacker: [], defender: [] },
          statusesAfter: {
            attacker: [{ key: 'shield', value: 24, turnsRemaining: 1 }],
            defender: [{ key: 'armorBreak', stacks: 2, turnsRemaining: 2 }],
          },
        },
        {
          actor: 'defender',
          actionType: 'skill',
          lines: ['守将甲稳住阵脚。', '守将甲释放技能 山地伏击。'],
          cooldownBefore: 0,
          cooldownAfter: 3,
          soldiersBefore: { attacker: 160, defender: 90 },
          soldiersAfter: { attacker: 110, defender: 90 },
          statusesBefore: {
            attacker: [{ key: 'shield', value: 24, turnsRemaining: 1 }],
            defender: [{ key: 'armorBreak', stacks: 2, turnsRemaining: 2 }],
          },
          statusesAfter: {
            attacker: [{ key: 'burn', stacks: 1, turnsRemaining: 2 }],
            defender: [],
          },
        },
      ],
    },
  };

  const view = UIStatePresenter.buildBattleSceneViewState(battle, { turnIndex: 1, phase: 'impact' });
  const direct = BattleScenePresenter.buildBattleSceneViewState(battle, { turnIndex: 1, phase: 'impact' });

  assert.deepEqual(view, direct);
  assert.equal(typeof UIStatePresenter.buildBattleSceneViewState, 'function');
  assert.equal(view.visible, true);
  assert.equal(view.title, '霍去病队 vs 守将甲队');
  assert.equal(view.attacker.soldiers, 110);
  assert.equal(view.defender.soldiers, 90);
  assert.equal(view.defender.skillState.state, 'cooldown');
  assert.equal(view.defender.skillState.stateText, '冷却 3 回合');
  assert.deepEqual(UIStatePresenter.makeVisualGroups(120, 50).map((group) => group.soldiers), [50, 50, 20]);
  assert.equal(UIStatePresenter.getBattleTurnSoldiers(battle.report.turns[0], 'defender', 'after', 0), 90);
  assert.equal(UIStatePresenter.formatBattleStatusBadge({ key: 'poison', stacks: 2, turnsRemaining: 3 }).text, '中毒 x2 3回合');
  assert.deepEqual(UIStatePresenter.buildBattleStatusBadges([{ key: 'shield', value: 18 }, { key: 'burn' }]).map((badge) => badge.text), ['守御 18', '灼烧']);
  assert.deepEqual(UIStatePresenter.getBattleTurnLines(battle.report.turns[0], { active: true, phase: 'cutin' }), ['霍去病列阵。', '霍去病发动战法 长驱直入。']);
});

test('UIStatePresenter resolves business module UI chrome through active locale', () => {
  LocaleText.setLocale('en-US');

  const homeState = {
    gameDay: 3,
    currentEra: 1,
    resources: { food: 10, wood: 8, stone: 0, iron: 0, knowledge: 2 },
    population: {
      total: 5,
      maxPop: 8,
      capacity: { active: true, limitingSource: 'era', eraCap: 5, housingCap: 8 },
    },
    cityState: { cities: [{ id: 'capital', population: { total: 5 }, totalBuildings: 0 }] },
  };
  assert.equal(UIStatePresenter.buildResourceViewState(homeState).text.gameTime, 'Day 3');
  assert.equal(
    UIStatePresenter.buildResourceViewState(homeState).text.populationStatus,
    'Population cannot grow further. Advance the era.',
  );
  assert.equal(UIStatePresenter.buildCitySwitcherViewState(homeState).options[0].tag, 'Subcity');

  const buildingState = {
    unlockedBuildings: ['house'],
    buildings: { house: 0 },
    buildingCosts: {},
    buildingDefinitions: {
      house: {
        id: 'house',
        name: 'House',
        maxLevel: 2,
        category: 'livelihood',
        effects: { perLevel: { populationCap: 1 } },
        ui: { effectText: [{ field: 'populationCapBonus', label: 'Population Cap' }] },
      },
    },
    resources: {},
  };
  const buildingView = UIStatePresenter.buildBuildingViewState(buildingState, {}, buildingState.buildingDefinitions);
  assert.equal(buildingView.categoryTabs.find((tab) => tab.id === 'all').label, 'All');
  assert.equal(buildingView.cards[0].button.label, 'Build');
  assert.equal(buildingView.cards[0].cost.text, 'Free build');

  const techView = UIStatePresenter.buildTechViewState({
    techs: {
      points: 1,
      eras: [{
        era: 1,
        techs: [{
          id: 'farm-tech',
          name: 'Agriculture',
          available: true,
          status: 'available',
          unlockText: ['Farm'],
          resourceEntrances: ['food'],
        }],
      }],
    },
  });
  assert.equal(techView.text.title, 'Tech Tree');
  assert.equal(techView.detail.statusLabel, 'Available');
  assert.equal(techView.detail.effectRows[1].text, 'Food production');
  assert.equal(techView.detail.unlockSummary.includes('Unlocks: Farm'), true);

  const eventView = UIStatePresenter.buildEventViewState({
    eventQueue: [{ id: 'event-1', type: 'regular', expiresAt: new Date(Date.now() + 61_000).toISOString() }],
    eventHistory: [],
  });
  assert.match(eventView.pending.cards[0].hint, /left, expires automatically/);
  assert.equal(eventView.history.emptyText, 'No event records');

  const taskView = UIStatePresenter.buildTaskCenterViewState({ guideTasks: { visible: true, tasks: [] } });
  assert.equal(taskView.tabs.find((tab) => tab.id === 'main').label, 'Main');
  assert.equal(taskView.categories.main.emptyText, 'No main tasks');
  assert.equal(UIStatePresenter.buildGuidebookViewState(homeState).title, 'Guide');

  const militaryView = UIStatePresenter.buildMilitaryViewState({
    military: { soldiers: 0, soldierCap: 0, trainingIntervalSeconds: 0 },
    famousPersons: { people: [] },
    territoryState: {},
  });
  assert.equal(militaryView.formations[0].name, 'Unit One');
  assert.equal(militaryView.text.soldierTrainingText, 'Waiting for barracks');

  const battleView = UIStatePresenter.buildBattleSceneViewState({
    report: {
      result: 'victory',
      attacker: { leaderName: 'Hero', soldiersStart: 10, soldiersEnd: 8 },
      defender: { soldiersStart: 6, soldiersEnd: 0 },
      turns: [],
    },
  });
  assert.equal(battleView.resultText, 'Victory');
  assert.equal(battleView.title, 'Hero Squad vs Defenders Squad');
  assert.equal(UIStatePresenter.formatBattleStatusBadge({ key: 'poison', stacks: 2, turnsRemaining: 3 }).text, 'Poison x2 3 turns');

  LocaleText.setLocale('zh-CN');
});

test('index.html loads focused state presenters before UIStatePresenter facade', () => {
  const htmlPath = path.resolve(__dirname, '../../index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const expectedOrder = [
    'TechPresenter.js',
    'HomePresenter.js',
    'BuildingPresenter.js',
    'EventPresenter.js',
    'TaskGuidePresenter.js',
    'CivilizationPresenter.js',
    'FamousPersonPresenter.js',
    'MilitaryPresenter.js',
    'WorldSitePresenter.js',
    'BattleScenePresenter.js',
    'WorldTileMapTileNormalizer.js',
    'WorldTileMapExplorerNormalizer.js',
    'WorldTileMapRenderDiagnostics.js',
    'WorldTileMapPresenter.js',
    'ShellPresenter.js',
    'TalentPolicyPresenter.js',
    'UIStatePresenterDelegates.js',
    'UIStatePresenter.js',
  ];
  const positions = expectedOrder.map((name) => html.indexOf(name));

  positions.forEach((position, index) => {
    assert.notEqual(position, -1, `${expectedOrder[index]} should be loaded`);
    if (index > 0) assert.equal(positions[index - 1] < position, true, `${expectedOrder[index - 1]} should load before ${expectedOrder[index]}`);
  });
});

test('UIStatePresenter facade is installed by delegate registry', () => {
  assert.equal(typeof UIStatePresenter.toNumber, 'function');
  assert.equal(typeof UIStatePresenter.buildGuidebookViewState, 'function');
  assert.equal(typeof UIStatePresenter.buildHomeFeatureViewState, 'undefined');
  assert.equal(typeof UIStatePresenter.buildTechViewState, 'function');
  assert.equal(UIStatePresenter.POPULATION_PER_OFFICIAL, 100);
});
