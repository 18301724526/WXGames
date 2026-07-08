(function (global) {
  const ActorPickingDiagnostics =
    global.ActorPickingDiagnostics ||
    (typeof require === 'function' ? require('../debug/ActorPickingDiagnostics') : null);

  function parseFlag(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return null;
    if (
      normalized === '0' ||
      normalized === 'false' ||
      normalized === 'off' ||
      normalized === 'no'
    ) {
      return false;
    }
    return true;
  }

  class H5ActorPickingDiagnosticsAdapter {
    constructor(runtime = null) {
      this.runtime = runtime || global;
    }

    readQueryFlag(names = []) {
      try {
        const params = new URL(this.runtime?.location?.href || '').searchParams;
        for (const name of names) {
          const value = params.get(name);
          if (value !== null) return parseFlag(value);
        }
      } catch (_error) {
        // Ignore optional H5 diagnostic preferences.
      }
      return null;
    }

    readStorageFlag(key = '') {
      try {
        return parseFlag(this.runtime?.localStorage?.getItem?.(key));
      } catch (_error) {
        return null;
      }
    }

    isEnabled() {
      const queryValue = this.readQueryFlag(['actorPickingDiag', 'worldActorPickingDiag']);
      if (queryValue !== null) return queryValue;
      return this.readStorageFlag('actorPickingDiag') === true;
    }

    isVerbose() {
      const queryValue = this.readQueryFlag([
        'actorPickingDiagVerbose',
        'worldActorPickingDiagVerbose',
      ]);
      if (queryValue !== null) return queryValue;
      return this.readStorageFlag('actorPickingDiagVerbose') === true;
    }

    install() {
      ActorPickingDiagnostics?.setPreferenceProvider?.({
        isEnabled: () => this.isEnabled(),
        isVerbose: () => this.isVerbose(),
      });
      return this;
    }

    static fromRuntime(runtime = null) {
      return new H5ActorPickingDiagnosticsAdapter(runtime).install();
    }
  }

  global.H5ActorPickingDiagnosticsAdapter = H5ActorPickingDiagnosticsAdapter;
  if (typeof module !== 'undefined' && module.exports)
    module.exports = H5ActorPickingDiagnosticsAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
