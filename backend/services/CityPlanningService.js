const BuildingState = require('../domain/BuildingState');

const TERRAIN_DEFINITIONS = {
  plains: {
    id: 'plains',
    label: '平原',
    summary: '适合农业、民居扩张和均衡建设。',
    hint: '保持农田与民居配套，会让城市更容易稳定扩张。',
    farmHouseTarget: 1.6,
    productionTolerance: 0.38,
  },
  hills: {
    id: 'hills',
    label: '山地',
    summary: '适合防御、采掘和紧凑建设。',
    hint: '山地更能承受生产设施，但仍需要照顾居住空间。',
    farmHouseTarget: 1.1,
    productionTolerance: 0.58,
  },
  coast: {
    id: 'coast',
    label: '沿海',
    summary: '适合探索、贸易和人口流动。',
    hint: '沿海城市适合均衡规划，后续可承接探索与贸易建筑。',
    farmHouseTarget: 1.25,
    productionTolerance: 0.45,
  },
  forest: {
    id: 'forest',
    label: '森林',
    summary: '适合木材与早期工业，但居住环境需要平衡。',
    hint: '森林城市可以偏工业，但生产建筑过密会压缩生活空间。',
    farmHouseTarget: 1.2,
    productionTolerance: 0.62,
  },
  river: {
    id: 'river',
    label: '河谷',
    summary: '适合农业、知识交流和人口聚集。',
    hint: '河谷城市适合粮食与民居搭配，也能承接知识发展。',
    farmHouseTarget: 1.45,
    productionTolerance: 0.42,
  },
};

const DEFAULT_TERRAIN_ID = 'plains';
const VALID_TERRAIN_IDS = new Set(Object.keys(TERRAIN_DEFINITIONS));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeTerrainId(value) {
  const id = String(value || '').trim();
  return VALID_TERRAIN_IDS.has(id) ? id : DEFAULT_TERRAIN_ID;
}

function getTerrainDefinition(terrainId) {
  return TERRAIN_DEFINITIONS[normalizeTerrainId(terrainId)] || TERRAIN_DEFINITIONS[DEFAULT_TERRAIN_ID];
}

function nameIncludes(text, patterns) {
  const value = String(text || '');
  return patterns.some((pattern) => value.includes(pattern));
}

function inferTerrainId(rawCity = {}, territory = {}) {
  const hasPersistedPlanning = rawCity.planning && Object.keys(rawCity.planning).length > 0;
  if (hasPersistedPlanning && rawCity.terrain && VALID_TERRAIN_IDS.has(rawCity.terrain)) return rawCity.terrain;
  if (hasPersistedPlanning && rawCity.planning?.terrainId && VALID_TERRAIN_IDS.has(rawCity.planning.terrainId)) return rawCity.planning.terrainId;
  if (territory?.terrain && VALID_TERRAIN_IDS.has(territory.terrain)) return territory.terrain;
  if ((rawCity.id || territory?.id) === 'capital') return DEFAULT_TERRAIN_ID;

  const name = `${rawCity.name || ''}${territory?.cityName || ''}${territory?.naturalName || ''}`;
  if (nameIncludes(name, ['林', '森', '木', '猎'])) return 'forest';
  if (nameIncludes(name, ['山', '丘', '石', '岩', '岭'])) return 'hills';
  if (nameIncludes(name, ['海', '港', '湾岸', '潮'])) return 'coast';
  if (nameIncludes(name, ['河', '湾', '渡', '湖', '溪', '谷'])) return 'river';

  const type = territory?.type || '';
  if (type === 'camp') return 'forest';
  if (type === 'ruins') return 'hills';
  if (Math.abs(toNumber(territory?.x)) >= 2 && toNumber(territory?.y) > 0) return 'coast';
  return DEFAULT_TERRAIN_ID;
}

function getBuildingLevel(buildings = {}, buildingId) {
  return BuildingState.getLevel(buildings, buildingId);
}

function getHabitabilityLabel(score) {
  if (score >= 24) return { label: '舒展', tone: 'excellent' };
  if (score >= 8) return { label: '良好', tone: 'good' };
  if (score >= -7) return { label: '平稳', tone: 'neutral' };
  if (score >= -24) return { label: '紧张', tone: 'warning' };
  return { label: '拥挤', tone: 'danger' };
}

