(function (global) {
  const { openBlockingPanelSnapshot, closeBlockingPanelSnapshot } = global.CanvasBlockingPanelSnapshotCalls || (typeof require !== 'undefined' ? require('./CanvasBlockingPanelSnapshotCalls') : {});

  function install(CanvasActionController) {
    if (!CanvasActionController?.prototype) return false;
    Object.assign(CanvasActionController.prototype, {
      handle_openFamousPersons(action) {
        openBlockingPanelSnapshot(this.host, 'showFamousPersons', true);
        const game = this.getGameHost();
        const owner = game || this.host;
        owner.famousPersonsPage = 0;
        owner.selectedFamousPersonId = '';
        this.host.renderer?.clearFamousSkillTooltip?.();
        this.closePanels(['showFamousPersons']);
        const handled = this.afterHandled(action);
        const result = game?.tutorialController?.onFamousPersonsOpened?.();
        game?.tutorialController?.refreshCurrentHighlight?.();
        const scheduler = this.host?.runtime || game?.runtime || global;
        scheduler?.setTimeout?.(() => game?.tutorialController?.refreshCurrentHighlight?.(), 0);
        if (result?.catch) result.catch((error) => this.log?.(error));
        return handled;
      },

      handle_closeFamousPersons(action) {
        closeBlockingPanelSnapshot(this.host, 'showFamousPersons');
        const game = this.getGameHost();
        const owner = game || this.host;
        owner.famousPersonsPage = 0;
        owner.selectedFamousPersonId = '';
        this.host.renderer?.clearFamousSkillTooltip?.();
        const handled = this.afterHandled(action);
        const tutorial = game?.tutorialController || null;
        const result = tutorial?.onFamousPersonsClosed
          ? tutorial.onFamousPersonsClosed()
          : tutorial?.refreshCurrentHighlight?.();
        const scheduler = this.host?.runtime || game?.runtime || global;
        scheduler?.setTimeout?.(() => tutorial?.refreshCurrentHighlight?.(), 0);
        if (result?.catch) result.catch((error) => this.log?.(error));
        return handled;
      },

      handle_openFamousPersonDetail(action) {
        const game = this.getGameHost();
        const owner = game || this.host;
        owner.selectedFamousPersonId = action.personId || '';
        this.host.renderer?.clearFamousSkillTooltip?.();
        const handled = this.afterHandled(action);
        const result = game?.tutorialController?.onFamousPersonDetailOpened?.(action.personId || '');
        game?.tutorialController?.refreshCurrentHighlight?.();
        const scheduler = this.host?.runtime || game?.runtime || global;
        scheduler?.setTimeout?.(() => game?.tutorialController?.refreshCurrentHighlight?.(), 0);
        if (result?.catch) result.catch((error) => this.log?.(error));
        return handled;
      },

      handle_closeFamousPersonDetail(action) {
        const game = this.getGameHost();
        const owner = game || this.host;
        owner.selectedFamousPersonId = '';
        this.host.renderer?.clearFamousSkillTooltip?.();
        const handled = this.afterHandled(action);
        game?.tutorialController?.refreshCurrentHighlight?.();
        const scheduler = this.host?.runtime || game?.runtime || global;
        scheduler?.setTimeout?.(() => game?.tutorialController?.refreshCurrentHighlight?.(), 0);
        return handled;
      },

      handle_seekFamousPerson(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const game = this.getGameHost();
        if (typeof game?.seekFamousPerson === 'function') {
          return this.finalize(Promise.resolve(game.seekFamousPerson(action.source || 'seek')).then((result) => {
            game?.tutorialController?.onFamousPersonSought?.(result || {});
            return result;
          }));
        }
        return this.finalize(this.runAction(() => this.host.api.seekFamousPerson(action.source || 'seek')).then((result) => {
          game?.tutorialController?.onFamousPersonSought?.(result || {});
          return result;
        }));
      },

      handle_acceptFamousPerson(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const game = this.getGameHost();
        if (typeof game?.acceptFamousPerson === 'function') {
          return this.finalize(game.acceptFamousPerson(action.candidateId));
        }
        return this.finalize(this.runAction(() => this.host.api.acceptFamousPerson(action.candidateId)));
      },

      handle_dismissFamousPersonCandidate(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const game = this.getGameHost();
        if (typeof game?.dismissFamousPersonCandidate === 'function') {
          return this.finalize(game.dismissFamousPersonCandidate(action.candidateId));
        }
        return this.finalize(this.runAction(() => this.host.api.dismissFamousPersonCandidate(action.candidateId)));
      },

      handle_assignFamousAttributePoint(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const game = this.getGameHost();
        if (typeof game?.assignFamousAttributePoint === 'function') {
          return this.finalize(game.assignFamousAttributePoint(action.personId, action.attribute));
        }
        return this.finalize(this.runAction(() => this.host.api.assignFamousAttributePoint(action.personId, action.attribute)));
      },

      handle_changeFamousPersonsPage(action) {
        if (typeof this.host?.changeFamousPersonsPage === 'function') {
          return this.host.changeFamousPersonsPage(action) !== false;
        }
        this.host.famousPersonsPage = Math.max(0, (Number(this.host.famousPersonsPage) || 0) + (Number(action.delta) || 0));
        this.host.selectedFamousPersonId = '';
        this.host.renderer?.clearFamousSkillTooltip?.();
        this.afterHandled(action);
        return true;
      },
    });
    return true;
  }

  const CanvasFamousActionHandlers = { install };
  global.CanvasFamousActionHandlers = CanvasFamousActionHandlers;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasFamousActionHandlers;
})(typeof globalThis !== 'undefined' ? globalThis : window);
