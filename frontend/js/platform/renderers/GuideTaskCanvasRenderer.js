(function (global) {
  class GuideTaskCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host && prop in host) {
            const hostValue = host[prop];
            return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value);
          if (target.host && prop in target.host) {
            target.host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }

    renderGuideTasks(state = {}, startY = 0) {
      return startY;
    }

    renderTaskCenterButton(state = {}) {
      return undefined;
    }

    renderTaskCenterPanel(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildTaskCenterViewState !== 'function') return;
      const view = this.presenter.buildTaskCenterViewState(state, { activeTab: options.activeTaskCenterTab });
      const layout = this.getLayout();
      const panelWidth = Math.min(372, layout.contentWidth - 10);
      const panelHeight = Math.min(540, Math.max(390, this.height - 188));
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 14);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeTaskCenter' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(53, 39, 25, 0.99)'],
            [1, 'rgba(21, 18, 14, 0.99)'],
          ],
          'rgba(35, 27, 20, 0.99)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawText('任务', x + 18, y + 18, { size: 18, bold: true, color: '#ffe6b5' });
      this.drawText(`${view.summary?.claimableCount || 0} 个可领取`, x + 18, y + 44, { size: 12, color: '#cbbd96' });
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeTaskCenter' });

      const tabs = Array.isArray(view.tabs) ? view.tabs : [];
      const tabY = y + 72;
      const tabGap = 5;
      const tabWidth = Math.max(54, (panelWidth - 28 - tabGap * Math.max(0, tabs.length - 1)) / Math.max(1, tabs.length));
      tabs.forEach((tab, index) => {
        const tabX = x + 14 + index * (tabWidth + tabGap);
        this.drawButton(tabX, tabY, tabWidth, 34, tab.label, {
          size: 12,
          bold: tab.isActive,
          active: tab.isActive,
          radius: 8,
        });
        if (Number(tab.badge) > 0) {
          this.drawPanel(tabX + tabWidth - 18, tabY - 5, 20, 18, {
            fill: '#e94560',
            stroke: 'rgba(255, 255, 255, 0.18)',
            radius: 9,
          });
          this.drawText(String(tab.badge), tabX + tabWidth - 8, tabY + 4, {
            size: 9,
            bold: true,
            color: '#fff',
            baseline: 'middle',
            align: 'center',
          });
        }
        this.addHitTarget(
          { x: tabX, y: tabY, width: tabWidth, height: 34 },
          { type: 'switchTaskCenterTab', tab: tab.id },
        );
      });

      const listX = x + 14;
      const listY = tabY + 48;
      const listWidth = panelWidth - 28;
      const listBottom = y + panelHeight - 18;
      const tasks = Array.isArray(view.activeCategory?.tasks) ? view.activeCategory.tasks : [];
      if (!tasks.length) {
        this.drawPanel(listX, listY, listWidth, listBottom - listY, {
          fill: 'rgba(23, 18, 13, 0.38)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 10,
        });
        this.drawText(view.activeCategory?.emptyText || '暂无任务', listX + listWidth / 2, listY + 72, {
          size: 14,
          color: '#aeb0b8',
          align: 'center',
        });
        return;
      }

      const itemGap = 10;
      const itemHeight = 104;
      tasks.slice(0, 4).forEach((task, index) => {
        const itemY = listY + index * (itemHeight + itemGap);
        if (itemY + itemHeight > listBottom) return;
        const claimable = task.status === 'claimable' && !task.claimed;
        const completed = task.status === 'completed';
        const buttonWidth = 78;
        const buttonHeight = 34;
        const buttonX = listX + listWidth - buttonWidth - 12;
        const buttonY = itemY + itemHeight - buttonHeight - 12;
        const buttonAction = task.action || (
          claimable
            ? { type: 'claimTaskReward', taskId: task.id, category: task.category || view.activeTab }
            : { type: 'goToGuideTaskTarget', taskId: task.id, target: task.target }
        );
        const buttonDisabled = completed || (!claimable && !task.target && buttonAction.type !== 'goToGuideTaskTarget');
        this.drawPanel(listX, itemY, listWidth, itemHeight, {
          fill: completed ? 'rgba(21, 25, 22, 0.66)' : (claimable ? 'rgba(64, 49, 27, 0.82)' : 'rgba(27, 22, 17, 0.74)'),
          stroke: completed ? 'rgba(116, 211, 160, 0.18)' : (claimable ? 'rgba(247, 215, 116, 0.42)' : 'rgba(255, 226, 177, 0.12)'),
          radius: 10,
          inset: 'rgba(255, 231, 184, 0.05)',
        });
        this.drawText(this.truncateText(task.title || '任务', listWidth - 26, { size: 14, bold: true }), listX + 12, itemY + 10, {
          size: 14,
          bold: true,
          color: completed ? '#aec9b8' : '#fff1cf',
        });
        const desc = task.description || task.rewardText || '';
        this.drawTextLines(this.wrapTextLimit(desc, listWidth - 104, 2, { size: 11 }), listX + 12, itemY + 34, {
          size: 11,
          color: completed ? '#8ba494' : '#cbbd96',
          lineHeight: 15,
        });
        this.drawText(this.truncateText(task.rewardText || '无奖励', listWidth - buttonWidth - 34, { size: 12, bold: true }), listX + 12, itemY + 76, {
          size: 12,
          bold: true,
          color: completed ? '#79c79b' : (claimable ? '#ffd98a' : '#74d3a0'),
        });
        this.drawButton(buttonX, buttonY, buttonWidth, buttonHeight, task.actionLabel || (completed ? '已完成' : (claimable ? '领取' : '前往')), {
          disabled: buttonDisabled,
          active: !buttonDisabled,
          size: 12,
          bold: !buttonDisabled,
          radius: 9,
        });
        this.addHitTarget(
          { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight },
          { ...buttonAction, disabled: buttonDisabled },
        );
      });
    }

  }

  global.GuideTaskCanvasRenderer = GuideTaskCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = GuideTaskCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
