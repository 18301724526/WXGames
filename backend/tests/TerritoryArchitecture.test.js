const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TerritoryService = require('../services/TerritoryService');
const TerritoryConstants = require('../services/territory/TerritoryConstants');
const TerritoryVisuals = require('../services/territory/TerritoryVisuals');
const TerritoryInitialState = require('../services/territory/TerritoryInitialState');
const TerritoryShared = require('../services/territory/TerritoryShared');
const ServerRandomAuthorityContract = require('../services/random/ServerRandomAuthorityContract');
const DefenderLeaderService = require('../services/DefenderLeaderService');
const DefenderLeaderRandomAuthority = require('../services/defenderLeader/DefenderLeaderRandomAuthority');
const createTerritoryCombatTargets = require('../services/territory/TerritoryCombatTargets');
const createTerritoryConquestMissions = require('../services/territory/TerritoryConquestMissions');
const createTerritoryMilitaryMissions = require('../services/territory/TerritoryMilitaryMissions');
const createTerritoryNaming = require('../services/territory/TerritoryNaming');
const createTerritoryQueries = require('../services/territory/TerritoryQueries');
const createTerritoryStateNormalizer = require('../services/territory/TerritoryStateNormalizer');

const serviceRoot = path.join(__dirname, '..', 'services');
const territoryRoot = path.join(serviceRoot, 'territory');

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

test('TerritoryService starts delegating foundation responsibilities to territory modules', () => {
  const moduleFiles = fs.readdirSync(territoryRoot)
    .filter((name) => name.endsWith('.js'))
    .sort();

  assert.deepEqual(moduleFiles, [
    'GarrisonCaptureResolver.js',
    'GarrisonPolicy.js',
    'TerritoryCombatTargets.js',
    'TerritoryConquestMissions.js',
    'TerritoryConstants.js',
    'TerritoryInitialState.js',
    'TerritoryMilitaryMissions.js',
    'TerritoryNaming.js',
    'TerritoryQueries.js',
    'TerritoryShared.js',
    'TerritoryStateNormalizer.js',
    'TerritoryVisuals.js',
  ]);
  for (const fileName of moduleFiles) {
    assert.ok(lineCount(path.join(territoryRoot, fileName)) < 500, `${fileName} should stay below 500 lines`);
  }
});

test('territory foundation modules preserve initial-state and visual contracts', () => {
  const now = '2026-06-06T00:00:00.000Z';

  assert.deepEqual(TerritoryInitialState.createInitialPolity(), {
    name: null,
    namePrompted: false,
    capitalCityName: '首都',
    color: '#d9a441',
  });
  assert.deepEqual(TerritoryInitialState.createInitialTerritories(now), TerritoryService.createInitialTerritories(now));
  assert.equal(TerritoryInitialState.createInitialTerritories(now)[0].art, TerritoryConstants.SITE_ART.capital);
  assert.equal(TerritoryConstants.SITE_TEMPLATES[0].naturalNames[0], '河畔前哨');

  assert.deepEqual(TerritoryVisuals.createVisualOffset(0, 0), { x: 0, y: 0 });
  assert.deepEqual(TerritoryVisuals.createVisualOffset(3, -2, 'seed'), TerritoryVisuals.createVisualOffset(3, -2, 'seed'));
  assert.deepEqual(TerritoryVisuals.normalizeVisualOffset({ x: 9, y: -9 }, 1, 1), { x: 0.55, y: -0.55 });
});

test('territory shared helpers preserve terrain and soldier normalization contracts', () => {
  assert.equal(TerritoryShared.toInteger('4.8'), 4);
  assert.equal(TerritoryShared.toInteger('bad', 7), 7);
  assert.equal(TerritoryShared.normalizeSoldierScale(3), 300);
  assert.equal(TerritoryShared.normalizeSoldierScale(120), 120);
  assert.equal(TerritoryShared.getDistance(-3, 2), 3);
  assert.equal(TerritoryShared.getRelativeDistance(1, 1, -2, 4), 3);
  assert.equal(TerritoryShared.getCoordinateKey(-2, 4), '-2,4');
  assert.equal(TerritoryShared.normalizeMapTerrainId('forest'), 'forest');
  assert.equal(TerritoryShared.normalizeMapTerrainId('unknown'), null);
  assert.equal(TerritoryShared.getPlanningTerrainForMapTerrain('mountain'), 'hills');
  assert.equal(TerritoryShared.getPlanningTerrainForMapTerrain('coast'), 'coast');
});

