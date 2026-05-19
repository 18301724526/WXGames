(function (global) {
  const KEYS = {
    autoStarted: 'tutorialAutoStarted',
    step: 'tutorialStep',
    completed: 'tutorialCompleted',
  };

  class H5TutorialStorageAdapter {
    constructor(storage = null) {
      this.storage = storage || null;
    }

    static fromRuntime(runtime = global) {
      return new H5TutorialStorageAdapter(runtime?.localStorage || global.localStorage || null);
    }

    static fromStorage(storage) {
      return new H5TutorialStorageAdapter(storage);
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

    isAutoStarted() {
      return this.get(KEYS.autoStarted) === 'true';
    }

    setAutoStarted(autoStarted) {
      if (autoStarted) this.set(KEYS.autoStarted, 'true');
      else this.remove(KEYS.autoStarted);
    }

    setProgress(tutorial = {}) {
      this.set(KEYS.completed, tutorial.completed ? 'true' : 'false');
      this.set(KEYS.step, String(tutorial.currentStep ?? 0));
    }

    clear() {
      Object.values(KEYS).forEach((key) => this.remove(key));
    }
  }

  global.H5TutorialStorageAdapter = H5TutorialStorageAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5TutorialStorageAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
