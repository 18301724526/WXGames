(function (global) {
  class AuthShellAdapter {
    constructor(elements = {}) {
      this.loginPanel = elements.loginPanel || null;
      this.loginMessage = elements.loginMessage || null;
      this.app = elements.app || null;
      this.usernameInput = elements.usernameInput || null;
      this.passwordInput = elements.passwordInput || null;
      this.rememberInput = elements.rememberInput || null;
      this.settingsMenu = elements.settingsMenu || null;
      this.loginButton = elements.loginButton || null;
      this.settingsButton = elements.settingsButton || null;
      this.resetButton = elements.resetButton || null;
      this.logoutButton = elements.logoutButton || null;
    }

    static fromDocument(doc) {
      return new AuthShellAdapter({
        loginPanel: doc.getElementById('loginPanel'),
        loginMessage: doc.getElementById('loginMessage'),
        app: doc.getElementById('app'),
        usernameInput: doc.getElementById('loginUsername'),
        passwordInput: doc.getElementById('loginPassword'),
        rememberInput: doc.getElementById('rememberPassword'),
        settingsMenu: doc.getElementById('settingsMenu'),
        loginButton: doc.getElementById('btnLogin'),
        settingsButton: doc.getElementById('settingsBtn'),
        resetButton: doc.getElementById('btnResetGame'),
        logoutButton: doc.getElementById('btnLogout'),
      });
    }

    setMessage(message) {
      if (this.loginMessage) this.loginMessage.textContent = message || '';
    }

    applyShell(view = {}) {
      if (this.loginPanel) this.loginPanel.style.display = view.loginPanelVisible ? 'flex' : 'none';
      this.setMessage(view.message || '');
      if (this.app) this.app.style.display = view.appVisible ? 'block' : 'none';
    }

    applyCredentials(view = {}) {
      if (this.rememberInput) this.rememberInput.checked = Boolean(view.rememberPasswordChecked);
      if (this.usernameInput) this.usernameInput.value = view.usernameValue || '';
      if (this.passwordInput) this.passwordInput.value = view.passwordValue || '';
    }

    readCredentials() {
      return {
        username: (this.usernameInput?.value || '').trim().toLowerCase(),
        password: this.passwordInput?.value || '',
        rememberPassword: Boolean(this.rememberInput?.checked),
      };
    }

    toggleSettings() {
      this.settingsMenu?.classList?.toggle('active');
    }

    closeSettings() {
      this.settingsMenu?.classList?.remove('active');
    }

    bindLoginEvents(onLogin) {
      const submitOnEnter = (event) => {
        if (event.key === 'Enter') onLogin();
      };
      this.passwordInput?.addEventListener?.('keydown', submitOnEnter);
      this.usernameInput?.addEventListener?.('keydown', submitOnEnter);
      this.loginButton?.addEventListener?.('click', () => onLogin());
    }

    bindSettingsEvents(handlers = {}) {
      this.settingsButton?.addEventListener?.('click', () => handlers.onToggleSettings?.());
      this.resetButton?.addEventListener?.('click', () => handlers.onReset?.());
      this.logoutButton?.addEventListener?.('click', () => handlers.onLogout?.());
    }
  }

  global.AuthShellAdapter = AuthShellAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = AuthShellAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
