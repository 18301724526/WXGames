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
  const calls = [];
  const adapter = new NavigationShellAdapter({
    tabButtons: [resourcesTab, militaryTab],
    pages: [createElement({ page: 'resources' }), createElement({ page: 'military' })],
  });

  adapter.bind({
    onTabClick: async (tabId) => calls.push(['tab', tabId]),
  });
  await militaryTab.listeners.click({ currentTarget: militaryTab });

  assert.deepEqual(calls, [
    ['tab', 'military'],
  ]);
  assert.deepEqual(adapter.getTabDescriptors(), [{ id: 'resources' }, { id: 'military' }]);
});

test('navigation shell adapter renders tab and lock states', () => {
  const resourcesTab = createElement({ tab: 'resources' });
  const militaryTab = createElement({ tab: 'military' });
  const resourcesPage = createElement({ page: 'resources' });
  const militaryPage = createElement({ page: 'military' });
  const adapter = new NavigationShellAdapter({
    tabButtons: [resourcesTab, militaryTab],
    pages: [resourcesPage, militaryPage],
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
});
