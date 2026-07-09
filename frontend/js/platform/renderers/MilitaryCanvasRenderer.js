(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const ModalPlate = (() => {
    if (global.ModalPlateRenderer) return global.ModalPlateRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./ModalPlateRenderer');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class MilitaryCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get presenter() {
      return this.host?.presenter;
    }

    addHitTarget(...args) { const surface = this.drawingSurface; return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args); }
    createGradient(...args) { const surface = this.drawingSurface; return surface && typeof surface.createGradient === 'function' ? surface.createGradient(...args) : this.host?.createGradient?.(...args); }
    drawAsset(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawAsset === 'function' ? surface.drawAsset(...args) : this.host?.drawAsset?.(...args); }
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawFamousPortrait(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawFamousPortrait === 'function' ? surface.drawFamousPortrait(...args) : this.host?.drawFamousPortrait?.(...args); }
    drawLine(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawLine === 'function' ? surface.drawLine(...args) : this.host?.drawLine?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawProgressBar(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawProgressBar === 'function' ? surface.drawProgressBar(...args) : this.host?.drawProgressBar?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    drawTextLines(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawTextLines === 'function' ? surface.drawTextLines(...args) : this.host?.drawTextLines?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    renderMilitaryWorldView(...args) { const surface = this.drawingSurface; return surface && typeof surface.renderMilitaryWorldView === 'function' ? surface.renderMilitaryWorldView(...args) : this.host?.renderMilitaryWorldView?.(...args); }
    renderSectionHeader(...args) { const surface = this.drawingSurface; return surface && typeof surface.renderSectionHeader === 'function' ? surface.renderSectionHeader(...args) : this.host?.renderSectionHeader?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }
    wrapTextLimit(...args) { const surface = this.drawingSurface; return surface && typeof surface.wrapTextLimit === 'function' ? surface.wrapTextLimit(...args) : this.host?.wrapTextLimit?.(...args); }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    renderMilitarySubTabs(nav = {}, x, y, width) {
      const labels = {
        army: this.t('military.tab.army', {}),
        world: this.t('military.tab.world', {}),
        veteranCamp: this.t('military.tab.veteranCamp', {}),
      };
      const tabs = Array.isArray(nav.views) ? nav.views : [];
      if (!tabs.length) return y + 46;
      const tabRects = ModalPlate.drawModalTabStrip(this, x, y, width, tabs.map((tab) => ({
        ...tab,
        label: labels[tab.id] || tab.id,
      })), { height: 34 });
      tabRects.forEach((rect, index) => {
        const tab = tabs[index] || {};
        this.addHitTarget(rect, {
          type: 'switchMilitaryView',
          view: tab.id,
          disabled: tab.disabled,
        });
      });
      return y + 46;
    }

    renderMilitaryArmyView(view = {}, x, y, width, height) {
      const formations = Array.isArray(view.formations) ? view.formations : [];
      const hasFormationSpace = height >= 250;
      const formationHeight = hasFormationSpace ? Math.min(158, Math.max(132, Math.floor(height * 0.43))) : 0;
      const cardHeight = Math.min(150, Math.max(104, height - formationHeight - (hasFormationSpace ? 30 : 18)));
      ModalPlate.drawModalCard(this, x, y, width, cardHeight, { tone: 'default', radius: 10 });
      this.drawAsset('assets/art/icon-soldier-cutout.webp', x + 16, y + 24, 58, 72);
      const textX = x + 88;
      this.drawText(this.t('military.army.status', {}), textX, y + 16, { size: 14, bold: true, color: '#f6e8c8' });
      this.drawText(this.t('military.army.soldiers', { count: view.text?.soldierCount || '0/0' }), textX, y + 42, { size: 18, bold: true, color: '#74d3a0' });
      this.drawText(this.t('military.army.defense', { defense: view.text?.militaryDefense ?? 0 }), textX, y + 68, { size: 12, color: '#cbbd96' });
      this.drawText(this.t(
        'military.army.available',
        { available: view.text?.availableSoldierCount ?? 0, onMission: view.text?.soldiersOnMission ?? 0 }), textX, y + 88, {
        size: 12,
        color: '#aeb0b8',
      });
      const progressY = y + cardHeight - 38;
      this.drawText(view.text?.soldierTrainingText || this.t('military.training.waitBarracks', {}), x + 16, progressY - 18, { size: 12, color: '#cbbd96' });
      this.drawProgressBar(x + 16, progressY, width - 32, 12, parseFloat(view.training?.progressWidth || '0'));
      if (!hasFormationSpace) return;
      this.renderArmyFormationStrip(
        formations,
        x,
        y + cardHeight + 12,
        width,
        formationHeight,
        view.formationMeta || {},
      );
    }

    renderVeteranCampView(view = {}, x, y, width, height) {
      ModalPlate.drawModalCard(this, x, y, width, height, { tone: 'default', radius: 10 });
      const pad = 16;
      const textX = x + pad;
      this.drawTextLines(
        this.wrapTextLimit(this.t('military.veteranCamp.desc', {}), width - pad * 2, 3, { size: 11 }),
        textX,
        y + 16,
        { size: 11, color: '#9a9ba3', lineHeight: 16 },
      );
      this.drawText(
        this.t('military.veteranCamp.levelLine', {
          level: view.level ?? 0,
          capacity: view.capacity ?? 0,
          hours: view.retentionHours ?? 0,
        }),
        textX,
        y + 58,
        { size: 13, bold: true, color: '#f6e8c8' },
      );
      this.drawText(
        this.t('military.veteranCamp.parked', { count: view.parkedTotal ?? 0, capacity: view.capacity ?? 0 }),
        textX,
        y + 84,
        { size: 16, bold: true, color: view.hasParked ? '#74d3a0' : '#8b8f98' },
      );
      const hint = view.hasParked
        ? (view.hasDrainCountdown ? this.t('military.veteranCamp.drainCountdown', { time: view.nextDrainText || '0s' }) : '')
        : this.t('military.veteranCamp.emptyHint', {});
      if (hint) this.drawText(hint, textX, y + 108, { size: 11, color: view.hasParked ? 'rgba(255, 170, 120, 0.85)' : '#8b8f98' });

      const btnHeight = 32;
      const btnY = y + height - btnHeight - 14;
      const gap = 12;
      const btnWidth = Math.max(96, Math.floor((width - pad * 2 - gap) / 2));
      const cityId = view.cityId || 'capital';

      ModalPlate.drawModalButton(this, textX, btnY, btnWidth, btnHeight, this.t('military.veteranCamp.withdrawAll', {}), {
        size: 12,
        radius: 8,
        variant: view.canWithdraw ? 'primary' : 'secondary',
        disabled: !view.canWithdraw,
      });
      this.addHitTarget(
        { x: textX, y: btnY, width: btnWidth, height: btnHeight },
        { type: 'veteranCampWithdraw', cityId, visualDisabled: !view.canWithdraw },
      );

      const upgradeX = x + width - pad - btnWidth;
      const upgradeLabel = view.nextLevel
        ? this.t('military.veteranCamp.upgradeCost', { cost: view.nextLevel.cost })
        : this.t('military.veteranCamp.maxLevel', {});
      ModalPlate.drawModalButton(this, upgradeX, btnY, btnWidth, btnHeight, upgradeLabel, {
        size: 12,
        radius: 8,
        variant: view.nextLevel ? 'primary' : 'secondary',
        disabled: !view.nextLevel,
      });
      this.addHitTarget(
        { x: upgradeX, y: btnY, width: btnWidth, height: btnHeight },
        { type: 'veteranCampUpgrade', cityId, visualDisabled: !view.nextLevel },
      );
    }

    renderArmyFormationPortrait(person = null, x, y, width, height, options = {}) {
      const radius = options.radius ?? 6;
      if (person) {
        const drawn = this.drawFamousPortrait(person, x, y, Math.min(width, height), {
          frameWidth: width,
          frameHeight: height,
          radius,
          scale: options.scale || 1.35,
          offsetY: options.offsetY ?? 0.16,
          fill: options.fill || 'rgba(23, 23, 20, 0.92)',
          stroke: options.stroke || 'rgba(229, 208, 165, 0.28)',
        });
        if (!drawn) {
          ModalPlate.drawModalCard(this, x, y, width, height, {
            fill: 'rgba(23, 23, 20, 0.92)',
            stroke: 'rgba(229, 208, 165, 0.28)',
            radius,
          });
          this.drawText(String(person.name || this.t('military.formation.leader', {})).slice(0, 1), x + width / 2, y + height / 2, {
            size: Math.max(13, Math.min(20, width * 0.44)),
            bold: true,
            color: '#ffe6b5',
            align: 'center',
            baseline: 'middle',
          });
        }
        return;
      }
      ModalPlate.drawModalCard(this, x, y, width, height, {
        tone: 'muted',
        fill: options.fill || 'rgba(22, 20, 17, 0.58)',
        stroke: options.stroke || 'rgba(255, 226, 177, 0.13)',
        radius,
      });
      this.drawText('+', x + width / 2, y + height / 2 - 1, {
        size: Math.max(12, Math.min(18, width * 0.45)),
        color: 'rgba(255, 230, 181, 0.58)',
        align: 'center',
        baseline: 'middle',
      });
    }

    renderArmyFormationCard(formation = {}, x, y, width, height, index = 0) {
      const members = Array.isArray(formation.members) ? formation.members : [];
      const leader = members[0] || null;
      const active = members.length > 0;
      ModalPlate.drawModalCard(this, x, y, width, height, {
        tone: active ? 'accent' : 'muted',
        fill: active ? 'rgba(20, 20, 18, 0.92)' : 'rgba(18, 18, 16, 0.84)',
        stroke: active ? 'rgba(229, 208, 165, 0.3)' : 'rgba(255, 226, 177, 0.12)',
        radius: 7,
      });
      const title = formation.name || this.t('military.formation.default', { slot: index + 1 });
      this.drawText(this.truncateText(title, width - 16, { size: 12, bold: true }), x + width / 2, y + 9, {
        size: 12,
        bold: true,
        color: '#fff1cf',
        align: 'center',
      });
      const innerPad = 8;
      const leaderSize = Math.min(58, Math.max(34, Math.min(height - 66, width * 0.4)));
      const leaderX = x + innerPad;
      const leaderY = y + 28;
      this.renderArmyFormationPortrait(leader, leaderX, leaderY, leaderSize, leaderSize, { radius: 5, scale: 1.42 });
      if (leader) {
        this.drawText(this.truncateText(leader.name || this.t('military.formation.leader', {}), leaderSize + 10, { size: 9, bold: true }), leaderX + leaderSize / 2, leaderY + leaderSize + 10, {
          size: 9,
          bold: true,
          color: '#ffe6b5',
          align: 'center',
        });
      } else {
        this.drawText(this.t('military.formation.leader', {}), leaderX + leaderSize / 2, leaderY + leaderSize + 10, {
          size: 9,
          color: 'rgba(255, 230, 181, 0.58)',
          align: 'center',
        });
      }
      const smallGap = 3;
      const smallAreaWidth = Math.max(24, width - leaderSize - innerPad * 3);
      const smallSize = Math.max(18, Math.min(32, Math.floor((smallAreaWidth - smallGap) / 2)));
      const smallStartX = x + width - innerPad - smallSize * 2 - smallGap;
      const smallStartY = leaderY + 2;
      [0, 1, 2, 3].forEach((smallIndex) => {
        const col = smallIndex % 2;
        const row = Math.floor(smallIndex / 2);
        this.renderArmyFormationPortrait(
          members[smallIndex + 1] || null,
          smallStartX + col * (smallSize + smallGap),
          smallStartY + row * (smallSize + smallGap),
          smallSize,
          smallSize,
          { radius: 4, scale: 1.32 },
        );
      });
      const countText = `${members.length}/${formation.maxMembers || 5}`;
      this.drawText(countText, x + width - 10, y + height - 24, {
        size: 10,
        bold: true,
        color: active ? '#74d3a0' : '#cbbd96',
        align: 'right',
      });
      this.drawText(active ? this.t('military.formation.edit', {}) : this.t('military.formation.create', {}), x + width / 2, y + height - 24, {
        size: 10,
        color: active ? '#f0b45b' : 'rgba(234, 234, 234, 0.64)',
        align: 'center',
      });
      this.addHitTarget(
        { x, y, width, height },
        { type: 'openArmyFormation', cityId: formation.cityId, slot: formation.slot || index + 1 },
      );
    }

    renderArmyFormationStrip(formations = [], x, y, width, height, meta = {}) {
      this.drawText(this.t('military.formation.title', {}), x + 2, y + 2, { size: 14, bold: true, color: '#ffe6b5' });
      this.drawText(meta.summary || this.t('military.formation.summary', { maxMembers: meta.maxMembers || 5 }), x + 48, y + 4, { size: 10, color: '#cbbd96' });
      const cardGap = 8;
      const cardY = y + 24;
      const cardHeight = Math.max(108, height - 26);
      const cardWidth = Math.floor((width - cardGap * 2) / 3);
      [0, 1, 2].forEach((index) => {
        const cardX = x + index * (cardWidth + cardGap);
        const finalCardWidth = index === 2 ? x + width - cardX : cardWidth;
        this.renderArmyFormationCard(
          formations[index] || {
            slot: index + 1,
            cityId: meta.cityId,
            name: this.t('military.formation.default', { slot: index + 1 }),
            members: [],
            maxMembers: meta.maxMembers || 5,
          },
          cardX,
          cardY,
          finalCardWidth,
          cardHeight,
          index,
        );
      });
    }

    renderMilitary(state = {}, startY = 210, panelHeight = 310, options = {}) {
      if (!this.presenter) return;
      const nav = this.presenter.buildMilitaryNavigationViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      ModalPlate.drawModalCard(this, x, startY, width, panelHeight, { tone: 'default', radius: 10 });
      this.renderSectionHeader(this.t('military.title', {}), x + 14, startY + 14, '🛡️');
      const contentTop = this.renderMilitarySubTabs(nav, x + 12, startY + 42, width - 24);
      const viewY = contentTop;
      const viewHeight = Math.max(120, startY + panelHeight - viewY - 12);
      if (nav.activeView === 'world') {
        this.renderMilitaryWorldView(state, x + 12, viewY, width - 24, viewHeight, options);
      } else if (nav.activeView === 'veteranCamp') {
        this.renderVeteranCampView(this.presenter.buildVeteranCampViewState(state), x + 12, viewY, width - 24, viewHeight);
      } else {
        this.renderMilitaryArmyView(this.presenter.buildMilitaryViewState(state), x + 12, viewY, width - 24, viewHeight);
      }
    }

  }

  global.MilitaryCanvasRenderer = MilitaryCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = MilitaryCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
