(function (global) {
  function install(CanvasActionController) {
    if (!CanvasActionController?.prototype) return false;
    Object.assign(CanvasActionController.prototype, {
      finalizeTalentPolicyApply(result, action = {}) {
        const closeAfterSuccess = (value) => {
          if (value !== false) {
            const game = this.getGameHost();
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

      handle_openTalentPolicy(action) {
        const game = this.getGameHost();
        const tab = 'people';
        this.host.showCityManagement = true;
        this.host.activeCityManagementTab = tab;
        this.closePanels(['showCityManagement']);
        if (game && game !== this.host) {
          game.showCityManagement = true;
          game.activeCityManagementTab = tab;
        }
        if (game?.canvasShell && game.canvasShell !== this.host) {
          game.canvasShell.showCityManagement = true;
          game.canvasShell.activeCityManagementTab = tab;
        }
        const handled = this.afterHandled(action);
        const result = game?.tutorialController?.onTalentPolicyOpened?.();
        const refreshAfterTutorialAdvance = () => {
          this.host.showCityManagement = true;
          this.host.activeCityManagementTab = tab;
          if (game && game !== this.host) {
            game.showCityManagement = true;
            game.activeCityManagementTab = tab;
          }
          if (game?.canvasShell && game.canvasShell !== this.host) {
            game.canvasShell.showCityManagement = true;
            game.canvasShell.activeCityManagementTab = tab;
          }
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
    });
    return true;
  }

  const CanvasTalentPolicyActionHandlers = { install };
  global.CanvasTalentPolicyActionHandlers = CanvasTalentPolicyActionHandlers;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasTalentPolicyActionHandlers;
})(typeof globalThis !== 'undefined' ? globalThis : window);
