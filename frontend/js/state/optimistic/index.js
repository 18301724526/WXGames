(function (global) {
  // state/optimistic/index.js -- the optimistic world-march orchestrator.
  //
  // This is the only host-coupled layer: it reads/writes the live owner state, owns
  // the per-host MarchPendingStore, drives renders, and writes host.networkState on
  // slow-sync. It assembles the public `WorldMarchOptimisticState` namespace from the
  // three single-responsibility modules:
  //   MarchCommandBuilder -- pure buildStart/buildReturn + shared march geometry
  //   MarchPendingStore   -- the { sequence, pending, aliases } owner
  //   MarchReconciler     -- pure reconcile -> { nextExplorer, storePatch, slowSync }
  //
  // Owner-selection precedence: the live owner is host.lastGame (when distinct) else
  // host. getState reads host.lastGame?.state || host.state and setExplorer writes the
  // exact same slot, so the read source and the write target are one. This precedence
  // is load-bearing and pinned by CanvasGameAppTripleHostMirror.test.js.
  function requireModule(name, relativePath) {
    if (global[name]) return global[name];
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require(relativePath);
      } catch (_error) {
        return null;
      }
    }
    return null;
  }

  const Builder = requireModule('MarchCommandBuilder', './MarchCommandBuilder');
  const PendingStore = requireModule('MarchPendingStore', './MarchPendingStore');
  const Reconciler = requireModule('MarchReconciler', './MarchReconciler');
  const StateWriter = requireModule('StateWriter', '../StateWriter');

  const SLOW_SYNC_MESSAGE = '网络连接缓慢，正在尝试同步';

  const toNumber = Builder.toNumber;
  const toInteger = Builder.toInteger;
  const toIso = Builder.toIso;
  const tileId = Builder.tileId;
  const getMissionList = Builder.getMissionList;
  const getCurrentCoord = Builder.getCurrentCoord;
  const getReconcileThresholdTiles = Builder.getReconcileThresholdTiles;

  function getNowMs(host = {}) {
    const worldNow = host.getWorldEpochNowMs?.();
    if (Number.isFinite(Number(worldNow))) return Number(worldNow);
    const runtimeNow = host.runtime?.now?.();
    if (Number.isFinite(Number(runtimeNow))) return Number(runtimeNow);
    const schedulerNow = host.scheduler?.now?.();
    if (Number.isFinite(Number(schedulerNow))) return Number(schedulerNow);
    return Date.now();
  }

  function resolveThresholdTiles(host = {}) {
    return getReconcileThresholdTiles(host.config || {}, host.worldMarchOptimistic?.thresholdTiles);
  }

  function ensureStore(host = {}) {
    if (!host || typeof host !== 'object') return PendingStore.createStore();
    if (!host.worldMarchOptimistic || typeof host.worldMarchOptimistic !== 'object') {
      host.worldMarchOptimistic = {
        ...PendingStore.createStore(),
        thresholdTiles: resolveThresholdTiles(host),
      };
    }
    return PendingStore.ensureShape(host.worldMarchOptimistic);
  }

  function getState(host = {}) {
    return host.lastGame?.state || host.state || {};
  }

  function getExplorer(host = {}) {
    return getState(host).worldExplorerState || {};
  }

  function setExplorer(host = {}, explorer = {}) {
    if (!host || typeof host !== 'object') return false;
    const currentState = getState(host);
    // Single live-state owner: StateWriter owns the host/lastGame precedence and is
    // the one place that assigns owner.state, so write exactly the slot getState()
    // reads. The host/lastGame split previously duplicated the same buffer and a
    // third canvasShell.state mirror existed (zero readers, removed).
    StateWriter.commit(
      host,
      {
        ...(currentState || {}),
        worldExplorerState: explorer,
      },
      { source: 'optimistic:setExplorer' },
    );
    return true;
  }

  function requestImmediateRender(host = {}, options = {}) {
    if (typeof host.renderCanvasSurface === 'function') {
      host.renderCanvasSurface();
    } else if (typeof host.render === 'function') {
      host.render();
    }
    const epochNowMs = options.epochNowMs ?? getNowMs(host);
    host.updateWorldActorAnimationLoop?.({ force: true, state: host.state, epochNowMs });
    host.requestWorldActorAnimationFrame?.({ force: true, state: host.state, epochNowMs });
    host.canvasShell?.requestWorldMapRenderAnimationFrame?.({
      force: true,
      invalidateWorldTileView: false,
    });
    return true;
  }

  function markSlowSync(host = {}, detail = {}) {
    if (!host || typeof host !== 'object') return false;
    host.networkState = {
      ...(host.networkState || {}),
      status: 'reconnecting',
      failureCount: Math.max(1, toInteger(host.networkState?.failureCount, 0)),
      message: SLOW_SYNC_MESSAGE,
      worldMarchReconciliation: {
        slow: true,
        ...detail,
      },
    };
    if (host.canvasShell?.setNetworkState) host.canvasShell.setNetworkState(host.networkState);
    else host.canvasShell && (host.canvasShell.networkState = host.networkState);
    return true;
  }

  function beginStart(host = {}, options = {}) {
    const state = getState(host);
    const store = ensureStore(host);
    const built = Builder.buildStart(state, options, {
      nowMs: getNowMs(host),
      sequence: PendingStore.nextSequence(store),
      config: host.config || {},
    });
    if (!built) return null;
    PendingStore.register(store, built.pending);
    setExplorer(host, built.nextExplorer);
    requestImmediateRender(host, { epochNowMs: built.pending.createdAtMs });
    return { ...built.pending, mission: built.mission };
  }

  function beginReturn(host = {}, missionId = '', options = {}) {
    const store = ensureStore(host);
    const built = Builder.buildReturn(getState(host), missionId, options, {
      nowMs: getNowMs(host),
      config: host.config || {},
    });
    if (!built) return null;
    PendingStore.register(store, built.pending);
    setExplorer(host, built.nextExplorer);
    requestImmediateRender(host, { epochNowMs: built.pending.createdAtMs });
    return { ...built.pending, mission: built.mission };
  }

  function rollback(host = {}, pendingRef = '', options = {}) {
    const store = ensureStore(host);
    const pending = PendingStore.resolve(store, pendingRef);
    if (!pending) return false;
    setExplorer(host, Builder.clonePlain(pending.previousExplorer || {}));
    PendingStore.remove(store, pending.pendingId);
    if (options.render !== false) requestImmediateRender(host);
    return true;
  }

  function complete(host = {}, pendingRef = '') {
    const store = ensureStore(host);
    const ref =
      typeof pendingRef === 'string'
        ? pendingRef
        : pendingRef?.pendingId || pendingRef?.missionId || '';
    return PendingStore.remove(store, ref);
  }

  function reconcileWorldExplorerState(host = {}, serverExplorer = {}, options = {}) {
    if (!serverExplorer || typeof serverExplorer !== 'object') return serverExplorer;
    const store = ensureStore(host);
    const { nextExplorer, storePatch, slowSync } = Reconciler.reconcile(
      getExplorer(host),
      serverExplorer,
      PendingStore.list(store),
      {
        nowMs: options.epochNowMs ?? getNowMs(host),
        threshold: resolveThresholdTiles(host),
      },
    );
    PendingStore.applyPatch(store, storePatch);
    slowSync.forEach((detail) => markSlowSync(host, detail));
    return nextExplorer;
  }

  function reconcileState(host = {}, serverState = {}, options = {}) {
    if (!serverState || typeof serverState !== 'object' || !serverState.worldExplorerState)
      return serverState;
    const worldExplorerState = reconcileWorldExplorerState(
      host,
      serverState.worldExplorerState,
      options,
    );
    return {
      ...serverState,
      worldExplorerState,
    };
  }

  function buildClientReport(host = {}, options = {}) {
    const state = options.state || getState(host);
    const explorer = state.worldExplorerState || {};
    const nowMs = options.epochNowMs ?? getNowMs(host);
    const missions = getMissionList(explorer)
      .filter((mission) => mission?.status === 'active')
      .slice(0, 12)
      .map((mission) => {
        const current = getCurrentCoord(mission, nowMs);
        return {
          missionId: mission.id || '',
          clientTime: toIso(nowMs),
          position: {
            q: toNumber(current.q ?? current.x, 0),
            r: toNumber(current.r ?? current.y, 0),
            tileId: tileId(current.q ?? current.x, current.r ?? current.y),
          },
        };
      })
      .filter((mission) => mission.missionId);
    if (!missions.length) return null;
    return {
      schema: 'world-march-client-report-batch-v1',
      clientTime: toIso(nowMs),
      missions,
    };
  }

  const api = {
    SLOW_SYNC_MESSAGE,
    buildClientReport,
    beginReturn,
    beginStart,
    buildLinearRoute: Builder.buildLinearRoute,
    complete,
    coordDistanceTiles: Builder.coordDistanceTiles,
    ensureStore,
    getMissionList,
    getReconcileThresholdTiles: resolveThresholdTiles,
    normalizeCoord: Builder.normalizeCoord,
    reconcileState,
    reconcileWorldExplorerState,
    requestImmediateRender,
    rollback,
  };

  global.WorldMarchOptimisticState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
