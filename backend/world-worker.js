const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const { openDatabase } = require('./services/DatabaseRuntime');
const GameStateRepository = require('./repositories/GameStateRepository');
const gameStateService = require('./services/GameStateService');
const CityService = require('./services/CityService');
const TerritoryService = require('./services/TerritoryService');
const EventService = require('./services/EventService');
const WorldWorkerService = require('./services/realtime/WorldWorkerService');
const ConfigTables = require('./config/ConfigTables');
const { createFactionDiplomacyService } = require('./services/faction/FactionDiplomacyService');
const { createFactionRegistryService } = require('./services/faction/FactionRegistryService');
const { createWorldDiplomacyTickService } = require('./services/faction/WorldDiplomacyTickService');
const {
  createWorldPeopleRegistryService,
} = require('./services/person/WorldPeopleRegistryService');
const { createWorldSocialTickService } = require('./services/person/WorldSocialTickService');
const personalityCore = require('../shared/person/personalityCore');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'civilization.db');
const { db } = openDatabase(Database, dbPath);
const repository = new GameStateRepository(db);
repository.init();

function tuningMap(table) {
  return Object.fromEntries(ConfigTables.getRows(table).map((row) => [row.paramKey, row.value]));
}

function tuningValue(table, key, fallback) {
  const value = Number(tuningMap(table)[key]);
  return Number.isFinite(value) ? value : fallback;
}

const worldPeopleRegistryService = createWorldPeopleRegistryService({
  worldPeopleRepo: repository.worldPeopleRepo,
});
const factionRegistryService = createFactionRegistryService({
  factionRepo: repository.factionRepo,
});
const factionDiplomacyService = createFactionDiplomacyService({
  diplomacyRepo: repository.factionDiplomacyRepo,
  getConfig: () => tuningMap('diplomacy_tuning'),
});
const worldSocialTickService = createWorldSocialTickService({
  natures: ConfigTables.getRows('personality_natures'),
});
const worldDiplomacyTickService = createWorldDiplomacyTickService({
  diplomacyService: factionDiplomacyService,
  personalityTuning: tuningMap('personality_tuning'),
});

let lastCommandEntrySignature = '';
function reportCommandEntry(report = {}) {
  const owner = report.ownerResolution || {};
  const compact = {
    schema: report.schema,
    mode: report.mode,
    inventoryId: report.inventoryId,
    idempotencyClassification: report.idempotencyClassification,
    ownerStatus: owner.status,
    error: owner.error || '',
    requiredFields: owner.requiredFields || [],
  };
  const signature = JSON.stringify(compact);
  if (signature === lastCommandEntrySignature) return;
  lastCommandEntrySignature = signature;
  console.warn('[world-worker] command entry report', compact);
}

const worker = new WorldWorkerService({
  repository,
  gameStateService,
  cityService: CityService,
  territoryService: TerritoryService,
  eventService: EventService,
  worldPeopleRepo: repository.worldPeopleRepo,
  worldPeopleRegistryService,
  worldSocialTickService,
  factionRegistryService,
  worldDiplomacyTickService,
  getSocialTickOptions: (now) => ({
    meetPairs: tuningValue('relationship_tuning', 'meetPairsPerTick', 3),
    natures: ConfigTables.getRows('personality_natures'),
    personalityTuning: tuningMap('personality_tuning'),
    relTuning: tuningMap('relationship_tuning'),
    prng: personalityCore.makePrng(`world-social:${now.toISOString()}`),
  }),
  intervalMs: process.env.WORLD_WORKER_INTERVAL_MS,
  activeWindowMs: process.env.WORLD_WORKER_ACTIVE_WINDOW_MS,
  activeLimit: process.env.WORLD_WORKER_ACTIVE_LIMIT,
  slowTickMs: process.env.WORLD_WORKER_SLOW_TICK_MS,
  commandEntryReporter: reportCommandEntry,
});

function shutdown(signal) {
  console.log(`[world-worker] received ${signal}; stopping`);
  worker.stop();
  try {
    db.close();
  } catch (_) {}
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

worker.start();
console.log('[world-worker] started', worker.getStatus());
