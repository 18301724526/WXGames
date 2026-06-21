'use strict';

// Backend authority for the new entity-based battle. Turns real formation /
// troop / general data into a battleSimCore setup, runs the deterministic core
// (the SAME module the frontend battle scene will run for the spectacle), and
// maps the authoritative casualties back onto a formation snapshot.
//
// This does NOT replace the legacy turn-based simulateConquestBattle yet: that
// one still feeds the old battle-replay UI. The live swap happens when the new
// battle scene (frontend) is ready to take over rendering.
//
// The attribute -> combat-stat conversion below is an intentional, isolated
// PLACEHOLDER. Real balance values should later move into the config registry.

const BattleSimCore = require('../../../shared/battleSimCore');

const SCHEMA = 'battle-sim-service-v1';

// Tunable balance defaults (placeholder — to be moved into config later).
const DEFAULT_BALANCE = Object.freeze({
  arena: { w: 720, h: 1280 }, // portrait, left-right clash
  general: {
    hpBase: 200,
    hpPerForce: 4,
    atkBase: 20,
    atkPerForce: 0.6,
    defPerCommand: 0.4,
    range: 16,
    moveSpeed: 80,
    atkIntervalBase: 20, // ticks between hits at 0 speed
    atkIntervalPerSpeed: 0.12,
    atkIntervalMin: 5,
  },
  soldier: { hp: 20, atk: 6, def: 2, range: 12, moveSpeed: 70, atkSpeed: 12 },
});

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function mergeBalance(config = {}) {
  return {
    arena: Object.assign({}, DEFAULT_BALANCE.arena, config.arena),
    general: Object.assign({}, DEFAULT_BALANCE.general, config.general),
    soldier: Object.assign({}, DEFAULT_BALANCE.soldier, config.soldier),
    core: config.core || {},
  };
}

// attributes: { force, command, speed, ... } in the famous-person/defender scale.
function generalStats(attributes = {}, balance) {
  const g = balance.general;
  const force = num(attributes.force, 45);
  const command = num(attributes.command, 45);
  const speed = num(attributes.speed, 45);
  return {
    hp: Math.round(g.hpBase + force * g.hpPerForce),
    atk: Math.round(g.atkBase + force * g.atkPerForce),
    def: Math.round(command * g.defPerCommand),
    range: g.range,
    moveSpeed: g.moveSpeed,
    atkSpeed: clamp(
      Math.round(g.atkIntervalBase - speed * g.atkIntervalPerSpeed),
      g.atkIntervalMin,
      g.atkIntervalBase,
    ),
  };
}

// A "force" is one side: { generals: [{ gid, attributes, soldiers }] }.
function buildSideGenerals(force = {}, balance) {
  const generals = Array.isArray(force.generals) ? force.generals : [];
  return generals.map((gd) => ({
    gid: String(gd.gid),
    stats: generalStats(gd.attributes || {}, balance),
    troop: {
      count: Math.max(0, Math.floor(num(gd.soldiers, 0))),
      template: Object.assign({}, balance.soldier),
    },
  }));
}

function buildSetup(input = {}) {
  const balance = mergeBalance(input.config);
  return {
    seed: num(input.seed, 1),
    arena: input.arena || balance.arena,
    config: balance.core,
    sides: [
      {
        side: input.attacker && input.attacker.side ? String(input.attacker.side) : 'attacker',
        generals: buildSideGenerals(input.attacker || {}, balance),
      },
      {
        side: input.defender && input.defender.side ? String(input.defender.side) : 'defender',
        generals: buildSideGenerals(input.defender || {}, balance),
      },
    ],
  };
}

// Run a full authoritative battle. inputStream = tick-tagged player orders/skills.
function resolve(input = {}) {
  const setup = buildSetup(input);
  const result = BattleSimCore.simulate(setup, input.inputStream || [], input.options || {});
  return { schema: SCHEMA, setup, result };
}

// Map authoritative survivors back onto a formation snapshot (pure).
// result.survivorsByGid is keyed by gid; we use member.personId as gid.
function applyCasualtiesToFormationSnapshot(snapshot, result) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const survivors = (result && result.survivorsByGid) || {};
  const members = (Array.isArray(snapshot.members) ? snapshot.members : []).map((m) => {
    const committed = num(m.soldiersCommitted, 0);
    const remaining = clamp(Math.floor(num(survivors[String(m.personId)], 0)), 0, committed);
    return Object.assign({}, m, { soldiersRemaining: remaining });
  });
  const soldiersRemaining = members.reduce((s, m) => s + num(m.soldiersRemaining, 0), 0);
  return Object.assign({}, snapshot, { members, soldiersRemaining });
}

// Full authoritative loop: real attacker formation snapshot + general attributes
// vs a defender force -> deterministic battle -> survivors written back onto the
// snapshot. This is the backend half of "march/expedition meets enemy -> fight ->
// persist". The caller resolves personId -> attributes (from famous-person state)
// and persists the returned attackerSnapshot; this service owns no game-state shape.
function resolveBattle(request = {}) {
  const attacker = request.attacker || {};
  const snapshot = attacker.snapshot || { members: [] };
  const attrs = attacker.attributesByPersonId || {};
  const members = Array.isArray(snapshot.members) ? snapshot.members : [];
  const attackerGenerals = members.map((m) => ({
    gid: String(m.personId),
    attributes: attrs[m.personId] || {},
    soldiers: num(m.soldiersRemaining != null ? m.soldiersRemaining : m.soldiersCommitted, 0),
  }));
  const defender = request.defender || { generals: [] };
  const out = resolve({
    seed: request.seed,
    arena: request.arena,
    config: request.config,
    inputStream: request.inputStream,
    options: request.options,
    attacker: { side: 'attacker', generals: attackerGenerals },
    defender: { side: 'defender', generals: defender.generals || [] },
  });
  const attackerSnapshot = applyCasualtiesToFormationSnapshot(snapshot, out.result);
  return {
    schema: SCHEMA,
    result: out.result,
    winner: out.result.winner,
    attackerSnapshot,
  };
}

module.exports = {
  SCHEMA,
  DEFAULT_BALANCE,
  generalStats,
  buildSetup,
  resolve,
  applyCasualtiesToFormationSnapshot,
  resolveBattle,
};
