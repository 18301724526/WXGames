(function (root) {
  'use strict';

  // Headless, deterministic battle simulation core. Shared by the frontend
  // battle scene (drives the on-screen spectacle) and the backend authority
  // (re-runs it from true stats + seed + input stream to produce the
  // authoritative result). No rendering, no DOM, no wall-clock.
  //
  // Extensibility seams (intentional, so later additions are drop-in):
  //   - ORDER_BEHAVIORS: add an order by registering one handler.
  //   - applyInput(): typed input-stream entries ('order' now, 'skill' reserved).
  //   - skill phase + rage hook are stubbed for the deferred skill system.
  //   - combat/damage and targeting are isolated functions.

  const SCHEMA = 'battle-sim-core-v1';

  const STATE = Object.freeze({
    ADVANCE: 'advance',
    ENGAGE: 'engage',
    HOLD: 'hold',
    COVER: 'covering',
    RETREAT: 'retreat',
    DEAD: 'dead',
  });

  // Per-squad tactical orders (repeatable, cooldown-gated) + army master orders
  // (one-shot, hand control to auto). Step 1 implements advance/defend/retreat;
  // the rest are registered as aliases so they exist and can be filled in later.
  const ORDER = Object.freeze({
    ADVANCE: 'advance', // push forward and engage (default)
    SOLDIER_ATTACK: 'soldierAttack', // soldiers push, general holds the rear
    DEFEND: 'defend', // hold position, only strike enemies in range
    COVER: 'cover', // screen the general (step 2)
    GENERAL_CHARGE: 'generalCharge', // general charges in (step 2)
    GENERAL_RETREAT: 'generalRetreat', // general pulls back (step 2)
    ALL_OUT: 'allOut', // master: whole side all-out, then auto
    ALL_RETREAT: 'allRetreat', // master: whole side retreats, then auto
  });

  const DEFAULTS = Object.freeze({
    tickHz: 20,
    maxTicks: 20 * 60 * 5, // 5 min safety cap at 20Hz
    orderCdTicks: 20 * 5, // 5s order cooldown
    aggroRange: 70, // distance at which an idle unit will acquire a target
    routChance: 0.5, // per-soldier flee roll when their general dies
    leaderDeathDamageMult: 0.5, // surviving soldiers fight at half power
    edgeMargin: 8, // beyond own edge => left the field
    rageOnHit: 0, // reserved for the skill system
  });

  function toNum(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  // Deterministic PRNG (mulberry32). Same seed => same sequence on any engine.
  function createRng(seed) {
    let s = toNum(seed, 1) >>> 0 || 1;
    return function next() {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function mergeConfig(config = {}) {
    const merged = {};
    for (const key of Object.keys(DEFAULTS)) {
      merged[key] = config[key] !== undefined ? toNum(config[key], DEFAULTS[key]) : DEFAULTS[key];
    }
    return merged;
  }

  function makeUnit(id, side, gid, kind, x, y, stats) {
    return {
      id,
      side,
      gid,
      kind, // 'general' | 'soldier'
      x,
      y,
      hp: toNum(stats.hp, 1),
      maxHp: toNum(stats.hp, 1),
      atk: toNum(stats.atk, 1),
      def: toNum(stats.def, 0),
      range: toNum(stats.range, 10),
      moveSpeed: toNum(stats.moveSpeed, 24),
      atkInterval: Math.max(1, Math.round(toNum(stats.atkSpeed, 12))), // ticks between hits
      atkCd: 0,
      targetId: -1,
      state: STATE.ADVANCE,
      routed: false,
      alive: true,
      left: false, // fled past own edge
      // skill-system hooks (reserved)
      rage: 0,
      skillCds: [],
      skills: kind === 'general' ? (stats.skills || []).slice() : [],
    };
  }

  function createBattle(setup = {}) {
    const config = mergeConfig(setup.config);
    const arena = {
      w: Math.max(1, toNum(setup.arena && setup.arena.w, 720)),
      h: Math.max(1, toNum(setup.arena && setup.arena.h, 1280)),
    };
    const rng = createRng(setup.seed);
    const units = [];
    const squads = Object.create(null);
    const sides = Array.isArray(setup.sides) ? setup.sides : [];
    const sideIds = sides.map((s, i) => (s && s.side != null ? String(s.side) : 'side' + i));

    sides.forEach((sideDef, sideIndex) => {
      const generals = Array.isArray(sideDef.generals) ? sideDef.generals : [];
      generals.forEach((g, gi) => {
        const gid = String(g.gid);
        const gStats = g.stats || {};
        const troop = g.troop || {};
        const count = Math.max(0, Math.floor(toNum(troop.count, 0)));
        const tpl = troop.template || {};
        // Tidy starting formation: each general owns a vertical band; soldiers line
        // up in files (across) and ranks (depth), general anchored at the home edge.
        const bandH = arena.h / Math.max(1, generals.length);
        const bandCenterY = bandH * (gi + 0.5);
        const dir = sideIndex === 0 ? 1 : -1; // toward the enemy
        const homeX = sideIndex === 0 ? arena.w * 0.05 : arena.w * 0.95;
        const frontX = sideIndex === 0 ? arena.w * 0.3 : arena.w * 0.7;
        const files = Math.max(1, Math.round(Math.sqrt(count * 2.2)));
        const ranks = Math.max(1, Math.ceil(count / files));
        const fileGap = Math.min((bandH * 0.9) / files, 12);
        const rankGap = Math.min((Math.abs(frontX - homeX) * 0.8) / ranks, 9);
        const general = makeUnit(
          units.length,
          sideIndex,
          gid,
          'general',
          homeX,
          bandCenterY,
          gStats,
        );
        units.push(general);
        squads[gid] = {
          gid,
          side: sideIndex,
          order: ORDER.DEFEND, // 待命: hold until commanded, no auto-clash
          orderCdLeft: 0,
          generalId: general.id,
          soldierIds: [],
          leaderAlive: true,
          damageMult: 1,
        };
        for (let i = 0; i < count; i += 1) {
          const rank = Math.floor(i / files);
          const file = i % files;
          const x = frontX - dir * rank * rankGap;
          const y = bandCenterY + (file - (files - 1) / 2) * fileGap;
          const soldier = makeUnit(units.length, sideIndex, gid, 'soldier', x, y, tpl);
          units.push(soldier);
          squads[gid].soldierIds.push(soldier.id);
        }
      });
    });

    return {
      schema: SCHEMA,
      tick: 0,
      config,
      arena,
      rng,
      units,
      squads,
      sideIds,
      auto: false,
      masterUsed: sideIds.map(() => Object.create(null)),
      result: null,
    };
  }

  // ---- targeting (sticky + spatial grid) ----

  function buildGrid(battle, cell) {
    const cols = Math.max(1, Math.ceil(battle.arena.w / cell));
    const rows = Math.max(1, Math.ceil(battle.arena.h / cell));
    const grid = new Array(cols * rows);
    for (let i = 0; i < grid.length; i += 1) grid[i] = null;
    const units = battle.units;
    for (let i = 0; i < units.length; i += 1) {
      const u = units[i];
      if (!u.alive || u.left) continue;
      let cx = (u.x / cell) | 0;
      let cy = (u.y / cell) | 0;
      if (cx < 0) cx = 0;
      else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0;
      else if (cy >= rows) cy = rows - 1;
      const idx = cy * cols + cx;
      if (grid[idx] === null) grid[idx] = [];
      grid[idx].push(i);
    }
    return { grid, cols, rows, cell };
  }

  function acquireTarget(battle, u, g) {
    const cell = g.cell;
    let cx = (u.x / cell) | 0;
    let cy = (u.y / cell) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= g.cols) cx = g.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= g.rows) cy = g.rows - 1;
    let best = -1;
    let bestD = Infinity;
    const maxR = g.cols + g.rows;
    for (let r = 0; r <= maxR; r += 1) {
      for (let oy = -r; oy <= r; oy += 1) {
        for (let ox = -r; ox <= r; ox += 1) {
          if (Math.abs(ox) !== r && Math.abs(oy) !== r) continue;
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue;
          const bucket = g.grid[ny * g.cols + nx];
          if (!bucket) continue;
          for (let k = 0; k < bucket.length; k += 1) {
            const bi = bucket[k];
            const b = battle.units[bi];
            if (b.side === u.side || !b.alive || b.left) continue;
            const dx = b.x - u.x;
            const dy = b.y - u.y;
            const d = dx * dx + dy * dy;
            if (d < bestD) {
              bestD = d;
              best = bi;
            }
          }
        }
      }
      if (best >= 0 && r >= 1) break;
    }
    return best;
  }

  // ---- order behaviors (extension point: register one kind-aware handler) ----
  // Each handler returns an intent: { engage, pursue, fallback, leaveField }.
  //   engage:     acquire/keep a target and attack when in range
  //   pursue:     when engaging and target out of range, advance toward it
  //   fallback:   movement when not attacking — 'enemyEdge' | 'homeEdge' | 'screen' | null
  //   leaveField: when moving to the home edge, leave the field on crossing it
  function intentAdvance() {
    return { engage: true, pursue: true, fallback: 'enemyEdge', leaveField: false };
  }
  function intentDefend() {
    return { engage: true, pursue: false, fallback: null, leaveField: false };
  }
  function intentRetreat(leaveField) {
    return { engage: false, pursue: false, fallback: 'homeEdge', leaveField: leaveField };
  }
  function intentCover() {
    return { engage: true, pursue: false, fallback: 'screen', leaveField: false };
  }

  const ORDER_BEHAVIORS = Object.create(null);
  ORDER_BEHAVIORS[ORDER.ADVANCE] = () => intentAdvance();
  ORDER_BEHAVIORS[ORDER.ALL_OUT] = () => intentAdvance();
  ORDER_BEHAVIORS[ORDER.DEFEND] = () => intentDefend();
  ORDER_BEHAVIORS[ORDER.ALL_RETREAT] = () => intentRetreat(true);
  // 士兵出击: soldiers push, general holds the rear.
  ORDER_BEHAVIORS[ORDER.SOLDIER_ATTACK] = (u) =>
    u.kind === 'soldier' ? intentAdvance() : intentDefend();
  // 武将出击: general charges in, soldiers stand guard.
  ORDER_BEHAVIORS[ORDER.GENERAL_CHARGE] = (u) =>
    u.kind === 'general' ? intentAdvance() : intentDefend();
  // 武将后退: general pulls back (stays on field), soldiers cover.
  ORDER_BEHAVIORS[ORDER.GENERAL_RETREAT] = (u) =>
    u.kind === 'general' ? intentRetreat(false) : intentCover();
  // 掩护: soldiers screen the general, general holds.
  ORDER_BEHAVIORS[ORDER.COVER] = (u) => (u.kind === 'soldier' ? intentCover() : intentDefend());

  function resolveIntent(u, squad) {
    if (u.routed) return intentRetreat(true);
    const handler = ORDER_BEHAVIORS[squad.order] || ORDER_BEHAVIORS[ORDER.ADVANCE];
    return handler(u, squad);
  }

  // ---- skill phase (reserved stub for the deferred skill system) ----
  function skillPhase(battle) {
    // Future: tick down skillCds, accumulate passive rage, auto-cast when ready.
    // Manual casts arrive via 'skill' input entries (currently ignored).
    void battle;
  }

  // ---- input stream ----
  function applyInput(battle, input) {
    if (!input || typeof input !== 'object') return false;
    if (input.type === 'skill') return false; // reserved
    if (input.type !== 'order') return false;
    const order = String(input.order);

    if (order === ORDER.ALL_OUT || order === ORDER.ALL_RETREAT) {
      const side = toNum(input.side, -1);
      if (side < 0 || side >= battle.sideIds.length) return false;
      if (battle.masterUsed[side][order]) return false; // each master order once
      battle.masterUsed[side][order] = true;
      battle.auto = true; // player hands control to auto after a master order
      for (const gid of Object.keys(battle.squads)) {
        const sq = battle.squads[gid];
        if (sq.side === side) sq.order = order;
      }
      return true;
    }

    const sq = battle.squads[String(input.gid)];
    if (!sq) return false;
    if (sq.orderCdLeft > 0) return false; // 5s cooldown
    if (!ORDER_BEHAVIORS[order]) return false;
    sq.order = order;
    sq.orderCdLeft = battle.config.orderCdTicks;
    return true;
  }

  // ---- combat ----
  function homeEdgeX(battle, side) {
    return side === 0 ? -battle.config.edgeMargin : battle.arena.w + battle.config.edgeMargin;
  }

  // Covering soldiers position between their general and the nearest threat to it.
  function screenPoint(battle, squad, g) {
    const gen = battle.units[squad.generalId];
    if (!gen || !gen.alive || gen.left) return null;
    const enemyIdx = acquireTarget(battle, gen, g);
    if (enemyIdx < 0) return { x: gen.x, y: gen.y };
    const e = battle.units[enemyIdx];
    const dx = e.x - gen.x;
    const dy = e.y - gen.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const screenDist = battle.config.aggroRange * 0.5;
    return { x: gen.x + (dx / d) * screenDist, y: gen.y + (dy / d) * screenDist };
  }

  function step(battle, inputs) {
    if (battle.result) return battle.result;
    const cfg = battle.config;

    if (Array.isArray(inputs)) {
      for (let i = 0; i < inputs.length; i += 1) applyInput(battle, inputs[i]);
    }
    skillPhase(battle);

    for (const gid of Object.keys(battle.squads)) {
      const sq = battle.squads[gid];
      if (sq.orderCdLeft > 0) sq.orderCdLeft -= 1;
    }

    const cell = Math.max(16, cfg.aggroRange);
    const g = buildGrid(battle, cell);
    const units = battle.units;
    const deadGenerals = [];

    for (let i = 0; i < units.length; i += 1) {
      const u = units[i];
      if (!u.alive || u.left) continue;
      const sq = battle.squads[u.gid];
      const intent = resolveIntent(u, sq);
      const sp = u.moveSpeed * (1 / cfg.tickHz);

      // 1) engage: attack a target in range, or pursue it.
      if (intent.engage) {
        let target = u.targetId >= 0 ? units[u.targetId] : null;
        if (!target || !target.alive || target.left) {
          u.targetId = acquireTarget(battle, u, g);
          target = u.targetId >= 0 ? units[u.targetId] : null;
        }
        if (target) {
          const dx = target.x - u.x;
          const dy = target.y - u.y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= u.range * u.range) {
            u.state = STATE.ENGAGE;
            if (u.atkCd > 0) {
              u.atkCd -= 1;
            } else {
              u.atkCd = u.atkInterval;
              const dmg = Math.max(1, Math.round(u.atk * sq.damageMult - target.def * 0.5));
              target.hp -= dmg;
              u.rage += cfg.rageOnHit; // reserved for skills
              if (target.hp <= 0 && target.alive) {
                target.alive = false;
                target.state = STATE.DEAD;
                if (target.kind === 'general') deadGenerals.push(target);
              }
            }
            continue;
          }
          if (intent.pursue) {
            const d = Math.sqrt(d2) || 1;
            u.x += (dx / d) * sp;
            u.y += (dy / d) * sp;
            u.state = STATE.ADVANCE;
            continue;
          }
          // engaging but not pursuing: fall through to fallback movement.
        }
      }

      // 2) fallback movement when not attacking/pursuing.
      if (intent.fallback === 'enemyEdge') {
        u.state = STATE.ADVANCE;
        u.x += (u.side === 0 ? 1 : -1) * sp;
      } else if (intent.fallback === 'homeEdge') {
        u.state = STATE.RETREAT;
        const ex = homeEdgeX(battle, u.side);
        u.x += Math.sign(ex - u.x) * sp;
        if (intent.leaveField && ((u.side === 0 && u.x <= ex) || (u.side === 1 && u.x >= ex))) {
          u.left = true;
        }
      } else if (intent.fallback === 'screen') {
        const p = screenPoint(battle, sq, g);
        if (p) {
          const dx = p.x - u.x;
          const dy = p.y - u.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 1) {
            u.x += (dx / d) * sp;
            u.y += (dy / d) * sp;
          }
          u.state = STATE.COVER;
        } else {
          u.state = STATE.HOLD;
        }
      } else {
        u.state = STATE.HOLD;
      }
    }

    // Leader death -> squad morale collapse: half damage + seeded rout rolls.
    for (let i = 0; i < deadGenerals.length; i += 1) {
      const sq = battle.squads[deadGenerals[i].gid];
      if (!sq || !sq.leaderAlive) continue;
      sq.leaderAlive = false;
      sq.damageMult = cfg.leaderDeathDamageMult;
      for (let k = 0; k < sq.soldierIds.length; k += 1) {
        const s = units[sq.soldierIds[k]];
        if (s.alive && !s.left && battle.rng() < cfg.routChance) {
          s.routed = true;
          s.state = STATE.RETREAT;
        }
      }
    }

    battle.tick += 1;
    return checkResult(battle);
  }

  function countOnField(battle) {
    const counts = battle.sideIds.map(() => 0);
    const units = battle.units;
    for (let i = 0; i < units.length; i += 1) {
      const u = units[i];
      if (u.alive && !u.left) counts[u.side] += 1;
    }
    return counts;
  }

  function summarize(battle, winner) {
    const survivorsByGid = Object.create(null);
    const units = battle.units;
    for (let i = 0; i < units.length; i += 1) {
      const u = units[i];
      if (u.kind !== 'soldier') continue;
      if (!survivorsByGid[u.gid]) survivorsByGid[u.gid] = 0;
      if (u.alive && !u.left) survivorsByGid[u.gid] += 1;
    }
    return {
      schema: SCHEMA,
      winner, // sideId, or 'draw'
      ticks: battle.tick,
      onField: countOnField(battle),
      survivorsByGid,
    };
  }

  function checkResult(battle) {
    if (battle.result) return battle.result;
    const counts = countOnField(battle);
    const alive = counts.map((c) => c > 0);
    const sidesAlive = alive.filter(Boolean).length;
    if (sidesAlive <= 1) {
      let winner = 'draw';
      for (let i = 0; i < alive.length; i += 1) {
        if (alive[i]) winner = battle.sideIds[i];
      }
      battle.result = summarize(battle, winner);
    } else if (battle.tick >= battle.config.maxTicks) {
      // Safety cap: side with more on-field units wins, else draw.
      let best = -1;
      let bestI = -1;
      let tie = false;
      for (let i = 0; i < counts.length; i += 1) {
        if (counts[i] > best) {
          best = counts[i];
          bestI = i;
          tie = false;
        } else if (counts[i] === best) {
          tie = true;
        }
      }
      battle.result = summarize(battle, tie ? 'draw' : battle.sideIds[bestI]);
    }
    return battle.result;
  }

  // Run a whole battle headlessly from an input stream (backend authority path).
  function simulate(setup, inputStream = [], options = {}) {
    const battle = createBattle(setup);
    const byTick = Object.create(null);
    for (let i = 0; i < inputStream.length; i += 1) {
      const e = inputStream[i];
      const t = Math.max(0, Math.floor(toNum(e && e.tick, 0)));
      if (!byTick[t]) byTick[t] = [];
      byTick[t].push(e);
    }
    const maxTicks = Math.max(1, Math.floor(toNum(options.maxTicks, battle.config.maxTicks)));
    while (!battle.result && battle.tick < maxTicks) {
      step(battle, byTick[battle.tick] || null);
    }
    if (!battle.result) battle.result = summarize(battle, 'draw');
    return battle.result;
  }

  const BattleSimCore = {
    SCHEMA,
    STATE,
    ORDER,
    DEFAULTS,
    ORDER_BEHAVIORS,
    createRng,
    createBattle,
    step,
    simulate,
    applyInput,
    countOnField,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BattleSimCore;
  root.BattleSimCore = BattleSimCore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
