// EntityBattleController -- SHAPE-B (stateful plain class) owner of the live
// entity-battle session (battleSimCore mass-melee) and its stepping interval,
// extracted from CanvasGameApp (god-file re-decomposition slice 8).
//
// Single-owner rule: exactly ONE controller instance holds the session + timer, and
// it lives on the state host (StateWriter.getStateHost). CanvasGameApp exposes a
// prototype accessor named after the legacy field, so every legacy read site (render
// options, input routing, the shell's lastGame reads, mode facts) observes the same
// live session object. BattleStore keeps holding that SAME reference via publish()
// (no second copy).
//
// The controller reaches its host only through explicit facilities: getState(),
// getBattleStore(), invalidateRendererSnapshot(), renderCanvasSurface(),
// renderAnimationFrame(), now(), getAnimationFrameMs(), and the scheduler/runtime
// interval chain. BattleSimCore / BattleAI / BattleCameraPolicy stay late-bound
// view globals, exactly as before the move.
(function (global) {
  var LocaleText = global.LocaleText;
  if (typeof module !== 'undefined' && module.exports && !LocaleText) {
    try {
      LocaleText = require('../ecs/resource/LocaleText');
    } catch (_error) {
      LocaleText = null;
    }
  }

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  class EntityBattleController {
    constructor({ host } = {}) {
      this.host = host || null;
      this.session = null;
      this.timer = null;
    }

    // The session is a single LIVE object stepped every tick; BattleStore holds that
    // same reference (no second copy). Re-pointing it on each change keeps the store
    // in sync if the session object is swapped, and invalidates the cached renderer
    // snapshot so battle facts are recomputed.
    publish(session) {
      const host = this.host;
      const store = host.getBattleStore();
      if (store) store.openEntityBattle(session || null);
      host.invalidateRendererSnapshot();
      return store ? store.getEntityBattle() : session;
    }

    // Open the entity battle as a pure-canvas scene. mode 'interactive' = live play
    // recording an inputStream (resolved by onResolve); mode 'replay' = deterministic
    // playback of a finished report's { setup, inputStream }. Rendered by
    // BattleCanvasRenderer.renderEntityBattleOverlay; the sim is stepped in tick().
    open(opts = {}) {
      const host = this.host;
      const view = typeof window !== 'undefined' ? window : globalThis;
      const Core = view.BattleSimCore;
      const setup = opts.setup;
      if (!Core || typeof Core.createBattle !== 'function' || !setup || !setup.sides) {
        view.console?.log?.('[entity-battle] openEntityBattle:abort', {
          hasCore: !!Core,
          hasSetup: !!setup,
        });
        return false;
      }
      this.close();
      const battle = Core.createBattle(setup);
      const tickHz = (battle.config && battle.config.tickHz) || 20;
      const mode = opts.mode === 'replay' ? 'replay' : 'interactive';
      let selectedGid = null;
      Object.keys(battle.squads || {}).some((gid) => {
        if (battle.squads[gid].side === 0) {
          selectedGid = gid;
          return true;
        }
        return false;
      });
      const byTick = {};
      if (mode === 'replay') {
        (Array.isArray(opts.inputStream) ? opts.inputStream : []).forEach((entry) => {
          const tick = Number(entry && entry.tick) || 0;
          (byTick[tick] = byTick[tick] || []).push(entry);
        });
      }
      const encounter = opts.encounter || {};
      const report = opts.report || null;
      const battleTarget = opts.battleTarget || encounter.battleTarget || {};
      const visualMap =
        mode === 'replay'
          ? report && report.visual && report.visual.map
          : encounter.visual && encounter.visual.map;
      const bgPath =
        (visualMap && (visualMap.background || visualMap.image)) ||
        'assets/art/battle/battlefield-forest-camp.png';
      this.session = {
        visible: true,
        mode,
        battle,
        setup,
        arena: (setup && setup.arena) || null,
        tickHz,
        status: t('battle.scene.status.fighting'),
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
        inputStream:
          mode === 'replay'
            ? Array.isArray(opts.inputStream)
              ? opts.inputStream.slice()
              : []
            : [],
        inputStreamLen:
          mode === 'replay' && Array.isArray(opts.inputStream) ? opts.inputStream.length : 0,
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
      this.publish(this.session);
      this.startTimer();
      host.renderCanvasSurface(host.getState()?.currentTab || 'military');
      return true;
    }

    startTimer() {
      this.stopTimer();
      const host = this.host;
      const timerHost =
        typeof host.scheduler?.setInterval === 'function'
          ? host.scheduler
          : typeof host.runtime?.setInterval === 'function'
            ? host.runtime
            : null;
      const setIntervalFn =
        timerHost?.setInterval || (typeof setInterval === 'function' ? setInterval : null);
      if (!setIntervalFn) return false;
      const tick = () => this.tick();
      this.timer = timerHost
        ? setIntervalFn.call(timerHost, tick, host.getAnimationFrameMs())
        : setIntervalFn(tick, host.getAnimationFrameMs());
      return true;
    }

    stopTimer() {
      if (!this.timer) return;
      const host = this.host;
      if (typeof host.scheduler?.clearInterval === 'function') {
        host.scheduler.clearInterval(this.timer);
      } else if (typeof host.runtime?.clearInterval === 'function') {
        host.runtime.clearInterval(this.timer);
      } else if (typeof clearInterval === 'function') {
        clearInterval(this.timer);
      }
      this.timer = null;
    }

    tick() {
      const host = this.host;
      const eb = this.session;
      if (!eb || !eb.visible) {
        this.stopTimer();
        return false;
      }
      const view = typeof window !== 'undefined' ? window : globalThis;
      const Core = view.BattleSimCore;
      const AI = view.BattleAI;
      const battle = eb.battle;
      if (!Core || !battle) {
        this.stopTimer();
        return false;
      }
      const now = host.now();
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
          const aiIns =
            AI && typeof AI.decideSideOrders === 'function' ? AI.decideSideOrders(battle, 1) : [];
          for (let k = 0; k < aiIns.length; k += 1) this.recordInput(aiIns[k]);
          ins = eb.pending;
          eb.pending = [];
        }
        Core.step(battle, ins);
        eb.acc -= tickDt;
        steps += 1;
      }
      if (battle && battle.result && !eb.ended) this.onEnd();
      this.publish(eb);
      host.renderAnimationFrame(host.getState()?.currentTab || 'military');
      return true;
    }

    recordInput(input) {
      const eb = this.session;
      if (!eb || !eb.battle) return;
      const entry = Object.assign({ tick: eb.battle.tick }, input);
      eb.inputStream.push(entry);
      eb.inputStreamLen = eb.inputStream.length;
      eb.pending.push(input);
    }

    issueInput(input) {
      const host = this.host;
      const eb = this.session;
      if (!eb || eb.mode !== 'interactive' || eb.ended || (eb.battle && eb.battle.result)) {
        return false;
      }
      this.recordInput(input);
      this.publish(eb);
      host.renderAnimationFrame(host.getState()?.currentTab || 'military');
      return true;
    }

    selectGeneral(gid) {
      const host = this.host;
      const eb = this.session;
      if (!eb) return false;
      eb.selectedGid = gid;
      this.publish(eb);
      host.renderAnimationFrame(host.getState()?.currentTab || 'military');
      return true;
    }

    order(gid, order) {
      return this.issueInput({ type: 'order', gid: gid || this.session?.selectedGid, order });
    }

    master(order) {
      return this.issueInput({ type: 'order', side: 0, order });
    }

    skill(gid, skillId) {
      return this.issueInput({ type: 'skill', gid: gid || this.session?.selectedGid, skillId });
    }

    toggleAuto() {
      const host = this.host;
      const eb = this.session;
      if (!eb || eb.mode !== 'interactive') return false;
      eb.auto = !eb.auto;
      if (eb.battle) {
        eb.battle.auto = eb.auto;
        Object.keys(eb.battle.squads || {}).forEach((gid) => {
          if (eb.battle.squads[gid].side !== 0) return;
          const gen = eb.battle.units[eb.battle.squads[gid].generalId];
          ((gen && gen.skills) || []).forEach((sk) => {
            sk.auto = eb.auto;
          });
        });
      }
      this.publish(eb);
      host.renderAnimationFrame(host.getState()?.currentTab || 'military');
      return true;
    }

    // Camera controller: translate an input gesture/drag into a camera change using
    // the pure BattleCameraPolicy, then re-render. No math lives here or in the input
    // routers -- only orchestration.
    zoom(gesture = {}) {
      const host = this.host;
      const eb = this.session;
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
      this.publish(eb);
      host.renderAnimationFrame(host.getState()?.currentTab || 'military');
      return true;
    }

    drag(phase, point = {}) {
      const host = this.host;
      const eb = this.session;
      if (!eb || !eb.visible) return false;
      const px = Number(point.x) || 0;
      const py = Number(point.y) || 0;
      if (phase === 'start') {
        eb._dragLast = { x: px, y: py };
        return true;
      }
      const Policy = (typeof window !== 'undefined' ? window : globalThis).BattleCameraPolicy;
      const fit = eb._viewFit;
      if (Policy && fit && eb._dragLast) {
        const dx = px - eb._dragLast.x;
        const dy = py - eb._dragLast.y;
        eb.camera = Policy.panBy(eb.camera || Policy.createCamera(), fit, dx, dy);
        eb._dragLast = { x: px, y: py };
        this.publish(eb);
        host.renderAnimationFrame(host.getState()?.currentTab || 'military');
      }
      if (phase === 'end' || phase === 'cancel') eb._dragLast = null;
      return true;
    }

    onEnd() {
      const host = this.host;
      const eb = this.session;
      if (!eb || eb.ended) return;
      eb.ended = true;
      eb.resultWinner = eb.battle && eb.battle.result && eb.battle.result.winner;
      if (eb.mode === 'replay') {
        const win = eb.report ? eb.report.result === 'victory' : eb.resultWinner === 'attacker';
        eb.status = win ? t('battle.scene.result.win') : t('battle.scene.result.lose');
        eb.statusColor = win ? '#3fb950' : '#f85149';
        this.stopTimer();
        this.publish(eb);
        host.renderAnimationFrame(host.getState()?.currentTab || 'military');
        return;
      }
      eb.status = t('battle.scene.status.settling');
      eb.statusColor = '#58a6ff';
      this.publish(eb);
      this.submitResolve();
    }

    async submitResolve() {
      const host = this.host;
      const eb = this.session;
      if (!eb || eb.resolving) return;
      eb.resolving = true;
      let winner = eb.battle && eb.battle.result && eb.battle.result.winner;
      let serverResult = null;
      try {
        if (typeof eb.onResolve === 'function') {
          const resolved = await eb.onResolve({
            battleId: eb.battleId,
            inputStream: eb.inputStream,
          });
          if (resolved) {
            if (resolved.winner) winner = resolved.winner;
            serverResult = resolved.result || serverResult;
          }
        }
      } catch (e) {
        const view = typeof window !== 'undefined' ? window : globalThis;
        view.console?.error?.('[entity-battle] resolve failed:', e);
      }
      if (this.session !== eb) return;
      eb.resultWinner = winner;
      eb.serverResult = serverResult;
      const win = winner === 'attacker';
      const draw = winner === 'draw';
      eb.status = win
        ? t('battle.scene.result.win')
        : draw
          ? t('battle.scene.result.draw')
          : t('battle.scene.result.lose');
      eb.statusColor = win ? '#3fb950' : draw ? '#d29922' : '#f85149';
      this.stopTimer();
      this.publish(eb);
      host.renderAnimationFrame(host.getState()?.currentTab || 'military');
    }

    close() {
      const host = this.host;
      const eb = this.session;
      this.stopTimer();
      host.getBattleStore()?.closeEntityBattle();
      host.invalidateRendererSnapshot();
      this.session = null;
      if (eb && typeof eb.onClose === 'function') {
        try {
          eb.onClose();
        } catch (_e) {
          /* ignore */
        }
      } else if (eb) {
        host.renderCanvasSurface(host.getState()?.currentTab || 'military');
      }
      return true;
    }
  }

  global.EntityBattleController = EntityBattleController;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EntityBattleController;
  }
})(typeof window !== 'undefined' ? window : globalThis);
