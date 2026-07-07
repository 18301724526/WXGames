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

  const ModalStoreModule = (() => {
    if (global.ModalStore) return global.ModalStore;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../state/ModalStore');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function getModalStore() {
    return global.ModalStore || ModalStoreModule || null;
  }

  const BattleStoreModule = (() => {
    if (global.BattleStore) return global.BattleStore;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../state/BattleStore');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function getBattleStore() {
    return global.BattleStore || BattleStoreModule || null;
  }

  function isTruthy(value) {
    return Boolean(value);
  }

  function getStateHost(host) {
    return host?.lastGame || host;
  }

  // Modal truth lives in the global ModalStore, NOT on any host. This resolver only
  // names the canonical game host so shell-rooted call sites (and the snapshot
  // adapter) keep a single reference point; it never stores or migrates modal state.
  function getModalOwnerHost(host) {
    if (!host || typeof host !== 'object') return host;
    return host.getCanvasGameHost?.() || host.lastGame || host;
  }

  function readBattleSnapshot() {
    const store = getBattleStore();
    return store ? store.getBattleFacts() : null;
  }

  function resolveBaseModeKey(host) {
    const game = getStateHost(host);
    const battleSnapshot = readBattleSnapshot();
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

  // Batch 8F: each blocking panel is its own owned modal subtype. The two non-panel
  // signals the retired 'modal:blockingPanel' umbrella also folded in --
  // tutorialAdvisorDialogue and armyFormationEditor.open -- are NOT panel subtypes;
  // they are preserved as explicit terms in deriveModeFacts.blockingOverlayActive and
  // hasBlockingOverlayExceptTechTree so blocking detection is unchanged.
  function collectModalKeys(host) {
    const keys = [];
    if (isAnyModalOpen(host, 'modal:naming')) keys.push('modal:naming');
    if (isAnyModalOpen(host, 'modal:event')) keys.push('modal:event');
    if (isAnyModalOpen(host, 'modal:rewardReveal')) keys.push('modal:rewardReveal');
    if (isAnyModalOpen(host, 'modal:confirmDialog')) keys.push('modal:confirmDialog');
    if (isAnyModalOpen(host, 'modal:targetPicker')) keys.push('modal:targetPicker');
    if (isAnyModalOpen(host, 'modal:settings')) keys.push('modal:settings');
    if (isAnyModalOpen(host, 'modal:logs')) keys.push('modal:logs');
    if (isAnyModalOpen(host, 'modal:resourceDetails')) keys.push('modal:resourceDetails');
    if (isAnyModalOpen(host, 'modal:citySwitcher')) keys.push('modal:citySwitcher');
    if (isAnyModalOpen(host, 'modal:subcityList')) keys.push('modal:subcityList');
    if (isAnyModalOpen(host, 'modal:cityManagement')) keys.push('modal:cityManagement');
    if (isAnyModalOpen(host, 'modal:advisor')) keys.push('modal:advisor');
    if (isAnyModalOpen(host, 'modal:taskCenter')) keys.push('modal:taskCenter');
    if (isAnyModalOpen(host, 'modal:guidebook')) keys.push('modal:guidebook');
    if (isAnyModalOpen(host, 'modal:famousPersons')) keys.push('modal:famousPersons');
    if (isAnyModalOpen(host, 'modal:commandPanel')) keys.push('modal:commandPanel');
    if (isAnyModalOpen(host, 'modal:techDetail')) keys.push('modal:techDetail');
    return Array.from(new Set(keys));
  }

  function hasBlockingOverlayExceptTechTree(host) {
    const game = getStateHost(host);
    const battleSnapshot = readBattleSnapshot();
    // commandPanel blocks tech-tree routing only when it is NOT the tech panel (the
    // 'tech' value IS tech-tree base access, not an overlay). techDetail still blocks
    // (it is a popup layered above the tech tree). This preserves the exact prior
    // semantics, now sourced from the per-panel modal entries instead of host mirrors.
    const commandValue = String(getAnyModalPayload(host, 'modal:commandPanel')?.value || '');
    return Boolean(
      isAnyModalOpen(host, 'modal:settings') ||
      isAnyModalOpen(host, 'modal:logs') ||
      isAnyModalOpen(host, 'modal:resourceDetails') ||
      isAnyModalOpen(host, 'modal:citySwitcher') ||
      isAnyModalOpen(host, 'modal:subcityList') ||
      isAnyModalOpen(host, 'modal:cityManagement') ||
      isAnyModalOpen(host, 'modal:advisor') ||
      isTruthy(host?.tutorialAdvisorDialogue) ||
      isTruthy(game?.tutorialAdvisorDialogue) ||
      isAnyModalOpen(host, 'modal:taskCenter') ||
      isAnyModalOpen(host, 'modal:guidebook') ||
      isAnyModalOpen(host, 'modal:famousPersons') ||
      isTruthy(host?.armyFormationEditor?.open) ||
      isTruthy(game?.armyFormationEditor?.open) ||
      isAnyModalOpen(host, 'modal:confirmDialog') ||
      (Boolean(commandValue) && commandValue !== 'tech') ||
      isAnyModalOpen(host, 'modal:techDetail') ||
      isAnyModalOpen(host, 'modal:event') ||
      isAnyModalOpen(host, 'modal:naming') ||
      isTruthy(battleSnapshot?.battleScene?.visible) ||
      isTruthy(battleSnapshot?.entityBattle?.visible) ||
      isAnyModalOpen(host, 'modal:rewardReveal'),
    );
  }

  function deriveModeFacts(host) {
    const game = getStateHost(host);
    const modalKeys = collectModalKeys(host);
    // entityBattleActive (blocking logic, ModeState) sources from BattleStore -- the
    // single source of truth for the live battle session -- not host/game mirrors.
    const entityBattle = readBattleSnapshot()?.entityBattle || null;
    const tutorialIntro = game?.tutorialIntro || host?.tutorialIntro || null;
    const tutorialHighlight = host?.tutorialHighlight || game?.tutorialHighlight || null;
    const baseModeKey = resolveBaseModeKey(host);
    return {
      baseModeKey,
      modalKeys,
      tutorialActive: isTruthy(tutorialIntro?.active) || isTruthy(tutorialHighlight),
      debugActive: isTruthy(global.__actorPickingDiag) || isTruthy(global.__wxgameDebugMode),
      // Batch 8F: modalKeys now carries the 12 panel subtypes individually. The two
      // non-panel signals the old umbrella also covered (tutorialAdvisorDialogue,
      // armyFormationEditor.open) are ORed back in here so blockingOverlayActive is
      // unchanged.
      blockingOverlayActive:
        modalKeys.length > 0 ||
        isTruthy(entityBattle?.visible) ||
        isTruthy(host?.tutorialAdvisorDialogue) ||
        isTruthy(game?.tutorialAdvisorDialogue) ||
        isTruthy(host?.armyFormationEditor?.open) ||
        isTruthy(game?.armyFormationEditor?.open),
      techTreeBlockingOverlayActive: hasBlockingOverlayExceptTechTree(host),
      entityBattleActive: isTruthy(entityBattle?.visible),
      worldMapHomeActive:
        isTruthy(host?.mapHomeActive) ||
        isTruthy(game?.mapHomeActive) ||
        baseModeKey === 'worldMap',
      techTreeActive:
        baseModeKey === 'techTree' ||
        getAnyModalPayload(host, 'modal:commandPanel')?.value === 'tech',
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

  function getCurrentTab(host) {
    const game = getStateHost(host);
    return String(
      game?.state?.currentTab ||
        game?.activeTab ||
        host?.state?.currentTab ||
        host?.activeTab ||
        '',
    );
  }

  function isCurrentTab(host, tabId = '') {
    const expected = String(tabId || '');
    return Boolean(expected && getCurrentTab(host) === expected);
  }

  function setMilitaryView(host, view = 'army') {
    const normalized = ['army', 'scout', 'world', 'veteranCamp'].includes(view) ? view : 'army';
    const game = getStateHost(host);
    if (game && typeof game === 'object') {
      game.militaryView = normalized;
      if (game.state && typeof game.state === 'object') {
        game.state.militaryView = normalized;
      }
    }
    if (host && host !== game && typeof host === 'object') {
      host.militaryView = normalized;
      if (host.state && typeof host.state === 'object') {
        host.state.militaryView = normalized;
      }
    }
    refreshModeSnapshot(host);
    if (game && game !== host) refreshModeSnapshot(game);
    return normalized;
  }

  function getFormationEditor(host) {
    const game = getStateHost(host);
    const gameEditor = game?.armyFormationEditor || null;
    const shellEditor = game?.canvasShell?.armyFormationEditor || null;
    const hostEditor = host?.armyFormationEditor || null;
    if (shellEditor?.open) return shellEditor;
    if (gameEditor?.open) return gameEditor;
    if (hostEditor?.open) return hostEditor;
    return gameEditor || shellEditor || hostEditor || {};
  }

  function closeFormationEditor(host) {
    const closed = {
      open: false,
      cityId: '',
      slot: 1,
      memberIds: [],
      soldierAssignments: {},
      soldierDraftAssignments: {},
      page: 0,
      saving: false,
    };
    const game = getStateHost(host);
    if (game && typeof game === 'object') game.armyFormationEditor = { ...closed };
    if (game?.canvasShell && typeof game.canvasShell === 'object') {
      game.canvasShell.armyFormationEditor = { ...closed };
    }
    if (host && host !== game && typeof host === 'object') host.armyFormationEditor = { ...closed };
    refreshModeSnapshot(host);
    if (game && game !== host) refreshModeSnapshot(game);
    if (game?.canvasShell && game.canvasShell !== host) refreshModeSnapshot(game.canvasShell);
    return closed;
  }

  function resolveInputIntent(host, physicalIntent) {
    const snapshot = getModeSnapshot(host);
    if (!snapshot || !EcsModeRuntime?.resolveInputIntent) return null;
    return EcsModeRuntime.resolveInputIntent(physicalIntent, snapshot);
  }

  function isBlockingOverlayOpen(snapshot = {}) {
    return EcsModeRuntime?.isBlockingOverlayOpen
      ? EcsModeRuntime.isBlockingOverlayOpen(snapshot)
      : Boolean(snapshot.blockingOverlayActive);
  }

  function isEntityBattleActive(snapshot = {}) {
    return EcsModeRuntime?.isEntityBattleActive
      ? EcsModeRuntime.isEntityBattleActive(snapshot)
      : Boolean(snapshot.entityBattleActive);
  }

  function canRouteWorldMap(snapshot = {}) {
    return EcsModeRuntime?.canRouteWorldMap
      ? EcsModeRuntime.canRouteWorldMap(snapshot)
      : Boolean(snapshot.canRouteWorldMap);
  }

  function canRouteTechTree(snapshot = {}) {
    return EcsModeRuntime?.canRouteTechTree
      ? EcsModeRuntime.canRouteTechTree(snapshot)
      : Boolean(snapshot.canRouteTechTree);
  }

  function getRendererSnapshotBoundaryApi() {
    return EcsModeRuntime && EcsModeRuntime.RendererSnapshotBoundary
      ? EcsModeRuntime.RendererSnapshotBoundary
      : null;
  }

  // Modal commands/queries are thin pass-throughs to the global ModalStore -- the
  // single source of truth for modal presence + payload + token + continuations.
  // The host argument is ignored for storage; when the store is unavailable
  // (node-require fallback edge) the helpers degrade to inert no-ops.

  // Open a covered modal subtype: the store mints a token and (for subtypes with
  // continuations) keeps callbacks on the entry. Returns the frozen payload.
  function openModal(host, subtype, payload = {}, callbacks = null) {
    const ModalStore = getModalStore();
    if (!ModalStore) return null;
    ModalStore.openModal(subtype, payload, callbacks);
    return ModalStore.getPayload(subtype);
  }

  function updateModalPayload(host, subtype, patch = {}) {
    const ModalStore = getModalStore();
    if (!ModalStore) return null;
    return ModalStore.updateModalPayload(subtype, patch);
  }

  function closeModal(host, subtype) {
    const ModalStore = getModalStore();
    if (!ModalStore) return null;
    return ModalStore.closeModal(subtype);
  }

  function getModalPayload(host, subtype) {
    const ModalStore = getModalStore();
    return ModalStore ? ModalStore.getPayload(subtype) : null;
  }

  function isModalOpen(host, subtype) {
    const ModalStore = getModalStore();
    return ModalStore ? ModalStore.isOpen(subtype) : false;
  }

  function isAnyModalOpen(host, subtype) {
    return isModalOpen(host, subtype);
  }

  function getAnyModalPayload(host, subtype) {
    return getModalPayload(host, subtype);
  }

  function resolveModalCallback(host, subtype, action, ...args) {
    const ModalStore = getModalStore();
    if (!ModalStore) return undefined;
    return ModalStore.resolve(ModalStore.getToken(subtype), action, ...args);
  }

  // Batch 8F: the single source-flip chokepoint. The flat-12 panel facts are now
  // DERIVED from the per-panel modal entries (the owner is the source of truth)
  // instead of read off a shell/game/host mirror. ~40 downstream renderer/runtime
  // reads of snapshot.panel.showX keep working unchanged. buildRendererSnapshot
  // passes the same modalWorld it builds so the panel facts and the modal block
  // are guaranteed to agree.
  function buildRendererPanelFacts(modalWorld, host = null) {
    const world = modalWorld || buildRendererModalWorld();
    const entries = (world && world.entries) || {};
    const isOpen = (subtype) => Boolean(entries[subtype]?.open);
    const commandEntry = entries['modal:commandPanel'];
    return {
      showSettings: isOpen('modal:settings'),
      showLogs: isOpen('modal:logs'),
      showResourceDetails: isOpen('modal:resourceDetails'),
      showCitySwitcher: isOpen('modal:citySwitcher'),
      showSubcityList: isOpen('modal:subcityList'),
      showCityManagement: isOpen('modal:cityManagement'),
      showAdvisor: isOpen('modal:advisor'),
      showTaskCenter: isOpen('modal:taskCenter'),
      showGuidebook: isOpen('modal:guidebook'),
      showFamousPersons: isOpen('modal:famousPersons'),
      activeCommandPanel: commandEntry?.open ? String(commandEntry.payload?.value || '') : '',
      techDetailOpen: isOpen('modal:techDetail'),
      // Map-command dock active states are DECIDED here on the owner side (Batch-3
      // ratchet: renderers may not derive mode decisions from modal facts). Each id
      // lights its dock item; MapCommandCanvasRenderer only consumes the list.
      // (tech/civilization light through activeCommandPanel above -- also a
      // pre-decided owner fact; the UI-REDO dock dropped the 'more' guidebook
      // item, so modal:guidebook no longer maps to a dock id.)
      activeDockItemIds: [
        isOpen('modal:taskCenter') && 'tasks',
        isOpen('modal:famousPersons') && 'famousPersons',
        isOpen('modal:settings') && 'settings',
        // The floating account button lights while settings are open OR the
        // reset-game confirm dialog (its own action's confirmation) is up.
        (isOpen('modal:settings')
          || (isOpen('modal:confirmDialog')
            && entries['modal:confirmDialog']?.payload?.kind === 'resetGame')) && 'account',
      ].filter(Boolean),
      // UI-REDO: the map-home FPS/latency/clock block is STANDARD HUD chrome per the
      // approved reference (layout-reference-v2) — always on, user-confirmed 2026-07-08.
      // The decision stays owner-side so future policy (e.g. a settings toggle) lands
      // here; ResourceTopBarCanvasRenderer only consumes the pre-decided boolean.
      showTopBarDebugStats: true,
    };
  }

  function buildRendererBattleFacts() {
    // BattleStore is the single source of truth for both overlays; the snapshot
    // boundary clones these facts once into the read-only renderer snapshot.
    const store = getBattleStore();
    if (store) return store.getBattleFacts();
    return { battleScene: null, entityBattle: null, activeOverlay: 'none' };
  }

  function buildRendererModalWorld() {
    // ModalStore is the single source of truth for modal presence; no host needed.
    const ModalStore = getModalStore();
    return ModalStore ? ModalStore.buildModalSnapshot() : null;
  }

  function buildRendererSnapshot(host, options = {}) {
    const RendererSnapshotBoundary = getRendererSnapshotBoundaryApi();
    if (!host || !RendererSnapshotBoundary?.buildRendererSnapshot) return null;
    const mode = options.mode || getModeSnapshot(host) || getFallbackModeFacts(host);
    const modalWorld = buildRendererModalWorld();
    const snapshot = RendererSnapshotBoundary.buildRendererSnapshot({
      modalWorld,
      panel: buildRendererPanelFacts(modalWorld, host),
      mode,
      battle: buildRendererBattleFacts(),
    });
    host.__ecsRendererSnapshot = snapshot;
    return snapshot;
  }

  function getRendererSnapshot(host) {
    return host?.__ecsRendererSnapshot || buildRendererSnapshot(host) || null;
  }

  const api = {
    closeModal,
    collectModalKeys,
    buildRendererSnapshot,
    deriveModeFacts,
    closeFormationEditor,
    getModalPayload,
    getModalOwnerHost,
    getCurrentTab,
    getFormationEditor,
    getModeSnapshot,
    getRendererSnapshot,
    hasBlockingOverlayExceptTechTree,
    isBlockingOverlayOpen,
    isCurrentTab,
    isEntityBattleActive,
    isModalOpen,
    openModal,
    refreshModeSnapshot,
    canRouteTechTree,
    canRouteWorldMap,
    resolveBaseModeKey,
    resolveInputIntent,
    resolveModalCallback,
    setMilitaryView,
    updateModalPayload,
  };

  global.CanvasModeOwnershipRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
