(function (global) {
  class BuildingUIRenderer {
    constructor(container, buildingConfig) {
      this.container = container;
      this.buildingConfig = buildingConfig;
    }

    formatCost(cost) {
      const parts = [];
      if (!cost) return '免费建造';
      if (cost.food) parts.push(`🌾 ${cost.food}`);
      if (cost.knowledge) parts.push(`📚 ${cost.knowledge}`);
      return parts.length ? parts.join(' ') : '免费建造';
    }

    getVisibleIds(state, tutorial) {
      const unlocked = state.unlockedBuildings || [];
      if ((tutorial && tutorial.currentStep >= 5 && tutorial.currentStep < 7) || state.currentEra === 1) return ['farm', 'house'];
      return unlocked.length ? unlocked : [];
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
        const level = global.FrontendBuildingState.getLevel(state.buildings, id);
        const actionLabel = global.FrontendBuildingState.getActionLabel(config, level);
        const disabledByTutorial = tutorial && !tutorial.completed && tutorial.currentStep === 5 && id !== 'farm';
        const isMax = actionLabel === '已满级';
        const disabled = disabledByTutorial || isMax;
        const cost = state.buildingCosts && state.buildingCosts[id];
        return `
          <div class="building-card ${disabledByTutorial ? 'is-muted' : ''}" data-building-id="${id}" id="card-${id}">
            <div class="building-header">
              <div class="building-icon">${config.icon}</div>
              <div class="building-title">
                <div class="building-name">${config.name}</div>
                <div class="building-level">等级 ${level}</div>
              </div>
            </div>
            <div class="building-effect">${config.effectText}</div>
            <div class="building-desc">${config.description}</div>
            <button class="btn-build" data-action="${level ? 'upgrade' : 'build'}" data-building-id="${id}" ${disabled ? 'disabled' : ''}>
              <span class="build-cost">${this.formatCost(cost)}</span>
              <span class="build-label">${disabledByTutorial ? '引导中锁定' : actionLabel}</span>
            </button>
          </div>
        `;
      }).join('');
    }
  }

  global.BuildingUIRenderer = BuildingUIRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = BuildingUIRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
