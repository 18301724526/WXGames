(function (global) {
  // Battle-scene + entity-battle action handlers, extracted from CanvasTerritoryActionHandlers
  // into their own single-responsibility module (mixin onto CanvasActionController.prototype).
  function install(CanvasActionController) {
    if (!CanvasActionController?.prototype) return false;
    Object.assign(CanvasActionController.prototype, {
      handle_enterBattleScene(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleAction) {
          territory.handleAction({ territoryId: action.territoryId, action: 'enter-battle' });
          return true;
        }
        const game = this.getGameHost();
        const api = game?.getGameApi?.() || game?.api || this.host?.api;
        if (!api?.claimConquest) return false;
        const run = async () => {
          const result = await this.runAction(() => api.claimConquest(action.territoryId));
          if (result?.battleReport && typeof game?.startBattleScene === 'function') {
            game.startBattleScene(result.battleReport);
          } else if (result?.battleReport && typeof this.host?.startBattleScene === 'function') {
            this.host.startBattleScene(result.battleReport);
          }
          return true;
        };
        return this.finalize(run());
      },

      handle_closeBattleScene(_action) {
        const game = this.getGameHost();
        const closed =
          typeof game?.closeBattleScene === 'function'
            ? game.closeBattleScene()
            : this.host?.closeBattleScene?.();
        return closed !== false;
      },

      handle_skipBattleScene(_action) {
        const game = this.getGameHost();
        const skipped =
          typeof game?.skipBattleScene === 'function'
            ? game.skipBattleScene()
            : this.host?.skipBattleScene?.();
        return skipped !== false;
      },

      // Entity battle (battleSimCore live sim) tap routing. Buttons are drawn by
      // BattleCanvasRenderer.renderEntityBattleOverlay as canvas hitTargets; each
      // carries one of these action types, dispatched to the game host's entity
      // battle methods (CanvasGameAppBattleScene).
      handle_entityBattleSelectGeneral(action) {
        const game = this.getGameHost();
        return game?.entityBattleSelectGeneral?.(action.gid) !== false;
      },

      handle_entityBattleOrder(action) {
        const game = this.getGameHost();
        return game?.entityBattleOrder?.(action.gid, action.order) !== false;
      },

      handle_entityBattleMaster(action) {
        const game = this.getGameHost();
        return game?.entityBattleMaster?.(action.order) !== false;
      },

      handle_entityBattleSkill(action) {
        const game = this.getGameHost();
        return game?.entityBattleSkill?.(action.gid, action.skillId) !== false;
      },

      handle_entityBattleAuto() {
        const game = this.getGameHost();
        return game?.toggleEntityBattleAuto?.() !== false;
      },

      handle_entityBattleDone() {
        const game = this.getGameHost();
        return game?.closeEntityBattle?.() !== false;
      },

      handle_entityBattleClose() {
        const game = this.getGameHost();
        return game?.closeEntityBattle?.() !== false;
      },

      handle_entityBattleZoom(action) {
        const game = this.getGameHost();
        return game?.entityBattleZoom?.(action.gesture || {}) !== false;
      },

      handle_entityBattleDrag(action) {
        const game = this.getGameHost();
        return game?.entityBattleDrag?.(action.phase, action.pointer || {}) !== false;
      },
    });
    return true;
  }

  const CanvasBattleActionHandlers = { install };
  global.CanvasBattleActionHandlers = CanvasBattleActionHandlers;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasBattleActionHandlers;
})(typeof globalThis !== 'undefined' ? globalThis : window);
