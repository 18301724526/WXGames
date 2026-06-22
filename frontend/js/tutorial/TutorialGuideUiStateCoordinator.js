(function (global) {
  const UI_STATE_METHODS = Object.freeze({
  clearBlockingCommandPanels() {
    const game = this.game || {};
    let changed = false;
    if (game.activeCommandPanel) {
      game.activeCommandPanel = '';
      changed = true;
    }
    if (game.canvasShell?.activeCommandPanel) {
      game.canvasShell.activeCommandPanel = '';
      changed = true;
    }
    return changed;
  },

  showSoftGuide(target, message) {
    const game = this.game || {};
    game.canvasShell?.hideTutorialHighlight?.();
    const dialogue = { message, advisorName: '谋士', source: `softGuide:${target || 'tutorial'}` };
    game.state = {
      ...(game.state || {}),
      softGuide: {
        mode: 'strong',
        target,
        message,
      },
    };
    game.showAdvisor = false;
    game.tutorialAdvisorDialogue = dialogue;
    if (game.canvasShell) {
      game.canvasShell.showAdvisor = false;
      game.canvasShell.tutorialAdvisorDialogue = dialogue;
    }
    if (target !== 'tech-tree') this.clearBlockingCommandPanels();
    game.renderCanvasSurface?.(game.state?.currentTab || game.activeTab);
    return true;
  },

  getClosedArmyFormationEditor() {
    return { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
  },

  closeArmyFormationEditorEverywhere() {
    const game = this.game || {};
    const closed = this.getClosedArmyFormationEditor();
    game.armyFormationEditor = { ...closed };
    if (game.canvasShell && typeof game.canvasShell === 'object') {
      game.canvasShell.armyFormationEditor = { ...closed };
    }
    return closed;
  },

  showCapitalEnterHighlight(siteId = this.getCapitalCityId()) {
    return this.showHighlight(
      'enterCity',
      (action) => !action.disabled && (!siteId || action.cityId === siteId || action.territoryId === siteId || action.siteId === siteId),
      '\u8fdb\u5165\u4e3b\u57ce\uff0c\u5728\u57ce\u5185\u519b\u4e8b\u9875\u914d\u7f6e\u4fa6\u5bdf\u7f16\u961f\u3002',
      { type: 'enterCity', cityId: siteId },
    );
  },

  focusCapitalSite(siteId = this.getCapitalCityId()) {
    if (!siteId) return false;
    const shell = this.game?.canvasShell || null;
    const actionController = shell?.actionController || this.game?.actionController || null;
    if (typeof actionController?.centerWorldMapOnSite === 'function') {
      actionController.centerWorldMapOnSite(siteId);
    }
    this.ensureMapHomeGuideVisible();
    const highlighted = this.showCapitalSiteOpenHighlight(siteId);
    if (!highlighted) {
      setTimeout(() => this.showCapitalSiteOpenHighlight(siteId), 80);
    }
    return highlighted;
  },

  focusFirstCitySite(siteId = '') {
    if (!siteId || this.focusedFirstCitySiteId === siteId) return false;
    const shell = this.game?.canvasShell || null;
    const actionController = shell?.actionController || this.game?.actionController || null;
    let changed = false;
    if (typeof actionController?.centerWorldMapOnSite === 'function') {
      changed = actionController.centerWorldMapOnSite(siteId) !== false;
    }
    if (!changed) return false;
    this.game?.renderCanvasSurface?.(this.game?.state?.currentTab || this.game?.activeTab);
    shell?.renderActive?.();
    if (this.showFirstCitySiteOpenHighlight(siteId)) {
      this.focusedFirstCitySiteId = siteId;
    }
    setTimeout(() => {
      if (this.showFirstCitySiteOpenHighlight(siteId)) {
        this.focusedFirstCitySiteId = siteId;
      }
    }, 80);
    return true;
  },

  prepareCommandPanelGuide(panelId) {
    const game = this.game || {};
    const shell = game.canvasShell || null;
    let changed = false;
    const closeIfOpen = (host, key, value = false) => {
      if (host && host[key]) {
        host[key] = value;
        changed = true;
      }
    };
    if (game.activeCommandPanel && game.activeCommandPanel !== panelId) {
      game.activeCommandPanel = '';
      changed = true;
    }
    if (shell?.activeCommandPanel && shell.activeCommandPanel !== panelId) {
      shell.activeCommandPanel = '';
      changed = true;
    }
    closeIfOpen(game, 'showCityManagement');
    closeIfOpen(shell, 'showCityManagement');
    closeIfOpen(game, 'showSubcityList');
    closeIfOpen(shell, 'showSubcityList');
    closeIfOpen(game, 'showTaskCenter');
    closeIfOpen(shell, 'showTaskCenter');
    closeIfOpen(game, 'showFamousPersons');
    closeIfOpen(shell, 'showFamousPersons');
    if (game.selectedFamousPersonId) {
      game.selectedFamousPersonId = '';
      changed = true;
    }
    if (shell?.selectedFamousPersonId) {
      shell.selectedFamousPersonId = '';
      changed = true;
    }
    if (game.activeEventId) {
      game.activeEventId = null;
      changed = true;
    }
    if (shell?.activeEventId) {
      shell.activeEventId = null;
      changed = true;
    }
    if (changed) {
      shell?.hideTutorialHighlight?.();
      game.renderCanvasSurface?.(game.state?.currentTab || game.activeTab);
    }
    return changed;
  },

  ensureHouseGuideVisible() {
    if (!this.isHouseGuideActive()) return false;
    const game = this.game || {};
    game.showCityManagement = true;
    game.activeCityManagementTab = 'buildings';
    game.showSubcityList = false;
    game.activeCommandPanel = '';
    game.activeEventId = null;
    if (game.canvasShell) {
      game.canvasShell.showCityManagement = true;
      game.canvasShell.activeCityManagementTab = 'buildings';
      game.canvasShell.showSubcityList = false;
      game.canvasShell.activeCommandPanel = '';
      game.canvasShell.activeEventId = null;
    }
    return true;
  },

  ensureBuildingGuideVisible() {
    const game = this.game || {};
    game.showCityManagement = false;
    game.activeCommandPanel = 'buildings';
    game.activeEventId = null;
    game.showTaskCenter = false;
    if (game.canvasShell) {
      game.canvasShell.showCityManagement = false;
      game.canvasShell.activeCommandPanel = 'buildings';
      game.canvasShell.activeEventId = null;
      game.canvasShell.showTaskCenter = false;
    }
    return true;
  },

  getBuildingCategory(buildingId) {
    const config = this.game?.state?.buildingDefinitions?.[buildingId]
      || this.game?.state?.buildingConfig?.buildings?.[buildingId]
      || this.game?.buildingConfig?.buildings?.[buildingId]
      || null;
    return config?.category || 'all';
  },

  focusBuildingCard(buildingId) {
    const category = this.getBuildingCategory(buildingId);
    const game = this.game || {};
    game.activeBuildingCategory = category;
    game.buildingOffset = 0;
    game.buildingTransition = null;
    if (game.canvasShell) {
      game.canvasShell.activeBuildingCategory = category;
      game.canvasShell.buildingOffset = 0;
      game.canvasShell.buildingTransition = null;
    }
    return true;
  },

  ensureCityPeopleGuideVisible(options = {}) {
    const game = this.game || {};
    const shell = game.canvasShell || null;
    let changed = false;
    const setIfChanged = (host, key, value) => {
      if (!host || host[key] === value) return;
      host[key] = value;
      changed = true;
    };
    const patch = {
      mapHomeActive: true,
      showCityManagement: true,
      activeCityManagementTab: 'people',
      showTaskCenter: false,
      showFamousPersons: false,
      showSubcityList: false,
      activeCommandPanel: '',
      activeEventId: null,
    };
    if (game.state) {
      setIfChanged(game.state, 'currentTab', 'military');
      setIfChanged(game.state, 'militaryView', 'world');
    }
    setIfChanged(game, 'activeTab', 'military');
    setIfChanged(game, 'militaryView', 'world');
    Object.entries(patch).forEach(([key, value]) => setIfChanged(game, key, value));
    if (shell) Object.entries(patch).forEach(([key, value]) => setIfChanged(shell, key, value));
    if (game.territoryUiState) {
      setIfChanged(game.territoryUiState, 'selectedSiteId', '');
      setIfChanged(game.territoryUiState, 'worldMarchTarget', null);
      setIfChanged(game.territoryUiState, 'selectedWorldActorId', '');
      setIfChanged(game.territoryUiState, 'selectedWorldMissionId', '');
    }
    if (shell?.territoryUiState) {
      setIfChanged(shell.territoryUiState, 'selectedSiteId', '');
      setIfChanged(shell.territoryUiState, 'worldMarchTarget', null);
      setIfChanged(shell.territoryUiState, 'selectedWorldActorId', '');
      setIfChanged(shell.territoryUiState, 'selectedWorldMissionId', '');
    }
    game.territoryController?.closeSiteDialog?.({ render: false });
    shell?.closeWorldSiteHud?.({ render: false });
    shell?.hideTutorialHighlight?.();
    if (typeof shell?.renderReadOnly === 'function') {
      shell.renderReadOnly(game.state, 'military', {
        forceMapHome: true,
        isMapHome: true,
      });
    } else if (changed || options.forceRender !== false) {
      game.renderCanvasSurface?.('military');
    }
    return true;
  },

  getCityPeopleGuideHighlightOptions() {
    return {
      renderActiveTab: 'military',
      renderOptions: {
        forceMapHome: true,
        isMapHome: true,
      },
    };
  },

  showBuildingGuide(buildingId, message) {
    this.ensureBuildingGuideVisible();
    this.focusBuildingCard(buildingId);
    return this.showHighlight(
      'buildBuilding',
      (action) => !action.disabled && action.buildingId === buildingId,
      message,
      { type: 'buildBuilding', buildingId },
    );
  }
  });

  function install(TutorialGuideController) {
    if (!TutorialGuideController?.prototype) return false;
    Object.entries(UI_STATE_METHODS).forEach(([name, method]) => {
      TutorialGuideController.prototype[name] = method;
    });
    return true;
  }

  const TutorialGuideUiStateCoordinator = {
    UI_STATE_METHODS,
    install,
  };
  global.TutorialGuideUiStateCoordinator = TutorialGuideUiStateCoordinator;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialGuideUiStateCoordinator;
})(typeof window !== 'undefined' ? window : globalThis);