test('territory combat targets module owns garrison and battle target contracts', () => {
  const leaderCalls = [];
  const CombatTargets = createTerritoryCombatTargets({
    DefenderLeaderService: {
      ensureDefenderLeader: (territory, options) => {
        leaderCalls.push({ territory, options });
        return {
          id: 'leader-1',
          name: '守备长',
          quality: 'rare',
          abilityKit: { id: 'shield-wall' },
        };
      },
    },
    WorldMapService: {
      getTileId: (q, r) => `tile_${q}_${r}`,
    },
  });

  assert.equal(CombatTargets.normalizeGarrison(null, { id: 'capital', owner: 'player' }), null);
  assert.equal(CombatTargets.normalizeGarrison(null, { id: 'empty', owner: 'neutral' }), null);

  const territory = {
    id: 'camp-1',
    x: 3,
    y: -1,
    type: 'camp',
    owner: 'tribe',
    status: 'discovered',
    naturalName: '林地部落',
    defense: 80,
    recommendedSoldiers: 80,
    threat: 4,
    scale: 2,
    mapTerrain: 'forest',
    discoveredAt: '2026-06-06T00:00:00.000Z',
  };

  const garrison = CombatTargets.normalizeGarrison(null, territory, '2026-06-06T00:00:00.000Z');
  assert.equal(garrison.id, 'garrison_camp-1');
  assert.equal(garrison.siteId, 'camp-1');
  assert.equal(garrison.owner, 'tribe');
  assert.equal(garrison.soldiers, 8000);
  assert.equal(garrison.quality, 'rare');
  assert.equal(garrison.threat, 4);
  assert.equal(garrison.scale, 2);
  assert.equal(garrison.leader.id, 'leader-1');
  assert.equal(leaderCalls.length, 1);

  const battleTarget = CombatTargets.normalizeBattleTarget({
    q: 3,
    r: -1,
    mapTerrain: 'mountain',
    defender: garrison,
  }, territory, '2026-06-06T00:01:00.000Z');

  assert.deepEqual(battleTarget.tile, { id: 'tile_3_-1', q: 3, r: -1, terrain: 'mountain' });
  assert.equal(battleTarget.site.id, 'camp-1');
  assert.equal(battleTarget.site.terrain, 'hills');
  assert.equal(battleTarget.defender.soldiers, 8000);
  assert.deepEqual(battleTarget.intelSnapshot, {
    knownTerrain: true,
    knownSite: true,
    knownOwner: true,
    knownGarrison: true,
    knownLeader: true,
    knownSkill: true,
  });

  const staleTileTarget = CombatTargets.normalizeBattleTarget({
    q: 3,
    r: -1,
    tileId: 'stale-raw-tile-id',
    tile: { id: 'stale-nested-tile-id', q: 3, r: -1, terrain: 'forest' },
  }, territory, '2026-06-06T00:02:00.000Z');
  assert.equal(staleTileTarget.tile.id, 'tile_3_-1');
});

test('server random authority contract owns backend random roll envelopes', () => {
  const roll = ServerRandomAuthorityContract.createRoll({
    scope: 'territory',
    action: 'scoutOutcome',
    subjectId: 'mission-1',
    seed: 'world-seed',
  }, {
    now: new Date('2026-06-06T00:00:00.000Z'),
    randomSource: () => 1.1,
  });
  const chance = ServerRandomAuthorityContract.rollChance(0.5, {
    scope: 'territory',
    action: 'scoutOutcome',
    subjectId: 'mission-1',
  }, {
    now: new Date('2026-06-06T00:00:00.000Z'),
    randomSource: () => 0.49,
  });

  assert.equal(roll.schema, ServerRandomAuthorityContract.SCHEMA);
  assert.equal(roll.authority, 'server');
  assert.equal(roll.scope, 'territory');
  assert.equal(roll.action, 'scoutOutcome');
  assert.equal(roll.value, ServerRandomAuthorityContract.MAX_UNIT_ROLL);
  assert.match(roll.rollId, /^[a-f0-9]{16}$/);
  assert.equal(chance.success, true);
  assert.equal(chance.threshold, 0.5);
});

test('defender leader generation consumes server random authority by default', () => {
  const territory = {
    id: 'camp-authority',
    owner: 'tribe',
    naturalName: 'Authority Camp',
    threat: 4,
    defense: 160,
    scale: 2,
  };

  const leader = DefenderLeaderService.createDefenderLeader(territory, {
    createdAt: '2026-06-06T00:00:00.000Z',
  });
  const injected = DefenderLeaderService.createDefenderLeader(territory, {
    randomSource: () => 0.42,
    createdAt: '2026-06-06T00:00:00.000Z',
  });

  assert.deepEqual(leader.source.randomAuthority, {
    schema: ServerRandomAuthorityContract.SCHEMA,
    authority: ServerRandomAuthorityContract.AUTHORITY,
    scope: DefenderLeaderRandomAuthority.SCOPE,
    action: DefenderLeaderRandomAuthority.DEFAULT_ACTION,
    subjectId: 'leader:camp-authority:tribe',
    seed: 'defender:camp-authority:tribe:4:160',
  });
  assert.equal(injected.source.randomAuthority, undefined);
  assert.equal(leader.source.type, 'defender');
  assert.equal(leader.status.assigned, 'defender');
});

