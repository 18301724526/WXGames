const path = require('path');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
require('dotenv').config();

const AuthService = require('./services/authService');
const LogService = require('./services/logService');
const GameStateRepository = require('./repositories/GameStateRepository');
const createAuthMiddleware = require('./middleware/authMiddleware');
const createAdminMiddleware = require('./middleware/adminMiddleware');
const registerPlayerRoutes = require('./routes/playerRoutes');
const registerGameRoutes = require('./routes/gameRoutes');
const registerBuildingRoutes = require('./routes/buildingRoutes');
const registerAdminRoutes = require('./routes/adminRoutes');
const registerVersionRoutes = require('./routes/versionRoutes');
const registerMetricsRoutes = require('./routes/metricsRoutes');
const registerClientEventsRoutes = require('./routes/clientEventsRoutes');
const gameStateService = require('./services/GameStateService');
const { BuildingConfig, initializeRuntimeConfig, getRuntimeConfigStatus } = require('./services/config/GameplayConfigRuntime');
const SecurityConfig = require('./config/SecurityConfig');
const VersionService = require('./services/VersionService');
const ObservabilityService = require('./services/ObservabilityService');
const ConfigReleaseService = require('./services/config/ConfigReleaseService');
const ConfigRuntimeLoader = require('./services/config/ConfigRuntimeLoader');
const EventService = require('./services/EventService');
const TerritoryService = require('./services/TerritoryService');
const CityService = require('./services/CityService');

const app = express();
const dbPath = process.env.DB_PATH || path.join(__dirname, 'civilization.db');
const db = new Database(dbPath);
const jwtSecret = SecurityConfig.resolveJwtSecret(process.env);
const corsOptions = SecurityConfig.resolveCorsOptions(process.env);

const repository = new GameStateRepository(db);
repository.init();

const authService = new AuthService(db, jwtSecret);
const logService = new LogService(db);
logService.initLogTable();
const authMiddleware = createAuthMiddleware(authService);
const adminMiddleware = createAdminMiddleware();
const versionService = new VersionService();
const observabilityService = new ObservabilityService();
const configReleaseService = ConfigReleaseService;
const configRuntimeLoader = ConfigRuntimeLoader;
const SKIP_API_LOG_PATHS = new Set([
  '/api/health',
  '/api/client-events',
  '/api/metrics',
  '/api/version',
  '/api/game/heartbeat',
  '/api/game/state',
  '/api/player/logs',
]);
const BACKGROUND_TICK_INTERVAL_MS = 5000;
const BACKGROUND_ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const BACKGROUND_ACTIVE_LIMIT = 25;
let backgroundTickRunning = false;

app.use(cors(corsOptions));
app.use(express.json({ limit: '8mb' }));

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
      observabilityService.recordApiRequest({
        method: req.method,
        path: req.path,
        body: req.body || {},
        statusCode: res.statusCode,
        response: responsePayload || {},
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      console.error('[logApi] failed:', error.message);
    }
  });
  next();
});

registerPlayerRoutes(app, { authMiddleware, authService, repository, gameStateService, logService });
registerGameRoutes(app, { authMiddleware, repository, gameStateService });
registerBuildingRoutes(app, { authMiddleware, repository, gameStateService });
registerAdminRoutes(app, { authMiddleware, adminMiddleware, configReleaseService, configRuntimeLoader });
registerVersionRoutes(app, { versionService });
registerClientEventsRoutes(app, { observabilityService });
registerMetricsRoutes(app, { authMiddleware, adminMiddleware, observabilityService });

app.get('/api/health', (req, res) => {
  const configRuntimeStatus = configReleaseService.getRuntimeStatus();
  const configRuntimePolicy = configReleaseService.resolveRuntimeGatePolicy();
  const configLoaderStatus = configRuntimeLoader.getRuntimeLoaderStatus();
  const gameplayConfigStatus = getRuntimeConfigStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    buildingConfigVersion: BuildingConfig.getVersion(),
    buildingConfigPath: BuildingConfig.getSourcePath(),
    appVersion: versionService.getVersionInfo(),
    observability: observabilityService.getHealthSummary(),
    configRuntime: {
      schema: configRuntimeStatus.schema,
      mode: configRuntimeStatus.mode,
      status: configRuntimeStatus.status,
      matchesCurrent: configRuntimeStatus.matchesCurrent,
      gatePolicy: {
        mode: configRuntimePolicy.mode,
        required: configRuntimePolicy.required,
        source: configRuntimePolicy.source,
      },
      activeRelease: configRuntimeStatus.activeRelease,
      drift: configRuntimeStatus.drift,
      errors: configRuntimeStatus.errors,
      warnings: configRuntimeStatus.warnings,
      loader: {
        schema: configLoaderStatus.schema,
        status: configLoaderStatus.status,
        ready: configLoaderStatus.ready,
        payloadIncluded: configLoaderStatus.payloadIncluded,
        registryCount: configLoaderStatus.registryCount,
        errors: configLoaderStatus.errors,
        warnings: configLoaderStatus.warnings,
      },
      gameplay: {
        schema: gameplayConfigStatus.schema,
        source: gameplayConfigStatus.source,
        bundleReady: gameplayConfigStatus.bundleReady,
        payloadIncluded: gameplayConfigStatus.payloadIncluded,
        release: gameplayConfigStatus.release,
        registryCount: gameplayConfigStatus.registryCount,
        errors: gameplayConfigStatus.errors,
        warnings: gameplayConfigStatus.warnings,
      },
    },
  });
});

setInterval(() => {
  if (backgroundTickRunning) return;
  backgroundTickRunning = true;
  try {
    const now = new Date();
    const activeSince = new Date(now.getTime() - BACKGROUND_ACTIVE_WINDOW_MS).toISOString();
    const gameStates = repository.findRecentlyActive(activeSince, BACKGROUND_ACTIVE_LIMIT);
    for (const rawState of gameStates) {
      const gameState = gameStateService.advanceRuntimeState(rawState, now);
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
const gameplayConfigRuntime = initializeRuntimeConfig();
if (!gameplayConfigRuntime.bundleReady && gameplayConfigRuntime.source === 'module-fallback') {
  console.warn(
    '[config-release] gameplay config is using module fallback; '
      + 'production should publish a matching active release before enabling required gate.',
  );
}
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
