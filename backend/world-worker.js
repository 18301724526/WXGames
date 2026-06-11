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

const dbPath = process.env.DB_PATH || path.join(__dirname, 'civilization.db');
const { db } = openDatabase(Database, dbPath);
const repository = new GameStateRepository(db);
repository.init();

const worker = new WorldWorkerService({
  repository,
  gameStateService,
  cityService: CityService,
  territoryService: TerritoryService,
  eventService: EventService,
  intervalMs: process.env.WORLD_WORKER_INTERVAL_MS,
  activeWindowMs: process.env.WORLD_WORKER_ACTIVE_WINDOW_MS,
  activeLimit: process.env.WORLD_WORKER_ACTIVE_LIMIT,
  slowTickMs: process.env.WORLD_WORKER_SLOW_TICK_MS,
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
