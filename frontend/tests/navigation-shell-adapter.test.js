const test = require('node:test');
const assert = require('node:assert/strict');

const NavigationShellAdapter = require('../js/ui/NavigationShellAdapter');

function createClassList() {
  const classes = new Set();
  return {
    toggle(name, force) {
      if (force) classes.add(name);
      else classes.delete(name);
    },
    contains(name) {
      return classes.has(name);
    },
  };
}

function createElement(dataset = {}) {
  return {
    dataset,
    disabled: false,
    title: '',
    attrs: {},
    listeners: {},
    classList: createClassList(),
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
  };
}

test('navigation shell adapter owns H5 tab and military bindings', async () => {
  const resourcesTab = createElement({ tab: 'resources' });
  const militaryTab = createElement({ tab: 'military' });
  const armyButton = createElement({ militaryView: 'army' });
  const scoutButton = createElement({ militaryView: 'scout' });
  const advanceButton = createElement();
  const calls = [];
  const adapter = new NavigationShellAdapter({
    tabButtons: [resourcesTab, militaryTab],
    pages: [createElement({ page: 'resources' }), createElement({ page: 'military' })],
    militaryButtons: [armyButton, scoutButton],
    militaryPages: [createElement({ militaryPage: 'army' }), createElement({ militaryPage: 'scout' })],
    advanceButton,
  });

  adapter.bind({
    onTabClick: async (tabId) => calls.push(['tab', tabId]),
    onMilitaryViewClick: (view) => calls.push(['military', view]),
    onAdvanceEra: () => calls.push(['advance']),
  });
  await militaryTab.listeners.click({ currentTarget: militaryTab });
  scoutButton.listeners.click({ currentTarget: scoutButton });
  advanceButton.listeners.click();

  assert.deepEqual(calls, [
    ['tab', 'military'],
    ['military', 'scout'],
    ['advance'],
  ]);
  assert.deepEqual(adapter.getTabDescriptors(), [{ id: 'resources' }, { id: 'military' }]);
});

test('navigation shell adapter renders tab, lock, and military view states', () => {
  const resourcesTab = createElement({ tab: 'resources' });
  const militaryTab = createElement({ tab: 'military' });
  const resourcesPage = createElement({ page: 'resources' });
  const militaryPage = createElement({ page: 'military' });
  const armyButton = createElement({ militaryView: 'army' });
  const scoutButton = createElement({ militaryView: 'scout' });
  const armyPage = createElement({ militaryPage: 'army' });
  const scoutPage = createElement({ militaryPage: 'scout' });
  const adapter = new NavigationShellAdapter({
    tabButtons: [resourcesTab, militaryTab],
    pages: [resourcesPage, militaryPage],
    militaryButtons: [armyButton, scoutButton],
    militaryPages: [armyPage, scoutPage],
  });

  adapter.renderTabs({
    pages: [{ id: 'resources', isActive: false }, { id: 'military', isActive: true }],
    tabs: [{ id: 'resources', isActive: false }, { id: 'military', isActive: true }],
  });
  assert.equal(resourcesPage.classList.contains('active'), false);
  assert.equal(militaryPage.classList.contains('active'), true);
  assert.equal(militaryTab.classList.contains('active'), true);

  adapter.renderTabLocks([
    { id: 'resources', disabled: false, isLocked: false },
    { id: 'military', disabled: true, isLocked: true },
  ]);
  assert.equal(militaryTab.disabled, true);
  assert.equal(militaryTab.classList.contains('is-locked'), true);

  adapter.renderMilitaryView({
    activeView: 'scout',
    views: [
      { id: 'army', isActive: false, disabled: false, isLocked: false, title: '', ariaSelected: 'false' },
      { id: 'scout', isActive: true, disabled: true, isLocked: true, title: '未解锁', ariaSelected: 'true' },
    ],
  });
  assert.equal(scoutPage.classList.contains('active'), true);
  assert.equal(scoutButton.disabled, true);
  assert.equal(scoutButton.classList.contains('active'), true);
  assert.equal(scoutButton.classList.contains('is-locked'), true);
  assert.equal(scoutButton.title, '未解锁');
  assert.equal(scoutButton.attrs['aria-selected'], 'true');
});