test('territory query module owns territory lookup, origin, effects, and spacing contracts', () => {
  const Queries = createTerritoryQueries();
  const gameState = {
    activeCityId: 'frontier',
    cities: {
      capital: { id: 'capital', name: '首都城', territoryId: 'capital' },
      frontier: { id: 'frontier', name: '边城', territoryId: 'frontier-site' },
      lost: { id: 'lost', name: '失地', territoryId: 'lost-site' },
    },
    territories: [
      {
        id: 'capital',
        x: 0,
        y: 0,
        status: 'occupied',
        cityName: '首都',
        naturalName: '首都',
        effects: { foodOutputMultiplier: 0.1, threatDefense: 1 },
      },
      {
        id: 'frontier-site',
        x: 5,
        y: -2,
        status: 'occupied',
        cityName: '边境城',
        naturalName: '边境城',
        effects: { woodOutputMultiplier: 0.2, knowledgeOutputMultiplier: 0.3, threatDefense: 2 },
      },
      {
        id: 'lost-site',
        x: 9,
        y: 9,
        status: 'discovered',
        effects: { foodOutputMultiplier: 99, threatDefense: 99 },
      },
    ],
  };

  assert.equal(Queries.getTerritory(gameState, 'frontier-site').cityName, '边境城');
  assert.equal(Queries.getTerritory(gameState, 'missing'), null);
  assert.equal(Queries.getCapitalTerritory({ territories: [] }).naturalName, '首都');
  assert.equal(Queries.getTerritoryForCity(gameState, 'frontier').id, 'frontier-site');
  assert.equal(Queries.getTerritoryForCity(gameState, 'lost').id, 'capital');
  assert.deepEqual(Queries.getScoutOrigin(gameState), {
    cityId: 'frontier',
    territoryId: 'frontier-site',
    name: '边城',
    x: 5,
    y: -2,
  });
  assert.deepEqual(Queries.getTerritoryEffects(gameState), {
    foodOutputMultiplier: 0.1,
    woodOutputMultiplier: 0.2,
    knowledgeOutputMultiplier: 0.3,
    threatDefense: 3,
  });
  assert.equal(Queries.getNearestSiteDistance(gameState, 8, 1), 3);
  assert.deepEqual(Queries.getSiteSpacingProfile(gameState, 8, 1), {
    valid: true,
    nearestDistance: 3,
    score: 5,
  });
  assert.equal(Queries.hasSiteSpacing(gameState, 1, 1), false);
});

test('territory military missions module owns selectors and soldier allocation contracts', () => {
  const MilitaryMissions = createTerritoryMilitaryMissions();

  const gameState = {
    activeCityId: 'frontier',
    military: { soldiers: 180 },
    cities: {
      capital: { id: 'capital', military: { soldiers: 140 } },
      frontier: { id: 'frontier', military: { soldiers: 120 } },
      outpost: { id: 'outpost', military: { soldiers: 90 } },
    },
    warMissions: [
      {
        id: 'conquest-ready',
        kind: 'conquest',
        territoryId: 'site-1',
        status: 'ready',
        sourceCityId: 'capital',
        soldiersCommitted: 100,
        soldierAllocations: [{ cityId: 'capital', soldiers: 100 }],
      },
      { id: 'conquest-done', kind: 'conquest', territoryId: 'site-2', status: 'done', soldiersCommitted: 400 },
    ],
  };

  assert.equal(MilitaryMissions.getMissionKind({ kind: 'scout' }), 'scout');
  assert.equal(MilitaryMissions.getMissionKind({ kind: 'other' }), 'conquest');
  assert.equal(MilitaryMissions.getActiveMissionForTerritory(gameState, 'site-1').id, 'conquest-ready');
  assert.equal(MilitaryMissions.getActiveMissionForTerritory(gameState, 'site-2'), null);
  assert.deepEqual(MilitaryMissions.getMissionSoldierAllocations({ sourceCityId: 'frontier', soldiersCommitted: 2 }), [
    { cityId: 'frontier', soldiers: 200 },
  ]);
  // Single source of truth: the active city ('frontier') reports its city-slot soldiers (120),
  // not the legacy top-level gameState.military mirror (180).
  assert.deepEqual(MilitaryMissions.getCitySoldierEntries(gameState), [
    { id: 'capital', soldiers: 140 },
    { id: 'frontier', soldiers: 120 },
    { id: 'outpost', soldiers: 90 },
  ]);
  assert.equal(MilitaryMissions.countSoldiersOnMission(gameState, 'capital'), 100);
  assert.equal(MilitaryMissions.countTotalSoldiersOnMission(gameState), 100);
  assert.equal(MilitaryMissions.getAvailableSoldiers(gameState), 250);
  assert.equal(MilitaryMissions.getAvailableSoldiersForCity(gameState, 'capital'), 40);
  assert.deepEqual(MilitaryMissions.allocateSoldiersForMission(gameState, 200), [
    { cityId: 'frontier', soldiers: 120 },
    { cityId: 'capital', soldiers: 40 },
    { cityId: 'outpost', soldiers: 40 },
  ]);
  assert.equal(MilitaryMissions.allocateSoldiersForMission(gameState, 999), null);
  // A zero-soldier mission (settlement) allocates successfully without drafting anyone.
  assert.deepEqual(MilitaryMissions.allocateSoldiersForMission(gameState, 0), []);
});

