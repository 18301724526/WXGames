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
        const config = this.buildingConfig[id];
        if (!config) return '';
        const level = global.FrontendBuildingState.getLevel(state.buildings, id);
        const cost = state.buildingCosts && Object.prototype.hasOwnProperty.call(state.buildingCosts, id)
          ? state.buildingCosts[id]
          : undefined;
        const actionLabel = global.FrontendBuildingState.getActionLabel(cost, level);
        const disabledByTutorial = tutorial && !tutorial.completed && tutorial.currentStep === 5 && id !== 'farm';
        const isMax = actionLabel === '已满级';
        const disabled = disabledByTutorial || isMax;
        const effectText = this.getEffectText(id, state.buildingEffects);
        const descText = this.getDescription(id, state.buildings);
        return `
          <div class="building-card ${disabledByTutorial ? 'is-muted' : ''}" data-building-id="${id}" id="card-${id}">
            <div class="building-header">
              <div class="building-icon">${config.icon}</div>
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

    getEffectText(id, buildingEffects) {
      const effect = buildingEffects?.byBuilding?.[id] || {};
      switch (id) {
        case 'farm':
          return `食物产出 +${Math.round((effect.foodOutputBonus || 0) * 100)}%`;
        case 'house': {
          const parts = [];
          if (typeof effect.populationCapBonus === 'number') parts.push(`人口上限 +${effect.populationCapBonus}`);
          if (typeof effect.happinessBonus === 'number') parts.push(`幸福度 +${effect.happinessBonus}`);
          return parts.join('，') || '提升人口上限';
        }
        case 'workshop':
          return `工匠产出 +${Math.round((effect.craftsmanOutputBonus || 0) * 100)}%`;
        case 'academy':
          return `知识产出 +${Math.round((effect.knowledgeOutputBonus || 0) * 100)}%`;
        case 'barracks': {
          const parts = [];
          if (typeof effect.defenseLevel === 'number') parts.push(`防御等级 +${effect.defenseLevel}`);
          if (typeof effect.globalOutputBonus === 'number') parts.push(`全产出 +${Math.round(effect.globalOutputBonus * 100)}%`);
          return parts.join('，') || '提升防御与全局产出';
        }
        case 'temple': {
          const parts = [];
          if (typeof effect.happinessBonus === 'number') parts.push(`幸福度 +${effect.happinessBonus}`);
          if (typeof effect.offlineEfficiencyBonus === 'number') parts.push(`离线收益 +${Math.round(effect.offlineEfficiencyBonus * 100)}%`);
          return parts.join('，') || '提升幸福度与离线收益';
        }
        default:
          return '效果由后端计算';
      }
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
