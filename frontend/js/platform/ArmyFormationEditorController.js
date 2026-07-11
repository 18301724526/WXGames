// ArmyFormationEditorController -- SHAPE-B (stateful plain class) owner of the
// army-formation editor blob, extracted from CanvasGameApp (god-file re-decomposition
// slice 6).
//
// Single-owner rule: UiRuntimeStateStore owns the editor state on the state host
// (StateWriter.getStateHost -- the mounted game for a shell, the app itself otherwise).
// The controller owns the editor behavior and reads/writes that store, so App, Shell,
// CanvasActionController, CanvasModeOwnershipRuntime and the tutorial layer observe
// the same value.
//
// The controller reaches its host only through explicit facilities: getState(),
// renderCanvasSurface(), showFloatingText(), log(), getGameApi(), applyApiState(),
// tutorialController, runtime.requestTextInput. Formation queries go straight to
// ArmyFormationQueries (SHAPE-A) with the same host.
(function (global) {
  var LocaleText = global.LocaleText;
  if (typeof module !== 'undefined' && module.exports && !LocaleText) {
    try {
      LocaleText = require('../ecs/resource/LocaleText');
    } catch (_error) {
      LocaleText = null;
    }
  }
  var ArmyFormationQueries = global.ArmyFormationQueries;
  if (typeof module !== 'undefined' && module.exports && !ArmyFormationQueries) {
    ArmyFormationQueries = require('./ArmyFormationQueries');
  }
  var UiRuntimeStateStore = global.UiRuntimeStateStore;
  if (typeof module !== 'undefined' && module.exports && !UiRuntimeStateStore) {
    UiRuntimeStateStore = require('../state/UiRuntimeStateStore');
  }

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function createArmyFormationEditorState(editor = {}) {
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
  }

  function normalizeArmyFormationAssignments(assignments = {}, memberIds = [], cap = 1000) {
    const max = Math.max(0, Math.floor(Number(cap) || 1000));
    const result = {};
    (Array.isArray(memberIds) ? memberIds : []).forEach((memberId) => {
      const id = String(memberId || '').trim();
      if (!id) return;
      result[id] = Math.max(0, Math.min(max, Math.floor(Number(assignments?.[id]) || 0)));
    });
    return result;
  }

  function sumArmyFormationAssignments(assignments = {}) {
    return Object.values(assignments && typeof assignments === 'object' ? assignments : {}).reduce(
      (sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)),
      0,
    );
  }

  class ArmyFormationEditorController {
    constructor({ host } = {}) {
      this.host = host || null;
      UiRuntimeStateStore?.ensure?.(this.host);
    }

    get editor() {
      return UiRuntimeStateStore?.getFormationEditor?.(this.host)
        || createArmyFormationEditorState();
    }

    set editor(value) {
      UiRuntimeStateStore?.setField?.(this.host, 'armyFormationEditor', value);
    }

    // Legacy direct assignments are normalized by the canonical UI runtime store.
    replaceEditor(value) {
      this.editor = value;
      return true;
    }

    setEditor(editor = {}, options = {}) {
      const host = this.host;
      const next = createArmyFormationEditorState(editor);
      const cap = ArmyFormationQueries.getArmyFormationSoldierCap(host, next.cityId, next.slot);
      next.memberIds = Array.isArray(next.memberIds) ? next.memberIds.slice(0, 5) : [];
      next.soldierAssignments = normalizeArmyFormationAssignments(
        next.soldierAssignments || {},
        next.memberIds,
        cap,
      );
      next.soldierDraftAssignments = normalizeArmyFormationAssignments(
        next.soldierDraftAssignments || next.soldierAssignments || {},
        next.memberIds,
        cap,
      );
      this.editor = next;
      if (options.render !== false) host.renderCanvasSurface(host.getState()?.currentTab);
      return true;
    }

    open(action = {}) {
      const host = this.host;
      const state = host.getState() || {};
      const slot = Math.max(1, Math.min(3, Number(action.slot) || 1));
      const cityId =
        action.cityId || state.activeCityId || state.cityState?.activeCityId || 'capital';
      const formation = ArmyFormationQueries.getArmyFormation(host, cityId, slot);
      const memberIds = Array.isArray(formation?.memberIds) ? formation.memberIds : [];
      const cap = ArmyFormationQueries.getArmyFormationSoldierCap(host, cityId, slot);
      return this.setEditor({
        open: true,
        cityId,
        slot,
        memberIds: [...memberIds].slice(0, 5),
        soldierAssignments: normalizeArmyFormationAssignments(
          formation?.soldierAssignments || {},
          memberIds,
          cap,
        ),
        soldierDraftAssignments: normalizeArmyFormationAssignments(
          formation?.soldierAssignments || {},
          memberIds,
          cap,
        ),
        page: 0,
        saving: false,
      });
    }

    close(options = {}) {
      return this.setEditor(createArmyFormationEditorState(), options);
    }

    toggleMember(action = {}) {
      const host = this.host;
      const editor = this.editor || {};
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
          host.showFloatingText(t('command.formation.full'));
          return false;
        }
        memberIds.push(personId);
        assignments[personId] = 0;
        draftAssignments[personId] = 0;
      }
      const cap = ArmyFormationQueries.getArmyFormationSoldierCap(host, editor.cityId, editor.slot);
      return this.setEditor(
        {
          ...editor,
          memberIds,
          soldierAssignments: normalizeArmyFormationAssignments(assignments, memberIds, cap),
          soldierDraftAssignments: normalizeArmyFormationAssignments(
            draftAssignments,
            memberIds,
            cap,
          ),
        },
        { render: true },
      );
    }

    changePage(action = {}) {
      const editor = this.editor || {};
      if (!editor.open) return false;
      const page = Math.max(0, (Number(editor.page) || 0) + (Number(action.delta) || 0));
      return this.setEditor({ ...editor, page }, { render: true });
    }

    changeSoldiers(action = {}) {
      const editor = this.editor || {};
      if (!editor.open || editor.saving) return false;
      const cap = ArmyFormationQueries.getArmyFormationSoldierCap(
        this.host,
        editor.cityId,
        editor.slot,
      );
      const ratio = Math.max(0, Math.min(1, Number(action.ratio) || 0));
      return this.setSoldierDraft(action.personId, Math.round(cap * ratio));
    }

    setSoldierDraft(personId, value, options = {}) {
      const host = this.host;
      const editor = this.editor || {};
      if (!editor.open) return false;
      const id = String(personId || '').trim();
      const memberIds = Array.isArray(editor.memberIds) ? editor.memberIds : [];
      if (!id || !memberIds.includes(id)) return false;
      const cap = ArmyFormationQueries.getArmyFormationSoldierCap(host, editor.cityId, editor.slot);
      const assignments = normalizeArmyFormationAssignments(
        editor.soldierDraftAssignments || editor.soldierAssignments || {},
        memberIds,
        cap,
      );
      const pool = ArmyFormationQueries.getArmyFormationEditablePool(host, editor);
      const others = memberIds.reduce(
        (sum, memberId) =>
          memberId === id ? sum : sum + Math.max(0, Math.floor(Number(assignments[memberId]) || 0)),
        0,
      );
      assignments[id] = Math.max(0, Math.min(cap, pool - others, Math.floor(Number(value) || 0)));
      return this.setEditor(
        { ...editor, soldierDraftAssignments: assignments },
        { render: options.render !== false },
      );
    }

    async requestSoldierInput(action = {}) {
      const host = this.host;
      const editor = this.editor || {};
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
        typeof host.runtime?.requestTextInput === 'function'
          ? await host.runtime.requestTextInput({
              title: t('command.formation.soldierTitle'),
              message: t('command.formation.soldierPrompt'),
              placeholder: '0',
              value: String(current),
              inputType: 'number',
            })
          : global.prompt?.(t('command.formation.soldierTitle'), String(current));
      if (input === null || input === undefined || input === '') return false;
      return this.setSoldierDraft(personId, input);
    }

    autoReplenish() {
      const host = this.host;
      const editor = this.editor || {};
      if (!editor.open || editor.saving) return false;
      const memberIds = Array.isArray(editor.memberIds) ? editor.memberIds : [];
      if (!memberIds.length) return false;
      const cap = ArmyFormationQueries.getArmyFormationSoldierCap(host, editor.cityId, editor.slot);
      let remaining = ArmyFormationQueries.getArmyFormationEditablePool(host, editor);
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
      return this.setEditor(
        {
          ...editor,
          soldierDraftAssignments: normalizeArmyFormationAssignments(assignments, memberIds, cap),
        },
        { render: true },
      );
    }

    async save() {
      const host = this.host;
      const editor = this.editor || {};
      if (!editor.open || editor.saving) return false;
      const cityId = editor.cityId || host.getState()?.activeCityId || 'capital';
      const slot = Math.max(1, Math.min(3, Number(editor.slot) || 1));
      const memberIds = (Array.isArray(editor.memberIds) ? editor.memberIds : []).slice(0, 5);
      const soldierAssignments = normalizeArmyFormationAssignments(
        editor.soldierDraftAssignments || editor.soldierAssignments || {},
        memberIds,
        ArmyFormationQueries.getArmyFormationSoldierCap(host, cityId, slot),
      );
      this.setEditor({ ...editor, saving: true }, { render: true });
      try {
        const result = await host
          .getGameApi()
          .setArmyFormation(cityId, slot, memberIds, soldierAssignments);
        host.applyApiState(result);
        this.close({ render: false });
        const tutorialHandled = await Promise.resolve(
          host.emitTutorialEvent?.('armyFormationSaved', { result }),
        ) === true;
        host.showFloatingText(result.message || t('command.formation.saved'));
        host.log(result.message || t('command.formation.saved'));
        if (!tutorialHandled) {
          host.tutorialController?.sync?.(host.tutorial);
          host.renderCanvasSurface(host.getState()?.currentTab);
        }
        return true;
      } catch (error) {
        const message =
          error.payload?.message || error.message || t('command.formation.saveFailed');
        this.setEditor({ ...editor, saving: false }, { render: false });
        host.showFloatingText(message);
        host.log(message);
        host.renderCanvasSurface(host.getState()?.currentTab);
        return false;
      }
    }
  }

  ArmyFormationEditorController.createArmyFormationEditorState = createArmyFormationEditorState;
  ArmyFormationEditorController.normalizeArmyFormationAssignments =
    normalizeArmyFormationAssignments;
  ArmyFormationEditorController.sumArmyFormationAssignments = sumArmyFormationAssignments;
  Object.freeze(ArmyFormationEditorController);

  global.ArmyFormationEditorController = ArmyFormationEditorController;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArmyFormationEditorController;
  }
})(typeof window !== 'undefined' ? window : globalThis);
