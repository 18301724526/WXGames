const {
  MIN_EXPEDITION_SOLDIERS,
} = require('./TerritoryConstants');
const {
  getPlanningTerrainForMapTerrain,
  normalizeMapTerrainId,
  normalizeSoldierScale,
  toInteger,
} = require('./TerritoryShared');

function createTerritoryCombatTargets(dependencies = {}) {
  const {
    DefenderLeaderService,
    WorldMapService,
  } = dependencies;

  function getTileId(q, r) {
    return typeof WorldMapService?.getTileId === 'function'
      ? WorldMapService.getTileId(q, r)
      : `tile_${q}_${r}`;
  }

  function normalizeGarrison(rawGarrison, territory = {}, now = new Date().toISOString()) {
    const raw = rawGarrison && typeof rawGarrison === 'object' ? rawGarrison : {};
    const owner = territory.owner || raw.owner || 'neutral';
    if (owner === 'player' || owner === 'neutral' || territory.id === 'capital') return null;
    const leaderSource = raw.leader && typeof raw.leader === 'object'
      ? raw.leader
      : territory.defenderLeader;
    const leader = typeof DefenderLeaderService?.ensureDefenderLeader === 'function'
      ? DefenderLeaderService.ensureDefenderLeader({
        ...territory,
        defenderLeader: leaderSource || territory.defenderLeader,
      }, { createdAt: raw.generatedAt || territory.discoveredAt || now })
      : leaderSource || null;
    const soldiers = Math.max(
      MIN_EXPEDITION_SOLDIERS,
      normalizeSoldierScale(raw.soldiers ?? territory.defense ?? territory.recommendedSoldiers, MIN_EXPEDITION_SOLDIERS),
    );
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : `garrison_${territory.id || 'site'}`,
      siteId: territory.id || raw.siteId || '',
      owner,
      soldiers,
      quality: raw.quality || leader?.quality || 'common',
      threat: Math.max(0, toInteger(raw.threat, territory.threat || 0)),
      scale: Math.max(1, toInteger(raw.scale, territory.scale || 1)),
      leader,
      generatedAt: raw.generatedAt || territory.discoveredAt || now,
    };
  }

  function normalizeBattleTarget(rawTarget, territory = {}, now = new Date().toISOString()) {
    const raw = rawTarget && typeof rawTarget === 'object' ? rawTarget : {};
    const x = toInteger(raw.tile?.q ?? raw.q ?? territory.x, 0);
    const y = toInteger(raw.tile?.r ?? raw.r ?? territory.y, 0);
    const tileId = raw.tile?.id || raw.tileId || getTileId(x, y);
    const mapTerrain = normalizeMapTerrainId(raw.tile?.terrain || raw.mapTerrain || territory.mapTerrain || territory.tileTerrain || territory.worldTerrain)
      || normalizeMapTerrainId(territory.terrain);
    const terrain = getPlanningTerrainForMapTerrain(raw.terrain || territory.terrain || mapTerrain);
    const garrison = normalizeGarrison(raw.defender || raw.garrison || territory.garrison, {
      ...territory,
      x,
      y,
      mapTerrain: mapTerrain || territory.mapTerrain,
    }, now);
    return {
      source: raw.source || 'tile-map',
      tile: {
        id: tileId,
        q: x,
        r: y,
        terrain: mapTerrain || raw.tile?.terrain || territory.mapTerrain || 'plains',
      },
      site: {
        id: raw.site?.id || territory.id || raw.siteId || '',
        type: raw.site?.type || territory.type || '',
        owner: raw.site?.owner || territory.owner || 'neutral',
        status: raw.site?.status || territory.status || 'discovered',
        name: raw.site?.name || territory.naturalName || territory.cityName || '',
        scale: Math.max(1, toInteger(raw.site?.scale ?? territory.scale, 1)),
        threat: Math.max(0, toInteger(raw.site?.threat ?? territory.threat, 0)),
        mapTerrain: raw.site?.mapTerrain || mapTerrain || null,
        terrain: raw.site?.terrain || terrain,
      },
      defender: garrison,
      intelSnapshot: {
        knownTerrain: true,
        knownSite: true,
        knownOwner: true,
        knownGarrison: Boolean(garrison),
        knownLeader: Boolean(garrison?.leader),
        knownSkill: Boolean(garrison?.leader?.abilityKit),
        ...(raw.intelSnapshot && typeof raw.intelSnapshot === 'object' ? raw.intelSnapshot : {}),
      },
    };
  }

  return {
    normalizeBattleTarget,
    normalizeGarrison,
  };
}

module.exports = createTerritoryCombatTargets;
