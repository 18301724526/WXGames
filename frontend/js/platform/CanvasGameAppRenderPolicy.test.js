const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameAppRenderPolicy = require('./CanvasGameAppRenderPolicy');

test('CanvasGameAppRenderPolicy resolves resources and territory into map home', () => {
  assert.deepEqual(CanvasGameAppRenderPolicy.resolveMapHomeViewState({
    currentTab: 'resources',
    militaryView: 'army',
  }), {
    activeTab: 'military',
    requestedTab: 'resources',
    militaryView: 'world',
    isMapHome: true,
    canUseMapHome: true,
  });

  assert.deepEqual(CanvasGameAppRenderPolicy.resolveMapHomeViewState({}, {
    requestedTab: 'territory',
  }), {
    activeTab: 'military',
    requestedTab: 'territory',
    militaryView: 'world',
    isMapHome: true,
    canUseMapHome: true,
  });
});

test('CanvasGameAppRenderPolicy honors allowDefaultMapHome false', () => {
  assert.deepEqual(CanvasGameAppRenderPolicy.resolveMapHomeViewState({
    currentTab: 'resources',
    militaryView: 'army',
  }, {
    allowDefaultMapHome: false,
  }), {
    activeTab: 'resources',
    requestedTab: 'resources',
    militaryView: 'army',
    isMapHome: false,
    canUseMapHome: true,
  });
});

test('CanvasGameAppRenderPolicy resolves preferred military view from guide state', () => {
  assert.equal(CanvasGameAppRenderPolicy.getPreferredMilitaryView('territory'), 'world');
  assert.equal(CanvasGameAppRenderPolicy.getPreferredMilitaryView('military', {
    target: 'scout-action-first',
  }), 'scout');
  assert.equal(CanvasGameAppRenderPolicy.getPreferredMilitaryView('military', {
    target: 'tab-territory',
  }), 'world');
  assert.equal(CanvasGameAppRenderPolicy.getPreferredMilitaryView('military', {
    target: 'tab-military',
    militaryView: 'scout',
  }), 'scout');
  assert.equal(CanvasGameAppRenderPolicy.getPreferredMilitaryView('military', {
    militaryView: 'world',
  }), 'world');
  assert.equal(CanvasGameAppRenderPolicy.getPreferredMilitaryView('military', {
    militaryView: 'army',
  }), null);
});

test('CanvasGameAppRenderPolicy never routes military view from guide message text', () => {
  assert.equal(CanvasGameAppRenderPolicy.getPreferredMilitaryView('military', {
    target: 'tab-military',
    message: '去侦察更多土地',
  }), null);
  assert.equal(CanvasGameAppRenderPolicy.getPreferredMilitaryView('military', {
    target: 'tab-military',
    message: '打开世界领土',
  }), null);
});

test('CanvasGameAppRenderPolicy returns a defensive tab order copy', () => {
  const tabs = CanvasGameAppRenderPolicy.getTabOrder();
  tabs.push('debug');
  assert.deepEqual(CanvasGameAppRenderPolicy.getTabOrder(), ['resources', 'buildings', 'tech', 'events', 'civilization', 'military']);
});
