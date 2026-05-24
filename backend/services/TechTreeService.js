const {
  TECH_POINT_GRANTS,
  TECH_CHOICE_LIMITS,
  TECH_ERAS,
  TECHS,
  TECH_BY_ID,
  RESOURCE_LABELS,
  BUILDING_LABELS,
} = require('../config/TechTreeConfig');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTechState(raw = {}) {
  const legacyCompleted = {};
  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([key, value]) => {
      if (['points', 'researched', 'eraChoices', 'grants'].includes(key)) return;
      if (value === true || value?.status === 'completed') legacyCompleted[key] = true;
    });
  }

  const researched = {
    ...(raw?.researched && typeof raw.researched === 'object' ? raw.researched : {}),
    ...legacyCompleted,
  };
  const eraChoices = raw?.eraChoices && typeof raw.eraChoices === 'object' ? { ...raw.eraChoices } : {};
  Object.keys(researched).forEach((techId) => {
    const tech = TECH_BY_ID[techId];
    if (!tech) return;
    const eraKey = String(tech.era);
    const existing = Array.isArray(eraChoices[eraKey])
      ? eraChoices[eraKey]
      : (eraChoices[eraKey] ? [eraChoices[eraKey]] : []);
    if (!existing.includes(techId)) eraChoices[eraKey] = [...existing, techId];
  });

  return {
    points: Math.max(0, Math.floor(Number(raw?.points) || 0)),
    researched,
    eraChoices,
    grants: raw?.grants && typeof raw.grants === 'object' ? { ...raw.grants } : {},
  };
}

function normalizeGameStateTechs(gameState) {
  const normalized = normalizeTechState(gameState?.techs || {});
  if (gameState && typeof gameState === 'object') gameState.techs = normalized;
  return normalized;
}

function getChoiceLimit(era) {
  return Math.max(1, Number(TECH_CHOICE_LIMITS[era]) || 1);
}