function calculateHabitability(city = {}, terrainId = DEFAULT_TERRAIN_ID) {
  const terrain = getTerrainDefinition(terrainId);
  const buildings = city.buildings || {};
  const house = getBuildingLevel(buildings, 'house');
  const farm = getBuildingLevel(buildings, 'farm');
  const lumbermill = getBuildingLevel(buildings, 'lumbermill');
  const barracks = getBuildingLevel(buildings, 'barracks');
  const watchtower = getBuildingLevel(buildings, 'watchtower');

  if (house <= 0) {
    return {
      score: 0,
      ...getHabitabilityLabel(0),
      summary: '城市还在萌芽阶段，先建立稳定居住空间。',
      notes: ['民居成形后，宜居度会开始体现城市规划质量。'],
    };
  }

  const notes = [];
  let score = 0;

  const farmRatio = farm / Math.max(1, house);
  const farmDelta = Math.abs(farmRatio - terrain.farmHouseTarget);
  score += clamp(18 - farmDelta * 18, -18, 18);
  if (farmRatio < terrain.farmHouseTarget * 0.65) notes.push('粮食配套偏少，民居扩张会更吃力。');
  else if (farmRatio > terrain.farmHouseTarget * 1.65) notes.push('农业空间充足，但也要留出生活与生产余地。');
  else notes.push('居住与粮食配套较协调。');

  const productionRatio = (lumbermill + watchtower * 0.5) / Math.max(1, house);
  if (productionRatio <= terrain.productionTolerance) {
    score += 8;
    if (lumbermill || watchtower) notes.push('生产设施密度仍在可承受范围内。');
  } else {
    const pressure = productionRatio - terrain.productionTolerance;
    score -= clamp(pressure * 22, 0, 18);
    notes.push('生产设施开始挤压居住环境。');
  }

  const barracksRatio = barracks / Math.max(1, house);
  if (barracks > 0 && house >= 2 && barracksRatio <= 0.45) {
    score += 5;
    notes.push('军事设施带来安全感，没有明显压迫生活区。');
  } else if (barracksRatio > 0.45) {
    score -= 10;
    notes.push('军事设施偏密，城市生活氛围会变紧张。');
  }

  if (house >= 2 && farm >= 2 && lumbermill >= 1) score += 5;
  if (house >= 3 && farm <= 1) score -= 8;

  const finalScore = Math.round(clamp(score, -50, 50));
  const label = getHabitabilityLabel(finalScore);
  return {
    score: finalScore,
    ...label,
    summary: `${terrain.label}城市规划${label.label}，会影响人口成长速度。`,
    notes: notes.slice(0, 3),
  };
}

function applyPlanningToCity(city = {}, gameState = {}) {
  const territory = (gameState.territories || []).find((item) => (
    item.id === city.territoryId || item.id === city.id
  )) || null;
  const terrain = getTerrainDefinition(inferTerrainId(city, territory));
  const habitability = calculateHabitability(city, terrain.id);
  const planning = {
    terrainId: terrain.id,
    terrainLabel: terrain.label,
    terrainSummary: terrain.summary,
    terrainHint: terrain.hint,
    habitability: habitability.score,
    habitabilityLabel: habitability.label,
    habitabilityTone: habitability.tone,
    habitabilitySummary: habitability.summary,
    habitabilityNotes: habitability.notes,
  };

  city.terrain = terrain.id;
  city.terrainLabel = terrain.label;
  city.habitability = habitability.score;
  city.habitabilityLabel = habitability.label;
  city.planning = planning;
  return planning;
}

function getClientPlanning(city = {}) {
  const terrain = getTerrainDefinition(city.planning?.terrainId || city.terrain);
  const habitability = Number.isFinite(city.habitability)
    ? city.habitability
    : toNumber(city.planning?.habitability, 0);
  const label = city.planning?.habitabilityLabel || city.habitabilityLabel || getHabitabilityLabel(habitability).label;
  return {
    terrainId: terrain.id,
    terrainLabel: city.planning?.terrainLabel || city.terrainLabel || terrain.label,
    terrainSummary: city.planning?.terrainSummary || terrain.summary,
    terrainHint: city.planning?.terrainHint || terrain.hint,
    habitability,
    habitabilityLabel: label,
    habitabilityTone: city.planning?.habitabilityTone || getHabitabilityLabel(habitability).tone,
    habitabilitySummary: city.planning?.habitabilitySummary || `${terrain.label}城市规划${label}`,
    habitabilityNotes: Array.isArray(city.planning?.habitabilityNotes) ? city.planning.habitabilityNotes : [],
  };
}

module.exports = {
  TERRAIN_DEFINITIONS,
  normalizeTerrainId,
  inferTerrainId,
  getTerrainDefinition,
  calculateHabitability,
  applyPlanningToCity,
  getClientPlanning,
};