test('territory conquest missions module owns settlement and battle resolution contracts', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const boundTiles = [];
  const terrainRevealRequests = [];
  const terrainRevealBatches = [];
  const experienceGrants = [];
  const conquestBattleCalls = [];
  const Conquest = createTerritoryConquestMissions({
    BattleService: {
      getLeaderSnapshot: (_gameState, leader) => (leader === 'leader-1' ? { id: leader, name: '先锋' } : null),
      createConquestSummaryReport: () => ({ id: 'summary-battle' }),
    },
    ConquestBattleService: {
      resolveConquestBattle: (_gameState, mission, territory) => {
        conquestBattleCalls.push({ missionId: mission.id, territoryId: territory.id });
        return {
          success: mission.soldiersCommitted >= territory.defense,
          casualties: 30,
          report: {
            id: 'battle-1',
            mode: 'entity-battle',
            attacker: { leaderName: 'battle-leader' },
            experience: { leader: 12 },
            replay: { setup: { sides: [{}, {}] }, inputStream: [] },
          },
        };
      },
    },
    getFamousPersonService: () => ({
      MAX_CANDIDATES: 3,
      ensureFamousPersonState: (gameState) => {
        gameState.famousPersons = gameState.famousPersons || { candidates: [] };
        return gameState.famousPersons;
      },
      createFamousPersonCandidate: () => ({ id: 'candidate-1', source: { type: 'postWar' } }),
      grantBattleExperience: (_gameState, leader, experience) => {
        experienceGrants.push({ leader, experience });
        return { leader, levelUp: false };
      },
    }),
    WorldMapService: {
      getRevealArea: (x, y, radius) => {
        terrainRevealRequests.push({ x, y, radius });
        return [
          { q: x, r: y },
          { q: x + radius, r: y },
          { q: x, r: y - radius },
        ];
      },
      revealTiles: (_gameState, coords, _now, options) => {
        terrainRevealBatches.push({
          coords: coords.map((coord) => ({ q: coord.q, r: coord.r })),
          options,
        });
        return coords.map((coord) => ({ id: `tile_${coord.q}_${coord.r}`, q: coord.q, r: coord.r }));
      },
      bindSiteToTile: (_gameState, x, y, siteId, _now, options) => {
        boundTiles.push({ x, y, siteId, options });
      },
      getDistanceFromCapital: (q, r) => Math.max(Math.abs(Number(q) || 0), Math.abs(Number(r) || 0)),
    },
    allocateSoldiersForMission: (_gameState, required) => [{ cityId: 'capital', soldiers: required }],
    attachBattleTileSnapshot: (report, snapshot, battleTarget) => ({ ...report, snapshot, battleTarget }),
    getActiveMissionForTerritory: (gameState, territoryId) => (
      gameState.warMissions || []
    ).find((mission) => mission.territoryId === territoryId && ['active', 'ready'].includes(mission.status)) || null,
    getAvailableSoldiers: (gameState) => gameState.availableSoldiers,
    getMissionSoldierAllocations: (mission) => mission.soldierAllocations || [],
    getNamingPrompt: () => ({ type: 'city', territoryId: 'site-1' }),
    getTerritory: (gameState, territoryId) => (
      gameState.territories || []
    ).find((territory) => territory.id === territoryId) || null,
    getTerritoryBattleTargetSnapshot: (_gameState, territory) => ({ id: `target_${territory.id}` }),
    getTerritoryBattleTileSnapshot: (_gameState, territory) => ({
      tileId: `tile_${territory.x}_${territory.y}`,
      q: territory.x,
      r: territory.y,
      mapTerrain: territory.mapTerrain || 'plains',
      terrain: territory.terrain || 'plains',
      tile: { id: `tile_${territory.x}_${territory.y}`, q: territory.x, r: territory.y, terrain: territory.mapTerrain || 'plains' },
    }),
    normalizeBattleTarget: (target) => ({ ...target, normalized: true }),
  });

  assert.equal(Conquest.getOccupationMode({ owner: 'neutral' }), 'settlement');
  assert.equal(Conquest.getOccupationMode({ owner: 'tribe' }), 'conquest');
  // The capital is not an expansion city. The first neutral expansion settles without combat,
  // while later cities follow their distance-band garrison policy.
  const capitalOnly = {
    playerId: 'territory-player',
    territories: [{ id: 'capital', type: 'capital', owner: 'player', status: 'occupied' }],
  };
  const firstExpansionOccupied = {
    ...capitalOnly,
    territories: [
      ...capitalOnly.territories,
      { id: 'site-first', type: 'city', owner: 'player', status: 'occupied' },
    ],
  };
  assert.equal(Conquest.getOccupationMode({ owner: 'neutral', capitalDistance: 6 }, capitalOnly), 'settlement');
  assert.equal(Conquest.getOccupationMode({ owner: 'neutral', capitalDistance: 2 }, firstExpansionOccupied), 'settlement');
  assert.equal(Conquest.getOccupationMode({ owner: 'neutral', capitalDistance: 6 }, firstExpansionOccupied), 'conquest');
  // Combat expeditions keep the requested amount (floor of 1); settlement needs no soldiers.
  assert.equal(Conquest.normalizeExpeditionConfig({ soldiers: 20 }, { owner: 'tribe', defense: 250 }).soldiers, 20);
  assert.equal(Conquest.normalizeExpeditionConfig({}, { owner: 'tribe', defense: 250 }).soldiers, 250);
  assert.equal(Conquest.normalizeExpeditionConfig({ soldiers: 500 }, { owner: 'neutral' }).soldiers, 0);

  const settlementState = {
    availableSoldiers: 0,
    activeCityId: 'capital',
    warMissions: [],
    territories: [{
      id: 'site-1',
      x: 2,
      y: 0,
      naturalName: 'River Bend',
      owner: 'neutral',
      status: 'discovered',
      defense: TerritoryConstants.MIN_EXPEDITION_SOLDIERS,
    }],
  };
  const startedSettlement = Conquest.startConquest(settlementState, 'site-1', {}, now);
  assert.equal(startedSettlement.success, true);
  assert.equal(startedSettlement.mission.mode, 'settlement');
  // Settlement occupation launches with zero reserve soldiers and commits zero.
  assert.equal(startedSettlement.mission.soldiersCommitted, 0);
  assert.equal(settlementState.territories[0].status, 'contested');
  settlementState.warMissions[0].status = 'ready';
  const claimedSettlement = Conquest.claimConquest(settlementState, 'site-1', now);
  assert.equal(claimedSettlement.success, true);
  assert.equal(claimedSettlement.outcome, 'success');
  assert.equal(claimedSettlement.namingPrompt.type, 'city');
  assert.equal(settlementState.territories[0].status, 'occupied');
  assert.equal(settlementState.territories[0].owner, 'player');
  assert.deepEqual(terrainRevealRequests.at(-1), { x: 2, y: 0, radius: 3 });
  assert.deepEqual(terrainRevealBatches.at(-1).coords, [
    { q: 2, r: 0 },
    { q: 5, r: 0 },
    { q: 2, r: -3 },
  ]);
  assert.equal(terrainRevealBatches.at(-1).options.overrides.visibility, 'scouted');
  assert.equal(boundTiles.at(-1).options.visibility, 'controlled');

  const battleState = {
    availableSoldiers: 300,
    activeCityId: 'capital',
    cities: { capital: { id: 'capital', military: { soldiers: 300 } } },
    warMissions: [],
    territories: [{
      id: 'camp-1',
      x: 3,
      y: 0,
      naturalName: 'Forest Camp',
      owner: 'tribe',
      status: 'discovered',
      defense: 200,
      recommendedSoldiers: 200,
      garrison: { id: 'garrison-1' },
      defenderLeader: { id: 'defender-1' },
    }],
  };
  const startedBattle = Conquest.startConquest(battleState, 'camp-1', { soldiers: 220, leader: 'leader-1' }, now);
  assert.equal(startedBattle.success, true);
  assert.equal(startedBattle.mission.mode, 'conquest');
  assert.equal(startedBattle.mission.expedition.leaderSnapshot.name, '先锋');
  battleState.warMissions[0].status = 'ready';
  const claimedBattle = Conquest.claimConquest(battleState, 'camp-1', now);
  assert.equal(claimedBattle.success, true);
  assert.equal(claimedBattle.outcome, 'success');
  assert.equal(claimedBattle.casualties, 30);
  assert.deepEqual(conquestBattleCalls, [{ missionId: startedBattle.mission.id, territoryId: 'camp-1' }]);
  assert.equal(claimedBattle.battleReport.mode, 'entity-battle');
  assert.equal(battleState.cities.capital.military.soldiers, 270);
  assert.equal(battleState.territories[0].garrison, null);
  assert.equal(battleState.territories[0].lastBattle.leaderGrowth.leader, 'leader-1');
  assert.deepEqual(experienceGrants[0], { leader: 'leader-1', experience: { leader: 12 } });
  assert.deepEqual(terrainRevealRequests.at(-1), { x: 3, y: 0, radius: 3 });
  assert.deepEqual(terrainRevealBatches.at(-1).coords, [
    { q: 3, r: 0 },
    { q: 6, r: 0 },
    { q: 3, r: -3 },
  ]);
  assert.equal(terrainRevealBatches.length, 2);
});

