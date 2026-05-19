(function (global) {
  class H5ShellAdapter {
    constructor(parts = {}) {
      Object.assign(this, parts);
    }

    static fromDocument(doc = global.document, runtime = global, options = {}) {
      const setText = options.setText || (() => {});
      const buildingActions = global.BuildingActionAdapter?.fromDocument(doc);
      const territoryActions = global.TerritoryActionAdapter?.fromDocument(doc);
      const tutorialRenderer = global.TutorialUIRenderer?.fromDocument(doc, runtime);

      return new H5ShellAdapter({
        textAdapter: global.H5TextAdapter?.fromDocument(doc),
        updateRuntime: global.H5UpdateRuntimeAdapter?.fromRuntime(runtime),
        resourceRenderer: global.ResourceRenderer?.fromDocument(doc, setText),
        resourceDetailModal: global.ResourceDetailModalAdapter?.fromDocument(doc),
        advisorPanel: global.AdvisorPanelAdapter?.fromDocument(doc),
        namingModal: global.NamingModalAdapter?.fromDocument(doc),
        authShell: global.AuthShellAdapter?.fromDocument(doc),
        populationPanel: global.PopulationPanelAdapter?.fromDocument(doc),
        citySwitcher: global.CitySwitcherAdapter?.fromDocument(doc),
        navigationShell: global.NavigationShellAdapter?.fromDocument(doc),
        tutorialTargets: global.TutorialTargetAdapter?.fromDocument(doc),
        civilizationPanel: global.CivilizationPanelAdapter?.fromDocument(doc, { setText }),
        militaryPanel: global.MilitaryPanelAdapter?.fromDocument(doc, { setText }),
        buildingActions,
        buildingRenderer: new global.BuildingUIRenderer(buildingActions?.getContainer?.(), {}),
        eventRenderer: new global.EventUIRenderer(setText),
        logModal: global.LogModalAdapter?.fromDocument(doc),
        runtimeLog: global.RuntimeLogAdapter?.fromDocument(doc),
        territoryActions,
        territoryRenderer: new global.TerritoryUIRenderer(territoryActions?.getContainer?.(), {
          getUiState: options.getTerritoryUiState || (() => ({})),
        }),
        tutorialRenderer,
      });
    }
  }

  global.H5ShellAdapter = H5ShellAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5ShellAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
