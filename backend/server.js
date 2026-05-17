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
const ResourceTickCalculator = require('./calculators/ResourceTickCalculator');
const MilitaryService = require('./services/MilitaryService');
const BuildingConfig = require('./config/BuildingConfig');
const VersionService = require('./services/VersionService');
const EventService = require('./services/EventService');

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

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

app.use((req, res, next) => {
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
  const gameStates = repository.findAll();
  for (const rawState of gameStates) {
    const gameState = gameStateService.normalizeState(rawState);
    const outputs = ResourceTickCalculator.calculateOutputs(gameState, gameState.buildingEffects);
    gameState.resources.food = Math.max(0, (gameState.resources.food || 0) + outputs.foodPerSecond);
    gameState.resources.knowledge = Math.max(0, (gameState.resources.knowledge || 0) + outputs.knowledgePerSecond);
    gameState.resources.wood = Math.max(0, (gameState.resources.wood || 0) + outputs.woodPerSecond);
    ResourceTickCalculator.applyPopulationGrowth(gameState, 1);
    MilitaryService.advanceTraining(gameState, 1);
    EventService.cleanupRuntimeState(gameState);
    EventService.maybeGenerateRegularEvent(gameState);
    gameState.updatedAt = new Date().toISOString();
    repository.save(gameState);
  }
}, 1000);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
