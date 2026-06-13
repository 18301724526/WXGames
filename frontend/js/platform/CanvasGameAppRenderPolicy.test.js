const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameAppRenderPolicy = require('./CanvasGameAppRenderPolicy');

test('CanvasGameAppRenderPolicy resolves military world and territory into map home', () => {
  assert.deepEqual(CanvasGameAppRenderPolicy.resolveMapHomeViewState({
    currentTab: 'military',
    militaryView: 'world',
  }), {
    activeTab: 'military',
    requestedTab: 'military',
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
    currentTab: 'military',
    militaryView: 'world',
  }, {
    allowDefaultMapHome: false,
  }), {
    activeTab: 'military',
    requestedTab: 'military',
    militaryView: 'world',
    isMapHome: true,
    canUseMapHome: true,
  });
});

test('CanvasGameAppRenderPolicy normalizes removed or unknown page tabs to map home', () => {
  assert.deepEqual(CanvasGameAppRenderPolicy.getTabOrder(), ['military', 'buildings', 'tech', 'events', 'civilization']);
  assert.deepEqual(CanvasGameAppRenderPolicy.resolveMapHomeViewState({}, {
    requestedTab: 'deleted-home-page',
    allowDefaultMapHome: false,
  }), {
    activeTab: 'military',
    requestedTab: 'military',
    militaryView: 'world',
    isMapHome: true,
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
    message: '去侦察更多土地',
  }), 'scout');
  assert.equal(CanvasGameAppRenderPolicy.getPreferredMilitaryView('military', {
    target: 'tab-military',
    message: '打开世界领土',
  }), 'world');
});

test('CanvasGameAppRenderPolicy returns a defensive tab order copy', () => {
  const tabs = CanvasGameAppRenderPolicy.getTabOrder();
  tabs.push('debug');
  assert.deepEqual(CanvasGameAppRenderPolicy.getTabOrder(), ['military', 'buildings', 'tech', 'events', 'civilization']);
});
