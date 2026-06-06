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

  const sharedUnitSpriteManifest = (() => {
    if (global.UnitSpriteManifest) return global.UnitSpriteManifest;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../config/UnitSpriteManifest');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();
  const sharedWorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldMarchSystem');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();
  const SharedWorldActorCanvasRenderer = (() => {
    if (global.WorldActorCanvasRenderer) return global.WorldActorCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldActorCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();
  const SharedWorldMarchHudCanvasRenderer = (() => {
    if (global.WorldMarchHudCanvasRenderer) return global.WorldMarchHudCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMarchHudCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedTutorialIntroUnitRenderer = (() => {
    if (global.TutorialIntroUnitRenderer) return global.TutorialIntroUnitRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./TutorialIntroUnitRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class WorldMapCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      const ActorRendererClass = options.worldActorRendererClass || SharedWorldActorCanvasRenderer;
      const childHost = options.childHost || options.host || this;
      this.worldActorRenderer = options.worldActorRenderer || (ActorRendererClass ? new ActorRendererClass({ host: childHost }) : null);
      const MarchHudRendererClass = options.worldMarchHudRendererClass || SharedWorldMarchHudCanvasRenderer;
      this.worldMarchHudRenderer = options.worldMarchHudRenderer || (MarchHudRendererClass ? new MarchHudRendererClass({ host: childHost }) : null);
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host) {
            if (typeof prop === 'string' && prop.startsWith('worldTile')) return host[prop];
            if (prop in host) {
              const hostValue = host[prop];
              return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
            }
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value);
          if (target.host) {
            if (typeof prop === 'string' && prop.startsWith('worldTile')) {
              target.host[prop] = value;
              return true;
            }
            if (prop in target.host) {
              target.host[prop] = value;
              return true;
            }
          }
          target[prop] = value;
          return true;
        },
      });
    }

    static getTileMapAssetManifest() {
      return sharedTileMapManifest || {};
    }

    static getTileMapGeometry() {
      return sharedTileMapGeometry || null;
    }

    static getUnitSpriteManifest() {
      return sharedUnitSpriteManifest || null;
    }

    static getTutorialIntroUnitRenderer() {
      return sharedTutorialIntroUnitRenderer || null;
    }

    render(tileMapView = {}, x = 0, y = 0, width = 0, height = 0, uiState = {}, options = {}) {
      return this.renderWorldTileMap(tileMapView, x, y, width, height, uiState, options);
    }

    getWorldSiteDialogPresenter() {
      return this.presenter || this.host?.presenter || null;
    }

    buildWorldSiteDialogViewState(territories = [], territoryState = {}, uiState = {}) {
      const presenter = this.getWorldSiteDialogPresenter();
      if (presenter && typeof presenter.buildWorldSiteDialogViewState === 'function') {
        return presenter.buildWorldSiteDialogViewState(territories, territoryState, uiState);
      }
      return this.buildFallbackWorldSiteDialogViewState(territories, territoryState, uiState);
    }

    buildFallbackWorldSiteDialogViewState(territories = [], territoryState = {}, uiState = {}) {
      const selectedSiteId = uiState.selectedSiteId || '';
      const makeButton = (label, action, territoryId, options = {}) => ({
        label,
        action: action || '',
        territoryId: territoryId || '',
        disabled: Boolean(options.disabled),
        secondary: Boolean(options.secondary),
      });
      const makeAction = (site = {}) => {
        if (site.status === 'occupied') {
          return {
            kind: 'city-command',
            buttons: [
              makeButton('\u5165\u57ce', 'enter-city', site.id),
              makeButton('\u884c\u519b', 'march-city', site.id, { disabled: true, secondary: true }),
              makeButton('\u8c03\u52a8', 'transfer-city', site.id, { disabled: true, secondary: true }),
              makeButton('\u9a7b\u5b88', 'garrison-city', site.id, { disabled: true, secondary: true }),
              makeButton('\u4f63\u5de5', 'labor-city', site.id, { secondary: true }),
              makeButton('\u6539\u540d', 'rename-city', site.id, { secondary: true }),
            ],
            hint: '',
            expeditionConfig: null,
          };
        }
        return {
          kind: 'single',
          buttons: [makeButton('\u7b49\u5f85\u4fa6\u5bdf', '', site.id, { disabled: true })],
          hint: '',
          expeditionConfig: null,
        };
      };
      const details = (territories || []).map((site) => ({
        id: site.id || '',
        visible: site.id === selectedSiteId,
        text: {
          name: site.cityName || site.naturalName || site.name || '',
          status: site.status === 'occupied' ? '\u5df2\u63a7\u5236' : (site.status || ''),
          owner: site.owner === 'player' ? '\u6211\u65b9' : (site.owner || ''),
          distance: `\u8ddd ${site.originDistance ?? site.distance ?? 0}`,
          scale: `\u89c4\u6a21 ${site.scale || 1}`,
          threat: `\u5a01\u80c1 ${site.threat || 0}`,
          summary: site.summary || '',
          defense: `\u9632\u5fa1 ${site.defense || 0}`,
          soldiers: `\u5efa\u8bae ${site.recommendedSoldiers || 0} \u58eb\u5175`,
        },
        action: makeAction(site),
      }));
      const view = {
        selectedSiteId,
        showModal: details.some((detail) => detail.id === selectedSiteId),
        details,
      };
      return {
        ...view,
        signature: JSON.stringify(view),
      };
    }

    getWorldTileScreenCenter(tile = {}, viewport = {}, geometry = {}) {
      const helper = this.constructor.getTileMapGeometry();
      if (helper?.getTileScreenCenter) return helper.getTileScreenCenter(tile, viewport, geometry);
      const stepX = Number(geometry.stepX) || 96;
      const stepY = Number(geometry.stepY) || 48;
      const q = Number(tile.q) || 0;
      const r = Number(tile.r) || 0;
      return {
        x: viewport.originX + viewport.panX + (q - r) * stepX * viewport.scale,
        y: viewport.originY + viewport.panY + (q + r) * stepY * viewport.scale,
      };
    }

    getWorldTileDrawRect(center = {}, scale = 1, geometry = {}) {
      const helper = this.constructor.getTileMapGeometry();
      if (helper?.getTileDrawRect) return helper.getTileDrawRect(center, scale, geometry);
      const tileWidth = (Number(geometry.tileWidth) || 192) + 3;
      const tileHeight = (Number(geometry.tileHeight) || 96) + 1.5;
      const anchorY = Number.isFinite(Number(geometry.anchorY)) ? Number(geometry.anchorY) : 0.5;
      return {
        x: center.x - tileWidth * scale * 0.5,
        y: center.y - tileHeight * scale * anchorY,
        width: tileWidth * scale,
        height: tileHeight * scale,
      };
    }

    drawIsoDiamond(cx, cy, width, height, options = {}) {
      if (!this.ctx) return;
      this.ctx.fillStyle = options.fill || 'rgba(71, 97, 67, 0.72)';
      this.ctx.strokeStyle = options.stroke || 'rgba(255, 226, 177, 0.14)';
      this.ctx.lineWidth = options.width || 1;
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy - height * 0.5);
      this.ctx.lineTo(cx + width * 0.5, cy);
      this.ctx.lineTo(cx, cy + height * 0.5);
      this.ctx.lineTo(cx - width * 0.5, cy);
      if (typeof this.ctx.closePath === 'function') this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }

    getFallbackTerrainFill(terrain = 'plains') {
      const fills = {
        capital: 'rgba(98, 124, 76, 0.94)',
        plains: 'rgba(90, 122, 70, 0.9)',
        forest: 'rgba(45, 91, 63, 0.94)',
        hills: 'rgba(126, 114, 75, 0.92)',
        mountain: 'rgba(104, 104, 96, 0.94)',
        waste: 'rgba(112, 96, 78, 0.9)',
        desert: 'rgba(165, 132, 78, 0.9)',
        river: 'rgba(54, 116, 139, 0.92)',
        ocean: 'rgba(35, 87, 120, 0.94)',
      };
      return fills[terrain] || fills.plains;
    }

    hashString(input) {
      let hash = 2166136261;
      const text = String(input);
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    }

    random01(seed, q, r, salt) {
      return this.hashString(`${seed || 'scout-tile-v1'}|${q}|${r}|${salt}`) / 4294967295;
    }

    getWorldOverlayAnchor(tile = {}, viewport = {}, geometry = {}, targetKey = '', explicitOffset = null, centerOverride = null) {
      const manifest = this.constructor.getTileMapAssetManifest();
      const center = centerOverride || this.getWorldTileScreenCenter(tile, viewport, geometry);
      const offset = explicitOffset || manifest.getOverlayOffset?.(targetKey) || { x: 0, y: 0 };
      const scale = Number(viewport.scale) || 1;
      return {
        x: center.x + (Number(offset.x) || 0) * scale,
        y: center.y + (Number(offset.y) || 0) * scale,
      };
    }

    getWorldTileImageAspect(assetPath = '') {
      const metrics = this.analyzeAssetAlphaBounds(assetPath);
      return (metrics?.height || 1) / Math.max(1, metrics?.width || 1);
    }

    drawWorldOverlayShadow(baseX, baseY, drawW, drawH, profile = {}) {
      if (!this.ctx?.beginPath || !this.ctx?.ellipse || !this.ctx?.fill) return;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      const previousFill = this.ctx.fillStyle;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = Number(profile.alpha) || 0.34;
      this.ctx.fillStyle = profile.fill || 'rgba(4, 6, 5, 0.62)';
      this.ctx.beginPath();
      this.ctx.ellipse(
        baseX,
        baseY + drawH * (Number(profile.yRatio) || 0.03),
        drawW * (Number(profile.rx) || 0.36),
        drawH * (Number(profile.ry) || 0.12),
        0,
        0,
        Math.PI * 2,
      );
      this.ctx.fill();
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      this.ctx.fillStyle = previousFill;
    }

    drawWorldOverlayAsset(assetPath = '', metrics, x, y, width, height, alpha = 1) {
      const image = this.getAsset(assetPath);
      if (!image || !metrics || typeof this.ctx.drawImage !== 'function') return false;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(image, metrics.x, metrics.y, metrics.width, metrics.height, x, y, width, height);
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    drawWorldTerrainFeature(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96) {
      const manifest = this.constructor.getTileMapAssetManifest();
      const terrainAsset = manifest.getTerrainAsset?.(tile.terrain) || manifest.terrain?.[tile.terrain] || null;
      const assetPath = terrainAsset?.sourceTerrainPath || terrainAsset?.path || '';
      if (!assetPath || tile.feature?.asset || ['plains', 'capital', 'river', 'desert', 'ocean'].includes(tile.terrain)) return false;
      const profileByTerrain = {
        hills: { chance: 0.42, scale: 0.5, alpha: 0.66, lift: 0.08, squash: 0.68 },
        waste: { chance: 0.32, scale: 0.48, alpha: 0.58, lift: 0.06, squash: 0.7 },
      };
      const profile = profileByTerrain[tile.terrain];
      if (!profile) return false;
      const seed = viewport.seed || 'scout-tile-v1';
      const q = Number(tile.q) || 0;
      const r = Number(tile.r) || 0;
      if (this.random01(seed, q, r, 'terrain-feature-visible') > profile.chance) return false;
      const image = this.getAsset(assetPath);
      if (!image || typeof this.ctx.drawImage !== 'function') return false;
      const targetKey = terrainAsset.overlayKey || `terrain:${tile.terrain}`;
      const anchor = this.getWorldOverlayAnchor(tile, viewport, geometry, targetKey, null);
      const scale = Number(viewport.scale) || 1;
      const size = Math.max(tileWidth, tileHeight);
      const jitterX = (this.random01(seed, q, r, 'terrain-feature-x') - 0.5) * (Number(geometry.stepX) || 96) * scale * 0.34;
      const jitterY = (this.random01(seed, q, r, 'terrain-feature-y') - 0.5) * (Number(geometry.stepY) || 48) * scale * 0.46;
      const drawW = size * profile.scale;
      const drawH = drawW * profile.squash;
      const drawX = anchor.x - drawW * 0.5 + jitterX;
      const drawY = anchor.y - size * profile.lift - drawH * 0.5 + jitterY;
      const sourceWidth = Number(image.naturalWidth || image.width || 1);
      const sourceHeight = Number(image.naturalHeight || image.height || 1);
      const sourceSize = Math.min(sourceWidth, sourceHeight);
      const sourceW = Math.floor(sourceSize * 0.36);
      const sourceH = Math.floor(sourceSize * 0.26);
      const sourceX = Math.floor(sourceWidth * 0.5 - sourceW * 0.5);
      const sourceY = Math.floor(sourceHeight * 0.52 - sourceH * 0.5);
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = profile.alpha;
      this.ctx.save?.();
      this.ctx.beginPath?.();
      this.ctx.ellipse?.(
        anchor.x + jitterX,
        anchor.y - size * profile.lift + jitterY,
        drawW * 0.48,
        drawH * 0.48,
        (this.random01(seed, q, r, 'terrain-feature-rot') - 0.5) * 0.36,
        0,
        Math.PI * 2,
      );
      this.ctx.clip?.();
      this.ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, drawX, drawY, drawW, drawH);
      this.ctx.restore?.();
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    drawWorldTileFeature(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96) {
      const feature = tile.feature || {};
      if (!feature.asset) return false;
      const scale = Number(viewport.scale) || 1;
      const seed = viewport.seed || 'scout-tile-v1';
      const metrics = this.analyzeAssetAlphaBounds(feature.asset);
      if (!metrics) return false;
      const targetKey = feature.overlayKey || `feature:${feature.key || ''}`;
      const anchor = this.getWorldOverlayAnchor(tile, viewport, geometry, targetKey, feature.offset);
      const q = Number(tile.q) || 0;
      const r = Number(tile.r) || 0;
      if (feature.key === 'treeCluster') {
        if (this.random01(seed, q, r, 'tree-feature-visible') > 0.82) return false;
        const count = this.random01(seed, q, r, 'tree-feature-count') > 0.68 ? 2 : 1;
        for (let index = 0; index < count; index += 1) {
          const jitterX = (this.random01(seed, q, r, `tree-feature-x-${index}`) - 0.5) * (Number(geometry.stepX) || 96) * scale * 0.62;
          const jitterY = (this.random01(seed, q, r, `tree-feature-y-${index}`) - 0.5) * (Number(geometry.stepY) || 48) * scale * 0.42;
          const treeScale = (0.38 + this.random01(seed, q, r, `tree-feature-scale-${index}`) * 0.13) * (count > 1 ? 0.82 : 1);
          const drawW = tileWidth * treeScale;
          const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
          const baseX = anchor.x + jitterX;
          const baseY = anchor.y + tileHeight * 0.1 + jitterY;
          this.drawWorldOverlayShadow(baseX, baseY, drawW, drawH, {
            alpha: 0.3,
            fill: 'rgba(3, 7, 4, 0.58)',
            rx: 0.34,
            ry: 0.09,
          });
          this.drawWorldOverlayAsset(feature.asset, metrics, baseX - drawW * 0.5, baseY - drawH * 0.9, drawW, drawH, 1);
        }
        return true;
      }
      if (feature.key === 'mountainRidge') {
        const neighbors = Number(tile.mountainNeighbors) || 0;
        const visibleChance = neighbors >= 2 ? 0.98 : 0.78;
        if (this.random01(seed, q, r, 'mountain-feature-visible') > visibleChance) return false;
        const jitterX = (this.random01(seed, q, r, 'mountain-feature-x') - 0.5) * (Number(geometry.stepX) || 96) * scale * 0.28;
        const jitterY = (this.random01(seed, q, r, 'mountain-feature-y') - 0.5) * (Number(geometry.stepY) || 48) * scale * 0.2;
        const mountainScale = (neighbors >= 2 ? 1.02 : 0.86) + this.random01(seed, q, r, 'mountain-feature-scale') * 0.12;
        const drawW = tileWidth * mountainScale;
        const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
        const baseX = anchor.x + jitterX;
        const baseY = anchor.y + tileHeight * 0.18 + jitterY;
        this.drawWorldOverlayShadow(baseX, baseY, drawW, drawH, {
          alpha: 0.34,
          fill: 'rgba(5, 5, 4, 0.62)',
          rx: 0.42,
          ry: 0.1,
          yRatio: 0.02,
        });
        return this.drawWorldOverlayAsset(feature.asset, metrics, baseX - drawW * 0.5, baseY - drawH * 0.82, drawW, drawH, 1);
      }
      const drawW = tileWidth * (Number(feature.scale) || 0.5);
      const drawH = drawW * this.getWorldTileImageAspect(feature.asset);
      return this.drawWorldOverlayAsset(feature.asset, metrics, anchor.x - drawW * 0.5, anchor.y - drawH * 0.5, drawW, drawH, 0.92);
    }

    getWorldTileSiteLayout(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96, center = null) {
      const site = tile.site || null;
      if (!site?.art) return null;
      const metrics = this.analyzeAssetAlphaBounds(site.art);
      if (!metrics) return null;
      const targetKey = site.overlayKey || this.constructor.getTileMapAssetManifest().getSiteOverlayKey?.(site.type) || `site:${site.type || 'town'}`;
      const anchor = this.getWorldOverlayAnchor(tile, viewport, geometry, targetKey, site.offset, center);
      const drawW = tileWidth * (Number(site.scale) || 0.46);
      const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
      const baseX = anchor.x;
      const baseY = anchor.y - tileHeight * 0.16;
      const drawX = baseX - drawW * 0.5;
      const drawY = baseY - drawH * 0.86;
      return {
        site,
        metrics,
        baseX,
        baseY,
        drawX,
        drawY,
        drawW,
        drawH,
        hitRect: { x: drawX - 8, y: drawY - 8, width: drawW + 16, height: drawH + 26 },
      };
    }

    drawWorldTileSite(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96, uiState = {}, options = {}) {
      const layout = this.getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, options.center);
      if (!layout) return false;
      const {
        site,
        metrics,
        baseX,
        baseY,
        drawX,
        drawY,
        drawW,
        drawH,
      } = layout;
      const selected = uiState.selectedSiteId === site.id;
      if (selected) {
        this.drawIsoDiamond(baseX, baseY, drawW * 1.16, Math.max(18, drawH * 0.32), {
          fill: 'rgba(116, 211, 160, 0.16)',
          stroke: 'rgba(116, 211, 160, 0.72)',
          width: 2,
        });
      }
      this.drawWorldOverlayShadow(baseX, baseY, drawW, drawH, {
        alpha: 0.34,
        fill: 'rgba(4, 6, 5, 0.62)',
        rx: 0.36,
        ry: 0.12,
      });
      const drawn = this.drawWorldOverlayAsset(site.art, metrics, drawX, drawY, drawW, drawH, 1);
      if (!drawn) {
        this.drawText(site.owner === 'player' ? 'P' : 'N', baseX, baseY - drawH * 0.42, {
          size: 15,
          color: site.owner === 'player' ? '#74d3a0' : '#f0b45b',
          align: 'center',
          baseline: 'middle',
        });
      }
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = 0.82;
      this.ctx.fillStyle = site.owner === 'player'
        ? '#7fdca0'
        : site.owner === 'neutral'
          ? '#e8edf1'
          : '#f0c45f';
      this.ctx.beginPath?.();
      this.ctx.arc?.(drawX + drawW * 0.78, drawY + drawH * 0.78, Math.max(3, drawW * 0.035), 0, Math.PI * 2);
      this.ctx.fill?.();
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      this.drawText(this.truncateText(site.name || site.title || 'Site', 74, { size: 9 }), baseX, drawY + drawH + 11, {
        size: 9,
        color: '#f6e8c8',
        align: 'center',
      });
      if (options.addHitTarget !== false) {
        this.addHitTarget(layout.hitRect, {
          type: 'openWorldSite',
          siteId: site.id,
          tileId: tile.id,
        });
      }
      return true;
    }

    getWorldTileRenderEntries(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
      const scale = Number(viewport.scale) || 1;
      const cacheKey = [
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        tiles.length,
        Math.round((Number(viewport.originX) || 0) * 10) / 10,
        Math.round((Number(viewport.originY) || 0) * 10) / 10,
        Math.round((Number(viewport.panX) || 0) * 10) / 10,
        Math.round((Number(viewport.panY) || 0) * 10) / 10,
        Math.round(scale * 1000),
        Math.round((Number(frame.x) || 0) * 10) / 10,
        Math.round((Number(frame.y) || 0) * 10) / 10,
        Math.round((Number(frame.width) || 0) * 10) / 10,
        Math.round((Number(frame.height) || 0) * 10) / 10,
      ].join('::');
      if (this.worldTileVisibleEntriesCache?.key === cacheKey) return this.worldTileVisibleEntriesCache.entries;
      const drawProbe = this.getWorldTileDrawRect({ x: 0, y: 0 }, scale, geometry);
      const tileDrawWidth = drawProbe.width;
      const tileDrawHeight = drawProbe.height;
      const offsetX = (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0);
      const offsetY = (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0);
      const localEntries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
      const entries = localEntries.map((entry) => {
        const center = {
          x: entry.center.x + offsetX,
          y: entry.center.y + offsetY,
        };
        const drawRect = {
          x: entry.drawRect.x + offsetX,
          y: entry.drawRect.y + offsetY,
          width: entry.drawRect.width,
          height: entry.drawRect.height,
        };
        const inView = drawRect.x < frame.x + frame.width + tileDrawWidth
          && drawRect.x + drawRect.width > frame.x - tileDrawWidth
          && drawRect.y < frame.y + frame.height + tileDrawHeight
          && drawRect.y + drawRect.height > frame.y - tileDrawHeight;
        return { tile: entry.tile, center, drawRect, inView };
      }).filter((entry) => entry.inView);
      this.worldTileVisibleEntriesCache = { key: cacheKey, entries };
      return entries;
    }

    getWorldTileLocalEntries(tileMapView = {}, viewport = {}, geometry = {}) {
      const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
      const scale = Number(viewport.scale) || 1;
      const cacheKey = [
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        tiles.length,
        Math.round(scale * 1000),
        Number(geometry.tileWidth) || 192,
        Number(geometry.tileHeight) || 96,
        Number(geometry.stepX) || 96,
        Number(geometry.stepY) || 48,
        Number.isFinite(Number(geometry.anchorY)) ? Number(geometry.anchorY) : 0.5,
      ].join('::');
      if (this.worldTileLocalEntriesCache?.key === cacheKey) return this.worldTileLocalEntriesCache.entries;
      const localViewport = {
        ...viewport,
        originX: 0,
        originY: 0,
        panX: 0,
        panY: 0,
      };
      const entries = tiles.map((tile) => {
        const center = this.getWorldTileScreenCenter(tile, localViewport, geometry);
        const drawRect = this.getWorldTileDrawRect(center, scale, geometry);
        return { tile, center, drawRect, inView: true };
      });
      this.worldTileLocalEntriesCache = { key: cacheKey, entries };
      return entries;
    }

    getWorldTileKey(tile = {}) {
      return `${Number(tile.q) || 0},${Number(tile.r) || 0}`;
    }

    getWorldTileRenderedDiamondCenter(tile = {}, drawRect = {}) {
      const baseTemplate = this.getWorldTileTemplateBaseAsset(tile);
      const assetPath = baseTemplate?.asset || tile.terrainAsset || '';
      const metrics = this.getWorldTileTemplateMetrics(baseTemplate || { asset: assetPath });
      const rectX = Number(drawRect.x) || 0;
      const rectY = Number(drawRect.y) || 0;
      const rectW = Number(drawRect.width) || 0;
      const rectH = Number(drawRect.height) || 0;
      if (metrics && rectW > 0 && rectH > 0) {
        // Tile-map assets are alpha-clipped before being stretched into drawRect.
        return {
          x: rectX + rectW * 0.5,
          y: rectY + rectH * 0.5,
        };
      }
      return {
        x: rectX + rectW * 0.5,
        y: rectY + rectH * 0.5,
      };
    }

    getWorldTileFogRevealEntries(entries = []) {
      if (!Array.isArray(entries) || entries.length <= 1) return entries || [];
      const keySet = new Set(entries.map(({ tile }) => this.getWorldTileKey(tile)));
      const offsets = [
        { q: -1, r: -1 }, { q: 0, r: -1 }, { q: 1, r: -1 },
        { q: -1, r: 0 }, { q: 1, r: 0 },
        { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
      ];
      const innerEntries = entries.filter(({ tile }) => {
        const q = Number(tile?.q) || 0;
        const r = Number(tile?.r) || 0;
        return offsets.every((offset) => keySet.has(`${q + offset.q},${r + offset.r}`));
      });
      return innerEntries.length ? innerEntries : entries;
    }

    getWorldTileStaticCacheLayout(tileMapView = {}, viewport = {}, geometry = {}) {
      const entries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
      if (!entries.length) return null;
      const frameEntries = entries;
      const padding = this.getWorldTileAtlasFramePadding(geometry, viewport);
      const minX = Math.min(...frameEntries.map((entry) => entry.drawRect.x)) - padding;
      const minY = Math.min(...frameEntries.map((entry) => entry.drawRect.y)) - padding;
      const maxX = Math.max(...frameEntries.map((entry) => entry.drawRect.x + entry.drawRect.width)) + padding;
      const maxY = Math.max(...frameEntries.map((entry) => entry.drawRect.y + entry.drawRect.height)) + padding;
      const frame = {
        x: Math.floor(minX),
        y: Math.floor(minY),
        width: Math.max(1, Math.ceil(maxX - minX)),
        height: Math.max(1, Math.ceil(maxY - minY)),
      };
      const localViewport = {
        ...viewport,
        originX: 0,
        originY: 0,
        panX: 0,
        panY: 0,
      };
      return {
        kind: 'world',
        frame,
        entries,
        renderViewport: localViewport,
        drawX: viewport.originX + (Number(viewport.panX) || 0) + frame.x,
        drawY: viewport.originY + (Number(viewport.panY) || 0) + frame.y,
      };
    }

    getWorldTileStaticViewportCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!entries.length) return null;
      const padding = 2;
      const localFrame = {
        x: Math.floor((Number(frame.x) || 0) - padding),
        y: Math.floor((Number(frame.y) || 0) - padding),
        width: Math.max(1, Math.ceil((Number(frame.width) || 1) + padding * 2)),
        height: Math.max(1, Math.ceil((Number(frame.height) || 1) + padding * 2)),
      };
      return {
        kind: 'viewport',
        frame: localFrame,
        entries,
        renderViewport: viewport,
        drawX: localFrame.x,
        drawY: localFrame.y,
      };
    }

    getWorldTileStaticChunkSize() {
      return 1024;
    }

    getWorldTileStaticChunkCacheLimit() {
      return 32;
    }

    getWorldTileStaticChunkCacheScale() {
      return 1;
    }

    getWorldTileAtlasFramePadding(geometry = {}, viewport = {}) {
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      return Math.max(tileWidth * 1.2, tileHeight * 2.2, 96);
    }

    getWorldTileStaticChunkLayouts(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      const localEntries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
      if (!localEntries.length) return [];
      const cacheScale = this.getWorldTileStaticChunkCacheScale();
      const pixelBudget = this.getWorldTileStaticCachePixelBudget();
      const atlasLayout = this.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry);
      if (!atlasLayout?.frame) return [];
      const padding = this.getWorldTileAtlasFramePadding(geometry, viewport);
      const chunkBleed = Math.max(padding, 128);
      const originX = Number(viewport.originX) || 0;
      const originY = Number(viewport.originY) || 0;
      const panX = Number(viewport.panX) || 0;
      const panY = Number(viewport.panY) || 0;
      const maxBudgetChunkSize = Math.floor(Math.sqrt(Math.max(1, pixelBudget)) / Math.max(1, cacheScale));
      const chunkSize = Math.max(256, Math.min(
        Number(this.getWorldTileStaticChunkSize()) || 1024,
        maxBudgetChunkSize || 1024,
      ));
      const localFrame = atlasLayout.frame;
      const minChunkX = Math.floor(localFrame.x / chunkSize);
      const maxChunkX = Math.floor((localFrame.x + localFrame.width - 1) / chunkSize);
      const minChunkY = Math.floor(localFrame.y / chunkSize);
      const maxChunkY = Math.floor((localFrame.y + localFrame.height - 1) / chunkSize);
      const localViewport = {
        ...viewport,
        originX: 0,
        originY: 0,
        panX: 0,
        panY: 0,
      };
      const layouts = [];
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
        for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
          const chunkFrame = {
            x: chunkX * chunkSize,
            y: chunkY * chunkSize,
            width: chunkSize,
            height: chunkSize,
          };
          const expandedChunkFrame = {
            x: chunkFrame.x - chunkBleed,
            y: chunkFrame.y - chunkBleed,
            width: chunkFrame.width + chunkBleed * 2,
            height: chunkFrame.height + chunkBleed * 2,
          };
          const chunkEntries = localEntries.filter((entry) => (
            entry.drawRect.x < expandedChunkFrame.x + expandedChunkFrame.width
            && entry.drawRect.x + entry.drawRect.width > expandedChunkFrame.x
            && entry.drawRect.y < expandedChunkFrame.y + expandedChunkFrame.height
            && entry.drawRect.y + entry.drawRect.height > expandedChunkFrame.y
          ));
          if (!chunkEntries.length) continue;
          layouts.push({
            kind: 'chunk',
            chunkX,
            chunkY,
            frame: chunkFrame,
            entries: chunkEntries,
            renderViewport: localViewport,
            drawX: originX + panX + chunkFrame.x,
            drawY: originY + panY + chunkFrame.y,
          });
        }
      }
      return layouts;
    }

    getWorldTileDragCachePanRange() {
      return 180;
    }

    getWorldTileStaticDragCacheLayout(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      const localEntries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
      if (!localEntries.length) return null;
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const padding = Math.max(tileWidth * 1.2, tileHeight * 2.2, 96);
      const panRange = Math.max(0, Number(this.getWorldTileDragCachePanRange()) || 0);
      const originX = Number(viewport.originX) || 0;
      const originY = Number(viewport.originY) || 0;
      const localFrame = {
        x: Math.floor((Number(frame.x) || 0) - originX - panRange - padding),
        y: Math.floor((Number(frame.y) || 0) - originY - panRange - padding),
        width: Math.max(1, Math.ceil((Number(frame.width) || 1) + (panRange + padding) * 2)),
        height: Math.max(1, Math.ceil((Number(frame.height) || 1) + (panRange + padding) * 2)),
      };
      const entries = localEntries.filter((entry) => (
        entry.drawRect.x < localFrame.x + localFrame.width
        && entry.drawRect.x + entry.drawRect.width > localFrame.x
        && entry.drawRect.y < localFrame.y + localFrame.height
        && entry.drawRect.y + entry.drawRect.height > localFrame.y
      ));
      if (!entries.length) return null;
      const localViewport = {
        ...viewport,
        originX: 0,
        originY: 0,
        panX: 0,
        panY: 0,
      };
      return {
        kind: 'drag',
        frame: localFrame,
        entries,
        renderViewport: localViewport,
        drawX: viewport.originX + (Number(viewport.panX) || 0) + localFrame.x,
        drawY: viewport.originY + (Number(viewport.panY) || 0) + localFrame.y,
      };
    }

    getWorldTileStaticCacheKey(tileMapView = {}, viewport = {}, frame = {}, entries = [], uiState = {}, options = {}) {
      const scale = Number(viewport.scale) || 1;
      const selectedSiteId = uiState.selectedSiteId || '';
      const entrySignature = entries.map(({ tile, center, drawRect }) => [
        tile.id,
        tile.terrain,
        tile.terrainAsset,
        (tile.templateAssets || []).map((asset) => `${asset.key}:${asset.asset}:${asset.waterKind || ''}`).join(','),
        tile.feature?.asset || '',
        tile.feature?.key || '',
        tile.site?.id || '',
        tile.site?.art || '',
        tile.site?.owner || '',
        tile.site?.name || tile.site?.title || '',
        tile.site?.scale || '',
        tile.site?.offset?.x || 0,
        tile.site?.offset?.y || 0,
        Math.round(center.x * 10) / 10,
        Math.round(center.y * 10) / 10,
        Math.round(drawRect.x * 10) / 10,
        Math.round(drawRect.y * 10) / 10,
      ].join('|')).join(';');
      return [
        options.kind || 'world',
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        selectedSiteId,
        Math.round(frame.x),
        Math.round(frame.y),
        Math.round(frame.width),
        Math.round(frame.height),
        Math.round(scale * 1000),
        Math.round((Number(options.cacheScale) || 1) * 1000),
        entrySignature,
      ].join('::');
    }

    renderWorldTileFogMask(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!this.ctx || typeof this.ctx.drawImage !== 'function') return;
      const knownEntries = this.getWorldTileFogRevealEntries(Array.isArray(entries) ? entries : []);
      const geometry = tileMapView.geometry || viewport.geometry || {};
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const width = Math.max(1, Math.ceil(Number(frame.width) || 1));
      const height = Math.max(1, Math.ceil(Number(frame.height) || 1));
      const cacheScale = Math.max(1, Number(this.pixelRatio) || 1);
      const work = this.getWorldTileLayerCacheContext('worldTileFogMaskCache', width, height, cacheScale);
      if (!work?.canvas || !work?.ctx) return;
      const readNumber = (value, fallback = 0) => {
        const next = Number(value);
        return Number.isFinite(next) ? next : fallback;
      };
      const ctx = work.ctx;
      ctx.setTransform?.(1, 0, 0, 1, 0, 0);
      ctx.clearRect?.(0, 0, work.pixelWidth || work.canvas.width, work.pixelHeight || work.canvas.height);
      ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000000';
      ctx.fillRect?.(0, 0, width, height);
      if (knownEntries.length) {
        const minX = Math.min(...knownEntries.map((entry) => readNumber(entry.drawRect?.x, readNumber(entry.center?.x))));
        const minY = Math.min(...knownEntries.map((entry) => readNumber(entry.drawRect?.y, readNumber(entry.center?.y))));
        const maxX = Math.max(...knownEntries.map((entry) => (
          readNumber(entry.drawRect?.x, readNumber(entry.center?.x))
          + readNumber(entry.drawRect?.width, tileWidth)
        )));
        const maxY = Math.max(...knownEntries.map((entry) => (
          readNumber(entry.drawRect?.y, readNumber(entry.center?.y))
          + readNumber(entry.drawRect?.height, tileHeight)
        )));
        const centerX = (minX + maxX) * 0.5;
        const centerY = (minY + maxY) * 0.5;
        const radiusX = Math.max(tileWidth * 1.05, (maxX - minX) * 0.5 + tileWidth * 0.28);
        const radiusY = Math.max(tileHeight * 1.35, (maxY - minY) * 0.5 + tileHeight * 0.42);
        const radius = Math.max(radiusX, radiusY, 1);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.save?.();
        ctx.translate?.(centerX - (Number(frame.x) || 0), centerY - (Number(frame.y) || 0));
        ctx.scale?.(radiusX / radius, radiusY / radius);
        const gradient = typeof ctx.createRadialGradient === 'function'
          ? ctx.createRadialGradient(0, 0, Math.max(4, radius * 0.42), 0, 0, radius)
          : 'rgba(0, 0, 0, 1)';
        if (gradient?.addColorStop) {
          [
            [0, 'rgba(0, 0, 0, 1)'],
            [0.54, 'rgba(0, 0, 0, 1)'],
            [0.86, 'rgba(0, 0, 0, 0.5)'],
            [1, 'rgba(0, 0, 0, 0)'],
          ].forEach(([offset, color]) => gradient.addColorStop(offset, color));
        }
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc?.(0, 0, radius, 0, Math.PI * 2);
        ctx.fill?.();
        ctx.restore?.();
      }
      ctx.globalCompositeOperation = 'source-over';
      this.ctx.drawImage(
        work.canvas,
        0,
        0,
        work.pixelWidth || work.canvas.width,
        work.pixelHeight || work.canvas.height,
        Number(frame.x) || 0,
        Number(frame.y) || 0,
        width,
        height,
      );
    }

    getWorldTileStaticCacheScale() {
      return Math.max(1, Number(this.pixelRatio) || 1);
    }

    getWorldTileStaticCachePixelBudget() {
      return 16000000;
    }

    getWorldTileLayerCacheContext(cacheName, width, height, cacheScale = 1) {
      const localW = Math.max(1, Math.ceil(width));
      const localH = Math.max(1, Math.ceil(height));
      const scale = Math.max(1, Number(cacheScale) || 1);
      const pixelW = Math.max(1, Math.ceil(localW * scale));
      const pixelH = Math.max(1, Math.ceil(localH * scale));
      const cached = this[cacheName];
      if (cached?.canvas && cached?.ctx) {
        if (cached.canvas.width !== pixelW) cached.canvas.width = pixelW;
        if (cached.canvas.height !== pixelH) cached.canvas.height = pixelH;
        cached.width = localW;
        cached.height = localH;
        cached.pixelWidth = pixelW;
        cached.pixelHeight = pixelH;
        cached.scale = scale;
        return cached;
      }
      const canvas = this.createTileWorkCanvas(pixelW, pixelH);
      const ctx = canvas?.getContext?.('2d') || null;
      if (!canvas || !ctx) return null;
      this[cacheName] = {
        canvas,
        ctx,
        width: localW,
        height: localH,
        pixelWidth: pixelW,
        pixelHeight: pixelH,
        scale,
      };
      return this[cacheName];
    }

    getWorldTileStaticCacheContext(width, height, cacheScale = 1) {
      return this.getWorldTileLayerCacheContext('worldTileStaticCache', width, height, cacheScale);
    }

    getWorldTileScoutRouteCacheContext(width, height, cacheScale = 1) {
      return this.getWorldTileLayerCacheContext('worldTileScoutRouteCache', width, height, cacheScale);
    }

    getWorldTileWaterLayerCacheContext(width, height, cacheScale = 1) {
      return this.getWorldTileLayerCacheContext('worldTileWaterLayerCache', width, height, cacheScale);
    }

    createWorldTileLayerWork(width, height, cacheScale = 1) {
      const localW = Math.max(1, Math.ceil(width));
      const localH = Math.max(1, Math.ceil(height));
      const scale = Math.max(1, Number(cacheScale) || 1);
      const pixelW = Math.max(1, Math.ceil(localW * scale));
      const pixelH = Math.max(1, Math.ceil(localH * scale));
      const canvas = this.createTileWorkCanvas(pixelW, pixelH);
      const ctx = canvas?.getContext?.('2d') || null;
      if (!canvas || !ctx) return null;
      return {
        canvas,
        ctx,
        width: localW,
        height: localH,
        pixelWidth: pixelW,
        pixelHeight: pixelH,
        scale,
      };
    }

    drawWorldTileLayerCache(work, layout = {}, clipFrame = null) {
      if (!work?.canvas || !layout?.frame || typeof this.ctx?.drawImage !== 'function') return false;
      const drawX = Number(layout.drawX) || 0;
      const drawY = Number(layout.drawY) || 0;
      const frameWidth = Math.max(1, Number(layout.frame.width) || 1);
      const frameHeight = Math.max(1, Number(layout.frame.height) || 1);
      const clip = clipFrame || { x: drawX, y: drawY, width: frameWidth, height: frameHeight };
      const clipX = Number(clip.x) || 0;
      const clipY = Number(clip.y) || 0;
      const clipWidth = Math.max(0, Number(clip.width) || 0);
      const clipHeight = Math.max(0, Number(clip.height) || 0);
      const visibleX = Math.max(drawX, clipX);
      const visibleY = Math.max(drawY, clipY);
      const visibleRight = Math.min(drawX + frameWidth, clipX + clipWidth);
      const visibleBottom = Math.min(drawY + frameHeight, clipY + clipHeight);
      const visibleWidth = Math.max(0, visibleRight - visibleX);
      const visibleHeight = Math.max(0, visibleBottom - visibleY);
      if (visibleWidth <= 0 || visibleHeight <= 0) return true;
      const scale = Math.max(1, Number(work.scale) || 1);
      const sourceX = Math.max(0, (visibleX - drawX) * scale);
      const sourceY = Math.max(0, (visibleY - drawY) * scale);
      const sourceWidth = Math.min(
        Math.max(1, visibleWidth * scale),
        Math.max(1, (Number(work.canvas.width) || sourceX + visibleWidth * scale) - sourceX),
      );
      const sourceHeight = Math.min(
        Math.max(1, visibleHeight * scale),
        Math.max(1, (Number(work.canvas.height) || sourceY + visibleHeight * scale) - sourceY),
      );
      this.ctx.drawImage(
        work.canvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        visibleX,
        visibleY,
        sourceWidth / scale,
        sourceHeight / scale,
      );
      return true;
    }

    getWorldTileFastDragCompositeSignature() {
      return [
        this.worldTileStaticCacheKey || '',
        this.worldTileScoutRouteCacheKey || '',
        this.worldTileWaterLayerCacheKey || '',
      ].join('::');
    }

    renderWorldTileFastDragComposite(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!this.worldTileFastDragComposite?.work || !this.worldTileFastDragComposite?.layout) return false;
      if (this.worldTileFastDragComposite.signature !== this.getWorldTileFastDragCompositeSignature()) return false;
      const layout = this.resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries);
      if (!layout || layout.kind === 'chunks') return false;
      const cachedLayout = this.worldTileFastDragComposite.layout;
      const drawLayout = {
        ...cachedLayout,
        drawX: layout.drawX,
        drawY: layout.drawY,
      };
      return this.drawWorldTileLayerCache(this.worldTileFastDragComposite.work, drawLayout, frame);
    }

    updateWorldTileFastDragComposite(layout = null, frame = null) {
      if (!layout?.frame || !this.worldTileStaticCache?.canvas) return false;
      const signature = this.getWorldTileFastDragCompositeSignature();
      if (!signature.trim()) return false;
      const width = Math.max(1, Number(layout.frame.width) || 1);
      const height = Math.max(1, Number(layout.frame.height) || 1);
      const cacheScale = this.getWorldTileStaticCacheScale();
      const work = this.getWorldTileLayerCacheContext('worldTileFastDragCompositeCache', width, height, cacheScale);
      if (!work) return false;
      const previousCtx = this.ctx;
      this.ctx = work.ctx;
      try {
        work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
        work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
        work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
        work.ctx.globalAlpha = 1;
        work.ctx.globalCompositeOperation = 'source-over';
        const localFrame = {
          x: 0,
          y: 0,
          width,
          height,
        };
        const localLayout = {
          ...layout,
          drawX: 0,
          drawY: 0,
        };
        this.drawWorldTileLayerCache(this.worldTileScoutRouteCache, localLayout, localFrame);
        this.drawWorldTileLayerCache(this.worldTileWaterLayerCache, localLayout, localFrame);
        this.drawWorldTileLayerCache(this.worldTileStaticCache, localLayout, localFrame);
        this.worldTileFastDragComposite = {
          signature,
          layout: { ...layout },
          work,
        };
        return true;
      } finally {
        this.ctx = previousCtx;
      }
    }

    resolveWorldTileStaticCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      const geometry = tileMapView.geometry || {};
      const cacheScale = this.getWorldTileStaticCacheScale();
      const pixelBudget = this.getWorldTileStaticCachePixelBudget();
      const worldLayout = this.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry);
      if (!worldLayout) return null;
      const worldPixels = worldLayout.frame.width * worldLayout.frame.height * cacheScale * cacheScale;
      if (worldPixels <= pixelBudget) return worldLayout;
      const chunkLayouts = this.getWorldTileStaticChunkLayouts(tileMapView, viewport, frame, geometry);
      if (chunkLayouts.length) return { kind: 'chunks', layouts: chunkLayouts };
      if (this.worldTileFastDragActive) return null;
      const viewportLayout = this.getWorldTileStaticViewportCacheLayout(tileMapView, viewport, frame, entries);
      if (!viewportLayout) return null;
      const viewportPixels = viewportLayout.frame.width * viewportLayout.frame.height * cacheScale * cacheScale;
      return viewportPixels <= pixelBudget ? viewportLayout : null;
    }

    getWorldTileStaticChunkCacheKey(tileMapView = {}, viewport = {}, layout = {}, uiState = {}, options = {}) {
      return this.getWorldTileStaticCacheKey(tileMapView, viewport, layout.frame, layout.entries, uiState, {
        ...options,
        kind: `chunk:${layout.chunkX},${layout.chunkY}`,
      });
    }

    pruneWorldTileStaticChunkCaches(activeKeys = new Set()) {
      const limit = Math.max(1, Number(this.getWorldTileStaticChunkCacheLimit()) || 32);
      if (!this.worldTileStaticChunkCaches || this.worldTileStaticChunkCaches.size <= limit) return false;
      const staleEntries = Array.from(this.worldTileStaticChunkCaches.entries())
        .filter(([key]) => !activeKeys.has(key))
        .sort((a, b) => (Number(a[1]?.lastUsedAt) || 0) - (Number(b[1]?.lastUsedAt) || 0));
      let pruned = false;
      while (this.worldTileStaticChunkCaches.size > limit && staleEntries.length) {
        const [key] = staleEntries.shift();
        this.worldTileStaticChunkCaches.delete(key);
        pruned = true;
      }
      return pruned;
    }

    renderWorldTileStaticChunk(tileMapView = {}, layout = {}, uiState = {}, cacheScale = 1) {
      const hasEntries = Array.isArray(layout.entries) && layout.entries.length > 0;
      if (!layout?.frame || !hasEntries) return false;
      const chunkKey = `${layout.chunkX},${layout.chunkY}`;
      let work = this.worldTileStaticChunkCaches.get(chunkKey);
      const width = Math.max(1, Number(layout.frame.width) || 1);
      const height = Math.max(1, Number(layout.frame.height) || 1);
      const pixelW = Math.max(1, Math.ceil(width * cacheScale));
      const pixelH = Math.max(1, Math.ceil(height * cacheScale));
      if (!work?.canvas || !work?.ctx) {
        const canvas = this.createTileWorkCanvas(pixelW, pixelH);
        const ctx = canvas?.getContext?.('2d') || null;
        if (!canvas || !ctx) return false;
        work = { canvas, ctx };
        this.worldTileStaticChunkCaches.set(chunkKey, work);
      }
      if (work.canvas.width !== pixelW) work.canvas.width = pixelW;
      if (work.canvas.height !== pixelH) work.canvas.height = pixelH;
      work.width = width;
      work.height = height;
      work.pixelWidth = pixelW;
      work.pixelHeight = pixelH;
      work.scale = cacheScale;
      work.chunkX = layout.chunkX;
      work.chunkY = layout.chunkY;
      work.frame = { ...layout.frame };
      const cacheKey = this.getWorldTileStaticChunkCacheKey(tileMapView, layout.renderViewport, layout, uiState, { cacheScale });
      if (cacheKey !== work.key) {
        const previousCtx = this.ctx;
        this.ctx = work.ctx;
        try {
          work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
          work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
          work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
          work.ctx.globalAlpha = 1;
          work.ctx.globalCompositeOperation = 'source-over';
          work.ctx.save?.();
          work.ctx.translate?.(-layout.frame.x, -layout.frame.y);
          this.withSuppressedHitTargets(() => {
            this.renderWorldTileStaticEntries(tileMapView, layout.renderViewport, layout.frame, layout.entries, uiState, {
              addHitTargets: false,
            });
          });
          work.ctx.restore?.();
          work.key = cacheKey;
        } finally {
          this.ctx = previousCtx;
        }
      }
      work.lastUsedAt = ++this.worldTileStaticChunkCacheTick;
      return true;
    }

    renderWorldTileStaticChunks(tileMapView = {}, chunkLayouts = [], frame = {}, uiState = {}) {
      const cacheScale = this.getWorldTileStaticChunkCacheScale();
      const activeKeys = new Set(chunkLayouts.map((layout) => `${layout.chunkX},${layout.chunkY}`));
      this.worldTileStaticCacheLayoutKind = 'chunks';
      let rendered = false;
      chunkLayouts.forEach((layout) => {
        if (this.renderWorldTileStaticChunk(tileMapView, layout, uiState, cacheScale)) {
          this.drawWorldTileLayerCache(this.worldTileStaticChunkCaches.get(`${layout.chunkX},${layout.chunkY}`), layout, frame);
          rendered = true;
        }
      });
      this.pruneWorldTileStaticChunkCaches(activeKeys);
      return rendered;
    }

    getWorldTileWaterChunkCacheKey(tileMapView = {}, viewport = {}, layout = {}, waterEntries = [], options = {}) {
      return this.getWorldTileWaterLayerCacheKey(tileMapView, viewport, layout.frame, waterEntries, {
        ...options,
        kind: `water-chunk:${layout.chunkX},${layout.chunkY}`,
      });
    }

    pruneWorldTileWaterChunkCaches(activeKeys = new Set()) {
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      const limit = Math.max(1, Number(this.getWorldTileStaticChunkCacheLimit()) || 32) * frameCount;
      if (!this.worldTileWaterChunkCaches || this.worldTileWaterChunkCaches.size <= limit) return false;
      const staleEntries = Array.from(this.worldTileWaterChunkCaches.entries())
        .filter(([key]) => !activeKeys.has(key))
        .sort((a, b) => (Number(a[1]?.lastUsedAt) || 0) - (Number(b[1]?.lastUsedAt) || 0));
      let pruned = false;
      while (this.worldTileWaterChunkCaches.size > limit && staleEntries.length) {
        const [key] = staleEntries.shift();
        this.worldTileWaterChunkCaches.delete(key);
        pruned = true;
      }
      return pruned;
    }

    getWorldTileWaterChunkFrameCacheId(layout = {}, frameIndex = 0) {
      return `${layout.chunkX},${layout.chunkY}:${frameIndex}`;
    }

    renderWorldTileWaterChunk(tileMapView = {}, layout = {}, cacheScale = 1, frameIndex = this.getWorldTileWaterAnimationFrameIndex()) {
      if (!layout?.frame || !Array.isArray(layout.entries) || !layout.entries.length) return false;
      const waterEntries = layout.entries.filter(({ tile }) => tile.water?.kind && tile.water?.asset);
      if (!waterEntries.length) return false;
      const cacheId = this.getWorldTileWaterChunkFrameCacheId(layout, frameIndex);
      const work = this.renderWorldTileWaterFrameCache(
        tileMapView,
        layout,
        waterEntries,
        cacheScale,
        frameIndex,
        this.worldTileWaterChunkCaches,
        cacheId,
        `water-chunk:${layout.chunkX},${layout.chunkY}`,
      );
      if (!work) return false;
      work.chunkX = layout.chunkX;
      work.chunkY = layout.chunkY;
      work.lastUsedAt = ++this.worldTileWaterChunkCacheTick;
      return true;
    }

    renderWorldTileWaterChunkFrames(tileMapView = {}, layout = {}, cacheScale = 1) {
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      let rendered = false;
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        if (this.renderWorldTileWaterChunk(tileMapView, layout, cacheScale, frameIndex)) rendered = true;
      }
      return rendered;
    }

    renderWorldTileWaterChunks(tileMapView = {}, chunkLayouts = [], frame = {}) {
      const cacheScale = this.getWorldTileStaticChunkCacheScale();
      const activeKeys = new Set();
      const frameIndex = this.getWorldTileWaterAnimationFrameIndex();
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      let rendered = false;
      chunkLayouts.forEach((layout) => {
        const waterEntries = (layout.entries || []).filter(({ tile }) => tile.water?.kind && tile.water?.asset);
        if (!waterEntries.length) return;
        for (let index = 0; index < frameCount; index += 1) {
          activeKeys.add(this.getWorldTileWaterChunkFrameCacheId(layout, index));
        }
        if (!this.worldTileFastDragActive) this.renderWorldTileWaterChunkFrames(tileMapView, layout, cacheScale);
        const cacheId = this.getWorldTileWaterChunkFrameCacheId(layout, frameIndex);
        const work = this.worldTileWaterChunkCaches.get(cacheId);
        if (work?.canvas) {
          this.drawWorldTileLayerCache(work, layout, frame);
          rendered = true;
        }
      });
      this.pruneWorldTileWaterChunkCaches(activeKeys);
      return rendered;
    }

    renderWorldTileSnapshotChunkCacheMap(cacheMap = null, viewport = {}, frame = {}) {
      if (!cacheMap?.size) return false;
      let rendered = false;
      cacheMap.forEach((work) => {
        const chunkFrame = work?.frame;
        if (!work?.canvas || !chunkFrame) return;
        const layout = {
          kind: 'chunk',
          frame: chunkFrame,
          drawX: (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0) + (Number(chunkFrame.x) || 0),
          drawY: (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0) + (Number(chunkFrame.y) || 0),
        };
        const drawRight = layout.drawX + (Number(chunkFrame.width) || 0);
        const drawBottom = layout.drawY + (Number(chunkFrame.height) || 0);
        if (
          layout.drawX > frame.x + frame.width
          || drawRight < frame.x
          || layout.drawY > frame.y + frame.height
          || drawBottom < frame.y
        ) return;
        if (this.drawWorldTileLayerCache(work, layout, frame)) rendered = true;
      });
      return rendered;
    }

    getWorldTileSnapshotDrawLayout(cachedLayout = {}, viewport = {}) {
      if (!cachedLayout?.frame) return null;
      return {
        ...cachedLayout,
        drawX: (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0) + (Number(cachedLayout.frame.x) || 0),
        drawY: (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0) + (Number(cachedLayout.frame.y) || 0),
      };
    }

    renderWorldTileSnapshotLayerCache(work = null, cachedLayout = null, viewport = {}, frame = {}) {
      if (!work?.canvas || !cachedLayout?.frame) return false;
      const drawLayout = this.getWorldTileSnapshotDrawLayout(cachedLayout, viewport);
      return drawLayout ? this.drawWorldTileLayerCache(work, drawLayout, frame) : false;
    }

    renderWorldTileSnapshotCache(tileMapView = {}, viewport = {}, frame = {}) {
      if (!this.ctx || typeof this.ctx.drawImage !== 'function') return false;
      let rendered = false;
      const renderFogMask = () => {
        const entries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, tileMapView.geometry || viewport.geometry || {});
        this.renderWorldTileFogMask(tileMapView, viewport, frame, entries);
      };
      if (this.worldTileStaticCache?.canvas && this.worldTileStaticCacheLayout?.frame) {
        const waterWork = this.getWorldTileWaterFrameCache();
        if (waterWork?.canvas) {
          rendered = this.renderWorldTileSnapshotLayerCache(
            waterWork,
            this.worldTileStaticCacheLayout,
            viewport,
            frame,
          ) || rendered;
        }
        rendered = this.renderWorldTileSnapshotLayerCache(
          this.worldTileStaticCache,
          this.worldTileStaticCacheLayout,
          viewport,
          frame,
        ) || rendered;
        if (this.worldTileScoutRouteCache?.canvas && this.worldTileScoutRouteCacheLayout?.frame) {
          rendered = this.renderWorldTileSnapshotLayerCache(
            this.worldTileScoutRouteCache,
            this.worldTileScoutRouteCacheLayout,
            viewport,
            frame,
          ) || rendered;
        }
        if (rendered) renderFogMask();
        return rendered;
      }
      if (this.worldTileStaticCacheLayoutKind !== 'chunks' || !this.worldTileStaticChunkCaches?.size) return false;
      const frameIndex = this.getWorldTileWaterAnimationFrameIndex();
      const renderedWater = this.renderWorldTileSnapshotChunkCacheMap(
        new Map(Array.from(this.worldTileWaterChunkCaches || [])
          .filter(([key]) => String(key).endsWith(`:${frameIndex}`))),
        viewport,
        frame,
      );
      const renderedStatic = this.renderWorldTileSnapshotChunkCacheMap(this.worldTileStaticChunkCaches, viewport, frame);
      rendered = renderedWater || renderedStatic;
      if (rendered) renderFogMask();
      return rendered;
    }

    renderWorldTileStaticLayer(tileMapView = {}, viewport = {}, frame = {}, entries = [], uiState = {}) {
      const layout = this.resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries);
      if (!layout) return false;
      if (layout.kind === 'chunks') return this.renderWorldTileStaticChunks(tileMapView, layout.layouts, frame, uiState);
      if (this.worldTileFastDragActive && this.worldTileStaticCacheKey && this.worldTileStaticCache?.canvas) {
        return this.drawWorldTileLayerCache(this.worldTileStaticCache, layout, frame);
      }
      const cacheScale = this.getWorldTileStaticCacheScale();
      const work = this.getWorldTileStaticCacheContext(layout.frame.width, layout.frame.height, cacheScale);
      if (!work) return false;
      const cacheKey = this.getWorldTileStaticCacheKey(tileMapView, layout.renderViewport, layout.frame, layout.entries, uiState, {
        kind: layout.kind,
        cacheScale,
      });
      if (cacheKey !== this.worldTileStaticCacheKey) {
        const previousCtx = this.ctx;
        this.ctx = work.ctx;
        try {
          work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
          work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
          work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
          work.ctx.globalAlpha = 1;
          work.ctx.globalCompositeOperation = 'source-over';
          work.ctx.save?.();
          work.ctx.translate?.(-layout.frame.x, -layout.frame.y);
          this.withSuppressedHitTargets(() => {
            this.renderWorldTileStaticEntries(tileMapView, layout.renderViewport, layout.frame, layout.entries, uiState, {
              addHitTargets: false,
            });
          });
          work.ctx.restore?.();
          this.worldTileStaticCacheKey = cacheKey;
          this.worldTileStaticCacheLayoutKind = layout.kind || '';
          this.worldTileStaticCacheLayout = { ...layout, frame: { ...layout.frame } };
        } finally {
          this.ctx = previousCtx;
        }
      }
      return this.drawWorldTileLayerCache(work, layout, frame);
    }

    getWorldTileScoutRouteCacheKey(tileMapView = {}, viewport = {}, frame = {}, options = {}) {
      const scale = Number(viewport.scale) || 1;
      const scoutSignature = (tileMapView.activeScouts || []).map((mission) => [
        mission.id || '',
        mission.status || '',
        (mission.route || []).map((step) => [
          step.tileId || '',
          step.q ?? '',
          step.r ?? '',
          step.step ?? '',
          step.revealed ? 1 : 0,
        ].join(',')).join('|'),
      ].join(':')).join(';');
      return [
        options.kind || 'world',
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        Math.round(frame.x),
        Math.round(frame.y),
        Math.round(frame.width),
        Math.round(frame.height),
        Math.round(scale * 1000),
        Math.round((Number(options.cacheScale) || 1) * 1000),
        Math.round((Number(viewport.originX) || 0) * 10) / 10,
        Math.round((Number(viewport.originY) || 0) * 10) / 10,
        Math.round((Number(viewport.panX) || 0) * 10) / 10,
        Math.round((Number(viewport.panY) || 0) * 10) / 10,
        scoutSignature,
      ].join('::');
    }

    renderWorldScoutRouteLayer(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!Array.isArray(tileMapView.activeScouts) || !tileMapView.activeScouts.length) return true;
      const layout = this.resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries);
      if (!layout) return false;
      if (layout.kind === 'chunks') return false;
      if (this.worldTileFastDragActive && this.worldTileScoutRouteCacheKey && this.worldTileScoutRouteCache?.canvas) {
        return this.drawWorldTileLayerCache(this.worldTileScoutRouteCache, layout, frame);
      }
      const cacheScale = this.getWorldTileStaticCacheScale();
      const work = this.getWorldTileScoutRouteCacheContext(layout.frame.width, layout.frame.height, cacheScale);
      if (!work) return false;
      const cacheKey = this.getWorldTileScoutRouteCacheKey(tileMapView, layout.renderViewport, layout.frame, {
        kind: layout.kind,
        cacheScale,
      });
      if (cacheKey !== this.worldTileScoutRouteCacheKey) {
        const previousCtx = this.ctx;
        this.ctx = work.ctx;
        try {
          work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
          work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
          work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
          work.ctx.globalAlpha = 1;
          work.ctx.globalCompositeOperation = 'source-over';
          work.ctx.save?.();
          work.ctx.translate?.(-(Number(layout.frame.x) || 0), -(Number(layout.frame.y) || 0));
          this.renderWorldScoutRoutes(tileMapView, layout.renderViewport);
          work.ctx.restore?.();
          this.worldTileScoutRouteCacheKey = cacheKey;
          this.worldTileScoutRouteCacheLayout = { ...layout, frame: { ...layout.frame } };
        } finally {
          this.ctx = previousCtx;
        }
      }
      return this.drawWorldTileLayerCache(work, layout, frame);
    }

    getWorldTileWaterAnimationFps() {
      return 8;
    }

    getWorldTileWaterAnimationFrameCount() {
      return 8;
    }

    getWorldTileWaterAnimationFrameMs() {
      return Math.max(16, Math.round(1000 / Math.max(1, this.getWorldTileWaterAnimationFps())));
    }

    getWorldTileWaterTimeMs() {
      return this.worldTileWaterTimeOverride !== null
        && this.worldTileWaterTimeOverride !== undefined
        && Number.isFinite(Number(this.worldTileWaterTimeOverride))
        ? Number(this.worldTileWaterTimeOverride)
        : this.getNow();
    }

    getWorldTileWaterAnimationFrame(timeMs = this.getWorldTileWaterTimeMs()) {
      return Math.floor((Math.max(0, Number(timeMs) || 0) / 1000) * this.getWorldTileWaterAnimationFps());
    }

    getWorldTileWaterAnimationFrameIndex(timeMs = this.getWorldTileWaterTimeMs()) {
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      const frame = this.getWorldTileWaterAnimationFrame(timeMs);
      return ((frame % frameCount) + frameCount) % frameCount;
    }

    getWorldTileWaterFrameTimeMs(frameIndex = 0) {
      const safeFrame = Math.max(0, Number(frameIndex) || 0);
      return safeFrame * this.getWorldTileWaterAnimationFrameMs();
    }

    getWorldTileWaterLayerCacheKey(tileMapView = {}, viewport = {}, frame = {}, entries = [], options = {}) {
      const scale = Number(viewport.scale) || 1;
      const entrySignature = entries
        .filter(({ tile }) => tile.water?.kind && tile.water?.asset)
        .map(({ tile, center, drawRect }) => [
          tile.id,
          tile.water?.kind || '',
          tile.water?.asset || '',
          (tile.templateAssets || []).map((asset) => `${asset.key}:${asset.asset}:${asset.waterKind || ''}`).join(','),
          Math.round(center.x * 10) / 10,
          Math.round(center.y * 10) / 10,
          Math.round(drawRect.x * 10) / 10,
          Math.round(drawRect.y * 10) / 10,
        ].join('|'))
        .join(';');
      return [
        options.kind || 'world',
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        Math.round(frame.x),
        Math.round(frame.y),
        Math.round(frame.width),
        Math.round(frame.height),
        Math.round(scale * 1000),
        Math.round((Number(options.cacheScale) || 1) * 1000),
        options.frameIndex ?? this.getWorldTileWaterAnimationFrameIndex(),
        entrySignature,
      ].join('::');
    }

    resolveWorldTileWaterLayerCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      return this.resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries);
    }

    renderWorldTileWaterFrameCache(tileMapView = {}, layout = {}, waterEntries = [], cacheScale = 1, frameIndex = 0, cacheMap = this.worldTileWaterFrameCaches, cacheId = frameIndex, kind = layout.kind || 'world') {
      if (!layout?.frame || !Array.isArray(waterEntries) || !waterEntries.length || !cacheMap) return null;
      const width = Math.max(1, Number(layout.frame.width) || 1);
      const height = Math.max(1, Number(layout.frame.height) || 1);
      let work = cacheMap.get(cacheId);
      const pixelW = Math.max(1, Math.ceil(width * cacheScale));
      const pixelH = Math.max(1, Math.ceil(height * cacheScale));
      if (!work?.canvas || !work?.ctx || work.canvas.width !== pixelW || work.canvas.height !== pixelH) {
        work = this.createWorldTileLayerWork(width, height, cacheScale);
        if (!work) return null;
        cacheMap.set(cacheId, work);
      }
      work.width = width;
      work.height = height;
      work.pixelWidth = pixelW;
      work.pixelHeight = pixelH;
      work.scale = cacheScale;
      work.frame = { ...layout.frame };
      work.frameIndex = frameIndex;
      const cacheKey = this.getWorldTileWaterLayerCacheKey(tileMapView, layout.renderViewport, layout.frame, waterEntries, {
        kind,
        cacheScale,
        frameIndex,
      });
      if (cacheKey !== work.key) {
        const previousCtx = this.ctx;
        this.ctx = work.ctx;
        try {
          work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
          work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
          work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
          work.ctx.globalAlpha = 1;
          work.ctx.globalCompositeOperation = 'source-over';
          work.ctx.save?.();
          work.ctx.translate?.(-(Number(layout.frame.x) || 0), -(Number(layout.frame.y) || 0));
          this.renderWorldTileWaterEntries(
            tileMapView,
            layout.renderViewport,
            waterEntries,
            this.getWorldTileWaterFrameTimeMs(frameIndex),
          );
          work.ctx.restore?.();
          work.key = cacheKey;
        } finally {
          this.ctx = previousCtx;
        }
      }
      return work;
    }

    getWorldTileWaterFrameCache(frameIndex = this.getWorldTileWaterAnimationFrameIndex()) {
      return this.worldTileWaterFrameCaches?.get?.(frameIndex) || null;
    }

    renderWorldTileWaterFrameCaches(tileMapView = {}, layout = {}, waterEntries = [], cacheScale = 1) {
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      let rendered = false;
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const work = this.renderWorldTileWaterFrameCache(
          tileMapView,
          layout,
          waterEntries,
          cacheScale,
          frameIndex,
          this.worldTileWaterFrameCaches,
          frameIndex,
          layout.kind || 'world',
        );
        if (work) rendered = true;
      }
      return rendered;
    }

    renderWorldTileWaterLayer(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      const layout = this.resolveWorldTileWaterLayerCacheLayout(tileMapView, viewport, frame, entries);
      if (!layout) return false;
      if (layout.kind === 'chunks') return this.renderWorldTileWaterChunks(tileMapView, layout.layouts, frame);
      const waterEntries = layout.entries.filter(({ tile }) => tile.water?.kind && tile.water?.asset);
      if (!waterEntries.length) return true;
      const cacheScale = this.getWorldTileStaticCacheScale();
      const frameIndex = this.getWorldTileWaterAnimationFrameIndex();
      if (!this.worldTileFastDragActive && !this.renderWorldTileWaterFrameCaches(tileMapView, layout, waterEntries, cacheScale)) {
        return false;
      }
      const work = this.getWorldTileWaterFrameCache(frameIndex);
      if (!work?.canvas) return false;
      this.worldTileWaterLayerCache = work;
      this.worldTileWaterLayerCacheKey = work.key || '';
      return this.drawWorldTileLayerCache(work, layout, frame);
    }

    renderWorldTileStaticEntries(tileMapView = {}, viewport = {}, frame = {}, entries = [], uiState = {}, options = {}) {
      const geometry = tileMapView.geometry || {};
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      entries.forEach(({ tile, center, drawRect }) => {
        const selected = uiState.selectedSiteId && tile.site?.id === uiState.selectedSiteId;
        if (tile.water?.kind && tile.water?.asset) {
          this.drawWorldTileDryTemplate(tile, drawRect);
        } else if (!this.drawWorldTileBase(tile, center, drawRect, viewport)) {
          this.drawIsoDiamond(center.x, center.y, tileWidth, tileHeight, {
            fill: this.getFallbackTerrainFill(tile.terrain),
            stroke: selected ? 'rgba(116, 211, 160, 0.78)' : 'rgba(255, 226, 177, 0.14)',
          });
        }
        if (selected) {
          this.drawIsoDiamond(center.x, center.y, tileWidth * 1.04, tileHeight * 1.04, {
            fill: 'rgba(0, 0, 0, 0)',
            stroke: 'rgba(116, 211, 160, 0.86)',
            width: 2,
          });
        }
        this.drawWorldTerrainFeature(tile, viewport, geometry, tileWidth, tileHeight);
        if (tile.feature?.asset) this.drawWorldTileFeature(tile, viewport, geometry, tileWidth, tileHeight);
      });
      entries.filter(({ tile }) => tile.site).forEach(({ tile, center }) => {
        this.drawWorldTileSite(tile, viewport, geometry, tileWidth, tileHeight, uiState, {
          center,
          addHitTarget: options.addHitTargets !== false,
        });
      });
    }

    renderWorldTileWaterEntries(tileMapView = {}, viewport = {}, entries = [], waterTimeMs = null) {
      entries.forEach(({ tile, center, drawRect }) => {
        if (!tile.water?.kind || !tile.water?.asset) return;
        this.drawWorldTileWater(tile, center, drawRect, viewport, { drawDryTemplate: false, waterTimeMs });
      });
    }

    addWorldTileSiteHitTargets(tileMapView = {}, viewport = {}, entries = [], uiState = {}) {
      const geometry = tileMapView.geometry || {};
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      entries.filter(({ tile }) => tile.site).forEach(({ tile, center }) => {
        const layout = this.getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center);
        if (!layout) return;
        this.addHitTarget(layout.hitRect, {
          type: 'openWorldSite',
          siteId: layout.site.id,
          tileId: tile.id,
        });
      });
    }

    renderWorldScoutRoutes(tileMapView = {}, viewport = {}) {
      const geometry = tileMapView.geometry || {};
      (tileMapView.activeScouts || []).forEach((mission) => {
        const points = (mission.route || []).map((step) => this.getWorldTileScreenCenter(step, viewport, geometry));
        if (points.length >= 2) {
          this.drawPolyline(points, {
            color: mission.status === 'ready' ? 'rgba(116, 211, 160, 0.72)' : 'rgba(240, 180, 91, 0.78)',
            width: 2,
          });
        }
        points.forEach((point, index) => {
          const step = mission.route[index] || {};
          const fill = step.revealed ? 'rgba(116, 211, 160, 0.84)' : 'rgba(240, 180, 91, 0.52)';
          this.drawPanel(point.x - 4, point.y - 4, 8, 8, {
            fill,
            stroke: 'rgba(11, 18, 14, 0.54)',
            radius: 4,
          });
        });
      });
    }

    getWorldScoutUnitRoutePoints(mission = {}, viewport = {}, geometry = {}) {
      const route = Array.isArray(mission.route) ? mission.route : [];
      const origin = mission.origin && typeof mission.origin === 'object' ? mission.origin : null;
      const path = origin ? [origin, ...route] : route;
      return path.map((step) => this.getWorldTileScreenCenter(step, viewport, geometry));
    }

    getWorldScoutUnitProgress(mission = {}) {
      if (!mission || mission.status !== 'active') return null;
      const route = Array.isArray(mission.route) ? mission.route : [];
      if (!route.length) return null;
      const startedAtMs = new Date(mission.startedAt).getTime();
      if (!Number.isFinite(startedAtMs)) return null;
      const nowMs = this.getNow?.() || Date.now();
      const stepDurationMs = Math.max(1000, Number(mission.stepDurationSeconds) * 1000 || 10000);
      const totalDurationMs = Math.max(stepDurationMs, stepDurationMs * route.length);
      const elapsed = Math.max(0, Number(nowMs) - startedAtMs);
      return Math.max(0, Math.min(1, elapsed / totalDurationMs));
    }

    getWorldScoutUnitPoint(mission = {}, viewport = {}, geometry = {}) {
      const progress = this.getWorldScoutUnitProgress(mission);
      if (progress === null) return null;
      const points = this.getWorldScoutUnitRoutePoints(mission, viewport, geometry);
      if (points.length < 2) return null;
      const scaled = progress * (points.length - 1);
      const index = Math.min(points.length - 2, Math.floor(scaled));
      const localT = Math.max(0, Math.min(1, scaled - index));
      const from = points[index];
      const to = points[index + 1];
      return {
        x: from.x + (to.x - from.x) * localT,
        y: from.y + (to.y - from.y) * localT,
        progress,
      };
    }

    getWorldScoutUnitFramePath(mission = {}) {
      const manifest = this.constructor.getUnitSpriteManifest();
      if (!manifest?.getFramePaths) return '';
      const frames = manifest.getFramePaths('spearman', 'move');
      if (!frames.length) return '';
      const frameMs = manifest.getFrameDurationMs?.('spearman', 'move') || 80;
      const startedAtMs = new Date(mission.startedAt).getTime();
      const nowMs = this.getNow?.() || Date.now();
      const elapsed = Number.isFinite(startedAtMs) ? Math.max(0, Number(nowMs) - startedAtMs) : Number(nowMs);
      return frames[Math.floor(elapsed / Math.max(1, frameMs)) % frames.length] || frames[0];
    }

    renderWorldScoutUnits(tileMapView = {}, viewport = {}) {
      const actors = sharedWorldMarchSystem?.buildActors?.({ missions: tileMapView.activeScouts || [] }, {
        nowMs: this.getNow?.() || Date.now(),
      }) || [];
      return this.renderWorldActors(actors, viewport, tileMapView.geometry || {});
    }

    renderWorldActors(actors = [], viewport = {}, geometry = {}) {
      if (!this.worldActorRenderer?.renderActors) return false;
      return this.worldActorRenderer.renderActors(actors, viewport, geometry);
    }

    addWorldActorHitTargets(actors = [], viewport = {}, geometry = {}) {
      if (!this.worldActorRenderer?.addActorHitTargets) return false;
      return this.worldActorRenderer.addActorHitTargets(actors, viewport, geometry);
    }

    renderWorldMarchHud(state = {}, uiState = {}, actors = [], viewport = {}, geometry = {}, frame = {}) {
      if (!this.worldMarchHudRenderer?.renderWorldMarchHud) return false;
      return this.worldMarchHudRenderer.renderWorldMarchHud(state, uiState, actors, viewport, geometry, frame);
    }

    getNearestWorldTileAtPoint(point = {}, tileMapView = {}, viewport = {}) {
      return sharedWorldMarchSystem?.screenPointToNearestTile?.(point, tileMapView, viewport) || null;
    }

    addWorldMarchTileHitTargets(tileMapView = {}, viewport = {}, frame = {}) {
      if (!Array.isArray(tileMapView.tiles) || !tileMapView.tiles.length) return false;
      const geometry = tileMapView.geometry || {};
      (tileMapView.tiles || []).forEach((tile) => {
        const center = this.getWorldTileScreenCenter(tile, viewport, geometry);
        if (
          center.x < frame.x - 48
          || center.x > frame.x + frame.width + 48
          || center.y < frame.y - 32
          || center.y > frame.y + frame.height + 32
        ) return;
        const tileWidth = (Number(geometry.tileWidth) || 192) * (Number(viewport.scale) || 1) * 0.86;
        const tileHeight = (Number(geometry.tileHeight) || 96) * (Number(viewport.scale) || 1) * 0.86;
        this.addHitTarget({
          x: center.x - tileWidth / 2,
          y: center.y - tileHeight / 2,
          width: tileWidth,
          height: tileHeight,
        }, {
          type: 'selectWorldMarchTarget',
          tileId: tile.id,
          targetQ: tile.q,
          targetR: tile.r,
          background: true,
        });
      });
      return true;
    }

    renderWorldScoutUnitsLegacy(tileMapView = {}, viewport = {}) {
      const unitRenderer = this.constructor.getTutorialIntroUnitRenderer();
      if (!unitRenderer?.renderUnit) return false;
      const geometry = tileMapView.geometry || {};
      let rendered = false;
      (tileMapView.activeScouts || []).forEach((mission) => {
        if (mission.kind !== 'worldExplore' || mission.status !== 'active') return;
        const point = this.getWorldScoutUnitPoint(mission, viewport, geometry);
        if (!point) return;
        const scale = Math.max(0.32, Math.min(0.62, (Number(viewport.scale) || 1) * 0.92));
        const framePath = this.getWorldScoutUnitFramePath(mission);
        unitRenderer.renderUnit(this, point.x, point.y + 6 * scale, scale, framePath);
        rendered = true;
      });
      return rendered;
    }

    renderWorldTileMap(tileMapView = {}, x, y, width, height, uiState = {}, options = {}) {
      const geometry = tileMapView.geometry || {};
      const scaleBasisWidth = Number(options.scaleBasisWidth) || width;
      const scaleBasisHeight = Number(options.scaleBasisHeight) || height;
      const originX = options.originX !== undefined ? Number(options.originX) : x + width * 0.5;
      const originY = options.originY !== undefined ? Number(options.originY) : y + height * 0.42;
      const scale = Math.max(0.38, Math.min(0.78, Math.min(scaleBasisWidth / 520, scaleBasisHeight / 420)));
      const viewport = {
        originX: Number.isFinite(originX) ? originX : x + width * 0.5,
        originY: Number.isFinite(originY) ? originY : y + height * 0.42,
        panX: Number(tileMapView.pan?.x) || 0,
        panY: Number(tileMapView.pan?.y) || 0,
        scale,
        seed: tileMapView.seed || 'scout-tile-v1',
        geometry,
      };
      const frame = { x: x + 1, y: y + 1, width: width - 2, height: height - 2 };
      const hitTargetsOnly = Boolean(options.hitTargetsOnly);
      const snapshotOnly = Boolean(options.snapshotOnly);
      const previousFastDragActive = this.worldTileFastDragActive;
      this.worldTileFastDragActive = Boolean(options.fastDrag);

      try {
        if (!hitTargetsOnly && options.frameless && this.ctx?.fillRect) {
          this.ctx.fillStyle = 'rgba(20, 26, 23, 0.92)';
          this.ctx.fillRect(x, y, width, height);
        } else if (!hitTargetsOnly) {
          this.drawPanel(x, y, width, height, {
            fill: this.createGradient(
              x, y, x, y + height,
              [
                [0, 'rgba(30, 43, 45, 0.88)'],
                [1, 'rgba(18, 17, 14, 0.94)'],
              ],
              'rgba(25, 31, 30, 0.92)',
            ),
            stroke: 'rgba(240, 180, 91, 0.18)',
            radius: 8,
            inset: 'rgba(255, 231, 184, 0.06)',
          });
        }
        this.addHitTarget({ x, y, width, height }, { type: 'worldMapDrag', background: true });
        if (!hitTargetsOnly && snapshotOnly) {
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.rect(x + 1, y + 1, width - 2, height - 2);
          this.ctx.clip();
          const renderedSnapshot = this.renderWorldTileSnapshotCache(tileMapView, viewport, frame);
          this.ctx.restore();
          if (renderedSnapshot) return;
          return;
        }
        const visibleEntries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
        if (hitTargetsOnly) {
          this.addWorldMarchTileHitTargets(tileMapView, viewport, frame);
          this.addWorldTileSiteHitTargets(tileMapView, viewport, visibleEntries, uiState);
          const actors = sharedWorldMarchSystem?.buildActors?.({ missions: tileMapView.activeScouts || [] }, {
            nowMs: this.getNow?.() || Date.now(),
          }) || [];
          this.addWorldActorHitTargets(actors, viewport, geometry);
          return;
        }

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(x + 1, y + 1, width - 2, height - 2);
        this.ctx.clip();

        if (!this.renderWorldScoutRouteLayer(tileMapView, viewport, frame, visibleEntries)) {
          this.renderWorldScoutRoutes(tileMapView, viewport);
        }
        if (!this.renderWorldTileWaterLayer(tileMapView, viewport, frame, visibleEntries)) {
          this.renderWorldTileWaterEntries(tileMapView, viewport, visibleEntries, this.getWorldTileWaterTimeMs());
        }
        if (!this.renderWorldTileStaticLayer(tileMapView, viewport, frame, visibleEntries, uiState)) {
          this.renderWorldTileStaticEntries(tileMapView, viewport, frame, visibleEntries, uiState, {
            addHitTargets: false,
          });
        }
        this.renderWorldTileFogMask(tileMapView, viewport, frame, visibleEntries);
        const actors = sharedWorldMarchSystem?.buildActors?.({ missions: tileMapView.activeScouts || [] }, {
          nowMs: this.getNow?.() || Date.now(),
        }) || [];
        this.renderWorldActors(actors, viewport, geometry);
        this.renderWorldMarchHud(options.state || {}, uiState, actors, viewport, geometry, frame);
        this.addWorldMarchTileHitTargets(tileMapView, viewport, frame);
        this.addWorldTileSiteHitTargets(tileMapView, viewport, visibleEntries, uiState);
        this.addWorldActorHitTargets(actors, viewport, geometry);

        this.ctx.restore();
      } finally {
        this.worldTileFastDragActive = previousFastDragActive;
      }
    }

    renderMilitaryWorldView(state = {}, x, y, width, height, options = {}) {
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const skipWorldMapLayer = Boolean(options.skipWorldMapLayer);
      const summary = this.presenter.buildTerritorySummaryViewState(territoryState);
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(28, 22, 17, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      this.drawText(summary.text?.polityName || '未命名势力', x + 14, y + 13, { size: 14, bold: true, color: '#f0b45b' });
      this.drawText(summary.text?.territoryCount || '0/0 已控制', x + width - 14, y + 15, {
        size: 11,
        color: '#74d3a0',
        align: 'right',
      });
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      if (tileMapView?.tiles?.length) {
        if (this.isWorldTileMapWaterAnimated(tileMapView)) {
          uiState.tileMapWaterAnimated = true;
        }
        const mapX = x + 12;
        const mapY = y + 46;
        const mapW = width - 24;
        const mapH = Math.max(160, height - 58);
        this.renderWorldTileMap(tileMapView, mapX, mapY, mapW, mapH, uiState, {
          hitTargetsOnly: skipWorldMapLayer,
        });
        if (skipWorldMapLayer && this.ctx?.clearRect) this.ctx.clearRect(mapX, mapY, mapW, mapH);
        const resetW = 76;
        this.drawButton(mapX + mapW - resetW - 8, mapY + 8, resetW, 28, '回到本城', { size: 11, radius: 8 });
        this.addHitTarget({ x: mapX + mapW - resetW - 8, y: mapY + 8, width: resetW, height: 28 }, { type: 'resetWorldPan' });
        this.drawText(`${tileMapView.tiles.length} tiles`, mapX + 12, mapY + mapH - 14, {
          size: 10,
          color: 'rgba(246, 232, 200, 0.68)',
        });
        return;
      }

      const territories = territoryState.territories || [];
      if (!territories.length) {
        this.drawTextLines(this.wrapTextLimit('派出侦察队后，外部世界将在这里逐步显现。', width - 40, 3, { size: 13 }), x + 20, y + 70, {
          size: 13,
          color: '#cbbd96',
          lineHeight: 18,
        });
        return;
      }

      const radarView = this.presenter.buildWorldRadarViewState(territories, {
        panX: uiState.worldPanX || 0,
        panY: uiState.worldPanY || 0,
      });
      const radarSize = Math.min(width - 24, Math.max(260, Math.min(height - 68, 520)));
      const radarX = x + (width - radarSize) / 2;
      const radarY = y + 46;
      this.drawPanel(radarX, radarY, radarSize, radarSize, {
        fill: this.createGradient(
          radarX, radarY, radarX + radarSize, radarY + radarSize,
          [
            [0, 'rgba(39, 56, 42, 0.78)'],
            [1, 'rgba(18, 16, 13, 0.9)'],
          ],
          'rgba(24, 30, 24, 0.86)',
        ),
        stroke: 'rgba(240, 180, 91, 0.22)',
        radius: radarSize / 2,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.addHitTarget({ x: radarX, y: radarY, width: radarSize, height: radarSize }, { type: 'worldRadarDrag', background: true });
      this.drawLine(radarX + radarSize / 2, radarY + 12, radarX + radarSize / 2, radarY + radarSize - 12, {
        color: 'rgba(240, 180, 91, 0.16)',
      });
      this.drawLine(radarX + 12, radarY + radarSize / 2, radarX + radarSize - 12, radarY + radarSize / 2, {
        color: 'rgba(240, 180, 91, 0.16)',
      });
      this.drawText('N', radarX + radarSize / 2, radarY + 12, { size: 10, color: '#d6b16e', align: 'center' });
      this.drawText('S', radarX + radarSize / 2, radarY + radarSize - 22, { size: 10, color: '#d6b16e', align: 'center' });
      this.drawText('W', radarX + 12, radarY + radarSize / 2 - 5, { size: 10, color: '#d6b16e' });
      this.drawText('E', radarX + radarSize - 18, radarY + radarSize / 2 - 5, { size: 10, color: '#d6b16e' });

      const panX = radarView.pan?.x || 0;
      const panY = radarView.pan?.y || 0;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(radarX + radarSize / 2, radarY + radarSize / 2, radarSize / 2 - 2, 0, Math.PI * 2);
      this.ctx.clip();

      radarView.sites.forEach((site) => {
        const left = Math.max(8, Math.min(92, Number(site.position?.left) || 50));
        const top = Math.max(8, Math.min(92, Number(site.position?.top) || 50));
        const siteX = radarX + radarSize * left / 100 - 18 + panX;
        const siteY = radarY + radarSize * top / 100 - 18 + panY;
        const isSelected = uiState.selectedSiteId === site.id;
        this.drawPanel(siteX, siteY, 36, 36, {
          fill: isSelected ? 'rgba(116, 211, 160, 0.3)' : 'rgba(42, 35, 24, 0.86)',
          stroke: isSelected ? 'rgba(116, 211, 160, 0.76)' : 'rgba(240, 180, 91, 0.3)',
          radius: 18,
          inset: 'rgba(255, 231, 184, 0.08)',
        });
        if (!this.drawAsset(site.art, siteX + 5, siteY + 5, 26, 26)) {
          this.drawText('●', siteX + 18, siteY + 18, {
            size: 14,
            color: site.owner === 'player' ? '#74d3a0' : '#f0b45b',
            baseline: 'middle',
            align: 'center',
          });
        }
        this.drawText(this.truncateText(site.name || site.title || '地点', 64, { size: 9 }), siteX + 18, siteY + 39, {
          size: 9,
          color: '#eaeaea',
          align: 'center',
        });
        this.addHitTarget({ x: siteX - 6, y: siteY - 6, width: 48, height: 54 }, { type: 'openWorldSite', siteId: site.id });
      });

      this.ctx.restore();

      const resetW = 76;
      this.drawButton(radarX + radarSize - resetW - 8, radarY + 8, resetW, 28, '回到本城', { size: 11, radius: 14 });
      this.addHitTarget({ x: radarX + radarSize - resetW - 8, y: radarY + 8, width: resetW, height: 28 }, { type: 'resetWorldPan' });
    }

    renderWorldSiteAction(actionView = {}, x, y, width) {
      const buttons = actionView.buttons || [];
      if (!buttons.length) return y;
      if (actionView.kind === 'city-command') {
        const primary = buttons.find((button) => button.action === 'enter-city') || buttons[0];
        const sideButtons = buttons.filter((button) => button !== primary).slice(0, 5);
        const primarySize = 74;
        const primaryX = x + Math.max(8, Math.floor(width * 0.26));
        const primaryY = y + 12;
        this.drawPanel(primaryX, primaryY, primarySize, primarySize, {
          fill: this.createGradient(
            primaryX, primaryY, primaryX, primaryY + primarySize,
            [
              [0, 'rgba(191, 90, 55, 0.98)'],
              [1, 'rgba(99, 35, 24, 0.98)'],
            ],
            'rgba(146, 56, 38, 0.98)',
          ),
          stroke: 'rgba(255, 218, 142, 0.86)',
          radius: primarySize / 2,
          inset: 'rgba(255, 248, 210, 0.22)',
        });
        this.drawText(primary.label || '入城', primaryX + primarySize / 2, primaryY + primarySize / 2, {
          size: 20,
          bold: true,
          color: '#ffe6b5',
          baseline: 'middle',
          align: 'center',
        });
        this.addHitTarget({ x: primaryX, y: primaryY, width: primarySize, height: primarySize }, {
          type: 'enterCity',
          territoryId: primary.territoryId,
          cityId: primary.territoryId,
          disabled: primary.disabled || !primary.action,
        });

        const commandX = Math.min(x + width - 116, primaryX + primarySize + 20);
        const commandY = y;
        sideButtons.forEach((button, index) => {
          const buttonY = commandY + index * 38;
          const type = button.action === 'rename-city'
            ? 'renameCity'
            : (button.action === 'labor-city' ? 'enterCity' : 'territoryAction');
          this.drawButton(commandX, buttonY, 108, 32, button.label, {
            size: 13,
            radius: 8,
            disabled: button.disabled || !button.action,
            active: !button.secondary && !button.disabled,
          });
          this.addHitTarget({ x: commandX, y: buttonY, width: 108, height: 32 }, {
            type,
            territoryId: button.territoryId,
            cityId: button.territoryId,
            tab: button.action === 'labor-city' ? 'people' : undefined,
            disabled: button.disabled || !button.action,
          });
        });
        return y + Math.max(primarySize + 18, sideButtons.length * 38 + 4);
      }
      const gap = 8;
      const buttonWidth = Math.max(72, (width - gap * (buttons.length - 1)) / Math.max(1, buttons.length));
      buttons.forEach((button, index) => {
        const buttonX = x + index * (buttonWidth + gap);
        this.drawButton(buttonX, y, buttonWidth, 34, button.label, {
          size: 12,
          radius: 8,
          disabled: button.disabled || !button.action,
          active: !button.secondary && !button.disabled && Boolean(button.action),
        });
        this.addHitTarget({ x: buttonX, y, width: buttonWidth, height: 34 }, {
          type: button.action === 'conquer' ? 'conquer' :
               button.action === 'launch-expedition' ? 'launchExpedition' :
               button.action === 'claim' ? 'claimConquest' :
               button.action === 'enter-battle' ? 'enterBattleScene' :
               button.action === 'enter-city' ? 'enterCity' :
               button.action === 'labor-city' ? 'enterCity' :
               button.action === 'manage-city' ? 'manageCity' :
               button.action === 'rename-city' ? 'renameCity' :
               button.action === 'open-expedition' ? 'openExpedition' :
               button.action === 'close-expedition' ? 'closeExpedition' : 'territoryAction',
          territoryId: button.territoryId,
          cityId: button.territoryId,
          tab: button.action === 'labor-city' ? 'people' : undefined,
          disabled: button.disabled || !button.action,
        });
      });
      return y + 44;
    }

    renderWorldExpeditionConfig(config = {}, x, y, width) {
      if (!config) return y;
      this.drawPanel(x, y, width, 136, {
        fill: 'rgba(0, 0, 0, 0.16)',
        stroke: 'rgba(240, 180, 91, 0.16)',
        radius: 9,
      });
      const leaderOptions = config.fields?.leader?.options || [];
      const activeLeader = leaderOptions.find((option) => option.value === config.fields?.leader?.value) || leaderOptions[0] || null;
      this.drawText(`领队 ${activeLeader?.label || '暂无可出征名人'}`, x + 12, y + 12, { size: 12, bold: true, color: '#f6e8c8' });
      const leaderY = y + 34;
      const leaderButtonWidth = Math.max(82, Math.min(118, (width - 24 - 8 * Math.max(0, leaderOptions.length - 1)) / Math.max(1, Math.min(3, leaderOptions.length || 1))));
      leaderOptions.slice(0, 3).forEach((option, index) => {
        const buttonX = x + 12 + index * (leaderButtonWidth + 8);
        const active = option.value === config.fields?.leader?.value;
        this.drawButton(buttonX, leaderY, leaderButtonWidth, 26, this.truncateText(option.label, leaderButtonWidth - 12, { size: 10 }), {
          size: 10,
          radius: 7,
          active,
          disabled: false,
        });
        this.addHitTarget({ x: buttonX, y: leaderY, width: leaderButtonWidth, height: 26 }, {
          type: 'changeExpeditionLeader',
          siteId: config.siteId,
          value: option.value,
          disabled: false,
        });
      });
      this.drawText(`出征数量 ${config.fields?.soldiers?.value || 1}`, x + 12, y + 70, { size: 12, bold: true, color: '#f6e8c8' });
      this.drawText(config.note || '', x + 12, y + 92, { size: 10, color: '#aeb0b8' });
      const value = Number(config.fields?.soldiers?.value) || 1;
      const controlsY = y + 112;
      this.drawButton(x + 12, controlsY, 34, 28, '-', { size: 14, radius: 7, disabled: value <= 1 });
      this.drawButton(x + width - 46, controlsY, 34, 28, '+', { size: 14, radius: 7 });
      this.drawButton(x + width - 132, controlsY, 78, 28, config.buttons?.launch?.label || '出发', {
        size: 12,
        radius: 7,
        disabled: config.disabled,
        active: !config.disabled,
      });
      this.addHitTarget({ x: x + 12, y: controlsY, width: 34, height: 28 }, {
        type: 'changeExpeditionSoldiers',
        siteId: config.siteId,
        delta: -1,
        value: Math.max(1, value - 1),
        disabled: value <= 1,
      });
      this.addHitTarget({ x: x + width - 46, y: controlsY, width: 34, height: 28 }, {
        type: 'changeExpeditionSoldiers',
        siteId: config.siteId,
        delta: 1,
        value: value + 1,
      });
      this.addHitTarget({ x: x + width - 132, y: controlsY, width: 78, height: 28 }, {
        type: 'launchExpedition',
        territoryId: config.siteId,
        disabled: config.disabled,
      });
      return y + 148;
    }

    renderWorldSiteModal(state = {}, options = {}) {
      const territoryState = state.territoryState || {};
      const territories = territoryState.territories || [];
      const uiState = options.territoryUiState || {};
      const view = this.buildWorldSiteDialogViewState(territories, territoryState, uiState);
      if (!view.showModal) return;
      const detail = view.details.find((item) => item.id === view.selectedSiteId);
      if (!detail) return;
      if (detail.action?.kind === 'city-command') {
        this.renderWorldCityCommandOverlay(detail, territories, state, options);
        return;
      }

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeWorldSite' });
      const layout = this.getLayout();
      const panelWidth = Math.min(layout.contentWidth - 24, 360);
      const panelHeight = Math.min(500, this.height - 150);
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 12);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });
      const closeSize = 28;
      this.drawButton(x + panelWidth - closeSize - 10, y + 10, closeSize, closeSize, '×', { size: 16, radius: 7 });
      this.addHitTarget({ x: x + panelWidth - closeSize - 10, y: y + 10, width: closeSize, height: closeSize }, { type: 'closeWorldSite' });

      const selectedSite = territories.find((site) => site.id === detail.id) || {};
      this.drawAsset(selectedSite.art, x + 16, y + 20, 58, 58);
      this.drawText(this.truncateText(detail.text.name || '地点', panelWidth - 112, { size: 17, bold: true }), x + 84, y + 22, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
      });
      this.drawText(`${detail.text.status} · ${detail.text.owner}`, x + 84, y + 50, { size: 11, color: '#aeb0b8' });
      this.drawText(`${detail.text.distance} · ${detail.text.scale} · ${detail.text.threat}`, x + 84, y + 68, { size: 11, color: '#aeb0b8' });
      let cursorY = y + 94;
      const summaryLines = this.wrapTextLimit(detail.text.summary || '无', panelWidth - 32, 3, { size: 12 });
      this.drawTextLines(summaryLines, x + 16, cursorY, { size: 12, color: '#f6e8c8', lineHeight: 17 });
      cursorY += summaryLines.length * 17 + 12;
      this.drawText(`${detail.text.defense} · ${detail.text.soldiers}`, x + 16, cursorY, { size: 12, color: '#74d3a0' });
      cursorY += 22;
      if (detail.text.defenderLeader) {
        this.drawText(detail.text.defenderLeader, x + 16, cursorY, { size: 11, color: '#ffba8a' });
        cursorY += 18;
      }
      if (detail.text.defenderSkill) {
        this.drawText(detail.text.defenderSkill, x + 16, cursorY, { size: 11, color: '#d6b16e' });
        cursorY += 18;
      }
      if (detail.text.march) {
        this.drawText(detail.text.march, x + 16, cursorY, { size: 11, color: '#d6b16e' });
        cursorY += 20;
      }
      if (detail.text.note) {
        this.drawText(detail.text.note, x + 16, cursorY, { size: 11, color: '#d6b16e' });
        cursorY += 20;
      }
      if (Array.isArray(detail.text.battleReport) && detail.text.battleReport.length) {
        detail.text.battleReport.slice(0, 4).forEach((line) => {
          const lines = this.wrapTextLimit(line, panelWidth - 32, 1, { size: 11 });
          this.drawTextLines(lines, x + 16, cursorY, { size: 11, color: '#f0b45b', lineHeight: 15 });
          cursorY += lines.length * 15 + 3;
        });
        cursorY += 6;
      }
      if (detail.action?.hint) {
        const hintLines = this.wrapTextLimit(detail.action.hint, panelWidth - 32, 2, { size: 11 });
        this.drawTextLines(hintLines, x + 16, cursorY, { size: 11, color: '#aeb0b8', lineHeight: 15 });
        cursorY += hintLines.length * 15 + 10;
      }
      cursorY = this.renderWorldSiteAction(detail.action, x + 16, cursorY, panelWidth - 32);
      if (detail.action?.expeditionConfig) {
        this.renderWorldExpeditionConfig(detail.action.expeditionConfig, x + 16, cursorY, panelWidth - 32);
      }
    }

    renderWorldCityCommandLegacyOverlay(detail = {}, territories = [], state = {}, options = {}) {
      const selectedSite = territories.find((site) => site.id === detail.id) || {};
      const layout = this.getLayout();
      const panelWidth = Math.min(layout.contentWidth - 18, 372);
      const panelHeight = 232;
      const x = Math.floor((this.width - panelWidth) / 2);
      const dockTop = this.height - 64;
      const y = Math.max(this.getTopBarBottom(state, { isMapHome: true }) + 12, dockTop - panelHeight - 14);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeWorldSite', background: true });
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(41, 34, 25, 0.72)'],
            [1, 'rgba(18, 16, 13, 0.9)'],
          ],
          'rgba(28, 24, 18, 0.86)',
        ),
        stroke: 'rgba(255, 226, 177, 0.26)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 26;
      this.drawButton(x + panelWidth - closeSize - 8, y + 8, closeSize, closeSize, 'x', { size: 13, radius: 7 });
      this.addHitTarget({ x: x + panelWidth - closeSize - 8, y: y + 8, width: closeSize, height: closeSize }, { type: 'closeWorldSite' });

      const iconSize = 46;
      this.drawAsset(selectedSite.art || 'assets/art/world-site-city-cutout.png', x + 14, y + 16, iconSize, iconSize);
      const title = detail.text?.name || selectedSite.cityName || selectedSite.naturalName || '城市';
      this.drawText(this.truncateText(title, panelWidth - 118, { size: 17, bold: true }), x + 70, y + 17, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
      });
      this.drawText(`${detail.text?.status || '已占领'} · ${detail.text?.owner || '我方'}`, x + 70, y + 42, {
        size: 11,
        color: '#74d3a0',
      });
      this.drawText(this.truncateText(detail.text?.summary || detail.text?.scale || '城市可进入管理。', panelWidth - 36, { size: 11 }), x + 14, y + 76, {
        size: 11,
        color: '#d8c7a2',
      });
      if (detail.action?.hint) {
        this.drawText(this.truncateText(detail.action.hint, panelWidth - 36, { size: 10 }), x + 14, y + 96, {
          size: 10,
          color: 'rgba(234, 234, 234, 0.58)',
        });
      }
      this.renderWorldSiteAction(detail.action, x + 12, y + 118, panelWidth - 24);
    }

    getWorldCityCommandAnchor(detail = {}, territories = [], state = {}, options = {}) {
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      if (!tileMapView?.tiles?.length) return null;
      const selectedSite = territories.find((site) => site.id === detail.id) || {};
      const selectedTile = tileMapView.tiles.find((tile) => (
        tile?.site?.id === detail.id
        || tile?.siteId === detail.id
        || selectedSite.id && (tile?.siteId === selectedSite.id || tile?.site?.id === selectedSite.id)
      ));
      if (!selectedTile) return null;
      const topBarBottom = options.topBarBottom ?? this.getTopBarBottom(state, { isMapHome: true });
      const layout = typeof this.getWorldMapLayerLayout === 'function'
        ? this.getWorldMapLayerLayout(state, topBarBottom, { isMapHome: true })
        : {
          map: {
            x: 0,
            y: topBarBottom,
            width: this.width,
            height: Math.max(160, this.height - topBarBottom - 64),
          },
        };
      if (!layout?.map) return null;
      const geometry = tileMapView.geometry || {};
      const offsetX = Number(this.viewportOffsetX) || 0;
      const offsetY = Number(this.viewportOffsetY) || 0;
      const visibleWidth = Number(this.viewportWidth) || Math.max(1, this.width - offsetX * 2);
      const visibleHeight = Number(this.viewportHeight) || Math.max(1, this.height - offsetY * 2);
      const visibleMapY = Math.max(0, topBarBottom ?? 84);
      const visibleMapH = Math.max(160, visibleHeight - 64 - visibleMapY);
      const scale = Math.max(0.38, Math.min(0.78, Math.min(visibleWidth / 520, visibleMapH / 420)));
      const viewport = {
        originX: offsetX + visibleWidth * 0.5,
        originY: offsetY + visibleMapY + visibleMapH * 0.42,
        panX: Number(tileMapView.pan?.x) || 0,
        panY: Number(tileMapView.pan?.y) || 0,
        scale,
        seed: tileMapView.seed || 'scout-tile-v1',
        geometry,
      };
      const projectedCenter = this.getWorldTileScreenCenter(selectedTile, viewport, geometry);
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const frame = {
        x: Number(layout.map.x) || 0,
        y: Number(layout.map.y) || 0,
        width: Number(layout.map.width) || this.width,
        height: Number(layout.map.height) || this.height,
      };
      const entries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
      const selectedEntry = entries.find(({ tile }) => (
        tile?.id === selectedTile.id
        || tile?.site?.id === detail.id
        || tile?.siteId === detail.id
      ));
      const center = selectedEntry
        ? this.getWorldTileRenderedDiamondCenter(selectedEntry.tile, selectedEntry.drawRect)
        : projectedCenter;
      const siteLayout = this.getWorldTileSiteLayout(selectedTile, viewport, geometry, tileWidth, tileHeight, projectedCenter);
      if (!siteLayout) return null;
      return {
        map: layout.map,
        site: siteLayout.site || selectedSite,
        siteLayout,
        tileCenter: center,
        tileWidth,
        tileHeight,
        anchorX: center.x,
        anchorY: center.y,
        titleY: center.y - Math.max(34, tileHeight * 0.48),
      };
    }

    getWorldSiteCanvasAnchor(siteId = '', state = {}, options = {}) {
      if (!siteId) return null;
      const territoryState = state.territoryState || {};
      const territories = territoryState.territories || [];
      const tileMapView = this.resolveWorldTileMapView(territoryState, options.territoryUiState || {}, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      if (!tileMapView?.tiles?.length) return null;
      const selectedSite = territories.find((site) => site.id === siteId) || {};
      const selectedTile = tileMapView.tiles.find((tile) => (
        tile?.site?.id === siteId
        || tile?.siteId === siteId
        || selectedSite.id && (tile?.siteId === selectedSite.id || tile?.site?.id === selectedSite.id)
      ));
      if (!selectedTile) return null;
      const topBarBottom = options.topBarBottom ?? this.getTopBarBottom(state, { isMapHome: true });
      const geometry = tileMapView.geometry || {};
      const offsetX = Number(this.viewportOffsetX) || 0;
      const offsetY = Number(this.viewportOffsetY) || 0;
      const visibleWidth = Number(this.viewportWidth) || Math.max(1, this.width - offsetX * 2);
      const visibleHeight = Number(this.viewportHeight) || Math.max(1, this.height - offsetY * 2);
      const visibleMapY = Math.max(0, topBarBottom ?? 84);
      const visibleMapH = Math.max(160, visibleHeight - 64 - visibleMapY);
      const scale = Math.max(0.38, Math.min(0.78, Math.min(visibleWidth / 520, visibleMapH / 420)));
      const viewport = {
        originX: offsetX + visibleWidth * 0.5,
        originY: offsetY + visibleMapY + visibleMapH * 0.42,
        panX: Number(tileMapView.pan?.x) || 0,
        panY: Number(tileMapView.pan?.y) || 0,
        scale,
        seed: tileMapView.seed || 'scout-tile-v1',
        geometry,
      };
      const projectedCenter = this.getWorldTileScreenCenter(selectedTile, viewport, geometry);
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const siteLayout = this.getWorldTileSiteLayout(selectedTile, viewport, geometry, tileWidth, tileHeight, projectedCenter);
      if (!siteLayout) return null;
      return {
        ...siteLayout,
        site: siteLayout.site || selectedSite,
        tile: selectedTile,
        center: projectedCenter,
      };
    }

    getWorldCityCommandButtonAction(button = {}) {
      return {
        type: button.action === 'rename-city'
          ? 'renameCity'
          : (button.action === 'labor-city' ? 'enterCity' :
            button.action === 'enter-city' ? 'enterCity' : 'territoryAction'),
        territoryId: button.territoryId,
        cityId: button.territoryId,
        tab: button.action === 'labor-city' ? 'people' : undefined,
        disabled: button.disabled || !button.action,
      };
    }

    drawWorldCityCommandPrimaryButton(button = {}, x, y, size) {
      this.drawPanel(x, y, size, size, {
        fill: button.disabled || !button.action
          ? 'rgba(60, 52, 46, 0.78)'
          : this.createGradient(
            x, y, x, y + size,
            [
              [0, 'rgba(214, 113, 66, 0.98)'],
              [0.58, 'rgba(163, 58, 39, 0.98)'],
              [1, 'rgba(92, 30, 23, 0.98)'],
            ],
            'rgba(155, 54, 38, 0.98)',
          ),
        stroke: button.disabled || !button.action ? 'rgba(240, 180, 91, 0.28)' : 'rgba(255, 225, 150, 0.9)',
        radius: size / 2,
        inset: button.disabled || !button.action ? 'rgba(255, 231, 184, 0.08)' : 'rgba(255, 248, 210, 0.24)',
      });
      this.drawText(button.label || '入城', x + size / 2, y + size / 2, {
        size: Math.max(13, Math.floor(size * 0.27)),
        bold: true,
        color: button.disabled || !button.action ? '#8d8f99' : '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });
    }

    drawWorldCityCommandSideButton(button = {}, x, y, width, height) {
      const active = !button.secondary && !button.disabled && Boolean(button.action);
      this.drawPanel(x, y, width, height, {
        fill: button.disabled || !button.action
          ? 'rgba(44, 39, 34, 0.72)'
          : this.createGradient(
            x, y, x, y + height,
            [
              [0, active ? 'rgba(79, 55, 35, 0.96)' : 'rgba(49, 39, 28, 0.94)'],
              [1, active ? 'rgba(37, 25, 18, 0.98)' : 'rgba(29, 24, 20, 0.96)'],
            ],
            'rgba(42, 31, 23, 0.96)',
          ),
        stroke: active ? 'rgba(255, 214, 138, 0.62)' : 'rgba(240, 180, 91, 0.26)',
        radius: 5,
        inset: active ? 'rgba(255, 231, 184, 0.12)' : 'rgba(255, 231, 184, 0.06)',
      });
      this.drawText(this.truncateText(button.label || '', width - 12, { size: 12, bold: active }), x + width / 2, y + height / 2, {
        size: 12,
        bold: active,
        color: button.disabled || !button.action ? '#8d8f99' : '#f6e8c8',
        baseline: 'middle',
        align: 'center',
      });
    }

    renderWorldCityCommandOverlay(detail = {}, territories = [], state = {}, options = {}) {
      const selectedSite = territories.find((site) => site.id === detail.id) || {};
      const buttons = detail.action?.buttons || [];
      if (!buttons.length) return;
      const primary = buttons.find((button) => button.action === 'enter-city') || buttons[0];
      const renameButton = buttons.find((button) => button.action === 'rename-city') || null;
      const sideButtons = buttons.filter((button) => (
        button !== primary
        && button.action !== 'labor-city'
        && button.action !== 'rename-city'
      )).slice(0, 5);
      const anchor = this.getWorldCityCommandAnchor(detail, territories, state, options);
      if (!anchor) {
        const width = Math.min(this.getLayout().contentWidth - 24, 320);
        const x = Math.max(12, (this.width - width) / 2);
        const y = Math.max(this.getTopBarBottom(state, { isMapHome: true }) + 16, this.height - 260);
        this.renderWorldSiteAction({ ...detail.action, buttons: [primary, ...sideButtons] }, x, y, width);
        return;
      }

      const topLimit = Math.max(4, Number(anchor.map?.y) || this.getTopBarBottom(state, { isMapHome: true }) || 84);
      const bottomLimit = Math.max(topLimit + 120, Math.min(this.height - 66 - this.bottomSafeArea, (Number(anchor.map?.y) || 0) + (Number(anchor.map?.height) || this.height)));
      const primarySize = Math.max(41, Math.min(52, (Number(anchor.siteLayout?.drawW) || 110) * 0.5));
      const sideWidth = Math.min(88, Math.max(73, this.width * 0.2));
      const sideHeight = 27;
      const sideGap = 5;
      const sideTotalHeight = sideButtons.length * sideHeight + Math.max(0, sideButtons.length - 1) * sideGap;
      const clusterHeight = Math.max(primarySize, sideTotalHeight || primarySize);
      const hudLift = clusterHeight / 3;
      const gap = 8;
      const clusterWidth = primarySize + gap + (sideButtons.length ? sideWidth : 0);
      const preferRight = anchor.anchorX + clusterWidth * 0.5 + 8 <= this.width;
      const sideOnRight = preferRight || anchor.anchorX - clusterWidth * 0.5 - 8 < 0;
      const primaryXRaw = anchor.anchorX - primarySize * 0.5;
      const primaryYRaw = anchor.anchorY - hudLift - primarySize * 0.5;
      const minPrimaryX = sideOnRight ? 8 : sideWidth + gap + 8;
      const maxPrimaryX = sideOnRight ? this.width - clusterWidth - 8 : this.width - primarySize - 8;
      const primaryX = Math.max(minPrimaryX, Math.min(primaryXRaw, Math.max(minPrimaryX, maxPrimaryX)));
      const primaryY = Math.max(topLimit + 38, Math.min(primaryYRaw, bottomLimit - primarySize - 8));
      const sideX = sideOnRight ? primaryX + primarySize + gap : primaryX - sideWidth - gap;
      const sideYRaw = primaryY + (primarySize - sideTotalHeight) / 2;
      const sideY = Math.max(topLimit + 8, Math.min(sideYRaw, bottomLimit - sideTotalHeight - 8));
      const title = detail.text?.name || selectedSite.cityName || selectedSite.naturalName || '城市';
      const renameWidth = renameButton ? 38 : 0;
      const titleWidth = this.measureTextWidth(title, { size: 12, bold: true });
      const badgeWidth = Math.min(190, Math.max(98, titleWidth + renameWidth + 30));
      const badgeX = Math.max(8, Math.min(anchor.anchorX - badgeWidth / 2, this.width - badgeWidth - 8));
      const titleGap = Math.max(9, primarySize * 0.22);
      const badgeYRaw = Math.min(anchor.titleY - 25 - hudLift, Math.min(primaryY, sideY) - 24 - titleGap);
      const badgeY = Math.max(topLimit + 6, Math.min(badgeYRaw, bottomLimit - 30));

      this.drawPanel(badgeX, badgeY, badgeWidth, 24, {
        fill: 'rgba(18, 16, 13, 0.78)',
        stroke: 'rgba(116, 211, 160, 0.42)',
        radius: 6,
        inset: 'rgba(255, 231, 184, 0.06)',
      });
      const titleMaxWidth = badgeWidth - renameWidth - 22;
      this.drawText(this.truncateText(title, titleMaxWidth, { size: 12, bold: true }), badgeX + 12 + titleMaxWidth / 2, badgeY + 12, {
        size: 12,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });
      if (renameButton) {
        const renameX = badgeX + badgeWidth - renameWidth - 7;
        const renameY = badgeY + 4;
        this.drawText('改名', renameX + renameWidth / 2, badgeY + 12, {
          size: 10,
          color: renameButton.disabled || !renameButton.action ? '#8d8f99' : '#74d3a0',
          baseline: 'middle',
          align: 'center',
        });
        this.addHitTarget({ x: renameX - 4, y: renameY - 4, width: renameWidth + 8, height: 24 }, this.getWorldCityCommandButtonAction(renameButton));
      }

      this.drawCircle(anchor.anchorX, anchor.anchorY - hudLift, Math.max(12, primarySize * 0.32), {
        fill: 'rgba(116, 211, 160, 0.08)',
        stroke: 'rgba(116, 211, 160, 0.42)',
        width: 2,
      });
      this.drawWorldCityCommandPrimaryButton(primary, primaryX, primaryY, primarySize);
      this.addHitTarget({ x: primaryX, y: primaryY, width: primarySize, height: primarySize }, this.getWorldCityCommandButtonAction(primary));

      sideButtons.forEach((button, index) => {
        const buttonY = sideY + index * (sideHeight + sideGap);
        this.drawWorldCityCommandSideButton(button, sideX, buttonY, sideWidth, sideHeight);
        this.addHitTarget({ x: sideX, y: buttonY, width: sideWidth, height: sideHeight }, this.getWorldCityCommandButtonAction(button));
      });
    }


  }

  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapCanvasRenderer;
  else global.WorldMapCanvasRenderer = WorldMapCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
