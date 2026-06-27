(function (global) {
  // CODEX_TEMP_MARCH_TARGET_DEBUG: remove after diagnosing tutorial march target state.
  function summarizeMarchHitCoord(coord = {}) {
    if (!coord || typeof coord !== 'object') return null;
    const q = Number(coord.q ?? coord.x ?? coord.targetQ);
    const r = Number(coord.r ?? coord.y ?? coord.targetR);
    return {
      q: Number.isFinite(q) ? q : null,
      r: Number.isFinite(r) ? r : null,
      tileId: coord.tileId || (Number.isFinite(q) && Number.isFinite(r) ? `${q},${r}` : ''),
    };
  }

  // CODEX_TEMP_MARCH_TARGET_DEBUG: remove after diagnosing tutorial march target state.
  function summarizeMarchHitRoute(route = {}) {
    if (!route || typeof route !== 'object') return null;
    const steps = Array.isArray(route.route) ? route.route : [];
    return {
      canMarch: route.canMarch,
      reason: route.reason || '',
      origin: summarizeMarchHitCoord(route.origin),
      target: summarizeMarchHitCoord(route.target),
      blockedStep: summarizeMarchHitCoord(route.blockedStep),
      routeLength: steps.length,
      routeHead: steps.slice(0, 3).map(summarizeMarchHitCoord),
      routeTail: steps.slice(Math.max(0, steps.length - 3)).map(summarizeMarchHitCoord),
    };
  }

  // CODEX_TEMP_MARCH_TARGET_DEBUG: remove after diagnosing tutorial march target state.
  function summarizeMarchHitAction(action = {}) {
    return {
      type: action?.type || '',
      targetQ: action?.targetQ ?? action?.q,
      targetR: action?.targetR ?? action?.r,
      tileId: action?.tileId || '',
      known: action?.known,
      terrain: action?.terrain || '',
      terrainLabel: action?.terrainLabel || '',
      marchDisabled: action?.marchDisabled,
      marchDisabledReason: action?.marchDisabledReason || '',
      inputSurface: action?.inputSurface || '',
      background: action?.background,
    };
  }

  // CODEX_TEMP_MARCH_TARGET_DEBUG: remove after diagnosing tutorial march target state.
  function summarizeMarchHitMapView(tileMapView = {}, target = {}) {
    const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
    const targetCoord = summarizeMarchHitCoord(target);
    const targetTile = targetCoord
      ? tiles.find((tile) => {
        const coord = summarizeMarchHitCoord(tile);
        return coord && Number(coord.q) === Number(targetCoord.q) && Number(coord.r) === Number(targetCoord.r);
      }) || null
      : null;
    return {
      tileCount: tiles.length,
      origin: summarizeMarchHitCoord(tileMapView.origin),
      worldOrigin: summarizeMarchHitCoord(tileMapView.worldOrigin),
      targetTile: targetTile ? {
        ...summarizeMarchHitCoord(targetTile),
        terrain: targetTile.terrain || '',
        terrainLabel: targetTile.terrainLabel || '',
        visibility: targetTile.visibility || '',
        discovered: targetTile.discovered,
      } : null,
    };
  }

  // CODEX_TEMP_MARCH_TARGET_DEBUG: remove after diagnosing tutorial march target state.
  function summarizeMarchHitState(state = {}) {
    const activeCityId = state.activeCityId || state.cityState?.activeCityId || 'capital';
    const territories = Array.isArray(state.territoryState?.territories)
      ? state.territoryState.territories
      : (Array.isArray(state.territories) ? state.territories : []);
    const activeTerritory = territories.find((item) => item?.id === activeCityId || item?.territoryId === activeCityId)
      || null;
    const capitalTerritory = territories.find((item) => item?.id === 'capital' || item?.territoryId === 'capital')
      || null;
    const worldMap = state.territoryState?.worldMap || {};
    return {
      activeCityId,
      territoryCount: territories.length,
      activeTerritory: summarizeMarchHitCoord(activeTerritory),
      capitalTerritory: summarizeMarchHitCoord(capitalTerritory),
      worldMapOrigin: summarizeMarchHitCoord(worldMap.origin),
      worldMapWorldOrigin: summarizeMarchHitCoord(worldMap.worldOrigin),
      worldMapTileCount: Array.isArray(worldMap.tiles) ? worldMap.tiles.length : 0,
      worldExplorer: {
        missions: Array.isArray(state.worldExplorerState?.missions) ? state.worldExplorerState.missions.length : 0,
        busyFormations: Array.isArray(state.worldExplorerState?.busyFormations) ? state.worldExplorerState.busyFormations.length : 0,
      },
    };
  }

  class WorldMapHitTargetFacade {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    addHitTarget(...args) {
      return this.host?.addHitTarget?.(...args);
    }

    analyzeAssetAlphaBounds(...args) {
      return this.host?.analyzeAssetAlphaBounds?.(...args);
    }

    getWorldTileScreenCenter(...args) {
      return this.host?.getWorldTileScreenCenter?.(...args);
    }

    getWorldTileSiteLayout(...args) {
      return this.host?.getWorldTileSiteLayout?.(...args);
    }

    getWorldMapHitTargetModel() {
      return global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('worldMapHitTargetModel')
        || this.host?.constructor?.getWorldMapHitTargetModel?.()
        || null;
    }

    getWorldMapLayoutModel() {
      return global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('worldMapLayoutModel')
        || this.host?.constructor?.getWorldMapLayoutModel?.()
        || null;
    }

    getTileMapGeometry() {
      return global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('tileMapGeometry')
        || this.host?.constructor?.getTileMapGeometry?.()
        || null;
    }

    getTileMapAssetManifest() {
      return global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('tileMapAssetManifest')
        || this.host?.constructor?.getTileMapAssetManifest?.()
        || {};
    }

    getWorldMarchRoutePolicy() {
      return global.WorldMarchRoutePolicy
        || global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('worldMarchRoutePolicy')
        || this.host?.constructor?.getWorldMarchRoutePolicy?.()
        || null;
    }

    // CODEX_TEMP_MARCH_TARGET_DEBUG: remove after diagnosing tutorial march target state.
    getGameStateSource() {
      const candidates = [
        ['host.lastGameState', this.host?.lastGameState],
        ['host.lastWorldMarchState', this.host?.lastWorldMarchState],
        ['host.state', this.host?.state],
        ['host.lastGame.state', this.host?.lastGame?.state],
        ['host.host.lastGameState', this.host?.host?.lastGameState],
        ['host.host.lastWorldMarchState', this.host?.host?.lastWorldMarchState],
        ['host.host.state', this.host?.host?.state],
        ['host.host.lastGame.state', this.host?.host?.lastGame?.state],
      ];
      const match = candidates.find(([, state]) => state);
      return {
        source: match?.[0] || 'empty',
        state: match?.[1] || {},
        equality: {
          hostLastGameStateIsHostState: Boolean(this.host?.lastGameState && this.host?.lastGameState === this.host?.state),
          hostLastGameStateIsLastGameState: Boolean(this.host?.lastGameState && this.host?.lastGameState === this.host?.lastGame?.state),
          hostStateIsLastGameState: Boolean(this.host?.state && this.host?.state === this.host?.lastGame?.state),
          parentLastGameStateIsParentState: Boolean(this.host?.host?.lastGameState && this.host.host.lastGameState === this.host.host.state),
        },
      };
    }

    getGameState() {
      return this.getGameStateSource().state || {};
    }

    evaluateMarchTarget(tile = {}, tileMapView = {}) {
      const policy = this.getWorldMarchRoutePolicy();
      if (!policy?.evaluateMarchTarget) return null;
      return policy.evaluateMarchTarget(this.getGameState(), tile, { tileMapView });
    }

    normalizeTileCoord(tile = {}) {
      const helper = this.getTileMapGeometry();
      if (helper?.normalizeCoord) return helper.normalizeCoord(tile);
      return global.TileCoord.normalizeCoord(tile);
    }

    registerHitTargets(targets = []) {
      if (!Array.isArray(targets) || !targets.length) return false;
      targets.forEach((target) => this.addHitTarget(target.rect, target.action));
      return true;
    }

    // CODEX_TEMP_MARCH_TARGET_DEBUG: remove after diagnosing tutorial march target state.
    logMarchHitTargetDebugSnapshot(stage = '', tileMapView = {}, targets = []) {
      if (typeof window === 'undefined') return null;
      const marchTargets = (Array.isArray(targets) ? targets : [])
        .filter((target) => target?.action?.type === 'selectWorldMarchTarget');
      if (!marchTargets.length) return null;
      const disabledTargets = marchTargets.filter((target) => target?.action?.marchDisabled);
      const stateSource = this.getGameStateSource();
      const reasonCounts = {};
      disabledTargets.forEach((target) => {
        const reason = target?.action?.marchDisabledReason || 'UNKNOWN';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
      const sampleActions = [
        ...disabledTargets.slice(0, 10),
        ...marchTargets.filter((target) => !target?.action?.marchDisabled).slice(0, 4),
      ];
      const samples = sampleActions.map((target) => {
        const action = target.action || {};
        const tile = (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : []).find((item) => {
          const coord = summarizeMarchHitCoord(item);
          return coord && Number(coord.q) === Number(action.targetQ) && Number(coord.r) === Number(action.targetR);
        }) || action;
        let route = null;
        try {
          route = this.evaluateMarchTarget(tile, tileMapView);
        } catch (error) {
          route = { canMarch: null, reason: `debug-evaluate-error:${error?.message || error}` };
        }
        return {
          action: summarizeMarchHitAction(action),
          route: summarizeMarchHitRoute(route),
          mapView: summarizeMarchHitMapView(tileMapView, action),
        };
      });
      const payload = {
        at: new Date().toISOString(),
        stage,
        counts: {
          total: marchTargets.length,
          disabled: disabledTargets.length,
          enabled: marchTargets.length - disabledTargets.length,
        },
        reasonCounts,
        stateSource: stateSource.source,
        stateEquality: stateSource.equality,
        state: summarizeMarchHitState(stateSource.state),
        samples,
      };
      const signature = JSON.stringify({
        stage,
        counts: payload.counts,
        reasonCounts,
        stateSource: payload.stateSource,
        state: payload.state,
        samples: samples.map((sample) => ({
          action: sample.action,
          route: sample.route,
        })),
      });
      global.__codexTempMarchHitTargetDebugLastSignatureByStage = global.__codexTempMarchHitTargetDebugLastSignatureByStage || {};
      if (global.__codexTempMarchHitTargetDebugLastSignatureByStage[stage] === signature) return null;
      global.__codexTempMarchHitTargetDebugLastSignatureByStage[stage] = signature;
      try {
        const events = global.__codexTempMarchHitTargetDebugEvents || [];
        events.push(payload);
        while (events.length > 120) events.shift();
        global.__codexTempMarchHitTargetDebugEvents = events;
      } catch (_error) {
        // Debug logging must never affect gameplay.
      }
      global.console?.log?.('[CODEX_TEMP_MARCH_HIT_TARGET_DEBUG]', payload);
      return payload;
    }

    addWorldTileSiteHitTargets(tileMapView = {}, viewport = {}, entries = [], uiState = {}) {
      const hitTargetModel = this.getWorldMapHitTargetModel();
      if (hitTargetModel?.createWorldTileSiteHitTargets) {
        const targets = hitTargetModel.createWorldTileSiteHitTargets(tileMapView, viewport, entries, {
          layoutModel: this.getWorldMapLayoutModel(),
          analyzeAssetAlphaBounds: (assetPath) => this.analyzeAssetAlphaBounds(assetPath),
          tileMapGeometry: this.getTileMapGeometry(),
          tileMapAssetManifest: this.getTileMapAssetManifest(),
          uiState,
        });
        return this.registerHitTargets(targets);
      }
      const geometry = tileMapView.geometry || {};
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const targets = [];
      entries.filter(({ tile }) => tile?.site).forEach(({ tile, center }) => {
        const layout = this.getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center);
        if (!layout) return;
        const coord = this.normalizeTileCoord(tile);
        targets.push({
          rect: layout.hitRect,
          action: {
            type: 'openWorldSite',
            siteId: layout.site.id,
            tileId: coord.tileId,
            inputSurface: 'worldMap',
          },
        });
      });
      return this.registerHitTargets(targets);
    }

    addWorldMarchTileHitTargets(tileMapView = {}, viewport = {}, frame = {}) {
      const hitTargetModel = this.getWorldMapHitTargetModel();
      if (hitTargetModel?.createWorldMarchTileHitTargets) {
        const targets = hitTargetModel.createWorldMarchTileHitTargets(tileMapView, viewport, frame, {
          layoutModel: this.getWorldMapLayoutModel(),
          tileMapGeometry: this.getTileMapGeometry(),
          evaluateMarchTarget: (tile, view) => this.evaluateMarchTarget(tile, view),
        });
        this.logMarchHitTargetDebugSnapshot('addWorldMarchTileHitTargets:model', tileMapView, targets);
        return this.registerHitTargets(targets);
      }
      if (!Array.isArray(tileMapView.tiles) || !tileMapView.tiles.length) return false;
      const geometry = tileMapView.geometry || {};
      const targets = [];
      (tileMapView.tiles || []).forEach((tile) => {
        const coord = this.normalizeTileCoord(tile);
        const center = this.getWorldTileScreenCenter(tile, viewport, geometry);
        if (
          center.x < frame.x - 48
          || center.x > frame.x + frame.width + 48
          || center.y < frame.y - 32
          || center.y > frame.y + frame.height + 32
        ) return;
        const tileWidth = (Number(geometry.tileWidth) || 192) * (Number(viewport.scale) || 1) * 0.86;
        const tileHeight = (Number(geometry.tileHeight) || 96) * (Number(viewport.scale) || 1) * 0.86;
        const marchCheck = this.evaluateMarchTarget(tile, tileMapView);
        const marchDisabled = marchCheck?.canMarch === false;
        targets.push({
          rect: {
            x: center.x - tileWidth / 2,
            y: center.y - tileHeight / 2,
            width: tileWidth,
            height: tileHeight,
          },
          action: {
            type: 'selectWorldMarchTarget',
            tileId: coord.tileId,
            targetQ: coord.q,
            targetR: coord.r,
            known: tile.visibility !== 'unknown' && tile.discovered !== false,
            terrain: tile.terrain || '',
            terrainLabel: tile.terrainLabel || tile.terrain || '',
            marchDisabled,
            marchDisabledReason: marchDisabled ? (marchCheck.reason || 'EXPLORE_ROUTE_BLOCKED') : '',
            background: true,
            inputSurface: 'worldMap',
          },
        });
      });
      this.logMarchHitTargetDebugSnapshot('addWorldMarchTileHitTargets:fallback', tileMapView, targets);
      return this.registerHitTargets(targets);
    }
  }

  global.WorldMapHitTargetFacade = WorldMapHitTargetFacade;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapHitTargetFacade;
})(typeof window !== 'undefined' ? window : globalThis);
