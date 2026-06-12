(function (global) {
  function getMapDataSignature(state = {}, options = {}) {
    const territoryState = state?.territoryState || {};
    const worldExplorerState = state?.worldExplorerState || {};
    const presenter = options.presenter || null;
    if (typeof presenter?.getWorldTileMapSignature === 'function') {
      return presenter.getWorldTileMapSignature(territoryState, worldExplorerState, options);
    }
    const worldMap = territoryState.worldMap || {};
    const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
    const sites = Array.isArray(territoryState.territories) ? territoryState.territories : [];
    const missions = Array.isArray(territoryState.scoutMissions) ? territoryState.scoutMissions : [];
    return JSON.stringify({
      version: worldMap.version || 0,
      seed: worldMap.seed || '',
      tiles: tiles.map((tile) => ({
        id: tile.id,
        q: tile.q,
        r: tile.r,
        terrain: tile.terrain,
        discovered: tile.discovered !== false,
        visible: tile.visible !== false,
        siteId: tile.siteId || null,
        riverPorts: tile.riverPorts || [],
        oceanTemplates: tile.oceanTemplates || [],
        transitionKey: tile.transitionKey || '',
      })),
      sites: sites.map((site) => ({
        id: site.id,
        x: site.x,
        y: site.y,
        status: site.status,
        owner: site.owner,
        type: site.type,
        art: site.art,
        name: site.cityName || site.naturalName,
      })),
      missions: missions.map((mission) => ({
        id: mission.id,
        status: mission.status,
        route: mission.route || [],
        revealArea: mission.revealArea || [],
        revealedTileIds: mission.revealedTileIds || [],
        actionPointsRemaining: mission.actionPointsRemaining,
      })),
      explorerMissions: [
        worldExplorerState.activeMission,
        ...(Array.isArray(worldExplorerState.idleMissions) ? worldExplorerState.idleMissions : []),
      ].filter(Boolean).map((mission) => ({
        id: mission.id,
        status: mission.status,
        position: mission.position || null,
        route: mission.route || [],
        plannedTiles: mission.plannedTiles || [],
        plannedSites: mission.plannedSites || [],
        revealedTileIds: mission.revealedTileIds || [],
      })),
    });
  }

  function getSignatureSyncResult(previousSignature = '', nextSignature = '') {
    const changed = nextSignature !== previousSignature;
    const hadPreviousSignature = Boolean(previousSignature);
    return {
      signature: nextSignature,
      changed,
      hadPreviousSignature,
      shouldInvalidateBake: Boolean(changed && hadPreviousSignature),
    };
  }

  function isMapBakeDirty(runtimeState = {}, state = {}, options = {}) {
    if (!runtimeState.hasBakedMapLayer || runtimeState.mapBakeDirty) return true;
    return getMapDataSignature(state, options) !== (runtimeState.lastMapDataSignature || '');
  }

  const WorldMapRuntimeBakePolicy = Object.freeze({
    getMapDataSignature,
    getSignatureSyncResult,
    isMapBakeDirty,
  });

  global.WorldMapRuntimeBakePolicy = WorldMapRuntimeBakePolicy;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRuntimeBakePolicy;
})(typeof window !== 'undefined' ? window : globalThis);
