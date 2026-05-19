const test = require('node:test');
const assert = require('node:assert/strict');

const AuthShellAdapter = require('../js/ui/AuthShellAdapter');

function createClassList() {
  const classes = new Set();
  return {
    toggle(name) {
      if (classes.has(name)) classes.delete(name);
      else classes.add(name);
    },
    remove(name) { classes.delete(name); },
    contains(name) { return classes.has(name); },
  };
}

function createElement() {
  return {
    style: {},
    value: '',
    checked: false,
    textContent: '',
    listeners: {},
    classList: createClassList(),
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
}

test('auth shell adapter owns login shell and credential H5 writes', () => {
  const loginPanel = createElement();
  const loginMessage = createElement();
  const app = createElement();
  const usernameInput = createElement();
  const passwordInput = createElement();
  const rememberInput = createElement();
  const settingsMenu = createElement();
  const loginButton = createElement();
  const adapter = new AuthShellAdapter({
    loginPanel,
    loginMessage,
    app,
    usernameInput,
    passwordInput,
    rememberInput,
    settingsMenu,
    loginButton,
  });

  adapter.applyShell({ loginPanelVisible: true, appVisible: false, message: 'login' });
  adapter.applyCredentials({ usernameValue: 'User ', passwordValue: 'pw', rememberPasswordChecked: true });

  assert.equal(loginPanel.style.display, 'flex');
  assert.equal(app.style.display, 'none');
  assert.equal(loginMessage.textContent, 'login');
  assert.deepEqual(adapter.readCredentials(), { username: 'user', password: 'pw', rememberPassword: true });

  adapter.toggleSettings();
  assert.equal(settingsMenu.classList.contains('active'), true);
  adapter.closeSettings();
  assert.equal(settingsMenu.classList.contains('active'), false);

  let loginCount = 0;
  adapter.bindLoginEvents(() => { loginCount += 1; });
  usernameInput.listeners.keydown({ key: 'Enter' });
  passwordInput.listeners.keydown({ key: 'Escape' });
  loginButton.listeners.click();
  assert.equal(loginCount, 2);
});
