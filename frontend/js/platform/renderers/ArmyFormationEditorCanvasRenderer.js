(function (global) {
  class ArmyFormationEditorCanvasRenderer {
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

    renderArmyFormationEditor(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildMilitaryViewState !== 'function') return;
      const editor = options.armyFormationEditor || {};
      if (!editor.open) return;
      const view = this.presenter.buildMilitaryViewState(state);
      const slot = Math.max(1, Math.min(3, Number(editor.slot) || 1));
      const formation = (view.formations || []).find((item) => Number(item.slot) === slot)
        || { slot, cityId: view.formationMeta?.cityId || state.activeCityId || 'capital', name: `部队${slot}`, members: [], memberIds: [], maxMembers: 5 };
      const allPeople = Array.isArray(view.formationPeople) ? view.formationPeople : [];
      const memberIds = Array.isArray(editor.memberIds) ? editor.memberIds : formation.memberIds || [];
      const selectedIds = new Set(memberIds);
      const peopleById = new Map(allPeople.map((person) => [person.id, person]));
      const selectedMembers = memberIds.map((personId) => peopleById.get(personId)).filter(Boolean);
      const maxMembers = formation.maxMembers || view.formationMeta?.maxMembers || 5;
      const layout = this.getLayout();
      const panelWidth = Math.min(390, layout.contentWidth - 10);
      const panelHeight = Math.min(570, Math.max(470, this.height - 132));
      const x = Math.floor((this.width - panelWidth) / 2);
      const y = Math.max(54, Math.floor((this.height - panelHeight) / 2));
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeArmyFormationEditor', background: true });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(50, 38, 26, 0.99)'],
            [1, 'rgba(20, 18, 14, 0.99)'],
          ],
          'rgba(34, 27, 20, 0.99)',
        ),
        stroke: 'rgba(255, 226, 177, 0.26)',
        radius: 12,
        inset: 'rgba(255, 231, 184, 0.09)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      this.drawText(`${formation.name || `部队${slot}`}编队`, x + 18, y + 16, { size: 18, bold: true, color: '#ffe6b5' });
      this.drawText(`已选 ${selectedIds.size}/${maxMembers} · 第一位为主将`, x + 18, y + 43, { size: 12, color: '#cbbd96' });
      this.drawButton(x + panelWidth - closeSize - 10, y + 10, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: x + panelWidth - closeSize - 10, y: y + 10, width: closeSize, height: closeSize }, { type: 'closeArmyFormationEditor' });

      const innerX = x + 14;
      const innerWidth = panelWidth - 28;
      const summaryY = y + 72;
      this.drawPanel(innerX, summaryY, innerWidth, 78, {
        fill: 'rgba(24, 21, 17, 0.64)',
        stroke: 'rgba(240, 180, 91, 0.18)',
        radius: 8,
      });
      const slotSize = 48;
      const slotGap = Math.max(5, Math.min(10, (innerWidth - slotSize * maxMembers - 18) / Math.max(1, maxMembers - 1)));
      const selectedStartX = innerX + 10;
      for (let index = 0; index < maxMembers; index += 1) {
        const member = selectedMembers[index] || null;
        const slotX = selectedStartX + index * (slotSize + slotGap);
        this.renderArmyFormationPortrait(member, slotX, summaryY + 12, slotSize, slotSize, { radius: 5, scale: 1.34 });
        this.drawText(index === 0 ? '主' : '副', slotX + slotSize / 2, summaryY + 67, {
          size: 9,
          color: member ? '#ffe6b5' : 'rgba(255, 230, 181, 0.46)',
          align: 'center',
        });
      }

      const listTop = summaryY + 94;
      this.drawText('名人列表', innerX, listTop, { size: 13, bold: true, color: '#ffe6b5' });
      const pageSize = Math.max(3, Math.min(5, Math.floor((panelHeight - 244) / 58)));
      const pages = Math.max(1, Math.ceil(allPeople.length / pageSize));
      const page = Math.max(0, Math.min(pages - 1, Number(editor.page) || 0));
      const listY = listTop + 22;
      const rowHeight = 54;
      if (!allPeople.length) {
        this.drawPanel(innerX, listY, innerWidth, 88, {
          fill: 'rgba(27, 23, 18, 0.62)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 8,
        });
        this.drawTextLines(this.wrapTextLimit('暂无可编入的名人。先在名人入口接纳名人后，再回来编队。', innerWidth - 28, 3, { size: 12 }), innerX + 14, listY + 18, {
          size: 12,
          color: '#aeb0b8',
          lineHeight: 18,
        });
      } else {
        allPeople.slice(page * pageSize, page * pageSize + pageSize).forEach((person, index) => {
          const rowY = listY + index * (rowHeight + 6);
          const selected = selectedIds.has(person.id);
          const disabled = !selected && selectedIds.size >= maxMembers;
          this.drawPanel(innerX, rowY, innerWidth, rowHeight, {
            fill: selected ? 'rgba(61, 49, 31, 0.92)' : 'rgba(31, 27, 22, 0.78)',
            stroke: selected ? 'rgba(116, 211, 160, 0.38)' : 'rgba(255, 226, 177, 0.12)',
            radius: 8,
            inset: selected ? 'rgba(116, 211, 160, 0.06)' : 'rgba(255, 231, 184, 0.04)',
          });
          this.renderArmyFormationPortrait(person, innerX + 9, rowY + 7, 40, 40, { radius: 5, scale: 1.34 });
          const nameWidth = innerWidth - 132;
          this.drawText(this.truncateText(person.name || '无名', nameWidth, { size: 13, bold: true }), innerX + 58, rowY + 9, {
            size: 13,
            bold: true,
            color: disabled ? '#8d8f99' : '#fff1cf',
          });
          this.drawText(this.truncateText(`${person.qualityLabel || ''} · ${person.roleText || person.title || ''}`, nameWidth, { size: 10 }), innerX + 58, rowY + 30, {
            size: 10,
            color: disabled ? 'rgba(174, 176, 184, 0.48)' : '#cbbd96',
          });
          this.drawButton(innerX + innerWidth - 64, rowY + 12, 50, 30, selected ? '移除' : '加入', {
            size: 11,
            radius: 7,
            active: selected,
            disabled,
          });
          this.addHitTarget(
            { x: innerX, y: rowY, width: innerWidth, height: rowHeight },
            disabled ? { type: 'blockCanvasModal' } : { type: 'toggleArmyFormationMember', personId: person.id },
          );
        });
      }

      const bottomY = y + panelHeight - 50;
      const pageButtonWidth = 72;
      this.drawButton(innerX, bottomY, pageButtonWidth, 34, '上一页', { size: 11, radius: 8, disabled: page <= 0 });
      this.addHitTarget({ x: innerX, y: bottomY, width: pageButtonWidth, height: 34 }, page <= 0 ? { type: 'blockCanvasModal' } : { type: 'changeArmyFormationPage', delta: -1 });
      this.drawText(`${page + 1}/${pages}`, innerX + pageButtonWidth + 34, bottomY + 17, {
        size: 11,
        color: '#cbbd96',
        align: 'center',
        baseline: 'middle',
      });
      this.drawButton(innerX + pageButtonWidth + 58, bottomY, pageButtonWidth, 34, '下一页', { size: 11, radius: 8, disabled: page >= pages - 1 });
      this.addHitTarget({ x: innerX + pageButtonWidth + 58, y: bottomY, width: pageButtonWidth, height: 34 }, page >= pages - 1 ? { type: 'blockCanvasModal' } : { type: 'changeArmyFormationPage', delta: 1 });
      const saveX = x + panelWidth - 104;
      this.drawButton(saveX, bottomY, 88, 34, '保存', {
        size: 12,
        bold: true,
        radius: 8,
        active: true,
        disabled: Boolean(editor.saving),
      });
      this.addHitTarget({ x: saveX, y: bottomY, width: 88, height: 34 }, editor.saving ? { type: 'blockCanvasModal' } : { type: 'saveArmyFormation' });
    }
  }

  global.ArmyFormationEditorCanvasRenderer = ArmyFormationEditorCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArmyFormationEditorCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
