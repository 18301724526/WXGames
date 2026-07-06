const WorldMapService = require('./WorldMapService');
const { clone } = require('../../shared/objectUtils');

function getMapBounds(territories) {
  const xs = territories.map((territory) => territory.x);
  const ys = territories.map((territory) => territory.y);
  return {
    minX: Math.min(...xs, 0),
    maxX: Math.max(...xs, 0),
    minY: Math.min(...ys, 0),
    maxY: Math.max(...ys, 0),
  };
}

function getCoordinateKey(site = {}) {
  const x = Number(site.x ?? site.q ?? 0);
  const y = Number(site.y ?? site.r ?? 0);
  return `${Math.floor(x)},${Math.floor(y)}`;
}

function getWorldMapOrigin(worldMap = {}) {
  const origin = worldMap?.origin && typeof worldMap.origin === 'object'
    ? worldMap.origin
    : {};
  const q = Number(origin.q ?? origin.x);
  const r = Number(origin.r ?? origin.y);
  if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
  return {
    x: Math.floor(q),
    y: Math.floor(r),
  };
}

function projectCapitalTerritoryToOrigin(territory = {}, origin = null) {
  if (!origin || territory?.id !== 'capital') return territory;
  return {
    ...territory,
    x: origin.x,
    y: origin.y,
  };
}

function isSharedOccupiedTerritory(site = {}) {
  return Boolean(site.ownerPlayerId && site.owner === 'player' && site.status === 'occupied');
}

// A shared PRE-PLACED NEUTRAL city (owner:'neutral', no ownerPlayerId) — the world_cities layer
// (docs/design/10 §3.2). Player-OWNED shared sites carry an ownerPlayerId and are NOT gated (they keep
// their pre-existing always-projected behavior).
function isSharedNeutralCity(site = {}) {
  return Boolean(site && site.owner === 'neutral' && !site.ownerPlayerId);
}

// Visibility gate (docs/design/10 §6-R2 — NO reveal-at-spawn). A pre-placed neutral city exists in the
// shared store from world-init, but must stay HIDDEN in a player's client map until that player's march
// vision discovers its tile. The player's own worldMap.tiles is already reveal-streamed (only tiles the
// player has seen are present), so a neutral city is "discovered" for this player exactly when a tile
// exists at its coordinate. Drop every not-yet-discovered neutral city from the projected set so it is
// absent from the client territories DTO and never bound to the map. Discovery (S4) simply reveals the
// tile, which flips the city visible here — this function stays unchanged. Own/occupied shared sites
// are untouched.
function filterDiscoveredNeutralCities(sharedTerritories, worldMap = {}) {
  if (!Array.isArray(sharedTerritories) || !sharedTerritories.length) return sharedTerritories || [];
  const visibleTileCoords = new Set(
    (Array.isArray(worldMap.tiles) ? worldMap.tiles : []).map((tile) => getCoordinateKey(tile)),
  );
  return sharedTerritories.filter((site) => {
    if (!isSharedNeutralCity(site)) return true;
    return visibleTileCoords.has(getCoordinateKey(site));
  });
}

function getTerritoryProjectionPriority(site = {}) {
  if (isSharedOccupiedTerritory(site)) return 4;
  if (site.owner === 'player' && site.status === 'occupied') return 3;
  if (site.status === 'contested') return 2;
  if (site.status === 'discovered') return 1;
  return 0;
}

function mergeProjectedTerritories(ownTerritories = [], sharedTerritories = []) {
  const byCoord = new Map();
  [...ownTerritories, ...sharedTerritories].forEach((territory) => {
    if (!territory || typeof territory !== 'object') return;
    const key = getCoordinateKey(territory);
    const existing = byCoord.get(key);
    if (!existing || getTerritoryProjectionPriority(territory) >= getTerritoryProjectionPriority(existing)) {
      byCoord.set(key, territory);
    }
  });
  return [...byCoord.values()];
}

