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
        tiles: tiles.map((tile) => ({
          id: tile.id,
          q: tile.q,
          r: tile.r,
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
          position: mission.position || null,
          route: mission.route || [],
          revealArea: mission.revealArea || [],
          revealedTileIds: mission.revealedTileIds || [],
          actionPointsRemaining: mission.actionPointsRemaining,
        })),
        explorerMissions: explorerMissions.map((mission) => ({
          id: mission.id,
          status: mission.status,
          position: mission.position || null,
          route: mission.route || [],
          plannedTiles: (mission.plannedTiles || []).map((tile) => ({
            id: tile.id,
            q: tile.q,
            r: tile.r,
            terrain: tile.terrain,
            siteId: tile.siteId || null,
            visibility: tile.visibility || '',
            riverPorts: tile.riverPorts || [],
            oceanTemplates: tile.oceanTemplates || [],
            transitionKey: tile.transitionKey || '',
          })),
          plannedSites: (mission.plannedSites || []).map((site) => ({
            tileId: site.tileId || '',
            q: site.q,
            r: site.r,
            siteId: site.siteId || site.site?.id || null,
            materialized: Boolean(site.materialized),
            revealedAt: site.revealedAt || '',
            site: site.site ? {
              id: site.site.id,
              x: site.site.x,
              y: site.site.y,
              status: site.site.status,
              owner: site.site.owner,
              type: site.site.type,
              art: site.site.art,
              name: site.site.cityName || site.site.naturalName,
            } : null,
          })),
          revealedTileIds: mission.revealedTileIds || [],
        })),
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

    static buildWorldTileMapViewState(territoryState = {}, options = {}) {
      const worldMap = territoryState.worldMap || {};
      const rawTiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
      const worldExplorerState = options.worldExplorerState || {};
      const plannedTiles = this.getWorldExplorerPlannedTiles(worldExplorerState, options);
      const rawTileById = new Map(rawTiles.map((tile) => [tile.id || `tile_${this.toInteger(tile.q)}_${this.toInteger(tile.r)}`, tile]));
      plannedTiles.forEach((tile) => {
        const existing = rawTileById.get(tile.id);
        rawTileById.set(tile.id, existing ? { ...existing, ...tile } : tile);
      });
      const territories = Array.isArray(territoryState.territories) ? territoryState.territories : [];
      const territoryById = new Map(territories.map((site) => [site.id, site]));
      territories.forEach((site) => {
        if (!site?.id) return;
        const q = this.toInteger(site.x ?? site.q);
        const r = this.toInteger(site.y ?? site.r);
        const tileId = this.getWorldTileId(q, r);
        const existing = rawTileById.get(tileId);
        rawTileById.set(tileId, {
          ...(existing || { id: tileId, q, r, terrain: site.mapTerrain || site.terrain || 'plains' }),
          id: tileId,
          q: this.toInteger(existing?.q ?? q),
          r: this.toInteger(existing?.r ?? r),
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
        const tileId = this.getWorldTileId(site.x, site.y);
        const existing = rawTileById.get(tileId);
        rawTileById.set(tileId, {
          ...(existing || { id: tileId, q: site.x, r: site.y, terrain: site.mapTerrain || 'plains' }),
          id: tileId,
          q: this.toInteger(existing?.q ?? site.x),
          r: this.toInteger(existing?.r ?? site.y),
          terrain: existing?.terrain || site.mapTerrain || 'plains',
          visibility: existing?.visibility || 'scouted',
          discovered: existing?.discovered !== false,
          visible: existing?.visible !== false,
          siteId: existing?.siteId || site.id,
        });
      });
      const mergedTiles = [...rawTileById.values()];
      const siteById = new Map([...territories, ...plannedSites].map((site) => [site.id, site]));
      siteById.__tileTerrainById = new Map(mergedTiles.map((tile) => [tile.id || `tile_${this.toInteger(tile.q)}_${this.toInteger(tile.r)}`, tile.terrain || 'plains']));
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
          route: (Array.isArray(mission.route) ? mission.route : []).map((step) => ({
            q: this.toInteger(step.q),
            r: this.toInteger(step.r),
            step: this.toInteger(step.step),
            tileId: step.tileId || `tile_${this.toInteger(step.q)}_${this.toInteger(step.r)}`,
            revealed: Boolean(step.revealed),
          })),
          revealArea: (Array.isArray(mission.revealArea) ? mission.revealArea : []).map((coord) => ({
            q: this.toInteger(coord.q),
            r: this.toInteger(coord.r),
            step: this.toInteger(coord.step),
            kind: coord.kind === 'branch' ? 'branch' : 'main',
            tileId: coord.tileId || `tile_${this.toInteger(coord.q)}_${this.toInteger(coord.r)}`,
            revealed: Boolean(coord.revealed),
          })),
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
          coords: (Array.isArray(area.coords) ? area.coords : []).map((coord) => ({
            q: this.toInteger(coord.q),
            r: this.toInteger(coord.r),
            tileId: coord.tileId || `tile_${this.toInteger(coord.q)}_${this.toInteger(coord.r)}`,
          })),
          scoutedAt: area.scoutedAt || '',
        }));
      const bounds = geometry?.getBounds ? geometry.getBounds(sortedTiles) : { width: 0, height: 0 };
      const viewState = {
        signature: this.getWorldTileMapSignature(territoryState, worldExplorerState, options),
        version: worldMap.version || 0,
        seed: worldMap.seed || '',
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
      return viewState;
    }
  }

  global.WorldTileMapPresenter = WorldTileMapPresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldTileMapPresenter;
})(typeof window !== 'undefined' ? window : globalThis);
