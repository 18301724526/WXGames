const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ConfigPipeline = require('../services/config/ConfigPipeline');
const ConfigRegistryContract = require('../services/config/ConfigRegistryContract');
const ConfigReleaseService = require('../services/config/ConfigReleaseService');
const GameplayConfigRuntime = require('../services/config/GameplayConfigRuntime');

function createTempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgame-gameplay-config-runtime-'));
  return {
    dir,
    historyPath: path.join(dir, 'configReleases.json'),
    activePath: path.join(dir, 'configActiveRelease.json'),
  };
}

function createPayloadLoader(id, payload, options = {}) {
  const entries = options.entries || Object.entries(payload).map(([key, value]) => ({ id: key, value }));
  const metadata = ConfigRegistryContract.createRegistryMetadata({
    id,
    schema: options.schema || `${id}-registry`,
    schemaVersion: 1,
    version: options.version || '1.0.0',
    source: `${id}.json`,
    entries,
    content: payload,
  });
  return {
    id,
    load(loadOptions = {}) {
      return {
        metadata,
        validation: { success: true, errors: [], warnings: [] },
        sourcePath: metadata.source,
        payload: loadOptions.includePayload ? payload : undefined,
      };
    },
  };
}

test('GameplayConfigRuntime falls back to module config in observe-only mode', () => {
  GameplayConfigRuntime.resetRuntimeConfig();
  GameplayConfigRuntime.configureRuntimeConfig({
    ...createTempPaths(),
    env: { NODE_ENV: 'development' },
    now: new Date('2026-06-11T00:00:00Z'),
  });

  const status = GameplayConfigRuntime.getRuntimeConfigStatus();

  assert.equal(status.schema, GameplayConfigRuntime.GAMEPLAY_CONFIG_RUNTIME_SCHEMA);
  assert.equal(status.source, 'module-fallback');
  assert.equal(status.bundleReady, false);
  assert.equal(GameplayConfigRuntime.GameConfig.population.baseMax, 3);
  assert.equal(GameplayConfigRuntime.BuildingConfig.hasBuilding('farm'), true);

  GameplayConfigRuntime.resetRuntimeConfig();
});

test('GameplayConfigRuntime consumes active runtime bundle payload after release gate match', () => {
  const paths = createTempPaths();
  const gamePayload = {
    resources: {
      baseFoodPerFarmer: 9,
      baseKnowledgePerPerson: 0.05,
      scholarKnowledgeBonus: 0.15,
      baseWoodPerCraftsman: 1,
      baseStonePerCraftsman: 1,
      baseIronPerCraftsman: 1,
      foodConsumptionPerPerson: 0.2,
      offlineBaseEfficiency: 0.8,
      maxOfflineHours: 8,
    },
    population: {
      baseMax: 7,
      growthIntervalSeconds: 10,
      splitCapacityActive: true,
      eraCaps: [7, 8],
    },
  };
  const buildingPayload = {
    version: '1.0.0',
    buildings: {
      farm: {
        id: 'farm',
        buildCost: { food: 1 },
        upgradeCosts: [{ food: 2 }],
        maxLevel: 2,
        effects: { perLevel: { foodOutputMultiplier: 0.5 } },
      },
    },
  };
  const eraPayload = {
    names: ['Unit Era'],
    descriptions: ['Unit era description'],
    buildingUnlocks: { 0: ['farm'] },
    advancement: {},
  };
  const techPayload = {
    techPointGrants: { 1: 4 },
    techChoiceLimits: { 1: 2 },
    resourceLabels: {},
    buildingLabels: {},
    techEras: [],
    techRouteMeta: {},
    techTreeLayout: {},
    techs: [],
  };
  const loaders = [
    createPayloadLoader('game-config', gamePayload, { entries: [{ id: 'resources' }, { id: 'population' }] }),
    createPayloadLoader('building-config', buildingPayload, { entries: [{ id: 'farm' }] }),
    createPayloadLoader('era-config', eraPayload, { entries: [{ id: 'era:0' }] }),
    createPayloadLoader('tech-tree-config', techPayload, { entries: [{ id: 'tech-meta' }] }),
  ];
  const snapshot = ConfigPipeline.buildCurrentSnapshot({
    loaders,
    generatedAt: '2026-06-11T00:00:00.000Z',
  });
  const publish = ConfigReleaseService.publishRelease(
    { snapshot, source: 'unit:publish' },
    { ...paths, loaders, operator: 'codexqa', now: new Date('2026-06-11T00:00:00Z') },
  );

  GameplayConfigRuntime.resetRuntimeConfig();
  GameplayConfigRuntime.configureRuntimeConfig({
    ...paths,
    loaders,
    env: { NODE_ENV: 'production' },
    now: new Date('2026-06-11T00:01:00Z'),
  });
  const status = GameplayConfigRuntime.initializeRuntimeConfig();

  assert.equal(publish.success, true);
  assert.equal(status.source, 'active-release-bundle');
  assert.equal(status.bundleReady, true);
  assert.equal(GameplayConfigRuntime.GameConfig.resources.baseFoodPerFarmer, 9);
  assert.equal(GameplayConfigRuntime.GameConfig.population.baseMax, 7);
  assert.deepEqual(GameplayConfigRuntime.BuildingConfig.getBuildCost('farm'), { food: 1 });
  assert.equal(GameplayConfigRuntime.BuildingConfig.calculateEffectBonus('farm', 'foodOutputMultiplier', 2), 1);
  assert.equal(GameplayConfigRuntime.EraConfig.getEraName(0), 'Unit Era');
  assert.equal(GameplayConfigRuntime.TechTreeConfig.TECH_POINT_GRANTS[1], 4);

  GameplayConfigRuntime.resetRuntimeConfig();
});
