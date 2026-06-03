const path = require('path');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
require('dotenv').config();

const AuthService = require('./services/authService');
const LogService = require('./services/logService');
const GameStateRepository = require('./repositories/GameStateRepository');
const createAuthMiddleware = require('./middleware/authMiddleware');
const registerPlayerRoutes = require('./routes/playerRoutes');
const registerGameRoutes = require('./routes/gameRoutes');
const registerBuildingRoutes = require('./routes/buildingRoutes');
const gameStateService = require('./services/GameStateService');
const BuildingConfig = require('./config/BuildingConfig');
const VersionService = require('./services/VersionService');
const EventService = require('./services/EventService');
const TerritoryService = require('./services/TerritoryService');
const CityService = require('./services/CityService');

const app = express();
const dbPath = process.env.DB_PATH || path.join(__dirname, 'civilization.db');
const db = new Database(dbPath);
const jwtSecret = process.env.JWT_SECRET || 'civilization-fire-secret-key-2026';

const repository = new GameStateRepository(db);
repository.init();

const authService = new AuthService(db, jwtSecret);
const logService = new LogService(db);
logService.initLogTable();
const authMiddleware = createAuthMiddleware(authService);
const versionService = new VersionService();
const SKIP_API_LOG_PATHS = new Set([
  '/api/health',
  '/api/version',
  '/api/game/heartbeat',
  '/api/game/state',
  '/api/player/logs',
]);
const BACKGROUND_TICK_INTERVAL_MS = 5000;
const BACKGROUND_ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const BACKGROUND_ACTIVE_LIMIT = 25;
let backgroundTickRunning = false;

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

app.use((req, res, next) => {
  if (SKIP_API_LOG_PATHS.has(req.path)) return next();
  const startedAt = Date.now();
  let responsePayload = null;
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    responsePayload = payload;
    return originalJson(payload);
  };
  res.on('finish', () => {
    try {
      logService.logApi(
        req.playerId || null,
        req.deviceId || null,
        req.method,
        req.path,
        req.body || {},
        res.statusCode,
        responsePayload || {},
        Date.now() - startedAt,
      );
    } catch (error) {
      console.error('[logApi] failed:', error.message);
    }
  });
  next();
});

registerPlayerRoutes(app, { authMiddleware, authService, repository, gameStateService, logService });
registerGameRoutes(app, { authMiddleware, repository, gameStateService });
registerBuildingRoutes(app, { authMiddleware, repository, gameStateService });

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    buildingConfigVersion: BuildingConfig.getVersion(),
    buildingConfigPath: BuildingConfig.getSourcePath(),
    appVersion: versionService.getVersionInfo(),
  });
});

app.get('/api/version', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json(versionService.getVersionInfo());
});

setInterval(() => {
  if (backgroundTickRunning) return;
  backgroundTickRunning = true;
  try {
    const now = new Date();
    const activeSince = new Date(now.getTime() - BACKGROUND_ACTIVE_WINDOW_MS).toISOString();
    const gameStates = repository.findRecentlyActive(activeSince, BACKGROUND_ACTIVE_LIMIT);
    for (const rawState of gameStates) {
      const gameState = gameStateService.normalizeState(rawState);
      CityService.advanceAllCities(gameState, Math.floor(BACKGROUND_TICK_INTERVAL_MS / 1000));
      TerritoryService.updateMissionReadiness(gameState);
      EventService.cleanupRuntimeState(gameState);
      EventService.maybeGenerateRegularEvent(gameState);
      EventService.maybeGenerateThreatEvent(gameState);
      gameState.updatedAt = now.toISOString();
      repository.save(gameState);
    }
  } catch (error) {
    console.error('[backgroundTick] failed:', error.message);
  } finally {
    backgroundTickRunning = false;
  }
}, BACKGROUND_TICK_INTERVAL_MS);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
