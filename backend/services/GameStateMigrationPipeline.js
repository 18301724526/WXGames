const LEGACY_SCHEMA_VERSION = 0;
const CURRENT_SCHEMA_VERSION = 1;
const SAVE_SCHEMA_NAME = 'game-state-save';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clonePlain(value) {
  if (value === undefined || value === null) return {};
  return JSON.parse(JSON.stringify(value));
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function toIsoString(value = new Date()) {
  if (typeof value === 'string' && value) return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function getSaveSchemaVersion(state = {}) {
  if (!isPlainObject(state)) return LEGACY_SCHEMA_VERSION;
  const metadataVersion = state.saveMetadata?.schemaVersion;
  if (Number.isFinite(Number(metadataVersion))) return toInteger(metadataVersion, LEGACY_SCHEMA_VERSION);
  if (Number.isFinite(Number(state.schemaVersion))) return toInteger(state.schemaVersion, LEGACY_SCHEMA_VERSION);
  if (Number.isFinite(Number(state.saveSchemaVersion))) return toInteger(state.saveSchemaVersion, LEGACY_SCHEMA_VERSION);
  return LEGACY_SCHEMA_VERSION;
}

function normalizeMigrationHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      return {
        id: String(entry.id || '').trim(),
        fromVersion: toInteger(entry.fromVersion, LEGACY_SCHEMA_VERSION),
        toVersion: toInteger(entry.toVersion, LEGACY_SCHEMA_VERSION),
        migratedAt: String(entry.migratedAt || '').trim(),
      };
    })
    .filter((entry) => entry.id && entry.toVersion >= entry.fromVersion);
}

function createSaveMetadata(options = {}) {
  const schemaVersion = toInteger(options.schemaVersion, CURRENT_SCHEMA_VERSION);
  return {
    schema: SAVE_SCHEMA_NAME,
    schemaVersion,
    migrations: normalizeMigrationHistory(options.migrations),
  };
}

function normalizeSaveMetadata(metadata = {}, options = {}) {
  const source = isPlainObject(metadata) ? metadata : {};
  return {
    ...source,
    schema: SAVE_SCHEMA_NAME,
    schemaVersion: toInteger(source.schemaVersion, toInteger(options.schemaVersion, CURRENT_SCHEMA_VERSION)),
    migrations: normalizeMigrationHistory(source.migrations),
  };
}

function appendMigrationHistory(state, migration, now) {
  const metadata = normalizeSaveMetadata(state.saveMetadata, { schemaVersion: migration.fromVersion });
  const migrations = normalizeMigrationHistory(metadata.migrations);
  migrations.push({
    id: migration.id,
    fromVersion: migration.fromVersion,
    toVersion: migration.toVersion,
    migratedAt: toIsoString(now),
  });
  state.saveMetadata = {
    ...metadata,
    schemaVersion: migration.toVersion,
    migrations,
  };
  return state;
}

function migrateLegacyResourceAliases(state) {
  if (!isPlainObject(state.resources)) return state;
  const resources = { ...state.resources };
  if (resources.iron === undefined && resources.metal !== undefined) resources.iron = resources.metal;
  if (resources.metal === undefined && resources.iron !== undefined) resources.metal = resources.iron;
  state.resources = resources;
  return state;
}

function migrateLegacyCollections(state) {
  if (!isPlainObject(state.taskProgress)) state.taskProgress = { claimed: {} };
  if (!isPlainObject(state.taskProgress.claimed)) {
    state.taskProgress = { ...state.taskProgress, claimed: {} };
  }
  ['eventQueue', 'eventHistory', 'activeBuffs', 'famousPeople', 'scoutedCoordinates', 'exploreMissions', 'warMissions', 'scoutReports']
    .forEach((key) => {
      if (!Array.isArray(state[key])) state[key] = [];
    });
  return state;
}

function initializeSaveSchemaV1(state) {
  migrateLegacyResourceAliases(state);
  migrateLegacyCollections(state);
  state.saveMetadata = normalizeSaveMetadata(state.saveMetadata, { schemaVersion: CURRENT_SCHEMA_VERSION });
  return state;
}

const MIGRATIONS = Object.freeze([
  Object.freeze({
    id: 'initialize-save-schema-v1',
    fromVersion: LEGACY_SCHEMA_VERSION,
    toVersion: 1,
    apply: initializeSaveSchemaV1,
  }),
]);

function normalizeMigrations(migrations = MIGRATIONS) {
  return Object.freeze((Array.isArray(migrations) ? migrations : [])
    .map((migration) => {
      if (!migration || typeof migration.apply !== 'function') return null;
      return Object.freeze({
        id: String(migration.id || '').trim(),
        fromVersion: toInteger(migration.fromVersion, LEGACY_SCHEMA_VERSION),
        toVersion: toInteger(migration.toVersion, LEGACY_SCHEMA_VERSION),
        apply: migration.apply,
      });
    })
    .filter((migration) => migration && migration.id && migration.toVersion > migration.fromVersion)
    .sort((a, b) => a.fromVersion - b.fromVersion || a.toVersion - b.toVersion || a.id.localeCompare(b.id)));
}

function createPipeline(migrations = MIGRATIONS, options = {}) {
  const orderedMigrations = normalizeMigrations(migrations);
  const currentSchemaVersion = toInteger(options.currentSchemaVersion, CURRENT_SCHEMA_VERSION);

  function getNextMigration(version) {
    return orderedMigrations.find((migration) => migration.fromVersion === version && migration.toVersion <= currentSchemaVersion) || null;
  }

  function migrateState(rawState = {}, migrateOptions = {}) {
    const now = migrateOptions.now || options.now || new Date();
    const fromVersion = getSaveSchemaVersion(rawState);
    let version = fromVersion;
    const state = clonePlain(rawState);
    const appliedMigrations = [];

    if (version > currentSchemaVersion) {
      state.saveMetadata = normalizeSaveMetadata(state.saveMetadata, { schemaVersion: version });
      return {
        state,
        fromVersion,
        toVersion: version,
        currentSchemaVersion,
        appliedMigrations,
        changed: false,
        futureSchema: true,
      };
    }

    while (version < currentSchemaVersion) {
      const migration = getNextMigration(version);
      if (!migration) {
        throw new Error(`Missing game state migration from schema version ${version} to ${currentSchemaVersion}`);
      }
      migration.apply(state, { now, fromVersion: version, targetVersion: currentSchemaVersion });
      appendMigrationHistory(state, migration, now);
      appliedMigrations.push(migration.id);
      version = migration.toVersion;
    }

    state.saveMetadata = normalizeSaveMetadata(state.saveMetadata, { schemaVersion: version });
    return {
      state,
      fromVersion,
      toVersion: version,
      currentSchemaVersion,
      appliedMigrations,
      changed: appliedMigrations.length > 0,
      futureSchema: false,
    };
  }

  return Object.freeze({
    currentSchemaVersion,
    migrations: orderedMigrations,
    getNextMigration,
    migrateState,
  });
}

const defaultPipeline = createPipeline(MIGRATIONS);

module.exports = {
  LEGACY_SCHEMA_VERSION,
  CURRENT_SCHEMA_VERSION,
  SAVE_SCHEMA_NAME,
  MIGRATIONS,
  appendMigrationHistory,
  createPipeline,
  createSaveMetadata,
  getSaveSchemaVersion,
  migrateState: defaultPipeline.migrateState,
  normalizeMigrationHistory,
  normalizeMigrations,
  normalizeSaveMetadata,
};