function bindProjectedSitesToWorldMap(worldMap = {}, territories = []) {
  const siteByCoord = new Map((territories || [])
    .filter((site) => site && typeof site === 'object' && site.id)
    .map((site) => [getCoordinateKey(site), site]));
  if (!Array.isArray(worldMap.tiles) || !siteByCoord.size) return worldMap;
  return {
    ...worldMap,
    tiles: worldMap.tiles.map((tile) => {
      const site = siteByCoord.get(getCoordinateKey(tile));
      if (!site) return tile;
      return {
        ...tile,
        siteId: site.id,
        visibility: site.owner === 'player' && !site.ownerPlayerId ? 'controlled' : tile.visibility,
      };
    }),
  };
}

function getTerritoryIntelSnapshot(territory = {}, deps = {}) {
  const rawIntel = territory.intel && typeof territory.intel === 'object' ? territory.intel : {};
  const rawLevel = deps.toInteger(rawIntel.level, territory.owner === 'player' ? 4 : 1);
  const level = territory.owner === 'player'
    ? 4
    : Math.max(0, Math.min(4, rawLevel));
  return {
    level,
    knownTerrain: rawIntel.knownTerrain !== false,
    knownSite: rawIntel.knownSite !== false,
    knownOwner: rawIntel.knownOwner !== false,
    knownGarrison: Boolean(rawIntel.knownGarrison ?? level >= 2),
    knownLeader: Boolean(rawIntel.knownLeader ?? level >= 3),
    knownSkill: Boolean(rawIntel.knownSkill ?? level >= 4),
  };
}

function redactGarrisonForIntel(garrison, intel) {
  if (!garrison || typeof garrison !== 'object' || !intel.knownGarrison) return null;
  const redacted = {
    id: garrison.id || '',
    siteId: garrison.siteId || '',
    owner: garrison.owner || '',
    soldiers: garrison.soldiers || 0,
    quality: garrison.quality || '',
    threat: garrison.threat || 0,
    scale: garrison.scale || 1,
    generatedAt: garrison.generatedAt || null,
    leader: null,
  };
  if (intel.knownLeader && garrison.leader && typeof garrison.leader === 'object') {
    redacted.leader = {
      id: garrison.leader.id || '',
      name: garrison.leader.name || '',
      title: garrison.leader.title || '',
      archetype: garrison.leader.archetype || '',
      abilityArchetype: garrison.leader.abilityArchetype || '',
      quality: garrison.leader.quality || '',
      qualityLabel: garrison.leader.qualityLabel || '',
      level: garrison.leader.level || 1,
      attributes: clone(garrison.leader.attributes || {}),
      appearance: clone(garrison.leader.appearance || {}),
      abilityKit: intel.knownSkill && garrison.leader.abilityKit ? clone(garrison.leader.abilityKit) : null,
      skills: intel.knownSkill && Array.isArray(garrison.leader.skills) ? clone(garrison.leader.skills) : [],
    };
  }
  return redacted;
}

function getClientBattleTargetForIntel(battleTarget, intel) {
  if (!battleTarget || typeof battleTarget !== 'object') return null;
  return {
    ...battleTarget,
    defender: redactGarrisonForIntel(battleTarget.defender, intel),
    intelSnapshot: {
      ...(battleTarget.intelSnapshot && typeof battleTarget.intelSnapshot === 'object' ? battleTarget.intelSnapshot : {}),
      ...intel,
    },
  };
}

// "Fought before" for a defended site = a lastBattle record was written after a resolved fight. It is
// the SINGLE fact that unlocks defender STRENGTH numbers (defense / recommendedSoldiers / threat) —
// learned in battle, not by scouting ("打了才知道"). The garrison/leader/battleTarget objects were
// already intel-gated above; this withholds the raw strength scalars the spread would otherwise leak.
function hasFoughtTerritory(territory = {}) {
  return Boolean(territory && territory.lastBattle);
}

