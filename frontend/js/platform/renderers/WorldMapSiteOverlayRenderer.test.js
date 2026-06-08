const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapSiteOverlayRenderer = require('./WorldMapSiteOverlayRenderer');

function createHost(overrides = {}) {
  const calls = [];
  const hitTargets = [];
  return {
    calls,
    hitTargets,
    width: 390,
    height: 844,
    bottomSafeArea: 12,
    presenter: null,
    addHitTarget(rect, action) {
      hitTargets.push({ rect, action });
    },
    createGradient(...args) {
      calls.push(['createGradient', ...args]);
      return '#123';
    },
    drawAsset(...args) {
      calls.push(['drawAsset', ...args]);
      return false;
    },
    drawButton(...args) {
      calls.push(['drawButton', ...args]);
    },
    drawCircle(...args) {
      calls.push(['drawCircle', ...args]);
    },
    drawPanel(...args) {
      calls.push(['drawPanel', ...args]);
    },
    drawText(...args) {
      calls.push(['drawText', ...args]);
    },
    drawTextLines(...args) {
      calls.push(['drawTextLines', ...args]);
    },
    getLayout() {
      return { contentWidth: 380, contentX: 10, contentRight: 390 };
    },
    getTopBarBottom() {
      return 84;
    },
    measureTextWidth(text) {
      return String(text || '').length * 8;
    },
    truncateText(text) {
      return String(text || '');
    },
    wrapTextLimit(text) {
      return [String(text || '')];
    },
    ...overrides,
  };
}

test('WorldMapSiteOverlayRenderer delegates dialog view state to presenter when available', () => {
  const presenterView = { selectedSiteId: 'site-1', showModal: true, details: [] };
  const host = createHost({
    presenter: {
      buildWorldSiteDialogViewState(territories, territoryState, uiState) {
        assert.equal(territories.length, 1);
        assert.equal(territoryState.version, 1);
        assert.equal(uiState.selectedSiteId, 'site-1');
        return presenterView;
      },
    },
  });
  const renderer = new WorldMapSiteOverlayRenderer({ host });

  assert.equal(renderer.getWorldSiteDialogPresenter(), host.presenter);
  assert.equal(
    renderer.buildWorldSiteDialogViewState([{ id: 'site-1' }], { version: 1 }, { selectedSiteId: 'site-1' }),
    presenterView,
  );
});

test('WorldMapSiteOverlayRenderer passes tutorial context into world site presenter state', () => {
  const host = createHost({
    state: {
      tutorial: {
        currentStep: 25,
        grants: { firstExploreEmptyCity: { siteId: 'site-1' } },
      },
    },
    presenter: {
      buildWorldSiteDialogViewState(territories, territoryState, uiState) {
        assert.equal(territoryState.availableSoldiers, 0);
        assert.equal(territoryState.tutorial.currentStep, 25);
        assert.equal(territoryState.tutorial.grants.firstExploreEmptyCity.siteId, 'site-1');
        assert.equal(uiState.selectedSiteId, 'site-1');
        return {
          selectedSiteId: 'site-1',
          showModal: true,
          details: [{
            id: 'site-1',
            text: {
              name: 'Empty Site',
              status: 'discovered',
              owner: 'neutral',
              distance: '',
              scale: '',
              threat: '',
              summary: '',
              defense: '',
              soldiers: '',
            },
            action: {
              kind: 'single',
              buttons: [{ label: 'Claim', action: 'conquer', territoryId: 'site-1' }],
            },
          }],
        };
      },
    },
  });
  const renderer = new WorldMapSiteOverlayRenderer({ host });

  renderer.renderWorldSiteModal({
    territoryState: {
      availableSoldiers: 0,
      territories: [{
        id: 'site-1',
        status: 'discovered',
        owner: 'neutral',
        naturalName: 'Empty Site',
      }],
    },
  }, { territoryUiState: { selectedSiteId: 'site-1' } });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'conquer' && !target.action.disabled), true);
});

test('WorldMapSiteOverlayRenderer builds occupied-city fallback action view state', () => {
  const renderer = new WorldMapSiteOverlayRenderer({ host: createHost() });
  const view = renderer.buildWorldSiteDialogViewState([
    {
      id: 'capital',
      status: 'occupied',
      owner: 'player',
      cityName: 'Capital',
      summary: 'Home city.',
      defense: 12,
      recommendedSoldiers: 8,
    },
  ], {}, { selectedSiteId: 'capital' });

  assert.equal(view.showModal, true);
  assert.equal(view.selectedSiteId, 'capital');
  assert.equal(view.details[0].action.kind, 'city-command');
  assert.equal(view.details[0].action.buttons.some((button) => button.action === 'enter-city'), true);
  assert.equal(view.details[0].action.buttons.some((button) => button.action === 'rename-city'), true);
  assert.equal(typeof view.signature, 'string');
});

test('WorldMapSiteOverlayRenderer registers action hit targets with stable action types', () => {
  const host = createHost();
  const renderer = new WorldMapSiteOverlayRenderer({ host });

  const nextY = renderer.renderWorldSiteAction({
    kind: 'single',
    buttons: [
      { label: 'Go', action: 'launch-expedition', territoryId: 'site-1' },
      { label: 'Rename', action: 'rename-city', territoryId: 'capital', secondary: true },
      { label: 'People', action: 'labor-city', territoryId: 'capital', secondary: true },
    ],
  }, 10, 20, 300);

  assert.equal(nextY, 64);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'launchExpedition'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'renameCity'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'enterCity' && target.action.tab === 'people'), true);
});

test('WorldMapSiteOverlayRenderer maps city command buttons through one action helper', () => {
  const renderer = new WorldMapSiteOverlayRenderer({ host: createHost() });

  assert.deepEqual(renderer.getWorldCityCommandButtonAction({ action: 'enter-city', territoryId: 'capital' }), {
    type: 'enterCity',
    territoryId: 'capital',
    cityId: 'capital',
    tab: undefined,
    disabled: false,
  });
  assert.deepEqual(renderer.getWorldCityCommandButtonAction({ action: 'labor-city', territoryId: 'capital' }), {
    type: 'enterCity',
    territoryId: 'capital',
    cityId: 'capital',
    tab: 'people',
    disabled: false,
  });
  assert.equal(renderer.getWorldCityCommandButtonAction({ action: 'rename-city', territoryId: 'capital' }).type, 'renameCity');
});

test('WorldMapSiteOverlayRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapSiteOverlayRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapSiteOverlayRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapSiteOverlayRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
