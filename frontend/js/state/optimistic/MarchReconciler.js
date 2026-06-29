(function (global) {
  // MarchReconciler -- PURE reconciliation of the local optimistic world-explorer
  // state against an authoritative server snapshot.
  //
  // reconcile() does NOT mutate the passed store and does NOT write host.state or
  // host.networkState. It returns:
  //   nextExplorer -- the reconciled worldExplorerState to hand to the owner
  //   storePatch   -- { aliases, authorityIds } the orchestrator feeds to
  //                   MarchPendingStore.applyPatch (alias writes + authorityId stamps
  //                   that rollback/complete rely on)
  //   slowSync     -- ordered list of { missionId, diffTiles, threshold } the
  //                   orchestrator replays through markSlowSync (the only host write)
  //
  // The geometry/mission helpers are reused from MarchCommandBuilder so the route and
  // coordinate math has a single home.
  const Builder = (() => {
    if (global.MarchCommandBuilder) return global.MarchCommandBuilder;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./MarchCommandBuilder');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const {
    clonePlain,
    coordDistanceTiles,
    getCurrentCoord,
    getFormationKey,
    getMissionFormationKey,
    getMissionList,
    getRouteSignature,
    isSameRoute,
    rebuildExplorer,
  } = Builder;

  function matchPendingAuthority(pending = {}, authorityMissions = []) {
    const idMatch = authorityMissions.find((mission) => mission.id === pending.missionId);
    if (pending.explicitMissionId) return idMatch || null;
    return (
      idMatch ||
      authorityMissions.find(
        (mission) =>
          getMissionFormationKey(mission) === getFormationKey(pending.formation) &&
          (!pending.routeSignature || getRouteSignature(mission.route) === pending.routeSignature),
      ) ||
      authorityMissions.find(
        (mission) =>
          getMissionFormationKey(mission) === getFormationKey(pending.formation) &&
          coordDistanceTiles(mission.target || {}, pending.target || {}) <= 0,
      )
    );
  }

  function mergeAuthorityIntoLocal(localMission = {}, authorityMission = {}, pending = null) {
    return {
      ...clonePlain(authorityMission),
      ...clonePlain(localMission),
      id: authorityMission.id || localMission.id,
      formation: clonePlain(authorityMission.formation || localMission.formation || {}),
      formationSnapshot: clonePlain(
        authorityMission.formationSnapshot || localMission.formationSnapshot || null,
      ),
      plannedTiles: clonePlain(authorityMission.plannedTiles || localMission.plannedTiles || []),
      plannedSites: clonePlain(authorityMission.plannedSites || localMission.plannedSites || []),
      _optimistic: {
        ...(localMission._optimistic || {}),
        pending: Boolean(pending),
        pendingId: pending?.pendingId || localMission._optimistic?.pendingId || '',
        authorityId: authorityMission.id || '',
        reconciled: true,
      },
    };
  }

  // reconcile -- pure. Inputs:
  //   localExplorer  -- the owner's current worldExplorerState
  //   serverExplorer -- the authoritative worldExplorerState
  //   pendingList    -- snapshot of in-flight pendings (MarchPendingStore.list)
  //   ctx            -- { nowMs, threshold }
  function reconcile(localExplorer = {}, serverExplorer = {}, pendingList = [], ctx = {}) {
    const empty = {
      nextExplorer: serverExplorer,
      storePatch: { aliases: {}, authorityIds: {} },
      slowSync: [],
    };
    if (!serverExplorer || typeof serverExplorer !== 'object') return empty;
    const nowMs = Number(ctx.nowMs) || 0;
    const threshold = Math.max(0, Number(ctx.threshold) || 0);
    const storePatch = { aliases: Object.create(null), authorityIds: Object.create(null) };
    const slowSync = [];

    const localMissions = getMissionList(localExplorer);
    const serverMissions = getMissionList(serverExplorer).map(clonePlain);
    const byServerId = new Map(serverMissions.map((mission) => [mission.id, mission]));
    const usedServerIds = new Set();
    const nextMissions = serverMissions.slice();

    const replaceServerMission = (serverMission = {}, nextMission = {}) => {
      const index = nextMissions.findIndex((mission) => mission.id === serverMission.id);
      if (index >= 0) nextMissions[index] = nextMission;
      else nextMissions.push(nextMission);
      usedServerIds.add(serverMission.id);
    };

    (Array.isArray(pendingList) ? pendingList : []).forEach((pending) => {
      const localMission =
        localMissions.find(
          (mission) =>
            mission.id === pending.missionId ||
            mission.id === pending.pendingId ||
            mission._optimistic?.pendingId === pending.pendingId,
        ) || null;
      const authorityMission = matchPendingAuthority(pending, serverMissions);
      if (!localMission) return;
      if (!authorityMission) {
        nextMissions.push(clonePlain(localMission));
        return;
      }
      storePatch.aliases[authorityMission.id] = pending.pendingId;
      storePatch.authorityIds[pending.pendingId] = authorityMission.id;
      if (pending.action === 'returnWorldMarch' && !isSameRoute(localMission, authorityMission)) {
        replaceServerMission(authorityMission, {
          ...authorityMission,
          _optimistic: {
            pending: false,
            pendingId: pending.pendingId,
            action: pending.action,
            authorityId: authorityMission.id,
            reconciled: true,
          },
        });
        return;
      }
      const localCurrent = getCurrentCoord(localMission, nowMs);
      const authorityCurrent = getCurrentCoord(authorityMission, nowMs);
      const diffTiles = coordDistanceTiles(localCurrent, authorityCurrent);
      if (isSameRoute(localMission, authorityMission) && diffTiles <= threshold) {
        replaceServerMission(
          authorityMission,
          mergeAuthorityIntoLocal(localMission, authorityMission, pending),
        );
        return;
      }
      slowSync.push({
        missionId: authorityMission.id || localMission.id || '',
        diffTiles,
        threshold,
      });
      replaceServerMission(authorityMission, {
        ...authorityMission,
        _optimistic: {
          pending: false,
          pendingId: pending.pendingId,
          action: pending.action,
          authorityId: authorityMission.id,
          pullback: true,
          diffTiles,
        },
      });
    });

    localMissions.forEach((localMission) => {
      const serverMission = byServerId.get(localMission.id);
      if (!serverMission || usedServerIds.has(serverMission.id)) return;
      if (!isSameRoute(localMission, serverMission)) return;
      const localCurrent = getCurrentCoord(localMission, nowMs);
      const authorityCurrent = getCurrentCoord(serverMission, nowMs);
      const diffTiles = coordDistanceTiles(localCurrent, authorityCurrent);
      if (diffTiles <= threshold) {
        replaceServerMission(
          serverMission,
          mergeAuthorityIntoLocal(localMission, serverMission, null),
        );
      } else {
        slowSync.push({
          missionId: serverMission.id || localMission.id || '',
          diffTiles,
          threshold,
        });
      }
    });

    return {
      nextExplorer: rebuildExplorer(serverExplorer, nextMissions),
      storePatch,
      slowSync,
    };
  }

  const api = Object.freeze({
    matchPendingAuthority,
    mergeAuthorityIntoLocal,
    reconcile,
  });

  global.MarchReconciler = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
