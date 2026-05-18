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
      if (site.owner === 'player') return '我方';
      if (site.owner === 'neutral') return '无主';
      const labels = {
        tribe: '部落',
      };
      const ownerLabel = labels[site.owner] || site.owner || '未知势力';
      return `有主 · ${ownerLabel}`;
    }

    formatDuration(seconds) {
      const value = Math.max(0, Math.ceil(Number(seconds) || 0));
      const minutes = Math.floor(value / 60);
      const rest = value % 60;
      return `${minutes}:${String(rest).padStart(2, '0')}`;
    }

    getMarchInfo(site, state) {
      const mission = site.mission || null;
      const totalSeconds = Math.max(0, Math.floor(mission?.durationSeconds || state.missionDurationSeconds || 0));
      if (site.status === 'contested' && mission?.status === 'ready') {
        return totalSeconds > 0 ? `行军耗时 ${this.formatDuration(totalSeconds)}，已抵达待接管` : '已抵达待接管';
      }
      if (site.status === 'contested') {
        const remaining = this.formatDuration(mission?.remainingSeconds || 0);
        return totalSeconds > 0 ? `行军耗时 ${this.formatDuration(totalSeconds)}，剩余 ${remaining}` : `剩余 ${remaining}`;
      }
      if (site.status === 'discovered' && totalSeconds > 0) {
        return `行军耗时 ${this.formatDuration(totalSeconds)}`;
      }
      return '';
    }

    getExpeditionDraft(site) {
      const recommended = Math.max(1, Number(site?.recommendedSoldiers) || Number(site?.defense) || 1);
      return {
        territoryId: this.container?.dataset.expeditionConfigSiteId || '',
        troopType: this.container?.dataset.expeditionTroopType || 'unavailable',
        leader: this.container?.dataset.expeditionLeader || 'unavailable',
        soldiers: Math.max(1, Number(this.container?.dataset.expeditionSoldiers) || recommended),
      };
    }

    getExpeditionConfig(site, state) {
      const draft = this.getExpeditionDraft(site);
      const disabled = (state.availableSoldiers || 0) < draft.soldiers;
      return `
        <div class="site-expedition-form">
          <div class="site-expedition-grid">
            <label class="site-expedition-field">
              <span class="site-expedition-label">兵种</span>
              <select class="site-expedition-select" data-expedition-field="troopType">
                <option value="unavailable" ${draft.troopType === 'unavailable' ? 'selected' : ''}>暂未开放</option>
              </select>
              <span class="site-expedition-note">暂未开放</span>
            </label>
            <label class="site-expedition-field">
              <span class="site-expedition-label">领队</span>
              <select class="site-expedition-select" data-expedition-field="leader">
                <option value="unavailable" ${draft.leader === 'unavailable' ? 'selected' : ''}>暂未开放</option>
              </select>
              <span class="site-expedition-note">暂未开放</span>
            </label>
          </div>
          <label class="site-expedition-field">
            <span class="site-expedition-label">出征数量</span>
            <input class="site-expedition-input" type="number" min="1" step="1" value="${draft.soldiers}" data-expedition-field="soldiers">
            <span class="site-expedition-note">建议 ${site.recommendedSoldiers || site.defense || 1} 人，当前可用 ${(state.availableSoldiers || 0)} 人</span>
          </label>
          <div class="site-expedition-actions">
            <button class="btn-territory secondary" type="button" data-territory-action="close-expedition" data-territory-id="${this.escapeHtml(site.id)}">取消</button>
            <button class="btn-territory" type="button" data-territory-action="launch-expedition" data-territory-id="${this.escapeHtml(site.id)}" ${disabled ? 'disabled' : ''}>出发</button>
          </div>
        </div>
      `;
    }

    getAction(site, state) {
      const mission = site.mission;
      if (site.status === 'discovered') {
        const isOwnedTarget = site.occupationMode === 'conquest';
        const expanded = this.container?.dataset.expeditionConfigSiteId === site.id;
        const directDisabled = (state.availableSoldiers || 0) < 1;
        return `
          <div class="site-action-group">
            <div class="site-action-row">
              <button class="btn-territory secondary" type="button" disabled>交涉</button>
              <button class="btn-territory secondary" type="button" disabled>掠夺</button>
              <button class="btn-territory" type="button" data-territory-action="${isOwnedTarget ? 'open-expedition' : 'conquer'}" data-territory-id="${this.escapeHtml(site.id)}" ${!isOwnedTarget && directDisabled ? 'disabled' : ''}>占领</button>
            </div>
            <div class="site-action-hint">${isOwnedTarget ? '该地区已有势力，需要先配置出征队伍。' : '该地区无主，派 1 人即可建立据点。'}</div>
            ${isOwnedTarget && expanded ? this.getExpeditionConfig(site, state) : ''}
          </div>
        `;
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
      const visualOffset = site.visualOffset || {};
      const x = Number(site.x || 0) + (Number(visualOffset.x) || 0);
      const y = Number(site.y || 0) + (Number(visualOffset.y) || 0);
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
        ...territories.map((site) => Math.hypot(
          Number(site.x || 0) + (Number(site.visualOffset?.x) || 0),
          Number(site.y || 0) + (Number(site.visualOffset?.y) || 0),
        )),
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

    getMapSignature(territories) {
      return JSON.stringify((territories || []).map((site) => ({
        id: site.id,
        x: site.x,
        y: site.y,
        visualOffset: site.visualOffset || null,
        status: site.status,
        owner: site.owner,
        type: site.type,
        art: site.art,
        name: site.cityName || site.naturalName,
      })));
    }

    getDialogStructureSignature(territories) {
      return JSON.stringify((territories || []).map((site) => ({
        id: site.id,
        art: site.art,
      })));
    }

    getDialogContentSignature(territories, state) {
      return JSON.stringify({
        selectedSiteId: this.container?.dataset.selectedSiteId || '',
        expeditionConfigSiteId: this.container?.dataset.expeditionConfigSiteId || '',
        expeditionTroopType: this.container?.dataset.expeditionTroopType || '',
        expeditionLeader: this.container?.dataset.expeditionLeader || '',
        expeditionSoldiers: this.container?.dataset.expeditionSoldiers || '',
        missionDurationSeconds: state.missionDurationSeconds || 0,
        availableSoldiers: state.availableSoldiers || 0,
        territories: (territories || []).map((site) => ({
          id: site.id,
          cityName: site.cityName || '',
          naturalName: site.naturalName || '',
          status: site.status,
          owner: site.owner,
          distance: site.distance || 0,
          scale: site.scale || 0,
          threat: site.threat || 0,
          summary: site.summary || '',
          effects: this.formatEffect(site.effects),
          defense: site.defense || 0,
          recommendedSoldiers: site.recommendedSoldiers || 0,
          missionStatus: site.mission?.status || '',
          missionRemaining: site.mission?.remainingSeconds || 0,
          missionDuration: site.mission?.durationSeconds || 0,
          lastBattleResolvedAt: site.lastBattle?.resolvedAt || '',
          lastBattleSuccess: !!site.lastBattle?.success,
          lastBattleCasualties: site.lastBattle?.casualties || 0,
          lastBattleMode: site.lastBattle?.mode || '',
          occupationMode: site.occupationMode || '',
        })),
      });
    }

    renderSiteDialogSkeleton(territories) {
      const selectedSiteId = this.container?.dataset.selectedSiteId || '';
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
      const selectedSiteId = this.container?.dataset.selectedSiteId || '';
      const modal = dialogHost.querySelector('[data-world-site-modal]');
      if (modal) modal.classList.toggle('show', territories.some((site) => site.id === selectedSiteId));
      territories.forEach((site) => {
        const detail = dialogHost.querySelector(`[data-site-detail="${site.id}"]`);
        if (!detail) return;
        detail.hidden = site.id !== selectedSiteId;
        const setText = (selector, value) => {
          const element = detail.querySelector(selector);
          if (element) element.textContent = value;
        };
        setText('[data-site-name]', site.cityName || site.naturalName);
        setText('[data-site-status]', this.formatStatus(site));
        setText('[data-site-owner]', this.formatOwner(site));
        setText('[data-site-distance]', `距 ${site.distance || 0}`);
        setText('[data-site-scale]', `规模 ${site.scale || 1}`);
        setText('[data-site-threat]', `威胁 ${site.threat || 0}`);
        setText('[data-site-summary]', site.summary || this.formatEffect(site.effects));
        setText('[data-site-defense]', `防御 ${site.defense || 0}`);
        setText('[data-site-soldiers]', `建议 ${site.recommendedSoldiers || 0} 士兵`);
        const march = detail.querySelector('[data-site-march]');
        if (march) {
          const marchInfo = this.getMarchInfo(site, state);
          march.hidden = !marchInfo;
          march.textContent = marchInfo;
        }
        const note = detail.querySelector('[data-site-note]');
        if (note) {
          const noteText = site.lastBattle
            ? site.lastBattle.mode === 'settlement'
              ? '最近一次行动已顺利建立据点'
              : `${site.lastBattle.success ? '上次占领成功' : '上次占领失败'} · 损失 ${site.lastBattle.casualties} 士兵`
            : '';
          note.hidden = !noteText;
          note.textContent = noteText;
        }
        const action = detail.querySelector('[data-site-action]');
        if (action) action.innerHTML = this.getAction(site, state);
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
      const mapSignature = this.getMapSignature(territories);
      if (mapHost && mapHost.dataset.mapSignature !== mapSignature) {
        mapHost.innerHTML = this.renderMap(territories);
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
