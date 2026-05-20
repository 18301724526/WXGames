(function (global) {
  class H5ShellAdapter {
    constructor(parts = {}) {
      Object.assign(this, parts);
    }

    static fromDocument(doc, runtime = null, options = {}) {
      const runtimeHost = runtime || {};
      const registry = options.registry || runtimeHost;
      const presenter = options.presenter || registry.UIStatePresenter || null;
      const setText = options.setText || (() => {});
      const buildingActions = registry.BuildingActionAdapter?.fromDocument(doc);
      const territoryActions = registry.TerritoryActionAdapter?.fromDocument(doc);
      const tutorialRenderer = registry.TutorialUIRenderer?.fromDocument(doc, runtimeHost, { presenter });
      const authRuntime = registry.H5AuthRuntimeAdapter?.fromRuntime(runtimeHost);
      const authStorage = registry.H5AuthStorageAdapter?.fromRuntime(runtimeHost);
      const moduleDeps = {
        presenter,
        authRuntime,
        authStorage,
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
          registry.mountPopulationMethods?.(game, moduleDeps);
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
          TutorialController: registry.TutorialController,
          EventController: registry.EventController,
          BuildingController: registry.BuildingController,
          TerritoryController: registry.TerritoryController,
        },
        stateNormalizer: options.stateNormalizer || registry.FrontendGameState,
        scheduler,
        textAdapter: registry.H5TextAdapter?.fromDocument(doc),
        updateRuntime: registry.H5UpdateRuntimeAdapter?.fromRuntime(runtimeHost),
        authRuntime,
        authStorage,
        tutorialStorage: registry.H5TutorialStorageAdapter?.fromRuntime(runtimeHost),
        floatingText: registry.FloatingTextAdapter?.fromDocument(doc),
        advisorPanel: registry.AdvisorPanelAdapter?.fromDocument(doc),
        namingModal: registry.NamingModalAdapter?.fromDocument(doc),
        authShell: registry.AuthShellAdapter?.fromDocument(doc),
        populationPanel: registry.PopulationPanelAdapter?.fromDocument(doc),
        navigationShell: registry.NavigationShellAdapter?.fromDocument(doc),
        tutorialTargets: registry.TutorialTargetAdapter?.fromDocument(doc),
        civilizationPanel: registry.CivilizationPanelAdapter?.fromDocument(doc, { setText }),
        militaryPanel: registry.MilitaryPanelAdapter?.fromDocument(doc, { setText }),
        buildingActions,
        buildingRenderer: registry.BuildingUIRenderer ? new registry.BuildingUIRenderer(buildingActions?.getContainer?.(), {}, { presenter }) : null,
        eventRenderer: registry.EventUIRenderer ? new registry.EventUIRenderer(setText, { document: doc, presenter }) : null,
        logModal: registry.LogModalAdapter?.fromDocument(doc),
        runtimeLog: registry.RuntimeLogAdapter?.fromDocument(doc),
        territoryActions,
        territoryRenderer: registry.TerritoryUIRenderer ? new registry.TerritoryUIRenderer(territoryActions?.getContainer?.(), {
          getUiState: options.getTerritoryUiState || (() => ({})),
          presenter,
        }) : null,
        tutorialRenderer,
      });
    }
  }

  global.H5ShellAdapter = H5ShellAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5ShellAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
