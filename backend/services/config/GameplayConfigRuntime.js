const ConfigReleaseService = require('./ConfigReleaseService');
const ConfigRuntimeLoader = require('./ConfigRuntimeLoader');

const FallbackGameConfig = require('../../config/GameConfig');
const FallbackBuildingConfig = require('../../config/BuildingConfig');
const FallbackEraConfig = require('../../config/EraConfig');
const FallbackTutorialFlowConfig = require('../../config/TutorialFlowConfig');
const FallbackTechTreeConfig = require('../../config/TechTreeConfig');
const SharedTutorialFlowConfig = require('../../../shared/tutorialFlowConfig');
const { clone } = require('../../../shared/objectUtils');

const GAMEPLAY_CONFIG_RUNTIME_SCHEMA = 'gameplay-config-runtime-v1';

let runtimeOptions = {};
let initialized = false;
let runtimeBundle = null;
let runtimeStatus = null;

function toLevel(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

function getConfiguredMaxLevel(building) {
  return Math.max(1, toLevel(building?.maxLevel || 1));
}

function isOpenEndedScale(building) {
  return Boolean(building?.scalePlan?.openEnded);
}

function getCostGrowth(building) {
  const growth = Number(building?.scalePlan?.costGrowth);
  return Number.isFinite(growth) && growth > 1 ? growth : 1.15;
}

function roundGeneratedCost(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  if (number < 20) return Math.ceil(number);
  if (number < 100) return Math.ceil(number / 5) * 5;
  if (number < 1000) return Math.ceil(number / 10) * 10;
  return Math.ceil(number / 50) * 50;
}

function scaleCost(cost = {}, growth = 1.15, steps = 1) {
  const multiplier = Math.pow(growth, Math.max(1, toLevel(steps)));
  const next = {};
  for (const [resource, amount] of Object.entries(cost || {})) {
    const rounded = roundGeneratedCost(Number(amount) * multiplier);
    if (rounded > 0) next[resource] = rounded;
  }
  return Object.keys(next).length ? next : null;
}

function roundEffectBonus(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 1_000_000) / 1_000_000;
}

function hasRuntimeBundle() {
  return Boolean(runtimeBundle?.success && runtimeBundle.payloadIncluded && runtimeBundle.payload);
}

function getRuntimePayload(registryId) {
  if (!hasRuntimeBundle()) return null;
  return runtimeBundle.payload[registryId] || null;
}

function buildFallbackStatus(extra = {}) {
  return {
    schema: GAMEPLAY_CONFIG_RUNTIME_SCHEMA,
    initialized: true,
    source: 'module-fallback',
    release: null,
    bundleReady: false,
    payloadIncluded: false,
    registryCount: 0,
    errors: [],
    warnings: [],
    ...extra,
  };
}

function initializeRuntimeConfig(options = {}) {
  runtimeOptions = {
    ...runtimeOptions,
    ...options,
  };
  const policy = ConfigReleaseService.resolveRuntimeGatePolicy(runtimeOptions.env || process.env, runtimeOptions);
  const loaderStatus = ConfigRuntimeLoader.getRuntimeLoaderStatus(runtimeOptions);

  if (!loaderStatus.ready) {
    if (policy.required) {
      const error = new Error(loaderStatus.errors?.[0] || 'Gameplay config runtime bundle is not ready.');
      error.code = 'GAMEPLAY_CONFIG_RUNTIME_NOT_READY';
      error.loaderStatus = loaderStatus;
      throw error;
    }
    runtimeBundle = null;
    runtimeStatus = buildFallbackStatus({
      loaderStatus,
      warnings: loaderStatus.warnings || [],
    });
    initialized = true;
    return runtimeStatus;
  }

  const bundle = ConfigRuntimeLoader.buildRuntimeBundle(runtimeOptions);
  if (!bundle.success) {
    if (policy.required) {
      const error = new Error(bundle.errors?.[0] || 'Gameplay config runtime bundle failed validation.');
      error.code = 'GAMEPLAY_CONFIG_RUNTIME_INVALID';
      error.bundle = bundle;
      throw error;
    }
    runtimeBundle = null;
    runtimeStatus = buildFallbackStatus({
      loaderStatus,
      errors: bundle.errors || [],
      warnings: bundle.warnings || [],
    });
    initialized = true;
    return runtimeStatus;
  }

  runtimeBundle = bundle;
  runtimeStatus = {
    schema: GAMEPLAY_CONFIG_RUNTIME_SCHEMA,
    initialized: true,
    source: 'active-release-bundle',
    release: bundle.release,
    bundleReady: true,
    payloadIncluded: true,
    registryCount: bundle.registries.length,
    errors: bundle.errors,
    warnings: bundle.warnings,
  };
  initialized = true;
  return runtimeStatus;
}

function ensureInitialized() {
  if (!initialized) initializeRuntimeConfig(runtimeOptions);
}

