(function (global) {
  class TerritoryUIRenderer {
    constructor(container) {
      this.container = container;
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
      const parts = [];
      if (effects.foodOutputMultiplier) parts.push(`食物 +${Math.round(effects.foodOutputMultiplier * 100)}%`);
      if (effects.woodOutputMultiplier) parts.push(`木材 +${Math.round(effects.woodOutputMultiplier * 100)}%`);
      if (effects.knowledgeOutputMultiplier) parts.push(`知识 +${Math.round(effects.knowledgeOutputMultiplier * 100)}%`);
      if (effects.threatDefense) parts.push(`边境防御 +${effects.threatDefense}`);
      return parts.join('，') || '无';
    }

    formatStatus(territory) {
      const labels = {
        locked: '未发现',
        scoutable: '可侦察',
        scouted: '可占领',
        contested: '出征中',
        occupied: '已占领',
      };
      return labels[territory.status] || territory.status;
    }

    getAction(territory, state) {
      const mission = territory.mission;
      if (territory.status === 'scoutable') {
        return `<button class="btn-territory" data-territory-action="scout" data-territory-id="${territory.id}">侦察</button>`;
      }
      if (territory.status === 'scouted') {
        const soldiers = territory.recommendedSoldiers || territory.defense || 1;
        const disabled = (state.availableSoldiers || 0) < soldiers;
        return `<button class="btn-territory" data-territory-action="conquer" data-territory-id="${territory.id}" data-soldiers="${soldiers}" ${disabled ? 'disabled' : ''}>派 ${soldiers} 士兵占领</button>`;
      }
      if (territory.status === 'contested' && mission?.status === 'ready') {
        return `<button class="btn-territory" data-territory-action="claim" data-territory-id="${territory.id}">完成占领</button>`;
      }
      if (territory.status === 'contested') {
        return `<button class="btn-territory" disabled>行军中</button>`;
      }
      if (territory.status === 'occupied') {
        return `<button class="btn-territory secondary" data-territory-action="rename-city" data-territory-id="${territory.id}">改名</button>`;
      }
      return '<button class="btn-territory" disabled>未发现</button>';
    }

    render(state) {
      if (!this.container) return;
      if ((state.currentEra || 0) < 5) {
        this.container.innerHTML = '<div class="territory-empty">进入古典时代后，疆域扩张将在这里展开。</div>';
        return;
      }
      const territoryState = state.territoryState || {};
      const territories = territoryState.territories || [];
      this.container.innerHTML = territories.map((territory) => `
        <div class="territory-card territory-${this.escapeHtml(territory.status)}" data-territory-id="${this.escapeHtml(territory.id)}">
          <div class="territory-art-wrap">
            <img class="territory-art" src="${this.escapeHtml(territory.art)}" alt="${this.escapeHtml(territory.naturalName)}" loading="lazy">
          </div>
          <div class="territory-body">
            <div class="territory-topline">
              <span class="territory-name">${this.escapeHtml(territory.cityName || territory.naturalName)}</span>
              <span class="territory-status">${this.escapeHtml(this.formatStatus(territory))}</span>
            </div>
            <div class="territory-natural">${this.escapeHtml(territory.naturalName)}</div>
            <div class="territory-meta">
              <span>防御 ${territory.defense || 0}</span>
              <span>建议 ${territory.recommendedSoldiers || 0} 士兵</span>
            </div>
            <div class="territory-effect">${this.escapeHtml(this.formatEffect(territory.effects))}</div>
            ${territory.lastBattle ? `<div class="territory-battle">${territory.lastBattle.success ? '上次占领成功' : '上次占领失败'} · 损失 ${territory.lastBattle.casualties} 士兵</div>` : ''}
            ${this.getAction(territory, territoryState)}
          </div>
        </div>
      `).join('');
    }
  }

  global.TerritoryUIRenderer = TerritoryUIRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = TerritoryUIRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