function getEraChoices(techs, era) {
  const value = techs.eraChoices?.[String(era)];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function getGrantForEra(era) {
  return Math.max(0, Number(TECH_POINT_GRANTS[era]) || 0);
}

function grantEraPoints(gameState, era) {
  const techs = normalizeGameStateTechs(gameState);
  const key = String(era);
  if (techs.grants[key]) {
    return { granted: 0, points: techs.points };
  }
  const granted = getGrantForEra(era);
  techs.grants[key] = {
    points: granted,
    grantedAt: new Date().toISOString(),
  };
  techs.points += granted;
  return { granted, points: techs.points };
}

function grantEarnedEraPoints(gameState) {
  const currentEra = Math.max(0, Math.floor(Number(gameState?.currentEra) || 0));
  let totalGranted = 0;
  for (let era = 1; era <= currentEra; era += 1) {
    totalGranted += grantEraPoints(gameState, era).granted;
  }
  return { granted: totalGranted, points: gameState.techs?.points || 0 };
}

function getResearchedIds(gameStateOrTechs = {}) {
  const techs = gameStateOrTechs.techs
    ? normalizeTechState(gameStateOrTechs.techs)
    : normalizeTechState(gameStateOrTechs);
  return Object.keys(techs.researched || {}).filter((techId) => Boolean(techs.researched[techId]));
}

function getUnlockedBuildings(gameStateOrTechs = {}) {
  return Array.from(new Set(getResearchedIds(gameStateOrTechs).flatMap((techId) => (
    TECH_BY_ID[techId]?.effects?.unlockedBuildings || []
  ))));
}

function getMissingParents(tech, techs) {
  const parents = Array.isArray(tech?.parents) ? tech.parents.filter(Boolean) : [];
  if (!parents.length) return [];
  const researched = techs?.researched || {};
  return parents.filter((parentId) => !researched[parentId]);
}

function hasRequiredParent(tech, techs) {
  const parents = Array.isArray(tech?.parents) ? tech.parents.filter(Boolean) : [];
  if (!parents.length) return true;
  const researched = techs?.researched || {};
  return parents.some((parentId) => Boolean(researched[parentId]));
}

function formatResourceEntrances(resources = []) {
  return resources.map((key) => RESOURCE_LABELS[key] || key).join('、') || '无';
}

function formatBuildingUnlocks(buildings = []) {
  return buildings.map((key) => BUILDING_LABELS[key] || key).join('、') || '';
}

function getTechStatus(tech, techs, currentEra) {
  if (techs.researched?.[tech.id]) return 'researched';
  if (tech.era > currentEra) return 'locked';
  if (getEraChoices(techs, tech.era).length >= getChoiceLimit(tech.era)) return 'eraChoiceFull';
  if (!hasRequiredParent(tech, techs)) return 'missingPrerequisite';
  if ((techs.points || 0) <= 0) return 'noPoints';
  return 'available';
}

function buildClientTech(tech, techs, currentEra) {
  const canonicalTech = TECH_BY_ID[tech.id] || tech;
  const status = getTechStatus({ ...canonicalTech, era: tech.era }, techs, currentEra);
  const unlockedBuildings = canonicalTech.effects?.unlockedBuildings || tech.effects?.unlockedBuildings || [];
  const resourceEntrances = canonicalTech.effects?.resourceEntrances || tech.effects?.resourceEntrances || [];
  const parents = Array.isArray(canonicalTech.parents) ? canonicalTech.parents : [];
  const missingParents = getMissingParents({ ...canonicalTech, parents }, techs);
  return {
    id: tech.id,
    era: tech.era,
    eraName: tech.eraName,
    name: tech.name,
    route: tech.route,
    routeLabel: tech.routeLabel,
    summary: tech.summary,
    core: tech.core,
    tree: clone(canonicalTech.tree || { column: tech.era, lane: 0, parents }),
    parents: [...parents],
    missingParents,
    parentNames: parents.map((parentId) => TECH_BY_ID[parentId]?.name || parentId),
    missingParentNames: missingParents.map((parentId) => TECH_BY_ID[parentId]?.name || parentId),
    status,
    researched: status === 'researched',
    available: status === 'available',
    disabled: status !== 'available',
    resourceEntrances,
    unlockedBuildings,
    resourceText: formatResourceEntrances(resourceEntrances),
    unlockText: formatBuildingUnlocks(unlockedBuildings),
  };
}

function getClientState(gameState = {}) {
  const techs = normalizeGameStateTechs(gameState);
  const currentEra = Math.max(0, Math.floor(Number(gameState.currentEra) || 0));
  const eras = TECH_ERAS
    .map((eraConfig) => {
      const choices = getEraChoices(techs, eraConfig.era);
      const limit = getChoiceLimit(eraConfig.era);
      return {
        era: eraConfig.era,
        name: eraConfig.name,
        summary: eraConfig.summary,
        choiceLimit: limit,
        choicesUsed: choices.length,
        closed: choices.length >= limit,
        techs: eraConfig.techs.map((tech) => buildClientTech(
          { ...tech, era: eraConfig.era, eraName: eraConfig.name },
          techs,
          currentEra,
        )),
      };
    });
  const researchedIds = getResearchedIds(techs);
  return {
    points: techs.points,
    researched: { ...techs.researched },
    researchedIds,
    researchedCount: researchedIds.length,
    eraChoices: clone(techs.eraChoices),
    grants: clone(techs.grants),
    unlockedBuildings: getUnlockedBuildings(techs),
    eras,
  };
}

function research(gameState, techId) {
  const tech = TECH_BY_ID[techId];
  if (!tech) return { success: false, error: 'TECH_NOT_FOUND', message: '科技不存在' };
  const techs = normalizeGameStateTechs(gameState);
  const currentEra = Math.max(0, Math.floor(Number(gameState.currentEra) || 0));
  if (tech.era > currentEra) return { success: false, error: 'TECH_LOCKED', message: '时代尚未解锁这项科技' };
  if (techs.researched[techId]) return { success: false, error: 'TECH_RESEARCHED', message: '这项科技已经研究完成' };
  const choices = getEraChoices(techs, tech.era);
  if (choices.length >= getChoiceLimit(tech.era)) {
    return { success: false, error: 'TECH_ERA_CHOICE_FULL', message: '这个时代的科技选择已经确定' };
  }
  if (!hasRequiredParent(tech, techs)) {
    return {
      success: false,
      error: 'TECH_PREREQUISITE_MISSING',
      message: '需要先研究前置科技',
      missingParents: getMissingParents(tech, techs),
    };
  }
  if (techs.points <= 0) return { success: false, error: 'TECH_POINTS_INSUFFICIENT', message: '科技点不足' };

  techs.points -= 1;
  techs.researched[techId] = {
    id: techId,
    completedAt: new Date().toISOString(),
  };
  techs.eraChoices[String(tech.era)] = [...choices, techId];

  return {
    success: true,
    message: `已研究：${tech.name}`,
    techId,
    tech: buildClientTech(tech, techs, currentEra),
    techs: getClientState(gameState),
  };
}

module.exports = {
  normalizeTechState,
  normalizeGameStateTechs,
  grantEraPoints,
  grantEarnedEraPoints,
  getClientState,
  getResearchedIds,
  getUnlockedBuildings,
  research,
};