test('TerritoryService battle tile snapshot terrain lookup uses coordinates over colliding tile ids', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = {
    playerId: 'territory-battle-tile-lookup-test',
    activeCityId: 'capital',
    military: { soldiers: 300 },
    warMissions: [],
    worldMap: {
      version: 7,
      seed: 'territory-battle-tile-lookup-seed',
      tiles: [
        {
          id: 'tile_8_0',
          q: 1,
          r: 0,
          terrain: 'mountain',
          discovered: true,
          visible: true,
          visibility: 'scouted',
        },
        {
          id: 'tile_8_0_current',
          q: 8,
          r: 0,
          terrain: 'forest',
          discovered: true,
          visible: true,
          visibility: 'scouted',
        },
      ],
    },
    territories: [{
      id: 'site-8-0',
      x: 8,
      y: 0,
      naturalName: 'Coordinate Site',
      type: 'outpost',
      owner: 'neutral',
      status: 'discovered',
      defense: TerritoryConstants.MIN_EXPEDITION_SOLDIERS,
    }],
  };

  const started = TerritoryService.startConquest(gameState, 'site-8-0', {}, now);
  assert.equal(started.success, true);
  gameState.warMissions[0].status = 'ready';

  const claimed = TerritoryService.claimConquest(gameState, 'site-8-0', now);
  assert.equal(claimed.success, true);
  const territory = gameState.territories.find((item) => item.id === 'site-8-0');
  assert.equal(territory.lastBattle.tileId, 'tile_8_0');
  assert.equal(territory.lastBattle.q, 8);
  assert.equal(territory.lastBattle.r, 0);
  assert.equal(territory.lastBattle.mapTerrain, 'forest');
  assert.equal(territory.lastBattle.tile.terrain, 'forest');
});

