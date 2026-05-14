/**
 * 建筑面板渲染器 - 负责建筑 UI 的生成和更新
 * 纯渲染，不碰状态和业务逻辑
 */
class BuildingRenderer {
  constructor(buildingManager) {
    this.manager = buildingManager;
    this.container = null;
  }

  /**
   * 绑定容器
   * @param {string} selector - CSS 选择器
   */
  bindContainer(selector) {
    this.container = document.querySelector ? document.querySelector(selector) : null;
    // 微信小程序环境可能不支持 querySelector，用传入的 element 也可以
  }

  /**
   * 渲染建筑面板
   * @param {HTMLElement} container - 容器元素（微信小程序中可用）
   * @returns {string} HTML 字符串（用于小程序 setData）
   */
  renderPanel(container) {
    if (container) this.container = container;
    if (!this.manager.state) return '';

    const displays = this.manager.getAllBuildingDisplays();
    const groups = this.groupByCategory(displays);

    let html = '';
    for (const [category, buildings] of Object.entries(groups)) {
      if (buildings.length === 0) continue;
      html += `<div class="building-category"><h4>${this.getCategoryLabel(category)}</h4>`;
      for (const b of buildings) {
        html += this.renderBuildingCard(b);
      }
      html += '</div>';
    }

    return html;
  }

  /**
   * 渲染单个建筑卡片
   * @param {BuildingDisplayInfo} b 
   * @returns {string}
   */
  renderBuildingCard(b) {
    const disabled = !b.isUnlocked || !b.canAfford ? 'disabled' : '';
    const lockedClass = !b.isUnlocked ? 'locked' : '';
    const costText = Object.entries(b.cost)
      .map(([r, a]) => `${r}:${a}`)
      .join(' ');

    return `
      <div class="building-card ${lockedClass}" data-id="${b.id}">
        <div class="building-icon" style="color:${b.color}">${b.icon}</div>
        <div class="building-info">
          <div class="building-name">${b.name} <span class="count">×${b.currentCount}</span></div>
          <div class="building-desc">${b.description}</div>
          <div class="building-cost">${costText}</div>
        </div>
        <button class="build-btn" ${disabled} data-building="${b.id}">建造</button>
      </div>
    `;
  }

  /**
   * 更新按钮可用状态（增量更新，不重绘全部）
   * @param {object} resources - 当前资源
   */
  updateButtonStates(resources) {
    if (!this.container) return;

    const displays = this.manager.getAllBuildingDisplays();
    for (const b of displays) {
      const btn = this.container.querySelector ? this.container.querySelector(`[data-building="${b.id}"]`) : null;
      if (btn) {
        if (b.isUnlocked && b.canAfford) {
          btn.disabled = false;
          btn.classList.remove('disabled');
        } else {
          btn.disabled = true;
          btn.classList.add('disabled');
        }
      }
    }
  }

  /**
   * 生成建筑提示 HTML
   * @param {string} buildingId 
   * @returns {string}
   */
  renderTooltip(buildingId) {
    const info = this.manager.getTooltipInfo(buildingId);
    if (!info) return '';

    const costText = Object.entries(info.nextCost)
      .map(([r, a]) => `${r}: ${a}`)
      .join(', ');

    const effectText = Object.entries(info.effects)
      .map(([k, v]) => `${k}: +${v}`)
      .join(', ');

    return `
      <div class="building-tooltip">
        <div class="tooltip-title">${info.icon} ${info.title}</div>
        <div class="tooltip-desc">${info.description}</div>
        <div class="tooltip-cost">消耗: ${costText}</div>
        ${info.unlockRequirement ? `<div class="tooltip-lock">🔒 ${info.unlockRequirement}</div>` : ''}
        ${effectText ? `<div class="tooltip-effects">效果: ${effectText}</div>` : ''}
      </div>
    `;
  }

  // ===== 私有方法 =====

  groupByCategory(displays) {
    const groups = {};
    for (const d of displays) {
      const cat = d.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    }
    return groups;
  }

  getCategoryLabel(category) {
    const labels = {
      production: '生产',
      housing: '居住',
      research: '科研',
      military: '军事',
      special: '特殊'
    };
    return labels[category] || category;
  }
}

// 兼容浏览器全局挂载
if (typeof window !== 'undefined') {
    window.BuildingRenderer = BuildingRenderer;
}
