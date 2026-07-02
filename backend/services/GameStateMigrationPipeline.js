const { toNonNegativeInteger } = require('../../shared/numberUtils');
const { isPlainObject } = require('../../shared/objectUtils');
const BuildingState = require('../modules/BuildingState');
const { BuildingConfig } = require('./config/GameplayConfigRuntime');
const SkillGeneratorService = require('./SkillGeneratorService');

const INITIAL_SCHEMA_VERSION = 0;
const CURRENT_SCHEMA_VERSION = 4;
const SAVE_SCHEMA_NAME = 'game-state-save';
const CAPITAL_CITY_ID = 'capital';
const INITIAL_PRESET_TERRITORY_UPGRADES = Object.freeze({
  river_plain: Object.freeze({ x: 1, y: 0, type: 'town', owner: 'neutral' }),
  north_forest: Object.freeze({ x: 0, y: -1, type: 'camp', owner: 'tribe' }),
  hill_outpost: Object.freeze({ x: -1, y: 0, type: 'outpost', owner: 'neutral' }),
  old_ruins: Object.freeze({ x: 1, y: -1, type: 'ruins', owner: 'neutral' }),
});
const SITE_ART_BY_TYPE = Object.freeze({
  capital: 'assets/art/world-site-city-cutout.png',
  city: 'assets/art/world-site-city-cutout.png',
  outpost: 'assets/art/world-site-outpost-cutout.png',
  town: 'assets/art/world-site-town-cutout.png',
  camp: 'assets/art/world-site-camp-cutout.png',
  ruins: 'assets/art/world-site-ruins-cutout.png',
});
const INITIAL_SKILL_EFFECT_KEY_UPGRADES = Object.freeze({
  combo: 'secondHit',
  ambush: 'firstStrike',
  morale: 'attributeBonus',
  counter: null,
});

function clonePlain(value) {
  if (value === undefined || value === null) return {};
  return JSON.parse(JSON.stringify(value));
}

function toIsoString(value = new Date()) {
  if (typeof value === 'string' && value) return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function getSaveSchemaVersion(state = {}) {
  if (!isPlainObject(state)) return INITIAL_SCHEMA_VERSION;
  const metadataVersion = state.saveMetadata?.schemaVersion;
  if (Number.isFinite(Number(metadataVersion))) return toNonNegativeInteger(metadataVersion, INITIAL_SCHEMA_VERSION);
  if (Number.isFinite(Number(state.schemaVersion))) return toNonNegativeInteger(state.schemaVersion, INITIAL_SCHEMA_VERSION);
  if (Number.isFinite(Number(state.saveSchemaVersion))) return toNonNegativeInteger(state.saveSchemaVersion, INITIAL_SCHEMA_VERSION);
  return INITIAL_SCHEMA_VERSION;
}

function normalizeMigrationHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      return {
        id: String(entry.id || '').trim(),
        fromVersion: toNonNegativeInteger(entry.fromVersion, INITIAL_SCHEMA_VERSION),
        toVersion: toNonNegativeInteger(entry.toVersion, INITIAL_SCHEMA_VERSION),
        migratedAt: String(entry.migratedAt || '').trim(),
      };
    })
    .filter((entry) => entry.id && entry.toVersion >= entry.fromVersion);
}

