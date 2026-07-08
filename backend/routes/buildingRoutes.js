const { BuildingConfig } = require('../services/config/GameplayConfigRuntime');
const BuildingState = require('../modules/BuildingState');
const BuildingActionService = require('../services/BuildingActionService');
const TutorialService = require('../services/TutorialService');
const BuildingUnlockService = require('../services/BuildingUnlockService');
const BuildingCostCalculator = require('../calculators/BuildingCostCalculator');
const CityService = require('../services/CityService');

function isPlayerStateLockTimeout(error = {}) {
  return error?.code === 'PLAYER_STATE_LOCK_TIMEOUT';
}

function buildPlayerStateBusyPayload(error = {}) {
  return {
    success: false,
    error: 'PLAYER_STATE_BUSY',
    message: '上一条操作仍在处理，请稍后重试',
    retryable: true,
    playerId: error.playerId || null,
  };
}

function withPlayerStateLock(repository, playerId, callback) {
  if (typeof repository?.withPlayerStateLock !== 'function') return callback();
  return repository.withPlayerStateLock(playerId, callback, {
    scope: 'building-build',
    waitMs: 20000,
    ttlMs: 60000,
    pollMs: 50,
  });
}

function registerBuildingRoutes(app, deps) {
  const { authMiddleware, repository, gameStateService } = deps;

  app.get('/api/buildings', authMiddleware, (req, res) => {
    const rawState = repository.findByPlayerId(req.playerId);
    if (!rawState) return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
    const gameState = gameStateService.normalizeState(rawState);
    const activeCityBuildings = CityService.getActiveCity(gameState)?.buildings || gameState.buildings;
    const buildings = Object.values(BuildingConfig.getAllBuildings()).map((config) => {
      const level = BuildingState.getLevel(activeCityBuildings, config.id);
      return {
        id: config.id,
        name: config.name,
        icon: config.icon,
        category: config.category,
        level,
        isBuilt: level > 0,
        isUnlocked: BuildingUnlockService.isUnlocked(config.id, gameState.currentEra, gameState),
        nextCost: BuildingCostCalculator.getNextActionCost(config.id, activeCityBuildings),
        maxLevel: config.maxLevel,
        maintenancePreview: BuildingConfig.getMaintenancePreview(config.id),
        scalePlanPreview: BuildingConfig.getScalePlanPreview(config.id),
      };
    });
    return res.json({ success: true, buildings });
  });

  app.post('/api/buildings/build', authMiddleware, (req, res) => {
    try {
      const response = withPlayerStateLock(repository, req.playerId, () => {
        const rawState = repository.findByPlayerId(req.playerId);
        if (!rawState) return { statusCode: 404, payload: { error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' } };
        const projection = repository.getClientProjectionForPlayer?.(req.playerId) || {};
        const gameState = gameStateService.applyOnlineProgress
          ? gameStateService.applyOnlineProgress(rawState, new Date(), {
            planningContext: projection,
            worldEncounterRepo: repository.worldEncounterRepo,
            sharedWorldEncounters: projection.sharedWorldEncounters,
          })
          : gameStateService.normalizeState(rawState);
        const tutorial = TutorialService.normalizeTutorialState(gameState.tutorial);
        const { buildingType } = req.body || {};
        const result = BuildingActionService.build(gameState, tutorial, buildingType);
        gameState.tutorial = result.tutorial || tutorial;
        repository.save(gameState);
        const responseProjection = repository.getClientProjectionForPlayer?.(req.playerId) || {};
        return {
          statusCode: result.success ? 200 : 400,
          payload: {
            ...result,
            gameState: gameStateService.getClientGameStateFromNormalized
              ? gameStateService.getClientGameStateFromNormalized(gameState, responseProjection)
              : gameStateService.getClientGameState(gameState, responseProjection),
            tutorial: gameState.tutorial,
          },
        };
      });
      return res.status(response.statusCode).json(response.payload);
    } catch (error) {
      if (isPlayerStateLockTimeout(error)) return res.status(409).json(buildPlayerStateBusyPayload(error));
      throw error;
    }
  });

  app.get('/api/buildings/effects', authMiddleware, (req, res) => {
    const rawState = repository.findByPlayerId(req.playerId);
    if (!rawState) return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
    const gameState = gameStateService.normalizeState(rawState);
    const effects = CityService.getActiveCity(gameState)?.buildingEffects || gameState.buildingEffects || {};
    return res.json({ success: true, effects });
  });
}

module.exports = registerBuildingRoutes;
