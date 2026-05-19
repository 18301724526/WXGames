(function (global) {
  class TerritoryUIRenderer {
    constructor(container, options = {}) {
      this.container = container;
      this.getUiState = options.getUiState || (() => ({}));
    }

    escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char]));
    }

    formatEffect(effects = {}) {
      return global.UIStatePresenter.formatWorldSiteEffect(effects);
    }

    formatStatus(site) {
      return global.UIStatePresenter.formatWorldSiteStatus(site);
    }

    formatOwner(site) {
      return global.UIStatePresenter.formatWorldSiteOwner(site);
    }

    formatDuration(seconds) {
      return global.UIStatePresenter.formatWorldDuration(seconds);
    }

    getMarchInfo(site, state) {
      return global.UIStatePresenter.getWorldSiteMarchInfo(site, state);
    }

    getExpeditionDraft(site) {
      return global.UIStatePresenter.buildWorldExpeditionDraftViewState(site, this.getInteractionState());
    }

    getInteractionState() {
      return this.getUiState() || {};
    }

    renderExpeditionSelect(fieldName, field) {
      const options = (field.options || []).map((option) => (
        `<option value="${this.escapeHtml(option.value)}" ${field.value === option.value ? 'selected' : ''}>${this.escapeHtml(option.label)}</option>`
      )).join('');
      return `
            <label class="site-expedition-field">
              <span class="site-expedition-label">${this.escapeHtml(field.label)}</span>
              <select class="site-expedition-select" data-expedition-field="${this.escapeHtml(fieldName)}">
                ${options}
              </select>
              <span class="site-expedition-note">${this.escapeHtml(field.note)}</span>
            </label>
      `;
    }

    renderExpeditionConfig(config) {
      if (!config) return '';
      return `
        <div class="site-expedition-form">
          <div class="site-expedition-grid">
            ${this.renderExpeditionSelect('troopType', config.fields.troopType)}
            ${this.renderExpeditionSelect('leader', config.fields.leader)}
          </div>
          <label class="site-expedition-field">
            <span class="site-expedition-label">${this.escapeHtml(config.fields.soldiers.label)}</span>
            <input class="site-expedition-input" type="number" min="${this.escapeHtml(config.fields.soldiers.min)}" step="${this.escapeHtml(config.fields.soldiers.step)}" value="${this.escapeHtml(config.fields.soldiers.value)}" data-expedition-field="soldiers">
            <span class="site-expedition-note">${this.escapeHtml(config.note)}</span>
          </label>
          <div class="site-expedition-actions">
            <button class="btn-territory secondary" type="button" data-territory-action="${this.escapeHtml(config.buttons.cancel.action)}" data-territory-id="${this.escapeHtml(config.siteId)}">${this.escapeHtml(config.buttons.cancel.label)}</button>
            <button class="btn-territory" type="button" data-territory-action="${this.escapeHtml(config.buttons.launch.action)}" data-territory-id="${this.escapeHtml(config.siteId)}" ${config.disabled ? 'disabled' : ''}>${this.escapeHtml(config.buttons.launch.label)}</button>
          </div>
        </div>
      `;
    }

    renderActionButton(button) {
      const classes = button.secondary ? 'btn-territory secondary' : 'btn-territory';
      const actionAttr = button.action ? ` data-territory-action="${this.escapeHtml(button.action)}"` : '';
      return `<button class="${classes}" type="button"${actionAttr} data-territory-id="${this.escapeHtml(button.territoryId)}" ${button.disabled ? 'disabled' : ''}>${this.escapeHtml(button.label)}</button>`;
    }

    renderAction(action) {
      if (!action) return '';
      if (action.kind === 'group') {
        return `
          <div class="site-action-group">
            <div class="site-action-row">
              ${action.buttons.map((button) => this.renderActionButton(button)).join('')}
            </div>
            <div class="site-action-hint">${this.escapeHtml(action.hint)}</div>
            ${this.renderExpeditionConfig(action.expeditionConfig)}
          </div>
        `;
      }
      if (action.kind === 'row') {
        return `
          <div class="site-action-row">
            ${action.buttons.map((button) => this.renderActionButton(button)).join('')}
          </div>
        `;
      }
      return action.buttons.map((button) => this.renderActionButton(button)).join('');
    }

    getExpeditionConfig(site, state) {
      return this.renderExpeditionConfig(global.UIStatePresenter.buildWorldExpeditionConfigViewState(site, state, this.getInteractionState()));
    }

    getAction(site, state) {
      const action = global.UIStatePresenter.buildWorldSiteActionViewState(site, state, this.getInteractionState());
      return this.renderAction(action);
    }

    getRadarPosition(site, maxDistance) {
      return global.UIStatePresenter.getWorldRadarPosition(site, maxDistance);
    }

    measureRadarSpacing(candidate, placed) {
      return global.UIStatePresenter.measureWorldRadarSpacing(candidate, placed);
    }

    resolveRadarPosition(anchor, placed) {
      return global.UIStatePresenter.resolveWorldRadarPosition(anchor, placed);
    }

    buildRadarLayout(territories) {
      return global.UIStatePresenter.buildWorldRadarLayout(territories);
    }

    renderMap(viewOrTerritories) {
      const view = Array.isArray(viewOrTerritories)
        ? global.UIStatePresenter.buildWorldRadarViewState(viewOrTerritories, {
          panX: this.getInteractionState().worldPanX || 0,
          panY: this.getInteractionState().worldPanY || 0,
        })
        : viewOrTerritories;
      const sites = view.sites.map((site) => `
          <button class="world-site ${this.escapeHtml(site.className)}" type="button" data-site-id="${this.escapeHtml(site.id)}" title="${this.escapeHtml(site.title)}" style="--site-x:${site.position.left}%;--site-y:${site.position.top}%">
            <span class="world-site-pulse"></span>
            <img src="${this.escapeHtml(site.art)}" alt="${this.escapeHtml(site.alt)}">
            <span class="world-site-name">${this.escapeHtml(site.name)}</span>
          </button>
        `).join('');
      return `
        <div class="world-map-shell">
          <button class="world-reset" type="button" data-world-reset>回到本城</button>
          <div class="world-radar" data-world-radar aria-label="已知世界地图">
            <span class="radar-bearing bearing-n">N</span>
            <span class="radar-bearing bearing-e">E</span>
            <span class="radar-bearing bearing-s">S</span>
            <span class="radar-bearing bearing-w">W</span>
            <span class="radar-sweep"></span>
            <div class="world-radar-pan" data-world-pan style="--world-pan-x:${view.pan.x}px;--world-pan-y:${view.pan.y}px">
              <span class="radar-origin"></span>
              ${sites}
            </div>
          </div>
        </div>
      `;
    }

    getMapSignature(territories) {
      return global.UIStatePresenter.getWorldMapSignature(territories);
    }

    getDialogStructureSignature(territories) {
      return JSON.stringify((territories || []).map((site) => ({
        id: site.id,
        art: site.art,
      })));
    }

    getDialogContentSignature(territories, state) {
      return global.UIStatePresenter.getWorldSiteDialogContentSignature(territories, state, this.getInteractionState());
    }

    renderSiteDialogSkeleton(territories) {
      const selectedSiteId = this.getInteractionState().selectedSiteId || '';
      const sites = territories.map((site) => `
        <article class="world-site-detail" data-site-detail="${this.escapeHtml(site.id)}" ${site.id === selectedSiteId ? '' : 'hidden'}>
          <div class="site-card-hero">
            <img class="site-card-art" src="${this.escapeHtml(site.art)}" alt="${this.escapeHtml(site.naturalName)}" loading="lazy">
            <div class="site-card-title">
              <span class="site-card-name" data-site-name></span>
              <span class="site-card-status" data-site-status></span>
            </div>
          </div>
          <div class="site-card-meta">
            <span data-site-owner></span>
            <span data-site-distance></span>
            <span data-site-scale></span>
            <span data-site-threat></span>
          </div>
          <div class="site-card-march" data-site-march hidden></div>
          <p class="site-card-summary" data-site-summary></p>
          <div class="site-card-stats">
            <span data-site-defense></span>
            <span data-site-soldiers></span>
          </div>
          <div class="site-card-note" data-site-note hidden></div>
          <div data-site-action></div>
        </article>
      `).join('');
      return `
        <div class="modal-overlay" id="worldSiteModal" data-world-site-modal>
          <div class="modal-content world-site-modal-content" role="dialog" aria-modal="true" aria-labelledby="worldSiteTitle">
            <button class="modal-close" type="button" data-world-site-close aria-label="关闭">✕</button>
            <h3 id="worldSiteTitle">地点</h3>
            <div class="world-site-detail-list">
              ${sites}
            </div>
          </div>
        </div>
      `;
    }

    updateSiteDialogContent(dialogHost, territories, state) {
      if (!dialogHost || typeof dialogHost.querySelector !== 'function' || typeof dialogHost.querySelectorAll !== 'function') return;
      const view = global.UIStatePresenter.buildWorldSiteDialogViewState(territories, state, this.getInteractionState());
      const modal = dialogHost.querySelector('[data-world-site-modal]');
      if (modal) modal.classList.toggle('show', view.showModal);
      view.details.forEach((siteView) => {
        const detail = dialogHost.querySelector(`[data-site-detail="${siteView.id}"]`);
        if (!detail) return;
        detail.hidden = !siteView.visible;
        const setText = (selector, value) => {
          const element = detail.querySelector(selector);
          if (element) element.textContent = value;
        };
        setText('[data-site-name]', siteView.text.name);
        setText('[data-site-status]', siteView.text.status);
        setText('[data-site-owner]', siteView.text.owner);
        setText('[data-site-distance]', siteView.text.distance);
        setText('[data-site-scale]', siteView.text.scale);
        setText('[data-site-threat]', siteView.text.threat);
        setText('[data-site-summary]', siteView.text.summary);
        setText('[data-site-defense]', siteView.text.defense);
        setText('[data-site-soldiers]', siteView.text.soldiers);
        const march = detail.querySelector('[data-site-march]');
        if (march) {
          march.hidden = !siteView.text.march;
          march.textContent = siteView.text.march;
        }
        const note = detail.querySelector('[data-site-note]');
        if (note) {
          note.hidden = !siteView.text.note;
          note.textContent = siteView.text.note;
        }
        const action = detail.querySelector('[data-site-action]');
        if (action) action.innerHTML = this.renderAction(siteView.action);
      });
    }

    getReportsSignature(reports = []) {
      return JSON.stringify((reports || []).map((report) => ({
        id: report.id,
        title: report.title,
        text: report.text,
      })));
    }

    renderReportsSection(reports = []) {
      return `
        <div class="territory-section-title">侦察报告</div>
        <div class="scout-report-list">${this.renderReports(reports)}</div>
      `;
    }

    renderReports(reports = []) {
      if (!reports.length) {
        return '<div class="territory-empty compact">暂无侦察报告。派出侦察队后，外部世界会从这里开始显现。</div>';
      }
      return reports.slice().reverse().map((report) => `
        <article class="scout-report">
          <div class="scout-report-title">${this.escapeHtml(report.title)}</div>
          <div class="scout-report-text">${this.escapeHtml(report.text)}</div>
        </article>
      `).join('');
    }

    render(state) {
      if (!this.container) return;
      if ((state.currentEra || 0) < 5) {
        this.container.innerHTML = '<div class="territory-empty">进入古典时代后，外部世界将在这里逐步显现。</div>';
        return;
      }
      const territoryState = state.territoryState || {};
      const territories = territoryState.territories || [];
      if (!this.container.querySelector('[data-world-map-host]')) {
        this.container.innerHTML = '<div data-world-map-host></div><div data-world-dynamic-host></div>';
      }

      const mapHost = this.container.querySelector('[data-world-map-host]');
      const dynamicHost = this.container.querySelector('[data-world-dynamic-host]');
      const mapView = global.UIStatePresenter.buildWorldRadarViewState(territories, {
        panX: this.getInteractionState().worldPanX || 0,
        panY: this.getInteractionState().worldPanY || 0,
      });
      const mapSignature = mapView.signature;
      if (mapHost && mapHost.dataset.mapSignature !== mapSignature) {
        mapHost.innerHTML = this.renderMap(mapView);
        mapHost.dataset.mapSignature = mapSignature;
      }
      if (dynamicHost) {
        if (!dynamicHost.querySelector || !dynamicHost.querySelector('[data-world-dialog-host]')) {
          dynamicHost.innerHTML = '<div data-world-dialog-host></div><div data-world-report-host></div>';
        }
        const dialogHost = typeof dynamicHost.querySelector === 'function' ? dynamicHost.querySelector('[data-world-dialog-host]') : null;
        const reportHost = typeof dynamicHost.querySelector === 'function' ? dynamicHost.querySelector('[data-world-report-host]') : null;
        const dialogStructureSignature = this.getDialogStructureSignature(territories);
        if (dialogHost && dialogHost.dataset.dialogStructureSignature !== dialogStructureSignature) {
          dialogHost.innerHTML = this.renderSiteDialogSkeleton(territories);
          dialogHost.dataset.dialogStructureSignature = dialogStructureSignature;
          if (dialogHost.dataset) delete dialogHost.dataset.dialogContentSignature;
        }
        const dialogContentSignature = this.getDialogContentSignature(territories, territoryState);
        if (dialogHost && dialogHost.dataset.dialogContentSignature !== dialogContentSignature) {
          this.updateSiteDialogContent(dialogHost, territories, territoryState);
          dialogHost.dataset.dialogContentSignature = dialogContentSignature;
        }
        const reportsSignature = this.getReportsSignature(territoryState.scoutReports || []);
        if (reportHost && reportHost.dataset.reportsSignature !== reportsSignature) {
          reportHost.innerHTML = this.renderReportsSection(territoryState.scoutReports || []);
          reportHost.dataset.reportsSignature = reportsSignature;
        }
      }
    }
  }

  global.TerritoryUIRenderer = TerritoryUIRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = TerritoryUIRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
