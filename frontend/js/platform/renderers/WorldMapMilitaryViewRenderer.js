(function (global) {
  class WorldMapMilitaryViewRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get presenter() {
      return this.host?.presenter;
    }

    callDrawingSurface(method, args = []) {
      const surface = this.drawingSurface;
      if (surface && typeof surface[method] === 'function') {
        return surface[method](...args);
      }
      return this.host?.[method]?.(...args);
    }

    addHitTarget(...args) {
      return this.callDrawingSurface('addHitTarget', args);
    }

    drawButton(...args) {
      return this.callDrawingSurface('drawButton', args);
    }

    drawPanel(...args) {
      return this.callDrawingSurface('drawPanel', args);
    }

    drawText(...args) {
      return this.callDrawingSurface('drawText', args);
    }

    drawTextLines(...args) {
      return this.callDrawingSurface('drawTextLines', args);
    }

    wrapTextLimit(...args) {
      return this.callDrawingSurface('wrapTextLimit', args);
    }

    isWorldTileMapWaterAnimated(...args) {
      return this.host?.isWorldTileMapWaterAnimated?.(...args);
    }

    renderWorldTileMap(...args) {
      return this.host?.renderWorldTileMap?.(...args);
    }

    resolveWorldTileMapView(...args) {
      return this.host?.resolveWorldTileMapView?.(...args);
    }

    renderMilitaryWorldView(state = {}, x, y, width, height, options = {}) {
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const skipWorldMapLayer = Boolean(options.skipWorldMapLayer);
      const summary = this.presenter.buildTerritorySummaryViewState(territoryState);
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      this.drawPanel(x, y, width, skipWorldMapLayer && tileMapView?.tiles?.length ? 40 : height, {
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
