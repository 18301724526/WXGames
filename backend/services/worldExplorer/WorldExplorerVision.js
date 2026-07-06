const WorldMapService = require('../WorldMapService');
const WorldMarchCore = require('../../../shared/worldMarchCore');
const { toInteger } = require('../../../shared/numberUtils');
const { EXPLORE_REVEAL_RADIUS } = require('./WorldExplorerShared');

// WorldExplorerVision — SSOT for the player's CURRENT (live) vision, computed fresh from the
// present game state on every call. This is deliberately NOT the reveal history: worldMap.tiles
// accumulates everything ever revealed (plus solid-fill bridge tiles and AI-explorer hidden
// tiles), while current vision is only what the player's eyes cover RIGHT NOW —
//   · every occupied player city (capital + captured cities), and
//   · every fielded march party at its current position.
// Consumers that want "live units the player can see" (hostile encounters — walk away and they
// vanish, come back and they reappear) gate on this set. Consumers that want "seen once → known
// forever" (tiles, discovered cities) gate on WorldMapService.getRevealedTileCoordSet instead.
//
// Radii are the existing fog-reveal single sources — vision IS the reveal range, by definition:
//   · unit: EXPLORE_REVEAL_RADIUS (the march-step reveal radius, WorldExplorerShared)
//   · city: START_REVEAL_RADIUS (the capital's initial revealed area, WorldMapConstants)
const UNIT_VISION_RADIUS = EXPLORE_REVEAL_RADIUS;
const CITY_VISION_RADIUS = WorldMapService.START_REVEAL_RADIUS;

// mission.combat.status values that mean the party is STANDING ON its target tile mid-fight
// (mission.status is already 'idle' by then — arrival flips it before the battle settles). The
// vocabulary is owned by WorldCombatEncounterService, which requires this module, so the two
// literals are mirrored here (a require back into worldCombat would be a cycle).
const FIELDED_COMBAT_STATUSES = Object.freeze(['engaged', 'inBattle']);

function getCapitalOriginCoord(worldMap = {}) {
  const origin = worldMap && typeof worldMap.origin === 'object' ? worldMap.origin : null;
  const q = Number(origin?.q ?? origin?.x);
  const r = Number(origin?.r ?? origin?.y);
  if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
  return { q: Math.floor(q), r: Math.floor(r) };
}

function isPlayerVisionCity(territory) {
  if (!territory || typeof territory !== 'object') return false;
  // The capital is BY DEFINITION the player's occupied home city (createCapital always stamps
  // owner:'player'/status:'occupied'); raw saves may carry it without those fields, and losing
  // capital vision would blind the whole home area, so it qualifies by id.
  if (territory.id === 'capital') return true;
  return territory.owner === 'player' && territory.status === 'occupied';
}

// Occupied player cities as vision sources. The capital is projected onto worldMap.origin (the
// same projection the client assembler applies — capitals spawn off world-origin, and a raw save
// may still carry the legacy 0,0 placement).
function getCityVisionCoords(gameState = {}) {
  const origin = getCapitalOriginCoord(gameState.worldMap);
  return (Array.isArray(gameState.territories) ? gameState.territories : [])
    .filter(isPlayerVisionCity)
    .map((territory) => (territory.id === 'capital' && origin
      ? origin
      : { q: toInteger(territory.x ?? territory.q, 0), r: toInteger(territory.y ?? territory.r, 0) }));
}

// Where the party stands RIGHT NOW — deliberately the SAME coord the vision area is drawn from
// (getFieldedPartyCoords), so the "is it home?" predicate and the vision source can never
// disagree. Canonical tile ids so the wrapped-world seam cannot split position and home into two
// keys (the same comparison WorldExplorerProgression.isAtHomeOrigin uses for return settlement;
// not required from there — Progression → WorldCombatEncounterService → this module would cycle).
function isPartyAtHomeOrigin(mission = {}) {
  const position = WorldMarchCore.getConfirmedPosition(mission);
  const home = mission.homeOrigin || mission.origin || {};
  return WorldMapService.getCanonicalTileId(position.q, position.r)
    === WorldMapService.getCanonicalTileId(home.q ?? home.x, home.r ?? home.y);
}

// A party is FIELDED (out of its home city, eyes on the world) while its march is active, while
// it is standing on an enemy tile fighting, or while it is parked in the field. Idle does NOT
// mean home: an arrived march idles at its destination, a victorious squad idles on the
// battlefield BY DESIGN (WorldCombatSessionService: "a victory does NOT return"), and a defeated
// one strands on the still-live enemy tile — only a manual returnWorldMarch brings them home.
// The invariant: wherever the map draws a party sprite (the client's parkedAwayFromHome
// projection), that party is a vision source — 有兵处必有眼.
function isFieldedParty(mission) {
  if (!mission || typeof mission !== 'object') return false;
  if (mission.status === WorldMarchCore.STATUS_ACTIVE) return true;
  if (FIELDED_COMBAT_STATUSES.includes(mission.combat?.status)) return true;
  return mission.status === WorldMarchCore.STATUS_IDLE && !isPartyAtHomeOrigin(mission);
}

function getFieldedPartyCoords(gameState = {}) {
  return (Array.isArray(gameState.exploreMissions) ? gameState.exploreMissions : [])
    .filter(isFieldedParty)
    .map((mission) => WorldMarchCore.getConfirmedPosition(mission));
}

// The player's current-vision coordinate-key set: the union of a CITY_VISION_RADIUS area around
// every occupied city and a UNIT_VISION_RADIUS area around every fielded party. Pure — reads the
// state, writes nothing, no dependence on tile history — so stale saves polluted by solid-fill or
// AI tiles cannot widen it. Keys come from the same WorldMapService.getTileCoordinateKey SSOT the
// other projection gates use; areas come from the same getRevealArea the fog reveal uses.
function computeCurrentVisionCoordSet(gameState = {}) {
  const coordSet = new Set();
  const addVisionArea = (coord, radius) => {
    for (const areaCoord of WorldMapService.getRevealArea(coord.q, coord.r, radius)) {
      coordSet.add(WorldMapService.getTileCoordinateKey(areaCoord));
    }
  };
  getCityVisionCoords(gameState).forEach((coord) => addVisionArea(coord, CITY_VISION_RADIUS));
  getFieldedPartyCoords(gameState).forEach((coord) => addVisionArea(coord, UNIT_VISION_RADIUS));
  return coordSet;
}

module.exports = {
  CITY_VISION_RADIUS,
  UNIT_VISION_RADIUS,
  computeCurrentVisionCoordSet,
};
