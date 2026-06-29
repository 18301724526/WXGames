(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const sharedUIStatePresenter = (() => {
    if (global.UIStatePresenter) return global.UIStatePresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../state/UIStatePresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class BuildingCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get ctx() {
      return this.host?.ctx;
    }

    get presenter() {
      return this.host?.presenter;
    }

    t(key, params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    addHitTarget(...args) { const surface = this.drawingSurface; return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args); }
    createGradient(...args) { const surface = this.drawingSurface; return surface && typeof surface.createGradient === 'function' ? surface.createGradient(...args) : this.host?.createGradient?.(...args); }
    drawAsset(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawAsset === 'function' ? surface.drawAsset(...args) : this.host?.drawAsset?.(...args); }
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawIconCard(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawIconCard === 'function' ? surface.drawIconCard(...args) : this.host?.drawIconCard?.(...args); }
    drawLine(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawLine === 'function' ? surface.drawLine(...args) : this.host?.drawLine?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    getTransitionFrame(...args) { const surface = this.drawingSurface; return surface && typeof surface.getTransitionFrame === 'function' ? surface.getTransitionFrame(...args) : this.host?.getTransitionFrame?.(...args); }
    measureTextWidth(...args) { const surface = this.drawingSurface; return surface && typeof surface.measureTextWidth === 'function' ? surface.measureTextWidth(...args) : this.host?.measureTextWidth?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }
    withSlideClip(...args) { const surface = this.drawingSurface; return surface && typeof surface.withSlideClip === 'function' ? surface.withSlideClip(...args) : this.host?.withSlideClip?.(...args); }
    withSuppressedHitTargets(...args) { const surface = this.drawingSurface; return surface && typeof surface.withSuppressedHitTargets === 'function' ? surface.withSuppressedHitTargets(...args) : this.host?.withSuppressedHitTargets?.(...args); }

    getBuildingPresenter() {
      return [this.presenter, this.host?.presenter, sharedUIStatePresenter]
        .find((presenter) => presenter && typeof presenter.buildBuildingViewState === 'function')
        || null;
    }

    buildBuildingViewState(state = {}, tutorial = {}, buildingConfig = {}, options = {}) {
      const presenter = this.getBuildingPresenter();
      if (presenter) {
        return presenter.buildBuildingViewState(state, tutorial, buildingConfig, options);
      }
      return {
        ids: [],
        filteredIds: [],
        isEmpty: true,
        emptyText: this.t('building.empty.all', {}),
        activeCategory: options.activeCategory || 'all',
        categoryTabs: [{ id: 'all', label: this.t('building.category.all', {}), count: 0, active: true }],
        cards: [],
        structureSignature: '[]',
      };
    }

    renderBuildings(state = {}, startY = 210, panelHeight = 310, options = {}) {
      const view = this.buildBuildingViewState(state, state.tutorial || {}, state.buildingDefinitions || {}, {
        activeCategory: options.activeBuildingCategory || 'all',
      });
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const panelBottom = startY + panelHeight;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: this.createGradient(
          x, startY, x + width, panelBottom,
          [
            [0, 'rgba(54, 40, 28, 0.94)'],
            [1, 'rgba(24, 19, 14, 0.94)'],
          ],
          'rgba(37, 29, 21, 0.92)',
        ),
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.drawIconCard(x + 14, startY + 14, 38, 38, 'assets/art/building-house-cutout.png');
      this.drawText(this.t('building.panel.title', {}), x + 62, startY + 17, { size: 15, bold: true, color: '#ffe6b5' });
      this.drawText(this.t('building.panel.subtitle', {}), x + 62, startY + 38, { size: 11, color: 'rgba(234, 234, 234, 0.58)' });
      this.drawLine(x + 16, startY + 60, x + width - 16, startY + 60, { color: 'rgba(255, 226, 177, 0.18)', width: 1 });
      const categoryTabs = Array.isArray(view.categoryTabs) ? view.categoryTabs : [];
      const categoryRowHeight = categoryTabs.length > 1 ? 32 : 0;
      if (categoryRowHeight) {
        this.drawBuildingCategoryTabs(categoryTabs, x + 14, startY + 68, width - 28);
      }
      if (view.isEmpty) {
        this.drawText(view.emptyText, x + width / 2, startY + 104 + categoryRowHeight, { color: '#cbbd96', size: 13, align: 'center' });
        return;
      }
      const rowHeight = 174;
      const rowGap = 8;
      const firstRowY = startY + 76 + categoryRowHeight;
      let visibleCount = Math.max(1, Math.floor((panelBottom - firstRowY - 8) / (rowHeight + rowGap)));
      let offset = Math.max(0, Number(options.offset) || 0);
      let maxOffset = Math.max(0, view.cards.length - visibleCount);
      if (view.cards.length > visibleCount || offset > 0) {
        visibleCount = Math.max(1, Math.floor((panelBottom - firstRowY - 42) / (rowHeight + rowGap)));
        maxOffset = Math.max(0, view.cards.length - visibleCount);
      }
      const pageCount = Math.max(1, Math.ceil(view.cards.length / visibleCount));
      const pageIndex = Math.min(Math.max(0, offset), pageCount - 1);
      offset = pageIndex * visibleCount;
      const visibleCards = view.cards.slice(offset, offset + visibleCount);
      const pendingAction = options.pendingBuildingAction || null;
      const drawCards = (cards, cardOffset = offset) => {
        cards.forEach((card, index) => {
          const y = firstRowY + index * (rowHeight + rowGap);
          const actionType = card.button.action === 'upgrade' ? 'upgrade' : 'build';
          const pendingMatches = Boolean(pendingAction
            && pendingAction.buildingId === card.id
            && pendingAction.action === actionType);
          const pendingActive = Boolean(pendingAction && pendingAction.buildingId);
          const isActionDisabled = Boolean(card.button.disabled || pendingActive);
          const buttonLabel = pendingMatches
            ? (actionType === 'upgrade'
              ? this.t('building.action.upgrading', {})
              : this.t('building.action.building', {}))
            : card.button.label;
          const isMuted = Boolean(card.isMuted || card.button.disabled);
          this.drawPanel(x + 10, y, width - 20, rowHeight, {
            fill: isMuted
              ? 'rgba(35, 31, 27, 0.78)'
              : this.createGradient(
                x + 10, y, x + width - 10, y + rowHeight,
                [
                  [0, 'rgba(79, 57, 38, 0.88)'],
                  [1, 'rgba(28, 22, 16, 0.86)'],
                ],
                'rgba(48, 36, 26, 0.86)',
              ),
            stroke: isMuted ? 'rgba(255, 226, 177, 0.1)' : 'rgba(255, 226, 177, 0.16)',
            radius: 8,
            inset: 'rgba(255, 231, 184, 0.07)',
          });
          if (card.art) this.drawAsset(card.art, x + 20, y + 14, 46, 46, isMuted ? 0.62 : 1);
          else this.drawText(card.icon || '', x + 43, y + 37, { size: 24, align: 'center', baseline: 'middle' });

          const textX = x + 76;
          const actionWidth = Math.min(128, Math.max(104, width - 238));
          const buttonX = x + width - actionWidth - 22;
          const textWidth = Math.max(112, buttonX - textX - 12);
          this.drawText(card.name, textX, y + 10, { size: 13, bold: true, color: '#fff1cf' });
          this.drawText(card.metaText || card.levelText, textX, y + 29, { size: 11, color: 'rgba(234, 234, 234, 0.62)' });

          const noneText = this.t('building.effect.none', {});
          this.drawBuildingInfoLine(card.currentEffectText || this.t('building.effect.current', { effect: noneText }), textX, y + 58, textWidth, { tone: 'current' });
          this.drawBuildingInfoLine(card.nextEffectText || this.t('building.effect.next', { label: this.t('building.effect.nextLevel', {}), effect: noneText }), textX, y + 77, x + width - 98, { tone: 'next' });
          this.drawBuildingInfoLine(card.maintenanceText || this.t('building.maintenance.none', {}), textX, y + 96, x + width - 98, { tone: 'maintenance' });
          this.drawBuildingInfoLine(card.cityImpactText || this.t('building.cityImpact', { pressure: this.t('building.habitability.stable', {}) }), textX, y + 115, x + width - 98, { tone: 'impact' });

          this.drawBuildingCostChips(card.cost, buttonX, y + 9, actionWidth, 44, {
            muted: isMuted,
            resources: state.resources || {},
          });
          this.drawText(card.costTitle || this.t('building.cost.upgrade', {}), buttonX, y + 58, {
            size: 10,
            bold: true,
            color: 'rgba(255, 226, 177, 0.68)',
          });
          this.drawBuildingActionButton(buttonX, y + rowHeight - 36, actionWidth, 26, buttonLabel, card.cost, { disabled: isActionDisabled });
          this.addHitTarget(
            { x: buttonX, y: y + rowHeight - 36, width: actionWidth, height: 26 },
            { type: card.button.action === 'upgrade' ? 'upgradeBuilding' : 'buildBuilding', buildingId: card.id, disabled: isActionDisabled },
          );
        });
      };
      const cardsBottom = firstRowY + visibleCount * (rowHeight + rowGap) - rowGap;
      const transition = this.getTransitionFrame(options.buildingTransition);
      if (transition && Number(options.buildingTransition?.toOffset) === pageIndex) {
        const fromPage = Math.min(Math.max(0, Number(options.buildingTransition.fromOffset) || 0), pageCount - 1);
        const fromOffset = fromPage * visibleCount;
        const oldCards = view.cards.slice(fromOffset, fromOffset + visibleCount);
        const travel = width + 24;
        this.withSlideClip(x, firstRowY - 4, width, Math.max(rowHeight, cardsBottom - firstRowY + 8), -transition.direction * travel * transition.eased, () => {
          this.withSuppressedHitTargets(() => drawCards(oldCards, fromOffset));
        });
        this.withSlideClip(x, firstRowY - 4, width, Math.max(rowHeight, cardsBottom - firstRowY + 8), transition.direction * travel * (1 - transition.eased), () => {
          drawCards(visibleCards, offset);
        });
      } else {
        drawCards(visibleCards, offset);
      }
      if (view.cards.length > visibleCount) {
        const pagerY = panelBottom - 32;
        const buttonWidth = 68;
        const gap = 8;
        const prevX = x + width / 2 - buttonWidth - gap - 42;
        const nextX = x + width / 2 + 42 + gap;
        const canPrev = pageIndex > 0;
        const canNext = pageIndex < pageCount - 1;
        const currentPage = pageIndex + 1;
        this.drawButton(prevX, pagerY, buttonWidth, 24, this.t('common.previousPage', {}), { disabled: !canPrev, size: 11, radius: 7 });
        this.drawText(`${currentPage}/${pageCount}`, x + width / 2, pagerY + 12, {
          size: 10,
          color: 'rgba(234, 234, 234, 0.62)',
          baseline: 'middle',
          align: 'center',
        });
        this.drawButton(nextX, pagerY, buttonWidth, 24, this.t('common.nextPage', {}), { disabled: !canNext, size: 11, radius: 7 });
        this.addHitTarget({ x: prevX, y: pagerY, width: buttonWidth, height: 24 }, { type: 'scrollBuildings', delta: -1, disabled: !canPrev });
        this.addHitTarget({ x: nextX, y: pagerY, width: buttonWidth, height: 24 }, { type: 'scrollBuildings', delta: 1, disabled: !canNext });
      }
    }

    drawBuildingCategoryTabs(tabs = [], x, y, width) {
      if (!this.ctx || !Array.isArray(tabs) || tabs.length <= 1) return;
      const gap = 5;
      const height = 26;
      const items = tabs.filter((tab) => tab && tab.id && tab.count > 0);
      if (items.length <= 1) return;
      const rawWidths = items.map((tab) => {
        const label = String(tab.label || tab.id);
        return Math.max(42, this.measureTextWidth(label, { size: 11, bold: Boolean(tab.active) }) + 22);
      });
      const totalGap = gap * Math.max(0, items.length - 1);
      const rawTotal = rawWidths.reduce((sum, value) => sum + value, 0) + totalGap;
      const scale = rawTotal > width ? Math.max(0.72, (width - totalGap) / Math.max(1, rawTotal - totalGap)) : 1;
      let cursorX = x;
      items.forEach((tab, index) => {
        const remainingItems = items.length - index - 1;
        const remainingGap = remainingItems * gap;
        const tabWidth = Math.max(36, Math.floor(rawWidths[index] * scale));
        const actualWidth = Math.max(36, Math.min(tabWidth, x + width - cursorX - remainingGap));
        const active = Boolean(tab.active);
        this.drawButton(cursorX, y, actualWidth, height, this.truncateText(tab.label || tab.id, Math.max(18, actualWidth - 12), {
          size: 11,
          bold: active,
        }), {
          active,
          size: 11,
          bold: active,
          radius: 13,
        });
        this.addHitTarget(
          { x: cursorX, y, width: actualWidth, height },
          { type: 'selectBuildingCategory', category: tab.id, disabled: active },
        );
        cursorX += actualWidth + gap;
      });
    }

    drawBuildingInfoLine(text, x, y, width, options = {}) {
      const palette = {
        current: '#f6e8c8',
        next: '#d5ffe8',
        maintenance: '#cbbd96',
        impact: '#f1c27d',
      };
      const content = this.truncateText(text || '', width, { size: 10, bold: options.tone === 'next' });
      this.drawText(content, x, y, {
        size: 10,
        bold: options.tone === 'next',
        color: palette[options.tone] || '#cbbd96',
      });
    }

    drawBuildingPlanningBadges(badges = [], x, y, width, options = {}) {
      const items = Array.isArray(badges) ? badges.slice(0, 3) : [];
      if (!items.length) return;
      const gap = 4;
      const rowGap = 3;
      const height = 17;
      const maxRows = 2;
      let cursorX = x;
      let cursorY = y;
      let row = 0;
      const palette = {
        maintenance: {
          fill: 'rgba(44, 62, 80, 0.52)',
          stroke: 'rgba(129, 178, 154, 0.24)',
          color: '#b7d4c2',
        },
        pressure: {
          fill: 'rgba(88, 58, 34, 0.52)',
          stroke: 'rgba(240, 180, 91, 0.26)',
          color: '#f1c27d',
        },
        scale: {
          fill: 'rgba(48, 68, 48, 0.5)',
          stroke: 'rgba(116, 211, 160, 0.24)',
          color: '#9ddfb5',
        },
      };
      items.forEach((badge) => {
        const style = palette[badge.type] || palette.maintenance;
        const rawLabel = String(badge.label || '');
        if (!rawLabel) return;
        let available = x + width - cursorX;
        let label = this.truncateText(rawLabel, Math.min(82, available - 12), { size: 9, bold: true });
        let badgeWidth = Math.min(88, Math.max(38, this.measureTextWidth(label, { size: 9, bold: true }) + 12));
        if (badgeWidth > available && row < maxRows - 1) {
          row += 1;
          cursorX = x;
          cursorY += height + rowGap;
          available = width;
          label = this.truncateText(rawLabel, Math.min(82, available - 12), { size: 9, bold: true });
          badgeWidth = Math.min(88, Math.max(38, this.measureTextWidth(label, { size: 9, bold: true }) + 12));
        }
        if (available < 34) return;
        this.drawPanel(cursorX, cursorY, badgeWidth, height, {
          fill: options.muted ? 'rgba(45, 42, 38, 0.46)' : style.fill,
          stroke: options.muted ? 'rgba(255, 226, 177, 0.08)' : style.stroke,
          radius: 6,
        });
        this.drawText(label, cursorX + badgeWidth / 2, cursorY + height / 2, {
          size: 9,
          bold: true,
          color: options.muted ? '#8d8f99' : style.color,
          align: 'center',
          baseline: 'middle',
        });
        cursorX += badgeWidth + gap;
      });
    }

    resourceShortName(resource) {
      const labelKeys = {
        food: 'resource.food',
        wood: 'resource.wood',
        iron: 'resource.iron',
        knowledge: 'resource.knowledge',
        stone: 'resource.stone',
        metal: 'resource.metal',
      };
      return labelKeys[resource] ? this.t(labelKeys[resource]) : resource;
    }

    resourceIconPath(resource) {
      return {
        food: 'assets/art/icon-food-cutout.webp',
        wood: 'assets/art/icon-wood-cutout.webp',
        iron: 'assets/art/icon-iron-cutout.webp',
        knowledge: 'assets/art/icon-knowledge-cutout.webp',
        stone: 'assets/art/icon-stone-cutout.webp',
        metal: 'assets/art/icon-iron-cutout.webp',
        soldier: 'assets/art/icon-soldier-cutout.webp',
      }[resource] || '';
    }

    buildingCostResourceAliases(resource) {
      return resource === 'iron' ? ['iron', 'metal'] : [resource];
    }

    formatBuildingCostAmount(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return String(value ?? 0);
      const sign = number < 0 ? '-' : '';
      const abs = Math.abs(number);
      if (abs < 1000) return String(Math.floor(number));
      const units = [
        { value: 1_000_000_000_000, suffix: 'T' },
        { value: 1_000_000_000, suffix: 'G' },
        { value: 1_000_000, suffix: 'M' },
        { value: 1_000, suffix: 'k' },
      ];
      const unit = units.find((item) => abs >= item.value) || units[units.length - 1];
      const scaled = Math.floor((abs / unit.value) * 10) / 10;
      return `${sign}${String(scaled.toFixed(1)).replace(/\.0$/, '')}${unit.suffix}`;
    }

    getBuildingCostSlot(cost = {}, resource) {
      const aliases = this.buildingCostResourceAliases(resource);
      const parts = Array.isArray(cost?.parts) ? cost.parts : [];
      const matches = parts.filter((part) => aliases.includes(part?.resource));
      if (!matches.length) {
        return { resource, value: 0, text: '0', present: false };
      }
      if (matches.length === 1) {
        const match = matches[0];
        const value = Number(match.value) || 0;
        return {
          resource,
          value,
          text: String(match.text ?? this.formatBuildingCostAmount(value)),
          present: true,
        };
      }
      const total = matches.reduce((sum, part) => sum + (Number(part.value) || 0), 0);
      return {
        resource,
        value: total,
        text: this.formatBuildingCostAmount(total),
        present: total > 0,
      };
    }

    getOwnedBuildingResource(resources = {}, resource) {
      const aliases = this.buildingCostResourceAliases(resource);
      const key = aliases.find((alias) => resources?.[alias] !== undefined);
      return Number(key ? resources[key] : 0) || 0;
    }

    drawBuildingActionButton(x, y, width, height, label, cost = {}, options = {}) {
      const knowledge = this.getBuildingCostSlot(cost, 'knowledge');
      if (cost?.isMax || !knowledge.present || knowledge.value <= 0) {
        this.drawButton(x, y, width, height, label, { disabled: options.disabled, size: 12, radius: 8 });
        return;
      }
      this.drawPanel(x, y, width, height, {
        fill: options.disabled ? 'rgba(60, 52, 46, 0.72)' : 'rgba(50, 35, 22, 0.94)',
        stroke: 'rgba(240, 180, 91, 0.32)',
        radius: 8,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      const amountText = this.truncateText(String(knowledge.text), Math.max(20, width * 0.32), { size: 10, bold: true });
      const amountWidth = this.measureTextWidth(amountText, { size: 10, bold: true });
      const iconSize = 13;
      const gap = 4;
      const labelMaxWidth = Math.max(28, width - amountWidth - iconSize - gap * 2 - 12);
      const labelText = this.truncateText(label, labelMaxWidth, { size: 11, bold: true });
      const labelWidth = this.measureTextWidth(labelText, { size: 11, bold: true });
      const groupWidth = labelWidth + gap + iconSize + 2 + amountWidth;
      const startX = x + Math.max(7, (width - groupWidth) / 2);
      const centerY = y + height / 2;
      const textColor = options.disabled ? '#8d8f99' : '#f6e8c8';
      this.drawText(labelText, startX, centerY, {
        color: textColor,
        size: 11,
        bold: true,
        baseline: 'middle',
      });
      const iconX = startX + labelWidth + gap;
      const iconY = y + (height - iconSize) / 2;
      if (!this.drawAsset(this.resourceIconPath('knowledge'), iconX, iconY, iconSize, iconSize, options.disabled ? 0.52 : 1)) {
        this.drawText('\u77e5', iconX + iconSize / 2, centerY, {
          color: textColor,
          size: 9,
          bold: true,
          align: 'center',
          baseline: 'middle',
        });
      }
      this.drawText(amountText, iconX + iconSize + 2, centerY, {
        color: textColor,
        size: 10,
        bold: true,
        baseline: 'middle',
      });
    }

    drawBuildingCostChips(cost = {}, x, y, width, height, options = {}) {
      if (cost?.isMax) {
        const text = cost?.text || this.t('building.action.maxLevel', {});
        const fill = cost?.isMax ? 'rgba(60, 52, 46, 0.48)' : 'rgba(116, 211, 160, 0.12)';
        const stroke = cost?.isMax ? 'rgba(255, 226, 177, 0.1)' : 'rgba(116, 211, 160, 0.26)';
        this.drawPanel(x, y + 7, width, 24, { fill, stroke, radius: 7 });
        this.drawText(this.truncateText(text, width - 14, { size: 10, bold: true }), x + width / 2, y + 19, {
          size: 10,
          bold: true,
          color: cost?.isMax ? '#a0a0a0' : '#74d3a0',
          align: 'center',
          baseline: 'middle',
        });
        return;
      }

      const gap = 4;
      const chipHeight = 18;
      const chipColumns = 2;
      const chipWidth = Math.floor((width - gap * (chipColumns - 1)) / chipColumns);
      ['wood', 'iron', 'stone', 'food'].forEach((resource, index) => {
        const part = this.getBuildingCostSlot(cost, resource);
        const col = index % chipColumns;
        const row = Math.floor(index / chipColumns);
        const chipX = x + col * (chipWidth + gap);
        const chipY = y + row * (chipHeight + gap);
        const required = Number(part.value) || 0;
        const owned = this.getOwnedBuildingResource(options.resources || {}, resource);
        const insufficient = part.present && required > 0 && owned < required;
        const fill = insufficient
          ? 'rgba(116, 47, 39, 0.58)'
          : (part.present ? 'rgba(40, 48, 34, 0.62)' : 'rgba(50, 44, 36, 0.42)');
        const stroke = insufficient
          ? 'rgba(235, 116, 100, 0.46)'
          : (part.present ? 'rgba(116, 211, 160, 0.24)' : 'rgba(255, 226, 177, 0.12)');
        const textColor = insufficient ? '#ffb0a5' : (part.present ? '#f6e8c8' : '#9a927e');
        this.drawPanel(chipX, chipY, chipWidth, chipHeight, { fill, stroke, radius: 6, inset: 'rgba(255, 255, 255, 0.04)' });
        const iconPath = this.resourceIconPath(resource);
        if (!this.drawAsset(iconPath, chipX + 4, chipY + 3, 12, 12, options.muted || !part.present ? 0.5 : 1)) {
          this.drawText(this.resourceShortName(resource), chipX + 8, chipY + 9, {
            size: 8,
            bold: true,
            color: textColor,
            align: 'center',
            baseline: 'middle',
          });
        }
        const valueText = this.truncateText(String(part.text ?? required), chipWidth - 21, { size: 10, bold: true });
        this.drawText(valueText, chipX + 19, chipY + 9, {
          size: 10,
          bold: true,
          color: textColor,
          baseline: 'middle',
        });
      });
    }

  }

  global.BuildingCanvasRenderer = BuildingCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = BuildingCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
