const { BuildingConfig } = require('../services/config/GameplayConfigRuntime');
const BuildingState = require('../modules/BuildingState');
const BuildingUnlockService = require('../services/BuildingUnlockService');
const BuildingCostCalculator = require('../calculators/BuildingCostCalculator');
const CityService = require('../services/CityService');
const { prepareCommandEntry, sendCommandEntryError } = require('../application/commands/CommandEntryContext');

function registerBuildingRoutes(app, deps) {
  const {
    authMiddleware,
    repository,
    gameStateService,
    commandEntryReporter,
    commandExecutionPipeline,
    commandDefinitionFactory,
  } = deps;

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
    const commandEntry = prepareCommandEntry(req, {
      type: 'build',
      inventoryId: 'server:buildings-build-legacy-route',
      reporter: commandEntryReporter,
      mode: 'blocking',
      requireClientIds: true,
      requireOwner: true,
    });
    if (!commandEntry.ok) return sendCommandEntryError(res, commandEntry);
    const response = commandExecutionPipeline.execute(
      commandEntry.envelope,
      commandDefinitionFactory.createGameActionDefinition('build'),
      { scope: 'building-build' },
    );
    return res.status(response.statusCode).json(response.payload);
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
