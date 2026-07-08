const {
  MIN_EXPEDITION_SOLDIERS,
} = require('./TerritoryConstants');
const {
  getPlanningTerrainForMapTerrain,
  normalizeMapTerrainId,
  normalizeSoldierScale,
  toInteger,
} = require('./TerritoryShared');
const GarrisonPolicy = require('./GarrisonPolicy');

function createTerritoryCombatTargets(dependencies = {}) {
  const {
    DefenderLeaderService,
    WorldMapService,
  } = dependencies;

  function getTileId(q, r) {
    // Single source: WorldMapService.getTileId (= WorldMapTopology.getTileId). WorldMapService is
    // always injected here (TerritoryService builds this factory with it), so the old inline raw
    // tile-id fallback was dead — removed (do not re-introduce a second format source).
    return WorldMapService.getTileId(q, r);
  }

  // 距首城 ring distance is stamped on the territory by TerritoryStateNormalizer (from the ACTUAL
  // capital origin). Read it here rather than recomputing from world-origin (which is wrong: the
  // capital is not at 0,0). Missing distance -> 0 -> safe band -> no garrison (fail-safe).
  function getCapitalDistance(territory) {
    return Math.max(0, Number(territory?.capitalDistance) || 0);
  }

  function normalizeGarrison(rawGarrison, territory = {}, now = new Date().toISOString()) {
    const raw = rawGarrison && typeof rawGarrison === 'object' ? rawGarrison : {};
    const owner = territory.owner || raw.owner || 'neutral';
    if (owner === 'player' || territory.id === 'capital') return null;
    const leaderSource = raw.leader && typeof raw.leader === 'object'
      ? raw.leader
      : territory.defenderLeader;
    const createdAt = raw.generatedAt || territory.discoveredAt || now;

    // NEUTRAL (empty) cities: defended only in the farther distance bands (config table `garrison`).
    // The spawn/`safe` band stays frictionless — this branch returns null there, so occupation
    // takes the settlement path. Must stay in lockstep with getOccupationMode's same check.
    if (owner === 'neutral') {
      const distance = getCapitalDistance(territory);
      if (!GarrisonPolicy.isNeutralCityDefended({ ...territory, owner }, distance)) return null;
      const band = GarrisonPolicy.resolveBand(distance);
      const defenderOwner = band?.ownerType || 'city_state';
      const scale = Math.max(1, toInteger(raw.scale, territory.scale || 1));
      const soldiers = Math.max(MIN_EXPEDITION_SOLDIERS, GarrisonPolicy.garrisonSoldiers(band, scale));
      const leader = typeof DefenderLeaderService?.ensureDefenderLeader === 'function'
        ? DefenderLeaderService.ensureDefenderLeader({
          ...territory,
          owner: defenderOwner,
          defenderLeader: leaderSource || territory.defenderLeader,
        }, { createdAt })
        : leaderSource || null;
      return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : `garrison_${territory.id || 'site'}`,
        siteId: territory.id || raw.siteId || '',
        owner: defenderOwner,
        soldiers,
        quality: band?.leaderQuality || leader?.quality || 'common',
        threat: Math.max(0, toInteger(raw.threat, territory.threat || 0)),
        scale,
        leader,
        band: band?.bandId || '',
        captureChance: GarrisonPolicy.bandCaptureChance(band),
        recruitBaseRate: GarrisonPolicy.bandRecruitBaseRate(band),
        generatedAt: createdAt,
      };
    }

    // HOSTILE territory: unchanged garrison logic.
    const leader = typeof DefenderLeaderService?.ensureDefenderLeader === 'function'
      ? DefenderLeaderService.ensureDefenderLeader({
        ...territory,
        defenderLeader: leaderSource || territory.defenderLeader,
      }, { createdAt })
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
      generatedAt: createdAt,
    };
  }

  function normalizeBattleTarget(rawTarget, territory = {}, now = new Date().toISOString()) {
    const raw = rawTarget && typeof rawTarget === 'object' ? rawTarget : {};
    const x = toInteger(raw.tile?.q ?? raw.q ?? territory.x, 0);
    const y = toInteger(raw.tile?.r ?? raw.r ?? territory.y, 0);
    const tileId = getTileId(x, y);
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
