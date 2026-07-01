(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class ArmyFormationEditorCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get ctx() {
      return this.host?.ctx;
    }

    get height() {
      return Number(this.host?.height) || 0;
    }

    get presenter() {
      return this.host?.presenter;
    }

    get width() {
      return Number(this.host?.width) || 0;
    }

    t(key, params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    addHitTarget(...args) { const surface = this.drawingSurface; return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args); }
    createGradient(...args) { const surface = this.drawingSurface; return surface && typeof surface.createGradient === 'function' ? surface.createGradient(...args) : this.host?.createGradient?.(...args); }
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    drawTextLines(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawTextLines === 'function' ? surface.drawTextLines(...args) : this.host?.drawTextLines?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }
    wrapTextLimit(...args) { const surface = this.drawingSurface; return surface && typeof surface.wrapTextLimit === 'function' ? surface.wrapTextLimit(...args) : this.host?.wrapTextLimit?.(...args); }

    renderArmyFormationPortrait(...args) {
      return this.host?.renderArmyFormationPortrait?.(...args);
    }

    renderArmyFormationEditor(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildMilitaryViewState !== 'function') return;
      const editor = options.armyFormationEditor || {};
      if (!editor.open) return;
      const view = this.presenter.buildMilitaryViewState(state);
      const slot = Math.max(1, Math.min(3, Number(editor.slot) || 1));
      const formation = (view.formations || []).find((item) => Number(item.slot) === slot)
        || {
          slot,
          cityId: view.formationMeta?.cityId || state.activeCityId || 'capital',
          name: this.t('military.formation.default', { slot }),
          members: [],
          memberIds: [],
          maxMembers: 5,
        };
      const allPeople = Array.isArray(view.formationPeople) ? view.formationPeople : [];
      const memberIds = Array.isArray(editor.memberIds) ? editor.memberIds : formation.memberIds || [];
      const selectedIds = new Set(memberIds);
      const peopleById = new Map(allPeople.map((person) => [person.id, person]));
      const selectedMembers = memberIds.map((personId) => peopleById.get(personId)).filter(Boolean);
      const maxMembers = formation.maxMembers || view.formationMeta?.maxMembers || 5;
      const maxSoldiersPerMember = Math.max(0, Math.floor(Number(formation.maxSoldiersPerMember || view.formationMeta?.perMemberSoldierCap || 1000) || 1000));
      const confirmedAssignments = editor.soldierAssignments && typeof editor.soldierAssignments === 'object'
        ? editor.soldierAssignments
        : formation.soldierAssignments || {};
      const draftAssignments = editor.soldierDraftAssignments && typeof editor.soldierDraftAssignments === 'object'
        ? editor.soldierDraftAssignments
        : confirmedAssignments;
      const previousAssigned = Math.max(0, Math.floor(Number(formation.soldiersAssigned) || 0));
      const reserveSoldiers = Math.max(0, Math.floor(Number(view.formationMeta?.availableReserveSoldiers ?? state.military?.soldiers) || 0));
      const editableSoldierPool = previousAssigned + reserveSoldiers;
      const currentAssigned = memberIds.reduce((sum, personId) => (
        sum + Math.max(0, Math.floor(Number(confirmedAssignments?.[personId]) || 0))
      ), 0);
      const draftAssigned = memberIds.reduce((sum, personId) => (
        sum + Math.max(0, Math.floor(Number(draftAssignments?.[personId]) || 0))
      ), 0);
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
      const formationName = formation.name || this.t('military.formation.default', { slot });
      this.drawText(this.t('military.formation.editor.title', { name: formationName }), x + 18, y + 16, { size: 18, bold: true, color: '#ffe6b5' });
      this.drawText(this.t(
        'military.formation.editor.selected',
        { selected: selectedIds.size, maxMembers }), x + 18, y + 43, { size: 12, color: '#cbbd96' });
      this.drawButton(x + panelWidth - closeSize - 10, y + 10, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: x + panelWidth - closeSize - 10, y: y + 10, width: closeSize, height: closeSize }, { type: 'closeArmyFormationEditor' });

      const innerX = x + 14;
      const innerWidth = panelWidth - 28;
      const summaryY = y + 72;
      this.drawPanel(innerX, summaryY, innerWidth, 186, {
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
        this.drawText(index === 0
          ? this.t('military.formation.editor.leaderSlot', {})
          : this.t('military.formation.editor.memberSlot', {}), slotX + slotSize / 2, summaryY + 67, {
          size: 9,
          color: member ? '#ffe6b5' : 'rgba(255, 230, 181, 0.46)',
          align: 'center',
        });
        if (member) {
          const confirmed = Math.max(0, Math.floor(Number(confirmedAssignments?.[member.id]) || 0));
          const assigned = Math.max(0, Math.floor(Number(draftAssignments?.[member.id]) || 0));
          const sliderY = summaryY + 82;
          const sliderHeight = 10;
          const ratio = maxSoldiersPerMember > 0 ? Math.max(0, Math.min(1, assigned / maxSoldiersPerMember)) : 0;
          this.drawPanel(slotX, sliderY, slotSize, sliderHeight, {
            fill: 'rgba(9, 13, 14, 0.82)',
            stroke: 'rgba(255, 226, 177, 0.12)',
            radius: 5,
          });
          if (this.ctx) {
            this.ctx.fillStyle = '#74d3a0';
            this.ctx.fillRect(slotX + 1, sliderY + 1, Math.max(0, (slotSize - 2) * ratio), sliderHeight - 2);
          }
          const thumbX = slotX + Math.max(1, Math.min(slotSize - 3, Math.round((slotSize - 2) * ratio)));
          this.drawPanel(thumbX - 3, sliderY - 2, 6, sliderHeight + 4, {
            fill: '#ffe6b5',
            stroke: 'rgba(0, 0, 0, 0.28)',
            radius: 3,
          });
          const inputY = sliderY + 17;
          this.drawPanel(slotX, inputY, slotSize, 22, {
            fill: 'rgba(11, 15, 15, 0.82)',
            stroke: 'rgba(116, 211, 160, 0.28)',
            radius: 5,
          });
          this.drawText(`${assigned}`, slotX + slotSize / 2, inputY + 11, {
            size: 10,
            color: '#dff9cf',
            align: 'center',
            baseline: 'middle',
          });
          this.drawText(`/${maxSoldiersPerMember}`, slotX + slotSize / 2, inputY + 32, {
            size: 8,
            color: confirmed === assigned ? '#9da783' : '#ffd27d',
            align: 'center',
          });
          for (let segment = 0; segment < 5; segment += 1) {
            this.addHitTarget(
              { x: slotX + (slotSize / 5) * segment, y: sliderY - 6, width: slotSize / 5, height: 22 },
              { type: 'changeArmyFormationSoldiers', personId: member.id, ratio: (segment + 1) / 5 },
            );
          }
          this.addHitTarget(
            { x: slotX, y: inputY, width: slotSize, height: 22 },
            { type: 'requestArmyFormationSoldierInput', personId: member.id },
          );
        }
      }

      const autoY = summaryY + 154;
      this.drawText(this.t(
        'military.formation.editor.reserveLine',
        { reserve: reserveSoldiers, pool: editableSoldierPool, confirmed: currentAssigned, draft: draftAssigned }), innerX + 10, autoY + 12, {
        size: 10,
        color: '#cbbd96',
      });
      const autoX = innerX + innerWidth - 70;
      this.drawButton(autoX, autoY, 60, 24, this.t('military.formation.editor.replenish', {}), {
        size: 10,
        radius: 7,
        active: true,
        disabled: selectedMembers.length <= 0 || editor.saving,
      });
      this.addHitTarget(
        { x: autoX, y: autoY, width: 60, height: 24 },
        selectedMembers.length <= 0 || editor.saving ? { type: 'blockCanvasModal' } : { type: 'autoReplenishArmyFormation' },
      );

      const listTop = summaryY + 204;
      this.drawText(this.t('military.formation.editor.rosterTitle', {}), innerX, listTop, { size: 13, bold: true, color: '#ffe6b5' });
      const pageSize = Math.max(2, Math.min(4, Math.floor((panelHeight - 354) / 58)));
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
        this.drawTextLines(this.wrapTextLimit(this.t('military.formation.editor.emptyPeople', {}), innerWidth - 28, 3, { size: 12 }), innerX + 14, listY + 18, {
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
          this.drawText(this.truncateText(person.name || this.t('military.formation.editor.unknownPerson', {}), nameWidth, { size: 13, bold: true }), innerX + 58, rowY + 9, {
            size: 13,
            bold: true,
            color: disabled ? '#8d8f99' : '#fff1cf',
          });
          this.drawText(this.truncateText(`${person.qualityLabel || ''} · ${person.roleText || person.title || ''}`, nameWidth, { size: 10 }), innerX + 58, rowY + 30, {
            size: 10,
            color: disabled ? 'rgba(174, 176, 184, 0.48)' : '#cbbd96',
          });
          this.drawButton(innerX + innerWidth - 64, rowY + 12, 50, 30, selected
            ? this.t('military.formation.editor.remove', {})
            : this.t('military.formation.editor.add', {}), {
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
      this.drawButton(innerX, bottomY, pageButtonWidth, 34, this.t('common.previousPage', {}), { size: 11, radius: 8, disabled: page <= 0 });
      this.addHitTarget({ x: innerX, y: bottomY, width: pageButtonWidth, height: 34 }, page <= 0 ? { type: 'blockCanvasModal' } : { type: 'changeArmyFormationPage', delta: -1 });
      this.drawText(`${page + 1}/${pages}`, innerX + pageButtonWidth + 34, bottomY + 17, {
        size: 11,
        color: '#cbbd96',
        align: 'center',
        baseline: 'middle',
      });
      this.drawButton(innerX + pageButtonWidth + 58, bottomY, pageButtonWidth, 34, this.t('common.nextPage', {}), { size: 11, radius: 8, disabled: page >= pages - 1 });
      this.addHitTarget({ x: innerX + pageButtonWidth + 58, y: bottomY, width: pageButtonWidth, height: 34 }, page >= pages - 1 ? { type: 'blockCanvasModal' } : { type: 'changeArmyFormationPage', delta: 1 });
      const saveX = x + panelWidth - 104;
      this.drawButton(saveX, bottomY, 88, 34, this.t('common.save', {}), {
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
