const path = require('path');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
require('dotenv').config();

const { openDatabase } = require('./services/DatabaseRuntime');
const AuthService = require('./services/authService');
const LogService = require('./services/logService');
const GameStateRepository = require('./repositories/GameStateRepository');
const createAuthMiddleware = require('./middleware/authMiddleware');
const createAdminMiddleware = require('./middleware/adminMiddleware');
const createMaintenanceMiddleware = require('./middleware/maintenanceMiddleware');
const registerPlayerRoutes = require('./routes/playerRoutes');
const registerGameRoutes = require('./routes/gameRoutes');
const registerBuildingRoutes = require('./routes/buildingRoutes');
const registerAdminRoutes = require('./routes/adminRoutes');
const registerOpsRoutes = require('./routes/opsRoutes');
const registerVersionRoutes = require('./routes/versionRoutes');
const registerMetricsRoutes = require('./routes/metricsRoutes');
const registerClientEventsRoutes = require('./routes/clientEventsRoutes');
const gameStateService = require('./services/GameStateService');
const TaskDefinitionService = require('./services/TaskDefinitionService');
const { SpawnLifecycleService } = require('./services/spawn/SpawnLifecycleService');
const PresenceService = require('./services/realtime/PresenceService');
const { BuildingConfig, initializeRuntimeConfig, getRuntimeConfigStatus } = require('./services/config/GameplayConfigRuntime');
const SecurityConfig = require('./config/SecurityConfig');
const VersionService = require('./services/VersionService');
const ObservabilityService = require('./services/ObservabilityService');
const { CommandIdempotencyStore } = require('./application/commands/CommandIdempotencyStore');
const { CommandExecutionPipeline } = require('./application/commands/CommandExecutionPipeline');
const OpsControlService = require('./services/OpsControlService');
const OpsAuthService = require('./services/OpsAuthService');
const ConfigReleaseService = require('./services/config/ConfigReleaseService');
const ConfigRuntimeLoader = require('./services/config/ConfigRuntimeLoader');

const app = express();
const dbPath = process.env.DB_PATH || path.join(__dirname, 'civilization.db');
const { db } = openDatabase(Database, dbPath);
const jwtSecret = SecurityConfig.resolveJwtSecret(process.env);
const corsOptions = SecurityConfig.resolveCorsOptions(process.env);

const repository = new GameStateRepository(db);
repository.init();

const authService = new AuthService(db, jwtSecret);
// Observability logs (api_logs / client_operation_logs) live in their OWN sqlite file:
// they are high-volume append-only data and must never share a write-lock domain with
// game state (a 1.2M-row api_logs table was the main "database is locked" contributor).
const observabilityDbPath =
  process.env.LOGS_DB_PATH || path.join(path.dirname(dbPath), 'observability.db');
const { db: observabilityDb } = openDatabase(Database, observabilityDbPath);
const logService = new LogService(observabilityDb);
logService.initLogTable();
logService.startCleanupInterval();
const presenceService = new PresenceService({
  repository,
  minPersistIntervalMs: process.env.PRESENCE_PERSIST_INTERVAL_MS,
  onlineWindowMs: process.env.PRESENCE_ONLINE_WINDOW_MS,
  maxEntries: process.env.PRESENCE_MAX_ENTRIES,
});
const authMiddleware = createAuthMiddleware(authService);
const spawnLifecycleService = new SpawnLifecycleService({
  repository,
  gameStateService,
});
const adminMiddleware = createAdminMiddleware();
const versionService = new VersionService();
const observabilityService = new ObservabilityService();
const commandIdempotencyStore = new CommandIdempotencyStore(db);
const commandExecutionPipeline = new CommandExecutionPipeline({
  repository,
  idempotencyStore: commandIdempotencyStore,
});
const commandEntryReporter = (report) => observabilityService.recordCommandEntry(report);
const opsAuthService = new OpsAuthService();
const configReleaseService = ConfigReleaseService;
const configRuntimeLoader = ConfigRuntimeLoader;
const opsControlService = new OpsControlService({
  repository,
  presenceService,
  observabilityService,
  configReleaseService,
  configRuntimeLoader,
  versionService,
  getGameplayConfigStatus: getRuntimeConfigStatus,
  getBuildingConfigVersion: () => BuildingConfig.getVersion(),
  getBuildingConfigPath: () => BuildingConfig.getSourcePath(),
});
const SKIP_API_LOG_PATHS = new Set([
  '/api/health',
  '/api/client-events',
  '/api/client-operation-logs',
  '/api/metrics',
  '/api/version',
  '/api/game/heartbeat',
  '/api/game/state',
  '/api/player/logs',
]);

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
      const clientRequestId = req.get?.('X-Client-Request-ID') || req.headers?.['x-client-request-id'] || '';
      const logBody = req.body && typeof req.body === 'object'
        ? {
          ...req.body,
          clientRequestId,
          ...(Array.isArray(req.commandReports) ? { commandReports: req.commandReports } : {}),
        }
        : {
          clientRequestId,
          ...(Array.isArray(req.commandReports) ? { commandReports: req.commandReports } : {}),
        };
      logService.logApi(
        req.playerId || null,
        req.deviceId || null,
        req.method,
        req.path,
        logBody,
        res.statusCode,
        responsePayload || {},
        Date.now() - startedAt,
      );
      observabilityService.recordApiRequest({
        method: req.method,
        path: req.path,
        body: logBody,
        statusCode: res.statusCode,
        response: responsePayload || {},
        durationMs: Date.now() - startedAt,
        requestId: clientRequestId,
      });
    } catch (error) {
      console.error('[logApi] failed:', error.message);
    }
  });
  next();
});

registerAdminRoutes(app, {
  authMiddleware,
  adminMiddleware,
  configReleaseService,
  configRuntimeLoader,
  commandEntryReporter,
});
registerVersionRoutes(app, { versionService });
registerClientEventsRoutes(app, {
  authMiddleware,
  logService,
  observabilityService,
  commandEntryReporter,
});
registerMetricsRoutes(app, { authMiddleware, adminMiddleware, observabilityService });
registerOpsRoutes(app, { opsAuthService, opsControlService, commandEntryReporter });

app.use(createMaintenanceMiddleware({ opsControlService }));

registerPlayerRoutes(app, {
  authMiddleware,
  authService,
  repository,
  gameStateService,
  logService,
  spawnLifecycleService,
  commandEntryReporter,
});
registerGameRoutes(app, {
  authMiddleware,
  repository,
  gameStateService,
  presenceService,
  commandEntryReporter,
  commandExecutionPipeline,
});
registerBuildingRoutes(app, {
  authMiddleware,
  repository,
  gameStateService,
  commandEntryReporter,
  commandExecutionPipeline,
});

app.get('/api/health', (req, res) => {
  const configRuntimeStatus = configReleaseService.getRuntimeStatus();
  const configRuntimePolicy = configReleaseService.resolveRuntimeGatePolicy();
  const configLoaderStatus = configRuntimeLoader.getRuntimeLoaderStatus();
  const gameplayConfigStatus = getRuntimeConfigStatus();
  const taskDefinitionsStatus = TaskDefinitionService.getDefinitionsSummary();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    buildingConfigVersion: BuildingConfig.getVersion(),
    buildingConfigPath: BuildingConfig.getSourcePath(),
    appVersion: versionService.getVersionInfo(),
    presence: presenceService.getOnlineSummary({ recentLimit: 12 }),
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
      taskDefinitions: taskDefinitionsStatus,
    },
  });
});

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
