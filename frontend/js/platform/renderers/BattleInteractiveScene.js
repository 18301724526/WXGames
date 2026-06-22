// Interactive world-combat battle scene.
// Opened from a LIVE attack: the backend issues a deterministic { battleId, setup }
// via startWorldCombat (no simulation). This scene runs battleSimCore.createBattle(setup)
// LIVE on the client, lets the player issue 军令 / master orders / skills, drives the
// enemy side with battleAI, and RECORDS every player + AI input as a tick-tagged
// inputStream. When the battle resolves it submits { battleId, inputStream } to the
// backend (resolveWorldCombat) for the authoritative result, then shows it.
//
// Reuses BattleReplayOverlay's sprite render loop + 9:16 portrait sizing + SPRITE_SCALE.
// Discriminator vs the passive overlay: this path has a live battleId + setup and NO
// pre-existing report; the passive BattleReplayOverlay path has a finished report.
(function (global) {
  'use strict';
  const doc = global.document;

  const SIDES = ['player', 'enemy'];
  const POSES = ['move', 'attack', 'die', 'idle'];
  const FRAMES = 4;
  const FRAME_MS = 130;
  const SPRITE_SCALE = 2; // match BattleReplayOverlay so detail is visible
  const STATE_POSE = { engage: 'attack', hold: 'idle', covering: 'move', advance: 'move', retreat: 'move', dead: 'die' };

  // Single-部队 tactical orders (master orders handled separately). Mirrors the lab.
  const ORDER_LABELS = [
    ['advance', '前进'],
    ['soldierAttack', '士兵出击'],
    ['generalCharge', '武将出击'],
    ['generalRetreat', '武将后退'],
    ['defend', '防御'],
    ['cover', '掩护'],
  ];
  const MASTER_LABELS = [['allOut', '全军出击'], ['allRetreat', '全军撤退']];

  let spriteCache = null;
  function loadSprites() {
    if (spriteCache) return spriteCache;
    const img = { player: {}, enemy: {}, ready: false, loaded: 0, total: SIDES.length * POSES.length * FRAMES };
    SIDES.forEach((side) => {
      POSES.forEach((pose) => {
        img[side][pose] = [];
        for (let i = 0; i < FRAMES; i += 1) {
          const im = new global.Image();
          im.onload = () => { img.loaded += 1; if (img.loaded >= img.total) img.ready = true; };
          im.src = `assets/art/battle/units/${side}/${pose}/${String(i + 1).padStart(2, '0')}.png`;
          img[side][pose].push(im);
        }
      });
    });
    spriteCache = img;
    return img;
  }

  // options:
  //   battleId  : string from startWorldCombat (passed back to resolveWorldCombat)
  //   setup     : exact BattleSimService.buildBattleSetup output (deterministic input)
  //   encounter : client-safe encounter (for labels / battlefield art)
  //   onResolve : async ({ battleId, inputStream }) => resolveResult (server-authoritative)
  //   onClose   : () => void   (called when the scene closes)
  function show(options = {}) {
    const Core = global.BattleSimCore;
    const AI = global.BattleAI;
    const setup = options.setup;
    const battleId = options.battleId || '';
    const LOG = (m, o) => { try { (global.console && global.console.log) && global.console.log('[battle-interactive] ' + m, o === undefined ? '' : o); } catch (e) { /* ignore */ } };
    if (!doc || !Core || typeof Core.createBattle !== 'function' || !setup || !setup.sides) {
      LOG('show:abort', { hasDoc: !!doc, hasCore: !!Core, hasSetup: !!setup });
      return false;
    }
    LOG('show:start', { battleId, seed: setup.seed, sides: (setup.sides || []).map((s) => `${s.side}:${(s.generals || []).length}`).join(',') });

    // ---- DOM shell (singleton) ----
    const prev = doc.getElementById('wxgame-battle-interactive');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    const root = doc.createElement('div');
    root.id = 'wxgame-battle-interactive';
    // Match the game's 9:16 portrait viewport (same sizing as BattleReplayOverlay).
    root.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);'
      + 'width:min(100vw,56.25dvh);height:min(100dvh,177.7778vw);'
      + 'z-index:2147483600;overflow:hidden;background:#0c1116;display:flex;flex-direction:column;'
      + 'color:#e6edf3;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;';

    const encounter = options.encounter || {};
    const battleTarget = options.battleTarget || encounter.battleTarget || {};
    const defenderName = battleTarget.name || battleTarget.leaderName || encounter.name || '敌军';

    const top = doc.createElement('div');
    top.style.cssText = 'padding:8px 12px;background:rgba(0,0,0,.5);display:flex;gap:12px;flex-wrap:wrap;'
      + 'font-variant-numeric:tabular-nums;font-size:12px;align-items:center;';
    top.innerHTML = '<span>tick <b id="wxbi-tick" style="color:#58a6ff">0</b></span>'
      + '<span>我方 <b id="wxbi-left" style="color:#3fb950">0</b></span>'
      + '<span>敌方 <b id="wxbi-right" style="color:#f0c000">0</b></span>'
      + '<span id="wxbi-status" style="color:#d29922;flex:1;text-align:right">交战中…</span>';

    const stageWrap = doc.createElement('div');
    const bgPath = (encounter.visual && encounter.visual.map && (encounter.visual.map.background || encounter.visual.map.image))
      || 'assets/art/battle/battlefield-forest-camp.png';
    stageWrap.style.cssText = 'position:relative;flex:1;min-height:0;background:#0c1116 center/cover no-repeat;'
      + 'background-image:url("' + bgPath + '");';
    const canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    stageWrap.appendChild(canvas);
    const resultBox = doc.createElement('div');
    resultBox.style.cssText = 'position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);min-width:70%;'
      + 'background:rgba(13,17,23,0.95);border:1px solid #2a3340;border-radius:10px;padding:14px 16px;'
      + 'font-size:14px;line-height:1.7;display:none;';
    stageWrap.appendChild(resultBox);

    // ---- interactive control panel (ported from battle-scene-lab) ----
    const ui = doc.createElement('div');
    ui.style.cssText = 'background:#161b22;border-top:1px solid #2a3340;padding:8px 10px 12px;';
    function row(labelText) {
      const r = doc.createElement('div');
      r.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px;';
      const lab = doc.createElement('span');
      lab.textContent = labelText;
      lab.style.cssText = 'color:#8b98a5;width:56px;flex:none;';
      r.appendChild(lab);
      const slot = doc.createElement('span');
      slot.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:1;';
      r.appendChild(slot);
      ui.appendChild(r);
      return slot;
    }
    const generalsSlot = row('选将');
    const ordersSlot = row('单部队令');
    const mastersSlot = row('全军总令');
    const skillsSlot = row('技能');

    const BTN_CSS = 'background:#30363d;color:#e6edf3;border:1px solid #3a444f;border-radius:6px;padding:7px 10px;font-size:13px;cursor:pointer;';
    function mkBtn(text) { const b = doc.createElement('button'); b.style.cssText = BTN_CSS; b.textContent = text; return b; }

    const bottom = doc.createElement('div');
    bottom.style.cssText = 'padding:10px 12px;background:rgba(0,0,0,.5);display:flex;gap:10px;align-items:center;';
    const autoLabel = doc.createElement('label');
    autoLabel.style.cssText = 'flex:1;color:#8b98a5;display:flex;gap:5px;align-items:center;font-size:12px;';
    const autoCb = doc.createElement('input');
    autoCb.type = 'checkbox';
    autoLabel.appendChild(autoCb);
    autoLabel.appendChild(doc.createTextNode('自动 (托管交战)'));
    const btnDone = mkBtn('完成');
    btnDone.style.cssText += 'background:#1f6feb;border-color:#2f81f7;color:#fff;display:none;';
    bottom.appendChild(autoLabel);
    bottom.appendChild(btnDone);

    root.appendChild(top);
    root.appendChild(stageWrap);
    root.appendChild(ui);
    root.appendChild(bottom);
    doc.body.appendChild(root);

    const ctx = canvas.getContext('2d');
    const sprites = loadSprites();
    const $tick = doc.getElementById('wxbi-tick');
    const $left = doc.getElementById('wxbi-left');
    const $right = doc.getElementById('wxbi-right');
    const $status = doc.getElementById('wxbi-status');

    let W = 1; let H = 1; let dpr = 1;
    function resize() {
      dpr = Math.min(global.devicePixelRatio || 1, 3);
      const r = stageWrap.getBoundingClientRect();
      W = Math.max(1, Math.floor(r.width));
      H = Math.max(1, Math.floor(r.height));
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    global.addEventListener('resize', resize);
    resize();

    // ---- live battle ----
    const battle = Core.createBattle(setup);
    const arena = (setup && setup.arena) || { w: W, h: H };
    const TICK_HZ = (battle.config && battle.config.tickHz) || 20;
    const TICK_DT = 1 / TICK_HZ;
    LOG('createBattle:ok', { units: (battle.units || []).length, tickHz: TICK_HZ });

    // pending = inputs to apply on the next step; inputStream = the recorded log
    // (player inputs + AI orders), each tagged with the battle.tick at issue time.
    let pending = [];
    const inputStream = [];
    let selectedGid = null;
    let battleEnded = false;
    let resolving = false;

    // Pick the first player (side 0) general as the default selection.
    Object.keys(battle.squads).some((gid) => {
      if (battle.squads[gid].side === 0) { selectedGid = gid; return true; }
      return false;
    });

    // Record then queue an input. tick is the tick the input is issued during, which
    // is exactly what the backend re-sim buckets by (it applies them at that tick's step).
    function record(input) {
      const entry = Object.assign({ tick: battle.tick }, input);
      inputStream.push(entry);
      pending.push(input);
    }
    function issue(input) {
      if (battleEnded || battle.result) return;
      record(input);
      buildUi();
    }

    // ---- UI build (re-rendered each frame batch / on input) ----
    function buildUi() {
      // generals (player squads)
      generalsSlot.innerHTML = '';
      Object.keys(battle.squads).forEach((gid) => {
        if (battle.squads[gid].side !== 0) return;
        const b = mkBtn(gid);
        if (gid === selectedGid) { b.style.background = '#1f6feb'; b.style.borderColor = '#1f6feb'; }
        const gen = battle.units[battle.squads[gid].generalId];
        if (gen && (!gen.alive || gen.left)) b.style.opacity = '0.4';
        b.onclick = () => { selectedGid = gid; buildUi(); };
        generalsSlot.appendChild(b);
      });

      const sq = battle.squads[selectedGid];
      const disabled = !!battle.result || battleEnded;

      // single-部队 orders
      ordersSlot.innerHTML = '';
      ORDER_LABELS.forEach((pair) => {
        const cd = sq ? sq.orderCdLeft : 0;
        const b = mkBtn(pair[1] + (cd > 0 ? ' (' + Math.ceil(cd / TICK_HZ) + 's)' : ''));
        if (cd > 0) b.style.color = '#d29922';
        b.disabled = disabled || cd > 0;
        if (b.disabled) b.style.opacity = '0.4';
        b.onclick = () => issue({ type: 'order', gid: selectedGid, order: pair[0] });
        ordersSlot.appendChild(b);
      });

      // master orders (side 0, once each)
      mastersSlot.innerHTML = '';
      MASTER_LABELS.forEach((pair) => {
        const b = mkBtn(pair[1]);
        b.style.background = '#6e40c9';
        b.style.borderColor = '#6e40c9';
        const used = battle.masterUsed && battle.masterUsed[0] && battle.masterUsed[0][pair[0]];
        b.disabled = disabled || !!used;
        if (b.disabled) b.style.opacity = '0.4';
        b.onclick = () => issue({ type: 'order', side: 0, order: pair[0] });
        mastersSlot.appendChild(b);
      });

      // skills for the selected general (rage / cooldown + auto toggle)
      skillsSlot.innerHTML = '';
      const gen = sq ? battle.units[sq.generalId] : null;
      const rageMax = battle.config.rageMax;
      (gen && gen.skills || []).forEach((sk, idx) => {
        const ready = Core.skillReady(battle, gen, sk, idx);
        const info = sk.kind === 'ultimate'
          ? '怒' + Math.floor(gen.rage) + '/' + (sk.rageCost || rageMax)
          : (gen.skillCds[idx] > 0 ? Math.ceil(gen.skillCds[idx] / TICK_HZ) + 's' : '就绪');
        const b = mkBtn(sk.name + ' [' + info + ']');
        if (!ready) b.style.color = '#d29922';
        b.disabled = disabled || !ready;
        if (b.disabled) b.style.opacity = '0.4';
        b.onclick = () => issue({ type: 'skill', gid: selectedGid, skillId: sk.id });
        skillsSlot.appendChild(b);
        const lab = doc.createElement('label');
        lab.style.cssText = 'margin-left:2px;color:#8b98a5;display:inline-flex;gap:3px;align-items:center;';
        const cb = doc.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!sk.auto;
        cb.onchange = () => { sk.auto = cb.checked; };
        lab.appendChild(cb);
        lab.appendChild(doc.createTextNode('自动'));
        skillsSlot.appendChild(lab);
      });
    }

    // ---- render (reuses BattleReplayOverlay's loop + sizing) ----
    const rstate = {};
    function poseFor(u) { return STATE_POSE[u.state] || 'move'; }
    function spriteSetFor(u) { return u.side === 0 ? 'player' : 'enemy'; }
    function dot(u, x, y) { ctx.fillStyle = u.side === 0 ? '#f0564b' : '#4a9bf0'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
    function render(now) {
      ctx.clearRect(0, 0, W, H);
      const aw = arena.w || W;
      const ah = arena.h || H;
      const scale = Math.min(W / aw, H / ah) || 1;
      const offX = (W - aw * scale) / 2;
      const offY = (H - ah * scale) / 2;
      const base = (now / FRAME_MS) | 0;
      const us = battle.units || [];
      const draw = [];
      for (let i = 0; i < us.length; i += 1) {
        const u = us[i];
        if (!u.alive || u.left) continue;
        const rs = rstate[u.id] || (rstate[u.id] = { fx: u.side === 0 ? 1 : -1, px: u.x });
        if (u.x > rs.px + 0.05) rs.fx = 1; else if (u.x < rs.px - 0.05) rs.fx = -1;
        rs.px = u.x;
        draw.push(u);
      }
      draw.sort((a, b) => a.y - b.y);
      for (let j = 0; j < draw.length; j += 1) {
        const d = draw[j];
        const h = (d.kind === 'general' ? 46 : 16) * scale * SPRITE_SCALE;
        const w = Math.round((h * 500) / 400);
        const x = offX + d.x * scale;
        const y = offY + d.y * scale;
        let drew = false;
        if (sprites.ready) {
          const fr = sprites[spriteSetFor(d)][poseFor(d)][(base + (d.id % FRAMES)) % FRAMES];
          if (fr && fr.complete && fr.naturalWidth) {
            if (rstate[d.id].fx < 0) {
              ctx.save();
              ctx.translate(x, 0);
              ctx.scale(-1, 1);
              ctx.drawImage(fr, -w / 2, y - h, w, h);
              ctx.restore();
            } else {
              ctx.drawImage(fr, x - w / 2, y - h, w, h);
            }
            drew = true;
          }
        }
        if (!drew) dot(d, x, y);
        if (d.kind === 'general') { ctx.fillStyle = d.side === 0 ? '#3fb950' : '#f0c000'; ctx.fillRect(x - 2, y - h - 6, 4, 4); }
      }
    }

    function updateTop() {
      const c = Core.countOnField(battle);
      if ($tick) $tick.textContent = battle.tick;
      if ($left) $left.textContent = c[0];
      if ($right) $right.textContent = c[1];
    }

    // ---- loop ----
    let acc = 0;
    let last = 0;
    let raf = 0;
    function frame(now) {
      try {
        if (!last) last = now;
        let dt = (now - last) / 1000; last = now;
        if (dt > 0.25) dt = 0.25;
        acc += dt;
        let uiDirty = false;
        let steps = 0;
        while (acc >= TICK_DT && steps < 6 && battle && !battle.result) {
          // Drive enemy (side 1) with the deterministic behavior-tree AI, recording
          // its orders into the SAME inputStream so the backend re-sim reproduces them.
          const aiIns = AI && typeof AI.decideSideOrders === 'function' ? AI.decideSideOrders(battle, 1) : [];
          for (let k = 0; k < aiIns.length; k += 1) record(aiIns[k]);
          // pending now holds [player inputs..., ai inputs...] all recorded; apply them.
          const ins = pending;
          pending = [];
          if (ins.length) uiDirty = true;
          Core.step(battle, ins);
          acc -= TICK_DT; steps += 1;
        }
        render(now);
        updateTop();
        frame._n = (frame._n || 0) + 1;
        if (uiDirty || frame._n % 15 === 0) buildUi();
        if (battle && battle.result && !battleEnded) onBattleEnd();
        raf = global.requestAnimationFrame(frame);
      } catch (e) {
        LOG('frame:ERROR', (e && e.stack) ? String(e.stack).slice(0, 400) : String(e));
      }
    }

    function onBattleEnd() {
      battleEnded = true;
      if ($status) { $status.textContent = '结算中…'; $status.style.color = '#58a6ff'; }
      buildUi();
      LOG('battle-ended:local', { winner: battle.result && battle.result.winner, ticks: battle.result && battle.result.ticks, inputs: inputStream.length });
      submitResolve();
    }

    function showResult(winner, serverResult) {
      const win = winner === 'attacker';
      const draw = winner === 'draw';
      const title = win ? '胜利' : (draw ? '平局' : '失败');
      const color = win ? '#3fb950' : (draw ? '#d29922' : '#f85149');
      if ($status) { $status.textContent = title; $status.style.color = color; }
      const r = serverResult || (battle && battle.result) || {};
      const sv = r.survivorsByGid || {};
      function sideLine(side) {
        const parts = []; let total = 0;
        Object.keys(battle.squads).forEach((gid) => {
          if (battle.squads[gid].side !== side) return;
          const n = Math.floor(sv[gid] || 0);
          total += n;
          parts.push(gid + ' ' + n);
        });
        return parts.join(' , ') + '  (总 ' + total + ')';
      }
      resultBox.innerHTML = '<h2 style="margin:0 0 8px;font-size:18px;color:' + color + '">' + title + '</h2>'
        + '<div><span style="color:#8b98a5">我方剩余:</span> ' + sideLine(0) + '</div>'
        + '<div><span style="color:#8b98a5">敌方剩余:</span> ' + sideLine(1) + '</div>'
        + '<div style="color:#8b98a5;margin-top:6px;font-size:12px">用时 ' + (r.ticks || 0) + ' tick · 指令 ' + inputStream.length + ' 条 (后端权威重算)</div>';
      resultBox.style.display = 'block';
      btnDone.style.display = 'inline-block';
      btnDone.style.background = win ? '#238636' : '#1f6feb';
    }

    async function submitResolve() {
      if (resolving) return;
      resolving = true;
      let serverResult = null;
      let winner = battle.result && battle.result.winner;
      try {
        if (typeof options.onResolve === 'function') {
          const resolved = await options.onResolve({ battleId, inputStream });
          // resolved = resolveWorldCombat payload: { winner, result, report, ... }
          if (resolved) {
            if (resolved.winner) winner = resolved.winner;
            serverResult = resolved.result || serverResult;
            LOG('resolve:ok', { winner, hasReport: !!resolved.report });
          }
        }
      } catch (e) {
        LOG('resolve:ERROR', (e && e.message) ? e.message : String(e));
      }
      showResult(winner, serverResult);
    }

    function close() {
      if (raf) global.cancelAnimationFrame(raf);
      global.removeEventListener('resize', resize);
      if (root.parentNode) root.parentNode.removeChild(root);
      if (typeof options.onClose === 'function') options.onClose();
    }
    btnDone.onclick = close;

    // auto toggle: hand control to the core's auto path + auto-cast all player skills.
    autoCb.onchange = () => {
      battle.auto = autoCb.checked;
      Object.keys(battle.squads).forEach((gid) => {
        if (battle.squads[gid].side !== 0) return;
        const gen = battle.units[battle.squads[gid].generalId];
        (gen && gen.skills || []).forEach((sk) => { sk.auto = autoCb.checked; });
      });
      buildUi();
    };

    buildUi();
    raf = global.requestAnimationFrame(frame);
    return true;
  }

  const api = { show };
  global.BattleInteractiveScene = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
