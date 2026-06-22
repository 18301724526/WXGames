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

      syncEntityBattleToShell() {
            if (this.canvasShell) this.canvasShell.entityBattle = this.entityBattle;
          },

      // Open the entity battle (battleSimCore mass-melee) as a pure-canvas scene.
      // mode 'interactive' = live 军令 play recording an inputStream (resolved by
      // onResolve); mode 'replay' = deterministic playback of a finished report's
      // { setup, inputStream }. Rendered by BattleCanvasRenderer.renderEntityBattleOverlay
      // via options.entityBattle; the sim is stepped here in startEntityBattleTimer.
      openEntityBattle(opts = {}) {
            const view = (typeof window !== 'undefined' ? window : globalThis);
            const Core = view.BattleSimCore;
            const setup = opts.setup;
            if (!Core || typeof Core.createBattle !== 'function' || !setup || !setup.sides) {
              view.console?.log?.('[entity-battle] openEntityBattle:abort', { hasCore: !!Core, hasSetup: !!setup });
              return false;
            }
            this.closeEntityBattle();
            const battle = Core.createBattle(setup);
            const tickHz = (battle.config && battle.config.tickHz) || 20;
            const mode = opts.mode === 'replay' ? 'replay' : 'interactive';
            let selectedGid = null;
            Object.keys(battle.squads || {}).some((gid) => {
              if (battle.squads[gid].side === 0) { selectedGid = gid; return true; }
              return false;
            });
            const byTick = {};
            if (mode === 'replay') {
              (Array.isArray(opts.inputStream) ? opts.inputStream : []).forEach((entry) => {
                const t = Number(entry && entry.tick) || 0;
                (byTick[t] = byTick[t] || []).push(entry);
              });
            }
            const encounter = opts.encounter || {};
            const report = opts.report || null;
            const battleTarget = opts.battleTarget || encounter.battleTarget || {};
            const visualMap = mode === 'replay'
              ? (report && report.visual && report.visual.map)
              : (encounter.visual && encounter.visual.map);
            const bgPath = (visualMap && (visualMap.background || visualMap.image))
              || 'assets/art/battle/battlefield-forest-camp.png';
            this.entityBattle = {
              visible: true,
              mode,
              battle,
              setup,
              arena: (setup && setup.arena) || null,
              tickHz,
              status: '交战中…',
              statusColor: '#d29922',
              selectedGid,
              auto: false,
              battleId: opts.battleId || '',
              encounter,
              battleTarget,
              report,
              bgPath,
              byTick,
              pending: [],
              inputStream: mode === 'replay'
                ? (Array.isArray(opts.inputStream) ? opts.inputStream.slice() : [])
                : [],
              inputStreamLen: mode === 'replay' && Array.isArray(opts.inputStream) ? opts.inputStream.length : 0,
              ended: false,
              resolving: false,
              resultWinner: null,
              serverResult: null,
              acc: 0,
              lastMs: 0,
              onResolve: typeof opts.onResolve === 'function' ? opts.onResolve : null,
              onClose: typeof opts.onClose === 'function' ? opts.onClose : null,
              camera: view.BattleCameraPolicy
                ? view.BattleCameraPolicy.createCamera()
                : { zoom: 1, offsetX: 0, offsetY: 0 },
              _viewFit: null,
              _dragLast: null,
              _rstate: {},
            };
            this.syncEntityBattleToShell();
            this.startEntityBattleTimer();
            this.renderCanvasSurface(this.state?.currentTab || 'military');
            return true;
          },

      startEntityBattleTimer() {
            this.stopEntityBattleTimer();
            const timerHost = typeof this.scheduler?.setInterval === 'function'
              ? this.scheduler
              : (typeof this.runtime?.setInterval === 'function' ? this.runtime : null);
            const setIntervalFn = timerHost?.setInterval || (typeof setInterval === 'function' ? setInterval : null);
            if (!setIntervalFn) return false;
            const tick = () => this.tickEntityBattle();
            this.entityBattleTimer = timerHost
              ? setIntervalFn.call(timerHost, tick, this.getAnimationFrameMs())
              : setIntervalFn(tick, this.getAnimationFrameMs());
            return true;
          },

      stopEntityBattleTimer() {
            if (!this.entityBattleTimer) return;
            if (typeof this.scheduler?.clearInterval === 'function') this.scheduler.clearInterval(this.entityBattleTimer);
            else if (typeof this.runtime?.clearInterval === 'function') this.runtime.clearInterval(this.entityBattleTimer);
            else if (typeof clearInterval === 'function') clearInterval(this.entityBattleTimer);
            this.entityBattleTimer = null;
          },

      tickEntityBattle() {
            const eb = this.entityBattle;
            if (!eb || !eb.visible) { this.stopEntityBattleTimer(); return false; }
            const view = (typeof window !== 'undefined' ? window : globalThis);
            const Core = view.BattleSimCore;
            const AI = view.BattleAI;
            const battle = eb.battle;
            if (!Core || !battle) { this.stopEntityBattleTimer(); return false; }
            const now = this.now();
            if (!eb.lastMs) eb.lastMs = now;
            let dt = (now - eb.lastMs) / 1000;
            eb.lastMs = now;
            if (dt > 0.25) dt = 0.25;
            if (!(dt >= 0)) dt = 0;
            eb.acc += dt;
            const tickDt = 1 / (eb.tickHz || 20);
            let steps = 0;
            while (eb.acc >= tickDt && steps < 6 && battle && !battle.result) {
              let ins;
              if (eb.mode === 'replay') {
                ins = eb.byTick[battle.tick] || [];
              } else {
                const aiIns = AI && typeof AI.decideSideOrders === 'function' ? AI.decideSideOrders(battle, 1) : [];
                for (let k = 0; k < aiIns.length; k += 1) this.recordEntityInput(aiIns[k]);
                ins = eb.pending;
                eb.pending = [];
              }
              Core.step(battle, ins);
              eb.acc -= tickDt;
              steps += 1;
            }
            if (battle && battle.result && !eb.ended) this.onEntityBattleEnd();
            this.syncEntityBattleToShell();
            this.renderAnimationFrame(this.state?.currentTab || 'military');
            return true;
          },

      recordEntityInput(input) {
            const eb = this.entityBattle;
            if (!eb || !eb.battle) return;
            const entry = Object.assign({ tick: eb.battle.tick }, input);
            eb.inputStream.push(entry);
            eb.inputStreamLen = eb.inputStream.length;
            eb.pending.push(input);
          },

      issueEntityInput(input) {
            const eb = this.entityBattle;
            if (!eb || eb.mode !== 'interactive' || eb.ended || (eb.battle && eb.battle.result)) return false;
            this.recordEntityInput(input);
            this.syncEntityBattleToShell();
            this.renderAnimationFrame(this.state?.currentTab || 'military');
            return true;
          },

      entityBattleSelectGeneral(gid) {
            const eb = this.entityBattle;
            if (!eb) return false;
            eb.selectedGid = gid;
            this.syncEntityBattleToShell();
            this.renderAnimationFrame(this.state?.currentTab || 'military');
            return true;
          },

      entityBattleOrder(gid, order) {
            return this.issueEntityInput({ type: 'order', gid: gid || this.entityBattle?.selectedGid, order });
          },

      entityBattleMaster(order) {
            return this.issueEntityInput({ type: 'order', side: 0, order });
          },

      entityBattleSkill(gid, skillId) {
            return this.issueEntityInput({ type: 'skill', gid: gid || this.entityBattle?.selectedGid, skillId });
          },

      toggleEntityBattleAuto() {
            const eb = this.entityBattle;
            if (!eb || eb.mode !== 'interactive') return false;
            eb.auto = !eb.auto;
            if (eb.battle) {
              eb.battle.auto = eb.auto;
              Object.keys(eb.battle.squads || {}).forEach((gid) => {
                if (eb.battle.squads[gid].side !== 0) return;
                const gen = eb.battle.units[eb.battle.squads[gid].generalId];
                ((gen && gen.skills) || []).forEach((sk) => { sk.auto = eb.auto; });
              });
            }
            this.syncEntityBattleToShell();
            this.renderAnimationFrame(this.state?.currentTab || 'military');
            return true;
          },

      // Camera controller: translate an input gesture/drag into a camera change
      // using the pure BattleCameraPolicy, then re-render. No math lives here or in
      // the input routers — only orchestration.
      entityBattleZoom(gesture = {}) {
            const eb = this.entityBattle;
            if (!eb || !eb.visible) return false;
            const Policy = (typeof window !== 'undefined' ? window : globalThis).BattleCameraPolicy;
            const fit = eb._viewFit;
            if (!Policy || !fit) return false;
            const point = {
              x: Number(gesture.centerX != null ? gesture.centerX : gesture.x) || 0,
              y: Number(gesture.centerY != null ? gesture.centerY : gesture.y) || 0,
            };
            const scaleDelta = Number(gesture.scaleDelta) || 1;
            let camera = Policy.zoomAt(eb.camera || Policy.createCamera(), fit, point, scaleDelta);
            // A pinch gesture also carries a pan delta; apply it too.
            const dx = Number(gesture.deltaX);
            const dy = Number(gesture.deltaY);
            if ((Number.isFinite(dx) && dx) || (Number.isFinite(dy) && dy)) {
              camera = Policy.panBy(camera, fit, dx || 0, dy || 0);
            }
            eb.camera = camera;
            this.syncEntityBattleToShell();
            this.renderAnimationFrame(this.state?.currentTab || 'military');
            return true;
          },

      entityBattleDrag(phase, point = {}) {
            const eb = this.entityBattle;
            if (!eb || !eb.visible) return false;
            const px = Number(point.x) || 0;
            const py = Number(point.y) || 0;
            if (phase === 'start') { eb._dragLast = { x: px, y: py }; return true; }
            const Policy = (typeof window !== 'undefined' ? window : globalThis).BattleCameraPolicy;
            const fit = eb._viewFit;
            if (Policy && fit && eb._dragLast) {
              const dx = px - eb._dragLast.x;
              const dy = py - eb._dragLast.y;
              eb.camera = Policy.panBy(eb.camera || Policy.createCamera(), fit, dx, dy);
              eb._dragLast = { x: px, y: py };
              this.syncEntityBattleToShell();
              this.renderAnimationFrame(this.state?.currentTab || 'military');
            }
            if (phase === 'end' || phase === 'cancel') eb._dragLast = null;
            return true;
          },

      onEntityBattleEnd() {
            const eb = this.entityBattle;
            if (!eb || eb.ended) return;
            eb.ended = true;
            eb.resultWinner = eb.battle && eb.battle.result && eb.battle.result.winner;
            if (eb.mode === 'replay') {
              const win = eb.report ? (eb.report.result === 'victory') : (eb.resultWinner === 'attacker');
              eb.status = win ? '胜利' : '失败';
              eb.statusColor = win ? '#3fb950' : '#f85149';
              this.stopEntityBattleTimer();
              this.syncEntityBattleToShell();
              this.renderAnimationFrame(this.state?.currentTab || 'military');
              return;
            }
            eb.status = '结算中…';
            eb.statusColor = '#58a6ff';
            this.submitEntityResolve();
          },

      async submitEntityResolve() {
            const eb = this.entityBattle;
            if (!eb || eb.resolving) return;
            eb.resolving = true;
            let winner = eb.battle && eb.battle.result && eb.battle.result.winner;
            let serverResult = null;
            try {
              if (typeof eb.onResolve === 'function') {
                const resolved = await eb.onResolve({ battleId: eb.battleId, inputStream: eb.inputStream });
                if (resolved) {
                  if (resolved.winner) winner = resolved.winner;
                  serverResult = resolved.result || serverResult;
                }
              }
            } catch (e) {
              const view = (typeof window !== 'undefined' ? window : globalThis);
              view.console?.error?.('[entity-battle] resolve failed:', e);
            }
            if (this.entityBattle !== eb) return;
            eb.resultWinner = winner;
            eb.serverResult = serverResult;
            const win = winner === 'attacker';
            const draw = winner === 'draw';
            eb.status = win ? '胜利' : (draw ? '平局' : '失败');
            eb.statusColor = win ? '#3fb950' : (draw ? '#d29922' : '#f85149');
            this.stopEntityBattleTimer();
            this.syncEntityBattleToShell();
            this.renderAnimationFrame(this.state?.currentTab || 'military');
          },

      closeEntityBattle() {
            const eb = this.entityBattle;
            this.stopEntityBattleTimer();
            this.entityBattle = null;
            if (this.canvasShell) this.canvasShell.entityBattle = null;
            if (eb && typeof eb.onClose === 'function') {
              try { eb.onClose(); } catch (_e) { /* ignore */ }
            } else if (eb) {
              this.renderCanvasSurface(this.state?.currentTab || 'military');
            }
            return true;
          },

      // LIVE attack on an active encounter tile. Opens a session on the backend
      // (startWorldCombat → deterministic {battleId, setup}, no simulation), then
      // runs the INTERACTIVE battle scene; on battle end it submits the recorded
      // inputStream to resolveWorldCombat for the authoritative result. Returns a
      // promise that resolves true when the scene opened. Falls back to false (so
      // the caller can use the passive/legacy path) when prerequisites are missing.
      async enterInteractiveBattle(options = {}) {
            const view = (typeof window !== 'undefined' ? window : globalThis);
            const api = this.getGameApi?.() || this.api;
            if (typeof this.openEntityBattle !== 'function' || !api?.startWorldCombat || !view.BattleSimCore) {
              view.console?.log?.('[battle-interactive] enterInteractiveBattle:abort', {
                hasScene: typeof this.openEntityBattle === 'function', hasApi: !!api?.startWorldCombat, hasCore: !!view.BattleSimCore,
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
            const shown = this.openEntityBattle({
              mode: 'interactive',
              battleId,
              setup: opened.setup,
              encounter: opened.encounter,
              battleTarget: opened.battleTarget,
              onResolve: async ({ inputStream }) => {
                try {
                  const resolved = await api.resolveWorldCombat(battleId, inputStream);
                  // The interactive scene already played this battle live. The
                  // authoritative re-sim pushes its report into recentReports, so
                  // mark it seen BEFORE applyApiState — otherwise the passive
                  // BattleReplayOverlay replays the very same fight right after
                  // (the "军令版 + 无军令版 交替出现" double-play). The passive
                  // path stays only for unattended/legacy reports.
                  const playedReportId = resolved?.report?.id;
                  if (playedReportId) {
                    this.playedWorldCombatReportIds = this.playedWorldCombatReportIds || new Set();
                    this.playedWorldCombatReportIds.add(playedReportId);
                  }
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
                hasOverlay: typeof this.openEntityBattle === 'function',
              });
            } catch (_e) { /* ignore */ }
            if (report.replay && report.replay.setup && view.BattleSimCore && typeof this.openEntityBattle === 'function') {
              try {
                const shown = this.openEntityBattle({
                  mode: 'replay',
                  setup: report.replay.setup,
                  inputStream: report.replay.inputStream || [],
                  report,
                  onClose: () => this.renderCanvasSurface(this.state?.currentTab || 'military'),
                });
                if (shown) return true;
              } catch (err) {
                view.console?.error?.('[battle-replay] entity overlay failed, using legacy scene:', err);
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
