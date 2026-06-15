(function (global) {
  const sharedTileMapManifest = (() => {
    if (global.TileMapAssetManifest) return global.TileMapAssetManifest;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../config/TileMapAssetManifest');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedTileMapGeometry = (() => {
    if (global.TileMapGeometry) return global.TileMapGeometry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/TileMapGeometry');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedTileNormalizer = (() => {
    if (global.WorldTileMapTileNormalizer) return global.WorldTileMapTileNormalizer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldTileMapTileNormalizer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedExplorerNormalizer = (() => {
    if (global.WorldTileMapExplorerNormalizer) return global.WorldTileMapExplorerNormalizer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldTileMapExplorerNormalizer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedRenderDiagnostics = (() => {
    if (global.WorldTileMapRenderDiagnostics) return global.WorldTileMapRenderDiagnostics;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldTileMapRenderDiagnostics');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class WorldTileMapPresenter {
    static toNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    static toInteger(value, fallback = 0) {
      return Math.floor(this.toNumber(value, fallback));
    }

    static getTileMapManifest() {
      return sharedTileMapManifest || {};
    }

    static getTileMapGeometry() {
      return sharedTileMapGeometry || null;
    }

    static getWorldTileMapSignature(territoryState = {}, worldExplorerState = {}, options = {}) {
      const worldMap = territoryState.worldMap || {};
      const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
      const sites = Array.isArray(territoryState.territories) ? territoryState.territories : [];
      const missions = Array.isArray(territoryState.scoutMissions) ? territoryState.scoutMissions : [];
      const explorerMissions = this.getWorldExplorerMissions(worldExplorerState, options);
      return JSON.stringify({
        version: worldMap.version || 0,
        seed: worldMap.seed || '',
        origin: this.summarizeCoordForSignature(worldMap.origin || {}),
        tiles: tiles.map((tile) => this.summarizeTileForSignature(tile)),
        sites: sites.map((site) => this.summarizeSiteForSignature(site)),
        missions: missions.map((mission) => this.summarizeScoutMissionForSignature(mission)),
        explorerMissions: explorerMissions.map((mission) => this.summarizeExplorerMissionForSignature(mission)),
      });
    }

    static normalizeWorldTile(tile = {}, siteById = new Map()) {
      return sharedTileNormalizer.normalizeWorldTile(tile, siteById, {
        manifest: this.getTileMapManifest(),
      });
    }

    static normalizeWorldExplorerMission(mission = {}) {
      return sharedExplorerNormalizer.normalizeWorldExplorerMission(mission);
    }

    static getWorldExplorerMissions(worldExplorerState = {}, options = {}) {
      return sharedExplorerNormalizer.getWorldExplorerMissions(worldExplorerState, options);
    }

    static getWorldExplorerPlannedTiles(worldExplorerState = {}, options = {}) {
      return sharedExplorerNormalizer.getWorldExplorerPlannedTiles(worldExplorerState, options);
    }

    static getWorldExplorerPlannedSites(worldExplorerState = {}, options = {}) {
      return sharedExplorerNormalizer.getWorldExplorerPlannedSites(worldExplorerState, options);
    }

    static getWorldTileId(q, r) {
      return sharedExplorerNormalizer.getWorldTileId(q, r);
    }

    static normalizeCoord(coord = {}, fallback = {}) {
      return sharedExplorerNormalizer.normalizeCoord(coord, fallback);
    }

    static getTileRenderLogState() {
      if (!this.tileRenderLogState) this.tileRenderLogState = sharedRenderDiagnostics?.createState?.() || null;
      return this.tileRenderLogState;
    }

    static resetTileRenderLogStateForTest() {
      this.tileRenderLogState = null;
    }

    static recordTileRenderDiagnostics(drawTiles = [], context = {}) {
      if (!sharedRenderDiagnostics?.record) return;
      sharedRenderDiagnostics.record(drawTiles, {
        context,
        logger: global.ClientOperationLog,
        normalizeCoord: (tile) => this.normalizeCoord(tile),
        state: this.getTileRenderLogState(),
      });
    }

    static summarizeCoordForSignature(coord = {}, fallback = {}) {
      const normalized = this.normalizeCoord(coord, fallback);
      return {
        q: normalized.q,
        r: normalized.r,
        tileId: normalized.tileId,
      };
    }

    static summarizeRouteCoordForSignature(coord = {}) {
      const normalized = this.summarizeCoordForSignature(coord);
      return {
        q: normalized.q,
        r: normalized.r,
        step: this.toInteger(coord.step),
        tileId: normalized.tileId,
        kind: coord.kind === 'branch' ? 'branch' : (coord.kind || ''),
        revealed: Boolean(coord.revealed),
      };
    }

    static summarizeTileForSignature(tile = {}) {
      const coord = this.summarizeCoordForSignature(tile);
      return {
        id: coord.tileId,
        q: coord.q,
        r: coord.r,
        terrain: tile.terrain,
        discovered: tile.discovered !== false,
        visible: tile.visible !== false,
        visibility: tile.visibility || '',
        discoveredAt: tile.discoveredAt || '',
        lastScoutedAt: tile.lastScoutedAt || '',
        intel: tile.intel && typeof tile.intel === 'object' ? {
          level: this.toInteger(tile.intel.level, 0),
          knownTerrain: Boolean(tile.intel.knownTerrain),
          knownSite: Boolean(tile.intel.knownSite),
          knownOwner: Boolean(tile.intel.knownOwner),
          knownGarrison: Boolean(tile.intel.knownGarrison),
          knownLeader: Boolean(tile.intel.knownLeader),
          knownSkill: Boolean(tile.intel.knownSkill),
        } : null,
        siteId: tile.siteId || null,
        riverPorts: tile.riverPorts || [],
        oceanTemplates: tile.oceanTemplates || [],
        transitionKey: tile.transitionKey || '',
      };
    }

    static summarizeSiteForSignature(site = {}) {
      const coord = this.summarizeCoordForSignature(site);
      return {
        id: site.id,
        q: coord.q,
        r: coord.r,
        tileId: coord.tileId,
        status: site.status,
        owner: site.owner,
        type: site.type,
        art: site.art,
        name: site.cityName || site.naturalName,
      };
    }

    static summarizeScoutMissionForSignature(mission = {}) {
      return {
        id: mission.id,
        status: mission.status,
        position: mission.position ? this.summarizeCoordForSignature(mission.position) : null,
        route: (mission.route || []).map((step) => this.summarizeRouteCoordForSignature(step)),
        revealArea: (mission.revealArea || []).map((coord) => this.summarizeRouteCoordForSignature(coord)),
        revealedTileIds: mission.revealedTileIds || [],
        actionPointsRemaining: mission.actionPointsRemaining,
      };
    }

    static summarizePlannedSiteForSignature(plannedSite = {}) {
      const rawSite = plannedSite.site && typeof plannedSite.site === 'object' ? plannedSite.site : null;
      const coord = this.summarizeCoordForSignature(plannedSite, rawSite || {});
      const siteCoord = rawSite ? this.summarizeCoordForSignature(rawSite) : null;
      return {
        tileId: coord.tileId,
        q: coord.q,
        r: coord.r,
        siteId: plannedSite.siteId || rawSite?.id || null,
        materialized: Boolean(plannedSite.materialized),
        revealedAt: plannedSite.revealedAt || '',
        site: rawSite ? {
          id: rawSite.id,
          q: siteCoord.q,
          r: siteCoord.r,
          tileId: siteCoord.tileId,
          status: rawSite.status,
          owner: rawSite.owner,
          type: rawSite.type,
          art: rawSite.art,
          name: rawSite.cityName || rawSite.naturalName,
        } : null,
      };
    }

    static summarizeExplorerMissionForSignature(mission = {}) {
      return {
        id: mission.id,
        status: mission.status,
        position: mission.position ? this.summarizeCoordForSignature(mission.position) : null,
        route: (mission.route || []).map((step) => this.summarizeRouteCoordForSignature(step)),
        plannedTiles: (mission.plannedTiles || []).map((tile) => this.summarizeTileForSignature(tile)),
        plannedSites: (mission.plannedSites || []).map((site) => this.summarizePlannedSiteForSignature(site)),
        revealedTileIds: sharedExplorerNormalizer.normalizeRevealedTileIds
          ? sharedExplorerNormalizer.normalizeRevealedTileIds(mission.revealedTileIds, mission.route)
          : (mission.revealedTileIds || []),
      };
    }

    static buildWorldTileMapViewState(territoryState = {}, options = {}) {
      const worldMap = territoryState.worldMap || {};
      const rawTiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
      const worldExplorerState = options.worldExplorerState || {};
      const plannedTiles = this.getWorldExplorerPlannedTiles(worldExplorerState, options);
      const rawTileById = new Map();
      rawTiles.forEach((tile) => {
        const coord = this.normalizeCoord(tile);
        rawTileById.set(coord.tileId, {
          ...tile,
          id: coord.tileId,
          q: coord.q,
          r: coord.r,
        });
      });
      plannedTiles.forEach((tile) => {
        const coord = this.normalizeCoord(tile);
        const existing = rawTileById.get(coord.tileId);
        if (existing) {
          rawTileById.set(coord.tileId, {
            ...existing,
            id: coord.tileId,
            q: coord.q,
            r: coord.r,
            renderReady: Boolean(existing.renderReady || tile.renderReady),
            renderOnly: false,
          });
          return;
        }
        rawTileById.set(coord.tileId, {
          ...tile,
          id: coord.tileId,
          q: coord.q,
          r: coord.r,
        });
      });
      const territories = Array.isArray(territoryState.territories) ? territoryState.territories : [];
      const territoryById = new Map(territories.map((site) => [site.id, site]));
      territories.forEach((site) => {
        if (!site?.id) return;
        const coord = this.normalizeCoord(site);
        const q = coord.q;
        const r = coord.r;
        const tileId = coord.tileId;
        const existing = rawTileById.get(tileId);
        rawTileById.set(tileId, {
          ...(existing || { id: tileId, q, r, terrain: site.mapTerrain || site.terrain || 'plains' }),
          id: tileId,
          q,
          r,
          terrain: existing?.terrain || site.mapTerrain || site.terrain || 'plains',
          visibility: existing?.visibility || (site.owner === 'player' ? 'controlled' : 'scouted'),
          discovered: existing?.discovered !== false,
          visible: existing?.visible !== false,
          siteId: existing?.siteId || site.id,
        });
      });
      const plannedSites = this.getWorldExplorerPlannedSites(worldExplorerState, options)
        .filter((site) => !territoryById.has(site.id));
      plannedSites.forEach((site) => {
        const coord = this.normalizeCoord(site);
        const tileId = coord.tileId;
        const existing = rawTileById.get(tileId);
        rawTileById.set(tileId, {
          ...(existing || { id: tileId, q: coord.q, r: coord.r, terrain: site.mapTerrain || 'plains' }),
          id: tileId,
          q: coord.q,
          r: coord.r,
          terrain: existing?.terrain || site.mapTerrain || 'plains',
          visibility: existing?.visibility || 'scouted',
          discovered: existing?.discovered !== false,
          visible: existing?.visible !== false,
          siteId: existing?.siteId || site.id,
        });
      });
      const mergedTiles = [...rawTileById.values()];
      const siteById = new Map([...territories, ...plannedSites].map((site) => [site.id, site]));
      siteById.__tileTerrainById = new Map(mergedTiles.map((tile) => [this.normalizeCoord(tile).tileId, tile.terrain || 'plains']));
      siteById.__nonRenderOnlyTileTerrainById = new Map(mergedTiles
        .filter((tile) => !tile.renderOnly)
        .map((tile) => [this.normalizeCoord(tile).tileId, tile.terrain || 'plains']));
      const geometry = this.getTileMapGeometry();
      const normalizedTiles = mergedTiles.map((tile) => this.normalizeWorldTile(tile, siteById));
      const sortedTiles = geometry?.sortTilesForIsoDraw
        ? geometry.sortTilesForIsoDraw(normalizedTiles)
        : normalizedTiles;
      const terrainPriority = { ocean: 0, river: 1 };
      const drawTiles = [...sortedTiles].sort((a, b) => {
        const terrainDelta = (terrainPriority[a.terrain] ?? 2) - (terrainPriority[b.terrain] ?? 2);
        if (terrainDelta) return terrainDelta;
        return 0;
      });
      const activeScouts = (Array.isArray(territoryState.scoutMissions) ? territoryState.scoutMissions : [])
        .filter((mission) => mission.kind === 'scout' && ['active', 'ready'].includes(mission.status))
        .map((mission) => ({
          id: mission.id || '',
          direction: mission.direction || '',
          status: mission.status || '',
          actionPoints: this.toInteger(mission.actionPoints),
          actionPointsRemaining: this.toInteger(mission.actionPointsRemaining),
          route: (Array.isArray(mission.route) ? mission.route : []).map((step) => {
            const coord = this.normalizeCoord(step);
            return {
              q: coord.q,
              r: coord.r,
              step: this.toInteger(step.step),
              tileId: coord.tileId,
              revealed: Boolean(step.revealed),
            };
          }),
          revealArea: (Array.isArray(mission.revealArea) ? mission.revealArea : []).map((areaCoord) => {
            const coord = this.normalizeCoord(areaCoord);
            return {
              q: coord.q,
              r: coord.r,
              step: this.toInteger(areaCoord.step),
              kind: areaCoord.kind === 'branch' ? 'branch' : 'main',
              tileId: coord.tileId,
              revealed: Boolean(areaCoord.revealed),
            };
          }),
          revealedTileIds: Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds.map(String) : [],
        }));
      const explorerScouts = this.getWorldExplorerMissions(worldExplorerState, options)
        .filter((mission) => ['active', 'ready', 'idle'].includes(mission.status))
        .map((mission) => this.normalizeWorldExplorerMission(mission))
        .filter(Boolean);
      const scoutAreas = (Array.isArray(territoryState.scoutAreas) ? territoryState.scoutAreas : [])
        .map((area) => ({
          id: area.id || '',
          missionId: area.missionId || null,
          direction: area.direction || null,
          result: area.result === 'site' ? 'site' : 'empty',
          siteId: area.siteId || null,
          targetX: this.toInteger(area.targetX),
          targetY: this.toInteger(area.targetY),
          tileIds: Array.isArray(area.tileIds) ? area.tileIds.map(String) : [],
          coords: (Array.isArray(area.coords) ? area.coords : []).map((areaCoord) => {
            const coord = this.normalizeCoord(areaCoord);
            return {
              q: coord.q,
              r: coord.r,
              tileId: coord.tileId,
            };
          }),
          scoutedAt: area.scoutedAt || '',
        }));
      const bounds = geometry?.getBounds ? geometry.getBounds(sortedTiles) : { width: 0, height: 0 };
      const origin = this.summarizeCoordForSignature(worldMap.origin || {});
      const viewState = {
        signature: this.getWorldTileMapSignature(territoryState, worldExplorerState, options),
        version: worldMap.version || 0,
        seed: worldMap.seed || '',
        origin,
        pan: {
          x: this.toNumber(options.panX),
          y: this.toNumber(options.panY),
        },
        geometry: geometry?.DEFAULT_GEOMETRY || { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
        bounds,
        tiles: drawTiles,
        sites: drawTiles.filter((tile) => tile.site).map((tile) => ({
          ...tile.site,
          tileId: tile.id,
          q: tile.q,
          r: tile.r,
        })),
        activeScouts: [...activeScouts, ...explorerScouts],
        scoutAreas,
      };
      global.WorldMarchTrace?.logDedup?.(
        'presenter:buildWorldTileMapViewState',
        [
          rawTiles.length,
          plannedTiles.length,
          plannedSites.length,
          mergedTiles.length,
          explorerScouts.map((mission) => `${mission.id}:${mission.status}:${mission.revealedTileIds?.length || 0}`).join(','),
        ].join('|'),
        {
          rawTileCount: rawTiles.length,
          plannedTileCount: plannedTiles.length,
          plannedSiteCount: plannedSites.length,
          mergedTileCount: mergedTiles.length,
          drawTileCount: drawTiles.length,
          activeScouts: explorerScouts.map((mission) => global.WorldMarchTrace?.summarizeMission?.(mission)),
        },
      );
      this.recordTileRenderDiagnostics(drawTiles, {
        version: worldMap.version || 0,
        rawTileCount: rawTiles.length,
        plannedTileCount: plannedTiles.length,
        plannedSiteCount: plannedSites.length,
        mergedTileCount: mergedTiles.length,
        activeScouts: explorerScouts,
      });
      return viewState;
    }
  }

  global.WorldTileMapPresenter = WorldTileMapPresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldTileMapPresenter;
})(typeof window !== 'undefined' ? window : globalThis);
