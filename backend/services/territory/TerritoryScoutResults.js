const {
  DIRECTIONS,
  SCOUT_SITE_BASE_CHANCE,
  SCOUT_SITE_CHANCE_STEP,
  SCOUT_SITE_GUARANTEE_AFTER,
  SITE_ART,
  SITE_TEMPLATES,
  SOLDIER_SCALE,
} = require('./TerritoryConstants');
const {
  createVisualOffset,
  seededNoise,
} = require('./TerritoryVisuals');
const {
  clone,
  getCoordinateKey,
  getPlanningTerrainForMapTerrain,
  getRelativeDistance,
  normalizeMapTerrainId,
  toInteger,
} = require('./TerritoryShared');

function createTerritoryScoutResults(dependencies = {}) {
  const {
    WorldMapService,
    ensureMissionRevealArea,
    getScoutCoordinateRecord,
    getScoutResolvedCoordinate,
    getSiteSpacingProfile,
    normalizeGarrison,
    normalizeScoutReport,
    normalizeScoutState,
  } = dependencies;

  function getScoutReportRevealAreaSnapshot(gameState, mission, now = new Date()) {
    return ensureMissionRevealArea(gameState, mission, now)
      .map((coord) => {
        const q = toInteger(coord.q, 0);
        const r = toInteger(coord.r, 0);
        return {
          q,
          r,
          step: Math.max(0, toInteger(coord.step, 0)),
          kind: coord.kind === 'branch' ? 'branch' : 'main',
          tileId: coord.tileId || WorldMapService.getTileId(q, r),
          revealed: coord.revealed !== false,
        };
      });
  }

  function getScoutReportTileSnapshot(gameState, mission, now = new Date(), options = {}) {
    const resolved = getScoutResolvedCoordinate(mission);
    const x = toInteger(options.x, resolved.x);
    const y = toInteger(options.y, resolved.y);
    const worldMap = WorldMapService.ensureWorldMap(gameState, now);
    const tileId = WorldMapService.getTileId(x, y);
    const tile = (worldMap.tiles || []).find((item) => item.id === tileId || (item.q === x && item.r === y)) || null;
    const mapTerrain = normalizeMapTerrainId(options.mapTerrain)
      || normalizeMapTerrainId(tile?.terrain)
      || WorldMapService.chooseTerrain(worldMap.seed, x, y);
    const terrain = getPlanningTerrainForMapTerrain(options.terrain || mapTerrain);
    return {
      tileId,
      q: x,
      r: y,
      mapTerrain,
      terrain,
      tile: {
        id: tileId,
        q: x,
        r: y,
        terrain: mapTerrain,
      },
    };
  }

  function attachScoutReportMapSnapshot(gameState, mission, report, now = new Date(), options = {}) {
    if (!report || typeof report !== 'object') return report;
    const tileSnapshot = getScoutReportTileSnapshot(gameState, mission, now, options);
    return normalizeScoutReport({
      ...report,
      ...tileSnapshot,
      revealArea: getScoutReportRevealAreaSnapshot(gameState, mission, now),
    });
  }

  function getScoutCandidateCoordinates(gameState, mission, now = new Date()) {
    const worldMap = WorldMapService.ensureWorldMap(gameState, now);
    const targetX = toInteger(mission.targetX, 0);
    const targetY = toInteger(mission.targetY, 0);
    const revealedIds = new Set(Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds.filter(Boolean) : []);
    const strictRevealArea = mission.revealAreaSource === 'directional-route-v1';
    const revealArea = ensureMissionRevealArea(gameState, mission, now);
    const coords = [];
    const known = new Set();
    const addCoord = (q, r) => {
      const key = getCoordinateKey(q, r);
      if (known.has(key)) return;
      known.add(key);
      coords.push({ q, r });
    };

    for (const tile of worldMap.tiles || []) {
      if (revealedIds.has(tile.id)) {
        addCoord(toInteger(tile.q, 0), toInteger(tile.r, 0));
        continue;
      }
      if (strictRevealArea) continue;
      const q = toInteger(tile.q, 0);
      const r = toInteger(tile.r, 0);
      if (getRelativeDistance(targetX, targetY, q, r) > 1) continue;
      addCoord(toInteger(tile.q, 0), toInteger(tile.r, 0));
    }
    for (const coord of revealArea) {
      if (coord.revealed || revealedIds.has(WorldMapService.getTileId(coord.q, coord.r))) {
        addCoord(coord.q, coord.r);
      }
    }
    if (!coords.length) addCoord(targetX, targetY);
    return coords;
  }

  function getDirectionProgressScore(mission, q, r) {
    const dir = DIRECTIONS[mission.direction];
    if (!dir) return 0;
    const originX = toInteger(mission.originX, 0);
    const originY = toInteger(mission.originY, 0);
    const targetX = toInteger(mission.targetX, 0);
    const targetY = toInteger(mission.targetY, 0);
    const targetProjection = (targetX - originX) * dir.dx + (targetY - originY) * dir.dy;
    const projection = (q - originX) * dir.dx + (r - originY) * dir.dy;
    if (targetProjection <= 0) return 0;
    return Math.max(0, Math.min(1, projection / targetProjection));
  }

  function getTerrainSiteScore(terrain) {
    if (terrain === 'plains') return 7;
    if (terrain === 'forest') return 6;
    if (terrain === 'hills') return 6;
    if (terrain === 'desert') return 4;
    if (terrain === 'waste') return 3;
    if (terrain === 'mountain') return 1;
    return 0;
  }

  function scoreScoutSiteCandidate(gameState, mission, coord, seed) {
    const q = toInteger(coord.q, 0);
    const r = toInteger(coord.r, 0);
    if (getScoutCoordinateRecord(gameState, q, r)) return null;
    if (!WorldMapService.canPlaceSiteOnTerrain(seed, q, r)) return null;
    const spacing = getSiteSpacingProfile(gameState, q, r);
    if (!spacing.valid) return null;
    const terrain = WorldMapService.chooseTerrain(seed, q, r);
    const originX = toInteger(mission.originX, 0);
    const originY = toInteger(mission.originY, 0);
    const targetX = toInteger(mission.targetX, 0);
    const targetY = toInteger(mission.targetY, 0);
    const distance = Math.max(1, getRelativeDistance(originX, originY, q, r));
    const targetDistance = Math.max(1, getRelativeDistance(originX, originY, targetX, targetY));
    const targetCloseness = Math.max(0, 3 - getRelativeDistance(targetX, targetY, q, r));
    const directionProgress = getDirectionProgressScore(mission, q, r);
    const terrainScore = getTerrainSiteScore(terrain);
    const stableNoise = seededNoise(Math.abs(q * 92821 + r * 68917 + String(seed).length * 131));
    return {
      q,
      r,
      terrain,
      distance,
      nearestSiteDistance: spacing.nearestDistance,
      spacingScore: spacing.score,
      score:
        terrainScore * 10
        + Math.min(distance, targetDistance + 2) * 2
        + targetCloseness * 5
        + directionProgress * 8
        + spacing.score
        + stableNoise,
    };
  }

  function pickScoutSiteCoordinate(gameState, mission, now = new Date()) {
    const seed = WorldMapService.ensureWorldMap(gameState, now).seed;
    return getScoutCandidateCoordinates(gameState, mission, now)
      .map((coord) => scoreScoutSiteCandidate(gameState, mission, coord, seed))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || b.distance - a.distance || a.q - b.q || a.r - b.r)[0] || null;
  }

  function rollScoutOutcome(gameState, randomSource = Math.random) {
    gameState.scoutState = normalizeScoutState(gameState.scoutState);
    const emptyStreak = Math.max(0, Number(gameState.scoutState.emptyStreak) || 0);
    if (emptyStreak >= SCOUT_SITE_GUARANTEE_AFTER) {
      return 'site';
    }
    const roll = rollUnit(randomSource);
    const siteChance = Math.min(1, SCOUT_SITE_BASE_CHANCE + emptyStreak * SCOUT_SITE_CHANCE_STEP);
    return roll < siteChance ? 'site' : 'empty';
  }

  function recordScoutOutcome(gameState, outcome) {
    gameState.scoutState = normalizeScoutState(gameState.scoutState);
    gameState.scoutState.emptyStreak = outcome === 'empty'
      ? (gameState.scoutState.emptyStreak || 0) + 1
      : 0;
    return gameState.scoutState.emptyStreak;
  }

  function recordDiscoveredSiteOwnership(gameState, owner) {
    gameState.scoutState = normalizeScoutState(gameState.scoutState);
    gameState.scoutState.neutralSiteStreak = owner === 'neutral'
      ? (gameState.scoutState.neutralSiteStreak || 0) + 1
      : 0;
    return gameState.scoutState.neutralSiteStreak;
  }

  function pickText(items, seed) {
    return items[Math.abs(seed) % items.length];
  }

  function rollUnit(randomSource = Math.random) {
    return Math.max(0, Math.min(0.999999, Number(typeof randomSource === 'function' ? randomSource() : Math.random()) || 0));
  }

  function getOwnedSiteChance(distance, neutralSiteStreak = 0) {
    const streak = Math.max(0, Number(neutralSiteStreak) || 0);
    const base = distance <= 1
      ? 0.24
      : distance === 2
        ? 0.58
        : Math.min(0.88, 0.72 + Math.max(0, distance - 3) * 0.06);
    if (streak >= 3) return 1;
    return Math.min(1, base + streak * 0.12);
  }

  function getTemplateDistanceWeight(template, distance) {
    if (template.type === 'outpost') return distance <= 2 ? 3 : 1.5;
    if (template.type === 'town') return distance <= 1 ? 1.5 : distance <= 4 ? 3 : 2;
    if (template.type === 'camp') return distance <= 1 ? 2.5 : distance <= 4 ? 3 : 2;
    if (template.type === 'city') return distance <= 1 ? 0.5 : distance <= 3 ? 2.5 : 3.5;
    if (template.type === 'ruins') return distance <= 1 ? 0.25 : distance <= 3 ? 2.5 : 4;
    return 1;
  }

  function getTemplateTerrainWeight(template, terrain) {
    const weights = template.terrainWeights || {};
    return Math.max(0.1, Number(weights[terrain]) || 0.1);
  }

  function pickWeightedTemplate(pool, terrain, distance, randomSource = Math.random) {
    const weighted = pool.map((template) => ({
      template,
      weight: getTemplateTerrainWeight(template, terrain) * getTemplateDistanceWeight(template, distance),
    }));
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    let cursor = rollUnit(randomSource) * totalWeight;
    for (const item of weighted) {
      cursor -= item.weight;
      if (cursor <= 0) return item.template;
    }
    return weighted.at(-1)?.template || pool[0];
  }

  function pickTemplateForScoutSite(options = {}) {
    const distance = Math.max(1, toInteger(options.distance, 1));
    const terrain = typeof options.terrain === 'string' && options.terrain ? options.terrain : 'plains';
    const neutralSiteStreak = Math.max(0, toInteger(options.neutralSiteStreak, 0));
    const randomSource = options.randomSource || Math.random;
    const neutralPool = [SITE_TEMPLATES[0], SITE_TEMPLATES[1]];
    const ownedPool = distance <= 1
      ? [SITE_TEMPLATES[2]]
      : [SITE_TEMPLATES[2], SITE_TEMPLATES[3], SITE_TEMPLATES[4]];
    const isOwned = rollUnit(randomSource) < getOwnedSiteChance(distance, neutralSiteStreak);
    const pool = isOwned ? ownedPool : neutralPool;
    return pickWeightedTemplate(pool, terrain, distance, randomSource);
  }

  function getSiteEffects(template, distance) {
    const effects = clone(template.effects || {});
    if (effects.foodOutputMultiplier) effects.foodOutputMultiplier = Math.round((effects.foodOutputMultiplier + Math.max(0, distance - 1) * 0.01) * 100) / 100;
    if (effects.woodOutputMultiplier) effects.woodOutputMultiplier = Math.round((effects.woodOutputMultiplier + Math.max(0, distance - 1) * 0.01) * 100) / 100;
    if (effects.knowledgeOutputMultiplier) effects.knowledgeOutputMultiplier = Math.round((effects.knowledgeOutputMultiplier + Math.max(0, distance - 1) * 0.01) * 100) / 100;
    if (effects.threatDefense) effects.threatDefense += Math.max(0, Math.floor((distance - 1) / 2));
    return effects;
  }

  function createSiteFromScout(gameState, mission, now = new Date(), randomSource = Math.random) {
    const direction = mission.direction;
    const resolvedCoord = getScoutResolvedCoordinate(mission);
    const x = resolvedCoord.x;
    const y = resolvedCoord.y;
    const originX = toInteger(mission.originX, 0);
    const originY = toInteger(mission.originY, 0);
    const distance = Math.max(1, toInteger(mission.scoutDistance, getRelativeDistance(originX, originY, x, y)));
    const originName = mission.originName || '\u51fa\u53d1\u57ce\u5e02';
    const discoveredCount = (gameState.territories || []).length;
    const terrain = mission.siteTerrain
      || WorldMapService.chooseTerrain(WorldMapService.ensureWorldMap(gameState, now).seed, x, y);
    const template = pickTemplateForScoutSite({
      terrain,
      distance,
      neutralSiteStreak: gameState.scoutState?.neutralSiteStreak || 0,
      randomSource,
    });
    const seed = Math.abs(x * 31 + y * 17 + discoveredCount * 13 + Object.keys(DIRECTIONS).indexOf(direction));
    const naturalName = pickText(template.naturalNames, seed);
    const title = pickText(template.reportTitles, seed + 1);
    const summary = pickText(template.summaries, seed + 2);
    const defense = template.defense + Math.max(0, distance - 1) * SOLDIER_SCALE;
    const site = {
      id: `site_${x}_${y}`,
      x,
      y,
      naturalName,
      cityName: null,
      type: template.type,
      terrain: getPlanningTerrainForMapTerrain(terrain),
      mapTerrain: normalizeMapTerrainId(terrain) || terrain,
      owner: template.owner,
      status: 'discovered',
      scale: Math.min(3, template.scale + Math.floor(Math.max(0, distance - 2) / 2)),
      threat: template.threat + Math.max(0, distance - 1),
      defense,
      recommendedSoldiers: Math.max(defense, template.recommendedSoldiers + Math.max(0, distance - 1) * SOLDIER_SCALE),
      art: SITE_ART[template.type],
      visualOffset: createVisualOffset(x, y, `${template.type}_${naturalName}_${discoveredCount}`),
      discoveredAt: now.toISOString(),
      occupiedAt: null,
      effects: getSiteEffects(template, distance),
      summary,
      lastBattle: null,
      garrison: null,
    };
    site.garrison = normalizeGarrison(null, site, now.toISOString());
    site.defenderLeader = site.garrison?.leader || null;
    const label = DIRECTIONS[direction]?.label || '\u8fdc\u65b9';
    const report = {
      id: `report_${site.id}_${now.getTime()}`,
      siteId: site.id,
      title,
      text: `\u4fa6\u5bdf\u961f\u4ece${originName}\u5411${label}\u63a8\u8fdb\uff0c\u5728\u8ddd\u79bb\u51fa\u53d1\u57ce\u5e02 ${distance} \u683c\u7684\u4f4d\u7f6e\u53d1\u73b0\u4e86${naturalName}\u3002${summary}`,
      direction,
      createdAt: now.toISOString(),
    };
    return {
      site,
      report: attachScoutReportMapSnapshot(gameState, mission, report, now, {
        x,
        y,
        mapTerrain: site.mapTerrain,
        terrain: site.terrain,
      }),
    };
  }

  function createEmptyScoutReport(gameState, mission, now = new Date(), repeated = false) {
    const direction = mission.direction;
    const resolvedCoord = getScoutResolvedCoordinate(mission);
    const x = resolvedCoord.x;
    const y = resolvedCoord.y;
    const originX = toInteger(mission.originX, 0);
    const originY = toInteger(mission.originY, 0);
    const distance = Math.max(1, toInteger(mission.scoutDistance, getRelativeDistance(originX, originY, x, y)));
    const originName = mission.originName || '\u51fa\u53d1\u57ce\u5e02';
    const label = DIRECTIONS[direction]?.label || '\u8fdc\u65b9';
    const report = {
      id: `report_empty_${x}_${y}_${now.getTime()}`,
      siteId: null,
      title: repeated ? '\u91cd\u590d\u4fa6\u5bdf\u786e\u8ba4\u7a7a\u5730' : '\u7a7a\u5730\u4fa6\u5bdf\u62a5\u544a',
      text: repeated
        ? `\u4fa6\u5bdf\u961f\u518d\u6b21\u786e\u8ba4${originName}${label}\u65b9\u5411\u3001\u8ddd\u79bb\u51fa\u53d1\u57ce\u5e02 ${distance} \u683c\u7684\u4f4d\u7f6e\u6682\u65e0\u53ef\u5360\u9886\u5730\u70b9\u3002`
        : `\u4fa6\u5bdf\u961f\u4ece${originName}\u5411${label}\u63a8\u8fdb\uff0c\u5728\u8ddd\u79bb\u51fa\u53d1\u57ce\u5e02 ${distance} \u683c\u7684\u4f4d\u7f6e\u672a\u53d1\u73b0\u53ef\u5efa\u7acb\u636e\u70b9\u6216\u5360\u9886\u7684\u76ee\u6807\u3002`,
      direction,
      createdAt: now.toISOString(),
    };
    return attachScoutReportMapSnapshot(gameState, mission, report, now, { x, y });
  }

  return {
    attachScoutReportMapSnapshot,
    createEmptyScoutReport,
    createSiteFromScout,
    getDirectionProgressScore,
    getOwnedSiteChance,
    getScoutCandidateCoordinates,
    getScoutReportRevealAreaSnapshot,
    getScoutReportTileSnapshot,
    getSiteEffects,
    getTerrainSiteScore,
    pickScoutSiteCoordinate,
    pickTemplateForScoutSite,
    pickWeightedTemplate,
    recordDiscoveredSiteOwnership,
    recordScoutOutcome,
    rollScoutOutcome,
    scoreScoutSiteCandidate,
  };
}

module.exports = createTerritoryScoutResults;
