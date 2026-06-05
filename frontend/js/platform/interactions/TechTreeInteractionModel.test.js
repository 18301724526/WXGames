const test = require('node:test');
const assert = require('node:assert/strict');

const TechTreeInteractionModel = require('./TechTreeInteractionModel');
const CanvasActionController = require('../CanvasActionController');

function createHost() {
  const calls = [];
  const host = {
    state: { techs: {} },
    techTreePanX: 0,
    techTreePanY: 0,
    techTreeZoom: 1,
    presenter: {
      buildTechViewState(state) {
        calls.push(['buildTechViewState', state]);
        return { nodes: [{ id: 'writing' }], links: [] };
      },
    },
    renderer: {
      width: 390,
      height: 844,
      lastTechTreeScroll: {
        panel: { x: 20, y: 100, width: 300, height: 240 },
      },
      getTechTreeLayout(view, panel, options) {
        calls.push(['getTechTreeLayout', view, panel, options]);
        return {
          minPanX: -100,
          maxPanX: 40,
          minPanY: -80,
          maxPanY: 30,
        };
      },
    },
    getTechTreePan() {
      return { x: this.techTreePanX, y: this.techTreePanY };
    },
    setTechTreePan(pan) {
      calls.push(['setTechTreePan', pan]);
      this.techTreePanX = pan.x;
      this.techTreePanY = pan.y;
    },
    getTechTreeZoom() {
      return this.techTreeZoom;
    },
    setTechTreeZoom(zoom) {
      calls.push(['setTechTreeZoom', zoom]);
      this.techTreeZoom = zoom;
    },
    render() {
      calls.push(['render']);
      return true;
    },
  };
  return { host, calls };
}

test('TechTreeInteractionModel clamps drag pan through renderer layout boundary', () => {
  const { host } = createHost();
  const model = new TechTreeInteractionModel({ host, getState: () => host.state });

  assert.equal(model.handleDrag({ phase: 'start', pointer: { x: 10, y: 10 } }), true);
  assert.equal(model.handleDrag({ phase: 'move', pointer: { x: 180, y: 160 } }), true);

  assert.equal(host.techTreePanX, 40);
  assert.equal(host.techTreePanY, 30);
  assert.deepEqual(host.techTreeDragStart, { x: 10, y: 10, panX: 0, panY: 0 });
  assert.equal(model.handleDrag({ phase: 'end', pointer: { x: 180, y: 160 } }), true);
  assert.equal(host.techTreeDragStart, null);
});

test('TechTreeInteractionModel keeps zoom centered and clamps resulting pan', () => {
  const { host } = createHost();
  host.techTreePanX = -20;
  host.techTreePanY = -10;
  const model = new TechTreeInteractionModel({ host, getState: () => host.state });

  assert.equal(model.handleZoom({ gesture: { scaleDelta: 1.2, centerX: 140, centerY: 180 } }), true);

  assert.equal(Math.round(host.techTreeZoom * 100), 120);
  assert.equal(Math.round(host.techTreePanX), -48);
  assert.equal(Math.round(host.techTreePanY), -28);
});

test('CanvasActionController delegates tech tree drag and zoom to interaction model', () => {
  const calls = [];
  const host = {
    render() {
      calls.push(['render']);
      return true;
    },
  };
  const controller = new CanvasActionController({
    host,
    techTreeInteraction: {
      handleDrag(action) {
        calls.push(['handleDrag', action.phase]);
        return true;
      },
      handleZoom(action) {
        calls.push(['handleZoom', action.gesture.scaleDelta]);
        return true;
      },
    },
  });

  assert.equal(controller.handle({ type: 'techTreeDrag', phase: 'move', pointer: { x: 1, y: 2 } }), true);
  assert.equal(controller.handle({ type: 'techTreeZoom', gesture: { scaleDelta: 1.1 } }), true);
  assert.deepEqual(calls, [
    ['handleDrag', 'move'],
    ['render'],
    ['handleZoom', 1.1],
    ['render'],
  ]);
});

test('CanvasActionController defers tutorial enter-city action until the intro transition completes', () => {
  const calls = [];
  const game = {
    state: {},
    enterCity(cityId, options) {
      calls.push(['enterCity', cityId, options.tab]);
      return true;
    },
  };
  const host = {
    tutorialIntro: { active: true, step: 'enter', capitalCityId: 'capital' },
    tutorialIntroOverlay: {
      beginEnterCityTransition(action, onComplete) {
        calls.push(['beginEnterCityTransition', action.type, action.cityId]);
        this.onComplete = onComplete;
        return true;
      },
      getViewState() {
        return host.tutorialIntro;
      },
    },
    getCanvasGameHost() {
      return game;
    },
    render() {
      calls.push(['render']);
      return true;
    },
  };
  const controller = new CanvasActionController({ host });

  assert.equal(controller.handle({ type: 'enterCity', cityId: 'capital', tab: 'buildings' }), true);
  assert.deepEqual(calls, [['beginEnterCityTransition', 'enterCity', 'capital']]);

  host.tutorialIntroOverlay.onComplete();
  assert.deepEqual(calls, [
    ['beginEnterCityTransition', 'enterCity', 'capital'],
    ['enterCity', 'capital', 'buildings'],
  ]);
});

test('CanvasActionController notifies tutorial when opening civilization command panel', async () => {
  const calls = [];
  const game = {
    tutorialController: {
      async onCommandPanelOpened(panelId) {
        calls.push(['onCommandPanelOpened', panelId]);
        return true;
      },
    },
  };
  const host = {
    activeCommandPanel: '',
    getCanvasGameHost() {
      return game;
    },
    render() {
      calls.push(['render']);
      return true;
    },
  };
  const controller = new CanvasActionController({ host, awaitAsync: true });

  assert.equal(await controller.handle_openCommandPanel({ type: 'openCommandPanel', panel: 'civilization' }), true);

  assert.equal(host.activeCommandPanel, 'civilization');
  assert.deepEqual(calls, [
    ['onCommandPanelOpened', 'civilization'],
    ['render'],
  ]);
});

test('CanvasActionController syncs opened event id across shell and game hosts', () => {
  const calls = [];
  const shell = {
    activeEventId: null,
    activeCommandPanel: 'events',
    showTaskCenter: true,
    state: { eventQueue: [{ id: 'event-1' }] },
    getCanvasGameHost() {
      return game;
    },
    render() {
      calls.push(['render']);
      return true;
    },
  };
  const game = {
    activeEventId: null,
    canvasShell: shell,
    state: { eventQueue: [{ id: 'event-1' }] },
  };
  const controller = new CanvasActionController({ host: shell });

  assert.equal(controller.handle_openEvent({ type: 'openEvent', eventId: 'event-1' }), true);

  assert.equal(shell.activeEventId, 'event-1');
  assert.equal(game.activeEventId, 'event-1');
  assert.equal(game.canvasShell.activeEventId, 'event-1');
  assert.equal(shell.activeCommandPanel, '');
  assert.equal(shell.showTaskCenter, false);
  assert.deepEqual(calls, [['render']]);

  assert.equal(controller.handle_closeEvent({ type: 'closeEvent' }), true);
  assert.equal(shell.activeEventId, null);
  assert.equal(game.activeEventId, null);
  assert.equal(game.canvasShell.activeEventId, null);
});