function getClientTerritoryView(territory, scoutOrigin, mission, deps = {}, gameState = {}) {
  const intel = getTerritoryIntelSnapshot(territory, deps);
  const occupationMode = deps.getOccupationMode(territory, gameState);
  // A settlement faces no defender — never advertise a band garrison/leader the player won't fight,
  // keeping the DTO's occupationMode and its defender fields consistent.
  const settling = occupationMode === 'settlement';
  // A conquest target the player has NOT fought yet hides its strength scalars. Own/occupied sites
  // (owner 'player') and already-fought sites keep them. Undefined (not 0) so the frontend shows
  // "未知" rather than a misleading "0 兵 / 0 防御".
  const hideStrength =
    !settling && territory.owner !== 'player' && !hasFoughtTerritory(territory);
  const view = {
    ...territory,
    intel,
    garrison: settling ? null : redactGarrisonForIntel(territory.garrison, intel),
    defenderLeader: settling ? null : (intel.knownLeader ? territory.defenderLeader : null),
    battleTarget: settling ? null : getClientBattleTargetForIntel(territory.battleTarget, intel),
    distance: deps.getDistance(territory.x, territory.y),
    originDistance: deps.getRelativeDistance(scoutOrigin.x, scoutOrigin.y, territory.x, territory.y),
    relativeX: territory.x - scoutOrigin.x,
    relativeY: territory.y - scoutOrigin.y,
    occupationMode,
    mission,
  };
  // Strip the strength scalars entirely (delete, not 0) so the key is absent from the DTO and the
  // frontend renders "未知" instead of a misleading zero.
  if (hideStrength) {
    delete view.defense;
    delete view.recommendedSoldiers;
    delete view.threat;
  }
  return view;
}

function getClientTerritoryState(gameState, now = new Date(), deps = {}, projection = {}) {
  const nowMs = now.getTime();
  const scoutOrigin = deps.getScoutOrigin(gameState);
  const missionsByTerritory = Object.fromEntries((gameState.warMissions || [])
    .filter((mission) => deps.getMissionKind(mission) === 'conquest')
    .map((mission) => [mission.territoryId, {
      ...mission,
      remainingSeconds: Math.max(0, Math.ceil((new Date(mission.completesAt).getTime() - nowMs) / 1000)),
      durationSeconds: Math.floor(deps.CONQUEST_DURATION_MS / 1000),
    }]));
  const ownTerritories = Array.isArray(gameState.territories) ? gameState.territories : [];
  // Visibility-gate the shared projection: undiscovered PRE-PLACED NEUTRAL cities are dropped so they
  // are absent from the client map (no reveal-at-spawn — docs/design/10 §6-R2). The player's own
  // worldMap is already reveal-streamed, so its tiles are the discovered set. Player-owned shared sites
  // pass through unchanged.
  const sharedTerritories = filterDiscoveredNeutralCities(
    Array.isArray(projection.sharedWorldTerritories) ? projection.sharedWorldTerritories : [],
    gameState.worldMap,
  );
  const capitalOrigin = getWorldMapOrigin(gameState.worldMap);
  const territories = mergeProjectedTerritories(ownTerritories, sharedTerritories)
    .map((territory) => projectCapitalTerritoryToOrigin(territory, capitalOrigin))
    .map((territory) => getClientTerritoryView(territory, scoutOrigin, missionsByTerritory[territory.id] || null, deps, gameState));
  const worldMap = typeof WorldMapService.getClientWorldMapFromNormalized === 'function'
    ? WorldMapService.getClientWorldMapFromNormalized(gameState.worldMap)
    : WorldMapService.getClientWorldMap(gameState, now);
  return {
    polity: gameState.polity || deps.createInitialPolity(),
    territories,
    worldMap: bindProjectedSitesToWorldMap(worldMap, territories),
    warMissions: gameState.warMissions || [],
    scoutOrigin,
    availableSoldiers: deps.getAvailableSoldiers(gameState),
    soldiersOnMission: deps.countTotalSoldiersOnMission(gameState),
    occupiedCount: deps.getOccupiedCount(gameState),
    discoveredCount: territories.length,
    mapBounds: getMapBounds(territories),
    territoryEffects: deps.getTerritoryEffects(gameState),
    namingPrompt: deps.getNamingPrompt(gameState),
    missionDurationSeconds: Math.floor(deps.CONQUEST_DURATION_MS / 1000),
    famousPersons: {
      people: clone(gameState.famousPeople || []),
    },
  };
}

module.exports = {
  getMapBounds,
  getTerritoryIntelSnapshot,
  redactGarrisonForIntel,
  getClientBattleTargetForIntel,
  getClientTerritoryView,
  getClientTerritoryState,
  getCoordinateKey,
  mergeProjectedTerritories,
  filterDiscoveredNeutralCities,
  isSharedNeutralCity,
};
