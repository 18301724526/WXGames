const { BuildingConfig } = require('../services/config/GameplayConfigRuntime');
const BuildingState = require('../modules/BuildingState');
const BuildingActionService = require('../services/BuildingActionService');
const TutorialService = require('../services/TutorialService');
const BuildingUnlockService = require('../services/BuildingUnlockService');
const BuildingCostCalculator = require('../calculators/BuildingCostCalculator');
const CityService = require('../services/CityService');

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
    const rawState = repository.findByPlayerId(req.playerId);
    if (!rawState) return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
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
    return res.status(result.success ? 200 : 400).json({
      ...result,
      gameState: gameStateService.getClientGameStateFromNormalized
        ? gameStateService.getClientGameStateFromNormalized(gameState, responseProjection)
        : gameStateService.getClientGameState(gameState, responseProjection),
      tutorial: gameState.tutorial,
    });
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
