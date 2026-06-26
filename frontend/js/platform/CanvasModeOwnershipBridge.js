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

  function readBattleDomainSnapshot(host) {
    const BattleDomainOwner = getBattleDomainOwnerApi();
    const owner =
      host?.__ecsBattleDomainOwner ||
      host?.lastGame?.__ecsBattleDomainOwner ||
      host?.getCanvasGameHost?.()?.__ecsBattleDomainOwner ||
      null;
    if (BattleDomainOwner?.getBattleDomainSnapshot && owner) {
      return BattleDomainOwner.getBattleDomainSnapshot(owner);
    }
    return null;
  }

  function resolveBaseModeKey(host) {
    const game = getStateHost(host);
    const battleSnapshot = readBattleDomainSnapshot(host);
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
    if (isTruthy(battleSnapshot?.battleScene?.visible)) return 'battle';
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
    const battleSnapshot = readBattleDomainSnapshot(host);
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
      isTruthy(battleSnapshot?.battleScene?.visible) ||
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

  function getRendererSnapshotBoundaryApi() {
    return EcsModeRuntime && EcsModeRuntime.RendererSnapshotBoundary
      ? EcsModeRuntime.RendererSnapshotBoundary
      : null;
  }

  function getBattleDomainOwnerApi() {
    return EcsModeRuntime && EcsModeRuntime.BattleDomainOwner
      ? EcsModeRuntime.BattleDomainOwner
      : null;
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

  function collectEventMirrorTargets(host) {
    if (!host || typeof host !== 'object') return [];
    const game = host.getCanvasGameHost?.() || host.lastGame || host;
    const shell = game?.canvasShell || host.canvasShell || host.lastGame?.canvasShell || null;
    return [host, game, shell].filter(
      (target, index, targets) =>
        target && typeof target === 'object' && targets.indexOf(target) === index,
    );
  }

  function syncEventMirrors(host, eventId = null) {
    const mirrorValue = eventId ?? null;
    collectEventMirrorTargets(host).forEach((target) => {
      target.activeEventId = mirrorValue;
    });
    return mirrorValue;
  }

  function openEventModal(host, eventId) {
    const mirrorValue = syncEventMirrors(host, eventId);
    if (mirrorValue === null) return mirrorValue;
    const payload = openModal(host, 'modal:event', { eventId: mirrorValue }) || {
      eventId: mirrorValue,
    };
    return payload?.eventId ?? mirrorValue;
  }

  function closeEventOwner(host) {
    closeModal(host, 'modal:event');
    return syncEventMirrors(host, null);
  }

  function resolveTerritoryUiState(host, uiState = null) {
    if (uiState && typeof uiState === 'object') return uiState;
    const game = host?.getCanvasGameHost?.() || host?.lastGame || host;
    const territoryController = host?.territoryController || game?.territoryController || null;
    return (
      territoryController?.uiState ||
      host?.territoryUiState ||
      game?.territoryUiState ||
      territoryController?.getUiState?.() ||
      {}
    );
  }

  function collectTerritoryMirrorTargets(host) {
    if (!host || typeof host !== 'object') return [];
    const game = host.getCanvasGameHost?.() || host.lastGame || host;
    const shell = game?.canvasShell || host.canvasShell || host.lastGame?.canvasShell || null;
    const territoryController = host.territoryController || game?.territoryController || null;
    return [host, game, shell, territoryController].filter(
      (target, index, targets) =>
        target && typeof target === 'object' && targets.indexOf(target) === index,
    );
  }

  function syncTerritoryUiStateMirror(host, uiState) {
    const game = host?.getCanvasGameHost?.() || host?.lastGame || host;
    const territoryController = host?.territoryController || game?.territoryController || null;
    collectTerritoryMirrorTargets(host, uiState).forEach((target) => {
      if (target === territoryController || 'uiState' in target) {
        target.uiState = uiState;
      } else {
        target.territoryUiState = uiState;
      }
    });
    return uiState;
  }

  function openWorldTargetPickerOwner(host, uiState, picker) {
    if (!picker) return null;
    const mirror = syncTerritoryUiStateMirror(host, resolveTerritoryUiState(host, uiState));
    mirror.worldTargetPicker = picker;
    mirror.worldMarchTarget = null;
    const payload = openModal(host, 'modal:targetPicker', {
      pickerKind: 'worldTargetPicker',
      picker,
    });
    return payload?.picker || picker;
  }

  function openWorldMarchFormationPickerOwner(host, uiState, target) {
    if (!target) return null;
    const mirror = syncTerritoryUiStateMirror(host, resolveTerritoryUiState(host, uiState));
    mirror.worldMarchTarget = { ...target, pickerOpen: true };
    mirror.worldTargetPicker = null;
    const payload = openModal(host, 'modal:targetPicker', {
      pickerKind: 'worldMarchFormation',
      target: mirror.worldMarchTarget,
    });
    return payload?.target || mirror.worldMarchTarget;
  }

  function closeTargetPickerOwner(host, uiState = null) {
    closeModal(host, 'modal:targetPicker');
    const mirror = syncTerritoryUiStateMirror(host, resolveTerritoryUiState(host, uiState));
    mirror.worldTargetPicker = null;
    if (mirror.worldMarchTarget?.pickerOpen) {
      mirror.worldMarchTarget = { ...mirror.worldMarchTarget, pickerOpen: false };
    }
    return mirror;
  }

  const BLOCKING_PANEL_KINDS = Object.freeze({
    showSettings: 'settings',
    showLogs: 'logs',
    showResourceDetails: 'resourceDetails',
    showCitySwitcher: 'citySwitcher',
    showSubcityList: 'subcityList',
    showCityManagement: 'cityManagement',
    showAdvisor: 'advisor',
    showTaskCenter: 'taskCenter',
    showGuidebook: 'guidebook',
    showFamousPersons: 'famousPersons',
    activeCommandPanel: 'commandPanel',
    techDetailOpen: 'techDetail',
  });

  const BLOCKING_PANEL_KEYS = Object.freeze(Object.keys(BLOCKING_PANEL_KINDS));

  function normalizeBlockingPanelValue(panelKey, value) {
    if (panelKey === 'activeCommandPanel') return String(value || '');
    return Boolean(value);
  }

  function isBlockingPanelOpenValue(panelKey, value) {
    return panelKey === 'activeCommandPanel' ? Boolean(value) : Boolean(value);
  }

  function collectBlockingPanelMirrorTargets(host) {
    if (!host || typeof host !== 'object') return [];
    const game = host.getCanvasGameHost?.() || host.lastGame || host;
    const shell = game?.canvasShell || host.canvasShell || host.lastGame?.canvasShell || null;
    return [host, game, shell].filter(
      (target, index, targets) =>
        target && typeof target === 'object' && targets.indexOf(target) === index,
    );
  }

  function writeBlockingPanelMirror(target, panelKey, value) {
    if (!target || typeof target !== 'object') return;
    target[panelKey] = normalizeBlockingPanelValue(panelKey, value);
  }

  function clearBlockingPanelMirror(target, panelKey) {
    if (!target || typeof target !== 'object') return;
    target[panelKey] = panelKey === 'activeCommandPanel' ? '' : false;
  }

  function syncBlockingPanelMirror(host, panelKey, value) {
    collectBlockingPanelMirrorTargets(host).forEach((target) => {
      writeBlockingPanelMirror(target, panelKey, value);
    });
    return normalizeBlockingPanelValue(panelKey, value);
  }

  function openBlockingPanelOwner(host, panelKey, value = true, _metadata = {}) {
    if (!BLOCKING_PANEL_KINDS[panelKey]) return null;
    const mirrorValue = syncBlockingPanelMirror(host, panelKey, value);
    if (!isBlockingPanelOpenValue(panelKey, mirrorValue)) {
      closeBlockingPanelOwner(host, panelKey);
      return mirrorValue;
    }
    const payload = openModal(host, 'modal:blockingPanel', {
      panelKey,
      panelKind: BLOCKING_PANEL_KINDS[panelKey],
      value: mirrorValue,
    });
    return (
      payload || {
        panelKey,
        panelKind: BLOCKING_PANEL_KINDS[panelKey],
        value: mirrorValue,
      }
    );
  }

  function closeBlockingPanelOwner(host, panelKey) {
    if (!BLOCKING_PANEL_KINDS[panelKey]) return null;
    closeModal(host, 'modal:blockingPanel');
    collectBlockingPanelMirrorTargets(host).forEach((target) => {
      clearBlockingPanelMirror(target, panelKey);
    });
    return panelKey === 'activeCommandPanel' ? '' : false;
  }

  function closeBlockingPanelsOwner(host, except = []) {
    const keep = new Set(Array.isArray(except) ? except : []);
    const targets = collectBlockingPanelMirrorTargets(host);
    BLOCKING_PANEL_KEYS.forEach((panelKey) => {
      if (keep.has(panelKey)) return;
      targets.forEach((target) => clearBlockingPanelMirror(target, panelKey));
    });
    const payload = getModalPayload(host, 'modal:blockingPanel');
    if (payload?.panelKey && keep.has(payload.panelKey)) return payload;
    closeModal(host, 'modal:blockingPanel');
    return null;
  }

  function buildRendererPanelFacts(host) {
    const game = host?.getCanvasGameHost?.() || getStateHost(host);
    const shell = game?.canvasShell || host?.canvasShell || host?.lastGame?.canvasShell || null;
    const source = shell || game || host || {};
    return {
      showSettings: isTruthy(source.showSettings),
      showLogs: isTruthy(source.showLogs),
      showResourceDetails: isTruthy(source.showResourceDetails),
      showCitySwitcher: isTruthy(source.showCitySwitcher),
      showSubcityList: isTruthy(source.showSubcityList),
      showCityManagement: isTruthy(source.showCityManagement),
      showAdvisor: isTruthy(source.showAdvisor),
      showTaskCenter: isTruthy(source.showTaskCenter),
      showGuidebook: isTruthy(source.showGuidebook),
      showFamousPersons: isTruthy(source.showFamousPersons),
      activeCommandPanel: String(source.activeCommandPanel || ''),
      techDetailOpen: isTruthy(source.techDetailOpen),
    };
  }

  function buildRendererBattleFacts(host) {
    const BattleDomainOwner = getBattleDomainOwnerApi();
    const battleSnapshot = readBattleDomainSnapshot(host);
    if (battleSnapshot) return battleSnapshot;
    const game = host?.getCanvasGameHost?.() || getStateHost(host);
    const shell = game?.canvasShell || host?.canvasShell || host?.lastGame?.canvasShell || null;
    const entityBattle = game?.entityBattle || shell?.entityBattle || host?.entityBattle || null;
    if (BattleDomainOwner?.createBattleDomainOwner) {
      return BattleDomainOwner.createBattleDomainOwner({ battleScene: null, entityBattle });
    }
    return {
      schema: 'battle-domain-v1',
      battleScene: null,
      entityBattle,
      activeOverlay: entityBattle?.visible ? 'entityBattle' : 'none',
    };
  }

  function buildRendererSnapshot(host, options = {}) {
    const RendererSnapshotBoundary = getRendererSnapshotBoundaryApi();
    if (!host || !RendererSnapshotBoundary?.buildRendererSnapshot) return null;
    const mode = options.mode || getModeSnapshot(host) || getFallbackModeFacts(host);
    const snapshot = RendererSnapshotBoundary.buildRendererSnapshot({
      modalWorld: host.__ecsModalOwner || null,
      panel: buildRendererPanelFacts(host),
      mode,
      battle: buildRendererBattleFacts(host),
    });
    host.__ecsRendererSnapshot = snapshot;
    return snapshot;
  }

  function getRendererSnapshot(host) {
    return host?.__ecsRendererSnapshot || buildRendererSnapshot(host) || null;
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

      buildRendererSnapshot(options = {}) {
        return buildRendererSnapshot(this, options);
      },

      getRendererSnapshot() {
        return getRendererSnapshot(this);
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

      // event-specific wrappers: payload stores `eventId` so the modal owner
      // stays separate from EventController's same-named claim cursor field.
      openEventModal(eventId) {
        return openEventModal(this, eventId);
      },

      closeEventOwner() {
        return closeEventOwner(this);
      },

      // targetPicker-specific wrappers own the two picker modal shapes while
      // leaving non-picker world-march target state to the world-march domain.
      openWorldTargetPickerOwner(uiState, picker) {
        return openWorldTargetPickerOwner(this, uiState, picker);
      },

      openWorldMarchFormationPickerOwner(uiState, target) {
        return openWorldMarchFormationPickerOwner(this, uiState, target);
      },

      closeTargetPickerOwner(uiState) {
        return closeTargetPickerOwner(this, uiState);
      },

      // blockingPanel wrappers own the umbrella modal open/close signal while
      // keeping panel-specific business state in its legacy domain owner.
      openBlockingPanelOwner(panelKey, value = true, metadata = {}) {
        return openBlockingPanelOwner(this, panelKey, value, metadata);
      },

      closeBlockingPanelOwner(panelKey) {
        return closeBlockingPanelOwner(this, panelKey);
      },

      closeBlockingPanelsOwner(except = []) {
        return closeBlockingPanelsOwner(this, except);
      },
    });
    return true;
  }

  const api = {
    closeBlockingPanelOwner,
    closeBlockingPanelsOwner,
    closeModal,
    closeEventOwner,
    closeTargetPickerOwner,
    collectModalKeys,
    buildRendererSnapshot,
    deriveModeFacts,
    getModalPayload,
    getModeSnapshot,
    getRendererSnapshot,
    hasBlockingOverlayExceptTechTree,
    install,
    isModalOpen,
    openBlockingPanelOwner,
    openEventModal,
    openModal,
    openWorldMarchFormationPickerOwner,
    openWorldTargetPickerOwner,
    refreshModeSnapshot,
    resolveBaseModeKey,
    resolveInputIntent,
    resolveModalCallback,
    updateModalPayload,
  };

  global.CanvasModeOwnershipBridge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