test('territory state normalizer owns territory, mission, and world sync contracts', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const calls = {
    boundSites: [],
    ensuredMaps: 0,
    readiness: 0,
  };
  const Normalizer = createTerritoryStateNormalizer({
    WorldMapService: {
      getTileId: (q, r) => `tile_${q}_${r}`,
      getWorldMapVersion: (worldMap) => worldMap?.version || 1,
      ensureWorldMap: (gameState) => {
        calls.ensuredMaps += 1;
        gameState.worldMap = gameState.worldMap || { version: 1, seed: 'seed', tiles: [] };
        gameState.worldMap.tiles = gameState.worldMap.tiles || [];
        return gameState.worldMap;
      },
      revealTile: (gameState, q, r) => {
        const tile = { id: `tile_${q}_${r}`, q, r, discovered: true, terrain: 'plains' };
        gameState.worldMap.tiles.push(tile);
        return tile;
      },
      bindSiteToTile: (gameState, x, y, siteId, _now, options) => {
        calls.boundSites.push({ x, y, siteId, options });
        const tileId = `tile_${x}_${y}`;
        const tile = (gameState.worldMap.tiles || []).find((item) => item.id === tileId);
        if (tile) tile.siteId = siteId;
      },
    },
    getMissionSoldierAllocations: (mission) => mission.soldierAllocations || [{ cityId: 'capital', soldiers: 200 }],
    normalizeBattleTarget: (target) => ({ ...target, normalized: true }),
    normalizeGarrison: (raw, territory) => (territory.owner === 'tribe'
      ? { id: `garrison_${territory.id}`, siteId: territory.id, leader: { id: 'leader-1' } }
      : raw || null),
    updateMissionReadiness: (gameState) => {
      calls.readiness += 1;
      return gameState.warMissions;
    },
  });

  const gameState = {
    polity: { name: '  River League  ', capitalCityName: '  Capital  ', color: '#abc' },
    worldMap: {
      version: 7,
      seed: 'seed',
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, discovered: true },
        { id: 'tile_1_0', q: 1, r: 0, discovered: true, siteId: 'ghost-site' },
        { id: 'tile_2_0', q: 2, r: 0, discovered: true },
      ],
    },
    territories: [
      { id: 'river-site', x: 1, y: 0, type: 'town', owner: 'neutral', status: 'discovered', naturalName: 'River Site' },
      { id: 'camp-1', x: 3, y: 0, type: 'camp', owner: 'tribe', status: 'discovered', defense: 5, recommendedSoldiers: 7 },
      { id: 'zero', x: 0, y: 0, status: 'discovered' },
    ],
    warMissions: [
      // Legacy directional-scout missions must be dropped by the normalizer.
      { id: 'bad-scout', kind: 'scout', direction: 'bad' },
      { id: 'scout-legacy', kind: 'scout', direction: 'e', status: 'active' },
      {
        id: 'conquest-1',
        kind: 'conquest',
        territoryId: 'camp-1',
        soldiersCommitted: 2,
        expedition: { soldiers: 2, troopType: 'spears', leader: 'leader-1' },
        status: 'ready',
      },
    ],
    // Legacy persisted directional-scout keys must be dropped on normalize.
    scoutReports: [{ id: 'report-1' }],
    scoutedCoordinates: [{ x: 9, y: 9, result: 'empty' }],
    scoutState: { emptyStreak: 2 },
  };

  Normalizer.normalizeTerritoryState(gameState, now);

  assert.equal(gameState.territories[0].id, 'capital');
  assert.equal(gameState.territories.some((territory) => territory.id === 'zero'), false);
  const riverSite = gameState.territories.find((territory) => territory.id === 'river-site');
  assert.equal(riverSite.x, 1);
  assert.equal(riverSite.y, 0);
  assert.equal(riverSite.status, 'discovered');
  assert.equal(riverSite.owner, 'neutral');
  const camp = gameState.territories.find((territory) => territory.id === 'camp-1');
  assert.equal(camp.defense, 500);
  assert.equal(camp.garrison.siteId, 'camp-1');
  // All scout missions dropped; only the conquest mission survives.
  assert.deepEqual(gameState.warMissions.map((mission) => mission.id), ['conquest-1']);
  assert.equal(gameState.warMissions[0].soldiersCommitted, 200);
  assert.equal(gameState.polity.name, 'River League');
  // Legacy directional-scout persisted keys are dropped.
  assert.equal(gameState.scoutState, undefined);
  assert.equal(gameState.scoutReports, undefined);
  assert.equal(gameState.scoutedCoordinates, undefined);
  assert.ok(calls.boundSites.some((call) => call.siteId === 'camp-1' && call.options.visibility === 'scouted'));
  assert.equal(gameState.worldMap.tiles.find((tile) => tile.id === 'tile_1_0').siteId, 'river-site');
  assert.equal(calls.readiness, 1);
});

