// BattleSceneController -- SHAPE-B (stateful plain class) owner of the turn-card
// battle-scene replay timers, extracted from CanvasGameApp (god-file re-decomposition
// slice 9).
//
// The scene session itself already single-lives in BattleStore (openBattleScene /
// updateBattleScene / closeBattleScene) -- this class owns the two raw handles that
// used to sit on the app: the per-turn advance timeout and the animation-frame
// interval, plus the turn-duration policy. It reaches the host only through explicit
// facilities: getState(), getBattleStore(), invalidateRendererSnapshot(),
// renderCanvasSurface(), renderAnimationFrame(), now(), getAnimationFrameMs(),
// openEntityBattle() (the slice-8 controller, for reports that carry a deterministic
// replay), and the scheduler/runtime timer chains.
(function (global) {
  class BattleSceneController {
    constructor({ host } = {}) {
      this.host = host || null;
      this.replayTurnTimer = null;
      this.animationTimer = null;
    }

    getSession() {
      const store = this.host.getBattleStore();
      return store ? store.getBattleScene() : null;
    }

    getBaseTurnDurationMs() {
      return 900;
    }

    getSkillCutInDurationMs() {
      return 2200;
    }

    getTurnDurationMs(turn = null) {
      const isSkill =
        turn &&
        (turn.action === 'skill' || turn.actionType === 'skill' || turn.presentation?.cutIn);
      return this.getBaseTurnDurationMs() + (isSkill ? this.getSkillCutInDurationMs() : 0);
    }

    getCurrentTurnDurationMs(scene = null) {
      const currentScene = scene || this.getSession();
      const turns = currentScene?.report?.turns || [];
      const index = Math.max(0, Math.min(turns.length, Number(currentScene?.turnIndex) || 0));
      return this.getTurnDurationMs(index < turns.length ? turns[index] : null);
    }

    start(report = null) {
      const host = this.host;
      if (!report) return false;
      // Entity battles carry a deterministic replay; render them in the new sprite
      // overlay instead of the turn-card scene. Any failure falls back to the
      // turn-card scene so a battle always shows.
      const view = typeof window !== 'undefined' ? window : globalThis;
      try {
        view.console?.log?.('[battle-replay] startBattleScene', {
          hasReplay: !!(report.replay && report.replay.setup),
          hasCore: !!view.BattleSimCore,
          hasOverlay: typeof host.openEntityBattle === 'function',
        });
      } catch (_e) {
        /* ignore */
      }
      if (
        report.replay &&
        report.replay.setup &&
        view.BattleSimCore &&
        typeof host.openEntityBattle === 'function'
      ) {
        try {
          const shown = host.openEntityBattle({
            mode: 'replay',
            setup: report.replay.setup,
            inputStream: report.replay.inputStream || [],
            report,
            onClose: () => host.renderCanvasSurface(host.getState()?.currentTab || 'military'),
          });
          if (shown) return true;
        } catch (err) {
          view.console?.error?.(
            '[battle-replay] entity overlay failed, using turn-card scene:',
            err,
          );
        }
      }
      const battleScene = {
        visible: true,
        report,
        turnIndex: 0,
        startedAt: host.now(),
        turnStartedAt: host.now(),
        turnDurationMs: this.getTurnDurationMs(report.turns?.[0] || null),
      };
      const store = host.getBattleStore();
      if (!store) return false;
      store.openBattleScene(battleScene);
      host.invalidateRendererSnapshot();
      this.startTurnTimer();
      this.startAnimationTimer();
      host.renderCanvasSurface(host.getState()?.currentTab || 'military');
      return true;
    }

    stopTurnTimer() {
      const host = this.host;
      if (!this.replayTurnTimer) return;
      if (typeof host.scheduler?.clearTimeout === 'function') {
        host.scheduler.clearTimeout(this.replayTurnTimer);
      } else if (typeof host.runtime?.clearTimeout === 'function') {
        host.runtime.clearTimeout(this.replayTurnTimer);
      } else if (typeof clearTimeout === 'function') {
        clearTimeout(this.replayTurnTimer);
      } else if (typeof host.scheduler?.clearInterval === 'function') {
        host.scheduler.clearInterval(this.replayTurnTimer);
      } else if (typeof host.runtime?.clearInterval === 'function') {
        host.runtime.clearInterval(this.replayTurnTimer);
      } else if (typeof clearInterval === 'function') {
        clearInterval(this.replayTurnTimer);
      }
      this.replayTurnTimer = null;
    }

    stopAnimationTimer() {
      const host = this.host;
      if (!this.animationTimer) return;
      if (typeof host.scheduler?.clearInterval === 'function') {
        host.scheduler.clearInterval(this.animationTimer);
      } else if (typeof host.runtime?.clearInterval === 'function') {
        host.runtime.clearInterval(this.animationTimer);
      } else if (typeof clearInterval === 'function') {
        clearInterval(this.animationTimer);
      }
      this.animationTimer = null;
    }

    startAnimationTimer() {
      const host = this.host;
      this.stopAnimationTimer();
      const timerHost =
        typeof host.scheduler?.setInterval === 'function'
          ? host.scheduler
          : typeof host.runtime?.setInterval === 'function'
            ? host.runtime
            : null;
      const setIntervalFn =
        timerHost?.setInterval || (typeof setInterval === 'function' ? setInterval : null);
      if (!setIntervalFn) return false;
      const tick = () => {
        if (!this.getSession()?.visible) {
          this.stopAnimationTimer();
          return;
        }
        host.renderAnimationFrame(host.getState()?.currentTab || 'military');
      };
      this.animationTimer = timerHost
        ? setIntervalFn.call(timerHost, tick, host.getAnimationFrameMs())
        : setIntervalFn(tick, host.getAnimationFrameMs());
      return true;
    }

    advanceTurn() {
      const host = this.host;
      const battleScene = this.getSession();
      if (!battleScene?.visible) {
        this.stopTurnTimer();
        return false;
      }
      const turns = battleScene.report?.turns || [];
      if (battleScene.turnIndex < turns.length) {
        const nextTurnIndex = battleScene.turnIndex + 1;
        const nextBattleScene = {
          ...battleScene,
          turnIndex: nextTurnIndex,
          turnStartedAt: host.now(),
          turnDurationMs: this.getTurnDurationMs(
            nextTurnIndex < turns.length ? turns[nextTurnIndex] : null,
          ),
        };
        host.getBattleStore()?.updateBattleScene(nextBattleScene);
        host.invalidateRendererSnapshot();
        host.renderAnimationFrame(host.getState()?.currentTab || 'military');
        this.startTurnTimer();
        return true;
      }
      this.stopTurnTimer();
      this.stopAnimationTimer();
      return false;
    }

    startTurnTimer() {
      const host = this.host;
      this.stopTurnTimer();
      const timerHost =
        typeof host.scheduler?.setTimeout === 'function'
          ? host.scheduler
          : typeof host.runtime?.setTimeout === 'function'
            ? host.runtime
            : null;
      const setTimeoutFn =
        timerHost?.setTimeout || (typeof setTimeout === 'function' ? setTimeout : null);
      if (!setTimeoutFn) return false;
      this.replayTurnTimer = timerHost
        ? setTimeoutFn.call(timerHost, () => this.advanceTurn(), this.getCurrentTurnDurationMs())
        : setTimeoutFn(() => this.advanceTurn(), this.getCurrentTurnDurationMs());
      return true;
    }

    close() {
      const host = this.host;
      this.stopTurnTimer();
      this.stopAnimationTimer();
      host.getBattleStore()?.closeBattleScene();
      host.invalidateRendererSnapshot();
      host.renderCanvasSurface(host.getState()?.currentTab || 'military');
      return true;
    }

    skip() {
      const host = this.host;
      const battleScene = this.getSession();
      if (!battleScene?.visible) return false;
      const turns = battleScene.report?.turns || [];
      const nextBattleScene = {
        ...battleScene,
        turnIndex: turns.length,
        turnStartedAt: host.now(),
      };
      host.getBattleStore()?.updateBattleScene(nextBattleScene);
      host.invalidateRendererSnapshot();
      this.stopTurnTimer();
      this.stopAnimationTimer();
      host.renderCanvasSurface(host.getState()?.currentTab || 'military');
      return true;
    }
  }

  global.BattleSceneController = BattleSceneController;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BattleSceneController;
  }
})(typeof window !== 'undefined' ? window : globalThis);
