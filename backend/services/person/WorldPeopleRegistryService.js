// WorldPeopleRegistryService — the single READ doorway for PEOPLE facts (docs/design/02, 03, 08).
// Unifies the two authoritative sources into one person registry: a REAL player's roster is
// materialized from its game_states (gameState.famousPeople), each stamped with the player's factionId
// (player_<playerId>) and its social fields backfilled through the one source (PersonSocialFields);
// 在野武将 + AI-faction officers come from the shared WorldPeopleRepository. READ-ONLY and ADDITIVE — no
// migration, mutates nothing; it just gives every caller (relationship tick, 招降, AI, DTO) one place to
// ask "who is person X?" / "who serves faction Y?" instead of poking at famousPeople vs the shared table.
//
// Single source: famousPeople stays authoritative for the player's roster (this only projects a typed
// view); the shared table is authoritative for everyone else. A captive recruited into a player MOVES
// from the shared table into that player's famousPeople (repo.deletePerson + roster add) — done by the
// ②b wiring, not here.

const factionCore = require('../../../shared/faction/factionCore');
const PersonSocialFields = require('./PersonSocialFields');

function createWorldPeopleRegistryService(deps = {}) {
  const worldPeopleRepo = deps.worldPeopleRepo || null;

  // Project the requesting player's roster into registry-shaped people: keep every existing field
  // (read-equivalent), stamp the player's factionId, and backfill the social sub-object deterministically
  // so player people carry personality/relationships in the same shape as world people.
  function materializePlayerRoster(gameState = {}) {
    const playerId = gameState.playerId || '';
    const factionId = factionCore.playerFactionId(playerId);
    const roster = Array.isArray(gameState.famousPeople) ? gameState.famousPeople : [];
    return roster
      .filter((p) => p && p.id)
      .map((p) => ({ ...p, ...PersonSocialFields.normalizeSocial(p, String(p.id)), id: String(p.id), factionId }));
  }

  function isOwnPlayerFaction(factionId, gameState) {
    return factionCore.isPlayerFaction(factionId)
      && factionId === factionCore.playerFactionId(gameState && gameState.playerId);
  }

  function getPerson(personId, gameState = {}) {
    const id = String(personId || '');
    const own = materializePlayerRoster(gameState).find((p) => p.id === id);
    if (own) return own;
    return worldPeopleRepo ? worldPeopleRepo.getPerson(id) : null;
  }

  // 在野武将 (recruitment pool) — always from the shared table.
  function getRoninPeople() {
    return worldPeopleRepo ? worldPeopleRepo.getRoninPeople() : [];
  }

  // Everyone serving a given faction: the player's own roster if it's their faction, else the shared
  // table's officers for that faction.
  function getPeopleByFaction(factionId, gameState = {}) {
    if (isOwnPlayerFaction(factionId, gameState)) return materializePlayerRoster(gameState);
    return worldPeopleRepo ? worldPeopleRepo.getPeopleByFaction(factionId) : [];
  }

  // The union registry visible in this request: the player's own roster + every shared person
  // (在野 + AI officers). Other real players' rosters arrive via projection in a later slice
  // (parallel to sharedWorldTerritories) — noted so the merge point is explicit.
  function getAllPeople(gameState = {}) {
    const shared = worldPeopleRepo ? worldPeopleRepo.getAllPeople() : [];
    return [...materializePlayerRoster(gameState), ...shared];
  }

  return {
    materializePlayerRoster,
    getPerson,
    getRoninPeople,
    getPeopleByFaction,
    getAllPeople,
  };
}

module.exports = { createWorldPeopleRegistryService };
