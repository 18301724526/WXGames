(function (global) {
  function install(CanvasActionController) {
    if (!CanvasActionController?.prototype) return false;
    Object.assign(CanvasActionController.prototype, {
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

    });
    return true;
  }

  const CanvasFamousActionHandlers = { install };
  global.CanvasFamousActionHandlers = CanvasFamousActionHandlers;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasFamousActionHandlers;
})(typeof globalThis !== 'undefined' ? globalThis : window);
