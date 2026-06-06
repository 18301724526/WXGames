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

    static getWorldTileMapSignature(territoryState = {}, worldExplorerState = {}) {
      const worldMap = territoryState.worldMap || {};
      const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
      const sites = Array.isArray(territoryState.territories) ? territoryState.territories : [];
      const missions = Array.isArray(territoryState.scoutMissions) ? territoryState.scoutMissions : [];
      const explorerMissions = Array.isArray(worldExplorerState.missions)
        ? worldExplorerState.missions
        : [
          worldExplorerState.activeMission,
          ...(Array.isArray(worldExplorerState.readyMissions) ? worldExplorerState.readyMissions : []),
        ].filter(Boolean);
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
          route: mission.route || [],
          revealArea: mission.revealArea || [],
          revealedTileIds: mission.revealedTileIds || [],
          actionPointsRemaining: mission.actionPointsRemaining,
        })),
        explorerMissions: explorerMissions.map((mission) => ({
          id: mission.id,
          status: mission.status,
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
          plannedSites: mission.plannedSites || [],
          revealedTileIds: mission.revealedTileIds || [],
        })),
      });
    }

    static normalizeWorldTile(tile = {}, siteById = new Map()) {
      const manifest = this.getTileMapManifest();
      const terrain = tile.terrain || 'plains';
      const terrainAsset = manifest.getTerrainAsset?.(terrain) || manifest.terrain?.[terrain] || manifest.terrain?.plains || {};
      const featureAsset = terrainAsset.feature ? manifest.getFeatureAsset?.(terrainAsset.feature) : null;
      const templateAssets = manifest.getTileTemplateAssets?.(tile) || [];
      const site = tile.siteId ? siteById.get(tile.siteId) : null;
      const siteAsset = site ? manifest.getSiteAsset?.(site.type || 'town') : null;
      const mountainNeighbors = terrain === 'mountain'
        ? [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
          .filter(([dq, dr]) => {
            const id = `tile_${this.toInteger(tile.q) + dq}_${this.toInteger(tile.r) + dr}`;
            return siteById.__tileTerrainById?.get(id) === 'mountain';
          }).length
        : 0;
      return {
        id: tile.id || `tile_${this.toInteger(tile.q)}_${this.toInteger(tile.r)}`,
        q: this.toInteger(tile.q),
        r: this.toInteger(tile.r),
        terrain,
        terrainLabel: terrainAsset.label || terrain,
        terrainAsset: terrainAsset.path || '',
        waterAsset: terrainAsset.water ? manifest.getWaterAsset?.(terrainAsset.water)?.path || '' : '',
        templateAssets: templateAssets.map((asset) => ({
          label: asset.label || '',
          key: asset.key || '',
          type: asset.templateType || '',
          asset: asset.path || '',
        })).filter((asset) => asset.asset),
        water: terrainAsset.water ? {
          kind: terrainAsset.water,
          asset: manifest.getWaterAsset?.(terrainAsset.water)?.path || '',
          uvScale: manifest.getWaterAsset?.(terrainAsset.water)?.uvScale || 1,
          speedX: manifest.getWaterAsset?.(terrainAsset.water)?.speedX || 0,
          speedY: manifest.getWaterAsset?.(terrainAsset.water)?.speedY || 0,
          alpha: manifest.getWaterAsset?.(terrainAsset.water)?.alpha || 1,
        } : null,
        riverPorts: Array.isArray(tile.riverPorts) ? tile.riverPorts.filter(Boolean) : [],
        oceanTemplates: Array.isArray(tile.oceanTemplates) ? tile.oceanTemplates.filter(Boolean) : [],
        transitionKey: typeof tile.transitionKey === 'string' ? tile.transitionKey : '',
        mountainNeighbors,
        feature: featureAsset ? {
          key: terrainAsset.feature,
          asset: featureAsset.path || '',
          overlayKey: featureAsset.overlayKey || '',
          scale: featureAsset.scale || 0.5,
          offset: manifest.getOverlayOffset?.(featureAsset.overlayKey) || { x: 0, y: 0 },
        } : null,
        discovered: tile.discovered !== false,
        visible: tile.visible !== false,
        visibility: tile.visibility || (tile.discovered === false ? 'unknown' : 'scouted'),
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
        site: site ? {
          id: site.id || '',
          type: site.type || '',
          status: site.status || '',
          owner: site.owner || '',
          name: site.cityName || site.naturalName || '',
          title: site.naturalName || site.cityName || '',
          art: site.art || siteAsset?.path || '',
          overlayKey: siteAsset?.overlayKey || manifest.getSiteOverlayKey?.(site.type) || `site:${site.type || 'town'}`,
          offset: manifest.getOverlayOffset?.(siteAsset?.overlayKey || manifest.getSiteOverlayKey?.(site.type) || `site:${site.type || 'town'}`) || { x: 0, y: 0 },
          scale: siteAsset?.scale || 0.46,
        } : null,
      };
    }

    static normalizeWorldExplorerMission(mission = {}) {
      if (!mission || typeof mission !== 'object') return null;
      const route = (Array.isArray(mission.route) ? mission.route : []).map((step, index) => ({
        q: this.toInteger(step.q),
        r: this.toInteger(step.r),
        step: this.toInteger(step.step, index + 1),
        tileId: step.tileId || `tile_${this.toInteger(step.q)}_${this.toInteger(step.r)}`,
        revealed: Boolean(step.revealed),
      }));
      if (!route.length) return null;
      return {
        id: mission.id || '',
        kind: 'worldExplore',
        direction: mission.mode || 'random',
        status: mission.status || '',
        actionPoints: route.length,
        actionPointsRemaining: route.filter((step) => !step.revealed).length,
        route,
        revealArea: route,
        revealedTileIds: Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds.map(String) : [],
      };
    }

    static getWorldExplorerMissions(worldExplorerState = {}) {
      const fromList = Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions : [];
      const fromSlots = [
        worldExplorerState.activeMission,
        ...(Array.isArray(worldExplorerState.readyMissions) ? worldExplorerState.readyMissions : []),
      ].filter(Boolean);
      const byId = new Map();
      [...fromList, ...fromSlots].forEach((mission) => {
        if (!mission || typeof mission !== 'object') return;
        const id = mission.id || `explore-${byId.size}`;
        byId.set(id, mission);
      });
      return [...byId.values()];
    }

    static getWorldExplorerPlannedTiles(worldExplorerState = {}) {
      const byId = new Map();
      this.getWorldExplorerMissions(worldExplorerState).forEach((mission) => {
        (Array.isArray(mission.plannedTiles) ? mission.plannedTiles : []).forEach((tile) => {
          if (!tile || typeof tile !== 'object') return;
          const q = this.toInteger(tile.q);
          const r = this.toInteger(tile.r);
          const id = tile.id || `tile_${q}_${r}`;
          byId.set(id, {
            ...tile,
            id,
            q,
            r,
            visibility: tile.visibility || 'scouted',
            discovered: tile.discovered !== false,
            visible: tile.visible !== false,
          });
        });
      });
      return [...byId.values()];
    }

    static buildWorldTileMapViewState(territoryState = {}, options = {}) {
      const worldMap = territoryState.worldMap || {};
      const rawTiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
      const worldExplorerState = options.worldExplorerState || {};
      const plannedTiles = this.getWorldExplorerPlannedTiles(worldExplorerState);
      const rawTileById = new Map(rawTiles.map((tile) => [tile.id || `tile_${this.toInteger(tile.q)}_${this.toInteger(tile.r)}`, tile]));
      plannedTiles.forEach((tile) => {
        const existing = rawTileById.get(tile.id);
        rawTileById.set(tile.id, existing ? { ...tile, ...existing } : tile);
      });
      const mergedTiles = [...rawTileById.values()];
      const territories = Array.isArray(territoryState.territories) ? territoryState.territories : [];
      const siteById = new Map(territories.map((site) => [site.id, site]));
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
      const explorerScouts = this.getWorldExplorerMissions(worldExplorerState)
        .filter((mission) => ['active', 'ready'].includes(mission.status))
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
      return {
        signature: this.getWorldTileMapSignature(territoryState, worldExplorerState),
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
    }
  }

  global.WorldTileMapPresenter = WorldTileMapPresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldTileMapPresenter;
})(typeof window !== 'undefined' ? window : globalThis);
