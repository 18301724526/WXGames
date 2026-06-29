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

  function getModalOwnerHost(host) {
    if (!host || typeof host !== 'object') return host;
    const owner = host.getCanvasGameHost?.() || host.lastGame || host;
    if (owner !== host && host.__ecsModalOwner && typeof owner === 'object') {
      if (!owner.__ecsModalOwner) {
        owner.__ecsModalOwner = host.__ecsModalOwner;
        if (host.__modalCallbacks && !owner.__modalCallbacks) {
          owner.__modalCallbacks = host.__modalCallbacks;
        }
      }
      delete host.__ecsModalOwner;
      delete host.__modalCallbacks;
    }
    return owner;
  }

  function readBattleSnapshot(host) {
    const BattleOwner = getBattleOwnerApi();
    const owner =
      host?.__ecsBattleOwner ||
      host?.lastGame?.__ecsBattleOwner ||
      host?.getCanvasGameHost?.()?.__ecsBattleOwner ||
      null;
    if (BattleOwner?.getBattleSnapshot && owner) {
      return BattleOwner.getBattleSnapshot(owner);
    }
    return null;
  }

  function resolveBaseModeKey(host) {
    const game = getStateHost(host);
    const battleSnapshot = readBattleSnapshot(host);
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
    const battleSnapshot = readBattleSnapshot(host);
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
      isTruthy(host?.entityBattle?.visible) ||
      isTruthy(game?.entityBattle?.visible) ||
      isAnyModalOpen(host, 'modal:rewardReveal'),
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

  function getBattleOwnerApi() {
    return EcsModeRuntime && EcsModeRuntime.BattleOwner
      ? EcsModeRuntime.BattleOwner
      : null;
  }

  function ensureModalOwner(host) {
    const ModalWorld = getModalWorldApi();
    if (!ModalWorld) return null;
    const owner = getModalOwnerHost(host);
    if (!owner || typeof owner !== 'object') return null;
    if (!owner.__ecsModalOwner) owner.__ecsModalOwner = ModalWorld.createModalWorld();
    if (!owner.__modalCallbacks && ModalCallbackRegistry) {
      owner.__modalCallbacks = ModalCallbackRegistry.createModalCallbackRegistry();
    }
    return owner.__ecsModalOwner;
  }

  // Open a covered modal subtype: the owner becomes the source of truth, mints a
  // token, and (for subtypes with continuations) registers callbacks by token.
  // Returns the frozen owner payload the host uses as its read-only mirror, or
  // null when the runtime is unavailable so the host keeps its legacy field.
  function openModal(host, subtype, payload = {}, callbacks = null) {
    const ModalWorld = getModalWorldApi();
    const owner = getModalOwnerHost(host);
    if (!ModalWorld || !ensureModalOwner(owner)) return null;
    owner.__ecsModalOwner = ModalWorld.openModal(owner.__ecsModalOwner, subtype, payload);
    if (callbacks && owner.__modalCallbacks) {
      owner.__modalCallbacks.register(
        ModalWorld.getModalToken(owner.__ecsModalOwner, subtype),
        callbacks,
      );
    }
    return ModalWorld.getModalPayload(owner.__ecsModalOwner, subtype);
  }

  function updateModalPayload(host, subtype, patch = {}) {
    const ModalWorld = getModalWorldApi();
    const owner = getModalOwnerHost(host);
    if (!ModalWorld || !owner?.__ecsModalOwner) return null;
    owner.__ecsModalOwner = ModalWorld.updateModalPayload(owner.__ecsModalOwner, subtype, patch);
    return ModalWorld.getModalPayload(owner.__ecsModalOwner, subtype);
  }

  function closeModal(host, subtype) {
    const ModalWorld = getModalWorldApi();
    const owner = getModalOwnerHost(host);
    if (!ModalWorld || !owner?.__ecsModalOwner) return null;
    if (owner.__modalCallbacks) {
      owner.__modalCallbacks.clear(ModalWorld.getModalToken(owner.__ecsModalOwner, subtype));
    }
    owner.__ecsModalOwner = ModalWorld.closeModal(owner.__ecsModalOwner, subtype);
    return null;
  }

  function getModalPayload(host, subtype) {
    const ModalWorld = getModalWorldApi();
    const owner = getModalOwnerHost(host);
    if (!ModalWorld || !owner?.__ecsModalOwner) return null;
    return ModalWorld.getModalPayload(owner.__ecsModalOwner, subtype);
  }

  function isModalOpen(host, subtype) {
    const ModalWorld = getModalWorldApi();
    const owner = getModalOwnerHost(host);
    if (!ModalWorld || !owner?.__ecsModalOwner) return false;
    return ModalWorld.isModalOpen(owner.__ecsModalOwner, subtype);
  }

  function isAnyModalOpen(host, subtype) {
    return isModalOpen(host, subtype);
  }

  function getAnyModalPayload(host, subtype) {
    return getModalPayload(host, subtype);
  }

  function resolveModalCallback(host, subtype, action, ...args) {
    const ModalWorld = getModalWorldApi();
    const owner = getModalOwnerHost(host);
    if (!ModalWorld || !owner?.__ecsModalOwner || !owner.__modalCallbacks) return undefined;
    return owner.__modalCallbacks.resolve(
      ModalWorld.getModalToken(owner.__ecsModalOwner, subtype),
      action,
      ...args,
    );
  }

  // Batch 8F: the single source-flip chokepoint. The flat-12 panel facts are now
  // DERIVED from the per-panel modal entries (the owner is the source of truth)
  // instead of read off a shell/game/host mirror. ~40 downstream renderer/runtime
  // reads of snapshot.panel.showX keep working unchanged. buildRendererSnapshot
  // passes the same modalWorld it builds so the panel facts and the modal block
  // are guaranteed to agree.
  function buildRendererPanelFacts(host, modalWorld) {
    const world = modalWorld || buildRendererModalWorld(host);
    const entries = (world && world.entries) || {};
    const isOpen = (subtype) => Boolean(entries[subtype]?.visible);
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
      activeCommandPanel: commandEntry?.visible ? String(commandEntry.payload?.value || '') : '',
      techDetailOpen: isOpen('modal:techDetail'),
    };
  }

  function buildRendererBattleFacts(host) {
    const BattleOwner = getBattleOwnerApi();
    const battleSnapshot = readBattleSnapshot(host);
    if (battleSnapshot) return battleSnapshot;
    const game = host?.getCanvasGameHost?.() || getStateHost(host);
    const shell = game?.canvasShell || host?.canvasShell || host?.lastGame?.canvasShell || null;
    const entityBattle = game?.entityBattle || shell?.entityBattle || host?.entityBattle || null;
    if (BattleOwner?.createBattleOwner) {
      return BattleOwner.createBattleOwner({ battleScene: null, entityBattle });
    }
    return {
      schema: 'battle-owner-v1',
      battleScene: null,
      entityBattle,
      activeOverlay: entityBattle?.visible ? 'entityBattle' : 'none',
    };
  }

  function buildRendererModalWorld(host) {
    return getModalOwnerHost(host)?.__ecsModalOwner || null;
  }

  function buildRendererSnapshot(host, options = {}) {
    const RendererSnapshotBoundary = getRendererSnapshotBoundaryApi();
    if (!host || !RendererSnapshotBoundary?.buildRendererSnapshot) return null;
    const mode = options.mode || getModeSnapshot(host) || getFallbackModeFacts(host);
    const modalWorld = buildRendererModalWorld(host);
    const snapshot = RendererSnapshotBoundary.buildRendererSnapshot({
      modalWorld,
      panel: buildRendererPanelFacts(host, modalWorld),
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

      getModalOwnerHost() {
        return getModalOwnerHost(this);
      },

      resolveModalCallback(subtype, action, ...args) {
        return resolveModalCallback(this, subtype, action, ...args);
      },
    });
    return true;
  }

  const api = {
    closeModal,
    collectModalKeys,
    buildRendererSnapshot,
    deriveModeFacts,
    getModalPayload,
    getModalOwnerHost,
    getModeSnapshot,
    getRendererSnapshot,
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

  global.CanvasModeOwnershipRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
