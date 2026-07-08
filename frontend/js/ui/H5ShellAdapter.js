(function (global) {
  class H5ShellAdapter {
    constructor(parts = {}) {
      Object.assign(this, parts);
    }

    static fromRuntime(runtime = null, options = {}) {
      const runtimeHost = runtime || {};
      const registry = options.registry || runtimeHost;
      const presenter = options.presenter || registry.UIStatePresenter || null;
      const debugDiagnostics = registry.H5DebugDiagnosticsAdapter?.fromRuntime(runtimeHost, { registry }) || null;
      const authRuntime = registry.H5AuthRuntimeAdapter?.fromRuntime(runtimeHost);
      const authStorage = registry.H5AuthStorageAdapter?.fromRuntime(runtimeHost);
      const actorPickingDiagnostics =
        registry.H5ActorPickingDiagnosticsAdapter?.fromRuntime(runtimeHost) || null;
      const gameApiTransport = registry.H5GameApiTransportAdapter?.fromRuntime(runtimeHost) || null;
      registry.LocaleText?.setStorageAdapter?.(runtimeHost.localStorage || null);
      const moduleDeps = {
        presenter,
        authRuntime,
        authStorage,
        debugDiagnostics,
        actorPickingDiagnostics,
        gameApiTransport,
      };
      const scheduler = {
        setInterval: runtimeHost.setInterval?.bind(runtimeHost),
        clearInterval: runtimeHost.clearInterval?.bind(runtimeHost),
        setTimeout: runtimeHost.setTimeout?.bind(runtimeHost),
        clearTimeout: runtimeHost.clearTimeout?.bind(runtimeHost),
      };
      const gameModules = {
        mount(game) {
          registry.mountAuthMethods?.(game, moduleDeps);
          registry.mountLogMethods?.(game, moduleDeps);
        },
      };

      return new H5ShellAdapter({
        config: options.config || registry.GameConfig,
        gameModules,
        presenter,
        buildingState: options.buildingState || registry.FrontendBuildingState,
        runtimeConstructors: options.runtimeConstructors || {
          GameAPI: registry.GameAPI,
          GameStateSync: registry.GameStateSync,
          UpdateChecker: registry.UpdateChecker,
          GameStateManager: registry.GameStateManager,
          EventController: registry.EventController,
          CaptureController: registry.CaptureController,
          BuildingController: registry.BuildingController,
          TerritoryController: registry.TerritoryController,
        },
        stateNormalizer: options.stateNormalizer || registry.FrontendGameState,
        scheduler,
        updateRuntime: registry.H5UpdateRuntimeAdapter?.fromRuntime(runtimeHost),
        debugDiagnostics,
        gameApiTransport,
        actorPickingDiagnostics,
        authRuntime,
        authStorage,
      });
    }
  }

  global.H5ShellAdapter = H5ShellAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5ShellAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
