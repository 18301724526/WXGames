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
      if (cost.food) parts.push(`🌾 ${cost.food}`);
      if (cost.wood) parts.push(`🪵 ${cost.wood}`);
      if (cost.knowledge) parts.push(`📚 ${cost.knowledge}`);
      return parts.length ? parts.join(' ') : '免费建造';
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
        const descText = this.getDescription(id, state.buildings);
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
            <div class="building-effect">${effectText}</div>
            <div class="building-desc">${descText}</div>
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
      return parts.join('，') || '效果由后端计算';
    }

    getDescription(id, buildings) {
      const level = global.FrontendBuildingState.getLevel(buildings, id);
      if (level > 0) return '当前效果已按后端最新建筑等级计算';
      return '建造后由后端实时计算效果与升级成本';
    }
  }

  global.BuildingUIRenderer = BuildingUIRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = BuildingUIRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
