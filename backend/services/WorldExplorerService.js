const WorldMapService = require('./WorldMapService');
const TerritoryService = require('./TerritoryService');
const { TUTORIAL_STEPS, createPhaseCompleted } = require('../config/TutorialFlowConfig');

const EXPLORE_STEP_DURATION_MS = 10 * 1000;
const DEFAULT_RANDOM_ROUTE_LENGTH = 8;
const MAX_RANDOM_ROUTE_LENGTH = 16;
const MAX_MANUAL_ROUTE_LENGTH = 16;
const MAX_ACTIVE_EXPLORE_MISSIONS = 1;
const EXPLORE_REVEAL_RADIUS = 0;
const MAX_ROUTE_DISTANCE_FROM_ORIGIN = 32;
const TUTORIAL_FIRST_SITE_GRANT_KEY = 'firstExploreEmptyCity';

const NEIGHBOR_OFFSETS = Object.values(WorldMapService.DIRECTION_VECTORS);
const TUTORIAL_EMPTY_CITY_NAMES = [
  '\u6e05\u6cc9\u57ce',
  '\u77f3\u6e21\u9547',
  '\u9752\u6797\u57ce',
  '\u6cb3\u6e7e\u57ce',
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function toTimestamp(value, fallback = 0) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : fallback;
}

