(function (global) {
  class WorldMapMilitaryViewRenderer {
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
      this.drawText(summary.text?.polityName || 'Unnamed polity', x + 14, y + 13, { size: 14, bold: true, color: '#f0b45b' });
      this.drawText(summary.text?.territoryCount || '0/0 controlled', x + width - 14, y + 15, {
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
        this.drawButton(mapX + mapW - resetW - 8, mapY + 8, resetW, 28, 'Home', { size: 11, radius: 8 });
        this.addHitTarget({ x: mapX + mapW - resetW - 8, y: mapY + 8, width: resetW, height: 28 }, { type: 'resetWorldPan' });
        this.drawText(`${tileMapView.tiles.length} tiles`, mapX + 12, mapY + mapH - 14, {
          size: 10,
          color: 'rgba(246, 232, 200, 0.68)',
        });
        return;
      }

      this.drawTextLines(this.wrapTextLimit('Send scouts to reveal the outer world here.', width - 40, 3, { size: 13 }), x + 20, y + 70, {
        size: 13,
        color: '#cbbd96',
        lineHeight: 18,
      });
    }
  }

  global.WorldMapMilitaryViewRenderer = WorldMapMilitaryViewRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapMilitaryViewRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
