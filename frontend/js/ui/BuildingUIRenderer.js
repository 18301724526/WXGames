(function (global) {
  class BuildingUIRenderer {
    constructor(container, buildingConfig) {
      this.container = container;
      this.buildingConfig = buildingConfig;
    }

    formatCost(cost) {
      const parts = [];
      if (cost === null) return '已满级';
      if (!cost) return '免费建造';
      if (cost.food) parts.push(this.formatCostPart('food', cost.food));
      if (cost.wood) parts.push(this.formatCostPart('wood', cost.wood));
      if (cost.knowledge) parts.push(this.formatCostPart('knowledge', cost.knowledge));
      return parts.length ? parts.join(' ') : '免费建造';
    }

    formatCostPart(resource, value) {
      return `<span class="cost-item cost-${resource}"><span class="cost-icon" aria-hidden="true"></span><span class="cost-value">${value}</span></span>`;
    }

    getVisibleIds(state, tutorial) {
      const unlocked = Array.isArray(state.unlockedBuildings) ? state.unlockedBuildings : [];
      const built = Object.entries(state.buildings || {})
        .filter(([, entry]) => (entry && typeof entry === 'object' ? entry.level : entry) > 0)
        .map(([id]) => id);
      return Array.from(new Set([...unlocked, ...built]));
    }

    render(state, tutorial) {
      if (!this.container) return;
      const ids = this.getVisibleIds(state, tutorial);
      if (!ids.length) {
        this.container.innerHTML = '<div class="building-empty">当前时代暂无可建造建筑</div>';
        return;
      }

      this.container.innerHTML = ids.map((id) => {
        const config = state.buildingDefinitions?.[id] || this.buildingConfig[id];
        if (!config) return '';
        const level = global.FrontendBuildingState.getLevel(state.buildings, id);
        const cost = state.buildingCosts && Object.prototype.hasOwnProperty.call(state.buildingCosts, id)
          ? state.buildingCosts[id]
          : undefined;
        const actionLabel = global.FrontendBuildingState.getActionLabel(cost, level);
        const disabledByTutorial = Boolean(tutorial && !tutorial.completed && (
          (tutorial.currentStep === 5 && id !== 'farm')
          || (tutorial.currentStep === 7 && id !== 'house')
          || (tutorial.currentStep >= 13 && tutorial.currentStep <= 14 && id !== 'lumbermill')
        ));
        const isMax = actionLabel === '已满级';
        const disabled = disabledByTutorial || isMax;
        const effectText = this.getEffectText(config, state.buildingEffects);
        const descText = this.getDescription(config);
        const militaryText = this.getMilitaryText(id, state.military);
        const art = config.art
          ? `<img class="building-art" src="${config.art}" alt="${config.name}" loading="lazy">`
          : config.icon;
        return `
          <div class="building-card ${disabledByTutorial ? 'is-muted' : ''}" data-building-id="${id}" id="card-${id}">
            <div class="building-header">
              <div class="building-icon">${art}</div>
              <div class="building-title">
                <div class="building-name">${config.name}</div>
                <div class="building-level">等级 ${level}</div>
              </div>
            </div>
            ${effectText ? `<div class="building-effect">${effectText}</div>` : ''}
            ${militaryText ? `<div class="building-military">${militaryText}</div>` : ''}
            ${descText ? `<div class="building-desc">${descText}</div>` : ''}
            <button class="btn-build" data-action="${level ? 'upgrade' : 'build'}" data-building-id="${id}" ${disabled ? 'disabled' : ''}>
              <span class="build-cost">${this.formatCost(cost)}</span>
              <span class="build-label">${disabledByTutorial ? '引导中锁定' : actionLabel}</span>
            </button>
          </div>
        `;
      }).join('');
    }

    formatEffectPart(template, effect) {
      if (!template?.field || !template?.label) return '';
      const value = effect?.[template.field];
      if (typeof value !== 'number') return '';
      if (template.format === 'percent') {
        return `${template.label} +${Math.round(value * 100)}%`;
      }
      return `${template.label} +${value}`;
    }

    getEffectText(config, buildingEffects) {
      const effect = buildingEffects?.byBuilding?.[config?.id] || {};
      const templates = config?.ui?.effectText || [];
      const parts = templates
        .map((template) => this.formatEffectPart(template, effect))
        .filter(Boolean);
      return parts.join('，');
    }

    getMilitaryText(id, military) {
      if (id !== 'barracks' || !military || !military.soldierCap) return '';
      const soldiers = Math.floor(military.soldiers || 0);
      const cap = Math.floor(military.soldierCap || 0);
      const progress = Math.floor(military.trainingProgress || 0);
      const interval = Math.floor(military.trainingIntervalSeconds || 0);
      const defense = Math.floor(military.defense || 0);
      const progressText = soldiers >= cap ? '训练已满' : `下一名 ${progress}/${interval}秒`;
      return `士兵 ${soldiers}/${cap} · 防御 ${defense}<br>${progressText}`;
    }

    getDescription(config) {
      return config?.ui?.description || '';
    }
  }

  global.BuildingUIRenderer = BuildingUIRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = BuildingUIRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
