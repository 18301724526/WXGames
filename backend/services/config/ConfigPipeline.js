const fs = require('node:fs');
const path = require('node:path');

const ConfigRegistryContract = require('./ConfigRegistryContract');

const SNAPSHOT_SCHEMA = 'config-pipeline-snapshot-v1';
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function toRepoPath(filePath, repoRoot = REPO_ROOT) {
  if (!filePath) return '';
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function sortById(entries = []) {
  return [...entries].sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
}

function createConfigModuleLoader(id, modulePath) {
  return {
    id,
    load(options = {}) {
      const moduleApi = require(modulePath);
      return {
        metadata: moduleApi.getRegistryMetadata(),
        validation: moduleApi.validateRegistry(),
        sourcePath: moduleApi.getSourcePath?.() || modulePath,
        payload: options.includePayload && typeof moduleApi.raw === 'function'
          ? moduleApi.raw()
          : undefined,
      };
    },
  };
}

function createTaskDefinitionsLoader() {
  return {
    id: 'task-definitions',
    load(options = {}) {
      const Normalizer = require('../taskDefinitions/TaskDefinitionNormalizer');
      const StaticBuildingConfig = require('../../config/BuildingConfig');
      const StaticEraConfig = require('../../config/EraConfig');
      const sourcePath = path.join(REPO_ROOT, 'backend', 'config', 'defaultTaskDefinitions.json');
      const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
      const definitions = Normalizer.normalizeDefinitions(raw, {
        source: sourcePath,
        rewardConfigDeps: {
          BuildingConfig: StaticBuildingConfig,
          EraConfig: StaticEraConfig,
        },
      });
      return {
        metadata: definitions.registry,
        validation: definitions.registryValidation,
        sourcePath,
        payload: options.includePayload ? definitions : undefined,
      };
    },
  };
}

function getDefaultRegistryLoaders() {
  return [
    createConfigModuleLoader('game-config', path.join(REPO_ROOT, 'backend', 'config', 'GameConfig.js')),
    createConfigModuleLoader('era-config', path.join(REPO_ROOT, 'backend', 'config', 'EraConfig.js')),
    createConfigModuleLoader('battle-config', path.join(REPO_ROOT, 'backend', 'config', 'BattleConfig.js')),
    createConfigModuleLoader('tech-tree-config', path.join(REPO_ROOT, 'backend', 'config', 'TechTreeConfig.js')),
    createConfigModuleLoader('building-config', path.join(REPO_ROOT, 'backend', 'config', 'BuildingConfig.js')),
    createTaskDefinitionsLoader(),
  ];
}

function normalizeRegistryReport(loader = {}, loaded = {}, options = {}) {
  const metadata = loaded.metadata || {};
  const validation = loaded.validation || { success: false, errors: ['registry validation result is missing'], warnings: [] };
  const id = metadata.id || loader.id || 'registry';
  const report = {
    id,
    metadata,
    validation: {
      success: validation.success === true,
      errors: Array.isArray(validation.errors) ? validation.errors : [],
      warnings: Array.isArray(validation.warnings) ? validation.warnings : [],
    },
    source: toRepoPath(loaded.sourcePath || metadata.source, options.repoRoot),
  };
  if (options.includePayload && Object.prototype.hasOwnProperty.call(loaded, 'payload')) {
    report.payload = loaded.payload;
  }
  return report;
}

function collectRegistryReports(options = {}) {
  const loaders = options.loaders || getDefaultRegistryLoaders();
  return sortById(loaders.map((loader) => {
    try {
      return normalizeRegistryReport(loader, loader.load(options), options);
    } catch (error) {
      return {
        id: loader.id || 'registry',
        metadata: { id: loader.id || 'registry' },
        validation: {
          success: false,
          errors: [error?.message || String(error || '')],
          warnings: [],
        },
        source: '',
      };
    }
  }));
}

function summarizeValidation(registryReports = []) {
  const errors = [];
  const warnings = [];
  registryReports.forEach((report) => {
    (report.validation.errors || []).forEach((error) => errors.push(`${report.id}: ${error}`));
    (report.validation.warnings || []).forEach((warning) => warnings.push(`${report.id}: ${warning}`));
  });
  return {
    success: errors.length === 0,
    errors,
    warnings,
  };
}

function createSnapshot(registryReports = [], options = {}) {
  const reports = sortById(registryReports);
  const validation = summarizeValidation(reports);
  return {
    schema: SNAPSHOT_SCHEMA,
    generatedAt: options.generatedAt || new Date().toISOString(),
    registryCount: reports.length,
    validation,
    registries: reports.map((report) => ({
      ...report.metadata,
      source: report.source || report.metadata.source || '',
    })),
  };
}

function buildCurrentSnapshot(options = {}) {
  return createSnapshot(collectRegistryReports(options), options);
}

function readSnapshot(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeSnapshot(filePath, snapshot) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return filePath;
}

function getSnapshotRegistryMap(snapshot = {}) {
  const registries = Array.isArray(snapshot.registries) ? snapshot.registries : [];
  return new Map(registries.map((registry) => [registry.id, registry]));
}

function getDeclaredRegistryRetirementMap(options = {}) {
  const declarations = Array.isArray(options.declaredRegistryRetirements)
    ? options.declaredRegistryRetirements
    : [];
  return new Map(declarations
    .map((entry = {}) => ({
      id: String(entry.id || '').trim(),
      reason: String(entry.reason || '').trim(),
    }))
    .filter((entry) => entry.id && entry.reason)
    .map((entry) => [entry.id, entry]));
}

function compareSnapshots(baseline = {}, current = {}, options = {}) {
  const beforeMap = getSnapshotRegistryMap(baseline);
  const afterMap = getSnapshotRegistryMap(current);
  const beforeIds = [...beforeMap.keys()].sort((a, b) => a.localeCompare(b));
  const afterIds = [...afterMap.keys()].sort((a, b) => a.localeCompare(b));
  const addedRegistryIds = afterIds.filter((id) => !beforeMap.has(id));
  const removedRegistryIds = beforeIds.filter((id) => !afterMap.has(id));
  const unchangedRegistryIds = [];
  const changedRegistries = [];
  const retiredRegistries = [];
  const errors = [];
  const warnings = [];
  const declaredRetirements = getDeclaredRegistryRetirementMap(options);

  removedRegistryIds.forEach((id) => {
    const declaration = declaredRetirements.get(id);
    if (!declaration) {
      errors.push(`${id}: registry removed`);
      return;
    }
    retiredRegistries.push(declaration);
    warnings.push(`${id}: registry retired (${declaration.reason})`);
  });

  addedRegistryIds.forEach((id) => {
    warnings.push(`${id}: registry added`);
  });

  afterIds
    .filter((id) => beforeMap.has(id))
    .forEach((id) => {
      const before = beforeMap.get(id);
      const after = afterMap.get(id);
      const comparison = ConfigRegistryContract.compareRegistryVersions(before, after);
      const recommendation = ConfigRegistryContract.recommendVersionBump(before, after, options);
      const changed = comparison.contentChanged || comparison.schemaChanged || comparison.versionChanged
        || comparison.addedEntryIds.length > 0 || comparison.removedEntryIds.length > 0;
      if (!changed) {
        unchangedRegistryIds.push(id);
        return;
      }
      if (comparison.direction === 'downgrade') {
        errors.push(`${id}: registry version downgraded from ${comparison.before.version} to ${comparison.after.version}`);
      }
      if (!recommendation.versionSatisfies) {
        errors.push(`${id}: ${recommendation.level} version bump required (${recommendation.reason}); expected >= ${recommendation.recommendedVersion}, got ${comparison.after.version}`);
      }
      changedRegistries.push({
        id,
        before: comparison.before,
        after: comparison.after,
        comparison,
        recommendation: {
          level: recommendation.level,
          reason: recommendation.reason,
          recommendedVersion: recommendation.recommendedVersion,
          versionSatisfies: recommendation.versionSatisfies,
        },
      });
    });

  return {
    success: errors.length === 0,
    errors,
    warnings,
    addedRegistryIds,
    removedRegistryIds,
    unchangedRegistryIds,
    changedRegistries,
    retiredRegistries,
  };
}

function buildPipelineReport(options = {}) {
  const current = options.currentSnapshot || buildCurrentSnapshot(options);
  const baseline = options.baselineSnapshot || (options.baselinePath ? readSnapshot(options.baselinePath) : null);
  const comparison = baseline ? compareSnapshots(baseline, current, options) : null;
  const errors = [
    ...(current.validation.errors || []),
    ...(comparison?.errors || []),
  ];
  const warnings = [
    ...(current.validation.warnings || []),
    ...(comparison?.warnings || []),
  ];
  return {
    schema: 'config-pipeline-report-v1',
    generatedAt: options.generatedAt || new Date().toISOString(),
    success: errors.length === 0,
    errors,
    warnings,
    current,
    baseline: baseline ? {
      schema: baseline.schema || '',
      generatedAt: baseline.generatedAt || '',
      registryCount: Array.isArray(baseline.registries) ? baseline.registries.length : 0,
    } : null,
    comparison,
  };
}

module.exports = {
  SNAPSHOT_SCHEMA,
  buildCurrentSnapshot,
  buildPipelineReport,
  collectRegistryReports,
  compareSnapshots,
  getDeclaredRegistryRetirementMap,
  createSnapshot,
  getDefaultRegistryLoaders,
  readSnapshot,
  writeSnapshot,
};