function createSaveMetadata(options = {}) {
  const schemaVersion = toNonNegativeInteger(options.schemaVersion, CURRENT_SCHEMA_VERSION);
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
    schemaVersion: toNonNegativeInteger(source.schemaVersion, toNonNegativeInteger(options.schemaVersion, CURRENT_SCHEMA_VERSION)),
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

function upgradeResourceAliases(state) {
  if (!isPlainObject(state.resources)) return state;
  const resources = { ...state.resources };
  if (resources.iron === undefined && resources.metal !== undefined) resources.iron = resources.metal;
  if (resources.metal === undefined && resources.iron !== undefined) resources.metal = resources.iron;
  state.resources = resources;
  return state;
}

function upgradeCollectionShapes(state) {
  if (!isPlainObject(state.taskProgress)) state.taskProgress = { claimed: {} };
  if (!isPlainObject(state.taskProgress.claimed)) {
    state.taskProgress = { ...state.taskProgress, claimed: {} };
  }
  ['eventQueue', 'eventHistory', 'activeBuffs', 'famousPeople', 'scoutedCoordinates', 'exploreMissions', 'warMissions', 'scoutReports']
    .forEach((key) => {
      if (!Array.isArray(state[key])) state[key] = [];
    });
  if (!state.worldAi || typeof state.worldAi !== 'object' || Array.isArray(state.worldAi)) state.worldAi = {};
  return state;
}

function normalizeStoredBuildingState(rawBuildings) {
  const base = BuildingState.createInitialBuildingState();
  const now = new Date().toISOString();
  const source = isPlainObject(rawBuildings) ? rawBuildings : {};
  for (const id of Object.keys(base)) {
    const value = source[id];
    if (value == null || value === 0) {
      base[id] = null;
      continue;
    }
    if (typeof value === 'number') {
      base[id] = { level: value, builtAt: now, upgradedAt: now };
      continue;
    }
    if (isPlainObject(value) && value.level) {
      base[id] = {
        level: value.level,
        builtAt: value.builtAt || now,
        upgradedAt: value.upgradedAt || value.builtAt || now,
      };
    }
  }
  return base;
}

function getBuildingLevel(buildings, id) {
  const entry = buildings?.[id];
  if (!entry) return 0;
  if (typeof entry === 'number') return Math.max(0, Math.floor(entry));
  return Math.max(0, Math.floor(Number(entry.level) || 0));
}

function getValueByLevel(values, level, fallback) {
  if (Array.isArray(values) && Number.isFinite(values[level])) return values[level];
  if (Array.isArray(values) && values.length > 0) return values[Math.min(level, values.length - 1)] || fallback;
  return fallback;
}

function getTrainingStats(buildings = {}) {
  const level = getBuildingLevel(buildings, 'barracks');
  const config = BuildingConfig.getBuilding('barracks')?.military || {};
  const fallbackCap = level > 0 ? level * 5 : 0;
  const fallbackBatchSize = level > 0 ? 1 : 0;
  return {
    soldierCap: getValueByLevel(config.soldierCapByLevel, level, fallbackCap),
    trainingBatchSize: getValueByLevel(config.trainingBatchSizeByLevel, level, fallbackBatchSize),
    defensePerSoldier: Number.isFinite(config.defensePerSoldier) ? config.defensePerSoldier : 1,
  };
}

function toNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function upgradeSoldierScale(rawMilitary = {}, buildings = {}) {
  const soldiers = Math.max(0, Math.floor(toNonNegativeNumber(rawMilitary?.soldiers)));
  const stats = getTrainingStats(buildings);
  const cap = Math.max(0, Math.floor(stats.soldierCap || 0));
  if (soldiers <= 0 || cap < 100) return soldiers;
  const hasCurrentScaleFields = Object.prototype.hasOwnProperty.call(rawMilitary || {}, 'trainingBatchSize')
    || Number(rawMilitary?.defensePerSoldier) === Number(stats.defensePerSoldier);
  if (!hasCurrentScaleFields && soldiers < 100) return Math.min(cap, soldiers * 100);
  return soldiers;
}

function normalizeStoredMilitaryState(rawMilitary = {}, buildings = {}) {
  const source = isPlainObject(rawMilitary) ? rawMilitary : {};
  return {
    ...source,
    soldiers: upgradeSoldierScale(source, buildings),
  };
}

function normalizeStoredResources(resources = {}) {
  const source = isPlainObject(resources) ? resources : {};
  return {
    food: Math.max(0, Number(source.food) || 0),
    knowledge: Math.max(0, Number(source.knowledge) || 0),
    wood: Math.max(0, Number(source.wood) || 0),
    iron: Math.max(0, Number(source.iron ?? source.metal) || 0),
    stone: Math.max(0, Number(source.stone) || 0),
    metal: Math.max(0, Number(source.metal ?? source.iron) || 0),
  };
}

function normalizeStoredPopulation(population = {}) {
  const source = isPlainObject(population) ? population : {};
  return {
    total: Math.max(1, Math.floor(Number(source.total) || 3)),
    max: Math.max(1, Math.floor(Number(source.max ?? source.maxPop) || 3)),
    maxPop: Math.max(1, Math.floor(Number(source.maxPop ?? source.max) || 3)),
    farmers: Math.max(0, Math.floor(Number(source.farmers) || 0)),
    scholars: Math.max(0, Math.floor(Number(source.scholars) || 0)),
    craftsmen: Math.max(0, Math.floor(Number(source.craftsmen) || 0)),
    unassigned: Math.max(0, Math.floor(Number(source.unassigned) || 0)),
    growthProgress: Math.max(0, Number(source.growthProgress) || 0),
  };
}

function getCapitalName(state = {}) {
  const territory = (Array.isArray(state.territories) ? state.territories : [])
    .find((item) => item?.id === CAPITAL_CITY_ID);
  return territory?.cityName || state.polity?.capitalCityName || 'Capital';
}

function normalizeStoredCity(rawCity = {}, state = {}, options = {}) {
  const source = isPlainObject(rawCity) ? rawCity : {};
  const id = source.id || source.territoryId || options.id || CAPITAL_CITY_ID;
  const buildings = normalizeStoredBuildingState(source.buildings);
  return {
    ...source,
    id,
    territoryId: source.territoryId || id,
    name: source.name || options.name || (id === CAPITAL_CITY_ID ? getCapitalName(state) : 'New City'),
    isCapital: Boolean(source.isCapital || id === CAPITAL_CITY_ID),
    foundedAt: source.foundedAt || state.eraHistory?.[0]?.advancedAt || state.updatedAt || new Date().toISOString(),
    resources: normalizeStoredResources(source.resources),
    buildings,
    population: normalizeStoredPopulation(source.population),
    military: normalizeStoredMilitaryState(source.military, buildings),
    happiness: Number.isFinite(source.happiness) ? source.happiness : 100,
    planning: isPlainObject(source.planning) ? source.planning : {},
    buildingEffects: isPlainObject(source.buildingEffects) ? source.buildingEffects : {},
  };
}

function createCapitalCityFromStoredState(state = {}) {
  const buildings = normalizeStoredBuildingState(state.buildings);
  return normalizeStoredCity({
    id: CAPITAL_CITY_ID,
    territoryId: CAPITAL_CITY_ID,
    name: getCapitalName(state),
    isCapital: true,
    foundedAt: state.eraHistory?.[0]?.advancedAt || state.updatedAt || new Date().toISOString(),
    resources: state.resources,
    buildings,
    population: state.population,
    military: normalizeStoredMilitaryState(state.military, buildings),
    happiness: Number.isFinite(state.happiness) ? state.happiness : 100,
  }, state, { id: CAPITAL_CITY_ID });
}

function initializeSaveSchemaV1(state) {
  upgradeResourceAliases(state);
  upgradeCollectionShapes(state);
  state.saveMetadata = normalizeSaveMetadata(state.saveMetadata, { schemaVersion: 1 });
  return state;
}

function initializeCitySourceV2(state) {
  state.buildings = normalizeStoredBuildingState(state.buildings);
  state.resources = normalizeStoredResources(state.resources);
  state.population = normalizeStoredPopulation(state.population);
  state.military = normalizeStoredMilitaryState(state.military, state.buildings);

  const sourceCities = isPlainObject(state.cities) ? state.cities : {};
  const cities = {};
  if (sourceCities[CAPITAL_CITY_ID]) {
    cities[CAPITAL_CITY_ID] = normalizeStoredCity({
      ...sourceCities[CAPITAL_CITY_ID],
      id: CAPITAL_CITY_ID,
      territoryId: CAPITAL_CITY_ID,
      isCapital: true,
      name: sourceCities[CAPITAL_CITY_ID].name || getCapitalName(state),
    }, state, { id: CAPITAL_CITY_ID });
  } else {
    cities[CAPITAL_CITY_ID] = createCapitalCityFromStoredState(state);
  }

  Object.values(sourceCities).forEach((rawCity) => {
    if (!rawCity || rawCity.id === CAPITAL_CITY_ID || rawCity.territoryId === CAPITAL_CITY_ID) return;
    const city = normalizeStoredCity(rawCity, state);
    cities[city.id] = city;
  });

  state.cities = cities;
  if (!cities[state.activeCityId]) state.activeCityId = CAPITAL_CITY_ID;
  state.saveMetadata = normalizeSaveMetadata(state.saveMetadata, { schemaVersion: 2 });
  return state;
}

function upgradeStoredSkillEffect(rawEffect = {}) {
  if (!isPlainObject(rawEffect)) return null;
  const rawKey = rawEffect.key;
  const key = Object.prototype.hasOwnProperty.call(INITIAL_SKILL_EFFECT_KEY_UPGRADES, rawKey)
    ? INITIAL_SKILL_EFFECT_KEY_UPGRADES[rawKey]
    : rawKey;
  if (!key) return null;
  return SkillGeneratorService.normalizeEffect({
    ...rawEffect,
    key,
    ...(key === 'secondHit' && rawEffect.multiplier === undefined && rawEffect.chance !== undefined
      ? { multiplier: rawEffect.chance }
      : {}),
    ...(key === 'firstStrike' && rawEffect.value === undefined && rawEffect.chance !== undefined
      ? { value: rawEffect.chance }
      : {}),
    migratedFrom: undefined,
  });
}

function upgradeStoredSkill(rawSkill = {}) {
  if (!isPlainObject(rawSkill)) return null;
  const effects = (Array.isArray(rawSkill.effects) ? rawSkill.effects : [])
    .map(upgradeStoredSkillEffect)
    .filter(Boolean);
  if (!effects.length) return null;
  return {
    ...rawSkill,
    effects,
    generatorVersion: rawSkill.generatorVersion || undefined,
  };
}

function upgradeAbility(rawAbility = {}) {
  return upgradeStoredSkill(rawAbility);
}

function upgradeAbilityKitShape(rawKit = {}, fallback = {}) {
  const source = isPlainObject(rawKit) ? rawKit : {};
  const rawAbilities = Array.isArray(source.abilities) ? source.abilities : [];
  const fallbackSkills = Array.isArray(fallback.skills) ? fallback.skills : [];
  const abilities = (rawAbilities.length ? rawAbilities : fallbackSkills)
    .map(upgradeAbility)
    .filter(Boolean)
    .map((ability) => ({
      ...ability,
      slot: ability.slot || (ability.kind === 'active' || ability.type === 'battle' ? 'activeSkill' : undefined),
      kind: ability.kind || (ability.type === 'battle' ? 'active' : undefined),
    }));
  const abilityArchetype = source.archetype || fallback.abilityArchetype || fallback.archetype;
  const quality = source.quality || fallback.quality;
  return SkillGeneratorService.normalizeAbilityKit({
    ...source,
    archetype: abilityArchetype,
    quality,
    abilities,
  }, {
    archetype: fallback.archetype,
    abilityArchetype,
    quality,
    source: source.source || fallback.source,
    seed: source.seed || fallback.seed,
    availableEffectPool: source.availableEffectPool || fallback.availableEffectPool,
  });
}

function upgradeLeaderAbilityState(rawLeader = {}) {
  if (!isPlainObject(rawLeader)) return rawLeader;
  const quality = SkillGeneratorService.normalizeQuality(rawLeader.quality);
  const abilityArchetype = SkillGeneratorService.normalizeAbilityArchetype(
    rawLeader.abilityArchetype || rawLeader.abilityKit?.archetype || rawLeader.archetype,
  );
  const upgradedSkills = (Array.isArray(rawLeader.skills) ? rawLeader.skills : [])
    .map(upgradeStoredSkill)
    .filter(Boolean);
  const abilityKit = upgradeAbilityKitShape(rawLeader.abilityKit, {
    archetype: rawLeader.archetype,
    abilityArchetype,
    quality,
    skills: upgradedSkills,
    source: rawLeader.source?.type,
    seed: rawLeader.source?.seed || rawLeader.id,
  });
  const activeSkill = SkillGeneratorService.getActiveBattleSkill(abilityKit);
  return {
    ...rawLeader,
    abilityArchetype,
    abilityKit,
    skills: abilityKit.battlePolicy === 'basicAttackOnly' || !activeSkill ? [] : [activeSkill],
  };
}

function upgradeTerritoryLeaderAbilityState(rawTerritory = {}) {
  if (!isPlainObject(rawTerritory)) return rawTerritory;
  const territory = { ...rawTerritory };
  if (isPlainObject(territory.defenderLeader)) {
    territory.defenderLeader = upgradeLeaderAbilityState(territory.defenderLeader);
  }
  if (isPlainObject(territory.garrison?.leader)) {
    territory.garrison = {
      ...territory.garrison,
      leader: upgradeLeaderAbilityState(territory.garrison.leader),
    };
  }
  if (isPlainObject(territory.battleTarget?.defender?.leader)) {
    territory.battleTarget = {
      ...territory.battleTarget,
      defender: {
        ...territory.battleTarget.defender,
        leader: upgradeLeaderAbilityState(territory.battleTarget.defender.leader),
      },
    };
  }
  return territory;
}

function upgradeStoredSkillEffectsV3(state) {
  state.famousPeople = (Array.isArray(state.famousPeople) ? state.famousPeople : [])
    .map(upgradeLeaderAbilityState)
    .filter(Boolean);
  if (isPlainObject(state.famousPersonState)) {
    state.famousPersonState = {
      ...state.famousPersonState,
      candidates: (Array.isArray(state.famousPersonState.candidates) ? state.famousPersonState.candidates : [])
        .map(upgradeLeaderAbilityState)
        .filter(Boolean),
    };
  }
  state.territories = (Array.isArray(state.territories) ? state.territories : [])
    .map(upgradeTerritoryLeaderAbilityState)
    .filter(Boolean);
  state.warMissions = (Array.isArray(state.warMissions) ? state.warMissions : [])
    .map((mission) => {
      if (!isPlainObject(mission?.expedition?.leaderSnapshot)) return mission;
      return {
        ...mission,
        expedition: {
          ...mission.expedition,
          leaderSnapshot: upgradeLeaderAbilityState(mission.expedition.leaderSnapshot),
        },
      };
    });
  if (isPlainObject(state.worldCombat)) {
    state.worldCombat = {
      ...state.worldCombat,
      encounters: (Array.isArray(state.worldCombat.encounters) ? state.worldCombat.encounters : [])
        .map((encounter) => {
          if (!isPlainObject(encounter?.defender?.leader)) return encounter;
          return {
            ...encounter,
            defender: {
              ...encounter.defender,
              leader: upgradeLeaderAbilityState(encounter.defender.leader),
            },
          };
        }),
    };
  }
  state.saveMetadata = normalizeSaveMetadata(state.saveMetadata, { schemaVersion: 3 });
  return state;
}

function upgradeInitialPresetTerritory(rawTerritory = {}) {
  if (!isPlainObject(rawTerritory)) return null;
  const upgrade = INITIAL_PRESET_TERRITORY_UPGRADES[rawTerritory.id];
  if (!upgrade) return rawTerritory;
  if (!['scouted', 'contested', 'occupied'].includes(rawTerritory.status)) return null;
  return {
    ...rawTerritory,
    x: Number.isFinite(Number(rawTerritory.x)) ? rawTerritory.x : upgrade.x,
    y: Number.isFinite(Number(rawTerritory.y)) ? rawTerritory.y : upgrade.y,
    type: upgrade.type,
    owner: rawTerritory.status === 'occupied' ? 'player' : upgrade.owner,
    status: rawTerritory.status === 'scouted' ? 'discovered' : rawTerritory.status,
    art: SITE_ART_BY_TYPE[upgrade.type],
  };
}

function upgradeTerritorySourceV4(state) {
  state.territories = (Array.isArray(state.territories) ? state.territories : [])
    .map(upgradeInitialPresetTerritory)
    .filter(Boolean);
  state.warMissions = (Array.isArray(state.warMissions) ? state.warMissions : [])
    .map((mission) => {
      if (!isPlainObject(mission) || mission.kind !== 'scout') return mission;
      const hasStoredRoute = Array.isArray(mission.route) && mission.route.length > 0;
      const hasStoredRevealArea = Array.isArray(mission.revealArea) && mission.revealArea.length > 0;
      if (mission.revealAreaSource && !String(mission.revealAreaSource).startsWith('legacy-')) return mission;
      return {
        ...mission,
        revealAreaSource: hasStoredRevealArea
          ? 'directional-route-v1'
          : hasStoredRoute
            ? 'stored-route-v1'
            : 'target-coordinate-v1',
      };
    });
  state.saveMetadata = normalizeSaveMetadata(state.saveMetadata, { schemaVersion: CURRENT_SCHEMA_VERSION });
  return state;
}

const MIGRATIONS = Object.freeze([
  Object.freeze({
    id: 'initialize-save-schema-v1',
    fromVersion: INITIAL_SCHEMA_VERSION,
    toVersion: 1,
    apply: initializeSaveSchemaV1,
  }),
  Object.freeze({
    id: 'initialize-city-source-v2',
    fromVersion: 1,
    toVersion: 2,
    apply: initializeCitySourceV2,
  }),
  Object.freeze({
    id: 'upgrade-stored-skill-effects-v3',
    fromVersion: 2,
    toVersion: 3,
    apply: upgradeStoredSkillEffectsV3,
  }),
  Object.freeze({
    id: 'upgrade-territory-source-v4',
    fromVersion: 3,
    toVersion: 4,
    apply: upgradeTerritorySourceV4,
  }),
]);

function normalizeMigrations(migrations = MIGRATIONS) {
  return Object.freeze((Array.isArray(migrations) ? migrations : [])
    .map((migration) => {
      if (!migration || typeof migration.apply !== 'function') return null;
      return Object.freeze({
        id: String(migration.id || '').trim(),
        fromVersion: toNonNegativeInteger(migration.fromVersion, INITIAL_SCHEMA_VERSION),
        toVersion: toNonNegativeInteger(migration.toVersion, INITIAL_SCHEMA_VERSION),
        apply: migration.apply,
      });
    })
    .filter((migration) => migration && migration.id && migration.toVersion > migration.fromVersion)
    .sort((a, b) => a.fromVersion - b.fromVersion || a.toVersion - b.toVersion || a.id.localeCompare(b.id)));
}

function createPipeline(migrations = MIGRATIONS, options = {}) {
  const orderedMigrations = normalizeMigrations(migrations);
  const currentSchemaVersion = toNonNegativeInteger(options.currentSchemaVersion, CURRENT_SCHEMA_VERSION);

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
  INITIAL_SCHEMA_VERSION,
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