function hashString(input) {
  let hash = 2166136261;
  const text = String(input);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function random01(seed, q, r, salt) {
  return hashString(`${seed || 'world-explorer'}|${q}|${r}|${salt}`) / 4294967295;
}

function getCoordinateKey(q, r) {
  return `${toInteger(q, 0)},${toInteger(r, 0)}`;
}

function getDistance(fromQ, fromR, toQ, toR) {
  return Math.max(Math.abs(toInteger(toQ, 0) - toInteger(fromQ, 0)), Math.abs(toInteger(toR, 0) - toInteger(fromR, 0)));
}

function advanceTutorialStep(tutorial = {}, nextStep = 0) {
  const step = Math.floor(Number(nextStep) || 0);
  const currentStep = Math.floor(Number(tutorial.currentStep) || 0);
  if (tutorial.completed || tutorial.disabled || step <= currentStep) return tutorial;
  return {
    ...tutorial,
    currentStep: step,
    phaseCompleted: {
      ...(tutorial.phaseCompleted || {}),
      ...createPhaseCompleted(step),
    },
    completed: step >= TUTORIAL_STEPS.completed,
    updatedAt: new Date().toISOString(),
  };
}

function getTutorialScoutPersonId(gameState = {}) {
  const personId = gameState.tutorial?.grants?.scoutFamousPerson?.personId;
  return personId ? String(personId) : '';
}

function getFormationSnapshot(gameState = {}, options = {}) {
  const cityId = String(options.cityId || gameState.activeCityId || 'capital').trim() || 'capital';
  const slot = Math.max(1, Math.min(3, toInteger(options.formationSlot ?? options.slot, 1)));
  const directFormations = gameState.military?.formations?.[cityId];
  const cityFormations = gameState.cities?.[cityId]?.military?.formations?.[cityId];
  const formations = Array.isArray(directFormations)
    ? directFormations
    : Array.isArray(cityFormations)
      ? cityFormations
      : [];
  const formation = formations.find((item) => Number(item?.slot) === slot) || formations[slot - 1] || null;
  return {
    cityId,
    slot,
    memberIds: Array.isArray(formation?.memberIds) ? formation.memberIds.map(String) : [],
  };
}

function validateTutorialFormation(gameState = {}, options = {}) {
  const tutorial = gameState.tutorial || {};
  if (tutorial.completed || tutorial.disabled) return { success: true, formation: getFormationSnapshot(gameState, options) };
  const step = Math.floor(Number(tutorial.currentStep) || 0);
  if (step < TUTORIAL_STEPS.scoutFormationSaved) {
    return { success: false, error: 'EXPLORE_TUTORIAL_LOCKED', message: 'Please finish the scout formation guide before exploring.' };
  }
  if (step >= TUTORIAL_STEPS.scoutExploreClaimed) return { success: true, formation: getFormationSnapshot(gameState, options) };
  const scoutPersonId = getTutorialScoutPersonId(gameState);
  const formation = getFormationSnapshot(gameState, options);
  if (!scoutPersonId || !formation.memberIds.includes(scoutPersonId)) {
    return { success: false, error: 'EXPLORE_TUTORIAL_FORMATION_REQUIRED', message: 'Please keep the tutorial scout famous person in formation 1 before exploring.' };
  }
  return { success: true, formation };
}

function normalizeRouteStep(rawStep, index = 0) {
  if (!rawStep || typeof rawStep !== 'object') return null;
  const q = toInteger(rawStep.q ?? rawStep.x, 0);
  const r = toInteger(rawStep.r ?? rawStep.y, 0);
  const step = Math.max(1, toInteger(rawStep.step, index + 1));
  return {
    q,
    r,
    step,
    tileId: rawStep.tileId || WorldMapService.getTileId(q, r),
    revealed: Boolean(rawStep.revealed),
    revealedAt: rawStep.revealedAt || null,
  };
}

function normalizePlannedTile(rawTile) {
  if (!rawTile || typeof rawTile !== 'object') return null;
  const q = toInteger(rawTile.q, 0);
  const r = toInteger(rawTile.r, 0);
  return {
    ...rawTile,
    id: rawTile.id || WorldMapService.getTileId(q, r),
    q,
    r,
  };
}

function normalizePlannedSite(rawSite) {
  if (!rawSite || typeof rawSite !== 'object') return null;
  const q = toInteger(rawSite.q ?? rawSite.x, 0);
  const r = toInteger(rawSite.r ?? rawSite.y, 0);
  const site = rawSite.site && typeof rawSite.site === 'object' ? rawSite.site : {};
  const siteId = String(rawSite.siteId || site.id || `site_${q}_${r}`).trim();
  if (!siteId) return null;
  const tileId = rawSite.tileId || WorldMapService.getTileId(q, r);
  return {
    tileId,
    q,
    r,
    siteId,
    materialized: Boolean(rawSite.materialized),
    revealedAt: rawSite.revealedAt || null,
    site: {
      ...site,
      id: siteId,
      x: toInteger(site.x ?? q, q),
      y: toInteger(site.y ?? r, r),
    },
  };
}

function normalizeMission(rawMission) {
  if (!rawMission || typeof rawMission !== 'object') return null;
  const route = (Array.isArray(rawMission.route) ? rawMission.route : [])
    .map(normalizeRouteStep)
    .filter(Boolean)
    .sort((a, b) => a.step - b.step);
  if (!route.length) return null;
  const mode = rawMission.mode === 'manual' ? 'manual' : 'random';
  const status = ['active', 'ready', 'cancelled'].includes(rawMission.status)
    ? rawMission.status
    : 'active';
  const origin = rawMission.origin && typeof rawMission.origin === 'object'
    ? rawMission.origin
    : {};
  const originQ = toInteger(origin.q ?? rawMission.originQ ?? rawMission.originX, 0);
  const originR = toInteger(origin.r ?? rawMission.originR ?? rawMission.originY, 0);
  const stepDurationMs = Math.max(1000, toInteger(rawMission.stepDurationMs, EXPLORE_STEP_DURATION_MS));
  const revealedTileIds = Array.from(new Set([
    ...(Array.isArray(rawMission.revealedTileIds) ? rawMission.revealedTileIds : []),
    ...route.filter((step) => step.revealed).map((step) => step.tileId),
  ].filter(Boolean).map(String)));
  return {
    id: typeof rawMission.id === 'string' && rawMission.id ? rawMission.id : `explore_${mode}_${Date.now()}`,
    kind: 'worldExplore',
    mode,
    status,
    origin: {
      q: originQ,
      r: originR,
      cityId: origin.cityId || rawMission.sourceCityId || 'capital',
      territoryId: origin.territoryId || rawMission.originTerritoryId || 'capital',
      name: origin.name || rawMission.originName || '',
    },
    target: rawMission.target && typeof rawMission.target === 'object'
      ? {
        q: toInteger(rawMission.target.q ?? rawMission.target.x, route.at(-1)?.q || originQ),
        r: toInteger(rawMission.target.r ?? rawMission.target.y, route.at(-1)?.r || originR),
      }
      : { q: route.at(-1)?.q || originQ, r: route.at(-1)?.r || originR },
    route,
    plannedTiles: (Array.isArray(rawMission.plannedTiles) ? rawMission.plannedTiles : [])
      .map(normalizePlannedTile)
      .filter(Boolean),
    plannedSites: (Array.isArray(rawMission.plannedSites) ? rawMission.plannedSites : [])
      .map(normalizePlannedSite)
      .filter(Boolean),
    revealedTileIds,
    stepDurationMs,
    formation: rawMission.formation && typeof rawMission.formation === 'object'
      ? {
        cityId: rawMission.formation.cityId || rawMission.sourceCityId || origin.cityId || 'capital',
        slot: Math.max(1, toInteger(rawMission.formation.slot ?? rawMission.formationSlot, 1)),
        memberIds: Array.isArray(rawMission.formation.memberIds)
          ? rawMission.formation.memberIds.map(String)
          : [],
      }
      : {
        cityId: rawMission.sourceCityId || origin.cityId || 'capital',
        slot: Math.max(1, toInteger(rawMission.formationSlot, 1)),
        memberIds: [],
      },
    startedAt: rawMission.startedAt || new Date().toISOString(),
    nextStepAt: rawMission.nextStepAt || rawMission.startedAt || new Date().toISOString(),
    completesAt: rawMission.completesAt || rawMission.startedAt || new Date().toISOString(),
    completedAt: rawMission.completedAt || null,
    claimedAt: rawMission.claimedAt || null,
  };
}

function normalizeMissions(rawMissions) {
  return (Array.isArray(rawMissions) ? rawMissions : [])
    .map(normalizeMission)
    .filter(Boolean);
}

function getExploreOrigin(gameState) {
  const activeCityId = gameState?.activeCityId || 'capital';
  const city = gameState?.cities?.[activeCityId] || null;
  const territoryId = city?.territoryId || activeCityId;
  const territory = (gameState?.territories || []).find((item) => (
    item?.id === territoryId || item?.id === activeCityId
  )) || (gameState?.territories || []).find((item) => item?.id === 'capital') || {};
  return {
    q: toInteger(territory.x ?? territory.q, 0),
    r: toInteger(territory.y ?? territory.r, 0),
    cityId: city?.id || activeCityId,
    territoryId: territory.id || 'capital',
    name: city?.name || territory.cityName || territory.naturalName || 'capital',
  };
}

function getKnownTileIds(gameState) {
  const worldMap = WorldMapService.ensureWorldMap(gameState);
  return new Set((worldMap.tiles || [])
    .filter((tile) => tile && tile.discovered !== false)
    .map((tile) => tile.id || WorldMapService.getTileId(tile.q, tile.r)));
}

function countUnknownNeighbors(seed, knownTileIds, visitedKeys, q, r) {
  return NEIGHBOR_OFFSETS.reduce((sum, offset) => {
    const nextQ = q + offset.q;
    const nextR = r + offset.r;
    const key = getCoordinateKey(nextQ, nextR);
    if (visitedKeys.has(key)) return sum;
    if (WorldMapService.chooseTerrain(seed, nextQ, nextR) === 'ocean') return sum;
    const tileId = WorldMapService.getTileId(nextQ, nextR);
    return sum + (knownTileIds.has(tileId) ? 0 : 1);
  }, 0);
}

function getRandomRouteCandidates(seed, knownTileIds, visitedKeys, current, origin, routeSeed, step) {
  const candidates = [];
  for (const offset of NEIGHBOR_OFFSETS) {
    const q = current.q + offset.q;
    const r = current.r + offset.r;
    const key = getCoordinateKey(q, r);
    if (visitedKeys.has(key)) continue;
    if (getDistance(origin.q, origin.r, q, r) > MAX_ROUTE_DISTANCE_FROM_ORIGIN) continue;
    if (WorldMapService.chooseTerrain(seed, q, r) === 'ocean') continue;
    const tileId = WorldMapService.getTileId(q, r);
    const known = knownTileIds.has(tileId);
    const frontier = countUnknownNeighbors(seed, knownTileIds, visitedKeys, q, r);
    candidates.push({
      q,
      r,
      tileId,
      known,
      frontier,
      roll: random01(routeSeed, q, r, `step-${step}`),
    });
  }
  return candidates.sort((a, b) => (
    Number(a.known) - Number(b.known)
    || b.frontier - a.frontier
    || b.roll - a.roll
    || a.q - b.q
    || a.r - b.r
  ));
}

function buildRandomRoute(gameState, origin, routeLength = DEFAULT_RANDOM_ROUTE_LENGTH, now = new Date()) {
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const length = Math.max(1, Math.min(MAX_RANDOM_ROUTE_LENGTH, toInteger(routeLength, DEFAULT_RANDOM_ROUTE_LENGTH)));
  const knownTileIds = getKnownTileIds(gameState);
  const visitedKeys = new Set([getCoordinateKey(origin.q, origin.r)]);
  const routeSeed = `${worldMap.seed}|${origin.q}|${origin.r}|${now.getTime()}`;
  const route = [];
  let current = { q: origin.q, r: origin.r };
  for (let step = 1; step <= length; step += 1) {
    const candidates = getRandomRouteCandidates(worldMap.seed, knownTileIds, visitedKeys, current, origin, routeSeed, step);
    const chosen = candidates[0];
    if (!chosen) break;
    route.push({
      q: chosen.q,
      r: chosen.r,
      step,
      tileId: chosen.tileId,
      revealed: false,
      revealedAt: null,
    });
    visitedKeys.add(getCoordinateKey(chosen.q, chosen.r));
    knownTileIds.add(chosen.tileId);
    current = { q: chosen.q, r: chosen.r };
  }
  return route;
}

function buildManualRoute(origin, target, seed = WorldMapService.DEFAULT_WORLD_SEED) {
  const targetQ = toInteger(target?.q ?? target?.x, origin.q);
  const targetR = toInteger(target?.r ?? target?.y, origin.r);
  const distance = getDistance(origin.q, origin.r, targetQ, targetR);
  if (distance <= 0) {
    return { success: false, error: 'EXPLORE_TARGET_IS_ORIGIN', message: 'Explore target is already the origin.' };
  }
  if (distance > MAX_MANUAL_ROUTE_LENGTH) {
    return { success: false, error: 'EXPLORE_TARGET_TOO_FAR', message: 'Explore target is too far.' };
  }
  const route = [];
  let q = origin.q;
  let r = origin.r;
  for (let step = 1; step <= distance; step += 1) {
    q += Math.sign(targetQ - q);
    r += Math.sign(targetR - r);
    if (WorldMapService.chooseTerrain(seed, q, r) === 'ocean') {
      return { success: false, error: 'EXPLORE_ROUTE_BLOCKED', message: 'Explorer route is blocked by ocean.' };
    }
    route.push({
      q,
      r,
      step,
      tileId: WorldMapService.getTileId(q, r),
      revealed: false,
      revealedAt: null,
    });
  }
  return { success: true, route, target: { q: targetQ, r: targetR } };
}

function createPlannedTiles(gameState, route, now = new Date()) {
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  return route.map((step) => WorldMapService.createTile(worldMap.seed, step.q, step.r, now, {
    visibility: 'scouted',
  }));
}

function shouldGuaranteeTutorialEmptyCity(gameState = {}) {
  const tutorial = gameState.tutorial || {};
  if (tutorial.completed || tutorial.disabled) return false;
  const step = Math.floor(Number(tutorial.currentStep) || 0);
  if (step < TUTORIAL_STEPS.scoutFormationSaved || step >= TUTORIAL_STEPS.scoutExploreClaimed) return false;
  return !tutorial.grants?.[TUTORIAL_FIRST_SITE_GRANT_KEY];
}

function pickTutorialCityName(gameState = {}, q = 0, r = 0) {
  const seed = hashString(`${gameState.playerId || 'tutorial'}|${q}|${r}|first-empty-city`);
  return TUTORIAL_EMPTY_CITY_NAMES[seed % TUTORIAL_EMPTY_CITY_NAMES.length];
}

function getPlanningTerrainForMapTerrain(mapTerrain = 'plains') {
  if (mapTerrain === 'forest') return 'forest';
  if (['hills', 'mountain', 'waste', 'desert'].includes(mapTerrain)) return 'hills';
  if (mapTerrain === 'river') return 'river';
  if (mapTerrain === 'ocean') return 'coast';
  return 'plains';
}

function createTutorialEmptyCitySite(gameState = {}, step = {}, plannedTile = {}, now = new Date()) {
  const q = toInteger(step.q, 0);
  const r = toInteger(step.r, 0);
  const siteId = `site_${q}_${r}`;
  const mapTerrain = plannedTile.terrain && !['ocean', 'river'].includes(plannedTile.terrain)
    ? plannedTile.terrain
    : 'plains';
  return {
    id: siteId,
    x: q,
    y: r,
    naturalName: pickTutorialCityName(gameState, q, r),
    cityName: null,
    type: 'town',
    terrain: getPlanningTerrainForMapTerrain(mapTerrain),
    mapTerrain,
    owner: 'neutral',
    status: 'discovered',
    scale: 2,
    threat: 0,
    defense: TerritoryService.MIN_EXPEDITION_SOLDIERS,
    recommendedSoldiers: TerritoryService.MIN_EXPEDITION_SOLDIERS,
    art: TerritoryService.SITE_ART.town,
    visualOffset: { x: 0, y: 0 },
    discoveredAt: now.toISOString(),
    occupiedAt: null,
    effects: { foodOutputMultiplier: 0.05 },
    summary: '\u4e00\u5ea7\u672a\u8bbe\u9632\u7684\u7a7a\u57ce\uff0c\u9002\u5408\u4f5c\u4e3a\u7b2c\u4e00\u5904\u5916\u90e8\u636e\u70b9\u3002',
    lastBattle: null,
    garrison: null,
    defenderLeader: null,
    battleTarget: null,
  };
}

function createTutorialPlannedSites(gameState, route = [], plannedTiles = [], now = new Date()) {
  if (!shouldGuaranteeTutorialEmptyCity(gameState)) return [];
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const plannedById = new Map(plannedTiles.map((tile) => [tile.id || WorldMapService.getTileId(tile.q, tile.r), tile]));
  const existingCoords = new Set((gameState.territories || []).map((site) => getCoordinateKey(site.x, site.y)));
  const chosen = [...route].reverse().find((step) => {
    if (existingCoords.has(getCoordinateKey(step.q, step.r))) return false;
    const planned = plannedById.get(step.tileId) || {};
    const terrain = planned.terrain || WorldMapService.chooseTerrain(worldMap.seed, step.q, step.r);
    return !['ocean', 'river'].includes(terrain);
  }) || route.at(-1);
  if (!chosen) return [];
  const tileId = chosen.tileId || WorldMapService.getTileId(chosen.q, chosen.r);
  let plannedTile = plannedById.get(tileId);
  if (!plannedTile) {
    plannedTile = WorldMapService.createTile(worldMap.seed, chosen.q, chosen.r, now, {
      terrain: 'plains',
      visibility: 'scouted',
    });
  }
  if (['ocean', 'river'].includes(plannedTile.terrain)) {
    plannedTile.terrain = 'plains';
    plannedTile.riverPorts = [];
    plannedTile.oceanTemplates = [];
    plannedTile.transitionKey = '';
  }
  const site = createTutorialEmptyCitySite(gameState, chosen, plannedTile, now);
  return [{
    tileId,
    q: chosen.q,
    r: chosen.r,
    siteId: site.id,
    materialized: false,
    revealedAt: null,
    site,
  }];
}

function getPlannedTileById(mission) {
  return new Map((mission.plannedTiles || []).map((tile) => [tile.id || WorldMapService.getTileId(tile.q, tile.r), tile]));
}

function materializePlannedSitesForStep(gameState, mission, step, now = new Date()) {
  const tileId = step.tileId || WorldMapService.getTileId(step.q, step.r);
  const materialized = [];
  mission.plannedSites = (mission.plannedSites || []).map((plannedSite) => {
    if (!plannedSite || plannedSite.materialized || plannedSite.tileId !== tileId) return plannedSite;
    const normalized = normalizePlannedSite(plannedSite);
    const site = normalized?.site || null;
    if (!site) return plannedSite;
    const existing = (gameState.territories || []).find((territory) => territory.id === site.id) || null;
    if (!existing) gameState.territories = [...(gameState.territories || []), site];
    const tile = WorldMapService.bindSiteToTile(gameState, site.x, site.y, site.id, now, { visibility: 'scouted' });
    materialized.push({ site, tile });
    return {
      ...plannedSite,
      materialized: true,
      revealedAt: now.toISOString(),
    };
  });
  if (materialized.length && gameState.tutorial && !gameState.tutorial.grants?.[TUTORIAL_FIRST_SITE_GRANT_KEY]) {
    gameState.tutorial = {
      ...gameState.tutorial,
      grants: {
        ...(gameState.tutorial.grants || {}),
        [TUTORIAL_FIRST_SITE_GRANT_KEY]: {
          siteId: materialized[0].site.id,
          discoveredAt: now.toISOString(),
        },
      },
      updatedAt: now.toISOString(),
    };
  }
  return materialized;
}

function revealCoordinate(gameState, mission, coord, now = new Date()) {
  const planned = getPlannedTileById(mission).get(WorldMapService.getTileId(coord.q, coord.r));
  const overrides = planned
    ? {
      terrain: planned.terrain,
      riverPorts: planned.riverPorts,
      oceanTemplates: planned.oceanTemplates,
      transitionKey: planned.transitionKey,
      generatedAt: planned.generatedAt,
      visibility: 'scouted',
    }
    : { visibility: 'scouted' };
  return WorldMapService.revealTile(gameState, coord.q, coord.r, now, overrides);
}

function revealStep(gameState, mission, step, now = new Date()) {
  const coords = EXPLORE_REVEAL_RADIUS > 0
    ? WorldMapService.getRevealArea(step.q, step.r, EXPLORE_REVEAL_RADIUS)
    : [{ q: step.q, r: step.r }];
  const revealedTiles = coords.map((coord) => revealCoordinate(gameState, mission, coord, now));
  const materialized = materializePlannedSitesForStep(gameState, mission, step, now);
  if (!materialized.length) return revealedTiles;
  const byId = new Map(revealedTiles.map((tile) => [tile.id, tile]));
  materialized.forEach(({ tile }) => {
    if (tile?.id) byId.set(tile.id, tile);
  });
  return [...byId.values()];
}

function advanceExploreMissions(gameState, now = new Date()) {
  gameState.exploreMissions = normalizeMissions(gameState.exploreMissions);
  const nowMs = now.getTime();
  const newlyRevealedTiles = [];
  for (const mission of gameState.exploreMissions) {
    if (mission.status !== 'active') continue;
    let nextStepAtMs = toTimestamp(mission.nextStepAt, nowMs);
    while (nextStepAtMs <= nowMs) {
      const step = mission.route.find((item) => !item.revealed);
      if (!step) break;
      const revealedTiles = revealStep(gameState, mission, step, now);
      step.revealed = true;
      step.revealedAt = now.toISOString();
      newlyRevealedTiles.push(...revealedTiles);
      mission.revealedTileIds = Array.from(new Set([
        ...(mission.revealedTileIds || []),
        ...revealedTiles.map((tile) => tile.id),
      ]));
      nextStepAtMs += mission.stepDurationMs;
    }
    mission.nextStepAt = new Date(nextStepAtMs).toISOString();
    if (mission.route.every((step) => step.revealed)) {
      mission.status = 'ready';
      mission.completedAt = mission.completedAt || now.toISOString();
      mission.nextStepAt = null;
    }
  }
  return newlyRevealedTiles;
}

function normalizeExploreState(gameState, now = new Date()) {
  WorldMapService.ensureWorldMap(gameState, now);
  gameState.exploreMissions = normalizeMissions(gameState.exploreMissions);
  advanceExploreMissions(gameState, now);
  return gameState.exploreMissions;
}

function countActiveMissions(gameState) {
  return (gameState.exploreMissions || []).filter((mission) => mission.status === 'active').length;
}

function getClientMission(mission, now = new Date()) {
  const route = (mission.route || []).map((step) => ({
    q: step.q,
    r: step.r,
    step: step.step,
    tileId: step.tileId,
    revealed: Boolean(step.revealed),
    revealedAt: step.revealedAt || null,
  }));
  const lastRevealed = [...route].reverse().find((step) => step.revealed);
  const nextStepAtMs = toTimestamp(mission.nextStepAt, 0);
  return {
    id: mission.id,
    kind: mission.kind || 'worldExplore',
    mode: mission.mode,
    status: mission.status,
    origin: clone(mission.origin || {}),
    target: clone(mission.target || {}),
    route,
    plannedTiles: (mission.plannedTiles || []).map((tile) => clone(tile)),
    plannedSites: (mission.plannedSites || []).map((site) => ({
      tileId: site.tileId,
      q: site.q,
      r: site.r,
      siteId: site.siteId,
      materialized: Boolean(site.materialized),
      revealedAt: site.revealedAt || null,
    })),
    formation: clone(mission.formation || {}),
    position: lastRevealed
      ? { q: lastRevealed.q, r: lastRevealed.r, tileId: lastRevealed.tileId }
      : { q: mission.origin?.q || 0, r: mission.origin?.r || 0, tileId: WorldMapService.getTileId(mission.origin?.q || 0, mission.origin?.r || 0) },
    revealedTileIds: [...(mission.revealedTileIds || [])],
    stepDurationSeconds: Math.floor((mission.stepDurationMs || EXPLORE_STEP_DURATION_MS) / 1000),
    remainingSeconds: mission.status === 'active' && nextStepAtMs
      ? Math.max(0, Math.ceil((nextStepAtMs - now.getTime()) / 1000))
      : 0,
    startedAt: mission.startedAt,
    completedAt: mission.completedAt || null,
  };
}

function getClientState(gameState, now = new Date()) {
  normalizeExploreState(gameState, now);
  const missions = (gameState.exploreMissions || []).map((mission) => getClientMission(mission, now));
  return {
    missions,
    activeMission: missions.find((mission) => mission.status === 'active') || null,
    readyMissions: missions.filter((mission) => mission.status === 'ready'),
    maxActiveMissions: MAX_ACTIVE_EXPLORE_MISSIONS,
    randomRouteLength: DEFAULT_RANDOM_ROUTE_LENGTH,
    maxManualRouteLength: MAX_MANUAL_ROUTE_LENGTH,
    stepDurationSeconds: Math.floor(EXPLORE_STEP_DURATION_MS / 1000),
  };
}

function startExplore(gameState, options = {}, now = new Date()) {
  normalizeExploreState(gameState, now);
  const formationValidation = validateTutorialFormation(gameState, options);
  if (!formationValidation.success) return formationValidation;
  if (countActiveMissions(gameState) >= MAX_ACTIVE_EXPLORE_MISSIONS) {
    return { success: false, error: 'EXPLORE_LIMIT_REACHED', message: 'An explorer mission is already active.' };
  }
  const mode = options.mode === 'manual' ? 'manual' : 'random';
  const origin = getExploreOrigin(gameState);
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  let routeResult = null;
  if (mode === 'manual') {
    routeResult = buildManualRoute(origin, {
      q: options.targetQ ?? options.q ?? options.x,
      r: options.targetR ?? options.r ?? options.y,
    }, worldMap.seed);
    if (!routeResult.success) return routeResult;
  } else {
    routeResult = {
      success: true,
      route: buildRandomRoute(gameState, origin, options.routeLength, now),
    };
  }
  const route = routeResult.route || [];
  if (!route.length) {
    return { success: false, error: 'EXPLORE_ROUTE_EMPTY', message: 'No explorer route could be generated.' };
  }
  const plannedTiles = createPlannedTiles(gameState, route, now);
  const plannedSites = createTutorialPlannedSites(gameState, route, plannedTiles, now);
  const mission = normalizeMission({
    id: `explore_${mode}_${now.getTime()}`,
    mode,
    status: 'active',
    origin,
    target: routeResult.target || { q: route.at(-1).q, r: route.at(-1).r },
    route,
    plannedTiles,
    plannedSites,
    revealedTileIds: [],
    formation: formationValidation.formation,
    stepDurationMs: EXPLORE_STEP_DURATION_MS,
    startedAt: now.toISOString(),
    nextStepAt: new Date(now.getTime() + EXPLORE_STEP_DURATION_MS).toISOString(),
    completesAt: new Date(now.getTime() + EXPLORE_STEP_DURATION_MS * route.length).toISOString(),
  });
  gameState.exploreMissions = [...(gameState.exploreMissions || []), mission];
  gameState.tutorial = advanceTutorialStep(gameState.tutorial, TUTORIAL_STEPS.scoutExploreStarted);
  return {
    success: true,
    message: 'Explorer mission started.',
    mission: getClientMission(mission, now),
    tutorial: gameState.tutorial,
  };
}

function claimExplore(gameState, missionId, now = new Date()) {
  normalizeExploreState(gameState, now);
  const mission = (gameState.exploreMissions || []).find((item) => item.id === missionId);
  if (!mission) return { success: false, error: 'EXPLORE_MISSION_NOT_FOUND', message: 'Explorer mission not found.' };
  if (mission.status !== 'ready') return { success: false, error: 'EXPLORE_MISSION_NOT_READY', message: 'Explorer mission is not ready.' };
  gameState.exploreMissions = (gameState.exploreMissions || []).filter((item) => item.id !== mission.id);
  gameState.tutorial = advanceTutorialStep(gameState.tutorial, TUTORIAL_STEPS.scoutExploreClaimed);
  return {
    success: true,
    message: 'Explorer mission complete.',
    mission: getClientMission({ ...mission, claimedAt: now.toISOString() }, now),
    tutorial: gameState.tutorial,
  };
}

module.exports = {
  EXPLORE_STEP_DURATION_MS,
  DEFAULT_RANDOM_ROUTE_LENGTH,
  MAX_RANDOM_ROUTE_LENGTH,
  MAX_MANUAL_ROUTE_LENGTH,
  MAX_ACTIVE_EXPLORE_MISSIONS,
  EXPLORE_REVEAL_RADIUS,
  TUTORIAL_FIRST_SITE_GRANT_KEY,
  normalizeExploreState,
  advanceExploreMissions,
  startExplore,
  claimExplore,
  getClientState,
  buildRandomRoute,
  buildManualRoute,
  normalizeMission,
};
