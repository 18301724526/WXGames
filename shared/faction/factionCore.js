// factionCore — pure entity model + id conventions + lifecycle for 势力(Faction), spine A of the
// PVPVE/三国志 system (docs/design/01, decisions in 08). PLAYER AND AI (and lightweight NEUTRAL
// garrisons) use ONE model; a real player is just the faction whose id is `player_<playerId>` — never
// a special case. This module has NO persistence and NO cross-module deps: it defines the canonical
// faction SHAPE, the id namespace, derived-view helpers, and the lifecycle state machine (incl. the
// 首都失守 -> rebuilding flow). The registry/repository (shared world state) wraps it in phase 1.
//
// Single source: a faction row NEVER stores its cities/officers/diplomacy — those live on
// territory.ownerFactionId / person.factionId / the diplomacy edges and are derived by query. This
// module deliberately has no cities[]/officers[] fields.

const KIND = Object.freeze({ PLAYER: 'player', AI: 'ai', NEUTRAL: 'neutral' });
const LIFECYCLE = Object.freeze({ ALIVE: 'alive', COLLAPSED: 'collapsed', REBUILDING: 'rebuilding' });
const KINDS = Object.freeze(Object.values(KIND));
const LIFECYCLES = Object.freeze(Object.values(LIFECYCLE));

function toStr(value) {
  return value == null ? '' : String(value);
}

// ── id namespace ────────────────────────────────────────────────────────────
// Prefixes keep the three kinds collision-free in one registry map. A real player's faction id is
// derived from their playerId, so faction identity and account identity stay in lockstep.
function playerFactionId(playerId) {
  return `player_${toStr(playerId)}`;
}
function aiFactionId(slug) {
  return `ai_${toStr(slug)}`;
}
function neutralFactionId(key) {
  return `neutral_${toStr(key)}`;
}
function parseFactionId(factionId) {
  const id = toStr(factionId);
  const sep = id.indexOf('_');
  if (sep < 0) return { kind: null, key: id };
  const prefix = id.slice(0, sep);
  const kind = KINDS.includes(prefix) ? prefix : null;
  return { kind, key: id.slice(sep + 1) };
}
function kindOf(factionId) {
  return parseFactionId(factionId).kind;
}
function isPlayerFaction(factionId) { return kindOf(factionId) === KIND.PLAYER; }
function isAiFaction(factionId) { return kindOf(factionId) === KIND.AI; }
function isNeutralFaction(factionId) { return kindOf(factionId) === KIND.NEUTRAL; }
function playerIdOfFaction(factionId) {
  const parsed = parseFactionId(factionId);
  return parsed.kind === KIND.PLAYER ? parsed.key : null;
}

// ── entity ──────────────────────────────────────────────────────────────────
function normalizeTreasury(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const bag = {};
  for (const [k, v] of Object.entries(src)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) bag[k] = Math.floor(n); // only positive holdings; 0/negative dropped
  }
  return bag;
}

function normalizeLifecycle(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const state = LIFECYCLES.includes(src.state) ? src.state : LIFECYCLE.ALIVE;
  return {
    state,
    foundedAt: src.foundedAt || null,
    collapsedAt: src.collapsedAt || null,
    collapsedReason: src.collapsedReason || null,
    rebuildCampId: src.rebuildCampId || null, // 首都失守 -> temp camp id to rebuild from
  };
}

function normalizeFaction(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const id = toStr(src.id);
  const kind = KINDS.includes(src.kind) ? src.kind : (kindOf(id) || KIND.AI);
  return {
    id,
    kind,
    name: toStr(src.name),
    color: toStr(src.color),
    rulerPersonId: src.rulerPersonId ? toStr(src.rulerPersonId) : null,
    capitalCityName: toStr(src.capitalCityName),
    // player only: which player account owns this faction (its game_states row).
    homePlayerId: kind === KIND.PLAYER ? (src.homePlayerId ? toStr(src.homePlayerId) : parseFactionId(id).key) : null,
    // faction-level 国库 for BOTH player and AI (confirmed decision 01-4).
    treasury: normalizeTreasury(src.treasury),
    // player tech authority stays gameState.techs (tech=null); AI carries a compact profile.
    tech: kind === KIND.AI && src.tech && typeof src.tech === 'object' ? { ...src.tech } : null,
    aiProfile: kind === KIND.AI && src.aiProfile && typeof src.aiProfile === 'object' ? { ...src.aiProfile } : null,
    lifecycle: normalizeLifecycle(src.lifecycle),
    createdAt: src.createdAt || null,
    updatedAt: src.updatedAt || null,
  };
}

function isPlayer(faction) {
  return normalizeFaction(faction).kind === KIND.PLAYER;
}

// How a faction appears to a given viewer BEFORE diplomacy: itself, a lightweight neutral, or another
// faction. Diplomacy state (ally/rival/nemesis) layers on top via diplomacyCore — not stored here.
function relationToViewer(factionId, viewerFactionId) {
  const id = toStr(factionId);
  if (id && id === toStr(viewerFactionId)) return 'self';
  if (isNeutralFaction(id)) return 'neutral';
  return 'other';
}

// ── lifecycle ─────────────────────────────────────────────────────────────
// A faction acts only while alive. collapsed = lost every city (kept as a row for history/宿敌);
// rebuilding = 首都失守 -> respawned as a temp camp, running the rebuild quest chain (decision 05-2).
function canAct(faction) {
  return normalizeFaction(faction).lifecycle.state === LIFECYCLE.ALIVE;
}

function markCollapsed(faction, reason, now) {
  const f = normalizeFaction(faction);
  f.lifecycle = { ...f.lifecycle, state: LIFECYCLE.COLLAPSED, collapsedAt: now || null, collapsedReason: reason || 'conquered' };
  f.updatedAt = now || f.updatedAt;
  return f;
}

// 首都失守: enter the rebuilding state anchored on a temp camp (player is NOT eliminated).
function markRebuilding(faction, rebuildCampId, now) {
  const f = normalizeFaction(faction);
  f.lifecycle = { ...f.lifecycle, state: LIFECYCLE.REBUILDING, rebuildCampId: toStr(rebuildCampId) || null };
  f.updatedAt = now || f.updatedAt;
  return f;
}

function markAlive(faction, now) {
  const f = normalizeFaction(faction);
  f.lifecycle = { ...f.lifecycle, state: LIFECYCLE.ALIVE, collapsedAt: null, collapsedReason: null, rebuildCampId: null };
  f.updatedAt = now || f.updatedAt;
  return f;
}

module.exports = {
  KIND,
  LIFECYCLE,
  KINDS,
  playerFactionId,
  aiFactionId,
  neutralFactionId,
  parseFactionId,
  kindOf,
  isPlayerFaction,
  isAiFaction,
  isNeutralFaction,
  playerIdOfFaction,
  normalizeFaction,
  isPlayer,
  relationToViewer,
  canAct,
  markCollapsed,
  markRebuilding,
  markAlive,
};
