(function (global) {
  function install(CanvasGameApp) {
    if (!CanvasGameApp?.prototype) return false;
    Object.assign(CanvasGameApp.prototype, {
      getBattleBaseTurnDurationMs() {
            return 900;
          },

      getBattleSkillCutInDurationMs() {
            return 2200;
          },

      getBattleTurnDurationMs(turn = null) {
            const isSkill = turn && (turn.action === 'skill' || turn.actionType === 'skill' || turn.presentation?.cutIn);
            return this.getBattleBaseTurnDurationMs() + (isSkill ? this.getBattleSkillCutInDurationMs() : 0);
          },

      getCurrentBattleTurnDurationMs(scene = this.battleScene) {
            const turns = scene?.report?.turns || [];
            const index = Math.max(0, Math.min(turns.length, Number(scene?.turnIndex) || 0));
            return this.getBattleTurnDurationMs(index < turns.length ? turns[index] : null);
          },

      syncBattleSceneToShell() {
            if (this.canvasShell) this.canvasShell.battleScene = this.battleScene;
          },

      // LIVE attack on an active encounter tile. Opens a session on the backend
      // (startWorldCombat → deterministic {battleId, setup}, no simulation), then
      // runs the INTERACTIVE battle scene; on battle end it submits the recorded
      // inputStream to resolveWorldCombat for the authoritative result. Returns a
      // promise that resolves true when the scene opened. Falls back to false (so
      // the caller can use the passive/legacy path) when prerequisites are missing.
      async enterInteractiveBattle(options = {}) {
            const view = (typeof window !== 'undefined' ? window : globalThis);
            const Scene = view.BattleInteractiveScene;
            const api = this.getGameApi?.() || this.api;
            if (!Scene || typeof Scene.show !== 'function' || !api?.startWorldCombat || !view.BattleSimCore) {
              view.console?.log?.('[battle-interactive] enterInteractiveBattle:abort', {
                hasScene: !!Scene, hasApi: !!api?.startWorldCombat, hasCore: !!view.BattleSimCore,
              });
              return false;
            }
            let opened = null;
            try {
              opened = await api.startWorldCombat({
                missionId: options.missionId || '',
                formationSlot: options.formationSlot ?? options.slot ?? 1,
                cityId: options.cityId || this.state?.activeCityId || 'capital',
                targetQ: options.targetQ ?? options.q,
                targetR: options.targetR ?? options.r,
              });
            } catch (err) {
              view.console?.error?.('[battle-interactive] startWorldCombat failed:', err);
              this.log?.(`战斗开启失败: ${err?.payload?.message || err?.message || ''}`);
              return false;
            }
            if (!opened || opened.success === false || !opened.setup || !opened.battleId) {
              this.log?.(opened?.message || '无法在此格开战');
              return false;
            }
            this.applyApiState?.(opened);
            const battleId = opened.battleId;
            const shown = Scene.show({
              battleId,
              setup: opened.setup,
              encounter: opened.encounter,
              battleTarget: opened.battleTarget,
              onResolve: async ({ inputStream }) => {
                try {
                  const resolved = await api.resolveWorldCombat(battleId, inputStream);
                  this.applyApiState?.(resolved);
                  return resolved;
                } catch (err) {
                  view.console?.error?.('[battle-interactive] resolveWorldCombat failed:', err);
                  this.log?.(`战斗结算失败: ${err?.payload?.message || err?.message || ''}`);
                  return null;
                }
              },
              onClose: () => this.renderCanvasSurface?.(this.state?.currentTab || 'military'),
            });
            return shown !== false;
          },

      startBattleScene(report = null) {
            if (!report) return false;
            // Entity battles carry a deterministic replay; render them in the new
            // sprite overlay instead of the legacy turn-card scene. Any failure
            // falls back to the legacy scene so a battle always shows.
            const view = (typeof window !== 'undefined' ? window : globalThis);
            try {
              view.console?.log?.('[battle-replay] startBattleScene', {
                hasReplay: !!(report.replay && report.replay.setup),
                hasCore: !!view.BattleSimCore,
                hasOverlay: !!view.BattleReplayOverlay,
              });
            } catch (e) { /* ignore */ }
            if (report.replay && report.replay.setup && view.BattleReplayOverlay && view.BattleSimCore) {
              try {
                const shown = view.BattleReplayOverlay.show(report, {
                  onClose: () => this.renderCanvasSurface(this.state?.currentTab || 'military'),
                });
                if (shown) return true;
              } catch (err) {
                view.console?.error?.('[battle-replay] overlay failed, using legacy scene:', err);
              }
            }
            this.battleScene = {
              visible: true,
              report,
              turnIndex: 0,
              startedAt: this.now(),
              turnStartedAt: this.now(),
              turnDurationMs: this.getBattleTurnDurationMs(report.turns?.[0] || null),
            };
            this.canvasShell?.startBattleScene?.(report);
            this.syncBattleSceneToShell();
            this.startBattleSceneTimer();
            this.startBattleAnimationTimer();
            this.renderCanvasSurface(this.state?.currentTab || 'military');
            return true;
          },

      stopBattleSceneTimer() {
            if (!this.battleSceneTimer) return;
            if (typeof this.scheduler?.clearTimeout === 'function') this.scheduler.clearTimeout(this.battleSceneTimer);
            else if (typeof this.runtime?.clearTimeout === 'function') this.runtime.clearTimeout(this.battleSceneTimer);
            else if (typeof clearTimeout === 'function') clearTimeout(this.battleSceneTimer);
            else if (typeof this.scheduler?.clearInterval === 'function') this.scheduler.clearInterval(this.battleSceneTimer);
            else if (typeof this.runtime?.clearInterval === 'function') this.runtime.clearInterval(this.battleSceneTimer);
            else if (typeof clearInterval === 'function') clearInterval(this.battleSceneTimer);
            this.battleSceneTimer = null;
          },

      stopBattleAnimationTimer() {
            if (!this.battleAnimationTimer) return;
            if (typeof this.scheduler?.clearInterval === 'function') this.scheduler.clearInterval(this.battleAnimationTimer);
            else if (typeof this.runtime?.clearInterval === 'function') this.runtime.clearInterval(this.battleAnimationTimer);
            else if (typeof clearInterval === 'function') clearInterval(this.battleAnimationTimer);
            this.battleAnimationTimer = null;
          },

      startBattleAnimationTimer() {
            this.stopBattleAnimationTimer();
            const timerHost = typeof this.scheduler?.setInterval === 'function'
              ? this.scheduler
              : (typeof this.runtime?.setInterval === 'function' ? this.runtime : null);
            const setIntervalFn = timerHost?.setInterval || (typeof setInterval === 'function' ? setInterval : null);
            if (!setIntervalFn) return false;
            this.battleAnimationTimer = timerHost
              ? setIntervalFn.call(timerHost, () => {
                if (!this.battleScene?.visible) {
                  this.stopBattleAnimationTimer();
                  return;
                }
                this.renderAnimationFrame(this.state?.currentTab || 'military');
              }, this.getAnimationFrameMs())
              : setIntervalFn(() => {
                if (!this.battleScene?.visible) {
                  this.stopBattleAnimationTimer();
                  return;
                }
                this.renderAnimationFrame(this.state?.currentTab || 'military');
              }, this.getAnimationFrameMs());
            return true;
          },

      advanceBattleSceneTurn() {
            if (!this.battleScene?.visible) {
              this.stopBattleSceneTimer();
              return false;
            }
            const turns = this.battleScene.report?.turns || [];
            if (this.battleScene.turnIndex < turns.length) {
              const nextTurnIndex = this.battleScene.turnIndex + 1;
              this.battleScene = {
                ...this.battleScene,
                turnIndex: nextTurnIndex,
                turnStartedAt: this.now(),
                turnDurationMs: this.getBattleTurnDurationMs(nextTurnIndex < turns.length ? turns[nextTurnIndex] : null),
              };
              this.syncBattleSceneToShell();
              this.renderAnimationFrame(this.state?.currentTab || 'military');
              this.startBattleSceneTimer();
              return true;
            }
            this.stopBattleSceneTimer();
            this.stopBattleAnimationTimer();
            return false;
          },

      startBattleSceneTimer() {
            this.stopBattleSceneTimer();
            const timerHost = typeof this.scheduler?.setTimeout === 'function'
              ? this.scheduler
              : (typeof this.runtime?.setTimeout === 'function' ? this.runtime : null);
            const setTimeoutFn = timerHost?.setTimeout || (typeof setTimeout === 'function' ? setTimeout : null);
            if (!setTimeoutFn) return false;
            this.battleSceneTimer = timerHost
              ? setTimeoutFn.call(timerHost, () => this.advanceBattleSceneTurn(), this.getCurrentBattleTurnDurationMs())
              : setTimeoutFn(() => this.advanceBattleSceneTurn(), this.getCurrentBattleTurnDurationMs());
            return true;
          },

      closeBattleScene() {
            this.stopBattleSceneTimer();
            this.stopBattleAnimationTimer();
            this.battleScene = null;
            this.canvasShell?.closeBattleScene?.();
            this.renderCanvasSurface(this.state?.currentTab || 'military');
            return true;
          },

      skipBattleScene() {
            if (!this.battleScene?.visible) return false;
            const turns = this.battleScene.report?.turns || [];
            this.battleScene = {
              ...this.battleScene,
              turnIndex: turns.length,
              turnStartedAt: this.now(),
            };
            this.syncBattleSceneToShell();
            this.stopBattleSceneTimer();
            this.stopBattleAnimationTimer();
            this.renderCanvasSurface(this.state?.currentTab || 'military');
            return true;
          },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameAppBattleScene = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
