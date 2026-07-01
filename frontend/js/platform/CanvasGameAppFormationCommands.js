(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  // Army-formation command handlers, extracted from CanvasGameAppCommands to give the
  // formation responsibility its own single-purpose module (mixin onto CanvasGameApp).
  function install(CanvasGameApp) {
    if (!CanvasGameApp?.prototype) return false;
    Object.assign(CanvasGameApp.prototype, {
      getArmyFormation(cityId, slot) {
        const targetCityId =
          cityId || this.state?.activeCityId || this.state?.cityState?.activeCityId || 'capital';
        const targetSlot = Math.max(1, Math.min(3, Number(slot) || 1));
        const formations = this.state?.military?.formations || {};
        const cityFormations = Array.isArray(formations[targetCityId])
          ? formations[targetCityId]
          : [];
        return (
          cityFormations.find((item) => Number(item?.slot) === targetSlot) ||
          cityFormations[targetSlot - 1] ||
          null
        );
      },

      getArmyFormationSoldierCap(cityId, slot) {
        const formation = this.getArmyFormation(cityId, slot);
        return Math.max(0, Math.floor(Number(formation?.maxSoldiersPerMember) || 1000));
      },

      getArmyFormationReserveSoldiers(cityId) {
        const targetCityId =
          cityId || this.state?.activeCityId || this.state?.cityState?.activeCityId || 'capital';
        const cityMilitary =
          this.state?.cities?.[targetCityId]?.military || this.state?.military || {};
        return Math.max(0, Math.floor(Number(cityMilitary.soldiers) || 0));
      },

      normalizeArmyFormationAssignments(assignments = {}, memberIds = [], cap = 1000) {
        const max = Math.max(0, Math.floor(Number(cap) || 1000));
        const result = {};
        (Array.isArray(memberIds) ? memberIds : []).forEach((memberId) => {
          const id = String(memberId || '').trim();
          if (!id) return;
          result[id] = Math.max(0, Math.min(max, Math.floor(Number(assignments?.[id]) || 0)));
        });
        return result;
      },

      sumArmyFormationAssignments(assignments = {}) {
        return Object.values(
          assignments && typeof assignments === 'object' ? assignments : {},
        ).reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0);
      },

      createArmyFormationEditorState(editor = {}) {
        return {
          open: false,
          cityId: '',
          slot: 1,
          memberIds: [],
          soldierAssignments: {},
          soldierDraftAssignments: {},
          page: 0,
          saving: false,
          ...(editor || {}),
        };
      },

      getArmyFormationEditablePool(editor = {}) {
        const cityId = editor.cityId || this.state?.activeCityId || 'capital';
        const slot = Math.max(1, Math.min(3, Number(editor.slot) || 1));
        const formation = this.getArmyFormation(cityId, slot) || {};
        const previousAssigned = this.sumArmyFormationAssignments(
          formation.soldierAssignments || {},
        );
        return previousAssigned + this.getArmyFormationReserveSoldiers(cityId);
      },

      setArmyFormationSoldierDraft(personId, value, options = {}) {
        const editor = this.armyFormationEditor || {};
        if (!editor.open) return false;
        const id = String(personId || '').trim();
        const memberIds = Array.isArray(editor.memberIds) ? editor.memberIds : [];
        if (!id || !memberIds.includes(id)) return false;
        const cap = this.getArmyFormationSoldierCap(editor.cityId, editor.slot);
        const assignments = this.normalizeArmyFormationAssignments(
          editor.soldierDraftAssignments || editor.soldierAssignments || {},
          memberIds,
          cap,
        );
        const pool = this.getArmyFormationEditablePool(editor);
        const others = memberIds.reduce(
          (sum, memberId) =>
            memberId === id
              ? sum
              : sum + Math.max(0, Math.floor(Number(assignments[memberId]) || 0)),
          0,
        );
        assignments[id] = Math.max(0, Math.min(cap, pool - others, Math.floor(Number(value) || 0)));
        return this.setArmyFormationEditor(
          { ...editor, soldierDraftAssignments: assignments },
          { render: options.render !== false },
        );
      },

      setArmyFormationEditor(editor = {}, options = {}) {
        const next = this.createArmyFormationEditorState(editor);
        const cap = this.getArmyFormationSoldierCap(next.cityId, next.slot);
        next.memberIds = Array.isArray(next.memberIds) ? next.memberIds.slice(0, 5) : [];
        next.soldierAssignments = this.normalizeArmyFormationAssignments(
          next.soldierAssignments || {},
          next.memberIds,
          cap,
        );
        next.soldierDraftAssignments = this.normalizeArmyFormationAssignments(
          next.soldierDraftAssignments || next.soldierAssignments || {},
          next.memberIds,
          cap,
        );
        this.armyFormationEditor = next;
        if (this.canvasShell && typeof this.canvasShell === 'object') {
          this.canvasShell.armyFormationEditor = { ...this.armyFormationEditor };
        }
        if (options.render !== false) this.renderCanvasSurface(this.state?.currentTab);
        return true;
      },

      openArmyFormation(action = {}) {
        const slot = Math.max(1, Math.min(3, Number(action.slot) || 1));
        const cityId =
          action.cityId ||
          this.state?.activeCityId ||
          this.state?.cityState?.activeCityId ||
          'capital';
        const formation = this.getArmyFormation(cityId, slot);
        const memberIds = Array.isArray(formation?.memberIds) ? formation.memberIds : [];
        const cap = this.getArmyFormationSoldierCap(cityId, slot);
        return this.setArmyFormationEditor({
          open: true,
          cityId,
          slot,
          memberIds: [...memberIds].slice(0, 5),
          soldierAssignments: this.normalizeArmyFormationAssignments(
            formation?.soldierAssignments || {},
            memberIds,
            cap,
          ),
          soldierDraftAssignments: this.normalizeArmyFormationAssignments(
            formation?.soldierAssignments || {},
            memberIds,
            cap,
          ),
          page: 0,
          saving: false,
        });
      },

      closeArmyFormationEditor(options = {}) {
        return this.setArmyFormationEditor(this.createArmyFormationEditorState(), options);
      },

      toggleArmyFormationMember(action = {}) {
        const editor = this.armyFormationEditor || {};
        if (!editor.open) return false;
        const personId = String(action.personId || '').trim();
        if (!personId) return false;
        const memberIds = Array.isArray(editor.memberIds) ? [...editor.memberIds] : [];
        const assignments = { ...(editor.soldierAssignments || {}) };
        const draftAssignments = {
          ...(editor.soldierDraftAssignments || editor.soldierAssignments || {}),
        };
        const index = memberIds.indexOf(personId);
        if (index >= 0) {
          memberIds.splice(index, 1);
          delete assignments[personId];
          delete draftAssignments[personId];
        } else {
          if (memberIds.length >= 5) {
            this.showFloatingText(t('command.formation.full'));
            return false;
          }
          memberIds.push(personId);
          assignments[personId] = 0;
          draftAssignments[personId] = 0;
        }
        return this.setArmyFormationEditor(
          {
            ...editor,
            memberIds,
            soldierAssignments: this.normalizeArmyFormationAssignments(
              assignments,
              memberIds,
              this.getArmyFormationSoldierCap(editor.cityId, editor.slot),
            ),
            soldierDraftAssignments: this.normalizeArmyFormationAssignments(
              draftAssignments,
              memberIds,
              this.getArmyFormationSoldierCap(editor.cityId, editor.slot),
            ),
          },
          { render: true },
        );
      },

      changeArmyFormationPage(action = {}) {
        const editor = this.armyFormationEditor || {};
        if (!editor.open) return false;
        const page = Math.max(0, (Number(editor.page) || 0) + (Number(action.delta) || 0));
        return this.setArmyFormationEditor({ ...editor, page }, { render: true });
      },

      changeArmyFormationSoldiers(action = {}) {
        const editor = this.armyFormationEditor || {};
        if (!editor.open || editor.saving) return false;
        const cap = this.getArmyFormationSoldierCap(editor.cityId, editor.slot);
        const ratio = Math.max(0, Math.min(1, Number(action.ratio) || 0));
        return this.setArmyFormationSoldierDraft(action.personId, Math.round(cap * ratio));
      },

      async requestArmyFormationSoldierInput(action = {}) {
        const editor = this.armyFormationEditor || {};
        if (!editor.open || editor.saving) return false;
        const personId = String(action.personId || '').trim();
        if (!personId) return false;
        const current = Math.max(
          0,
          Math.floor(
            Number(
              editor.soldierDraftAssignments?.[personId] ?? editor.soldierAssignments?.[personId],
            ) || 0,
          ),
        );
        const input =
          typeof this.runtime?.requestTextInput === 'function'
            ? await this.runtime.requestTextInput({
                title: t('command.formation.soldierTitle'),
                message: t('command.formation.soldierPrompt'),
                placeholder: '0',
                value: String(current),
                inputType: 'number',
              })
            : global.prompt?.(t('command.formation.soldierTitle'), String(current));
        if (input === null || input === undefined || input === '') return false;
        return this.setArmyFormationSoldierDraft(personId, input);
      },

      autoReplenishArmyFormation() {
        const editor = this.armyFormationEditor || {};
        if (!editor.open || editor.saving) return false;
        const memberIds = Array.isArray(editor.memberIds) ? editor.memberIds : [];
        if (!memberIds.length) return false;
        const cap = this.getArmyFormationSoldierCap(editor.cityId, editor.slot);
        let remaining = this.getArmyFormationEditablePool(editor);
        const assignments = {};
        let active = [...memberIds];
        while (active.length && remaining > 0) {
          const share = Math.max(1, Math.floor(remaining / active.length));
          const nextActive = [];
          active.forEach((memberId) => {
            const current = assignments[memberId] || 0;
            const add = Math.min(cap - current, share, remaining);
            assignments[memberId] = current + add;
            remaining -= add;
            if (assignments[memberId] < cap) nextActive.push(memberId);
          });
          if (nextActive.length === active.length && share <= 0) break;
          active = nextActive;
        }
        return this.setArmyFormationEditor(
          {
            ...editor,
            soldierDraftAssignments: this.normalizeArmyFormationAssignments(
              assignments,
              memberIds,
              cap,
            ),
          },
          { render: true },
        );
      },

      async saveArmyFormation() {
        const editor = this.armyFormationEditor || {};
        if (!editor.open || editor.saving) return false;
        const cityId = editor.cityId || this.state?.activeCityId || 'capital';
        const slot = Math.max(1, Math.min(3, Number(editor.slot) || 1));
        const memberIds = (Array.isArray(editor.memberIds) ? editor.memberIds : []).slice(0, 5);
        const soldierAssignments = this.normalizeArmyFormationAssignments(
          editor.soldierDraftAssignments || editor.soldierAssignments || {},
          memberIds,
          this.getArmyFormationSoldierCap(cityId, slot),
        );
        this.setArmyFormationEditor({ ...editor, saving: true }, { render: true });
        try {
          const result = await this.getGameApi().setArmyFormation(
            cityId,
            slot,
            memberIds,
            soldierAssignments,
          );
          this.applyApiState(result);
          this.closeArmyFormationEditor({ render: false });
          const tutorialHandled = this.tutorialController?.onArmyFormationSaved?.(result) === true;
          this.showFloatingText(result.message || t('command.formation.saved'));
          this.log(result.message || t('command.formation.saved'));
          if (!tutorialHandled) {
            this.tutorialController?.sync?.(this.tutorial);
            this.tutorialController?.refreshCurrentHighlight?.();
            this.renderCanvasSurface(this.state?.currentTab);
          }
          return true;
        } catch (error) {
          const message =
            error.payload?.message || error.message || t('command.formation.saveFailed');
          this.setArmyFormationEditor({ ...editor, saving: false }, { render: false });
          this.showFloatingText(message);
          this.log(message);
          this.renderCanvasSurface(this.state?.currentTab);
          return false;
        }
      },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameAppFormationCommands = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
