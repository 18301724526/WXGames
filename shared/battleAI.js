(function (root) {
  'use strict';

  // Minimal behavior-tree AI for one battle side. Pure function of battle state
  // (no RNG, so it stays deterministic and replayable). It emits battleSimCore
  // input-stream order entries; the cooldown is respected so it never spams.
  // Headless + UMD so the backend (auto-battles/AI raids) and the frontend
  // battle scene can both drive an AI side from the SAME logic.

  const SCHEMA = 'battle-ai-v1';

  const DEFAULTS = Object.freeze({
    retreatHpRatio: 0.25, // general pulls back below this hp fraction
    engageDist: 90, // commit soldiers when an enemy is within this distance
  });

  function num(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function nearestEnemyDist2(battle, side, from) {
    let best = Infinity;
    const us = battle.units;
    for (let i = 0; i < us.length; i += 1) {
      const u = us[i];
      if (u.side === side || !u.alive || u.left) continue;
      const dx = u.x - from.x;
      const dy = u.y - from.y;
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    return best;
  }

  function squadAnchor(battle, sq) {
    const gen = battle.units[sq.generalId];
    if (gen && gen.alive && !gen.left) return gen;
    for (let k = 0; k < sq.soldierIds.length; k += 1) {
      const s = battle.units[sq.soldierIds[k]];
      if (s.alive && !s.left) return s;
    }
    return null;
  }

  // Selector behavior tree (first matching rule wins):
  //   1) general hurt        -> 武将后退 (pull the general back, soldiers cover)
  //   2) enemy within reach  -> 士兵出击 (commit soldiers, keep the general safer)
  //   3) otherwise           -> 推进 (close the distance)
  function decideSquadOrder(battle, sq, cfg) {
    const gen = battle.units[sq.generalId];
    const genAlive = gen && gen.alive && !gen.left;
    if (genAlive && gen.maxHp > 0 && gen.hp / gen.maxHp < cfg.retreatHpRatio) {
      return 'generalRetreat';
    }
    const anchor = squadAnchor(battle, sq);
    if (!anchor) return null;
    const reach = cfg.engageDist * cfg.engageDist;
    if (nearestEnemyDist2(battle, sq.side, anchor) <= reach) return 'soldierAttack';
    return 'advance';
  }

  // Returns input-stream order entries for the given side this tick.
  function decideSideOrders(battle, side, config) {
    const cfg = {
      retreatHpRatio: num(config && config.retreatHpRatio, DEFAULTS.retreatHpRatio),
      engageDist: num(config && config.engageDist, DEFAULTS.engageDist),
    };
    const inputs = [];
    const gids = Object.keys(battle.squads);
    for (let i = 0; i < gids.length; i += 1) {
      const sq = battle.squads[gids[i]];
      if (sq.side !== side || sq.orderCdLeft > 0) continue;
      const desired = decideSquadOrder(battle, sq, cfg);
      if (desired && desired !== sq.order) {
        inputs.push({ type: 'order', gid: gids[i], order: desired });
      }
    }
    return inputs;
  }

  const api = { SCHEMA, DEFAULTS, decideSquadOrder, decideSideOrders };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BattleAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