test('territory normalizer stamps 距首城 distance from the ACTUAL capital origin, not world origin', () => {
  const Normalizer = createTerritoryStateNormalizer({
    WorldMapService: { getTileId: (q, r) => `tile_${q}_${r}` },
    normalizeGarrison: (garrison) => garrison,
    normalizeBattleTarget: (target) => target,
  });
  // Capital spawned off world-origin at (18,-4); a neutral city one tile away at (19,-4).
  const site = Normalizer.normalizeTerritory(
    { id: 'site_19_-4', x: 19, y: -4, owner: 'neutral', type: 'outpost', status: 'discovered', defense: 300 },
    '2026-01-01T00:00:00.000Z',
    { capitalOrigin: { q: 18, r: -4 } },
  );
  // True ring distance from the capital is 1 (safe band) — NOT 19 (distance from world origin),
  // which was the bug that put a 500-soldier garrison on a city next to home.
  assert.equal(site.capitalDistance, 1);
});

test('territory known-world bridging reveals gaps through the world-map batch API', () => {
  const calls = {
    ensureWorldMap: 0,
    revealTile: 0,
    revealTiles: [],
  };
  const Normalizer = createTerritoryStateNormalizer({
    WorldMapService: {
      ensureWorldMap: (gameState) => {
        calls.ensureWorldMap += 1;
        gameState.worldMap = gameState.worldMap || { seed: 'seed', tiles: [] };
        return gameState.worldMap;
      },
      revealTile: () => {
        calls.revealTile += 1;
        throw new Error('known-world bridging should not reveal one tile at a time');
      },
      revealTiles: (gameState, coords) => {
        const batch = coords.map((coord) => ({ q: coord.q, r: coord.r }));
        calls.revealTiles.push(batch);
        gameState.worldMap.tiles.push(...batch.map((coord) => ({
          id: `tile_${coord.q}_${coord.r}`,
          q: coord.q,
          r: coord.r,
          discovered: true,
          visible: true,
          visibility: 'scouted',
        })));
        return batch;
      },
    },
    getMissionSoldierAllocations: () => [],
    normalizeBattleTarget: (target) => target,
    normalizeGarrison: (raw) => raw || null,
    updateMissionReadiness: () => {},
  });
  const gameState = {
    worldMap: {
      seed: 'seed',
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, discovered: true, visible: true, visibility: 'controlled' },
        { id: 'tile_3_0', q: 3, r: 0, discovered: true, visible: true, visibility: 'scouted' },
      ],
    },
    territories: [],
  };

  const added = Normalizer.revealSolidKnownWorldTiles(gameState, '2026-06-06T00:00:00.000Z');

  assert.equal(added, 2);
  assert.equal(calls.revealTile, 0);
  assert.deepEqual(calls.revealTiles, [[
    { q: 1, r: 0 },
    { q: 2, r: 0 },
  ]]);
});

