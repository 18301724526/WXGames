// Entity battle replay overlay.
// Renders an authoritative world-combat battle (report.replay = { setup, inputStream })
// by re-running the deterministic battleSimCore on the client — the same setup +
// input stream the backend used, so the playback matches the authoritative result
// tick-for-tick. Self-contained DOM overlay so it reuses the battle-scene entry
// without touching the legacy turn-card renderer.
(function (global) {
  'use strict';
  const doc = global.document;

  const SIDES = ['player', 'enemy'];
  const POSES = ['move', 'attack', 'die', 'idle'];
  const FRAMES = 4;
  const FRAME_MS = 130;
  const SPRITE_SCALE = 2; // enlarge soldiers/general so detail is visible
  // unit.state -> sprite pose (unknown states fall back to 'move').
  const STATE_POSE = { engage: 'attack', hold: 'idle', covering: 'move', advance: 'move', retreat: 'move', dead: 'die' };

  let spriteCache = null; // shared across battles once loaded

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

  function show(report, options = {}) {
    const Core = global.BattleSimCore;
    const replay = report && report.replay;
    const LOG = (m, o) => { try { (global.console && global.console.log) && global.console.log('[battle-replay] ' + m, o === undefined ? '' : o); } catch (e) { /* ignore */ } };
    if (!doc || !Core || typeof Core.createBattle !== 'function' || !replay || !replay.setup) {
      LOG('show:abort', { hasDoc: !!doc, hasCore: !!Core, hasReplay: !!replay, hasSetup: !!(replay && replay.setup) });
      return false;
    }
    LOG('show:start', { id: report.id, result: report.result, seed: replay.setup.seed, sides: (replay.setup.sides || []).map((s) => `${s.side}:${(s.generals || []).length}`).join(','), inputs: (replay.inputStream || []).length });

    // ---- DOM shell ---- (singleton: drop any previous overlay first)
    const prev = doc.getElementById('wxgame-battle-replay');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    const root = doc.createElement('div');
    root.id = 'wxgame-battle-replay';
    // Match the game's 9:16 portrait viewport (same sizing as #app::before in
    // style.css) and center it, instead of covering the whole browser window.
    root.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);'
      + 'width:min(100vw,56.25dvh);height:min(100dvh,177.7778vw);'
      + 'z-index:2147483600;overflow:hidden;background:#0c1116;display:flex;flex-direction:column;'
      + 'color:#e6edf3;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;';

    const attackerName = (report.attacker && report.attacker.leaderName) || '我军';
    const defenderName = (report.defender && (report.defender.name || report.defender.leaderName)) || '敌军';
    const top = doc.createElement('div');
    top.style.cssText = 'padding:10px 14px;text-align:center;background:rgba(0,0,0,.45);font-weight:600;';
    top.innerHTML = `<div>${attackerName} 队 <span style="opacity:.6">vs</span> ${defenderName} 队</div><div id="wxgame-battle-replay-sub" style="font-size:12px;opacity:.7;margin-top:2px">交战中…</div>`;

    const stageWrap = doc.createElement('div');
    const bgPath = (report.visual && report.visual.map && (report.visual.map.background || report.visual.map.image))
      || 'assets/art/battle/battlefield-forest-camp.png';
    stageWrap.style.cssText = 'position:relative;flex:1;min-height:0;background:#0c1116 center/cover no-repeat;background-image:url("' + bgPath + '");';
    const canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    stageWrap.appendChild(canvas);

    const bottom = doc.createElement('div');
    bottom.style.cssText = 'padding:12px 14px;background:rgba(0,0,0,.5);display:flex;gap:10px;align-items:center;';
    const msg = doc.createElement('div');
    msg.style.cssText = 'flex:1;font-size:13px;opacity:.9;';
    msg.textContent = report.summary || '';
    const btnBack = doc.createElement('button');
    btnBack.textContent = '返回';
    btnBack.style.cssText = 'padding:8px 18px;border:1px solid #30363d;border-radius:6px;background:#21262d;color:#e6edf3;';
    const btnDone = doc.createElement('button');
    btnDone.textContent = '完成';
    btnDone.style.cssText = 'padding:8px 18px;border:1px solid #2f81f7;border-radius:6px;background:#1f6feb;color:#fff;';
    bottom.appendChild(msg);
    bottom.appendChild(btnBack);
    bottom.appendChild(btnDone);

    root.appendChild(top);
    root.appendChild(stageWrap);
    root.appendChild(bottom);
    doc.body.appendChild(root);

    const ctx = canvas.getContext('2d');
    const sprites = loadSprites();
    const sub = doc.getElementById('wxgame-battle-replay-sub');

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

    LOG('show:dom-ok', { W, H });
    // ---- deterministic replay ----
    const battle = Core.createBattle(replay.setup);
    LOG('createBattle:ok', { units: (battle.units || []).length, tick: battle.tick, hasConfig: !!battle.config, tickHz: battle.config && battle.config.tickHz });
    const arena = (replay.setup && replay.setup.arena) || { w: W, h: H };
    const byTick = {};
    (Array.isArray(replay.inputStream) ? replay.inputStream : []).forEach((e) => {
      const t = Number(e && e.tick) || 0;
      (byTick[t] = byTick[t] || []).push(e);
    });
    const TICK_HZ = (battle.config && battle.config.tickHz) || 20;
    const TICK_DT = 1 / TICK_HZ;

    const rstate = {};
    function poseFor(u) { return STATE_POSE[u.state] || 'move'; }
    function spriteSetFor(u) { return u.side === 0 ? 'player' : 'enemy'; }
    function dot(u, x, y) { ctx.fillStyle = u.side === 0 ? '#f0564b' : '#4a9bf0'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }

    function render(now) {
      ctx.clearRect(0, 0, W, H);
      // Uniform fit + center so the battlefield keeps its aspect ratio.
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

    let acc = 0;
    let last = 0;
    let ended = false;
    let raf = 0;
    function settle() {
      ended = true;
      const win = report.result === 'victory';
      if (sub) { sub.textContent = win ? '胜利' : '失败'; sub.style.color = win ? '#3fb950' : '#f85149'; }
      btnDone.style.background = win ? '#238636' : '#1f6feb';
    }
    let framed = 0;
    function frame(now) {
      try {
        if (!last) last = now;
        let dt = (now - last) / 1000; last = now;
        if (dt > 0.25) dt = 0.25;
        acc += dt;
        let steps = 0;
        while (acc >= TICK_DT && steps < 6 && battle && !battle.result) {
          Core.step(battle, byTick[battle.tick] || []);
          acc -= TICK_DT; steps += 1;
        }
        render(now);
        if (framed === 0) LOG('first-frame:ok', { tick: battle.tick, alive: (battle.units || []).filter((u) => u.alive).length });
        framed += 1;
        if (battle && battle.result && !ended) { settle(); LOG('battle-ended', { winner: battle.result.winner, ticks: battle.result.ticks }); }
        raf = global.requestAnimationFrame(frame);
      } catch (e) {
        LOG('frame:ERROR', (e && e.stack) ? String(e.stack).slice(0, 400) : String(e));
        try { global.console && global.console.error && global.console.error('[battle-replay] frame error', e); } catch (e2) { /* ignore */ }
      }
    }
    LOG('show:scheduling-frame');
    raf = global.requestAnimationFrame(frame);

    function close() {
      if (raf) global.cancelAnimationFrame(raf);
      global.removeEventListener('resize', resize);
      if (root.parentNode) root.parentNode.removeChild(root);
      if (typeof options.onClose === 'function') options.onClose();
    }
    btnBack.onclick = close;
    btnDone.onclick = close;
    return true;
  }

  const api = { show };
  global.BattleReplayOverlay = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
