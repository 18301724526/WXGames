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

  const ModalCallbackRegistry = (() => {
    if (global.ModalCallbackRegistry) return global.ModalCallbackRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./ModalCallbackRegistry');
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

  function resolveInputIntent(host, physicalIntent) {
    const snapshot = getModeSnapshot(host);
    if (!snapshot || !EcsModeRuntime?.resolveInputIntent) return null;
    return EcsModeRuntime.resolveInputIntent(physicalIntent, snapshot);
  }

  function getModalWorldApi() {
    return EcsModeRuntime && EcsModeRuntime.ModalWorld ? EcsModeRuntime.ModalWorld : null;
  }

  function ensureModalOwner(host) {
    const ModalWorld = getModalWorldApi();
    if (!ModalWorld) return null;
    if (!host.__ecsModalOwner) host.__ecsModalOwner = ModalWorld.createModalWorld();
    if (!host.__modalCallbacks && ModalCallbackRegistry) {
      host.__modalCallbacks = ModalCallbackRegistry.createModalCallbackRegistry();
    }
    return host.__ecsModalOwner;
  }

  // Open a covered modal subtype: the owner becomes the source of truth, mints a
  // token, and (for subtypes with continuations) registers callbacks by token.
  // Returns the frozen owner payload the host uses as its read-only mirror, or
  // null when the runtime is unavailable so the host keeps its legacy field.
  function openModal(host, subtype, payload = {}, callbacks = null) {
    const ModalWorld = getModalWorldApi();
    if (!ModalWorld || !ensureModalOwner(host)) return null;
    host.__ecsModalOwner = ModalWorld.openModal(host.__ecsModalOwner, subtype, payload);
    if (callbacks && host.__modalCallbacks) {
      host.__modalCallbacks.register(
        ModalWorld.getModalToken(host.__ecsModalOwner, subtype),
        callbacks,
      );
    }
    return ModalWorld.getModalPayload(host.__ecsModalOwner, subtype);
  }

  function updateModalPayload(host, subtype, patch = {}) {
    const ModalWorld = getModalWorldApi();
    if (!ModalWorld || !host.__ecsModalOwner) return null;
    host.__ecsModalOwner = ModalWorld.updateModalPayload(host.__ecsModalOwner, subtype, patch);
    return ModalWorld.getModalPayload(host.__ecsModalOwner, subtype);
  }

  function closeModal(host, subtype) {
    const ModalWorld = getModalWorldApi();
    if (!ModalWorld || !host.__ecsModalOwner) return null;
    if (host.__modalCallbacks) {
      host.__modalCallbacks.clear(ModalWorld.getModalToken(host.__ecsModalOwner, subtype));
    }
    host.__ecsModalOwner = ModalWorld.closeModal(host.__ecsModalOwner, subtype);
    return null;
  }

  function getModalPayload(host, subtype) {
    const ModalWorld = getModalWorldApi();
    if (!ModalWorld || !host.__ecsModalOwner) return null;
    return ModalWorld.getModalPayload(host.__ecsModalOwner, subtype);
  }

  function isModalOpen(host, subtype) {
    const ModalWorld = getModalWorldApi();
    if (!ModalWorld || !host.__ecsModalOwner) return false;
    return ModalWorld.isModalOpen(host.__ecsModalOwner, subtype);
  }

  function resolveModalCallback(host, subtype, action, ...args) {
    const ModalWorld = getModalWorldApi();
    if (!ModalWorld || !host.__ecsModalOwner || !host.__modalCallbacks) return undefined;
    return host.__modalCallbacks.resolve(
      ModalWorld.getModalToken(host.__ecsModalOwner, subtype),
      action,
      ...args,
    );
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

      resolveInputIntent(physicalIntent) {
        return resolveInputIntent(this, physicalIntent);
      },

      openModal(subtype, payload, callbacks) {
        return openModal(this, subtype, payload, callbacks);
      },

      updateModalPayload(subtype, patch) {
        return updateModalPayload(this, subtype, patch);
      },

      closeModal(subtype) {
        return closeModal(this, subtype);
      },

      getModalPayload(subtype) {
        return getModalPayload(this, subtype);
      },

      isModalOpen(subtype) {
        return isModalOpen(this, subtype);
      },

      resolveModalCallback(subtype, action, ...args) {
        return resolveModalCallback(this, subtype, action, ...args);
      },

      // Naming-specific convenience wrappers. The subtype literal and the legacy
      // mirror fallback live here (the bridge is an approved owner path) so the
      // host call sites stay one-line and do not grow legacy `naming` references.
      openNamingModal(state) {
        return openModal(this, 'modal:naming', state) || state;
      },

      closeNamingOwner() {
        return closeModal(this, 'modal:naming');
      },

      updateNamingPayload(patch) {
        return (
          updateModalPayload(this, 'modal:naming', patch) || { ...(this.naming || {}), ...patch }
        );
      },

      // confirmDialog-specific wrappers: the subtype literal, the legacy mirror
      // fallback, and the callbacks plumbing live here (approved bridge path).
      // confirmDialog keeps kind-dispatch for its continuation; the registry is
      // wired (resolve-if-present) and stays ready for a closure-continuation modal.
      openConfirmDialogModal(state, callbacks) {
        return openModal(this, 'modal:confirmDialog', state, callbacks) || state;
      },

      closeConfirmDialogOwner() {
        return closeModal(this, 'modal:confirmDialog');
      },

      updateConfirmDialogPayload(patch) {
        return (
          updateModalPayload(this, 'modal:confirmDialog', patch) || {
            ...(this.confirmDialog || {}),
            ...patch,
          }
        );
      },

      resolveConfirmDialogCallback(type, ...args) {
        return resolveModalCallback(this, 'modal:confirmDialog', type, ...args);
      },

      // rewardReveal-specific wrappers (pure presentation; no callbacks). The
      // subtype literal lives here so host call sites stay one-line.
      openRewardRevealModal(state) {
        return openModal(this, 'modal:rewardReveal', state) || state;
      },

      closeRewardRevealOwner() {
        return closeModal(this, 'modal:rewardReveal');
      },
    });
    return true;
  }

  const api = {
    closeModal,
    collectModalKeys,
    deriveModeFacts,
    getModalPayload,
    getModeSnapshot,
    hasBlockingOverlayExceptTechTree,
    install,
    isModalOpen,
    openModal,
    refreshModeSnapshot,
    resolveBaseModeKey,
    resolveInputIntent,
    resolveModalCallback,
    updateModalPayload,
  };

  global.CanvasModeOwnershipBridge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
