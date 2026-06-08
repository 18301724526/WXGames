(function (global) {
  function install(CanvasActionController) {
    if (!CanvasActionController?.prototype) return false;
    Object.assign(CanvasActionController.prototype, {
      finalizeTalentPolicyApply(result, action = {}) {
        const closeAfterSuccess = (value) => {
          if (value !== false) {
            this.host.showTalentPolicy = false;
            const game = this.getGameHost();
            if (game && game !== this.host && 'showTalentPolicy' in game) game.showTalentPolicy = false;
            game?.tutorialController?.onTalentPolicyApplied?.(value || {});
            this.afterHandled(action);
            game?.tutorialController?.refreshCurrentHighlight?.();
          }
          return value !== false;
        };
        if (!result || typeof result.then !== 'function') return closeAfterSuccess(result);
        if (this.awaitAsync) return result.then(closeAfterSuccess);
        result.then(closeAfterSuccess).catch((error) => this.log?.(error));
        return true;
      },

      syncTalentPolicyPanelOpen(open = true) {
        const game = this.getGameHost();
        this.host.showTalentPolicy = Boolean(open);
        if (game && game !== this.host && 'showTalentPolicy' in game) {
          game.showTalentPolicy = Boolean(open);
        }
        if (game?.canvasShell && game.canvasShell !== this.host && 'showTalentPolicy' in game.canvasShell) {
          game.canvasShell.showTalentPolicy = Boolean(open);
        }
        return game;
      },

      getTalentPolicyDraft() {
        const game = this.getGameHost();
        if (typeof game?.getTalentPolicyDraft === 'function') return game.getTalentPolicyDraft();
        const state = this.getState();
        const policies = state?.talentPolicies || {};
        const uiState = this.host?.talentPolicyUiState || {};
        const systemPolicies = Array.isArray(policies.systemPolicies) ? policies.systemPolicies : [];
        const activeIsSystem = systemPolicies.some((policy) => policy.id === policies.activePolicyId);
        const basePolicyId = uiState.basePolicyId
          || uiState.selectedBasePolicyId
          || (activeIsSystem ? policies.activePolicyId : null)
          || policies.activeDraft?.basePolicyId
          || 'balanced';
        const defaults = policies.defaultTiers || { agriculture: 2, knowledge: 2, industry: 2 };
        return {
          basePolicyId,
          tiers: {
            agriculture: Number(uiState.tiers?.agriculture ?? defaults.agriculture ?? 2),
            knowledge: Number(uiState.tiers?.knowledge ?? defaults.knowledge ?? 2),
            industry: Number(uiState.tiers?.industry ?? defaults.industry ?? 2),
          },
        };
      },

      isDefaultTalentPolicyDraft(draft = {}) {
        const tiers = draft.tiers || {};
        return ['agriculture', 'knowledge', 'industry'].every((key) => Number(tiers[key] ?? 2) === 2);
      },

      handle_openTalentPolicy(action) {
        const game = this.syncTalentPolicyPanelOpen(true);
        this.closePanels(['showTalentPolicy']);
        const handled = this.afterHandled(action);
        const result = game?.tutorialController?.onTalentPolicyOpened?.();
        const refreshAfterTutorialAdvance = () => {
          this.syncTalentPolicyPanelOpen(true);
          this.render(action);
          game?.tutorialController?.refreshCurrentHighlight?.();
        };
        if (result && typeof result.then === 'function') {
          result.then(refreshAfterTutorialAdvance).catch((error) => this.log?.(error));
        } else {
          refreshAfterTutorialAdvance();
        }
        return handled;
      },

      handle_closeTalentPolicy(action) {
        this.host.showTalentPolicy = false;
        return this.afterHandled(action);
      },

      handle_setTalentPolicyTier(action) {
        const game = this.getGameHost();
        const target = game && game !== this.host ? game : this.host;
        if (!target.talentPolicyUiState || typeof target.talentPolicyUiState !== 'object') target.talentPolicyUiState = {};
        target.talentPolicyUiState.tiers = {
          ...(target.talentPolicyUiState.tiers || {}),
          [action.tendency]: action.tier,
        };
        if (game && game !== this.host) this.host.talentPolicyUiState = target.talentPolicyUiState;
        return this.afterHandled(action);
      },

      handle_selectTalentPolicyBase(action) {
        const game = this.getGameHost();
        const target = game && game !== this.host ? game : this.host;
        if (!target.talentPolicyUiState || typeof target.talentPolicyUiState !== 'object') target.talentPolicyUiState = {};
        target.talentPolicyUiState = {
          ...target.talentPolicyUiState,
          basePolicyId: action.policyId || 'balanced',
          ...(action.resetTiers ? { tiers: { agriculture: 2, knowledge: 2, industry: 2 } } : {}),
        };
        if (game && game !== this.host) this.host.talentPolicyUiState = target.talentPolicyUiState;
        return this.afterHandled(action);
      },

      handle_resetTalentPolicyDraft(action) {
        const game = this.getGameHost();
        const target = game && game !== this.host ? game : this.host;
        target.talentPolicyUiState = {};
        if (game && game !== this.host) this.host.talentPolicyUiState = {};
        return this.afterHandled(action);
      },

      handle_applyTalentPolicy(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) {
          return this.finalizeTalentPolicyApply(forwarded, action);
        }
        const game = this.getGameHost();
        if (typeof game?.applyTalentPolicy === 'function') {
          return this.finalizeTalentPolicyApply(game.applyTalentPolicy(action.policyId), action);
        }
        return this.finalizeTalentPolicyApply(
          this.runAction(() => this.host.api.applyTalentPolicy(action.policyId)),
          action,
        );
      },

      handle_applyTalentPolicyDraft(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) {
          return this.finalizeTalentPolicyApply(forwarded, action);
        }
        const game = this.getGameHost();
        if (typeof game?.applyTalentPolicyDraft === 'function') {
          return this.finalizeTalentPolicyApply(game.applyTalentPolicyDraft(), action);
        }
        const draft = this.host?.talentPolicyUiState || {};
        return this.finalizeTalentPolicyApply(
          this.runAction(() => this.host.api.applyTalentPolicy(null, draft)),
          action,
        );
      },

      handle_confirmTalentPolicy(action) {
        const draft = this.getTalentPolicyDraft();
        if (this.host?.talentPolicyUiState && typeof this.host.talentPolicyUiState === 'object') {
          this.host.talentPolicyUiState = {
            ...this.host.talentPolicyUiState,
            basePolicyId: draft.basePolicyId,
            tiers: { ...(draft.tiers || {}) },
          };
        }
        const game = this.getGameHost();
        if (game && game !== this.host && 'talentPolicyUiState' in game) {
          game.talentPolicyUiState = this.host.talentPolicyUiState;
        }
        if (this.isDefaultTalentPolicyDraft(draft) && draft.basePolicyId) {
          return this.handle_applyTalentPolicy({ ...action, type: 'applyTalentPolicy', policyId: draft.basePolicyId });
        }
        return this.handle_applyTalentPolicyDraft({ ...action, type: 'applyTalentPolicyDraft' });
      },

      handle_saveTalentPolicyDraft(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return forwarded !== false;
        const game = this.getGameHost();
        if (typeof game?.saveTalentPolicyDraft === 'function') return this.finalize(game.saveTalentPolicyDraft());
        const draft = this.host?.talentPolicyUiState || {};
        return this.finalize(this.runAction(() => this.host.api.saveTalentPolicy(draft)));
      },

      handle_deleteTalentPolicy(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return forwarded !== false;
        const game = this.getGameHost();
        if (typeof game?.deleteTalentPolicy === 'function') return this.finalize(game.deleteTalentPolicy(action.policyId));
        return this.finalize(this.runAction(() => this.host.api.deleteTalentPolicy(action.policyId)));
      },
    });
    return true;
  }

  const CanvasTalentPolicyActionHandlers = { install };
  global.CanvasTalentPolicyActionHandlers = CanvasTalentPolicyActionHandlers;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasTalentPolicyActionHandlers;
})(typeof globalThis !== 'undefined' ? globalThis : window);
