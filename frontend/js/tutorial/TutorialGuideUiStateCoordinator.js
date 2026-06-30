(function (global) {

  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key, params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  const CanvasModalSnapshotAdapter = (() => {
    if (global.CanvasModalSnapshotAdapter) return global.CanvasModalSnapshotAdapter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../platform/CanvasModalSnapshotAdapter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const { openBlockingPanelSnapshot, closeBlockingPanelSnapshot, isBlockingPanelSnapshotOpen } = global.CanvasBlockingPanelSnapshotCalls || (typeof require !== 'undefined' ? require('../platform/CanvasBlockingPanelSnapshotCalls') : {});
  var StateWriter = global.StateWriter;
  if (typeof module !== 'undefined' && module.exports && !StateWriter) {
    StateWriter = require('../state/StateWriter');
  }

  function getCommandPanelValue(host) {
    if (typeof host?.getCommandPanelValue === 'function') return host.getCommandPanelValue();
    return CanvasModalSnapshotAdapter?.getCommandPanelValue?.(host) || '';
  }

  const UI_STATE_METHODS = Object.freeze({
  clearBlockingCommandPanels() {
    const game = this.game || {};
    let changed = false;
    if (isBlockingPanelSnapshotOpen(game, 'activeCommandPanel')) {
      closeBlockingPanelSnapshot(game, 'activeCommandPanel');
      changed = true;
    }
    return changed;
  },

  showSoftGuide(target, message) {
    const game = this.game || {};
    game.canvasShell?.hideTutorialHighlight?.();
    const dialogue = { message, advisorName: t('tutorial.advisorName'), source: `softGuide:${target || 'tutorial'}` };
    StateWriter.commit(game, (prev) => ({
      ...(prev || {}),
      softGuide: {
        mode: 'strong',
        target,
        message,
      },
    }), { source: 'tutorialUiState:softGuide' });
    closeBlockingPanelSnapshot(game, 'showAdvisor');
    game.tutorialAdvisorDialogue = dialogue;
    if (game.canvasShell) {
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
    // The adapter reads/writes the canonical modal owner; read the snapshot BEFORE
    // closing so the 'changed' re-render gate stays accurate.
    const closeIfOpen = (key) => {
      if (isBlockingPanelSnapshotOpen(game, key)) {
        closeBlockingPanelSnapshot(game, key);
        changed = true;
      }
    };
    const activeCommandPanel = getCommandPanelValue(game);
    if (activeCommandPanel && activeCommandPanel !== panelId) {
      closeBlockingPanelSnapshot(game, 'activeCommandPanel');
      changed = true;
    }
    closeIfOpen('showCityManagement');
    closeIfOpen('showSubcityList');
    closeIfOpen('showTaskCenter');
    closeIfOpen('showFamousPersons');
    if (game.selectedFamousPersonId) {
      game.selectedFamousPersonId = '';
      changed = true;
    }
    if (game.isEventSnapshotOpen?.()) {
      game.closeEventSnapshot?.();
      changed = true;
    } else if (shell?.isEventSnapshotOpen?.()) {
      shell.closeEventSnapshot?.();
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
    openBlockingPanelSnapshot(game, 'showCityManagement', true);
    game.activeCityManagementTab = 'buildings';
    closeBlockingPanelSnapshot(game, 'showSubcityList');
    closeBlockingPanelSnapshot(game, 'activeCommandPanel');
    game.closeEventSnapshot?.();
    return true;
  },

  ensureBuildingGuideVisible() {
    const game = this.game || {};
    closeBlockingPanelSnapshot(game, 'showCityManagement');
    openBlockingPanelSnapshot(game, 'activeCommandPanel', 'buildings');
    game.closeEventSnapshot?.();
    closeBlockingPanelSnapshot(game, 'showTaskCenter');
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
    // Read the snapshot BEFORE mutating so the 'changed' re-render gate stays accurate.
    const openPanelIfChanged = (key, value) => {
      const open = isBlockingPanelSnapshotOpen(game, key);
      if (open === Boolean(value)) return;
      openBlockingPanelSnapshot(game, key, value);
      changed = true;
    };
    const closePanelIfChanged = (key) => {
      if (!isBlockingPanelSnapshotOpen(game, key)) return;
      closeBlockingPanelSnapshot(game, key);
      changed = true;
    };
    if (game.state) {
      setIfChanged(game.state, 'currentTab', 'military');
      setIfChanged(game.state, 'militaryView', 'world');
    }
    setIfChanged(game, 'activeTab', 'military');
    setIfChanged(game, 'militaryView', 'world');
    setIfChanged(game, 'mapHomeActive', true);
    setIfChanged(game, 'activeCityManagementTab', 'people');
    openPanelIfChanged('showCityManagement', true);
    closePanelIfChanged('showTaskCenter');
    closePanelIfChanged('showFamousPersons');
    closePanelIfChanged('showSubcityList');
    closePanelIfChanged('activeCommandPanel');
    if (game.isEventSnapshotOpen?.()) {
      game.closeEventSnapshot?.();
      changed = true;
    }
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
    Object.assign(TutorialGuideController.prototype, UI_STATE_METHODS);
    return true;
  }

  const TutorialGuideUiStateCoordinator = {
    UI_STATE_METHODS,
    install,
  };
  global.TutorialGuideUiStateCoordinator = TutorialGuideUiStateCoordinator;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialGuideUiStateCoordinator;
})(typeof window !== 'undefined' ? window : globalThis);
