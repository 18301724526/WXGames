const test = require('node:test');
const assert = require('node:assert/strict');

const RendererSnapshotBoundary = require('./RendererSnapshotBoundary');

test('RendererSnapshotBoundary builds frozen serializable modal and panel snapshots', () => {
  const modalWorld = {
    entries: {
      'modal:event': {
        visible: true,
        token: 'modal:event#1',
        payload: { eventId: 'event-1', ignored: undefined },
      },
      'modal:blockingPanel': {
        visible: true,
        token: 'modal:blockingPanel#2',
        payload: { panelKey: 'activeCommandPanel', panelKind: 'commandPanel', value: 'tech' },
      },
    },
  };

  const snapshot = RendererSnapshotBoundary.buildRendererSnapshot({
    modalWorld,
    panel: {
      showTaskCenter: true,
      activeCommandPanel: 'tech',
      techDetailOpen: true,
    },
    mode: {
      baseModeKey: 'techTree',
      modalKeys: ['modal:blockingPanel'],
      canRouteTechTree: true,
    },
    battle: {
      schema: 'battle-domain-v1',
      battleScene: { visible: true, report: { id: 'report-1' }, turnIndex: 0 },
      entityBattle: null,
      activeOverlay: 'battleScene',
    },
  });

  assert.equal(snapshot.schema, 'renderer-snapshot-v1');
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.modal), true);
  assert.equal(Object.isFrozen(snapshot.panel), true);
  assert.equal(Object.isFrozen(snapshot.mode), true);
  assert.equal(Object.isFrozen(snapshot.battle), true);
  assert.deepEqual(snapshot.modal['modal:event'], {
    open: true,
    token: 'modal:event#1',
    payload: { eventId: 'event-1' },
  });
  assert.deepEqual(snapshot.modal['modal:blockingPanel'].payload, {
    panelKey: 'activeCommandPanel',
    panelKind: 'commandPanel',
    value: 'tech',
  });
  assert.equal(snapshot.panel.showTaskCenter, true);
  assert.equal(snapshot.panel.activeCommandPanel, 'tech');
  assert.equal(snapshot.panel.techDetailOpen, true);
  assert.deepEqual(snapshot.battle, {
    schema: 'battle-domain-v1',
    battleScene: {
      report: { id: 'report-1' },
      turnIndex: 0,
      visible: true,
    },
    entityBattle: null,
    activeOverlay: 'battleScene',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)).schema, 'renderer-snapshot-v1');
});

test('RendererSnapshotBoundary defaults covered panels and excludes domain state', () => {
  const snapshot = RendererSnapshotBoundary.buildRendererSnapshot({
    panel: {
      showFamousPersons: true,
      selectedTechId: 'tech-1',
      taskTab: 'available',
      famousPersonDetail: { id: 'hero-1' },
    },
    mode: {
      baseModeKey: 'city',
      selectedTechId: 'tech-1',
      famousPersonPage: 2,
      worldMarchTarget: { tileId: 'tile_0_0' },
    },
  });

  assert.equal(snapshot.panel.showSettings, false);
  assert.equal(snapshot.panel.showFamousPersons, true);
  assert.equal(snapshot.panel.selectedTechId, undefined);
  assert.equal(snapshot.panel.taskTab, undefined);
  assert.equal(snapshot.panel.famousPersonDetail, undefined);
  assert.equal(snapshot.mode.baseModeKey, 'city');
  assert.equal(snapshot.mode.selectedTechId, undefined);
  assert.equal(snapshot.mode.famousPersonPage, undefined);
  assert.equal(snapshot.mode.worldMarchTarget, undefined);
  assert.deepEqual(snapshot.battle, RendererSnapshotBoundary.BATTLE_DEFAULTS);
  assert.equal(RendererSnapshotBoundary.isRendererSnapshot(snapshot), true);
  assert.equal(RendererSnapshotBoundary.isRendererSnapshot({ schema: 'other' }), false);
});