function configureRuntimeConfig(options = {}) {
  runtimeOptions = {
    ...runtimeOptions,
    ...options,
  };
  initialized = false;
  runtimeBundle = null;
  runtimeStatus = null;
}

function resetRuntimeConfig() {
  runtimeOptions = {};
  initialized = false;
  runtimeBundle = null;
  runtimeStatus = null;
}

function getRuntimeConfigStatus() {
  ensureInitialized();
  return runtimeStatus || buildFallbackStatus({ initialized: false });
}

function getGamePayload() {
  ensureInitialized();
  return getRuntimePayload('game-config') || FallbackGameConfig.raw();
}

function getBuildingPayload() {
  ensureInitialized();
  return getRuntimePayload('building-config') || FallbackBuildingConfig.raw();
}

function getEraPayload() {
  ensureInitialized();
  return getRuntimePayload('era-config') || FallbackEraConfig.raw();
}

function getTutorialPayload() {
  ensureInitialized();
  return getRuntimePayload('tutorial-flow-config') || FallbackTutorialFlowConfig.raw();
}

function getTechPayload() {
  ensureInitialized();
  return getRuntimePayload('tech-tree-config') || FallbackTechTreeConfig.raw();
}

function getTaskDefinitionsPayload() {
  ensureInitialized();
  const payload = getRuntimePayload('task-definitions');
  return payload ? clone(payload) : null;
}

const GameConfig = {
  get resources() {
    return getGamePayload().resources || {};
  },
  get population() {
    return getGamePayload().population || {};
  },
  raw() {
    return clone(getGamePayload());
  },
  getVersion() {
    return getRuntimePayload('game-config') ? getRuntimePayload('game-config').version || null : FallbackGameConfig.getVersion();
  },
  getSourcePath() {
    return getRuntimePayload('game-config') ? 'active-release-bundle:game-config' : FallbackGameConfig.getSourcePath();
  },
};

const BuildingConfig = {
  raw() {
    return clone(getBuildingPayload());
  },
  getVersion() {
    return getBuildingPayload().version || FallbackBuildingConfig.getVersion();
  },
  getSourcePath() {
    return getRuntimePayload('building-config') ? 'active-release-bundle:building-config' : FallbackBuildingConfig.getSourcePath();
  },
  getAllBuildings() {
    return getBuildingPayload().buildings || {};
  },
  getBuilding(buildingId) {
    return this.getAllBuildings()[buildingId] || null;
  },
  hasBuilding(buildingId) {
    return Boolean(this.getBuilding(buildingId));
  },
  getBuildCost(buildingId) {
    return { ...(this.getBuilding(buildingId)?.buildCost || {}) };
  },
  getUpgradeCost(buildingId, currentLevel) {
    const building = this.getBuilding(buildingId);
    if (!building) return null;
    const level = toLevel(currentLevel);
    if (level <= 0) return null;
    const upgradeCosts = Array.isArray(building.upgradeCosts) ? building.upgradeCosts : [];
    const configured = upgradeCosts[level - 1];
    if (configured) return { ...configured };
    if (!this.canUpgrade(buildingId, level)) return null;
    const seedCost = upgradeCosts[upgradeCosts.length - 1] || building.buildCost || {};
    return scaleCost(seedCost, getCostGrowth(building), level - upgradeCosts.length);
  },
  getMaxLevel(buildingId) {
    return this.getBuilding(buildingId)?.maxLevel || 1;
  },
  canUpgrade(buildingId, currentLevel) {
    const building = this.getBuilding(buildingId);
    const level = toLevel(currentLevel);
    if (!building || level <= 0) return false;
    if (isOpenEndedScale(building)) return true;
    return level < getConfiguredMaxLevel(building);
  },
  calculateEffectBonus(buildingId, field, level) {
    const building = typeof buildingId === 'string' ? this.getBuilding(buildingId) : buildingId;
    const currentLevel = toLevel(level);
    const perLevel = Number(building?.effects?.perLevel?.[field] || 0);
    if (!building || currentLevel <= 0 || perLevel <= 0) return 0;
    const maxLevel = getConfiguredMaxLevel(building);
    const baseLevels = Math.min(currentLevel, maxLevel);
    let total = baseLevels * perLevel;
    if (isOpenEndedScale(building) && currentLevel > maxLevel) {
      const extraLevels = currentLevel - maxLevel;
      const curve = building.scalePlan?.effectCurve || 'diminishing';
      for (let index = 0; index < extraLevels; index += 1) {
        if (curve === 'linear') total += perLevel;
        else if (curve === 'step') total += perLevel * 0.5;
        else total += perLevel * (0.05 + 0.95 / Math.sqrt(index + 2));
      }
    }
    return roundEffectBonus(total);
  },
  getScalePlan(buildingId) {
    return clone(this.getBuilding(buildingId)?.scalePlan || {});
  },
  getMaintenancePolicy() {
    return clone(getBuildingPayload().maintenancePolicy || {});
  },
  getMaintenance(buildingId) {
    return clone(this.getBuilding(buildingId)?.maintenance || {});
  },
  isMaintenanceActive() {
    const policy = getBuildingPayload().maintenancePolicy || {};
    return Boolean(policy.active && policy.appliesToResourceTick);
  },
  getMaintenancePreview(buildingId) {
    if (!getRuntimePayload('building-config')) return FallbackBuildingConfig.getMaintenancePreview(buildingId);
    const maintenance = this.getMaintenance(buildingId);
    const resources = Object.entries(maintenance.perLevelPerMinute || {})
      .filter(([, value]) => Number(value) > 0)
      .map(([key]) => key);
    const active = Boolean(this.isMaintenanceActive() && maintenance.enabled);
    return {
      planned: resources.length > 0 || Boolean(maintenance.summary),
      active,
      enabled: Boolean(maintenance.enabled),
      startsAtEra: maintenance.startsAtEra || null,
      resources,
      resourceText: resources.join(', ') || 'none',
      pressureText: `pressure:${Number(maintenance.habitabilityPressure) || 0}`,
      summary: maintenance.summary || '',
      text: `${active ? 'active' : 'planned'} maintenance: ${resources.join(', ') || 'none'}`,
    };
  },
  getScalePlanPreview(buildingId) {
    if (!getRuntimePayload('building-config')) return FallbackBuildingConfig.getScalePlanPreview(buildingId);
    const scalePlan = this.getBuilding(buildingId)?.scalePlan || {};
    const openEnded = Boolean(scalePlan.openEnded);
    return {
      openEnded,
      currentCapRetained: Boolean(scalePlan.currentCapRetained),
      curveText: scalePlan.effectCurve || 'diminishing',
      text: openEnded ? 'open-ended scale enabled' : 'fixed max level',
    };
  },
};

