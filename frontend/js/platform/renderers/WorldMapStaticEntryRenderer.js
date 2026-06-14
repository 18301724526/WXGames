(function (global) {
  class WorldMapStaticEntryRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host && prop in host) {
            const hostValue = host[prop];
            return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value, receiver);
          const host = target.host;
          if (host) {
            host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }

    getTileMapAssetManifest() {
      return this.host?.constructor?.getTileMapAssetManifest?.() || {};
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
      if (!image || !metrics || typeof this.ctx?.drawImage !== 'function') return false;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(image, metrics.x, metrics.y, metrics.width, metrics.height, x, y, width, height);
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    drawWorldTerrainFeature(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96) {
      const manifest = this.getTileMapAssetManifest();
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
      if (!image || typeof this.ctx?.drawImage !== 'function') return false;
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
          inputSurface: 'worldMap',
        });
      }
      return true;
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
  }

  global.WorldMapStaticEntryRenderer = WorldMapStaticEntryRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapStaticEntryRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