test('territory naming module owns city and polity naming contracts', () => {
  const Naming = createTerritoryNaming({
    getTerritory: (gameState, territoryId) => (
      gameState.territories || []
    ).find((territory) => territory.id === territoryId) || null,
  });

  assert.equal(Naming.sanitizeName(''), null);
  assert.equal(Naming.sanitizeName('  '), null);
  assert.equal(Naming.sanitizeName('  123456789012345  '), '123456789012');

  const oneCityState = {
    polity: { name: null, namePrompted: false, capitalCityName: 'Capital' },
    territories: [
      { id: 'capital', status: 'occupied', cityName: 'Capital', naturalName: 'Capital' },
      { id: 'site-1', status: 'discovered', cityName: null, naturalName: 'River Bend' },
    ],
  };
  assert.equal(Naming.getOccupiedCount(oneCityState), 1);
  assert.equal(Naming.renamePolity(oneCityState, 'Alliance').error, 'POLITY_NOT_READY');

  const namingState = {
    polity: { name: null, namePrompted: false, capitalCityName: 'Capital' },
    territories: [
      { id: 'capital', status: 'occupied', cityName: 'Capital', naturalName: 'Capital' },
      { id: 'site-1', status: 'occupied', cityName: null, naturalName: 'River Bend' },
      { id: 'site-2', status: 'discovered', cityName: null, naturalName: 'Hill Gate' },
    ],
  };

  assert.equal(Naming.getPendingCityNamingTerritory(namingState).id, 'site-1');
  assert.equal(Naming.getNamingPrompt(namingState).type, 'city');
  assert.equal(Naming.getNamingPrompt(namingState).territoryId, 'site-1');
  assert.equal(Naming.renameCity(namingState, 'site-1', '  ').error, 'INVALID_NAME');
  assert.equal(Naming.renameCity(namingState, 'site-2', 'Hill City').error, 'TERRITORY_NOT_OCCUPIED');

  const renamedCity = Naming.renameCity(namingState, 'site-1', '  123456789012345  ');
  assert.equal(renamedCity.success, true);
  assert.equal(namingState.territories[1].cityName, '123456789012');
  assert.equal(renamedCity.namingPrompt.type, 'polity');

  const renamedCapital = Naming.renameCity(namingState, 'capital', 'New Capital');
  assert.equal(renamedCapital.success, true);
  assert.equal(namingState.polity.capitalCityName, 'New Capital');

  const renamedPolity = Naming.renamePolity(namingState, '  River League  ');
  assert.equal(renamedPolity.success, true);
  assert.equal(namingState.polity.name, 'River League');
  assert.equal(namingState.polity.namePrompted, true);
  assert.equal(renamedPolity.namingPrompt, null);
});

test('TerritoryService facade preserves the legacy territory API', () => {
  const expectedApi = [
    'CONQUEST_DURATION_MS',
    'MIN_EXPEDITION_SOLDIERS',
    'MISSION_DURATION_MS',
    'SITE_ART',
    'SITE_TEMPLATES',
    'claimConquest',
    'countSoldiersOnMission',
    'resolveCapture',
    'createInitialPolity',
    'createInitialTerritories',
    'getAvailableSoldiers',
    'getClientTerritoryState',
    'getTerritoryEffects',
    'normalizeTerritoryState',
    'renameCity',
    'renamePolity',
    'startConquest',
    'updateMissionReadiness',
  ];

  assert.deepEqual(Object.keys(TerritoryService).sort(), expectedApi.sort());
});
