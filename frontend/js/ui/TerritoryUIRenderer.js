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

    formatStatus(site) {
      const labels = {
        discovered: '已发现',
        contested: '出征中',
        occupied: '已控制',
      };
      return labels[site.status] || site.status;
    }

    formatOwner(site) {
      const labels = {
        player: '我方',
        neutral: '中立',
        tribe: '部落',
      };
      return labels[site.owner] || site.owner || '未知';
    }

    getAction(site, state) {
      const mission = site.mission;
      if (site.status === 'discovered') {
        const soldiers = site.recommendedSoldiers || site.defense || 1;
        const disabled = (state.availableSoldiers || 0) < soldiers;
        return `<button class="btn-territory" data-territory-action="conquer" data-territory-id="${this.escapeHtml(site.id)}" data-soldiers="${soldiers}" ${disabled ? 'disabled' : ''}>派 ${soldiers} 士兵占领</button>`;
      }
      if (site.status === 'contested' && mission?.status === 'ready') {
        return `<button class="btn-territory" data-territory-action="claim" data-territory-id="${this.escapeHtml(site.id)}">完成占领</button>`;
      }
      if (site.status === 'contested') {
        return '<button class="btn-territory" disabled>行军中</button>';
      }
      if (site.status === 'occupied') {
        return `<button class="btn-territory secondary" data-territory-action="rename-city" data-territory-id="${this.escapeHtml(site.id)}">改名</button>`;
      }
      return '<button class="btn-territory" disabled>等待侦察</button>';
    }

    getRadarPosition(site, maxDistance) {
      const x = Number(site.x || 0);
      const y = Number(site.y || 0);
      const scale = 39 / Math.max(1, maxDistance);
      const left = Math.max(8, Math.min(92, 50 + x * scale));
      const top = Math.max(8, Math.min(92, 50 + y * scale));
      return {
        left: left.toFixed(2),
        top: top.toFixed(2),
      };
    }

    renderMap(territories) {
      const panX = Number(this.container?.dataset.worldPanX || 0);
      const panY = Number(this.container?.dataset.worldPanY || 0);
      const maxDistance = Math.max(
        1,
        ...territories.map((site) => Math.hypot(Number(site.x || 0), Number(site.y || 0))),
      );
      const sites = territories.map((site) => {
        const position = this.getRadarPosition(site, maxDistance);
        return `
          <button class="world-site world-site-${this.escapeHtml(site.status)} owner-${this.escapeHtml(site.owner)} type-${this.escapeHtml(site.type)}" type="button" data-site-id="${this.escapeHtml(site.id)}" title="${this.escapeHtml(site.naturalName)}" style="--site-x:${position.left}%;--site-y:${position.top}%">
            <span class="world-site-pulse"></span>
            <img src="${this.escapeHtml(site.art)}" alt="${this.escapeHtml(site.naturalName)}">
            <span class="world-site-name">${this.escapeHtml(site.cityName || site.naturalName)}</span>
          </button>
        `;
      }).join('');
      return `
        <div class="world-map-shell">
          <button class="world-reset" type="button" data-world-reset>回到本城</button>
          <div class="world-radar" data-world-radar aria-label="已知世界地图">
            <span class="radar-bearing bearing-n">N</span>
            <span class="radar-bearing bearing-e">E</span>
            <span class="radar-bearing bearing-s">S</span>
            <span class="radar-bearing bearing-w">W</span>
            <span class="radar-sweep"></span>
            <div class="world-radar-pan" data-world-pan style="--world-pan-x:${panX}px;--world-pan-y:${panY}px">
              <span class="radar-origin"></span>
              ${sites}
            </div>
          </div>
        </div>
      `;
    }

    renderSiteDialog(territories, state) {
      const sites = territories.map((site) => `
        <article class="world-site-detail" data-site-detail="${this.escapeHtml(site.id)}" hidden>
          <div class="world-detail-head">
            <div class="territory-art-wrap">
              <img class="territory-art" src="${this.escapeHtml(site.art)}" alt="${this.escapeHtml(site.naturalName)}" loading="lazy">
            </div>
            <div class="world-detail-title">
              <div class="territory-topline">
                <span class="territory-name">${this.escapeHtml(site.cityName || site.naturalName)}</span>
                <span class="territory-status">${this.escapeHtml(this.formatStatus(site))}</span>
              </div>
              <div class="territory-natural">${this.escapeHtml(this.formatOwner(site))} · 坐标 ${site.x},${site.y} · 距离 ${site.distance || 0}</div>
            </div>
          </div>
          <div class="territory-meta">
            <span>类型 ${this.escapeHtml(site.type || '未知')}</span>
            <span>规模 ${site.scale || 1}</span>
            <span>威胁 ${site.threat || 0}</span>
            <span>防御 ${site.defense || 0}</span>
            <span>建议 ${site.recommendedSoldiers || 0} 士兵</span>
          </div>
          <div class="territory-effect">${this.escapeHtml(this.formatEffect(site.effects))}</div>
          ${site.summary ? `<div class="territory-battle">${this.escapeHtml(site.summary)}</div>` : ''}
          ${site.lastBattle ? `<div class="territory-battle">${site.lastBattle.success ? '上次占领成功' : '上次占领失败'} · 损失 ${site.lastBattle.casualties} 士兵</div>` : ''}
          ${this.getAction(site, state)}
        </article>
      `).join('');
      return `
        <div class="modal-overlay" id="worldSiteModal" data-world-site-modal>
          <div class="modal-content world-site-modal-content" role="dialog" aria-modal="true" aria-labelledby="worldSiteTitle">
            <button class="modal-close" type="button" data-world-site-close aria-label="关闭">✕</button>
            <h3 id="worldSiteTitle">地点详情</h3>
            <div class="world-site-detail-list">
              ${sites}
            </div>
          </div>
        </div>
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
      this.container.innerHTML = `
        ${this.renderMap(territories)}
        ${this.renderSiteDialog(territories, territoryState)}
        <div class="territory-section-title">侦察报告</div>
        <div class="scout-report-list">${this.renderReports(territoryState.scoutReports || [])}</div>
      `;
    }
  }

  global.TerritoryUIRenderer = TerritoryUIRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = TerritoryUIRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
