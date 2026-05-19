(function (global) {
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  class CivilizationPanelAdapter {
    constructor(elements = {}) {
      this.setText = elements.setText || (() => {});
      this.progressBar = elements.progressBar || null;
      this.advanceButton = elements.advanceButton || null;
      this.advanceLabel = elements.advanceLabel || null;
      this.features = elements.features || null;
      this.conditions = elements.conditions || null;
    }

    static fromDocument(doc = document, options = {}) {
      return new CivilizationPanelAdapter({
        setText: options.setText,
        progressBar: doc.getElementById('eraProgress'),
        advanceButton: doc.getElementById('btnAdvanceEra'),
        advanceLabel: doc.getElementById('btnEraLabel'),
        features: typeof doc.querySelector === 'function'
          ? doc.querySelector('.civ-features-list')
          : null,
        conditions: doc.getElementById('eraConditions'),
      });
    }

    render(view = {}) {
      const text = view.text || {};
      this.setText('eraName', text.eraName);
      this.setText('civOverviewEraName', text.civOverviewEraName);
      this.setText('civOverviewDay', text.civOverviewDay);
      this.setText('civOverviewPop', text.civOverviewPop);
      this.setText('civOverviewBuildings', text.civOverviewBuildings);
      this.setText('civOverviewTechs', text.civOverviewTechs);
      this.setText('civOverviewHappiness', text.civOverviewHappiness);
      if (this.progressBar) this.progressBar.style.width = view.progress?.width || '0%';
      this.setText('eraProgressText', text.eraProgressText);
      this.setText('eraTargetName', text.eraTargetName);

      if (this.advanceButton) {
        this.advanceButton.disabled = Boolean(view.advanceButton?.disabled);
      }
      if (this.advanceLabel) {
        this.advanceLabel.textContent = text.advanceLabel || '';
      }
      if (this.features) {
        this.features.innerHTML = `<div class="civ-feature-item">${escapeHtml(text.featureDescription)}</div>`;
      }
      this.renderConditions(view.conditions || []);
    }

    renderConditions(conditions = []) {
      if (!this.conditions) return;
      this.conditions.innerHTML = conditions.map((condition) => `
        <div class="era-condition-item ${escapeHtml(condition.className)}">
          <div class="era-condition-name">${escapeHtml(condition.name)}</div>
          <div class="era-condition-progress">${escapeHtml(condition.progressText)}</div>
        </div>
      `).join('');
    }

    setAdvanceDisabled(disabled) {
      if (this.advanceButton) this.advanceButton.disabled = Boolean(disabled);
    }
  }

  global.CivilizationPanelAdapter = CivilizationPanelAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = CivilizationPanelAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
