const ConfigRegistryContract = require('../services/config/ConfigRegistryContract');
const { clone } = require('../../shared/objectUtils');

const CONFIG_VERSION = '1.2.0';
const CONFIG_SCHEMA_VERSION = 1;
const sourcePath = __filename;

const resources = {
  baseFoodPerFarmer: 1.0,
  baseKnowledgePerPerson: 0.05,
  scholarKnowledgeBonus: 0.15,
  baseWoodPerCraftsman: 1.0,
  baseStonePerCraftsman: 0.8,
  baseIronPerCraftsman: 0.55,
  foodConsumptionPerPerson: 0.2,
  woodConsumptionPerPerson: 0,
  offlineBaseEfficiency: 0.8,
  maxOfflineHours: 8,
};

const population = {
  baseMax: 3,
  growthIntervalSeconds: 120,
  splitCapacityActive: true,
  eraCaps: [3, 6, 9, 12, 16, 20],
};

const features = {};

function raw() {
  return clone({ resources, population, features });
}

function createRegistryEntries() {
  return {
    resources: { id: 'resources', values: resources },
    population: { id: 'population', values: population },
    features: { id: 'features', values: features },
  };
}

function getRegistryMetadata() {
  return ConfigRegistryContract.createRegistryMetadata({
    id: 'game-config',
    schema: 'game-config-registry',
    schemaVersion: CONFIG_SCHEMA_VERSION,
    version: CONFIG_VERSION,
    source: sourcePath,
    entries: createRegistryEntries(),
    content: raw(),
  });
}

function validateRegistry() {
  return ConfigRegistryContract.validateRegistry({
    id: 'game-config',
    schema: 'game-config-registry',
    schemaVersion: CONFIG_SCHEMA_VERSION,
    version: CONFIG_VERSION,
    source: sourcePath,
    entries: createRegistryEntries(),
    content: raw(),
  }, {
    requireEntries: true,
    requireVersion: true,
    requireObjectKeyMatch: true,
  });
}

module.exports = {
  resources,
  population,
  features,
  raw,
  getVersion: () => CONFIG_VERSION,
  getSourcePath: () => sourcePath,
  getRegistryMetadata,
  validateRegistry,
};
