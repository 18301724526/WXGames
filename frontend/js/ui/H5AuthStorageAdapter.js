(function (global) {
  const KEYS = {
    token: 'cf_token',
    username: 'cf_username',
    rememberEnabled: 'cf_remember_enabled',
    rememberUsername: 'cf_remember_username',
    rememberPassword: 'cf_remember_password',
    phase2: 'civilizationFirePhase2',
  };

  const TUTORIAL_KEYS = ['tutorialAutoStarted', 'tutorialStep', 'tutorialCompleted', 'tutorialIntroAdvisorSeen.v1'];

  class H5AuthStorageAdapter {
    constructor(storage = null) {
      this.storage = storage || null;
    }

    static fromRuntime(runtime = null) {
      return new H5AuthStorageAdapter(runtime?.localStorage || null);
    }

    static fromStorage(storage) {
      return new H5AuthStorageAdapter(storage);
    }

    get(key) {
      return this.storage?.getItem?.(key) ?? null;
    }

    set(key, value) {
      this.storage?.setItem?.(key, value);
    }

    remove(key) {
      this.storage?.removeItem?.(key);
    }

    getToken() {
      return this.get(KEYS.token);
    }

    setToken(token) {
      this.set(KEYS.token, token);
    }

    clearToken() {
      this.remove(KEYS.token);
    }

    getCredentialSnapshot() {
      return {
        rememberEnabled: this.get(KEYS.rememberEnabled) === 'true',
        rememberedUsername: this.get(KEYS.rememberUsername),
        rememberedPassword: this.get(KEYS.rememberPassword),
        username: this.get(KEYS.username),
      };
    }

    setUsername(username) {
      this.set(KEYS.username, username);
    }

    persistRememberedCredentials(username, password, rememberPassword) {
      if (rememberPassword) {
        this.set(KEYS.rememberEnabled, 'true');
        this.set(KEYS.rememberUsername, username);
        this.set(KEYS.rememberPassword, password);
        return;
      }
      this.removeRememberedCredentials();
    }

    removeRememberedCredentials() {
      this.remove(KEYS.rememberEnabled);
      this.remove(KEYS.rememberUsername);
      this.remove(KEYS.rememberPassword);
    }

    clearTutorialStorage() {
      TUTORIAL_KEYS.forEach((key) => this.remove(key));
    }

    clearSession() {
      this.clearToken();
      this.remove(KEYS.phase2);
      this.clearTutorialStorage();
    }
  }

  global.H5AuthStorageAdapter = H5AuthStorageAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5AuthStorageAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
