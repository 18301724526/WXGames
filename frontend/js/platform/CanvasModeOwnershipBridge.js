(function (global) {
  const EcsModeRuntime = (() => {
    if (global.EcsModeRuntime) return global.EcsModeRuntime;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/mode/EcsModeRuntimeEntry');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function isTruthy(value) {
    return Boolean(value);
  }

  function getStateHost(host) {
    return host?.lastGame || host;
  }

  function resolveBaseModeKey(host) {
    const game = getStateHost(host);
    const activeTab =
      game?.state?.currentTab ||
      game?.activeTab ||
      host?.state?.currentTab ||
      host?.activeTab ||
      'resources';
    const militaryView =
      game?.state?.militaryView ||
      game?.militaryView ||
      host?.state?.militaryView ||
      host?.militaryView ||
      'army';
    if (
      (activeTab === 'military' || activeTab === 'territory' || activeTab === 'resources') &&
      militaryView === 'world'
    )
      return 'worldMap';
    if (activeTab === 'tech') return 'techTree';
    if (isTruthy(host?.armyFormationEditor?.open) || isTruthy(game?.armyFormationEditor?.open))
      return 'formationEditor';
    if (isTruthy(host?.battleScene?.visible) || isTruthy(game?.battleScene?.visible))
      return 'battle';
    if (
      activeTab === 'resources' ||
      activeTab === 'buildings' ||
      activeTab === 'people' ||
      activeTab === 'military'
    )
      return 'city';
    return 'city';
  }

  function collectModalKeys(host) {
    const game = getStateHost(host);
    const keys = [];
    if (isTruthy(host?.naming?.visible) || isTruthy(game?.naming?.visible))
      keys.push('modal:naming');
    if (isTruthy(host?.activeEventId) || isTruthy(game?.activeEventId)) keys.push('modal:event');
    if (isTruthy(host?.rewardReveal) || isTruthy(game?.rewardReveal))
      keys.push('modal:rewardReveal');
    if (isTruthy(host?.confirmDialog?.visible) || isTruthy(game?.confirmDialog?.visible))
      keys.push('modal:confirmDialog');
    const territoryUiState =
      host?.territoryUiState || game?.territoryUiState || game?.territoryController?.uiState || {};
    if (
      isTruthy(territoryUiState?.worldTargetPicker) ||
      isTruthy(territoryUiState?.worldMarchTarget?.pickerOpen)
    )
      keys.push('modal:targetPicker');
    if (
      isTruthy(host?.showSettings) ||
      isTruthy(host?.showLogs) ||
      isTruthy(host?.showResourceDetails) ||
      isTruthy(host?.showCitySwitcher) ||
      isTruthy(host?.showSubcityList) ||
      isTruthy(host?.showCityManagement) ||
      isTruthy(host?.showAdvisor) ||
      isTruthy(host?.tutorialAdvisorDialogue) ||
      isTruthy(game?.tutorialAdvisorDialogue) ||
      isTruthy(host?.showTaskCenter) ||
      isTruthy(host?.showGuidebook) ||
      isTruthy(host?.showFamousPersons) ||
      isTruthy(host?.armyFormationEditor?.open) ||
      isTruthy(game?.armyFormationEditor?.open) ||
      isTruthy(host?.activeCommandPanel) ||
      isTruthy(host?.techDetailOpen) ||
      isTruthy(game?.techDetailOpen)
    ) {
      keys.push('modal:blockingPanel');
    }
    return Array.from(new Set(keys));
  }

  function hasBlockingOverlayExceptTechTree(host) {
    const game = getStateHost(host);
    return Boolean(
      isTruthy(host?.showSettings) ||
      isTruthy(host?.showLogs) ||
      isTruthy(host?.showResourceDetails) ||
      isTruthy(host?.showCitySwitcher) ||
      isTruthy(host?.showSubcityList) ||
      isTruthy(host?.showCityManagement) ||
      isTruthy(host?.showAdvisor) ||
      isTruthy(host?.tutorialAdvisorDialogue) ||
      isTruthy(game?.tutorialAdvisorDialogue) ||
      isTruthy(host?.showTaskCenter) ||
      isTruthy(host?.showGuidebook) ||
      isTruthy(host?.showFamousPersons) ||
      isTruthy(host?.armyFormationEditor?.open) ||
      isTruthy(game?.armyFormationEditor?.open) ||
      isTruthy(host?.confirmDialog?.visible) ||
      (isTruthy(host?.activeCommandPanel) && host.activeCommandPanel !== 'tech') ||
      isTruthy(host?.techDetailOpen) ||
      isTruthy(game?.techDetailOpen) ||
      isTruthy(host?.activeEventId) ||
      isTruthy(game?.activeEventId) ||
      isTruthy(host?.naming?.visible) ||
      isTruthy(game?.naming?.visible) ||
      isTruthy(host?.battleScene?.visible) ||
      isTruthy(game?.battleScene?.visible) ||
      isTruthy(host?.entityBattle?.visible) ||
      isTruthy(game?.entityBattle?.visible) ||
      isTruthy(host?.rewardReveal) ||
      isTruthy(game?.rewardReveal),
    );
  }

  function deriveModeFacts(host) {
    const game = getStateHost(host);
    const modalKeys = collectModalKeys(host);
    const entityBattle = host?.entityBattle || game?.entityBattle || null;
    const tutorialIntro = game?.tutorialIntro || host?.tutorialIntro || null;
    const tutorialHighlight = host?.tutorialHighlight || game?.tutorialHighlight || null;
    const baseModeKey = resolveBaseModeKey(host);
    return {
      baseModeKey,
      modalKeys,
      tutorialActive: isTruthy(tutorialIntro?.active) || isTruthy(tutorialHighlight),
      debugActive: isTruthy(global.__actorPickingDiag) || isTruthy(global.__wxgameDebugMode),
      blockingOverlayActive: modalKeys.length > 0 || isTruthy(entityBattle?.visible),
      techTreeBlockingOverlayActive: hasBlockingOverlayExceptTechTree(host),
      entityBattleActive: isTruthy(entityBattle?.visible),
      worldMapHomeActive:
        isTruthy(host?.mapHomeActive) ||
        isTruthy(game?.mapHomeActive) ||
        baseModeKey === 'worldMap',
      techTreeActive: baseModeKey === 'techTree' || host?.activeCommandPanel === 'tech',
      formationEditorActive:
        isTruthy(host?.armyFormationEditor?.open) || isTruthy(game?.armyFormationEditor?.open),
    };
  }

  function ensureModeOwner(host) {
    if (!EcsModeRuntime?.ensureModeWorld) return null;
    host.__ecsModeOwner = EcsModeRuntime.ensureModeWorld(host.__ecsModeOwner);
    return host.__ecsModeOwner;
  }

  function refreshModeSnapshot(host) {
    const owner = ensureModeOwner(host);
    if (!owner || !EcsModeRuntime?.updateModeWorld) return null;
    const result = EcsModeRuntime.updateModeWorld(owner, deriveModeFacts(host));
    host.__ecsModeOwner = result.modeOwner;
    host.__ecsModeSnapshot = result.snapshot;
    return result.snapshot;
  }

  function getModeSnapshot(host) {
    return refreshModeSnapshot(host) || host?.__ecsModeSnapshot || null;
  }

  function getFallbackModeFacts(host) {
    return deriveModeFacts(host);
  }

  function install(TargetClass) {
    if (!TargetClass?.prototype) return false;
    Object.assign(TargetClass.prototype, {
      getModeSnapshot() {
        return getModeSnapshot(this);
      },

      refreshModeSnapshot() {
        return refreshModeSnapshot(this);
      },

      deriveModeFacts() {
        return deriveModeFacts(this);
      },

      isModeBlockingOverlayOpen() {
        const snapshot = getModeSnapshot(this);
        return snapshot
          ? EcsModeRuntime.isBlockingOverlayOpen(snapshot)
          : getFallbackModeFacts(this).blockingOverlayActive;
      },

      isModeEntityBattleActive() {
        const snapshot = getModeSnapshot(this);
        return snapshot
          ? EcsModeRuntime.isEntityBattleActive(snapshot)
          : getFallbackModeFacts(this).entityBattleActive;
      },

      canRouteModeWorldMap() {
        const snapshot = getModeSnapshot(this);
        if (snapshot) return EcsModeRuntime.canRouteWorldMap(snapshot);
        const facts = getFallbackModeFacts(this);
        return facts.baseModeKey === 'worldMap' && !facts.blockingOverlayActive;
      },

      canRouteModeTechTree() {
        const snapshot = getModeSnapshot(this);
        if (snapshot) return EcsModeRuntime.canRouteTechTree(snapshot);
        const facts = getFallbackModeFacts(this);
        return facts.techTreeActive && !facts.techTreeBlockingOverlayActive;
      },
    });
    return true;
  }

  const api = {
    collectModalKeys,
    deriveModeFacts,
    getModeSnapshot,
    hasBlockingOverlayExceptTechTree,
    install,
    refreshModeSnapshot,
    resolveBaseModeKey,
  };

  global.CanvasModeOwnershipBridge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
