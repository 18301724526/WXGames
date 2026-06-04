(function (global) {
  class MilitaryCanvasRenderer {
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
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value, receiver);
          if (target.host && prop in target.host) {
            target.host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }

    renderMilitarySubTabs(nav = {}, x, y, width) {
      const labels = { army: '军队', scout: '侦察', world: '世界' };
      const tabs = nav.views || [];
      const gap = 6;
      const tabWidth = (width - gap * Math.max(0, tabs.length - 1)) / Math.max(1, tabs.length);
      tabs.forEach((tab, index) => {
        const tabX = x + index * (tabWidth + gap);
        this.drawButton(tabX, y, tabWidth, 34, labels[tab.id] || tab.id, {
          size: 12,
          bold: true,
          radius: 9,
          disabled: tab.disabled,
          active: tab.isActive,
        });
        this.addHitTarget({ x: tabX, y, width: tabWidth, height: 34 }, {
          type: 'switchMilitaryView',
          view: tab.id,
          disabled: tab.disabled,
        });
      });
      return y + 46;
    }

    renderMilitaryArmyView(view = {}, x, y, width, height) {
      const formations = Array.isArray(view.formations) ? view.formations : [];
      const hasFormationSpace = height >= 250;
      const formationHeight = hasFormationSpace ? Math.min(158, Math.max(132, Math.floor(height * 0.43))) : 0;
      const cardHeight = Math.min(150, Math.max(104, height - formationHeight - (hasFormationSpace ? 30 : 18)));
      this.drawPanel(x, y, width, cardHeight, {
        fill: 'rgba(28, 22, 17, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      this.drawAsset('assets/art/icon-soldier-cutout.webp', x + 16, y + 24, 58, 72);
      const textX = x + 88;
      this.drawText('军队状态', textX, y + 16, { size: 14, bold: true, color: '#f6e8c8' });
      this.drawText(`士兵 ${view.text?.soldierCount || '0/0'}`, textX, y + 42, { size: 18, bold: true, color: '#74d3a0' });
      this.drawText(`防御 ${view.text?.militaryDefense ?? 0}`, textX, y + 68, { size: 12, color: '#cbbd96' });
      this.drawText(`可用 ${view.text?.availableSoldierCount ?? 0} · 出征中 ${view.text?.soldiersOnMission ?? 0}`, textX, y + 88, {
        size: 12,
        color: '#aeb0b8',
      });
      const progressY = y + cardHeight - 38;
      this.drawText(view.text?.soldierTrainingText || '等待兵营', x + 16, progressY - 18, { size: 12, color: '#cbbd96' });
      this.drawProgressBar(x + 16, progressY, width - 32, 12, parseFloat(view.training?.progressWidth || '0'));
      if (!hasFormationSpace) return;
      this.renderArmyFormationStrip(
        formations,
        x,
        y + cardHeight + 12,
        width,
        formationHeight,
        view.formationMeta || {},
      );
    }

    renderArmyFormationPortrait(person = null, x, y, width, height, options = {}) {
      const radius = options.radius ?? 6;
      if (person) {
        const drawn = this.drawFamousPortrait(person, x, y, Math.min(width, height), {
          frameWidth: width,
          frameHeight: height,
          radius,
          scale: options.scale || 1.35,
          offsetY: options.offsetY ?? 0.16,
          fill: options.fill || 'rgba(70, 49, 33, 0.92)',
          stroke: options.stroke || 'rgba(240, 180, 91, 0.34)',
        });
        if (!drawn) {
          this.drawPanel(x, y, width, height, {
            fill: 'rgba(70, 49, 33, 0.92)',
            stroke: 'rgba(240, 180, 91, 0.34)',
            radius,
          });
          this.drawText(String(person.name || '将').slice(0, 1), x + width / 2, y + height / 2, {
            size: Math.max(13, Math.min(20, width * 0.44)),
            bold: true,
            color: '#ffe6b5',
            align: 'center',
            baseline: 'middle',
          });
        }
        return;
      }
      this.drawPanel(x, y, width, height, {
        fill: options.fill || 'rgba(22, 20, 17, 0.58)',
        stroke: options.stroke || 'rgba(255, 226, 177, 0.13)',
        radius,
      });
      this.drawText('+', x + width / 2, y + height / 2 - 1, {
        size: Math.max(12, Math.min(18, width * 0.45)),
        color: 'rgba(255, 230, 181, 0.58)',
        align: 'center',
        baseline: 'middle',
      });
    }

    renderArmyFormationCard(formation = {}, x, y, width, height, index = 0) {
      const members = Array.isArray(formation.members) ? formation.members : [];
      const leader = members[0] || null;
      const active = members.length > 0;
      this.drawPanel(x, y, width, height, {
        fill: active ? 'rgba(55, 40, 29, 0.92)' : 'rgba(38, 33, 28, 0.86)',
        stroke: active ? 'rgba(240, 180, 91, 0.34)' : 'rgba(255, 226, 177, 0.14)',
        radius: 7,
        inset: active ? 'rgba(255, 231, 184, 0.08)' : 'rgba(255, 231, 184, 0.04)',
      });
      const title = formation.name || `部队${index + 1}`;
      this.drawText(this.truncateText(title, width - 16, { size: 12, bold: true }), x + width / 2, y + 9, {
        size: 12,
        bold: true,
        color: '#fff1cf',
        align: 'center',
      });
      const innerPad = 8;
      const leaderSize = Math.min(58, Math.max(34, Math.min(height - 66, width * 0.4)));
      const leaderX = x + innerPad;
      const leaderY = y + 28;
      this.renderArmyFormationPortrait(leader, leaderX, leaderY, leaderSize, leaderSize, { radius: 5, scale: 1.42 });
      if (leader) {
        this.drawText(this.truncateText(leader.name || '主将', leaderSize + 10, { size: 9, bold: true }), leaderX + leaderSize / 2, leaderY + leaderSize + 10, {
          size: 9,
          bold: true,
          color: '#ffe6b5',
          align: 'center',
        });
      } else {
        this.drawText('主将', leaderX + leaderSize / 2, leaderY + leaderSize + 10, {
          size: 9,
          color: 'rgba(255, 230, 181, 0.58)',
          align: 'center',
        });
      }
      const smallGap = 3;
      const smallAreaWidth = Math.max(24, width - leaderSize - innerPad * 3);
      const smallSize = Math.max(18, Math.min(32, Math.floor((smallAreaWidth - smallGap) / 2)));
      const smallStartX = x + width - innerPad - smallSize * 2 - smallGap;
      const smallStartY = leaderY + 2;
      [0, 1, 2, 3].forEach((smallIndex) => {
        const col = smallIndex % 2;
        const row = Math.floor(smallIndex / 2);
        this.renderArmyFormationPortrait(
          members[smallIndex + 1] || null,
          smallStartX + col * (smallSize + smallGap),
          smallStartY + row * (smallSize + smallGap),
          smallSize,
          smallSize,
          { radius: 4, scale: 1.32 },
        );
      });
      const countText = `${members.length}/${formation.maxMembers || 5}`;
      this.drawText(countText, x + width - 10, y + height - 24, {
        size: 10,
        bold: true,
        color: active ? '#74d3a0' : '#cbbd96',
        align: 'right',
      });
      this.drawText(active ? '点击调整' : '点击编制', x + width / 2, y + height - 24, {
        size: 10,
        color: active ? '#f0b45b' : 'rgba(234, 234, 234, 0.64)',
        align: 'center',
      });
      this.addHitTarget(
        { x, y, width, height },
        { type: 'openArmyFormation', cityId: formation.cityId, slot: formation.slot || index + 1 },
      );
    }

    renderArmyFormationStrip(formations = [], x, y, width, height, meta = {}) {
      this.drawText('编队', x + 2, y + 2, { size: 14, bold: true, color: '#ffe6b5' });
      this.drawText(meta.summary || '3 支部队 · 每队最多 5 名名人', x + 48, y + 4, { size: 10, color: '#cbbd96' });
      const cardGap = 8;
      const cardY = y + 24;
      const cardHeight = Math.max(108, height - 26);
      const cardWidth = Math.floor((width - cardGap * 2) / 3);
      [0, 1, 2].forEach((index) => {
        const cardX = x + index * (cardWidth + cardGap);
        const finalCardWidth = index === 2 ? x + width - cardX : cardWidth;
        this.renderArmyFormationCard(
          formations[index] || { slot: index + 1, cityId: meta.cityId, name: `部队${index + 1}`, members: [], maxMembers: meta.maxMembers || 5 },
          cardX,
          cardY,
          finalCardWidth,
          cardHeight,
          index,
        );
      });
    }

    getScoutButtonTone(cell = {}) {
      if (cell.status === 'ready') return { fill: 'rgba(40, 84, 62, 0.72)', stroke: 'rgba(116, 211, 160, 0.42)' };
      if (cell.status === 'active') return { fill: 'rgba(75, 58, 37, 0.66)', stroke: 'rgba(240, 180, 91, 0.28)' };
      if (cell.status === 'locked') return { fill: 'rgba(42, 40, 39, 0.62)', stroke: 'rgba(255, 255, 255, 0.08)' };
      return { fill: 'rgba(63, 47, 32, 0.78)', stroke: 'rgba(240, 180, 91, 0.25)' };
    }

    renderMilitaryScoutView(scout = {}, x, y, width, height) {
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(28, 22, 17, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      const statusLines = this.wrapTextLimit(scout.statusText || '', width - 28, 2, { size: 12 });
      this.drawTextLines(statusLines, x + 14, y + 14, { size: 12, color: '#cbbd96', lineHeight: 16 });

      const gridTop = y + 56;
      const reportReserve = Math.min(126, Math.max(86, height * 0.26));
      const gridSize = Math.min(width - 28, Math.max(190, Math.min(height - 82 - reportReserve, 286)));
      const gridX = x + (width - gridSize) / 2;
      this.drawPanel(gridX, gridTop, gridSize, gridSize, {
        fill: 'rgba(18, 16, 13, 0.38)',
        stroke: 'rgba(240, 180, 91, 0.16)',
        radius: 18,
      });
      const order = ['nw', 'n', 'ne', 'w', 'center', 'e', 'sw', 's', 'se'];
      const cellsById = new Map((scout.cells || []).map((cell) => [cell.id || cell.type, cell]));
      const cellGap = 7;
      const cellSize = (gridSize - 28 - cellGap * 2) / 3;
      order.forEach((id, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const cellX = gridX + 14 + col * (cellSize + cellGap);
        const cellY = gridTop + 14 + row * (cellSize + cellGap);
        const cell = id === 'center'
          ? { type: 'center', label: '城', subLabel: '本城' }
          : cellsById.get(id);
        if (!cell) return;
        if (cell.type === 'center') {
          this.drawPanel(cellX, cellY, cellSize, cellSize, {
            fill: 'rgba(75, 49, 25, 0.82)',
            stroke: 'rgba(240, 180, 91, 0.38)',
            radius: Math.min(22, cellSize / 2),
            inset: 'rgba(255, 231, 184, 0.12)',
          });
          this.drawText(cell.label || '城', cellX + cellSize / 2, cellY + cellSize / 2 - 7, {
            size: 18,
            bold: true,
            color: '#f0b45b',
            baseline: 'middle',
            align: 'center',
          });
          this.drawText(cell.subLabel || '本城', cellX + cellSize / 2, cellY + cellSize / 2 + 14, {
            size: 10,
            color: '#a0a0a0',
            baseline: 'middle',
            align: 'center',
          });
          return;
        }
        const tone = this.getScoutButtonTone(cell);
        this.drawPanel(cellX, cellY, cellSize, cellSize, {
          fill: tone.fill,
          stroke: tone.stroke,
          radius: 12,
          inset: 'rgba(255, 231, 184, 0.05)',
        });
        this.drawText(cell.label, cellX + cellSize / 2, cellY + cellSize / 2 - 8, {
          size: 13,
          bold: true,
          color: '#f6e8c8',
          baseline: 'middle',
          align: 'center',
        });
        this.drawText(cell.actionText, cellX + cellSize / 2, cellY + cellSize / 2 + 12, {
          size: 10,
          color: cell.status === 'ready' ? '#74d3a0' : '#aeb0b8',
          baseline: 'middle',
          align: 'center',
        });
        this.addHitTarget({ x: cellX, y: cellY, width: cellSize, height: cellSize }, {
          type: cell.action === 'claim' ? 'claimScout' : 'scoutTerritory',
          value: cell.actionValue,
          direction: cell.action === 'scout' ? cell.actionValue : undefined,
          missionId: cell.action === 'claim' ? cell.actionValue : undefined,
          disabled: cell.disabled || !cell.action,
        });
      });

      const reportsY = gridTop + gridSize + 18;
      if (reportsY < y + height - 42) {
        this.renderWorldReports(scout.reports || scout.scoutReports || [], x + 14, reportsY, width - 28, y + height - reportsY - 10);
      }
    }

    renderWorldReports(reports = [], x, y, width, maxHeight) {
      this.drawText('侦察报告', x, y, { size: 13, bold: true, color: '#f6e8c8' });
      if (!reports.length) {
        this.drawTextLines(this.wrapTextLimit('暂无侦察报告。派出侦察队后，外部世界会从这里开始显现。', width, 2, { size: 11 }), x, y + 24, {
          size: 11,
          color: '#aeb0b8',
          lineHeight: 15,
        });
        return;
      }
      let cursorY = y + 24;
      reports.slice().reverse().slice(0, Math.max(1, Math.floor(maxHeight / 54))).forEach((report) => {
        this.drawPanel(x, cursorY, width, 48, {
          fill: 'rgba(0, 0, 0, 0.16)',
          stroke: 'rgba(240, 180, 91, 0.18)',
          radius: 9,
        });
        this.drawText(this.truncateText(report.title || '侦察报告', width - 20, { size: 12, bold: true }), x + 10, cursorY + 8, {
          size: 12,
          bold: true,
          color: '#f6e8c8',
        });
        this.drawText(this.truncateText(report.text || '', width - 20, { size: 11 }), x + 10, cursorY + 27, {
          size: 11,
          color: '#aeb0b8',
        });
        cursorY += 56;
      });
    }

    renderMilitary(state = {}, startY = 210, panelHeight = 310, options = {}) {
      if (!this.presenter) return;
      const nav = this.presenter.buildMilitaryNavigationViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderSectionHeader('军事', x + 14, startY + 14, '🛡️');
      const contentTop = this.renderMilitarySubTabs(nav, x + 12, startY + 42, width - 24);
      const viewY = contentTop;
      const viewHeight = Math.max(120, startY + panelHeight - viewY - 12);
      if (nav.activeView === 'scout') {
        this.renderMilitaryScoutView(this.presenter.buildScoutControlViewState(state), x + 12, viewY, width - 24, viewHeight);
      } else if (nav.activeView === 'world') {
        this.renderMilitaryWorldView(state, x + 12, viewY, width - 24, viewHeight, options);
      } else {
        this.renderMilitaryArmyView(this.presenter.buildMilitaryViewState(state), x + 12, viewY, width - 24, viewHeight);
      }
    }

  }

  global.MilitaryCanvasRenderer = MilitaryCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = MilitaryCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
