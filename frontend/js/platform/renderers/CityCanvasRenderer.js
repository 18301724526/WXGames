(function (global) {
  class CityCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get width() {
      return this.host?.width;
    }

    get height() {
      return this.host?.height;
    }

    get presenter() {
      return this.host?.presenter;
    }

    callDrawingSurface(method, args = []) {
      const explicitSurface = this.drawingSurface;
      if (explicitSurface && typeof explicitSurface[method] === 'function') {
        return explicitSurface[method](...Array.from(args));
      }
      const fallbackSurface = this.host;
      if (fallbackSurface && typeof fallbackSurface[method] === 'function') {
        return fallbackSurface[method](...Array.from(args));
      }
      return undefined;
    }

    addHitTarget(...args) {
      return this.callDrawingSurface('addHitTarget', args);
    }

    createGradient(...args) {
      return this.callDrawingSurface('createGradient', args);
    }

    drawAsset(...args) {
      return this.callDrawingSurface('drawAsset', args);
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

    getLayout(...args) {
      return this.callDrawingSurface('getLayout', args);
    }

    getTopBarBottom(...args) {
      return this.callDrawingSurface('getTopBarBottom', args);
    }

    renderArmyFormationStrip(...args) {
      return this.callDrawingSurface('renderArmyFormationStrip', args);
    }

    renderBuildings(...args) {
      return this.callDrawingSurface('renderBuildings', args);
    }

    renderPopulation(...args) {
      return this.callDrawingSurface('renderPopulation', args);
    }

    truncateText(...args) {
      return this.callDrawingSurface('truncateText', args);
    }

    getActiveCitySummary(state = {}) {
      const cityState = state.cityState || {};
      const cities = Array.isArray(cityState.cities) ? cityState.cities : [];
      const activeCityId = state.activeCityId || cityState.activeCityId || cityState.capitalCityId || 'capital';
      const city = cities.find((item) => item.id === activeCityId) || cities[0] || {};
      const territories = state.territoryState?.territories || [];
      const site = territories.find((item) => item.id === activeCityId) || {};
      return {
        id: activeCityId,
        name: city.name || site.cityName || site.naturalName || (activeCityId === 'capital' ? '首都' : '城市'),
        tag: city.isCapital || activeCityId === 'capital' ? '主城' : '分城',
        level: city.level || site.level || '',
        population: city.population || state.population || {},
        military: city.military || state.military || {},
        terrainLabel: city.planning?.terrainLabel || city.terrainLabel || site.terrainLabel || '平原',
      };
    }

    renderCitySwitcherMenu(state = {}) {
      if (!this.presenter || typeof this.presenter.buildCitySwitcherViewState !== 'function') return;
      const view = this.presenter.buildCitySwitcherViewState(state);
      if (view.hidden) return;

      const options = Array.isArray(view.options) ? view.options : [];
      const layout = this.getLayout();
      const panelWidth = Math.min(260, layout.contentWidth - 44);
      const x = (this.width - panelWidth) / 2;
      const y = 194;
      const itemHeight = 50;
      const visibleCount = Math.min(options.length, 5);
      const panelHeight = Math.max(56, 18 + visibleCount * itemHeight);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeCitySwitcher' });
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(45, 32, 21, 0.98)'],
            [1, 'rgba(23, 18, 13, 0.98)'],
          ],
          'rgba(35, 26, 19, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 10,
        inset: 'rgba(255, 238, 203, 0.12)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      if (!options.length) {
        this.drawText('暂无城市', x + panelWidth / 2, y + 23, {
          size: 13,
          color: '#cbbd96',
          align: 'center',
        });
        return;
      }

      options.slice(0, visibleCount).forEach((city, index) => {
        const itemX = x + 9;
        const itemY = y + 9 + index * itemHeight;
        const itemWidth = panelWidth - 18;
        const active = Boolean(city.isActive);
        this.drawPanel(itemX, itemY, itemWidth, 43, {
          fill: active
            ? 'rgba(126, 81, 39, 0.92)'
            : 'rgba(45, 34, 24, 0.82)',
          stroke: active
            ? 'rgba(240, 180, 91, 0.6)'
            : 'rgba(255, 226, 177, 0.12)',
          radius: 8,
        });
        if (active) {
          this.drawPanel(itemX, itemY, 4, 43, {
            fill: '#f0b45b',
            stroke: '#f0b45b',
            radius: 2,
          });
        }
        this.drawText(city.name || '未命名城市', itemX + 12, itemY + 8, {
          size: 13,
          bold: true,
          color: '#fff1cf',
        });
        this.drawText(city.tag || '', itemX + itemWidth - 12, itemY + 8, {
          size: 11,
          bold: true,
          color: '#f0b45b',
          align: 'right',
        });
        this.drawText(city.metaText || '', itemX + 12, itemY + 26, {
          size: 11,
          color: 'rgba(234, 234, 234, 0.66)',
        });
        this.addHitTarget(
          { x: itemX, y: itemY, width: itemWidth, height: 43 },
          active || !city.id
            ? { type: 'blockCanvasModal' }
            : { type: 'selectCity', cityId: city.id },
        );
      });
    }

    renderCityManagementPanel(state = {}, options = {}) {
      const layout = this.getLayout();
      const dockTop = this.height - 64;
      const top = Math.max(82, this.getTopBarBottom(state, { isMapHome: true }) + 8);
      const panelHeight = Math.max(360, dockTop - top - 10);
      const x = layout.contentX;
      const y = dockTop - panelHeight - 8;
      const width = layout.contentWidth;
      const city = this.getActiveCitySummary(state);
      const activeTab = ['buildings', 'people', 'military'].includes(options.activeCityManagementTab)
        ? options.activeCityManagementTab
        : 'buildings';

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeCityManagement', background: true });
      this.drawPanel(x, y, width, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(49, 40, 30, 0.97)'],
            [1, 'rgba(16, 15, 12, 0.98)'],
          ],
          'rgba(31, 26, 20, 0.97)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 12,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.addHitTarget({ x, y, width, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      this.drawText(this.truncateText(city.name, width - 132, { size: 18, bold: true }), x + 16, y + 14, {
        size: 18,
        bold: true,
        color: '#ffe6b5',
      });
      const meta = `${city.tag}${city.level ? ` · ${city.level}级` : ''} · ${city.terrainLabel}`;
      this.drawText(meta, x + 16, y + 40, { size: 11, color: '#cbbd96' });
      this.drawButton(x + width - closeSize - 10, y + 10, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: x + width - closeSize - 10, y: y + 10, width: closeSize, height: closeSize }, { type: 'closeCityManagement' });

      const tabs = [
        { id: 'buildings', label: '建设' },
        { id: 'people', label: '人才' },
        { id: 'military', label: '军事' },
      ];
      const tabY = y + 64;
      const gap = 6;
      const tabWidth = Math.floor((width - 32 - gap * (tabs.length - 1)) / tabs.length);
      tabs.forEach((tab, index) => {
        const tabX = x + 16 + index * (tabWidth + gap);
        const active = tab.id === activeTab;
        this.drawButton(tabX, tabY, tabWidth, 30, tab.label, { size: 12, bold: active, active, radius: 8 });
        this.addHitTarget({ x: tabX, y: tabY, width: tabWidth, height: 30 }, { type: 'switchCityManagementTab', tab: tab.id });
      });

      const contentTop = tabY + 40;
      const contentHeight = Math.max(180, panelHeight - (contentTop - y) - 12);
      if (activeTab === 'buildings') {
        this.renderBuildings(state, contentTop, contentHeight, {
          ...options,
          offset: options.buildingOffset,
          buildingTransition: options.buildingTransition,
          activeBuildingCategory: options.activeBuildingCategory,
        });
      } else if (activeTab === 'people') {
        this.renderPopulation(state, contentTop);
      } else {
        this.renderCityMilitaryPanel(state, city, x + 12, contentTop, width - 24, contentHeight);
      }
    }

    renderCityMilitaryPanel(state = {}, city = {}, x, y, width, height) {
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(28, 24, 18, 0.76)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.05)',
      });
      const soldiers = Number(city.military?.soldiers ?? state.military?.soldiers ?? 0) || 0;
      const available = Number(state.territoryState?.availableSoldiers ?? soldiers) || 0;
      const compactFormation = height < 232;
      this.drawAsset('assets/art/icon-soldier-cutout.webp', x + 16, y + 18, 38, 38);
      this.drawText('驻军', x + 66, y + 17, { size: 16, bold: true, color: '#ffe6b5' });
      this.drawText(`当前兵力 ${soldiers} · 可调兵力 ${available}`, x + 66, y + 42, { size: 12, color: '#cbbd96' });
      const rows = [
        { label: '行军', note: '从本城发起部队行动', disabled: true },
        { label: '调动', note: '城市之间调配驻军', disabled: true },
        { label: '驻守', note: '设置防守与巡逻队列', disabled: true },
      ];
      const formationSectionHeight = compactFormation
        ? Math.min(80, Math.max(64, Math.floor(height * 0.34)))
        : Math.min(166, Math.max(132, Math.floor(height * 0.48)));
      const formationX = x + 12;
      const formationWidth = width - 24;
      const formationY = Math.max(y + 138, y + height - formationSectionHeight - 10);
      const rowTop = y + 72;
      const rowGap = 6;
      const rowAreaHeight = Math.max(72, formationY - rowTop - 8);
      const rowHeight = Math.max(26, Math.min(38, Math.floor((rowAreaHeight - rowGap * (rows.length - 1)) / rows.length)));
      rows.forEach((row, index) => {
        const rowY = rowTop + index * (rowHeight + rowGap);
        this.drawPanel(x + 12, rowY, width - 24, rowHeight, {
          fill: 'rgba(43, 35, 26, 0.82)',
          stroke: 'rgba(255, 226, 177, 0.12)',
          radius: 8,
        });
        this.drawText(row.label, x + 26, rowY + 7, { size: 13, bold: true, color: '#fff1cf' });
        this.drawText(row.note, x + 26, rowY + rowHeight - 13, { size: 9, color: 'rgba(234, 234, 234, 0.58)' });
        this.drawButton(x + width - 82, rowY + Math.max(4, (rowHeight - 24) / 2), 58, 24, '待开放', { size: 10, radius: 7, disabled: true });
      });

      const formationView = this.presenter?.buildMilitaryViewState?.({
        ...state,
        activeCityId: city.id || state.activeCityId,
        cityState: {
          ...(state.cityState || {}),
          activeCityId: city.id || state.cityState?.activeCityId,
        },
      }) || {};
      if (compactFormation) {
        const compactGap = 8;
        const compactCardY = formationY + 24;
        const compactCardHeight = Math.max(38, y + height - compactCardY - 8);
        const compactCardWidth = Math.floor((formationWidth - compactGap * 2) / 3);
        this.drawText('编队', formationX, formationY + 5, { size: 14, bold: true, color: '#ffe6b5' });
        this.drawText('每队最多 5 名名人', formationX + 44, formationY + 7, { size: 10, color: '#cbbd96' });
        (formationView.formations || [{}, {}, {}]).slice(0, 3).forEach((formation, index) => {
          const cardX = formationX + index * (compactCardWidth + compactGap);
          const cardWidth = index === 2 ? formationX + formationWidth - cardX : compactCardWidth;
          const count = Array.isArray(formation.members) ? formation.members.length : 0;
          this.drawPanel(cardX, compactCardY, cardWidth, compactCardHeight, {
            fill: count ? 'rgba(55, 40, 29, 0.92)' : 'rgba(38, 33, 28, 0.86)',
            stroke: count ? 'rgba(240, 180, 91, 0.34)' : 'rgba(255, 226, 177, 0.14)',
            radius: 7,
          });
          this.drawText(this.truncateText(formation.name || `部队${index + 1}`, cardWidth - 12, { size: 11, bold: true }), cardX + cardWidth / 2, compactCardY + 9, {
            size: 11,
            bold: true,
            color: '#fff1cf',
            align: 'center',
          });
          this.drawText(`${count}/${formation.maxMembers || 5}`, cardX + cardWidth / 2, compactCardY + compactCardHeight - 17, {
            size: 10,
            color: count ? '#74d3a0' : '#cbbd96',
            align: 'center',
          });
          this.addHitTarget(
            { x: cardX, y: compactCardY, width: cardWidth, height: compactCardHeight },
            { type: 'openArmyFormation', cityId: formation.cityId || city.id, slot: formation.slot || index + 1 },
          );
        });
        return;
      }
      this.renderArmyFormationStrip(
        formationView.formations || [],
        formationX,
        formationY,
        formationWidth,
        Math.max(132, y + height - formationY - 8),
        formationView.formationMeta || { cityId: city.id, maxMembers: 5 },
      );
    }

    renderSubcityListPanel(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildCitySwitcherViewState !== 'function') return;
      const view = this.presenter.buildCitySwitcherViewState(state);
      const cities = (Array.isArray(view.options) ? view.options : []).filter((city) => city.id && city.id !== 'capital' && city.tag !== '主城' && city.tag !== '涓诲煄');
      const layout = this.getLayout();
      const panelWidth = Math.min(340, layout.contentWidth - 20);
      const itemHeight = 58;
      const visibleCount = Math.min(Math.max(1, cities.length), 6);
      const panelHeight = Math.max(142, 76 + visibleCount * itemHeight);
      const x = (this.width - panelWidth) / 2;
      const dockTop = this.height - 64;
      const y = Math.max(82, dockTop - panelHeight - 10);
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeSubcityList', background: true });
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(46, 37, 26, 0.98)'],
            [1, 'rgba(20, 17, 13, 0.98)'],
          ],
          'rgba(34, 26, 19, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 12,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });
      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawText('分城管理', x + 16, y + 17, { size: 17, bold: true, color: '#ffe6b5' });
      this.drawText(`${cities.length} 座分城`, x + 16, y + 41, { size: 11, color: '#cbbd96' });
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeSubcityList' });

      if (!cities.length) {
        this.drawText('暂无分城', x + panelWidth / 2, y + 96, {
          size: 14,
          color: '#cbbd96',
          align: 'center',
        });
        return;
      }
      cities.slice(0, visibleCount).forEach((city, index) => {
        const itemX = x + 12;
        const itemY = y + 64 + index * itemHeight;
        const itemWidth = panelWidth - 24;
        const active = Boolean(city.isActive);
        this.drawPanel(itemX, itemY, itemWidth, itemHeight - 8, {
          fill: active ? 'rgba(78, 61, 35, 0.92)' : 'rgba(32, 27, 20, 0.82)',
          stroke: active ? 'rgba(247, 215, 116, 0.5)' : 'rgba(255, 226, 177, 0.12)',
          radius: 9,
          inset: 'rgba(255, 231, 184, 0.05)',
        });
        this.drawAsset('assets/art/world-site-city-cutout.png', itemX + 10, itemY + 10, 30, 30);
        this.drawText(this.truncateText(city.name || '未命名分城', itemWidth - 108, { size: 14, bold: true }), itemX + 50, itemY + 9, {
          size: 14,
          bold: true,
          color: '#fff1cf',
        });
        this.drawText(this.truncateText(city.metaText || '', itemWidth - 108, { size: 10 }), itemX + 50, itemY + 30, {
          size: 10,
          color: 'rgba(234, 234, 234, 0.62)',
        });
        this.drawButton(itemX + itemWidth - 72, itemY + 11, 60, 28, active ? '当前' : '跳转', {
          size: 12,
          bold: !active,
          active: !active,
          radius: 8,
          disabled: active,
        });
        this.addHitTarget(
          { x: itemX, y: itemY, width: itemWidth, height: itemHeight - 8 },
          active ? { type: 'blockCanvasModal' } : { type: 'jumpToSubcity', cityId: city.id },
        );
      });
    }
  }

  global.CityCanvasRenderer = CityCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CityCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
