// FactionRegistryService — the single READ doorway for 势力(Faction) facts (docs/design/01, 08).
// Unifies the two authoritative sources into one faction view: a REAL player's faction is
// materialized from its game_states (polity today; a dedicated faction block later) so the player is
// literally "the faction whose id is player_<playerId>"; AI + neutral factions come from the shared
// FactionRepository. This service is READ-ONLY and ADDITIVE — it introduces no migration and mutates
// nothing; it just gives every caller (diplomacy, AI, occupy/招降, DTO) one place to ask "what is
// faction X?" instead of poking at polity/owner strings.
//
// Single source: cities/officers/diplomacy are NOT read from the faction here — those are separate
// queries (territory.ownerFactionId / person.factionId / diplomacy edges). This module only resolves
// the faction ENTITY.

const factionCore = require('../../../shared/faction/factionCore');

function createFactionRegistryService(deps = {}) {
  const factionRepo = deps.factionRepo || null;

  // Materialize the requesting player's faction from their gameState. Until the faction spine
  // migration lands, the fields come from gameState.polity + playerId (read-equivalent: polity stays
  // authoritative, this is just a typed view). Treasury/tech stay where they are today (per-city
  // economy + gameState.techs) — the faction-level treasury refactor (decision 01-4) is a later slice.
  function materializePlayerFaction(gameState = {}) {
    const playerId = gameState.playerId || '';
    const polity = gameState.polity && typeof gameState.polity === 'object' ? gameState.polity : {};
    const lifecycle = gameState.factionLifecycle && typeof gameState.factionLifecycle === 'object'
      ? gameState.factionLifecycle
      : { state: factionCore.LIFECYCLE.ALIVE };
    return factionCore.normalizeFaction({
      id: factionCore.playerFactionId(playerId),
      kind: factionCore.KIND.PLAYER,
      name: polity.name || '',
      color: polity.color || '',
      capitalCityName: polity.capitalCityName || '',
      homePlayerId: playerId,
      rulerPersonId: polity.rulerPersonId || null,
      lifecycle,
    });
  }

  function isOwnPlayerFaction(factionId, gameState) {
    return factionCore.isPlayerFaction(factionId)
      && factionId === factionCore.playerFactionId(gameState && gameState.playerId);
  }

  function getFaction(factionId, gameState = {}) {
    if (isOwnPlayerFaction(factionId, gameState)) return materializePlayerFaction(gameState);
    return factionRepo ? factionRepo.getFaction(factionId) : null;
  }

  function getPlayerFaction(gameState = {}) {
    return materializePlayerFaction(gameState);
  }

  function getAiFactions() {
    return factionRepo ? factionRepo.getFactionsByKind(factionCore.KIND.AI) : [];
  }

  function getNeutralFactions() {
    return factionRepo ? factionRepo.getFactionsByKind(factionCore.KIND.NEUTRAL) : [];
  }

  // All factions visible in this request: the requesting player's own faction + every shared
  // (AI + neutral) faction. Other real players' factions arrive via projection in a later slice
  // (parallel to sharedWorldTerritories) — noted so the merge point is explicit.
  function getAllFactions(gameState = {}) {
    const shared = factionRepo ? factionRepo.getAllFactions() : [];
    return [materializePlayerFaction(gameState), ...shared];
  }

  function getAliveFactions(gameState = {}) {
    return getAllFactions(gameState).filter((f) => f && factionCore.canAct(f));
  }

  return {
    materializePlayerFaction,
    getPlayerFaction,
    getFaction,
    getAiFactions,
    getNeutralFactions,
    getAllFactions,
    getAliveFactions,
  };
}

module.exports = { createFactionRegistryService };
