(function (global) {
  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
getCanvasGameHost() {
      return this.lastGame || null;
    },

getCanvasActionState() {
      return this.lastGame?.state || {};
    },

runAction(callback) {
      if (typeof this.lastGame?.runAction === 'function') return this.lastGame.runAction(callback);
      return typeof callback === 'function' ? callback() : null;
    },

setPendingBuildingAction(pending = null, options = {}) {
      const nextPending = pending && pending.buildingId
        ? {
          buildingId: pending.buildingId,
          action: pending.action === 'upgrade' ? 'upgrade' : 'build',
        }
        : null;
      this.pendingBuildingAction = nextPending;
      if (this.lastGame && typeof this.lastGame === 'object') {
        this.lastGame.pendingBuildingAction = nextPending;
      }
      if (options.render !== false) this.renderActive();
      return true;
    },

selectBuildingCategory(action = {}) {
      const category = action.category || 'all';
      this.activeBuildingCategory = category;
      this.buildingOffset = 0;
      this.buildingTransition = null;
      if (this.lastGame && typeof this.lastGame === 'object') {
        this.lastGame.activeBuildingCategory = category;
        this.lastGame.buildingOffset = 0;
        this.lastGame.buildingTransition = null;
      }
      return true;
    },

selectTechNode(action = {}) {
      const techId = action.techId || '';
      this.selectedTechId = techId;
      this.techDetailOpen = Boolean(techId);
      if (this.lastGame?.state && typeof this.lastGame.state === 'object') {
        this.lastGame.state = {
          ...this.lastGame.state,
          techUiState: {
            ...(this.lastGame.state.techUiState || {}),
            selectedTechId: techId,
            detailOpen: Boolean(techId),
          },
        };
      }
      return true;
    },

closeTechDetail(action = {}) {
      this.techDetailOpen = false;
      if (this.lastGame?.state && typeof this.lastGame.state === 'object') {
        this.lastGame.state = {
          ...this.lastGame.state,
          techUiState: {
            ...(this.lastGame.state.techUiState || {}),
            detailOpen: false,
          },
        };
      }
      return true;
    },

openFamousPersons() {
      this.showFamousPersons = true;
      this.famousPersonsPage = 0;
      this.selectedFamousPersonId = '';
      this.showTaskCenter = false;
      this.showGuidebook = false;
      this.activeCommandPanel = '';
      return true;
    },

closeFamousPersons() {
      this.showFamousPersons = false;
      this.famousPersonsPage = 0;
      this.selectedFamousPersonId = '';
      const game = this.lastGame || null;
      if (game && typeof game === 'object') {
        if ('showFamousPersons' in game) game.showFamousPersons = false;
        if ('famousPersonsPage' in game) game.famousPersonsPage = 0;
        if ('selectedFamousPersonId' in game) game.selectedFamousPersonId = '';
      }
      this.renderer?.clearFamousSkillTooltip?.();
      game?.tutorialController?.onFamousPersonsClosed?.();
      return true;
    },

openFamousPersonDetail(action = {}) {
      this.selectedFamousPersonId = action.personId || '';
      this.renderer?.clearFamousSkillTooltip?.();
      this.renderActive();
      return true;
    },

closeFamousPersonDetail() {
      this.selectedFamousPersonId = '';
      this.renderer?.clearFamousSkillTooltip?.();
      this.renderActive();
      return true;
    },

getArmyFormation(cityId, slot) {
      const state = this.lastGame?.state || {};
      const targetCityId = cityId || state.activeCityId || state.cityState?.activeCityId || 'capital';
      const targetSlot = Math.max(1, Math.min(3, Number(slot) || 1));
      const formations = state.military?.formations || {};
      const cityFormations = Array.isArray(formations[targetCityId]) ? formations[targetCityId] : [];
      return cityFormations.find((item) => Number(item?.slot) === targetSlot) || cityFormations[targetSlot - 1] || null;
    },

setArmyFormationEditor(editor = {}, options = {}) {
      this.armyFormationEditor = {
        open: false,
        cityId: '',
        slot: 1,
        memberIds: [],
        page: 0,
        saving: false,
        ...(editor || {}),
      };
      if (this.lastGame && typeof this.lastGame === 'object') {
        this.lastGame.armyFormationEditor = { ...this.armyFormationEditor };
      }
      if (options.render !== false) this.renderActive();
      return true;
    },

openArmyFormation(action = {}) {
      const game = this.lastGame;
      if (game && game !== this && typeof game.openArmyFormation === 'function') {
        const opened = game.openArmyFormation(action);
        this.armyFormationEditor = { ...(game.armyFormationEditor || this.armyFormationEditor || {}) };
        return opened !== false;
      }
      const slot = Math.max(1, Math.min(3, Number(action.slot) || 1));
      const cityId = action.cityId || game?.state?.activeCityId || game?.state?.cityState?.activeCityId || 'capital';
      const formation = this.getArmyFormation(cityId, slot);
      const memberIds = Array.isArray(formation?.memberIds) ? formation.memberIds : [];
      return this.setArmyFormationEditor({
        open: true,
        cityId,
        slot,
        memberIds: [...memberIds].slice(0, 5),
        page: 0,
        saving: false,
      });
    },

closeArmyFormationEditor(options = {}) {
      const game = this.lastGame;
      if (game && game !== this && typeof game.closeArmyFormationEditor === 'function') {
        const closed = game.closeArmyFormationEditor({ render: false });
        this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
        if (options.render !== false) this.renderActive();
        return closed !== false;
      }
      return this.setArmyFormationEditor({ open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false }, options);
    },

toggleArmyFormationMember(action = {}) {
      const game = this.lastGame;
      if (game && game !== this && typeof game.toggleArmyFormationMember === 'function') {
        const result = game.toggleArmyFormationMember(action);
        this.armyFormationEditor = { ...(game.armyFormationEditor || this.armyFormationEditor || {}) };
        return result !== false;
      }
      const editor = this.armyFormationEditor || {};
      if (!editor.open) return false;
      const personId = String(action.personId || '').trim();
      if (!personId) return false;
      const memberIds = Array.isArray(editor.memberIds) ? [...editor.memberIds] : [];
      const index = memberIds.indexOf(personId);
      if (index >= 0) memberIds.splice(index, 1);
      else {
        if (memberIds.length >= 5) {
          this.showFloatingText('每个编队最多 5 名名人');
          return false;
        }
        memberIds.push(personId);
      }
      return this.setArmyFormationEditor({ ...editor, memberIds }, { render: true });
    },

changeArmyFormationPage(action = {}) {
      const game = this.lastGame;
      if (game && game !== this && typeof game.changeArmyFormationPage === 'function') {
        const result = game.changeArmyFormationPage(action);
        this.armyFormationEditor = { ...(game.armyFormationEditor || this.armyFormationEditor || {}) };
        return result !== false;
      }
      const editor = this.armyFormationEditor || {};
      if (!editor.open) return false;
      const page = Math.max(0, (Number(editor.page) || 0) + (Number(action.delta) || 0));
      return this.setArmyFormationEditor({ ...editor, page }, { render: true });
    },

saveArmyFormation() {
      const game = this.lastGame;
      if (game && game !== this && typeof game.saveArmyFormation === 'function') {
        const result = game.saveArmyFormation();
        if (result && typeof result.then === 'function') {
          result.finally(() => {
            this.armyFormationEditor = { ...(game.armyFormationEditor || this.armyFormationEditor || {}) };
          });
          return result;
        }
        this.armyFormationEditor = { ...(game.armyFormationEditor || this.armyFormationEditor || {}) };
        return result !== false;
      }
      return false;
    },

enterCity(action = {}) {
      const game = this.lastGame;
      const cityId = action.cityId || action.territoryId || action.siteId || game?.state?.activeCityId || 'capital';
      const tab = action.tab || 'buildings';
      if (typeof game?.enterCity === 'function') return game.enterCity(cityId, { tab });
      this.showCityManagement = true;
      this.activeCityManagementTab = tab;
      this.showSubcityList = false;
      this.activeCommandPanel = '';
      this.activeEventId = null;
      this.renderActive();
      return true;
    },

openCityManagement(action = {}) {
      const tab = action.tab || 'buildings';
      this.showCityManagement = true;
      this.activeCityManagementTab = tab;
      this.showSubcityList = false;
      this.activeCommandPanel = '';
      this.activeEventId = null;
      this.renderActive();
      return true;
    },

closeCityManagement() {
      this.showCityManagement = false;
      this.renderActive();
      return true;
    },

switchCityManagementTab(tab = 'buildings') {
      const allowed = ['buildings', 'people', 'military'];
      this.activeCityManagementTab = allowed.includes(tab) ? tab : 'buildings';
      if (this.lastGame && typeof this.lastGame === 'object') {
        this.lastGame.activeCityManagementTab = this.activeCityManagementTab;
      }
      this.renderActive();
      return true;
    },

changeFamousPersonsPage(action = {}) {
      const delta = Number(action.delta) || 0;
      this.famousPersonsPage = Math.max(0, (Number(this.famousPersonsPage) || 0) + delta);
      this.selectedFamousPersonId = '';
      this.renderer?.clearFamousSkillTooltip?.();
      this.renderActive();
      return true;
    },

resetForCanvasTabSwitch() {
      this.buildingOffset = 0;
      this.activeBuildingCategory = 'all';
      this.techTreePanX = 0;
      this.techTreePanY = 0;
      this.techTreeZoom = 1;
      this.selectedTechId = '';
      this.techDetailOpen = false;
      this.techTreeDragStart = null;
      this.buildingTransition = null;
      this.activeEventId = null;
      this.showGuidebook = false;
      this.showFamousPersons = false;
      this.showCityManagement = false;
      this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
      this.rewardReveal = null;
      this.famousPersonsPage = 0;
      this.selectedFamousPersonId = '';
      this.renderer?.clearFamousSkillTooltip?.();
    },

resetLocalViewToResources(options = {}) {
      const homeView = this.resolveMapHomeViewState(this.lastGame?.state || {}, { requestedTab: 'resources', forceMapHome: true });
      this.buildingOffset = 0;
      this.activeBuildingCategory = 'all';
      this.techTreePanX = 0;
      this.techTreePanY = 0;
      this.techTreeZoom = 1;
      this.selectedTechId = '';
      this.techDetailOpen = false;
      this.techTreeDragStart = null;
      this.pageTransition = null;
      this.buildingTransition = null;
      this.activeEventId = null;
      this.territoryUiState = {
        ...(this.territoryUiState || {}),
        selectedSiteId: '',
        expeditionConfigSiteId: '',
        expeditionSoldiers: '',
        expeditionTroopType: '',
        expeditionLeader: '',
      };
      this.clearWorldSiteHudSelection?.();
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.showSubcityList = false;
      this.showCityManagement = false;
      this.showAdvisor = false;
      this.showTaskCenter = false;
      this.showGuidebook = false;
      this.showFamousPersons = false;
      this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
      this.activeCommandPanel = '';
      this.famousPersonsPage = 0;
      this.selectedFamousPersonId = '';
      this.renderer?.clearFamousSkillTooltip?.();
      this.activeTaskCenterTab = 'main';
      this.activeGuidebookTab = 'planning';
      const game = this.lastGame;
      if (game?.state && typeof game.state === 'object') {
        game.state = {
          ...game.state,
          currentTab: homeView.activeTab,
          militaryView: homeView.militaryView,
        };
      }
      if (game && 'activeTab' in game) game.activeTab = homeView.activeTab;
      if (game && 'militaryView' in game) game.militaryView = homeView.militaryView;
      if (game && 'mapHomeActive' in game) game.mapHomeActive = homeView.isMapHome;
      if (!options.skipGame && game?.resetLocalViewToResources) {
        game.resetLocalViewToResources({ skipShell: true, skipRender: true });
      }
      if (!options.skipRender) this.renderReadOnly(game?.state, homeView.activeTab);
      return true;
    },

forwardCanvasAction(action, meta = {}) {
      if (!this.onAction) return undefined;
      const result = this.onAction(action, meta.event, meta);
      const syncAfterAllowed = (value) => {
        const forwarded = value !== false;
        if (forwarded) this.syncForwardedLocalAction(action);
        return forwarded;
      };
      if (result && typeof result.then === 'function') return result.then(syncAfterAllowed);
      return syncAfterAllowed(result);
    },

syncForwardedLocalAction(action = {}) {
      if (action.type === 'openWorldSite') {
        const siteId = action.siteId || action.territoryId || action.cityId || '';
        if (!siteId) return false;
        const territory = this.lastGame?.territoryController || null;
        if (territory?.openSiteDialog) territory.openSiteDialog(siteId);
        this.territoryUiState = this.territoryUiState || {};
        this.territoryUiState.selectedSiteId = siteId;
        if (this.lastGame && typeof this.lastGame === 'object') {
          this.lastGame.territoryUiState = this.lastGame.territoryUiState || {};
          this.lastGame.territoryUiState.selectedSiteId = siteId;
        }
        this.lastGame?.tutorialController?.refreshCurrentHighlight?.();
        return true;
      }
      return false;
    },

renderCanvasAction(action = {}) {
      this.renderActive();
      return true;
    },

clearWorldSiteHudSelection() {
      const clearUiState = (uiState) => {
        if (!uiState || typeof uiState !== 'object') return false;
        const hadValue = Boolean(
          uiState.selectedSiteId
          || uiState.worldMarchTarget
          || uiState.selectedWorldActorId
          || uiState.expeditionConfigSiteId
          || uiState.expeditionSoldiers
          || uiState.expeditionTroopType
          || uiState.expeditionLeader
        );
        uiState.selectedSiteId = '';
        uiState.worldMarchTarget = null;
        uiState.selectedWorldActorId = '';
        uiState.expeditionConfigSiteId = '';
        uiState.expeditionSoldiers = '';
        uiState.expeditionTroopType = '';
        uiState.expeditionLeader = '';
        return hadValue;
      };
      let changed = false;
      const territoryController = this.lastGame?.territoryController || null;
      const controllerUiState = territoryController?.uiState || null;
      changed = clearUiState(controllerUiState) || changed;
      if (territoryController?.closeSiteDialog) {
        territoryController.closeSiteDialog({ render: false });
      }
      changed = clearUiState(this.territoryUiState) || changed;
      changed = clearUiState(this.lastGame?.territoryUiState) || changed;
      return changed;
    },

closeWorldSiteHud(options = {}) {
      const changed = this.clearWorldSiteHudSelection();
      if (!changed) return false;
      if (options.render === false) return true;
      if (options.direct || this.isWorldMapDragging()) {
        return this.renderReadOnly(this.lastGame?.state, this.getActiveTab()) !== false;
      }
      return this.renderActive({ invalidateWorldTileView: false }) !== false;
    }
    });
    return true;
  }

  const api = { install };

  global.CanvasGameShellCommands = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
