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

  class MilitaryPanelAdapter {
    constructor(elements = {}) {
      this.setText = elements.setText || (() => {});
      this.panel = elements.panel || null;
      this.trainingProgress = elements.trainingProgress || null;
      this.scoutGrid = elements.scoutGrid || null;
    }

    static fromDocument(doc, options = {}) {
      return new MilitaryPanelAdapter({
        setText: options.setText,
        panel: doc.getElementById('militaryPanel'),
        trainingProgress: doc.getElementById('soldierTrainingProgress'),
        scoutGrid: doc.getElementById('scoutDirectionGrid'),
      });
    }

    renderMilitary(view = {}) {
      if (!this.panel) return false;
      const text = view.text || {};
      this.setText('soldierCount', text.soldierCount);
      this.setText('militaryDefense', text.militaryDefense);
      this.setText('availableSoldierCount', text.availableSoldierCount);
      this.setText('soldiersOnMission', text.soldiersOnMission);
      this.setText('soldierTrainingText', text.soldierTrainingText);
      if (this.trainingProgress) {
        this.trainingProgress.style.width = view.training?.progressWidth || '0%';
      }
      return true;
    }

    renderScoutControls(view = {}) {
      this.setText('scoutStatus', view.statusText || '');
      if (!this.scoutGrid) return;
      this.scoutGrid.innerHTML = (view.cells || []).map((cell) => {
        if (cell.type === 'center') {
          return `<div class="scout-center" aria-hidden="true"><span>${escapeHtml(cell.label)}</span><small>${escapeHtml(cell.subLabel)}</small></div>`;
        }
        const actionAttr = cell.action === 'claim'
          ? ` data-scout-claim="${escapeHtml(cell.actionValue)}"`
          : cell.action === 'scout'
            ? ` data-scout-direction="${escapeHtml(cell.actionValue)}"`
            : '';
        return `<button class="btn-scout ${escapeHtml(cell.className)}"${actionAttr} ${cell.disabled ? 'disabled' : ''} aria-label="${escapeHtml(cell.ariaLabel)}"><span class="scout-direction-label">${escapeHtml(cell.label)}</span><span class="scout-action">${escapeHtml(cell.actionText)}</span></button>`;
      }).join('');
    }
  }

  global.MilitaryPanelAdapter = MilitaryPanelAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = MilitaryPanelAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
