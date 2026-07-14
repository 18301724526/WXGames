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

test('CanvasGameAppRenderPolicy resolves the territory military view', () => {
  assert.equal(CanvasGameAppRenderPolicy.getPreferredMilitaryView('territory'), 'world');
  assert.equal(CanvasGameAppRenderPolicy.getPreferredMilitaryView('military'), null);
  assert.equal(CanvasGameAppRenderPolicy.getPreferredMilitaryView('events'), null);
});

test('CanvasGameAppRenderPolicy returns a defensive tab order copy', () => {
  const tabs = CanvasGameAppRenderPolicy.getTabOrder();
  tabs.push('debug');
  assert.deepEqual(CanvasGameAppRenderPolicy.getTabOrder(), ['resources', 'buildings', 'tech', 'events', 'civilization', 'military']);
});
