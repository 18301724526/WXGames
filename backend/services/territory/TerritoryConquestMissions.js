const {
  CONQUEST_DURATION_MS,
  POST_WAR_FAMOUS_PERSON_ENABLED,
} = require('./TerritoryConstants');
const {
  clone,
} = require('./TerritoryShared');
const GarrisonPolicy = require('./GarrisonPolicy');

const OCCUPIED_CITY_TERRAIN_REVEAL_RADIUS = 3;

function createTerritoryConquestMissions(dependencies = {}) {
  const {
    BattleService,
    ConquestBattleService,
    getFamousPersonService,
    WorldMapService,
    allocateSoldiersForMission,
    attachBattleTileSnapshot,
    getActiveMissionForTerritory,
    getAvailableSoldiers,
    getMissionSoldierAllocations,
    getNamingPrompt,
    getTerritory,
    getTerritoryBattleTargetSnapshot,
    getTerritoryBattleTileSnapshot,
    normalizeBattleTarget,
  } = dependencies;

  function isUnownedTerritory(territory) {
    return territory?.owner === 'neutral';
  }

  function isTutorialActive(gameState) {
    const tutorial = gameState?.tutorial || {};
    return tutorial.completed !== true && tutorial.disabled !== true;
  }

  // 距首城 ring distance, stamped on the territory by TerritoryStateNormalizer from the ACTUAL
  // capital origin. Same source normalizeGarrison reads, so mode and garrison stay in lockstep.
  function getNeutralCityDistance(territory) {
    return Math.max(0, Number(territory?.capitalDistance) || 0);
  }

  // Neutral (empty) cities settle directly (no battle) inside the spawn area and throughout the
  // tutorial; farther, defended distance bands must be taken by conquest. Non-neutral (hostile)
  // territories are always conquest. getOccupationMode and normalizeGarrison agree via the same
  // GarrisonPolicy.isNeutralCityDefended check, so a settlement never faces a garrison and a
  // conquest always has one.
  function getOccupationMode(territory, gameState) {
    if (!isUnownedTerritory(territory)) return 'conquest';
    if (isTutorialActive(gameState)) return 'settlement';
    const distance = getNeutralCityDistance(territory);
    return GarrisonPolicy.isNeutralCityDefended(territory, distance) ? 'conquest' : 'settlement';
  }

  function revealOccupiedCityTerrain(gameState, territory, now = new Date()) {
    if (!territory || !WorldMapService?.getRevealArea || !WorldMapService?.revealTiles) return [];
    const coords = WorldMapService.getRevealArea(territory.x, territory.y, OCCUPIED_CITY_TERRAIN_REVEAL_RADIUS);
    return WorldMapService.revealTiles(gameState, coords, now, {
      overrides: {
        visibility: 'scouted',
      },
    });
  }

  function normalizeExpeditionConfig(rawConfig, territory, gameState) {
    // Settlement of an unowned site requires and consumes no soldiers; combat
    // expeditions need at least one soldier (you cannot attack with zero).
    const isSettlement = getOccupationMode(territory, gameState) === 'settlement';
    const fallbackSoldiers = Math.max(1, territory?.recommendedSoldiers || territory?.defense || 1);
    const raw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    return {
      troopType: typeof raw.troopType === 'string' && raw.troopType.trim() ? raw.troopType.trim() : 'unavailable',
      leader: typeof raw.leader === 'string' && raw.leader.trim() ? raw.leader.trim() : 'unavailable',
      soldiers: isSettlement ? 0 : Math.max(1, Math.floor(Number(raw.soldiers) || fallbackSoldiers)),
    };
  }

  function startConquest(gameState, territoryId, expeditionInput, now = new Date()) {
    const territory = getTerritory(gameState, territoryId);
    if (!territory) return { success: false, error: 'TERRITORY_NOT_FOUND', message: '\u5730\u70b9\u4e0d\u5b58\u5728' };
    if (territory.status !== 'discovered') return { success: false, error: 'TERRITORY_NOT_DISCOVERED', message: '\u53ea\u80fd\u5360\u9886\u5df2\u53d1\u73b0\u4e14\u672a\u63a7\u5236\u7684\u5730\u70b9' };
    if (getActiveMissionForTerritory(gameState, territoryId)) return { success: false, error: 'MISSION_EXISTS', message: '\u8be5\u5730\u70b9\u5df2\u6709\u8fdb\u884c\u4e2d\u7684\u519b\u4e8b\u884c\u52a8' };
    const occupationMode = getOccupationMode(territory, gameState);
    const expedition = normalizeExpeditionConfig(
      expeditionInput && typeof expeditionInput === 'object'
        ? expeditionInput
        : { soldiers: expeditionInput },
      territory,
      gameState,
    );
    const committed = occupationMode === 'settlement' ? 0 : expedition.soldiers;
    if (committed > getAvailableSoldiers(gameState)) return { success: false, error: 'INSUFFICIENT_SOLDIERS', message: '\u53ef\u7528\u58eb\u5175\u4e0d\u8db3' };
    const soldierAllocations = allocateSoldiersForMission(gameState, committed);
    if (!soldierAllocations) return { success: false, error: 'INSUFFICIENT_SOLDIERS', message: '\u53ef\u7528\u58eb\u5175\u4e0d\u8db3' };
    const leaderSnapshot = BattleService.getLeaderSnapshot(gameState, expedition.leader);
    const battleTarget = getTerritoryBattleTargetSnapshot(gameState, territory, now);
    const mission = {
      id: `conquest_${territoryId}_${now.getTime()}`,
      kind: 'conquest',
      territoryId,
      mode: occupationMode,
      sourceCityId: soldierAllocations[0]?.cityId || gameState.activeCityId || 'capital',
      soldierAllocations,
      soldiersCommitted: committed,
      battleTarget,
      expedition: {
        ...expedition,
        soldiers: committed,
        ...(leaderSnapshot ? { leaderSnapshot } : {}),
      },
      startedAt: now.toISOString(),
      completesAt: new Date(now.getTime() + CONQUEST_DURATION_MS).toISOString(),
      status: 'active',
    };
    gameState.warMissions = [...(gameState.warMissions || []), mission];
    territory.status = 'contested';
    return {
      success: true,
      message: occupationMode === 'settlement'
        ? `\u5df2\u6d3e\u51fa\u5148\u9063\u961f\u524d\u5f80${territory.naturalName}\u5efa\u7acb\u636e\u70b9`
        : `\u5df2\u6d3e\u51fa ${committed} \u58eb\u5175\u524d\u5f80${territory.naturalName}`,
      mission,
    };
  }

  function resolveMission(gameState, mission, territory, now = new Date()) {
    const tileSnapshot = getTerritoryBattleTileSnapshot(gameState, territory, now);
    const battleTarget = normalizeBattleTarget(
      mission.battleTarget || territory.battleTarget || getTerritoryBattleTargetSnapshot(gameState, territory, now),
      territory,
      now.toISOString(),
    );
    if (mission.mode === 'settlement') {
      territory.lastBattle = {
        resolvedAt: now.toISOString(),
        soldiersCommitted: mission.soldiersCommitted,
        casualties: 0,
        success: true,
        mode: 'settlement',
        tileId: tileSnapshot.tileId,
        q: tileSnapshot.q,
        r: tileSnapshot.r,
        mapTerrain: tileSnapshot.mapTerrain,
        terrain: tileSnapshot.terrain,
        tile: { ...tileSnapshot.tile },
        battleTarget,
      };
      territory.status = 'occupied';
      territory.owner = 'player';
      territory.occupiedAt = now.toISOString();
      territory.cityName = null;
      // A frictionless settlement faces no defender: clear any band garrison the site carried
      // (a defended-band neutral city settled during the tutorial), mirroring the conquest branch.
      territory.defenderLeader = null;
      territory.garrison = null;
      revealOccupiedCityTerrain(gameState, territory, now);
      WorldMapService.bindSiteToTile(gameState, territory.x, territory.y, territory.id, now, { visibility: 'controlled' });
      return { success: true, casualties: 0 };
    }

    if (typeof ConquestBattleService?.resolveConquestBattle !== 'function') {
      throw new Error('ConquestBattleService.resolveConquestBattle is required');
    }
    const battle = ConquestBattleService.resolveConquestBattle(gameState, mission, territory, now);
    const success = battle.success;
    const casualties = battle.casualties;
    let remainingCasualties = casualties;
    for (const allocation of getMissionSoldierAllocations(mission)) {
      if (remainingCasualties <= 0) break;
      const proportionalCasualties = Math.min(
        allocation.soldiers,
        Math.ceil((casualties * allocation.soldiers) / Math.max(1, mission.soldiersCommitted)),
        remainingCasualties,
      );
      const sourceCity = gameState.cities?.[allocation.cityId] || null;
      const military = sourceCity?.military || gameState.military || {};
      military.soldiers = Math.max(0, Math.floor(military.soldiers || 0) - proportionalCasualties);
      if (sourceCity) sourceCity.military = military;
      else gameState.military = military;
      remainingCasualties -= proportionalCasualties;
    }

    territory.lastBattle = {
      resolvedAt: now.toISOString(),
      soldiersCommitted: mission.soldiersCommitted,
      casualties,
      success,
      mode: 'conquest',
      tileId: tileSnapshot.tileId,
      q: tileSnapshot.q,
      r: tileSnapshot.r,
      mapTerrain: tileSnapshot.mapTerrain,
      terrain: tileSnapshot.terrain,
      tile: { ...tileSnapshot.tile },
      battleTarget,
      leaderId: mission.expedition?.leader || 'unavailable',
      leaderName: battle?.report?.attacker?.leaderName || mission.expedition?.leaderSnapshot?.name || '',
      report: attachBattleTileSnapshot(
        battle.report || BattleService.createConquestSummaryReport(mission, territory, { success, casualties }, now),
        tileSnapshot,
        battleTarget,
      ),
    };
    const FamousPersonService = getFamousPersonService();
    const leaderGrowth = FamousPersonService.grantBattleExperience(
      gameState,
      mission.expedition?.leader,
      territory.lastBattle.report?.experience,
      now,
    );
    territory.lastBattle.leaderGrowth = leaderGrowth;
    if (territory.lastBattle.report) territory.lastBattle.report.leaderGrowth = leaderGrowth;
    if (success) {
      territory.status = 'occupied';
      territory.owner = 'player';
      territory.defenderLeader = null;
      territory.garrison = null;
      territory.occupiedAt = now.toISOString();
      territory.cityName = null;
      revealOccupiedCityTerrain(gameState, territory, now);
      WorldMapService.bindSiteToTile(gameState, territory.x, territory.y, territory.id, now, { visibility: 'controlled' });
    } else {
      territory.status = 'discovered';
    }
    return { success, casualties };
  }

  function createPostWarCandidate(gameState, mission, territory, result, now = new Date()) {
    if (!POST_WAR_FAMOUS_PERSON_ENABLED) return null;
    if (!result?.success || mission.mode === 'settlement') return null;
    const FamousPersonService = getFamousPersonService();
    const famousPersonState = FamousPersonService.ensureFamousPersonState(gameState);
    if (famousPersonState.candidates.length >= FamousPersonService.MAX_CANDIDATES) return null;
    const candidate = FamousPersonService.createFamousPersonCandidate(gameState, { source: 'postWar' }, now);
    candidate.source = {
      ...candidate.source,
      territoryId: territory.id,
      territoryName: territory.naturalName || territory.cityName || '',
      battleReportId: territory.lastBattle?.report?.id || null,
      leaderId: territory.lastBattle?.leaderId || mission.expedition?.leader || 'unavailable',
    };
    famousPersonState.candidates = [candidate, ...famousPersonState.candidates].slice(0, FamousPersonService.MAX_CANDIDATES);
    return clone(candidate);
  }

  function claimConquest(gameState, territoryId, now = new Date()) {
    const territory = getTerritory(gameState, territoryId);
    if (!territory) return { success: false, error: 'TERRITORY_NOT_FOUND', message: '\u5730\u70b9\u4e0d\u5b58\u5728' };
    const mission = getActiveMissionForTerritory(gameState, territoryId);
    if (!mission) return { success: false, error: 'MISSION_NOT_FOUND', message: '\u6ca1\u6709\u53ef\u5b8c\u6210\u7684\u519b\u4e8b\u884c\u52a8' };
    if (mission.status !== 'ready') return { success: false, error: 'MISSION_NOT_READY', message: '\u519b\u4e8b\u884c\u52a8\u5c1a\u672a\u5b8c\u6210' };
    const result = resolveMission(gameState, mission, territory, now);
    const postWarCandidate = createPostWarCandidate(gameState, mission, territory, result, now);
    gameState.warMissions = (gameState.warMissions || []).filter((item) => item.id !== mission.id);
    return {
      success: true,
      message: result.success
        ? `\u5df2\u63a7\u5236${territory.naturalName}${postWarCandidate ? '\uff0c\u6218\u540e\u6709\u4eba\u613f\u610f\u6295\u5954' : ''}`
        : `${territory.naturalName}\u5360\u9886\u5931\u8d25\uff0c\u58eb\u5175\u6b63\u5728\u6574\u961f\u8fd4\u56de`,
      outcome: result.success ? 'success' : 'failure',
      casualties: result.casualties,
      battleReport: territory.lastBattle?.report || null,
      postWarCandidate,
      territory,
      namingPrompt: getNamingPrompt(gameState),
    };
  }

  return {
    claimConquest,
    createPostWarCandidate,
    getOccupationMode,
    isUnownedTerritory,
    normalizeExpeditionConfig,
    revealOccupiedCityTerrain,
    resolveMission,
    startConquest,
  };
}

module.exports = createTerritoryConquestMissions;