const EraConfig = {
  get ERA_NAMES() {
    return getEraPayload().names || [];
  },
  get ERA_DESCRIPTIONS() {
    return getEraPayload().descriptions || [];
  },
  get ERA_BUILDING_UNLOCKS() {
    return getEraPayload().buildingUnlocks || {};
  },
  get ERA_ADVANCEMENT() {
    return getEraPayload().advancement || {};
  },
  getEraName(era) {
    return this.ERA_NAMES[era] || `era${era}`;
  },
  getEraDescription(era) {
    return this.ERA_DESCRIPTIONS[era] || `${this.getEraName(era)} is not configured.`;
  },
  getAdvanceConfig(currentEra) {
    return this.ERA_ADVANCEMENT[currentEra] || null;
  },
};

const TutorialFlowConfig = {
  get TUTORIAL_STEPS() {
    return getTutorialPayload().steps || {};
  },
  get TUTORIAL_EVENT_STEPS() {
    return getTutorialPayload().eventSteps || {};
  },
  get PASS_THROUGH_ACTIONS() {
    return getTutorialPayload().passThroughActions || [];
  },
  get CLIENT_TUTORIAL_STEP_GATES() {
    return getTutorialPayload().clientStepGates || {};
  },
  createPhaseCompleted(currentStep) {
    const steps = this.TUTORIAL_STEPS;
    return {
      newbie: SharedTutorialFlowConfig.stepAtLeast(currentStep, steps.eraAdvancedTo1),
      era2: SharedTutorialFlowConfig.stepAtLeast(currentStep, steps.lumbermillBuilt),
      scoutFormation: SharedTutorialFlowConfig.stepAtLeast(currentStep, steps.scoutFormationSaved),
    };
  },
};

const TechTreeConfig = {
  get TECH_POINT_GRANTS() {
    return getTechPayload().techPointGrants || {};
  },
  get TECH_CHOICE_LIMITS() {
    return getTechPayload().techChoiceLimits || {};
  },
  get RESOURCE_LABELS() {
    return getTechPayload().resourceLabels || {};
  },
  get BUILDING_LABELS() {
    return getTechPayload().buildingLabels || {};
  },
  get TECH_ERAS() {
    return getTechPayload().techEras || [];
  },
  get TECH_ROUTE_META() {
    return getTechPayload().techRouteMeta || {};
  },
  get TECH_TREE_LAYOUT() {
    return getTechPayload().techTreeLayout || {};
  },
  get TECHS() {
    return getTechPayload().techs || [];
  },
  get TECH_BY_ID() {
    return Object.fromEntries(this.TECHS.map((tech) => [tech.id, tech]));
  },
};

module.exports = {
  GAMEPLAY_CONFIG_RUNTIME_SCHEMA,
  GameConfig,
  BuildingConfig,
  EraConfig,
  TutorialFlowConfig,
  TechTreeConfig,
  configureRuntimeConfig,
  getTaskDefinitionsPayload,
  getRuntimeConfigStatus,
  initializeRuntimeConfig,
  resetRuntimeConfig,
};
