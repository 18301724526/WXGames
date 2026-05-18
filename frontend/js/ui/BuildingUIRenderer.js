(function (global) {
  class BuildingUIRenderer {
    constructor(container, buildingConfig) {
      this.container = container;
      this.buildingConfig = buildingConfig;
    }

    hasPatchableDom() {
      return Boolean(this.container
        && this.container.dataset
        && typeof this.container.querySelector === 'function'
        && typeof this.container.querySelectorAll === 'function');
    }

    formatCost(cost) {
      return this.renderCost(global.UIStatePresenter.buildCostViewState(cost));
    }

    formatCostPart(resource, value) {
      return `<span class="cost-item cost-${resource}"><span class="cost-icon" aria-hidden="true"></span><span class="cost-value">${global.UIStatePresenter.formatResourceAmount(value)}</span></span>`;
    }

    getVisibleIds(state) {
      return global.UIStatePresenter.getVisibleBuildingIds(state);
    }

    getConfig(state, id) {
      return global.UIStatePresenter.getBuildingConfig(state, this.buildingConfig, id);
    }

    getStructureSignature(state, ids, tutorial = {}) {
      const view = global.UIStatePresenter.buildBuildingViewState(state, tutorial, this.buildingConfig);
      if (!ids) return view.structureSignature;
      const allowed = new Set(ids);
      return JSON.stringify(view.cards
        .filter((card) => allowed.has(card.id))
        .map((card) => ({
          id: card.id,
          name: card.name,
          art: card.art,
          icon: card.icon,
          structure: card.structure,
        })));
    }

    getCardState(state, tutorial, id) {
      return global.UIStatePresenter.buildBuildingCardViewState(state, tutorial, this.buildingConfig, id);
    }

    renderCost(costState) {
      if (!costState) return '';
      if (costState.text) return costState.text;
      return (costState.parts || [])
        .map((part) => `<span class="cost-item cost-${part.resource}"><span class="cost-icon" aria-hidden="true"></span><span class="cost-value">${part.text}</span></span>`)
        .join(' ');
    }

    buildCardMarkup(cardState) {
      const art = cardState.art
        ? `<img class="building-art" src="${cardState.art}" alt="${cardState.name}" loading="lazy">`
        : cardState.icon;
      const militaryText = (cardState.militaryLines || []).join('<br>');
      return `
          <div class="building-card ${cardState.isMuted ? 'is-muted' : ''}" data-building-id="${cardState.id}" id="card-${cardState.id}">
            <div class="building-header">
              <div class="building-icon">${art}</div>
              <div class="building-title">
                <div class="building-name">${cardState.name}</div>
                <div class="building-level" data-building-level>${cardState.levelText}</div>
              </div>
            </div>
            ${cardState.effectText ? `<div class="building-effect" data-building-effect>${cardState.effectText}</div>` : ''}
            ${militaryText ? `<div class="building-military" data-building-military>${militaryText}</div>` : ''}
            ${cardState.descText ? `<div class="building-desc" data-building-desc>${cardState.descText}</div>` : ''}
            <button class="btn-build" data-building-button data-action="${cardState.button.action}" data-building-id="${cardState.id}" ${cardState.button.disabled ? 'disabled' : ''}>
              <span class="build-cost" data-building-cost>${this.renderCost(cardState.cost)}</span>
              <span class="build-label" data-building-label>${cardState.button.label}</span>
            </button>
          </div>
        `;
    }

    renderFull(viewOrState, tutorial, ids) {
      const view = viewOrState?.cards
        ? viewOrState
        : {
          cards: (ids || this.getVisibleIds(viewOrState))
            .map((id) => this.getCardState(viewOrState, tutorial, id))
            .filter(Boolean),
        };
      this.container.innerHTML = view.cards.map((cardState) => this.buildCardMarkup(cardState)).join('');
    }

    patchCardState(cardStateOrState, tutorial, id) {
      const cardState = cardStateOrState?.button
        ? cardStateOrState
        : this.getCardState(cardStateOrState, tutorial, id);
      if (!cardState) return;
      const card = this.container.querySelector(`[data-building-id="${cardState.id}"]`);
      if (!card) return;
      card.classList.toggle('is-muted', cardState.isMuted);

      const levelEl = card.querySelector('[data-building-level]');
      if (levelEl) levelEl.textContent = cardState.levelText;

      const effectEl = card.querySelector('[data-building-effect]');
      if (effectEl) effectEl.innerHTML = cardState.effectText;

      const militaryEl = card.querySelector('[data-building-military]');
      if (militaryEl) militaryEl.innerHTML = (cardState.militaryLines || []).join('<br>');

      const descEl = card.querySelector('[data-building-desc]');
      if (descEl) descEl.textContent = cardState.descText;

      const button = card.querySelector('[data-building-button]');
      if (button) {
        button.dataset.action = cardState.button.action;
        button.disabled = cardState.button.disabled;
      }

      const costEl = card.querySelector('[data-building-cost]');
      if (costEl) costEl.innerHTML = this.renderCost(cardState.cost);

      const labelEl = card.querySelector('[data-building-label]');
      if (labelEl) labelEl.textContent = cardState.button.label;
    }

    render(state, tutorial) {
      if (!this.container) return;
      const view = global.UIStatePresenter.buildBuildingViewState(state, tutorial, this.buildingConfig);
      if (view.isEmpty) {
        this.container.innerHTML = `<div class="building-empty">${view.emptyText}</div>`;
        if (this.container.dataset) delete this.container.dataset.buildingStructureSignature;
        return;
      }
      if (!this.hasPatchableDom()) {
        this.renderFull(view, tutorial, view.ids);
        return;
      }
      if (this.container.dataset.buildingStructureSignature !== view.structureSignature) {
        this.renderFull(view, tutorial, view.ids);
        this.container.dataset.buildingStructureSignature = view.structureSignature;
      }
      view.cards.forEach((cardState) => this.patchCardState(cardState));
    }

    formatEffectPart(template, effect) {
      return global.UIStatePresenter.formatEffectPart(template, effect);
    }

    getEffectText(config, buildingEffects) {
      return global.UIStatePresenter.getBuildingEffectText(config, buildingEffects);
    }

    getMilitaryText(id, military, buildingEffects) {
      return global.UIStatePresenter.getBuildingMilitaryLines(id, military, buildingEffects).join('<br>');
    }

    getDescription(config) {
      return config?.ui?.description || '';
    }
  }

  global.BuildingUIRenderer = BuildingUIRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = BuildingUIRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
